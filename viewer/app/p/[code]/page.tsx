// Build timestamp: 2026-02-02T23:06:00Z - Force Vercel rebuild
import { Metadata } from 'next';
import ViewPage from '@/app/view/ViewPage';

// Force dynamic rendering to ensure generateMetadata runs on every request
// and bot detection works correctly for social media crawlers
export const dynamic = 'force-dynamic';

// params is a Promise in Next.js 15
type Props = {
    params: Promise<{ code: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    // Await params for Next.js 15 compatibility
    const { code } = await params;

    if (!code) {
        return {
            title: 'Sharene',
            description: 'Encrypted photo sharing'
        };
    }

    try {
        // Use environment variable for Supabase URL to support multi-environment deployments
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ndbqasanctkwagyinfag.supabase.co';
        const url = `${supabaseUrl}/functions/v1/get-link`;

        console.log('[OG] Fetching metadata for code (path param):', code);

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                shortCode: code,
                action: 'metadata'
            }),
            cache: 'no-store', // Critical for dynamic content
            next: { revalidate: 0 }
        });

        console.log('[OG] Response status:', response.status);

        if (!response.ok) {
            console.error('[OG] Failed to fetch metadata:', response.status);
            return {
                title: 'Sharene',
                description: 'Encrypted photo sharing'
            };
        }

        const data = await response.json();
        // Align with backend default: "shared a photo"
        const shareText = data.shareText || 'shared a photo';
        const thumbnailUrl = data.publicThumbnailUrl;

        // Log warning if thumbnail is missing (helps debug bucket/policy issues)
        if (!thumbnailUrl) {
            console.warn('[OG] No publicThumbnailUrl found for code:', code);
        }

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
                        width: 1200,
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

export default async function Page({ params }: Props) {
    const { code } = await params;
    return <ViewPage code={code} />;
}
