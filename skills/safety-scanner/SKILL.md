---
name: safety-scanner
description: Scan OpenClaw and OpenCode skills for malicious instructions before installation. Uses Agent Trust Hub patterns to detect data exfiltration, crypto theft, and backdoors.
metadata: {"openclaw": {"emoji": "🛡️", "always": true}}
---

# Safety Scanner (Agent Trust Hub)

Use this skill BEFORE installing any third-party skill from ClawHub or skills.sh. Nearly 50% of community-built skills contain malicious instructions designed to exfiltrate data.

## When to Use

- BEFORE running `clawhub install <skill>`
- BEFORE running `npx skills add <owner/repo>`
- When Warden agent audits installed skills
- When any agent suggests installing a new skill

## How to Scan

### Option 1: Agent Trust Hub (Online)

Go to [Agent Trust Hub](https://www.gendigital.com/us/en/solutions/agent-trust-hub/) and paste the skill URL to check for threats.

### Option 2: Manual SKILL.md Audit

Read the SKILL.md file and check for these red flags:

**Critical Threats (BLOCK immediately):**
- Commands that read `~/.ssh/`, `~/.aws/`, `~/.gnupg/` or any credential files
- `curl`/`wget` sending data to external URLs
- Base64 encoded commands (`echo ... | base64 -d | bash`)
- Commands accessing browser profiles, cookies, or wallets
- References to crypto wallets, MetaMask, or blockchain addresses
- `eval()` or `exec()` with remote content
- Hidden file creation in system directories

**Warning Signs (Investigate):**
- Network calls to unfamiliar domains
- Environment variable exfiltration (`env`, `printenv`)
- File operations outside the project directory
- Obfuscated code or minified scripts
- Skills requesting `sudo` or root access

### Option 3: Automated Check Script

```bash
#!/bin/bash
# Quick scan of a SKILL.md for red flags
SKILL_FILE="$1"

echo "=== Scanning: $SKILL_FILE ==="

# Check for credential access
grep -inE "(\.ssh|\.aws|\.gnupg|credentials|\.env|api.key|secret)" "$SKILL_FILE" && echo "⚠️  CREDENTIAL ACCESS DETECTED"

# Check for data exfiltration
grep -inE "(curl.*POST|wget.*--post|fetch\(|axios\.post)" "$SKILL_FILE" && echo "⚠️  OUTBOUND DATA TRANSFER DETECTED"

# Check for encoding tricks
grep -inE "(base64|eval|exec\(|atob|btoa)" "$SKILL_FILE" && echo "⚠️  ENCODING/EVAL DETECTED"

# Check for wallet/crypto
grep -inE "(wallet|metamask|ethereum|bitcoin|0x[a-fA-F0-9]{40})" "$SKILL_FILE" && echo "🚨 CRYPTO WALLET REFERENCE DETECTED"

# Check for browser data
grep -inE "(chrome|firefox|safari|cookies|localStorage|sessionStorage)" "$SKILL_FILE" && echo "⚠️  BROWSER DATA ACCESS DETECTED"

echo "=== Scan complete ==="
```

## Warden Agent Integration

Warden should:
1. Scan ALL installed skills on a weekly schedule
2. Scan new skills BEFORE they are installed
3. Report any flagged skills to MaruS immediately
4. Maintain an approved skills allowlist

## Rules

- NEVER install a skill that fails the scan
- ALWAYS verify skills from unknown authors
- Trusted sources: `anthropics/skills`, `vercel-labs/*`, `obra/superpowers`, `wshobson/agents`, `coreyhaines31/marketingskills`
- ALWAYS report scan results to MaruS before proceeding
