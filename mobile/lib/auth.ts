import { supabase } from './supabase';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

export async function signInAnonymously() {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    return data;
}

export async function signInWithApple(): Promise<{ user: { id: string } }> {
    if (Platform.OS !== 'ios') {
        throw new Error('Apple Sign-In is only available on iOS');
    }

    const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
    });

    const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken!,
    });

    if (error) throw error;
    if (!data.user) throw new Error('Sign in with Apple failed: no user returned');

    return { user: data.user };
}

/**
 * Migrates anonymous user's data to the Apple-authenticated account.
 * Must be called while still signed in as the anonymous user,
 * before calling signInWithApple().
 *
 * Returns the migration code to be passed to completeMigration() after sign-in.
 */
export async function prepareMigration(): Promise<string> {
    const { data, error } = await supabase.rpc('prepare_migration');
    if (error) throw error;
    return data as string;
}

/**
 * Completes the migration after signing in with Apple.
 * Transfers all shared_links from the anonymous user to the Apple account.
 */
export async function completeMigration(migrationCode: string): Promise<void> {
    const { error } = await supabase.rpc('complete_migration', {
        migration_code: migrationCode,
    });
    if (error) throw error;
}

/**
 * Step 1: Send OTP to email.
 */
export async function signInWithEmailOtp(email: string): Promise<void> {
    const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
            shouldCreateUser: true,
        },
    });
    if (error) throw error;
}

/**
 * Step 2: Verify the 6-digit code.
 */
export async function verifyEmailOtp(email: string, token: string): Promise<void> {
    const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
    });
    if (error) throw error;
}

/**
 * Unified migration flow for Apple or Email.
 * Call this when the user chooses to back up their links.
 *
 * @param signInAction A function that performs the sign-in (e.g. signInWithApple or verifyEmailOtp)
 */
export async function migrateToPermanentAccount(signInAction: () => Promise<void>): Promise<void> {
    // Step 1: Prepare migration code while still anonymous
    const migrationCode = await prepareMigration();

    // Step 2: Sign in (session switches to permanent user)
    await signInAction();

    // Step 3: Complete migration with the code
    await completeMigration(migrationCode);
}

/**
 * Full migration flow: prepare (as anon) → sign in Apple → complete.
 * @deprecated Use migrateToPermanentAccount(signInWithApple) instead.
 */
export async function migrateAnonymousToApple(): Promise<void> {
    await migrateToPermanentAccount(async () => {
        await signInWithApple();
    });
}

export async function signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

export async function getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

export function isAnonymousSession(session: any) {
    if (!session?.user) return false;
    // New Supabase versions provide is_anonymous directly
    if (session.user.is_anonymous !== undefined) {
        return session.user.is_anonymous;
    }
    // Fallback for older sessions or specific metadata
    const payload = session.user.app_metadata;
    return (
        payload?.provider === 'anonymous' ||
        (payload?.provider === undefined && session.user.email === undefined)
    );
}
