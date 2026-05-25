# Deploying Naija Bill Tracker

Production target: **`https://naijabilltracker.com.ng`**.

The stack splits across three providers:

| Piece | Where | URL |
|---|---|---|
| **Web** (Next.js) | Vercel | `https://naijabilltracker.com.ng` |
| **API** (NestJS) | Render | `https://api.naijabilltracker.com.ng` |
| **Database** | Neon | (already in place) |

Vercel is **not** an option for the API — NestJS expects a long-running HTTP server, not serverless functions. Render's free tier works well; Railway and Fly.io are interchangeable substitutes.

---

## 0. One-time prep

### 0.1 Push to GitHub
Both Vercel and Render deploy from a Git repo.

```bash
cd C:\Users\USER\naija-bill-tracker
git init
git add .
git commit -m "Initial deploy"
gh repo create naija-bill-tracker --private --source=. --push
```

### 0.2 Generate fresh secrets

You will need three random secrets. Generate now and keep them in a password manager:

```bash
# AUTH_JWT_SECRET — at least 32 chars
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# ADMIN_TOKEN — what you'll type at /admin/login
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

The Groq, Tavily, and Resend keys you already have — **rotate them now** in their dashboards because they've been shared in chat earlier. Use the fresh values in steps below.

### 0.3 Verify Resend domain
- https://resend.com/domains → confirm `naijabilltracker.com.ng` is verified (you reported this earlier)
- Note the DKIM + SPF records Resend gave you — those should already be in DNS

---

## 1. Deploy the API to Render

The root `package.json` defines `start` (launches the API) and a `postinstall` hook
(runs `prisma generate`), so **Render's default `npm install && npm run build` → `npm start`
flow works without custom config**. Two equivalent ways to create the service:

### 1.1a Blueprint (reads `render.yaml`)

1. https://dashboard.render.com → **New +** → **Blueprint**
2. Connect your GitHub repo
3. Render reads `render.yaml` and shows the service plan. Click **Apply**

### 1.1b Manual web service

1. **New +** → **Web Service** → connect the repo
2. Settings:
   - **Build command**: `npm install && npm run build`
   - **Start command**: `npm start`
   - **Health check path**: `/health`
   - **Environment**: Node, Free plan, Frankfurt region

### 1.2 Set secrets in the Render dashboard

Open the `nbt-api` service → **Environment** tab → add these (each one is in `render.yaml` marked `sync: false`):

| Key | Value |
|---|---|
| `DATABASE_URL` | Your Neon connection string |
| `AUTH_JWT_SECRET` | The 48-byte token from §0.2 |
| `ADMIN_TOKEN` | The 24-byte token from §0.2 |
| `AI_API_KEY` | Your fresh Groq key (`gsk_…`) |
| `TAVILY_API_KEY` | Your fresh Tavily key (`tvly-…`) |
| `RESEND_API_KEY` | Your fresh Resend key (`re_…`) |

Already pre-set in the blueprint (don't touch unless you want to change them):
- `EMAIL_FROM` → `Naija Bill Tracker <alerts@naijabilltracker.com.ng>`
- `CORS_ORIGIN`, `PUBLIC_WEB_URL`, `USE_LIVE_SOURCES`, `NASS_MAX_BILLS`, `EMAIL_PROVIDER`, `AI_PROVIDER`

### 1.3 Migrate the production database

Render will run `npx prisma generate` during build, but it doesn't apply migrations. Apply them once from your laptop:

```bash
# .env.prod with the production DATABASE_URL
DATABASE_URL="postgresql://..." npx prisma migrate deploy --schema=prisma/schema.prisma
DATABASE_URL="postgresql://..." npm run db:seed
```

Optional: pre-load some Senate fixtures:
```bash
DATABASE_URL="..." AI_API_KEY="..." AI_PROVIDER=groq npm run ingest:senate
```

### 1.4 Wire DNS for `api.naijabilltracker.com.ng`

1. Render → service → **Settings** → **Custom Domains** → **Add Custom Domain** → `api.naijabilltracker.com.ng`
2. Render gives you a `CNAME` target (something like `nbt-api.onrender.com`)
3. At your DNS host (the same place where you verified Resend), add:
   ```
   Type   Name   Value
   CNAME  api    nbt-api.onrender.com
   ```
4. Render auto-issues a Let's Encrypt cert once DNS propagates (1–10 min)

### 1.5 Verify
```bash
curl https://api.naijabilltracker.com.ng/health
# → {"status":"ok","service":"nbt-api","time":"..."}

curl https://api.naijabilltracker.com.ng/api/bills?limit=1 | head -c 300
```

---

## 2. Deploy the Web to Vercel

### 2.1 Import the project

1. https://vercel.com/new → import your GitHub repo
2. Vercel reads `vercel.json`. Confirm:
   - **Framework Preset**: Next.js
   - **Root Directory**: `.` (project root — workspaces need this)
   - **Build Command** is the one from `vercel.json` (don't override)
   - **Output Directory**: `apps/web/.next`

### 2.2 Environment variables

Add via Project → **Settings** → **Environment Variables** (mark all as **Production** scope):

| Key | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.naijabilltracker.com.ng` |
| `NEXT_PUBLIC_WEB_URL` | `https://naijabilltracker.com.ng` |
| `PUBLIC_WEB_URL` | `https://naijabilltracker.com.ng` |
| `DATABASE_URL` | Same Neon URL as Render (Prisma client needs it to generate types at build) |

### 2.3 Wire DNS for the apex + www

1. Vercel project → **Settings** → **Domains** → **Add** → `naijabilltracker.com.ng`
2. Add `www.naijabilltracker.com.ng` too — Vercel will offer to redirect www → apex (accept)
3. At your DNS host:
   ```
   Type   Name   Value
   A      @      76.76.21.21          # Vercel's apex IP
   
   CNAME  www    cname.vercel-dns.com
   ```
4. Wait for propagation; Vercel issues the SSL cert automatically

### 2.4 Trigger a deploy
- Vercel auto-deploys on every push to `main`
- Or click **Redeploy** on the dashboard

### 2.5 Verify
- https://naijabilltracker.com.ng — home page in Cinzel, all 5 languages in the switcher
- https://naijabilltracker.com.ng/bills — bill list renders, search works
- https://naijabilltracker.com.ng/admin/login — enter your `ADMIN_TOKEN`
- Sign-in flow: real OTP email arrives in your Gmail inbox

---

## 3. Post-deploy checklist

- [ ] Open the production site — verify the new domain shows in the hero, footer, share URLs
- [ ] Submit an OTP request from a non-personal email — confirm Resend delivers (now that the domain is verified)
- [ ] Sign in to `/admin` with the new `ADMIN_TOKEN`
- [ ] Run a sample ingest: visit Render shell or use the deploy hook — `USE_LIVE_SOURCES=true npm run ingest:senate`
- [ ] Trigger an "advance stage" on a sample bill — confirm the alert email arrives
- [ ] Trigger a daily digest dry-run from `/admin/digest`
- [ ] Translate one explainer to Yoruba from `/admin/bills/[id]` — read the result on the public bill page with `?lang=yo`
- [ ] Open the public bill in incognito + dark mode + Yorùbá — visual sanity check
- [ ] Confirm DNS over time: `dig naijabilltracker.com.ng`, `dig api.naijabilltracker.com.ng`
- [ ] Test mobile nav on a phone

---

## 4. Operations

### Logs
- **Render**: dashboard → service → **Logs** tab
- **Vercel**: project → **Deployments** → click a deploy → **Runtime Logs**

### Updating
- Push to `main` → both Vercel and Render redeploy automatically
- Schema changes: run `prisma migrate deploy` locally against the prod DATABASE_URL before pushing the new schema code

### Adding scraper sources
- Edit `apps/api/src/scrapers/*` → push → Render rebuilds
- Trigger ingest manually via Render Shell or schedule via Render's cron jobs

### Scaling
- Render free tier sleeps after 15 min idle. First request after a sleep takes ~30 sec. Upgrade to the $7/mo Starter plan for always-on.
- Neon free tier supports the current dataset easily; scale storage tier when bills > 50k

---

## 5. Rollback

```bash
# Vercel: dashboard → Deployments → click any prior good deploy → Promote to Production
# Render: dashboard → Deploys → click the prior deploy → Redeploy
```

Database rollbacks: Neon supports branching and point-in-time restore from its dashboard.

---

## What's NOT auto-deployed

- **Live scrapers** — the infra is there but the per-source CSS selectors (Lagos, Rivers, Kaduna etc.) need tuning against the real sites once you can inspect them. NASS works out of the box; rest fall back to fixtures with a logged warning.
- **Background digest cron** — runs inside the API process. Render's free tier sleeps; if you want guaranteed 07:00 WAT execution, either bump to the Starter plan or move to an external cron (Render Jobs or GitHub Actions hitting `/api/admin/digest/run`).
- **Sitemap + robots.txt** — not yet generated. Add via Next.js' built-in `app/sitemap.ts` and `app/robots.ts` when you're ready to invite Google in.
