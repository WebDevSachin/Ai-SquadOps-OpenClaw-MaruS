#!/usr/bin/env bash
# SquadOps — Install Agent Skills from skills.sh
# Maps the best open-source skills to each specialized agent
# Run from: squadops/
# Usage: ./scripts/install-skills.sh [agent-name]
# Example: ./scripts/install-skills.sh forge
# Or install all: ./scripts/install-skills.sh

set -euo pipefail

AGENTS_DIR="$(cd "$(dirname "$0")/.." && pwd)/agents"

install_skill() {
  local agent="$1"
  local skill="$2"
  local dir="$AGENTS_DIR/$agent/skills"
  mkdir -p "$dir"
  echo "  Installing $skill for $agent..."
  (cd "$dir" && npx skills add "$skill" 2>/dev/null) || echo "  ⚠ Failed: $skill"
}

install_marus() {
  echo "=== MaruS (Lead / Orchestrator) ==="
  install_skill marus "obra/superpowers/brainstorming"
  install_skill marus "obra/superpowers/writing-plans"
  install_skill marus "obra/superpowers/executing-plans"
  install_skill marus "obra/superpowers/dispatching-parallel-agents"
  install_skill marus "obra/superpowers/subagent-driven-development"
  install_skill marus "obra/superpowers/using-superpowers"
}

install_forge() {
  echo "=== Forge (Backend Dev) ==="
  install_skill forge "wshobson/agents/nodejs-backend-patterns"
  install_skill forge "wshobson/agents/api-design-principles"
  install_skill forge "wshobson/agents/error-handling-patterns"
  install_skill forge "wshobson/agents/microservices-patterns"
  install_skill forge "wshobson/agents/auth-implementation-patterns"
  install_skill forge "wshobson/agents/modern-javascript-patterns"
  install_skill forge "wshobson/agents/typescript-advanced-types"
}

install_canvas() {
  echo "=== Canvas (Frontend / UI) ==="
  install_skill canvas "anthropics/skills/frontend-design"
  install_skill canvas "vercel-labs/agent-skills/vercel-react-best-practices"
  install_skill canvas "vercel-labs/agent-skills/web-design-guidelines"
  install_skill canvas "vercel-labs/agent-skills/vercel-composition-patterns"
  install_skill canvas "vercel-labs/next-skills/next-best-practices"
  install_skill canvas "wshobson/agents/tailwind-design-system"
  install_skill canvas "wshobson/agents/responsive-design"
  install_skill canvas "nextlevelbuilder/ui-ux-pro-max-skill/ui-ux-pro-max"
  install_skill canvas "giuseppe-trisciuoglio/developer-kit/shadcn-ui"
}

install_helm() {
  echo "=== Helm (DevOps / Infra) ==="
  install_skill helm "sickn33/antigravity-awesome-skills/docker-expert"
  install_skill helm "wshobson/agents/github-actions-templates"
  install_skill helm "wshobson/agents/monorepo-management"
}

install_aegis() {
  echo "=== Aegis (QA / Testing) ==="
  install_skill aegis "obra/superpowers/test-driven-development"
  install_skill aegis "obra/superpowers/verification-before-completion"
  install_skill aegis "anthropics/skills/webapp-testing"
  install_skill aegis "wshobson/agents/e2e-testing-patterns"
  install_skill aegis "wshobson/agents/javascript-testing-patterns"
}

install_vault() {
  echo "=== Vault (DBA / Database) ==="
  install_skill vault "supabase/agent-skills/supabase-postgres-best-practices"
  install_skill vault "wshobson/agents/postgresql-table-design"
  install_skill vault "wshobson/agents/sql-optimization-patterns"
  install_skill vault "wshobson/agents/database-migration"
}

install_architect() {
  echo "=== Architect (System Design) ==="
  install_skill architect "wshobson/agents/architecture-patterns"
  install_skill architect "wshobson/agents/architecture-decision-records"
  install_skill architect "wshobson/agents/microservices-patterns"
  install_skill architect "wshobson/agents/api-design-principles"
}

install_patcher() {
  echo "=== Patcher (Code Review) ==="
  install_skill patcher "obra/superpowers/requesting-code-review"
  install_skill patcher "obra/superpowers/receiving-code-review"
  install_skill patcher "wshobson/agents/code-review-excellence"
  install_skill patcher "obra/superpowers/finishing-a-development-branch"
}

install_scout() {
  echo "=== Scout (Research) ==="
  install_skill scout "obra/superpowers/brainstorming"
  install_skill scout "firecrawl/cli/firecrawl"
  install_skill scout "coreyhaines31/marketingskills/competitor-alternatives"
}

install_scribe() {
  echo "=== Scribe (Content Writer) ==="
  install_skill scribe "coreyhaines31/marketingskills/copywriting"
  install_skill scribe "coreyhaines31/marketingskills/copy-editing"
  install_skill scribe "coreyhaines31/marketingskills/content-strategy"
  install_skill scribe "anthropics/skills/doc-coauthoring"
  install_skill scribe "coreyhaines31/marketingskills/email-sequence"
}

install_sentinel() {
  echo "=== Sentinel (Retention) ==="
  install_skill sentinel "coreyhaines31/marketingskills/onboarding-cro"
  install_skill sentinel "coreyhaines31/marketingskills/signup-flow-cro"
  install_skill sentinel "coreyhaines31/marketingskills/page-cro"
  install_skill sentinel "coreyhaines31/marketingskills/form-cro"
  install_skill sentinel "coreyhaines31/marketingskills/paywall-upgrade-cro"
}

install_lens() {
  echo "=== Lens (SEO) ==="
  install_skill lens "coreyhaines31/marketingskills/seo-audit"
  install_skill lens "coreyhaines31/marketingskills/programmatic-seo"
  install_skill lens "coreyhaines31/marketingskills/schema-markup"
  install_skill lens "resciencelab/opc-skills/seo-geo"
  install_skill lens "aaron-he-zhu/seo-geo-claude-skills/backlink-analyzer"
}

install_herald() {
  echo "=== Herald (Outreach / Sales) ==="
  install_skill herald "coreyhaines31/marketingskills/email-sequence"
  install_skill herald "coreyhaines31/marketingskills/launch-strategy"
  install_skill herald "coreyhaines31/marketingskills/free-tool-strategy"
  install_skill herald "resend/email-best-practices/email-best-practices"
}

install_oracle() {
  echo "=== Oracle (Analytics) ==="
  install_skill oracle "coreyhaines31/marketingskills/analytics-tracking"
  install_skill oracle "coreyhaines31/marketingskills/ab-test-setup"
  install_skill oracle "wshobson/agents/stripe-integration"
}

install_guide() {
  echo "=== Guide (Onboarding) ==="
  install_skill guide "coreyhaines31/marketingskills/onboarding-cro"
  install_skill guide "coreyhaines31/marketingskills/signup-flow-cro"
  install_skill guide "coreyhaines31/marketingskills/form-cro"
  install_skill guide "resend/email-best-practices/email-best-practices"
}

install_beacon() {
  echo "=== Beacon (Social Media) ==="
  install_skill beacon "coreyhaines31/marketingskills/social-content"
  install_skill beacon "coreyhaines31/marketingskills/marketing-ideas"
  install_skill beacon "coreyhaines31/marketingskills/marketing-psychology"
}

install_shield() {
  echo "=== Shield (Customer Support) ==="
  install_skill shield "anthropics/skills/internal-comms"
  install_skill shield "anthropics/skills/doc-coauthoring"
}

install_compass() {
  echo "=== Compass (Strategy / Planning) ==="
  install_skill compass "coreyhaines31/marketingskills/pricing-strategy"
  install_skill compass "coreyhaines31/marketingskills/product-marketing-context"
  install_skill compass "coreyhaines31/marketingskills/competitor-alternatives"
  install_skill compass "coreyhaines31/marketingskills/launch-strategy"
  install_skill compass "coreyhaines31/marketingskills/marketing-ideas"
  install_skill compass "obra/superpowers/writing-plans"
  install_skill compass "obra/superpowers/executing-plans"
}

install_warden() {
  echo "=== Warden (Security / Audit) ==="
  install_skill warden "wshobson/agents/security-requirement-extraction"
  install_skill warden "wshobson/agents/auth-implementation-patterns"
  install_skill warden "squirrelscan/skills/audit-website"
}

install_prism() {
  echo "=== Prism (Design / UX) ==="
  install_skill prism "anthropics/skills/frontend-design"
  install_skill prism "wshobson/agents/visual-design-foundations"
  install_skill prism "wshobson/agents/interaction-design"
  install_skill prism "wshobson/agents/design-system-patterns"
  install_skill prism "dammyjay93/interface-design/interface-design"
  install_skill prism "nextlevelbuilder/ui-ux-pro-max-skill/ui-ux-pro-max"
}

install_clerk() {
  echo "=== Clerk (Docs / Knowledge) ==="
  install_skill clerk "anthropics/skills/doc-coauthoring"
  install_skill clerk "anthropics/skills/internal-comms"
}

# Main
if [ $# -eq 0 ]; then
  echo "Installing skills for ALL 21 agents..."
  echo ""
  install_marus
  install_forge
  install_canvas
  install_helm
  install_aegis
  install_vault
  install_architect
  install_patcher
  install_scout
  install_scribe
  install_sentinel
  install_lens
  install_herald
  install_oracle
  install_guide
  install_beacon
  install_shield
  install_compass
  install_warden
  install_prism
  install_clerk
  echo ""
  echo "Done! All skills installed."
else
  agent="$1"
  func="install_$agent"
  if type "$func" &>/dev/null; then
    "$func"
  else
    echo "Unknown agent: $agent"
    echo "Available: marus forge canvas helm aegis vault architect patcher scout scribe sentinel lens herald oracle guide beacon shield compass warden prism clerk"
    exit 1
  fi
fi
