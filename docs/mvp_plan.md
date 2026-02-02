# Sharene MVP Implementation Plan

Building on the working prototype to create a production-ready MVP.

## Current State (Prototype ✅)

**What's Working:**
- ✅ Anonymous authentication
- ✅ Photo selection (camera + gallery)
- ✅ Image processing (EXIF stripping, resize to 2048px, thumbnail generation)
- ✅ Client-side AES-256-GCM encryption (optimized, in-memory)
- ✅ Upload to Supabase Storage
- ✅ Link creation via Edge Function
- ✅ Web viewer with client-side decryption
- ✅ Basic security (JWT verification, storage path validation)
- ✅ Performance instrumentation

**Current Architecture:**
- Mobile: React Native + Expo
- Backend: Supabase (PostgreSQL, Storage, Edge Functions)
- Viewer: Next.js (static export)
- Encryption: AES-256-GCM (client-side)

---

## MVP Additions

### Features to Add

| Feature | Prototype | MVP |
|---------|-----------|-----|
| **Authentication** | Anonymous | ✅ Apple Sign-In |
| **User Dashboard** | None | ✅ Active/Expired/Revoked tabs |
| **Link Management** | None | ✅ Revoke, View details |
| **Expiry** | None | ✅ 1h/1d/1w/1m/1y/custom (default: 1 week) |
| **Analytics** | None | ✅ View count, last accessed |
| **Download Control** | None | ✅ Allow/disallow toggle |
| **Thumbnail Privacy** | Encrypted only | ✅ Encrypted (default) or Public preview |
| **UI/UX** | Basic | ✅ React Native Paper (polished) |
| **Share Text** | None | ✅ Custom message with link |

---

## Proposed Changes

### 1. Authentication & User Management

#### Database Schema Updates

##### [MODIFY] [supabase/migrations/001_initial_schema.sql](file:///Users/ju/Documents/Projects/2026/sharing-app/supabase/migrations/001_initial_schema.sql)

**Add users table:**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  apple_id TEXT UNIQUE,
  display_name TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Trigger to auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

**Update shared_links table:**
```sql
ALTER TABLE shared_links
  ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN expires_at TIMESTAMP,
  ADD COLUMN allow_download BOOLEAN DEFAULT false,
  ADD COLUMN share_text TEXT DEFAULT 'shared a photo',
  ADD COLUMN view_count INTEGER DEFAULT 0,
  ADD COLUMN last_accessed_at TIMESTAMP;

-- Add index for user queries
CREATE INDEX idx_shared_links_user_id ON shared_links(user_id);
CREATE INDEX idx_shared_links_expires_at ON shared_links(expires_at) WHERE expires_at IS NOT NULL;
```

##### [NEW] [supabase/migrations/002_rls_policies.sql](file:///Users/ju/Documents/Projects/2026/sharing-app/supabase/migrations/002_rls_policies.sql)

```sql
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_secrets ENABLE ROW LEVEL SECURITY;

-- Users: Read own profile
CREATE POLICY "users_select_own" ON users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Shared Links: Owner access
CREATE POLICY "shared_links_insert_own" ON shared_links
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "shared_links_select_own" ON shared_links
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "shared_links_update_own" ON shared_links
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "shared_links_delete_own" ON shared_links
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Link Secrets: NO CLIENT ACCESS (Edge Functions only)
CREATE POLICY "link_secrets_deny_all" ON link_secrets
  FOR ALL USING (false);

-- Storage: Owner access for uploads/deletes
CREATE POLICY "storage_upload_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "storage_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Deny all public reads (signed URLs only)
CREATE POLICY "storage_deny_reads" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (false);
```

---

#### Mobile App Changes

##### [MODIFY] [mobile/lib/auth.ts](file:///Users/ju/Documents/Projects/2026/sharing-app/mobile/lib/auth.ts)

**Replace anonymous auth with Apple Sign-In:**
```typescript
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from './supabase';

export async function signInWithApple(): Promise<void> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken!,
    });

    if (error) throw error;
  } catch (e: any) {
    if (e.code === 'ERR_REQUEST_CANCELED') {
      // User canceled
      return;
    }
    throw e;
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
```

##### [MODIFY] [mobile/App.tsx](file:///Users/ju/Documents/Projects/2026/sharing-app/mobile/App.tsx)

**Add auth state management and navigation:**
```typescript
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PaperProvider } from 'react-native-paper';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';

import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import CreateLinkScreen from './screens/CreateLinkScreen';
import LinkDetailScreen from './screens/LinkDetailScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <PaperProvider>
      <NavigationContainer>
        <Stack.Navigator>
          {!session ? (
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          ) : (
            <>
              <Stack.Screen name="Dashboard" component={DashboardScreen} />
              <Stack.Screen name="CreateLink" component={CreateLinkScreen} />
              <Stack.Screen name="LinkDetail" component={LinkDetailScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}
```

---

### 2. User Dashboard

##### [NEW] [mobile/screens/DashboardScreen.tsx](file:///Users/ju/Documents/Projects/2026/sharing-app/mobile/screens/DashboardScreen.tsx)

**Features:**
- Tabs: Active / Expired / Revoked
- Link cards showing thumbnail, title, expiry, view count
- Pull-to-refresh
- FAB for creating new link

```typescript
import { useState, useEffect } from 'react';
import { View, FlatList, RefreshControl } from 'react-native';
import { FAB, SegmentedButtons, Card, Text, Chip } from 'react-native-paper';
import { supabase } from '../lib/supabase';

type TabValue = 'active' | 'expired' | 'revoked';

export default function DashboardScreen({ navigation }) {
  const [tab, setTab] = useState<TabValue>('active');
  const [links, setLinks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLinks = async () => {
    const { data } = await supabase
      .from('shared_links')
      .select('*')
      .order('created_at', { ascending: false });

    // Filter by tab
    const now = new Date();
    const filtered = data?.filter(link => {
      if (tab === 'revoked') return link.is_revoked;
      if (tab === 'expired') return link.expires_at && new Date(link.expires_at) < now;
      return !link.is_revoked && (!link.expires_at || new Date(link.expires_at) >= now);
    });

    setLinks(filtered || []);
  };

  useEffect(() => {
    fetchLinks();
  }, [tab]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLinks();
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <SegmentedButtons
        value={tab}
        onValueChange={setTab}
        buttons={[
          { value: 'active', label: 'Active' },
          { value: 'expired', label: 'Expired' },
          { value: 'revoked', label: 'Revoked' },
        ]}
      />

      <FlatList
        data={links}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <LinkCard link={item} onPress={() => navigation.navigate('LinkDetail', { id: item.id })} />
        )}
      />

      <FAB
        icon="plus"
        style={{ position: 'absolute', right: 16, bottom: 16 }}
        onPress={() => navigation.navigate('CreateLink')}
      />
    </View>
  );
}
```

---

### 3. Link Creation with Settings

##### [NEW] [mobile/screens/CreateLinkScreen.tsx](file:///Users/ju/Documents/Projects/2026/sharing-app/mobile/screens/CreateLinkScreen.tsx)

**Features:**
- Photo selection (camera/gallery)
- Expiry selector (1h/1d/1w/1m/1y/custom)
- Download toggle
- **Thumbnail privacy toggle (Encrypted vs. Public preview)**
- Custom share text
- Progress indicator during upload

```typescript
import { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { Button, TextInput, Switch, SegmentedButtons, Text, HelperText } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { processAndUploadPhoto } from '../lib/photoWorkflow';

export default function CreateLinkScreen({ navigation }) {
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [expiry, setExpiry] = useState('1w'); // 1h, 1d, 1w, 1m, 1y, custom
  const [allowDownload, setAllowDownload] = useState(false);
  const [publicThumbnail, setPublicThumbnail] = useState(false);
  const [shareText, setShareText] = useState('');
  const [loading, setLoading] = useState(false);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleCreate = async () => {
    if (!photoUri) return;

    setLoading(true);
    try {
      const shareUrl = await processAndUploadPhoto(photoUri, {
        expiry,
        allowDownload,
        publicThumbnail,
        shareText,
      });

      navigation.navigate('LinkDetail', { shareUrl });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={{ padding: 16 }}>
      <Button mode="outlined" onPress={pickPhoto}>
        {photoUri ? 'Change Photo' : 'Select Photo'}
      </Button>

      <Text variant="titleMedium" style={{ marginTop: 24 }}>Expiry</Text>
      <SegmentedButtons
        value={expiry}
        onValueChange={setExpiry}
        buttons={[
          { value: '1h', label: '1 Hour' },
          { value: '1d', label: '1 Day' },
          { value: '1w', label: '1 Week' },
          { value: '1m', label: '1 Month' },
        ]}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text>Allow Download</Text>
        </View>
        <Switch value={allowDownload} onValueChange={setAllowDownload} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text>Public Thumbnail Preview</Text>
          <HelperText type="info">
            {publicThumbnail 
              ? 'WhatsApp/iMessage will show a preview' 
              : 'WhatsApp/iMessage will show a generic placeholder'}
          </HelperText>
        </View>
        <Switch value={publicThumbnail} onValueChange={setPublicThumbnail} />
      </View>

      <TextInput
        label="Share Message (Optional)"
        value={shareText}
        onChangeText={setShareText}
        placeholder="Check out this photo!"
        style={{ marginTop: 16 }}
      />

      <Button
        mode="contained"
        onPress={handleCreate}
        loading={loading}
        disabled={!photoUri || loading}
        style={{ marginTop: 24 }}
      >
        Create Link
      </Button>
    </ScrollView>
  );
}
```

---

### 4. Link Detail & Management

##### [NEW] [mobile/screens/LinkDetailScreen.tsx](file:///Users/ju/Documents/Projects/2026/sharing-app/mobile/screens/LinkDetailScreen.tsx)

**Features:**
- Display link metadata (created, expires, views)
- Copy link button
- Revoke button
- View access logs (basic)

```typescript
import { useState, useEffect } from 'react';
import { View, ScrollView, Share } from 'react-native';
import { Card, Button, Text, Chip, Divider } from 'react-native-paper';
import { supabase } from '../lib/supabase';
import * as Clipboard from 'expo-clipboard';

export default function LinkDetailScreen({ route }) {
  const { id } = route.params;
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLink();
  }, []);

  const fetchLink = async () => {
    const { data } = await supabase
      .from('shared_links')
      .select('*')
      .eq('id', id)
      .single();

    setLink(data);
  };

  const handleCopy = async () => {
    const shareUrl = `https://sharene.app/${link.short_code}`;
    await Clipboard.setStringAsync(shareUrl);
  };

  const handleShare = async () => {
    const shareUrl = `https://sharene.app/${link.short_code}`;
    await Share.share({
      message: link.share_text ? `${link.share_text}\n${shareUrl}` : shareUrl,
    });
  };

  const handleRevoke = async () => {
    setLoading(true);
    await supabase
      .from('shared_links')
      .update({ is_revoked: true })
      .eq('id', id);

    await fetchLink();
    setLoading(false);
  };

  if (!link) return <Text>Loading...</Text>;

  return (
    <ScrollView style={{ padding: 16 }}>
      <Card>
        <Card.Cover source={{ uri: link.thumbnail_url }} />
        <Card.Content style={{ marginTop: 16 }}>
          <Text variant="titleLarge">{link.share_text || 'Shared Photo'}</Text>
          
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Chip icon="eye">{link.view_count} views</Chip>
            {link.expires_at && <Chip icon="clock">Expires {formatExpiry(link.expires_at)}</Chip>}
          </View>

          <Divider style={{ marginVertical: 16 }} />

          <Text variant="bodySmall">Created: {formatDate(link.created_at)}</Text>
          {link.last_accessed_at && (
            <Text variant="bodySmall">Last viewed: {formatDate(link.last_accessed_at)}</Text>
          )}
        </Card.Content>

        <Card.Actions>
          <Button onPress={handleCopy}>Copy Link</Button>
          <Button onPress={handleShare}>Share</Button>
          {!link.is_revoked && (
            <Button mode="contained-tonal" onPress={handleRevoke} loading={loading}>
              Revoke
            </Button>
          )}
        </Card.Actions>
      </Card>
    </ScrollView>
  );
}
```

---

### 5. Edge Function Updates

##### [MODIFY] [supabase/functions/create-link/index.ts](file:///Users/ju/Documents/Projects/2026/sharing-app/supabase/functions/create-link/index.ts)

**Add support for expiry and settings:**
```typescript
// Add to request body interface
interface CreateLinkRequest {
  photoUrl: string;
  thumbnailUrl: string | null;
  encryptionKey: string;
  expiry?: '1h' | '1d' | '1w' | '1m' | '1y' | string; // ISO date for custom
  allowDownload?: boolean;
  shareText?: string;
}

// Calculate expiry timestamp
function calculateExpiry(expiry: string): Date | null {
  if (!expiry) return null;

  const now = new Date();
  const expiryMap = {
    '1h': 1 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    '1w': 7 * 24 * 60 * 60 * 1000,
    '1m': 30 * 24 * 60 * 60 * 1000,
    '1y': 365 * 24 * 60 * 60 * 1000,
  };

  if (expiry in expiryMap) {
    return new Date(now.getTime() + expiryMap[expiry]);
  }

  // Custom date
  return new Date(expiry);
}

// In the handler, add expiry to insert
const expiresAt = calculateExpiry(expiry || '1w'); // Default 1 week

const { data: link, error: insertError } = await supabaseAdmin
  .from('shared_links')
  .insert({
    user_id: user.id,
    short_code: shortCode,
    photo_url: photoUrl,
    thumbnail_url: thumbnailUrl,
    expires_at: expiresAt,
    allow_download: allowDownload ?? false,
    share_text: shareText || 'shared a photo',
  })
  .select()
  .single();
```

##### [MODIFY] [supabase/functions/get-link/index.ts](file:///Users/ju/Documents/Projects/2026/sharing-app/supabase/functions/get-link/index.ts)

**Add analytics tracking:**
```typescript
// After validating link, increment view count
await supabaseAdmin
  .from('shared_links')
  .update({
    view_count: link.view_count + 1,
    last_accessed_at: new Date().toISOString(),
  })
  .eq('id', link.id);
```

##### [NEW] [supabase/functions/cleanup-expired/index.ts](file:///Users/ju/Documents/Projects/2026/sharing-app/supabase/functions/cleanup-expired/index.ts)

**Cron job to delete expired link files:**
```typescript
import { createClient } from '@supabase/supabase-js';

Deno.serve(async () => {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Find expired links
  const { data: expiredLinks } = await supabaseAdmin
    .from('shared_links')
    .select('id, photo_url, thumbnail_url')
    .lt('expires_at', new Date().toISOString())
    .is('deleted_at', null);

  // Delete files from storage
  for (const link of expiredLinks || []) {
    await supabaseAdmin.storage.from('photos').remove([link.photo_url]);
    if (link.thumbnail_url) {
      await supabaseAdmin.storage.from('photos').remove([link.thumbnail_url]);
    }

    // Mark as deleted
    await supabaseAdmin
      .from('shared_links')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', link.id);
  }

  return new Response(JSON.stringify({ deleted: expiredLinks?.length || 0 }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

---

### 6. UI Polish

##### [NEW] [mobile/theme.ts](file:///Users/ju/Documents/Projects/2026/sharing-app/mobile/theme.ts)

**React Native Paper theme:**
```typescript
import { MD3LightTheme, configureFonts } from 'react-native-paper';
import { Platform } from 'react-native';

const fontConfig = {
  fontFamily: Platform.select({
    ios: 'System',
    default: 'Inter',
  }),
};

export const theme = {
  ...MD3LightTheme,
  fonts: configureFonts({ config: fontConfig }),
  colors: {
    ...MD3LightTheme.colors,
    primary: '#6366F1', // Indigo
    secondary: '#EC4899', // Pink
    background: '#F9FAFB',
    surface: '#FFFFFF',
  },
  roundness: 12,
};
```

---

## Verification Plan

### Automated Tests
- [ ] Run `npx expo start` - app builds successfully
- [ ] Run `npm run dev` in viewer - viewer builds successfully
- [ ] Deploy Edge Functions - all functions deploy without errors

### Manual Testing

**Authentication:**
- [ ] Sign in with Apple works
- [ ] Session persists across app restarts
- [ ] Sign out works

**Dashboard:**
- [ ] Active links display correctly
- [ ] Expired links move to Expired tab
- [ ] Revoked links move to Revoked tab
- [ ] Pull-to-refresh updates data

**Link Creation:**
- [ ] Photo selection works (camera + gallery)
- [ ] Expiry options work (1h, 1d, 1w, 1m, 1y)
- [ ] Download toggle saves correctly
- [ ] Share text appears in link metadata

**Link Management:**
- [ ] Copy link works
- [ ] Share sheet works
- [ ] Revoke immediately disables link
- [ ] View count increments on each view

**Viewer:**
- [ ] Expired links show error
- [ ] Revoked links show error
- [ ] Download button only appears if allowed
- [ ] Share text displays correctly

**Security:**
- [ ] Cannot access other users' links
- [ ] Cannot access encryption keys directly
- [ ] Storage files require signed URLs
- [ ] Expired files are deleted by cron job

---

## Dependencies

**Mobile App:**
- `expo-apple-authentication` - Apple Sign-In
- `@react-navigation/native` - Navigation
- `@react-navigation/native-stack` - Stack navigator
- `react-native-paper` - UI components
- `expo-clipboard` - Copy to clipboard

**Backend:**
- Supabase CLI for migrations
- Edge Functions deployment

---

## Estimated Timeline

| Phase | Tasks | Time |
|-------|-------|------|
| **Phase 1: Auth** | Database schema, Apple Sign-In, session management | 4 hours |
| **Phase 2: Dashboard** | Tab navigation, link cards, pull-to-refresh | 4 hours |
| **Phase 3: Link Creation** | Settings UI, expiry selector, integration | 3 hours |
| **Phase 4: Link Management** | Detail screen, revoke, analytics | 3 hours |
| **Phase 5: Edge Functions** | Update create-link, get-link, add cleanup cron | 3 hours |
| **Phase 6: UI Polish** | Theme, animations, error states | 3 hours |
| **Phase 7: Testing** | Manual testing, bug fixes | 4 hours |
| **Total** | | **24 hours** |

---

## Notes

- Build incrementally - test each phase before moving to next
- Keep performance instrumentation for monitoring
- Defer analytics dashboard to post-MVP
- Use Supabase Dashboard for monitoring during development
