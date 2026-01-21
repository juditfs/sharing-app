# Phase 4 Testing - Quick Reference

## 🚀 Quick Start

### Run All Automated Tests
```bash
cd /Users/ju/Documents/Projects/2026/sharing-app
./test-scripts/e2e-test-suite.sh
```

---

## ✅ Automated Tests - COMPLETED

### Results Summary

| Test Category | Status | Details |
|--------------|--------|---------|
| Environment | ✅ PASSED | Supabase connected, dependencies verified |
| Security (RLS) | ✅ PASSED | link_secrets and shared_links protected |
| API Flow | ✅ PASSED | Edge Functions deployed and accessible |
| Test Framework | ✅ READY | Image processing tests ready for manual execution |

### Key Findings

**✅ Security Confirmed:**
- `link_secrets` table is inaccessible to clients (RLS working)
- `shared_links` table blocks anonymous access (RLS working)
- Edge Functions require authentication as designed

**✅ Infrastructure Ready:**
- Supabase connection successful
- Edge Functions deployed and responding
- Test framework fully implemented

---

## 📋 Manual Tests - TODO

### Priority 1: Core Functionality

1. **Test Mobile App Upload**
   ```
   1. Launch mobile app
   2. Select a photo
   3. Verify link generation
   4. Open link in browser
   5. Verify image displays
   ```

2. **Test Encrypted Storage**
   ```
   1. Upload photo via app
   2. Go to Supabase Storage dashboard
   3. Download raw file
   4. Verify it's encrypted (unreadable)
   ```

3. **Test EXIF Stripping** (requires exiftool)
   
   > See detailed guide: [EXIF_TESTING.md](EXIF_TESTING.md)

   ```bash
   # Install exiftool first
   brew install exiftool
   
   # Then test
   1. Prepare image (Sample downloaded to test-data/test-image-with-exif.jpg)
   2. Upload via app
   3. Download decrypted image
   4. Run: ./test-scripts/test-image-processing.sh
   ```

### Priority 2: Advanced Features

4. **Test Image Resizing**
   - Upload 4000px+ image
   - Verify output ≤2048px

5. **Test Signed URL Expiry**
   - Capture signed URL
   - Wait 60+ seconds
   - Verify expiry

6. **Test Cross-Browser**
   - Safari
   - Chrome
   - Firefox

---

## 📁 Test Files Created

### Scripts
- ✅ `test-scripts/e2e-test-suite.sh` - Master orchestrator
- ✅ `test-scripts/verify-environment.sh` - Environment check
- ✅ `test-scripts/test-api-flow.sh` - API tests
- ✅ `test-scripts/test-security.sh` - Security tests
- ✅ `test-scripts/test-image-processing.sh` - Image tests

### Documentation
- ✅ `test-scripts/manual-test-checklist.md` - Step-by-step guide
- ✅ `test-scripts/README.md` - Complete testing guide
- ✅ `test-data/README.md` - Test image preparation
- ✅ `test-results/test-report-template.md` - Results template

---

## 🎯 Next Steps

1. **Prepare Test Images**
   - Create test-image-with-exif.jpg (photo with GPS/metadata)
   - Create test-image-large.jpg (>4000px)
   - Place in `test-data/` directory

2. **Run Mobile App**
   ```bash
   cd mobile
   npm start
   # Then press 'i' for iOS simulator
   ```

3. **Test Upload Flow**
   - Select photo in app
   - Generate link
   - Test in browser

4. **Document Results**
   - Use `test-results/test-report-template.md`
   - Fill in findings
   - Capture screenshots

5. **Complete Checklist**
   - Follow `test-scripts/manual-test-checklist.md`
   - Mark items as complete
   - Note any issues

---

## 📊 Progress Tracker

### Automated Tests
- [x] Environment verification
- [x] Security validation (RLS)
- [x] API flow tests
- [x] Test framework setup

### Manual Tests
- [ ] In-app photo upload
- [ ] Link generation
- [ ] Browser decryption
- [ ] EXIF stripping
- [ ] Image resizing
- [ ] Thumbnail generation
- [ ] Cross-browser testing
- [ ] Signed URL expiry
- [ ] Encrypted storage verification

### Documentation
- [x] Test scripts
- [x] Manual checklist
- [x] Test report template
- [ ] Completed test report

---

## 🔧 Troubleshooting

### Mobile App Won't Start
```bash
cd mobile
npm install
npx expo start --clear
```

### Environment Variables Not Found
Check `viewer/.env.local` exists with:
```
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### Edge Functions Not Responding
```bash
cd supabase
supabase functions list
# Deploy if needed
supabase functions deploy get-link --no-verify-jwt
supabase functions deploy create-link --no-verify-jwt
```

---

## 📖 Full Documentation

- **Walkthrough:** `brain/walkthrough.md`
- **Implementation Plan:** `brain/implementation_plan.md`
- **Task List:** `brain/task.md`
- **Test Scripts Guide:** `test-scripts/README.md`
- **Main Task List:** `docs/task.md`

---

## ✨ Success Criteria

Phase 4 is complete when:
- [x] Automated tests pass
- [ ] All functional tests pass
- [ ] Security validations confirmed
- [ ] Image processing validated
- [ ] Cross-browser compatibility confirmed
- [ ] Test report completed

**Current Status:** 🟡 In Progress (Automated tests ✅, Manual tests pending)
