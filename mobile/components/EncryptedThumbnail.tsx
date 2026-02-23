import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { supabase } from '../lib/supabase';
import { decryptImage, bytesToBase64 } from '../lib/crypto';

interface EncryptedThumbnailProps {
    path: string;
    encryptionKey: string;
    style: any;
}

export const EncryptedThumbnail = ({ path, encryptionKey, style }: EncryptedThumbnailProps) => {
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const fetchAndDecrypt = async () => {
            try {
                // 1. Download encrypted file
                const { data, error } = await supabase.storage
                    .from('photos')
                    .download(path);

                if (error || !data) {
                    console.warn('EncryptedThumbnail: download failed', error);
                    throw error || new Error('No data');
                }

                // 2. Convert Blob to Uint8Array
                const buffer = await new Response(data).arrayBuffer();
                const encryptedBytes = new Uint8Array(buffer);

                // 3. Decrypt
                const decryptedBytes = await decryptImage(encryptedBytes, encryptionKey);

                // 4. Convert to Base64
                const base64 = bytesToBase64(decryptedBytes);
                const uri = `data:image/jpeg;base64,${base64}`;

                if (isMounted) {
                    setImageUri(uri);
                    setLoading(false);
                }
            } catch (err) {
                // Don't use console.error here: React Native shows LogBox for each failed decrypt.
                // Failed decrypts are non-fatal; we fall back to a lock placeholder.
                console.warn('EncryptedThumbnail: failed to decrypt thumbnail, showing placeholder');
                if (isMounted) setLoading(false);
            }
        };

        fetchAndDecrypt();

        return () => { isMounted = false; };
    }, [path, encryptionKey]);

    if (loading) {
        return (
            <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }]}>
                <ActivityIndicator size="small" color="#ccc" />
            </View>
        );
    }

    if (!imageUri) {
        return (
            <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#eee' }]}>
                <MaterialCommunityIcons name="lock" size={24} color="#aaa" />
            </View>
        );
    }

    return (
        <View style={style}>
            <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={200} />
            {/* Overlay Lock Icon - subtle indicator of encryption */}
            <View style={[StyleSheet.absoluteFillObject, {
                backgroundColor: 'rgba(0,0,0,0.3)',
                justifyContent: 'center',
                alignItems: 'center'
            }]}>
                <MaterialCommunityIcons name="lock" size={20} color="white" />
            </View>
        </View>
    );
};
