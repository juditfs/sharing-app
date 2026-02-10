import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';
import { decryptImage } from './crypto';

/**
 * React Native-safe base64 decoder (avoids atob which is unreliable in Hermes)
 * Handles = padding correctly
 */
function base64ToBytes(base64: string): Uint8Array {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const lookup = new Uint8Array(256);
    for (let i = 0; i < chars.length; i++) {
        lookup[chars.charCodeAt(i)] = i;
    }

    const len = base64.length;
    let padding = 0;
    if (base64.endsWith('==')) padding = 2;
    else if (base64.endsWith('=')) padding = 1;

    const bytes = new Uint8Array((len * 3) / 4 - padding);
    let p = 0;

    for (let i = 0; i < len; i += 4) {
        const encoded1 = lookup[base64.charCodeAt(i)];
        const encoded2 = lookup[base64.charCodeAt(i + 1)];
        const encoded3 = lookup[base64.charCodeAt(i + 2)];
        const encoded4 = lookup[base64.charCodeAt(i + 3)];

        bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
        if (p < bytes.length) bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
        if (p < bytes.length) bytes[p++] = ((encoded3 & 3) << 6) | encoded4;
    }

    return bytes;
}

const THUMBNAIL_CACHE_DIR = `${FileSystem.cacheDirectory}decrypted_thumbnails/`;

/**
 * Ensures the thumbnail cache directory exists
 */
async function ensureCacheDir() {
    const dirInfo = await FileSystem.getInfoAsync(THUMBNAIL_CACHE_DIR);
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(THUMBNAIL_CACHE_DIR, { intermediates: true });
    }
}

interface DecryptProps {
    path: string;
    encryptionKey: string;
}

/**
 * Downloads, decrypts and caches a private thumbnail. 
 * Returns the local file URI.
 */
export async function getDecryptedThumbnailUri({ path, encryptionKey }: DecryptProps): Promise<string | null> {
    try {
        await ensureCacheDir();

        // The filename in cache is based on the storage path (unique enough)
        const safeName = path.replace(/\//g, '_');
        const localUri = `${THUMBNAIL_CACHE_DIR}${safeName}`;

        // 1. Check if already in cache
        const fileInfo = await FileSystem.getInfoAsync(localUri);
        if (fileInfo.exists) {
            return localUri;
        }

        // 2. Download from storage
        const { data, error } = await supabase.storage
            .from('photos')
            .download(path);

        if (error || !data) {
            console.error('getDecryptedThumbnailUri: download failed', error);
            return null;
        }

        // 3. Decrypt
        const buffer = await new Response(data).arrayBuffer();
        const encryptedBytes = new Uint8Array(buffer);
        const decryptedBytes = await decryptImage(encryptedBytes, encryptionKey);

        // 4. Save to local file system
        const { bytesToBase64 } = require('./crypto');
        const base64 = bytesToBase64(decryptedBytes);

        await FileSystem.writeAsStringAsync(localUri, base64, {
            encoding: 'base64'
        });

        return localUri;
    } catch (e) {
        console.error('getDecryptedThumbnailUri error:', e);
        return null;
    }
}

interface RestoreProps {
    path: string;
    encryptionKey: string;
}

/**
 * Restores a missing public thumbnail from a private one.
 */
export async function restorePublicThumbnail({ path, encryptionKey }: RestoreProps): Promise<string | null> {
    try {
        const fileUri = await getDecryptedThumbnailUri({ path, encryptionKey });
        if (!fileUri) {
            return null;
        }

        const base64 = await FileSystem.readAsStringAsync(fileUri!, {
            encoding: 'base64'
        });

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return null;
        }

        const filename = `${user.id}/${Date.now()}_restored.jpg`;

        // Upload Uint8Array directly - React Native-safe, avoids Blob
        const { error: uploadError } = await supabase.storage
            .from('public-thumbnails')
            .upload(filename, base64ToBytes(base64), {
                contentType: 'image/jpeg',
                upsert: true
            });

        if (uploadError) {
            console.error('Failed to restore thumbnail:', uploadError);
            return null;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('public-thumbnails')
            .getPublicUrl(filename);

        return publicUrl;
    } catch (e) {
        console.error('Failed to restore thumbnail:', e);
        return null;
    }
}
