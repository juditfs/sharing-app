'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { getLinkData, downloadEncryptedPhoto, LinkData } from '@/lib/api';
import { decryptPhoto } from '@/lib/crypto';
import PhotoViewer from '@/components/PhotoViewer';
import LoadingState from '@/components/LoadingState';
import ErrorScreen from '@/components/ErrorScreen';

export default function ViewPage() {
    const searchParams = useSearchParams();
    const shortCode = searchParams.get('code');

    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const [metadata, setMetadata] = useState<LinkData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Use ref to track object URL for proper cleanup
    const photoUrlRef = useRef<string | null>(null);

    useEffect(() => {
        if (!shortCode) {
            setError('not-found');
            setLoading(false);
            return;
        }

        async function loadPhoto() {
            try {
                setLoading(true);
                const startTime = performance.now();
                console.log('👀 [PERF] Starting photo view workflow');

                // Fetch link metadata and encryption key
                const t1 = performance.now();
                const linkData = await getLinkData(shortCode!);
                console.log(`⏱️  [PERF] Fetch metadata + key: ${(performance.now() - t1).toFixed(1)}ms`);

                // Check if link is valid
                if (linkData.isRevoked) {
                    setError('revoked');
                    return;
                }

                if (linkData.expiresAt && new Date(linkData.expiresAt) < new Date()) {
                    setError('expired');
                    return;
                }

                // Download encrypted photo
                const t2 = performance.now();
                const encryptedData = await downloadEncryptedPhoto(linkData.signedPhotoUrl);
                console.log(`⏱️  [PERF] Download encrypted blob (${(encryptedData.byteLength / 1024).toFixed(1)} KB): ${(performance.now() - t2).toFixed(1)}ms`);

                // Decrypt client-side
                const t3 = performance.now();
                const decryptedBlob = await decryptPhoto(encryptedData, linkData.encryptionKey);
                console.log(`⏱️  [PERF] Client-side decryption: ${(performance.now() - t3).toFixed(1)}ms`);

                // Create object URL for display
                const objectUrl = URL.createObjectURL(decryptedBlob);
                photoUrlRef.current = objectUrl;
                setPhotoUrl(objectUrl);
                setMetadata(linkData);

                const totalTime = performance.now() - startTime;
                console.log(`✅ [PERF] Total view time: ${totalTime.toFixed(1)}ms (${(totalTime / 1000).toFixed(2)}s)`);
            } catch (err: any) {
                console.error('Error loading photo:', err);

                // Map specific errors to user-friendly messages
                if (err.message === 'decryption-failed') {
                    setError('decryption-failed');
                } else {
                    setError(err.message || 'not-found');
                }
            } finally {
                setLoading(false);
            }
        }

        loadPhoto();

        // Cleanup object URL on unmount
        return () => {
            if (photoUrlRef.current) {
                URL.revokeObjectURL(photoUrlRef.current);
                photoUrlRef.current = null;
            }
        };
    }, [shortCode]);

    if (loading) {
        return <LoadingState />;
    }

    if (error) {
        return <ErrorScreen error={error} />;
    }

    return (
        <PhotoViewer
            photoUrl={photoUrl!}
            shareText={metadata!.shareText}
        />
    );
}
