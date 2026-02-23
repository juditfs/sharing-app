-- Apple Sign-In Migration
-- Adds user_migrations table and RPCs for secure anon→authenticated data handshake.
-- Also updates storage_delete_own_files RLS to allow deleting files owned via shared_links.

-- =========================================
-- TABLE: user_migrations
-- =========================================

CREATE TABLE user_migrations (
  code           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anon_user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes'),
  used_at        TIMESTAMPTZ
);

CREATE INDEX idx_user_migrations_expires ON user_migrations(expires_at);

-- No direct client access; all access via SECURITY DEFINER RPCs
ALTER TABLE user_migrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_migrations_deny_all" ON user_migrations FOR ALL USING (false);

-- =========================================
-- RPC: prepare_migration()
-- Called while signed in as the anonymous user.
-- Returns a short-lived migration code.
-- =========================================

CREATE OR REPLACE FUNCTION prepare_migration()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_code uuid;
BEGIN
  -- Guard 1: caller must have a valid session
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Guard 2: caller must be an anonymous user
  IF NOT COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'Only anonymous users can prepare a migration';
  END IF;

  INSERT INTO user_migrations (anon_user_id)
  VALUES (auth.uid())
  RETURNING code INTO v_code;

  RETURN v_code;
END;
$$;

REVOKE EXECUTE ON FUNCTION prepare_migration() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION prepare_migration() TO authenticated;
REVOKE ALL ON TABLE user_migrations FROM authenticated;

-- =========================================
-- RPC: complete_migration(migration_code uuid)
-- Called after signing in as the Apple user.
-- Atomically transfers shared_links ownership.
-- =========================================

CREATE OR REPLACE FUNCTION complete_migration(migration_code uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_migration user_migrations%ROWTYPE;
BEGIN
  -- Guard 1: caller must have a valid session
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Guard 2: caller must be non-anonymous (authenticated Apple user)
  IF COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'Only authenticated (non-anonymous) users can complete a migration';
  END IF;

  -- Lock the migration row for this transaction
  SELECT * INTO v_migration
  FROM user_migrations
  WHERE code = migration_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Migration code not found';
  END IF;

  -- Guard 3: caller must not be the same user as the anon user
  IF auth.uid() = v_migration.anon_user_id THEN
    RAISE EXCEPTION 'Cannot migrate to the same user';
  END IF;

  -- Idempotency: if already used by this exact caller, succeed silently
  IF v_migration.used_at IS NOT NULL THEN
    IF v_migration.target_user_id = auth.uid() THEN
      RETURN;
    ELSE
      RAISE EXCEPTION 'Migration code already used';
    END IF;
  END IF;

  -- Validate code is not expired
  IF v_migration.expires_at < now() THEN
    RAISE EXCEPTION 'Migration code expired';
  END IF;

  -- Transfer ownership of all shared_links from anon user to Apple user
  UPDATE shared_links
  SET user_id = auth.uid()
  WHERE user_id = v_migration.anon_user_id;

  -- Only mark used after successful transfer (same transaction)
  UPDATE user_migrations
  SET used_at = now(),
      target_user_id = auth.uid()
  WHERE code = migration_code;
END;
$$;

REVOKE EXECUTE ON FUNCTION complete_migration(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION complete_migration(uuid) TO authenticated;

-- =========================================
-- STORAGE RLS: update storage_delete_own_files
-- Allow deleting files referenced by links the user owns
-- (needed after migration: files stay in old uid/ folder)
-- =========================================

DROP POLICY IF EXISTS "storage_delete_own_files" ON storage.objects;

CREATE POLICY "storage_delete_own_files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'photos'
  AND (
    -- Standard: file lives in caller's own folder
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
    -- Post-migration: file referenced by a link the caller owns
    OR EXISTS (
      SELECT 1 FROM shared_links
      WHERE (photo_url = name OR thumbnail_url = name)
        AND user_id = auth.uid()
    )
  )
);
