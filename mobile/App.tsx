import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Alert, TouchableWithoutFeedback, Modal, LayoutRectangle } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { BlurView } from 'expo-blur';
import { Provider as PaperProvider, Button, Text, ActivityIndicator, Snackbar, Menu, Avatar, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { AppState, AppStateStatus, Platform } from 'react-native';
import { getSession, isAnonymousSession, signOut } from './lib/auth';
import LoginScreen from './screens/LoginScreen';
import { handlePhotoError } from './lib/errorHandling';
import { processAndUploadPhoto } from './lib/photoWorkflow';
import { getPendingSharedImage } from './lib/shareExtension';
import { LinkDetailsDrawer, LinkDetailsData } from './components/LinkDetailsDrawer';
import { DashboardScreen } from './components/DashboardScreen';
import { LinkSettings, updateLink, LinkItem, getUserLinks, deleteLink } from './lib/api';
import { theme } from './theme';

export default function App() {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [isAnon, setIsAnon] = useState(false);
  const [view, setView] = useState<'upload' | 'success' | 'dashboard'>('upload');
  const [showDeleted, setShowDeleted] = useState(false);
  const [overflowMenuVisible, setOverflowMenuVisible] = useState(false);

  // Navigation state helper
  const [hasLinks, setHasLinks] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [avatarMenuVisible, setAvatarMenuVisible] = useState(false);

  // Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('Copied link');

  // Settings Drawer state
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [editingLink, setEditingLink] = useState<LinkDetailsData | null>(null);
  const [editingLinkLayout, setEditingLinkLayout] = useState<LayoutRectangle | undefined>(undefined);

  // Dashboard refresh function
  const dashboardRefreshRef = useRef<(() => void) | null>(null);
  const pendingDashboardRefreshRef = useRef(false);


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
        setUserEmail(session.user?.email ?? null);
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

  // Check for pending shared images on App Activation
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && sessionReady && !showLogin) {
        try {
          const pending = await getPendingSharedImage();
          if (pending) {
            console.log('[App] Found pending shared image, starting upload...');
            // handlePhotoUpload already sets loading state and handles the UI
            try {
              await handlePhotoUpload(pending.uri);
              await pending.cleanUp();
            } catch (e) {
              console.error('[App] Failed to upload pending shared image:', e);
              // Do not cleanUp so it can be retried later
            }
          }
        } catch (err) {
          console.error('[App] Error checking for shared image:', err);
        }
      }
    };

    // Check once explicitly if session is already ready (e.g. initial launch)
    if (sessionReady && !showLogin) {
      handleAppStateChange('active');
    }

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [sessionReady, showLogin]);

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

      // Switch to dashboard view
      setHasLinks(true);
      setView('dashboard');

      // Setup editing state immediately to open drawer
      setEditingLinkLayout(undefined);
      setEditingLink({
        shortCode: uploadResult.shortCode,
        settings: {
          ...defaultSettings,
          publicThumbnailUrl: uploadResult.publicThumbnailUrl
        },
        availableThumbnailUrl: uploadResult.publicThumbnailUrl,
        shareUrl: uploadResult.shareUrl,
        viewCount: 0,
        createdAt: new Date().toISOString()
      });
      setSettingsVisible(true);

      // Ensure dashboard list reflects newly-created link even if first fetch raced.
      setTimeout(() => {
        refreshDashboard();
      }, 700);

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
    setEditingLink(null);
  };

  const dismissToast = () => setToastVisible(false);

  // --- Dashboard Logic ---
  // const openDashboard = () => { setView('dashboard'); }; // Removed as per request

  const handleOpenLinkDetails = (link: LinkItem, layout?: LayoutRectangle) => {
    setEditingLinkLayout(layout);
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
        : `https://viewer-rho-seven.vercel.app/p/${link.short_code}`,
      viewCount: link.view_count,
      createdAt: link.created_at
    });
    setSettingsVisible(true);
  };

  const handleSignedIn = async () => {
    setShowLogin(false);
    setInitialLoading(true);
    try {
      const session = await getSession();

      const anon = isAnonymousSession(session);
      setIsAnon(anon);
      setSessionReady(true);
      setUserEmail(session?.user?.email ?? null);
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

  const handleSignOut = async () => {
    try {
      await signOut();
      setSessionReady(false);
      setIsAnon(false);
      setUserEmail(null);
      setShowLogin(true);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Sign out failed.');
    }
  };

  const refreshDashboard = async () => {
    if (dashboardRefreshRef.current) {
      dashboardRefreshRef.current();
      return;
    }

    // Fallback if dashboard hasn't mounted its refresh callback yet.
    pendingDashboardRefreshRef.current = true;
    try {
      const links = await getUserLinks();
      setHasLinks(links.length > 0);
    } catch (e) {
      console.warn('[App] Fallback dashboard refresh failed:', e);
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
            <View style={styles.headerLeftActions}>
              <Menu
                visible={avatarMenuVisible}
                onDismiss={() => setAvatarMenuVisible(false)}
                anchor={
                  <TouchableWithoutFeedback onPress={() => setAvatarMenuVisible(true)}>
                    <View style={styles.avatarButtonOutline}>
                      <Avatar.Text
                        size={32}
                        label={userEmail ? userEmail[0].toUpperCase() : '?'}
                        style={styles.avatar}
                      />
                    </View>
                  </TouchableWithoutFeedback>
                }
              >
                <Menu.Item
                  leadingIcon="email-outline"
                  title={isAnon ? 'Guest User' : (userEmail ?? 'Signed in')}
                  disabled
                />
                <Menu.Item
                  leadingIcon={isAnon ? "login" : "logout"}
                  title={isAnon ? "Sign In" : "Sign Out"}
                  onPress={() => { setAvatarMenuVisible(false); handleSignOut(); }}
                />
              </Menu>

              {(view !== 'dashboard' && hasLinks) ? (
                <Button mode="text" icon="arrow-left" onPress={handleBackToHome} compact style={{ marginLeft: 8 }}>
                  Back
                </Button>
              ) : null}
            </View>

            <View style={{ flex: 1 }} />

            <View style={styles.headerRightActions}>
              {view === 'dashboard' && (
                <Menu
                  visible={overflowMenuVisible}
                  onDismiss={() => setOverflowMenuVisible(false)}
                  anchor={
                    <TouchableWithoutFeedback onPress={() => setOverflowMenuVisible(true)}>
                      <View style={styles.overflowMenuButtonOutline}>
                        <MaterialCommunityIcons name="dots-horizontal" size={24} color="#333" />
                      </View>
                    </TouchableWithoutFeedback>
                  }
                  anchorPosition="bottom"
                >
                  <Menu.Item
                    leadingIcon={showDeleted ? 'eye-off-outline' : 'eye-outline'}
                    title={showDeleted ? 'Hide deleted' : 'Show deleted'}
                    onPress={() => {
                      setShowDeleted(v => !v);
                      setOverflowMenuVisible(false);
                    }}
                  />
                </Menu>
              )}
            </View>
          </View>

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






            {view === 'dashboard' && (
              <DashboardScreen
                onOpenSettings={handleOpenLinkDetails}
                onCopyLink={(item: any) => handleCopyLink(item.shareUrl)}
                onTakePhoto={handleTakePhoto}
                onPickPhoto={handlePickPhoto}
                onLinkPress={handleOpenLinkDetails}
                showDeleted={showDeleted}
                onRefreshNeeded={(refreshFn) => {
                  dashboardRefreshRef.current = refreshFn;
                  if (pendingDashboardRefreshRef.current) {
                    pendingDashboardRefreshRef.current = false;
                    refreshFn();
                  }
                }}
              />
            )}
          </View>

          {/* Shared Link Details Drawer */}
          {editingLink && (
            <LinkDetailsDrawer
              visible={settingsVisible}
              originLayout={editingLinkLayout}
              onClose={() => {
                setSettingsVisible(false);
                refreshDashboard();
              }}
              link={editingLink}
              onCopy={handleCopyLink}
              onDelete={async () => {
                try {
                  await deleteLink(editingLink.shortCode);
                  setSettingsVisible(false);
                  setTimeout(() => {
                    refreshDashboard();
                  }, 300);
                } catch (e) {
                  // Error handled in drawer possibly, or we can just console.error
                  console.error('Delete failed:', e);
                  throw e;
                }
              }}
              onUpdateSettings={async (newSettings: LinkSettings) => {
                await updateLink(editingLink.shortCode, newSettings);
                // Update local editingLink state so UI refreshes without closing
                setEditingLink(prev => prev ? { ...prev, settings: newSettings } : null);

                // Refresh dashboard quietly
                setTimeout(() => {
                  refreshDashboard();
                }, 300);
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 70, // Increased more significantly to make it visible
    paddingBottom: 10,
    width: '100%',
  },
  headerLeftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  // --- Avatar ---
  avatarButtonOutline: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  overflowMenuButtonOutline: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  // --- Avatar dropdown menu ---
  avatarMenu: {
    position: 'absolute',
    top: 100,
    left: 16,
    width: 240,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
    zIndex: 100,
    overflow: 'hidden',
  },
  avatarMenuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  avatarLarge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLargeInitials: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  avatarMenuEmail: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  avatarMenuSubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  avatarMenuDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 0,
  },
  avatarMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  avatarMenuItemText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
});

