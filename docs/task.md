# Sharene Prototype - Task List

## Phase 1: Infrastructure Setup ✅

### Supabase Project Setup
- [ ] Install Node.js and npm (if not already installed)
- [ ] Install Supabase CLI (`brew install supabase/tap/supabase`)
- [ ] Create new Supabase project at https://app.supabase.com
- [ ] Note down Project URL, Anon Key, and Service Role Key
- [ ] Copy `.env.example` to `.env.local` and fill in credentials
- [ ] Configure anonymous authentication in Supabase Dashboard
- [ ] Login to Supabase CLI (`supabase login`)
- [ ] Link to cloud project (`supabase link --project-ref <your-ref>`)

### Database Schema ✅
- [x] Create `shared_links` table with minimal schema
- [x] Create `link_secrets` table
- [x] Enable RLS on both tables
- [x] Create RLS policies for `shared_links` (owner access)
- [x] Create RLS policy for `link_secrets` (deny all client access)
- [x] Create storage RLS policies (private bucket, owner upload/delete only)
- [x] **Refinements (Best Practices)**
  - [x] Optimize RLS policies with sub-select caching
  - [x] Add temporal indexes for performance


### Edge Functions Setup ✅
- [x] Create `create-link` Edge Function
  - [x] Generate short_code logic
  - [x] Store encryption key in `link_secrets`
  - [x] Return shortCode and shareUrl
- [x] Create `get-link` Edge Function
  - [x] Handle 'metadata' action (return signed URL + metadata)
  - [x] Handle 'key' action (return encryption key)
  - [x] Generate 60-second signed URLs
- [x] Deploy database migrations (`supabase db push`)
- [x] Deploy Edge Functions to Supabase
  - [x] `supabase functions deploy create-link --no-verify-jwt`
  - [x] `supabase functions deploy get-link --no-verify-jwt`
- [x] Test Edge Functions with curl/Postman

---

## Phase 2: Mobile App (iOS)

### Project Initialization
- [ ] Initialize Expo project with TypeScript
- [ ] Install dependencies:
  - [ ] `react-native-quick-crypto`
  - [ ] `expo-image-manipulator`
  - [ ] `expo-image-picker`
  - [ ] `@supabase/supabase-js`
  - [ ] `expo-clipboard`
  - [ ] `expo-sharing` (for Share Sheet)
- [ ] Configure polyfills for crypto
- [ ] Set up Supabase client with anonymous auth

### Share Sheet Configuration
- [ ] Configure `app.json` for iOS Share Extension
- [ ] Add share target configuration (accept images)
- [ ] Test receiving photos from iOS Photos app

### Core Services
- [ ] Create encryption service (`services/encryption.ts`)
  - [ ] `generateKey()` - Generate 32-byte AES key
  - [ ] `encryptPhoto()` - AES-256-GCM encryption with structured payload
  - [ ] Export as hex string for storage
- [ ] Create image processing service (`services/imageProcessing.ts`)
  - [ ] Strip EXIF metadata
  - [ ] Resize to max 2048px (~80% quality)
  - [ ] Generate thumbnail (smaller size)
- [ ] Create API service (`services/api.ts`)
  - [ ] `uploadPhoto()` - Upload to Supabase Storage
  - [ ] `createLink()` - Call create-link Edge Function
  - [ ] Handle errors and retries

### UI Components
- [ ] Create main screen with "Select Photo" button
- [ ] Implement photo picker integration
- [ ] Create processing flow UI (loading states)
- [ ] Create success screen with:
  - [ ] Display generated link
  - [ ] "Copy Link" button (auto-copy to clipboard)
  - [ ] Visual confirmation of copy action
- [ ] Add basic error handling UI

### Integration & Flow
- [ ] Implement anonymous auth on app launch
- [ ] Wire up photo selection → processing → upload → link creation flow
- [ ] Wire up Share Sheet → processing → upload → link creation flow
- [ ] Test full flow on iOS Simulator

---

## Phase 3: Web Viewer

### Project Initialization
- [ ] Initialize Next.js project with TypeScript
- [ ] Configure for static export (`output: 'export'`)
- [ ] Install dependencies:
  - [ ] None required (use native Web Crypto API)
- [ ] Set up environment variables (Supabase URL, anon key)

### Decryption Service
- [ ] Create decryption utility (`utils/decryption.ts`)
  - [ ] `loadAndDecryptPhoto()` - Main decryption flow
  - [ ] Fetch metadata + signed URL (action: 'metadata')
  - [ ] Download encrypted blob
  - [ ] Fetch encryption key (action: 'key')
  - [ ] Parse structured payload (version + IV + ciphertext + tag)
  - [ ] Decrypt using Web Crypto API
  - [ ] Return blob URL for display

### UI Components
- [ ] Create `[shortCode].tsx` dynamic route
- [ ] Implement loading states (fetching, decrypting)
- [ ] Create photo viewer component
  - [ ] Responsive image display
  - [ ] Basic styling
- [ ] Create error states:
  - [ ] Link not found (404)
  - [ ] Decryption failed
  - [ ] Network error
  - [ ] Invalid key

### Integration & Testing
- [ ] Test with links generated from mobile app
- [ ] Verify decryption works correctly
- [ ] Test on different browsers (Safari, Chrome)
- [ ] Test responsive design (mobile, tablet, desktop)

---

## Phase 4: End-to-End Testing

### Functional Tests
- [ ] **In-App Flow**: Select image → Get URL → Open in browser → Verify decrypted image displays
- [ ] **Share Sheet Flow**: Share from Photos app → Process → Get URL → Verify in browser
- [ ] **Copy Link**: Tap "Copy Link" → Paste in Notes → Verify correct format
- [ ] **Thumbnail**: Verify encrypted thumbnail loads in web viewer

### Security Validation
- [ ] **Encrypted Storage**: View raw file in Supabase Storage → Confirm encrypted (garbage data)
- [ ] **Key Separation**: Attempt to query `link_secrets` via client SDK → Confirm RLS blocks
- [ ] **RLS Enforcement**: Attempt to access another user's `shared_links` → Confirm blocked
- [ ] **Signed URL Expiry**: Wait 60+ seconds → Try to re-fetch → Confirm expired

### Image Processing Validation
- [ ] **EXIF Stripped**: Download decrypted image → Run `exiftool` → Confirm no metadata
- [ ] **Image Resized**: Upload 4000px image → Verify output is max 2048px
- [ ] **Thumbnail Generated**: Verify thumbnail exists and loads faster than full image

---

## Phase 5: Documentation & Cleanup

- [ ] Document any deviations from original plan
- [ ] Create quick start guide for running the prototype
- [ ] List known issues/limitations
- [ ] Document learnings for MVP phase
- [ ] Clean up test data from Supabase

---

## Success Criteria

✅ Complete encryption → upload → decrypt → display loop works  
✅ Security model (RLS + key separation) proven  
✅ Image processing pipeline validated  
✅ Share Sheet integration works on iOS  
✅ No security vulnerabilities in core architecture
