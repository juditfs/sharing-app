# Phase 1 Code Review - Senior Engineer Feedback

## Overall Assessment: **GOOD with CRITICAL FIXES NEEDED** ⚠️

The infrastructure is well-architected with strong security fundamentals, but has several issues that must be addressed before production use.

---

## 🔴 CRITICAL Issues (Must Fix Before Deployment)

### 1. **Short Code Collision Handling** 
**File**: `supabase/functions/create-link/index.ts` (Line 72-84)

**Issue**: No handling for duplicate short codes. The 8-character random code has a collision probability that increases with scale.

**Current Code**:
```typescript
const shortCode = generateShortCode()
const { data: linkData, error: linkError } = await supabaseClient
    .from('shared_links')
    .insert({ short_code: shortCode, ... })
```

**Problem**: If `shortCode` already exists, the insert will fail with a unique constraint violation, but the error message won't be helpful.

**Fix**:
```typescript
// Add retry logic with max attempts
let shortCode: string
let attempts = 0
const MAX_ATTEMPTS = 5

while (attempts < MAX_ATTEMPTS) {
    shortCode = generateShortCode()
    
    // Check if code exists
    const { data: existing } = await supabaseClient
        .from('shared_links')
        .select('id')
        .eq('short_code', shortCode)
        .single()
    
    if (!existing) break
    attempts++
}

if (attempts === MAX_ATTEMPTS) {
    return new Response(
        JSON.stringify({ error: 'Failed to generate unique short code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
}
```

**Alternative**: Use longer codes (10-12 characters) or UUID-based short codes.

---

### 2. **Missing Rate Limiting**
**File**: `supabase/functions/get-link/index.ts`

**Issue**: No rate limiting on the `get-link` function, especially for the `action=key` endpoint. An attacker could enumerate short codes or repeatedly fetch keys.

**Risk**: 
- Brute force attacks to discover valid short codes
- Excessive key fetches for the same link
- DoS attacks

**Fix**: Add rate limiting using Supabase Edge Function's built-in capabilities or Upstash Redis:

```typescript
// At the top of get-link function
import { Ratelimit } from "https://esm.sh/@upstash/ratelimit@0.4.3"
import { Redis } from "https://esm.sh/@upstash/redis@1.20.1"

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "60 s"), // 10 requests per minute
})

// In the handler
const identifier = req.headers.get("x-forwarded-for") || "anonymous"
const { success } = await ratelimit.limit(identifier)

if (!success) {
  return new Response(
    JSON.stringify({ error: 'Rate limit exceeded' }),
    { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
```

**For Prototype**: At minimum, add a comment acknowledging this is missing and defer to MVP.

---

### 3. **Storage Path Extraction Vulnerability**
**File**: `supabase/functions/get-link/index.ts` (Line 165-168)

**Issue**: The `extractStoragePath()` function is too simplistic and could fail or be exploited.

**Current Code**:
```typescript
function extractStoragePath(url: string): string {
    const parts = url.split('/photos/')
    return parts[parts.length - 1]
}
```

**Problems**:
- Assumes URL always contains `/photos/`
- No validation of the extracted path
- Could return undefined if split fails
- Doesn't handle edge cases (empty string, malformed URLs)

**Fix**:
```typescript
function extractStoragePath(url: string): string {
    // Handle both full URLs and relative paths
    if (!url.includes('/photos/')) {
        // Assume it's already a storage path
        return url
    }
    
    const parts = url.split('/photos/')
    if (parts.length < 2) {
        throw new Error('Invalid storage URL format')
    }
    
    const path = parts[parts.length - 1]
    
    // Validate path format (should be user-id/filename)
    if (!path || path.trim() === '') {
        throw new Error('Empty storage path')
    }
    
    return path
}
```

---

## 🟡 MODERATE Issues (Should Fix Before MVP)

### 4. **Missing Input Validation**
**File**: `supabase/functions/create-link/index.ts` (Line 62-69)

**Issue**: Minimal validation of `photoUrl`, `thumbnailUrl`, and `encryptionKey`.

**Risks**:
- Invalid URLs stored in database
- Malformed encryption keys
- SQL injection (mitigated by parameterized queries, but still)

**Fix**:
```typescript
// Validate photoUrl format
if (!photoUrl.startsWith('http') && !photoUrl.includes('/')) {
    return new Response(
        JSON.stringify({ error: 'Invalid photoUrl format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
}

// Validate encryption key length (should be 64 hex chars for 32 bytes)
if (!/^[a-fA-F0-9]{64}$/.test(encryptionKey)) {
    return new Response(
        JSON.stringify({ error: 'Invalid encryption key format (expected 64 hex characters)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
}
```

---

### 5. **Hardcoded Share URL**
**File**: `supabase/functions/create-link/index.ts` (Line 113)

**Issue**: `http://localhost:3000` is hardcoded, won't work in production.

**Current Code**:
```typescript
const shareUrl = `http://localhost:3000/share/${shortCode}`
```

**Fix**:
```typescript
// Use environment variable with fallback
const baseUrl = Deno.env.get('VIEWER_BASE_URL') || 'http://localhost:3000'
const shareUrl = `${baseUrl}/share/${shortCode}`
```

**Add to `.env.example`**:
```env
# Edge Function Configuration
VIEWER_BASE_URL=https://sharene.app
```

---

### 6. **Incomplete Error Handling in Rollback**
**File**: `supabase/functions/create-link/index.ts` (Line 104-105)

**Issue**: Rollback operation doesn't check if deletion succeeded.

**Current Code**:
```typescript
await supabaseClient.from('shared_links').delete().eq('id', linkData.id)
```

**Fix**:
```typescript
const { error: deleteError } = await supabaseClient
    .from('shared_links')
    .delete()
    .eq('id', linkData.id)

if (deleteError) {
    console.error('CRITICAL: Failed to rollback link creation:', deleteError)
    // Log to monitoring service in production
}
```

---

### 7. **Missing Transaction Support**
**File**: `supabase/functions/create-link/index.ts`

**Issue**: Link creation and key storage are two separate operations. If the function crashes between them, you'll have orphaned links without keys.

**Risk**: Data inconsistency.

**Fix**: While Supabase doesn't support transactions in Edge Functions, you can use a database function:

```sql
-- Add to migration
CREATE OR REPLACE FUNCTION create_link_with_secret(
    p_user_id UUID,
    p_short_code TEXT,
    p_photo_url TEXT,
    p_thumbnail_url TEXT,
    p_encryption_key TEXT
) RETURNS TABLE (
    link_id UUID,
    short_code TEXT
) AS $$
DECLARE
    v_link_id UUID;
BEGIN
    INSERT INTO shared_links (user_id, short_code, photo_url, thumbnail_url)
    VALUES (p_user_id, p_short_code, p_photo_url, p_thumbnail_url)
    RETURNING id INTO v_link_id;
    
    INSERT INTO link_secrets (link_id, encryption_key)
    VALUES (v_link_id, p_encryption_key);
    
    RETURN QUERY SELECT v_link_id, p_short_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Then call from Edge Function:
```typescript
const { data, error } = await supabaseClient
    .rpc('create_link_with_secret', {
        p_user_id: user.id,
        p_short_code: shortCode,
        p_photo_url: photoUrl,
        p_thumbnail_url: thumbnailUrl || null,
        p_encryption_key: encryptionKey
    })
```

---

## 🟢 MINOR Issues (Nice to Have)

### 8. **Weak Short Code Randomness**
**File**: `supabase/functions/create-link/index.ts` (Line 138-149)

**Issue**: Using modulo bias in random generation.

**Current Code**:
```typescript
result += chars[randomValues[i] % chars.length]
```

**Problem**: Modulo operation introduces slight bias (some characters slightly more likely).

**Fix** (for cryptographic quality):
```typescript
function generateShortCode(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const length = 8
    const charsLength = chars.length
    const randomValues = new Uint8Array(length)
    
    let result = ''
    for (let i = 0; i < length; i++) {
        // Rejection sampling to avoid modulo bias
        let randomIndex
        do {
            crypto.getRandomValues(randomValues)
            randomIndex = randomValues[i]
        } while (randomIndex >= 256 - (256 % charsLength))
        
        result += chars[randomIndex % charsLength]
    }
    
    return result
}
```

**For Prototype**: Current implementation is acceptable. Fix for MVP.

---

### 9. **Missing Logging/Observability**
**Files**: All Edge Functions

**Issue**: Only `console.error` for errors. No structured logging or metrics.

**Recommendation**: Add structured logging:
```typescript
// At the top
const logger = {
    info: (msg: string, data?: any) => console.log(JSON.stringify({ level: 'info', msg, ...data })),
    error: (msg: string, error?: any) => console.error(JSON.stringify({ level: 'error', msg, error })),
}

// Usage
logger.info('Link created', { shortCode, userId: user.id })
logger.error('Failed to create link', { error: linkError, userId: user.id })
```

---

### 10. **Database Schema: Missing Constraints**
**File**: `supabase/migrations/20260119_initial_schema.sql`

**Issue**: No check constraints on data format.

**Recommendations**:
```sql
-- Add constraints
ALTER TABLE shared_links 
ADD CONSTRAINT short_code_format CHECK (short_code ~ '^[a-zA-Z0-9]{8}$');

ALTER TABLE link_secrets
ADD CONSTRAINT encryption_key_format CHECK (encryption_key ~ '^[a-fA-F0-9]{64}$');
```

---

### 11. **TypeScript: Missing Strict Null Checks**
**Files**: All Edge Functions

**Issue**: Using `??` and optional chaining, but not enforcing strict null checks.

**Recommendation**: Add `deno.json` or `tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true
  }
}
```

---

### 12. **Documentation: Missing API Contracts**
**File**: `supabase/README.md`

**Issue**: No formal API documentation for Edge Functions.

**Recommendation**: Add OpenAPI/Swagger spec or at least document request/response schemas:

```markdown
## Edge Function API Reference

### POST /create-link

**Request**:
```json
{
  "photoUrl": "string (required) - Storage path to encrypted photo",
  "thumbnailUrl": "string (optional) - Storage path to encrypted thumbnail",
  "encryptionKey": "string (required) - 64 hex characters (32 bytes)"
}
```

**Response** (200):
```json
{
  "shortCode": "string - 8 character code",
  "shareUrl": "string - Full viewer URL"
}
```
```

---

## ✅ What's Done Well

1. **Security-First Design**: RLS policies are excellent, especially the complete lockdown of `link_secrets`
2. **Key Separation**: Splitting metadata and key retrieval is smart
3. **Rollback Logic**: Good attempt at handling partial failures
4. **CORS Handling**: Proper preflight support
5. **TypeScript Types**: Good use of interfaces for request/response
6. **Storage Privacy**: Signed URLs with 60s expiry is appropriate
7. **Code Organization**: Clean separation of concerns
8. **Comments**: Good inline documentation

---

## 📊 Priority Recommendations

### Before Deployment:
1. ✅ Fix short code collision handling (CRITICAL)
2. ✅ Add basic rate limiting or document as known limitation (CRITICAL)
3. ✅ Fix `extractStoragePath()` validation (CRITICAL)
4. ✅ Add environment variable for `VIEWER_BASE_URL` (MODERATE)
5. ✅ Add encryption key validation (MODERATE)

### Before MVP:
6. Implement transaction-safe link creation
7. Add structured logging
8. Add database constraints
9. Improve error handling in rollback
10. Add API documentation

### Nice to Have:
11. Fix modulo bias in random generation
12. Add TypeScript strict mode
13. Add monitoring/alerting

---

## Final Verdict

**Status**: ✅ **APPROVED with CONDITIONS**

The code demonstrates solid understanding of security principles and Supabase architecture. The RLS policies are excellent, and the key separation pattern is exactly right.

However, the **short code collision handling** and **rate limiting** issues must be addressed before any real-world use. The storage path extraction bug could cause runtime failures.

**Recommendation**: 
- Fix the 3 CRITICAL issues before deploying to Supabase cloud
- Document rate limiting as a known limitation for the prototype
- Address MODERATE issues before moving to Phase 2

**Estimated time to fix critical issues**: 1-2 hours

Great work overall! The foundation is solid. 🎉
