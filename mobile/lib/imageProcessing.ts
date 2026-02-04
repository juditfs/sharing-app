import * as ImageManipulator from 'expo-image-manipulator';

export async function processImage(imageUri: string) {
    // Process main image, thumbnail, and OG preview in parallel
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
        // Generate thumbnail for in-app display
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

    // Generate OG preview (1200x630) separately to handle cropping
    const ogPreview = await createOgPreview(imageUri);

    return {
        processedUri: processed.uri,
        thumbnailUri: thumbnail.uri,
        ogPreviewUri: ogPreview.uri,
    };
}

/**
 * Create an OG-compliant preview image (1200x630, 1.91:1 aspect ratio)
 * This resizes to 1200px width, then crops to 630px height from center
 */
async function createOgPreview(imageUri: string): Promise<{ uri: string }> {
    // First resize to 1200px width (maintains aspect ratio)
    const resized = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 1200 } }],
        {
            compress: 0.8,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: false,
        }
    );

    // Get image info to calculate crop
    const imageInfo = await ImageManipulator.manipulateAsync(
        resized.uri,
        [],
        { base64: false }
    );

    // If height is already close to 630, just return
    // Otherwise, crop from center to get 1200x630
    const targetHeight = 630;
    const currentHeight = imageInfo.height;

    if (currentHeight <= targetHeight) {
        // Image is already shorter than target, return as-is
        return { uri: resized.uri };
    }

    // Crop from center vertically
    const cropY = Math.floor((currentHeight - targetHeight) / 2);

    const cropped = await ImageManipulator.manipulateAsync(
        resized.uri,
        [
            {
                crop: {
                    originX: 0,
                    originY: cropY,
                    width: 1200,
                    height: targetHeight,
                },
            },
        ],
        {
            compress: 0.8,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: false,
        }
    );

    return { uri: cropped.uri };
}
