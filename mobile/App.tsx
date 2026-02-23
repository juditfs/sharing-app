import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Alert, TouchableWithoutFeedback, Modal } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { BlurView } from 'expo-blur';
import { Provider as PaperProvider, Button, Text, ActivityIndicator, Card, Snackbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Platform } from 'react-native';
import { getSession, isAnonymousSession, signOut, prepareMigration, completeMigration } from './lib/auth';
import LoginScreen from './screens/LoginScreen';
import { handlePhotoError } from './lib/errorHandling';
import { processAndUploadPhoto } from './lib/photoWorkflow';
import { SettingsDrawer } from './components/SettingsDrawer';
import { DashboardScreen } from './components/DashboardScreen';
import { LinkSettings, updateLink, LinkItem, getUserLinks } from './lib/api';
import { theme } from './theme';

interface EditingItem {
  shortCode: string;
  settings: LinkSettings;
  availableThumbnailUrl?: string | null;
  privateThumbnailPath?: string | null;
  encryptionKey?: string;
  shareUrl: string;
}

export default function App() {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [isAnon, setIsAnon] = useState(false);
  const [migrationCode, setMigrationCode] = useState<string | null>(null);
  const [view, setView] = useState<'upload' | 'success' | 'dashboard'>('upload');

  // Navigation state helper
  const [hasLinks, setHasLinks] = useState(false);

  // Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('Copied link');

  // State for the currently created link (for Success view)
  const [currentLink, setCurrentLink] = useState<{
    shortCode: string;
    shareUrl: string;
    thumbnailUri: string;
    settings: LinkSettings;
    availableThumbnailUrl?: string | null;
  } | null>(null);

  // Settings Drawer state
  const [settingsVisible, setSettingsVisible] = useState(false);
  // We can open settings for the "currentLink" OR a link from the dashboard
  // If this is null, we might be editing currentLink (legacy logic) or we need a way to track which link is being edited.
  // Let's store the full link data being edited.
  const [editingLink, setEditingLink] = useState<EditingItem | null>(null);

  // Dashboard refresh function
  const dashboardRefreshRef = useRef<(() => void) | null>(null);


  useEffect(() => {
    const init = async () => {
      try {
        // Check for an existing session first
        let session = await getSession();

        if (!session) {
          // No session — show login screen
          setShowLogin(true);
          setInitialLoading(false);
          return;
        }

        const anon = isAnonymousSession(session);
        setIsAnon(anon);
        setSessionReady(true);
        console.log('Session ready, anonymous:', anon);

        // Check for existing links to determine home screen
        const links = await getUserLinks();
        if (links.length > 0) {
          setHasLinks(true);
          setView('dashboard');
        } else {
          setHasLinks(false);
          setView('upload');
        }
      } catch (err) {
        console.error('Initialization failed:', err);
        Alert.alert('Error', 'Failed to initialize. Please restart.');
      } finally {
        setInitialLoading(false);
      }
    };
    init();
  }, []);

  const handlePhotoUpload = async (uri: string) => {
    try {
      setLoading(true);
      // Smart Defaults
      const defaultSettings: LinkSettings = {
        expiry: '1h',
        shareText: 'user shared a photo',
        allowDownload: false,
      };

      const uploadResult = await processAndUploadPhoto(
        uri,
        defaultSettings
      );

      // Auto-copy to clipboard
      await Clipboard.setStringAsync(uploadResult.shareUrl);

      // Set current link and switch to success view
      const newLink = {
        shortCode: uploadResult.shortCode,
        shareUrl: uploadResult.shareUrl,
        thumbnailUri: uploadResult.thumbnailUri,
        settings: {
          ...defaultSettings,
          publicThumbnailUrl: uploadResult.publicThumbnailUrl
        },
        availableThumbnailUrl: uploadResult.publicThumbnailUrl
      };
      setCurrentLink(newLink);
      setHasLinks(true); // User now has links!
      setView('success');

      // Setup editing state immediately in case they click "Edit Settings"
      setEditingLink({
        shortCode: newLink.shortCode,
        settings: newLink.settings,
        availableThumbnailUrl: newLink.availableThumbnailUrl,
        shareUrl: newLink.shareUrl
      });

      setToastMessage('Copied link');
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

  const handleCopyLink = async (url: string) => {
    await Clipboard.setStringAsync(url);
    setToastMessage('Copied link');
    setToastVisible(true);
  };

  const handleBackToHome = () => {
    // If the user has links, Home is Dashboard.
    // Otherwise, Home is Upload (but we only show Back if we are NOT at Home).
    if (hasLinks) {
      setView('dashboard');
    } else {
      setView('upload');
    }
    setCurrentLink(null);
    setEditingLink(null);
  };

  const dismissToast = () => setToastVisible(false);

  // --- Dashboard Logic ---
  // const openDashboard = () => { setView('dashboard'); }; // Removed as per request

  const handleDashboardSettings = (link: LinkItem) => {
    setEditingLink({
      shortCode: link.short_code,
      settings: {
        expiry: link.expires_at || undefined, // TODO: Better mapping needed if strict types
        shareText: link.share_text,
        allowDownload: link.allow_download,
        publicThumbnailUrl: link.public_thumbnail_url || undefined,
      },
      availableThumbnailUrl: link.public_thumbnail_url,
      privateThumbnailPath: link.thumbnail_url,
      encryptionKey: link.encryption_key,
      shareUrl: process.env.EXPO_PUBLIC_VIEWER_URL
        ? `${process.env.EXPO_PUBLIC_VIEWER_URL}/p/${link.short_code}`
        : `https://viewer-rho-seven.vercel.app/p/${link.short_code}`
    });
    setSettingsVisible(true);
  };

  const handleLinkPress = (link: LinkItem) => {
    setCurrentLink({
      shortCode: link.short_code,
      shareUrl: process.env.EXPO_PUBLIC_VIEWER_URL
        ? `${process.env.EXPO_PUBLIC_VIEWER_URL}/p/${link.short_code}`
        : `https://viewer-rho-seven.vercel.app/p/${link.short_code}`,
      thumbnailUri: link.public_thumbnail_url || 'https://via.placeholder.com/150',
      settings: {
        expiry: link.expires_at || undefined,
        shareText: link.share_text,
        allowDownload: link.allow_download,
        publicThumbnailUrl: link.public_thumbnail_url || undefined,
      },
      availableThumbnailUrl: link.public_thumbnail_url,
    });

    setEditingLink({
      shortCode: link.short_code,
      settings: {
        expiry: link.expires_at || undefined,
        shareText: link.share_text,
        allowDownload: link.allow_download,
        publicThumbnailUrl: link.public_thumbnail_url || undefined,
      },
      availableThumbnailUrl: link.public_thumbnail_url,
      privateThumbnailPath: link.thumbnail_url,
      encryptionKey: link.encryption_key,
      shareUrl: process.env.EXPO_PUBLIC_VIEWER_URL
        ? `${process.env.EXPO_PUBLIC_VIEWER_URL}/p/${link.short_code}`
        : `https://viewer-rho-seven.vercel.app/p/${link.short_code}`
    });

    setView('success');
  };

  const handleSignedIn = async () => {
    setShowLogin(false);
    setInitialLoading(true);
    try {
      const session = await getSession();

      // If we have a pending migration, complete it now that we are signed in
      if (migrationCode) {
        try {
          await completeMigration(migrationCode);
          Alert.alert('Success', 'Your links have been backed up!');
          setMigrationCode(null);
        } catch (migErr: any) {
          console.error('Migration completion failed:', migErr);
          Alert.alert(
            'Backup Failed',
            'You are signed in, but your links couldn\'t be moved. Sign out and try "Back up with Apple" again to retry.',
          );
          // Keep migrationCode: user is now authenticated (non-anon), so they can't
          // call prepare_migration() again. However clearing it was incorrect —
          // the code may still be valid (e.g. transient network error). Retain it
          // so a future sign-in attempt (after sign-out + re-backup) can retry.
          // The DB code expires in 5 min, so stale codes will fail gracefully.
        }
      }

      const anon = isAnonymousSession(session);
      setIsAnon(anon);
      setSessionReady(true);
      const links = await getUserLinks();
      if (links.length > 0) {
        setHasLinks(true);
        setView('dashboard');
      } else {
        setHasLinks(false);
        setView('upload');
      }
    } catch (err) {
      console.error('Post-login init failed:', err);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleBackUpLinks = async () => {
    try {
      setLoading(true);
      // Step 1: Prepare migration while still anonymous
      const code = await prepareMigration();
      setMigrationCode(code);

      // Step 2: Show login screen to authenticate (completes in handleSignedIn)
      setShowLogin(true);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not start backup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setSessionReady(false);
      setIsAnon(false);
      setShowLogin(true);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Sign out failed.');
    }
  };

  if (showLogin) {
    return <LoginScreen onSignedIn={handleSignedIn} />;
  }

  if (initialLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // ... existing codes ...
  // Inside App function, before return
  const UploadLoadingOverlay = () => (
    <Modal transparent animationType="fade" visible={loading}>
      <View style={styles.loadingOverlay}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Encrypting & Uploading...</Text>
        </View>
      </View>
    </Modal>
  );

  return (
    <PaperProvider theme={theme}>
      <TouchableWithoutFeedback onPress={dismissToast}>
        <View style={styles.container}>
          <StatusBar style="auto" />

          <UploadLoadingOverlay />

          {/* Header Area */}
          <View style={styles.header}>
            {/* ... rest of header ... */}
            {(view !== 'dashboard' && hasLinks) ? (
              <Button mode="text" icon="arrow-left" onPress={handleBackToHome} compact>
                Back to Created Links
              </Button>
            ) : null}

            <View style={{ flex: 1 }} />

            <Button mode="text" onPress={handleSignOut} compact>
              Sign Out
            </Button>
          </View>

          {/* Migration nudge: shown for anonymous users on iOS */}
          {isAnon && Platform.OS === 'ios' && (
            <View style={styles.nudgeBanner}>
              <Text style={styles.nudgeText}>Your links are stored on this device only.</Text>
              <Button mode="text" compact onPress={handleBackUpLinks} style={styles.nudgeButton}>
                Back up with Apple
              </Button>
            </View>
          )}

          <View style={[styles.content, view !== 'dashboard' && { justifyContent: 'center' }]}>
            {view === 'upload' && (
              <>
                <Text variant="displayMedium" style={styles.title}>Sharene</Text>
                <Text variant="titleMedium" style={styles.subtitle}>Encrypted Photo Sharing</Text>

                {/* Removed inline loader in favor of overlay */}
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
              </>
            )}

            {/* ... rest of existing code ... */}


            {view === 'success' && currentLink && (
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
                    <Button onPress={() => handleCopyLink(currentLink.shareUrl)}>Copy Link</Button>
                    <Button onPress={() => setSettingsVisible(true)}>Edit Settings</Button>
                  </Card.Actions>
                </Card>

                <Button
                  mode="contained"
                  onPress={() => setView('upload')}
                  style={styles.createNewButton}
                >
                  Share Another
                </Button>
              </View>
            )}




            {view === 'dashboard' && (
              <DashboardScreen
                onOpenSettings={handleDashboardSettings}
                onCopyLink={(item: any) => handleCopyLink(item.shareUrl)}
                onTakePhoto={handleTakePhoto}
                onPickPhoto={handlePickPhoto}
                onLinkPress={handleLinkPress}
                onRefreshNeeded={(refreshFn) => {
                  dashboardRefreshRef.current = refreshFn;
                }}
              />
            )}
          </View>

          {/* Shared Settings Drawer */}
          {editingLink && (
            <SettingsDrawer
              visible={settingsVisible}
              onClose={() => setSettingsVisible(false)}
              initialSettings={editingLink.settings}
              availableThumbnailUrl={editingLink.availableThumbnailUrl}
              privateThumbnailPath={editingLink.privateThumbnailPath}
              encryptionKey={editingLink.encryptionKey}
              onSave={async (newSettings: LinkSettings) => {
                try {
                  // Update backend
                  await updateLink(editingLink.shortCode, newSettings);

                  // Update editing link state to reflect cache bust if needed, 
                  // though for dashboard list we rely on refresh.
                  // For success view, we update currentLink to reflected changes immediately.

                  if (view === 'success') {
                    const randomTag = Math.random().toString(36).substring(2, 5);
                    const baseUrl = currentLink!.shareUrl.split('?')[0];
                    const newShareUrl = `${baseUrl}?v=${randomTag}`;

                    setCurrentLink(prev => prev ? ({
                      ...prev,
                      settings: newSettings,
                      shareUrl: newShareUrl
                    }) : null);

                    await Clipboard.setStringAsync(newShareUrl);
                    setToastMessage('Link updated & copied');
                    setToastVisible(true);
                  } else {
                    setToastMessage('Settings saved');
                    setToastVisible(true);
                    // Refresh dashboard if we're in dashboard view
                    // Add delay to ensure DB consistency (transaction commit time)
                    if (dashboardRefreshRef.current) {
                      setTimeout(() => {
                        dashboardRefreshRef.current?.();
                      }, 500);
                    }
                  }

                } catch (e) {
                  console.error('Failed to save settings:', e);
                  Alert.alert('Error', 'Failed to save settings. Please try again.');
                }
              }}
            />
          )}

          <Snackbar
            visible={toastVisible}
            onDismiss={dismissToast}
            duration={5000}
            style={styles.snackbar}
          >
            <View style={styles.snackbarContent}>
              <MaterialCommunityIcons name="check-circle" size={20} color="white" />
              <Text style={styles.snackbarText}>{toastMessage}</Text>
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
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50, // Status bar path
    paddingBottom: 10,
    width: '100%',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
    // justifyContent: 'center' // Removed global centering
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
    paddingHorizontal: 20,
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
  },
  loadingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)', // Fallback if blur fails or on older android
  },
  loadingContainer: {
    padding: 24,
    backgroundColor: 'white',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  nudgeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0F0FF',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  nudgeText: {
    fontSize: 12,
    color: '#555',
    flex: 1,
  },
  nudgeButton: {
    marginLeft: 8,
  },
});
