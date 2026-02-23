-- Security hardening: Index for efficient per-user daily link count queries
-- Supports the rate limiting check in the create-link Edge Function
CREATE INDEX IF NOT EXISTS idx_shared_links_user_created
    ON shared_links (user_id, created_at);
