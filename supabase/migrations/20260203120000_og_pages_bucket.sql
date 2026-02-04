-- Create public OG pages bucket for social previews
-- Migration: 20260203120000_og_pages_bucket

-- Create PUBLIC bucket for static OG HTML pages
INSERT INTO storage.buckets (id, name, public)
VALUES ('og-pages', 'og-pages', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow public reads for OG pages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'og_pages_public_read'
  ) THEN
    CREATE POLICY "og_pages_public_read"
    ON storage.objects
    FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'og-pages');
  END IF;
END $$;
