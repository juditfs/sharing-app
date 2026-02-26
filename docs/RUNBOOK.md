# Operational Runbook

This file documents manual infrastructure steps that cannot be safely automated in code
(e.g. steps that would require embedding service-role secrets in SQL migrations).

---

## Scheduled Jobs

### cleanup-expired (Every 10 minutes via pg_cron)

**Purpose:** Deletes storage files and marks database records for expired/revoked shared links.

**How it works:**
Scheduled via `pg_cron` + `pg_net` (see migration `20260225_cron_cleanup_schedule.sql`). Credentials are stored in Supabase Vault — never hardcoded.

**One-time setup (run once in Supabase SQL Editor before applying the migration):**

```sql
select vault.create_secret('https://ndbqasanctkwagyinfag.supabase.co', 'project_url');
select vault.create_secret('<YOUR_ANON_KEY>', 'anon_key');
```

The anon key is `EXPO_PUBLIC_SUPABASE_ANON_KEY` from `mobile/.env`.

**Re-apply after:** Any project reset or new Supabase environment (re-run the Vault setup above, then re-apply the migration).

> [!NOTE]
> To verify the job is running, check the `cron.job_run_details` table in the SQL editor.
> To change frequency, update the cron expression in the migration or run:
> `SELECT cron.alter_job(job_id, schedule := '*/5 * * * *');`

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
- `20260225_cron_cleanup_schedule.sql` ← enables pg_cron/pg_net and schedules cleanup

---

## Supabase Auth Configuration

These settings must be configured manually in the Supabase Dashboard:

| Setting | Location | Value |
|---|---|---|
| Email OTP length | Auth → Providers → Email | 6 |
| Email OTP expiry | Auth → Settings | 120s (recommended) |
| Magic Link template | Auth → Email Templates → Magic Link | Use `{{ .Token }}` in body |
