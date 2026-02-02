import { Suspense } from 'react';
import { Metadata } from 'next';
import ViewPage from './ViewPage';
import LoadingState from '@/components/LoadingState';

// Force dynamic rendering so OG tags are generated per request
export const dynamic = 'force-dynamic';

export async function generateMetadata({ searchParams }: {
    searchParams: { code?: string }
}): Promise<Metadata> {
    const code = searchParams.code;

    if (!code) {
        return {
            title: 'Sharene',
            description: 'Encrypted photo sharing'
        };
    }

    try {
        // Fetch link metadata from Edge Function
        const response = await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-link`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shortCode: code,
                    action: 'metadata'
                }),
                cache: 'no-store' // Don't cache for fresh data
            }
        );

        if (!response.ok) {
            throw new Error('Link not found');
        }

        const data = await response.json();

        return {
            title: 'Sharene',
            description: data.shareText || 'user shared a photo',
            openGraph: {
                title: 'Sharene',
                description: data.shareText || 'user shared a photo',
                images: data.publicThumbnailUrl ? [
                    {
                        url: data.publicThumbnailUrl,
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
                description: data.shareText || 'user shared a photo',
                images: data.publicThumbnailUrl ? [data.publicThumbnailUrl] : []
            }
        };
    } catch (error) {
        console.error('Error generating metadata:', error);
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
