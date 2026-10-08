# Inventory — build plan

Step-by-step trace of milestones 1–4 from
[inventory-next-steps.md](./inventory-next-steps.md) §7. That doc holds the
decisions and the *why*; this one holds the files and the order. If they
disagree, next-steps wins and this file gets fixed.

Written 2026-10-07 against the code as it stood that day.

---

## 0. Before starting a milestone

**Read:** `inventory-next-steps.md` (all of it, ~250 lines), then this
milestone's section. For any screen, `src/assets/ui/CLAUDE.md`.

**House rules** (they override defaults):

- Ask before running any test, every time, including mid-task.
- Never touch git — no commits, branches, worktrees — unless asked.
- Explain diagnosis + diff + blast radius as text, wait for "apply it", then edit.
- Vue SFC order: `<script setup>`, `<template>`, `<style scoped>`.
- Code and stored data in English; Spanish only in UI copy.
- Comments state the current rule, never the history ("used to be X").
- No proactive linting. The dev server is always running.
- Old Tailwind views are not migrated. Where this plan edits one (the kitchen
  lists, the order form), the change is additive and stays in that file's
  existing idiom.

**Repos**

- Backend: `C:\Users\casal\documents\web\back\bake-ry\functions\src`
- Frontend: this repo, `src/`

**Backend `index.js` has uncommitted inbound-email work.** New route files are
mounted with one `app.use("/bakeries", …)` line each, next to `stockRoutes`.
Touch nothing else in that file.

### Conventions every step uses

- **Item identity at the API boundary is `{ type, id, combinationId }`** — the
  shape screens and recipe components already use. The ledger's movement
  descriptor is `{ itemType, ingredientId, productId, combinationId }`
  (`stockService.js` `buildItemKey`). M1.3 adds one converter, `toStockItem`;
  services call it, screens never see the ledger shape. The frontend never
  builds an `itemKey` or a stock-doc id.
- **Hand-entered documents are idempotent through `retryId`** (`stockService.js`,
  exported in M1.3): the client generates `idempotencyKey` when the document
  opens, the service turns it into the document id.
- **Editor** comes from `req.user`, passed down like `adjust` does.
- **Roles:** reads `requireBakeryAssistant`, writes `requireBakeryStaffOrAdmin`,
  same as `stockRoutes.js`. Exceptions are named in the step.
- **Factory trio** to copy: `productCollectionService.js` /
  `productCollectionController.js` / `productCollectionRoutes.js`. The base
  service's `remove` is already a soft delete (`isDeleted: true`).

---

## Milestone 1 — Providers + Ingreso

**Done when:** a purchase confirmed on Ingreso writes one `purchase` movement
per line, the stock rows go up, ticked lines update the ingredient cost (and
recipes re-cost), and picking the provider next time prefills their last basket.

### Backend

**M1.1 Provider entity**
- `models/Provider.js` (extends `BaseModel`): `name` (required, trimmed),
  `nationalId` (optional, NIT), `phone` (optional), `isDeleted`.
- `services/providerService.js`: `createBaseService('providers', Provider,
  'bakeries/{bakeryId}')`.
- `controllers/providerController.js`: factory controller; validator rejects an
  empty name (runs on create/PUT only; the factory's `patch` doesn't validate).
- `routes/providerRoutes.js`: `GET/POST /providers`, `GET/PATCH/DELETE
  /providers/:id`. No PUT. Mounted in `index.js`.

**M1.2 Purchase model** — `models/Purchase.js`
```
{ providerId, date, warehouseId, total, createdBy,
  lines: [{ item: { type, id, combinationId }, itemKey, qty, total, unitCost, updateCost }] }
```
- The client sends `qty` and `total` per line (what the invoice says);
  `unitCost = total / qty` is derived in the model, as the screen derives it.
- Validation: provider exists and isn't deleted; at least one line; `qty > 0`;
  `total >= 0`; a product line must be `inventoryMode: 'unit'` (buying a
  croissant or an untracked product is refused, the same shelf rule
  `PurchaseDoc.vue` applies).

**M1.3 stockService additions**
- `toStockItem({ type, id, combinationId })` → the ledger descriptor. Exported.
- Export `retryId`.

**M1.4 `services/purchaseService.js`** — factory service + overridden `create`.
Resolve the warehouse (`resolveWarehouseId`) first, outside the transaction.
Then one `db.runTransaction`, every read before any write. Same shape as
`ingredientService.update` (`ingredientService.js:31`), which already runs cost
propagation inside a transaction.

1. **Read:** `t.get(purchaseRef)` (id from `retryId(idempotencyKey,
   'purchase')`). Exists → return it, nothing written. Read the provider (exists,
   not deleted) and each line's ingredient/product: validation (product must be
   `'unit'`), `name`/`unit` for the stock doc seed, stored `costPerUnit`.
2. **Read:** `plan = createPlan()`.
   - Cost lines = `updateCost` + `type: 'ingredient'` + no `recipeId` + new cost
     differs from stored (`sameCost`). One ingredient on two lines → the last
     line's cost, walked once.
   - First seed `plan.costOverrides.set('ingredient_<id>', unitCost)` for all of
     them.
   - Then for each: `stage` its `{ costPerUnit, updatedAt }`,
     `recordCostChange` with `{ costPerUnit: { from, to } }`, and
     `planIngredientCostPropagation(t, bakeryId, id, unitCost, { plan })`.
   - Seeding first means a recipe using two purchased ingredients is re-costed
     once, with both new prices.
3. `writeMovements(…, { transaction: t })`: one `purchase` movement per line
   (`+qty`, `unitCost`, `refs: { purchaseId }`, id `${purchaseId}_${index}`). It
   does its own reads, then its own writes.
4. **Write:** `t.set(purchaseRef, …)` with each line's `itemKey`, then
   `applyPlan(t, plan, { editor, reason: 'purchase' })`.

Returns the purchase. All or nothing: a propagation failure fails the purchase.
Preparaciones ignore `updateCost` (their cost comes from their recipe). Resale
products take `updateCost` on `costPrice`, or on the combination's `costPrice`
inside `variations`, only when that cost is `'manual'`; not propagated to
recipes using the product (recipeGraph stops at products). The new cost is the
last price paid, not an average.
- No update or delete of a confirmed purchase: the routes don't exist.
- `getLastPurchase(bakeryId, providerId)`: `purchases` where `providerId ==`,
  `orderBy('date', 'desc')`, `limit(1)` → its lines with `unitCost` and the
  purchase `date`. Needs a composite index `(providerId asc, date desc,
  createdAt desc)` in the backend's `firestore.indexes.json`. The base list
  query (`isDeleted != true` + `createdAt desc`) also needs one per collection,
  for `providers` and `purchases`. All three are in the file;
  `firebase deploy --only firestore:indexes` before production.
- `routes/purchaseRoutes.js`: `POST /purchases`, `GET /purchases`,
  `GET /purchases/:id`. Mount in `index.js`.
- `GET /providers/:id/last-purchase` goes in `providerRoutes.js`, handled by
  `purchaseService.getLastPurchase`.

**M1.5 Drop `preferredSupplier`**
- Backend `models/Ingredient.js` (constructor + field) and
  `seeds/data/ingredients.js`.
- Frontend `src/models/Ingredient.js` and the scope comment at
  `src/components/forms/IngredientForm.vue:15`.

**M1.6 Tests** *(write; ask before running)* —
`__tests__/services/purchaseService.test.js`: one movement per line with
`unitCost` and `refs.purchaseId`; purchase doc + movements atomic (a failing
movement leaves no purchase); same `idempotencyKey` twice → one purchase, one
set of movements; `updateCost` only on flagged lines, and it propagates to a
recipe owner's cost; two ingredients of one recipe in one purchase re-cost that
recipe once, with both prices; a preparación line ignores `updateCost`; the
cost history entry has `reason: 'purchase'`; a `'recipe'` product line is
refused; `getLastPurchase` returns the newest purchase's lines.

### Frontend

**M1.7 Plumbing**
- `src/services/providerService.js` + `src/stores/providerStore.js`
  (`createResourceStore`, like `ingredientStore`), with `getLastPurchase(id)` on
  the service.
- `src/services/purchaseService.js`: `create(payload)` only. No store; the
  screen calls it, then refetches `stockStore` (and `ingredientStore` when a
  cost changed).
- The bakery id is read at module load, like every other store. If that ever
  bites (bakery switching), fix it once in `resourceStore`, not per store.

**M1.8 `inventoryDocsStore.js`** — the ingreso blank doc carries
`providerId: null` and `idempotencyKey: crypto.randomUUID()` in place of
`provider: ''`. A draft restored from localStorage with the old string field
just shows no provider selected.

**M1.9 `PurchaseDoc.vue`**
- **Provider:** first field, a `UiItemPicker` over `providerStore.items` with
  `allow-create`. Create = name only, through `providerStore.create`. Delete the
  "texto libre" note.
- **Basket:** selecting a provider fetches `getLastPurchase` into a price map
  (identity → last unit cost). On a document with no lines it also adds those
  lines with last time's `qty` and `total: null`. Any line whose item has a last
  price shows it as its unit cost, and follows `qty × lastUnitCost` as its total,
  until a total is typed, marked "precio anterior".
  A provider with no history adds nothing.
- **Price flag** (per line, `ui-item-desc`): unit cost vs `lastUnitCost` →
  `antes $3.200 · subió 9%` / `bajó 4%`. No `lastUnitCost` → no flag, never an
  invented one.
- **Right pane:** "Costos que se actualizarán": each ingredient or resale line
  whose unit cost differs from its stored cost gets a checkbox (`updateCost`,
  default ON; unticking stores `false`). Confirmar reads "· actualiza N costos"
  and `ConfirmDialog` lists the changes before sending.
- **Confirmar:** enabled when a provider is set and every line has `qty > 0` and
  a total. Sends `{ providerId, date, warehouseId, idempotencyKey, lines: [{
  item, qty, total, updateCost }] }`. On success: discard the draft, refetch.
  On error: inline error, the draft stays. Copy `ShowStock.vue`'s `submitting` / `formError` pattern. Delete the
  disabled button's ponytail comment and the "todavía no se puede confirmar"
  paragraph.

**M1.10 Verify by hand:** new provider inline → two lines (one a first-time
ingredient) → confirm → both rows go up, the new one appears; tick cost on one
line → that ingredient and its recipes re-cost, the other doesn't; open Ingreso
again, pick the same provider → basket prefills with last prices; double-click
Confirmar → one purchase.

---

## Milestone 2 — Production runs

**Done when:** a run sent from Producción shows in the kitchen list with a
"Vitrina" tag; receiving a line adds the output and consumes its recipe exactly
as the preview said; cancelling a line writes nothing.

### Backend

**M2.1 `recipeGraph.js`** — export `resolveRecipeId`, `normalizeComponent`,
`MAX_DEPTH`. Fix the header comment: deduction is a walk in `stockService` that
runs **before** a transaction, never inside one.

**M2.2 The walk** — `stockService.expandRecipe(bakeryId, item, qty)` →
`{ components: [{ item, qty, name, unit }], gaps: [] }`, the components of the
item's **own** recipe (`resolveRecipeId`, NO fallback; none → gap
`missingRecipe`). Each component resolves as:

```
product 'unit' or 'recipe'          → −qty of its own stock. STOP
product 'none'                      → nothing
ingredient 'stocked'                → −qty. STOP
ingredient 'passThrough' + recipe   → recurse, scaled by qty / yield
ingredient 'passThrough', no recipe → nothing, and not a gap
```
A tracked product used as a component is taken from stock, not re-made (a caja
de 6 consumes six croissants, not their flour). Only the top item walks its own
recipe.
- Plain reads, no transaction (invariant 4). Memoize docs within one call.
- Depth past `MAX_DEPTH` → gap `{ reason: 'depthExceeded' }`, stop that branch.
- Merge results by item, so one component appears once per call.
- `expandRecipe` on an item with no recipe returns no components and one gap.

**M2.3 Model** — `models/ProductionRun.js`, with `ProductionRunLine` in the same
file (the way `OrderItem` lives in `Order.js`). Shapes in next-steps §4.
`status` on the run is derived on every write: `closed` when no line is pending.

**M2.4 `services/productionRunService.js`** — factory service plus:
- `create`: id from `retryId(idempotencyKey, 'run')`; every line's output must
  have somewhere to land — a product not `'none'`, an ingredient `stocked` —
  else 400 naming the item. No movements.
- `preview(bakeryId, { lines, warehouseId })` → per line: `+output` and
  `expandRecipe` components, plus gaps. Writes nothing.
- `receiveLine(bakeryId, runId, lineId, editor)`: read the run and expand the
  line **outside** the transaction. Transaction: re-read the run; line not
  `pending` → return the run unchanged (idempotent). Else `writeMovements` with
  `+plannedQty` of the output and `−` each component, `type: 'production'`,
  `refs: { productionRunId, lineId, receipt }`, ids
  `run_${runId}_${lineId}_${receipt}_${itemKey}` where `receipt` is the line's
  `receiptNo + 1`; then update the line (`received`, `receivedQty`,
  `receivedAt`, `receivedBy`, `receiptNo`) and the run status.
- `undoLine`: a `received` line only (else 400). In the transaction, read the
  receipt's `production` movements (`stockService.getMovementsByRefs`), write
  their opposites as `compensation` (`stockService.reverseMovements`, ids
  `undo_<original id>`), set the line back to `pending`. A receipt from before
  receipts were counted has no `refs.receipt`: matched without it.
- `cancelLine`: pending only → `cancelled`, run status updated. No movements.
- `updateLine`: the planned quantity of a pending line, `PATCH
  /productionRuns/:id/lines/:lineId`. Any other line is refused (400), not
  ignored. Adding a line is another run; there is no whole-run update.

**M2.5 Routes** — `routes/productionRunRoutes.js`: `POST /productionRuns`,
`GET /productionRuns` (filters: `status`, date range for the kitchen),
`GET /productionRuns/:id`, `POST /productionRuns/preview`,
`POST /productionRuns/:id/lines/:lineId/receive`,
`POST /productionRuns/:id/lines/:lineId/cancel`. Mount in `index.js`.
**Role decision at this step:** receive/cancel must include
`production_assistant`. `requireBakeryAssistant` does, but also lets
`delivery_assistant` and `accounting_assistant` in. Ask whether that's
acceptable or whether a narrower check is worth adding.

**M2.6 Tests** *(write; ask before running)* —
`__tests__/services/productionRunService.test.js`, walk cases included: a `'recipe'` product as a component is taken from
stock, not walked; nested preparaciones walk down to stocked ingredients;
pass-through scaled by yield; `passThrough` without recipe deducts nothing and
isn't a gap; missing combination recipe → gap, never the product's recipe;
depth guard; preview writes nothing; receive writes output + components
atomically and exactly what preview returned; receiving twice writes once;
cancelled line writes nothing; a `'none'` output is refused at create; the run
closes when the last line resolves.

### Frontend

**M2.7 Plumbing** — `src/services/productionRunService.js` +
`src/stores/productionRunStore.js` (`createResourceStore`; extra actions
`preview`, `receiveLine`, `cancelLine`, each refetching what it changed).
**Delete** `produce` from `src/services/stockService.js` and
`src/stores/stockStore.js`. Add `idempotencyKey` to the produccion blank doc in
`inventoryDocsStore.js`.

**M2.8 `ProductionDoc.vue`**
- Picker (`catalogItems`, `:94-117`): products in `'none'` or `'recipe'`, never
  `'unit'`; every preparación. Entries that will be switched on carry
  `sub: 'se activará el inventario'`.
- `addLine`: a `'none'` product → `productStore.update(id, { inventoryMode:
  'recipe' })`; a `passThrough` preparación → `ingredientStore.update(id, {
  stockBehavior: 'stocked' })`. Then refetch, same as `onIngredientCreated` in
  `PurchaseDoc.vue`. The backend's update paths create the stocks doc.
- Preview panel under the lines (the comment at `:242-245` marks the spot):
  debounced call to `productionRunStore.preview`, rows `Harina 8.0 kg (hay
  12.4)`, shortfall flagged, gaps listed as "sin receta — no descuenta nada".
  Warns, never blocks.
- **Enviar a producción** replaces Confirmar: creates the run, discards the
  draft. Delete the disabled button's ponytail comment and the "falta POST
  /stocks/produce" paragraph.

**M2.9 Kitchen lists** — `views/orders/ShowProductionSingleItems.vue` and
`ShowProductionGroupedItems.vue` (both dashboards route to them,
`router/index.js:203-209`, `:389-395`).
- Fetch runs for the selected period from `productionRunStore`; map their
  pending and received lines into the same row shape as
  `flattenedOrderItems` (`:32-74`), with `source: 'run'`, `runId`, `lineId`, and
  `status` 0/1 from pending/received. Cancelled lines don't show.
- A **Cliente** column: the customer's name on order rows, "Vitrina" on run
  rows. "Comentarios" stays the order's production comments (`internalNotes`),
  empty on run rows. In the grouped list the column reads "Vitrina" for a run
  group, and for an order group the client's name when it has one client or
  "N clientes" when it has several (distinct by `userId`). A Vitrina / Clientes
  filter sits on the group's `origin`. Run lines form their own groups, never
  merged with order items of the same product, so each group is one or the
  other. Notes aren't shown there; a group spans many orders.
- Estado is the last column in both views; a scoped style fixes its width so
  it doesn't resize when a row toggles to "producido".
- Run lines store `name`, `unit`, `collectionName` at send (like OrderItem's
  productName), so the kitchen renders them without the catalog.
- Live updates: `productionRunStore.subscribeToChanges()`, which needs a
  read-only `productionRuns` rule in `firestore.rules` (deploy it).
- `handleToggleUpdate` (`:167`): run rows → `productionRunStore.receiveLine`;
  un-ticking a received run row is not possible (disabled toggle). Order rows
  keep `orderStore.patchAll`.
- Additive only; no restyling.

**M2.10 Verify by hand:** add an untracked product to Producción → it switches
on, note shown → preview lists components and a shortfall → send → kitchen list
shows it with "Vitrina" → tick it → stock up by planned qty, components down by
exactly the preview → tick is now locked; cancel another line → nothing moves.

---

## Milestone 3 — Orders + availability

**Done when:** disponible shows in Bodega and on each order line; shipping an
order deducts per line; moving it back, deleting it or editing it while shipped
reconciles exactly; nothing else about orders changes.

### Frontend first — one step

**M3.1 `src/models/Order.js` `OrderItem`** carries `fulfillmentSource`
(default `'produce'`) and `sourceWarehouseId` (default `null`) through the
constructor and `toFirestore`. **This lands before anything can create a
`stock` line:** today the frontend model drops both fields, so any order save
from the UI would silently turn a `stock` line back into `produce`.

### Backend

**M3.2 Availability on `GET /stocks`** — `stockService.getStocks` adds
`committed`, `incoming`, `available` to each row; `?itemKeys=a,b` narrows it.
- `committed`: orders with `status in [0, 1]`, not deleted, due within the
  window → each `stock` line → `buildItemKey` of its product/combination, at
  `sourceWarehouseId` or the default warehouse → sum `quantity`.
- `incoming`: `productionRuns` with `status == 'open'` → pending lines →
  `plannedQty` at the run's warehouse.
- **Decision at this step: the forgotten-order window** (comment on the client
  doc). Make it one named constant with a `ponytail:` comment.
- Index: `orders (status, dueDate)` in `firestore.indexes.json`.

**M3.3 Order reconciliation in `stockService`**
- `affectsStock(order) = !order.isDeleted && order.status >= 2`.
- `expandOrder(bakeryId, order)` → desired movements, per line:
  `'none'` product → nothing; `stock` line or `'unit'` product → `−quantity` of
  the product at `sourceWarehouseId` or default; `produce` line on a `'recipe'`
  product → `expandRecipe` at the default warehouse. Plus gaps. Nothing when
  `affectsStock` is false.
- `reconcileOrderStock(bakeryId, orderId)`:
  1. Read the order and run `expandOrder` outside any transaction.
  2. Transaction: re-read the order; `updatedAt` changed → start over (max 3
     tries). Query its movements (`refs.orderId`), net them per
     (`itemKey`, `warehouseId`); delta = desired − existing; write the non-zero
     deltas with `writeMovements(…, { transaction })`, `type: 'sale'` when the
     order has no movements yet, else `'compensation'`; `refs: { orderId }`;
     generated ids.
  3. Gaps: `stockGaps/{orderId}_{orderItemId}` set for each gap and deleted
     for lines that no longer have one, in the same transaction (query the
     order's gap docs among the reads).
- Running it on an unchanged order is an empty diff: no writes. That is the
  idempotency.
- Update the header comment's invariant 5 to say this.

**M3.4 Hooks in `services/orderService.js`** — after each transaction commits,
never inside it:
- `needsReconcile(before, after) = affectsStock(before) !== affectsStock(after)
  || (affectsStock(after) && orderItems changed)`; `before` is `null` on create.
- `create` (`:26`), `update` (`:77`), `patch` (`:130`), `remove` (`:325`): when
  `needsReconcile`, `await reconcileOrderStock(…).catch(log)`. A failure never
  fails the order (invariant 8); the next reconcile of that order fixes it.
- `patchAll` (`:190`): collect the orders that need it from `updateOperations`;
  reconcile each **after** the batch transaction, one by one. Never inside the
  500-op batch.

**M3.5 Drift check** — `stockService.verify(bakeryId)`: per stocks doc,
`baselineQty + Σ movements since baselineAt` vs `currentStock`; report only.
Admin-only `GET /stocks/verify`. A repair, if ever needed, writes an
`adjustment`, never a silent overwrite.

**M3.6 Tests** *(the epic's correctness contract; write from these
descriptions, ask before running)* — `__tests__/services/orderStock.test.js`:
- combo expansion: a `'recipe'` product with a product component plus a `'unit'`
  coke on the same order;
- `stock` line deducts the product, `produce` line deducts its ingredients,
  `'none'` deducts nothing, `'unit'` deducts itself whatever its source;
- 1 → 2 deducts; 0 → 3 deducts; 2 → 3 writes nothing; 2 → 1 reverses exactly;
- ship → back → ship ends at one net deduction;
- quantity edit while shipped writes only the delta; delete while shipped
  reverses; edit before shipping writes nothing;
- a payment / driver / notes patch triggers zero stock reads (spy on the
  service);
- `patchAll` shipping three orders → three independent reconciles;
- reconcile twice on the same state → second writes nothing;
- missing recipe → gap doc, order still saves; recipe added + reconcile → gap
  removed;
- `committed` / `incoming` / `available` math, and an order outside the window
  is not committed.

### Frontend

**M3.7 Bodega** — `ShowStock.vue` rows and the detail pane show disponible next
to existencia; en producción and comprometido in the detail pane. Silent when
both are zero.

**M3.8 Order form** — `OrderLineItem.vue` / `OrderItemsManager.vue`: for a
product not in `'none'`, a two-option toggle **Vitrina / Producir**, plus
"disponible N" from `stockStore` (fetched with `itemKeys` for the order's
products). Default: Vitrina when disponible covers the quantity, else Producir.
`'unit'` products are always Vitrina, no toggle. A shortfall warns, never
blocks. Bodega picker only when multi-warehouse. Additive, in the file's
existing idiom.

**M3.9 Kitchen lists** — order lines with `fulfillmentSource: 'stock'` drop out
of `flattenedOrderItems` in both production views (and
`ShowProductionAssistantOrders.vue` if it lists items).

**M3.10 Verify by hand:** stock 10 pan → pre-order 4 as Vitrina → disponible 6,
existencia 10, the kitchen doesn't see it → mark Enviada → existencia 6 → back
to Producida → 10 → Entregada → 6 → edit to 5 → 5 → delete → 10. A Producir
line for a cake → kitchen sees it with the customer's name → Entregada →
ingredients down, cake stock untouched.

---

## Milestone 4 — Conteo

**Starts with the design conversation the user reserved.** Don't build from
this section.

What any design has to keep: you write what's on the shelf and the system
computes the difference; the expected quantity appears only after entry; an
empty box is "not counted", not zero; a count covers one bodega; partial counts
leave other items' baselines untouched; completion is one transaction that sets
`baselineQty = currentStock = countedQty`, `baselineAt = now`, plus one `count`
movement per item; the summary splits merma **explicada** (Σ `waste` since the
last baseline) from **no explicada**. Backend shape in
`ui/EXISTENCIAS-BUILD.md` §4.3. Role access is decided then.

---

## Open decisions, and the step that resolves each

| Decision | Step |
|---|---|
| Forgotten-order window | M3.2 |
| Who may receive / cancel run lines | M2.5 |
| Editing a sent run's pending lines | after M2, when a screen needs it |
| Received quantity ≠ planned | on hold; until then, the difference is a baja |
| Conteo design | M4 |
| POS orders born Entregada | `mad-td.md`, outside the epic; counter sales don't deduct without it |
