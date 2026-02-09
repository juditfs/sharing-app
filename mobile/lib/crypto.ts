import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { gcm } from '@noble/ciphers/aes.js';
import 'react-native-get-random-values';

// Encryption version for future compatibility
const ENCRYPTION_VERSION = 1;
const IV_LENGTH = 12; // 12 bytes for GCM (96 bits)

export async function generateEncryptionKey(): Promise<string> {
    // Generate 256-bit (32 bytes) random key
    const randomBytes = await Crypto.getRandomBytesAsync(32);
    return Array.from(randomBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

export async function encryptImage(
    imageUri: string,
    encryptionKey: string
): Promise<Uint8Array> {
    // Read image as base64
    const imageData = await FileSystem.readAsStringAsync(imageUri, {
        encoding: 'base64',
    });

    // Convert to bytes
    const plaintext = base64ToBytes(imageData);
    const keyBytes = hexToBytes(encryptionKey);

    // Generate random IV (12 bytes for GCM)
    const iv = await Crypto.getRandomBytesAsync(IV_LENGTH);

    // Encrypt with AES-256-GCM
    const cipher = gcm(keyBytes, iv);
    const ciphertext = cipher.encrypt(plaintext);

    // Structured payload: version (1 byte) | IV (12 bytes) | ciphertext (includes 16-byte auth tag)
    const payload = new Uint8Array(1 + IV_LENGTH + ciphertext.length);
    payload[0] = ENCRYPTION_VERSION;
    payload.set(iv, 1);
    payload.set(ciphertext, 1 + IV_LENGTH);

    return payload;
}

export async function decryptImage(
    encryptedData: Uint8Array,
    encryptionKey: string
): Promise<Uint8Array> {
    // Parse structured payload
    const version = encryptedData[0];

    if (version !== ENCRYPTION_VERSION) {
        throw new Error(`Unsupported encryption version: ${version}`);
    }

    const iv = encryptedData.slice(1, 1 + IV_LENGTH);
    const ciphertext = encryptedData.slice(1 + IV_LENGTH);

    // Decrypt with AES-256-GCM
    const keyBytes = hexToBytes(encryptionKey);
    const cipher = gcm(keyBytes, iv);
    const plaintext = cipher.decrypt(ciphertext);

    return plaintext;
}

// Helper functions
export function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
}

function base64ToBytes(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}
