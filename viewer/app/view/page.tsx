import { Suspense } from 'react';
import { Metadata } from 'next';
import ViewPage from './ViewPage';
import LoadingState from '@/components/LoadingState';
import { fetchSocialMetadata } from '@/lib/fetchSocialMetadata';

// export const dynamic = 'force-dynamic'; // Let Next.js decide based on searchParams
const DEFAULT_VIEWER_URL = 'https://viewer-rho-seven.vercel.app';

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
        const viewerBaseUrl = (process.env.NEXT_PUBLIC_VIEWER_URL || DEFAULT_VIEWER_URL).replace(/\/$/, '');
        const defaultOgImage = `${viewerBaseUrl}/og-default.png`;
        const data = await fetchSocialMetadata(code);
        if (!data) {
            return {
                title: 'Sharene',
                description: 'Encrypted photo sharing'
            };
        }
        const shareText = data.shareText || 'user shared a photo';
        const thumbnailUrl = data.publicThumbnailUrl || defaultOgImage;

        // Return rich metadata
        return {
            title: 'Sharene',
            description: shareText,
            openGraph: {
                title: 'Sharene',
                description: shareText,
                url: `${viewerBaseUrl}/view?code=${code}`,
                images: [
                    {
                        url: thumbnailUrl,
                        width: 1200, // Standard OG size
                        height: 630,
                        alt: 'Photo preview'
                    }
                ],
                type: 'website',
                siteName: 'Sharene'
            },
            twitter: {
                card: 'summary_large_image',
                title: 'Sharene',
                description: shareText,
                images: [thumbnailUrl]
            }
        };
    } catch {
        return {
            title: 'Sharene',
            description: 'Encrypted photo sharing'
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
