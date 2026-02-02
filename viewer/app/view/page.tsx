import { Suspense } from 'react';
import { Metadata } from 'next';
import ViewPage from './ViewPage';
import LoadingState from '@/components/LoadingState';

// Force dynamic rendering so OG tags are generated per request
export const dynamic = 'force-dynamic';

export async function generateMetadata({ searchParams }: {
    searchParams: Promise<{ code?: string }>
}): Promise<Metadata> {
    const params = await searchParams;
    const code = params.code;

    if (!code) {
        return {
            title: 'Sharene',
            description: 'Encrypted photo sharing'
        };
    }

    try {
        // Fetch link metadata from Edge Function
        const url = 'https://ndbqasanctkwagyinfag.supabase.co/functions/v1/get-link';

        console.log('[OG] Fetching metadata for code:', code);

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                shortCode: code,
                action: 'metadata'
            }),
            cache: 'no-store'
        });

        console.log('[OG] Response status:', response.status);

        if (!response.ok) {
            console.error('[OG] Failed to fetch metadata:', response.status);
            throw new Error('Link not found');
        }

        const data = await response.json();
        console.log('[OG] Metadata fetched:', {
            hasShareText: !!data.shareText,
            hasThumbnail: !!data.publicThumbnailUrl
        });

        const shareText = data.shareText || 'user shared a photo';
        const thumbnailUrl = data.publicThumbnailUrl;

        return {
            title: 'Sharene',
            description: shareText,
            openGraph: {
                title: 'Sharene',
                description: shareText,
                images: thumbnailUrl ? [
                    {
                        url: thumbnailUrl,
                        width: 400,
                        height: 400,
                        alt: 'Photo preview'
                    }
                ] : [],
                type: 'website'
            },
            twitter: {
                card: 'summary_large_image',
                title: 'Sharene',
                description: shareText,
                images: thumbnailUrl ? [thumbnailUrl] : []
            }
        };
    } catch (error: any) {
        console.error('[OG] Error generating metadata:', error);
        return {
            title: 'Sharene Debug',
            description: `Debug Error: ${error?.message || 'Unknown error'} | Code: ${code}`
        };
    }
}

export default function View() {
    return (
        <Suspense fallback={<LoadingState />}>
            <ViewPage />
        </Suspense>
    );
}
