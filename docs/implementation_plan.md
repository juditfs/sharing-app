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
> **End-to-End Encryption Clarification**
> 
> All photos are encrypted client-side before upload using AES-256. For the MVP, **encryption keys are stored (encrypted) in the database**. 
> 
> **Note**: This provides robust security against casual breaches but is **not Zero-Knowledge** since the server technically holds the keys. A future "Advanced Privacy Mode" will allow keys to be embedded in URL fragments for true Zero-Knowledge privacy.

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
- ✅ Basic analytics (view count, access history)

**Technical:**
- ✅ React Native Paper UI components
- ✅ Node.js + Express backend
- ✅ Supabase (PostgreSQL + Auth + Storage)
- ✅ Encryption keys stored in database
- ✅ HTTPS/TLS for all communication

### **Post-MVP Features (Future Enhancements)**

**Advanced Privacy:**
- ⏳ Device-based access limits (with cookie/fingerprint tracking)
- ⏳ URL fragment encryption keys (zero-knowledge architecture)
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

**Strategy: Hybrid UI (Native-Feel iOS + Material Android)**
We will use **React Native Paper** for Android to get perfect Material 3 support, but use **Custom Native-Like Components** on iOS. We will achieve this through **Wrapper Components**.

#### **UI Library Approach**
- **Android**: React Native Paper (Material Design 3)
- **iOS**: Custom styled components (Cupertino style) or unstyled Paper components with iOS theme
- **Web**: React Native Paper (Material Design is standard on web)

#### **Wrapper Component Pattern**
We will not use `Button` or `TextInput` directly from libraries. Instead, we generate our own:
```typescript
// components/AppButton.tsx
import { Platform, Pressable, Text, StyleSheet } from 'react-native';
import { Button as PaperButton } from 'react-native-paper';

export const AppButton = ({ children, onPress, mode = 'contained', ...props }) => {
  // iOS: Native-style Pressable
  if (Platform.OS === 'ios') {
    return (
      <Pressable 
        style={({ pressed }) => [
          styles.iosButton, 
          mode === 'outlined' && styles.iosOutlined,
          pressed && styles.iosPressed
        ]} 
        onPress={onPress}
      >
        <Text style={[styles.iosText, mode === 'outlined' && styles.iosTextOutlined]}>
          {children}
        </Text>
      </Pressable>
    );
  }
  // Android/Web: Material Design
  return <PaperButton mode={mode} onPress={onPress} {...props}>{children}</PaperButton>;
};
```

#### **Theme Configuration** (`/packages/shared-components/theme`)
```typescript
import { Platform } from 'react-native';
import { MD3LightTheme } from 'react-native-paper';

const isIOS = Platform.OS === 'ios';

export const theme = {
  // Only inherit MD3 properties on Android/Web
  ...(isIOS ? {} : MD3LightTheme),
  colors: {
    ...MD3LightTheme.colors,
    primary: isIOS ? '#007AFF' : '#6366F1', // iOS Blue vs Brand Indigo
    background: isIOS ? '#F2F2F7' : '#FFFFFF', // iOS Grouped Background
    surface: isIOS ? '#FFFFFF' : '#F9FAFB',
    error: '#FF3B30', // iOS System Red
  },
  roundness: isIOS ? 10 : 20, // Tighter corners on iOS headers
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
- `FamilyRulesList` - Display family rules
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

// types/FamilyRule.ts
export interface FamilyRule {
  id: string;
  ruleText: string;
  isTemplate: boolean;
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
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

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
        J[Storage Bucket]
        K[Auth Provider]
        L[Edge Functions]
        L1[Cron: Cleanup]
        L2[RPC: Revoke Link]
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
    
    M --> I
    M --> J
    M --> N
    
    L1 --> I
    L1 --> J
    
    I -.-> |RLS Policy| C
    I -.-> |RLS Policy| M
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

#### **family_rules**
```sql
CREATE TABLE family_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  rule_text TEXT NOT NULL,
  is_template BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
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
  
  -- Analytics
  view_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP
);
```

#### **link_rules** (Many-to-many: links can have multiple rules)
```sql
CREATE TABLE link_rules (
  link_id UUID REFERENCES shared_links(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES family_rules(id) ON DELETE CASCADE,
  PRIMARY KEY (link_id, rule_id)
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
  anonymized_ip TEXT, -- Last octet removed (e.g. 192.168.1.xxx) for privacy
  
  -- Event data
  accessed_at TIMESTAMP DEFAULT NOW(),
  action TEXT -- 'view', 'download', 'blocked'
);
```

---

### Component Breakdown

#### **Database & Security** (`/supabase`)

##### **Row Level Security (RLS) Policies**
Since we are removing the middleware backend, **RLS is our primary security layer**.

**`shared_links` Policies:**
1.  **INSERT**: Authenticated users can insert rows where `user_id = auth.uid()`.
2.  **SELECT (Owner)**: Authenticated users can view rows where `user_id = auth.uid()`.
3.  **SELECT (Recipient)**: Public/Anonymous users can view rows where:
    - `short_code` matches input
    - `is_revoked` is false
    - `expires_at` is NULL or > NOW()
4.  **UPDATE**: Authenticated users can update rows where `user_id = auth.uid()`.

**`storage` Policies:**
1.  **UPLOAD**: Authenticated users can upload to `/{uid}/*`.
2.  **DOWNLOAD (Owner)**: Authenticated users can download from `/{uid}/*`.
3.  **DOWNLOAD (Recipient)**: Public users can download if they have a valid `short_code` mapped to that file (requires a specialized PostgreSQL function or Edge Function to validate access before signing URL, or relying on unguessable filenames + short-lived signed URLs generated by Edge Function).

> **Note**: For MVP, we will use **Signed URLs** generated by the Mobile App (for owner) or an implementation pattern where the `shared_links` table contains the public path if valid.

##### **Edge Functions** (`/supabase/functions`)

**1. `process-expiration` (Scheduled Cron)**
- Runs every hour.
- Deletes files from Storage for expired links.
- Updates `status` in database.

**2. `get-link-details` (Optional)**
- If RLS logic gets too complex for "Recipient View", we can wrap the fetch in an Edge Function that validates expiry/revocation and returns the signed Storage URL + metadata.

---

#### **Backend Logic (Supabase)**

##### [NEW] [supabase/migrations/001_initial_schema.sql](file:///Users/ju/Documents/Projects/2026/sharing-app/supabase/migrations/001_initial_schema.sql)
- Initial DDL for `users`, `shared_links`, `family_rules`.
- Enable RLS on all tables.

##### [NEW] [supabase/migrations/002_security_policies.sql](file:///Users/ju/Documents/Projects/2026/sharing-app/supabase/migrations/002_security_policies.sql)
- RLS policies for Owner access.
- RLS policies for Public recipient access (filtered by expiry).

##### [NEW] [supabase/functions/cleanup-expired/index.ts](file:///Users/ju/Documents/Projects/2026/sharing-app/supabase/functions/cleanup-expired/index.ts)
- Deno function to query expired rows and remove objects from Storage bucket.

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

##### [NEW] [screens/FamilyRulesSetupScreen.tsx](file:///Users/ju/Documents/Projects/2026/sharing-app/mobile/screens/FamilyRulesSetupScreen.tsx)
Optional family rules setup (can skip).

##### [NEW] [screens/HomeScreen.tsx](file:///Users/ju/Documents/Projects/2026/sharing-app/mobile/screens/HomeScreen.tsx)
Main screen with "Share Photo" button and empty state.

##### [NEW] [screens/PhotoSelectionScreen.tsx](file:///Users/ju/Documents/Projects/2026/sharing-app/mobile/screens/PhotoSelectionScreen.tsx)
Photo picker using `expo-image-picker`.

##### [NEW] [screens/LinkCreationScreen.tsx](file:///Users/ju/Documents/Projects/2026/sharing-app/mobile/screens/LinkCreationScreen.tsx)
Configure link settings:
- Preview thumbnail toggle (Off = Secure Placeholder, On = Public Thumbnail for WhatsApp)
- Share text input
- Expiry dropdown (1 hour, 1 day, 1 week [default], 1 month, 1 year, custom)
- Download toggle
- Family rules selector
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
- Family rules management
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
2. Show family rules (first-time view) with "I Understand" button
3. Display photo in clean viewer
4. Show family rules footer
5. Download button (if enabled)
6. Error states (expired, revoked, limit reached)

##### [NEW] [components/PhotoViewer.tsx](file:///Users/ju/Documents/Projects/2026/sharing-app/viewer/components/PhotoViewer.tsx)
Responsive photo display component.

##### [NEW] [components/FamilyRulesModal.tsx](file:///Users/ju/Documents/Projects/2026/sharing-app/viewer/components/FamilyRulesModal.tsx)
First-time family rules display with acceptance.

##### [NEW] [components/ErrorScreen.tsx](file:///Users/ju/Documents/Projects/2026/sharing-app/viewer/components/ErrorScreen.tsx)
Friendly error messages for invalid links.

##### [NEW] [utils/deviceFingerprint.ts](file:///Users/ju/Documents/Projects/2026/sharing-app/viewer/utils/deviceFingerprint.ts)
Generate device fingerprint (post-MVP, placeholder for now).

---

### Key Implementation Details

#### **Photo Upload Flow**
1. User selects photo in mobile app
2. App uploads to backend `/links` endpoint
3. Backend strips EXIF metadata and optimizes image using `sharp`
   - Resize to max 2048px width/height (Reduces file size significantly)
   - Compress to ~80% quality
4. Generate thumbnail (if requested) at 200x200px
5. Upload original + thumbnail to Supabase Storage
6. Generate unique short code (8 characters, URL-safe)
7. Create database record with default settings (1 week expiry)
8. Return link to app
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
2. Verify family rules modal appears (first time)
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

```typescript
// mobile/services/encryption.ts
import QuickCrypto from 'react-native-quick-crypto';

export class PhotoEncryption {
  // Generate unique 256-bit key per photo
  static async generateKey(): Promise<string> {
    const randomBytes = QuickCrypto.randomBytes(32);
    return Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  // Encrypt photo using AES-256 (Native performance)
  static encryptPhoto(photoBase64: string, key: string): string {
    const iv = QuickCrypto.randomBytes(16);
    const cipher = QuickCrypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
    let encrypted = cipher.update(photoBase64, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    // Return IV + Encrypted Data
    return iv.toString('hex') + ':' + encrypted;
  }
  
  // Decrypt photo (recipient viewer - Web uses Web Crypto API)
  static async decryptPhotoWeb(encryptedData: string, key: string): Promise<string> {
    // Implementation using Web Crypto API for viewer
    return decryptedData;
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
- ✅ Keys encrypted at rest in database (pgcrypto)
- ✅ HTTPS/TLS for all communication
- ✅ Keys only accessible to authorized users
- ⚠️ Requires trusting server (not zero-knowledge)

**MVP Decision:** Use **Option 2** for better UX and reliability. Option 1 can be added later as "Advanced Privacy Mode" for power users who want zero-knowledge architecture.

### Database Schema Updates

```sql
-- Add encryption key column
ALTER TABLE shared_links 
  ADD COLUMN client_encryption_key TEXT;

-- Enable PostgreSQL encryption extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypt sensitive columns at database level
-- (if using Option 2 - key in database)
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
  // 1. Extract key from URL fragment
  const key = window.location.hash.replace('#key=', '');
  
  // 2. Fetch encrypted photo
  const response = await fetch(`/api/view/${shortCode}`);
  const { encryptedPhotoUrl } = await response.json();
  
  // 3. Download encrypted data
  const encryptedData = await fetch(encryptedPhotoUrl).then(r => r.text());
  
  // 4. Decrypt client-side
  const photoBase64 = PhotoEncryption.decryptPhoto(encryptedData, key);
  
  // 5. Display photo
  return `data:image/jpeg;base64,${photoBase64}`;
}
```

### Security Checklist

- [x] **HTTPS/TLS** - All API communication encrypted in transit
- [x] **Client-side encryption** - AES-256 before upload
- [x] **Encryption at rest** - S3/R2 server-side encryption
- [x] **Database encryption** - Sensitive fields encrypted (pgcrypto)
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
