const METADATA_TIMEOUT_MS = 3000;
const DEFAULT_SUPABASE_URL = 'https://ndbqasanctkwagyinfag.supabase.co';

export async function fetchSocialMetadata(code: string) {
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
    const metadataUrl = `${supabaseUrl}/functions/v1/get-link-metadata`;
    const legacyUrl = `${supabaseUrl}/functions/v1/get-link`;

    const metadataResponse = await fetch(metadataUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shortCode: code }),
        cache: 'no-store',
        signal: AbortSignal.timeout(METADATA_TIMEOUT_MS),
    }).catch(() => null);

    if (metadataResponse?.ok) {
        return metadataResponse.json();
    }

    // Compatibility fallback during rollout window.
    const legacyResponse = await fetch(legacyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shortCode: code, action: 'metadata' }),
        cache: 'no-store',
        signal: AbortSignal.timeout(METADATA_TIMEOUT_MS),
    }).catch(() => null);

    if (legacyResponse?.ok) {
        return legacyResponse.json();
    }

    return null;
}
