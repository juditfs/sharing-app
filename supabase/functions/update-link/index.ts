// Supabase Edge Function: update-link
// Updates link settings (expiry, share text, thumbnail) without re-uploading photo

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UpdateLinkRequest {
    linkId: string
    expiry?: string
    shareText?: string
    enableThumbnail?: boolean
}

interface UpdateLinkResponse {
    success: boolean
    link: {
        expiresAt: string | null
        shareText: string
        hasThumbnail: boolean
    }
}

serve(async (req) => {
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
            console.error('Invalid or expired token:', authError)
            return new Response(
                JSON.stringify({ error: 'Invalid or expired token' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log('User authenticated:', user.id)

        // Parse request body
        const {
            linkId,
            expiry,
            shareText,
            enableThumbnail
        }: UpdateLinkRequest = await req.json()

        // Validate required fields
        if (!linkId) {
            return new Response(
                JSON.stringify({ error: 'linkId is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Fetch link and verify ownership
        const { data: link, error: linkError } = await supabaseAdmin
            .from('shared_links')
            .select('*')
            .eq('id', linkId)
            .eq('user_id', user.id)  // Enforce ownership
            .single()

        if (linkError || !link) {
            console.error('Link not found or not owned by user:', linkError)
            return new Response(
                JSON.stringify({ error: 'Link not found or access denied' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // CRITICAL: Block updates on revoked links
        if (link.is_revoked) {
            return new Response(
                JSON.stringify({ error: 'Cannot update revoked link' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // CRITICAL: Block updates on expired links
        if (link.expires_at && new Date(link.expires_at) < new Date()) {
            return new Response(
                JSON.stringify({ error: 'Cannot update expired link' }),
                { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Prepare updates object
        const updates: any = {}

        // Handle expiry update
        if (expiry !== undefined) {
            const validation = validateExpiry(expiry)
            if (!validation.valid) {
                return new Response(
                    JSON.stringify({ error: validation.error }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            const newExpiresAt = calculateExpiry(expiry)
            if (newExpiresAt && newExpiresAt <= new Date()) {
                return new Response(
                    JSON.stringify({ error: 'Expiry must be in the future' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            updates.expires_at = newExpiresAt?.toISOString() || null
        }

        // Handle share text update
        if (shareText !== undefined) {
            updates.share_text = shareText
        }

        // Handle thumbnail toggle
        if (enableThumbnail !== undefined) {
            if (enableThumbnail && !link.public_thumbnail_url) {
                // User wants to enable thumbnail
                if (!link.thumbnail_url) {
                    return new Response(
                        JSON.stringify({ error: 'Cannot enable thumbnail: no thumbnail was uploaded with this photo' }),
                        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    )
                }

                // TODO: Decrypt encrypted thumbnail and upload to public bucket
                // For now, return error indicating feature not yet implemented
                return new Response(
                    JSON.stringify({ error: 'Thumbnail toggle not yet implemented' }),
                    { status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            } else if (!enableThumbnail && link.public_thumbnail_url) {
                // User wants to disable thumbnail
                try {
                    const { error: deleteError } = await supabaseAdmin
                        .storage
                        .from('public-thumbnails')
                        .remove([link.public_thumbnail_url])

                    if (deleteError) {
                        console.error('Error deleting public thumbnail:', deleteError)
                        // Still NULL the field so cleanup can retry
                    }

                    updates.public_thumbnail_url = null
                } catch (error) {
                    console.error('Unexpected error deleting thumbnail:', error)
                    // Still NULL the field
                    updates.public_thumbnail_url = null
                }
            }
        }

        // Update the link
        const { data: updatedLink, error: updateError } = await supabaseAdmin
            .from('shared_links')
            .update(updates)
            .eq('id', linkId)
            .select()
            .single()

        if (updateError) {
            console.error('Error updating link:', updateError)
            return new Response(
                JSON.stringify({ error: 'Failed to update link' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const response: UpdateLinkResponse = {
            success: true,
            link: {
                expiresAt: updatedLink.expires_at,
                shareText: updatedLink.share_text,
                hasThumbnail: !!updatedLink.public_thumbnail_url
            }
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
                error: 'Invalid expiry format. Use: 10m, 1h, 1d, 1w, 1m, 1y, or ISO date string'
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
            error: 'Invalid expiry format. Use: 10m, 1h, 1d, 1w, 1m, 1y, or ISO date string'
        }
    }
}

/**
 * Calculate expiry timestamp from expiry option
 * @param expiry - Expiry option (10m, 1h, 1d, 1w, 1m, 1y) or ISO date string
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
