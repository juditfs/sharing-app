import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';
import { getSession } from './auth';

export async function uploadEncryptedImage(
    encryptedUri: string,
    thumbnailUri: string | null
): Promise<{ photoPath: string; thumbnailPath: string | null }> {
    const session = await getSession();
    if (!session) {
        throw new Error('No active session');
    }

    // Generate unique file paths
    const timestamp = Date.now();
    const userId = session.user.id;
    const photoPath = `${userId}/${timestamp}_photo.enc`;
    const thumbnailPath = thumbnailUri ? `${userId}/${timestamp}_thumb.enc` : null;

    // Read encrypted file as ArrayBuffer
    const photoData = await FileSystem.readAsStringAsync(encryptedUri, {
        encoding: 'base64',
    });
    const photoBuffer = Uint8Array.from(atob(photoData), c => c.charCodeAt(0));

    // Upload photo
    console.log('Uploading photo to:', photoPath);
    console.log('Photo buffer size:', photoBuffer.length);

    const { error: photoError } = await supabase.storage
        .from('photos')
        .upload(photoPath, photoBuffer, {
            contentType: 'application/octet-stream',
            cacheControl: '3600',
            upsert: false,
        });

    if (photoError) {
        console.error('Photo upload error:', photoError);
        throw new Error(`Upload failed: ${photoError.message}`);
    }

    console.log('Photo uploaded successfully');

    // Upload thumbnail if exists
    if (thumbnailUri && thumbnailPath) {
        const thumbData = await FileSystem.readAsStringAsync(thumbnailUri, {
            encoding: 'base64',
        });
        const thumbBuffer = Uint8Array.from(atob(thumbData), c => c.charCodeAt(0));

        await supabase.storage
            .from('photos')
            .upload(thumbnailPath, thumbBuffer, {
                contentType: 'application/octet-stream',
                cacheControl: '3600',
                upsert: false,
            });
    }

    return { photoPath, thumbnailPath };
}

export async function createShareLink(
    photoPath: string,
    thumbnailPath: string | null,
    encryptionKey: string
): Promise<{ shortCode: string; shareUrl: string }> {
    const session = await getSession();
    if (!session) {
        throw new Error('No active session');
    }

    const { data, error } = await supabase.functions.invoke('create-link', {
        body: {
            photoUrl: photoPath,
            thumbnailUrl: thumbnailPath,
            encryptionKey,
        },
    });

    if (error) {
        throw error;
    }

    return data as { shortCode: string; shareUrl: string };
}
