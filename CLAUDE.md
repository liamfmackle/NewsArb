# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NewsArb is a prediction market platform for news virality. Users stake on breaking news stories they believe will go viral; early backers earn proportional returns as later participants enter the market pool.

## Commands

### Development
```bash
pnpm install          # Install all dependencies
pnpm dev              # Run both frontend and API in development mode
```

### Individual Apps
```bash
pnpm --filter @newsarb/web dev    # Frontend only (http://localhost:3000)
pnpm --filter @newsarb/api dev    # API only (http://localhost:3001)
```

### Database
```bash
pnpm db:generate      # Generate Prisma client
pnpm db:push          # Push schema to database (dev)
pnpm db:migrate       # Create and run migrations (production)
```

### Build & Lint
```bash
pnpm build            # Build all packages
pnpm lint             # Lint all packages
```

## Architecture

### Monorepo Structure
- `apps/web` - Next.js 14 frontend (App Router, TypeScript, Tailwind, shadcn/ui)
- `apps/api` - Fastify backend (TypeScript, Prisma, Redis)
- `packages/shared` - Shared TypeScript types

### Key Data Flow
1. User submits story with initial stake → AI classifies → Market created
2. Other users stake on market → Pool grows → Earlier backers gain weight advantage
3. Market settles → Payouts distributed proportionally (weight = stake/entryPoolSize)

### Database Schema (PostgreSQL)
- `User` - accounts, balances, KYC status
- `Story` - submitted news with AI classification
- `Market` - trading pool for each story
- `Position` - user stakes with entry timing
- `Transaction` - ledger of all movements

### Payout Logic
```
weight = stakeAmount / poolSizeAtEntry
payout = (weight / totalWeight) * (pool - 5% fee)
```
Earlier backers have smaller `poolSizeAtEntry` → higher weight → larger share.

## Key Files

### Frontend
- `apps/web/app/layout.tsx` - Root layout with Navbar and Providers
- `apps/web/app/stories/page.tsx` - Story feed
- `apps/web/app/stories/[id]/page.tsx` - Market detail page
- `apps/web/components/StakeModal.tsx` - Staking interface
- `apps/web/lib/api.ts` - API client with typed endpoints

### Backend
- `apps/api/src/index.ts` - Fastify server setup
- `apps/api/src/routes/stories.ts` - Story CRUD + market creation
- `apps/api/src/routes/markets.ts` - Staking and settlement
- `apps/api/src/ai/classifier.ts` - OpenAI integration for story classification
- `apps/api/prisma/schema.prisma` - Database schema

### Authentication
- NextAuth.js handles frontend sessions (credentials + Google OAuth)
- API uses JWT tokens issued by the backend
- Web3 wallet connection via wagmi + RainbowKit
- Wallet can be linked to user account for optional wallet-based features

Key auth files:
- `apps/web/app/api/auth/[...nextauth]/route.ts` - NextAuth configuration
- `apps/web/hooks/useAuth.ts` - Unified auth hook (session + wallet state)
- `apps/web/components/WalletButton.tsx` - RainbowKit wallet connector
- `apps/web/components/UserMenu.tsx` - User dropdown with settings/logout
- `apps/web/middleware.ts` - Protected route middleware
- `apps/web/lib/wagmi.ts` - Wagmi/RainbowKit configuration

### Payments (Stripe)
- Stripe Checkout for wallet deposits in multiple currencies
- Webhook handler for payment confirmation
- Automatic currency conversion to USD for balance

Key payment files:
- `apps/api/src/routes/payments.ts` - Payment routes (checkout, webhook, deposits)
- `apps/web/components/DepositModal.tsx` - Deposit modal with currency selection
- `apps/web/app/deposit/success/page.tsx` - Post-payment success page
- `apps/web/app/deposit/cancel/page.tsx` - Payment cancelled page

## Environment Variables

Copy `.env.example` to `.env` and configure:
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis for caching
- `NEXTAUTH_SECRET` - Session encryption
- `GOOGLE_CLIENT_ID/SECRET` - OAuth (optional)
- `OPENAI_API_KEY` - AI classification (optional, defaults to auto-approve)
- `STRIPE_SECRET_KEY` - Stripe secret key for payments
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key for frontend
