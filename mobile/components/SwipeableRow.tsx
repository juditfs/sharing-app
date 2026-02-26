import React, { useRef } from 'react';
import {
    Animated,
    PanResponder,
    StyleSheet,
    TouchableOpacity,
    View,
    Text,
    Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DELETE_BUTTON_WIDTH = 80;

interface SwipeableRowProps {
    children: React.ReactNode;
    onDelete: () => void;
    disabled?: boolean;
    /** Called when a horizontal swipe gesture begins — use to lock the parent list's scroll */
    onSwipeStart?: () => void;
    /** Called when the gesture ends — use to unlock the parent list's scroll */
    onSwipeEnd?: () => void;
}

export function SwipeableRow({ children, onDelete, disabled, onSwipeStart, onSwipeEnd }: SwipeableRowProps) {
    const translateX = useRef(new Animated.Value(0)).current;
    const restingX = useRef(0);
    const isSwiping = useRef(false);

    const close = (callback?: () => void) => {
        Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 9,
            tension: 80,
        }).start(() => {
            restingX.current = 0;
            callback?.();
        });
    };

    const open = () => {
        Animated.spring(translateX, {
            toValue: -DELETE_BUTTON_WIDTH,
            useNativeDriver: true,
            friction: 9,
            tension: 80,
        }).start(() => {
            restingX.current = -DELETE_BUTTON_WIDTH;
        });
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onStartShouldSetPanResponderCapture: () => false,
            // Continuously evaluate: once dx is clearly dominant, claim the touch
            onMoveShouldSetPanResponder: (_e, g) =>
                Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
            onMoveShouldSetPanResponderCapture: (_e, g) =>
                Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
            onPanResponderGrant: () => {
                isSwiping.current = true;
                onSwipeStart?.();
            },
            onPanResponderMove: (_e, g) => {
                const next = restingX.current + g.dx;
                // Clamp: can only swipe left up to DELETE_BUTTON_WIDTH, not right past 0
                translateX.setValue(Math.max(-DELETE_BUTTON_WIDTH, Math.min(0, next)));
            },
            onPanResponderRelease: (_e, g) => {
                isSwiping.current = false;
                onSwipeEnd?.();
                const projected = restingX.current + g.dx;
                if (projected < -DELETE_BUTTON_WIDTH / 2) {
                    open();
                } else {
                    close();
                }
            },
            onPanResponderTerminate: () => {
                isSwiping.current = false;
                onSwipeEnd?.();
                close();
            },
        })
    ).current;

    const handleDeletePress = () => {
        close(() => onDelete());
    };

    if (disabled) {
        return <View>{children}</View>;
    }

    return (
        // Outer container clips the sliding content at screen width
        <View style={styles.clipper}>
            {/* Inner row: [SCREEN_WIDTH children][DELETE_BUTTON_WIDTH button] */}
            <Animated.View
                style={[styles.row, { transform: [{ translateX }] }]}
                {...panResponder.panHandlers}
            >
                {/* Row content — fixed to SCREEN_WIDTH */}
                <View style={styles.rowContent}>
                    {children}
                </View>

                {/* Delete button — right next to the row content */}
                <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={handleDeletePress}
                    activeOpacity={0.75}
                >
                    <MaterialCommunityIcons name="trash-can-outline" size={22} color="#fff" />
                    <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    clipper: {
        overflow: 'hidden',
        width: SCREEN_WIDTH,
    },
    row: {
        flexDirection: 'row',
        width: SCREEN_WIDTH + DELETE_BUTTON_WIDTH,
    },
    rowContent: {
        width: SCREEN_WIDTH,
    },
    deleteButton: {
        width: DELETE_BUTTON_WIDTH,
        backgroundColor: '#E02424',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
    },
    deleteButtonText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
});
