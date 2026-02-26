import { getPendingSharedImage } from '../lib/shareExtension';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import ExpoShareExtension from '../lib/ExpoShareExtension';

// Mocks
jest.mock('expo-file-system', () => ({
    readDirectoryAsync: jest.fn(),
    moveAsync: jest.fn(),
    readAsStringAsync: jest.fn(),
    getInfoAsync: jest.fn(),
    deleteAsync: jest.fn(),
}));

jest.mock('../lib/ExpoShareExtension', () => ({
    getAppGroupPath: jest.fn(),
}));

describe('shareExtension', () => {
    const MOCK_CONTAINER = '/mock/container';
    const MOCK_UUID = '1234-5678';

    beforeEach(() => {
        jest.clearAllMocks();
        Platform.OS = 'ios';
        (ExpoShareExtension.getAppGroupPath as jest.Mock).mockResolvedValue(MOCK_CONTAINER);
    });

    it('returns null on Android', async () => {
        Platform.OS = 'android';
        const result = await getPendingSharedImage();
        expect(result).toBeNull();
    });

    it('returns null if no pending files exist', async () => {
        (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(['other_file.txt']);
        const result = await getPendingSharedImage();
        expect(result).toBeNull();
    });

    it('handles happy path: renames JSON, reads, and returns uri with cleanup', async () => {
        const jsonFilename = `sharene_pending_${MOCK_UUID}.json`;
        const processingFilename = `sharene_pending_${MOCK_UUID}.processing`;

        // First read returns the .json
        (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([jsonFilename]);

        // Read JSON returns valid payload
        const mockPayload = {
            version: 1,
            imagePath: `${MOCK_CONTAINER}/sharene_${MOCK_UUID}.jpg`,
            mimeType: 'image/jpeg',
            originalFilename: 'test.jpg',
            timestamp: '2026-02-24T12:00:00Z'
        };
        (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(JSON.stringify(mockPayload));
        (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });

        const result = await getPendingSharedImage();

        expect(result).not.toBeNull();
        expect(result?.uri).toBe(`file://${MOCK_CONTAINER}/sharene_${MOCK_UUID}.jpg`);

        // Verify consume-once rename occurred
        expect(FileSystem.moveAsync).toHaveBeenCalledWith({
            from: `${MOCK_CONTAINER}/${jsonFilename}`,
            to: `${MOCK_CONTAINER}/${processingFilename}`
        });

        // Verify cleanup
        await result?.cleanUp();
        expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(2);
        expect(FileSystem.deleteAsync).toHaveBeenCalledWith(`${MOCK_CONTAINER}/${processingFilename}`, expect.any(Object));
        expect(FileSystem.deleteAsync).toHaveBeenCalledWith(`${MOCK_CONTAINER}/sharene_${MOCK_UUID}.jpg`, expect.any(Object));
    });

    it('recovers from crash by renaming .processing back to .pending', async () => {
        const processingFilename = `sharene_pending_${MOCK_UUID}.processing`;
        const jsonFilename = `sharene_pending_${MOCK_UUID}.json`;

        // First call returns .processing, then after rename returns .json
        (FileSystem.readDirectoryAsync as jest.Mock)
            .mockResolvedValueOnce([processingFilename]) // first scan finds stale processing
            .mockResolvedValueOnce([jsonFilename]);      // second scan finds the recovered pending

        const mockPayload = {
            version: 1,
            imagePath: `${MOCK_CONTAINER}/test.jpg`
        };
        (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(JSON.stringify(mockPayload));
        (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });

        await getPendingSharedImage();

        // Verify recovery rename
        expect(FileSystem.moveAsync).toHaveBeenNthCalledWith(1, {
            from: `${MOCK_CONTAINER}/${processingFilename}`,
            to: `${MOCK_CONTAINER}/${jsonFilename}`
        });
    });

    it('returns null and warns on invalid JSON', async () => {
        const jsonFilename = `sharene_pending_${MOCK_UUID}.json`;
        (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([jsonFilename]);
        (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('{"bad_json":');

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        const result = await getPendingSharedImage();

        expect(result).toBeNull();
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it('discards unknown schema version', async () => {
        (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([`sharene_pending_1.json`]);
        (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(JSON.stringify({ version: 99, imagePath: `${MOCK_CONTAINER}/img.jpg` }));

        const result = await getPendingSharedImage();
        expect(result).toBeNull();
    });

    it('blocks path traversal (image outside container)', async () => {
        (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([`sharene_pending_1.json`]);
        // Payload pointing outside container
        (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(JSON.stringify({
            version: 1,
            imagePath: `/private/var/mobile/Library/OtherApp/img.jpg`
        }));

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        const result = await getPendingSharedImage();

        expect(result).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Path traversal blocked'));
        consoleSpy.mockRestore();
    });
});
