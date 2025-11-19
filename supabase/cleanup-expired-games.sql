-- Function to cleanup expired games (older than 1 minute and not joined)
CREATE OR REPLACE FUNCTION cleanup_expired_games()
RETURNS void AS $$
BEGIN
  -- Delete games that are in WAITING state (0) and older than 1 minute
  DELETE FROM games
  WHERE state = 0
  AND created_at < NOW() - INTERVAL '1 minute';
  
  -- Optional: Also cleanup very old finished games (older than 24 hours)
  DELETE FROM games
  WHERE state = 2
  AND finished_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job using pg_cron (if available) to run cleanup every minute
-- Note: pg_cron extension needs to be enabled in Supabase dashboard
-- Alternatively, this can be called from the backend API

-- Manual cleanup trigger (optional - can be called via API)
COMMENT ON FUNCTION cleanup_expired_games() IS 'Removes games in WAITING state older than 1 minute and finished games older than 24 hours';
