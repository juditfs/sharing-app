import * as ImageManipulator from 'expo-image-manipulator';

export async function processImage(imageUri: string) {
    // Process main image and thumbnail in parallel
    const [processed, thumbnail] = await Promise.all([
        // Resize and strip EXIF data
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
        // Generate thumbnail
        ImageManipulator.manipulateAsync(
            imageUri,
            [
                { resize: { width: 400 } },
            ],
            {
                compress: 0.7,
                format: ImageManipulator.SaveFormat.JPEG,
                base64: false,
            }
        ),
    ]);

    return {
        processedUri: processed.uri,
        thumbnailUri: thumbnail.uri,
    };
}
