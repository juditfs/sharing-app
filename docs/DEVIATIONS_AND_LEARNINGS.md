# Sharene Prototype: Deviations, Learnings & Best Practices

This document captures the key architectural decisions, plan deviations, technical learnings, and established best practices from the prototype implementation phase to guide MVP development.

---

## Core Principle: Security is the Product Differentiator

> **Security is not a feature, it's the foundation of our product.**

Sharene exists because existing photo-sharing options don't provide adequate privacy controls. Our competitive advantage is **trustworthy security**, which means:

1. **Security decisions are non-negotiable** - Never compromise security for performance, features, or convenience
2. **Every performance optimization must be security-reviewed** - Speed gains that weaken encryption are unacceptable
3. **When in doubt, choose the more secure option** - Conservative defaults, explicit user consent for less secure options
4. **Security is visible** - Users should understand and trust our security model
5. **Defense in depth** - Multiple layers of protection (client-side encryption + RLS + Edge Functions + signed URLs)

**Practical implications:**
- Performance optimizations must preserve end-to-end encryption
- Never cache decrypted content on disk
- Never log encryption keys or plaintext data
- Always validate inputs before processing
- Prefer battle-tested crypto libraries over faster custom implementations

---

## Performance Analysis: Upload & Viewing Flows

### Current Performance Bottlenecks

#### Upload Flow (Mobile App)

The upload flow has **5 sequential blocking operations**:

```
1. Image Processing (resize + EXIF strip) → ~500-1500ms
2. File Read (image to base64)            → ~200-400ms  
3. Encryption (AES-256-GCM)               → ~100-300ms
4. File Write (encrypted to temp file)   → ~100-200ms
5. File Read Again (for upload)          → ~200-400ms
6. Network Upload (Supabase Storage)     → ~500-3000ms (network-dependent)
7. API Call (create-link Edge Function)  → ~200-500ms
```

**Total: ~1.8 - 6.3 seconds**

**Key Issues Identified:**

| Issue | Location | Impact | Cause |
|-------|----------|--------|-------|
| Double file I/O | `crypto.ts:24-55` | ~400ms | Read image → encrypt → write → read again for upload |
| Base64 conversion loops | `crypto.ts:88-103` | ~100ms | Character-by-character conversion is slow |
| Sequential thumbnail processing | `imageProcessing.ts:17-28` | ~500ms | Thumbnail processed after main image, not parallel |
| Synchronous byte conversion | `upload.ts:24` | ~50ms | `Uint8Array.from(atob(...))` is inefficient |

#### Viewing Flow (Web Viewer)

The viewing flow has **4 sequential operations**:

```
1. API Call #1 (get metadata)     → ~200-400ms
2. API Call #2 (get key)          → ~200-400ms  
3. Network Download (signed URL)  → ~500-2000ms (size-dependent)
4. Decryption (AES-256-GCM)       → ~50-200ms
```

**Total: ~0.95 - 3.0 seconds**

**Key Issues Identified:**

| Issue | Location | Impact | Cause |
|-------|----------|--------|-------|
| Sequential API calls | `api.ts:22-48` | ~400ms | Two separate calls for metadata + key |
| No progressive loading | `ViewPage.tsx:49-52` | UX | Full image must download before decryption |
| No thumbnail usage | `ViewPage.tsx` | UX | Encrypted thumbnail exists but not used |

---

### Security-Conscious Optimization Recommendations

#### PRIORITY 1: Eliminate Double File I/O (Upload)

**Current:** Encrypt → Write to temp file → Read temp file → Upload
**Proposed:** Encrypt → Upload directly from memory

```typescript
// CURRENT (slow)
const encryptedUri = await encryptImage(processedUri, key);
const photoData = await FileSystem.readAsStringAsync(encryptedUri, { encoding: 'base64' });

// PROPOSED (fast, secure)
export async function encryptImageToBuffer(imageUri: string, key: string): Promise<Uint8Array> {
  const imageData = await FileSystem.readAsStringAsync(imageUri, { encoding: 'base64' });
  const plaintext = base64ToBytes(imageData);
  const keyBytes = hexToBytes(key);
  const iv = await Crypto.getRandomBytesAsync(12);
  const cipher = gcm(keyBytes, iv);
  const ciphertext = cipher.encrypt(plaintext);
  
  // Return buffer directly - no temp file
  const payload = new Uint8Array(1 + 12 + ciphertext.length);
  payload[0] = 1; // version
  payload.set(iv, 1);
  payload.set(ciphertext, 13);
  return payload;
}
```

**Security review:** ✅ Safe - Data stays in memory, never written to disk unencrypted

**Expected improvement:** ~300-500ms saved

---

#### PRIORITY 2: Parallelize Image Processing

**Current:** Process main image → Then process thumbnail (sequential)
**Proposed:** Process both in parallel

```typescript
// CURRENT (slow)
const processed = await ImageManipulator.manipulateAsync(imageUri, [...]);
const thumbnail = await ImageManipulator.manipulateAsync(imageUri, [...]);

// PROPOSED (fast, secure)
export async function processImage(imageUri: string) {
  const [processed, thumbnail] = await Promise.all([
    ImageManipulator.manipulateAsync(imageUri, [{ resize: { width: 2048 } }], { compress: 0.8 }),
    ImageManipulator.manipulateAsync(imageUri, [{ resize: { width: 400 } }], { compress: 0.7 }),
  ]);
  return { processedUri: processed.uri, thumbnailUri: thumbnail.uri };
}
```

**Security review:** ✅ Safe - Same operations, just parallel

**Expected improvement:** ~300-600ms saved

---

#### PRIORITY 3: Merge API Calls (Viewer)

**Current:** Two separate Edge Function calls (metadata + key)
**Proposed:** Single call with proper security model

```typescript
// CURRENT (slow, 2 round trips)
const metadata = await supabase.functions.invoke('get-link', { body: { shortCode, action: 'metadata' } });
const key = await supabase.functions.invoke('get-link', { body: { shortCode, action: 'key' } });

// PROPOSED (fast, 1 round trip)
const response = await supabase.functions.invoke('get-link', { body: { shortCode, action: 'full' } });
// Returns: { signedUrl, metadata, key }
```

**Security review:** ⚠️ Needs consideration
- **Pro:** Single request reduces latency
- **Con:** Key and URL in same response could be captured together
- **Mitigation:** HTTPS ensures transit security; key separation was for defense-in-depth
- **Decision:** ✅ Acceptable for MVP - HTTPS provides sufficient protection

**Expected improvement:** ~200-400ms saved

---

#### PRIORITY 4: Progressive Loading with Thumbnail

**Current:** Wait for full image to download and decrypt
**Proposed:** Show encrypted thumbnail immediately while full image loads

```typescript
// In ViewPage.tsx
async function loadPhoto() {
  const linkData = await getLinkData(shortCode);
  
  // Start full image download in background
  const fullImagePromise = downloadAndDecrypt(linkData.signedPhotoUrl, linkData.encryptionKey);
  
  // Show thumbnail immediately (if available)
  if (linkData.signedThumbnailUrl) {
    const thumbData = await downloadEncryptedPhoto(linkData.signedThumbnailUrl);
    const thumbBlob = await decryptPhoto(thumbData, linkData.encryptionKey);
    setPhotoUrl(URL.createObjectURL(thumbBlob));
    setIsLoadingFull(true);
  }
  
  // Swap to full image when ready
  const fullBlob = await fullImagePromise;
  setPhotoUrl(URL.createObjectURL(fullBlob));
  setIsLoadingFull(false);
}
```

**Security review:** ✅ Safe - Thumbnail is encrypted with same key

**Expected improvement:** Perceived ~1-2 seconds faster (actual total time similar)

---

#### PRIORITY 5: Use Web Workers for Decryption (Viewer)

**Current:** Decryption blocks main thread
**Proposed:** Decrypt in Web Worker

```typescript
// decryptWorker.ts
self.onmessage = async (e) => {
  const { encryptedData, keyHex } = e.data;
  const decrypted = await decryptPhoto(encryptedData, keyHex);
  self.postMessage(decrypted);
};

// ViewPage.tsx
const worker = new Worker(new URL('../workers/decryptWorker.ts', import.meta.url));
worker.postMessage({ encryptedData, keyHex: linkData.encryptionKey });
worker.onmessage = (e) => setPhotoUrl(URL.createObjectURL(e.data));
```

**Security review:** ✅ Safe - Worker has same security context

**Expected improvement:** UI responsiveness, no blocking

---

#### PRIORITY 6: Optimize Base64 Conversion (Mobile)

**Current:** Character-by-character loop
**Proposed:** Use native Buffer or optimized library

```typescript
// CURRENT (slow)
function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// PROPOSED (fast)
import { Buffer } from 'buffer';

function base64ToBytes(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, 'base64'));
}
```

**Security review:** ✅ Safe - Same data transformation

**Expected improvement:** ~50-100ms saved

**⚠️ PROMOTED TO P1** - Low effort, high impact. Manual character looping is extremely slow.

---

### Performance Optimization Summary

| Optimization | Effort | Impact | Security Risk | Priority |
|--------------|--------|--------|---------------|----------|
| Eliminate double file I/O | Medium | High (~400ms) | ✅ None | P1 |
| Parallelize image processing | Low | Medium (~400ms) | ✅ None | P1 |
| **Optimize base64 conversion** | **Low** | **Low (~75ms)** | ✅ **None** | **P1** ⬆️ |
| Merge API calls | Medium | Medium (~300ms) | ⚠️ Low | P2 |
| Progressive thumbnail loading | Medium | High (perceived) | ✅ None | P2 |
| Web Worker decryption | Medium | Medium (UX) | ✅ None | ~~P3~~ **DEFERRED** |

**Total potential improvement:** ~1.2 seconds off upload, ~0.5 seconds off viewing

---

### Engineering Review Feedback

#### ✅ Strongly Endorsed (Implement Immediately)

**1. Eliminate Double File I/O (P1)**
- **Caveat:** Watch memory usage on low-end Android devices
- **Action:** Use `Uint8Array` buffers instead of base64 strings where possible
- **Mitigation:** Aggressively garbage collect after upload

**2. Parallelize Image Processing (P1)**
- **Endorsement:** Pure efficiency gain with zero security downside
- **Implementation:** `Promise.all` is perfect

**3. Optimize Base64 Conversion (Promoted from P3 → P1)**
- **Rationale:** Low-effort, high-impact fix
- **Impact:** Benefits every single upload
- **Implementation:** One-line change using `Buffer` or native C++ binding

#### ⚠️ Proceed with Caution

**4. Merge API Calls (P2)**
- **Risk:** Single log entry could expose both key and URL ("skeleton key")
- **Original Design:** Separate calls meant metadata logs never contained keys
- **Mitigation Required:**
  ```typescript
  // In Edge Function
  console.log('get-link request', { shortCode, action }); // ✅ Safe
  // DO NOT LOG: console.log('response', response); // ❌ Would expose key
  ```
- **Action:** Explicitly exclude response body from Edge Function logs
- **Decision:** ✅ Approved for MVP with logging safeguards

#### 🛑 Deferred (Post-MVP)

**5. Web Workers for Decryption**
- **Rationale:** Over-engineering for prototype
- **Reality:** Modern mobile browsers handle AES-GCM very fast (~50-200ms)
- **Decision:** Fix only if users complain about UI stuttering
- **Moved to:** Post-MVP backlog

---

### Additional Considerations

#### Memory Management (Mobile)

**Issue:** Keeping full-resolution base64 strings in memory can cause OOM crashes on low-end Android devices.

**Mitigation Strategy:**
```typescript
// ❌ Bad - Keeps large base64 string in memory
const imageData = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
const bytes = base64ToBytes(imageData); // imageData still in memory

// ✅ Good - Convert and release immediately
async function encryptImageToBuffer(uri: string, key: string): Promise<Uint8Array> {
  const imageData = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
  const bytes = Buffer.from(imageData, 'base64'); // Native conversion
  imageData = null; // Hint for GC (not guaranteed but helps)
  
  // Continue with encryption using bytes
  const keyBytes = hexToBytes(key);
  const iv = await Crypto.getRandomBytesAsync(12);
  const cipher = gcm(keyBytes, iv);
  return cipher.encrypt(bytes);
}
```

**Testing:** Verify on low-end Android devices (e.g., Android Go edition with 1-2GB RAM)

#### Image Resizing Enforcement

**Current Implementation:** ✅ Already enforced
```typescript
// mobile/lib/imageProcessing.ts
{ resize: { width: 2048 } } // Strict max dimension
```

**Validation:** Uploading raw 12MP/48MP photos would be the #1 cause of slow uploads. Current implementation correctly resizes to max 2048px before encryption.

**Additional Safeguard (Recommended):**
```typescript
// Add size validation before processing
export async function processImage(imageUri: string) {
  const info = await FileSystem.getInfoAsync(imageUri);
  if (info.size > 10 * 1024 * 1024) { // 10MB limit
    console.warn('Large image detected, resizing will help:', info.size);
  }
  
  const [processed, thumbnail] = await Promise.all([
    ImageManipulator.manipulateAsync(imageUri, [{ resize: { width: 2048 } }], { compress: 0.8 }),
    ImageManipulator.manipulateAsync(imageUri, [{ resize: { width: 400 } }], { compress: 0.7 }),
  ]);
  return { processedUri: processed.uri, thumbnailUri: thumbnail.uri };
}
```

---

### ❌ Optimizations We Will NOT Do (Security Reasons)

| Proposed Optimization | Why Rejected |
|----------------------|--------------|
| Cache decrypted images on disk | Leaves plaintext on device |
| Pre-decrypt in Service Worker | Key would be in worker cache |
| Server-side decryption | Server would have access to plaintext |
| Reduce encryption strength | Unacceptable security tradeoff |
| Skip EXIF stripping | Privacy violation |
| Store unencrypted thumbnails | Leaks preview content |

---

## Part 1: Deviations from Original Plan

### 1.1 Expiry Defaults
- **Original Plan:** "Never" expires by default
- **Implementation:** Default expiry set to **1 Week**
- **Reason:** Aligns better with "Privacy First" philosophy. Users can still explicitly select longer durations, but the safe default prevents accumulation of stale shared content.
- **Status:** ✅ Validated - Better UX and privacy posture

### 1.2 Testing Strategy
- **Original Plan:** Full automated E2E testing including UI
- **Implementation:** Hybrid approach
  - **Automated:** API, Security (RLS), and Environment validation
  - **Manual:** Mobile UI, Share Sheet, and Visual verification
- **Reason:** Mobile simulator limitations (specifically for Share Extensions) and the high cost of maintaining fragile UI tests for a prototype
- **Status:** ✅ Validated - Pragmatic for prototype scale

### 1.3 Thumbnail Handling
- **Original Plan:** Encrypted thumbnails everywhere
- **Adaptation:** Explicit support for "Public Preview" logic where required by platform constraints (e.g., specific messaging apps), though MVP defaults to privacy
- **Reason:** WhatsApp and similar apps need unencrypted thumbnails for preview generation
- **Status:** ✅ Validated - User choice between privacy and convenience

### 1.4 Schema Simplification
- **Original Plan:** Full feature set (revocation, expiry, download control, custom share text)
- **Implementation:** Minimal schema with only essential fields
- **Reason:** Prototype validation - implement features when actually needed, not speculatively
- **Status:** ✅ Validated - Reduced complexity, easier to maintain
- **Action for MVP:** Add fields only when implementing corresponding features

---

## Part 2: Technical Learnings

### 2.1 Security Model (RLS + Edge Functions)

**Finding:** The decision to store encryption keys in a distinct `link_secrets` table protected by RLS proved **extremely robust**.

**Evidence:**
- Automated tests confirmed that `link_secrets` returns 0 rows to any client (anon or authenticated)
- Only Edge Functions using the `service_role` key can access keys
- Creates a secure "airlock" for key retrieval

**Key Insight:** RLS is not just a security feature - it's an **architectural pattern** that enables secure serverless design.

**Best Practice:**
```sql
-- Complete lockdown pattern
CREATE POLICY "deny_all_client_access" 
ON sensitive_table 
FOR ALL 
USING (false);
```

---

### 2.2 EXIF Data Stripping

**Finding:** Client-side EXIF stripping is reliable but requires **verification tooling**.

**Evidence:**
- Visual inspection is insufficient - metadata is invisible to users
- `exiftool` is indispensable for automated verification
- Successfully removes GPS coordinates, camera make/model, timestamps

**Key Insight:** Privacy features must be **testable and verifiable**, not assumed.

**Best Practice:**
- Always include test images with known EXIF data
- Automate verification in CI/CD pipeline
- Document what metadata is stripped vs. preserved

---

### 2.3 Edge Function JWT Verification Pitfall

**Finding:** Supabase Edge Functions with `verify_jwt: true` (default) can silently block requests before they reach your code.

**Evidence:**
- Requests to `create-link` returned 401/403 errors despite valid tokens in client
- Custom logging and error handling in the function code was **never triggered**
- Platform-level gateway rejected requests before function invocation

**Key Insight:** Default platform security can obscure debugging. If you handle auth manually in the function (e.g., using `supabaseAdmin.auth.getUser()`), you must disable platform verification.

**Best Practice:**
- Always deploy functions with `--no-verify-jwt` if you perform custom auth checks
- Use `supabase functions deploy <name> --no-verify-jwt`
- Rely on `supabaseAdmin.auth.getUser(token)` within the function for granular control

---

### 2.4 Cross-Platform Crypto Compatibility

**Challenge:** Consistent encryption between React Native (Mobile) and Web Crypto API (Viewer)

**Solution:** Standardized on AES-256-GCM
- Mobile: `react-native-quick-crypto` (faster, feature-complete)
- Viewer: Native `SubtleCrypto` API
- Both produce identical encrypted payloads

**Key Insight:** Use **battle-tested, standard algorithms** - avoid custom crypto implementations.

**Best Practice:**
```typescript
// Version your crypto format for future migration
interface EncryptedPayload {
  version: 1;  // Enables format changes without breaking old links
  iv: string;
  ciphertext: string;
}
```

---

### 2.4 Code Duplication Detection

**Finding:** Code review caught ~20 lines of duplicated logic that wasn't obvious during development.

**Evidence:**
- `handleTakePhoto` and `handlePickPhoto` had identical processing workflows
- Duplication led to inconsistent error handling
- Refactoring reduced `App.tsx` by 33% (194 → 130 lines)

**Key Insight:** **Duplication is a code smell** - it indicates missing abstraction.

**Best Practice:**
- Extract shared logic when duplication exceeds 10 lines
- Use code review to catch duplication early
- Prefer composition over copy-paste

---

### 2.5 Schema-Code Mismatch Detection

**Finding:** Edge Function was returning fields that didn't exist in the database.

**Evidence:**
- `share_text`, `allow_download`, `is_revoked`, `expires_at` always returned defaults
- Features appeared to work but were non-functional
- Caught during engineering review, not during development

**Key Insight:** **Schema and code must be synchronized** - phantom fields create false confidence.

**Best Practice:**
- Use TypeScript types generated from database schema
- Validate API responses against schema in tests
- Never access fields that don't exist in migrations

---

### 2.6 Error Handling Consistency

**Finding:** Inconsistent error handling between similar functions degraded UX.

**Evidence:**
- `handleTakePhoto`: 5 specific error cases with helpful messages
- `handlePickPhoto`: Generic "Unknown error" message
- Users got different experiences for the same failure modes

**Key Insight:** **Error handling is a feature** - it deserves the same attention as happy paths.

**Best Practice:**
- Centralize error handling logic
- Provide actionable error messages ("Check WiFi" not "Network error")
- Test error paths as rigorously as success paths

---

### 2.7 Serverless Architecture Benefits

**Finding:** Supabase Edge Functions eliminated infrastructure complexity.

**Evidence:**
- No server provisioning, scaling, or monitoring required
- Automatic HTTPS, CORS handling, and logging
- Sub-100ms cold start times

**Key Insight:** **Serverless is ideal for prototypes** - focus on features, not infrastructure.

**Tradeoff:** Vendor lock-in to Supabase (acceptable for MVP, plan migration path for scale)

---

### 2.8 Testing Pyramid for Mobile Apps

**Finding:** UI tests are expensive and fragile; focus on integration and unit tests.

**Evidence:**
- Share Sheet testing requires physical device
- Simulator behavior differs from real devices
- Manual testing caught issues automated tests missed

**Key Insight:** **Optimize test ROI** - automate what's stable, manually test what's variable.

**Best Practice:**
```
Manual Tests (10%)    ← Share Sheet, Visual QA
Integration Tests (30%) ← API flows, E2E workflows
Unit Tests (60%)       ← Crypto, Image processing, Utils
```

---

### 2.9 Thumbnail Implementation & React Native Quirks

**Finding:** React Native's JS environment differs significantly from Node.js, causing silent failures in standard patterns.

**Evidence:**
- `Buffer.from()` caused a `ReferenceError` that silently failed the upload (caught in a generic catch block).
- `public_thumbnail_url` was null in the database, but no error surfaced in the UI.
- `expo-image-manipulator` behaves unexpectedly when combining `resize` (width+height) actions, sometimes producing empty files.

**Key Insight:** **Test on the platform, not just logic.** Polyfills like `Buffer` are not guaranteed.

**Technical Fixes:**
1. **Binary Handling**: Replaced `Buffer.from` with a pure JavaScript `base64ToUint8Array` decoder.
2. **File System**: Migrated to `expo-file-system/legacy` to avoid deprecation warnings for `readAsStringAsync`.
3. **OG Images**: Implemented a "Resize then Crop" strategy to enforce exact 1200x630px dimensions for WhatsApp/Telegram (using strict aspect ratio calculations), as simply setting width/height distorted or failed.

**Best Practice:**
- Avoid Node.js globals (`Buffer`, `process`) in React Native code.
- Use explicit resizing and cropping steps for image manipulation rather than single-step transforms.
- Ensure error handling logs the *specific* error (e.g., `ReferenceError`) rather than just "Upload failed".

---

## Part 3: Known Limitations (Prototype)

### 3.1 Share Sheet on Simulator
- **Issue:** Testing iOS Share Extension fully requires a physical device
- **Impact:** Simulator behavior for sharing files from Photos/Safari can be inconsistent
- **Workaround:** Manual testing on physical device before release
- **MVP Action:** Document testing requirements for QA team

### 3.2 Download on iOS
- **Issue:** Web Viewer's "Download" button behavior is browser-dependent on iOS
- **Impact:** Safari opens the blob; users must manually "Save to Files"
- **Workaround:** Provide clear instructions in UI
- **MVP Action:** Consider native share sheet for downloads

### 3.3 Single-Device Key Management
- **Issue:** Keys are stored in database, not in URL fragments
- **Impact:** Not true "zero-knowledge" encryption
- **Tradeoff:** Simpler implementation vs. maximum privacy
- **MVP Action:** Implement "Advanced Privacy Mode" with URL fragment keys

### 3.4 Analytics Precision
- **Issue:** View counts are approximate
- **Impact:** Cannot distinguish unique viewers from repeat views
- **Tradeoff:** Privacy (no tracking pixels) vs. precise analytics
- **MVP Action:** Document limitations to users

---

## Part 4: Best Practices & Development Guidelines

### 4.1 Established Principles (Already Following)

These principles were validated during prototype development:

1. ✅ **Single Responsibility** - Each file/function does one thing
2. ✅ **DRY Principle** - Minimal duplication (now enforced via refactoring)
3. ✅ **Security First** - Encryption, RLS, input validation
4. ✅ **Type Safety** - TypeScript strict mode, interfaces everywhere
5. ✅ **Error Handling** - Try-catch blocks, user-friendly messages
6. ✅ **Code Comments** - Only where needed (not over-commented)
7. ✅ **Naming Conventions** - Clear, descriptive names
8. ✅ **File Organization** - Logical grouping by feature/layer

---

### 4.2 New Rules for MVP Development

#### Rule 1: No Code Duplication > 10 Lines ✅ ADOPTED

**Rationale:** Duplication leads to bugs when one copy is updated but not the other.

**Action:** Extract to shared function/component immediately.

**Example:**
```typescript
// ❌ Bad - Duplicated logic
const handleTakePhoto = async () => {
  const processed = await processImage(uri);
  const encrypted = await encryptImage(processed, key);
  const uploaded = await uploadImage(encrypted);
  // ...
};

const handlePickPhoto = async () => {
  const processed = await processImage(uri);  // Duplicate!
  const encrypted = await encryptImage(processed, key);  // Duplicate!
  const uploaded = await uploadImage(encrypted);  // Duplicate!
  // ...
};

// ✅ Good - Shared workflow
const processAndUploadPhoto = async (uri) => {
  const processed = await processImage(uri);
  const encrypted = await encryptImage(processed, key);
  return await uploadImage(encrypted);
};
```

---

#### Rule 2: Shared Types for API Contracts ⚠️ MODIFIED

**Engineering Review Recommendation:** Create `shared-types` package

**Our Decision:** ❌ **Reject for MVP** - Over-engineering for 2-3 shared interfaces

**Rationale:** 
- Adds build complexity (workspace configuration, package linking)
- Requires Metro/Next.js configuration updates
- Type drift is not a real risk with only 2-3 shared interfaces

**Action for MVP:** 
- Keep types duplicated (copy-paste is acceptable for small scale)
- Document shared interfaces in a single reference file
- Revisit if shared types grow to 5+

**Example:**
```typescript
// docs/api-contracts.md - Single source of truth
interface CreateLinkRequest {
  photoUrl: string;
  thumbnailUrl?: string;
  encryptionKey: string;
}

// Copy-paste into mobile/viewer/functions as needed
// Update docs/api-contracts.md when changing
```

---

#### Rule 3: Error Codes, Not String Matching ⚠️ MODIFIED

**Engineering Review Recommendation:** Use enum-based error codes everywhere

**Our Decision:** ⚠️ **Defer to Post-MVP** - Implement incrementally

**Rationale:**
- String matching works for prototype scale
- Error code refactoring is low-risk, can be done later
- Focus MVP effort on user-facing features

**Action for MVP:**
- Continue using string matching for now
- Centralize error handling (already done)
- Plan error code migration for v1.1

**Future Pattern:**
```typescript
// Post-MVP
export enum ErrorCode {
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
}

export class AppError extends Error {
  constructor(public code: ErrorCode, message: string) {
    super(message);
  }
}
```

---

#### Rule 4: Database Schema Must Match Code ✅ ADOPTED

**Rationale:** Unused columns cause confusion and maintenance burden.

**Action:** Either use the column or remove it from schema.

**Evidence:** We removed phantom fields (`share_text`, `allow_download`, `is_revoked`, `expires_at`) from Edge Function response.

**Best Practice:**
```sql
-- Add columns ONLY when implementing features
-- Migration: 20260122_add_revocation.sql
ALTER TABLE shared_links ADD COLUMN is_revoked BOOLEAN DEFAULT FALSE;

-- Then update code to use it
```

---

#### Rule 5: TODOs Must Have Priority & Owner ✅ ADOPTED

**Rationale:** Generic TODOs get forgotten.

**Action:** Format as `// TODO(MVP|P1|P2): [Owner] Description`

**Example:**
```typescript
// ✅ Good
// TODO(MVP): @backend-team Add rate limiting (10 req/min per IP)
// TODO(P1): @mobile-team Implement offline queue for uploads
// TODO(P2): @design-team Add dark mode support

// ❌ Bad
// TODO: Add rate limiting
// TODO: Fix this later
```

---

#### Rule 6: One Error Handling Pattern Per Layer ✅ ADOPTED

**Rationale:** Consistency makes debugging easier.

**Action:**
- **Mobile:** Use centralized `handlePhotoError` function
- **Viewer:** Use error codes mapped to user messages
- **Edge Functions:** Use HTTP status codes + JSON errors

**Example:**
```typescript
// Mobile
catch (error: any) {
  handlePhotoError(error);  // Centralized
}

// Viewer
if (response.status === 404) {
  setError('Link not found or expired');
}

// Edge Function
return new Response(
  JSON.stringify({ error: 'Link not found' }),
  { status: 404, headers: corsHeaders }
);
```

---

#### Rule 7: Test Critical Paths ✅ ADOPTED

**Rationale:** Encryption bugs are catastrophic.

**Action:** Unit test all crypto functions before deploying.

**Example:**
```typescript
// test/crypto.test.ts
describe('Encryption', () => {
  it('should encrypt and decrypt round-trip', async () => {
    const key = await generateEncryptionKey();
    const plaintext = 'test data';
    const encrypted = await encrypt(plaintext, key);
    const decrypted = await decrypt(encrypted, key);
    expect(decrypted).toBe(plaintext);
  });

  it('should fail with wrong key', async () => {
    const key1 = await generateEncryptionKey();
    const key2 = await generateEncryptionKey();
    const encrypted = await encrypt('test', key1);
    await expect(decrypt(encrypted, key2)).rejects.toThrow();
  });
});
```

---

#### Rule 8: No Magic Numbers ✅ ADOPTED

**Rationale:** Unexplained constants are hard to maintain.

**Action:** Extract to named constants with comments.

**Example:**
```typescript
// ✅ Good
const SIGNED_URL_EXPIRY_SECONDS = 60; // Short expiry for security
const SHORT_CODE_LENGTH = 8; // Balance between collision risk and UX
const MAX_IMAGE_DIMENSION = 2048; // Reduce file size while maintaining quality

// Usage
.createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS)

// ❌ Bad
.createSignedUrl(path, 60)  // What does 60 mean?
```

---

### 4.3 Additional MVP Guidelines

#### Rule 9: Rate Limiting is Essential ✅ NEW

**Rationale:** Prevent brute force attacks and DoS.

**Action:** Implement CDN-level rate limiting (Vercel Edge Config)

**Implementation:**
```typescript
// vercel.json
{
  "functions": {
    "api/**": {
      "maxDuration": 10,
      "memory": 1024
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "X-RateLimit-Limit",
          "value": "10"
        }
      ]
    }
  ]
}
```

**Note:** Supabase doesn't have "built-in" Edge Function rate limiting - use CDN layer.

---

#### Rule 10: Keep Thumbnails (Don't Remove) ✅ NEW

**Rationale:** Already implemented, low cost to keep, useful for future features.

**Evidence:** Engineering review suggested removal, but:
- Minimal overhead (already implemented)
- Enables progressive loading (future feature)
- Part of original design

**Action:** Keep thumbnail generation, document future use cases.

---

#### Rule 11: Prototype Pragmatism Over Perfection ✅ NEW

**Rationale:** Prototypes validate ideas, not architecture.

**Guidelines:**
- **Acceptable:** Copy-paste for 2-3 shared types
- **Acceptable:** String-based error matching
- **Acceptable:** Manual testing for Share Sheet
- **Not Acceptable:** Security shortcuts
- **Not Acceptable:** Code duplication >10 lines
- **Not Acceptable:** Skipping critical path tests

**Decision Framework:**
- **Security:** Never compromise
- **User Experience:** High priority
- **Code Quality:** Pragmatic (refactor when needed)
- **Scalability:** Plan for it, don't over-engineer

---

## Part 5: MVP Transition Checklist

### 5.1 Code Quality
- [x] Remove code duplication (completed in refactoring)
- [x] Standardize error handling (completed in refactoring)
- [x] Fix schema-code mismatches (completed in refactoring)
- [ ] Add unit tests for crypto functions
- [ ] Add integration tests for API flows
- [ ] Set up CI/CD pipeline

### 5.2 Security
- [x] RLS policies validated
- [x] Encryption tested
- [x] EXIF stripping verified
- [ ] Add rate limiting (CDN level)
- [ ] Security audit (external)
- [ ] Penetration testing

### 5.3 Features
- [ ] Implement revocation (add `is_revoked` column)
- [ ] Implement expiry enforcement (add `expires_at` column)
- [ ] Implement download control (add `allow_download` column)
- [ ] Add user dashboard
- [ ] Add analytics tracking

### 5.4 Documentation
- [x] Deviations and learnings documented
- [x] Best practices established
- [ ] API documentation
- [ ] Deployment guide
- [ ] User manual

---

## Part 6: Key Takeaways for MVP

### What Worked Well
1. **RLS + Edge Functions** - Robust security model
2. **Hybrid Testing** - Pragmatic for mobile apps
3. **Minimal Schema** - Implement features when needed
4. **Serverless Architecture** - Fast iteration, low overhead
5. **Code Review** - Caught issues early

### What to Improve
1. **Unit Test Coverage** - Add tests for crypto functions
2. **Type Safety** - Consider schema-generated types
3. **Rate Limiting** - Add before public launch
4. **Error Handling** - Plan error code migration
5. **Documentation** - Keep API contracts in sync

### What to Avoid
1. **Premature Optimization** - Don't create shared-types package yet
2. **Feature Creep** - Stick to MVP scope
3. **Security Shortcuts** - Never compromise on security
4. **Phantom Fields** - Only add columns when implementing features
5. **Magic Numbers** - Always use named constants

---

**Last Updated:** 2026-01-22  
**Status:** Ready for MVP Development  
**Next Review:** After MVP Launch
