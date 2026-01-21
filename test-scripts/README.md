# Sharene E2E Test Scripts

This directory contains automated and manual testing scripts for Phase 4 end-to-end testing.

## Quick Start

### Run All Automated Tests

```bash
cd /Users/ju/Documents/Projects/2026/sharing-app
./test-scripts/e2e-test-suite.sh
```

This will run:
1. Environment verification
2. API flow tests
3. Security validation
4. Image processing tests

---

## Individual Test Scripts

### 1. Environment Verification

```bash
./test-scripts/verify-environment.sh
```

**What it tests:**
- Environment variables are set
- Supabase connection works
- Required tools are installed (jq, exiftool)

**Expected output:**
```
✓ Loaded environment from viewer/.env.local
✓ Environment variables configured
✓ jq installed
✓ Supabase connection successful
```

---

### 2. Security Validation

```bash
./test-scripts/test-security.sh
```

**What it tests:**
- RLS policies on `link_secrets` table
- RLS policies on `shared_links` table
- Storage bucket privacy (manual verification required)

**Expected output:**
```
✓ RLS blocks access to link_secrets (empty result)
✓ RLS blocks anonymous access to shared_links
```

---

### 3. API Flow Tests

```bash
./test-scripts/test-api-flow.sh
```

**What it tests:**
- `get-link` Edge Function deployment and accessibility
- `create-link` Edge Function deployment and authentication

**Expected output:**
```
✓ Edge Function is accessible (404 expected for non-existent link)
✓ Edge Function is accessible (auth required as expected)
```

---

### 4. Image Processing Tests

```bash
./test-scripts/test-image-processing.sh
```

**What it tests:**
- EXIF stripping (requires exiftool)
- Image resizing validation
- Thumbnail generation

**Note:** Most image processing tests require manual steps (upload via mobile app, download decrypted image).

---

## Manual Testing

### Manual Test Checklist

Follow the step-by-step guide:
```bash
cat test-scripts/manual-test-checklist.md
```

Or open in your editor for interactive checklist.

### Test Data Preparation

See instructions for creating test images:
```bash
cat test-data/README.md
```

---

## Test Results

### Automated Test Results

All automated tests log to stdout. To save results:

```bash
./test-scripts/e2e-test-suite.sh > test-results/automated-test-results.txt 2>&1
```

### Manual Test Results

Use the test report template:
```bash
cp test-results/test-report-template.md test-results/test-report-$(date +%Y%m%d).md
```

Then fill in your findings.

---

## Prerequisites

### Required
- Supabase project configured
- Environment variables in `viewer/.env.local`
- `jq` installed (for JSON parsing)

### Optional
- `exiftool` for EXIF validation tests
  ```bash
  brew install exiftool
  ```

---

## Test Coverage

### ✅ Automated Tests
- Environment setup
- Supabase connection
- RLS policies (link_secrets, shared_links)
- Edge Functions deployment
- API endpoint accessibility

### 📋 Manual Tests Required
- In-app photo upload flow
- Share Sheet integration
- Link generation and sharing
- Image decryption in browser
- EXIF metadata stripping
- Image resizing validation
- Thumbnail generation
- Cross-browser compatibility
- Signed URL expiry
- Encrypted storage verification

---

## Troubleshooting

### Environment variables not found

**Error:** `❌ NEXT_PUBLIC_SUPABASE_URL not set`

**Solution:** Ensure `viewer/.env.local` exists with:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Supabase connection failed

**Error:** `❌ Supabase connection failed (HTTP 403)`

**Solution:** Check that your anon key is correct and the project is active.

### Edge Functions not accessible

**Error:** `Response code: 000`

**Solution:** Verify Edge Functions are deployed:
```bash
cd supabase
supabase functions list
```

Deploy if needed:
```bash
supabase functions deploy get-link --no-verify-jwt
supabase functions deploy create-link --no-verify-jwt
```

---

## Next Steps

After running automated tests:

1. ✅ Review automated test results
2. 📋 Prepare test images (see `test-data/README.md`)
3. 📱 Run mobile app and test in-app flow
4. ✅ Complete manual test checklist
5. 📝 Document findings in test report
6. 🔍 Review and address any issues
7. ✅ Mark Phase 4 complete in `docs/task.md`

---

## Files in This Directory

- `e2e-test-suite.sh` - Master test orchestrator
- `verify-environment.sh` - Environment verification
- `test-api-flow.sh` - API endpoint tests
- `test-security.sh` - Security validation tests
- `test-image-processing.sh` - Image processing tests
- `manual-test-checklist.md` - Manual testing guide
- `README.md` - This file

---

## Support

For issues or questions:
1. Check the walkthrough: `brain/walkthrough.md`
2. Review implementation plan: `brain/implementation_plan.md`
3. Check main task list: `docs/task.md`
