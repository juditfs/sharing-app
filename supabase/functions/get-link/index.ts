// Supabase Edge Function: get-link
// Handles secure link retrieval with metadata and encryption key separation

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type ActionType = 'metadata' | 'key'

interface GetLinkRequest {
    shortCode: string
    action: ActionType
}

interface MetadataResponse {
    signedUrl: string
    thumbnailUrl?: string
    shareText: string
    allowDownload: boolean
    metadata: {
        id: string
        createdAt: string
    }
}

interface KeyResponse {
    key: string
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // TODO (MVP): Add rate limiting to prevent brute force attacks
    // Recommended: 10 requests/minute per IP using Supabase built-in rate limiting
    // For prototype (localhost only), this is acceptable risk
    // Risk: Brute force enumeration of short codes, DoS attacks

    try {
        // Initialize Supabase client with Service Role key (for bypassing RLS)
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        // Parse request body (from supabase.functions.invoke)
        const body: GetLinkRequest = await req.json()
        const { shortCode, action } = body

        if (!shortCode || !action) {
            return new Response(
                JSON.stringify({ error: 'Missing required parameters: shortCode, action' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (action !== 'metadata' && action !== 'key') {
            return new Response(
                JSON.stringify({ error: 'Invalid action. Must be "metadata" or "key"' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Fetch link from database (using Service Role to bypass RLS)
        const { data: linkData, error: linkError } = await supabaseAdmin
            .from('shared_links')
            .select('*')
            .eq('short_code', shortCode)
            .single()

        if (linkError || !linkData) {
            return new Response(
                JSON.stringify({ error: 'Link not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // CRITICAL: Check revocation and expiry BEFORE returning anything
        if (linkData.is_revoked) {
            return new Response(
                JSON.stringify({ error: 'This link has been revoked by the owner' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (linkData.expires_at && new Date(linkData.expires_at) < new Date()) {
            return new Response(
                JSON.stringify({ error: 'This link has expired' }),
                { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Check if link has been deleted (cleaned up)
        if (linkData.deleted_at) {
            return new Response(
                JSON.stringify({ error: 'This link has been deleted' }),
                { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }


        // Handle different actions
        if (action === 'metadata') {
            // Increment view count ONLY on metadata action (first call)
            await supabaseAdmin
                .from('shared_links')
                .update({
                    view_count: (linkData.view_count || 0) + 1,
                    last_accessed_at: new Date().toISOString(),
                })
                .eq('id', linkData.id)

            // Generate signed URL for photo (valid for 60 seconds)
            const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin
                .storage
                .from('photos')
                .createSignedUrl(extractStoragePath(linkData.photo_url), 60)

            if (signedUrlError || !signedUrlData) {
                console.error('Error generating signed URL:', signedUrlError)
                return new Response(
                    JSON.stringify({ error: 'Failed to generate signed URL' }),
                    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            // Generate signed URL for thumbnail if it exists
            let thumbnailSignedUrl: string | undefined
            if (linkData.thumbnail_url) {
                const { data: thumbData } = await supabaseAdmin
                    .storage
                    .from('photos')
                    .createSignedUrl(extractStoragePath(linkData.thumbnail_url), 60)

                thumbnailSignedUrl = thumbData?.signedUrl
            }

            const response = {
                signedUrl: signedUrlData.signedUrl,
                thumbnailUrl: thumbnailSignedUrl,
                shareText: linkData.share_text,
                allowDownload: linkData.allow_download || false,
                publicThumbnailUrl: linkData.public_thumbnail_url,
                metadata: {
                    id: linkData.id,
                    createdAt: linkData.created_at,
                }
            }

            return new Response(
                JSON.stringify(response),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )

        } else if (action === 'key') {
            // Re-check revocation/expiry (in case it changed between calls)
            const { data: freshLink } = await supabaseAdmin
                .from('shared_links')
                .select('is_revoked, expires_at')
                .eq('id', linkData.id)
                .single()

            if (freshLink?.is_revoked) {
                return new Response(
                    JSON.stringify({ error: 'This link has been revoked by the owner' }),
                    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            if (freshLink?.expires_at && new Date(freshLink.expires_at) < new Date()) {
                return new Response(
                    JSON.stringify({ error: 'This link has expired' }),
                    { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            // Fetch encryption key from link_secrets
            const { data: secretData, error: secretError } = await supabaseAdmin
                .from('link_secrets')
                .select('encryption_key')
                .eq('link_id', linkData.id)
                .single()

            if (secretError || !secretData) {
                console.error('Error fetching encryption key:', secretError)
                return new Response(
                    JSON.stringify({ error: 'Encryption key not found' }),
                    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            const response: KeyResponse = {
                key: secretData.encryption_key,
            }

            return new Response(
                JSON.stringify(response),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

    } catch (error) {
        console.error('Unexpected error:', error)
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

/**
 * Extract storage path from full Supabase storage URL or return path as-is
 * Handles both full URLs and relative storage paths
 * 
 * Examples:
 *   - Full URL: https://xxx.supabase.co/storage/v1/object/public/photos/user-id/file.jpg
 *     Returns: user-id/file.jpg
 *   - Relative path: user-id/file.jpg
 *     Returns: user-id/file.jpg
 */
function extractStoragePath(url: string): string {
    // If it's already a path (no protocol), return as-is
    if (!url.startsWith('http')) {
        return url
    }

    // Extract path from full URL using regex
    const match = url.match(/\/photos\/(.+)$/)
    if (!match) {
        throw new Error(`Invalid storage URL format: ${url}`)
    }

    return match[1]
}
