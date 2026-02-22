-- ============================================================================
-- SquadOps Database Migration: Phase 4 AI Provider Management
-- Adds user preferences, provider usage tracking, and free tier limits
-- ============================================================================

-- 1. Add user_id and provider columns to usage_log for user-based tracking
ALTER TABLE usage_log ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE usage_log ADD COLUMN IF NOT EXISTS provider VARCHAR(50);

-- Ensure user_id is NOT NULL in provider_keys (fix if exists as nullable)
ALTER TABLE provider_keys ALTER COLUMN user_id SET NOT NULL;

-- Create index for user-based usage queries
CREATE INDEX IF NOT EXISTS idx_usage_log_user ON usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_log_user_created ON usage_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_log_provider ON usage_log(provider);

-- 2. Create user_preferences table for storing default provider and tier info
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    default_provider VARCHAR(50) DEFAULT 'minimax',
    tier VARCHAR(20) DEFAULT 'free',
    free_requests_used INTEGER DEFAULT 0,
    free_requests_limit INTEGER DEFAULT 1000,
    free_tokens_used INTEGER DEFAULT 0,
    free_tokens_limit INTEGER DEFAULT 100000,
    last_usage_reset TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for user preferences
CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);

-- 3. Add default provider preference for users who don't have one
INSERT INTO user_preferences (user_id, default_provider, tier, free_requests_limit, free_tokens_limit)
SELECT id, 'minimax', 'free', 1000, 100000
FROM users
WHERE id NOT IN (SELECT user_id FROM user_preferences)
ON CONFLICT (user_id) DO NOTHING;

-- 4. Create trigger for updating user_preferences updated_at
CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER trigger_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_user_preferences_updated_at();

-- 5. Update provider_keys to include provider_display_name for UI
ALTER TABLE provider_keys ADD COLUMN IF NOT EXISTS provider_display_name VARCHAR(100);
ALTER TABLE provider_keys ADD COLUMN IF NOT EXISTS masked_key VARCHAR(50);

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
