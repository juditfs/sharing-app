import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, FlatList, RefreshControl, Animated, TouchableWithoutFeedback, Easing } from 'react-native';
import { Text, ActivityIndicator, IconButton, Chip, Divider, FAB } from 'react-native-paper'; // Removed Menu import
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import { getUserLinks, LinkItem } from '../lib/api';

interface DashboardScreenProps {
    onOpenSettings: (link: LinkItem) => void;
    onCopyLink: (link: LinkItem) => void;
    onTakePhoto: () => void;
    onPickPhoto: () => void;
}

export function DashboardScreen({ onOpenSettings, onCopyLink, onTakePhoto, onPickPhoto }: DashboardScreenProps) {
    const [links, setLinks] = useState<LinkItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false);

    // Animation Values
    const menuAnim = useRef(new Animated.Value(0)).current;
    const fabScale = useRef(new Animated.Value(1)).current;

    const openMenu = () => {
        setMenuVisible(true);
        Animated.parallel([
            Animated.timing(menuAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
                easing: Easing.out(Easing.ease),
            }),
            Animated.timing(fabScale, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            })
        ]).start();
    };

    const closeMenu = () => {
        Animated.parallel([
            Animated.timing(menuAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
                easing: Easing.in(Easing.ease),
            }),
            Animated.timing(fabScale, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            })
        ]).start(() => setMenuVisible(false));
    };

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
    // ... existing code ...


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

            {/* Portal-like effect for custom menu, but kept in layout for simplicity since it's absolute positioned */}
            {menuVisible && (
                <TouchableWithoutFeedback onPress={closeMenu}>
                    <View style={styles.overlay} />
                </TouchableWithoutFeedback>
            )}

            <View style={styles.fabContainer}>
                {/* FAB - Animated Scale Out */}
                <Animated.View style={{
                    transform: [{ scale: fabScale }],
                    opacity: fabScale,
                    position: 'absolute',
                    right: 0,
                    bottom: 0,
                }}>
                    <FAB
                        icon="plus"
                        color="white"
                        style={styles.fab}
                        onPress={openMenu}
                    />
                </Animated.View>

                {/* Menu - Animated Scale In from bottom right */}
                {menuVisible && (
                    <Animated.View style={[
                        styles.customMenu,
                        {
                            opacity: menuAnim,
                            transform: [
                                { scale: menuAnim },
                                {
                                    translateY: menuAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [20, 0] // Slide up slightly
                                    })
                                }
                            ]
                        }
                    ]}>
                        <TouchableWithoutFeedback onPress={() => { closeMenu(); onTakePhoto(); }}>
                            <View style={styles.menuItem}>
                                <MaterialCommunityIcons name="camera" size={24} color="#333" />
                                <Text style={styles.menuText}>Take Photo</Text>
                            </View>
                        </TouchableWithoutFeedback>

                        {/* No Divider as requested */}

                        <TouchableWithoutFeedback onPress={() => { closeMenu(); onPickPhoto(); }}>
                            <View style={styles.menuItem}>
                                <MaterialCommunityIcons name="image" size={24} color="#333" />
                                <Text style={styles.menuText}>Choose from Library</Text>
                            </View>
                        </TouchableWithoutFeedback>
                    </Animated.View>
                )}
            </View>
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
    fabContainer: {
        position: 'absolute',
        margin: 24,
        right: 0,
        bottom: 0,
        alignItems: 'flex-end', // Ensure items align right
        zIndex: 10, // Ensure above overlay
    },
    fab: {
        backgroundColor: '#000',
        borderRadius: 50,
    },
    customMenu: {
        backgroundColor: 'white',
        borderRadius: 24, // Rounder definition
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginBottom: 0,
        marginRight: 0,
        minWidth: 200,
        position: 'absolute',
        bottom: 0,
        right: 0,

        // Shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 4,

        // Alignment
        transformOrigin: 'bottom right', // React Native specific: anchor point for scale
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    menuText: {
        marginLeft: 12,
        fontSize: 16,
        color: '#333',
        fontWeight: '500',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.05)', // Subtle dim
        zIndex: 1,
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
