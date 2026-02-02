-- Add MVP fields to shared_links table
-- Migration: 20260202134500_add_mvp_fields

-- Add new columns for MVP features
ALTER TABLE shared_links
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS is_revoked BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS allow_download BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS share_text TEXT DEFAULT 'shared a photo',
  ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS public_thumbnail_url TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_shared_links_expires_at 
  ON shared_links(expires_at) 
  WHERE expires_at IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_shared_links_is_revoked 
  ON shared_links(is_revoked) 
  WHERE is_revoked = true;

-- Add comments for clarity
COMMENT ON COLUMN shared_links.thumbnail_url IS 'Encrypted thumbnail (always generated)';
COMMENT ON COLUMN shared_links.public_thumbnail_url IS 'Unencrypted thumbnail (optional, for WhatsApp/iMessage previews)';
COMMENT ON COLUMN shared_links.deleted_at IS 'Soft delete timestamp (set by cleanup cron job)';
COMMENT ON COLUMN shared_links.expires_at IS 'Link expiration timestamp (NULL = never expires)';
COMMENT ON COLUMN shared_links.is_revoked IS 'Manual revocation by user';
COMMENT ON COLUMN shared_links.view_count IS 'Number of times link was viewed (incremented on metadata fetch only)';
