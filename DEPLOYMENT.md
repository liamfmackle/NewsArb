# NewsArb Deployment Guide

This guide walks you through deploying NewsArb to Railway.

## Prerequisites

- GitHub account with this repository
- [Railway account](https://railway.app) (free tier available)

## Architecture Overview

The production deployment consists of 4 services:

```
┌─────────────────────────────────────────────────────────┐
│                     Railway Project                      │
├─────────────┬─────────────┬─────────────┬───────────────┤
│   Web App   │   API App   │  PostgreSQL │     Redis     │
│  (Next.js)  │  (Fastify)  │  (Database) │   (Cache)     │
│   :3000     │   :3001     │   :5432     │    :6379      │
└─────────────┴─────────────┴─────────────┴───────────────┘
```

## Deployment Steps

### Step 1: Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in
2. Click **"New Project"**
3. Select **"Empty Project"**

### Step 2: Add PostgreSQL Database

1. In your project, click **"+ New"** → **"Database"** → **"PostgreSQL"**
2. Railway automatically provisions the database
3. The `DATABASE_URL` variable is created automatically

### Step 3: Add Redis

1. Click **"+ New"** → **"Database"** → **"Redis"**
2. Railway automatically provisions Redis
3. The `REDIS_URL` variable is created automatically

### Step 4: Deploy the API Service

1. Click **"+ New"** → **"GitHub Repo"**
2. Select this repository
3. Railway will detect the monorepo structure
4. Configure the service:
   - **Name**: `api`
   - **Root Directory**: `apps/api`
   - **Build Command**: (leave empty, uses Dockerfile)
   - **Start Command**: (leave empty, uses Dockerfile)

5. Add environment variables (click on the service → Variables):

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Reference from PostgreSQL service |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` | Reference from Redis service |
| `JWT_SECRET` | Generate with `openssl rand -base64 32` | Required |
| `FRONTEND_URL` | Your web app URL (set after Step 5) | For CORS |
| `NODE_ENV` | `production` | |

6. Click **"Deploy"**

### Step 5: Deploy the Web Service

1. Click **"+ New"** → **"GitHub Repo"**
2. Select this repository again
3. Configure the service:
   - **Name**: `web`
   - **Root Directory**: `apps/web`
   - **Build Command**: (leave empty, uses Dockerfile)

4. Add environment variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `NEXTAUTH_SECRET` | Generate with `openssl rand -base64 32` | Required |
| `NEXTAUTH_URL` | Your Railway web URL | e.g., `https://web-production-xxxx.up.railway.app` |
| `API_URL` | Internal API URL | e.g., `http://api.railway.internal:3001` |
| `NEXT_PUBLIC_API_URL` | Public API URL | Your Railway API URL |
| `NODE_ENV` | `production` | |

5. Click **"Deploy"**

### Step 6: Run Database Migrations

1. Go to your API service in Railway
2. Click **"Settings"** → **"Deploy"**
3. Under **"Custom Build Command"**, add for initial deploy:
   ```
   pnpm install && pnpm db:generate && pnpm db:migrate deploy && pnpm build
   ```
4. After first successful deploy, you can remove the migration step

Or run manually via Railway CLI:
```bash
railway run pnpm db:migrate deploy
```

### Step 7: Update Cross-References

After both services are deployed:

1. **Update API's FRONTEND_URL**: Set to the web service's public URL
2. **Update Web's NEXT_PUBLIC_API_URL**: Set to the API service's public URL
3. Redeploy both services

### Step 8: Generate Public URLs

1. Click on each service
2. Go to **"Settings"** → **"Networking"**
3. Click **"Generate Domain"** or add a custom domain

## Custom Domain Setup

Once deployed, you can add your custom domain:

### For the Web App:
1. Go to the web service → **"Settings"** → **"Networking"**
2. Click **"+ Custom Domain"**
3. Enter your domain (e.g., `newsarb.com`)
4. Railway provides DNS records to add to your registrar

### For the API:
1. Go to the API service → **"Settings"** → **"Networking"**
2. Click **"+ Custom Domain"**
3. Enter your API subdomain (e.g., `api.newsarb.com`)
4. Add the DNS records to your registrar

### DNS Configuration

Add these records at your domain registrar:

| Type | Name | Value |
|------|------|-------|
| CNAME | `@` or `www` | `<your-web-service>.up.railway.app` |
| CNAME | `api` | `<your-api-service>.up.railway.app` |

Railway automatically provisions SSL certificates.

## Environment Variables Reference

### API Service

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection URL |
| `REDIS_URL` | Yes | Redis connection URL |
| `JWT_SECRET` | Yes | Secret for JWT tokens |
| `FRONTEND_URL` | Yes | Web app URL for CORS |
| `PORT` | No | Server port (default: 3001) |
| `OPENAI_API_KEY` | No | For AI classification |
| `NODE_ENV` | Yes | Set to `production` |

### Web Service

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXTAUTH_SECRET` | Yes | Secret for NextAuth sessions |
| `NEXTAUTH_URL` | Yes | Full URL of the web app |
| `API_URL` | Yes | Backend API URL (can use internal networking) |
| `NEXT_PUBLIC_API_URL` | Yes | Public API URL for browser |
| `GOOGLE_CLIENT_ID` | No | For Google OAuth |
| `GOOGLE_CLIENT_SECRET` | No | For Google OAuth |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | No | For Web3 wallet |
| `NODE_ENV` | Yes | Set to `production` |

## Automatic Deployments (CI/CD)

Railway automatically deploys when you push to the `main` branch:

1. Push to `main` → Railway detects changes
2. Builds Docker images
3. Runs health checks
4. Deploys new version
5. Zero-downtime deployment

GitHub Actions runs tests and linting on every push and PR.

## Monitoring

### Railway Dashboard
- View logs in real-time
- Monitor resource usage
- Check deployment status

### Health Checks
- API: `GET /health` returns `{ "status": "ok" }`
- Web: Responds on `/`

## Troubleshooting

### Build Failures

1. Check build logs in Railway dashboard
2. Ensure all environment variables are set
3. Verify Dockerfile paths are correct

### Database Connection Issues

1. Verify `DATABASE_URL` is correctly referenced
2. Check PostgreSQL service is running
3. Run migrations: `railway run pnpm db:migrate deploy`

### CORS Errors

1. Ensure `FRONTEND_URL` on API matches web app URL exactly
2. Include protocol (`https://`)
3. No trailing slash

### 500 Errors on API

1. Check API logs in Railway
2. Verify `JWT_SECRET` is set
3. Ensure database migrations ran successfully

## Scaling (Beyond Free Tier)

When ready to scale:

1. Upgrade Railway plan
2. Increase service resources in Settings
3. Add horizontal scaling (multiple instances)
4. Consider dedicated database

## Cost Estimation

Railway Free Tier includes:
- $5/month in credits
- ~500 hours of runtime
- Shared CPU and RAM

For production traffic, expect:
- Hobby plan: ~$20/month
- Pro plan: Usage-based pricing

## Seed Data (Optional)

To add demo data for testing:

```bash
railway run pnpm db:seed
```

This creates:
- Demo users (demo@newsarb.com, etc.)
- Sample stories and markets
