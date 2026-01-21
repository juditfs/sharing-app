import { supabase } from './supabase';

export interface LinkMetadata {
    shortCode: string;
    photoUrl: string;
    thumbnailUrl: string | null;
    shareText: string;
    allowDownload: boolean;
    isRevoked: boolean;
    expiresAt: string | null;
}

export interface LinkData extends LinkMetadata {
    encryptionKey: string;
    signedPhotoUrl: string;
    signedThumbnailUrl: string | null;
}

/**
 * Fetch link metadata and encryption key via Edge Function
 */
export async function getLinkData(shortCode: string): Promise<LinkData> {
    const { data, error } = await supabase.functions.invoke('get-link', {
        body: { shortCode, action: 'metadata' },
    });

    if (error) {
        throw new Error(error.message);
    }

    if (!data || data.error) {
        throw new Error(data?.error || 'Link not found');
    }

    // Fetch encryption key in separate request (security: split payload)
    const { data: keyData, error: keyError } = await supabase.functions.invoke('get-link', {
        body: { shortCode, action: 'key' },
    });

    if (keyError) {
        throw new Error(keyError.message);
    }

    return {
        ...data.metadata,
        encryptionKey: keyData.key,
        signedPhotoUrl: data.signedUrl,
        signedThumbnailUrl: data.signedThumbnailUrl,
    };
}

/**
 * Download encrypted photo from signed URL
 */
export async function downloadEncryptedPhoto(signedUrl: string): Promise<ArrayBuffer> {
    const response = await fetch(signedUrl);

    if (!response.ok) {
        throw new Error('Failed to download photo');
    }

    return response.arrayBuffer();
}
