# SquadOps Skills Map (from skills.sh)

Each agent gets specialized skills from [skills.sh](https://skills.sh/) to enhance its capabilities.

## Install

```bash
# Install all skills for all agents
./scripts/install-skills.sh

# Install skills for a specific agent
./scripts/install-skills.sh forge
```

## Agent → Skills Mapping

### MaruS (Lead / Orchestrator) — 6 skills
| Skill | Source | Why |
|-------|--------|-----|
| brainstorming | obra/superpowers | Generate ideas before delegating |
| writing-plans | obra/superpowers | Create structured plans for the squad |
| executing-plans | obra/superpowers | Track and execute multi-step plans |
| dispatching-parallel-agents | obra/superpowers | Coordinate parallel agent work |
| subagent-driven-development | obra/superpowers | Best practices for delegation |
| using-superpowers | obra/superpowers | Meta-skill for orchestration |

### Forge (Backend Dev) — 7 skills
| Skill | Source | Why |
|-------|--------|-----|
| nodejs-backend-patterns | wshobson/agents | Backend architecture patterns |
| api-design-principles | wshobson/agents | REST/GraphQL API design |
| error-handling-patterns | wshobson/agents | Robust error handling |
| microservices-patterns | wshobson/agents | Service decomposition |
| auth-implementation-patterns | wshobson/agents | Auth best practices |
| modern-javascript-patterns | wshobson/agents | Modern JS/TS patterns |
| typescript-advanced-types | wshobson/agents | Advanced TypeScript |

### Canvas (Frontend / UI) — 9 skills
| Skill | Source | Why |
|-------|--------|-----|
| frontend-design | anthropics/skills | Frontend design principles |
| vercel-react-best-practices | vercel-labs/agent-skills | React patterns |
| web-design-guidelines | vercel-labs/agent-skills | Web design standards |
| vercel-composition-patterns | vercel-labs/agent-skills | Component composition |
| next-best-practices | vercel-labs/next-skills | Next.js patterns |
| tailwind-design-system | wshobson/agents | Tailwind CSS system |
| responsive-design | wshobson/agents | Mobile-first design |
| ui-ux-pro-max | nextlevelbuilder | Advanced UI/UX patterns |
| shadcn-ui | giuseppe-trisciuoglio | shadcn component library |

### Helm (DevOps / Infra) — 3 skills
| Skill | Source | Why |
|-------|--------|-----|
| docker-expert | sickn33/antigravity | Docker best practices |
| github-actions-templates | wshobson/agents | CI/CD pipelines |
| monorepo-management | wshobson/agents | Monorepo tooling |

### Aegis (QA / Testing) — 5 skills
| Skill | Source | Why |
|-------|--------|-----|
| test-driven-development | obra/superpowers | TDD methodology |
| verification-before-completion | obra/superpowers | Verify before done |
| webapp-testing | anthropics/skills | Web app testing |
| e2e-testing-patterns | wshobson/agents | End-to-end tests |
| javascript-testing-patterns | wshobson/agents | JS test patterns |

### Vault (DBA / Database) — 4 skills
| Skill | Source | Why |
|-------|--------|-----|
| supabase-postgres-best-practices | supabase/agent-skills | Postgres patterns |
| postgresql-table-design | wshobson/agents | Schema design |
| sql-optimization-patterns | wshobson/agents | Query optimization |
| database-migration | wshobson/agents | Migration patterns |

### Architect (System Design) — 4 skills
| Skill | Source | Why |
|-------|--------|-----|
| architecture-patterns | wshobson/agents | System patterns |
| architecture-decision-records | wshobson/agents | ADR documentation |
| microservices-patterns | wshobson/agents | Service design |
| api-design-principles | wshobson/agents | API contracts |

### Patcher (Code Review) — 4 skills
| Skill | Source | Why |
|-------|--------|-----|
| requesting-code-review | obra/superpowers | How to request reviews |
| receiving-code-review | obra/superpowers | How to process reviews |
| code-review-excellence | wshobson/agents | Review best practices |
| finishing-a-development-branch | obra/superpowers | Branch completion |

### Scout (Research) — 3 skills
| Skill | Source | Why |
|-------|--------|-----|
| brainstorming | obra/superpowers | Research ideation |
| firecrawl | firecrawl/cli | Web scraping for research |
| competitor-alternatives | coreyhaines31/marketingskills | Competitive analysis |

### Scribe (Content Writer) — 5 skills
| Skill | Source | Why |
|-------|--------|-----|
| copywriting | coreyhaines31/marketingskills | Persuasive copy |
| copy-editing | coreyhaines31/marketingskills | Polish and refine |
| content-strategy | coreyhaines31/marketingskills | Content planning |
| doc-coauthoring | anthropics/skills | Collaborative docs |
| email-sequence | coreyhaines31/marketingskills | Email campaigns |

### Sentinel (Retention) — 5 skills
| Skill | Source | Why |
|-------|--------|-----|
| onboarding-cro | coreyhaines31/marketingskills | Onboarding conversion |
| signup-flow-cro | coreyhaines31/marketingskills | Signup optimization |
| page-cro | coreyhaines31/marketingskills | Page conversion |
| form-cro | coreyhaines31/marketingskills | Form optimization |
| paywall-upgrade-cro | coreyhaines31/marketingskills | Upgrade conversion |

### Lens (SEO) — 5 skills
| Skill | Source | Why |
|-------|--------|-----|
| seo-audit | coreyhaines31/marketingskills | Full SEO audit |
| programmatic-seo | coreyhaines31/marketingskills | Programmatic pages |
| schema-markup | coreyhaines31/marketingskills | Structured data |
| seo-geo | resciencelab/opc-skills | Local/geo SEO |
| backlink-analyzer | aaron-he-zhu | Backlink analysis |

### Herald (Outreach / Sales) — 4 skills
| Skill | Source | Why |
|-------|--------|-----|
| email-sequence | coreyhaines31/marketingskills | Outreach sequences |
| launch-strategy | coreyhaines31/marketingskills | Product launches |
| free-tool-strategy | coreyhaines31/marketingskills | Lead magnets |
| email-best-practices | resend | Email deliverability |

### Oracle (Analytics) — 3 skills
| Skill | Source | Why |
|-------|--------|-----|
| analytics-tracking | coreyhaines31/marketingskills | Event tracking setup |
| ab-test-setup | coreyhaines31/marketingskills | A/B testing |
| stripe-integration | wshobson/agents | Stripe data access |

### Guide (Onboarding) — 4 skills
| Skill | Source | Why |
|-------|--------|-----|
| onboarding-cro | coreyhaines31/marketingskills | Onboarding flows |
| signup-flow-cro | coreyhaines31/marketingskills | Signup optimization |
| form-cro | coreyhaines31/marketingskills | Form UX |
| email-best-practices | resend | Onboarding emails |

### Beacon (Social Media) — 3 skills
| Skill | Source | Why |
|-------|--------|-----|
| social-content | coreyhaines31/marketingskills | Social post creation |
| marketing-ideas | coreyhaines31/marketingskills | Campaign ideation |
| marketing-psychology | coreyhaines31/marketingskills | Persuasion principles |

### Shield (Customer Support) — 2 skills
| Skill | Source | Why |
|-------|--------|-----|
| internal-comms | anthropics/skills | Communication patterns |
| doc-coauthoring | anthropics/skills | Help doc creation |

### Compass (Strategy / Planning) — 7 skills
| Skill | Source | Why |
|-------|--------|-----|
| pricing-strategy | coreyhaines31/marketingskills | Pricing decisions |
| product-marketing-context | coreyhaines31/marketingskills | Market positioning |
| competitor-alternatives | coreyhaines31/marketingskills | Competitive intel |
| launch-strategy | coreyhaines31/marketingskills | Go-to-market |
| marketing-ideas | coreyhaines31/marketingskills | Growth ideas |
| writing-plans | obra/superpowers | Strategic planning |
| executing-plans | obra/superpowers | Plan execution |

### Warden (Security / Audit) — 3 skills
| Skill | Source | Why |
|-------|--------|-----|
| security-requirement-extraction | wshobson/agents | Security requirements |
| auth-implementation-patterns | wshobson/agents | Auth security |
| audit-website | squirrelscan/skills | Website security audit |

### Prism (Design / UX) — 6 skills
| Skill | Source | Why |
|-------|--------|-----|
| frontend-design | anthropics/skills | Design principles |
| visual-design-foundations | wshobson/agents | Visual design |
| interaction-design | wshobson/agents | Interaction patterns |
| design-system-patterns | wshobson/agents | Design systems |
| interface-design | dammyjay93 | Interface patterns |
| ui-ux-pro-max | nextlevelbuilder | Advanced UX |

### Clerk (Docs / Knowledge) — 2 skills
| Skill | Source | Why |
|-------|--------|-----|
| doc-coauthoring | anthropics/skills | Doc collaboration |
| internal-comms | anthropics/skills | Internal documentation |

---

**Total: 95 skills across 21 agents** (sourced from [skills.sh](https://skills.sh/))
