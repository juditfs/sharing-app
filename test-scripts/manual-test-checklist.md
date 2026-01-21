# Manual Test Checklist

## Prerequisites
- [ ] iOS Simulator running
- [ ] Mobile app installed and running
- [ ] Web viewer deployed and accessible
- [ ] Test images prepared (with EXIF, large size)

## 1. In-App Flow

### Test Steps
1. [ ] Launch mobile app
2. [ ] Tap "Select Photo" button
3. [ ] Choose test image from picker
4. [ ] Observe processing UI
5. [ ] Wait for link generation
6. [ ] Copy generated URL
7. [ ] Open URL in browser
8. [ ] Verify image displays correctly

### Expected Results
- [ ] Processing shows loading indicator
- [ ] Link is generated successfully
- [ ] URL format is correct
- [ ] Image decrypts and displays in browser
- [ ] Image matches original (visual check)

### Issues Found
- None / [Document issues here]

---

## 2. Share Sheet Flow (iOS)

### Test Steps
1. [ ] Open Photos app
2. [ ] Select a photo
3. [ ] Tap Share button
4. [ ] Look for Sharene in share sheet
5. [ ] Share to Sharene
6. [ ] Verify processing
7. [ ] Test generated link

### Expected Results
- [ ] Sharene appears in share sheet
- [ ] Photo is received by app
- [ ] Processing completes
- [ ] Link works in browser

### Issues Found
- None / [Document issues here]

---

## 3. Copy Link Functionality

### Test Steps
1. [ ] Generate new link
2. [ ] Tap "Copy Link"
3. [ ] Open Notes app
4. [ ] Paste link
5. [ ] Verify format
6. [ ] Tap link

### Expected Results
- [ ] Link copies to clipboard
- [ ] Format is correct (https://...)
- [ ] Link is clickable
- [ ] Opens in browser

### Issues Found
- None / [Document issues here]

---

## 4. Security Validation

### 4.1 Encrypted Storage

1. [ ] Upload photo via mobile app
2. [ ] Go to Supabase Dashboard → Storage
3. [ ] Find uploaded file
4. [ ] Download raw file
5. [ ] Try to open in image viewer

**Expected:** File should be unreadable garbage data

**Result:** _______________

### 4.2 Key Separation

1. [ ] Open browser console on viewer
2. [ ] Try to query link_secrets:
   ```javascript
   const { data, error } = await supabase
     .from('link_secrets')
     .select('*')
   ```
3. [ ] Check error message

**Expected:** RLS policy violation error

**Result:** _______________

### 4.3 Signed URL Expiry

1. [ ] Open link in browser
2. [ ] Open Network tab
3. [ ] Copy signed URL from request
4. [ ] Wait 60+ seconds
5. [ ] Try to access copied URL directly

**Expected:** 403 or 404 error (URL expired)

**Result:** _______________

---

## 5. Image Processing Validation

### 5.1 EXIF Stripping

1. [ ] Prepare test image with EXIF data
2. [ ] Run: `exiftool original.jpg > original-exif.txt`
3. [ ] Upload via mobile app
4. [ ] Download decrypted image
5. [ ] Run: `exiftool decrypted.jpg > decrypted-exif.txt`
6. [ ] Compare files

**Expected:** Decrypted image has no EXIF metadata

**Result:** _______________

### 5.2 Image Resizing

1. [ ] Prepare 4000px+ image
2. [ ] Note dimensions: _____ x _____
3. [ ] Upload via mobile app
4. [ ] Download decrypted image
5. [ ] Check dimensions: _____ x _____

**Expected:** Max dimension ≤2048px, aspect ratio maintained

**Result:** _______________

### 5.3 Thumbnail Generation

1. [ ] Upload image
2. [ ] Check Supabase Storage
3. [ ] Verify thumbnail file exists
4. [ ] Compare file sizes

**Expected:** Thumbnail is smaller than full image

**Result:** _______________

---

## 6. Cross-Browser Testing

### Safari
- [ ] Link opens correctly
- [ ] Image decrypts
- [ ] UI is responsive
- [ ] No console errors

### Chrome
- [ ] Link opens correctly
- [ ] Image decrypts
- [ ] UI is responsive
- [ ] No console errors

### Firefox
- [ ] Link opens correctly
- [ ] Image decrypts
- [ ] UI is responsive
- [ ] No console errors

---

## 7. Error Handling

### Invalid Link
1. [ ] Navigate to viewer with invalid shortcode
2. [ ] Verify error message displays

**Expected:** User-friendly 404 error

**Result:** _______________

### Network Error
1. [ ] Disable network on mobile
2. [ ] Try to upload photo
3. [ ] Observe error handling

**Expected:** Clear error message, retry option

**Result:** _______________

---

## Test Summary

**Date:** _______________  
**Tester:** _______________  
**Total Tests:** _______________  
**Passed:** _______________  
**Failed:** _______________  

**Critical Issues:**
- None / [List issues]

**Recommendations:**
- [Document recommendations]
