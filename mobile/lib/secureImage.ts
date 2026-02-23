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

function normalizePhotosPath(path: string): string {
    if (path.startsWith('/photos/')) return path.slice('/photos/'.length);
    if (path.startsWith('photos/')) return path.slice('photos/'.length);
    if (!path.startsWith('http')) return path;
    try {
        const url = new URL(path);
        const marker = '/storage/v1/object/';
        const idx = url.pathname.indexOf(marker);
        if (idx === -1) return path;
        const after = url.pathname.slice(idx + marker.length); // public/photos/x or sign/photos/x
        const parts = after.split('/');
        if (parts.length < 3) return path;
        // parts: [public|sign, bucket, ...objectPath]
        return decodeURIComponent(parts.slice(2).join('/'));
    } catch {
        return path;
    }
}

function getCandidatePhotoPaths(path: string): string[] {
    const normalized = normalizePhotosPath(path);
    const variants = [
        normalized,
        normalized.startsWith('/photos/') ? normalized.slice('/photos/'.length) : normalized,
        normalized.startsWith('photos/') ? normalized.slice('photos/'.length) : normalized,
        normalized.startsWith('/') ? normalized.slice(1) : normalized,
    ].filter(Boolean);
    return [...new Set(variants)];
}

function isLikelyImageBytes(bytes: Uint8Array): boolean {
    // JPEG
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
    // PNG
    if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true;
    // WEBP: "RIFF....WEBP"
    if (
        bytes.length >= 12 &&
        bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    ) return true;
    return false;
}

function looksLikeJsonError(bytes: Uint8Array): boolean {
    if (bytes.length < 2 || bytes[0] !== 0x7b) return false; // '{'
    try {
        const probe = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.length, 220)));
        return probe.includes('"error"') || probe.includes('"statusCode"') || probe.includes('"message"');
    } catch {
        return false;
    }
}

function getJsonPayloadHint(bytes: Uint8Array): string | null {
    if (bytes.length < 2 || bytes[0] !== 0x7b) return null; // '{'
    try {
        const sample = bytes.slice(0, Math.min(bytes.length, 2000));
        let text = '';
        for (let i = 0; i < sample.length; i++) text += String.fromCharCode(sample[i]);
        const obj = JSON.parse(text);
        if (obj && typeof obj === 'object') {
            if ('uri' in obj && 'type' in obj) {
                return 'stored JSON file descriptor instead of encrypted bytes';
            }
            if ('error' in obj || 'message' in obj || 'statusCode' in obj) {
                return 'storage returned JSON error payload';
            }
        }
        return 'JSON payload';
    } catch {
        return null;
    }
}

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
        const candidatePaths = getCandidatePhotoPaths(path);
        await ensureCacheDir();

        // The filename in cache is based on the storage path (unique enough)
        const safeName = candidatePaths[0].replace(/\//g, '_');
        const localUri = `${THUMBNAIL_CACHE_DIR}${safeName}`;

        // 1. Check if already in cache
        const fileInfo = await FileSystem.getInfoAsync(localUri);
        if (fileInfo.exists) {
            return localUri;
        }

        // 2. Download from storage (retry across known path formats)
        let decryptedBytes: Uint8Array | null = null;
        let lastErr: unknown = null;

        for (const candidatePath of candidatePaths) {
            const { data, error } = await supabase.storage
                .from('photos')
                .download(candidatePath);

            if (error || !data) {
                lastErr = error ?? new Error('No data');
                continue;
            }

            const buffer = await new Response(data).arrayBuffer();
            const encryptedBytes = new Uint8Array(buffer);

            // Some storage failures come back as JSON blobs; treat that as miss and retry variant.
            if (looksLikeJsonError(encryptedBytes)) {
                lastErr = new Error('Storage returned JSON error payload');
                continue;
            }

            const jsonHint = getJsonPayloadHint(encryptedBytes);
            if (jsonHint) {
                lastErr = new Error(`Thumbnail object is not decryptable (${jsonHint})`);
                continue;
            }

            try {
                decryptedBytes = await decryptImage(encryptedBytes, encryptionKey);
                break;
            } catch (e) {
                // Some historical records may contain unencrypted image bytes in thumbnail_url.
                if (isLikelyImageBytes(encryptedBytes)) {
                    decryptedBytes = encryptedBytes;
                    break;
                }
                lastErr = e;
            }
        }

        if (!decryptedBytes) {
            console.warn('getDecryptedThumbnailUri: unable to fetch/decrypt thumbnail', {
                path,
                candidatePaths,
                error: String(lastErr ?? 'unknown'),
            });
            return null;
        }

        // 4. Save to local file system
        const { bytesToBase64 } = require('./crypto');
        const base64 = bytesToBase64(decryptedBytes);

        await FileSystem.writeAsStringAsync(localUri, base64, {
            encoding: 'base64'
        });

        return localUri;
    } catch (e) {
        console.warn('getDecryptedThumbnailUri failed:', e);
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
            console.warn('Failed to restore thumbnail upload:', uploadError);
            return null;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('public-thumbnails')
            .getPublicUrl(filename);

        return publicUrl;
    } catch (e) {
        console.warn('Failed to restore thumbnail:', e);
        return null;
    }
}
