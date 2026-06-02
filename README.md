# VocalLytics

![CI](https://github.com/vishnup22/Vocalytics/actions/workflows/ci.yml/badge.svg)

**Voice-to-SQL BI copilot** — ask a business question by voice or text, get an interactive chart and the exact SQL behind it.

Built as a portfolio demo: schema-grounded NL→SQL, layered SQL safety, and real grocery data at scale ([Instacart Market Basket Analysis](https://www.kaggle.com/datasets/psparks/instacart-market-basket-analysis)).

## Features

- **Voice or typed input** — Whisper transcription (OpenAI or Groq) plus a text fallback
- **Schema-grounded SQL** — Claude generates a single `SELECT` from a fixed catalog (`lib/schema.ts`)
- **Read-only execution** — `lib/sql-guard.ts` validates every query; optional read-only Postgres role
- **Transparent results** — Plotly chart, one-line explanation, and syntax-highlighted SQL
- **Large real dataset** — ~3.4M orders and millions of line items (configurable import size)
- **Fast charts on hosted DB** — pre-aggregated `summary_*` tables avoid full-table scans on Supabase

## How it works

```mermaid
flowchart LR
  Mic[Mic / typed question] --> STT["/api/transcribe"]
  STT --> NL["/api/nl2sql"]
  NL --> Guard["sql-guard.ts"]
  Guard --> DB["/api/query → Postgres"]
  DB --> UI["Chart + SQL panel"]
```

1. Audio → `POST /api/transcribe` → `{ text }`
2. Text → `POST /api/nl2sql` → `{ sql, chart, explanation, needsClarification }`
3. SQL → `POST /api/query` → `{ columns, rows, rowCount }`
4. Client renders Plotly + SQL + explanation

The LLM **never** connects to the database. It only returns a SQL string; the app validates and runs it.

## Tech stack

| Layer | Choice |
|--------|--------|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS |
| Charts | Plotly (`react-plotly.js`) |
| Database | PostgreSQL (`pg`) — Supabase, Neon, or local |
| NL→SQL | Anthropic Claude (`claude-sonnet-4-20250514`), tool-use / Zod |
| Speech | OpenAI Whisper (`whisper-1`), swappable via `lib/stt.ts` |
| SQL safety | `node-sql-parser`, table allowlist, forced `LIMIT` |

## Dataset (Instacart)

| Table | Description |
|--------|-------------|
| `departments` | Grocery departments (produce, dairy, …) |
| `aisles` | Aisles within the store |
| `products` | ~50k products |
| `orders` | ~3.4M orders (`order_dow`, `order_hour_of_day`, `eval_set`, …) |
| `order_items` | Line items (`reordered`, `add_to_cart_order`) |
| `summary_*` | Small rollups for fast charts (built after import) |

**Note:** Instacart has **no prices or revenue**. Metrics use **items ordered**, **order counts**, and **reorder rate**. There is no calendar `order_date` — use `order_dow` (0=Sunday … 6=Saturday) or `summary_*` tables.

## Example questions

1. **Orders by day of week**
2. **Top 10 departments by items ordered**
3. **Reorder rate by department**
4. **Orders per hour of day**
5. **How are we doing?** → clarification flow (too vague)

## Quick start

### Prerequisites

- Node.js 18+
- PostgreSQL ([Supabase](https://supabase.com) recommended)
- API keys: [Anthropic](https://console.anthropic.com), [OpenAI](https://platform.openai.com) (for voice)

### 1. Install

```bash
git clone <your-repo-url>
cd vocallytics
npm install
```

### 2. Environment

```bash
cp .env.example .env.local
```

| Variable | Purpose |
|----------|---------|
| `SEED_DATABASE_URL` | Admin Postgres URL (import scripts only) |
| `DATABASE_URL` | App runtime URL (prefer read-only role) |
| `ANTHROPIC_API_KEY` | NL→SQL |
| `OPENAI_API_KEY` | Whisper STT |
| `STT_PROVIDER` | `openai` or `groq` |

**Supabase:** use the **direct** connection string (`db.<project-ref>.supabase.co:5432`). URL-encode special characters in passwords (e.g. `@` → `%40`).

### 3. Load data

1. Download [Instacart CSVs](https://www.kaggle.com/datasets/psparks/instacart-market-basket-analysis) into `backend/data/instacart/` (see `backend/data/instacart/README.md`).
2. Import:

```bash
npm run import:instacart -- --items=train
```

| Flag | Line items (approx.) | Fits Supabase free tier? |
|------|----------------------|---------------------------|
| `--items=train` | ~1.3M | Often yes |
| `--items=prior` | ~32M | Usually needs Pro |
| `--items=all` | ~34M | Usually needs Pro |

Summaries are built automatically at the end of import. To rebuild later:

```bash
npm run build:summaries
```

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Mic works best in Chrome.

### 5. Verify

```bash
npm run typecheck
npm test
npm run lint
```

## NPM scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run import:instacart` | Bulk-load Instacart CSVs via `COPY` |
| `npm run seed` | Alias for `import:instacart` |
| `npm run build:summaries` | Rebuild `summary_*` rollup tables |
| `npm run seed:synthetic` | Legacy small fake e-commerce dataset |
| `npm test` | SQL guard unit tests |
| `npm run typecheck` | TypeScript check |

## SQL safety (`lib/sql-guard.ts`)

LLM output is **untrusted**. Before execution:

1. Keyword denylist (`INSERT`, `DROP`, `pg_*`, …) with whole-word matching
2. Single statement only (no stacked queries)
3. Parse with `node-sql-parser` (PostgreSQL dialect)
4. **`SELECT` only**
5. **Table allowlist:** `departments`, `aisles`, `products`, `orders`, `order_items`, `summary_orders_by_dow`, `summary_orders_by_hour`, `summary_department_stats`, `summary_product_stats`
6. **Forced `LIMIT`** (default 1000, max 5000)
7. **`BEGIN READ ONLY`** + 5s statement timeout in `lib/db.ts`

Optional: create a read-only role with `backend/db/roles.sql` (adjust database name for Supabase: `postgres`).

## Project structure

```
vocallytics/
├── .env.example                  Copy to .env.local for secrets
├── README.md
├── .gitignore
├── package.json                  npm / Next.js entry (required at repo root)
├── app/                          Next.js routes (API + thin page shells)
│   ├── api/                      transcribe, nl2sql, query
│   ├── layout.tsx
│   └── page.tsx
├── frontend/                     UI (pages, components, styles)
├── backend/
│   ├── lib/                      SQL guard, schema, Claude, DB, types
│   ├── db/                       SQL schemas and roles
│   ├── scripts/                  Import and seed scripts
│   └── data/instacart/           Kaggle CSVs (gitignored)
├── config/                       Tailwind, ESLint, Vitest
└── .github/workflows/ci.yml
```

## Deploying (Vercel + Supabase)

1. Push to GitHub and import the repo in [Vercel](https://vercel.com).
2. Create a Supabase project; import data locally with `SEED_DATABASE_URL`.
3. Set Vercel env vars: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `STT_PROVIDER`.
4. Deploy (API routes use the Node.js runtime).

## Troubleshooting

### `No space left on device`

Supabase ran out of disk during a heavy query.

1. Check usage in **Project Settings → Database**.
2. Free space: `TRUNCATE order_items;` or re-import with `--items=train`.
3. Run `backend/db/summary-tables.sql` in the SQL editor, then `npm run build:summaries`.
4. Prefer questions that hit `summary_*` tables (e.g. “orders by day of week”).

### Empty chart / wrong axis

Hard-refresh the page. If you switched chart types, the Plotly axis fix in `Chart.tsx` sets explicit axis types per render.

### SSL errors on import

Use a connection string without `?sslmode=require` if using our import scripts (SSL is configured in code). URL-encode passwords with special characters.

## Non-goals

No auth, no writes, no query history, no fine-tuning. Single-page portfolio demo focused on safety and a clear voice→SQL→chart path.

## License

MIT (or your chosen license). Instacart data is subject to [Kaggle / Instacart terms](https://www.kaggle.com/datasets/psparks/instacart-market-basket-analysis).
