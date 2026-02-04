import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * API route to pre-warm metadata for a given short code
 * Call this immediately after creating a link to ensure fast WhatsApp previews
 */
export async function POST(request: NextRequest) {
    try {
        const { shortCode } = await request.json();

        if (!shortCode) {
            return NextResponse.json({ error: 'shortCode required' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ndbqasanctkwagyinfag.supabase.co';
        const url = `${supabaseUrl}/functions/v1/get-link`;

        // Fetch metadata
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                shortCode,
                action: 'metadata'
            })
        });

        if (!response.ok) {
            return NextResponse.json({ error: 'Failed to fetch metadata' }, { status: response.status });
        }

        const data = await response.json();

        // Trigger a request to the actual page to warm up Vercel's cache
        const pageUrl = `https://viewer-rho-seven.vercel.app/p/${shortCode}`;
        fetch(pageUrl, {
            headers: { 'User-Agent': 'WhatsApp/2.21.12.21' }
        }).catch(() => { }); // Fire and forget

        return NextResponse.json({
            success: true,
            metadata: {
                shareText: data.shareText,
                hasThumbnail: !!data.publicThumbnailUrl
            }
        });
    } catch (error) {
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
