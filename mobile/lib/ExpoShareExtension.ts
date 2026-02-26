import { NativeModules } from 'react-native';

// A tiny stub Native Module that would be implemented in Swift
// For now, it gracefully returns null if not linked.
const { ShareExtensionModule } = NativeModules;

export default {
    getAppGroupPath: async (groupId: string): Promise<string | null> => {
        if (ShareExtensionModule && ShareExtensionModule.getAppGroupPath) {
            return await ShareExtensionModule.getAppGroupPath(groupId);
        }
        console.warn('[ShareExtension] Native ShareExtensionModule is not linked. App Group path unavailable.');
        return null; // Fallback so JS tests don't crash
    },
    isNativeModuleLinked: (): boolean => {
        return !!(ShareExtensionModule && ShareExtensionModule.getAppGroupPath);
    },
};
