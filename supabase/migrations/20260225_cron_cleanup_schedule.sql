-- Migration: 20260225_cron_cleanup_schedule
-- Schedules the cleanup-expired Edge Function to run every 10 minutes via pg_cron + pg_net.
--
-- PREREQUISITE (one-time, manual step):
-- Run the following in the Supabase SQL Editor BEFORE applying this migration:
--
--   select vault.create_secret('https://ndbqasanctkwagyinfag.supabase.co', 'project_url');
--   select vault.create_secret('<YOUR_ANON_KEY>', 'anon_key');
--
-- The anon key can be found in: mobile/.env (EXPO_PUBLIC_SUPABASE_ANON_KEY)
-- Vault secrets are encrypted at rest and never exposed to client roles.

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule cleanup-expired every 10 minutes
-- Reads project_url and anon_key securely from Vault (never hardcoded)
SELECT cron.schedule(
  'cleanup-expired-every-10-min',  -- job name (unique)
  '*/10 * * * *',                 -- every 10 minutes
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/cleanup-expired',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
