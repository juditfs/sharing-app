import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, Modal, TouchableOpacity, Switch, ActivityIndicator, Alert, Animated, Dimensions, Share, LayoutRectangle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { LinkSettings } from '../lib/api';
import { restorePublicThumbnail } from '../lib/secureImage';
import { EncryptedThumbnail } from './EncryptedThumbnail';

export interface LinkDetailsData {
    shortCode: string;
    shareUrl: string;
    settings: LinkSettings;
    availableThumbnailUrl?: string | null;
    privateThumbnailPath?: string | null;
    encryptionKey?: string;
    viewCount?: number;
    createdAt?: string;
}

interface LinkDetailsDrawerProps {
    visible: boolean;
    onClose: () => void;
    onUpdateSettings: (newSettings: LinkSettings) => Promise<void>;
    onCopy: (url: string) => void;
    onDelete: () => Promise<void>;
    link: LinkDetailsData | null;
    originLayout?: LayoutRectangle;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const formatUploadDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const month = date.toLocaleString('en-US', { month: 'short' });
    const day = date.getDate();
    return `Uploaded ${month} ${day}`;
};

const getExpiryDate = (createdAt?: string, expiresAtOrDuration?: string): Date | null => {
    if (!createdAt || !expiresAtOrDuration) return null;
    let expiryDate = new Date(expiresAtOrDuration);
    if (isNaN(expiryDate.getTime())) {
        expiryDate = new Date(createdAt);
        const val = parseInt(expiresAtOrDuration);
        if (expiresAtOrDuration.endsWith('m')) expiryDate.setMinutes(expiryDate.getMinutes() + val);
        else if (expiresAtOrDuration.endsWith('h')) expiryDate.setHours(expiryDate.getHours() + val);
        else if (expiresAtOrDuration.endsWith('d')) expiryDate.setDate(expiryDate.getDate() + val);
        else if (expiresAtOrDuration.endsWith('w')) expiryDate.setDate(expiryDate.getDate() + val * 7);
    }
    return expiryDate;
};

const formatTimeLeft = (createdAt?: string, expiresAtOrDuration?: string) => {
    const expiryDate = getExpiryDate(createdAt, expiresAtOrDuration);
    if (!expiryDate) return 'Never';

    const now = new Date();
    if (expiryDate <= now) return 'Expired';

    const diffMs = expiryDate.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d left`;
    if (diffHours > 0) return `${diffHours}h left`;
    return `${diffMins}m left`;
};

const formatFormattedExpiry = (createdAt?: string, expiresAtOrDuration?: string) => {
    const expiryDate = getExpiryDate(createdAt, expiresAtOrDuration);
    if (!expiryDate) return 'Never';

    const month = expiryDate.toLocaleString('en-US', { month: 'short' });
    const day = expiryDate.getDate();
    const year = expiryDate.getFullYear();
    const time = expiryDate.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    return `${month} ${day}, ${year} at ${time}`;
};

export function LinkDetailsDrawer({ visible, originLayout, onClose, onUpdateSettings, onCopy, onDelete, link }: LinkDetailsDrawerProps) {
    const [settings, setSettings] = useState<LinkSettings | null>(null);
    const [restoring, setRestoring] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showEditExpiry, setShowEditExpiry] = useState(false);
    const animValue = useRef(new Animated.Value(0)).current;

    // Handle opening animation and reset state for new links
    useEffect(() => {
        if (visible && link) {
            setSettings(link.settings);
            setShowEditExpiry(false);
            animValue.setValue(0);
            Animated.spring(animValue, {
                toValue: 1,
                friction: 8,
                tension: 40,
                // We use useNativeDriver: false because we animate layout properties (width, height, top, left)
                useNativeDriver: false,
            }).start();
        }
    }, [visible, link?.shortCode]);

    // Keep settings in sync if parent object updates (e.g. from upstream changes) without re-animating
    useEffect(() => {
        if (visible && link) {
            setSettings(link.settings);
        }
    }, [link]);

    const handleClose = () => {
        Animated.timing(animValue, {
            toValue: 0,
            duration: 250,
            useNativeDriver: false,
        }).start(() => onClose());
    };

    const handleConfirmExpiry = async (date: Date) => {
        setShowEditExpiry(false);
        if (!settings || !link) return;

        // Ensure date is in the future
        if (date <= new Date()) {
            Alert.alert('Invalid Time', 'Expiration must be in the future.');
            return;
        }

        const expiry = date.toISOString();
        const newSettings = { ...settings, expiry };
        setSettings(newSettings);

        try {
            await onUpdateSettings(newSettings);
        } catch (e) {
            Alert.alert('Error', 'Failed to update expiration.');
            setSettings(settings); // Revert
        }
    };

    const toggleThumbnail = async (value: boolean) => {
        if (!settings || !link) return;
        let newPublicThumbnailUrl: string | null = null;

        if (value) {
            if (link.availableThumbnailUrl) {
                newPublicThumbnailUrl = link.availableThumbnailUrl;
            } else if (link.settings.publicThumbnailUrl) {
                newPublicThumbnailUrl = link.settings.publicThumbnailUrl;
            } else if (link.privateThumbnailPath && link.encryptionKey) {
                try {
                    setRestoring(true);
                    const newUrl = await restorePublicThumbnail({
                        path: link.privateThumbnailPath,
                        encryptionKey: link.encryptionKey
                    });
                    if (newUrl) {
                        newPublicThumbnailUrl = newUrl;
                    } else {
                        throw new Error('No URL returned');
                    }
                } catch (e) {
                    Alert.alert('Error', 'Failed to restore thumbnail preview.');
                    setRestoring(false);
                    return;
                } finally {
                    setRestoring(false);
                }
            } else {
                Alert.alert('Cannot Enable', 'No public thumbnail is available for this link.');
                return;
            }
        }

        const newSettings = { ...settings, publicThumbnailUrl: newPublicThumbnailUrl };
        setSettings(newSettings);
        try {
            await onUpdateSettings(newSettings);
        } catch (e) {
            Alert.alert('Error', 'Failed to update thumbnail setting.');
            setSettings(settings); // Revert
        }
    };

    const handleDelete = async () => {
        Alert.alert('Delete Link', 'Are you sure you want to permanently delete this link?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        setDeleting(true);
                        await onDelete();
                        handleClose();
                    } catch (e) {
                        Alert.alert('Error', 'Failed to delete link.');
                    } finally {
                        setDeleting(false);
                    }
                }
            }
        ]);
    };

    const handleShare = async () => {
        if (!link) return;
        try {
            await Share.share({
                message: link.shareUrl,
                url: link.shareUrl,
            });
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to share');
        }
    };

    if (!link || !settings) return null;

    const hasThumbnail = !!settings.publicThumbnailUrl;
    const currentPublicThumbnailUrl = settings.publicThumbnailUrl ?? null;

    // Animation interpolations
    const top = animValue.interpolate({
        inputRange: [0, 1],
        outputRange: [originLayout?.y ?? SCREEN_HEIGHT, 0]
    });
    const left = animValue.interpolate({
        inputRange: [0, 1],
        outputRange: [originLayout?.x ?? 0, 0]
    });
    const width = animValue.interpolate({
        inputRange: [0, 1],
        outputRange: [originLayout?.width ?? SCREEN_WIDTH, SCREEN_WIDTH]
    });
    const height = animValue.interpolate({
        inputRange: [0, 1],
        outputRange: [originLayout?.height ?? SCREEN_HEIGHT, SCREEN_HEIGHT]
    });
    const borderRadius = animValue.interpolate({
        inputRange: [0, 1],
        outputRange: [originLayout ? 12 : 0, 0] // Match row border radius
    });
    const contentOpacity = animValue.interpolate({
        inputRange: [0, 0.4, 1],
        outputRange: [0, 0, 1]
    });

    return (
        <Modal
            animationType="none"
            transparent={true}
            visible={visible}
            onRequestClose={handleClose}
        >
            <View style={StyleSheet.absoluteFill}>
                {/* Expandable container */}
                <Animated.View style={{
                    position: 'absolute',
                    top, left, width, height,
                    backgroundColor: '#F8F9FA',
                    borderRadius,
                    overflow: 'hidden',
                }}>
                    <Animated.View style={{
                        width: SCREEN_WIDTH,
                        height: SCREEN_HEIGHT,
                        opacity: contentOpacity,
                    }}>
                        <View style={styles.header}>
                            <TouchableOpacity onPress={handleClose} style={styles.closeButtonContainer}>
                                <MaterialCommunityIcons name="chevron-left" size={32} color="#5E5E5E" />
                            </TouchableOpacity>
                            <Text style={styles.title}>Shared Link</Text>
                            <View style={{ width: 32 }} />
                        </View>

                        <View style={styles.contentScroll}>
                            {/* Image Preview Card */}
                            <View style={styles.imageCard}>
                                <View style={styles.imageContainer}>
                                    {currentPublicThumbnailUrl ? (
                                        <Image
                                            source={{ uri: currentPublicThumbnailUrl || undefined }}
                                            style={styles.image}
                                            contentFit="cover"
                                        />
                                    ) : link.privateThumbnailPath && link.encryptionKey ? (
                                        <EncryptedThumbnail
                                            path={link.privateThumbnailPath}
                                            encryptionKey={link.encryptionKey}
                                            style={styles.image}
                                        />
                                    ) : (
                                        <View style={[styles.image, styles.placeholderImage]}>
                                            <MaterialCommunityIcons name="image-outline" size={48} color="#ccc" />
                                        </View>
                                    )}

                                    <View style={styles.secureBadge}>
                                        <MaterialCommunityIcons name="shield-check-outline" size={14} color="#333" />
                                        <Text style={styles.secureBadgeText}>Secure</Text>
                                    </View>
                                </View>

                                <View style={styles.statsContainer}>
                                    <View style={styles.statRow}>
                                        <MaterialCommunityIcons name="eye-outline" size={16} color="#666" />
                                        <Text style={styles.statText}>{link.viewCount || 0}</Text>
                                    </View>
                                    <View style={styles.statRow}>
                                        <MaterialCommunityIcons name="clock-outline" size={16} color="#666" />
                                        <Text style={styles.statText}>{formatTimeLeft(link.createdAt, settings.expiry)}</Text>
                                    </View>
                                    <View style={{ flex: 1 }} />
                                    <Text style={styles.dateText}>{formatUploadDate(link.createdAt)}</Text>
                                </View>
                            </View>

                            {/* Settings Card */}
                            <View style={styles.settingsCard}>
                                {/* Expiration Row */}
                                <View style={styles.settingRow}>
                                    <View style={[styles.iconBox, { backgroundColor: '#E8E8FF' }]}>
                                        <MaterialCommunityIcons name="calendar-blank" size={20} color="#6366F1" />
                                    </View>
                                    <View style={styles.settingTextContainer}>
                                        <Text style={styles.settingTitle}>Expiration</Text>
                                        <Text style={styles.settingSubtitle}>{formatFormattedExpiry(link.createdAt, settings.expiry)}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setShowEditExpiry(true)}>
                                        <Text style={styles.editText}>Edit</Text>
                                    </TouchableOpacity>
                                </View>

                                <DateTimePickerModal
                                    isVisible={showEditExpiry}
                                    mode="datetime"
                                    date={getExpiryDate(link.createdAt, settings.expiry) || new Date()}
                                    onConfirm={handleConfirmExpiry}
                                    onCancel={() => setShowEditExpiry(false)}
                                    minimumDate={new Date()}
                                    themeVariant="light"
                                />

                                <View style={styles.divider} />

                                {/* Preview Row */}
                                <View style={styles.settingRow}>
                                    <View style={[styles.iconBox, { backgroundColor: '#F0F0F0' }]}>
                                        <MaterialCommunityIcons name="image-outline" size={20} color="#333" />
                                    </View>
                                    <View style={styles.settingTextContainer}>
                                        <Text style={styles.settingTitle}>Preview</Text>
                                        <Text style={styles.settingSubtitle}>Show thumbnail on link</Text>
                                    </View>
                                    {restoring ? (
                                        <ActivityIndicator size="small" />
                                    ) : (
                                        <Switch
                                            value={hasThumbnail}
                                            onValueChange={toggleThumbnail}
                                            disabled={(!link.availableThumbnailUrl && !link.settings.publicThumbnailUrl && !link.privateThumbnailPath && !hasThumbnail) || restoring}
                                            trackColor={{ false: '#D1D1D6', true: '#DDE2FF' }}
                                            thumbColor={hasThumbnail ? '#6366F1' : '#fff'}
                                        />
                                    )}
                                </View>
                            </View>

                            {/* Action Buttons */}
                            <Text style={styles.shareUrlText} numberOfLines={1} ellipsizeMode="middle">
                                {link.shareUrl}
                            </Text>

                            <TouchableOpacity
                                style={styles.actionButtonOutline}
                                onPress={handleShare}
                            >
                                <MaterialCommunityIcons name="export-variant" size={20} color="#333" />
                                <Text style={styles.actionButtonOutlineText}>Share link</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.actionButtonOutline}
                                onPress={() => { handleClose(); onCopy(link.shareUrl); }}
                            >
                                <MaterialCommunityIcons name="content-copy" size={20} color="#333" />
                                <Text style={styles.actionButtonOutlineText}>Copy link</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.actionButtonDanger}
                                onPress={handleDelete}
                                disabled={deleting}
                            >
                                {deleting ? (
                                    <ActivityIndicator size="small" color="#E02424" />
                                ) : (
                                    <>
                                        <MaterialCommunityIcons name="trash-can-outline" size={20} color="#E02424" />
                                        <Text style={styles.actionButtonDangerText}>Delete now</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 56, // For safe area / status bar
        paddingBottom: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#000',
    },
    closeButtonContainer: {
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    contentScroll: {
        paddingHorizontal: 20,
    },
    imageCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 12,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    imageContainer: {
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    placeholderImage: {
        backgroundColor: '#f0f0f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    secureBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(255,255,255,0.9)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    secureBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#333',
    },
    statsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        paddingHorizontal: 4,
        gap: 16,
    },
    statRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#555',
    },
    dateText: {
        fontSize: 13,
        color: '#888',
    },
    settingsCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        paddingVertical: 8,
        paddingHorizontal: 16,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    settingTextContainer: {
        flex: 1,
    },
    settingTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#000',
    },
    settingSubtitle: {
        fontSize: 13,
        color: '#666',
        marginTop: 2,
    },
    editText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333',
    },
    divider: {
        height: 1,
        backgroundColor: '#F0F0F0',
        marginLeft: 56, // Align with text
    },
    segmentContainer: {
        flexDirection: 'row',
        backgroundColor: '#F0F0F0',
        borderRadius: 9,
        padding: 2,
        marginVertical: 10,
        marginLeft: 56,
        marginBottom: 16,
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
        shadowOpacity: 0.15,
        shadowRadius: 2,
        elevation: 2,
    },
    segmentText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#666',
    },
    segmentTextActive: {
        fontWeight: '600',
        color: '#000',
    },
    shareUrlText: {
        fontSize: 13,
        color: '#888',
        textAlign: 'center',
        marginBottom: 8,
    },
    actionButtonOutline: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E5EA',
        marginBottom: 12,
        gap: 8,
    },
    actionButtonOutlineText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    actionButtonDanger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FEF2F2', // Light red background
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
    },
    actionButtonDangerText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#E02424',
    },
});
