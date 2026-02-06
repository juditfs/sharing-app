import 'react-native-get-random-values';

// Mock the Expo runtime to avoid "import outside scope" errors
jest.mock('expo', () => {
    const React = require('react');
    const { View } = require('react-native');
    return {
        registerRootComponent: jest.fn(),
    };
});

jest.mock('expo-status-bar', () => ({
    StatusBar: () => null,
}));


jest.mock('expo-modules-core', () => {
    const React = require('react');
    return {
        NativeModulesProxy: {},
        EventEmitter: jest.fn(() => ({
            addListener: jest.fn(),
            removeListeners: jest.fn(),
        })),
        requireNativeModule: jest.fn(() => ({})),
        Platform: { OS: 'ios' },
    };
});

global.alert = jest.fn();

console.log('Jest setup file loaded');
