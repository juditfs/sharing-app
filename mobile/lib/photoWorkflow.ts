import { processImage } from './imageProcessing';
import { generateEncryptionKey, encryptImage } from './crypto';
import { uploadEncryptedImage, uploadPublicThumbnail, createShareLink, LinkSettings } from './upload';

/**
 * Process, encrypt, and upload a photo, returning the shareable URL
 * 
 * This function encapsulates the complete workflow:
 * 1. Process image (resize, strip EXIF)
 * 2. Generate encryption key
 * 3. Encrypt photo and thumbnail
 * 4. Upload to Supabase Storage
 * 5. Upload public thumbnail for WhatsApp previews
 * 6. Create shareable link via Edge Function
 * 
 * @param imageUri - URI of the image to process
 * @param settings - Optional link settings (expiry, download, share text, public thumbnail)
 * @returns Share URL for the encrypted photo
 */
export async function processAndUploadPhoto(
    imageUri: string,
    settings?: LinkSettings
): Promise<{ shareUrl: string; linkId: string; shortCode: string; thumbnailUri: string; publicThumbnailUrl?: string }> {
    const startTime = Date.now();
    console.log('📸 [PERF] Starting photo workflow');

    // Process image (resize, strip EXIF)
    const t1 = Date.now();
    const { processedUri, thumbnailUri, ogPreviewUri } = await processImage(imageUri);
    console.log(`⏱️  [PERF] Image processing (EXIF + resize + thumbnail + OG): ${Date.now() - t1}ms`);

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

    // Upload OG preview (1200x630) for WhatsApp/social previews
    let publicThumbnailUrl: string | undefined;
    if (ogPreviewUri) {
        const t5 = Date.now();
        try {
            publicThumbnailUrl = await uploadPublicThumbnail(ogPreviewUri);
            console.log(`⏱️  [PERF] Upload OG preview (1200x630): ${Date.now() - t5}ms`);
        } catch (error) {
            console.warn('Failed to upload OG preview:', error);
            // Continue without public thumbnail
        }
    }

    // Create shareable link
    const t6 = Date.now();
    const { shareUrl, linkId, shortCode } = await createShareLink(
        photoPath,
        thumbnailPath,
        encryptionKey,
        { ...settings, publicThumbnailUrl }
    );
    console.log(`⏱️  [PERF] Create share link (Edge Function): ${Date.now() - t6}ms`);

    const totalTime = Date.now() - startTime;
    console.log(`✅ [PERF] Total workflow time: ${totalTime}ms (${(totalTime / 1000).toFixed(1)}s)`);

    return { shareUrl, linkId, shortCode, thumbnailUri, publicThumbnailUrl };
}
