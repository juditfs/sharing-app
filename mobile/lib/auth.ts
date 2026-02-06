import { supabase } from './supabase';

export async function signInAnonymously() {
    // Check for existing session first
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (session) {
        console.log('Restored existing session for user:', session.user.id);
        return { session, user: session.user };
    }

    // Only create new anonymous user if no session exists
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
