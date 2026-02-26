import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, SectionList, RefreshControl, Animated, TouchableWithoutFeedback, Easing, Share, Alert, TouchableOpacity, Modal, LayoutRectangle, Dimensions } from 'react-native';
import { Text, ActivityIndicator, IconButton, Divider, FAB } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';

import { getUserLinks, LinkItem, deleteLink } from '../lib/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

import { EncryptedThumbnail } from './EncryptedThumbnail';
import { SwipeableRow } from './SwipeableRow';

type SectionData = {
    title: string;
    data: LinkItem[];
};

const groupLinksByDate = (links: LinkItem[]): SectionData[] => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const isSameDay = (d1: Date, d2: Date) =>
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();

    const sections: SectionData[] = [
        { title: 'Today', data: [] },
        { title: 'Yesterday', data: [] },
        { title: 'This Year', data: [] },
        // Older years will be dynamic
    ];

    const olderYears: { [key: string]: LinkItem[] } = {};

    links.forEach(link => {
        const date = new Date(link.created_at);
        if (isSameDay(date, today)) {
            sections[0].data.push(link);
        } else if (isSameDay(date, yesterday)) {
            sections[1].data.push(link);
        } else if (date.getFullYear() === today.getFullYear()) {
            sections[2].data.push(link);
        } else {
            const year = date.getFullYear().toString();
            if (!olderYears[year]) olderYears[year] = [];
            olderYears[year].push(link);
        }
    });

    // Add older years to sections
    Object.keys(olderYears).sort((a, b) => Number(b) - Number(a)).forEach(year => {
        sections.push({ title: year, data: olderYears[year] });
    });

    // Filter out empty sections
    return sections.filter(section => section.data.length > 0);
};

const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = date.toLocaleString('en-US', { month: 'short' });
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month} ${day} ${hours}:${minutes}`;
};

const getLinkStatus = (expiresAt: string | null, deletedAt: string | null) => {
    if (deletedAt) return { text: 'Deleted', isDeleted: true, isExpiringSoon: false };
    if (!expiresAt) return null;

    const now = new Date();
    const expiryDate = new Date(expiresAt);

    if (expiryDate <= now) return { text: 'Expired', isDeleted: false, isExpiringSoon: true };

    const diffMs = expiryDate.getTime() - now.getTime();
    const diffHours = diffMs / 3600000;
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return { text: `${diffDays}d left`, isDeleted: false, isExpiringSoon: false };

    const remainingHours = Math.floor(diffHours);
    if (remainingHours > 0) return { text: `${remainingHours}h left`, isDeleted: false, isExpiringSoon: true };

    const remainingMins = Math.floor(diffMs / 60000);
    return { text: `${remainingMins}m left`, isDeleted: false, isExpiringSoon: true };
};

interface DashboardScreenProps {
    onOpenSettings: (link: LinkItem, layout?: LayoutRectangle) => void;
    onCopyLink: (link: LinkItem) => void;
    onTakePhoto: () => void;
    onPickPhoto: () => void;
    onLinkPress: (link: LinkItem, layout?: LayoutRectangle) => void;
    onRefreshNeeded?: (refreshFn: () => void) => void;
}

export function DashboardScreen({ onOpenSettings, onCopyLink, onTakePhoto, onPickPhoto, onLinkPress, onRefreshNeeded }: DashboardScreenProps) {
    const [links, setLinks] = useState<LinkItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    // Lock list scrolling while a row swipe gesture is active
    const [listScrollEnabled, setListScrollEnabled] = useState(true);

    // Regular Menu (Black FAB)
    const [menuVisible, setMenuVisible] = useState(false);

    // Context Menu State
    const [activeLink, setActiveLink] = useState<LinkItem | null>(null);
    const [activeItemLayout, setActiveItemLayout] = useState<LayoutRectangle | null>(null);
    const [contextMenuVisible, setContextMenuVisible] = useState(false);

    // Animation Values
    const menuAnim = useRef(new Animated.Value(0)).current;
    const fabScale = useRef(new Animated.Value(1)).current;

    // Context Menu Animations
    const overlayAnim = useRef(new Animated.Value(0)).current; // 0 -> 1 (Opacity)
    const activeItemScale = useRef(new Animated.Value(1)).current; // 1 -> 1.05

    // Refs for list items to measure
    const itemRefs = useRef<Map<string, View>>(new Map());

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

    const handleLongPress = (link: LinkItem, id: string) => {
        const ref = itemRefs.current.get(id);
        if (ref) {
            ref.measureInWindow((x, y, width, height) => {
                setActiveItemLayout({ x, y, width, height });
                setActiveLink(link);
                setContextMenuVisible(true);

                // Start animations
                Animated.parallel([
                    Animated.timing(overlayAnim, {
                        toValue: 1,
                        duration: 200,
                        useNativeDriver: true,
                        easing: Easing.out(Easing.ease),
                    }),
                    Animated.spring(activeItemScale, {
                        toValue: 1.02,
                        friction: 7,
                        tension: 40,
                        useNativeDriver: true,
                    })
                ]).start();
            });
        }
    };

    const closeContextMenu = () => {
        Animated.parallel([
            Animated.timing(overlayAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(activeItemScale, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            })
        ]).start(() => {
            setContextMenuVisible(false);
            setActiveLink(null);
            setActiveItemLayout(null);
        });
    };

    const handleDeleteLink = async (link: LinkItem) => {
        // Close menu first
        closeContextMenu();

        Alert.alert(
            "Delete Link",
            "Are you sure you want to delete this link? This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setLoading(true); // Maybe local loading state better
                            await deleteLink(link.short_code);
                            setLinks(current => current.filter(l => l.id !== link.id));
                        } catch (e) {
                            Alert.alert("Error", "Failed to delete link");
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleShareLink = async (link: LinkItem) => {
        const url = process.env.EXPO_PUBLIC_VIEWER_URL
            ? `${process.env.EXPO_PUBLIC_VIEWER_URL}/p/${link.short_code}`
            : `https://viewer-rho-seven.vercel.app/p/${link.short_code}`;

        try {
            await Share.share({
                message: `Check out this link: ${url}`,
                url: url, // iOS
            });
            closeContextMenu();
        } catch (error) {
            console.error(error);
        }
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

    useEffect(() => {
        loadLinks();
        // Expose refresh function to parent
        if (onRefreshNeeded) {
            onRefreshNeeded(loadLinks);
        }
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        loadLinks();
    };

    const renderItem = ({ item }: { item: LinkItem }) => {
        const isDeleted = !!item.deleted_at;

        return (
            <SwipeableRow
                disabled={isDeleted}
                onDelete={() => handleDeleteLink(item)}
                onSwipeStart={() => setListScrollEnabled(false)}
                onSwipeEnd={() => setListScrollEnabled(true)}
            >
                <TouchableOpacity
                    ref={(ref) => {
                        if (ref) itemRefs.current.set(item.id, ref as unknown as View);
                    }}
                    activeOpacity={isDeleted ? 1 : 0.7}
                    onPress={isDeleted ? undefined : () => {
                        const ref = itemRefs.current.get(item.id);
                        if (ref) {
                            ref.measureInWindow((x, y, width, height) => {
                                onLinkPress(item, { x, y, width, height });
                            });
                        } else {
                            onLinkPress(item);
                        }
                    }}
                    onLongPress={() => handleLongPress(item, item.id)}
                    delayLongPress={200}
                    style={[styles.itemContainer, isDeleted && styles.itemContainerDeleted]}
                >
                    {/* Left: Thumbnail */}
                    <View style={[styles.thumbnailContainer, isDeleted && styles.thumbnailContainerDeleted]}>
                        {isDeleted ? (
                            <View style={styles.placeholderThumbnail}>
                                <MaterialCommunityIcons name="image-off-outline" size={24} color="#ccc" />
                            </View>
                        ) : item.public_thumbnail_url ? (
                            <Image
                                key={`public-${item.id}-${item.public_thumbnail_url}`}
                                source={{ uri: item.public_thumbnail_url }}
                                style={styles.thumbnail}
                                contentFit="cover"
                            />
                        ) : item.thumbnail_url && item.encryption_key ? (
                            <EncryptedThumbnail
                                key={`encrypted-${item.id}-${item.thumbnail_url}`}
                                path={item.thumbnail_url}
                                encryptionKey={item.encryption_key}
                                style={styles.thumbnail}
                            />
                        ) : (
                            <View style={styles.placeholderThumbnail}>
                                <MaterialCommunityIcons name="lock" size={24} color="#aaa" />
                            </View>
                        )}
                    </View>

                    {/* Center: Info */}
                    <View style={styles.infoContainer}>
                        <Text variant="titleMedium" style={[styles.shortCode, isDeleted && { color: '#aaa' }]}>
                            /{item.short_code}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                            <Text variant="bodySmall" style={{ color: '#888' }}>
                                {formatDate(item.created_at)}
                            </Text>
                            <Text style={{ color: '#888', marginHorizontal: 6, fontSize: 12 }}>•</Text>
                            <MaterialCommunityIcons name="eye-outline" size={12} color="#888" style={{ marginRight: 4 }} />
                            <Text style={{ color: '#888', fontSize: 12 }}>
                                {item.view_count || 0}
                            </Text>
                        </View>
                    </View>

                    {/* Right: Badge */}
                    <View style={styles.actionsContainer}>
                        {(() => {
                            const status = getLinkStatus(item.expires_at, item.deleted_at);
                            if (!status) return null;
                            if (status.isDeleted) {
                                return (
                                    <View style={styles.deletedBadge}>
                                        <MaterialCommunityIcons name="trash-can-outline" size={12} color="#aaa" style={{ marginRight: 4 }} />
                                        <Text style={styles.deletedBadgeText}>Deleted</Text>
                                    </View>
                                );
                            }
                            return (
                                <View style={[styles.expiryBadge, status.isExpiringSoon && styles.expiryBadgeUrgent]}>
                                    <MaterialCommunityIcons name="clock-outline" size={12} color={status.isExpiringSoon ? '#9B1C1C' : '#555'} style={{ marginRight: 4 }} />
                                    <Text style={[styles.expiryBadgeText, status.isExpiringSoon && styles.expiryBadgeTextUrgent]}>
                                        {status.text}
                                    </Text>
                                </View>
                            );
                        })()}
                    </View>
                </TouchableOpacity>
            </SwipeableRow>
        );
    };

    // Render logic for the Cloned Item in Overlay
    const renderActiveItem = () => {
        if (!activeLink || !activeItemLayout) return null;

        const item = activeLink;

        return (
            <Animated.View
                style={[
                    styles.itemContainer,
                    {
                        position: 'absolute',
                        top: activeItemLayout.y,
                        left: activeItemLayout.x,
                        width: activeItemLayout.width,
                        height: activeItemLayout.height,
                        backgroundColor: 'white',
                        borderRadius: 12,
                        elevation: 5, // Android shadow
                        shadowColor: "#000", // iOS shadow
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.2,
                        shadowRadius: 8,
                        transform: [{ scale: activeItemScale }],
                        zIndex: 100,
                        marginHorizontal: 0, // Reset margin since position is absolute
                        marginTop: 0,
                    }
                ]}
            >
                {/* Re-render exact item content */}
                <View style={[styles.thumbnailContainer, !!item.deleted_at && styles.thumbnailContainerDeleted]}>
                    {item.deleted_at ? (
                        <View style={styles.placeholderThumbnail}>
                            <MaterialCommunityIcons name="image-off-outline" size={24} color="#ccc" />
                        </View>
                    ) : item.public_thumbnail_url ? (
                        <Image
                            source={{ uri: item.public_thumbnail_url }}
                            style={styles.thumbnail}
                            contentFit="cover"
                        />
                    ) : item.thumbnail_url && item.encryption_key ? (
                        <EncryptedThumbnail
                            path={item.thumbnail_url}
                            encryptionKey={item.encryption_key}
                            style={styles.thumbnail}
                        />
                    ) : (
                        <View style={styles.placeholderThumbnail}>
                            <MaterialCommunityIcons name="lock" size={24} color="#aaa" />
                        </View>
                    )}
                </View>
                <View style={styles.infoContainer}>
                    <Text variant="titleMedium" style={[styles.shortCode, !!item.deleted_at && { color: '#aaa' }]}>/{item.short_code}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                        <Text variant="bodySmall" style={{ color: '#888' }}>{formatDate(item.created_at)}</Text>
                        <Text style={{ color: '#888', marginHorizontal: 6, fontSize: 12 }}>•</Text>
                        <MaterialCommunityIcons name="eye-outline" size={12} color="#888" style={{ marginRight: 4 }} />
                        <Text style={{ color: '#888', fontSize: 12 }}>
                            {item.view_count || 0}
                        </Text>
                    </View>
                </View>
                <View style={styles.actionsContainer}>
                    {(() => {
                        const status = getLinkStatus(item.expires_at, item.deleted_at);
                        if (!status) return null;
                        if (status.isDeleted) {
                            return (
                                <View style={styles.deletedBadge}>
                                    <MaterialCommunityIcons name="trash-can-outline" size={12} color="#aaa" style={{ marginRight: 4 }} />
                                    <Text style={styles.deletedBadgeText}>Deleted</Text>
                                </View>
                            );
                        }
                        return (
                            <View style={[styles.expiryBadge, status.isExpiringSoon && styles.expiryBadgeUrgent]}>
                                <MaterialCommunityIcons name="clock-outline" size={12} color={status.isExpiringSoon ? '#9B1C1C' : '#555'} style={{ marginRight: 4 }} />
                                <Text style={[styles.expiryBadgeText, status.isExpiringSoon && styles.expiryBadgeTextUrgent]}>
                                    {status.text}
                                </Text>
                            </View>
                        );
                    })()}
                </View>
            </Animated.View>
        );
    };

    const renderContextMenu = () => {
        if (!activeItemLayout) return null;

        // Calculate if menu should be above or below
        const spaceBelow = SCREEN_HEIGHT - (activeItemLayout.y + activeItemLayout.height);
        const menuHeight = 180; // Approx height for new layout
        const showBelow = spaceBelow > menuHeight + 50;

        const menuTop = showBelow
            ? activeItemLayout.y + activeItemLayout.height + 16
            : activeItemLayout.y - menuHeight - 16;

        const menuWidth = 280;
        const menuLeft = (SCREEN_WIDTH - menuWidth) / 2;

        return (
            <Animated.View style={[
                styles.contextMenu,
                {
                    opacity: overlayAnim,
                    top: menuTop,
                    left: menuLeft,
                    width: menuWidth,
                }
            ]}>
                {/* Top Row: Horizontal Actions */}
                <View style={styles.contextRow}>
                    <View style={styles.contextActionItem}>
                        <IconButton
                            icon="content-copy"
                            size={24}
                            disabled={!!activeLink?.deleted_at}
                            onPress={() => {
                                const url = process.env.EXPO_PUBLIC_VIEWER_URL
                                    ? `${process.env.EXPO_PUBLIC_VIEWER_URL}/p/${activeLink?.short_code}`
                                    : `https://viewer-rho-seven.vercel.app/p/${activeLink?.short_code}`;
                                closeContextMenu();
                                onCopyLink({ ...activeLink, shareUrl: url } as any);
                            }}
                        />
                        <Text variant="labelSmall" style={activeLink?.deleted_at ? { color: '#ccc' } : undefined}>Copy</Text>
                    </View>
                    <View style={styles.contextActionItem}>
                        <IconButton
                            icon="share-variant"
                            size={24}
                            disabled={!!activeLink?.deleted_at}
                            onPress={() => {
                                if (activeLink) handleShareLink(activeLink);
                            }}
                        />
                        <Text variant="labelSmall" style={activeLink?.deleted_at ? { color: '#ccc' } : undefined}>Share</Text>
                    </View>
                    <View style={styles.contextActionItem}>
                        <IconButton
                            icon="delete-outline"
                            iconColor="red"
                            size={24}
                            onPress={() => {
                                if (activeLink) handleDeleteLink(activeLink);
                            }}
                        />
                        <Text variant="labelSmall" style={{ color: 'red' }}>Delete</Text>
                    </View>
                </View>

                <Divider style={{ width: '80%', alignSelf: 'center', backgroundColor: '#e0e0e0' }} />

                {/* Bottom Row: Settings */}
                <TouchableOpacity
                    style={styles.contextVerticalItem}
                    disabled={!!activeLink?.deleted_at}
                    onPress={() => {
                        if (activeLink) {
                            closeContextMenu();
                            onOpenSettings(activeLink, activeItemLayout ?? undefined);
                        }
                    }}
                >
                    <MaterialCommunityIcons name="cog-outline" size={24} color={activeLink?.deleted_at ? '#ccc' : '#333'} />
                    <Text style={[styles.contextVerticalText, activeLink?.deleted_at && { color: '#ccc' }]}>Edit Settings</Text>
                </TouchableOpacity>
            </Animated.View>
        );
    }

    if (loading && !refreshing) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text variant="displaySmall" style={styles.headerTitle}>Your Shares</Text>

            <SectionList
                sections={groupLinksByDate(links)}
                renderItem={renderItem}
                renderSectionHeader={({ section: { title } }) => (
                    <Text style={styles.sectionHeader}>{title}</Text>
                )}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                scrollEnabled={listScrollEnabled}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ItemSeparatorComponent={() => <Divider style={styles.divider} />}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <MaterialCommunityIcons name="image-multiple-outline" size={48} color="#ccc" />
                        <Text style={styles.emptyText}>No links created yet</Text>
                    </View>
                }
                stickySectionHeadersEnabled={false}
            />

            {/*  Floating Action Button (Menu) */}
            <View style={styles.fabContainer}>
                <Animated.View style={{
                    transform: [{ scale: fabScale }],
                    opacity: fabScale,
                    position: 'absolute', right: 0, bottom: 0,
                }}>
                    <FAB icon="plus" color="white" style={styles.fab} onPress={openMenu} />
                </Animated.View>

                {menuVisible && (
                    <Animated.View style={[
                        styles.customMenu,
                        {
                            opacity: menuAnim,
                            transform: [{ scale: menuAnim }, { translateY: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
                        }
                    ]}>
                        <TouchableWithoutFeedback onPress={() => { closeMenu(); onTakePhoto(); }}>
                            <View style={styles.menuItem}>
                                <MaterialCommunityIcons name="camera" size={24} color="#333" />
                                <Text style={styles.menuText}>Take Photo</Text>
                            </View>
                        </TouchableWithoutFeedback>
                        <TouchableWithoutFeedback onPress={() => { closeMenu(); onPickPhoto(); }}>
                            <View style={styles.menuItem}>
                                <MaterialCommunityIcons name="image" size={24} color="#333" />
                                <Text style={styles.menuText}>Choose from Library</Text>
                            </View>
                        </TouchableWithoutFeedback>
                    </Animated.View>
                )}
            </View>

            {/* Global Overlay for regular menu click-out */}
            {menuVisible && (
                <TouchableWithoutFeedback onPress={closeMenu}>
                    <View style={[styles.overlay, { zIndex: 1 }]} />
                </TouchableWithoutFeedback>
            )}

            {/* Context Menu Modal/Overlay */}
            <Modal
                visible={contextMenuVisible}
                transparent={true}
                animationType="none"
                onRequestClose={closeContextMenu}
            >
                <View style={styles.modalContainer}>
                    {/* The Blur Background */}
                    <TouchableWithoutFeedback onPress={closeContextMenu}>
                        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                    </TouchableWithoutFeedback>

                    {/* The Active Item (Cloned) */}
                    {renderActiveItem()}

                    {/* The Menu */}
                    {renderContextMenu()}
                </View>
            </Modal>
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
        backgroundColor: 'white', // Important for clone
        marginHorizontal: 16,
        borderRadius: 12,
    },
    thumbnailContainer: {
        width: 56,
        height: 56,
        borderRadius: 8,
        backgroundColor: '#f0f0f0',
        marginRight: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    thumbnail: {
        width: '100%',
        height: '100%',
        borderRadius: 8,
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
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    statRowRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    expiryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    expiryBadgeUrgent: {
        backgroundColor: '#FDF2F2',
    },
    expiryBadgeText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#555',
    },
    expiryBadgeTextUrgent: {
        color: '#9B1C1C',
    },
    deletedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    deletedBadgeText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#aaa',
    },
    itemContainerDeleted: {
        opacity: 0.6,
    },
    thumbnailContainerDeleted: {
        backgroundColor: '#f8f8f8',
        shadowOpacity: 0,
        elevation: 0,
    },
    viewChip: {
        height: 24,
        alignItems: 'center',
        backgroundColor: '#f0f0f0',
        marginRight: 4,
    },
    viewCountText: {
        fontSize: 12,
        color: '#888',
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
        alignItems: 'flex-end',
        zIndex: 10,
    },
    fab: {
        backgroundColor: '#000',
        borderRadius: 50,
    },
    customMenu: {
        backgroundColor: 'white',
        borderRadius: 24,
        paddingVertical: 12,
        paddingHorizontal: 16,
        position: 'absolute',
        bottom: 0,
        right: 0,
        minWidth: 200,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 4,
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
        backgroundColor: 'transparent',
    },
    headerTitle: {
        fontWeight: 'bold',
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 10,
        color: '#000',
    },
    sectionHeader: {
        fontSize: 16,
        fontWeight: '500', // Semibold/Medium
        color: '#666',
        marginTop: 24,
        marginBottom: 8,
        paddingHorizontal: 16,
    },
    divider: {
        marginLeft: 96, // 80 (original) + 16 (card margin)
        marginRight: 16, // Match card margin
    },
    // Context Menu Specifics
    modalContainer: {
        flex: 1,
        // justifyContent: 'center',
    },
    contextMenu: {
        position: 'absolute',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 16,
        padding: 16,
        overflow: 'hidden',
        // Shadow for iOS
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 5,
    },
    contextMenuItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        backgroundColor: 'white',
    },
    contextMenuText: {
        fontSize: 16,
        color: '#000',
    },
    contextRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        gap: 24,
    },
    contextActionItem: {
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 50,
    },
    contextVerticalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingTop: 20, // Added 8px extra padding
        width: '80%',
        alignSelf: 'center',
    },
    contextVerticalText: {
        marginLeft: 12,
        fontSize: 16,
        color: '#333',
    }
});
