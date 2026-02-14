-- SquadOps Database Schema
-- Tasks, Audit Log, Approvals, Users, Usage, Goals

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Users & Teams
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'member', -- admin, member, viewer
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE team_members (
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  PRIMARY KEY (team_id, user_id)
);

-- ============================================================
-- API Keys — for programmatic access
-- ============================================================
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix VARCHAR(20) NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);

-- ============================================================
-- Provider Keys — BYOK (Bring Your Own Keys)
-- ============================================================
CREATE TABLE provider_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  key_data TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

CREATE INDEX idx_provider_keys_user ON provider_keys(user_id);
CREATE INDEX idx_provider_keys_provider ON provider_keys(provider);

-- ============================================================
-- Agents
-- ============================================================
CREATE TABLE agents (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  specialty VARCHAR(100) NOT NULL,
  squad VARCHAR(50) NOT NULL, -- lead, engineering, business, ops
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, paused, error
  model VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed all 21 agents
INSERT INTO agents (id, name, specialty, squad, model) VALUES
  ('marus', 'MaruS', 'Orchestrator / Lead', 'lead', 'openrouter/moonshotai/kimi-k2.5'),
  ('forge', 'Forge', 'Backend Dev', 'engineering', 'openrouter/moonshotai/kimi-k2.5'),
  ('canvas', 'Canvas', 'Frontend / UI Dev', 'engineering', 'openrouter/moonshotai/kimi-k2.5'),
  ('helm', 'Helm', 'DevOps / Infra', 'engineering', 'openrouter/moonshotai/kimi-k2.5'),
  ('aegis', 'Aegis', 'QA / Testing', 'engineering', 'openrouter/moonshotai/kimi-k2.5'),
  ('vault', 'Vault', 'DBA / Database', 'engineering', 'openrouter/moonshotai/kimi-k2.5'),
  ('architect', 'Architect', 'System Design', 'engineering', 'openrouter/moonshotai/kimi-k2.5'),
  ('patcher', 'Patcher', 'Code Review / Refactor', 'engineering', 'openrouter/moonshotai/kimi-k2.5'),
  ('scout', 'Scout', 'Research', 'business', 'openrouter/moonshotai/kimi-k2.5'),
  ('scribe', 'Scribe', 'Content Writer', 'business', 'openrouter/moonshotai/kimi-k2.5'),
  ('sentinel', 'Sentinel', 'Retention', 'business', 'openrouter/moonshotai/kimi-k2.5'),
  ('lens', 'Lens', 'SEO', 'business', 'openrouter/moonshotai/kimi-k2.5'),
  ('herald', 'Herald', 'Outreach / Sales', 'business', 'openrouter/moonshotai/kimi-k2.5'),
  ('oracle', 'Oracle', 'Analytics', 'business', 'openrouter/moonshotai/kimi-k2.5'),
  ('guide', 'Guide', 'Onboarding', 'business', 'openrouter/moonshotai/kimi-k2.5'),
  ('beacon', 'Beacon', 'Social Media', 'business', 'openrouter/moonshotai/kimi-k2.5'),
  ('shield', 'Shield', 'Customer Support', 'business', 'openrouter/moonshotai/kimi-k2.5'),
  ('compass', 'Compass', 'Strategy / Planning', 'business', 'openrouter/moonshotai/kimi-k2.5'),
  ('warden', 'Warden', 'Security / Audit', 'ops', 'openrouter/moonshotai/kimi-k2.5'),
  ('prism', 'Prism', 'Design / UX', 'ops', 'openrouter/moonshotai/kimi-k2.5'),
  ('clerk', 'Clerk', 'Docs / Knowledge', 'ops', 'openrouter/moonshotai/kimi-k2.5');

-- ============================================================
-- Tasks
-- ============================================================
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, cancelled, blocked
  priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, urgent
  assigned_agent VARCHAR(50) REFERENCES agents(id),
  created_by VARCHAR(50) REFERENCES agents(id),
  parent_task_id UUID REFERENCES tasks(id),
  tags TEXT[] DEFAULT '{}',
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_agent);
CREATE INDEX idx_tasks_created_by ON tasks(created_by);

-- ============================================================
-- Audit Log
-- ============================================================
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id VARCHAR(50) REFERENCES agents(id),
  action VARCHAR(100) NOT NULL, -- task.created, task.completed, email.drafted, code.pushed, approval.requested
  target_type VARCHAR(50), -- task, email, code, config, approval
  target_id VARCHAR(255),
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_agent ON audit_log(agent_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- ============================================================
-- Approvals
-- ============================================================
CREATE TABLE approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id VARCHAR(50) REFERENCES agents(id),
  action_type VARCHAR(100) NOT NULL, -- deploy, send_email, publish, delete
  title VARCHAR(500) NOT NULL,
  description TEXT,
  payload JSONB DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_approvals_status ON approvals(status);

-- ============================================================
-- Agent Messages (Group Chat)
-- ============================================================
CREATE TABLE agent_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_agent VARCHAR(50) REFERENCES agents(id),
  to_agent VARCHAR(50) REFERENCES agents(id), -- NULL = broadcast
  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'chat', -- chat, finding, handoff, report
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_from ON agent_messages(from_agent);
CREATE INDEX idx_messages_created ON agent_messages(created_at DESC);

-- ============================================================
-- Goals / OKRs
-- ============================================================
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  target_value DECIMAL,
  current_value DECIMAL DEFAULT 0,
  unit VARCHAR(50), -- ARR, users, conversions, %
  deadline TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'active', -- active, achieved, missed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Usage Tracking
-- ============================================================
CREATE TABLE usage_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id VARCHAR(50) REFERENCES agents(id),
  model VARCHAR(100) NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd DECIMAL(10, 6) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usage_agent ON usage_log(agent_id);
CREATE INDEX idx_usage_created ON usage_log(created_at DESC);

-- ============================================================
-- Recurring Tasks
-- ============================================================
CREATE TABLE recurring_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  cron_expression VARCHAR(100) NOT NULL, -- e.g. "0 9 * * *" = daily 9am
  assigned_agent VARCHAR(50) REFERENCES agents(id),
  enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Previews — Agent-built app preview/deploy tracking
-- ============================================================
CREATE TABLE previews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_name VARCHAR(200) NOT NULL UNIQUE,
  preview_url VARCHAR(1000) NOT NULL,
  deploy_target VARCHAR(50) NOT NULL DEFAULT 'local', -- local, s3, cloudflare
  agent_id VARCHAR(50) REFERENCES agents(id),
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, stopped, failed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_previews_status ON previews(status);
CREATE INDEX idx_previews_project ON previews(project_name);
