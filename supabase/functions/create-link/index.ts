// Supabase Edge Function: create-link
// Handles secure link creation and encryption key storage

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateLinkRequest {
    photoUrl: string
    thumbnailUrl?: string
    encryptionKey: string
}

interface CreateLinkResponse {
    shortCode: string
    shareUrl: string
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

        // Get user from auth header
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Missing authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Parse request body
        const { photoUrl, thumbnailUrl, encryptionKey }: CreateLinkRequest = await req.json()

        if (!photoUrl || !encryptionKey) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields: photoUrl, encryptionKey' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Generate short code (8 characters, URL-safe)
        const shortCode = generateShortCode()

        // Insert link into shared_links table
        const { data: linkData, error: linkError } = await supabaseClient
            .from('shared_links')
            .insert({
                user_id: user.id,
                short_code: shortCode,
                photo_url: photoUrl,
                thumbnail_url: thumbnailUrl || null,
            })
            .select()
            .single()

        if (linkError) {
            console.error('Error creating link:', linkError)
            return new Response(
                JSON.stringify({ error: 'Failed to create link' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Store encryption key in link_secrets (bypassing RLS with Service Role)
        const { error: secretError } = await supabaseClient
            .from('link_secrets')
            .insert({
                link_id: linkData.id,
                encryption_key: encryptionKey,
            })

        if (secretError) {
            console.error('Error storing encryption key:', secretError)
            // Rollback: delete the link
            await supabaseClient.from('shared_links').delete().eq('id', linkData.id)
            return new Response(
                JSON.stringify({ error: 'Failed to store encryption key' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Generate share URL
        const shareUrl = `http://localhost:3000/share/${shortCode}`

        const response: CreateLinkResponse = {
            shortCode,
            shareUrl,
        }

        return new Response(
            JSON.stringify(response),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Unexpected error:', error)
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

/**
 * Generate a random URL-safe short code
 * Uses crypto.getRandomValues for cryptographic randomness
 */
function generateShortCode(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const length = 8
    const randomValues = new Uint8Array(length)
    crypto.getRandomValues(randomValues)

    let result = ''
    for (let i = 0; i < length; i++) {
        result += chars[randomValues[i] % chars.length]
    }

    return result
}
