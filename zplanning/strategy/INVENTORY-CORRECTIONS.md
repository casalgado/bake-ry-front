# Inventory — Corrections & Amendments

Amendments to [INVENTORY-IMPLEMENTATION.md](./INVENTORY-IMPLEMENTATION.md) and
[INVENTORY-PLAN.md](./INVENTORY-PLAN.md), decided after the UX pass
(`zplanning/inventory-ux-plan.md`) and **after phases 0 / 1A / 1B (+ the 1C.5
stock view) were already implemented in the backend**. This doc therefore
speaks in terms of changes to existing files, not greenfield design.

**Why now:** the ledger is empty in production (no `stocks` / `stockMovements`
docs exist yet, phase 2 deduction is not built). Movements are append-only —
their schema is the one thing that cannot be retrofitted later. Every
correction below is cheap today and expensive after the first real movement is
written. **All of §1–§3 must land before phase 2 starts.**

Current backend anchors (all in `functions/src`):

- `services/stockService.js` — `buildItemKey`, `writeMovements`, `syncStockDoc`,
  `syncProductStockDocs`, `syncIngredientStockDoc`, `getStocks`,
  `getItemMovements`, `getOrderMovements`, `adjust`, `MOVEMENT_TYPES`.
- `controllers/stockController.js`, `routes/stockRoutes.js`.
- Frontend already built against it: `src/views/inventory/ShowStock.vue`,
  `src/components/inventory/StockMovementsModal.vue`, `src/stores/stockStore.js`,
  `src/services/stockService.js`.

---

## 1. Warehouses (bodegas) — the ledger gains a location dimension

**Naming convention (applies to this whole epic):** code and stored data are
English — `warehouseId`, `features.inventory.warehouses`, `sourceWarehouseId`,
movement `reason: 'damaged'`. **"Bodega" is a UI word only**, and lives in
frontend copy. Same rule as every other enum in the codebase.

**Decision:** stock is held per **(item, warehouse)**. A warehouse is a named
location, nothing more — no types, no hierarchy, no per-warehouse pricing,
permissions, or reports (those turn "location" into "branch"; explicitly out
until a client asks — the `warehouseId` tag on movements preserves the data to
build them later).

Rejected alternatives, for the record:

- *Single stocks doc per item with a `byWarehouse` map* — per-warehouse count
  baselines (`baselineQty`/`baselineAt` per warehouse) inside one doc turn every
  count completion into a map-surgery write; two docs are simpler than one
  clever one.
- *Defer warehouses, tag movements only* — viable (the cache is rebuildable from
  the ledger by design), but only saves work if warehouses never ship; since some
  clients do have multiple locations, deferring buys double churn on
  `stockService` and the frontend.

**UX rule (unchanged from the UX plan):** a bakery with exactly one warehouse
(auto-provisioned default) sees **zero** warehouse UI — no pickers, no columns,
no transfer action. Multi-warehouse UI appears only when a second warehouse exists.

### 1.1 Settings

- `BakerySettings.features.inventory` (or a sibling settings field) gains
  `warehouses: [{ id, name, isDefault }]`. On first use, auto-provision
  `{ id: 'main', name: 'Principal', isDefault: true }` so every bakery has one
  without migration.
- Managed in `BakeryFeaturesForm.vue` (frontend): list editor — create,
  rename, mark default; delete only when the warehouse holds no stock.

### 1.2 `stockService.js` changes

- **New id builder** next to `buildItemKey` (invariant 7 applies — one
  function, never hand-built):
  `buildStockDocId(itemKey, warehouseId) → \`${itemKey}__${warehouseId}\``.
  `itemKey` keeps meaning *item identity*; the stocks **doc id** now carries
  the warehouse. `__` is safe — existing ids use single `_`.
- **`StockMovement` gains `warehouseId` (required).** `validateMovement` rejects
  a movement without one; callers pass the default warehouse when the client
  didn't choose. No "optional means main" — explicit always, so the ledger
  never needs interpretation.
- **`writeMovements`:** the delta map keys by `buildStockDocId(itemKey,
  warehouseId)` instead of `itemKey`; the fallback doc-creation path seeds the
  stock doc with `warehouseId`. Deterministic **sale ids stay
  `{orderId}_{orderItemId}_{itemKey}`** — one order line deducts from exactly
  one warehouse, so the id is still unique; the warehouse lives in the movement
  body.
- **`StockDoc` gains `warehouseId`**; `stockDocSeed` includes it. Baselines are
  now naturally per (item, warehouse) — partial counts per warehouse work with no
  extra machinery.
- **`syncStockDoc` / `syncProductStockDocs` / `syncIngredientStockDoc`:**
  create the doc for the **default warehouse** only. Docs for other warehouses are
  born lazily by the first movement that touches them (the `writeMovements`
  fallback already does this — verified, it creates missing docs).
- **New `transfer(bakeryId, itemKey, { qty, fromWarehouseId, toWarehouseId, editor })`:**
  one `writeMovements` call with two movements — `−qty` at origin, `+qty` at
  destination — `type: 'transfer'` (new `MOVEMENT_TYPES.TRANSFER`), sharing a
  generated `refs.transferId`. Append-only invariant untouched.
- **`adjust`** gains `warehouseId` in its payload (defaulting to the default
  warehouse); `getStock` / `getItemMovements` address by stock doc id / accept a
  `warehouseId` filter; `getStocks` returns per-warehouse rows and accepts an
  optional `warehouseId` query param.

### 1.3 Routes / controller

- `stockRoutes.js` / `stockController.js`: thread `warehouseId` through adjust and
  the reads; add `POST /bakeries/:bakeryId/stocks/:itemKey/transfer`.
- Indexes: existing (`itemKey`, `timestamp`) still serves per-item history
  across warehouses; drift verify per (item, warehouse) filters that same query
  client-side (fine at bakery scale — revisit only if verify is ever slow).

### 1.4 Frontend

- `stockStore.js` / `services/stockService.js`: adjust + movements calls carry
  `warehouseId`; new `transfer` method.
- `ShowStock.vue`: rows grouped by item showing the total, expandable into
  per-warehouse rows when >1 warehouse; warehouse filter; **Transferir** action
  (multi-warehouse only).
- `StockMovementsModal.vue`: warehouse column (shown only when >1 warehouse).

### 1.5 Riders on later phases

- **Phase 2 (deduction):** order items carry the source warehouse (§2); expansion
  passes it into every movement. Ingredient deductions use the default warehouse
  (ingredients are single-location for now — multi-location ingredients is a
  UI-only unlock later, the field is already on every movement).
- **Phase 3 (counts):** count doc items gain `warehouseId`; a count session is
  scoped to one warehouse (you physically count one place at a time). Completion
  baselines (item, warehouse) pairs.
- **Phase 4 (purchases):** purchase lines gain a destination `warehouseId`
  (default warehouse when hidden).

---

## 2. Per-line fulfillment source — Bodega vs Producir

**Decision:** the seller chooses per order line whether the item leaves
existing stock or gets produced. This replaces nothing in the deduction
machinery — it selects **which branch** of the §6 expansion applies to that
line.

### 2.1 Order model

- `OrderItem` gains `fulfillmentSource: 'produce' | 'stock'` and, when
  `'stock'` and multi-warehouse, `sourceWarehouseId` (default: the default warehouse).
  Existing orders read as `'produce'` (today's behavior) — no migration.
- Default resolution is a per-bakery setting,
  `features.inventory.orderDefault: 'smart' | 'produce' | 'stock'`:
  - `smart`: due date today/POS → `stock` (when the product holds stock),
    future date → `produce`.
  - `produce`: behaves exactly like today — the safe migration default.
  - `stock`: pure-resale shops.
  The setting only picks the **preselected** value; the toggle is always
  visible on the line showing the resolved choice. Never hidden magic.
- `unit`-mode products are always `'stock'` (toggle hidden); `none`-mode
  products show nothing (silence is the feature, §11.7 — unchanged).

### 2.2 Expansion rule amendment (plan 2.2, `expandOrderItem` — not yet built)

```
product 'none'                        → nothing (unchanged)
product 'unit'                        → −qty at sourceWarehouseId. STOP. (unchanged, now warehouse-aware)
product 'recipe', source 'stock'      → −qty of the sellable unit at sourceWarehouseId. STOP.
                                        (NEW branch — behaves like 'unit' for this line)
product 'recipe', source 'produce'    → resolve recipe, expand components (unchanged;
                                        no fallback, gap markers, depth guard all as designed)
ingredients                           → unchanged (stocked stops, passThrough recurses),
                                        movements at the default warehouse
```

Compensation (§8.6) needs no changes: flipping the toggle or the warehouse on a
line is an item edit → expand new state, diff against existing movements,
write the delta. Deterministic ids unchanged.

### 2.3 Recipe-mode products can hold stock

§5's "recipe products have no stock of their own" is **amended**: a
recipe-mode product may hold finished-goods stock (pan de bono made for the
vitrina *and* made to order).

- `syncProductStockDocs`: the `inventoryMode !== 'unit'` early-return becomes
  `=== 'none'` — `recipe`-mode products get stocks docs for their sellable
  units too. (The `writeMovements` fallback would create them lazily anyway;
  syncing eagerly keeps them visible in the stock view before first movement.)
- **"Producir para stock" extends to products** (amends plan 4.5, which only
  covered stocked intermediates): one compound `writeMovements` call —
  `+N` of the sellable unit at the destination warehouse, `−` its recipe
  components scaled by N, `type: 'production'`, shared `refs.productionId`.
  Same flow, two owners (stocked production ingredient | recipe product).
- Frontend: modal from `ShowStock.vue` — pick item with recipe, quantity,
  destination warehouse → preview movements → confirm.

### 2.4 What does NOT change

- The `affectsStock` predicate (§9) stays the sole trigger, order-level,
  edge-triggered. **Marking items produced in the production views never
  touches stock** (the UX plan's earlier "consume on mark-produced" line is
  superseded by this).
- Production views (`ShowProductionSingleItems` / `ShowProductionGroupedItems`)
  filter out `fulfillmentSource: 'stock'` lines — pure frontend filter,
  nothing to bake.
- Negative stock: allowed, displayed prominently, never blocks (confirms
  §12.4 — an oversold warehouse line is warned about at entry and corrected by a
  count).

---

## 3. Bajas — the `waste` movement type

**Decision:** explicit write-offs (dañado, vencido, perdido) are their own
movement type, not adjustments. `adjustment` = information correction (should
net ~0 over time); `waste` = real value loss (a period cost). The merma report
(§11.9) needs them separated, and an append-only ledger can't be re-tagged —
add the type while the ledger is empty.

- `MOVEMENT_TYPES` gains `WASTE: 'waste'`. Qty always negative (a positive one
  is rejected — a baja is a loss, not an entry); carries
  `reason: 'damaged' | 'expired' | 'lost' | 'other'` plus optional note, and
  `warehouseId` like every movement. The UI renders those four as dañado /
  vencido / perdido / otro (naming convention, §1).
- New endpoint sibling of adjust:
  `POST /bakeries/:bakeryId/stocks/:itemKey/waste` → one `waste` movement via
  `writeMovements` (or the adjust endpoint accepting a type — routes-level
  choice, either is fine; the movement type distinction is what matters).
- **Frontend:** "Registrar baja" row action in `ShowStock.vue` (quantity,
  motivo, warehouse when multi) as a sibling modal of the manual adjustment;
  `StockMovementsModal.vue` renders the type.
- **Count summary upgrade (phase 3):** expected-vs-counted now splits merma
  into **explicada** (Σ `waste` movements since the last baseline) and **no
  explicada** (the residual count difference). Consistently high unexplained
  merma on one ingredient still means waste or an inaccurate recipe — but now
  reported bajas don't pollute that signal.

---

## 4. Suppliers (free text)

Confirmed against §13.5: supplier **entities** belong to no epic until the
balance-sheet phase. Two free-text touchpoints only:

- `purchases.supplier` — already in the phase-4 design, unchanged.
- **New:** optional `Ingredient.preferredSupplier` (free text, one field) —
  "where do I buy this". Shown in `IngredientForm.vue`; pre-fills the supplier
  field of a purchase/registrar-compra entry. Must not grow into an entity.

---

## 5. Sequencing

1. **§1 + §2.1/§2.3 + §3 land before phase 2** — they change the movement
   schema (`warehouseId`), the movement enum (`waste`, `transfer`), the order
   item shape (`fulfillmentSource`), and `syncProductStockDocs`. All are
   near-free while the ledger is empty; none are after it has data. If any
   test movements/stocks docs exist in dev environments, delete them — the
   cache is disposable and prod is empty.
2. **§2.2 is an amendment to plan step 2.2** — `expandOrderItem` is built
   once, already source-aware and warehouse-aware.
3. **§2.3's producir-para-stock flow and §1.5's count/purchase riders** ride
   their existing phases (3 and 4); the transfer action ships with §1.
4. **§4's `preferredSupplier`** is a one-field model touch — anytime, rides
   the next `Ingredient` edit.
