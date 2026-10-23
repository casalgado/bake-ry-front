# Accounting Implementation

Design decisions for the Accounting epic ([ROADMAP.md](../strategy/ROADMAP.md) → Now → Accounting): fixed and one-off gastos, the Resumen month view, the P&G, the purchase form's accounting door, shared providers and the Facturas recibidas inbox. The balance sheet is out of scope. Electronic invoicing is its own epic (backend `services/dian/README.md`); §16 says how the two meet. Same purpose as [INVENTORY.md](../inventory/INVENTORY.md): source of truth for what was decided and why.

**Status of each area:**

| Area | Status |
|---|---|
| Glossary (ingresos, costo de ventas, gastos, Compra de insumos, registro) | ✅ Decided |
| One `accountingRecords` collection, single-sided | ✅ Decided |
| Recurring templates: lazy materialization | ✅ Decided |
| Record month: explicit `period` field | ✅ Decided |
| Categories in `BakerySettings` (kinds, `pucCode`) | ✅ Decided |
| Inversión (fixed assets) outside the P&G | ✅ Decided |
| Colombia tax fields on records | ✅ Decided |
| Costo de ventas boundary vs Compra de insumos | ✅ Decided |
| Insumo/gasto boundary UX (decoy category + layers) | ✅ Decided |
| P&G: new view, accounting service reusing `orderService.getIncomeStatement` | ✅ Decided |
| Sidebar and screens | ✅ Decided |
| One purchase form, two doors | ✅ Decided |
| Shared providers with fiscal fields; optional on manual entry | ✅ Decided |
| Facturas recibidas inbox: shape | ✅ Decided; mail transport open |
| Module activation (opt-in per business) | ✅ Decided (§14) |
| Combos with e-invoicing | ✅ Decided (§16) |
| Does the accountant need the balance sheet or journal from MAD? | 🔶 Open (accountant). Decides whether the balance-sheet phase moves up |
| Role access for records/templates | 🔶 Open (`requireBakeryBilling` meanwhile) |
| Default category lists and PUC codes | 🔶 Open (accountant) |
| Period closing (snapshot-on-close) | 🔶 Open, phase J |

---

## Glossary

One word per thing, in the UI and in these docs. Code and stored data stay English; these are the Spanish UI terms.

| Term | Meaning | PUC | Entered how |
|---|---|---|---|
| **Ingresos** | Money from selling | 4 | Automatic, from orders |
| **Costo de ventas** | Cost of what was sold | 6 | Automatic, from recipe cost. Never typed |
| **Gastos** | Cost of running the business | 5 | **Nuevo gasto**, or a recurring template |
| **Compra de insumos** | Buying what goes into the product or gets resold | feeds 6 | **Compra de insumos** screen |
| **Inversión** | Fixed assets (oven, kneader) | 1 | A gasto category of kind investment, outside the P&G |
| **Registro** | One single-sided row of money outside orders: a gasto, an inversión or other income | n/a | Stored in `accountingRecords` |

Rules:

1. **Bare "compras" is never a label.** It means buying anything. The screen is *Compra de insumos*.
2. **"Ingreso" never means stock entering.** In accounting it is income.
3. **"Costo" only appears as "costo de ventas".** Owners say "costos fijos" for rent and utilities; those are gastos, and the UI says *gasto recurrente*.
4. **The test:** is it in a recipe, or resold, and tracked in stock? Then Compra de insumos. Everything else is a gasto, packaging included (it is not in the recipe and its quantity per sale varies).
5. **A registro is not an asiento.** An asiento is a journal posting with a debit and a credit. A registro is one side only (see §2); the code and the UI never call it an "asiento" or an "entry".

---

## 1. Current backend state (baseline)

- **`Order` / `OrderItem`**: the entire revenue side today: `preTaxSubtotal`, `postTaxSubtotal`, `total`, `deliveryFee`/`deliveryCost`, discounts, `taxBreakdown` by rate (sales IVA is solved), `isPaid`, `paymentDate`, `paymentMethod`, `partialPayments[]` (future accounts-receivable seed), `einvoice` (status of the sale's electronic invoice, owned by the einvoicing service).
- **COGS**: per-item `costPrice` with a fallback waterfall (item → combination → product) inside `orderService.getIncomeStatement`. Inventory makes it recipe-computed; accounting only consumes it.
- **`getIncomeStatement`** (`orderService.js:614`, ~260 lines): computes revenue, COGS, gross profit, cost coverage; groups by month; route `GET /orders/income_statement`; consumed by `IncomeStatement.vue`, an older Tailwind view that stays as it is.
- **`BakerySettings`**: precedent for managed category lists: `ingredientCategories` is an embedded array of `{id, name, description, displayOrder, isActive}`. `features` carries `inventory`, `accounting` and `einvoicing` flags; the arrays are replaced whole on a settings PATCH.
- **`providers` and `purchases`** exist under inventory. `Provider` has `name`, `nationalId` and `phone`. A confirmed purchase is immutable. The base service's `create` accepts a caller-supplied `id`.
- **Nothing models money leaving the business** beyond `deliveryCost` and product `costPrice`. That is the gap this epic closes.
- **Roles**: `accounting_assistant` exists and has its own dashboard/sidebar (`AccountingSidebar.vue`, routes under `/accounting`). The module's sidebar section is added to it and to the admin sidebar. `requireBakeryBilling` (admin, staff, accounting) is the guard e-invoices use.

---

## 2. Decision: one `accountingRecords` collection, single-sided

Gastos, inversiones and other income live in **one collection**, `bakeries/{bakeryId}/accountingRecords`, discriminated by `type: 'expense' | 'revenue'`.

```
AccountingRecord {
  id,                        // '{templateId}_{period}' when template-born, else generated
  type: 'expense' | 'revenue',
  period,                    // 'YYYY-MM': the P&L month it belongs to (§4)
  date,                      // payment/transaction date
  amount,                    // total transaction amount, IVA-inclusive (matches orders' inclusive convention)
  ivaAmount = 0,             // IVA descontable (expense) / IVA generado (revenue) (§6)
  retefuente = 0,
  reteica = 0,
  reteiva = 0,
  categoryId, categoryName,  // denormalized snapshot (existing ingredient pattern)
  isInvestment = false,      // snapshot of the category's kind; investment records skip the P&G (§5)
  description,
  paymentMethod,             // same list as orders
  providerId = null,         // expense only: the shared provider (§13.5)
  counterparty = '',         // free text: the payer of a revenue record, or an expense with no provider
  invoiceRef = '',           // supplier invoice number or CUFE (§15)
  receivedInvoiceId = null,  // the inbox invoice this record was confirmed from (§15)
  templateId = null,         // set when materialized from a recurring template (§3)
  notes = '',
  isDeleted, lastEditedBy, createdAt, updatedAt
}
```

**Single-sided.** A registro stores the P&G side of a money movement: an amount, a category, a month. It has no debit and no credit and keeps no balances. The other side of the books (cash or bank, what is owed, stock) belongs to the balance-sheet phase. It can be derived later without storing it now: the debit is the category's `pucCode`, the credit comes from `paymentMethod` and `date` (cash or bank by method, or "owed" if unpaid). A journal export for the accountant is generated from records, not stored.

**What lives where:**

| Event | Stored as |
|---|---|
| A sale | `Order` |
| Ingredients or resale products bought | `Purchase` (Compra de insumos) |
| Rent, utilities, maintenance, packaging, payroll | Record, expense category |
| Oven, kneader | Record, `isInvestment` |
| A supplier invoice with eggs and cleaning supplies | One purchase + one record, same `invoiceRef` |
| Income outside orders | Record, `type: 'revenue'` |

**Provider.** Optional on manual entry (a payroll, a bank fee or a taxi receipt has no supplier, and forcing one slows the entry). It is required when:
- the record is created from an inbox invoice,
- the record has an `invoiceRef` (the dedupe key is `(providerId, invoiceRef)`),
- a documento soporte is about to be issued from it.

**Revenue records** are for income that needs no invoice: bank interest, a supplier refund, a used machine sold. They use `counterparty`, never `providerId`, and `isInvestment` is always false. **Anything sold to a customer is an order**, so it gets invoiced; the accountant's main worry is sales that escape invoicing. A loan or an owner's contribution is not income; it belongs to the balance-sheet phase.

One supplier invoice can cover several categories. It makes **one record per category**, all sharing the same `providerId` and `invoiceRef`. A record never has a quantity or item list (§10.7).

Derived, never stored: `preTaxAmount = amount − ivaAmount`.

**Rejected: separate `expenses` / `otherRevenue` collections.** Marginally clearer in the Firestore console; duplicates service/controller wiring and forces two queries per statement period.

---

## 3. Decision: recurring templates with lazy materialization

`bakeries/{bakeryId}/accountingTemplates`: one doc per recurring gasto (or recurring income):

```
AccountingTemplate {
  id,
  type: 'expense' | 'revenue',   // expense in practice; revenue allowed (a fixed rental)
  name,                          // "Arriendo local"
  categoryId, categoryName,
  providerId = null,
  defaultAmount,
  defaultIvaAmount = 0,
  paymentMethod = 'transfer',
  dayOfMonth = null,             // informational (sort/reminder), no automation attached
  isActive = true,
  notes, createdAt, updatedAt
}
```

**Materialization is lazy: no cron, no draft documents.** The month view endpoint (`GET /accounting/months/:period`) returns:

- `records`: all non-deleted records with that `period`
- `pendingTemplates`: active templates with **no** record whose id is `{templateId}_{period}`

"Pending" is computed at read time, never stored. Confirming a pending template creates the record (prefilled from the template, user adjusts the amount if needed). The deterministic id `{templateId}_{period}` makes confirmation idempotent (the same trick as the inventory ledger's deterministic movement ids) and means a soft-deleted template record can be re-confirmed by overwriting the same doc, so a deleted record naturally reappears as pending.

Editing a template's `defaultAmount` affects only future confirmations; existing records are untouched. No template versioning. "Recurring" is not "fixed": internet recurs and its amount varies.

**Rejected: scheduled function creating drafts on the 1st.** Adds cron infrastructure, creates drafts for abandoned accounts, introduces a draft state to manage, and removes the human from a loop the UX wants them in ("confirm/adjust, not re-type").

---

## 4. Decision: explicit `period`, separate `date`

A record stores **which P&L month it belongs to** (`period: 'YYYY-MM'`) independently from **when it was paid** (`date`). Rent confirmed July 3rd, or paid late on August 2nd, is July rent either way.

- The month view and the P&G group strictly by `period`.
- `date` defaults to today at entry time; users rarely touch it.
- This is the accrual-vs-cash distinction in embryo. The balance-sheet phase needs exactly this separation; capturing it now costs one field and cannot be reconstructed retroactively.

**Rejected: single date, month derived.** Late-paid recurring gastos land in the wrong month, distorting the report this epic exists to fix.

The order side of the statement still filters by `dueDate`/`paymentDate` (user-selectable). Records always aggregate by `period`. The statement is month-aligned; arbitrary date ranges snap to whole months for the records side.

---

## 5. Decision: categories embedded in `BakerySettings`

`expenseCategories` and `revenueCategories`: arrays on the settings doc, same shape and management as `ingredientCategories`, plus `pucCode`:

```
{ id, name, description, displayOrder, isActive, pucCode = '', isInvestment = false }
```

Records reference `categoryId` and denormalize `categoryName` and `isInvestment`; never free text.

- **Categories, not a chart of accounts.** The P&G needs account grouping, not postings. `pucCode` is an optional string the accountant fills in; the class comes from the list (revenue 4, gasto 5, investment 1). A category with no code groups under its class. No ledger and no double-entry until the balance-sheet phase.
- **Inversión** is an expense category with `isInvestment: true` (defaults below). Its records are kept for the books and the tax data but never enter the P&G arithmetic (§8).
- **Defaults have fixed slug ids** (`rent`, `payroll`, `utilities`, …: English slugs, Spanish names) seeded by the `BakerySettings` constructor when the arrays are absent. Existing bakeries get them on next settings read/save, no migration. Custom categories get generated ids.
- Categories are soft-disabled (`isActive: false`), never deleted, so historical records keep resolving.
- **Proposed defaults** (final wording and codes open, §12). Gasto: Arriendo, Nómina, Servicios públicos, Transporte y domicilios, Mantenimiento y reparaciones, Aseo y cafetería, Papelería, Empaques, Publicidad, Honorarios, Gastos legales, Impuestos, Otros gastos. Investment: Maquinaria y equipo, Muebles y enseres. Revenue: Eventos, Alquileres, Otros ingresos.
- **The decoy category (reserved id `ingredients`):** "Ingredientes y materia prima" **appears** in the gasto picker (a frontend-only row, not stored in settings) but is a signpost, not a bucket: selecting it never saves a record, and the backend rejects that id. A user scanning for "ingredientes" and not finding it would dump flour into "Otros gastos", an invisible mistake. Selecting it explains and redirects: "los insumos que van en tus recetas se registran en **Compra de insumos** para que entren al inventario y al costo de ventas → [Ir a Compra de insumos]" (carrying over what was typed). Without inventory the text says the ingredients' cost already reaches the P&G through the product's cost and must not be entered as a gasto too.

**Rejected: separate categories collection.** New wiring for a list that stays at 10–30 items per business.

---

## 6. Decision: Colombia tax fields from day one

Every record carries `ivaAmount`, `retefuente`, `reteica`, `reteiva`: flat optional scalars defaulting to 0, entered under a collapsed "Impuestos" section. Templates carry `defaultIvaAmount` so the monthly confirm flow never asks twice.

Tax **reporting** can come later, but the data cannot be reconstructed retroactively. Flat scalars, not a typed retention array: three known retention kinds, no dynamism needed.

`amount` is IVA-inclusive (the number on the receipt), consistent with the orders' `inclusive` tax mode. Sales IVA stays on orders.

---

## 7. Decision: costo de ventas boundary

Costo de ventas comes from product/recipe cost. A **Compra de insumos** is a stock acquisition, not a P&G record: its cost reaches the statement when the product is sold, not when the flour is bought. This is how the accountant described it: a sale posts its recipe cost to group 6 and reduces inventory by the same amount.

- The default gasto categories exclude ingredients. A business that types rent and flour into the same form would count flour twice (once as a gasto, once as costo de ventas).
- The rule is **universal, not inventory-conditional**: flour as a gasto double-counts whether or not the inventory module exists, because costo de ventas comes from `costPrice` either way (§13).
- **Compras del mes** (the cash spent on insumos) is a different number from costo de ventas: they differ by what sits unsold. It is shown as a memo line beside the P&G, never subtracted from profit (§8).
- A business with accounting but no inventory records its purchases through the same screen (§13): that keeps ingredient `costPrice` current, which feeds costo de ventas.

---

## 8. Decision: the P&G is a new view on an accounting service

New backend surface: `accountingService` + `accountingController` + routes under `/bakeries/:bakeryId/accounting/…`:

```
CRUD   /accounting/records            (factory-generated)
CRUD   /accounting/templates          (factory-generated)
GET    /accounting/months/:period     → { records, pendingTemplates }   (§3)
GET    /accounting/income_statement   → extended statement (below)
```

`accountingService.getIncomeStatement` **calls `orderService.getIncomeStatement`** for the order side (revenue, COGS waterfall, coverage) and adds the records on top. The order logic is extracted into its own module only if something else needs it. The old `/orders/income_statement` route and `IncomeStatement.vue` stay until the new P&G replaces them in the sidebar; then both are deleted together.

The P&G is a **new `ui-*` view**; existing Tailwind views are not edited.

**Before the statement is built:** verify whether an annulled invoice (a credit note) removes the order's revenue from the order side. The P&G must not count credited sales.

**Statement structure** (per period and totals), rows grouped by category and, when set, `pucCode`:

```
Ingresos
  Ventas + domicilios                (orders)
  Otros ingresos                     (revenue records, by category)
− Costo de ventas + costo de domicilios   (orders, recipe cost)
= Utilidad bruta
− Gastos                             (expense records, by category; investment excluded)
= Utilidad neta (+ margen neto %)

Memo, outside the arithmetic:
  Compras del mes                    (Σ purchases)
  Inversiones del mes                (Σ investment records)
```

**Completeness signals.** An incomplete month must look incomplete, never silently profitable. A warning line lists what is outstanding: recurring gastos not confirmed, supplier invoices waiting in the inbox (§15), and, when einvoicing is on, sales without an invoice (§16).

**Export (phase I).** The P&G exports with the `pucCode` beside each category. If the accountant needs journal entries for her own books, they are generated from records at export time (§2).

---

## 9. Resulting model changes (summary)

| Entity | Change |
|---|---|
| New: `accountingRecords` collection | unified gasto/revenue records (§2), deterministic ids for template-born records (§3), tax fields (§6) |
| New: `accountingTemplates` collection | recurring templates (§3) |
| New: `receivedInvoices` collection | the inbox (§15) |
| `BakerySettings` | + `expenseCategories`, + `revenueCategories` with `pucCode`, `isInvestment` (§5) |
| `Provider` | shared entity; + `documentType`, `email`, `defaultDestination` (phase E); `address`, `issuesEinvoice` (phase G) (§13.5) |
| `Purchase` | + tax fields, `invoiceRef`, `receivedInvoiceId`, set at creation (§13) |
| `Order` | no changes |
| Income statement | new accounting endpoint and view (§8); the old route stays until retired |

All changes additive; no data migration. New backend surface follows the factory patterns. Frontend: `accountingService.js` + Pinia stores, the screens in §10, category management in settings.

Indexes: composite on (`type`, `period`) for records; the statement and month view both query by period.

---

## 10. Screens and UX

Roadmap cross-cutting rule: **data entry is the product risk, not the reports.**

### Sidebar

```
Contabilidad                   (features.accounting.enabled)
  Resumen
  Facturas recibidas
  P&G
  Gastos recurrentes
  Compra de insumos            (here if accounting is on, else under Inventario; one link)

Usuarios
  Proveedores                  (if inventory, accounting or einvoicing is on)

Pedidos
  Facturas                     (einvoicing; gains "Documentos soporte", §16)
```

Categories live in settings, not the sidebar. The `accounting_assistant` dashboard gets the same section behind the same flag.

### Screens

- **Resumen**: the month's working screen. Month stepper (‹ month ›, a value local to the view; the shared period store and `PeriodSelector.vue` belong to the older reports); **Por confirmar** (pending templates, prefilled, one tap to confirm, inline amount edit); the month's registros with **+ Nuevo gasto**; a totals strip (ingresos, costo de ventas, gastos, utilidad neta, link to the P&G); the completeness warnings (§8).
- **Nuevo gasto**: category, amount, description, provider (optional, created inline). Taxes collapsed. "Repetir" copies a recent record. Picking the decoy category redirects (§5). With einvoicing on and the provider's fiscal data present, a row can emit a documento soporte (§16).
- **P&G**: months as columns, structure in §8, export with the `pucCode` beside each category.
- **Gastos recurrentes**: list of templates (name, category, amount, day, active).
- **Facturas recibidas**: the inbox (§15).
- **Compra de insumos**: the inventory purchase form (INVENTORY.md §4.1). With accounting on it also shows the tax fields and the supplier invoice number.
- **Proveedores**: name, document type and number, email, phone, default destination (insumo, a gasto category, or inversión).

Lists on these screens are plain `ui-*` lists, not the older DataTable.

### Requirements

1. **The month view is a checklist, not a form.** Confirming "rent, same as always" is one tap; adjusting is an inline edit. Zero re-typing.
2. **A one-off gasto in under ten seconds.** Category, amount, description; everything else defaulted (period = viewed month, date = today, payment method = business default).
3. **Taxes collapsed by default.** Templates remember `defaultIvaAmount`.
4. **Inline creation** of categories and providers. Never navigate to settings mid-entry.
5. **Month completeness is visible.** Confirmed months feel *done*.
6. **Copy from recent.** One-off records offer "repetir".
7. **The insumo/gasto boundary is defended in layers.** (a) *Naming*: Compra de insumos vs Gastos, by what each does. (b) *Structure*: records carry an amount and nothing countable, **never add a quantity or item field to records**; the purchase form's item picker makes the reverse mistake (rent as a purchase) impossible. (c) *The decoy category* (§5). (d) *Deferred*: a keyword nudge is not built until real usage shows the decoy isn't enough. The inventory-side merma summary is the backstop.

---

## 11. Build order (phases A–J)

| | Phase | Depends on | Size |
|---|---|---|---|
| A | **Categories** (§5): `BakerySettings` arrays, defaults, settings section | none | S |
| B | **Records + Nuevo gasto** (§2, §6): model, factory service/controller/routes, store, form | A | M |
| C | **Templates + Resumen** (§3): template CRUD, `months/:period`, the checklist screen | B | M |
| D | **P&G** (§8): accounting service, new view | B, C | M |
| E | **Shared providers + purchase door** (§13): `documentType`, `email`, `defaultDestination`, the uniqueness rule; tax fields and `invoiceRef` on purchases; sidebar rule; Proveedores screen; rename of the Ingreso screen | A | M |
| F | **Facturas recibidas** (§15) | B, E | L |
| G | **Documento soporte** (§16): provider `address` and `issuesEinvoice` | E | L |
| H | **Other revenue**: UI only, the model supports it | B | S |
| I | **Export for the accountant** (§8) | D | S |
| J | **Period close**: snapshot-on-close (`closedPeriods/{period}`) | D | M |

The serial spine is A → B → C → D (the Resumen and P&G the accountant can test). E can start after A. Each phase ships behind the `accounting` flag. Deploy order is the inventory one: indexes, rules, functions, hosting.

---

## 12. Open items

1. **Does the accountant need the balance sheet or the journal from MAD, or only the P&G?** Alegra builds double-entry books automatically; replacing it without them may leave a hole. The answer decides whether the balance-sheet phase moves up.
2. **Role access:** which roles may create/edit records and templates (`requireBakeryBilling` meanwhile: admin, staff, accounting).
3. **Default category lists and PUC codes:** final wording and codes with the accountant. Packaging (gasto is the working answer), cleaning and maintenance (class 5 or 7), whether a bakery uses class 7 (production costs).
4. **Costo de ventas for accounting-only clients:** recipe cost (working answer) or purchases?
5. **Waste and shrinkage:** how normal and abnormal loss reach the P&G.
6. **Non-deductible invoices** (an invoice on a personal NIT) and money that is not a gasto (a loan to the owner): where they go.
7. **DIAN receipt events** (acuse, recibo, aceptación) for supplier invoices: is the business responsible?
8. **Payroll:** whether the business owes electronic payroll; payslips for workers are a separate feature.
9. **Facturas recibidas transport:** how mail reaches the system and how the attachments are read. Decide after a spike on a handful of real invoices.
10. **Documento soporte enablement:** it likely needs its own DIAN test set. Verify, and request it early.
11. **IVA/retención reporting:** data captured from day one; declaración-style reports deferred until there is demand.
12. **What the accountant uses today beyond invoicing, purchases and documento soporte** (bank reconciliation, petty cash, receivables, exports).

---

## 13. Relationship to the Inventory epic

Boundary contract with [INVENTORY.md](../inventory/INVENTORY.md) (mirrored there as its §10). The two epics stay independent by construction: a business can adopt either, both or neither, in any order. Six rules:

1. **Shared data is `costPrice` / `costPerUnit`, the purchase document and providers.** Accounting consumes costs (the COGS waterfall); inventory refreshes them (recipe cost propagation). A client without inventory still records purchases through the same form (rule 6), which keeps ingredient costs current, and its P&G still computes to net profit.
2. **The P&G's arithmetic never reads `purchases`; Compra de insumos never writes `accountingRecords`.** "Compras del mes" is a memo report over `purchases`, shown outside the net-profit line.
3. **Ingredient spend is never a gasto**, whether or not inventory is on. The decoy category (§5) guards it.
4. **One tax vocabulary:** `ivaAmount`, `retefuente`, `reteica`, `reteiva`, plus `invoiceRef`. `accountingRecords` and `purchases` use the same names, so future IVA/retención reports union them without translation. The purchase form shows these fields when accounting is on.
5. **Providers are a shared entity**, owned by neither epic. Today a provider has `name`, `nationalId` (the NIT or cédula number) and `phone`. It gains:
   - `documentType` (`NIT` | `CC` | `CE`): the number alone cannot tell a company from a person. The NIT check digit is computed, never typed.
   - `email`: needed for the documento soporte and for matching senders in the inbox.
   - `defaultDestination: { kind: 'insumo' | 'expense' | 'investment', categoryId? }`: where this supplier's invoice lines go by default; `categoryId` only for `expense`. A supplier's default is not always a gasto category (a flour house defaults to insumo, a machinery seller to investment).
   - Phase G: `address` (line, city code, department code) for the documento soporte, and `issuesEinvoice` to tell whether a documento soporte is needed at all.
   - `(documentType, nationalId)` is unique per business: the inbox matches suppliers by it, and a duplicate would split a supplier's invoices.

   Records point at a provider with `providerId`; purchases and documentos soporte do too. Accounts payable (owing money, due dates, payments) is not part of providers; it belongs to the balance-sheet phase.
6. **One purchase form, two doors.** Compra de insumos is a single screen reached from whichever module is on, shown once in the sidebar. The flags change what the form shows and where the link sits, never the data model, and no backend code branches on them. Two forms for the same record would drift and double-enter invoices.

---

## 14. Decision: module activation

Inventory, accounting and e-invoicing ship as **modules that are off by default**, switched on per business.

**Mechanism: the existing one.** `BakerySettings.features` carries per-business flags (`features.pos.enabled`, `features.order.offlineMode`), merged against `DEFAULT_FEATURES` in both the backend and frontend `BakerySettings` model, edited by system admins in `BakeryManagementView.vue`, and consumed by `AdminSidebar.vue` to splice nav sections in and out:

```
features.inventory  = { enabled: false, enabledAt: null, warehouses: [...] }
features.accounting = { enabled: false }
features.einvoicing = { enabled: false }
```

Defaults `false`, so every existing business reads as "off" with no migration. Inventory's ledger follows `enabledAt` (INVENTORY.md §4.4).

**The flag gates doors, never logic:**

- **Frontend only**: sidebar sections (admin **and** accounting sidebars), route guards (`meta.requiresFeature`), settings tabs, entry points into the month view and forms. Off = the business sees no trace of the module.
- **Never in the backend**: no `if (features.accounting.enabled)` in `accountingService`, `orderService` or the statement computation. Each module already no-ops for a non-adopting business. A settings check would be a second kill switch that can drift from the first. Data collection is unconditional; only the doors open and close.

**The extended P&G is not behind the flag.** A business with accounting off has no records, so the new rows read zero.

**What the flag does not exempt.** The universal rules (§13.3, the decoy category) stay universal; only message text is context-aware.

**Self-containment is the §13 contract, not the toggle.** New code lives in its own directories (`src/services/accounting*.js`, `src/stores/accounting*.js`, `src/views/accounting/`); existing services gain hooks, not knowledge of each other.

---

## 15. Facturas recibidas (the inbox)

Supplier invoices arrive as electronic invoices by email: one month of MAD's mail held 28 emails from 13 suppliers, almost all with line items. Typing them is the cost this epic must remove, so the inbox is the main entry door after Resumen; Compra de insumos and Nuevo gasto remain the manual doors.

**Flow.**

1. An invoice arrives and is read into a `receivedInvoices` document: provider, `invoiceRef` (number or CUFE), date, lines (description, quantity, net, IVA), and totals.
2. Each line gets a destination: **insumo**, a **gasto category**, **inversión**, or **ignore**. The default comes from the provider's `defaultDestination`; a line can override it. Suppliers that sell one thing (a hardware store, a cheese seller, a cleaning supplier) need no review; mixed suppliers (a supermarket, a bakery-supply house) do.
3. Lines the system cannot place wait in a review queue. The owner decides; the parser never guesses silently (meat for fillings or for staff meals, a yogurt, a sticker label).
4. Confirming creates the real documents: the insumo lines become **one purchase** (through the purchase form's API), and each gasto or inversión category becomes **one record**, all carrying the same `providerId`, `invoiceRef` and `receivedInvoiceId`.
5. **An invoice is never entered twice**: `(providerId, invoiceRef)` is the dedupe key.

**Cases.**

- A supplier's **credit note** (a return) is a correction of the original document, never an edit (purchases are immutable; INVENTORY.md §8).
- **DIAN event emails** (acuse, recibo, aceptación) are not invoices and are not read as lines.
- An invoice on a **different NIT** than the business is flagged, not silently booked (open item 6).

**Decided:** the shape above. **Not decided:** how the mail gets in (a forwarding address and attached XML are the likely path) and where the review queue lives in the UI (open item 9).

---

## 16. Relationship to e-invoicing

E-invoicing is its own module with its own flag. Accounting and e-invoicing work independently:

| Accounting | Einvoicing | What the business gets |
|---|---|---|
| off | off | Orders, inventory as enabled |
| on | off | Resumen, records, P&G, inbox. No invoice status anywhere |
| off | on | Sales invoices, credit notes, and documentos soporte from the Facturas screen |
| on | on | The above, plus "emitir documento soporte" from a record or purchase, and the "ventas sin factura" warning in the P&G |

Rules:

1. **The einvoicing service owns every electronic document.** Accounting never writes `einvoices`, and e-invoicing never writes records or purchases.
2. **Documento soporte** is for purchases from a supplier that is not obliged to e-invoice, and without it the expense is not deductible. It is an einvoicing document with an optional `source: {type: 'purchase' | 'accountingRecord', id}`. A purchase stays immutable: the screen finds its documento soporte by `source`, and the purchase carries no pointer. It can also be issued standalone from Facturas. Every supplier in MAD's sample e-invoices, so it is not the first thing to build.
3. **Sales without an invoice** are read from `order.einvoice`, which the orders already carry. The P&G warning needs no coupling between the modules.
4. **The accountant's main requirement** is that every sale in the month is invoiced, including a Sunday at month-end. The orders list filter and the P&G warning are how it is seen.
