import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';
import { decryptImage } from './crypto';

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
        if (!fileUri) return null;

        const base64 = await FileSystem.readAsStringAsync(fileUri!, {
            encoding: 'base64'
        });

        const res = await fetch(`data:image/jpeg;base64,${base64}`);
        const blob = await res.blob();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const filename = `${user.id}/${Date.now()}_restored.jpg`;

        const { error: uploadError } = await supabase.storage
            .from('public-thumbnails')
            .upload(filename, blob, {
                contentType: 'image/jpeg',
                upsert: true
            });

        if (uploadError) return null;

        const { data: { publicUrl } } = supabase.storage
            .from('public-thumbnails')
            .getPublicUrl(filename);

        return publicUrl;
    } catch (e) {
        return null;
    }
}
