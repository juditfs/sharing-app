import { supabase } from './supabase';
import { getSession } from './auth';
import * as FileSystem from 'expo-file-system/legacy';

export async function uploadEncryptedImage(
    encryptedPhoto: Uint8Array,
    encryptedThumbnail: Uint8Array | null
): Promise<{ photoPath: string; thumbnailPath: string | null }> {
    const session = await getSession();
    if (!session) {
        throw new Error('No active session');
    }

    // Generate unique file paths
    const timestamp = Date.now();
    const userId = session.user.id;
    const photoPath = `${userId}/${timestamp}_photo.enc`;
    const thumbnailPath = encryptedThumbnail ? `${userId}/${timestamp}_thumb.enc` : null;

    // Upload photo directly from buffer
    console.log('Uploading photo to:', photoPath);
    console.log('Photo buffer size:', encryptedPhoto.length);

    const { error: photoError } = await supabase.storage
        .from('photos')
        .upload(photoPath, encryptedPhoto, {
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
    if (encryptedThumbnail && thumbnailPath) {
        await supabase.storage
            .from('photos')
            .upload(thumbnailPath, encryptedThumbnail, {
                contentType: 'application/octet-stream',
                cacheControl: '3600',
                upsert: false,
            });
    }

    return { photoPath, thumbnailPath };
}

/**
 * Upload unencrypted thumbnail to public bucket for WhatsApp/social previews
 */
export async function uploadPublicThumbnail(
    thumbnailUri: string
): Promise<string> {
    const session = await getSession();
    if (!session) {
        throw new Error('No active session');
    }

    const timestamp = Date.now();
    const userId = session.user.id;
    const publicPath = `${userId}/${timestamp}_preview.jpg`;

    // Read thumbnail file as base64
    const base64 = await FileSystem.readAsStringAsync(thumbnailUri, {
        encoding: 'base64',
    });

    // Convert base64 to Uint8Array
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    console.log('Uploading public thumbnail to:', publicPath);

    const { error } = await supabase.storage
        .from('public-thumbnails')
        .upload(publicPath, bytes, {
            contentType: 'image/jpeg',
            cacheControl: '31536000', // 1 year cache
            upsert: false,
        });

    if (error) {
        console.error('Public thumbnail upload error:', error);
        throw new Error(`Public thumbnail upload failed: ${error.message}`);
    }

    // Get public URL
    const { data } = supabase.storage
        .from('public-thumbnails')
        .getPublicUrl(publicPath);

    console.log('Public thumbnail URL:', data.publicUrl);
    return data.publicUrl;
}

export interface LinkSettings {
    expiry?: '1h' | '1d' | '1w' | '1m' | '1y' | string;
    allowDownload?: boolean;
    shareText?: string;
    publicThumbnailUrl?: string;
}

export async function createShareLink(
    photoPath: string,
    thumbnailPath: string | null,
    encryptionKey: string,
    settings?: LinkSettings
): Promise<{ shortCode: string; shareUrl: string; linkId: string }> {
    // Always refresh session to ensure we have a valid token
    console.log('Refreshing session before create-link...');
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

    if (refreshError || !refreshData.session) {
        console.error('Session refresh failed:', refreshError);
        // Try getting existing session
        const session = await getSession();
        if (!session) {
            throw new Error('No active session. Please restart the app.');
        }
        console.log('Using existing session');
    } else {
        console.log('Session refreshed successfully');
    }

    console.log('Calling create-link with publicThumbnailUrl:', settings?.publicThumbnailUrl);

    const { data, error } = await supabase.functions.invoke('create-link', {
        body: {
            photoUrl: photoPath,
            thumbnailUrl: thumbnailPath,
            encryptionKey,
            expiry: settings?.expiry,
            allowDownload: settings?.allowDownload,
            shareText: settings?.shareText,
            publicThumbnailUrl: settings?.publicThumbnailUrl,
        },
    });

    if (error) {
        console.error('Edge Function error:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        throw error;
    }

    console.log('Create-link response:', data);
    return data as { shortCode: string; shareUrl: string; linkId: string };
}
