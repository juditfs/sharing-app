// Supabase Edge Function: update-link
// Handles updating link settings and managing associated resources

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UpdateLinkRequest {
    shortCode: string
    updates: {
        expiry?: string
        allowDownload?: boolean
        publicThumbnailUrl?: string | null
    }
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Invalid or expired token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const { shortCode, updates }: UpdateLinkRequest = await req.json()

        if (!shortCode) {
            return new Response(JSON.stringify({ error: 'Missing shortCode' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // Fetch existing link to verify ownership and get current state
        const { data: link, error: fetchError } = await supabaseAdmin
            .from('shared_links')
            .select('*')
            .eq('short_code', shortCode)
            .single()

        if (fetchError || !link) {
            return new Response(JSON.stringify({ error: 'Link not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        if (link.user_id !== user.id) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const updateData: any = {}

        // Handle Expiry
        if (updates.expiry !== undefined) {
            const validation = validateExpiry(updates.expiry)
            if (!validation.valid) {
                return new Response(JSON.stringify({ error: validation.error }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }
            updateData.expires_at = calculateExpiry(updates.expiry)?.toISOString() || null
        }

        // Handle Download
        if (updates.allowDownload !== undefined) {
            updateData.allow_download = updates.allowDownload
        }

        // Handle Public Thumbnail
        if (updates.publicThumbnailUrl !== undefined) {
            // If turning OFF (setting to null) and there was a public thumbnail, delete it
            if (updates.publicThumbnailUrl === null && link.public_thumbnail_url) {
                try {
                    // Attempt to cleanup storage
                    // We assume the stored URL allows us to identify the file.
                    // If it's a full URL, we might need to parse.
                    // But typically clients store the path.
                    // Let's verify if we need to extract user ID or path.
                    // Ideally we just pass what's in the DB if it is the path.

                    // Helper: Extract path if it is a URL
                    let pathToDelete = link.public_thumbnail_url;
                    if (pathToDelete.startsWith('http')) {
                        const url = new URL(pathToDelete);
                        // path is /storage/v1/object/public/public-thumbnails/path/to/file
                        const pathParts = url.pathname.split('/public-thumbnails/');
                        if (pathParts.length > 1) {
                            pathToDelete = pathParts[1];
                        }
                    }

                    const { error: deleteError } = await supabaseAdmin.storage
                        .from('public-thumbnails')
                        .remove([pathToDelete])

                    if (deleteError) {
                        console.error('Failed to delete public thumbnail from storage:', deleteError)
                    }
                } catch (e) {
                    console.error('Error deleting public thumbnail:', e)
                }
                updateData.public_thumbnail_url = null
            } else if (updates.publicThumbnailUrl) {
                // Updating to a new one
                if (!updates.publicThumbnailUrl.includes(`/${user.id}/`)) {
                    return new Response(JSON.stringify({ error: 'Invalid public thumbnail path' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
                }
                updateData.public_thumbnail_url = updates.publicThumbnailUrl
            }
        }

        if (Object.keys(updateData).length > 0) {
            const { error: updateError } = await supabaseAdmin
                .from('shared_links')
                .update(updateData)
                .eq('id', link.id)

            if (updateError) {
                throw updateError
            }
        }

        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    } catch (error) {
        console.error('Unexpected error:', error)
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

// Helper functions (copied from create-link)
function validateExpiry(expiry?: string): { valid: boolean; error?: string } {
    if (!expiry) return { valid: true }
    const validPresets = ['10m', '1h', '1d', '1w', '1m', '1y']
    if (validPresets.includes(expiry)) return { valid: true }
    try {
        const date = new Date(expiry)
        if (isNaN(date.getTime())) return { valid: false, error: 'Invalid expiry format' }
        if (date <= new Date()) return { valid: false, error: 'Expiry must be in future' }
        return { valid: true }
    } catch { return { valid: false, error: 'Invalid expiry format' } }
}

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
    if (expiry in expiryMap) return new Date(now.getTime() + expiryMap[expiry])
    try {
        const d = new Date(expiry)
        return isNaN(d.getTime()) ? null : d
    } catch { return null }
}
