# Naija Bill Tracker

Civic infrastructure for tracking bills moving through Nigerian legislatures — the Senate, House of Representatives, 36 State Houses of Assembly plus the FCT, and Executive bills. Free, open, citizen-facing.

This repo is the **v0 end-to-end slice**: a working spine of the architecture in the PRD, with one source (Senate) fully wired through the ingestion → AI explainer → database → API → web pipeline. All external integrations (Claude, email, WhatsApp, object storage) are mocked so the app runs locally with zero API keys.

## What's in this repo

```
naija-bill-tracker/
├── apps/
│   ├── api/          NestJS API + ingestion pipeline + AI explainer
│   └── web/          Next.js 14 (App Router) frontend
├── prisma/           Database schema, migrations, seed data, fixtures
├── docker-compose.yml   Postgres + Redis for local dev
└── .env.example
```

## What's working

- ✅ Postgres schema covering Bills, Legislators, Topics, Jurisdictions, Stage Events, AI Explainers, Source Documents, Users, Subscriptions, Comments, Audit Log
- ✅ Senate "scraper" — reads bundled fixtures through the real ingestion pipeline (parse → normalize → enrich → index)
- ✅ AI explainer service with a `MockClaudeProvider` returning structured plain-English output (`tldr`, `plain_english`, `how_it_affects_you`, `arguments_for`, `arguments_against`, `jargon_terms`, `source_citations`)
- ✅ REST API: `/bills`, `/bills/:jurisdiction/:slug`, `/legislators`, `/topics`, search with filters
- ✅ Web: landing, bills list (search + filters), bill detail with tabbed view (Overview, Plain-Language Explainer, Timeline, Sponsors, Documents), topic pages, legislator pages, about/methodology page
- ✅ Topic auto-tagging via the mock AI provider
- ✅ Postgres full-text search with `tsvector`

## What's stubbed (intentionally)

- ❌ Live scraping of nass.gov.ng et al. — replaced with `senate-bills.json` fixture. Real scrapers slot into `apps/api/src/scrapers/`.
- ❌ Real Claude calls — `MockClaudeProvider` returns deterministic explainers. Swap to `ClaudeProvider` and set `ANTHROPIC_API_KEY` to go live.
- ❌ Email + WhatsApp delivery — interfaces defined, no provider wired.
- ❌ Auth, comments submission, alert subscription UI (read-only placeholders in the web app)
- ❌ Admin console
- ❌ BullMQ / Redis queue (Redis is in docker-compose but no jobs yet)
- ❌ Object storage to R2 — local filesystem fallback

See [PRD §10 (Phasing)](#) for what's next.

## Prerequisites

- Node.js ≥ 20.10
- Docker Desktop (for Postgres) — or a local Postgres install
- npm ≥ 10

## Quick start

```powershell
# 1. Start Postgres + Redis
docker-compose up -d

# 2. Install
npm install

# 3. Set up env
Copy-Item .env.example .env

# 4. Generate Prisma client + migrate + seed reference data
npm run db:generate
npm run db:migrate
npm run db:seed

# 5. Ingest mock Senate bills through the real pipeline
npm run ingest:senate

# 6. Start API + Web in parallel
npm run dev
```

Then open:
- Web: <http://localhost:3000>
- API: <http://localhost:4000>
- API docs (Swagger): <http://localhost:4000/docs>

## Architecture notes

This v0 deviates slightly from the PRD §8 architecture to keep the slice small:

| PRD says | v0 ships | Why |
|---|---|---|
| Three NestJS apps (api, workers, admin-api) | One NestJS app (`apps/api`) with scraper logic invokable as CLI | Workers/admin are post-launch; collapsing avoids premature splitting |
| BullMQ + Redis for scheduled jobs | Direct CLI invocation | No queue needed until we have live sources running on cron |
| Meilisearch fallback for search | Postgres FTS only | FTS sufficient for current corpus |
| Cloudflare R2 for raw PDFs | Local filesystem under `.storage/` | No prod ingestion yet |

The interfaces are clean — extending to the full PRD architecture means swapping providers, not rewriting modules.

## Running with real Claude

```powershell
# In .env
AI_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-...

# Reset explainers and re-run ingestion
npm run db:reset
npm run db:seed
npm run ingest:senate
```

You'll need to install `@anthropic-ai/sdk` in `apps/api` and finish the stub in [apps/api/src/ai/providers/claude.provider.ts](apps/api/src/ai/providers/claude.provider.ts) (the file has a comment marking the spot).

## Editorial guardrails

Per PRD §6.4.2, every explainer carries an "AI-generated, human-reviewed" badge in the UI. Bills flagged sensitive (`sensitive_flag=true` in the schema) show a "Pending editorial review" banner instead of the explainer until an editor approves it. The mock provider currently flags any bill containing the words "election", "security", "religion" — see [apps/api/src/ai/explainer.service.ts](apps/api/src/ai/explainer.service.ts).

## License

TBD — intended to be open. See PRD §3 (Goals).
