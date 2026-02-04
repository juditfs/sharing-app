import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Alert, TouchableWithoutFeedback } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { Provider as PaperProvider, Button, Text, ActivityIndicator, Card, Snackbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { signInAnonymously } from './lib/auth';
import { handlePhotoError } from './lib/errorHandling';
import { processAndUploadPhoto } from './lib/photoWorkflow';
import { SettingsDrawer } from './components/SettingsDrawer';
import { LinkSettings } from './lib/api';
import { theme } from './theme';

export default function App() {
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // Toast state
  const [toastVisible, setToastVisible] = useState(false);

  // State for the currently created link
  const [currentLink, setCurrentLink] = useState<{
    shortCode: string;
    shareUrl: string;
    thumbnailUri: string;
    settings: LinkSettings;
  } | null>(null);

  const [settingsVisible, setSettingsVisible] = useState(false);

  useEffect(() => {
    // DEBUG: Check environment and network
    const checkNetwork = async () => {
      try {
        console.log('DEBUG: Checking Supabase connection...');
        const url = process.env.EXPO_PUBLIC_SUPABASE_URL;

        if (url) {
          const resp = await fetch(`${url}/auth/v1/health`);
          console.log('DEBUG: Health status:', resp.status);
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

  const handlePhotoUpload = async (uri: string) => {
    try {
      setLoading(true);
      // Smart Defaults
      const defaultSettings: LinkSettings = {
        expiry: '1h',
        shareText: 'user shared a photo',
        allowDownload: false,
        // publicThumbnailUrl is handled in workflow, defaults to created unless specified otherwise
      };

      const uploadResult = await processAndUploadPhoto(
        uri,
        defaultSettings
      );

      // Auto-copy to clipboard
      await Clipboard.setStringAsync(uploadResult.shareUrl);

      // Update state to show Success UI
      setCurrentLink({
        shortCode: uploadResult.shortCode,
        shareUrl: uploadResult.shareUrl,
        thumbnailUri: uploadResult.thumbnailUri,
        settings: {
          ...defaultSettings,
          // Use returned publicThumbnailUrl or null details
          publicThumbnailUrl: uploadResult.publicThumbnailUrl
        }
      });

      // Show Toast instead of Alert
      setToastVisible(true);

    } catch (error: any) {
      handlePhotoError(error);
    } finally {
      setLoading(false);
    }
  }

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera access is needed.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled) {
      await handlePhotoUpload(result.assets[0].uri);
    }
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Photo library access is needed.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled) {
      await handlePhotoUpload(result.assets[0].uri);
    }
  };

  const handleCopyLink = async () => {
    if (currentLink?.shareUrl) {
      await Clipboard.setStringAsync(currentLink.shareUrl);
      setToastVisible(true);
    }
  };

  const handleCreateNew = () => {
    setCurrentLink(null);
  };

  const dismissToast = () => setToastVisible(false);

  return (
    <PaperProvider theme={theme}>
      <TouchableWithoutFeedback onPress={dismissToast}>
        <View style={styles.container}>
          <StatusBar style="auto" />

          {!currentLink ? (
            // Upload Screen
            <>
              <Text variant="displayMedium" style={styles.title}>Sharene</Text>
              <Text variant="titleMedium" style={styles.subtitle}>Encrypted Photo Sharing</Text>

              {loading ? (
                <ActivityIndicator size="large" />
              ) : (
                <View style={styles.buttonContainer}>
                  <Button
                    mode="contained"
                    icon="camera"
                    onPress={handleTakePhoto}
                    disabled={!sessionReady}
                    style={styles.button}
                  >
                    Take Photo
                  </Button>
                  <Button
                    mode="outlined"
                    icon="image"
                    onPress={handlePickPhoto}
                    disabled={!sessionReady}
                    style={styles.button}
                  >
                    Choose from Library
                  </Button>
                </View>
              )}
            </>
          ) : (
            // Success / Management Screen
            <View style={styles.successContainer}>
              <Text variant="headlineMedium" style={styles.successTitle}>Link Created!</Text>

              <Card style={styles.card}>
                <Card.Cover source={{ uri: currentLink.thumbnailUri }} />
                <Card.Content>
                  <Text variant="bodyMedium" style={styles.linkText} numberOfLines={1}>
                    {currentLink.shareUrl}
                  </Text>
                </Card.Content>
                <Card.Actions style={styles.cardActions}>
                  <Button onPress={handleCopyLink}>Copy Link</Button>
                  <Button onPress={() => setSettingsVisible(true)}>Edit Settings</Button>
                </Card.Actions>
              </Card>

              <Button
                mode="contained"
                onPress={handleCreateNew}
                style={styles.createNewButton}
              >
                Share Another
              </Button>

              <SettingsDrawer
                visible={settingsVisible}
                onClose={() => setSettingsVisible(false)}
                initialSettings={currentLink.settings}
                onSave={async (newSettings: LinkSettings) => {
                  // Optimistic update
                  setCurrentLink(prev => prev ? ({ ...prev, settings: newSettings }) : null);
                }}
              />
            </View>
          )}

          <Snackbar
            visible={toastVisible}
            onDismiss={dismissToast}
            duration={5000}
            style={styles.snackbar}
          >
            <View style={styles.snackbarContent}>
              <MaterialCommunityIcons name="check-circle" size={20} color="white" />
              <Text style={styles.snackbarText}>Copied link</Text>
            </View>
          </Snackbar>
        </View>
      </TouchableWithoutFeedback>
    </PaperProvider>
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
  title: {
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#6366F1',
  },
  subtitle: {
    color: '#666',
    marginBottom: 40,
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 20,
    gap: 16,
  },
  button: {
    paddingVertical: 4
  },
  successContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 24,
  },
  successTitle: {
    fontWeight: 'bold',
    color: '#10B981'
  },
  card: {
    width: '100%',
    marginBottom: 20
  },
  linkText: {
    marginTop: 10,
    color: '#666'
  },
  cardActions: {
    justifyContent: 'space-between',
    paddingHorizontal: 8
  },
  createNewButton: {
    marginTop: 20
  },
  snackbar: {
    backgroundColor: '#10B981', // Green
    bottom: 40,
  },
  snackbarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  snackbarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  }
});
