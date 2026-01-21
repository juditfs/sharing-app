# Sharene MVP: Deviations & Learnings

This document captures the key architectural decisions, plan deviations, and technical learnings from the MVP implementation phase.

## 1. Deviations from Original Plan

### 1.1 Expiry Defaults
- **Plan:** "Never" expires by default.
- **Implementation:** Default expiry set to **1 Week**.
- **Reason:** Aligns better with "Privacy First" philosophy. Users can still explicitly select longer durations, but the safe default prevents accumulation of stale shared content.

### 1.2 Testing Strategy
- **Plan:** Full automated E2E testing including UI.
- **Implementation:** Hybrid approach.
  - **Automated:** API, Security (RLS), and Environment validation.
  - **Manual:** Mobile UI, Share Sheet, and Visual verification.
- **Reason:** Mobile simulator limitations (specifically for Share Extensions) and the high cost of maintaining fragile UI tests for an MVP.

### 1.3 Thumbnail Handling
- **Plan:** Encrypted thumbnails everywhere.
- **Adaptation:** Explicit support for "Public Preview" logic where required by platform constraints (e.g., specific messaging apps), though MVP defaults to privacy. The `cleanup-expired` function was enhanced to aggressively clean up both private and public assets.

## 2. Technical Learnings

### 2.1 Security Model (RLS + Edge Functions)
The decision to store encryption keys in a distinct `link_secrets` table protected by RLS proved robust.
- **Verification:** Automated tests confirmed that `link_secrets` returns 0 rows to any client (anon or authenticated).
- **Access:** Only Edge Functions using the `service_role` key can bridge this gap, creating a secure "airlock" for key retrieval.

### 2.2 EXIF Data Stripping
- **Finding:** Client-side EXIF stripping is reliable but requires careful verification.
- **Tooling:** `exiftool` is indispensable for verifying that stripping actually works. Visual inspection is insufficient.
- **Impact:** We successfully remove GPS and Camera metadata before the encrypted blob ever leaves the device.

### 2.3 Cross-Platform Crypto
- **Challenge:** Consistent encryption between React Native (Mobile) and Web Crypto API (Viewer).
- **Solution:** Standardized on AES-256-GCM. The mobile app uses `react-native-quick-crypto` (faster, feature-complete) which outputs a format compatible with the browser's native `SubtleCrypto`.

## 3. Known Limitations (MVP)

1.  **Share Sheet on Simulator:**
    - Testing the iOS Share Extension fully requires a physical device. Simulator behavior for sharing files from Photos/Safari can be inconsistent.

2.  **Download on iOS:**
    - The Web Viewer's "Download" button behavior is browser-dependent on iOS. Safari opens the blob; users must manually "Save to Files".

3.  **Single-Device Key Management:**
    - Currently, keys are stored in the database. End-to-End Encryption (where the key is *only* in the URL) is a Post-MVP feature.

4.  **Analytics Precision:**
    - View counts are approximate. We intentionally trade precision for privacy (avoiding invasive tracking pixels).
