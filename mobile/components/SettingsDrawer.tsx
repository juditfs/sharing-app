import React, { useState } from 'react';
import { StyleSheet, View, Text, Modal, TouchableOpacity, Switch, ActivityIndicator, Alert } from 'react-native';
import { LinkSettings } from '../lib/upload';

interface SettingsDrawerProps {
    visible: boolean;
    onClose: () => void;
    onSave: (newSettings: LinkSettings) => Promise<void>;
    initialSettings: LinkSettings;
}

export function SettingsDrawer({ visible, onClose, onSave, initialSettings }: SettingsDrawerProps) {
    const [settings, setSettings] = useState<LinkSettings>(initialSettings);
    const [saving, setSaving] = useState(false);

    // Reset state when opening
    React.useEffect(() => {
        if (visible) {
            setSettings(initialSettings);
        }
    }, [visible, initialSettings]);

    const handleSave = async () => {
        try {
            setSaving(true);
            await onSave(settings);
            onClose();
        } catch (error) {
            Alert.alert('Error', 'Failed to update settings');
        } finally {
            setSaving(false);
        }
    };

    const updateExpiry = (expiry: string) => {
        setSettings(prev => ({ ...prev, expiry }));
    };

    const toggleDownload = (value: boolean) => {
        setSettings(prev => ({ ...prev, allowDownload: value }));
    };

    const toggleThumbnail = (value: boolean) => {
        // If turning ON, we use a placeholder "true" string or the actual URL if we have it.
        // But wait, the backend expects a URL string.
        // If we turn it OFF, we send null.
        // If we turn it ON, we need the original URL.
        // The current UI flow assumes we can just toggle it. 
        // Issue: If we turn it OFF, the backend deletes the file. We can't turn it back ON easily unless we re-upload or if the backend soft-deletes.
        // The implementation plan said: "Turning this ON shares a preview... Turning OFF will require deleting".
        // If user toggles OFF then ON without saving, it's fine.
        // If user saves OFF, then tries to turn ON later, we might have lost the file.
        // For MVP: If saved as OFF, the file is gone. We should disable the toggle or warn.
        // Actually, let's just handle the state here. The parent component typically passes the current known publicThumbnailUrl.
        // If we toggle OFF, we set it to null (or undefined? code says null).
        // If we toggle ON, we need to recover the previous URL.

        if (value) {
            // Attempting to turn ON
            // We ideally restore the initial value if it existed
            if (initialSettings.publicThumbnailUrl) {
                setSettings(prev => ({ ...prev, publicThumbnailUrl: initialSettings.publicThumbnailUrl }));
            } else {
                // We can't enable it if it didn't exist or was deleted
                Alert.alert('Cannot Enable', 'No public thumbnail is available for this link.');
            }
        } else {
            // Turning OFF
            setSettings(prev => ({ ...prev, publicThumbnailUrl: undefined })); // undefined or null needed. Let's use undefined to signal removal/absence in our types, but backend expects null/omission logic.
            // Wait, update-link expects explicit null to delete.
            // My api.ts maps Partial<LinkSettings>.
            // Let's modify LinkSettings logic or just pass null via a cast if needed. 
            // Actually LinkSettings defines it as `string | undefined`.
            // I'll assume passing null to backend is handled by JSON.stringify converting null to null.
            // So I should set it to null in state.
            // However TS might complain if interface says string | undefined.
            // Let's coerce it.
            setSettings(prev => ({ ...prev, publicThumbnailUrl: null as any }));
        }
    };

    const hasThumbnail = !!settings.publicThumbnailUrl;

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.drawer}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Link Settings</Text>
                        <TouchableOpacity onPress={onClose} disabled={saving}>
                            <Text style={styles.closeButton}>Close</Text>
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

                    <View style={styles.row}>
                        <Text style={styles.label}>Allow Download</Text>
                        <Switch
                            value={settings.allowDownload || false}
                            onValueChange={toggleDownload}
                        />
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
                            disabled={!initialSettings.publicThumbnailUrl && !hasThumbnail} // Cannot enable if never existed
                        />
                    </View>

                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.saveButton, saving && styles.disabledButton]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.saveButtonText}>Save Changes</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    drawer: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: 40,
        minHeight: 400,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    closeButton: {
        color: '#007AFF',
        fontSize: 16,
    },
    section: {
        marginBottom: 25,
    },
    sectionTitle: {
        fontSize: 14,
        color: '#666',
        marginBottom: 10,
        textTransform: 'uppercase',
    },
    segmentContainer: {
        flexDirection: 'row',
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        padding: 4,
    },
    segmentButton: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 6,
    },
    segmentButtonActive: {
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 2,
    },
    segmentText: {
        color: '#666',
        fontWeight: '500',
    },
    segmentTextActive: {
        color: '#000',
        fontWeight: '600',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginVertical: 15,
    },
    label: {
        fontSize: 16,
        fontWeight: '500',
    },
    disclaimer: {
        fontSize: 12,
        color: '#888',
        marginTop: 4,
        marginRight: 10,
    },
    divider: {
        height: 1,
        backgroundColor: '#eee',
        marginVertical: 10,
    },
    footer: {
        marginTop: 30,
    },
    saveButton: {
        backgroundColor: '#007AFF',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    disabledButton: {
        backgroundColor: '#ccc',
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
