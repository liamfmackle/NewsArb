# NewsArb

A reputation-based news discovery platform. Users discover breaking news stories they believe will go viral — early discoverers earn Kudos (reputation points) when stories peak in virality.

**Key concept:** Kudos are non-monetary reputation points that cannot be exchanged for cash.

## Features

- **Story Discovery** — Submit and discover breaking news with AI-powered classification
- **Kudos System** — Earn reputation points for spotting viral stories early
- **Early Bird Rewards** — Earlier discoverers earn more Kudos when a story peaks
- **Virality Tracking** — Real-time virality scores based on article mentions, social signals, and search interest
- **Leaderboards** — Weekly and all-time rankings for top discoverers
- **Automated Distribution** — Kudos are distributed automatically when virality decays

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Fastify, Prisma ORM, PostgreSQL
- **Auth**: NextAuth.js (credentials + Google OAuth), JWT
- **AI**: OpenAI GPT-4o-mini for classification and embeddings
- **Monorepo**: Turborepo, pnpm

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- PostgreSQL (or use Railway/Supabase)
- Redis (optional, for caching)

### Installation

```bash
# Clone the repository
git clone https://github.com/liamfmackle/NewsArb.git
cd NewsArb

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example apps/api/.env
cp .env.example apps/web/.env

# Generate Prisma client and push schema
pnpm db:generate
pnpm db:push

# Start development servers
pnpm dev
```

The app will be available at:
- Frontend: http://localhost:3000
- API: http://localhost:3001

### Environment Variables

See `.env.example` for required configuration:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/newsarb?schema=public"

# Auth
JWT_SECRET="your-secret-key"
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"

# Optional: Google OAuth
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Optional: OpenAI for AI classification
OPENAI_API_KEY=""
```

## Project Structure

```
NewsArb/
├── apps/
│   ├── api/                 # Fastify backend
│   │   ├── prisma/          # Database schema
│   │   └── src/
│   │       ├── routes/      # API endpoints
│   │       ├── services/    # Business logic (kudos, virality)
│   │       └── jobs/        # Background jobs (kudos calculator)
│   └── web/                 # Next.js frontend
│       ├── app/             # App Router pages
│       ├── components/      # React components
│       └── lib/             # Utilities
└── packages/
    └── shared/              # Shared TypeScript types
```

## Scripts

```bash
pnpm dev              # Run both frontend and API
pnpm build            # Build all packages
pnpm lint             # Lint all packages
pnpm db:generate      # Generate Prisma client
pnpm db:push          # Push schema to database
pnpm db:migrate       # Run migrations (production)
```

## How It Works

### Kudos Formula

```
baseKudos = 100 (for participating)
earlyBonus = max(0, 100 - (submissionOrder - 1) * 10)  # Earlier = more
timingBonus = max(0, 50 - hoursSinceFirst * 5)         # Quick = more
viralityBonus = floor(peakViralityScore / 10) * 5      # Viral = more
multiplier = isFirstDiscoverer ? 2.0 : 1.0

totalKudos = (base + early + timing + virality) * multiplier
```

Earlier discoverers get higher bonuses, and the first discoverer receives a 2x multiplier.

### Virality Score

Stories are scored 0-100 based on:
- Article mentions (30%)
- Social signals (30%)
- Search interest (25%)
- Engagement velocity (15%)

### Kudos Distribution

Kudos are distributed automatically when:
- Virality trend is declining for 3 consecutive checks, OR
- Score drops 40%+ from peak

## Terminology

| Term | Definition |
|------|------------|
| Kudos | Non-monetary reputation points |
| Discovery | When a user identifies a story as newsworthy |
| Discoverer | User who discovered a story |
| First Discoverer | Original submitter of a story (2x multiplier) |
| Virality Score | 0-100 measure of story spread |
| Settled | Story whose virality has peaked; Kudos distributed |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT
