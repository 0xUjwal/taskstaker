-- Run this in Supabase SQL Editor to create the required tables

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_id TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  unique_id TEXT UNIQUE NOT NULL,
  wallet_address TEXT,
  completed_tasks INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  task_id INT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task validator assignments (real validator, tracked off-chain)
-- On-chain validator address = RELAYER_ADDRESS, real validator stored here
CREATE TABLE IF NOT EXISTS task_validators (
  task_id INT NOT NULL PRIMARY KEY,
  validator_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  task_name TEXT DEFAULT '',
  owner_username TEXT DEFAULT '',
  validator_username TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_validators_validator ON task_validators(validator_user_id);
CREATE INDEX IF NOT EXISTS idx_task_validators_owner ON task_validators(owner_user_id);

CREATE POLICY "Service role full access on task_validators" ON task_validators
  FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE task_validators ENABLE ROW LEVEL SECURITY;

-- AI analyses table
CREATE TABLE IF NOT EXISTS ai_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id INT NOT NULL,
  analysis JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_ai_analyses_task ON ai_analyses(task_id);

-- Enable Realtime for notifications table (for live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Storage bucket (run in Supabase dashboard or via API)
-- Create a public bucket called "taskstaker" with 10MB file size limit

-- Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (backend uses service key)
CREATE POLICY "Service role full access on users" ON users
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on notifications" ON notifications
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on ai_analyses" ON ai_analyses
  FOR ALL USING (true) WITH CHECK (true);
