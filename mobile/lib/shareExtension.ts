import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import ExpoShareExtension from './ExpoShareExtension';

const APP_GROUP_ID = 'group.com.sharene.app';

interface PendingShare {
    version: number;
    imagePath: string;
    mimeType: string;
    originalFilename: string;
    timestamp: string;
}

export interface SharedImageResult {
    uri: string;
    cleanUp: () => Promise<void>;
}

export interface ShareInboxDiagnostics {
    platform: string;
    containerPath: string | null;
    fileCount: number;
    pendingCount: number;
    files: string[];
    reason?: string;
}

interface ContainerResolution {
    path: string | null;
    reason: string;
}

function toFileUri(path: string): string {
    return path.startsWith('file://') ? path : `file://${path}`;
}

function joinUri(baseUri: string, filename: string): string {
    return `${baseUri.replace(/\/+$/, '')}/${filename}`;
}

// Internal helper to locate the shared directory.
// On iOS, this uses the App Group container.
async function getSharedContainerPath(): Promise<string | null> {
    const resolution = await getSharedContainerPathWithReason();
    return resolution.path;
}

async function getSharedContainerPathWithReason(): Promise<ContainerResolution> {
    if (Platform.OS !== 'ios') return { path: null, reason: 'NOT_IOS' };

    // Expo FileSystem doesn't natively expose `containerURLForSecurityApplicationGroupIdentifier` 
    // directly without a custom module. However, from RN 0.70+ or expo-file-system, 
    // we might need a small native module to get the root.
    // 
    // For the sake of this JS-only implementation mock relying on the native template:
    // If we don't have a native getter for the App Group URL, we can't reliably build 
    // the path purely in JS because the UUID of the container changes.
    //
    // In a real app, you MUST write a 5-line Swift module:
    // `FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.sharene.app")?.path`
    // 
    // We will assume a native Module `ShareExtensionModule` is available.
    // If not, we fall back to null safely.

    try {
        if (ExpoShareExtension?.isNativeModuleLinked && !ExpoShareExtension.isNativeModuleLinked()) {
            return { path: null, reason: 'NATIVE_MODULE_NOT_LINKED' };
        }
        if (ExpoShareExtension && ExpoShareExtension.getAppGroupPath) {
            const path = await ExpoShareExtension.getAppGroupPath(APP_GROUP_ID);
            if (!path) {
                console.warn('[ShareExtension] getAppGroupPath returned null.');
                return { path: null, reason: 'GET_APP_GROUP_PATH_NULL' };
            } else {
                console.log(`[ShareExtension] App Group container: ${path}`);
                return { path, reason: 'OK' };
            }
        }
    } catch (e) {
        console.warn('[ShareExtension] Failed to resolve App Group path:', e);
        return { path: null, reason: `GET_APP_GROUP_PATH_THROW: ${String((e as any)?.message ?? e)}` };
    }

    // Fallback for tests or missing native module: gracefully do nothing.
    return { path: null, reason: 'NO_EXPO_SHARE_EXTENSION_MODULE' };
}

export async function getPendingSharedImage(): Promise<SharedImageResult | null> {
    if (Platform.OS !== 'ios') return null;

    const containerPath = await getSharedContainerPath();
    if (!containerPath) return null;
    const containerUri = toFileUri(containerPath);

    try {
        const files = await FileSystem.readDirectoryAsync(containerUri);
        console.log(`[ShareExtension] Container file count: ${files.length}`);

        // 1. Crash recovery: Check if there's any stale .processing file
        const processingFiles = files.filter(f => f.startsWith('sharene_pending_') && f.endsWith('.processing'));
        for (const pFile of processingFiles) {
            console.log(`[ShareExtension] Found stale processing file: ${pFile}. Renaming back to .pending for retry.`);
            const pendingName = pFile.replace('.processing', '.json');
            await FileSystem.moveAsync({
                from: joinUri(containerUri, pFile),
                to: joinUri(containerUri, pendingName)
            });
        }

        // Refresh list after renames
        const currentFiles = await FileSystem.readDirectoryAsync(containerUri);
        const pendingJsonFiles = currentFiles.filter(f => f.startsWith('sharene_pending_') && f.endsWith('.json'));
        console.log(`[ShareExtension] Pending JSON files: ${pendingJsonFiles.length}`);

        if (pendingJsonFiles.length === 0) {
            return null;
        }

        // Take the first pending share for this activation
        const jsonFilename = pendingJsonFiles[0];
        const processingFilename = jsonFilename.replace('.json', '.processing');

        const jsonPath = joinUri(containerUri, jsonFilename);
        const processingPath = joinUri(containerUri, processingFilename);

        // 2. Consume-once via rename
        await FileSystem.moveAsync({
            from: jsonPath,
            to: processingPath
        });

        // 3. Read payload
        const rawData = await FileSystem.readAsStringAsync(processingPath);
        let payload: PendingShare;
        try {
            payload = JSON.parse(rawData);
        } catch (e) {
            console.warn(`[ShareExtension] Invalid JSON in ${processingFilename}:`, e);
            return null;
        }

        // 4. Validate Version
        if (payload.version !== 1) {
            console.warn(`[ShareExtension] Unknown schema version ${payload.version}. Ignoring.`);
            return null;
        }

        // 5. Path traversal guard: ensure imagePath canonicalizes inside the container
        // We do a simple prefix check as a primary defense.
        if (!payload.imagePath.startsWith(containerPath)) {
            console.warn(`[ShareExtension] Path traversal blocked. Image path ${payload.imagePath} is outside container ${containerPath}.`);
            return null;
        }

        // Check if the actual image file exists
        const imageInfo = await FileSystem.getInfoAsync(toFileUri(payload.imagePath));
        if (!imageInfo.exists) {
            console.warn(`[ShareExtension] Image file missing at ${payload.imagePath}.`);
            return null;
        }

        // Return the result and the cleanup closure
        return {
            uri: `file://${payload.imagePath}`,
            cleanUp: async () => {
                try {
                    await FileSystem.deleteAsync(processingPath, { idempotent: true });
                    await FileSystem.deleteAsync(toFileUri(payload.imagePath), { idempotent: true });
                    console.log(`[ShareExtension] Cleaned up ${processingFilename} and image.`);
                } catch (err) {
                    console.error(`[ShareExtension] Cleanup failed:`, err);
                }
            }
        };

    } catch (err) {
        console.error(`[ShareExtension] Error processing shared image:`, err);
        return null;
    }
}

export async function inspectShareInbox(): Promise<ShareInboxDiagnostics> {
    if (Platform.OS !== 'ios') {
        return {
            platform: Platform.OS,
            containerPath: null,
            fileCount: 0,
            pendingCount: 0,
            files: [],
            reason: 'NOT_IOS',
        };
    }

    const resolution = await getSharedContainerPathWithReason();
    const containerPath = resolution.path;
    if (!containerPath) {
        return {
            platform: Platform.OS,
            containerPath: null,
            fileCount: 0,
            pendingCount: 0,
            files: [],
            reason: resolution.reason,
        };
    }

    const containerUri = toFileUri(containerPath);
    try {
        const files = await FileSystem.readDirectoryAsync(containerUri);
        const pendingCount = files.filter(f => f.startsWith('sharene_pending_') && f.endsWith('.json')).length;
        return {
            platform: Platform.OS,
            containerPath,
            fileCount: files.length,
            pendingCount,
            files: files.slice(0, 20),
        };
    } catch (error: any) {
        return {
            platform: Platform.OS,
            containerPath,
            fileCount: 0,
            pendingCount: 0,
            files: [],
            reason: `READ_DIR_FAILED: ${error?.message || 'unknown'}`,
        };
    }
}
