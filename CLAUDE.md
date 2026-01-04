# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NewsArb is a reputation-based news discovery platform. Users discover breaking news stories they believe will go viral; early discoverers earn Kudos (reputation points) when stories peak in virality.

**Key concept:** This is NOT a betting/gambling platform. Kudos are non-monetary reputation points that cannot be exchanged for cash.

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
1. User submits/discovers story → AI classifies → Story created
2. Other users discover same story → Discoverer count grows
3. Story virality peaks (detected by decay) → Kudos distributed to all discoverers
4. Earlier discoverers earn more Kudos (timing bonus)

### Database Schema (PostgreSQL)
- `User` - accounts with Kudos stats (totalKudos, weeklyKudos, ranks)
- `Story` - submitted news with AI classification and virality tracking
- `Submission` - tracks who discovered stories and when
- `KudosHistory` - ledger of all Kudos earnings
- `ViralitySnapshot` - time-series virality data
- `CanonicalEvent` - clusters related stories

### Kudos Formula
```
baseKudos = 100 (for participating)
earlyBonus = max(0, 100 - (submissionOrder - 1) * 10)  // Earlier = more
timingBonus = max(0, 50 - hoursSinceFirst * 5)          // Quick = more
viralityBonus = floor(peakViralityScore / 10) * 5       // Viral = more
multiplier = isFirstDiscoverer ? 2.0 : 1.0

totalKudos = (base + early + timing + virality) * multiplier
```

## Key Files

### Frontend
- `apps/web/app/layout.tsx` - Root layout with Navbar and Providers
- `apps/web/app/stories/page.tsx` - Story feed
- `apps/web/app/stories/[id]/page.tsx` - Story detail page
- `apps/web/app/portfolio/page.tsx` - User's discoveries and Kudos
- `apps/web/app/leaderboards/page.tsx` - Weekly and all-time rankings
- `apps/web/components/StoryCard.tsx` - Story card component
- `apps/web/lib/api.ts` - API client with typed endpoints

### Backend
- `apps/api/src/index.ts` - Fastify server setup
- `apps/api/src/routes/stories.ts` - Story CRUD + discovery
- `apps/api/src/routes/users.ts` - User profile, submissions, Kudos history
- `apps/api/src/routes/leaderboards.ts` - Leaderboard endpoints
- `apps/api/src/services/kudos.ts` - Kudos calculation logic
- `apps/api/src/services/virality.ts` - Virality tracking
- `apps/api/src/jobs/kudosCalculator.ts` - Background job for Kudos distribution
- `apps/api/src/ai/classifier.ts` - OpenAI integration for story classification
- `apps/api/prisma/schema.prisma` - Database schema

### Authentication
- NextAuth.js handles frontend sessions (credentials + Google OAuth)
- API uses JWT tokens issued by the backend

Key auth files:
- `apps/web/app/api/auth/[...nextauth]/route.ts` - NextAuth configuration
- `apps/web/hooks/useAuth.ts` - Auth hook (session + user data)
- `apps/web/components/UserMenu.tsx` - User dropdown with settings/logout
- `apps/web/middleware.ts` - Protected route middleware

## Environment Variables

Copy `.env.example` to `.env` and configure:
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis for caching
- `NEXTAUTH_SECRET` - Session encryption
- `GOOGLE_CLIENT_ID/SECRET` - OAuth (optional)
- `OPENAI_API_KEY` - AI classification (optional, defaults to auto-approve)

## Terminology

| Term | Definition |
|------|------------|
| Kudos | Non-monetary reputation points |
| Discovery | When a user identifies a story as newsworthy |
| Discoverer | User who discovered a story |
| First Discoverer | Original submitter of a story (2x multiplier) |
| Virality Score | 0-100 measure of story spread |
| Settled | Story whose virality has peaked; Kudos distributed |
