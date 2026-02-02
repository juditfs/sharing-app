// Supabase Edge Function: cleanup-expired
// Cron job to delete expired and revoked link files from storage

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Initialize Supabase client with Service Role key
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

        const now = new Date().toISOString()

        // Find expired or revoked links that haven't been cleaned up
        const { data: linksToDelete, error: queryError } = await supabaseAdmin
            .from('shared_links')
            .select('id, photo_url, thumbnail_url, public_thumbnail_url')
            .or(`expires_at.lt.${now},is_revoked.eq.true`)
            .is('deleted_at', null)

        if (queryError) {
            console.error('Error querying links:', queryError)
            return new Response(
                JSON.stringify({ error: 'Failed to query links', deleted: 0 }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        let deletedCount = 0
        const errors: string[] = []

        // Delete files from storage and mark as deleted
        for (const link of linksToDelete || []) {
            try {
                // Delete encrypted photo
                const { error: photoError } = await supabaseAdmin
                    .storage
                    .from('photos')
                    .remove([link.photo_url])

                if (photoError) {
                    console.error(`Error deleting photo ${link.photo_url}:`, photoError)
                    errors.push(`Photo ${link.id}: ${photoError.message}`)
                }

                // Delete encrypted thumbnail
                if (link.thumbnail_url) {
                    const { error: thumbError } = await supabaseAdmin
                        .storage
                        .from('photos')
                        .remove([link.thumbnail_url])

                    if (thumbError) {
                        console.error(`Error deleting thumbnail ${link.thumbnail_url}:`, thumbError)
                        errors.push(`Thumbnail ${link.id}: ${thumbError.message}`)
                    }
                }

                // Delete public thumbnail (if exists)
                if (link.public_thumbnail_url) {
                    const { error: publicThumbError } = await supabaseAdmin
                        .storage
                        .from('public-thumbnails')
                        .remove([link.public_thumbnail_url])

                    if (publicThumbError) {
                        console.error(`Error deleting public thumbnail ${link.public_thumbnail_url}:`, publicThumbError)
                        errors.push(`Public thumbnail ${link.id}: ${publicThumbError.message}`)
                    }
                }

                // Soft delete in database
                const { error: updateError } = await supabaseAdmin
                    .from('shared_links')
                    .update({ deleted_at: new Date().toISOString() })
                    .eq('id', link.id)

                if (updateError) {
                    console.error(`Error marking link ${link.id} as deleted:`, updateError)
                    errors.push(`Database ${link.id}: ${updateError.message}`)
                } else {
                    deletedCount++
                }

            } catch (error) {
                console.error(`Unexpected error processing link ${link.id}:`, error)
                errors.push(`Link ${link.id}: ${error}`)
            }
        }

        return new Response(
            JSON.stringify({
                deleted: deletedCount,
                total: linksToDelete?.length || 0,
                timestamp: new Date().toISOString(),
                errors: errors.length > 0 ? errors : undefined
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Unexpected error:', error)
        return new Response(
            JSON.stringify({ error: 'Internal server error', deleted: 0 }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
