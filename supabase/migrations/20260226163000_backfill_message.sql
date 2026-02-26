-- Backfill message for existing links that have NULL message
-- (rows created before the migration won't have picked up the NOT NULL DEFAULT yet)
UPDATE shared_links
SET message = 'I''d like to share this picture with you'
WHERE message IS NULL OR message = '';
