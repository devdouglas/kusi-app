# Kusi Safaris Rates & Quotes

An internal web application for Kusi Safaris: a central **Rate Library** for
supplier prices, and a **Quote Builder** for assembling tailor-made trip
costings day by day.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS 4** for styling
- **Prisma** ORM with **PostgreSQL**
- **Zod** for input validation
- **decimal.js** for exact currency arithmetic (see [Money handling](#money-handling))
- **docx** for generating the internal Word quote summary
- **Vitest** for unit + integration tests

## Getting started

```bash
docker compose -f docker-compose.dev.yml up -d
npm install
cp .env.example .env
npx prisma migrate deploy
npm run seed                # optional: a couple of demo Rate Library entries
npm run dev
```

Open http://localhost:3000.

## Docker / Dokploy

| Dokploy setup | Build type | Database |
| --- | --- | --- |
| **Application** (recommended) | **Dockerfile** at repo root | Create **PostgreSQL** in Dokploy; set `DATABASE_URL` to the **internal** connection URL |
| **Docker Compose** | `docker-compose.yml` | Uses bundled `postgres:16-alpine`, or drop `db` and point `DATABASE_URL` at managed Postgres |

1. Add a **domain** on the app service (required for Traefik and for reaching internal DB URLs from the container).
2. Set env: `DATABASE_URL`, optionally `RUN_SEED=true` once for demo data.
3. Deploy — the entrypoint runs `prisma migrate deploy` before `next start`.

Full stack locally: `docker compose up --build` → http://localhost:3000

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run test` | Run the unit + integration test suite (spins up `prisma/test.db`) |
| `npm run seed` | Insert a small set of demo Rate Library entries (safe to re-run) |
| `npm run lint` | ESLint |

## Architecture

The codebase is layered on purpose, per the brief:

- **Data layer** — `prisma/schema.prisma`, `src/lib/prisma.ts`
- **Business logic** — `src/lib/calc/*` (pure functions, no I/O, fully unit
  tested), `src/lib/money.ts` (currency conversion / formatting),
  `src/lib/quote/derive.ts` (turns a raw quote record into everything a
  screen or the docx export needs: totals, day totals, private vehicle days,
  travel period)
- **Data access / mutations** — `src/lib/actions/*` (Next.js Server Actions;
  the only place that talks to Prisma for writes, and where Zod validation
  happens)
- **UI layer** — `src/app/**` (routes) and `src/components/**`
- **Document generation** — `src/lib/docx/quote-summary.ts`, served from
  `src/app/api/quotes/[id]/docx/route.ts`

### Money handling

Every monetary amount is stored as an **integer number of cents** (the
smallest currency unit), never as a float. `src/lib/money.ts` is the only
place that converts between cents and decimal.js `Decimal` for the handful
of operations that need it (currency conversion, splitting a total into a
per-person share) — every conversion is rounded back to whole cents before
it's returned, so nothing downstream ever sees a floating-point remainder.

The exchange rate is stored the same way: as an integer "rateMicros" (KES
per 1 USD, scaled by 1,000,000), giving six decimal places of precision
without floats.

### Historical snapshots

This is the one rule the whole schema is built around: **a saved quote must
never change when the Rate Library or the exchange rate changes later.**

- Every `QuoteLineItem` stores its own frozen `originalCurrency`,
  `originalTotalCents`, `rateMicros` and `totalUsdCents` at the moment it's
  added. Rate Library edits after that point never touch existing line
  items — only a brand-new line item reads the current library price.
- Every `Quote` stores the `rateMicros` in effect when it was created. A
  global Settings change never rewrites existing quotes. A Draft quote can
  be explicitly refreshed onto the current rate (`refreshQuoteExchangeRate`),
  which requires user confirmation in the UI and recomputes every line
  item's USD total from its own frozen original-currency amount.
- A manual override (`manualOverride: true`) still keeps the original
  library-computed price in `libraryTotalCents` / `libraryCurrency` for
  reference and for "revert to library rate."

This is covered by integration tests in
`src/lib/actions/snapshot.test.ts` that create a quote, change the source
data, and assert the quote is unaffected — the two scenarios described in
the spec (Rate Library price change, exchange rate change).

### Category-specific quote data

`QuoteLineItem.data` is a JSON column holding a discriminated union
(`src/types/line-items.ts`) keyed by category — room type/season/meal plan
for accommodation, vehicle type for transport, class for train, and so on.
Common fields that every category shares (currency, totals, manual-override
bookkeeping) are real columns so totals can be summed without parsing JSON.

### Future margin / selling-price architecture

Version 1 only ever calculates **cost**. The `Quote` model already has
nullable `marginPercent` and `sellingPriceCents` columns that nothing reads
or writes yet, so a future selling-price layer can be added without
touching the cost engine or migrating existing quotes.

## Assumptions made while building this

A few judgment calls where the spec allowed for a sensible default:

- **Accommodation pricing basis is set per accommodation**, not per
  individual rate row. In practice a property is quoted one way (per person
  or per room) across all its rates; this keeps the rate-entry grid simple.
- **Train, Taxi Transfer, Activity and Domestic Flight** all support both a
  Rate-Library-backed selection and a fully manual entry (with its own
  currency), even where the spec only explicitly calls out "Other / Manual"
  for Transfer and Flight. This keeps the four categories consistent and
  gives consultants an escape hatch everywhere a one-off item might come up.
- **Manual rate override** is offered as a separate "Override" action on
  Rate-Library-derived line items (Accommodation, Transport, Transfer,
  Activity, Flight-by-route), rather than inline in the add-item form, so
  the override always has a library price to compare against and revert to.
- **Editing trip dates** on an existing quote keeps line items on days whose
  date is still in range, and drops items on days that fall outside the new
  range (cascade delete) — there's no "orphaned day" concept in the schema.

## Tests

```bash
npm run test
```

25 tests covering: currency conversion and formatting, every category's
pricing rule (accommodation per-person and per-room, transport, train,
transfer, activity, flight, villa, misc), trip date / private-vehicle-day
math, quote totals and price-per-person, and the two historical-snapshot
integration scenarios described above.
