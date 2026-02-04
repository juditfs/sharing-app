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
