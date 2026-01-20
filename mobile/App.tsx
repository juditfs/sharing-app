import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Button, Text, ActivityIndicator, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { signInAnonymously } from './lib/auth';
import { generateEncryptionKey, encryptImage } from './lib/crypto';
import { processImage } from './lib/imageProcessing';
import { uploadEncryptedImage, createShareLink } from './lib/upload';

export default function App() {
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  useEffect(() => {
    // Sign in anonymously on app launch
    signInAnonymously().catch(console.error);
  }, []);

  const handleTakePhoto = async () => {
    try {
      setLoading(true);

      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Camera access is needed to take photos.');
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled) {
        return;
      }

      const imageUri = result.assets[0].uri;

      // Process image (resize, strip EXIF)
      const { processedUri, thumbnailUri } = await processImage(imageUri);

      // Generate encryption key
      const encryptionKey = await generateEncryptionKey();

      // Encrypt images
      const encryptedPhotoUri = await encryptImage(processedUri, encryptionKey);
      const encryptedThumbUri = thumbnailUri
        ? await encryptImage(thumbnailUri, encryptionKey)
        : null;

      // Upload to Supabase
      const { photoPath, thumbnailPath } = await uploadEncryptedImage(
        encryptedPhotoUri,
        encryptedThumbUri
      );

      // Create shareable link
      const { shareUrl } = await createShareLink(photoPath, thumbnailPath, encryptionKey);

      setShareUrl(shareUrl);
      Alert.alert('Success!', 'Your photo has been encrypted and uploaded.');
    } catch (error: any) {
      console.error('Error:', error);

      // Provide specific error messages based on error type
      if (error?.message?.includes('permission') || error?.message?.includes('Permission')) {
        Alert.alert('Permission Denied', 'Camera or photo library access is required to share photos.');
      } else if (error?.message?.includes('network') || error?.message?.includes('Network') || error?.code === 'NETWORK_ERROR') {
        Alert.alert('Network Error', 'Please check your internet connection and try again.');
      } else if (error?.message?.includes('encrypt') || error?.message?.includes('decrypt')) {
        Alert.alert('Encryption Error', 'Failed to encrypt photo. Please try again.');
      } else if (error?.message?.includes('upload') || error?.message?.includes('storage')) {
        Alert.alert('Upload Failed', 'Could not upload photo to server. Please try again.');
      } else {
        Alert.alert('Error', `Failed to process photo: ${error?.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePickPhoto = async () => {
    try {
      setLoading(true);

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Photo library access is needed to select photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled) return;

      const imageUri = result.assets[0].uri;
      const { processedUri, thumbnailUri } = await processImage(imageUri);
      const encryptionKey = await generateEncryptionKey();
      const encryptedPhotoUri = await encryptImage(processedUri, encryptionKey);
      const encryptedThumbUri = thumbnailUri ? await encryptImage(thumbnailUri, encryptionKey) : null;

      const { photoPath, thumbnailPath } = await uploadEncryptedImage(encryptedPhotoUri, encryptedThumbUri);
      const { shareUrl } = await createShareLink(photoPath, thumbnailPath, encryptionKey);

      setShareUrl(shareUrl);
      Alert.alert('Success!', 'Your photo has been encrypted and uploaded.');
    } catch (error: any) {
      console.error('Error:', error);
      Alert.alert('Error', `Failed to process photo: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (shareUrl) {
      await Clipboard.setStringAsync(shareUrl);
      Alert.alert('Copied!', 'Share link copied to clipboard.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sharene</Text>
      <Text style={styles.subtitle}>Encrypted Photo Sharing</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <View style={styles.buttonContainer}>
          <Button title="Take Photo" onPress={handleTakePhoto} />
          <View style={{ height: 10 }} />
          <Button title="Choose from Library" onPress={handlePickPhoto} />

          {shareUrl && (
            <View style={styles.linkContainer}>
              <Text style={styles.linkText}>{shareUrl}</Text>
              <Button title="Copy Link" onPress={handleCopyLink} />
            </View>
          )}
        </View>
      )}

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
  },
  linkContainer: {
    marginTop: 30,
    padding: 15,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    width: '100%',
  },
  linkText: {
    fontSize: 14,
    marginBottom: 10,
    textAlign: 'center',
  },
});

