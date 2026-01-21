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

                // Fetch link metadata and encryption key
                const linkData = await getLinkData(shortCode!);

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
                const encryptedData = await downloadEncryptedPhoto(linkData.signedPhotoUrl);

                // Decrypt client-side
                const decryptedBlob = await decryptPhoto(encryptedData, linkData.encryptionKey);

                // Create object URL for display
                const objectUrl = URL.createObjectURL(decryptedBlob);
                photoUrlRef.current = objectUrl;
                setPhotoUrl(objectUrl);
                setMetadata(linkData);
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
