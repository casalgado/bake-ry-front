# Client Persistency Report — Redesign

Replaces the current report (tiles + period-grid table) entirely. Goal: less data, more story.

## Files

- Front: `src/views/reports/ClientPersistencyReport.vue` (rewrite)
- Back: `src/models/ClientReport.js` (rewrite of report shape; order grouping/validation logic reusable)
- Back: `src/utils/periods.js` (add quincena to `buildPeriods`)

## Filters (unchanged + quincena)

- Periodo: `weekly` | `biweekly` (label "Quincena") | `monthly`
- Cantidad: 4 / 6 / 8 / 12
- Segmento: B2B / B2C
- Fecha: dueDate / paymentDate

**Quincena = calendar quincena**: day 1–15 and 16–end of month. Composes with monthly (2 quincenas = 1 mes). Weekly stays ISO weeks.

## Partial current period rule

The current period is almost always incomplete. Rules:

- Recency for buckets (Caído / Perdido / Intermitente) is judged against the **last complete period**.
- Ordering in the partial period can only **promote** (→ Intermitente / keeps a streak alive); not ordering in it never demotes.
- Estrella / Futura Estrella do **not** require an order in the partial period.
- Range bar shows "(periodo actual parcial)".

## Layout (top to bottom)

### 1. Range bar
Slim text line under filters, not a card:
`6 meses · 1 mar 2026 → 24 ago 2026 · periodo actual parcial`

### 2. KPI cards (4, plain numbers, not clickable)

| Card | Definition |
|---|---|
| Clientes | Clients with ≥1 order in range |
| Nuevos | Clients whose first order **ever** falls in range |
| Promedio nuevos | nuevos ÷ count, labeled per period type ("por mes") |
| % Recurrentes | (Estrellas + Futuras Estrellas + Reactivados + Intermitentes) ÷ Clientes — derived from buckets, no separate formula |

### 3. Tabs: Nuevos | Recurrentes

#### Nuevos tab
Horizontal-scroll flex of period cards, **newest first (left)**.

- Card header: period label + dates (`Marzo 2026`, `Q1 Mar · 1–15 mar`, `Sem 12 · 17–23 mar`).
- Body: list of clients new in that period → name, total, N pedidos.
- Empty period still renders a card ("0 nuevos").
- Click client → history modal.

#### Recurrentes tab
Applies to every client with ≥1 order in range **except** those whose first order is in the current period (they live in the Nuevos tab only).

Bucket summary cards in a row (count + total value). Click one → its client list below. One list at a time. **Default selection: Estrellas** (the first card, and the healthy baseline the other buckets read against).

Client row: name, total in range, N pedidos, última orden ("hace 3 semanas"). Click → history modal.

## Buckets (partition — every client lands in exactly one)

### Data structure

Per client, a vector over the **N complete periods** (partial current period is not in the vector — promotion only). Each cell:

- `·` — not yet a client (before first-ever order; only ever a prefix)
- `1` — ≥1 order in that period
- `0` — client existed, no order

Derived quantities:

- **start** — index where the `·` prefix ends (0 for veterans born before the range)
- **hasGaps** — any `0` from `start` to `N-1`
- **last** — index of last `1`; **missed** = `N - 1 - last`
- **quietBeforeLast** — consecutive `0`s immediately before the most recent order (`·` never counts as silence)
- **recent** — ordered in the partial period OR `missed == 0`

### Decision tree (first match wins)

```
if no 0 from start to N-1:            # perfect streak since they existed
    if veteran (start == 0)  → ESTRELLA
    else                     → FUTURA ESTRELLA
else:                                 # streak broken somewhere
    if recent:
        if quietBeforeLast >= 3 → REACTIVADO    (was perdido, came back)
        else                    → INTERMITENTE  (ordinary irregularity)
    elif missed <= 2            → CAÍDO         (fresh churn → call them)
    else                        → PERDIDO
```

Exhaustive by construction: first branch splits on "any 0 after start"; each side fully partitions its cases.

Examples (N=8, no partial-period order unless noted):

```
1 1 1 1 1 1 1 1   ESTRELLA
· · · 1 1 1 1 1   FUTURA ESTRELLA   (born index 3, perfect since)
1 1 0 0 0 0 0 1   REACTIVADO        (5 quiet, then back)
1 0 1 1 0 1 0 1   INTERMITENTE      (gaps, never 3+ quiet before returning)
· 1 1 0 1 1 0 0   CAÍDO             (gaps, missed = 2)
1 0 0 0 0 0 1 0   CAÍDO             (comeback that fizzled — recency wins)
1 1 1 0 0 0 0 0   PERDIDO           (missed = 5)
```

### Decisions locked

- **Trivial streaks accepted**: born in the last complete period with a single `1` → Futura Estrella (streak of 1 is honest).
- **Reactivado threshold = Perdido threshold = 3 quiet periods**, hard-coded symmetry: one concept read forward or backward. A Reactivado is a Perdido who came back.
- **Self-healing lifecycle** (no stored state, recomputed from the vector each report): Perdido → Reactivado → Intermitente → (range slides past the gap) → Estrella.
- Bucket card order in UI: Estrellas · Futuras Estrellas · Reactivados · Intermitentes · Caídos · Perdidos. Default selection is Estrellas.
- % Recurrentes numerator = Estrellas + Futuras Estrellas + Reactivados + Intermitentes.

Known caveat (document in UI, don't solve): a loyal monthly client viewed weekly looks Intermitente/Caído. Weekly/quincena views judge weekly/quincena cadence — pick the period that matches the segment's rhythm.

## Client history modal

- Fetched **on demand** when opened (own endpoint / existing client-orders query; report payload stays light).
- v1 content: name, first/last order date, LTV, total order count, order list (date, total, status).
- Richer design later.

## Backend payload sketch

```
{
  meta: { period, count, segment, dateField, generatedAt, rangeStart, rangeEnd, currentPeriodPartial },
  periods: [{ key, label, start, end }],
  kpis: { activeClients, newClients, avgNewPerPeriod, returningPct },
  nuevosPorPeriodo: [{ periodKey, clients: [{ userId, name, total, orderCount }] }],
  buckets: {
    estrella:        [clientRow],
    futuraEstrella:  [clientRow],
    reactivado:      [clientRow],
    intermitente:    [clientRow],
    caido:           [clientRow],
    perdido:         [clientRow],
  },
}

clientRow: { userId, name, email, phone, rangeTotal, orderCount, lastOrderDate }
```

`email`/`phone` included from day one so per-bucket export is trivial later.

## What dies

Period-grid table, clickable status tiles, sort + min-orders toolbar, insight line, current CSV export, lifetime status machinery (`gapRatio`, `medianGapDays`, at_risk/overdue statuses) — buckets replace it.

## Deferred (explicitly later)

- **Per-bucket export**: name + contact info of a selected bucket (e.g., export Caídos as a call list) without regenerating the report. Data already in payload.
- Richer modal design.
- Fine-tuning bucket thresholds (the 1–2 / 3+ period cutoffs) after seeing real data.
