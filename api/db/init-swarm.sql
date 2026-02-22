-- ============================================================
-- Swarm / Agent Swarm Orchestration System
-- ============================================================

-- Swarms - groups of agents working on parallel tasks
CREATE TABLE swarms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  config JSONB DEFAULT '{}',
  status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, paused, completed, terminated
  agent_count INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_swarms_status ON swarms(status);
CREATE INDEX idx_swarms_created_by ON swarms(created_by);

-- Individual swarm agents (tasks)
CREATE TABLE swarm_agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  swarm_id UUID REFERENCES swarms(id) ON DELETE CASCADE,
  template_id VARCHAR(100) NOT NULL, -- e.g., 'youtube-researcher'
  task JSONB NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, timeout
  progress INTEGER NOT NULL DEFAULT 0, -- 0-100
  result JSONB,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  timeout_seconds INTEGER DEFAULT 300,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_swarm_agents_swarm ON swarm_agents(swarm_id);
CREATE INDEX idx_swarm_agents_status ON swarm_agents(status);

-- Swarm events for real-time progress tracking
CREATE TABLE swarm_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  swarm_id UUID REFERENCES swarms(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES swarm_agents(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- agent_spawned, agent_progress, agent_complete, agent_error, swarm_complete
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_swarm_events_swarm ON swarm_events(swarm_id);
CREATE INDEX idx_swarm_events_created ON swarm_events(created_at DESC);

-- Swarm results aggregation
CREATE TABLE swarm_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  swarm_id UUID REFERENCES swarms(id) ON DELETE CASCADE,
  result_type VARCHAR(100) NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_swarm_results_swarm ON swarm_results(swarm_id);
