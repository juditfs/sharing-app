import { Alert } from 'react-native';

/**
 * Centralized error handling for photo operations
 * Provides user-friendly error messages based on error type
 */
export function handlePhotoError(error: any) {
    console.error('Photo error:', error);

    // Provide specific error messages based on error type
    if (error?.message?.includes('permission') || error?.message?.includes('Permission')) {
        Alert.alert(
            'Permission Denied',
            'Camera or photo library access is required to share photos.'
        );
    } else if (
        error?.message?.includes('network') ||
        error?.message?.includes('Network') ||
        error?.code === 'NETWORK_ERROR'
    ) {
        Alert.alert(
            'Network Error',
            'Please check your internet connection and try again.'
        );
    } else if (error?.message?.includes('encrypt') || error?.message?.includes('decrypt')) {
        Alert.alert(
            'Encryption Error',
            'Failed to encrypt photo. Please try again.'
        );
    } else if (error?.message?.includes('upload') || error?.message?.includes('storage')) {
        Alert.alert(
            'Upload Failed',
            'Could not upload photo to server. Please try again.'
        );
    } else {
        Alert.alert('Error', `Failed to process photo: ${error?.message || 'Unknown error'}`);
    }
}
