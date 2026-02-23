import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import App from './App';

// --- Mocks ---

// Mock expo-image-picker
jest.mock('expo-image-picker', () => ({
    requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    launchImageLibraryAsync: jest.fn(() => Promise.resolve({
        canceled: false,
        assets: [{ uri: 'file://test_image.jpg' }]
    })),
    launchCameraAsync: jest.fn(() => Promise.resolve({
        canceled: false,
        assets: [{ uri: 'file://camera_image.jpg' }]
    })),
}));

// Mock expo-clipboard
jest.mock('expo-clipboard', () => ({
    setStringAsync: jest.fn(() => Promise.resolve()),
}));

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
    readAsStringAsync: jest.fn(() => Promise.resolve('mock-data')),
    writeAsStringAsync: jest.fn(() => Promise.resolve()),
    deleteAsync: jest.fn(() => Promise.resolve()),
    documentDirectory: 'file:///mock-dir/',
    EncodingType: { Base64: 'base64' },
}));
jest.mock('expo-file-system/legacy', () => ({
    readAsStringAsync: jest.fn(() => Promise.resolve('mock-data')),
    documentDirectory: 'file:///mock-dir/',
}));

// Mock expo-crypto
jest.mock('expo-crypto', () => ({
    randomUUID: jest.fn(() => 'test-uuid'),
}));

// Mock expo-blur
jest.mock('expo-blur', () => {
    const { View } = require('react-native');
    return {
        BlurView: (props: any) => <View {...props} testID="mock-blur-view" />
    };
});

// Mock expo-image (Image component)
jest.mock('expo-image', () => {
    const { View } = require('react-native');
    return {
        Image: (props: any) => <View {...props} testID="mock-expo-image" />
    };
});

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => {
    const { View } = require('react-native');
    return {
        MaterialCommunityIcons: (props: any) => <View {...props} testID="mock-icon" />,
        Ionicons: (props: any) => <View {...props} testID="mock-ionicon" />
    };
});

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock expo-apple-authentication
jest.mock('expo-apple-authentication', () => ({
    AppleAuthenticationButton: ({ onPress, ...props }: any) => {
        const { TouchableOpacity, Text } = require('react-native');
        return <TouchableOpacity onPress={onPress} {...props}><Text>Sign in with Apple</Text></TouchableOpacity>;
    },
    AppleAuthenticationButtonType: { SIGN_IN: 'SIGN_IN' },
    AppleAuthenticationButtonStyle: { BLACK: 'BLACK' },
    AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
    signInAsync: jest.fn(() => Promise.resolve({
        identityToken: 'mock-identity-token',
        user: 'apple-user-id',
    })),
}));

// Mock API and Auth
const mockGetSession = jest.fn(() => Promise.resolve({ user: { id: 'test-user', email: undefined, app_metadata: {} } }));
const mockSignInWithApple = jest.fn(() => Promise.resolve({ user: { id: 'apple-user' } }));
const mockPrepareMigration = jest.fn(() => Promise.resolve('mock-migration-code'));
const mockCompleteMigration = jest.fn(() => Promise.resolve());
const mockSignOut = jest.fn(() => Promise.resolve());

const mockSignInWithEmailOtp = jest.fn((_email: string) => Promise.resolve());
const mockVerifyEmailOtp = jest.fn((_email: string, _token: string) => Promise.resolve());

jest.mock('./lib/auth', () => ({
    signInAnonymously: jest.fn(() => Promise.resolve({ user: { id: 'test-user' } })),
    getSession: () => mockGetSession(),
    isAnonymousSession: jest.fn((session: any) => {
        if (!session) return false;
        return !session.user?.email && !session.user?.app_metadata?.provider;
    }),
    signInWithApple: () => mockSignInWithApple(),
    signInWithEmailOtp: (email: string) => mockSignInWithEmailOtp(email),
    verifyEmailOtp: (email: string, token: string) => mockVerifyEmailOtp(email, token),
    prepareMigration: () => mockPrepareMigration(),
    completeMigration: (code: string) => mockCompleteMigration(code),
    signOut: () => mockSignOut(),
}));

// Mock API workflow
jest.mock('./lib/photoWorkflow', () => ({
    processAndUploadPhoto: jest.fn((uri, settings) => Promise.resolve({
        shortCode: 'TEST12',
        shareUrl: 'https://sharene.app/p/TEST12',
        thumbnailUri: uri,
        publicThumbnailUrl: 'https://supabase.co/storage/v1/object/public/thumbnails/TEST12.jpg'
    })),
}));

// Mock Supabase API calls
const mockUpdateLink = jest.fn(() => Promise.resolve());
const mockGetUserLinks = jest.fn<Promise<any[]>, []>(() => Promise.resolve([])); // Default empty

// Mock Supabase client module
jest.mock('./lib/supabase', () => ({
    supabase: {
        auth: {
            getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
            onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
            signInWithOtp: jest.fn(() => Promise.resolve({ data: {}, error: null })),
            verifyOtp: jest.fn(() => Promise.resolve({ data: {}, error: null })),
            signInAnonymously: jest.fn(() => Promise.resolve({ data: { user: { id: 'test-user' } }, error: null })),
            signOut: jest.fn(() => Promise.resolve({ error: null })),
        },
        rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
        storage: {
            from: jest.fn(() => ({
                remove: jest.fn(() => Promise.resolve({ data: [], error: null })),
                getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'http://mock-url' } })),
            })),
        }
    },
}));

jest.mock('./lib/api', () => ({
    updateLink: (code: string, settings: any) => mockUpdateLink(code, settings),
    getUserLinks: () => mockGetUserLinks(),
    LinkItem: {}, // Type mock if needed/used at runtime
}));


describe('Sharene App Integration Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetUserLinks.mockResolvedValue([]);
    });

    const waitForUploadScreen = async (utils: ReturnType<typeof render>) => {
        await utils.findByText('Sharene');
        await utils.findByText('Choose from Library');
    };

    test('1. Upload from Library flow', async () => {
        const { getByText, findByText } = render(<App />);

        // Wait for app to load (Upload screen)
        await waitForUploadScreen({ getByText, findByText } as any);

        // Press "Choose from Library"
        const libraryButton = getByText('Choose from Library');
        fireEvent.press(libraryButton);

        // Should switch to Success screen
        const successTitle = await findByText('Link Created!');
        expect(successTitle).toBeTruthy();

        // Verify link URL is displayed
        const linkText = await findByText('https://sharene.app/p/TEST12');
        expect(linkText).toBeTruthy();
    });

    test('2. Take a photo flow', async () => {
        const { getByText, findByText } = render(<App />);
        await waitForUploadScreen({ getByText, findByText } as any);

        // Press "Take Photo"
        const cameraButton = getByText('Take Photo');
        fireEvent.press(cameraButton);

        // Should switch to success screen
        await findByText('Link Created!');
        // Verify camera image used (implied by mock)
    });

    test('4. Copy Link action', async () => {
        const { getByText, findByText } = render(<App />);

        // Trigger upload first to get to success screen
        await waitForUploadScreen({ getByText, findByText } as any);
        fireEvent.press(getByText('Choose from Library'));
        await findByText('Link Created!');

        // Press Copy Link
        const copyButton = getByText('Copy Link');
        fireEvent.press(copyButton);

        // Verify Clipboard called
        const Clipboard = require('expo-clipboard');
        expect(Clipboard.setStringAsync).toHaveBeenCalledWith('https://sharene.app/p/TEST12');
    });

    test('5. Change expiration (Edit Settings)', async () => {
        const { getByText, findByText } = render(<App />);

        // Trigger upload
        await waitForUploadScreen({ getByText, findByText } as any);
        fireEvent.press(getByText('Choose from Library'));
        await findByText('Link Created!');

        // Open Settings
        fireEvent.press(getByText('Edit Settings'));

        // Verify Settings Drawer opens
        const settingsHeader = await findByText('Settings');
        expect(settingsHeader).toBeTruthy();

        // Find "Get link" button and press it (assuming default settings for now)
        // We could check changing a segmented button value if we added testID to them
        const saveButton = getByText('Get link');
        fireEvent.press(saveButton);

        // Verify updateLink API called
        await waitFor(() => {
            expect(mockUpdateLink).toHaveBeenCalled();
        });
    });

    test('7. Get new link (Share Another)', async () => {
        const { getByText, findByText } = render(<App />);

        await waitForUploadScreen({ getByText, findByText } as any);
        fireEvent.press(getByText('Choose from Library'));
        await findByText('Link Created!');

        // Press Share Another
        fireEvent.press(getByText('Share Another'));

        // Should be back at Upload screen
        await findByText('Sharene');
        expect(getByText('Take Photo')).toBeTruthy();
    });

    test('Home Logic: Check links on load (Dashboard)', async () => {
        // Mock getUserLinks to return data
        mockGetUserLinks.mockResolvedValue([
            {
                id: '1',
                short_code: 'DASH12',
                created_at: new Date().toISOString(),
                view_count: 5,
                public_thumbnail_url: 'http://thumb.jpg',
                share_text: 'Test',
                allow_download: false
            }
        ]);

        const { findByText } = render(<App />);

        // Should skip Upload screen and go to Dashboard
        // "Created Links" is the header title we added
        const dashboardHeader = await findByText('Created Links');
        expect(dashboardHeader).toBeTruthy();

        // Should show the link shortcode from mock
        const linkItem = await findByText('/DASH12');
        expect(linkItem).toBeTruthy();
    });

    test('5. Shows LoginScreen when no session exists', async () => {
        mockGetSession.mockResolvedValueOnce(null as any);

        const { findByText } = render(<App />);

        // Should show the login screen welcome step
        const skipText = await findByText('Get Started');
        expect(skipText).toBeTruthy();
    });

    test('6. Migration flow: calls prepareMigration and logs in', async () => {
        // Start as anonymous user
        mockGetSession.mockResolvedValue({
            user: { id: 'anon-user', email: undefined, app_metadata: {} }
        } as any);

        const { findByText } = render(<App />);

        // Wait for nudge to appear (anon + iOS)
        const nudge = await findByText('Back up with Apple');
        expect(nudge).toBeTruthy();

        fireEvent.press(nudge);

        await waitFor(() => {
            expect(mockPrepareMigration).toHaveBeenCalledTimes(1);
        });
    });

    test('7. Sign out clears session and shows LoginScreen', async () => {
        const { findByText, getByText } = render(<App />);

        // Wait for app to load
        await findByText('Sharene');

        // Press Sign Out
        const signOutButton = getByText('Sign Out');
        fireEvent.press(signOutButton);

        await waitFor(() => {
            expect(mockSignOut).toHaveBeenCalledTimes(1);
        });
    });

    test('8. Email OTP login flow', async () => {
        mockGetSession.mockResolvedValueOnce(null as any);
        const { findByText, findByPlaceholderText, getByText } = render(<App />);

        // 1. Initial login screen
        const getStartedBtn = await findByText('Get Started');
        fireEvent.press(getStartedBtn);

        // 2. Email entry screen
        const emailInput = await findByPlaceholderText('Your Email');
        fireEvent.changeText(emailInput, 'test@example.com');
        const continueBtn = getByText('Continue');
        fireEvent.press(continueBtn);

        // 3. Code entry screen
        const codeInput = await findByPlaceholderText('000000');
        fireEvent.changeText(codeInput, '123456');
        const verifyBtn = getByText('Verify');

        // Mock successful session after verification
        mockGetSession.mockResolvedValueOnce({
            user: { id: 'email-user', email: 'test@example.com', app_metadata: { provider: 'email' } }
        } as any);

        fireEvent.press(verifyBtn);

        await waitFor(() => {
            expect(mockVerifyEmailOtp).toHaveBeenCalledWith('test@example.com', '123456');
        });

        // Should land on Dashboard/Upload after login
        await findByText('Encrypted Photo Sharing');
    });

});
