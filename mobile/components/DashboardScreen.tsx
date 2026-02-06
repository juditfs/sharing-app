import React, { useEffect, useState } from 'react';
import { StyleSheet, View, FlatList, RefreshControl } from 'react-native';
import { Text, ActivityIndicator, IconButton, Chip, Divider, FAB } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import { getUserLinks, LinkItem } from '../lib/api';

interface DashboardScreenProps {
    onOpenSettings: (link: LinkItem) => void;
    onCopyLink: (link: LinkItem) => void;
    onCreateNew: () => void;
}

export function DashboardScreen({ onOpenSettings, onCopyLink, onCreateNew }: DashboardScreenProps) {
    const [links, setLinks] = useState<LinkItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadLinks = async () => {
        try {
            const data = await getUserLinks();
            setLinks(data);
        } catch (error) {
            console.error('Failed to load dashboard:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadLinks();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        loadLinks();
    };

    const renderItem = ({ item }: { item: LinkItem }) => {
        const shareUrl = process.env.EXPO_PUBLIC_VIEWER_URL
            ? `${process.env.EXPO_PUBLIC_VIEWER_URL}/p/${item.short_code}`
            : `https://viewer-rho-seven.vercel.app/p/${item.short_code}`;

        return (
            <View style={styles.itemContainer}>
                {/* Left: Thumbnail */}
                <View style={styles.thumbnailContainer}>
                    {item.public_thumbnail_url ? (
                        <Image
                            source={{ uri: item.public_thumbnail_url }}
                            style={styles.thumbnail}
                            contentFit="cover"
                        />
                    ) : (
                        <View style={styles.placeholderThumbnail}>
                            <MaterialCommunityIcons name="lock" size={24} color="#aaa" />
                        </View>
                    )}
                </View>

                {/* Center: Info */}
                <View style={styles.infoContainer}>
                    <Text variant="titleMedium" style={styles.shortCode}>
                        /{item.short_code}
                    </Text>
                    <Text variant="bodySmall" style={styles.date}>
                        {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                </View>

                {/* Right: Actions & Stats */}
                <View style={styles.actionsContainer}>
                    <Chip icon="eye" style={styles.viewChip} textStyle={{ fontSize: 10, paddingVertical: 1 }}>
                        {item.view_count || 0}
                    </Chip>

                    <IconButton
                        icon="content-copy"
                        size={20}
                        onPress={() => onCopyLink({ ...item, shareUrl } as any)}
                    />
                    <IconButton
                        icon="cog"
                        size={20}
                        onPress={() => onOpenSettings(item)}
                    />
                </View>
            </View>
        );
    };

    if (loading && !refreshing) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text variant="displaySmall" style={styles.headerTitle}>Shared Links</Text>

            <FlatList
                data={links}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ItemSeparatorComponent={() => <Divider style={styles.divider} />}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <MaterialCommunityIcons name="image-multiple-outline" size={48} color="#ccc" />
                        <Text style={styles.emptyText}>No links shared yet</Text>
                    </View>
                }
            />

            <FAB
                icon="plus"
                style={styles.fab}
                onPress={onCreateNew}
                label="New Link"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        width: '100%',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingBottom: 20,
    },
    itemContainer: {
        flexDirection: 'row',
        padding: 12,
        alignItems: 'center',
        height: 80,
    },
    thumbnailContainer: {
        width: 56,
        height: 56,
        borderRadius: 8,
        // overflow: 'hidden', // Removed to allow shadow to show
        backgroundColor: '#f0f0f0',
        marginRight: 12,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    thumbnail: {
        width: '100%',
        height: '100%',
        borderRadius: 8, // Moved borderRadius here since container overflow is visible
    },
    placeholderThumbnail: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    infoContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    shortCode: {
        fontWeight: 'bold',
        color: '#333',
    },
    date: {
        color: '#888',
        marginTop: 2,
    },
    actionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 0,
    },
    viewChip: {
        height: 24,
        alignItems: 'center',
        backgroundColor: '#f0f0f0',
        marginRight: 4,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
    },
    emptyText: {
        marginTop: 16,
        color: '#888',
        fontSize: 16,
    },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
        backgroundColor: '#6366F1', // Primary color
    },
    headerTitle: {
        fontWeight: 'bold',
        paddingHorizontal: 16,
        paddingTop: 20, // Increased top padding
        paddingBottom: 10,
        color: '#000',
    },
    divider: {
        marginLeft: 80, // iOS style separator inset
    }
});
