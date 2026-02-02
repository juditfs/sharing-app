import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Button, Text, ActivityIndicator, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { signInAnonymously } from './lib/auth';
import { handlePhotoError } from './lib/errorHandling';
import { processAndUploadPhoto } from './lib/photoWorkflow';

export default function App() {
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // DEBUG: Check environment and network
    const checkNetwork = async () => {
      try {
        console.log('DEBUG: Checking Supabase connection...');
        const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
        console.log('DEBUG: URL configured:', url ? 'YES' : 'NO');

        if (url) {
          const resp = await fetch(`${url}/auth/v1/health`);
          console.log('DEBUG: Health status:', resp.status);
          const text = await resp.text();
          console.log('DEBUG: Health response body starts with:', text.substring(0, 100));
        }
      } catch (e) {
        console.error('DEBUG: Network check failed:', e);
      }
    };
    checkNetwork();

    // Sign in anonymously on app launch
    signInAnonymously()
      .then(() => {
        console.log('Anonymous sign-in successful');
        setSessionReady(true);
      })
      .catch((err) => {
        console.error('Anonymous sign-in failed:', err);
        Alert.alert('Authentication Error', 'Failed to initialize session. Please restart the app.');
      });
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

      // Process and upload using shared workflow
      const shareUrl = await processAndUploadPhoto(result.assets[0].uri);

      setShareUrl(shareUrl);
      Alert.alert('Success!', 'Your photo has been encrypted and uploaded.');
    } catch (error: any) {
      handlePhotoError(error);
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

      // Process and upload using shared workflow
      const shareUrl = await processAndUploadPhoto(result.assets[0].uri);

      setShareUrl(shareUrl);
      Alert.alert('Success!', 'Your photo has been encrypted and uploaded.');
    } catch (error: any) {
      handlePhotoError(error);
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
          <Button
            title={sessionReady ? "Take Photo" : "Initializing..."}
            onPress={handleTakePhoto}
            disabled={!sessionReady}
          />
          <View style={{ height: 10 }} />
          <Button
            title={sessionReady ? "Choose from Library" : "Initializing..."}
            onPress={handlePickPhoto}
            disabled={!sessionReady}
          />

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

