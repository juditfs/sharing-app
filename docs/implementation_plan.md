# ShareSafe MVP Implementation Plan

A controlled photo sharing app for privacy-conscious parents to share photos via time-limited, revocable links through existing messaging apps.

## User Review Required

> [!IMPORTANT]
> **Device Fingerprinting Options** (Post-MVP Feature)
> 
> For the device-based access limits feature, here are the recommended approaches:
> 
> **Option 1: Browser Fingerprinting (Recommended for MVP+)**
> - **How**: Combine User-Agent, screen resolution, timezone, language, and canvas fingerprinting
> - **Pros**: No user action required, works immediately
> - **Cons**: 
>   - Can be bypassed by changing browsers or using incognito mode
>   - Privacy concerns (though we're already privacy-focused)
>   - ~85-90% accuracy for unique device identification
> - **Libraries**: FingerprintJS, ClientJS
> 
> **Option 2: Cookie-Based Device Tracking**
> - **How**: Set a unique cookie on first access, count unique cookies
> - **Pros**: Simple, reliable for normal users
> - **Cons**: 
>   - Easily bypassed by clearing cookies or using incognito
>   - Doesn't work across browsers on same device
> - **Best for**: Casual prevention, not strict enforcement
> 
> **Option 3: Hybrid Approach (Recommended)**
> - **How**: Combine fingerprinting + cookie + IP address (with grace period)
> - **Pros**: More robust, harder to bypass accidentally
> - **Cons**: More complex, potential false positives (family on same WiFi)
> - **Implementation**: Count a "new device" only if 2+ signals differ
> 
> **Option 4: Require Recipient Authentication**
> - **How**: Recipients create accounts, track by user ID
> - **Pros**: Most accurate, enables additional features
> - **Cons**: **Violates core product principle** - no recipient friction
> - **Verdict**: ❌ Not recommended
> 
> **Recommendation**: Start with **Option 2** (cookie-based) for post-MVP, then upgrade to **Option 3** (hybrid) if needed. This balances simplicity with effectiveness while acknowledging that determined users can bypass any client-side limit.

> [!WARNING]
> **Default Expiry Changed from PRD**
> 
> The PRD specified "never" as the default expiry (line 275), but per user clarification, the default will be **1 week**. This better aligns with the product's privacy-first positioning.

> [!IMPORTANT]
> [!IMPORTANT]
> **Encryption Strategy Clarification**
> 
> **MVP: Client-Side Encrypted**
> All photos are encrypted on the device before upload using AES-256. 
> **Encryption keys** are stored in a dedicated `link_secrets` table that is **completely inaccessible** to client applications via Row Level Security.
> - Access is restricted to **Edge Functions** using Supabase's Service Role key.
> - Keys rely on Supabase's managed **database-at-rest encryption** and strict access controls.
> - No additional application-layer encryption of keys is performed in the MVP.
> 
> **Post-MVP: Advanced Privacy Mode (End-to-End Encrypted)**
> A future update will support embedding keys in URL fragments (e.g., `#key=...`). This achieves true **Zero-Knowledge / End-to-End Encryption**, where the server never sees the key.

## MVP Scope

### **MVP Features (Initial Release)**

**Core Functionality:**
- ✅ Photo sharing via controlled links
- ✅ Image size reduction (max 2048px, ~80% quality)
- ✅ Time-limited access (1 hour, 1 day, 1 week [default], 1 month, 1 year, custom)
- ✅ **Thumbnail Privacy Options**: Default is encrypted (generic placeholder in WhatsApp). Encrypted thumbnails are still generated for the **Sender's Dashboard** and **Faster Web Viewer Loading**. Users can opt-in to **Public Preview**, which uploads a separate **unencrypted** thumbnail for WhatsApp to display. This is **not** end-to-end encrypted.
- ✅ Manual link revocation
- ✅ Download control (allow/disallow)
- ✅ EXIF metadata stripping
- ✅ Client-side AES-256 encryption

**Authentication:**
- ✅ Apple Sign-In only

**User Experience:**
- ✅ Mobile app (iOS & Android via React Native + Expo)
- ✅ Web viewer for recipients (no signup required)
- ✅ Link dashboard (active/revoked/expired tabs)
- ✅ Basic analytics (approximate view count, access history)

**Technical:**
- ✅ React Native Paper UI components
- ✅ **Serverless Architecture** (Supabase Edge Functions)
- ✅ Supabase (PostgreSQL + Auth + Storage)
- ✅ Encryption keys stored in database
- ✅ HTTPS/TLS for all communication

### **Post-MVP Features (Future Enhancements)**

**Advanced Privacy:**
- ⏳ Device-based access limits (with cookie/fingerprint tracking)
- ⏳ URL fragment encryption keys (**Advanced Privacy Mode** / End-to-End)
- ⏳ Screenshot detection warnings (native apps only)

**Additional Authentication:**
- ⏳ Google Sign-In
- ⏳ Email/Password authentication

**Enhanced Features:**
- ⏳ Family rules setup and enforcement
- ⏳ Sharing groups with custom defaults
- ⏳ Context tracking (recently shared with)
- ⏳ Deep linking to messaging apps
- ⏳ Detailed device analytics (device type, time)
- ⏳ Push notifications for link access

**Shared Rules Enhancements:**
- ⏳ Rule templates with gentle enforcement
- ⏳ Family-level vs link-level rules
- ⏳ Recipient onboarding with rule acceptance

---

## Proposed Changes

### Technology Stack

**Mobile Apps (iOS & Android)**
- **Framework**: React Native with Expo
- **Why**: Single codebase, excellent share sheet integration, fast development
- **Key Libraries**:
  - `react-native-paper` (UI)
  - `expo-image-manipulator` (Client-side compression & EXIF stripping)
  - `react-native-quick-crypto` (High-performance encryption)

**Backend & Data (Serverless)**
- **Platform**: **Supabase** (Direct from client)
- **Database**: PostgreSQL with Row Level Security (RLS)
- **Auth**: Supabase Auth (Apple Sign-In)
- **Logic**: **Supabase Edge Functions** (Deno/TypeScript) for:
  - Complex validations
  - Link revocation logic
  - Cron jobs (expiration)
- **Storage**: Supabase Storage (S3-backed)

**Recipient Viewer**
- **Framework**: Next.js (Static Export `output: 'export'`)
- **Hosting**: Vercel / Netlify / Cloudflare Pages
- **Why**: Cheap, fast, separate from app infrastructure


---

### Component Reusability Strategy

**Strategy: React Native Paper Foundation**
For MVP, we will prioritize development speed by using **React Native Paper directly** on all platforms. We will rely on **Platform-Aware Theming** to ensure it feels native enough on iOS without maintaining a complex abstraction layer.

#### **UI Library Approach**
- **All Platforms**: React Native Paper (Material Design 3)
- **Adaptation**: Use theme overrides for fonts and colors.

#### **Theme Configuration** (`/packages/shared-components/theme`)
We use `Platform.select` in the theme to handle the biggest "feel" differences (Fonts, Colors, Roundness) without custom components.

```typescript
import { Platform } from 'react-native';
import { MD3LightTheme, configureFonts } from 'react-native-paper';

const fontConfig = {
  // Use San Francisco on iOS, Inter on Android
  fontFamily: Platform.select({
    ios: 'System',
    default: 'Inter, sans-serif',
  }),
};

export const theme = {
  ...MD3LightTheme,
  fonts: configureFonts({ config: fontConfig }),
  colors: {
    ...MD3LightTheme.colors,
    // iOS Blue vs Brand Indigo
    primary: Platform.select({ ios: '#007AFF', default: '#6366F1' }),
    // iOS uses lighter backgrounds
    background: Platform.select({ ios: '#F2F2F7', default: '#FFFFFF' }),
    surface: Platform.select({ ios: '#FFFFFF', default: '#F9FAFB' }),
  },
  // Tighter corners on iOS
  roundness: Platform.select({ ios: 10, default: 20 }),
};
```

#### **Shared Business Components** (`/packages/shared-components`)

Custom components built with React Native Paper:

```typescript
// shared-components/LinkCard/LinkCard.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, Badge } from 'react-native-paper';
import { formatExpiry } from '@sharesafe/shared-utils';

export interface LinkCardProps {
  title: string;
  expiresAt: Date | null;
  viewCount: number;
  thumbnailUrl?: string;
  status: 'active' | 'expired' | 'revoked';
  onPress: () => void;
}

export const LinkCard: React.FC<LinkCardProps> = ({
  title,
  expiresAt,
  viewCount,
  thumbnailUrl,
  status,
  onPress,
}) => {
  return (
    <Card style={styles.card} onPress={onPress}>
      {thumbnailUrl && (
        <Card.Cover source={{ uri: thumbnailUrl }} />
      )}
      <Card.Content style={styles.content}>
        <View style={styles.header}>
          <Text variant="titleMedium" numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          <Badge
            style={[
              styles.badge,
              status === 'active' ? styles.badgeActive : styles.badgeInactive,
            ]}
          >
            {status}
          </Badge>
        </View>
        <Text variant="bodySmall" style={styles.meta}>
          {viewCount} views • {expiresAt ? formatExpiry(expiresAt) : 'Never expires'}
        </Text>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  content: {
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    flex: 1,
  },
  badge: {
    marginLeft: 8,
  },
  badgeActive: {
    backgroundColor: '#10B981',
  },
  badgeInactive: {
    backgroundColor: '#6B7280',
  },
  meta: {
    color: '#6B7280',
  },
});
```

**Other Shared Components:**
- `ExpirySelector` - Dropdown for expiration time

- `PhotoViewer` - Photo display with controls
- `EmptyState` - Empty state illustrations
- `ErrorMessage` - Error display

#### **Shared Types** (`/packages/shared-types`)

```typescript
// types/Link.ts
export interface SharedLink {
  id: string;
  shortCode: string;
  photoUrl: string;
  thumbnailUrl?: string;
  expiresAt: Date | null;
  isRevoked: boolean;
  allowDownload: boolean;
  shareText: string;
  viewCount: number;
  status: 'active' | 'expired' | 'revoked';
  createdAt: Date;
}



// types/api.ts
export interface CreateLinkResponse {
  link: SharedLink;
  shareUrl: string;
}
```

#### **Shared Utilities** (`/packages/shared-utils`)

```typescript
// utils/formatters.ts
export const formatExpiry = (expiresAt: Date): string => {
  const now = new Date();
  const diff = expiresAt.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days > 1) return `${days} days left`;
  if (days === 1) return '1 day left';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours > 0) return `${hours} hours left`;
  return 'Expires soon';
};

// utils/api-client.ts
export class ShareSafeAPI {
  private baseUrl: string;
  
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }
  
  async createLink(photo: Blob, settings: LinkSettings): Promise<CreateLinkResponse> {
    // Shared API logic
  }
  
  async getLinks(filter?: 'active' | 'expired' | 'revoked'): Promise<SharedLink[]> {
    // Shared API logic
  }
}
```

#### **Usage in Applications**

**Mobile App:**
```typescript
// mobile/App.tsx
import { PaperProvider } from 'react-native-paper';
import { theme } from '@sharesafe/shared-components/theme';

export default function App() {
  return (
    <PaperProvider theme={theme}>
      <Navigation />
    </PaperProvider>
  );
}

// mobile/screens/DashboardScreen.tsx
import { LinkCard } from '@sharesafe/shared-components';
import { Button } from 'react-native-paper';

export const DashboardScreen = () => {
  return (
    <ScrollView>
      {links.map(link => (
        <LinkCard
          key={link.id}
          {...link}
          onPress={() => navigation.navigate('LinkDetail', { id: link.id })}
        />
      ))}
      <Button mode="contained" onPress={handleCreateLink}>
        Create New Link
      </Button>
    </ScrollView>
  );
};
```

**Web Viewer:**
```typescript
// viewer/pages/_app.tsx
import { PaperProvider } from 'react-native-paper';
import { theme } from '@sharesafe/shared-components/theme';

export default function App({ Component, pageProps }) {
  return (
    <PaperProvider theme={theme}>
      <Component {...pageProps} />
    </PaperProvider>
  );
}

// viewer/pages/[shortCode].tsx
import { Button, Card, Text } from 'react-native-paper';

export default function ViewerPage({ link }) {
  return (
    <Card>
      <Card.Cover source={{ uri: link.photoUrl }} />
      <Card.Content>
        <Text variant="bodyMedium">{link.shareText}</Text>
      </Card.Content>
      {link.allowDownload && (
        <Card.Actions>
          <Button onPress={handleDownload}>Download</Button>
        </Card.Actions>
      )}
    </Card>
  );
}
```

#### **Benefits of This Approach**

✅ **Fast MVP development** - Pre-built components accelerate development  
✅ **Consistent UI** - Material Design across mobile and web  
✅ **Built-in accessibility** - Paper handles screen readers, focus management  
✅ **Cross-platform** - Works with React Native Web for viewer  
✅ **Shared business logic** - Custom components for ShareSafe-specific features  
✅ **Easy theming** - Customize colors and styles via theme object  
✅ **Type-safe** - Full TypeScript support  
✅ **Well-documented** - Extensive React Native Paper documentation

#### **Monorepo Setup**

```json
// package.json (root)
{
  "name": "sharesafe-monorepo",
  "private": true,
  "workspaces": [
    "packages/*",
    "mobile",
    "viewer",
    "backend"
  ]
}

// packages/shared-components/package.json
{
  "name": "@sharesafe/shared-components",
  "version": "1.0.0",
  "peerDependencies": {
    "react": "^18.0.0",
    "react-native": "^0.72.0",
    "react-native-paper": "^5.11.0"
  }
}
```

#### **Metro Configuration**

Since this is a monorepo, we must configure Metro to resolve dependencies correctly from the root `node_modules` and watch the shared packages.

```javascript
// metro.config.js (root)
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Only add this if Metro still fails to resolve workspace packages
// config.resolver.extraNodeModules = {};

module.exports = config;
```

---

### Architecture Overview
 
 ```mermaid
 graph TB
     subgraph "Mobile App (React Native)"
         A[Photo Selection]
         B[Client-Side Processing]
         B1[Strip EXIF / Resize]
         B2[Encrypt (AES-256)]
         C[Upload to Supabase]
         D[Link Creation]
     end
     
     subgraph "Supabase Platform"
         I[(PostgreSQL + RLS)]
         J[Storage Bucket (Private)]
         K[Auth Provider]
         L[Edge Functions]
         L1[Cron: Cleanup]
         L2[Gateway: Get Link]
     end
     
     subgraph "Recipient Experience"
         M[Web Viewer (Next.js Static)]
         N[Client-Side Decryption]
     end
     
     A --> B
     B --> B1
     B1 --> B2
     B2 --> C
     C --> J
     D --> I
     
     M --> L2
     L2 --> I
     L2 --> J
     M --> N
     
     L1 --> I
     L1 --> J
 ```


```text
                             +------------------------+
                             |   Recipient (Browser)  |
                             +-----------+------------+
                                         |
+----------------------+                 | 1. Request Link Metadata
|   Sender (Mobile)    |                 v
+----------+-----------+      +-----------------------+
           |                  | Edge Function Gateway |
           |                  |      (get-link)       |
           |                  +-----------+-----------+
 1. Encrypt| (Client-side)                |
           |                              | 2. Validate & Sign URL
           v                              | 3. Log Access (Hashed IP)
+----------------------+                  |
| Supabase Storage     | <----------------+
| (Private Bucket)     |                  |
+----------+-----------+                  | 4. Return Metadata + Signed URL
           ^                              v
           |                  +-----------------------+
           +----------------- |   Recipient (Browser) |
        5. Download Blob      +-----------+-----------+
                                          |
           +----------------------+       | 6. Request Key (Delayed)
           | Supabase Database    | <-----+
           | (Postgres + RLS)     |
           +----------------------+
             - shared_links
             - link_secrets (Key)
             - access_logs

7. Decrypt & Render (Client-side)
```

---

### Database Schema

#### **users**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  apple_id TEXT UNIQUE,
  display_name TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```



#### **shared_links**
```sql
CREATE TABLE shared_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  short_code TEXT UNIQUE NOT NULL, -- e.g., "abc123" for sharesafe.app/abc123
  
  -- Photo data
  photo_url TEXT NOT NULL, -- Storage URL
  thumbnail_url TEXT, -- Optional preview thumbnail
  original_filename TEXT,
  
  -- Access controls
  expires_at TIMESTAMP, -- NULL = never expires
  is_revoked BOOLEAN DEFAULT false,
  allow_download BOOLEAN DEFAULT false,
  device_limit INTEGER, -- NULL = unlimited (post-MVP)
  
  -- Metadata
  share_text TEXT DEFAULT 'shared a photo',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Analytics (Best Effort)
  view_count INTEGER DEFAULT 0, -- Approximate count (not concurrency safe)
  last_accessed_at TIMESTAMP
);

-- 🔐 KEY STORAGE (STRICT SECURITY)
-- Separate table to prevent accidental exposure via SELECT *
CREATE TABLE link_secrets (
  link_id UUID PRIMARY KEY REFERENCES shared_links(id) ON DELETE CASCADE,
  encryption_key TEXT NOT NULL, -- Stored here, accessible ONLY by Server/Edge Functions
  created_at TIMESTAMP DEFAULT NOW()
);
```



#### **access_logs**
```sql
CREATE TABLE access_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  link_id UUID REFERENCES shared_links(id) ON DELETE CASCADE,
  
  -- Device tracking (post-MVP)
  device_fingerprint TEXT,
  user_agent TEXT,
  ip_hash TEXT, -- SHA-256 hash of IP + Daily Salt (No raw IP stored)
  
  -- Event data
  accessed_at TIMESTAMP DEFAULT NOW(),
  action TEXT -- 'view', 'download', 'blocked'
);
```

---

### Component Breakdown

#### **Database & Security** (`/supabase`)

##### **Row Level Security (RLS) Policies**

**`shared_links` Policies:**
1.  **INSERT/UPDATE/SELECT (Owner)**: Authenticated users can access their own rows (`user_id = auth.uid()`).
2.  **Public Access**: **DISABLED**. No public `SELECT` allowed.

**`link_secrets` Policies (CRITICAL):**
1.  **ALL OPERATIONS**: **DISABLED** for standard users (Owner & Public).
    -   `CREATE POLICY no_direct_access ON link_secrets FOR ALL USING (false);`
    -   Keys are **strictly accessible** only via Edge Functions (Service Role).

> **CRITICAL SECURITY NOTE**: 
> - **Service Role Keys** must ONLY exist in Supabase Edge Function Secrets. 
> - **NEVER** bundle Service Role keys in the Mobile App or Client Code.
> - **Shared Links Public Access**: Explicitly disabled. All access must flow through the `get-link` Edge Function.

**`storage` Policies:**
1.  **UPLOAD/DELETE (Owner)**: Authenticated users can access `/{uid}/*`.
2.  **DOWNLOAD**: **DISABLED**. Storage is **Private**. Access is only granted via Signed URLs generated by Edge Functions.

##### **Edge Functions** (`/supabase/functions`)

**1. `get-link` (Recipient Gateway)**
- **Role**: Secure Gatekeeper for public access.
- **Input**: `shortCode`, `action` ('metadata' | 'key')
- **Logic**:
  1.  **Validate**: Check `shared_links` (Service Role) for expiry/revocation.
  2.  **Action 'metadata'**:
      -   Generate **Signed URL** (valid for **60 seconds**).
      -   Return `{ signedUrl, metadata }`.
  3.  **Action 'key'**:
      -   Fetch key from `link_secrets` (Service Role).
      -   Return `{ key }`.
  4.  **Security Note**: Splitting these responses prevents a single intercepted payload from compromising the photo.

**2. `create-link` (Sender Gateway)**
- **Role**: Securely create link and save key (bypassing RLS "No Direct Access").
- **Input**: `photoUrl`, `encryptedKey` (hex/base64), `iv`, `authTag`.
- **Logic**:
  1.  **Auth Check**: Verify user is authenticated.
  2.  **Insert**: Add row to `shared_links`.
  3.  **Insert Key**: Add row to `link_secrets` (via Service Role).
  4.  **Return**: `{ shortCode, linkId }`.

**3. `process-expiration` (Scheduled Cron)**
- Runs every hour.
- Deletes files from Storage for expired links.
- Updates `status` in database.

---

#### **Backend Logic (Supabase)**

##### [NEW] [supabase/migrations/001_initial_schema.sql](file:///Users/ju/Documents/Projects/2026/sharing-app/supabase/migrations/001_initial_schema.sql)
- Initial DDL for `users`, `shared_links`.
- Enable RLS on all tables.

##### [NEW] [supabase/migrations/002_security_policies.sql](file:///Users/ju/Documents/Projects/2026/sharing-app/supabase/migrations/002_security_policies.sql)

```sql
-- =========================================
-- Enable Row Level Security
-- =========================================
ALTER TABLE shared_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;

-- =========================================
-- shared_links: Owner-Only Access
-- =========================================
-- Owner can insert/select/update/delete their own links
CREATE POLICY "shared_links_insert_own" ON shared_links FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "shared_links_select_own" ON shared_links FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "shared_links_update_own" ON shared_links FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "shared_links_delete_own" ON shared_links FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Explicitly deny all anon access (defensive)
CREATE POLICY "shared_links_deny_anon" ON shared_links FOR ALL TO anon USING (false);

-- =========================================
-- link_secrets: NO CLIENT ACCESS
-- =========================================
-- Deny all RLS-governed access. Service Role bypasses this.
CREATE POLICY "link_secrets_deny_all" ON link_secrets FOR ALL USING (false);

-- =========================================
-- access_logs: Read Own, Write via Functions
-- =========================================
-- Owners can view access logs for their own links
CREATE POLICY "access_logs_select_owner" ON access_logs FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM shared_links
    WHERE shared_links.id = access_logs.link_id AND shared_links.user_id = auth.uid()
  )
);
-- Deny all client-side writes (Edge Functions write via Service Role)
CREATE POLICY "access_logs_deny_client_writes" ON access_logs FOR INSERT, UPDATE, DELETE TO authenticated, anon USING (false);

-- =========================================
-- Storage: Private Bucket
-- =========================================
-- Users can upload/delete files in their own folder
CREATE POLICY "storage_upload_own_files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "storage_delete_own_files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Explicitly deny ALL reads (public + authenticated). Access via Signed URLs only.
CREATE POLICY "storage_deny_all_reads" ON storage.objects FOR SELECT TO anon, authenticated USING (false);
```

```typescript
import { createHash } from 'node:crypto';
// import { serve } ...

// 1. In-Memory Rate Limiter (Max 60 req/min per IP)
const requestCounts = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  // ... (User provided implementation) ...
}

// 2. IP Anonymization (Daily Salt)
function hashIP(ip: string): string {
  // ... (SHA-256 + Daily Salt implementation) ...
}

// Main Handler Logic
// Input: { shortCode, action: 'metadata' | 'key' }
// 1. Check Rate Limit
// 2. Validate Link (DB Query) -> Check Expiry/Revocation
// 3. Log Access (access_logs) -> Store ip_hash
// 4. Increment View Count (shared_links)
//    - UPDATE shared_links SET view_count = view_count + 1 WHERE id = ...
//    - Note: This is an atomic increment but still best-effort under high concurrency.

// 5. Handle Action:
//    - If action === 'metadata':
//        Generate Signed URL (60 seconds)
//        Return { signedUrl, metadata }
//    - If action === 'key':
//        6. Anti-Abuse Check:
//           - Enforce strict rate limit for KEY fetches per shortCode (e.g., 5/hour).
//           - Maintain counter in DB or KV limit.
//        Fetch Key from link_secrets (Service Role)
//        Return { key }
```

##### [NEW] [supabase/functions/cleanup-expired/index.ts](file:///Users/ju/Documents/Projects/2026/sharing-app/supabase/functions/cleanup-expired/index.ts)
- **Cron Job**: Runs every hour.
- **Logic**:
  1. Find rows where `expires_at < NOW()` OR `is_revoked = true` (and status != 'deleted').
  2. **Storage Cleanup**:
     - Delete encrypted original: `photos/{uuid}`.
     - Delete **public thumbnail**: `thumbnails/{uuid}`.
  3. **DB Update**: Set status to 'deleted', clear sensitive fields.
  4. **Security**: Ensures no "zombie" public thumbnails persist after revocation.

---

##### **Edge Function Responsibility Separation**
Although link viewing is handled by a single `get-link` Edge Function, internal responsibilities are explicitly separated into validation, access logging, key retrieval, and URL generation steps.
- **Critical Path**: Only validation and content retrieval are blocking operations.
- **Best-Effort**: Logging and analytics are non-blocking where possible.
- **Idempotency**: All steps are designed to safely handle retries.

---

#### **Mobile App** (`/mobile`)

##### [NEW] [App.tsx](file:///Users/ju/Documents/Projects/2026/sharing-app/mobile/App.tsx)
Root component with navigation setup and auth context.

##### [NEW] [navigation/AppNavigator.tsx](file:///Users/ju/Documents/Projects/2026/sharing-app/mobile/navigation/AppNavigator.tsx)
Stack navigator: Onboarding → Auth → Main App (Tabs)

##### [NEW] [screens/OnboardingScreen.tsx](file:///Users/ju/Documents/Projects/2026/sharing-app/mobile/screens/OnboardingScreen.tsx)
Welcome screen with value proposition and visual examples.

##### [NEW] [screens/AuthScreen.tsx](file:///Users/ju/Documents/Projects/2026/sharing-app/mobile/screens/AuthScreen.tsx)
Apple Sign-In button and terms acceptance.



##### [NEW] [screens/HomeScreen.tsx](file:///Users/ju/Documents/Projects/2026/sharing-app/mobile/screens/HomeScreen.tsx)
Main screen with "Share Photo" button and empty state.

##### [NEW] [screens/PhotoSelectionScreen.tsx](file:///Users/ju/Documents/Projects/2026/sharing-app/mobile/screens/PhotoSelectionScreen.tsx)
Photo picker using `expo-image-picker`.

##### [NEW] [screens/LinkCreationScreen.tsx](file:///Users/ju/Documents/Projects/2026/sharing-app/mobile/screens/LinkCreationScreen.tsx)
Configure link settings:
- **Preview thumbnail toggle** (Off = Secure Placeholder, On = Public Thumbnail for WhatsApp)
  - *UI Warning*: "Public thumbnails are shared with messaging apps and may be cached on their servers even after you delete the link."
- Share text input
- Expiry dropdown (1 hour, 1 day, 1 week [default], 1 month, 1 year, custom)
- Download toggle
- Donwload toggle
- Actions: Copy Link, Share (opens system share sheet)

##### [NEW] [screens/DashboardScreen.tsx](file:///Users/ju/Documents/Projects/2026/sharing-app/mobile/screens/DashboardScreen.tsx)
Tabs for Active / Revoked / Expired links with list view.

##### [NEW] [screens/LinkDetailScreen.tsx](file:///Users/ju/Documents/Projects/2026/sharing-app/mobile/screens/LinkDetailScreen.tsx)
Show link analytics:
- View count
- Time remaining
- Access history
- Actions: Extend, Modify, Copy, Share, Revoke, Delete

##### [NEW] [screens/SettingsScreen.tsx](file:///Users/ju/Documents/Projects/2026/sharing-app/mobile/screens/SettingsScreen.tsx)
- Default link settings

- Account settings

##### [NEW] [components/LinkCard.tsx](file:///Users/ju/Documents/Projects/2026/sharing-app/mobile/components/LinkCard.tsx)
Reusable link preview card for dashboard.

##### [NEW] [services/api.ts](file:///Users/ju/Documents/Projects/2026/sharing-app/mobile/services/api.ts)
API client for backend communication.

##### [NEW] [services/shareSheet.ts](file:///Users/ju/Documents/Projects/2026/sharing-app/mobile/services/shareSheet.ts)
Handle system share sheet integration (receive photos from other apps).

##### [NEW] [context/AuthContext.tsx](file:///Users/ju/Documents/Projects/2026/sharing-app/mobile/context/AuthContext.tsx)
Global auth state management.

---

#### **Recipient Web Viewer** (`/viewer`)

##### [NEW] [pages/[shortCode].tsx](file:///Users/ju/Documents/Projects/2026/sharing-app/viewer/pages/%5BshortCode%5D.tsx)
Dynamic route for viewing shared photos:
1. Validate link (exists, not expired, not revoked, device limit check)
4. Display photo in clean viewer
5. Download button (if enabled)
6. Error states (expired, revoked, limit reached)

##### [NEW] [components/PhotoViewer.tsx](file:///Users/ju/Documents/Projects/2026/sharing-app/viewer/components/PhotoViewer.tsx)
Responsive photo display component.



##### [NEW] [components/ErrorScreen.tsx](file:///Users/ju/Documents/Projects/2026/sharing-app/viewer/components/ErrorScreen.tsx)
Friendly error messages for invalid links.

##### [NEW] [utils/deviceFingerprint.ts](file:///Users/ju/Documents/Projects/2026/sharing-app/viewer/utils/deviceFingerprint.ts)
Generate device fingerprint (post-MVP, placeholder for now).

---

### Key Implementation Details

#### **Photo Upload Flow (Client-Side Only)**
1.  **Select**: User picks photo in mobile app.
2.  **Process (Client-Side)**:
    -   Use `expo-image-manipulator` to:
        -   Strip EXIF metadata.
        -   Resize to max 2048px (reduce file size).
        -   Compress to ~80% quality.
    -   **Result**: Raw `Uint8Array` of the optimized image.
3.  **Encrypt (Client-Side)**:
    -   Generate unique 32-byte key.
    -   Encrypt `Uint8Array` using **AES-256-GCM**.
    -   Result: Encrypted Payload (`Version + IV + Tag + Ciphertext`).
4.  **Upload**:
    -   Request Signed URL from Supabase (for `storage/{uid}/{uuid}`).
    -   Upload **Encrypted Payload** directly to Supabase Storage.
    -   (Optional) Repeat for Thumbnail (if "Public Preview" logic is active).
5.  **Create Link**:
    -   Insert record into `shared_links` via Supabase SDK.
    -   Call Edge Function (or Insert) to store Key in `link_secrets` securely.
6.  **Share**:
    -   Generate short URL.
    -   Show system share sheet.
9. App copies link to clipboard and shows share options

#### **Link Validation Flow (Recipient)**
1. Recipient clicks link in messaging app
2. Browser loads `/view/:shortCode`
3. Backend checks:
   - Link exists?
   - `is_revoked = false`?
   - `expires_at > NOW()` or `NULL`?
   - Device limit not exceeded? (post-MVP)
4. If valid: Return photo URL, rules, settings
5. If invalid: Return error type (expired/revoked/not found)
6. Log access event in `access_logs`
7. Increment `view_count`

#### **Expiration Handling**
- **Cron job** (or Supabase Edge Function) runs every hour
- Query links where `expires_at < NOW() AND is_revoked = false`
- For each expired link:
  - Delete photo and thumbnail from storage
  - Keep database record for history (don't delete)
- Frontend shows "Expired" badge in dashboard

#### **Revocation Flow**
1. User taps "Revoke" in link detail screen
2. App calls `POST /links/:shortCode/revoke`
3. Backend sets `is_revoked = true`
4. Delete photo from storage immediately
5. Return success
6. Future access attempts return "This link has been revoked"

#### **Share Sheet Integration (iOS)**
1. User shares photo from iOS Photos app
2. Selects "ShareSafe" from share sheet
3. App receives photo via `expo-sharing` or `react-native-share`
4. Opens `LinkCreationScreen` with pre-loaded photo
5. User configures settings and shares

---

## Verification Plan

### Automated Tests

**Backend API Tests**
```bash
npm test
```
- Unit tests for metadata stripping
- Link generation uniqueness
- Expiration logic
- Access validation rules
- Authentication flows

**Integration Tests**
- End-to-end link creation → viewing → revocation
- Expiration cron job simulation
- Storage upload/delete operations

### Manual Verification

**Mobile App Testing**
1. **Onboarding Flow**
   - Complete Apple Sign-In
   - Set family rules
   - Reach main screen

2. **Photo Sharing Flow**
   - Select photo from gallery
   - Configure link settings (with/without preview)
   - Copy link and paste in Notes app
   - Share via system share sheet to WhatsApp
   - Verify link format and preview display

3. **Dashboard Testing**
   - View active links
   - Check analytics (view count, time remaining)
   - Modify link settings
   - Revoke link
   - Verify link moves to "Revoked" tab

4. **Share Sheet Integration**
   - Open iOS Photos app
   - Select photo → Share → ShareSafe
   - Verify app opens with photo loaded

**Recipient Experience Testing**
1. Open link in Safari (iOS), Chrome (Android), desktop browser

3. View photo in responsive viewer
4. Test download button (when enabled)
5. Test error states:
   - Revoke link → try to access
   - Wait for expiration → try to access
   - Invalid short code → 404 error

**Cross-Platform Testing**
- Send links via WhatsApp, iMessage, Telegram, Signal
- Verify preview thumbnails display correctly
- Test on different screen sizes

**Metadata Verification**
- Upload photo with GPS data
- Download shared photo
- Verify EXIF data is stripped using `exiftool`

### Success Criteria
- [ ] User can create and share link in < 30 seconds
- [ ] Recipients can view photo without any signup
- [ ] Revoked links are immediately inaccessible
- [ ] Expired links are cleaned up within 1 hour
- [ ] Metadata is completely stripped from shared photos
- [ ] App works on iOS 15+ and Android 10+
- [ ] Links open correctly in all major messaging apps
- [ ] All photos are encrypted client-side before upload
- [ ] Encryption keys are managed securely

---

## Encryption & Security Strategy

All user data (photos, thumbnails) must be encrypted to ensure privacy and security.

### Encryption Architecture

**Three Layers of Protection:**
1. **Client-side encryption** - Photos encrypted before upload (AES-256)
2. **Encryption at rest** - Server-side storage encryption enabled
3. **Encryption in transit** - HTTPS/TLS for all API communication

### Client-Side Encryption Implementation

**Standard: AES-256-GCM**
- **Algorithm**: AES-256-GCM (Galois/Counter Mode) for authenticated encryption.
- **Input**: Raw binary data (`ArrayBuffer` / `Uint8Array`), NOT Base64 strings.
- **Output**: Structured binary payload.

**Structured Payload Format:**
We avoid string concatenation and use a defined binary structure:
```
[ Version (1 byte) ] + [ IV (12 bytes) ] + [ Auth Tag (16 bytes) ] + [ Ciphertext (N bytes) ]
``` 

```typescript
// mobile/services/encryption.ts
import QuickCrypto from 'react-native-quick-crypto';

export class PhotoEncryption {
  // Generate unique 256-bit key (32 bytes)
  static async generateKey(): Promise<string> {
    const randomBytes = QuickCrypto.randomBytes(32);
    // Return hex string for DB storage
    return randomBytes.toString('hex');
  }
  
  // Encrypt Buffer (GCM Mode)
  static encryptPhoto(imageBytes: Uint8Array, keyHex: string): Uint8Array {
    const key = Buffer.from(keyHex, 'hex');
    const iv = QuickCrypto.randomBytes(12); // GCM standard IV is 12 bytes
    
    // Create GCM Cipher
    const cipher = QuickCrypto.createCipheriv('aes-256-gcm', key, iv);
    
    // Node.js/QuickCrypto: cipher.final() does NOT include the tag.
    const encrypted = Buffer.concat([
      cipher.update(imageBytes),
      cipher.final()
    ]);
    
    // Get the Auth Tag (MUST be appended manually for GCM compatibility)
    const authTag = cipher.getAuthTag(); // 16 bytes
    
    // Paylod Structure: [Version: 1] [IV: 12] [Ciphertext... + Tag: 16]
    // WebCrypto expects the tag to be the last 16 bytes of the ciphertext buffer.
    const version = Buffer.from([1]);
    return Buffer.concat([version, iv, encrypted, authTag]);
  }
}
```

### Photo Upload Flow with Encryption

1. User selects photo in mobile app
2. Strip EXIF metadata (location, device, timestamp)
3. Generate unique encryption key for this photo
4. Encrypt photo client-side with AES-256
5. Upload encrypted photo to storage
6. Store encryption key in database (encrypted at rest)
7. Generate share link with embedded key
8. Return link to user

### Key Management Options

**Option 1: Key in URL Fragment (Post-MVP - Maximum Privacy)**
```
https://sharesafe.app/v/abc123#key=a1b2c3d4e5f6...
```
- Fragment (`#key=...`) never sent to server
- Client-side decryption only
- Server cannot decrypt photos
- True end-to-end encryption (zero-knowledge)

**Drawbacks:**
- ❌ Very long URLs (~100 characters)
- ❌ Link previews often broken in messaging apps
- ❌ Fragments stripped by email clients, social media
- ❌ Copy-paste issues in some contexts
- ❌ No server-side thumbnail generation
- ❌ Complex error handling

**Option 2: Key in Database (MVP Implementation)**
```
https://sharesafe.app/v/abc123
```
- Key retrieved via API call
- Clean, short URLs
- Reliable link previews everywhere
- Works in all contexts (email, social, QR codes)
- Server-side thumbnail generation possible
- Simple error handling

**Security:**
- ✅ Photos still encrypted client-side before upload
- ✅ **Strict Access Control**: `link_secrets` table inaccessible to public/client
- ✅ **Managed Encryption**: Keys protected by Supabase database-at-rest encryption
- ✅ HTTPS/TLS for all communication
- ✅ Keys only accessible to authorized users
- ⚠️ Requires trusting server (not zero-knowledge)

**MVP Decision:** Use **Option 2** for better UX and reliability. Option 1 can be added later as "Advanced Privacy Mode" for power users who want zero-knowledge architecture.

### Database Schema Updates

```sql
-- Key storage handled by strict `link_secrets` table (see Schema section)
-- MVP Security Model:
-- 1. Encryption keys are stored in `link_secrets`
-- 2. Table is INACCESSIBLE to client apps (RLS Deny All)
-- 3. Only Edge Functions (Service Role) can access keys
-- 4. Keys rely on Supabase managed database-at-rest encryption

-- Future: App-layer encryption (pgcrypto) can be added here
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### Storage Configuration

**S3/Cloudflare R2 Settings:**
- Enable server-side encryption (SSE-S3 or SSE-KMS)
- Use AES-256 encryption at rest
- Store files with UUID keys (not original filenames)
- Enable versioning for recovery
- Set lifecycle rules for automatic deletion

**Supabase Storage Settings:**
- Enable RLS (Row Level Security)
- Server-side encryption enabled by default
- Automatic HTTPS for all requests

### Recipient Decryption Flow

```typescript
// viewer/utils/photoDecryption.ts
export async function loadAndDecryptPhoto(shortCode: string): Promise<string> {
  try {
    // 1. Fetch Metadata + Signed URL (Step A)
    // Signed URL is short-lived (60s), so we fetch it just-in-time.
    const metaResponse = await fetch(`/api/get-link?code=${shortCode}&action=metadata`);
    if (!metaResponse.ok) throw new Error('LinkInvalid');
    const { signedUrl, metadata } = await metaResponse.json();
    
    // 2. Fetch Encrypted Blob immediately
    const blobResponse = await fetch(signedUrl);
    if (!blobResponse.ok) throw new Error('FetchFailed');
    const encryptedBuffer = await blobResponse.arrayBuffer();

    // 3. Fetch Encryption Key (Step B)
    // Separate call to prevent single-response compromise
    const keyResponse = await fetch(`/api/get-link?code=${shortCode}&action=key`);
    if (!keyResponse.ok) throw new Error('KeyAccessDenied');
    const { key: keyHex } = await keyResponse.json();
    
    // 4. Parse Structured Payload
    // [ Version (1) ] [ IV (12) ] [ Ciphertext........ + Tag (16) ]
    const view = new DataView(encryptedBuffer);
    const version = view.getUint8(0);
    
    if (version !== 1) throw new Error('UnknownVersion');
    
    const iv = encryptedBuffer.slice(1, 13);
    const ciphertextWithTag = encryptedBuffer.slice(13); // Rest is Ciphertext + Tag
    
    // 5. Import Key (Web Crypto API)
    const keyBytes = matchKeyHexToBytes(keyHex); // Helper to convert hex string to Uint8Array
    const cryptoKey = await window.crypto.subtle.importKey(
      'raw', 
      keyBytes, 
      'AES-GCM', 
      false, 
      ['decrypt']
    );
    
    // 6. Decrypt (Web Crypto automatically validates tag at end of buffer)
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { 
        name: 'AES-GCM', 
        iv: iv 
        // tagLength is implicit (128) when tag is part of ciphertext
      },
      cryptoKey,
      ciphertextWithTag // Tag is integrated here
    );
    
    // 5. Convert to Blob URL
    const blob = new Blob([decryptedBuffer], { type: 'image/jpeg' });
    return URL.createObjectURL(blob);
    
  } catch (error) {
    console.error('Decryption failed:', error);
    // Return explicit error state rather than partial render
    throw new Error('DecryptionFailed'); 
  }
}
```

### Decryption UX States
We treat decryption failure as a first-class state, never attempting partial renders.

- **Success**: Photo renders immediately.
- **Decryption Failed**: "This photo cannot be decrypted. The link may be corrupted." (Show 'Broken Lock' icon).
- **Network Error**: "Failed to load photo data. Check your connection."
- **Invalid Key**: "Access Denied. Invalid encryption key."

### Security Checklist

- [x] **HTTPS/TLS** - All API communication encrypted in transit
- [x] **Client-side encryption** - AES-256 before upload
- [x] **Encryption at rest** - S3/R2 server-side encryption
- [x] **Database encryption** - Keys protected by Supabase Encryption-at-Rest + Strict RLS
- [ ] **App-layer key encryption** - Future enhancement (pgcrypto/KMS envelope)
- [x] **EXIF stripping** - Metadata removed before encryption
- [x] **Unique keys** - Each photo has unique encryption key
- [x] **Secure deletion** - Encrypted data deleted on expiration/revocation
- [x] **No plaintext storage** - Photos never stored unencrypted
- [x] **Zero-knowledge option** - URL fragment keys (Option 1)

### Privacy Benefits

✅ **Secure Transfer** - Keys exchanged securely via API
✅ **Zero-knowledge ready** - Architecture supports future upgrade to URL fragment keys
✅ **Secure by default** - All photos automatically encrypted
✅ **No metadata leakage** - EXIF stripped before encryption
✅ **Automatic cleanup** - Encrypted data deleted on expiration
✅ **GDPR compliant** - Meets privacy requirements
✅ **Defense in depth** - Multiple encryption layers

### Performance Considerations

- **Encryption overhead**: ~100-200ms for typical photo (2-5MB)
- **Decryption overhead**: ~50-100ms in browser
- **Mitigation**: Use Web Workers for decryption to avoid blocking UI
- **Caching**: Cache decrypted photos in memory (not localStorage for security)
