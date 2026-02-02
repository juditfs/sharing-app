import { Suspense } from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import ViewPage from './ViewPage';
import LoadingState from '@/components/LoadingState';

// export const dynamic = 'force-dynamic'; // Let Next.js decide based on searchParams

export async function generateMetadata({ searchParams }: {
    searchParams: Promise<{ code?: string }>
}): Promise<Metadata> {
    // Await params for Next.js 15 compatibility
    const params = await searchParams;
    const code = params.code;

    // We can't redirect in generateMetadata, so we return basic metadata
    // The default OG tags will be used until redirect happens (which is fast)

    if (!code) {
        return {
            title: 'Sharene',
            description: 'Encrypted photo sharing'
        };
    }

    try {
        // Fetch link metadata from Edge Function
        // Using hardcoded URL to ensure it works on Vercel
        const url = 'https://ndbqasanctkwagyinfag.supabase.co/functions/v1/get-link';

        console.log('[OG] Fetching metadata for code:', code);

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                shortCode: code,
                action: 'metadata'
            }),
            cache: 'no-store', // Disable caching for metadata
            next: { revalidate: 0 } // Next.js specific cache disable
        });

        console.log('[OG] Response status:', response.status);

        if (!response.ok) {
            console.error('[OG] Failed to fetch metadata:', response.status);
            // Don't throw, just return default to avoid crashing
            return {
                title: 'Sharene',
                description: 'Encrypted photo sharing'
            };
        }

        const data = await response.json();
        console.log('[OG] Metadata fetched:', {
            hasShareText: !!data.shareText,
            hasThumbnail: !!data.publicThumbnailUrl
        });

        const shareText = data.shareText || 'user shared a photo';
        const thumbnailUrl = data.publicThumbnailUrl;

        // Return rich metadata
        return {
            title: 'Sharene',
            description: shareText,
            openGraph: {
                title: 'Sharene',
                description: shareText,
                images: thumbnailUrl ? [
                    {
                        url: thumbnailUrl,
                        width: 1200, // Standard OG size
                        height: 630,
                        alt: 'Photo preview'
                    }
                ] : [],
                type: 'website',
                siteName: 'Sharene'
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
            title: 'Sharene',
            description: 'Encrypted photo sharing'
        };
    }
}

export default async function View({ searchParams }: {
    searchParams: Promise<{ code?: string }>
}) {
    const params = await searchParams;

    if (params?.code) {
        redirect(`/p/${params.code}`);
    }

    return (
        <Suspense fallback={<LoadingState />}>
            <ViewPage />
        </Suspense>
    );
}
