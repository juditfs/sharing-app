// OG tags for WhatsApp/social previews
import { Metadata } from 'next';
import ViewPage from '@/app/view/ViewPage';

// Force dynamic rendering for metadata
export const dynamic = 'force-dynamic';

type Props = {
    params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { code } = await params;

    if (!code) {
        return {
            title: 'Sharene',
            description: 'Encrypted photo sharing'
        };
    }

    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ndbqasanctkwagyinfag.supabase.co';
        const url = `${supabaseUrl}/functions/v1/get-link`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                shortCode: code,
                action: 'metadata'
            }),
            cache: 'no-store'
        });

        if (!response.ok) {
            return {
                title: 'Sharene',
                description: 'Encrypted photo sharing'
            };
        }

        const data = await response.json();
        const shareText = data.shareText || 'shared a photo';
        const thumbnailUrl = data.publicThumbnailUrl;

        return {
            title: 'Sharene',
            description: shareText,
            openGraph: {
                title: 'Sharene',
                description: shareText,
                url: `https://viewer-rho-seven.vercel.app/p/${code}`,
                images: thumbnailUrl ? [{
                    url: thumbnailUrl,
                    width: 1200,
                    height: 630,
                    alt: 'Photo preview'
                }] : [],
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
