-- ============================================================================
-- Migration: Add OpenClaw Swarm Tables
-- Adds tables for OpenClaw integration: swarm_configurations, swarm_executions, agent_allocations
-- Run this migration to add OpenClaw swarm functionality to existing database
-- ============================================================================

-- Check if tables already exist before creating
DO $$
BEGIN
    -- Swarm configurations - stores templates for swarm setups
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'swarm_configurations') THEN
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
        
        RAISE NOTICE 'Created table: swarm_configurations';
    ELSE
        RAISE NOTICE 'Table swarm_configurations already exists, skipping';
    END IF;
END $$;

DO $$
BEGIN
    -- Swarm executions - tracks actual swarm runs
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'swarm_executions') THEN
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
        
        RAISE NOTICE 'Created table: swarm_executions';
    ELSE
        RAISE NOTICE 'Table swarm_executions already exists, skipping';
    END IF;
END $$;

DO $$
BEGIN
    -- Agent allocations - tracks which agents are assigned to which executions
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'agent_allocations') THEN
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
        
        RAISE NOTICE 'Created table: agent_allocations';
    ELSE
        RAISE NOTICE 'Table agent_allocations already exists, skipping';
    END IF;
END $$;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Create indexes if they don't exist
DO $$
BEGIN
    -- Index for swarm_configurations
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_swarm_configurations_created_by') THEN
        CREATE INDEX idx_swarm_configurations_created_by ON swarm_configurations(created_by);
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_swarm_configurations_active') THEN
        CREATE INDEX idx_swarm_configurations_active ON swarm_configurations(is_active);
    END IF;
    
    -- Indexes for swarm_executions
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_swarm_executions_configuration') THEN
        CREATE INDEX idx_swarm_executions_configuration ON swarm_executions(configuration_id);
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_swarm_executions_status') THEN
        CREATE INDEX idx_swarm_executions_status ON swarm_executions(status);
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_swarm_executions_created_by') THEN
        CREATE INDEX idx_swarm_executions_created_by ON swarm_executions(created_by);
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_swarm_executions_created_at') THEN
        CREATE INDEX idx_swarm_executions_created_at ON swarm_executions(created_at DESC);
    END IF;
    
    -- Indexes for agent_allocations
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_agent_allocations_execution') THEN
        CREATE INDEX idx_agent_allocations_execution ON agent_allocations(execution_id);
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_agent_allocations_agent_id') THEN
        CREATE INDEX idx_agent_allocations_agent_id ON agent_allocations(openclaw_agent_id);
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_agent_allocations_status') THEN
        CREATE INDEX idx_agent_allocations_status ON agent_allocations(status);
    END IF;
    
    RAISE NOTICE 'Created indexes successfully';
END $$;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE swarm_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE swarm_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_allocations ENABLE ROW LEVEL SECURITY;

-- Create policies
DO $$
BEGIN
    -- Swarm Configurations policies
    IF NOT EXISTS (SELECT FROM pg_policies WHERE policyname = 'swarm_configurations_select' AND tablename = 'swarm_configurations') THEN
        CREATE POLICY swarm_configurations_select ON swarm_configurations
            FOR SELECT USING (
                is_public = TRUE 
                OR created_by = current_user_id() 
                OR current_user_role() = 'admin'
            );
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_policies WHERE policyname = 'swarm_configurations_modify_own' AND tablename = 'swarm_configurations') THEN
        CREATE POLICY swarm_configurations_modify_own ON swarm_configurations
            FOR ALL USING (
                created_by = current_user_id() 
                OR current_user_role() = 'admin'
            );
    END IF;
    
    -- Swarm Executions policies
    IF NOT EXISTS (SELECT FROM pg_policies WHERE policyname = 'swarm_executions_select' AND tablename = 'swarm_executions') THEN
        CREATE POLICY swarm_executions_select ON swarm_executions
            FOR SELECT USING (
                created_by = current_user_id() 
                OR current_user_role() = 'admin'
            );
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_policies WHERE policyname = 'swarm_executions_modify_own' AND tablename = 'swarm_executions') THEN
        CREATE POLICY swarm_executions_modify_own ON swarm_executions
            FOR ALL USING (
                created_by = current_user_id() 
                OR current_user_role() = 'admin'
            );
    END IF;
    
    -- Agent Allocations policies
    IF NOT EXISTS (SELECT FROM pg_policies WHERE policyname = 'agent_allocations_select' AND tablename = 'agent_allocations') THEN
        CREATE POLICY agent_allocations_select ON agent_allocations
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM swarm_executions se 
                    WHERE se.id = agent_allocations.execution_id 
                    AND (se.created_by = current_user_id() OR current_user_role() = 'admin')
                )
            );
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_policies WHERE policyname = 'agent_allocations_modify_own' AND tablename = 'agent_allocations') THEN
        CREATE POLICY agent_allocations_modify_own ON agent_allocations
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM swarm_executions se 
                    WHERE se.id = agent_allocations.execution_id 
                    AND (se.created_by = current_user_id() OR current_user_role() = 'admin')
                )
            );
    END IF;
    
    RAISE NOTICE 'Created RLS policies successfully';
END $$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Add updated_at triggers if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_triggers WHERE tgname = 'trigger_swarm_configurations_updated_at') THEN
        CREATE TRIGGER trigger_swarm_configurations_updated_at
            BEFORE UPDATE ON swarm_configurations
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_triggers WHERE tgname = 'trigger_swarm_executions_updated_at') THEN
        CREATE TRIGGER trigger_swarm_executions_updated_at
            BEFORE UPDATE ON swarm_executions
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    RAISE NOTICE 'Created triggers successfully';
END $$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE swarm_configurations IS 'OpenClaw swarm configuration templates';
COMMENT ON TABLE swarm_executions IS 'OpenClaw swarm execution tracking';
COMMENT ON TABLE agent_allocations IS 'Agent allocation tracking for swarm executions';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
