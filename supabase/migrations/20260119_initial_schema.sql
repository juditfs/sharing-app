-- ShareSafe Prototype: Initial Database Schema
-- Creates minimal tables for encrypted photo sharing

-- Enable pgcrypto extension (available by default in Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================
-- TABLES
-- =========================================

-- Users table (managed by Supabase Auth)
-- No custom users table needed for prototype (using auth.users)

-- Shared Links table
CREATE TABLE shared_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  short_code TEXT UNIQUE NOT NULL,
  photo_url TEXT NOT NULL,
  thumbnail_url TEXT, -- Encrypted thumbnail for faster loading
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Link Secrets table (encryption keys)
-- CRITICAL: This table must be completely inaccessible to client applications
CREATE TABLE link_secrets (
  link_id UUID PRIMARY KEY REFERENCES shared_links(id) ON DELETE CASCADE,
  encryption_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================
-- INDEXES
-- =========================================

-- Index for fast short_code lookups
CREATE INDEX idx_shared_links_short_code ON shared_links(short_code);

-- Index for user's links
CREATE INDEX idx_shared_links_user_id ON shared_links(user_id);

-- Index for temporal queries (sorting by creation date)
CREATE INDEX idx_shared_links_created_at ON shared_links(created_at DESC);

-- =========================================
-- ROW LEVEL SECURITY (RLS)
-- =========================================

-- Enable RLS on all tables
ALTER TABLE shared_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_secrets ENABLE ROW LEVEL SECURITY;

-- =========================================
-- RLS POLICIES: shared_links
-- =========================================

-- Policy: Users can insert their own links
CREATE POLICY "shared_links_insert_own" 
ON shared_links 
FOR INSERT 
TO authenticated 
WITH CHECK ((SELECT auth.uid()) = user_id);

-- Policy: Users can select their own links
CREATE POLICY "shared_links_select_own" 
ON shared_links 
FOR SELECT 
TO authenticated 
USING ((SELECT auth.uid()) = user_id);

-- Policy: Users can update their own links
CREATE POLICY "shared_links_update_own" 
ON shared_links 
FOR UPDATE 
TO authenticated 
USING ((SELECT auth.uid()) = user_id) 
WITH CHECK ((SELECT auth.uid()) = user_id);

-- Policy: Users can delete their own links
CREATE POLICY "shared_links_delete_own" 
ON shared_links 
FOR DELETE 
TO authenticated 
USING ((SELECT auth.uid()) = user_id);

-- Policy: Explicitly deny all anonymous access
CREATE POLICY "shared_links_deny_anon" 
ON shared_links 
FOR ALL 
TO anon 
USING (false);

-- =========================================
-- RLS POLICIES: link_secrets (CRITICAL SECURITY)
-- =========================================

-- Policy: Deny ALL client access to encryption keys
-- Keys are ONLY accessible via Edge Functions using Service Role
CREATE POLICY "link_secrets_deny_all" 
ON link_secrets 
FOR ALL 
USING (false);

-- =========================================
-- STORAGE SETUP
-- =========================================

-- Create storage bucket for photos (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', false)
ON CONFLICT (id) DO NOTHING;

-- =========================================
-- STORAGE RLS POLICIES
-- =========================================

-- Policy: Users can upload files to their own folder
CREATE POLICY "storage_upload_own_files" 
ON storage.objects 
FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id = 'photos' 
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

-- Policy: Users can delete their own files
CREATE POLICY "storage_delete_own_files" 
ON storage.objects 
FOR DELETE 
TO authenticated 
USING (
  bucket_id = 'photos' 
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

-- Policy: Deny all direct reads (access via signed URLs only)
CREATE POLICY "storage_deny_all_reads" 
ON storage.objects 
FOR SELECT 
TO anon, authenticated 
USING (false);
