# Instacart data (Kaggle)

Download the **[Instacart Market Basket Analysis](https://www.kaggle.com/datasets/psparks/instacart-market-basket-analysis)** dataset and place these CSV files in this folder:

| File | Rows (approx.) |
|------|----------------|
| `departments.csv` | 21 |
| `aisles.csv` | 134 |
| `products.csv` | 49,688 |
| `orders.csv` | 3,421,083 |
| `order_products__prior.csv` | 32,434,489 |
| `order_products__train.csv` | 1,384,617 |

Then from the project root:

```bash
npm run import:instacart
```

## Options

```bash
# Train split only (~1.3M line items) — fits smaller Supabase plans
npm run import:instacart -- --items=train

# Prior split only (~32M line items) — needs Supabase Pro / large storage
npm run import:instacart -- --items=prior

# Both prior + train (default, ~33.8M line items)
npm run import:instacart -- --items=all
```

Requires `SEED_DATABASE_URL` in `.env.local` (admin Postgres connection).

## Supabase disk space

The full dataset (~34M line items) can exceed **Supabase free tier (~500 MB)** and cause
`No space left on device` when querying. Options:

1. **Train split only:** `npm run import:instacart -- --items=train` (~1.3M lines)
2. **Upgrade** Supabase plan for more storage
3. After import, summaries are built automatically; the app prefers `summary_*` tables
   so charts avoid scanning millions of rows

If you already imported but queries fail, free space then run:

```bash
# In Supabase SQL editor, paste db/summary-tables.sql
npm run build:summaries
```
