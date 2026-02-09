import { supabase } from './supabase';
import { LinkSettings } from './upload';

export { LinkSettings };

/**
 * Update an existing link's settings
 */
export async function updateLink(
    shortCode: string,
    updates: Partial<LinkSettings>
): Promise<void> {
    console.log('Updating link:', shortCode, updates);

    const { error } = await supabase.functions.invoke('update-link', {
        body: {
            shortCode,
            updates
        }
    });

    if (error) {
        console.error('Failed to update link:', error);
        throw error;
    }

    console.log('Link updated successfully');
}

/**
 * Delete a link
 */
export async function deleteLink(shortCode: string): Promise<void> {
    const { error } = await supabase
        .from('shared_links')
        .delete()
        .eq('short_code', shortCode);

    if (error) {
        console.error('Failed to delete link:', error);
        throw error;
    }
}

export interface LinkItem {
    id: string;
    short_code: string;
    public_thumbnail_url: string | null;
    thumbnail_url: string | null; // Encrypted thumbnail path
    view_count: number;
    created_at: string;
    // We fetch settings just in case we need them for the drawer immediately
    allow_download: boolean;
    share_text: string;
    expires_at: string | null;
    encryption_key?: string; // Flattened from link_secrets
}

/**
 * Fetch all links created by the current user
 */
export async function getUserLinks(): Promise<LinkItem[]> {
    // 1. Fetch links
    const { data: linksData, error: linksError } = await supabase
        .from('shared_links')
        .select('*')
        .order('created_at', { ascending: false });

    if (linksError) {
        console.error('Failed to fetch user links:', linksError);
        throw linksError;
    }

    // 2. Fetch keys securely via RPC
    const { data: keysData, error: keysError } = await supabase
        .rpc('get_my_link_keys');

    if (keysError) {
        console.error('Failed to fetch link keys:', keysError);
        // Don't throw, just continue without keys (thumbnails won't decrypt)
    }

    // 3. Merge keys into links
    const keyMap = new Map<string, string>();
    if (keysData) {
        keysData.forEach((k: any) => keyMap.set(k.link_id, k.encryption_key));
    }

    const links = linksData.map((item: any) => ({
        ...item,
        encryption_key: keyMap.get(item.id)
    })) as LinkItem[];

    return links;
}
