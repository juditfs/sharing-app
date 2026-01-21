/**
 * Decrypt photo using AES-256-GCM
 * Payload structure: [Version: 1 byte] [IV: 12 bytes] [Ciphertext + AuthTag: N bytes]
 */
export async function decryptPhoto(
    encryptedData: ArrayBuffer,
    keyHex: string
): Promise<Blob> {
    try {
        // Validate key format (64 hex characters = 32 bytes = 256 bits)
        if (!/^[0-9a-f]{64}$/i.test(keyHex)) {
            throw new Error('Invalid encryption key format');
        }

        const data = new Uint8Array(encryptedData);

        // Parse structured payload
        const version = data[0];
        if (version !== 1) {
            throw new Error('Unsupported encryption version');
        }

        const iv = data.slice(1, 13); // 12 bytes
        const ciphertext = data.slice(13); // Remaining bytes (includes 16-byte auth tag at end)

        // Convert hex key to CryptoKey
        const keyData = hexToArrayBuffer(keyHex);
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'AES-GCM' },
            false,
            ['decrypt']
        );

        // Decrypt using Web Crypto API
        const decrypted = await crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: iv,
            },
            cryptoKey,
            ciphertext
        );

        // Return as Blob for image display
        return new Blob([decrypted], { type: 'image/jpeg' });
    } catch (error) {
        // Catch specific decryption failures
        if (error instanceof DOMException && error.name === 'OperationError') {
            throw new Error('decryption-failed');
        }
        // Re-throw other errors (validation, unsupported version, etc.)
        throw error;
    }
}

function hexToArrayBuffer(hex: string): ArrayBuffer {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes.buffer;
}
