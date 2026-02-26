// OG tags for WhatsApp/social previews
import { Metadata } from 'next';
import ViewPage from '@/app/view/ViewPage';
import { fetchSocialMetadata } from '@/lib/fetchSocialMetadata';

// Force dynamic rendering for metadata
export const dynamic = 'force-dynamic';
const DEFAULT_VIEWER_URL = 'https://viewer-rho-seven.vercel.app';

type Props = {
    params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { code } = await params;
    const viewerBaseUrl = (process.env.NEXT_PUBLIC_VIEWER_URL || DEFAULT_VIEWER_URL).replace(/\/$/, '');
    const defaultOgImage = `${viewerBaseUrl}/og-default.png`;

    if (!code) {
        return {
            title: 'Sharene',
            description: 'Encrypted photo sharing'
        };
    }

    try {
        const data = await fetchSocialMetadata(code);
        if (!data) {
            return {
                title: 'Sharene',
                description: 'Encrypted photo sharing'
            };
        }

        const shareText = data.shareText || 'shared a photo';
        const thumbnailUrl = data.publicThumbnailUrl || defaultOgImage;

        return {
            title: 'Sharene',
            description: shareText,
            openGraph: {
                title: 'Sharene',
                description: shareText,
                url: `${viewerBaseUrl}/p/${code}`,
                images: [{
                    url: thumbnailUrl,
                    width: 1200,
                    height: 630,
                    alt: 'Photo preview'
                }],
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

export default async function Page({ params }: Props) {
    const { code } = await params;
    return <ViewPage code={code} />;
}
