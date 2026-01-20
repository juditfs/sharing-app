# Sharene Prototype Plan ("Walking Skeleton")

**Goal:** Prove the core securely-encrypted sharing loop end-to-end with minimal UI and zero optional features.

## Scope Reduction (Prototype vs MVP)

| Feature | MVP | Prototype |
| :--- | :--- | :--- |
| **Auth** | Sign in with Apple | **Anonymous Auth** (Invisible to user) |
| **User History** | Dashboard with active/revoked/expired links | **None** (Fire and forget) |
| **Link Management** | Revoke, Extend, Modify Settings | **None** (Links exist forever or manual DB delete) |
| **Expiry** | 1h/1d/1w/1m/1y/custom | **None** (No expiration) |
| **Analytics** | View count, access logs, device tracking | **None** (No logging) |
| **UI/UX** | Polished, Animations, React Native Paper | **Bare Bones** (System buttons, minimal styling) |
| **Platform** | iOS + Android + Web | **iOS Simulator + Localhost Web** |
| **Share Sheet** | Full integration with custom UI | **Basic integration** (Receive photo only) |

## Features INCLUDED in Prototype

✅ **Image Processing** (Critical for validating full pipeline):
- EXIF metadata stripping (location, device info, timestamps)
- Image resizing (max 2048px, ~80% quality)
- Thumbnail generation (for encrypted preview)

✅ **Encryption** (Core technical risk):
- Client-side AES-256-GCM encryption
- Secure key generation and storage separation
- Structured binary payload (version + IV + tag + ciphertext)

✅ **Share Sheet Integration** (iOS only):
- Receive photos from iOS Photos app
- Process and share via Sharene

✅ **Basic UX**:
- Copy Link button (auto-copy to clipboard)
- Simple success/error states

## Core User Flow (The "Walking Skeleton")

### Flow 1: In-App Photo Selection
1.  **Sender (iOS App)**
    *   Opens App (Auto-signs in anonymously via Supabase)
    *   Taps "Select Photo"
    *   Picks photo from gallery
    *   App processes: Strip EXIF → Resize → Generate thumbnail → Encrypt (AES-256-GCM)
    *   Uploads encrypted photo + thumbnail to Supabase Storage
    *   Calls `create-link` Edge Function
    *   Displays link with "Copy Link" button
    *   Link auto-copied to clipboard

2.  **Recipient (Web Browser)**
    *   Opens `http://localhost:3000/share/<shortCode>`
    *   JS calls `get-link` Edge Function (action: 'metadata')
    *   Receives signed URL + metadata
    *   Downloads encrypted blob
    *   JS calls `get-link` Edge Function (action: 'key')
    *   Decrypts using Web Crypto API
    *   Renders image

### Flow 2: Share Sheet Integration
1.  **Sender (iOS Photos App)**
    *   Opens Photos app
    *   Selects photo → Share → Sharene
    *   Sharene app opens with photo pre-loaded
    *   Same processing flow as above
    *   Returns to Photos app after link copied

## Architecture (Simplified MVP)

### Database Schema (Minimal)
```sql
-- Minimum viable schema
CREATE TABLE shared_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id), -- For RLS testing
  short_code TEXT UNIQUE NOT NULL,
  photo_url TEXT NOT NULL,
  thumbnail_url TEXT, -- Encrypted thumbnail
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE link_secrets (
  link_id UUID PRIMARY KEY REFERENCES shared_links(id) ON DELETE CASCADE,
  encryption_key TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Supabase Configuration
*   **Auth**: Anonymous auth enabled
*   **Storage**: Private bucket `photos` with RLS
*   **RLS Policies**: 
    - `shared_links`: Owner can read/write (user_id = auth.uid())
    - `link_secrets`: NO direct access (Service Role only)
    - `storage.objects`: Owner can upload/delete, NO public reads

### Edge Functions
*   **`create-link`**: 
    - Input: `{ photoUrl, thumbnailUrl, encryptionKey }`
    - Generates short_code
    - Stores key in `link_secrets` (bypassing RLS)
    - Returns: `{ shortCode, shareUrl }`

*   **`get-link`**: 
    - Input: `{ shortCode, action: 'metadata' | 'key' }`
    - Action 'metadata': Returns signed URL (60s expiry) + metadata
    - Action 'key': Returns encryption key
    - No validation (expiry/revocation) in prototype

### Frontend
*   **Mobile (iOS)**: 
    - Expo + React Native
    - Single screen with "Select Photo" button
    - Share Sheet target configuration
    - Encryption service (`react-native-quick-crypto`)
    - Image processing (`expo-image-manipulator`)

*   **Web Viewer**: 
    - Next.js (localhost:3000)
    - Single page: `/share/[shortCode].tsx`
    - Web Crypto API for decryption
    - Basic loading/error states

## Explicit Exclusions (Defer to MVP)

❌ **No Expiry/Revocation** - Links live forever (or manual DB cleanup)  
❌ **No Analytics** - No view counts, no access logs  
❌ **No Download Control** - All photos are viewable (no download toggle)  
❌ **No Link Dashboard** - Fire and forget (no history)  
❌ **No Custom Share Text** - Default text only  
❌ **No Error Recovery** - Basic error messages only  
❌ **No Rate Limiting** - Trust-based (local testing only)  
❌ **No Android Support** - iOS Simulator only  
❌ **No Production Deployment** - Localhost web viewer only

## Definition of Done

### Functional Tests
1. ✅ **In-App Flow**: Select image on iOS Simulator → Get URL → Open on desktop browser → See decrypted image
2. ✅ **Share Sheet Flow**: Share from iOS Photos → Sharene processes → Get URL → Verify on browser
3. ✅ **Copy Link**: Tap "Copy Link" → Paste in Notes → Link is correct format
4. ✅ **Thumbnail**: Verify encrypted thumbnail displays in web viewer (faster load)

### Security Validation
5. ✅ **Encrypted Storage**: View raw file in Supabase Storage dashboard → Confirm garbage data (encrypted)
6. ✅ **Key Separation**: Attempt to query `link_secrets` via client SDK → Confirm RLS blocks access
7. ✅ **RLS Enforcement**: Attempt to access another user's `shared_links` row → Confirm blocked
8. ✅ **Signed URL Expiry**: Wait 60+ seconds → Try to re-fetch signed URL → Confirm expired

### Image Processing Validation
9. ✅ **EXIF Stripped**: Download decrypted image → Run `exiftool` → Confirm no GPS/device metadata
10. ✅ **Image Resized**: Upload 4000px image → Verify output is max 2048px
11. ✅ **Thumbnail Generated**: Verify thumbnail exists and loads faster than full image

## Success Criteria

**The prototype is successful if:**
- The complete encryption → upload → decrypt → display loop works end-to-end
- Security model (RLS + key separation) is proven in practice
- Image processing (EXIF/resize/thumbnail) pipeline is validated
- Share Sheet integration works on iOS
- No security vulnerabilities in the core architecture

**Time Estimate: 8-12 hours** (including debugging and validation)
