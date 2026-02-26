# Social Preview Hardening Plan (2026-02-26)

## Problem Statement

Social link previews (WhatsApp, iMessage, Telegram, etc.) are intermittently failing.

Observed failure modes:
- Metadata endpoint returns `401` when function JWT verification is enabled.
- Metadata endpoint returns `429` due to fragile rate-limit keying (`unknown` client bucket).
- Preview image disappears when `publicThumbnailUrl` is missing or metadata fetch fails.

Impact:
- Shared links appear broken or low-trust in chat apps.
- Regressions are discovered manually after release.
- Recovery depends on tribal knowledge and manual CLI flags.

## Intent

Create a stable, testable preview pipeline where:
- Crawlers can always fetch public metadata without auth.
- Recipient viewing flow remains secure and fully functional.
- Deployment cannot silently flip critical auth behavior.
- Regressions are detected automatically before/after deploy.

## Non-Negotiable Constraints

- Do not break recipient photo viewing/decryption flow.
- Do not expose encryption keys in any public metadata endpoint.
- Keep anti-abuse controls in place (no full crawler exemption by user-agent only).

## Proposed Solutions

### Solution A (Recommended): Split Preview Metadata from Recipient Read Path

1. Keep recipient flow endpoint (`get-link`) public for recipient access semantics already used by viewer.
2. Add dedicated public endpoint (`get-link-metadata`) for OG/crawler metadata only.
3. Configure both functions in-repo with function-local config:
   - `verify_jwt = false`
4. Move `viewer/app/p/[code]/page.tsx` metadata fetch to `get-link-metadata`.
5. Add default OG fallback image (`viewer/public/og-default.png`).
6. Keep robust rate limiting:
   - No global `ip:unknown` bucket.
   - Use `ip || ua-derived key` for anonymous callers.
   - Keep per-code throttling.
7. Add smoke tests and monitoring.

Why this is best:
- Separates crawler concerns from recipient payload concerns.
- Lowers blast radius of future changes.
- Preserves existing product behavior while improving reliability.

### `get-link-metadata` API Contract (explicit)

Request:
- `POST /functions/v1/get-link-metadata`
- Body: `{ "shortCode": "abc123" }`

Success response (`200`):
```json
{
  "title": "Sharene",
  "description": "shared a photo",
  "shareText": "shared a photo",
  "publicThumbnailUrl": "https://.../public-thumbnails/...jpg",
  "hasCustomThumbnail": true,
  "metadata": {
    "code": "abc123",
    "createdAt": "2026-02-26T12:34:56.000Z"
  }
}
```

Rules:
- `metadata` contains only lightweight diagnostics (`code`, `createdAt`) and never OG HTML tags.
- `publicThumbnailUrl` is nullable. If preview is disabled or missing, return `null` (not error).
- Endpoint does not return encryption key, signed photo URL, or private storage paths.
- If link missing/revoked/expired/deleted: return `404`/`403`/`410` with `{ "error": "..." }`.

### Solution B: Keep Single Endpoint, Harden In Place

1. Keep `get-link` as the single endpoint.
2. Ensure `verify_jwt = false` in repo config.
3. Keep current rate-limit fix and add fallback OG image.
4. Add smoke tests and monitoring.

Tradeoff:
- Simpler now, but function remains multi-purpose and easier to regress later.

### Rejected Approach

Make `get-link` key-only and JWT-protected without introducing a new public recipient-read endpoint.

Reason:
- Breaks current unauthenticated recipient viewer flow.

## Recommended Implementation Sequence

1. Commit function configs:
   - `supabase/functions/get-link/config.toml`
   - `supabase/functions/get-link-metadata/config.toml`
2. Create `get-link-metadata` function using the contract above.
3. Update viewer OG metadata fetch path to new function.
4. Add `DEFAULT_OG_IMAGE` fallback in OG metadata generation.
5. Add `scripts/smoke-social-preview.sh`.
6. Add CI job to run smoke script post-deploy.
7. Add synthetic checks (15-minute steady-state cadence; tighter deploy-time checks).
8. Update `docs/RUNBOOK.md` with a recovery checklist.

## Rate Limiting Specification (for `get-link-metadata`)

Client identity key:
- `clientKey = ip || "ua:" + sha1(userAgent).slice(0, 16)`
- `ip` resolved from `x-forwarded-for`, then `x-real-ip`, then `cf-connecting-ip`.
- Never use a global literal fallback like `ip:unknown`.

Limits:
- Global per-client: `60 req/min` by `clientKey`.
- Per-short-code per-client: `10 req/min` by `shortCode + ":" + clientKey`.
- Deploy warm-up override (first 10 minutes after deploy): per-client temporarily `120 req/min`.

Abuse notes:
- Do not fully exempt crawler user-agents.
- If crawler-specific behavior is needed, only use modest multiplier (max 2x) and still enforce per-code limit.

## Caching Policy

`get-link-metadata` should return:
- `Cache-Control: public, max-age=60, stale-while-revalidate=300`

Rationale:
- Reduces repeated bot traffic and cold-start churn.
- Still allows metadata updates to propagate quickly.

## Verification Plan

### Automated

1. `POST /functions/v1/get-link-metadata` with known test code returns `200`.
2. Response contract assertions:
   - has `title`, `description`, `shareText`
   - has `publicThumbnailUrl` key (nullable)
   - has `metadata.code` and `metadata.createdAt`
3. Response headers assertion:
   - `Cache-Control` contains `max-age=60`
4. `GET /p/{test_code}` HTML contains:
   - `og:image`
   - `og:title`
   - `og:description`
5. `GET /og-default.png` returns `200`.

Smoke script behavior (`scripts/smoke-social-preview.sh`):
- Step 1: call `get-link-metadata` with `SMOKE_TEST_SHORT_CODE`; fail non-200.
- Step 2: JSON-validate required keys and nullable thumbnail semantics.
- Step 3: assert caching header exists and is correct.
- Step 4: fetch `viewer /p/{code}` and assert OG meta tags in HTML.
- Step 5: exit non-zero on any failure (CI gate).

PROJECT_REF=ndbqasanctkwagyinfag \
VIEWER_URL=https://viewer-rho-seven.vercel.app \
SMOKE_TEST_SHORT_CODE=Ab12Xy \
./scripts/smoke-social-preview.sh


### Manual

1. Create fresh share link.
2. Paste link in WhatsApp and Telegram.
3. Confirm preview title, description, and image render.
4. Open link as recipient and confirm photo still decrypts and displays.

## Operational Guardrails

- Store a permanent non-expiring smoke-test link code in environment secret `SMOKE_TEST_SHORT_CODE`.
- Treat any metadata `401`/`429` spike as production incident.
- Never rely on `--no-verify-jwt` as a one-off fix; enforce config in repo.
- Monitoring cadence:
  - Steady state: every 15 minutes.
  - First 60 minutes after deploy: every 5 minutes.
  - Roll back to 15-minute cadence automatically after stabilization.

## Deployment Compatibility Window

Viewer/function deploys are not atomic. Enforce a compatibility window:

1. Deploy `get-link-metadata` first.
2. Keep viewer backward-compatible for at least one deploy cycle:
   - Try new endpoint.
   - If unavailable/non-200, fall back to old `get-link` metadata path.
3. After successful smoke checks in production for 24 hours, remove fallback path.

## Success Criteria

- Zero preview outages caused by JWT mode drift.
- Zero crawler outages caused by shared `unknown` rate-limit buckets.
- CI blocks deployments when OG tags or metadata contract regress.
