# Accounting Implementation

Design decisions for the Accounting epic ([ROADMAP.md](./ROADMAP.md) → Next → Accounting), phases 1–3 (fixed costs, variable/other revenue, full P&L). Balance sheet and DIAN invoicing are out of scope here. Same purpose as [INVENTORY-IMPLEMENTATION.md](./INVENTORY-IMPLEMENTATION.md): source of truth for what was decided and why.

**Status of each area:**

| Area | Status |
|---|---|
| One entries collection vs two | ✅ Decided |
| Recurring templates: lazy materialization | ✅ Decided |
| Entry month: explicit `period` field | ✅ Decided |
| Categories in `BakerySettings` | ✅ Decided |
| Colombia tax fields on entries | ✅ Decided |
| COGS boundary vs Compras (no double counting) | ✅ Decided |
| Compras/Gastos boundary UX (decoy category + layers) | ✅ Decided |
| Income statement relocation + structure | ✅ Decided |
| Module activation (opt-in per business) | ✅ Decided (§14) |
| Role access for entries/templates | 🔶 Open |
| Default category lists (final wording) | 🔶 Open |
| Period closing (snapshot-on-close) | 🔶 Open — later phase |

---

## 1. Current backend state (baseline)

- **`Order` / `OrderItem`** — the entire revenue side today: `preTaxSubtotal`, `postTaxSubtotal`, `total`, `deliveryFee`/`deliveryCost`, discounts, `taxBreakdown` by rate (sales IVA is solved), `isPaid`, `paymentDate`, `partialPayments[]` (future accounts-receivable seed).
- **COGS** — per-item `costPrice` with a fallback waterfall (item → combination → product) inside `orderService.getIncomeStatement`. The Inventory epic (§7 there) will make this recipe-computed; accounting only consumes it.
- **`getIncomeStatement`** (`orderService.js:475`, ~260 lines) — computes revenue, COGS, gross profit, cost coverage; groups by month; route `GET /orders/income_statement`; consumed by `IncomeStatement.vue`.
- **`BakerySettings`** — precedent for managed category lists: `ingredientCategories` is an embedded array of `{id, name, description, displayOrder, isActive}` managed through existing settings CRUD.
- **Nothing models money leaving the business** beyond `deliveryCost` and product `costPrice`. `grep expense` over the backend: zero hits. That is the gap this epic closes.
- **Roles** — `accounting_assistant` exists and has its own dashboard/sidebar with the income statement view.

---

## 2. Decision: one `accountingEntries` collection

Expenses and other-revenue entries live in **one collection**, `bakeries/{bakeryId}/accountingEntries`, discriminated by `type: 'expense' | 'revenue'`.

```
AccountingEntry {
  id,                        // '{templateId}_{period}' when template-born, else generated
  type: 'expense' | 'revenue',
  period,                    // 'YYYY-MM' — the P&L month it belongs to (§4)
  date,                      // payment/transaction date
  amount,                    // total transaction amount, IVA-inclusive (matches orders' inclusive convention)
  ivaAmount = 0,             // IVA descontable (expense) / IVA generado (revenue) (§6)
  retefuente = 0,
  reteica = 0,
  reteiva = 0,
  categoryId, categoryName,  // denormalized snapshot (existing ingredient pattern)
  description,
  paymentMethod,             // same list as orders
  counterparty = '',         // supplier / payer, free text, optional
  invoiceRef = '',           // factura/document number, optional
  templateId = null,         // set when materialized from a recurring template (§3)
  notes = '',
  isDeleted, lastEditedBy, createdAt, updatedAt
}
```

Why one collection: the P&L reads both types for the same period in one query; the factory pattern generates the CRUD once; the models are ~95% identical (revenue entries also carry IVA in Colombia). The entry *forms* differ — that is a frontend concern, not a model split.

**Rejected: separate `expenses` / `otherRevenue` collections.** Marginally clearer in the Firestore console; duplicates service/controller wiring and forces two queries per statement period. Not worth it.

Derived, never stored: `preTaxAmount = amount − ivaAmount`.

---

## 3. Decision: recurring templates with lazy materialization

`bakeries/{bakeryId}/accountingTemplates` — one doc per recurring cost (or recurring income):

```
AccountingTemplate {
  id,
  type: 'expense' | 'revenue',   // expense in practice; revenue allowed (fixed contracts)
  name,                          // "Arriendo local"
  categoryId, categoryName,
  defaultAmount,
  defaultIvaAmount = 0,
  paymentMethod = 'transfer',
  dayOfMonth = null,             // informational (sort/reminder), no automation attached
  isActive = true,
  notes, createdAt, updatedAt
}
```

**Materialization is lazy — no cron, no draft documents.** The month view endpoint (`GET /accounting/months/:period`) returns:

- `entries` — all non-deleted entries with that `period`
- `pendingTemplates` — active templates with **no** entry whose id is `{templateId}_{period}`

"Pending" is computed at read time, never stored. Confirming a pending template = creating the entry (prefilled from the template, user adjusts amount if needed). The deterministic id `{templateId}_{period}` makes confirmation idempotent — the same trick as the inventory ledger's deterministic movement ids — and means a soft-deleted template entry can be re-confirmed by undeleting/overwriting the same doc, so a deleted entry naturally reappears as pending.

Editing a template's `defaultAmount` affects only future confirmations; existing entries are untouched (they captured the real amount when confirmed). No template versioning.

**Rejected: scheduled function creating drafts on the 1st.** Adds cron infrastructure, creates drafts for abandoned accounts, introduces a draft state to manage, and removes the human from a loop the UX explicitly wants them in ("confirm/adjust, not re-type").

---

## 4. Decision: explicit `period`, separate `date`

An entry stores **which P&L month it belongs to** (`period: 'YYYY-MM'`) independently from **when it was paid** (`date`). Rent confirmed July 3rd — or paid late on August 2nd — is July rent either way.

- The month view and the P&L group strictly by `period`.
- `date` defaults to today at entry time; users rarely touch it.
- This is the accrual-vs-cash distinction in embryo. The balance-sheet phase (accounts payable, cash flow) needs exactly this separation; capturing it now costs one field and, like the IVA fields, cannot be reconstructed retroactively.

**Rejected: single date, month derived.** Simpler form, but late-paid fixed costs land in the wrong month, distorting exactly the report this epic exists to fix — and a `period` retrofit later would require guessing intent from dates.

Note the asymmetry with orders: the order side of the statement still filters by `dueDate`/`paymentDate` (user-selectable, unchanged). Entries always aggregate by `period`. The statement is month-aligned; arbitrary date ranges snap to whole months for the entries side.

---

## 5. Decision: categories embedded in `BakerySettings`

`expenseCategories` and `revenueCategories` — arrays on the settings doc, same shape and management as `ingredientCategories` (`{id, name, description, displayOrder, isActive}`). Entries reference `categoryId` and denormalize `categoryName`; never free text (roadmap resolved decision).

- **Defaults have fixed slug ids** (`arriendo`, `nomina`, `servicios`, …) seeded by the `BakerySettings` constructor when the arrays are absent — existing bakeries get them on next settings read/save, no migration script. Custom categories get generated ids.
- Categories are soft-disabled (`isActive: false`), never deleted, so historical entries keep resolving.
- Proposed defaults (final wording open, §12): **expense** — Arriendo, Nómina, Servicios públicos, Transporte y domicilios, Mantenimiento, Empaques, Publicidad, Honorarios, Impuestos, Otros gastos; **revenue** — Eventos, Alquileres, Otros ingresos.
- **The decoy category (`ingredientes`, fixed slug):** "Ingredientes y materia prima" **appears** in the expense category list but is a signpost, not a bucket — selecting it never saves an entry. The predictable failure is a user scanning the list for "ingredientes", not finding it, and dumping flour into "Otros gastos"; the category's absence doesn't teach, it funnels the mistake somewhere invisible. Instead, selecting it explains and redirects, context-aware: with the Compras flow available — "las compras de ingredientes se registran en **Compras** para que entren al inventario y al costo de ventas → [Ir a Compras]" (carrying over anything already typed); without it — "el costo de tus ingredientes ya entra al estado de resultados a través del costo de tus productos — no lo registres también como gasto." The second message covers the nastiest silent case: an accounting-only business double-counting flour against COGS.

**Rejected: separate categories collection.** New wiring and endpoints for a list that stays at 10–30 items per business. The ingredient precedent works; follow it.

---

## 6. Decision: Colombia tax fields from day one

Every entry carries `ivaAmount`, `retefuente`, `reteica`, `reteiva` — flat optional scalars defaulting to 0, entered under a collapsed "Impuestos" section in the form. Templates carry `defaultIvaAmount` so the monthly confirm flow never asks twice.

Rationale (roadmap): tax **reporting** can come later, but the data cannot be reconstructed retroactively. Flat scalars, not a typed retention array — three known retention kinds, no dynamism needed, and flat fields keep the form and the model trivial.

`amount` is IVA-inclusive (the number on the receipt), consistent with the orders' `inclusive` tax mode convention. Sales IVA remains on orders; nothing changes there.

---

## 7. Decision: COGS boundary — purchases are not operating expenses

Cost of sales continues to come from product/recipe cost (roadmap phase 2, explicitly). Ingredient purchases recorded through the future **Compras** flow (Inventory §10.4) are **stock acquisitions, not P&L expense entries** — the cost hits the statement when the product is sold (COGS), not when the flour is bought.

Consequences:

- The default expense categories deliberately exclude "ingredientes/materia prima". A business that types rent and flour into the same expense form would double-count flour (once as expense, once as COGS).
- Entry-form UX guards this with the **decoy category** (§5): "Ingredientes y materia prima" is in the list but redirects/explains instead of saving — it catches the intent at the exact moment and place the mistake happens. Note the rule is **universal, not inventory-conditional**: flour-as-expense double-counts whether or not the inventory module exists, because COGS comes from `costPrice` either way (§13).
- Until the Compras flow exists, businesses that want to track ingredient spend simply keep maintaining `costPerUnit`/`costPrice` as today; the statement's coverage metrics already surface gaps.

---

## 8. Decision: income statement moves to an accounting service

New backend surface: `accountingService` + `accountingController` + routes under `/bakeries/:bakeryId/accounting/…`:

```
CRUD   /accounting/entries            (factory-generated)
CRUD   /accounting/templates          (factory-generated)
GET    /accounting/months/:period     → { entries, pendingTemplates }   (§3)
GET    /accounting/income_statement   → extended statement (below)
```

The statement computation moves out of `orderService` (already ~260 lines there and about to learn a second collection) into the accounting service — extracted as a report module in the spirit of `SalesReport`/`ProductReport`. The order-side logic (revenue, COGS waterfall, coverage) is reused as-is; the old `/orders/income_statement` route is deleted and the frontend service updated in the same release (we own the only client).

**Statement structure** (per period and totals):

```
Revenue
  productSales + deliveryFees        (existing)
  otherRevenue                       (Σ revenue entries, by category)
− COGS + deliveryCosts               (existing)
= Gross profit                       (existing)
− Operating expenses                 (Σ expense entries, grouped by category)
= Net profit (+ net margin %)
```

Completeness signal: a month whose `pendingTemplates` is non-empty renders a warning in the statement ("3 costos fijos sin confirmar") — the accounting counterpart of the inventory coverage matrix. An incomplete month must look incomplete, never silently profitable.

---

## 9. Resulting model changes (summary)

| Entity | Change |
|---|---|
| New: `accountingEntries` collection | unified expense/revenue entries (§2), deterministic ids for template-born entries (§3), tax fields (§6) |
| New: `accountingTemplates` collection | recurring templates (§3) |
| `BakerySettings` | + `expenseCategories`, + `revenueCategories` (constructor-seeded defaults with fixed slug ids, §5) |
| `Order` | no changes |
| Income statement | relocated to `accountingService`, extended to net profit (§8); `/orders/income_statement` route removed |

All changes additive; no data migration. New backend surface: `accountingService`, `accountingController`, `accountingRoutes` following the factory patterns. Frontend: `accountingService.js` + Pinia store, fixed-costs month view, entry/template forms, category management in settings, extended `IncomeStatement.vue`.

Indexes: composite on (`type`, `period`) — the statement and month view both query by period; single-field on `templateId` is unnecessary (pending check is by deterministic id).

---

## 10. UX requirements

Roadmap cross-cutting rule: **data entry is the product risk, not the reports.**

1. **The month view is a checklist, not a form.** Pending templates listed with prefilled amounts; confirming the common case ("rent, same as always") is one tap. Adjusting is an inline edit of the amount, then confirm. Zero re-typing.
2. **One-off entry in under ten seconds.** Category, amount, description — everything else defaulted (period = viewed month, date = today, payment method = business default). Save-on-blur / enter-advances, same pattern as invoice items.
3. **Taxes collapsed by default.** The "Impuestos" section (IVA, retenciones) is folded; templates remember `defaultIvaAmount` so recurring entries never re-ask.
4. **Inline category creation.** Typing an unknown category offers "create it" in place — never navigate to settings mid-entry (same rule as inline ingredient creation in Inventory §11.4).
5. **Month completeness is visible.** Pending-template count on the month view and as a warning on the statement (§8). Confirmed months feel *done*.
6. **Copy from recent.** One-off entries offer "repeat" from the recent entries list (prefill everything, change amount) — the pragmatic middle ground between templates and blank forms.
7. **The Compras/Gastos boundary is defended in layers** (§7). (a) *Naming*: frame by what each flow does, not what it costs — "Compras de inventario" (merchandise entering stock) vs "Gastos del negocio" (running the business); to a user both just mean "pagué plata". (b) *Structure*: entries carry an amount and nothing countable — **never add a quantity or item field to entries**, the moment gastos can count things the two forms blur; Compras' item picker makes the reverse mistake (rent as a purchase) structurally impossible. (c) *The decoy category* (§5) catching intent at the moment it goes wrong. (d) *Deferred*: a keyword nudge (description matching ingredient names → "¿esto es una compra de inventario?") is deliberately **not** built until real usage shows the decoy isn't catching enough — no heuristic machinery on speculation. The inventory-side merma summary (inventory §11.9) is the backstop that surfaces whatever leaks through.

---

## 11. Build order

1. **Categories** (§5) — `BakerySettings` arrays + defaults + settings UI. Small, unblocks everything.
2. **Entries model + CRUD** (§2, §6) — model, factory service/controller/routes, frontend service/store, basic entry form.
3. **Templates + month view** (§3) — template CRUD, `months/:period` endpoint, the checklist UI. *This is roadmap phase 1's deliverable.*
4. **Revenue entries** — type `revenue` forms and category list. *Roadmap phase 2.* (Model already supports it; this is UI.)
5. **Extended statement** (§8) — relocate, add other revenue + operating expenses + net profit, extend `IncomeStatement.vue`. *Roadmap phase 3.*

---

## 12. Open items

1. **Role access:** which roles may create/edit entries and templates (`accounting_assistant` + `bakery_admin` presumed; `bakery_staff`?). Decide when building routes — same deferral as Inventory §12.2.
2. **Default category lists:** final wording/composition with real business input before seeding (fixed slug ids make later additions cheap, renames are just label edits).
3. **Period closing (roadmap open question):** leaning snapshot-on-close — closing a month writes a frozen statement doc (`closedPeriods/{period}`); later edits to underlying data flag drift instead of silently changing history. Belongs with phase 3 polish or after; the entries model needs nothing extra for it now.
4. **IVA/retención reporting:** data captured from day one (§6); declaración-style reports deferred until there's real demand. When built, the purchase side unions in cleanly — same field names on both collections (§13.4).

---

## 13. Relationship to the Inventory epic

Boundary contract with [INVENTORY-IMPLEMENTATION.md](./INVENTORY-IMPLEMENTATION.md) (mirrored there as its §13). The two epics are **independent by construction** — a business can adopt either, both, or neither, in any order — and stay that way by holding five rules:

1. **The only shared data is `costPrice` / `costPerUnit`.** Accounting consumes them (the COGS waterfall); inventory refreshes them (recipe cost propagation). A client without inventory maintains costs manually — today's behavior — and their P&L still computes to net profit.
2. **The income statement never reads `purchases`; Compras never writes `accountingEntries`.** If a "cash view of ingredient spend" is ever wanted, it's a report over `purchases` — never expense entries.
3. **Ingredient spend is never an expense entry — universal rule, not inventory-conditional** (§7). Guarded by the decoy category (§5).
4. **One tax vocabulary**: `ivaAmount`, `retefuente`, `reteica`, `reteiva` — identical flat scalars on both `accountingEntries` and `purchases`, so future IVA/retención reports union the two collections without translation.
5. **Supplier entities / accounts payable belong to neither epic** — balance-sheet phase. Until then `counterparty` (entries) and `supplier` (purchases) remain free text and must not grow into entities independently.

---

## 14. Decision: module activation (shared with Inventory)

Mirrored verbatim as Inventory §14. Both epics ship as **modules that are off by default** and are switched on per business.

**Mechanism — the existing one, no new machinery.** `BakerySettings.features` already carries per-business behavior flags (`features.pos.enabled`, `features.order.offlineMode`) merged against `DEFAULT_FEATURES` in both the backend and frontend `BakerySettings` model, edited by system admins in `BakeryManagementView.vue`, and already consumed by `AdminSidebar.vue` to splice nav sections in and out. Two more flags join it:

```
features.inventory  = { enabled: false }
features.accounting = { enabled: false }
```

Defaults `false`, so every existing business reads as "off" with no migration — the same trick as inventory's `inventoryMode: 'none'`.

**The flag gates doors, never logic.** This is the rule that keeps the toggle from becoming a bug factory:

- **Frontend only**: sidebar sections (admin **and** accounting sidebars), route guards (`meta.requiresFeature`), settings tabs (category management, §5), and entry points into the month view and entry forms. Off = the business sees no trace of the module.
- **Never in the backend**: no `if (features.accounting.enabled)` in `accountingService`, `orderService`, or the statement computation. Both epics already no-op for a non-adopting business by construction — with no `accountingEntries` the statement's net profit simply equals its gross profit, and every product is `inventoryMode: 'none'` so nothing deducts. A settings check would be a **second kill switch that can drift from the first**, and on the inventory side toggling off for a month would silently stop deductions while sales continued — a hole in an append-only ledger that no count can explain. Data collection is unconditional; only the doors open and close.

**One consequence specific to this epic:** the extended income statement (§8) is *not* behind the flag. It replaces the existing one for everyone; a business with the accounting module off simply has no entries, so the new "operating expenses / net profit" rows read zero. Hiding the rows behind the flag would fork the report into two shapes for no gain.

**What the flag does not exempt.** Rules marked universal in §13 stay universal: ingredient spend is never an expense entry, and the decoy category (§5) redirects whether or not inventory is enabled. Only its message text is context-aware.

**Self-containment is the §13 contract, not the toggle.** The toggle is visibility; independence is the five data rules above. New code lives in its own directories (`src/services/accountingService.js`, `src/stores/accountingStore.js`, accounting views; the inventory counterparts) and existing services gain hooks, not knowledge of each other.
