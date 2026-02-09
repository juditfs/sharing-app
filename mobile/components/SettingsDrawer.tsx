import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, Modal, TouchableOpacity, Switch, ActivityIndicator, Alert, TouchableWithoutFeedback, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinkSettings } from '../lib/upload';
import { restorePublicThumbnail } from '../lib/secureImage';

interface SettingsDrawerProps {
    visible: boolean;
    onClose: () => void;
    onSave: (newSettings: LinkSettings) => Promise<void>;
    initialSettings: LinkSettings;
    availableThumbnailUrl?: string | null;
    privateThumbnailPath?: string | null;
    encryptionKey?: string;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function SettingsDrawer({ visible, onClose, onSave, initialSettings, availableThumbnailUrl, privateThumbnailPath, encryptionKey }: SettingsDrawerProps) {
    const [settings, setSettings] = useState<LinkSettings>(initialSettings);
    const [saving, setSaving] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

    // Reset state and animate when opening
    useEffect(() => {
        if (visible) {
            setSettings(initialSettings);
            // Slide up animation
            translateY.setValue(SCREEN_HEIGHT);
            Animated.spring(translateY, {
                toValue: 0,
                friction: 8, // Adjust for bounciness
                tension: 40, // Adjust for speed
                useNativeDriver: true,
            }).start();
        }
    }, [visible, initialSettings]);

    const handleClose = () => {
        // Slide down animation before closing
        Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration: 250,
            useNativeDriver: true,
        }).start(() => onClose());
    };

    const handleGetLink = async () => {
        try {
            setSaving(true);
            await onSave(settings);
            handleClose(); // Use animated close
        } catch (error) {
            Alert.alert('Error', 'Failed to update settings');
        } finally {
            setSaving(false);
        }
    };

    const updateExpiry = (expiry: string) => {
        setSettings(prev => ({ ...prev, expiry }));
    };

    const toggleThumbnail = async (value: boolean) => {
        if (value) {
            if (availableThumbnailUrl) {
                setSettings(prev => ({ ...prev, publicThumbnailUrl: availableThumbnailUrl }));
            } else if (initialSettings.publicThumbnailUrl) {
                setSettings(prev => ({ ...prev, publicThumbnailUrl: initialSettings.publicThumbnailUrl }));
            } else if (privateThumbnailPath && encryptionKey) {
                // Restore from private thumbnail
                try {
                    setRestoring(true);
                    const newUrl = await restorePublicThumbnail({
                        path: privateThumbnailPath,
                        encryptionKey: encryptionKey
                    });

                    if (newUrl) {
                        setSettings(prev => ({ ...prev, publicThumbnailUrl: newUrl }));
                    } else {
                        Alert.alert('Error', 'Failed to restore thumbnail preview.');
                    }
                } catch (e) {
                    Alert.alert('Error', 'Failed to restore thumbnail preview.');
                } finally {
                    setRestoring(false);
                }
            } else {
                Alert.alert('Cannot Enable', 'No public thumbnail is available for this link.');
            }
        } else {
            setSettings(prev => ({ ...prev, publicThumbnailUrl: null as any }));
        }
    };

    const hasThumbnail = !!settings.publicThumbnailUrl;

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={handleClose}
        >
            <TouchableOpacity
                style={styles.overlay}
                activeOpacity={1}
                onPress={handleClose}
            >
                <TouchableWithoutFeedback>
                    <Animated.View style={[
                        styles.drawer,
                        { transform: [{ translateY }] }
                    ]}>
                        <View style={styles.header}>
                            <Text style={styles.title}>Settings</Text>
                            <TouchableOpacity
                                onPress={handleClose}
                                disabled={saving}
                                style={styles.closeButtonContainer}
                            >
                                <Ionicons name="close" size={20} color="#5E5E5E" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Expiration</Text>
                            <View style={styles.segmentContainer}>
                                {['10m', '1h', '1d', '1w'].map((opt) => (
                                    <TouchableOpacity
                                        key={opt}
                                        style={[
                                            styles.segmentButton,
                                            settings.expiry === opt && styles.segmentButtonActive
                                        ]}
                                        onPress={() => updateExpiry(opt)}
                                    >
                                        <Text style={[
                                            styles.segmentText,
                                            settings.expiry === opt && styles.segmentTextActive
                                        ]}>{opt}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>Public Preview on WhatsApp</Text>
                                <Text style={styles.disclaimer}>
                                    {hasThumbnail
                                        ? "Thumbnail is visible to messaging apps."
                                        : "No preview will be shown."}
                                </Text>
                            </View>
                            <Switch
                                value={hasThumbnail}
                                onValueChange={toggleThumbnail}
                                disabled={(!availableThumbnailUrl && !initialSettings.publicThumbnailUrl && !privateThumbnailPath && !hasThumbnail) || restoring}
                            />
                            {restoring && <ActivityIndicator size="small" style={{ marginLeft: 10 }} />}
                        </View>

                        <View style={styles.footer}>
                            <TouchableOpacity
                                style={[styles.getLinkButton, saving && styles.disabledButton]}
                                onPress={handleGetLink}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.getLinkButtonText}>Get link</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </TouchableWithoutFeedback>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)', // Slightly lighter dim
        justifyContent: 'flex-end',
    },
    drawer: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 16, // iOS native usually ~10-16
        borderTopRightRadius: 16,
        padding: 20,
        paddingTop: 24, // More breathing room top
        paddingBottom: 40,
        minHeight: 450,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 32,
    },
    title: {
        fontSize: 32, // Large Title
        fontWeight: 'bold',
        color: '#000',
        letterSpacing: 0.3,
    },
    closeButtonContainer: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#E5E5EA', // iOS System Gray 5/6
        alignItems: 'center',
        justifyContent: 'center',
    },
    // ... (rest of styles need to be preserved or updated slightly?)
    // I will rewrite the styles block to be safe since I need to remove old 'closeButton' text style
    section: {
        marginBottom: 28,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#8E8E93', // iOS Section Header Gray
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: -0.2,
    },
    segmentContainer: {
        flexDirection: 'row',
        backgroundColor: '#EEEEEF', // iOS Segmented Control BG
        borderRadius: 9,
        padding: 2,
    },
    segmentButton: {
        flex: 1,
        paddingVertical: 6,
        alignItems: 'center',
        borderRadius: 7,
    },
    segmentButtonActive: {
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15, // iOS shadow is subtle but sharp
        shadowRadius: 2,
        elevation: 2,
    },
    segmentText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#000',
    },
    segmentTextActive: {
        fontWeight: '600',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginVertical: 12,
        paddingVertical: 4,
    },
    label: {
        fontSize: 17, // iOS Body size
        fontWeight: '400',
        color: '#000',
    },
    disclaimer: {
        fontSize: 13, // iOS Footnote size
        color: '#8E8E93',
        marginTop: 4,
        marginRight: 16,
        lineHeight: 18,
    },
    divider: {
        height: 1,
        backgroundColor: '#F2F2F7', // iOS separator
        marginVertical: 12,
        marginLeft: 0,
    },
    footer: {
        marginTop: 32,
    },
    getLinkButton: {
        backgroundColor: '#007AFF', // iOS Blue
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    disabledButton: {
        backgroundColor: '#D1D1D6',
    },
    getLinkButtonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '600',
    },
});
