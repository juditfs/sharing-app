-- DEV/TEST ONLY: OTP capture hook for Maestro E2E testing.
-- DO NOT apply to production. Run manually in local dev:
--   supabase db execute --file supabase/seed/testing_otp_hook.sql
--
-- To verify it's enabled, check if handle_auth_email_hook exists:
--   SELECT proname FROM pg_proc WHERE proname = 'handle_auth_email_hook';

-- Create a table to store test OTPs
CREATE TABLE IF NOT EXISTS public.test_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    otp TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: restrict reads to service role only (not world-readable)
ALTER TABLE public.test_otps ENABLE ROW LEVEL SECURITY;
-- No SELECT policy: anon/authenticated cannot read OTPs.
-- The testing script must use the service role key directly.

-- Hook function: intercepts Supabase auth emails in test environments.
-- Captures OTP for @example.com and maestro-* addresses only.
CREATE OR REPLACE FUNCTION public.handle_auth_email_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    otp_code TEXT;
    target_email TEXT;
BEGIN
    target_email := event->'user'->>'email';
    otp_code     := event->'data'->>'token';

    IF target_email LIKE '%@example.com' OR target_email LIKE 'maestro-%@%' THEN
        INSERT INTO public.test_otps (email, otp)
        VALUES (target_email, otp_code);
        RETURN jsonb_build_object('should_send', false);
    END IF;

    RETURN jsonb_build_object('should_send', true);
END;
$$;

-- After running this file, register the hook in Supabase Dashboard:
--   Auth > Hooks > Email Send Hook → select handle_auth_email_hook
