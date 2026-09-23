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
- **exceljs** for generating the Rate Library Excel export
- **Vitest** for unit + integration tests

## Agent / contributor notes (Prisma, Docker, Dokploy)

**Read this before changing `prisma/schema.prisma`, adding migrations, or
touching `Dockerfile` / deploy config.**

### PostgreSQL only

- `datasource` provider is **`postgresql`** everywhere (local, CI, production).
  **Do not** generate or commit SQLite migrations (`DATETIME`, `PRAGMA`,
  SQLite-style `RedefineTables`, enum columns as plain `TEXT` where Postgres
  uses `"Currency"` / native enums, etc.). Production runs the same SQL as
  local; SQLite-only migrations will fail on deploy (often at `DATETIME` or
  `PRAGMA`) and leave a **P3009** failed migration.
- After schema changes, create migrations against Postgres, e.g. local DB up
  via `docker compose -f docker-compose.dev.yml up -d`, then
  `npx prisma migrate dev --name …`. Alternatively
  `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script`
  and review the SQL before committing.
- `migration_lock.toml` must stay `provider = "postgresql"`.

### What production deploy runs

- **Docker entrypoint** (`docker/entrypoint.sh`): `prisma migrate deploy` →
  optional seed if `RUN_SEED=true` → `node server.js`.
- **`next build` must not require a live DB**: root layout sets
  `export const dynamic = "force-dynamic"` so Prisma-backed pages are not
  pre-rendered at image build time.
- **`migrate deploy` applies every pending migration in one go** — there is
  no hook between migration files. If you use **expand → data script →
  contract**, you must either:
  - run the data script **manually** on production between deploys (apply
    additive migration, exec `npx tsx prisma/scripts/migrate-legacy-children.ts`,
    then deploy again with contract migration), or
  - fold data backfills into SQL in the additive migration, or
  - accept that contract migrations run immediately after additive ones on
    the next deploy (fine when prod has no legacy rows to preserve).

### Dokploy (production)

| Item | Value |
| --- | --- |
| Build | **Dockerfile** at repo root, or **Compose** with `docker-compose.dokploy.yml` (joins `dokploy-network` for internal DB hostnames like `kusi-db-*`) |
| Database | Managed **PostgreSQL 16**; `DATABASE_URL` = **internal** connection URL from Dokploy |
| Domain | e.g. `app.kusisafaris.com` → container port **3000** (not 80) |
| Env | `DATABASE_URL` (required), `NODE_ENV=production`, `HOSTNAME=0.0.0.0`, `PORT=3000`; `RUN_SEED=true` **once** for demo data then remove/disable |
| Logs | Use **container/runtime** logs, not build logs — look for `Starting Next.js...` |

Internal DB hostnames only resolve when the app container is on
`dokploy-network` (Compose file above, or domain attached on Application
deploy per Dokploy behavior).

### Failed migration recovery (P3009)

If deploy logs show `P3009` / a named migration **failed**:

1. Fix the migration SQL in git (Postgres-compatible) and push.
2. On the server, once, with the same `DATABASE_URL` as the app:

   ```bash
   ./node_modules/.bin/prisma migrate resolve --rolled-back "MIGRATION_FOLDER_NAME"
   ```

   Example:
   `20260922123453_add_child_brackets_and_parks`

3. If a failed run left stray objects (unusual when Postgres rolls back the
   transaction), drop partial tables/enums manually, then redeploy.
4. Redeploy so `migrate deploy` can re-apply.

Do **not** edit applied migration files in place on production without
`migrate resolve`; checksums and `_prisma_migrations` must stay consistent.

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

See **[Agent / contributor notes](#agent--contributor-notes-prisma-docker-dokploy)**
for env vars, networking, migration rules, and P3009 recovery.

| Dokploy setup | Build type | Database |
| --- | --- | --- |
| **Application** | **Dockerfile** at repo root | Managed Postgres; internal `DATABASE_URL` |
| **Docker Compose** | `docker-compose.dokploy.yml` | Same; app service must use `dokploy-network` |
| **Local full stack** | `docker-compose.yml` | Bundled `postgres:16-alpine` |

Full stack locally: `docker compose up --build` → http://localhost:3000

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run test` | Run the unit + integration test suite (needs Postgres; see `vitest.config.ts`) |
| `npm run seed` | Insert a small set of demo Rate Library entries (safe to re-run) |
| `npm run lint` | ESLint |
| `npx tsx prisma/scripts/migrate-legacy-children.ts` | One-off: converts old fixed child categories to the exact-age model. See "Migrating existing child-pricing data" below — only relevant between the additive and contract migrations. |

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

### Daily Totals

Each day's total (`DerivedDay.dayTotalUsdCents` in `src/lib/quote/derive.ts`)
is a pure aggregation — `sum(day.lineItems.map(li => li.totalUsdCents))` —
computed independently from the trip-level total, which is itself
`sum(all line items across all days)`. Both figures are derived from the
same flat list of line items, so the sum of every Day Total always equals
the Total Party price by construction; there is no code path that adds a
Day Total to the trip total, so double counting isn't structurally
possible. This already reflects manual overrides and KES conversions,
since both are baked into each line item's `totalUsdCents` before the
aggregation ever runs.

### Exact child ages and accommodation/park-specific age brackets

Children are stored on the quote as one `QuoteChild` row per child with an
**exact age** (`0`–`15`), never only an aggregated category — the same
age can then be matched against a different bracket for every supplier,
because brackets are never global:

- `AccommodationChildAgeBracket` (+ `AccommodationChildRate`, one price per
  bracket per rate row) belongs to a single `Accommodation`.
- `ParkChildAgeBracket` belongs to a single `Park`, and carries its own
  price directly (a park has one flat rate, unlike accommodation's
  room/season/meal-plan matrix, so there's no separate join table).

Matching, range validation (`0 ≤ min ≤ max ≤ 15`) and overlap detection are
shared, provider-agnostic functions in `src/lib/calc/child-brackets.ts`.
When a child's age matches no configured bracket, the calculation
functions (`computeAccommodationPerPersonWithChildren`,
`computeParkEntranceFee`) return `{ ok: false, unmatchedAges }` rather than
guessing a price; the server actions turn that into a clear error
(`No child rate configured for age 14 at …`) unless the consultant
supplies an explicit manual total to proceed, which is recorded as a
`manualOverride` line item with no library figure to revert to.

Park Entrance Fee line items also support the same "adjust who's included"
pattern per spec: the adult count can be reduced and individual children
toggled off for that one line item without touching the quote's own
passenger composition.

### Migrating existing child-pricing data

This schema change (removing the old fixed `children5to12` /
`childrenUnder5` / `child5to12Cents` / `childUnder5Cents` columns) used an
**expand → migrate data → contract** sequence rather than a single
destructive migration:

1. `20260922123453_add_child_brackets_and_parks` — additive only: adds
   `QuoteChild`, `AccommodationChildAgeBracket`, `AccommodationChildRate`,
   `Park`, `ParkChildAgeBracket`, while leaving the old columns in place.
2. `prisma/scripts/migrate-legacy-children.ts` — a standalone, idempotent
   script that reads the old columns via raw SQL (since by the time it's
   safe to run, the *current* generated Prisma Client may already have
   dropped them from its types) and writes the new rows: each quote's
   aggregate child counts become `QuoteChild` rows with `age: null` and a
   `legacyLabel` (`"5-12"`, `"Under 5"`) — **exact ages are never invented**
   — and each accommodation's old child prices become two representative
   brackets (`0–4`, `5–12`) carrying the old per-bracket prices forward.
3. `20260922130000_drop_legacy_child_columns` — drops the now-migrated old
   columns.

**Production / Docker:** the entrypoint only runs `migrate deploy`, so steps
1 and 3 run back-to-back on the same deploy. Run step 2 manually between
deploys if production still has rows in the legacy columns (see
[Agent / contributor notes](#agent--contributor-notes-prisma-docker-dokploy)).

This repository had no real historical quote data at the time of this
change (only local seed/test data), so a clean migration would have been
acceptable per the brief — but the expand/migrate/contract sequence was
used anyway, and the migration script was actually run against local data
(converting the seeded Samburu Intrepids rates) rather than merely written,
so the same sequence is proven safe to run again if Kusi ever needs it
against real data before deploying this change. Existing `QuoteLineItem`
accommodation snapshots are **never rewritten** by this migration — they're
immutable historical records already, so `AccommodationLineData` keeps a
`AccommodationPerPersonDataLegacy` variant purely for **display**: old
quotes still render their frozen `child5to12` / `childUnder5` breakdown
correctly, and `deriveQuote` exposes `hasLegacyChildren` so the UI can
acknowledge a quote has an unconvertible legacy child if needed.

### Rate Library Excel export

"Export to Excel" on the Rate Library toolbar (`src/components/rate-library/library-toolbar.tsx`)
opens a modal to pick which categories to include (Select All, or one/several),
plus an "Include archived rates" option. Confirming navigates to
`GET /api/rate-library/export?categories=…&archived=…`, which streams back a
`.xlsx` download — the same `Content-Disposition: attachment` pattern already
used for the Word quote summary, so no client-side blob handling is needed.

The export is layered the same way as the rest of the app:

- `src/lib/xlsx/flatten.ts` — pure, DB-free functions that turn a Rate
  Library record into human-readable rows (no ids, JSON blobs, or foreign
  keys) — one function per category, each individually unit tested.
- `src/lib/xlsx/export-rate-library.ts` — one `exportXRates()` per category
  (fetch via the existing `listX` actions + flatten) and
  `buildRateLibraryWorkbook()`, which combines only the selected categories
  into one workbook, always in the same order as the Rate Library tabs
  regardless of the order they were checked in.
- `src/lib/xlsx/workbook.ts` — the exceljs formatting layer: bold sage
  header row, frozen top row, autofilter, sensible column widths, wrapped
  Notes column, numeric (not text) price/age cells, worksheet-name
  sanitization (31-char Excel limit, illegal characters stripped).

**Accommodation and Park child brackets** flatten into one row per
combination rather than fixed columns, since each accommodation/park
defines its own bracket set: a `Child` row carries that specific bracket's
`Child Minimum Age` / `Child Maximum Age` alongside its price, so two
properties with different brackets for the same age are never conflated —
exactly the same "brackets are never global" principle as the Quote
Builder (see above).

**Currency**: every row keeps its original `Price` + `Currency` and adds a
`USD Equivalent` computed via the same `toUsdCents()` used everywhere else
in the app, using the exchange rate at the moment of export (never a stored
rate from when a rate was entered). That rate is shown once, on a small
"Export Info" worksheet (export date, `1 USD = X KES`, categories included),
rather than repeating a banner row on every category tab. The export never
writes to the database.

Archived rates are excluded by default; when "Include archived rates" is
checked, they're included and every sheet gains a `Status` (Active/Archived)
column — otherwise the column is omitted entirely, since it would carry no
information.

### No Meals, long Room Type labels, and Lodge Activities

Three Accommodation Rate Library improvements, all purely additive (one
migration, no destructive changes, no schema change was even needed for the
Room Type length — Prisma's plain `String` already maps to unbounded
Postgres `text`, so that was a UI/validation change only):

- **No Meals** (`MealPlan.NO_MEALS`) is a normal meal plan — the same enum,
  label map (`MEAL_PLAN_LABELS`) and dropdown used everywhere else, so
  nothing category-specific was needed to make it work in the Quote
  Builder, snapshots, Word export or the Excel export.
- **Room Type names** have a generous 300-character Zod ceiling (well past
  the "~150" ask) rather than a technical limit — the column was already
  unbounded. The Rate Library UI widens the relevant inputs/selects and
  wraps the Excel "Room Type" column instead of truncating.
- **Lodge Activities** (`AccommodationActivity`) are accommodation-specific
  activities — never general standalone Activities — managed as their own
  small CRUD list inside an accommodation's Rate Library record
  (`src/components/rate-library/lodge-activities-section.tsx`), with a
  `LodgeActivityPricingBasis` (`PER_PERSON` / `PER_GROUP` / `FIXED_PRICE`)
  kept as its own enum so a future per-activity child-pricing layer doesn't
  require reshaping accommodation pricing too. In the Quote Builder,
  "Lodge Activity" is its own category in Add Item, scoped to accommodations
  already on the quote (`src/components/quote-builder/forms/lodge-activity-item-form.tsx`);
  its total is computed by `computeLodgeActivityTotal()` (the same
  `unitCents × quantity` shared calculation as every other simple category)
  and contributes to Day Total / Total Party / snapshots / Word / Excel
  exactly like any other line item, with no special-casing anywhere in
  `deriveQuote()`. Removing an accommodation that still has linked Lodge
  Activities on the quote shows a confirmation warning first (the
  activities are never silently deleted). On Excel export, Lodge Activities
  ride along as their own "Lodge Activities" worksheet whenever
  Accommodation is selected — never a separate top-level category to pick.

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
- **Park Entrance Fees have no "Other / Manual Park" pinned option** (unlike
  Taxi Transfer and Domestic Flight) since the spec only describes searching
  the Rate Library for parks; a manual-total rescue path still exists, but
  only when a travelling child's age matches no configured bracket.
- **A Tailwind `cn()` helper (`clsx` + `tailwind-merge`) was added** for
  every shared UI primitive that accepts a caller `className` alongside its
  own base classes (`Input`, `Select`, `Textarea`, `Button`, `Card`,
  `Stepper`). Plain `clsx` doesn't resolve conflicting utilities (e.g. a
  caller's `w-24` losing to the component's own `w-full`) deterministically
  — this had already surfaced as a real, silently-broken layout in one form.
- **All Add/Edit modals are ~95% of the viewport width** (`width="max-w-[95vw]"`
  on every `Modal` call for a create/edit form, across both the Rate
  Library and the Quote Builder), at the user's explicit request — this
  gives the longer inputs added for Room Type names and the new rate-grid
  columns room to breathe without a second design pass per form.

## Tests

```bash
npm run test
```

115 tests covering: currency conversion and formatting, every category's
pricing rule (accommodation per-person and per-room, transport, train,
transfer, activity, park entrance fee, flight, villa, misc, lodge
activity — Per Person / Per Group / Fixed Price), child age bracket
matching/validation/overlap detection (including the same age mapping to
different brackets for different suppliers), trip date /
private-vehicle-day math, quote totals and price-per-person, Daily Totals
(correct aggregation, updates on quantity/override/KES changes, sum equals
Total Party with no double counting), the Rate Library Excel export
(flattening each category including nested accommodation/park child
brackets, No Meals and long Room Type names, Lodge Activities linked to
the correct accommodation, USD/KES conversion, archived-rate
inclusion/exclusion, worksheet selection and naming, and a real read-back
of the generated `.xlsx` to prove it's a valid file), Word export line
rendering for No Meals / long Room Type names / each Lodge Activity
pricing basis, and integration scenarios run against a real database: the
two historical-snapshot scenarios (Rate Library price change, exchange
rate change), accommodation bracket matching end-to-end, the
missing-bracket error path, Park Entrance Fees (adults + children, KES,
manual override, excluding one traveller), a legacy quote (old
child-category shape) rendering without error, and Lodge Activities
end-to-end (zero/multiple activities per accommodation, each pricing
basis, USD/KES, manual override, Daily Total / Total Party contribution,
a frozen snapshot after the Rate Library price changes, and activities
correctly scoped to their own accommodation).
