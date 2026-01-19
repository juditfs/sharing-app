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

    try {
        // Initialize Supabase client with Service Role key
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        // Parse query parameters
        const url = new URL(req.url)
        const shortCode = url.searchParams.get('shortCode')
        const action = url.searchParams.get('action') as ActionType

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
        const { data: linkData, error: linkError } = await supabaseClient
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

        // Handle different actions
        if (action === 'metadata') {
            // Generate signed URL for photo (valid for 60 seconds)
            const { data: signedUrlData, error: signedUrlError } = await supabaseClient
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
                const { data: thumbData } = await supabaseClient
                    .storage
                    .from('photos')
                    .createSignedUrl(extractStoragePath(linkData.thumbnail_url), 60)

                thumbnailSignedUrl = thumbData?.signedUrl
            }

            const response: MetadataResponse = {
                signedUrl: signedUrlData.signedUrl,
                thumbnailUrl: thumbnailSignedUrl,
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
            // Fetch encryption key from link_secrets
            const { data: secretData, error: secretError } = await supabaseClient
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
 * Extract storage path from full Supabase storage URL
 * Example: https://xxx.supabase.co/storage/v1/object/public/photos/user-id/file.jpg
 * Returns: user-id/file.jpg
 */
function extractStoragePath(url: string): string {
    const parts = url.split('/photos/')
    return parts[parts.length - 1]
}
