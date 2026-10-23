# Accounting: implementation brief (for the AI doing the work)

You are implementing the accounting module of a Vue 3 + Firebase Functions bakery system. Read this whole page, then the sources in §1, then start at phase A. The human overview is [HANDOFF.md](HANDOFF.md); the decisions and their reasons are [ACCOUNTING-IMPLEMENTATION.md](ACCOUNTING-IMPLEMENTATION.md) (the source of truth: when this page and that one disagree, stop and ask).

Backend root: `C:\Users\casal\documents\web\back\bake-ry\functions\src` (`BE`). Frontend root: `C:\Users\casal\documents\web\front\bake-ry-front\src` (`FE`).

---

## 0. How to work

1. **One phase at a time, A to E in order.** F to J are outlined only (§9); do not start them without a fresh instruction.
2. **Before changing an existing file, explain first**: the diagnosis, the diff, and the blast radius, as text. Wait for "apply it". New files may be created once the phase plan is agreed.
3. **Ask before running any test.** Write tests as part of each phase; run nothing without permission.
4. **No eslint after edits. No git actions** (commit, branch, worktree) unless asked.
5. Edit with the Edit/Write tools, never shell scripts or heredocs that patch files.
6. The dev server is always running. Do not ask to start it.
7. At the end of a phase, report: what changed, how a person verifies it in the UI, and anything you were unsure of. Then stop.
8. If a fact in §2 turns out wrong, say so and correct the plan; do not work around it silently.

## 1. Read first

- `zplanning/accounting/ACCOUNTING-IMPLEMENTATION.md` (all of it) and `zplanning/accounting/HANDOFF.md`.
- `FE src/assets/ui/CLAUDE.md`, and the live gallery source `FE src/views/SystemAdmin/UxView.vue` + `UxFormsView.vue`. New views follow the `ui-*` system.
- Reference screens to imitate: `FE views/inventory/CountList.vue` (a list), `FE views/inventory/PurchaseDoc.vue` (a document form), `FE components/settings/ModulesSection.vue` (a settings section), `FE components/ui/PageHeader.vue`.
- Backend patterns: `BE routes/providerRoutes.js`, `controllers/providerController.js`, `services/providerService.js`, `models/Provider.js`, `models/Purchase.js`, `routes/einvoiceRoutes.js`.
- Memory-worthy conventions are in §3.

## 2. Verified facts (checked against the code)

| Fact | Where |
|---|---|
| `createBaseService(collection, Model, 'bakeries/{bakeryId}')` gives `create/getById/getAll/update/patch/remove`. `create` uses `data.id` as the doc id when present and overwrites with `set`. `remove` is a soft delete (`isDeleted: true, isActive: false`). `getAll` filters `isDeleted != true` and orders by `createdAt desc` | `BE services/base/serviceFactory.js` |
| `createBaseController(service, validateFn)`: `validateFn(data)` returns an array of error strings → 400. `patch` bodies skip validation. Handlers read `req.params.bakeryId`, `req.params.id` | `BE controllers/base/controllerFactory.js` |
| A route file builds `router.use(authenticateUser)` then a `bakeryRouter` with `hasBakeryAccess` mounted at `/:bakeryId`; mounted in `index.js` with `app.use("/bakeries", xRoutes)` | `BE routes/providerRoutes.js`, `BE index.js:61-68` |
| Guards in `middleware/userAccess.js`: `requireBakeryAdmin`, `requireBakeryStaffOrAdmin`, `requireBakeryBilling` (staff, admin, system_admin, accounting_assistant), `requireBakeryAssistant` | `BE middleware/userAccess.js` |
| `BaseModel` assigns all passed data, defaults `createdAt`, turns `dateFields` into `Date` (a date-only string becomes `T12:00:00Z`), and `toFirestore()` drops `id` and undefined. Models that add a date field do `super({ id, createdAt, updatedAt, date })` and `static get dateFields() { return [...super.dateFields, 'date']; }` | `BE models/base/BaseModel.js`, `models/Purchase.js` |
| `Provider` has `name`, `nationalId` (null), `phone` (null), `isDeleted`; the only validation is a non-empty name | `BE models/Provider.js`, `controllers/providerController.js` |
| `BakerySettings` stores `ingredientCategories` as an embedded array of `IngredientCategory` objects; `toFirestore` maps them with `toPlainObject()`; `features` already has `accounting: { enabled }` and `einvoicing`. The settings doc id is `default` under `bakeries/{id}/settings` | `BE models/BakerySettings.js` |
| The settings `patch` merges `features`/`branding`/`subscription` one level deep and **replaces every other top-level field whole**, arrays included | `BE services/bakerySettingsService.js` |
| The frontend settings model's constructor destructures a fixed list of fields; **a field not listed there is dropped** | `FE models/BakerySettings.js:96` |
| Ingredient categories are created from the UI by `settingsStore.patch('default', { ingredientCategories: [...existing, new] })` | `FE components/recipes/IngredientCreateCard.vue:151` |
| `BaseService(resource, basePath)` builds `${basePath}/${resource}`; a resource with a slash (`'accounting/records'`) works. Stores come from `createResourceStore(name, serviceInstance)` and are built at module load with `getBakeryId.value` | `FE services/base/resourceService.js`, `FE stores/providerStore.js` |
| `bakerySettingsStore` already exposes `isAccountingEnabled`, `isInventoryEnabled`, `isEinvoicingEnabled` | `FE stores/bakerySettingsStore.js:61-71` |
| Routes carry `meta: { requiresFeature: 'inventory' }` (on the inventory layout); the accounting dashboard lives at `/accounting` with `allowedRoles` including `accounting_assistant` | `FE router/index.js:105-108, 319-325` |
| `ModulesSection.vue` describes the Contabilidad card with the retired words "Costos fijos, gastos, otros ingresos y estado de resultados" | `FE components/settings/ModulesSection.vue:31` |
| Existing sidebar sections are built in a `navigationSections` computed; the Inventario section is gated by `settingsStore.isInventoryEnabled` | `FE components/layouts/AdminSidebar.vue:143`, `AccountingSidebar.vue` |

**To verify when you reach the phase** (do not assume): how `FE stores/base/resourceStore.js` handles listeners and filters; whether any store reads Firestore directly (this decides whether rules are needed); the shape `orderService.getIncomeStatement(bakeryId, query)` takes and returns (`BE services/orderService.js:614`, route `orderRoutes.js:22`, caller `FE views/reports/IncomeStatement.vue`); how `PurchaseDoc.vue` and `purchaseService` behave with inventory off.

## 3. Conventions

- **Language.** Code, ids, enums and stored data are English (`rent`, `payroll`, `expense`, `investment`). Spanish is UI copy only. Category *names* are user-facing data and are Spanish.
- **Money is whole pesos.** Every amount and tax field is an integer; the backend rejects a fraction (`Number.isInteger`). Amounts are IVA-inclusive.
- **Dates.** `date` is sent as `YYYY-MM-DD` (the local day, not UTC) and stored as a `Date`. `period` is `YYYY-MM` and is sent explicitly; the server also derives it from `date` when absent.
- **Errors** are Spanish messages through `BadRequestError` (400) / `NotFoundError`.
- **Comments** state the current rule only. No "used to be…" narration.
- **Vue files:** `<script setup>` first, then `<template>`, then `<style scoped>`. PascalCase components.
- **UI:** `ui-*` classes for color and shape, Tailwind for arrangement only. No Tailwind color classes in new views. No one-off CSS classes named after a screen; compose existing `ui-*` classes or add a general one and put it in the `/system-admin/ux` gallery in the same change. One `ui-btn-solid` per form footer; Cancelar is `ui-btn-danger` outline.
- **Do not edit** `IncomeStatement.vue`, any other older Tailwind view, `tailwind.config.js`, `custom-components.css`, `custom-base.css`.
- **Feature flag gates doors, never backend logic.** No `features.accounting.enabled` check anywhere in `BE`.
- **Terms:** *registro* (not "entry"/"asiento"), *gasto*, *Compra de insumos*, *costo de ventas*, *ingresos*, *Inversión*. Never "compras" alone, never "Ingreso" for stock, never "costo fijo".

---

## 4. Phase A: categories

**Goal:** `BakerySettings` carries `expenseCategories` and `revenueCategories` with seeded defaults; the owner can add, rename, disable and set a PUC code.

### Backend
Edit `BE models/BakerySettings.js`:
- New class `AccountingCategory`: `{ id = generateId(), name, description = '', displayOrder = 0, isActive = true, pucCode = '', isInvestment = false }` with `toPlainObject()` like `IngredientCategory`. Export it.
- Static `DEFAULT_EXPENSE_CATEGORIES` and `DEFAULT_REVENUE_CATEGORIES` (English slug ids, Spanish names, `displayOrder` = index):

| id | name | isInvestment |
|---|---|---|
| `rent` | Arriendo | no |
| `payroll` | Nómina | no |
| `utilities` | Servicios públicos | no |
| `transport` | Transporte y domicilios | no |
| `maintenance` | Mantenimiento y reparaciones | no |
| `cleaning` | Aseo y cafetería | no |
| `stationery` | Papelería | no |
| `packaging` | Empaques | no |
| `advertising` | Publicidad | no |
| `fees` | Honorarios | no |
| `legal` | Gastos legales | no |
| `taxes` | Impuestos | no |
| `other-expenses` | Otros gastos | no |
| `machinery` | Maquinaria y equipo | **yes** |
| `furniture` | Muebles y enseres | **yes** |

Revenue: `events` Eventos, `rentals` Alquileres, `other-income` Otros ingresos.
- Constructor takes `expenseCategories` and `revenueCategories` with **no default**; when `undefined` use the defaults (so existing businesses get them on read, with no migration). `[]` explicitly stays empty. Map each to `AccountingCategory`.
- `toFirestore()` adds both arrays as plain objects. Add `getExpenseCategory(id)` and `getRevenueCategory(id)`.
- Reserved id: `ingredients` (the frontend decoy). It must never be a stored category id.

Edit `BE services/bakerySettingsService.js` `patch`: when `data.expenseCategories` / `data.revenueCategories` is present, validate and normalize:
- each item has a string `id` and non-empty `name`; ids unique; none equals `ingredients`;
- **no existing id may be missing** (categories are disabled, never deleted): 400 "Las categorías no se eliminan; desactívalas";
- `isInvestment` of an existing category may not change; investment only exists in `expenseCategories`;
- `pucCode` is empty or 1 to 10 digits;
- new items without an id get `generateId()`.

### Frontend
- Edit `FE models/BakerySettings.js`: add `expenseCategories` and `revenueCategories` to the constructor and keep them as plain arrays (fallback `[]`). Read the model's serialization first.
- New `FE components/settings/AccountingCategoriesSection.vue`: two lists ("Gastos", "Ingresos"). Each row: name, `pucCode` input, active toggle, an "Inversión" mark when `isInvestment`. "Agregar categoría": name, and for gastos a choice Gasto/Inversión. Every change patches the whole array with `settingsStore.patch('default', { expenseCategories })` (the `IngredientCategory` pattern), then toasts. Disabled categories stay listed.
- Edit `FE views/bakerySettings/ShowBakerySettings.vue`: mount the section only when `settingsStore.isAccountingEnabled`. Read the whole template first; the features form has its own save button and dirty guard, and this section must not interfere with it.
- Edit `FE components/settings/ModulesSection.vue:31`: description becomes "Gastos, facturas de proveedores y estado de resultados (P&G)."

### Tests (ask before running)
Backend: defaults seeded when absent; explicit `[]` kept; patch rejects a dropped id, a duplicate id, `ingredients`, a bad `pucCode`, a changed `isInvestment`. Frontend: the section renders both lists and sends the whole array.

### Done when
1. `GET /bakeries/:id/settings/default` for an existing business returns both arrays with the defaults.
2. In Settings (accounting on) you can add "Seguros", rename it, set a PUC code, disable it, and it persists after reload.
3. A request that drops a category is refused.
4. With accounting off the section is not on the screen.

---

## 5. Phase B: records and Nuevo gasto

**Goal:** a person can enter a gasto and see it in the month list.

### Backend
New `BE models/AccountingRecord.js` extending `BaseModel` (follow `Purchase.js` for the date field):

```
type: 'expense' | 'revenue'                       required
period: 'YYYY-MM'                                  required (derive from date if absent)
date: Date                                         required
amount: integer > 0                                required, IVA-inclusive
ivaAmount, retefuente, reteica, reteiva: integer >= 0, each <= amount, default 0
categoryId: string                                 required
categoryName: string                               server-owned snapshot
isInvestment: boolean                              server-owned snapshot
description: string, default ''
paymentMethod: string, default 'transfer'
providerId: string | null                          expense only
counterparty: string, default ''
invoiceRef: string, default ''
receivedInvoiceId: string | null
templateId: string | null
notes: string, default ''
lastEditedBy, isDeleted (false), createdAt, updatedAt
```

`validate()` (throws `BadRequestError`, Spanish): type valid; period matches `/^\d{4}-(0[1-9]|1[0-2])$/`; date valid; amount and tax fields integers with the limits above; `categoryId` present; a `revenue` record has no `providerId` and `isInvestment` false; a record with `invoiceRef` has a `providerId`; if `templateId` is set the `id` equals `${templateId}_${period}`.

New `BE services/accountingRecordService.js`: `createBaseService('accountingRecords', AccountingRecord, 'bakeries/{bakeryId}')`, then wrap `create` and `update`/`patch`:
- **Resolve the category on the server.** Load `settingsService.getById('default', bakeryId)`; for `expense` look in `expenseCategories`, for `revenue` in `revenueCategories`. 400 if the id is missing, inactive, or equals `ingredients`. Set `categoryName` and `isInvestment` from the stored category; ignore the client's values.
- If `providerId` is set, check the provider exists and is not deleted.
- **Duplicate invoice:** when `invoiceRef` is non-empty, refuse (400 "Esta factura ya está registrada") if a non-deleted record exists with the same `providerId`, `invoiceRef` and `categoryId` (two equality filters, no composite index needed).
- **Idempotent template confirmation:** if `templateId` is set and the doc with that id exists and is not deleted, return it unchanged. If it exists but is deleted, overwrite it.
- Run `new AccountingRecord(...).validate()` before writing.

New `BE services/accountingService.js` with `getMonth(bakeryId, period)`:
- read `accountingRecords` with `where('period','==',period)` only, then filter `isDeleted` in memory and sort by `date` desc (no composite index);
- return `{ period, records, pendingTemplates: [], totals: { expense, investment, revenue } }` where `expense` excludes `isInvestment`, and `investment` sums the investment ones. Totals are integers.

New controllers: `BE controllers/accountingRecordController.js` (`createBaseController(service, validateRecord)`, where `validateRecord` mirrors the model checks that need no database) and `controllers/accountingController.js` (`getMonth`, validates `period`).

New `BE routes/accountingRoutes.js`, same shape as `providerRoutes.js`, every route with `requireBakeryBilling`:

```
GET    /accounting/months/:period
GET    /accounting/records           POST /accounting/records
GET    /accounting/records/:id       PATCH /accounting/records/:id     DELETE /accounting/records/:id
```
Mount in `BE index.js` next to `einvoiceRoutes`.

Firestore rules: first check whether any frontend store listens to these collections directly. If not, no rule is needed (default deny). If yes, mirror the rule used for `providers`.

### Frontend
- New `FE services/accountingRecordService.js` (`extends BaseService`, `super('accounting/records', '/bakeries/${bakeryId}')`) and `FE services/accountingService.js` (`getMonth(period)` → `GET ${basePath}/accounting/months/${period}`).
- New `FE stores/accountingRecordStore.js` (`createResourceStore('accountingRecords', service)`) and `FE stores/accountingStore.js` (a setup store: `period` as `YYYY-MM` defaulting to the current local month, `records`, `pendingTemplates`, `totals`, `loading`, `error`; actions `loadMonth`, `stepMonth(±1)`).
- New `FE components/accounting/RecordForm.vue`, opened from Resumen in a dialog like the existing dialogs. Fields in this order: **Categoría** (a picker from `expenseCategories`, active only; investment categories under an "Inversión" group; plus the decoy row "Ingredientes y materia prima"), **Monto** (`UiMoneyInput`), **Descripción**, **Fecha** (defaults to today, local), **Pertenece a** (the viewed month, changeable), **Proveedor** (optional; created inline through `providerStore`), **Pago** (`UiPills` with `paymentIconMap`, from the business's `activePaymentMethods` without `complimentary`), a collapsed **Impuestos** group (`ivaAmount`, `retefuente`, `reteica`, `reteiva`), and **N.º de factura** (shown once a provider is chosen). Picking the decoy shows "Los insumos que van en tus recetas se registran en Compra de insumos para que entren al inventario y al costo de ventas." with a link to that screen, and disables Guardar. Footer: one `ui-btn-solid` "Guardar gasto", and Cancelar as danger outline. Map server errors to the field or a toast. "Repetir" on a list row opens the form prefilled from that record.
- New `FE views/accounting/ResumenView.vue` (the shell): `PageHeader`, a ‹ month › stepper bound to `accountingStore.period` (do **not** use `PeriodSelector.vue` or `periodStore`), the totals strip (gastos, inversiones, otros ingresos), the month's records as a plain `ui-*` list (date, category, description, provider, amount; investment rows marked), and **+ Nuevo gasto**. Empty state: "No hay gastos registrados este mes." Delete a row with a confirm.
- Edit `FE router/index.js`: under the dashboard, `accounting` with `meta: { requiresFeature: 'accounting' }` → Resumen at `/dashboard/accounting`; and the same view under the `/accounting` dashboard at `/accounting/resumen` (for the accounting role). Check that `requiresFeature` resolves `'accounting'`; if the guard only knows inventory, extend it.
- Edit `FE components/layouts/AdminSidebar.vue` and `AccountingSidebar.vue`: a "Contabilidad" section behind `settingsStore.isAccountingEnabled`, with Resumen only for now. Icons from `@phosphor-icons/vue`.

### Tests (ask before running)
Backend: model validation matrix (fractions, bad period, `invoiceRef` without provider, revenue with provider, tax > amount); category resolution and snapshot; reserved `ingredients`; duplicate invoice; template-born idempotency; `getMonth` ordering, soft-deleted exclusion and totals; route guard (a non-billing role gets 403). Frontend: the form blocks the decoy, sends integers, repeats a record.

### Done when
1. In the UI you enter a gasto in under ten seconds and it appears in the month; it is gone after delete.
2. An investment (an oven) appears in the list but not in the gastos total.
3. Picking "Ingredientes y materia prima" cannot be saved.
4. Entering the same provider and invoice number twice is refused.
5. With accounting off the section is not on the screen and the route redirects.

---

## 6. Phase C: templates and Resumen

**Goal:** recurring gastos appear as pending each month and confirm in one tap.

### Backend
- New `BE models/AccountingTemplate.js`: `type` ('expense' | 'revenue'), `name` (required), `categoryId`, `categoryName` (server snapshot), `providerId` (null), `defaultAmount` (integer > 0), `defaultIvaAmount` (integer ≥ 0, default 0), `paymentMethod` ('transfer'), `dayOfMonth` (null or 1 to 31), `isActive` (true), `notes`, `isDeleted`, `createdAt`, `updatedAt`.
- New `services/accountingTemplateService.js` (factory, with the same category resolution as records) and `controllers/accountingTemplateController.js`.
- Edit `accountingService.getMonth`: also read active, non-deleted templates; `pendingTemplates` = templates with **no non-deleted record whose id is `${template.id}_${period}`**. Soft-deleted records do not count as confirmed.
- New `accountingService.confirmTemplate(bakeryId, period, templateId, overrides, editor)`: build the record from the template (type, category, provider, amount, IVA, payment method, description = template name, `templateId`, `period`, `date` = today, id `${templateId}_${period}`), apply optional overrides `{ amount, ivaAmount, date, notes }` (integers), and create it through the record service (so the idempotency and validation rules apply).
- Routes (all `requireBakeryBilling`):

```
GET/POST   /accounting/templates          GET/PATCH/DELETE /accounting/templates/:id
POST       /accounting/months/:period/templates/:templateId/confirm
```

### Frontend
- New service and store for templates (`'accounting/templates'`, same pattern).
- Edit `ResumenView.vue`: a **Por confirmar** block above the list, via `components/accounting/PendingTemplates.vue`. Each row: name, category, amount, an "editar" that turns the amount into a `UiMoneyInput`, and a confirm button. Confirming calls the confirm endpoint and reloads the month. A **warning line** under the totals when pending templates remain: "N gastos recurrentes sin confirmar".
- New `views/accounting/RecurringExpensesView.vue` (list of templates: name, category, amount, day, active toggle, edit, delete) and `components/accounting/TemplateForm.vue` (dialog). Route `/dashboard/accounting/recurrentes` and `/accounting/recurrentes`; a "Gastos recurrentes" item in both sidebars.

### Tests (ask first)
Backend: pending computation across months; a soft-deleted record reappears as pending; confirm twice returns the same record; confirm with an amount override; inactive/deleted templates never pending. Frontend: confirm flow and the warning line.

### Done when
1. Creating "Arriendo local, 2.500.000" makes it pending in the current and next month.
2. One tap confirms it and it moves into the list; a second tap changes nothing.
3. Editing the template amount does not alter the confirmed record.
4. Deleting the confirmed record makes it pending again.

---

## 7. Phase D: P&G

**Goal:** a new view showing ingresos − costo de ventas − gastos = utilidad neta by month.

**Before writing any code**, read `orderService.getIncomeStatement` (`BE services/orderService.js:614`, ~260 lines), its route and its tests (`BE __tests__/services/orderService.incomeStatement.test.js`), and answer in writing: (a) the exact input query and output shape, (b) whether an annulled invoice (a credit note) still counts as revenue. Report both before continuing. If (b) is yes, stop and ask: this is open question 12.

### Backend
- Edit `accountingService`: `getIncomeStatement(bakeryId, { from, to })` with `from`/`to` as `YYYY-MM`, `to` ≥ `from`, at most 24 months. It **calls `orderService.getIncomeStatement`** for the order side (grouped by month; convert the months to a date range) and reads records with `where('period','>=',from).where('period','<=',to)`, filtering `isDeleted` in memory.
- Output per month and for the whole range:

```
{ period, orders: { revenue, cogs, grossProfit, ...whatever the order side returns },
  otherRevenue: { total, byCategory: [{ categoryId, name, pucCode, total }] },
  expenses: { total, byCategory: [...] },     // investment excluded
  investments: { total },                     // memo
  purchasesTotal,                             // memo: sum of purchases with date in the month
  netProfit, netMarginPct,
  warnings: { pendingTemplates: n } }
```
`netProfit = orders.grossProfit + otherRevenue.total − expenses.total`. Investments and purchases are memo lines. Do not subtract either.
- Route `GET /accounting/income_statement?from=&to=` with `requireBakeryBilling`.
- Do not touch the old `/orders/income_statement` route.

### Frontend
- New `views/accounting/PygView.vue` (new `ui-*` view): months as columns, rows as in the doc: Ingresos (ventas + domicilios, otros ingresos), Costo de ventas, Utilidad bruta, Gastos by category (with the `pucCode` beside each), Utilidad neta and margin; below, the memo block "Compras del mes" and "Inversiones del mes". A warnings line when `pendingTemplates > 0`. A range control for months (from/to), default the last 6 months. Extend `accountingStore` with `loadStatement`.
- Routes `/dashboard/accounting/pyg` and `/accounting/pyg`; "P&G" item in both sidebars; a "Ver P&G" link from the Resumen totals strip.

### Tests (ask first)
Backend: a fixture with one order month and records: net profit arithmetic, investment excluded, category grouping, empty months, range validation. Frontend: the table renders the memo rows outside the net profit.

### Done when
For a real MAD month the P&G shows the order side from `getIncomeStatement`, the entered gastos grouped by category, and a utilidad neta equal to gross profit minus gastos; an oven entered as Inversión changes nothing in the net.

---

## 8. Phase E: shared providers and the purchase door

**Goal:** providers carry fiscal data; Compra de insumos is reachable and complete from accounting.

**Before coding, verify** (open question 13): read `FE views/inventory/PurchaseDoc.vue`, `FE services/purchaseService.js`, `BE services/purchaseService.js` and the inventory layout. Report whether the purchase form works with inventory off (stock lookups, warehouse picker, `enabledAt`) and what must be guarded.

### Backend
- Edit `BE models/Provider.js`: add `documentType` ('NIT' | 'CC' | 'CE', default 'NIT'), `email` (null), `defaultDestination` (null or `{ kind: 'insumo' | 'expense' | 'investment', categoryId? }`). Normalize `nationalId` to digits only, without a check digit.
- Edit `BE controllers/providerController.js` validation: name required; `documentType` in the list; `email` a valid address when present; `defaultDestination.kind` valid; `categoryId` required for `expense` and must be an active expense category, forbidden for the other kinds (check in the service, which can read settings).
- Edit `BE services/providerService.js`: **uniqueness** of (`documentType`, `nationalId`) among non-deleted providers when `nationalId` is set (400 "Ya existe un proveedor con ese documento"); exclude the provider's own id on update.
- Edit `BE models/Purchase.js` and `BE services/purchaseService.js`: add `ivaAmount`, `retefuente`, `reteica`, `reteiva` (integers ≥ 0), `invoiceRef` (string), `receivedInvoiceId` (null). Include them in `requestFingerprint`. When `invoiceRef` is set, refuse a second non-deleted purchase with the same `providerId` and `invoiceRef`.
- Check how existing providers without the new fields read (defaults only; no migration).

### Frontend
- New `views/providers/ShowProviders.vue` (a `ui-*` list) and `components/forms/ProviderForm.vue` (dialog): name, tipo de documento, número, email, teléfono, destino por defecto (Insumo / Gasto + categoría / Inversión). Route `/dashboard/providers` (also under `/accounting`), shown when any of the three modules is on.
- Edit `components/layouts/AdminSidebar.vue`: "Proveedores" in the Usuarios section behind `isInventoryEnabled || isAccountingEnabled || isEinvoicingEnabled`; **rename the Ingreso link to "Compra de insumos"** and show it once: in Contabilidad when `isAccountingEnabled`, otherwise in Inventario. Add the Compra de insumos item to `AccountingSidebar.vue` too.
- Make `PurchaseDoc.vue` reachable without inventory: either an accounting route (`/dashboard/accounting/compra-de-insumos`) that mounts it outside `InventoryLayout`, or a feature-meta that accepts either module. Decide after the verification above and tell the user. Keep the existing `/dashboard/inventory/ingreso` path working.
- Edit `PurchaseDoc.vue`: retitle "Compra de insumos"; when `isAccountingEnabled`, show a collapsed **Impuestos** group and **N.º de factura**; hide stock-only parts when `!isInventoryEnabled`.
- Edit `providerService.js`/`providerStore.js` only if the new endpoints need it.
- Rename other visible "Ingreso" labels for this screen; leave `inventory/ui/README.md`, `BROWSER-CHECKS.md` and the prototype alone.

### Tests (ask first)
Backend: provider uniqueness (create, update, self-exclusion, different type allowed); validation of `defaultDestination`; purchase tax fields and duplicate invoice; the fingerprint changes with the new fields. Frontend: the sidebar shows Compra de insumos once in each module combination (inventory only, accounting only, both).

### Done when
1. Two providers with the same NIT cannot be created.
2. A provider with default destination "insumo" or "gasto: Mantenimiento" saves and reloads.
3. A business with accounting only opens Compra de insumos from Contabilidad and records a purchase with IVA and an invoice number.
4. A business with inventory only sees the same screen under Inventario, unchanged.

---

## 9. Phases F to J (outline only)

Read ACCOUNTING-IMPLEMENTATION.md §15 and §16 before any of these. Do not start without a fresh instruction.

- **F, Facturas recibidas.** Spike first: collect 5 real supplier emails, read the attachments, and report how the XML can be read and how the mail should arrive (open question 15). Then: `receivedInvoices` model; destinations per line (`insumo | expense category | investment | ignore`), defaulted from `provider.defaultDestination`; a review queue for lines it cannot place; confirming creates one purchase (the insumo lines) and one record per category, each with `providerId`, `invoiceRef`, `receivedInvoiceId`; dedupe on (`providerId`, `invoiceRef`); DIAN event emails ignored; credit notes handled as corrections.
- **G, Documento soporte.** Read `BE services/dian/CLAUDE.md` and README first. An einvoice kind with an optional `source: { type: 'purchase' | 'accountingRecord', id }`; provider `address` and `issuesEinvoice` fields; the shortcut from a record. Needs the user to have requested the DIAN test set.
- **H, other revenue.** UI only: revenue mode in `RecordForm.vue`, using `counterparty`, never `providerId`. Anything sold to a customer is an order, not a revenue record.
- **I, export.** The P&G as CSV/Excel with `pucCode` beside each category; optional derived journal (debit = `pucCode`, credit from `paymentMethod`).
- **J, period close.** `closedPeriods/{period}` snapshot of the statement; later edits to that month flag drift.

---

## 10. Open questions and what you build meanwhile

Use the working default. Do not wait for an answer, and do not invent one. The full table, with what changes if the answer differs, is in [HANDOFF.md](HANDOFF.md) §7. In short:

| # | Question | You build |
|---|---|---|
| 1 | Does the accountant need the balance sheet or the journal? | P&G only; single-sided records |
| 2 | Default categories and PUC codes | The §4 defaults; `pucCode` blank |
| 3 | Packaging: inventory/cost or gasto | `packaging` is a gasto category |
| 4 | Cleaning and maintenance as class 5 or 7 | `pucCode` only; the P&G ignores it |
| 5 | Costo de ventas for accounting-only clients | Recipe cost, through `getIncomeStatement` |
| 6 | Waste in the P&G | Not included |
| 7 | Non-deductible invoices, non-expense money | Nothing in A to E |
| 8 | DIAN receipt events | Ignored |
| 9 | Payroll obligations | `payroll` category and a template; no module |
| 10 | Other Alegra functions | Nothing |
| 11 | Who may write records | `requireBakeryBilling` |
| 12 | Credit note effect on revenue | Checked: the old report ignores `einvoice.annulled`. The new P&G excludes annulled orders; do not edit the old route |
| 16 | Which date assigns an order's revenue to a month; do unpaid orders count | Order date, paid orders only (today's behaviour); unpaid not counted |
| 13 | Compra de insumos with inventory off | **You verify, before phase E** |
| 14 | DIAN test set for documento soporte | The user's task |
| 15 | Mail transport and attachment parsing | **Spike before phase F** |

## 11. Definition of done for the whole epic through E

A and B are the minimum for a first look. After E: a business with only accounting records gastos, confirms its rent, reads a P&G and a month of purchases with taxes; a business with both modules also keeps stock; a business with neither sees no trace of any of it.
