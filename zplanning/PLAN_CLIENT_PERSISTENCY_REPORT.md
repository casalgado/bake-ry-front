# Client Persistency Report — implementation plan

Build a new report answering two questions: **how many new clients are we getting**, and **which clients keep ordering vs. quietly stopped**. One view does both.

All design decisions below are final. Do not re-open them, do not add features not listed here.

Repos:
- Frontend: `C:\Users\casal\documents\web\front\bake-ry-front`
- Backend: `C:\Users\casal\documents\Web\back\bake-ry\functions`

Build the backend first, then the view.

---

## Files to touch

**Backend**
```
src/utils/periods.js                    NEW   week/month helpers lifted from SalesReport
src/models/ClientReport.js              NEW   the report class
src/services/orderService.js            EDIT  + getClientReport()
src/controllers/orderController.js      EDIT  + getClientReport
src/routes/orderRoutes.js               EDIT  + GET /orders/client_report
src/__tests__/models/ClientReport.test.js NEW
```

**Frontend**
```
src/services/orderService.js                    EDIT  + getClientReport()
src/views/reports/ClientPersistencyReport.vue   NEW   the whole view, one component
src/views/reports/ReportsPage.vue               EDIT  + link card
src/router/index.js                             EDIT  + route
src/utils/exportOrders.js                       EDIT  + exportClientPersistency()
```

---

## Patterns to copy (read these first)

| Read | For |
|---|---|
| `back/src/models/SalesReport.js` | The report-class shape: constructor pre-computes, `generateReport()` assembles. Also `getWeekRange`/`getMonthKey` at lines 184-206, and the b2b_clientIds pattern at line 13. |
| `back/src/services/orderService.js:402-455` (`getProductReport`) | How a report service pulls options out of `query.filters`, deletes them so they never reach Firestore, fetches b2b_clients, instantiates the model. |
| `back/src/routes/orderRoutes.js:19-21` | Route registration. |
| `front/src/services/orderService.js` | `getProductReport()` — copy verbatim, change the path. |
| `front/src/components/reports/ProductReportCard.vue:168-179` | How to read `bakerySettingsStore.currentItem?.features?.reports?.defaultReportFilter` on mount. |
| `front/src/utils/helpers.js:126` | `formatMoney(value, { slim: true })` — **already produces the `120k` abbreviation this plan asks for.** Import it; do not write your own. |
| `front/src/router/index.js:220-229` | Report routes are registered **twice** — once under `/admin`, once under `/accounting`. Yours must be too. |

Available libraries: **`date-fns` v4 is installed.** Use it (with the `es` locale) for period labels and day arithmetic. Do not hand-roll date math and do not add a new date dependency.

---

## Facts about this codebase you need

- `order.userId`, `order.userName` are **denormalized onto every order** (`Order.js:250-257`). No client lookup needed for names.
- B2B is determined by membership in the `b2b_clients` settings subcollection, exactly as `SalesReport.js:13,24-25` does. **There is no `client_type` field to add.**
- `order.isComplimentary` is true when `paymentMethod` is `'complimentary'` or `'quote'` (`Order.js:317`). One flag covers both.
- **There is no cancelled order status.** `ORDER_STATUSES` is `['Recibida','En Produccion','Preparada','En Camino','Completada']`. Cancellation is `isDeleted`, already filtered by `baseService.getAll`.
- Which date counts as "the order date" is a tenant setting: `bakerySettings.features.reports.defaultReportFilter`, default `'dueDate'`. Valid values: `'dueDate'`, `'paymentDate'`.

## Inclusion rules (locked)

- **Exclude** complimentary/quote orders.
- **Include** unpaid orders. An unpaid order still means the client ordered.
- Soft-deleted orders are already excluded upstream.

---

## Backend

### 1. `src/utils/periods.js`

Move `getWeekRange(date)` and `getMonthKey(date)` out of `SalesReport.js` (lines 184-206) into this file, unchanged. Export both. Update `SalesReport.js` to import them and delete its copies — this is a pure move, **no behavior change**. Verify the existing sales report tests still pass.

Add one more helper:

```js
// Returns `count` period descriptors ending at endDate, OLDEST FIRST.
// [{ key: '2026-08-10/2026-08-16', label: '10–16 Ago' }, ...]
buildPeriods(endDate, period /* 'weekly'|'monthly' */, count)
```
`key` must be produced by the same `getWeekRange`/`getMonthKey` used to bucket orders, so keys match exactly. Labels in Spanish, short (`'10–16 Ago'`, `'Ago 2026'`) — use `date-fns` `format` with the `es` locale.

Known wart, do not try to fix here: `getWeekRange` ends with `.toISOString()`, which is UTC. It happens to be correct for negative UTC offsets (Colombia, UTC-5), and off by one day for positive offsets. Every existing report shares this. Leave it — just don't introduce a *second*, differently-broken bucketing path.

### 2. `src/models/ClientReport.js`

```js
class ClientReport {
  constructor(orders, b2b_clients, options) { ... }
  generateReport() { ... }
}
```

`options`: `{ period, count, segment, dateField, endDate }`
- `period`: `'weekly'` | `'monthly'`
- `count`: 1–12
- `segment`: `'b2b'` | `'b2c'` (required, never blended — a weekly wholesale client and a twice-a-year consumer have nothing in common)
- `dateField`: `'dueDate'` | `'paymentDate'` — validate against a whitelist and throw on anything else, same as `ProductReport.js:125-128`
- `endDate`: defaults to now

**Constructor steps**

1. Drop orders where `isComplimentary`.
2. Tag each order b2b/b2c via `b2b_clientIds.has(order.userId)`; keep only the requested segment.
3. Group into `Map<userId, orders[]>`, each array sorted ascending by `options.dateField`.
4. `this.periods = buildPeriods(endDate, period, count)`.

**IMPORTANT — this report reads all orders, with no date range filter.** Every other report is window-scoped; this one cannot be. Whether a client is "new" depends on their first order ever, and the median gap needs their whole history. A client who first ordered three years ago and reappears in a 12-week window must read as returning, not new.

Put this comment above the query in the service:
```js
// ponytail: full-history scan. If this gets slow, denormalize firstOrderDate
// + orderCount onto the user doc on order create, and window this query.
```

### 3. Per-client computation

From each client's sorted order list:

| Field | Rule |
|---|---|
| `firstOrderDate`, `lastOrderDate` | first / last element |
| `orderCount`, `ltv` | length, sum of `total` |
| `medianGapDays` | median of day-diffs between consecutive orders. `null` when `orderCount < 3`. |
| `daysSinceLast` | `endDate − lastOrderDate`, in days |
| `baselineGap` | `orderCount >= 3` → their own `medianGapDays`; else → median of all clients' `medianGapDays` within this segment |
| `gapRatio` | `daysSinceLast / baselineGap` |
| `cells[]` | bucket their orders into period keys, sum `total` per bucket, pad missing periods with `{ total: 0, orderCount: 0 }` |
| `windowTotal` | sum of `cells[].total` |
| `persistentCount` | count of cells with status `'persistent'` |
| `firstSeenIndex` | index of their first non-absent cell (for the "new" sort) |

Use a median, not a mean. Do **not** winsorize — the median is already outlier-robust, and the 18-month ceiling below handles the rest.

### 3b. Which clients get a row — read this carefully

`clients[]` includes a client if **either**:

- they have at least one order inside the window, **or**
- their lifetime status is `at_risk`, `lapsed`, or `one_time`.

The second condition is not optional. A client who stopped ordering eight months ago has **zero** orders in a 12-week window — but they are exactly who the PERDIDOS tile is counting, and clicking that tile has to filter the grid to *something*. Without this rule the tile shows "4" and filtering shows an empty table.

Such clients get a full row of `'absent'` cells. Their value is in the name, the ⚠, and the lifetime columns — not the grid cells.

`firstSeenIndex` is `-1` for these all-absent rows. The "new" sort must push `-1` to the bottom, not the top.

### 4. Two statuses — keep them separate

**Cell status** (per client, per period):
```
total === 0                              → 'absent'
firstOrderDate falls inside this period  → 'new'
total > 0 && previous cell total > 0     → 'persistent'
otherwise (total > 0)                    → 'old'
```
Column index 0 can never be `'persistent'` — there is no prior column.

**Lifetime status** (per client, one value, drives the ⚠ marker and the tiles). Evaluate in this order:
```js
daysSinceLast < 20                          → 'active'    // floor: never nag before day 20
daysSinceLast > 540                         → 'lapsed'    // ceiling: 18 months
orderCount === 1 && daysSinceLast > baselineGap → 'one_time'
gapRatio > 3                                → 'lapsed'
gapRatio > 1.5                              → 'at_risk'
gapRatio > 1                                → 'overdue'
else                                        → 'active'
```
The floor and the ceiling are mandatory. Without the floor, a client with two orders three days apart is "overdue" on day seven. Without the ceiling, a genuinely seasonal client never resolves.

There is deliberately **no `'reactivated'` status.** It's an event, not a state; a client who just ordered is `active`. It only appears in the quick-ratio math.

### 5. Summary

`summary.perPeriod[]` — index-aligned to `periods[]`, one entry per column:
```js
{ nuevos, persistentes, viejos, ausentes, activos }   // activos = total clients − ausentes
```

`summary.tiles`:

```js
newClients: {
  value:      // clients whose firstOrderDate falls in the LAST period
  prevPeriod: // same, for the period before it
  lastYear:   // same, for the equivalent period one year earlier
              // (52 weeks back for weekly, 12 months back for monthly)
}
```

```js
returnRate: {
  judged:   // new clients whose firstOrderDate is >= 90 days before endDate
  value:    // of those, % who placed a 2nd order within 90 days of their first
  tooEarly: // new clients younger than 90 days
}
```
**The horizon is a fixed 90 days**, not one period. It must not change meaning when the user toggles weekly↔monthly. In a 12-week window most newcomers will land in `tooEarly` — that is correct, and the UI says so rather than showing a fake low percentage.

```js
atRisk: { count }   // lifetime status === 'at_risk'
lapsed: { count }   // lifetime status === 'lapsed'

quickRatio: {
  gained,  // clients whose first order OR whose return-from-lapsed falls in the last period
  lost,    // clients whose lapse date falls in the last period
  value,   // gained / lost   (> 1 growing, < 1 shrinking)
}
```
Lapse date needs no history simulation: `lastOrderDate + 3 × baselineGap`, clamped by the same 20-day floor and 540-day ceiling. If it lands inside the last period, they were lost during it.

### 6. Response shape (this is the contract — the frontend depends on it exactly)

```js
{
  meta: { period, count, segment, dateField, generatedAt },

  periods: [ { key: '2026-08-10/2026-08-16', label: '10–16 Ago' }, ... ],

  clients: [{
    userId, name,
    cells: [ { total, orderCount, status } ],   // INDEX-ALIGNED to periods[]
    windowTotal, persistentCount, firstSeenIndex,
    orderCount, ltv, firstOrderDate, lastOrderDate,
    medianGapDays, daysSinceLast, gapRatio, status,
  }],

  summary: {
    perPeriod: [ { nuevos, persistentes, viejos, ausentes, activos } ],  // aligned to periods[]
    tiles: { newClients, returnRate, atRisk, lapsed, quickRatio },
  },
}
```

`cells` is index-aligned to `periods`, never keyed by date. Building the alignment once on the server is what keeps every column the same height and in the same order no matter how the frontend sorts.

### 7. Service, controller, route

`getClientReport(bakeryId, query)` in `services/orderService.js` — mirror `getProductReport` (lines 402-455):
- pull `period`, `count`, `segment`, `date_field` out of `query.filters` into `options`
- `delete` each of them off the query object so they never reach Firestore
- **override pagination: `pagination: { perPage: 10000, offset: 0 }`**, same as `getProductReport:418`. Without this you silently get one default-sized page and every number in the report is wrong in a way that looks plausible.
- fetch **all** orders (no `dateRange`) plus the `b2b_clients` subcollection
- `return new ClientReport(orders.items, b2b_clients, options).generateReport()`

Controller entry mirrors `getProductReport`. Route: `bakeryRouter.get('/orders/client_report', orderController.getClientReport);`

### 8. Tests — `__tests__/models/ClientReport.test.js`

Follow the existing `ProductReport` test file for setup style. Hand-build one fixture client per branch:

- 4 orders, steady 7-day cadence → `active`, `persistent` in every cell after the first
- 3 orders then silent 40 days on a 10-day median → `at_risk`
- silent 600 days → `lapsed` **via the ceiling**
- 2 orders 3 days apart, silent 8 days → `active` **via the floor**, not `overdue`
- 1 order ever → `one_time`, and `medianGapDays === null`
- first order inside the window → `new` in exactly one cell, never two
- first order 3 years ago, reorders inside the window → **not** `new`
- lapsed client with **zero** orders in the window → still present in `clients[]`, all cells `'absent'`, `firstSeenIndex === -1` (see §3b)

Plus one invariant, asserted for every period:
```
nuevos + persistentes + viejos + ausentes === clients.length
```
(Lapsed clients are not in this sum — they didn't order in the period. Don't add them.)

---

## Frontend

### Routing

Its own route, not a card on `ReportsPage` — the grid needs full width and its own state. Register it **twice**, mirroring how `reports` and `income-statement` are registered (`router/index.js:220-229` and `253-261`):

```js
{ path: 'client-persistency', name: 'admin-client-persistency',      component: () => import('../views/reports/ClientPersistencyReport.vue') }
{ path: 'client-persistency', name: 'accounting-client-persistency', component: () => import('../views/reports/ClientPersistencyReport.vue') }
```

Role guards come from the parent route — don't add `meta` of your own.

`ReportsPage.vue` gets a link card to it. Match the existing card's visual style (`bg-white rounded-lg shadow p-4`); use `router-link` with the name matching the current dashboard.

### One component: `src/views/reports/ClientPersistencyReport.vue`

Vue SFC order is **`<script setup>`, then `<template>`, then `<style scoped>`**. One file. Do not split the tiles into a child component — four identical tiles are a `v-for` over an array.

Use a plain `<table>`, **not** the project's `DataTable`. The columns are dynamic (one per period), cells are colored by status, and the first column must freeze. `position: sticky` does the freeze in about four lines of CSS; bending `DataTable` to this costs more than writing the table.

### State

```js
const filters = ref({
  period: 'weekly',      // weekly | monthly
  count: 12,             // 1–12
  segment: 'b2b',        // b2b | b2c
  dateField: 'dueDate',  // ← from bakerySettingsStore on mount
});

const report = ref(null);
const loading = ref(false);
const error = ref(null);
const sortBy = ref('persistent');  // name | value | persistent | new
const statusFilter = ref(null);    // null | 'at_risk' | 'lapsed'  ← set by tile click
const minOrders = ref(1);
```

**`filters` changes only take effect on the "Generar" button** (the query is potentially heavy). Everything else — sorting, `statusFilter`, `minOrders` — is a computed over `report.clients`, instant, no refetch.

On mount, read `bakerySettingsStore.currentItem?.features?.reports?.defaultReportFilter` into `filters.dateField`, exactly as `ProductReportCard.vue:168-179` does.

### Layout, top to bottom

```
┌──────────────────────────────────────────────────────────────┐
│  Persistencia de Clientes                                    │
│  [Semanas ▾] [12 ▾] [B2B ▾] [Fecha entrega ▾]   [Generar]   │
├──────────────────────────────────────────────────────────────┤
│  NUEVOS         REGRESARON      EN RIESGO      PERDIDOS      │
│  12             41%             7              4             │
│  ↑ 8 año ant.   de 29 juzg.     [filtrar]      [filtrar]     │
│  Calculado sobre todo el historial, no solo el periodo.      │
├──────────────────────────────────────────────────────────────┤
│  ▸ Tu base está creciendo: entran 14, se van 4.              │
├──────────────────────────────────────────────────────────────┤
│  Ordenar: [Nombre] [Valor] [Persistencia] [Nuevos]           │
│  Min. pedidos: [1 ▾]        En riesgo ✕            [CSV]     │
├──────────────────────────────────────────────────────────────┤
│  Cliente     │ Nuevos │  2  │  1  │  0  │  3  │  ← summary   │
│              │ Activos│  8  │ 11  │ 12  │ 10  │    rows      │
│  ─────────── │ ────── │ ─── │ ─── │ ─── │ ─── │              │
│  Ana Ruiz  ⚠ │        │ 120 │  —  │  95 │ 110 │              │
│  Beto SAS    │        │  —  │ 200 │ 210 │ 205 │              │
└──────────────────────────────────────────────────────────────┘
     ↑ sticky              ↑ scrolls horizontally →
```

Summary rows go **directly under the header, above the client rows** — with hundreds of clients the bottom of the table is too far away to be useful.

### Rendering details

- **Zero renders as `—` in dim grey**, never `0`. A grid of zeros is unreadable.
- Money in cells via `formatMoney(total, { slim: true })` from `utils/helpers.js` — that gives you `120k`. Full precision lives in the CSV.
- `minOrders` is a small select (1 / 2 / 5 / 10) on the sort row, filtering on lifetime `orderCount`. When `statusFilter` is active, show it as a dismissible chip next to it so the user can see why rows are missing.
- **Cell background by status**: `persistent` green, `new` blue, `old` none, `absent` dim grey text. Include a small legend — four colors with no key is a puzzle.
- **⚠ next to the client name** when lifetime status is `at_risk` or `lapsed`. `title` attribute gives the reason in plain Spanish: `"Suele pedir cada 34 días. Han pasado 61."` That sentence is the whole payoff of the gap math — make sure it's there.
- **Tile caption is required**: *"Calculado sobre todo el historial, no solo el periodo mostrado."* At-risk and lapsed come from full history, so those numbers don't change when the window changes. Without the caption that reads as a bug.
- **`returnRate` must show its denominator**: `"41% de 29 juzgados · 6 muy recientes"`. Never show a bare percentage that silently includes clients too new to judge.
- Clicking the EN RIESGO / PERDIDOS tiles sets `statusFilter` and filters the client rows. Clicking again clears it.

### Sorting

Four sorts, all computed over `report.clients`:
- `name` — alphabetical by `name`
- `value` — `windowTotal` descending
- `persistent` — `persistentCount` descending (this is the "most loyal" ranking)
- `new` — newest arrivals first: `firstSeenIndex` descending, with `-1` (never seen in window) forced to the bottom

Because `cells` is index-aligned server-side, sorting rows never misaligns columns.

### Responsive

Sticky first column plus horizontal scroll. Below the `sm:` breakpoint default the visible period count to 6 rather than 12 — twelve columns on a phone is too much swiping. Don't build a separate mobile layout.

### States

- Skeleton rows while loading (the query may touch all orders ever).
- Error message, same style as `ProductReportCard`.
- Empty state per segment — a bakery may legitimately have no B2C clients yet.

### CSV export

Add `exportClientPersistency(report)` to `src/utils/exportOrders.js`, following the existing export functions there. One row per client: name, lifetime order count, LTV, first order, last order, days since last, median gap, status, then one column per period with the totals.

---

## Explicitly out of scope

Do not build these. They were considered and deliberately deferred:

- A nightly-rebuilt `client_metrics` table or any scheduled job — everything is computed per request.
- RFM segmentation (Champions / Hibernating / etc.) — at monthly-or-slower cadence most clients have 1–3 lifetime orders, so the frequency quintiles are noise.
- BG/NBD or any probabilistic "probability alive" model.
- Cohort retention heatmap (first-order month × months-since). Wanted eventually, not in v1.
- Lifecycle stacked bar chart.
- Acquisition-source breakdown — the field doesn't exist in this app.
- Blending B2B and B2C into one table.

## Build order

1. `utils/periods.js` + update `SalesReport.js` to import it; confirm existing tests pass.
2. `ClientReport.js` + its tests.
3. Service, controller, route; verify against real data with a manual request.
4. Frontend service method + route + the view.
5. CSV export.

Ask before running tests.
