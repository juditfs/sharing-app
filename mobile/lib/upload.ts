import { supabase } from './supabase';
import { getSession } from './auth';

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
): Promise<{ shortCode: string; shareUrl: string }> {
    // Validate session exists and is valid
    const session = await getSession();
    if (!session) {
        throw new Error('No active session');
    }

    // Check if session is expired or about to expire (within 60 seconds)
    const expiresAt = session.expires_at ? new Date(session.expires_at * 1000) : null;
    const now = new Date();

    if (expiresAt && expiresAt.getTime() - now.getTime() < 60000) {
        console.log('Session expired or expiring soon, refreshing...');
        const { data, error } = await supabase.auth.refreshSession();
        if (error || !data.session) {
            console.error('Session refresh failed:', error);
            throw new Error('Session expired. Please restart the app.');
        }
        console.log('Session refreshed successfully');
    }

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
        throw error;
    }

    return data as { shortCode: string; shareUrl: string };
}
