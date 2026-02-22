# SquadOps Database Schema

## Overview

This directory contains the complete PostgreSQL database schema for SquadOps - a production-grade AI operations platform for YouTube research.

## Schema Statistics

| Metric | Count |
|--------|-------|
| Tables | 14 |
| ENUM Types | 7 |
| Indexes | 50+ |
| Triggers | 15+ |
| RLS Policies | 25+ |
| Views | 3 |
| Functions | 8 |

## Table Structure

### User Management
```
┌─────────────────┐     ┌─────────────────┐
│     users       │────►│  user_profiles  │
├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ id (PK)         │
│ email (unique)  │     │ user_id (FK)    │
│ password_hash   │     │ first_name      │
│ role (enum)     │     │ last_name       │
│ status (enum)   │     │ display_name    │
│ last_login_at   │     │ preferences     │
│ created_at      │     │ created_at      │
└─────────────────┘     └─────────────────┘
```

### Authentication
```
┌─────────────────┐     ┌─────────────────┐
│ refresh_tokens  │     │    api_keys     │
├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ id (PK)         │
│ user_id (FK)    │     │ user_id (FK)    │
│ token_hash      │     │ name            │
│ expires_at      │     │ key_prefix      │
│ revoked_at      │     │ key_hash        │
│ ip_address      │     │ scopes[]        │
└─────────────────┘     │ expires_at      │
                        └─────────────────┘
```

### Agent Swarm System
```
┌─────────────────────┐
│   agent_templates   │
├─────────────────────┤
│ id (PK)             │
│ name                │
│ slug (unique)       │
│ agent_type          │
│ capabilities[]      │
│ config_schema       │
│ default_config      │
│ resource_reqs       │
│ is_system           │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐     ┌─────────────────────┐
│  swarm_orchestrators│     │   agent_instances   │
├─────────────────────┤     ├─────────────────────┤
│ id (PK)             │◄────│ id (PK)             │
│ name                │     │ name                │
│ orchestrator_type   │     │ template_id (FK)    │
│ max_agents          │     │ swarm_id (FK)       │
│ scaling_config      │     │ status (enum)       │
│ status              │     │ current_task_id     │
└─────────────────────┘     │ host_node           │
                            │ process_id          │
                            │ metadata            │
                            └──────────┬──────────┘
                                       │
                                       ▼
                            ┌─────────────────────┐
                            │       tasks         │
                            ├─────────────────────┤
                            │ id (PK)             │
                            │ title               │
                            │ task_type           │
                            │ status (enum)       │
                            │ priority (enum)     │
                            │ swarm_id (FK)       │
                            │ assigned_agent (FK) │
                            │ input_payload       │
                            │ parent_task_id (FK) │
                            │ deadline_at         │
                            └──────────┬──────────┘
                                       │
                                       ▼
                            ┌─────────────────────┐
                            │      results        │
                            ├─────────────────────┤
                            │ id (PK)             │
                            │ task_id (FK)        │
                            │ agent_id (FK)       │
                            │ status              │
                            │ output_payload      │
                            │ output_text         │
                            │ execution_time_ms   │
                            │ tokens_used         │
                            │ quality_score       │
                            │ storage_path        │
                            └─────────────────────┘
```

### YouTube Research Domain
```
┌─────────────────────┐
│   niche_domains     │
├─────────────────────┤
│ id (PK)             │
│ name (unique)       │
│ slug (unique)       │
│ category            │
│ keywords[]          │
│ research_config     │
│ total_creators      │
│ research_priority   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐     ┌─────────────────────┐
│  youtube_creators   │     │    youtube_videos   │
├─────────────────────┤     ├─────────────────────┤
│ id (PK)             │◄────│ id (PK)             │
│ youtube_channel_id  │     │ youtube_video_id    │
│ channel_name        │     │ creator_id (FK)     │
│ niche_id (FK)       │     │ title               │
│ subscriber_count    │     │ description         │
│ total_views         │     │ view_count          │
│ content_themes[]    │     │ transcript_text     │
│ search_vector       │     │ key_topics[]        │
└─────────────────────┘     │ sentiment_score     │
                            │ search_vector       │
                            └─────────────────────┘
                            
┌─────────────────────┐
│   research_jobs     │
├─────────────────────┤
│ id (PK)             │
│ job_type            │
│ status (enum)       │
│ niche_id (FK)       │
│ creator_id (FK)     │
│ swarm_id (FK)       │
│ config              │
│ total_tasks         │
│ completed_tasks     │
│ result_summary      │
└─────────────────────┘
```

## ENUM Types

| Type | Values |
|------|--------|
| `user_role` | admin, user, service_account |
| `user_status` | active, inactive, suspended, pending_verification |
| `audit_action` | CREATE, READ, UPDATE, DELETE, LOGIN, LOGOUT, TOKEN_REFRESH, API_KEY_USED, AGENT_START, AGENT_STOP, etc. |
| `agent_status` | idle, running, paused, completed, failed, terminated |
| `task_status` | pending, assigned, in_progress, completed, failed, cancelled, retrying |
| `task_priority` | low, medium, high, critical |
| `research_status` | queued, processing, completed, failed, cancelled |

## Security Features

### Row Level Security (RLS)

All tables have RLS enabled with the following policy patterns:

| Table | Select Policy | Modify Policy |
|-------|--------------|---------------|
| users | Own record or admin | Own record or admin |
| agent_templates | Active records or admin | Admin only |
| swarm_orchestrators | Own records or admin | Own records or admin |
| agent_instances | Own records or admin | Own records or admin |
| tasks | Own records or admin | Own records or admin |
| research_jobs | Own records or admin | Own records or admin |
| youtube_creators | All users | Admin only |
| niche_domains | All users | Admin only |

### Helper Functions

```sql
-- Get current user role from session
current_user_role() RETURNS user_role

-- Get current user ID from session
current_user_id() RETURNS UUID
```

## Performance Features

### Indexes

| Table | Key Indexes |
|-------|-------------|
| users | email, role, status, created_at |
| tasks | status, priority, assigned_agent, deadline (partial) |
| agent_instances | template, swarm, status, heartbeat |
| youtube_creators | channel_id, niche, subscribers, search_vector (GIN) |
| youtube_videos | video_id, creator, published, search_vector (GIN) |
| audit_logs | user_id, action, entity, created_at (partitioned) |

### Partitioning

- **audit_logs**: Partitioned by month (`audit_logs_2024_01`, etc.)
- Enables efficient archival of old audit data
- Use `pg_partman` extension for automatic partition management

### Full-Text Search

```sql
-- Search creators
SELECT * FROM youtube_creators 
WHERE search_vector @@ to_tsquery('english', 'fitness & workout');

-- Search videos
SELECT * FROM youtube_videos 
WHERE search_vector @@ plainto_tsquery('english', 'machine learning tutorial');
```

## Triggers

| Table | Trigger | Purpose |
|-------|---------|---------|
| All tables with `updated_at` | `update_updated_at_column()` | Auto-update timestamp on modification |
| youtube_creators | `update_creator_search_vector()` | Maintain full-text search index |
| youtube_videos | `update_video_search_vector()` | Maintain full-text search index |
| users | `audit_trigger_function()` | Log changes to audit_logs |
| agent_instances | `audit_trigger_function()` | Log changes to audit_logs |
| tasks | `audit_trigger_function()` | Log changes to audit_logs |

## Stored Procedures

### create_swarm_with_agents()
Creates a new swarm and initializes agents from template slugs.

```sql
SELECT create_swarm_with_agents(
    'My Research Swarm',
    'Description',
    'round_robin',
    10,
    ARRAY['youtube-researcher', 'content-analyzer'],
    'user-uuid'::UUID
);
```

### cleanup_expired_tokens()
Removes expired and old revoked refresh tokens.

```sql
SELECT cleanup_expired_tokens(); -- Returns count deleted
```

### archive_old_audit_logs(days)
Archives or deletes audit logs older than specified days.

```sql
SELECT archive_old_audit_logs(90); -- Remove logs older than 90 days
```

## Views

### user_stats
Aggregated user statistics including agent counts, task counts, and research job counts.

### swarm_status
Real-time swarm statistics including agent counts and task breakdown by status.

### research_job_summary
Research job summary with completion percentages and related niche/creator names.

## Seed Data

### Admin User
- Email: `admin@squadops.ai`
- Password: `admin123` (CHANGE IN PRODUCTION!)
- Role: `admin`

### Agent Templates
1. **YouTube Research Agent** (`youtube-researcher`) - Channel discovery and scraping
2. **Content Analysis Agent** (`content-analyzer`) - NLP processing and sentiment analysis
3. **Report Generation Agent** (`report-generator`) - Markdown/PDF report creation
4. **Data Validation Agent** (`data-validator`) - Data quality checks
5. **Trend Detection Agent** (`trend-detector`) - Pattern recognition and forecasting

### Niche Domains (20 sample niches)
Categories include: Technology, Entertainment, Education, Business, Health & Fitness, Lifestyle, Creative, News & Commentary

## Installation

### 1. Create Database

```bash
createdb squadops
```

### 2. Apply Schema

```bash
psql -d squadops -f schema.sql
```

### 3. Verify Installation

```sql
-- Check tables
\dt

-- Check indexes
\di

-- Check RLS policies
\dp

-- Verify seed data
SELECT * FROM users WHERE email = 'admin@squadops.ai';
SELECT * FROM agent_templates;
SELECT * FROM niche_domains;
```

## Application Integration

### Setting Session Variables for RLS

```python
# Python example using psycopg2
import psycopg2

conn = psycopg2.connect("dbname=squadops user=app_user")
cur = conn.cursor()

# Set current user for RLS policies
cur.execute("SET app.current_user_id = %s", (user_id,))
cur.execute("SET app.current_user_role = %s", (user_role,))
cur.execute("SET app.request_id = %s", (request_id,))

conn.commit()
```

### Using Stored Procedures

```python
# Create a swarm with agents
cur.execute("""
    SELECT create_swarm_with_agents(%s, %s, %s, %s, %s, %s)
""", (
    'AI Research Swarm',
    'Researching AI YouTubers',
    'round_robin',
    5,
    ['youtube-researcher', 'content-analyzer'],
    current_user_id
))
swarm_id = cur.fetchone()[0]
```

## Maintenance

### Regular Tasks

```sql
-- Clean up expired tokens (run daily)
SELECT cleanup_expired_tokens();

-- Archive old audit logs (run weekly)
SELECT archive_old_audit_logs(90);

-- Analyze tables for query optimization
ANALYZE;

-- Vacuum and reindex (run during low traffic)
VACUUM ANALYZE;
REINDEX DATABASE squadops;
```

### Monitoring Queries

```sql
-- Active swarms and their status
SELECT * FROM swarm_status WHERE status = 'active';

-- Pending tasks by priority
SELECT priority, COUNT(*) 
FROM tasks 
WHERE status = 'pending' 
GROUP BY priority 
ORDER BY priority;

-- Research job progress
SELECT * FROM research_job_summary 
WHERE status = 'processing';

-- Agent health check
SELECT 
    status, 
    COUNT(*),
    MAX(last_heartbeat_at) as last_heartbeat
FROM agent_instances
GROUP BY status;
```

## Migration Notes

When adding new partitions for audit_logs:

```sql
-- Create new monthly partition
CREATE TABLE audit_logs_2024_03 PARTITION OF audit_logs
    FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');
```

Consider using `pg_partman` for automatic partition management:

```sql
-- Install pg_partman extension
CREATE EXTENSION pg_partman;

-- Convert audit_logs to use pg_partman
SELECT partman.create_parent('public.audit_logs', 'created_at', 'native', 'monthly');
```
