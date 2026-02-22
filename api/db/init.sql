-- ============================================================================
-- SquadOps Database Initialization Script
-- Complete schema with users, agents, tasks, swarms, and YouTube research
-- Run this on fresh PostgreSQL to create a fully working database
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

DO $$
BEGIN
    -- Drop existing types if they exist to allow re-running
    DROP TYPE IF EXISTS user_role CASCADE;
    DROP TYPE IF EXISTS user_status CASCADE;
    DROP TYPE IF EXISTS audit_action CASCADE;
    DROP TYPE IF EXISTS agent_status CASCADE;
    DROP TYPE IF EXISTS task_status CASCADE;
    DROP TYPE IF EXISTS task_priority CASCADE;
    DROP TYPE IF EXISTS research_status CASCADE;
END $$;

CREATE TYPE user_role AS ENUM ('admin', 'user', 'service_account');
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'pending_verification');
CREATE TYPE audit_action AS ENUM (
    'CREATE', 'READ', 'UPDATE', 'DELETE', 
    'LOGIN', 'LOGOUT', 'TOKEN_REFRESH', 'API_KEY_USED',
    'AGENT_START', 'AGENT_STOP', 'AGENT_PAUSE', 'AGENT_RESUME',
    'TASK_CREATE', 'TASK_ASSIGN', 'TASK_COMPLETE', 'TASK_FAIL',
    'SWARM_CREATE', 'SWARM_SCALE', 'SWARM_TERMINATE'
);
CREATE TYPE agent_status AS ENUM (
    'idle', 'running', 'paused', 'completed', 'failed', 'terminated'
);
CREATE TYPE task_status AS ENUM (
    'pending', 'assigned', 'in_progress', 'completed', 'failed', 'cancelled', 'retrying'
);
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE research_status AS ENUM (
    'queued', 'processing', 'completed', 'failed', 'cancelled'
);

-- ============================================================================
-- USER MANAGEMENT
-- ============================================================================

-- Users table with roles and authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role user_role NOT NULL DEFAULT 'user',
    status user_status NOT NULL DEFAULT 'active',
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at TIMESTAMPTZ,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    metadata JSONB DEFAULT '{}'
);

-- User profiles table (separated for extensibility)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    display_name VARCHAR(100),
    avatar_url TEXT,
    timezone VARCHAR(50) DEFAULT 'UTC',
    locale VARCHAR(10) DEFAULT 'en-US',
    company VARCHAR(255),
    job_title VARCHAR(100),
    bio TEXT,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Teams table
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Team members junction table
CREATE TABLE team_members (
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    PRIMARY KEY (team_id, user_id)
);

-- ============================================================================
-- AUTHENTICATION & AUTHORIZATION
-- ============================================================================

-- JWT Refresh tokens table
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revoked_reason VARCHAR(255),
    ip_address INET,
    user_agent TEXT
);

-- API Keys for service accounts and external integrations
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    key_prefix VARCHAR(8) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    key_prefix_old VARCHAR(20), -- Legacy field for compatibility
    scopes TEXT[] DEFAULT '{}',
    rate_limit_per_minute INTEGER DEFAULT 60,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    metadata JSONB DEFAULT '{}'
);

-- Provider Keys — BYOK (Bring Your Own Keys)
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

-- ============================================================================
-- AGENT SYSTEM
-- ============================================================================

-- Legacy agents table (21 SquadOps agents)
CREATE TABLE agents (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    specialty VARCHAR(100) NOT NULL,
    squad VARCHAR(50) NOT NULL, -- lead, engineering, business, ops
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, paused, error
    model VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent templates - define agent types and their configurations
CREATE TABLE agent_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    agent_type VARCHAR(50) NOT NULL, -- e.g., 'researcher', 'analyzer', 'writer'
    capabilities TEXT[] NOT NULL DEFAULT '{}',
    config_schema JSONB NOT NULL DEFAULT '{}',
    default_config JSONB NOT NULL DEFAULT '{}',
    docker_image VARCHAR(255),
    resource_requirements JSONB DEFAULT '{"cpu": 1, "memory": "512Mi"}',
    timeout_seconds INTEGER DEFAULT 300,
    max_retries INTEGER DEFAULT 3,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SWARM ORCHESTRATION SYSTEM
-- ============================================================================

-- Swarm orchestrators - manage groups of agents
CREATE TABLE swarm_orchestrators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    orchestrator_type VARCHAR(50) NOT NULL DEFAULT 'round_robin',
    max_agents INTEGER NOT NULL DEFAULT 10,
    min_agents INTEGER NOT NULL DEFAULT 1,
    scaling_config JSONB DEFAULT '{"auto_scale": true, "scale_up_threshold": 0.8}',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    terminated_at TIMESTAMPTZ,
    terminated_reason TEXT
);

-- Simplified swarms table (for basic use cases)
CREATE TABLE swarms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    config JSONB DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    agent_count INTEGER NOT NULL DEFAULT 0,
    completed_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- ============================================================================
-- OPENCLAW SWARM CONFIGURATIONS (New)
-- ============================================================================

-- Swarm configurations - stores templates for swarm setups
CREATE TABLE swarm_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    -- OpenClaw specific configuration
    openclaw_agent_ids TEXT[] NOT NULL DEFAULT '{}',
    coordination_mode VARCHAR(50) NOT NULL DEFAULT 'parallel',
    max_concurrent INTEGER NOT NULL DEFAULT 10,
    timeout_seconds INTEGER DEFAULT 300,
    retry_attempts INTEGER DEFAULT 2,
    -- Task configuration
    task_template VARCHAR(100),
    default_prompt TEXT,
    context JSONB DEFAULT '{}',
    -- Agent allocation settings
    agent_allocation_strategy VARCHAR(50) DEFAULT 'round_robin',
    load_balancing_enabled BOOLEAN DEFAULT TRUE,
    -- Metadata
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    is_public BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Swarm executions - tracks actual swarm runs
CREATE TABLE swarm_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    configuration_id UUID REFERENCES swarm_configurations(id) ON DELETE SET NULL,
    -- OpenClaw swarm reference
    openclaw_swarm_id VARCHAR(255),
    openclaw_session_ids TEXT[] DEFAULT '{}',
    -- Execution details
    name VARCHAR(255) NOT NULL,
    description TEXT,
    prompt TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- Progress tracking
    total_agents INTEGER NOT NULL DEFAULT 0,
    running_agents INTEGER NOT NULL DEFAULT 0,
    completed_agents INTEGER NOT NULL DEFAULT 0,
    failed_agents INTEGER NOT NULL DEFAULT 0,
    progress_percent INTEGER DEFAULT 0,
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    estimated_duration_seconds INTEGER,
    actual_duration_seconds INTEGER,
    -- Results summary
    results_summary JSONB,
    error_message TEXT,
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent allocations - tracks which agents are assigned to which executions
CREATE TABLE agent_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id UUID NOT NULL REFERENCES swarm_executions(id) ON DELETE CASCADE,
    openclaw_agent_id VARCHAR(100) NOT NULL,
    openclaw_session_id VARCHAR(255),
    -- Agent details from OpenClaw
    agent_name VARCHAR(100),
    agent_model VARCHAR(100),
    agent_workspace VARCHAR(255),
    -- Allocation status
    status VARCHAR(50) NOT NULL DEFAULT 'allocated',
    -- Task details
    task_id VARCHAR(255),
    task_payload JSONB DEFAULT '{}',
    -- Progress
    progress_percent INTEGER DEFAULT 0,
    -- Timing
    allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    -- Results
    result JSONB,
    error_message TEXT,
    -- Logs
    logs JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}'
);

-- Indexes for OpenClaw swarm tables
CREATE INDEX idx_swarm_configurations_created_by ON swarm_configurations(created_by);
CREATE INDEX idx_swarm_configurations_active ON swarm_configurations(is_active);
CREATE INDEX idx_swarm_executions_configuration ON swarm_executions(configuration_id);
CREATE INDEX idx_swarm_executions_status ON swarm_executions(status);
CREATE INDEX idx_swarm_executions_created_by ON swarm_executions(created_by);
CREATE INDEX idx_swarm_executions_created_at ON swarm_executions(created_at DESC);
CREATE INDEX idx_agent_allocations_execution ON agent_allocations(execution_id);
CREATE INDEX idx_agent_allocations_agent_id ON agent_allocations(openclaw_agent_id);
CREATE INDEX idx_agent_allocations_status ON agent_allocations(status);

-- Agent instances - running agent processes
CREATE TABLE agent_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    template_id UUID NOT NULL REFERENCES agent_templates(id),
    swarm_id UUID REFERENCES swarm_orchestrators(id) ON DELETE SET NULL,
    status agent_status NOT NULL DEFAULT 'idle',
    config JSONB NOT NULL DEFAULT '{}',
    current_task_id UUID,
    host_node VARCHAR(100),
    process_id VARCHAR(50),
    started_at TIMESTAMPTZ,
    last_heartbeat_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_count INTEGER NOT NULL DEFAULT 0,
    total_tasks_completed INTEGER NOT NULL DEFAULT 0,
    total_tasks_failed INTEGER NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Individual swarm agents (tasks)
CREATE TABLE swarm_agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    swarm_id UUID REFERENCES swarms(id) ON DELETE CASCADE,
    template_id VARCHAR(100) NOT NULL,
    task JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    progress INTEGER NOT NULL DEFAULT 0,
    result JSONB,
    error TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    timeout_seconds INTEGER DEFAULT 300,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Swarm events for real-time progress tracking
CREATE TABLE swarm_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    swarm_id UUID REFERENCES swarms(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES swarm_agents(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Swarm results aggregation
CREATE TABLE swarm_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    swarm_id UUID REFERENCES swarms(id) ON DELETE CASCADE,
    result_type VARCHAR(100) NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TASKS SYSTEM
-- ============================================================================

-- Tasks - work assigned to agents
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    task_type VARCHAR(50) NOT NULL DEFAULT 'general',
    status task_status NOT NULL DEFAULT 'pending',
    priority task_priority NOT NULL DEFAULT 'medium',
    
    -- Assignment
    swarm_id UUID REFERENCES swarm_orchestrators(id) ON DELETE SET NULL,
    assigned_agent_id UUID REFERENCES agent_instances(id) ON DELETE SET NULL,
    assigned_agent VARCHAR(50) REFERENCES agents(id),
    created_by VARCHAR(50) REFERENCES agents(id),
    parent_task_id UUID REFERENCES tasks(id),
    
    -- Task configuration
    input_payload JSONB NOT NULL DEFAULT '{}',
    expected_output_schema JSONB,
    timeout_seconds INTEGER DEFAULT 300,
    max_retries INTEGER DEFAULT 3,
    retry_count INTEGER NOT NULL DEFAULT 0,
    
    -- Execution tracking
    tags TEXT[] DEFAULT '{}',
    due_date TIMESTAMPTZ,
    deadline_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Dependencies
    depends_on UUID[],
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_by_user UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Results - agent outputs from task execution
CREATE TABLE results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agent_instances(id),
    
    -- Result data
    status VARCHAR(20) NOT NULL,
    output_payload JSONB,
    output_text TEXT,
    output_files JSONB,
    
    -- Execution metrics
    execution_time_ms INTEGER,
    tokens_used INTEGER,
    cost_estimate DECIMAL(10, 6),
    
    -- Error tracking
    error_code VARCHAR(50),
    error_message TEXT,
    stack_trace TEXT,
    
    -- Quality metrics
    quality_score DECIMAL(3, 2),
    validation_result JSONB,
    
    -- Storage
    storage_path TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Task dependencies junction table
CREATE TABLE task_dependencies (
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    depends_on_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    dependency_type VARCHAR(20) NOT NULL DEFAULT 'finish_to_start',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (task_id, depends_on_task_id)
);

-- Recurring Tasks
CREATE TABLE recurring_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    cron_expression VARCHAR(100) NOT NULL,
    assigned_agent VARCHAR(50) REFERENCES agents(id),
    enabled BOOLEAN DEFAULT true,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- AUDIT & LOGGING
-- ============================================================================

-- Legacy audit log
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(50) REFERENCES agents(id),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id VARCHAR(255),
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enhanced audit logs for compliance and security
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action audit_action NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    request_id VARCHAR(255),
    status VARCHAR(20) DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- COMMUNICATION
-- ============================================================================

-- Agent Messages (Group Chat)
CREATE TABLE agent_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_agent VARCHAR(50) REFERENCES agents(id),
    to_agent VARCHAR(50) REFERENCES agents(id),
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'chat',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- GOALS & TRACKING
-- ============================================================================

-- Goals / OKRs
CREATE TABLE goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    target_value DECIMAL,
    current_value DECIMAL DEFAULT 0,
    unit VARCHAR(50),
    deadline TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'active',
    workflow_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- WORKFLOWS & MULTI-AGENT ORCHESTRATION
-- ============================================================================

-- Workflow definitions
CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    workflow_type VARCHAR(50) NOT NULL DEFAULT 'sequential', -- sequential, parallel, conditional
    status VARCHAR(20) DEFAULT 'active', -- active, paused, archived
    config JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Workflow steps / nodes
CREATE TABLE workflow_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    agent_id VARCHAR(50) REFERENCES agents(id),
    step_type VARCHAR(50) NOT NULL DEFAULT 'agent', -- agent, condition, delay
    name VARCHAR(255) NOT NULL,
    config JSONB DEFAULT '{}',
    -- For conditional steps
    condition_expression TEXT,
    true_step_id UUID REFERENCES workflow_steps(id),
    false_step_id UUID REFERENCES workflow_steps(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Workflow execution history
CREATE TABLE workflow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id),
    status VARCHAR(20) DEFAULT 'pending', -- pending, running, completed, failed, cancelled
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    triggered_by UUID REFERENCES users(id),
    input_payload JSONB DEFAULT '{}',
    output_payload JSONB DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Individual step executions
CREATE TABLE workflow_step_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
    step_id UUID NOT NULL REFERENCES workflow_steps(id),
    status VARCHAR(20) DEFAULT 'pending', -- pending, running, completed, failed, skipped
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    agent_id VARCHAR(50),
    input_data JSONB DEFAULT '{}',
    output_data JSONB DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent trigger history
CREATE TABLE agent_triggers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(50) REFERENCES agents(id),
    triggered_by UUID REFERENCES users(id),
    input_params JSONB DEFAULT '{}',
    output_result JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending', -- pending, running, completed, failed
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for workflows
CREATE INDEX idx_workflows_created_by ON workflows(created_by);
CREATE INDEX idx_workflows_status ON workflows(status);
CREATE INDEX idx_workflow_steps_workflow ON workflow_steps(workflow_id);
CREATE INDEX idx_workflow_steps_order ON workflow_steps(workflow_id, step_order);
CREATE INDEX idx_workflow_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX idx_workflow_step_executions_execution ON workflow_step_executions(execution_id);
CREATE INDEX idx_agent_triggers_agent ON agent_triggers(agent_id);
CREATE INDEX idx_agent_triggers_status ON agent_triggers(status);

-- Trigger for workflow_steps updated_at
CREATE TRIGGER trigger_workflow_steps_updated_at
    BEFORE UPDATE ON workflow_steps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for workflows updated_at
CREATE TRIGGER trigger_workflows_updated_at
    BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for workflow_executions updated_at
CREATE TRIGGER trigger_workflow_executions_updated_at
    BEFORE UPDATE ON workflow_executions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for agent_triggers updated_at
CREATE TRIGGER trigger_agent_triggers_updated_at
    BEFORE UPDATE ON agent_triggers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- WORKFLOWS & MULTI-AGENT ORCHESTRATION
-- ============================================================================

-- Legacy: Simplified workflows table (kept for backward compatibility)
CREATE TABLE IF NOT EXISTS workflow_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    workflow_type VARCHAR(50) NOT NULL DEFAULT 'sequential',
    status VARCHAR(20) DEFAULT 'active',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Legacy: Workflow task steps
CREATE TABLE IF NOT EXISTS workflow_task_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflow_tasks(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    agent_id VARCHAR(50) REFERENCES agents(id),
    step_type VARCHAR(50) NOT NULL DEFAULT 'agent',
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Legacy triggers
CREATE TRIGGER trigger_workflow_tasks_updated_at
    BEFORE UPDATE ON workflow_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Legacy indexes
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_created_by ON workflow_tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_workflow_task_steps_workflow ON workflow_task_steps(workflow_id);

-- Usage Tracking
CREATE TABLE usage_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(50) REFERENCES agents(id),
    model VARCHAR(100) NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cost_usd DECIMAL(10, 6) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PREVIEWS & DEPLOYMENTS
-- ============================================================================

-- Previews — Agent-built app preview/deploy tracking
CREATE TABLE previews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_name VARCHAR(200) NOT NULL UNIQUE,
    preview_url VARCHAR(1000) NOT NULL,
    deploy_target VARCHAR(50) NOT NULL DEFAULT 'local',
    agent_id VARCHAR(50) REFERENCES agents(id),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- YOUTUBE RESEARCH DOMAIN
-- ============================================================================

-- Niche domains table (100+ niches)
CREATE TABLE niche_domains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    subcategory VARCHAR(50),
    
    -- Research configuration
    research_config JSONB DEFAULT '{}',
    keywords TEXT[] DEFAULT '{}',
    
    -- Statistics
    total_creators INTEGER NOT NULL DEFAULT 0,
    total_videos_analyzed INTEGER NOT NULL DEFAULT 0,
    last_research_at TIMESTAMPTZ,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    research_priority INTEGER DEFAULT 5,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- YouTube creators table
CREATE TABLE youtube_creators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    youtube_channel_id VARCHAR(50) UNIQUE NOT NULL,
    
    -- Channel info
    channel_name VARCHAR(255) NOT NULL,
    channel_handle VARCHAR(100),
    description TEXT,
    thumbnail_url TEXT,
    banner_url TEXT,
    
    -- Niche classification
    niche_id UUID REFERENCES niche_domains(id) ON DELETE SET NULL,
    detected_niches UUID[] DEFAULT '{}',
    
    -- Statistics (cached)
    subscriber_count BIGINT,
    total_views BIGINT,
    video_count INTEGER,
    
    -- Engagement metrics
    avg_views_per_video BIGINT,
    engagement_rate DECIMAL(5, 4),
    upload_frequency VARCHAR(20),
    
    -- Content analysis
    content_themes TEXT[] DEFAULT '{}',
    last_video_published_at TIMESTAMPTZ,
    
    -- Research tracking
    is_verified BOOLEAN DEFAULT FALSE,
    is_monetized BOOLEAN,
    country VARCHAR(2),
    language VARCHAR(10),
    
    -- Metadata
    social_links JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    
    first_discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_research_at TIMESTAMPTZ,
    
    -- Full-text search
    search_vector TSVECTOR
);

-- Research jobs table
CREATE TABLE research_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_type VARCHAR(50) NOT NULL,
    status research_status NOT NULL DEFAULT 'queued',
    
    -- Target specification
    niche_id UUID REFERENCES niche_domains(id) ON DELETE SET NULL,
    creator_id UUID REFERENCES youtube_creators(id) ON DELETE SET NULL,
    custom_query TEXT,
    
    -- Job configuration
    config JSONB NOT NULL DEFAULT '{}',
    priority INTEGER DEFAULT 5,
    
    -- Execution
    swarm_id UUID REFERENCES swarm_orchestrators(id),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Progress tracking
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    failed_tasks INTEGER DEFAULT 0,
    
    -- Results summary
    result_summary JSONB,
    result_count INTEGER DEFAULT 0,
    
    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Storage
    output_location TEXT,
    
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- YouTube videos (for detailed analysis)
CREATE TABLE youtube_videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    youtube_video_id VARCHAR(20) UNIQUE NOT NULL,
    creator_id UUID NOT NULL REFERENCES youtube_creators(id) ON DELETE CASCADE,
    
    -- Video info
    title VARCHAR(500) NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    published_at TIMESTAMPTZ NOT NULL,
    duration_seconds INTEGER,
    
    -- Statistics
    view_count BIGINT,
    like_count BIGINT,
    comment_count BIGINT,
    
    -- Content analysis
    tags TEXT[] DEFAULT '{}',
    category_id VARCHAR(50),
    language VARCHAR(10),
    
    -- Research data
    transcript_text TEXT,
    transcript_language VARCHAR(10),
    key_topics TEXT[] DEFAULT '{}',
    sentiment_score DECIMAL(3, 2),
    
    -- Research tracking
    research_job_id UUID REFERENCES research_jobs(id),
    analyzed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Full-text search
    search_vector TSVECTOR
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Users indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Refresh tokens indexes
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at) WHERE revoked_at IS NULL;

-- API Keys indexes
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON api_keys(is_active, expires_at);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);

-- Provider keys indexes
CREATE INDEX idx_provider_keys_user ON provider_keys(user_id);
CREATE INDEX idx_provider_keys_provider ON provider_keys(provider);

-- Audit logs indexes
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_request_id ON audit_logs(request_id);

-- Legacy audit log indexes
CREATE INDEX idx_audit_agent ON audit_log(agent_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- Agents indexes
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_squad ON agents(squad);

-- Agent templates indexes
CREATE INDEX idx_agent_templates_slug ON agent_templates(slug);
CREATE INDEX idx_agent_templates_type ON agent_templates(agent_type);
CREATE INDEX idx_agent_templates_active ON agent_templates(is_active);

-- Swarm indexes
CREATE INDEX idx_swarms_status ON swarms(status);
CREATE INDEX idx_swarms_created_by ON swarms(created_by);
CREATE INDEX idx_swarm_orchestrators_status ON swarm_orchestrators(status);
CREATE INDEX idx_swarm_orchestrators_created_by ON swarm_orchestrators(created_by);

-- Agent instances indexes
CREATE INDEX idx_agent_instances_template ON agent_instances(template_id);
CREATE INDEX idx_agent_instances_swarm ON agent_instances(swarm_id);
CREATE INDEX idx_agent_instances_status ON agent_instances(status);
CREATE INDEX idx_agent_instances_heartbeat ON agent_instances(last_heartbeat_at);
CREATE INDEX idx_agent_instances_created_by ON agent_instances(created_by);

-- Swarm agents indexes
CREATE INDEX idx_swarm_agents_swarm ON swarm_agents(swarm_id);
CREATE INDEX idx_swarm_agents_status ON swarm_agents(status);

-- Swarm events indexes
CREATE INDEX idx_swarm_events_swarm ON swarm_events(swarm_id);
CREATE INDEX idx_swarm_events_created ON swarm_events(created_at DESC);

-- Swarm results indexes
CREATE INDEX idx_swarm_results_swarm ON swarm_results(swarm_id);

-- Tasks indexes
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_swarm ON tasks(swarm_id);
CREATE INDEX idx_tasks_assigned_agent ON tasks(assigned_agent_id);
CREATE INDEX idx_tasks_assigned_agent_legacy ON tasks(assigned_agent);
CREATE INDEX idx_tasks_created_by ON tasks(created_by);
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX idx_tasks_created_by_user ON tasks(created_by_user);
CREATE INDEX idx_tasks_status_priority ON tasks(status, priority, created_at);
CREATE INDEX idx_tasks_deadline ON tasks(deadline_at) WHERE status IN ('pending', 'assigned', 'in_progress');

-- Results indexes
CREATE INDEX idx_results_task ON results(task_id);
CREATE INDEX idx_results_agent ON results(agent_id);
CREATE INDEX idx_results_status ON results(status);
CREATE INDEX idx_results_created_at ON results(created_at DESC);

-- Task dependencies indexes
CREATE INDEX idx_task_dependencies_depends_on ON task_dependencies(depends_on_task_id);

-- Messages indexes
CREATE INDEX idx_messages_from ON agent_messages(from_agent);
CREATE INDEX idx_messages_to ON agent_messages(to_agent);
CREATE INDEX idx_messages_created ON agent_messages(created_at DESC);

-- Usage indexes
CREATE INDEX idx_usage_agent ON usage_log(agent_id);
CREATE INDEX idx_usage_created ON usage_log(created_at DESC);

-- Previews indexes
CREATE INDEX idx_previews_status ON previews(status);
CREATE INDEX idx_previews_project ON previews(project_name);

-- Niche domains indexes
CREATE INDEX idx_niche_domains_slug ON niche_domains(slug);
CREATE INDEX idx_niche_domains_category ON niche_domains(category);
CREATE INDEX idx_niche_domains_active ON niche_domains(is_active);

-- YouTube creators indexes
CREATE INDEX idx_youtube_creators_channel_id ON youtube_creators(youtube_channel_id);
CREATE INDEX idx_youtube_creators_niche ON youtube_creators(niche_id);
CREATE INDEX idx_youtube_creators_subscribers ON youtube_creators(subscriber_count DESC);
CREATE INDEX idx_youtube_creators_updated ON youtube_creators(last_updated_at);
CREATE INDEX idx_youtube_creators_search ON youtube_creators USING GIN(search_vector);

-- Research jobs indexes
CREATE INDEX idx_research_jobs_status ON research_jobs(status);
CREATE INDEX idx_research_jobs_niche ON research_jobs(niche_id);
CREATE INDEX idx_research_jobs_creator ON research_jobs(creator_id);
CREATE INDEX idx_research_jobs_swarm ON research_jobs(swarm_id);
CREATE INDEX idx_research_jobs_created_by ON research_jobs(created_by);

-- YouTube videos indexes
CREATE INDEX idx_youtube_videos_video_id ON youtube_videos(youtube_video_id);
CREATE INDEX idx_youtube_videos_creator ON youtube_videos(creator_id);
CREATE INDEX idx_youtube_videos_published ON youtube_videos(published_at DESC);
CREATE INDEX idx_youtube_videos_research_job ON youtube_videos(research_job_id);
CREATE INDEX idx_youtube_videos_search ON youtube_videos USING GIN(search_vector);

-- Approvals indexes
CREATE INDEX idx_approvals_status ON approvals(status);

-- ============================================================================
-- TRIGGERS FOR updated_at TIMESTAMPS
-- ============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_provider_keys_updated_at
    BEFORE UPDATE ON provider_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_agent_templates_updated_at
    BEFORE UPDATE ON agent_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_swarm_orchestrators_updated_at
    BEFORE UPDATE ON swarm_orchestrators
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_swarms_updated_at
    BEFORE UPDATE ON swarms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Triggers for OpenClaw swarm tables
CREATE TRIGGER trigger_swarm_configurations_updated_at
    BEFORE UPDATE ON swarm_configurations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_swarm_executions_updated_at
    BEFORE UPDATE ON swarm_executions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_agent_instances_updated_at
    BEFORE UPDATE ON agent_instances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_results_updated_at
    BEFORE UPDATE ON results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_recurring_tasks_updated_at
    BEFORE UPDATE ON recurring_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_goals_updated_at
    BEFORE UPDATE ON goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_previews_updated_at
    BEFORE UPDATE ON previews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_niche_domains_updated_at
    BEFORE UPDATE ON niche_domains
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_youtube_creators_updated_at
    BEFORE UPDATE ON youtube_creators
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_youtube_videos_updated_at
    BEFORE UPDATE ON youtube_videos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_research_jobs_updated_at
    BEFORE UPDATE ON research_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FULL-TEXT SEARCH TRIGGER FUNCTIONS
-- ============================================================================

-- Update search vector for youtube_creators
CREATE OR REPLACE FUNCTION update_creator_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.channel_name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(NEW.content_themes, ' '), '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_creator_search_vector
    BEFORE INSERT OR UPDATE ON youtube_creators
    FOR EACH ROW EXECUTE FUNCTION update_creator_search_vector();

-- Update search vector for youtube_videos
CREATE OR REPLACE FUNCTION update_video_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.transcript_text, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'D');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_video_search_vector
    BEFORE INSERT OR UPDATE ON youtube_videos
    FOR EACH ROW EXECUTE FUNCTION update_video_search_vector();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE swarm_orchestrators ENABLE ROW LEVEL SECURITY;
ALTER TABLE swarms ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE niche_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube_creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_jobs ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role AS $$
BEGIN
    RETURN COALESCE(
        current_setting('app.current_user_role', true)::user_role,
        'user'::user_role
    );
EXCEPTION WHEN OTHERS THEN
    RETURN 'user'::user_role;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function to get current user ID
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_user_id', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Users table policies
CREATE POLICY users_select_own ON users
    FOR SELECT USING (
        id = current_user_id() 
        OR current_user_role() = 'admin'
    );

CREATE POLICY users_update_own ON users
    FOR UPDATE USING (
        id = current_user_id() 
        OR current_user_role() = 'admin'
    );

CREATE POLICY users_insert_admin ON users
    FOR INSERT WITH CHECK (current_user_role() = 'admin');

CREATE POLICY users_delete_admin ON users
    FOR DELETE USING (current_user_role() = 'admin');

-- User profiles policies
CREATE POLICY user_profiles_select_own ON user_profiles
    FOR SELECT USING (
        user_id = current_user_id() 
        OR current_user_role() = 'admin'
    );

CREATE POLICY user_profiles_update_own ON user_profiles
    FOR UPDATE USING (
        user_id = current_user_id() 
        OR current_user_role() = 'admin'
    );

-- Refresh tokens policies
CREATE POLICY refresh_tokens_user_isolation ON refresh_tokens
    FOR ALL USING (user_id = current_user_id());

-- API keys policies
CREATE POLICY api_keys_select_own ON api_keys
    FOR SELECT USING (
        user_id = current_user_id() 
        OR current_user_role() = 'admin'
    );

CREATE POLICY api_keys_modify_own ON api_keys
    FOR ALL USING (
        user_id = current_user_id() 
        OR current_user_role() = 'admin'
    );

-- Audit logs policies
CREATE POLICY audit_logs_select ON audit_logs
    FOR SELECT USING (
        user_id = current_user_id() 
        OR current_user_role() = 'admin'
    );

-- Agent templates policies
CREATE POLICY agent_templates_select ON agent_templates
    FOR SELECT USING (is_active = TRUE OR current_user_role() = 'admin');

CREATE POLICY agent_templates_modify_admin ON agent_templates
    FOR ALL USING (current_user_role() = 'admin');

-- Swarm orchestrators policies
CREATE POLICY swarm_orchestrators_select ON swarm_orchestrators
    FOR SELECT USING (
        created_by = current_user_id() 
        OR current_user_role() = 'admin'
    );

CREATE POLICY swarm_orchestrators_modify_own ON swarm_orchestrators
    FOR ALL USING (
        created_by = current_user_id() 
        OR current_user_role() = 'admin'
    );

-- Swarms policies
CREATE POLICY swarms_select ON swarms
    FOR SELECT USING (
        created_by = current_user_id() 
        OR current_user_role() = 'admin'
    );

CREATE POLICY swarms_modify_own ON swarms
    FOR ALL USING (
        created_by = current_user_id() 
        OR current_user_role() = 'admin'
    );

-- OpenClaw Swarm Configurations policies
CREATE POLICY swarm_configurations_select ON swarm_configurations
    FOR SELECT USING (
        is_public = TRUE 
        OR created_by = current_user_id() 
        OR current_user_role() = 'admin'
    );

CREATE POLICY swarm_configurations_modify_own ON swarm_configurations
    FOR ALL USING (
        created_by = current_user_id() 
        OR current_user_role() = 'admin'
    );

-- OpenClaw Swarm Executions policies
CREATE POLICY swarm_executions_select ON swarm_executions
    FOR SELECT USING (
        created_by = current_user_id() 
        OR current_user_role() = 'admin'
    );

CREATE POLICY swarm_executions_modify_own ON swarm_executions
    FOR ALL USING (
        created_by = current_user_id() 
        OR current_user_role() = 'admin'
    );

-- Agent Allocations policies
CREATE POLICY agent_allocations_select ON agent_allocations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM swarm_executions se 
            WHERE se.id = agent_allocations.execution_id 
            AND (se.created_by = current_user_id() OR current_user_role() = 'admin')
        )
    );

CREATE POLICY agent_allocations_modify_own ON agent_allocations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM swarm_executions se 
            WHERE se.id = agent_allocations.execution_id 
            AND (se.created_by = current_user_id() OR current_user_role() = 'admin')
        )
    );

-- Agent instances policies
CREATE POLICY agent_instances_select ON agent_instances
    FOR SELECT USING (
        created_by = current_user_id() 
        OR current_user_role() = 'admin'
    );

CREATE POLICY agent_instances_modify_own ON agent_instances
    FOR ALL USING (
        created_by = current_user_id() 
        OR current_user_role() = 'admin'
    );

-- Tasks policies
CREATE POLICY tasks_select ON tasks
    FOR SELECT USING (
        created_by_user = current_user_id() 
        OR current_user_role() = 'admin'
    );

CREATE POLICY tasks_modify_own ON tasks
    FOR ALL USING (
        created_by_user = current_user_id() 
        OR current_user_role() = 'admin'
    );

-- Results policies
CREATE POLICY results_select_task_owner ON results
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM tasks 
            WHERE tasks.id = results.task_id 
            AND (tasks.created_by_user = current_user_id() OR current_user_role() = 'admin')
        )
    );

-- Niche domains policies (everyone can read, only admins can modify)
CREATE POLICY niche_domains_select ON niche_domains
    FOR SELECT USING (TRUE);

CREATE POLICY niche_domains_modify_admin ON niche_domains
    FOR ALL USING (current_user_role() = 'admin');

-- YouTube creators policies (everyone can read)
CREATE POLICY youtube_creators_select ON youtube_creators
    FOR SELECT USING (TRUE);

CREATE POLICY youtube_creators_modify_admin ON youtube_creators
    FOR ALL USING (current_user_role() = 'admin');

-- YouTube videos policies (everyone can read)
CREATE POLICY youtube_videos_select ON youtube_videos
    FOR SELECT USING (TRUE);

CREATE POLICY youtube_videos_modify_admin ON youtube_videos
    FOR ALL USING (current_user_role() = 'admin');

-- Research jobs policies
CREATE POLICY research_jobs_select ON research_jobs
    FOR SELECT USING (
        created_by = current_user_id() 
        OR current_user_role() = 'admin'
    );

CREATE POLICY research_jobs_modify_own ON research_jobs
    FOR ALL USING (
        created_by = current_user_id() 
        OR current_user_role() = 'admin'
    );

-- ============================================================================
-- SEED DATA - CORE SYSTEM
-- ============================================================================

-- Initial admin user (password: 'admin123' - CHANGE IN PRODUCTION!)
-- Using bcrypt hash for 'admin123'
INSERT INTO users (
    id,
    email, 
    password_hash, 
    name,
    role, 
    status, 
    email_verified,
    created_at
) VALUES (
    '00000000-0000-0000-0000-000000000001'::UUID,
    'admin@squadops.ai',
    '$2a$10$N9qo8uLOickgx2ZMRZoMy.MqrqRm3TQMcyXEaYKPLSJ.Zk33Qh0Ra', -- admin123
    'System Administrator',
    'admin',
    'active',
    TRUE,
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- Admin profile
INSERT INTO user_profiles (
    user_id,
    first_name,
    last_name,
    display_name,
    timezone
) VALUES (
    '00000000-0000-0000-0000-000000000001'::UUID,
    'System',
    'Administrator',
    'Admin',
    'UTC'
) ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- SEED DATA - 21 SQUADOPS AGENTS
-- ============================================================================

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
  ('clerk', 'Clerk', 'Docs / Knowledge', 'ops', 'openrouter/moonshotai/kimi-k2.5')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SEED DATA - AGENT TEMPLATES
-- ============================================================================

INSERT INTO agent_templates (
    name,
    slug,
    description,
    version,
    agent_type,
    capabilities,
    config_schema,
    default_config,
    resource_requirements,
    timeout_seconds,
    is_system,
    created_by
) VALUES 
-- YouTube Research Agent
(
    'YouTube Research Agent',
    'youtube-researcher',
    'Specialized agent for discovering and analyzing YouTube content creators',
    '1.0.0',
    'researcher',
    ARRAY['youtube_api', 'data_extraction', 'content_analysis', 'sentiment_analysis'],
    '{"type": "object", "properties": {"search_query": {"type": "string"}, "max_results": {"type": "integer", "default": 50}, "include_transcripts": {"type": "boolean", "default": true}, "analysis_depth": {"type": "string", "enum": ["basic", "detailed", "comprehensive"], "default": "detailed"}}}'::JSONB,
    '{"max_results": 50, "include_transcripts": true, "analysis_depth": "detailed"}'::JSONB,
    '{"cpu": 1, "memory": "1Gi"}'::JSONB,
    600,
    TRUE,
    '00000000-0000-0000-0000-000000000001'::UUID
),
-- Content Analysis Agent
(
    'Content Analysis Agent',
    'content-analyzer',
    'Analyzes video content, extracts topics, and performs sentiment analysis',
    '1.0.0',
    'analyzer',
    ARRAY['nlp', 'topic_extraction', 'sentiment_analysis', 'trend_detection'],
    '{"type": "object", "properties": {"analysis_types": {"type": "array", "items": {"type": "string"}}, "language": {"type": "string", "default": "en"}}}'::JSONB,
    '{"analysis_types": ["topics", "sentiment", "engagement"], "language": "en"}'::JSONB,
    '{"cpu": 2, "memory": "2Gi"}'::JSONB,
    300,
    TRUE,
    '00000000-0000-0000-0000-000000000001'::UUID
),
-- Report Generation Agent
(
    'Report Generation Agent',
    'report-generator',
    'Generates comprehensive research reports from analyzed data',
    '1.0.0',
    'writer',
    ARRAY['report_generation', 'data_visualization', 'markdown', 'pdf_export'],
    '{"type": "object", "properties": {"report_format": {"type": "string", "enum": ["markdown", "pdf", "json"], "default": "markdown"}, "include_charts": {"type": "boolean", "default": true}}}'::JSONB,
    '{"report_format": "markdown", "include_charts": true}'::JSONB,
    '{"cpu": 1, "memory": "512Mi"}'::JSONB,
    300,
    TRUE,
    '00000000-0000-0000-0000-000000000001'::UUID
),
-- Data Validation Agent
(
    'Data Validation Agent',
    'data-validator',
    'Validates scraped data integrity and quality',
    '1.0.0',
    'validator',
    ARRAY['data_validation', 'schema_validation', 'quality_check'],
    '{"type": "object", "properties": {"strict_mode": {"type": "boolean", "default": true}, "validation_rules": {"type": "object"}}}'::JSONB,
    '{"strict_mode": true}'::JSONB,
    '{"cpu": 0.5, "memory": "256Mi"}'::JSONB,
    120,
    TRUE,
    '00000000-0000-0000-0000-000000000001'::UUID
),
-- Trend Detection Agent
(
    'Trend Detection Agent',
    'trend-detector',
    'Identifies emerging trends and patterns in content data',
    '1.0.0',
    'analyzer',
    ARRAY['trend_analysis', 'pattern_recognition', 'forecasting'],
    '{"type": "object", "properties": {"time_window_days": {"type": "integer", "default": 30}, "min_confidence": {"type": "number", "default": 0.7}}}'::JSONB,
    '{"time_window_days": 30, "min_confidence": 0.7}'::JSONB,
    '{"cpu": 1, "memory": "1Gi"}'::JSONB,
    600,
    TRUE,
    '00000000-0000-0000-0000-000000000001'::UUID
),
-- Competitor Analysis Agent
(
    'Competitor Analysis Agent',
    'competitor-analyzer',
    'Analyzes competitor channels and content strategies',
    '1.0.0',
    'analyzer',
    ARRAY['competitor_analysis', 'benchmarking', 'strategy_recommendation'],
    '{"type": "object", "properties": {"comparison_metrics": {"type": "array", "default": ["subscribers", "views", "engagement"]}, "time_period": {"type": "string", "default": "90d"}}}'::JSONB,
    '{"comparison_metrics": ["subscribers", "views", "engagement"], "time_period": "90d"}'::JSONB,
    '{"cpu": 1, "memory": "1Gi"}'::JSONB,
    300,
    TRUE,
    '00000000-0000-0000-0000-000000000001'::UUID
),
-- Keyword Research Agent
(
    'Keyword Research Agent',
    'keyword-researcher',
    'Discovers high-value keywords and search trends',
    '1.0.0',
    'researcher',
    ARRAY['keyword_research', 'seo_analysis', 'search_volume_analysis'],
    '{"type": "object", "properties": {"target_region": {"type": "string", "default": "US"}, "language": {"type": "string", "default": "en"}}}'::JSONB,
    '{"target_region": "US", "language": "en"}'::JSONB,
    '{"cpu": 0.5, "memory": "512Mi"}'::JSONB,
    180,
    TRUE,
    '00000000-0000-0000-0000-000000000001'::UUID
),
-- Content Strategy Agent
(
    'Content Strategy Agent',
    'content-strategist',
    'Develops content strategies based on research insights',
    '1.0.0',
    'strategist',
    ARRAY['content_strategy', 'audience_analysis', 'content_planning'],
    '{"type": "object", "properties": {"content_types": {"type": "array", "default": ["video", "shorts", "live"]}, "posting_frequency": {"type": "string", "default": "weekly"}}}'::JSONB,
    '{"content_types": ["video", "shorts", "live"], "posting_frequency": "weekly"}'::JSONB,
    '{"cpu": 1, "memory": "1Gi"}'::JSONB,
    300,
    TRUE,
    '00000000-0000-0000-0000-000000000001'::UUID
),
-- Outreach Agent
(
    'Outreach Agent',
    'outreach-specialist',
    'Handles creator outreach and collaboration management',
    '1.0.0',
    'outreach',
    ARRAY['email_composition', 'relationship_management', 'follow_up'],
    '{"type": "object", "properties": {"communication_style": {"type": "string", "default": "professional"}, "follow_up_days": {"type": "integer", "default": 7}}}'::JSONB,
    '{"communication_style": "professional", "follow_up_days": 7}'::JSONB,
    '{"cpu": 0.5, "memory": "512Mi"}'::JSONB,
    120,
    TRUE,
    '00000000-0000-0000-0000-000000000001'::UUID
),
-- Data Export Agent
(
    'Data Export Agent',
    'data-exporter',
    'Exports research data in various formats',
    '1.0.0',
    'exporter',
    ARRAY['data_export', 'format_conversion', 'csv_generation', 'json_export'],
    '{"type": "object", "properties": {"export_formats": {"type": "array", "default": ["json", "csv"]}, "include_metadata": {"type": "boolean", "default": true}}}'::JSONB,
    '{"export_formats": ["json", "csv"], "include_metadata": true}'::JSONB,
    '{"cpu": 0.5, "memory": "512Mi"}'::JSONB,
    120,
    TRUE,
    '00000000-0000-0000-0000-000000000001'::UUID
)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- SEED DATA - NICHE DOMAINS (20 Sample - Full 100 in seed.sql)
-- ============================================================================

INSERT INTO niche_domains (
    name,
    slug,
    description,
    category,
    subcategory,
    keywords,
    research_config,
    research_priority
) VALUES 
-- Technology
('Artificial Intelligence', 'artificial-intelligence', 'AI, machine learning, and neural networks content', 'technology', 'ai-ml', 
    ARRAY['AI', 'machine learning', 'deep learning', 'neural networks', 'ChatGPT', 'LLM', 'computer vision'],
    '{"min_subscribers": 10000, "content_type": ["tutorial", "news", "research"]}'::JSONB, 9),
('Cybersecurity', 'cybersecurity', 'Security, hacking, and privacy content', 'technology', 'security',
    ARRAY['cybersecurity', 'hacking', 'penetration testing', 'privacy', 'encryption', 'malware'],
    '{"min_subscribers": 5000, "content_type": ["tutorial", "news"]}'::JSONB, 8),
('Web Development', 'web-development', 'Frontend, backend, and full-stack development', 'technology', 'programming',
    ARRAY['web development', 'JavaScript', 'React', 'Node.js', 'HTML', 'CSS', 'full stack'],
    '{"min_subscribers": 10000, "content_type": ["tutorial", "project"]}'::JSONB, 9),
('Mobile Development', 'mobile-development', 'iOS and Android app development', 'technology', 'programming',
    ARRAY['mobile development', 'iOS', 'Android', 'React Native', 'Flutter', 'Swift'],
    '{"min_subscribers": 8000, "content_type": ["tutorial", "project"]}'::JSONB, 8),
('Cloud Computing', 'cloud-computing', 'AWS, Azure, GCP, and cloud architecture', 'technology', 'infrastructure',
    ARRAY['cloud computing', 'AWS', 'Azure', 'GCP', 'DevOps', 'serverless'],
    '{"min_subscribers": 10000, "content_type": ["tutorial", "architecture"]}'::JSONB, 8),
-- Entertainment
('Gaming', 'gaming', 'Video game reviews, gameplay, and esports', 'entertainment', 'gaming',
    ARRAY['gaming', 'gameplay', 'review', 'esports', 'walkthrough', 'lets play'],
    '{"min_subscribers": 50000, "content_type": ["gameplay", "review"]}'::JSONB, 10),
('Movie Reviews', 'movie-reviews', 'Film criticism and movie analysis', 'entertainment', 'movies',
    ARRAY['movie review', 'film analysis', 'cinema', 'Hollywood', 'movie breakdown'],
    '{"min_subscribers": 10000, "content_type": ["review", "analysis"]}'::JSONB, 7),
('Music', 'music', 'Music reviews, reactions, and discovery', 'entertainment', 'music',
    ARRAY['music', 'song review', 'album review', 'reaction', 'music discovery'],
    '{"min_subscribers": 20000, "content_type": ["reaction", "review"]}'::JSONB, 8),
-- Education
('Science Education', 'science-education', 'Physics, chemistry, biology, and general science', 'education', 'science',
    ARRAY['science', 'physics', 'chemistry', 'biology', 'astronomy', 'education'],
    '{"min_subscribers": 50000, "content_type": ["educational", "documentary"]}'::JSONB, 8),
('Language Learning', 'language-learning', 'Learning foreign languages', 'education', 'languages',
    ARRAY['language learning', 'Spanish', 'French', 'Japanese', 'English', 'learn language'],
    '{"min_subscribers": 10000, "content_type": ["tutorial", "lesson"]}'::JSONB, 7),
('Online Courses', 'online-courses', 'Educational courses and tutorials', 'education', 'e-learning',
    ARRAY['online courses', 'e-learning', 'tutorial', 'MOOC', 'skill development'],
    '{"min_subscribers": 15000, "content_type": ["tutorial", "course"]}'::JSONB, 8),
-- Business
('Entrepreneurship', 'entrepreneurship', 'Startups, business building, and entrepreneurship', 'business', 'startups',
    ARRAY['entrepreneurship', 'startup', 'business', 'founder', 'CEO', 'venture capital'],
    '{"min_subscribers": 20000, "content_type": ["interview", "advice"]}'::JSONB, 8),
('Personal Finance', 'personal-finance', 'Money management, investing, and financial literacy', 'business', 'finance',
    ARRAY['personal finance', 'investing', 'stocks', 'crypto', 'budget', 'money'],
    '{"min_subscribers": 25000, "content_type": ["educational", "analysis"]}'::JSONB, 9),
('Digital Marketing', 'digital-marketing', 'SEO, social media, and online marketing', 'business', 'marketing',
    ARRAY['digital marketing', 'SEO', 'social media', 'content marketing', 'growth hacking'],
    '{"min_subscribers": 15000, "content_type": ["tutorial", "case study"]}'::JSONB, 7),
-- Health & Fitness
('Fitness', 'fitness', 'Workouts, fitness tips, and health', 'health', 'fitness',
    ARRAY['fitness', 'workout', 'gym', 'exercise', 'health', 'training'],
    '{"min_subscribers": 30000, "content_type": ["tutorial", "workout"]}'::JSONB, 8),
('Mental Health', 'mental-health', 'Mental wellness, therapy, and self-care', 'health', 'wellness',
    ARRAY['mental health', 'therapy', 'anxiety', 'depression', 'self care', 'mindfulness'],
    '{"min_subscribers": 10000, "content_type": ["educational", "support"]}'::JSONB, 9),
('Nutrition', 'nutrition', 'Healthy eating, diets, and nutrition science', 'health', 'nutrition',
    ARRAY['nutrition', 'healthy eating', 'diet', 'weight loss', 'recipes', 'supplements'],
    '{"min_subscribers": 20000, "content_type": ["educational", "recipe"]}'::JSONB, 7),
-- Lifestyle
('Travel', 'travel', 'Travel vlogs, destinations, and tips', 'lifestyle', 'travel',
    ARRAY['travel', 'vlog', 'destination', 'backpacking', 'adventure', 'tourism'],
    '{"min_subscribers": 25000, "content_type": ["vlog", "guide"]}'::JSONB, 8),
('Cooking', 'cooking', 'Recipes, cooking techniques, and food culture', 'lifestyle', 'food',
    ARRAY['cooking', 'recipes', 'food', 'chef', 'baking', 'cuisine'],
    '{"min_subscribers": 20000, "content_type": ["recipe", "tutorial"]}'::JSONB, 7),
-- Creative
('Photography', 'photography', 'Photography tutorials, gear reviews, and techniques', 'creative', 'photography',
    ARRAY['photography', 'camera', 'photo editing', 'portrait', 'landscape', 'lightroom'],
    '{"min_subscribers": 15000, "content_type": ["tutorial", "review"]}'::JSONB, 7)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View for user statistics
CREATE OR REPLACE VIEW user_stats AS
SELECT 
    u.id,
    u.email,
    u.role,
    u.status,
    u.created_at,
    u.last_login_at,
    p.display_name,
    p.company,
    COUNT(DISTINCT ai.id) AS agent_count,
    COUNT(DISTINCT t.id) AS task_count,
    COUNT(DISTINCT rj.id) AS research_job_count
FROM users u
LEFT JOIN user_profiles p ON u.id = p.user_id
LEFT JOIN agent_instances ai ON u.id = ai.created_by
LEFT JOIN tasks t ON u.id = t.created_by_user
LEFT JOIN research_jobs rj ON u.id = rj.created_by
GROUP BY u.id, p.display_name, p.company;

-- View for swarm status
CREATE OR REPLACE VIEW swarm_status AS
SELECT 
    s.id,
    s.name,
    s.status,
    s.max_agents,
    s.min_agents,
    COUNT(DISTINCT ai.id) AS current_agents,
    COUNT(DISTINCT CASE WHEN ai.status = 'running' THEN ai.id END) AS active_agents,
    COUNT(DISTINCT t.id) AS total_tasks,
    COUNT(DISTINCT CASE WHEN t.status = 'pending' THEN t.id END) AS pending_tasks,
    COUNT(DISTINCT CASE WHEN t.status = 'in_progress' THEN t.id END) AS in_progress_tasks,
    COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) AS completed_tasks,
    COUNT(DISTINCT CASE WHEN t.status = 'failed' THEN t.id END) AS failed_tasks
FROM swarm_orchestrators s
LEFT JOIN agent_instances ai ON s.id = ai.swarm_id
LEFT JOIN tasks t ON s.id = t.swarm_id
GROUP BY s.id;

-- View for research job summary
CREATE OR REPLACE VIEW research_job_summary AS
SELECT 
    rj.id,
    rj.job_type,
    rj.status,
    rj.priority,
    nd.name AS niche_name,
    yc.channel_name AS creator_name,
    rj.started_at,
    rj.completed_at,
    rj.total_tasks,
    rj.completed_tasks,
    rj.failed_tasks,
    CASE 
        WHEN rj.total_tasks > 0 
        THEN ROUND((rj.completed_tasks::DECIMAL / rj.total_tasks) * 100, 2)
        ELSE 0 
    END AS completion_percentage,
    rj.created_at
FROM research_jobs rj
LEFT JOIN niche_domains nd ON rj.niche_id = nd.id
LEFT JOIN youtube_creators yc ON rj.creator_id = yc.id;

-- ============================================================================
-- STORED PROCEDURES
-- ============================================================================

-- Create a new swarm with initial agents
CREATE OR REPLACE FUNCTION create_swarm_with_agents(
    p_name VARCHAR(100),
    p_description TEXT,
    p_orchestrator_type VARCHAR(50),
    p_max_agents INTEGER,
    p_template_slugs TEXT[],
    p_created_by UUID
)
RETURNS UUID AS $$
DECLARE
    v_swarm_id UUID;
    v_template_id UUID;
    v_slug TEXT;
BEGIN
    INSERT INTO swarm_orchestrators (
        name, description, orchestrator_type, max_agents, min_agents, created_by
    ) VALUES (
        p_name, p_description, p_orchestrator_type, p_max_agents, 
        LEAST(1, p_max_agents), p_created_by
    ) RETURNING id INTO v_swarm_id;
    
    FOREACH v_slug IN ARRAY p_template_slugs
    LOOP
        SELECT id INTO v_template_id FROM agent_templates WHERE slug = v_slug;
        IF v_template_id IS NOT NULL THEN
            INSERT INTO agent_instances (
                name, template_id, swarm_id, status, created_by, config
            ) VALUES (
                p_name || ' - ' || v_slug,
                v_template_id,
                v_swarm_id,
                'idle',
                p_created_by,
                '{}'::JSONB
            );
        END IF;
    END LOOP;
    
    RETURN v_swarm_id;
END;
$$ LANGUAGE plpgsql;

-- Clean up expired refresh tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM refresh_tokens 
    WHERE expires_at < NOW() 
       OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '7 days');
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Archive old audit logs
CREATE OR REPLACE FUNCTION archive_old_audit_logs(p_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM audit_logs 
    WHERE created_at < NOW() - INTERVAL '1 day' * p_days;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE users IS 'Core user accounts with authentication and role information';
COMMENT ON TABLE user_profiles IS 'Extended user profile information';
COMMENT ON TABLE refresh_tokens IS 'JWT refresh tokens for session management';
COMMENT ON TABLE api_keys IS 'API keys for service accounts and external integrations';
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for all system actions';
COMMENT ON TABLE agents IS 'Legacy SquadOps agent registry (21 agents)';
COMMENT ON TABLE agent_templates IS 'Reusable agent configurations and definitions';
COMMENT ON TABLE swarm_orchestrators IS 'Manages groups of agent instances';
COMMENT ON TABLE swarms IS 'Simplified swarm management table';
COMMENT ON TABLE agent_instances IS 'Running instances of agent templates';
COMMENT ON TABLE tasks IS 'Work units assigned to agents';
COMMENT ON TABLE results IS 'Output and results from task execution';
COMMENT ON TABLE niche_domains IS 'YouTube content niche categories for research';
COMMENT ON TABLE youtube_creators IS 'YouTube channel profiles and statistics';
COMMENT ON TABLE youtube_videos IS 'Individual YouTube video metadata and analysis';
COMMENT ON TABLE research_jobs IS 'Research job tracking and management';

-- ============================================================================
-- PHASE 8: DATABASE SCHEMA UPDATES
-- ============================================================================

-- ============================================================================
-- NEW TABLES FOR USAGE LIMITS, WORKFLOWS, AND NOTIFICATIONS
-- ============================================================================

-- Usage limits by tier
CREATE TABLE usage_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tier_name VARCHAR(50) NOT NULL UNIQUE,
    requests_limit INTEGER NOT NULL DEFAULT 0,
    tokens_limit INTEGER NOT NULL DEFAULT 0,
    features JSONB DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Workflow definitions
CREATE TABLE workflow_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    steps JSONB NOT NULL DEFAULT '[]',
    config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Workflow executions
CREATE TABLE workflow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    input_payload JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    results JSONB DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notification preferences
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    types JSONB DEFAULT '{"task": true, "workflow": true, "system": true, "team": true}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- ADD MISSING COLUMNS TO EXISTING TABLES
-- ============================================================================

-- Add columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS tier VARCHAR(50) DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_from_ip INET;

-- Add columns to user_profiles table
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Add columns to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_goal_id UUID REFERENCES goals(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_hours DECIMAL(6, 2);

-- Add columns to goals table
ALTER TABLE goals ADD COLUMN IF NOT EXISTS progress_percentage DECIMAL(5, 2) DEFAULT 0;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS target_date TIMESTAMPTZ;

-- Add user_id to usage_log for tracking
ALTER TABLE usage_log ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================================
-- ADD NEW INDEXES FOR PERFORMANCE
-- ============================================================================

-- Composite index on users(email, status)
CREATE INDEX IF NOT EXISTS idx_users_email_status ON users(email, status);

-- Composite index on tasks(user_id, status)
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(created_by_user, status);

-- Composite index on usage_log(user_id, created_at)
CREATE INDEX IF NOT EXISTS idx_usage_log_user_created ON usage_log(user_id, created_at DESC);

-- Index on workflow_executions(workflow_id, status)
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_status ON workflow_executions(workflow_id, status);

-- Additional useful indexes
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_user ON workflow_definitions(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON notification_preferences(user_id);

-- Add trigger for usage_limits updated_at
CREATE TRIGGER trigger_usage_limits_updated_at
    BEFORE UPDATE ON usage_limits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add trigger for workflow_definitions updated_at
CREATE TRIGGER trigger_workflow_definitions_updated_at
    BEFORE UPDATE ON workflow_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add trigger for workflow_executions updated_at
CREATE TRIGGER trigger_workflow_executions_updated_at
    BEFORE UPDATE ON workflow_executions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add trigger for notification_preferences updated_at
CREATE TRIGGER trigger_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DATA FOR USAGE LIMITS
-- ============================================================================

INSERT INTO usage_limits (tier_name, requests_limit, tokens_limit, features, is_active) VALUES
    ('free', 100, 10000, '{"api_access": false, "custom_workflows": false, "priority_support": false}'::JSONB, TRUE),
    ('starter', 1000, 100000, '{"api_access": true, "custom_workflows": false, "priority_support": false}'::JSONB, TRUE),
    ('pro', 10000, 1000000, '{"api_access": true, "custom_workflows": true, "priority_support": false}'::JSONB, TRUE),
    ('enterprise', -1, -1, '{"api_access": true, "custom_workflows": true, "priority_support": true, "sla": true}'::JSONB, TRUE)
ON CONFLICT (tier_name) DO NOTHING;

-- ============================================================================
-- END OF INIT.SQL
-- ============================================================================

-- Team invites table
CREATE TABLE IF NOT EXISTS team_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    UNIQUE(email, invited_by)
);

-- Index for faster lookup
CREATE INDEX IF NOT EXISTS idx_team_invites_invited_by ON team_invites(invited_by);
CREATE INDEX IF NOT EXISTS idx_team_invites_email ON team_invites(email);
