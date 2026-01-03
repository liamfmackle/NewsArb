# NewsArb

A prediction market platform for news virality. Users stake on breaking news stories they believe will go viral — early backers earn proportional returns as later participants enter the market pool.

## Features

- **Story Submission** — Submit breaking news with AI-powered classification
- **Market Staking** — Stake on stories you believe will go viral
- **Weighted Payouts** — Earlier backers receive higher weight in the payout pool
- **Virality Tracking** — Real-time virality scores based on article mentions, social signals, and search interest
- **Automated Settlement** — Markets settle automatically when virality decays
- **Web3 Integration** — Optional wallet connection via RainbowKit

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Fastify, Prisma ORM, SQLite (dev) / PostgreSQL (prod)
- **Auth**: NextAuth.js (credentials + Google OAuth), JWT
- **AI**: OpenAI GPT-4o-mini for classification and embeddings
- **Monorepo**: Turborepo, pnpm

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)

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

Create `.env` files in `apps/api` and `apps/web` with the following:

```env
# Database
DATABASE_URL="file:./dev.db"

# Auth
JWT_SECRET="your-secret-key"
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"

# Optional: Google OAuth
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Optional: OpenAI for AI classification
OPENAI_API_KEY=""

# Optional: NewsAPI for virality tracking
NEWSAPI_KEY=""
```

## Project Structure

```
NewsArb/
├── apps/
│   ├── api/                 # Fastify backend
│   │   ├── prisma/          # Database schema
│   │   └── src/
│   │       ├── routes/      # API endpoints
│   │       ├── services/    # Business logic
│   │       └── jobs/        # Background jobs
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

### Payout Logic

```
weight = stakeAmount / poolSizeAtEntry
payout = (weight / totalWeight) * (pool - 5% fee)
```

Earlier backers have a smaller `poolSizeAtEntry`, giving them higher weight and a larger share of the final pool.

### Virality Score

Stories are scored 0-100 based on:
- Article mentions (30%)
- Social signals (30%)
- Search interest (25%)
- Engagement velocity (15%)

### Settlement

Markets settle automatically when:
- Virality trend is declining for 3 consecutive checks, OR
- Score drops 40%+ from peak

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT
