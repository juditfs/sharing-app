# Sharene Prototype Review Summary (2026-02-02)

## Scope Reviewed
- Product docs: PRD, Deviations & Learnings, Prototype Plan
- Code: mobile app, viewer app, Supabase functions + schema, test scripts

## Highest-Risk Findings (Fix Before MVP)
1) **JWT is not verified in `create-link`**
   - The function parses the JWT payload without validating the signature, then uses the service role to write rows. This allows forged tokens and arbitrary `user_id` attribution.
   - **Impact:** Impersonation, link ownership spoofing, and potential unauthorized link creation.
   - **Where:** `supabase/functions/create-link/index.ts`

2) **API contract mismatch between viewer and backend**
   - Viewer expects fields that do not exist in the database or `get-link` response (`shareText`, `allowDownload`, `isRevoked`, `expiresAt`).
   - **Impact:** Viewer logic for revocation/expiry never triggers; UI shows missing share text; false confidence about implemented controls.
   - **Where:** `viewer/lib/api.ts`, `viewer/app/view/ViewPage.tsx`

3) **`create-link` does not validate storage paths**
   - The backend accepts arbitrary `photoUrl` values and signs them later via service role, without ensuring they belong to the authenticated user.
   - **Impact:** If a user can guess or obtain a path, they could mint a sharable link to any object in the bucket.
   - **Where:** `supabase/functions/create-link/index.ts`

## Major Issues (Should Fix Next)
1) **Thumbnail URL field mismatch**
   - `get-link` returns `thumbnailUrl`, but the viewer reads `signedThumbnailUrl`.
   - **Impact:** Thumbnail URL always null; blocks progressive loading plans.
   - **Where:** `viewer/lib/api.ts`

2) **Upload path does not gate on authenticated session readiness**
   - UI allows photo actions before anonymous sign-in completes; this can throw “No active session”.
   - **Impact:** Flaky user experience on cold start.
   - **Where:** `mobile/App.tsx`, `mobile/lib/upload.ts`

3) **Encryption pipeline does double file I/O + slow base64 conversion**
   - Read -> encrypt -> write -> read -> upload, plus manual base64 loops.
   - **Impact:** Extra latency and memory pressure (risk on low-end devices).
   - **Where:** `mobile/lib/crypto.ts`, `mobile/lib/upload.ts`

## Minor Issues / Hygiene
- **Thumbnail upload errors ignored**; a failure leaves link pointing to a missing thumb.
  - Where: `mobile/lib/upload.ts`
- **Docs reference missing file** (`docs/engineering_review.md`), but repo has `docs/prototype_engineering_review.md` and `docs/engineering_review_critique.md`.
  - Where: `README.md`

---

## Recommended Architectural / Code Modifications

### Security & Trust (P0)
- **Verify JWT server-side** in `create-link`:
  - Use `supabaseAdmin.auth.getUser(token)` (or GoTrue verify) and reject on failure.
- **Validate storage path ownership**:
  - Enforce `photoUrl` and `thumbnailUrl` to start with `${userId}/`.
  - Reject any path outside the requester’s folder.

### API Contract Alignment (P0)
- **Align viewer types with actual schema**:
  - Remove unused fields in viewer (`shareText`, `allowDownload`, `isRevoked`, `expiresAt`) or implement them fully with schema changes + Edge Function support.
  - If keeping placeholders, define explicit defaults in `get-link` response to avoid undefined UI.

### Performance & Reliability (P1)
- **Avoid double file I/O**:
  - Encrypt to memory and upload buffers directly (no temp file round-trip).
- **Optimize base64 conversion**:
  - Use `Buffer.from(base64, 'base64')` or another native implementation.
- **Parallelize image processing**:
  - Use `Promise.all` for main image + thumbnail.
- **Gate UI on session readiness**:
  - Disable photo buttons until anonymous sign-in completes.

### Performance Target: ≤1s Upload + ≤1s Decrypt (No Security Tradeoffs)
**Upload path (mobile)**
- **Encrypt to buffer and upload directly** to remove extra read/write/encode steps. Current flow: read → encrypt → write → read → upload. Replace with in-memory payload upload in `mobile/lib/crypto.ts` + `mobile/lib/upload.ts`.
- **Use native base64 decode** instead of manual loops. Replace `atob` + `Uint8Array.from` and manual loops with `Buffer.from(base64, 'base64')` in `mobile/lib/crypto.ts` and `mobile/lib/upload.ts`.
- **Parallelize image processing** in `mobile/lib/imageProcessing.ts` with `Promise.all` (main image + thumbnail).
- **Short-circuit on large images**: check file size and resize before expensive conversions; log warning and lower quality if needed (still strip EXIF).
- **Avoid duplicate encryption passes** when thumbnail is disabled; skip entirely rather than encrypting unused assets.

**Viewer path (web)**
- **Reduce RTTs by merging metadata + key** (if accepted): one Edge Function call can return `{ signedUrl, thumbnailUrl, key }` to cut a round trip. Keep logs clean; do not log responses. `supabase/functions/get-link/index.ts`, `viewer/lib/api.ts`.
- **Progressive load with encrypted thumbnail**: show thumbnail ASAP while full-size decrypts to improve perceived speed. `viewer/app/view/ViewPage.tsx`.
- **Use a Web Worker for decryption** to keep UI responsive; does not weaken security. `viewer/lib/crypto.ts` + new worker.
- **Co-locate viewer + Supabase region** to reduce latency (hosting placement, not code).

**Network**
- **Prefer short signed URL expiry, but cache encrypted blobs** in memory during a single view to avoid re-downloads if React re-renders.
- **Keep encrypted content cacheable** (already encrypted) with conservative `cacheControl` to improve repeat view performance.

**Reality check for the 1s goal**
- Total time budget is dominated by network for large files. To reach ≤1s consistently, enforce smaller payloads (e.g., lower max dimension or aggressive compression) while keeping EXIF stripping and AES-GCM unchanged.

### Viewer UX / Consistency (P1)
- **Fix thumbnail URL field**:
  - Map `thumbnailUrl` → `signedThumbnailUrl` or rename the response field.
- **Add safe defaults for absent metadata**:
  - Ensure `shareText` is defined (or hide the info bar if empty).

---

## Suggested Next Actions
1) Patch `create-link` JWT verification + storage path validation.
2) Update viewer API types to match the real schema and Edge Function response.
3) Apply the P1 performance improvements already outlined in `DEVIATIONS_AND_LEARNINGS.md`.
4) Add a short API contract doc (`docs/api-contracts.md`) and keep it authoritative.

## Tests to Prioritize After Changes
- Unit: crypto round-trip (mobile + viewer compatibility)
- Integration: create-link + get-link flow with invalid tokens / wrong paths
- Manual: first launch -> sign-in -> share flow without session errors
