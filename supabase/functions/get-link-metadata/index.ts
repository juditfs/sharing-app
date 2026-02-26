// Supabase Edge Function: get-link-metadata
// Public metadata endpoint for social preview crawlers (WhatsApp/iMessage/etc.).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const cacheHeaders = {
    'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
}

// In-memory limiter (cold-start scoped; acceptable at current scale).
const GLOBAL_CLIENT_LIMIT_PER_MIN = 60
const CODE_CLIENT_LIMIT_PER_MIN = 10
const WINDOW_MS = 60_000
const requestLog = new Map<string, number[]>()

function isRateLimited(key: string, max: number): boolean {
    const now = Date.now()
    const hits = (requestLog.get(key) ?? []).filter(t => now - t < WINDOW_MS)
    hits.push(now)
    requestLog.set(key, hits)
    return hits.length > max
}

let lastSweep = Date.now()
function maybeSweep() {
    const now = Date.now()
    if (now - lastSweep < WINDOW_MS) return
    lastSweep = now
    for (const [k, times] of requestLog) {
        const recent = times.filter(t => now - t < WINDOW_MS)
        if (recent.length === 0) requestLog.delete(k)
        else requestLog.set(k, recent)
    }
}

function getClientIp(req: Request): string | null {
    const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    const realIp = req.headers.get('x-real-ip')?.trim()
    const cfIp = req.headers.get('cf-connecting-ip')?.trim()
    const ip = forwarded || realIp || cfIp || ''
    return ip.length > 0 ? ip : null
}

function hashString(input: string): string {
    // Compact FNV-1a hash for bucketing anonymous UA strings.
    let hash = 2166136261
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i)
        hash = Math.imul(hash, 16777619)
    }
    return (hash >>> 0).toString(16).padStart(8, '0')
}

interface GetLinkMetadataRequest {
    shortCode: string
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: { ...corsHeaders, ...cacheHeaders } })
    }

    maybeSweep()

    try {
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

        const body: GetLinkMetadataRequest = await req.json()
        const { shortCode } = body

        if (!shortCode) {
            return new Response(
                JSON.stringify({ error: 'Missing required parameter: shortCode' }),
                { status: 400, headers: { ...corsHeaders, ...cacheHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const ip = getClientIp(req)
        const userAgent = req.headers.get('user-agent') || 'unknown'
        const clientKey = ip || `ua:${hashString(userAgent)}`

        if (isRateLimited(`client:${clientKey}`, GLOBAL_CLIENT_LIMIT_PER_MIN)) {
            return new Response(
                JSON.stringify({ error: 'Too many requests' }),
                { status: 429, headers: { ...corsHeaders, ...cacheHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (isRateLimited(`code:${shortCode}:${clientKey}`, CODE_CLIENT_LIMIT_PER_MIN)) {
            return new Response(
                JSON.stringify({ error: 'Too many requests' }),
                { status: 429, headers: { ...corsHeaders, ...cacheHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const { data: linkData, error: linkError } = await supabaseAdmin
            .from('shared_links')
            .select('short_code, created_at, share_text, public_thumbnail_url, is_revoked, expires_at, deleted_at')
            .eq('short_code', shortCode)
            .single()

        if (linkError || !linkData) {
            return new Response(
                JSON.stringify({ error: 'Link not found' }),
                { status: 404, headers: { ...corsHeaders, ...cacheHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (linkData.is_revoked) {
            return new Response(
                JSON.stringify({ error: 'This link has been revoked by the owner' }),
                { status: 403, headers: { ...corsHeaders, ...cacheHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (linkData.expires_at && new Date(linkData.expires_at) < new Date()) {
            return new Response(
                JSON.stringify({ error: 'This link has expired' }),
                { status: 410, headers: { ...corsHeaders, ...cacheHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (linkData.deleted_at) {
            return new Response(
                JSON.stringify({ error: 'This link has been deleted' }),
                { status: 410, headers: { ...corsHeaders, ...cacheHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const shareText = linkData.share_text || 'shared a photo'
        const publicThumbnailUrl = linkData.public_thumbnail_url || null
        const response = {
            title: 'Sharene',
            description: shareText,
            shareText,
            publicThumbnailUrl,
            hasCustomThumbnail: !!publicThumbnailUrl,
            metadata: {
                code: linkData.short_code,
                createdAt: linkData.created_at,
            }
        }

        return new Response(
            JSON.stringify(response),
            {
                status: 200,
                headers: { ...corsHeaders, ...cacheHeaders, 'Content-Type': 'application/json' }
            }
        )
    } catch (error) {
        console.error('Unexpected error in get-link-metadata:', error)
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, ...cacheHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
