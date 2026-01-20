import { supabase } from './supabase';

export async function signInAnonymously() {
    const { data, error } = await supabase.auth.signInAnonymously();

    if (error) {
        console.error('Anonymous sign-in error:', error);
        throw error;
    }

    return data;
}

export async function getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
        console.error('Get session error:', error);
        throw error;
    }

    return session;
}
