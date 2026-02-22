-- ============================================================================
-- SquadOps - AI Operations Platform Database Schema
-- PostgreSQL 15+ with Row Level Security (RLS)
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

-- User role enumeration
CREATE TYPE user_role AS ENUM ('admin', 'user', 'service_account');

-- User status enumeration
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'pending_verification');

-- Audit action types
CREATE TYPE audit_action AS ENUM (
    'CREATE', 'READ', 'UPDATE', 'DELETE', 
    'LOGIN', 'LOGOUT', 'TOKEN_REFRESH', 'API_KEY_USED',
    'AGENT_START', 'AGENT_STOP', 'AGENT_PAUSE', 'AGENT_RESUME',
    'TASK_CREATE', 'TASK_ASSIGN', 'TASK_COMPLETE', 'TASK_FAIL',
    'SWARM_CREATE', 'SWARM_SCALE', 'SWARM_TERMINATE'
);

-- Agent instance status
CREATE TYPE agent_status AS ENUM (
    'idle', 'running', 'paused', 'completed', 'failed', 'terminated'
);

-- Task status enumeration
CREATE TYPE task_status AS ENUM (
    'pending', 'assigned', 'in_progress', 'completed', 'failed', 'cancelled', 'retrying'
);

-- Task priority enumeration
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'critical');

-- Research job status
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
    role user_role NOT NULL DEFAULT 'user',
    status user_status NOT NULL DEFAULT 'pending_verification',
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
    scopes TEXT[] DEFAULT '{}',
    rate_limit_per_minute INTEGER DEFAULT 60,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    metadata JSONB DEFAULT '{}'
);

-- Audit logs for compliance and security
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
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for audit logs
CREATE TABLE audit_logs_2024_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE audit_logs_2024_02 PARTITION OF audit_logs
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
-- Add more partitions as needed or use pg_partman

-- ============================================================================
-- AGENT SWARM SYSTEM
-- ============================================================================

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

-- Swarm orchestrators - manage groups of agents
CREATE TABLE swarm_orchestrators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    orchestrator_type VARCHAR(50) NOT NULL DEFAULT 'round_robin', -- round_robin, priority_queue, load_balanced
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

-- Tasks - work assigned to agents
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    task_type VARCHAR(50) NOT NULL,
    status task_status NOT NULL DEFAULT 'pending',
    priority task_priority NOT NULL DEFAULT 'medium',
    
    -- Assignment
    swarm_id UUID REFERENCES swarm_orchestrators(id) ON DELETE SET NULL,
    assigned_agent_id UUID REFERENCES agent_instances(id) ON DELETE SET NULL,
    
    -- Task configuration
    input_payload JSONB NOT NULL DEFAULT '{}',
    expected_output_schema JSONB,
    timeout_seconds INTEGER DEFAULT 300,
    max_retries INTEGER DEFAULT 3,
    retry_count INTEGER NOT NULL DEFAULT 0,
    
    -- Execution tracking
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    deadline_at TIMESTAMPTZ,
    
    -- Dependencies
    parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    depends_on UUID[], -- Array of task IDs this task depends on
    
    -- Metadata
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    
    -- Ownership
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Results - agent outputs from task execution
CREATE TABLE results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agent_instances(id),
    
    -- Result data
    status VARCHAR(20) NOT NULL, -- success, partial, failure
    output_payload JSONB,
    output_text TEXT,
    output_files JSONB, -- Array of file references
    
    -- Execution metrics
    execution_time_ms INTEGER,
    tokens_used INTEGER,
    cost_estimate DECIMAL(10, 6),
    
    -- Error tracking
    error_code VARCHAR(50),
    error_message TEXT,
    stack_trace TEXT,
    
    -- Quality metrics
    quality_score DECIMAL(3, 2), -- 0.00 to 1.00
    validation_result JSONB,
    
    -- Storage
    storage_path TEXT, -- S3/MinIO path for large outputs
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Task dependencies junction table (for complex dependency graphs)
CREATE TABLE task_dependencies (
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    depends_on_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    dependency_type VARCHAR(20) NOT NULL DEFAULT 'finish_to_start', -- finish_to_start, start_to_start, finish_to_finish, start_to_finish
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (task_id, depends_on_task_id)
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
    category VARCHAR(50) NOT NULL, -- e.g., 'technology', 'entertainment', 'education'
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
    research_priority INTEGER DEFAULT 5, -- 1-10 scale
    
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
    detected_niches UUID[] DEFAULT '{}', -- Can belong to multiple niches
    
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
    job_type VARCHAR(50) NOT NULL, -- 'niche_discovery', 'creator_analysis', 'trend_research'
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
    output_location TEXT, -- S3/MinIO path for results
    
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
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at) 
    WHERE revoked_at IS NULL;

-- API Keys indexes
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON api_keys(is_active, expires_at);

-- Audit logs indexes
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_request_id ON audit_logs(request_id);

-- Agent templates indexes
CREATE INDEX idx_agent_templates_slug ON agent_templates(slug);
CREATE INDEX idx_agent_templates_type ON agent_templates(agent_type);
CREATE INDEX idx_agent_templates_active ON agent_templates(is_active);

-- Swarm orchestrators indexes
CREATE INDEX idx_swarm_orchestrators_status ON swarm_orchestrators(status);
CREATE INDEX idx_swarm_orchestrators_created_by ON swarm_orchestrators(created_by);

-- Agent instances indexes
CREATE INDEX idx_agent_instances_template ON agent_instances(template_id);
CREATE INDEX idx_agent_instances_swarm ON agent_instances(swarm_id);
CREATE INDEX idx_agent_instances_status ON agent_instances(status);
CREATE INDEX idx_agent_instances_heartbeat ON agent_instances(last_heartbeat_at);
CREATE INDEX idx_agent_instances_created_by ON agent_instances(created_by);

-- Tasks indexes
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_swarm ON tasks(swarm_id);
CREATE INDEX idx_tasks_assigned_agent ON tasks(assigned_agent_id);
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX idx_tasks_created_by ON tasks(created_by);
CREATE INDEX idx_tasks_status_priority ON tasks(status, priority, created_at);
CREATE INDEX idx_tasks_deadline ON tasks(deadline_at) WHERE status IN ('pending', 'assigned', 'in_progress');

-- Results indexes
CREATE INDEX idx_results_task ON results(task_id);
CREATE INDEX idx_results_agent ON results(agent_id);
CREATE INDEX idx_results_status ON results(status);
CREATE INDEX idx_results_created_at ON results(created_at DESC);

-- Task dependencies indexes
CREATE INDEX idx_task_dependencies_depends_on ON task_dependencies(depends_on_task_id);

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

CREATE TRIGGER trigger_agent_templates_updated_at
    BEFORE UPDATE ON agent_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_swarm_orchestrators_updated_at
    BEFORE UPDATE ON swarm_orchestrators
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
-- AUDIT LOG TRIGGER
-- ============================================================================

-- Function to log changes to audit_logs
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    old_data JSONB;
    new_data JSONB;
    action_type audit_action;
    entity_type_val VARCHAR(100);
BEGIN
    entity_type_val := TG_TABLE_NAME;
    
    IF TG_OP = 'INSERT' THEN
        action_type := 'CREATE';
        old_data := NULL;
        new_data := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        action_type := 'UPDATE';
        old_data := to_jsonb(OLD);
        new_data := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
        action_type := 'DELETE';
        old_data := to_jsonb(OLD);
        new_data := NULL;
    END IF;
    
    -- Get current user from session variable (set by application)
    INSERT INTO audit_logs (
        user_id,
        action,
        entity_type,
        entity_id,
        old_values,
        new_values,
        request_id
    ) VALUES (
        NULLIF(current_setting('app.current_user_id', true), '')::UUID,
        action_type,
        entity_type_val,
        COALESCE(NEW.id, OLD.id),
        old_data,
        new_data,
        current_setting('app.request_id', true)
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers to important tables
-- Note: Be selective to avoid excessive logging
CREATE TRIGGER trigger_users_audit
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER trigger_agent_instances_audit
    AFTER INSERT OR UPDATE OR DELETE ON agent_instances
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER trigger_tasks_audit
    AFTER INSERT OR UPDATE OR DELETE ON tasks
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

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

-- Only admins can create/delete users
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

-- Refresh tokens policies (user can only see their own)
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

-- Audit logs policies (admins can see all, users can see their own)
CREATE POLICY audit_logs_select ON audit_logs
    FOR SELECT USING (
        user_id = current_user_id() 
        OR current_user_role() = 'admin'
    );

-- Agent templates policies (everyone can read active, only admins can modify)
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
        created_by = current_user_id() 
        OR current_user_role() = 'admin'
    );

CREATE POLICY tasks_modify_own ON tasks
    FOR ALL USING (
        created_by = current_user_id() 
        OR current_user_role() = 'admin'
    );

-- Results policies (accessible to task owners)
CREATE POLICY results_select_task_owner ON results
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM tasks 
            WHERE tasks.id = results.task_id 
            AND (tasks.created_by = current_user_id() OR current_user_role() = 'admin')
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
-- SEED DATA
-- ============================================================================

-- Initial admin user (password: 'admin123' - CHANGE IN PRODUCTION!)
-- Using bcrypt hash for 'admin123'
INSERT INTO users (
    id,
    email, 
    password_hash, 
    role, 
    status, 
    email_verified,
    created_at
) VALUES (
    '00000000-0000-0000-0000-000000000001'::UUID,
    'admin@squadops.ai',
    '$2a$10$N9qo8uLOickgx2ZMRZoMy.MqrqRm3TQMcyXEaYKPLSJ.Zk33Qh0Ra', -- admin123
    'admin',
    'active',
    TRUE,
    NOW()
);

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
);

-- Agent Templates
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
-- Research Agent
(
    'YouTube Research Agent',
    'youtube-researcher',
    'Specialized agent for discovering and analyzing YouTube content creators',
    '1.0.0',
    'researcher',
    ARRAY['youtube_api', 'data_extraction', 'content_analysis', 'sentiment_analysis'],
    '{
        "type": "object",
        "properties": {
            "search_query": {"type": "string"},
            "max_results": {"type": "integer", "default": 50},
            "include_transcripts": {"type": "boolean", "default": true},
            "analysis_depth": {"type": "string", "enum": ["basic", "detailed", "comprehensive"], "default": "detailed"}
        }
    }'::JSONB,
    '{
        "max_results": 50,
        "include_transcripts": true,
        "analysis_depth": "detailed"
    }'::JSONB,
    '{"cpu": 1, "memory": "1Gi"}'::JSONB,
    600,
    TRUE,
    '00000000-0000-0000-0000-000000000001'::UUID
),

-- Analysis Agent
(
    'Content Analysis Agent',
    'content-analyzer',
    'Analyzes video content, extracts topics, and performs sentiment analysis',
    '1.0.0',
    'analyzer',
    ARRAY['nlp', 'topic_extraction', 'sentiment_analysis', 'trend_detection'],
    '{
        "type": "object",
        "properties": {
            "analysis_types": {"type": "array", "items": {"type": "string"}},
            "language": {"type": "string", "default": "en"}
        }
    }'::JSONB,
    '{
        "analysis_types": ["topics", "sentiment", "engagement"],
        "language": "en"
    }'::JSONB,
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
    '{
        "type": "object",
        "properties": {
            "report_format": {"type": "string", "enum": ["markdown", "pdf", "json"], "default": "markdown"},
            "include_charts": {"type": "boolean", "default": true}
        }
    }'::JSONB,
    '{
        "report_format": "markdown",
        "include_charts": true
    }'::JSONB,
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
    '{
        "type": "object",
        "properties": {
            "strict_mode": {"type": "boolean", "default": true},
            "validation_rules": {"type": "object"}
        }
    }'::JSONB,
    '{
        "strict_mode": true
    }'::JSONB,
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
    '{
        "type": "object",
        "properties": {
            "time_window_days": {"type": "integer", "default": 30},
            "min_confidence": {"type": "number", "default": 0.7}
        }
    }'::JSONB,
    '{
        "time_window_days": 30,
        "min_confidence": 0.7
    }'::JSONB,
    '{"cpu": 1, "memory": "1Gi"}'::JSONB,
    600,
    TRUE,
    '00000000-0000-0000-0000-000000000001'::UUID
);

-- Niche Domains (Sample of 20 diverse niches, expand to 100+)
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

-- Entertainment
('Gaming', 'gaming', 'Video game reviews, gameplay, and esports', 'entertainment', 'gaming',
    ARRAY['gaming', 'gameplay', 'review', 'esports', 'walkthrough', 'lets play'],
    '{"min_subscribers": 50000, "content_type": ["gameplay", "review"]}'::JSONB, 10),

('Movie Reviews', 'movie-reviews', 'Film criticism and movie analysis', 'entertainment', 'movies',
    ARRAY['movie review', 'film analysis', 'cinema', 'Hollywood', 'movie breakdown'],
    '{"min_subscribers": 10000, "content_type": ["review", "analysis"]}'::JSONB, 7),

-- Education
('Science Education', 'science-education', 'Physics, chemistry, biology, and general science', 'education', 'science',
    ARRAY['science', 'physics', 'chemistry', 'biology', 'astronomy', 'education'],
    '{"min_subscribers": 50000, "content_type": ["educational", "documentary"]}'::JSONB, 8),

('Language Learning', 'language-learning', 'Learning foreign languages', 'education', 'languages',
    ARRAY['language learning', 'Spanish', 'French', 'Japanese', 'English', 'learn language'],
    '{"min_subscribers": 10000, "content_type": ["tutorial", "lesson"]}'::JSONB, 7),

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

('Minimalism', 'minimalism', 'Minimalist lifestyle and decluttering', 'lifestyle', 'minimalism',
    ARRAY['minimalism', 'declutter', 'simple living', 'organization', 'tiny house'],
    '{"min_subscribers": 5000, "content_type": ["lifestyle", "guide"]}'::JSONB, 6),

-- Creative
('Photography', 'photography', 'Photography tutorials, gear reviews, and techniques', 'creative', 'photography',
    ARRAY['photography', 'camera', 'photo editing', 'portrait', 'landscape', 'lightroom'],
    '{"min_subscribers": 15000, "content_type": ["tutorial", "review"]}'::JSONB, 7),

('Music Production', 'music-production', 'Music creation, DAWs, and audio engineering', 'creative', 'music',
    ARRAY['music production', 'DAW', 'Ableton', 'FL Studio', 'mixing', 'mastering'],
    '{"min_subscribers": 10000, "content_type": ["tutorial", "review"]}'::JSONB, 7),

('Animation', 'animation', '2D/3D animation tutorials and showcases', 'creative', 'animation',
    ARRAY['animation', 'Blender', 'Maya', '3D modeling', 'motion graphics', 'VFX'],
    '{"min_subscribers": 10000, "content_type": ["tutorial", "showcase"]}'::JSONB, 6),

-- News & Commentary
('Tech News', 'tech-news', 'Technology news and commentary', 'news', 'technology',
    ARRAY['tech news', 'technology', 'gadgets', 'reviews', 'industry'],
    '{"min_subscribers": 20000, "content_type": ["news", "commentary"]}'::JSONB, 8),

('Political Commentary', 'political-commentary', 'Political analysis and commentary', 'news', 'politics',
    ARRAY['politics', 'news', 'analysis', 'commentary', 'policy'],
    '{"min_subscribers": 15000, "content_type": ["analysis", "commentary"]}'::JSONB, 6);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View for user statistics
CREATE VIEW user_stats AS
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
LEFT JOIN tasks t ON u.id = t.created_by
LEFT JOIN research_jobs rj ON u.id = rj.created_by
GROUP BY u.id, p.display_name, p.company;

-- View for swarm status
CREATE VIEW swarm_status AS
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
CREATE VIEW research_job_summary AS
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
-- STORED PROCEDURES FOR COMMON OPERATIONS
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
    -- Create swarm
    INSERT INTO swarm_orchestrators (
        name, description, orchestrator_type, max_agents, min_agents, created_by
    ) VALUES (
        p_name, p_description, p_orchestrator_type, p_max_agents, 
        LEAST(1, p_max_agents), p_created_by
    ) RETURNING id INTO v_swarm_id;
    
    -- Create initial agents for each template
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
    -- In a real scenario, this would move to an archive table or S3
    -- For now, we just delete old logs
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
COMMENT ON TABLE agent_templates IS 'Reusable agent configurations and definitions';
COMMENT ON TABLE swarm_orchestrators IS 'Manages groups of agent instances';
COMMENT ON TABLE agent_instances IS 'Running instances of agent templates';
COMMENT ON TABLE tasks IS 'Work units assigned to agents';
COMMENT ON TABLE results IS 'Output and results from task execution';
COMMENT ON TABLE niche_domains IS 'YouTube content niche categories for research';
COMMENT ON TABLE youtube_creators IS 'YouTube channel profiles and statistics';
COMMENT ON TABLE youtube_videos IS 'Individual YouTube video metadata and analysis';
COMMENT ON TABLE research_jobs IS 'Research job tracking and management';

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
