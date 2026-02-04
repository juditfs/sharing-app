import { MD3LightTheme, configureFonts } from 'react-native-paper';
import { Platform } from 'react-native';

const fontConfig = {
    fontFamily: Platform.select({
        ios: 'System',
        default: 'Inter',
    }),
};

export const theme = {
    ...MD3LightTheme,
    fonts: configureFonts({ config: fontConfig }),
    colors: {
        ...MD3LightTheme.colors,
        primary: '#6366F1', // Indigo
        secondary: '#EC4899', // Pink
        background: '#F9FAFB',
        surface: '#FFFFFF',
    },
    roundness: 12,
};
