# SquadOps System Architecture

## Overview

SquadOps is a production-grade AI operations platform designed for orchestrating agent swarms to perform YouTube research at scale. The architecture follows a microservices-oriented design with clear separation of concerns, horizontal scalability, and enterprise-grade security.

---

## High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    CLIENT LAYER                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │
│  │   Web App    │  │   CLI Tool   │  │  Mobile App  │  │  External    │                │
│  │  (React)     │  │   (Python)   │  │  (React      │  │   APIs       │                │
│  │              │  │              │  │   Native)    │  │              │                │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                │
│         │                 │                 │                 │                        │
│         └─────────────────┴─────────────────┴─────────────────┘                        │
│                                   │                                                     │
│                          ┌────────▼────────┐                                            │
│                          │   API Gateway   │                                            │
│                          │   (Kong/AWS)    │  • Rate Limiting                          │
│                          │                 │  • Authentication                         │
│                          │                 │  • Request Routing                        │
│                          └────────┬────────┘  • Load Balancing                         │
└───────────────────────────────────┼─────────────────────────────────────────────────────┘
                                    │
┌───────────────────────────────────┼─────────────────────────────────────────────────────┐
│                          API LAYER│                                                   │
│                          ┌────────▼────────┐                                            │
│                          │   Load Balancer │                                            │
│                          │    (Nginx/HA)   │                                            │
│                          └────────┬────────┘                                            │
│                                   │                                                     │
│         ┌─────────────────────────┼─────────────────────────┐                          │
│         │                         │                         │                          │
│  ┌──────▼──────┐         ┌────────▼────────┐      ┌────────▼────────┐                │
│  │   Auth      │         │   Core API      │      │  WebSocket      │                │
│  │  Service    │         │   (FastAPI)     │      │    Server       │                │
│  │             │         │                 │      │                 │                │
│  │ • JWT auth  │◄───────►│ • REST API      │      │ • Real-time     │                │
│  │ • API Keys  │         │ • GraphQL       │      │   updates       │                │
│  │ • OAuth2    │         │ • Validation    │      │ • Agent status  │                │
│  │ • Sessions  │         │ • Rate limits   │      │ • Task progress │                │
│  └──────┬──────┘         └────────┬────────┘      └─────────────────┘                │
│         │                         │                                                     │
│         └─────────────────────────┘                                                     │
│                                   │                                                     │
└───────────────────────────────────┼─────────────────────────────────────────────────────┘
                                    │
┌───────────────────────────────────┼─────────────────────────────────────────────────────┐
│                       SERVICE LAYER│                                                  │
│                         ┌─────────▼─────────┐                                          │
│                         │   Message Queue   │                                          │
│                         │    (Redis/Rabbit) │  • Task Distribution                     │
│                         │                   │  • Event Broadcasting                    │
│                         └─────────┬─────────┘  • Pub/Sub                               │
│                                   │                                                     │
│     ┌─────────────────────────────┼─────────────────────────────┐                      │
│     │                             │                             │                      │
│     ▼                             ▼                             ▼                      │
│ ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────┐                │
│ │  Agent Swarm    │    │  Research       │    │  Notification       │                │
│ │  Orchestrator   │    │  Service        │    │  Service            │                │
│ │                 │    │                 │    │                     │                │
│ │ • Swarm mgmt    │    │ • YouTube API   │    │ • Email             │                │
│ │ • Task routing  │    │ • Data scraping │    │ • Push              │                │
│ │ • Auto-scaling  │    │ • NLP analysis  │    │ • Webhooks          │                │
│ │ • Load balance  │    │ • Trend detect  │    │ • Slack             │                │
│ └────────┬────────┘    └────────┬────────┘    └─────────────────────┘                │
│          │                      │                                                      │
│          │         ┌────────────┼────────────┐                                       │
│          │         │            │            │                                       │
│          ▼         ▼            ▼            ▼                                       │
│ ┌─────────────────────────────────────────────────────────────────────┐             │
│ │                     AGENT EXECUTION LAYER                            │             │
│ │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────┐│             │
│ │  │   Research   │  │   Content    │  │    Report    │  │  Trend    ││             │
│ │  │    Agent     │  │   Analyzer   │  │  Generator   │  │  Detector ││             │
│ │  │              │  │              │  │              │  │           ││             │
│ │  │ • YouTube    │  │ • NLP proc   │  │ • Markdown   │  │ • Pattern ││             │
│ │  │   scraping   │  │ • Sentiment  │  │ • Charts     │  │   detect  ││             │
│ │  │ • Channel    │  │ • Topics     │  │ • PDF exp    │  │ • Forecast││             │
│ │  │   analysis   │  │ • Keywords   │  │              │  │           ││             │
│ │  └──────────────┘  └──────────────┘  └──────────────┘  └───────────┘│             │
│ │                                                                     │             │
│ │  ┌─────────────────────────────────────────────────────────────┐   │             │
│ │  │              Agent Runtime (Docker/Kubernetes)               │   │             │
│ │  │  • Containerized execution  • Resource limits               │   │             │
│ │  │  • Auto-scaling            • Health checks                  │   │             │
│ │  └─────────────────────────────────────────────────────────────┘   │             │
│ └─────────────────────────────────────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
┌───────────────────────────────────┼─────────────────────────────────────────────────────┐
│                         DATA LAYER│                                                   │
│                         ┌─────────▼─────────┐                                          │
│                         │  PostgreSQL       │  • Primary data store                     │
│                         │  (Primary +       │  • ACID compliance                        │
│                         │   Replicas)       │  • RLS policies                           │
│                         │                   │  • Partitioned audit logs                 │
│                         └─────────┬─────────┘                                          │
│                                   │                                                     │
│         ┌─────────────────────────┼─────────────────────────┐                          │
│         │                         │                         │                          │
│         ▼                         ▼                         ▼                          │
│ ┌───────────────┐      ┌─────────────────┐      ┌─────────────────┐                  │
│ │    Redis      │      │   Elasticsearch │      │  Object Store   │                  │
│ │               │      │                 │      │   (S3/MinIO)    │                  │
│ │ • Sessions    │      │ • Full-text     │      │                 │                  │
│ │ • Caching     │      │   search        │      │ • Video assets  │                  │
│ │ • Rate limit  │      │ • Analytics     │      │ • Large results │                  │
│ │ • Pub/Sub     │      │ • Log aggregation│     │ • Exports       │                  │
│ └───────────────┘      └─────────────────┘      └─────────────────┘                  │
│                                                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────────────┐ │
│ │                         External Integrations                                    │ │
│ │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐  │ │
│ │  │  YouTube   │  │   OpenAI   │  │  Google    │  │   Slack    │  │  SendGrid │  │ │
│ │  │   Data     │  │    API     │  │   OAuth    │  │   Bot      │  │   Email   │  │ │
│ │  │   API v3   │  │   GPT-4    │  │            │  │            │  │           │  │ │
│ │  └────────────┘  └────────────┘  └────────────┘  └────────────┘  └───────────┘  │ │
│ └─────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
┌───────────────────────────────────┼─────────────────────────────────────────────────────┐
│                      OBSERVABILITY LAYER                                              │
│         ┌─────────────────────────┼─────────────────────────┐                          │
│         │                         │                         │                          │
│         ▼                         ▼                         ▼                          │
│ ┌───────────────┐      ┌─────────────────┐      ┌─────────────────┐                  │
│ │  Prometheus   │      │     Grafana     │      │    Jaeger       │                  │
│ │               │      │                 │      │                 │                  │
│ │ • Metrics     │─────►│ • Dashboards    │      │ • Distributed   │                  │
│ │ • Alerts      │      │ • Visualization │      │   tracing       │                  │
│ │ • SLIs/SLOs   │      │ • Custom views  │      │ • Performance   │                  │
│ └───────────────┘      └─────────────────┘      └─────────────────┘                  │
│                                                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────────────┐ │
│ │                         Logging Infrastructure                                   │ │
│ │                    ┌─────────────────────────────┐                               │ │
│ │                    │   Centralized Logging (ELK)  │                               │ │
│ │                    │   • Filebeat (shippers)      │                               │ │
│ │                    │   • Logstash (processing)    │                               │ │
│ │                    │   • Elasticsearch (storage)  │                               │ │
│ │                    │   • Kibana (visualization)   │                               │ │
│ │                    └─────────────────────────────┘                               │ │
│ └─────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Interactions

### 1. Authentication Flow

```
┌─────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  Client │────►│  API Gateway │────►│ Auth Service│────►│  PostgreSQL  │
└─────────┘     └──────────────┘     └─────────────┘     └──────────────┘
                     │                       │                    │
                     │                       ▼                    │
                     │              ┌──────────────┐              │
                     │              │    Redis     │              │
                     │              │  (sessions)  │              │
                     │              └──────────────┘              │
                     │                       │                    │
                     ▼                       ▼                    │
              ┌──────────────┐       ┌──────────────┐             │
              │  JWT Token   │◄──────│   Validate   │◄────────────┘
              │   (access)   │       │   Credentials│
              └──────────────┘       └──────────────┘
```

**Flow:**
1. Client sends credentials to Auth Service via API Gateway
2. Auth Service validates credentials against PostgreSQL
3. Upon success, generates JWT access token (short-lived) + refresh token (long-lived)
4. Refresh tokens stored in Redis for session management
5. Client uses JWT for subsequent API calls
6. API Gateway validates JWT signature on each request

### 2. Agent Swarm Execution Flow

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│    User      │────►│  Swarm API      │────►│  Task Queue      │
│  Request     │     │  (create swarm) │     │  (Redis/RabbitMQ)│
└──────────────┘     └─────────────────┘     └────────┬─────────┘
                                                      │
                                                      ▼
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   Results    │◄────│  Agent Instance │◄────│  Swarm           │
│   Stored     │     │  (execute task) │     │  Orchestrator    │
└──────────────┘     └─────────────────┘     └──────────────────┘
       │                      │
       │              ┌───────┴───────┐
       │              │               │
       ▼              ▼               ▼
┌──────────────┐ ┌──────────┐  ┌──────────┐
│  PostgreSQL  │ │  NLP     │  │ YouTube  │
│  (results)   │ │  Service │  │   API    │
└──────────────┘ └──────────┘  └──────────┘
```

**Flow:**
1. User creates a research job via API
2. Job broken down into tasks and pushed to Task Queue
3. Swarm Orchestrator monitors queue depth and scales agents
4. Agent Instances poll queue for tasks
5. Agent executes task (may call external APIs)
6. Results stored in PostgreSQL, large outputs to S3
7. WebSocket pushes real-time updates to client

### 3. YouTube Research Domain Flow

```
┌──────────────────┐
│  Research Job    │
│  (user request)  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│  Job Planner     │────►│  Task Generator  │
│  (breakdown)     │     │  (parallel tasks)│
└────────┬─────────┘     └────────┬─────────┘
         │                        │
         │         ┌──────────────┼──────────────┐
         │         │              │              │
         ▼         ▼              ▼              ▼
┌─────────────────────────────────────────────────────────┐
│                    Agent Swarm Pool                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐ │
│  │  Research  │  │  Content   │  │  Trend Detection   │ │
│  │   Agent    │  │  Analyzer  │  │      Agent         │ │
│  │            │  │            │  │                    │ │
│  │• Discover  │  │• NLP proc  │  │• Pattern detect    │ │
│  │  channels  │  │• Sentiment │  │• Forecast          │ │
│  │• Scrape    │  │• Topics    │  │• Correlation       │ │
│  │  metadata  │  │            │  │                    │ │
│  └─────┬──────┘  └─────┬──────┘  └─────────┬──────────┘ │
└────────┼───────────────┼───────────────────┼────────────┘
         │               │                   │
         └───────────────┴───────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                     Data Storage                         │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐ │
│  │  Creators  │  │   Videos   │  │   Research Jobs    │ │
│  │  Table     │  │   Table    │  │   Table            │ │
│  └────────────┘  └────────────┘  └────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Database Schema Highlights

### Partitioning Strategy
- **audit_logs**: Partitioned by month for efficient archival
- **tasks**: Consider partitioning by status or created_at for high-volume workloads
- **results**: Partitioned by created_at for historical analysis

### Indexing Strategy
- **B-tree indexes**: Primary keys, foreign keys, status fields
- **GIN indexes**: JSONB columns (config, metadata), full-text search vectors
- **Partial indexes**: Frequently queried subsets (e.g., active agents only)
- **Composite indexes**: Multi-column queries (status + priority + created_at)

### RLS (Row Level Security)
- Users can only access their own data
- Admins have full access
- API keys scoped to specific users
- Audit logs accessible to record owner and admins

---

## Scalability Considerations

### Horizontal Scaling
```
                    ┌──────────────┐
                    │   Load       │
                    │   Balancer   │
                    └──────┬───────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
     ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐
     │  API      │   │  API      │   │  API      │
     │ Server 1  │   │ Server 2  │   │ Server N  │
     └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
           │               │               │
           └───────────────┼───────────────┘
                           │
                    ┌──────▼──────┐
                    │   Shared    │
                    │   Database  │
                    │  (Primary + │
                    │  Replicas)  │
                    └─────────────┘
```

### Agent Scaling
- **Auto-scaling**: Based on queue depth and task backlog
- **Min/Max limits**: Configurable per swarm
- **Resource quotas**: CPU/memory limits per agent
- **Health checks**: Automatic restart of unhealthy agents

---

## Security Architecture

### Authentication Layers
1. **API Gateway**: TLS termination, rate limiting
2. **JWT Validation**: Stateless token verification
3. **API Keys**: Service-to-service authentication
4. **RLS Policies**: Database-level access control

### Data Protection
- **Encryption at rest**: Database encryption (TDE)
- **Encryption in transit**: TLS 1.3 for all connections
- **Secrets management**: HashiCorp Vault or AWS Secrets Manager
- **PII handling**: Data masking in logs

---

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| API Framework | FastAPI | REST/GraphQL APIs |
| Database | PostgreSQL 15+ | Primary data store |
| Cache | Redis | Sessions, caching, pub/sub |
| Queue | Redis/RabbitMQ | Task distribution |
| Search | Elasticsearch | Full-text search, analytics |
| Storage | S3/MinIO | Object storage |
| Containers | Docker + K8s | Agent runtime |
| Monitoring | Prometheus + Grafana | Metrics, dashboards |
| Tracing | Jaeger | Distributed tracing |
| Logging | ELK Stack | Centralized logging |

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Kubernetes Cluster                      │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    Ingress Controller                    ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Namespace: squadops-api                                 ││
│  │  ┌────────────┐ ┌────────────┐ ┌────────────────────┐  ││
│  │  │ API Pods   │ │ API Pods   │ │ API Pods           │  ││
│  │  │ (3+ replicas)│           │ │                    │  ││
│  │  └────────────┘ └────────────┘ └────────────────────┘  ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Namespace: squadops-agents                              ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │           Agent Swarm (HPA auto-scaled)            │││
│  │  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐     │││
│  │  │  │ Agent  │ │ Agent  │ │ Agent  │ │ Agent  │ ...  │││
│  │  │  │ Pod    │ │ Pod    │ │ Pod    │ │ Pod    │     │││
│  │  │  └────────┘ └────────┘ └────────┘ └────────┘     │││
│  │  └─────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Namespace: squadops-data                                ││
│  │  ┌────────────┐ ┌────────────┐ ┌────────────────────┐  ││
│  │  │ PostgreSQL │ │   Redis    │ │ Elasticsearch      │  ││
│  │  │ (StatefulSet)│  Cluster  │ │ Cluster            │  ││
│  │  └────────────┘ └────────────┘ └────────────────────┘  ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Future Considerations

1. **Multi-tenancy**: Namespace isolation for enterprise customers
2. **Federation**: Cross-region agent swarms
3. **Edge Computing**: Agent execution at edge locations
4. **ML Model Serving**: Dedicated inference endpoints
5. **Blockchain**: Immutable audit trails for compliance
