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

// Mock expo-crypto
jest.mock('expo-crypto', () => ({
    randomUUID: jest.fn(() => 'test-uuid'),
}));

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

// Mock API and Auth
jest.mock('./lib/auth', () => ({
    signInAnonymously: jest.fn(() => Promise.resolve({ user: { id: 'test-user' } })),
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
jest.mock('./lib/api', () => ({
    updateLink: (code: string, settings: any) => mockUpdateLink(code, settings),
    getUserLinks: () => mockGetUserLinks(),
    LinkItem: {}, // Type mock if needed/used at runtime
}));


describe('Sharene App Integration Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
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

});
