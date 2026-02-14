---
name: preview-deploy
description: Deploy and preview agent-built applications. Supports local dev server preview, S3 static hosting, and Cloudflare Pages deployment.
metadata: {"openclaw": {"requires": {"bins": ["node"]}, "emoji": "🚀"}}
---

# Preview & Deploy

Use this skill to make agent-built applications accessible for review. Supports three modes:

## 1. Local Preview (Dev Server)

Start a dev server inside the container. Ports are exposed to the host.

```bash
# Vite/React project
cd /home/node/projects/<project-name>
npm run dev -- --host 0.0.0.0 --port 5173

# Next.js project
cd /home/node/projects/<project-name>
npx next dev -p 3001 -H 0.0.0.0

# Static build (any framework)
cd /home/node/projects/<project-name>
npm run build
npx serve -l 8080 -s dist  # or build/ depending on framework
```

Access at:
- `http://localhost:5173` (Vite)
- `http://localhost:3001` (Next.js)
- `http://localhost:8080` (Static)

## 2. Deploy to AWS S3 (Static Sites)

For React/Vite/static builds that need a shareable URL:

```bash
cd /home/node/projects/<project-name>
npm run build

# Upload to S3 (requires AWS credentials)
aws s3 sync dist/ s3://${S3_PREVIEW_BUCKET}/<project-name>/ \
  --delete \
  --cache-control "public, max-age=3600"

# Enable static website hosting
aws s3 website s3://${S3_PREVIEW_BUCKET} \
  --index-document index.html \
  --error-document index.html
```

Preview URL: `http://${S3_PREVIEW_BUCKET}.s3-website-${AWS_REGION}.amazonaws.com/<project-name>/`

## 3. Deploy to Cloudflare Pages (Free)

For quick free deployments with a public URL:

```bash
cd /home/node/projects/<project-name>
npm run build
npx wrangler pages deploy dist --project-name=<project-name>
```

## Security for Preview URLs

- Local previews: Only accessible on localhost (Docker port mapping)
- S3: Use CloudFront + OAI for auth, or S3 bucket policy with IP allowlist
- Cloudflare: Use Cloudflare Access for auth gating

## When to Use Each

| Method | Use When | URL Type |
|--------|----------|----------|
| Local dev server | Quick preview during development | localhost only |
| S3 + CloudFront | Need a shareable URL with auth | Public with auth |
| Cloudflare Pages | Need free public URL fast | Public |

## Important Rules

- ALWAYS build before deploying (`npm run build`)
- ALWAYS use `--host 0.0.0.0` for dev servers in Docker
- NEVER deploy to production S3 buckets without approval
- Report the preview URL back to MaruS immediately after deployment
