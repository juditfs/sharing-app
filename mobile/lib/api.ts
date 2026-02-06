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
    view_count: number;
    created_at: string;
    // We fetch settings just in case we need them for the drawer immediately
    allow_download: boolean;
    share_text: string;
    expires_at: string | null;
}

/**
 * Fetch all links created by the current user
 */
export async function getUserLinks(): Promise<LinkItem[]> {
    const { data, error } = await supabase
        .from('shared_links')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Failed to fetch user links:', error);
        throw error;
    }

    return data as LinkItem[];
}
