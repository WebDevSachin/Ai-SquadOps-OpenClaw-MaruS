---
name: opencode-controller
description: Execute coding tasks via OpenCode AI agent. Routes code generation, editing, debugging, and project scaffolding through OpenCode's terminal-based coding agent.
metadata: {"openclaw": {"requires": {"bins": ["opencode"]}, "emoji": "💻"}}
---

# OpenCode Controller

Use this skill when you need to write, edit, debug, or scaffold code. OpenCode is an AI coding agent that lives in the terminal and can read, edit, and reason over real codebases.

## When to Use

- Scaffold new projects (React, Node.js, Python, etc.)
- Write or edit code files
- Fix bugs and debug issues
- Refactor existing code
- Run tests and fix failures
- Install dependencies
- Start dev servers for preview

## How to Use

Run OpenCode in non-interactive (headless) mode with the `-p` flag:

```bash
# Scaffold a project
opencode -p "Create a React + Vite + Tailwind project in /home/node/projects/my-app with a dashboard layout"

# Edit existing code
opencode -p "In /home/node/projects/my-app, add a login page with email/password form" --approval-mode auto_edit

# Fix bugs
opencode -p "Debug and fix the error in /home/node/projects/my-app/src/App.tsx" --approval-mode auto_edit

# Run tests
opencode -p "Run tests in /home/node/projects/my-app and fix any failures" --approval-mode auto_edit

# Start preview server
opencode -p "Start the dev server for /home/node/projects/my-app on port 5173 --host 0.0.0.0"
```

## Configuration

OpenCode uses the model set in `OPENCODE_MODEL` environment variable. Default: `anthropic/claude-sonnet-4-5`.

Approval modes:
- `auto_edit` — Auto-approve file edits, prompt for other tools (recommended for coding)
- `yolo` — Auto-approve everything (use only for trusted tasks)
- `default` — Prompt for all approvals

## Project Workspace

All projects are created in `/home/node/projects/`. This directory is mounted from the host at `./projects/` so you can inspect the code outside the container.

## Preview

After building, start a dev server on one of the exposed ports:
- Port 5173: Vite dev server (`npm run dev -- --host 0.0.0.0 --port 5173`)
- Port 3001: Next.js (`next dev -p 3001 -H 0.0.0.0`)
- Port 8080: Static files (`npx serve -l 8080 -s build`)

Access previews at `http://localhost:<port>` from your browser.

## Important Rules

- ALWAYS use `--approval-mode auto_edit` for code changes
- ALWAYS specify the full project path
- ALWAYS use `--host 0.0.0.0` when starting dev servers (required for Docker)
- NEVER use `--approval-mode yolo` for production code
- Report back the created/modified files and any running preview URLs
