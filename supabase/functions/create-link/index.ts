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
    expiry?: '1h' | '1d' | '1w' | '1m' | '1y' | string // ISO date for custom
    allowDownload?: boolean
    shareText?: string
    publicThumbnailUrl?: string // Unencrypted thumbnail for WhatsApp previews
}

interface CreateLinkResponse {
    shortCode: string
    shareUrl: string
    linkId: string
}

serve(async (req) => {
    console.log("DEPLOY_VERIFICATION: V2 - Using /p/ scheme")

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Get user from auth header
        const authHeader = req.headers.get('Authorization')
        console.log('Authorization header present:', !!authHeader)

        if (!authHeader) {
            console.error('Missing Authorization header')
            return new Response(
                JSON.stringify({ error: 'Missing authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Initialize Service Role client for JWT verification
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

        // Extract token from Authorization header
        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

        if (authError || !user) {
            console.error('JWT verification failed:', authError?.message || 'No user')
            return new Response(
                JSON.stringify({ error: 'Invalid or expired token' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log('User authenticated:', user.id)

        // Parse request body first
        const {
            photoUrl,
            thumbnailUrl,
            encryptionKey,
            expiry,
            allowDownload,
            shareText,
            publicThumbnailUrl
        }: CreateLinkRequest = await req.json()

        // Validate required fields
        if (!photoUrl || !encryptionKey) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields: photoUrl, encryptionKey' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Validate encryption key format (64 hex chars = 32 bytes)
        if (!/^[a-fA-F0-9]{64}$/.test(encryptionKey)) {
            return new Response(
                JSON.stringify({ error: 'Invalid encryption key format (expected 64 hex characters)' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Validate expiry format
        const expiryValidation = validateExpiry(expiry)
        if (!expiryValidation.valid) {
            console.error('Invalid expiry:', expiry, expiryValidation.error)
            return new Response(
                JSON.stringify({ error: expiryValidation.error }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }


        // Validate storage paths belong to authenticated user (prevent path traversal)
        const userPrefix = `${user.id}/`
        if (!photoUrl.startsWith(userPrefix)) {
            return new Response(
                JSON.stringify({ error: 'Invalid photo path: must belong to authenticated user' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (thumbnailUrl && !thumbnailUrl.startsWith(userPrefix)) {
            return new Response(
                JSON.stringify({ error: 'Invalid thumbnail path: must belong to authenticated user' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (publicThumbnailUrl && !publicThumbnailUrl.includes(`/${user.id}/`)) {
            console.error('Invalid public thumbnail URL - user ID not found in path:', publicThumbnailUrl)
            return new Response(
                JSON.stringify({ error: 'Invalid public thumbnail URL: must belong to authenticated user' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Calculate expiry timestamp
        // TEMP: Default to 10 minutes for verification (user request)
        // const expiresAt = calculateExpiry(expiry || '1w')
        const expiresAt = expiry ? calculateExpiry(expiry) : new Date(Date.now() + 10 * 60 * 1000)

        // Insert link with collision retry
        const MAX_RETRIES = 3
        let linkData = null
        let lastError = null

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            const shortCode = generateShortCode()

            const { data, error } = await supabaseAdmin
                .from('shared_links')
                .insert({
                    user_id: user.id,
                    short_code: shortCode,
                    photo_url: photoUrl,
                    thumbnail_url: thumbnailUrl || null,
                    expires_at: expiresAt?.toISOString() || null,
                    allow_download: allowDownload ?? false,
                    share_text: shareText || 'shared a photo',
                    public_thumbnail_url: publicThumbnailUrl || null,
                })
                .select()
                .single()

            if (!error) {
                linkData = data
                break
            }

            // Check if it's a uniqueness violation (PostgreSQL error code 23505)
            if (error.code === '23505' && attempt < MAX_RETRIES - 1) {
                console.log(`Short code collision on attempt ${attempt + 1}, retrying...`)
                continue
            }

            lastError = error
            break
        }

        if (!linkData) {
            console.error('Failed to create link after retries:', lastError)
            return new Response(
                JSON.stringify({ error: 'Failed to create link' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Store encryption key in link_secrets (bypassing RLS with Service Role)
        const { error: secretError } = await supabaseAdmin
            .from('link_secrets')
            .insert({
                link_id: linkData.id,
                encryption_key: encryptionKey,
            })

        if (secretError) {
            console.error('Error storing encryption key:', secretError)
            // Rollback: delete the link
            await supabaseAdmin.from('shared_links').delete().eq('id', linkData.id)
            return new Response(
                JSON.stringify({ error: 'Failed to store encryption key' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Generate share URL (configurable via environment variable)
        // Production URL on Vercel - using /p/ for better OG tag support
        const baseUrl = (Deno.env.get('VIEWER_BASE_URL') || 'https://viewer-rho-seven.vercel.app').replace(/\/$/, '')
        const shareUrl = `${baseUrl}/p/${linkData.short_code}`

        const response: CreateLinkResponse = {
            shortCode: linkData.short_code,
            shareUrl,
            linkId: linkData.id,
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
 * Validate expiry input before processing
 * @param expiry - Expiry option to validate
 * @returns Validation result with error message if invalid
 */
function validateExpiry(expiry?: string): { valid: boolean; error?: string } {
    if (!expiry) return { valid: true }

    const validPresets = ['10m', '1h', '1d', '1w', '1m', '1y']
    if (validPresets.includes(expiry)) return { valid: true }

    // Try parsing as ISO date
    try {
        const date = new Date(expiry)
        if (isNaN(date.getTime())) {
            return {
                valid: false,
                error: 'Invalid expiry format. Use: 1h, 1d, 1w, 1m, 1y, or ISO date string'
            }
        }
        if (date <= new Date()) {
            return {
                valid: false,
                error: 'Expiry date must be in the future'
            }
        }
        return { valid: true }
    } catch {
        return {
            valid: false,
            error: 'Invalid expiry format. Use: 1h, 1d, 1w, 1m, 1y, or ISO date string'
        }
    }
}

/**
 * Calculate expiry timestamp from expiry option
 * @param expiry - Expiry option (1h, 1d, 1w, 1m, 1y) or ISO date string
 * @returns Date object or null for no expiry
 */
function calculateExpiry(expiry?: string): Date | null {
    if (!expiry) return null

    const now = new Date()
    const expiryMap: Record<string, number> = {
        '10m': 10 * 60 * 1000,
        '1h': 1 * 60 * 60 * 1000,
        '1d': 24 * 60 * 60 * 1000,
        '1w': 7 * 24 * 60 * 60 * 1000,
        '1m': 30 * 24 * 60 * 60 * 1000,
        '1y': 365 * 24 * 60 * 60 * 1000,
    }

    if (expiry in expiryMap) {
        return new Date(now.getTime() + expiryMap[expiry])
    }

    // Custom date (ISO string)
    try {
        const customDate = new Date(expiry)
        if (isNaN(customDate.getTime())) {
            return null
        }
        return customDate
    } catch {
        return null
    }
}

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
