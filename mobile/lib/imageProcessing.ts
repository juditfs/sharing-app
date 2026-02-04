import * as ImageManipulator from 'expo-image-manipulator';

export async function processImage(imageUri: string) {
    // Process main image and thumbnail in parallel
    const [processed, thumbnail] = await Promise.all([
        // Resize and strip EXIF data for full image
        ImageManipulator.manipulateAsync(
            imageUri,
            [
                { resize: { width: 2048 } }, // Max width 2048px, maintains aspect ratio
            ],
            {
                compress: 0.8,
                format: ImageManipulator.SaveFormat.JPEG,
                base64: false,
            }
        ),
        // Generate thumbnail - used for both in-app display and OG preview
        // Using 600px width for better quality on social media
        ImageManipulator.manipulateAsync(
            imageUri,
            [
                { resize: { width: 600 } },
            ],
            {
                compress: 0.8,
                format: ImageManipulator.SaveFormat.JPEG,
                base64: false,
            }
        ),
    ]);

    return {
        processedUri: processed.uri,
        thumbnailUri: thumbnail.uri,
        // Use the same thumbnail for OG preview (aspect ratio doesn't need to be exact)
        ogPreviewUri: thumbnail.uri,
    };
}
