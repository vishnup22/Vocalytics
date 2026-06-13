# Instacart Data

Download the Instacart Market Basket Analysis dataset and place these CSV files in this folder.

| File | Rows |
| --- | --- |
| `departments.csv` | 21 |
| `aisles.csv` | 134 |
| `products.csv` | 49,688 |
| `orders.csv` | 3,421,083 |
| `order_products__prior.csv` | 32,434,489 |
| `order_products__train.csv` | 1,384,617 |

Run the default import from the project root:

```bash
npm run import:instacart
```

## Import Modes

```bash
npm run import:instacart -- --items=train
npm run import:instacart -- --items=prior
npm run import:instacart -- --items=all
```

`SEED_DATABASE_URL` must be set in `.env.local`.

## Storage

The full dataset is large. Use `--items=train` for smaller database plans. After import, summary tables are built automatically.

Rebuild summaries:

```bash
npm run build:summaries
```
