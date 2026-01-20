import * as ImageManipulator from 'expo-image-manipulator';

export async function processImage(imageUri: string) {
    // Resize and strip EXIF data
    const processed = await ImageManipulator.manipulateAsync(
        imageUri,
        [
            { resize: { width: 2048 } }, // Max width 2048px, maintains aspect ratio
        ],
        {
            compress: 0.8,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: false,
        }
    );

    // Generate thumbnail
    const thumbnail = await ImageManipulator.manipulateAsync(
        imageUri,
        [
            { resize: { width: 400 } },
        ],
        {
            compress: 0.7,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: false,
        }
    );

    return {
        processedUri: processed.uri,
        thumbnailUri: thumbnail.uri,
    };
}
