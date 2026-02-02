import { processImage } from './imageProcessing';
import { generateEncryptionKey, encryptImage } from './crypto';
import { uploadEncryptedImage, createShareLink, LinkSettings } from './upload';

/**
 * Process, encrypt, and upload a photo, returning the shareable URL
 * 
 * This function encapsulates the complete workflow:
 * 1. Process image (resize, strip EXIF)
 * 2. Generate encryption key
 * 3. Encrypt photo and thumbnail
 * 4. Upload to Supabase Storage
 * 5. Create shareable link via Edge Function
 * 
 * @param imageUri - URI of the image to process
 * @param settings - Optional link settings (expiry, download, share text, public thumbnail)
 * @returns Share URL for the encrypted photo
 */
export async function processAndUploadPhoto(
    imageUri: string,
    settings?: LinkSettings
): Promise<string> {
    const startTime = Date.now();
    console.log('📸 [PERF] Starting photo workflow');

    // Process image (resize, strip EXIF)
    const t1 = Date.now();
    const { processedUri, thumbnailUri } = await processImage(imageUri);
    console.log(`⏱️  [PERF] Image processing (EXIF + resize + thumbnail): ${Date.now() - t1}ms`);

    // Generate encryption key
    const t2 = Date.now();
    const encryptionKey = await generateEncryptionKey();
    console.log(`⏱️  [PERF] Key generation: ${Date.now() - t2}ms`);

    // Encrypt images
    const t3 = Date.now();
    const encryptedPhotoBuffer = await encryptImage(processedUri, encryptionKey);
    const encryptedThumbBuffer = thumbnailUri
        ? await encryptImage(thumbnailUri, encryptionKey)
        : null;
    console.log(`⏱️  [PERF] Encryption (photo + thumbnail): ${Date.now() - t3}ms`);

    // Upload to Supabase
    const t4 = Date.now();
    const { photoPath, thumbnailPath } = await uploadEncryptedImage(
        encryptedPhotoBuffer,
        encryptedThumbBuffer
    );
    console.log(`⏱️  [PERF] Upload to Supabase: ${Date.now() - t4}ms`);

    // Create shareable link
    const t5 = Date.now();
    const { shareUrl } = await createShareLink(photoPath, thumbnailPath, encryptionKey, settings);
    console.log(`⏱️  [PERF] Create share link (Edge Function): ${Date.now() - t5}ms`);

    const totalTime = Date.now() - startTime;
    console.log(`✅ [PERF] Total workflow time: ${totalTime}ms (${(totalTime / 1000).toFixed(1)}s)`);

    return shareUrl;
}
