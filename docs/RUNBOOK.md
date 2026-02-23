# Operational Runbook

This file documents manual infrastructure steps that cannot be safely automated in code
(e.g. steps that would require embedding service-role secrets in SQL migrations).

---

## Scheduled Jobs

### cleanup-expired (Hourly)

**Purpose:** Deletes storage files and marks database records for expired/revoked shared links.

**How to schedule:**

1. Go to [Supabase Dashboard → Edge Functions](https://supabase.com/dashboard/project/ndbqasanctkwagyinfag/functions)
2. Open the `cleanup-expired` function
3. Go to the **Schedule** tab
4. Add a new schedule with cron expression: `0 * * * *` (every hour, on the hour)
5. Save

**Re-apply after:** Any project reset or new Supabase environment.

> [!NOTE]
> Credentials are injected securely by Supabase's scheduler — no service-role key is embedded anywhere in the repo.

---

## Database Migrations

Run migrations via the Supabase SQL Editor or CLI (`supabase db push`) when deploying to a new environment.

Current migrations in `supabase/migrations/`:
- `20260119_initial_schema.sql`
- `20260202134500_add_mvp_fields.sql`
- `20260202134501_public_thumbnails_bucket.sql`
- `20260203120000_og_pages_bucket.sql`
- `20260218_apple_auth_migration.sql`
- `20260219_rate_limit_index.sql`

---

## Supabase Auth Configuration

These settings must be configured manually in the Supabase Dashboard:

| Setting | Location | Value |
|---|---|---|
| Email OTP length | Auth → Providers → Email | 6 |
| Email OTP expiry | Auth → Settings | 120s (recommended) |
| Magic Link template | Auth → Email Templates → Magic Link | Use `{{ .Token }}` in body |
