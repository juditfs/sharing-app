-- Create public thumbnails bucket for WhatsApp/iMessage previews
-- Migration: 20260202134501_public_thumbnails_bucket

-- Create PUBLIC bucket for unencrypted thumbnails
INSERT INTO storage.buckets (id, name, public)
VALUES ('public-thumbnails', 'public-thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Users can upload to their own folder
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'public_thumbnails_upload_own'
  ) THEN
    CREATE POLICY "public_thumbnails_upload_own" 
    ON storage.objects 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (
      bucket_id = 'public-thumbnails' 
      AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );
  END IF;
END $$;

-- Policy: Users can delete their own files
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'public_thumbnails_delete_own'
  ) THEN
    CREATE POLICY "public_thumbnails_delete_own" 
    ON storage.objects 
    FOR DELETE 
    TO authenticated 
    USING (
      bucket_id = 'public-thumbnails' 
      AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );
  END IF;
END $$;

-- Policy: Allow public reads (for WhatsApp/iMessage)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'public_thumbnails_public_read'
  ) THEN
    CREATE POLICY "public_thumbnails_public_read" 
    ON storage.objects 
    FOR SELECT 
    TO anon, authenticated
    USING (bucket_id = 'public-thumbnails');
  END IF;
END $$;
