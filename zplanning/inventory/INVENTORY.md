# Inventory

How the inventory epic works and why. This is the one document for it: the
contract, the data, the flows, the screens, the deploy, and what is still open.
The code is the source for detail; this says where to look and which rules must
not break.

Backend: `C:\Users\casal\documents\web\back\bake-ry\functions\src` (called `BE`
below). Frontend: this repo, `src/` (called `FE`). Costing mechanics live in the
backend's `docs/recipe-costing.md`; accepted shortcuts in its `tech-debt.md`.

- **Code and stored data are English** (`warehouse`, `waste`, `damaged`).
  **Spanish is UI copy only** ("bodega", "baja", "dañado").
- Screens use the `ui-*` system: read `src/assets/ui/CLAUDE.md` before touching
  one. The live gallery is `/system-admin/ux`.

---

## 1. The model in one page

### The three numbers (and a fourth, derived)

| Number | Where it lives | Moved by |
|---|---|---|
| **Existencia** | `stocks/{doc}.currentStock`, per (item, bodega) | only the ledger |
| **En producción** (`incoming`) | pending lines of open production runs | sending, receiving, cancelling a run line |
| **Comprometido** (`committed`) | open orders' lines that take from stock | creating, editing, shipping, deleting an order |
| **Disponible** (`available`) | computed on read: `existencia + en producción − comprometido` | never stored |

### Words that mean one thing each

- **Disponible** (order line, `fulfillmentSource: 'stock'`): taken from the shelf.
  Hidden from the kitchen.
- **Producir** (`'produce'`): made for this order. On the kitchen list with the
  customer's name. When the order ships it deducts its recipe's ingredients.
- **Vitrina** (kitchen list only): a production-run line made for the shelf.
- Order statuses: 0 Recibida, 1 Producida, 2 Enviada, 3 Entregada. An order moves
  stock when `!isDeleted && status >= 2` (`affectsStock`, defined once in BE
  `stockService.js`). Payment never touches stock.

### Entities

| Entity | Inventory fields |
|---|---|
| `Product` | `inventoryMode`: `none` (default, untracked, no inventory UI anywhere) · `unit` (resale: bought and sold as is) · `recipe` (made here) |
| `Combination` | `recipeId` (nullable). With variations, the combination is the sellable unit |
| `Ingredient` | `recipeId` (a *preparación*), `stockBehavior`: `passThrough` (default, holds no stock, deduction walks into its recipe) · `stocked` |
| `Recipe` | one owner: a product, a product + combination, or an ingredient. `yield` is required exactly when the owner is an ingredient |
| `RecipeComponent` | `{ type: 'ingredient' \| 'product', id, combinationId?, quantity, unit, notes? }`. Pure structure: no name, no cost |
| `OrderItem` | `fulfillmentSource` (`produce` default, `stock`), `sourceWarehouseId` |
| `Order` | `shippedAt`: when it last became Enviada. Set by the server from the status change; a client value is ignored |
| bakery settings | `features.inventory = { enabled, enabledAt, warehouses: [{ id, name, isDefault }] }` |

Resale is `Product.inventoryMode: 'unit'`, never an ingredient (an order line only
carries a `productId`). There is no `isResale` flag.

### Collections (all under `bakeries/{bakeryId}/`)

`stocks/{itemKey}__{warehouseId}` · `stockMovements/{id}` · `stockGaps/{orderId}_{itemId}`
· `providers` · `purchases` · `productionRuns` · `stockCounts`.

---

## 2. The contract (do not break)

1. **Movements are append-only.** No update or delete path or endpoint. A
   correction is a new movement.
2. **Every movement goes through `writeMovements`** (BE `stockService.js`). The
   only other stocks writes are a doc's first seed (`syncStockDoc`, using
   `create()` so it can't overwrite) and a count setting the baseline of an item
   whose count matched.
3. **Movement and `currentStock` increment land in one transaction**, with one
   cache write per stocks doc.
4. **Reads before writes** in every transaction. Unbounded walks (recipe
   expansion, order expansion, cycle checks) run outside.
5. **Keys come from one place.** `buildItemKey` lives in BE `utils/itemKey.js`;
   `buildStockDocId` in `stockService.js`. The frontend never builds either.
6. **No "already deducted" flags.** Orders are idempotent through a diff against
   their own movements. Hand-entered documents use deterministic ids from a
   client `idempotencyKey` (`retryId`, with a prefix per kind: `adjustment`,
   `waste`, `transfer`, `purchase`, `run`). Purchases and runs also store a
   fingerprint of the request: the same key with different content is refused.
7. **No unit conversions in the ledger.** A quantity is always in the item's own
   unit. Presentation math ("bulto = 25 kg") happens at entry.
8. **Inventory never blocks a sale.** Failures become `stockGaps` entries or a
   logged reconcile failure; stock may go negative and a count corrects it.
9. **`none` items show no inventory UI.** No chips, columns or warnings.
10. **The module switch hides screens; the ledger follows `enabledAt`.** See §4.4.
11. Quantities are rounded (`roundQty`, 1e-6) in `writeMovements`; a quantity must
    be finite, and an adjustment must not be 0.

Movement types: `sale`, `purchase`, `count`, `adjustment`, `production`,
`compensation`, `transfer`, `waste`. Every movement carries `warehouseId`, `qty`
(signed), `type`, `refs` (`orderId`, `purchaseId`, `productionRunId`+`lineId`,
`countId`, `transferId`), `editor`, `timestamp`, optional `unitCost`.

---

## 3. Recipes and costing

- **Owner and resolution.** A product without variations owns its recipe; with
  variations, each combination does. `resolveRecipeId` (BE `recipeGraph.js`) has
  **no fallback**: a combination without a recipe never borrows the product's.
- **An owner has one recipe.** Creating a second for an owner that already has a
  live one is refused. A pointer to a recipe that no longer exists doesn't count.
- **Guardrails at save** (before the transaction): cycle detection, depth cap 5
  (`MAX_DEPTH`), component units must match the component's own unit.
- **Deletion guards.** A recipe in use by a product, a combination or an
  ingredient can't be deleted; neither can an ingredient or product used as a
  component (reverse index `usedInRecipes`). A recipe whose component document is
  gone can still be deleted or edited.
- **Ingredient units.** The unit of an ingredient can't change while it has its
  own recipe, is used in a live recipe, or has any inventory movement (an empty
  stocks doc doesn't count; it follows the new unit).
- **Server-owned fields.** `usedInRecipes`, `recipeId` (also per combination), a
  recipe-sourced `costPrice` and a preparación's `costPerUnit` can't be written
  from a form; a stale form is silently ignored. A cost switched to `manual` is
  taken as sent.
- **Costing is live.** Cost is never stored on a recipe row. `computeRecipeCost`
  sums `quantity × cost` from each component's own doc and one propagation walk
  keeps the owner's cache (`costPrice` / `costPerUnit`) honest, in both
  directions (a recipe changes, or an ingredient's cost changes). It only writes
  where `costPriceSource === 'recipe'`; `manual` is never clobbered.
- **Linking a recipe** sets `costPriceSource: 'recipe'` and the computed cost only
  if the owner is already recipe-sourced or has no cost (0 or blank). A cost typed
  by hand stays `manual` until the user unlocks it.
- **Backstops.** `GET /ingredients/:id/cost-impact` previews a cost change's
  fan-out; `POST /recipes/reconcile-costs` (admin) corrects one owner.
- **Accepted gaps** (`tech-debt.md`): a recipe reached twice in one walk is only
  re-costed on the first hit; a product's cost change doesn't propagate on to
  recipes that use the product.

### The deduction walk (`expandRecipe`, BE `stockService.js`)

The components of an item's **own** recipe; each component resolves as:

| Component | Result |
|---|---|
| product `unit` or `recipe` | its own stock; stop |
| product `none` | nothing |
| ingredient `stocked` | its own stock; stop |
| ingredient `passThrough` with a recipe | recurse, scaled by `qty / yield` |
| ingredient `passThrough`, no recipe | nothing, and not a gap |

A tracked product used as a component comes off its own shelf (a box of 6
consumes six croissants, not their flour). A missing recipe, a missing item or a
depth overflow is a gap, never a block.

---

## 4. Flows

### 4.1 Purchases (Ingreso)

`POST /purchases` runs one transaction: the purchase doc, one `purchase` movement
per line (`+qty`, `unitCost = total / qty`, `refs.purchaseId`, id
`${purchaseId}_${index}`) and the opt-in cost updates. All or nothing. A confirmed
purchase is immutable (no update or delete route).

- A product line must be a `unit` product. A stocks doc is created on a first
  purchase.
- **Cost update** is per line (`updateCost`, on by default). It applies to
  ingredients without a recipe and to resale products or combinations whose cost
  is `manual`; never to a recipe-costed one. The new cost is the last price paid,
  a `$0` line never sets a cost, and one ingredient on two lines takes the last.
  Recipes using the ingredient are re-costed once, with all new prices.
- `GET /providers/:id/last-purchase` returns the provider's newest purchase: the
  screen prefills its basket and flags prices ("antes $3.200 · subió 9%") only
  against a real previous price.
- Screen: provider first (inline create), shelf rule (ingredients without a
  recipe + `unit` products), the draft lives in localStorage with an
  `idempotencyKey` minted when it opens, Confirmar names the cost changes and asks
  once. No tax fields until an accounting screen needs them.

### 4.2 Production runs (Producción)

A run is a server document: `{ date, warehouseId, status: 'open' | 'closed',
lines }`; a line is `pending`, `received` or `cancelled` and carries name, unit
and colección so the kitchen renders without the catalog. Sending writes no
movements.

- **Receive a line:** the recipe is expanded outside the transaction, then one
  transaction writes `+plannedQty` of the output and `−` each component, ids
  `run_${runId}_${lineId}_${receipt}_${itemKey}` (`receipt` counts receipts of
  that line). A line that is no longer pending, or whose quantity changed since
  it was measured, is a no-op or a refusal. Ingredients come off at receipt.
- **Undo:** writes the exact opposite of what the receipt wrote, read from the
  ledger (not rebuilt from the recipe), as `compensation` with ids
  `undo_<movement id>`. A re-receipt writes new movements.
- **Cancel** a pending line (no movements) and **edit** a pending line's planned
  quantity. Adding is another run. The run closes when no line is pending.
- **Preview** (`POST /productionRuns/preview`) runs the same expansion and writes
  nothing, so what the screen shows is what the tick will move.
- The output must have somewhere to land: a product not `none`, an ingredient
  `stocked`. The picker lists `none` and `recipe` products (never `unit`) and every
  preparación; adding an untracked product switches it to `recipe`, a
  `passThrough` preparación to `stocked`.
- **Received ≠ planned** is not supported: the difference is a baja.
- Screen: left is the document, right is what you are making with the live
  consumption preview (shortfall flagged, never blocking), batches ("2 lotes")
  for anything with a yield, and "Repetir la producción del {fecha}", which adds
  the lines of the last day with runs in the previous 14 days that aren't already
  there. A restored draft dated in the past moves to today.

### 4.3 Orders

One mechanism: `reconcileOrderStock(bakeryId, orderId)`. It expands what the order
should have deducted (nothing when `affectsStock` is false), diffs it against the
net of the order's existing movements (`refs.orderId`) and writes only the delta:
`sale` when the net is zero, `compensation` otherwise. That is shipping, moving
back, editing and deleting, with no flags; running it twice writes nothing.

- Each line decides: a `stock` line, or any `unit` product, deducts the product
  at `sourceWarehouseId` (default bodega if empty); a `produce` line on a `recipe`
  product walks its own recipe; `none` deducts nothing. A line that can't be
  followed becomes `stockGaps/{orderId}_{itemId}` and the order still saves.
- **The gate** is `reconcileIfNeeded` (`orderService.js`). It runs after the order
  commits (never inside a transaction), only when the order crossed
  `affectsStock` or a shipped order's stock signature changed (lines, quantities,
  sources, warehouses), and only when the bakery's inventory has ever been live.
  Payment, driver or note edits do no stock work. `patchAll` reconciles each
  order one at a time after its batch (batches of 100).
- **Pre-tracking guard.** Editing an order that was already shipped, has no
  movements, and shipped before inventory went live (or has no `shippedAt`) does
  nothing: an old order must not deduct everything it ever held.
- **A failed reconcile never fails the order.** It is logged. Repair:
  `GET /stocks/verify-orders?days=14` lists shipped orders (since inventory went
  live, including ones moved back or deleted whose reversal failed) whose
  movements differ from what they should be;
  `POST /stocks/reconcile-orders` brings them in line. Both are admin-only.
- **Availability.** `GET /stocks` returns `committed`, `incoming`, `available` per
  row (`?itemKeys=` narrows). `committed` counts open orders (status 0 or 1, not
  deleted, `dueDate` no more than **10 days** past — `COMMITTED_WINDOW_DAYS`, in BE
  `stockService.js` and exported from FE `services/stockService.js`) whose line
  is `stock` or is a `unit` product. `incoming` is the pending lines of open runs.
  The browser never sums orders.
- **Order form** (`OrderItemsManager.vue`, `OrderLineItem.vue`):
  - `availableFor(item)` is the server figure plus the saved order's own lines
    (`savedLines`), which are only given back while the server holds them: the
    order is shipped, or open and inside the window. One figure per product, the
    same on every line; editing a quantity never moves it. The draft's `stock`
    lines of a product together exceeding it turns them red. It warns, never blocks.
  - Default source on add: resale `stock`; a recipe product `stock` if what the
    draft hasn't already taken covers the quantity, else `produce`. Lines that
    arrive without a source (a repeated order, a duplicate) get the same default.
  - The form listens (`stockStore.watchAvailability()`) to the `stocks`
    collection and the open-orders slice, debounced, started before the first
    load; `resourceStore.fetchAll` ignores out-of-order answers.
- **Kitchen lists.** `stock` lines are hidden. Individual
  (`ShowProductionSingleItems.vue`) lists order lines and Vitrina lines with a
  Cliente column ("Vitrina" for run lines); ticking a Vitrina line, undoing,
  removing and editing its quantity each ask first. Grouped
  (`ShowProductionGroupedItems.vue`) is read-only apart from assigning a batch to
  order lines.
- **Bulk status** is capped at 20 rows on Entrega and the driver table
  (`maxBulk`); the calendar toggle (0 and 1) never moves stock.

### 4.4 The module switch

`features.inventory.enabled` shows or hides the screens (sidebar, routes, the
mode selector in `ProductForm`, the chips in the order form). The backend runs the
ledger from `features.inventory.enabledAt`: `getInventoryStart` sets it the first
time it finds the module on and never clears it. Turning the switch off later
hides the doors and the ledger keeps recording; turning it back on meets no gap.
A bakery that never turned it on stays silent. `enabledAt` is the server's: the
settings update ignores a client value and keeps the stored one, and a patch that
leaves `features.inventory` out leaves inventory as it was. Turning it on for a
real bakery:
do the first count before enabling (or shipping produces negatives), then call
`GET /stocks/verify` after the first day.

### 4.5 Counts (Conteo)

A count is a shared server document several people type into at once; closing it
sets each counted item's baseline to what was on the shelf.

- **Rules.** You type what is on the shelf, never the difference; the expected
  number shows only after a row is entered. An empty box is "not counted", not
  zero, and uncounted items keep their baseline. One bodega per count and one open
  count per bodega (opening joins it). Each row is its own write (`items.<itemKey>`
  in a map), so two people never overwrite each other; the latest number wins and
  the row shows who wrote it. Nothing sells during a count; one open more than
  12 h warns on Revisar. Closing happens only on Revisar. Discard ends the count
  for everyone, moves nothing and stays listed. There is no count date: it is the
  close time. A row is flagged when `|difference| × unit cost ≥ $50.000`
  (`ALERT_VALUE`, `CountReview.vue`); a row with no cost (0 or unresolved) reads
  "sin costo" and isn't flagged. Alerts warn, never block.
- **Close** is `open → closing → closed`. Moving to `closing` stamps `closedAt`
  and stops typing and discarding. The counted items are then closed in chunks of
  200 (`CLOSE_CHUNK`), each its own transaction: per item, a `count` movement for
  `counted − currentStock` (none if it matches; id `count_{countId}_{itemKey}`)
  through `writeMovements`, `baselineQty = counted`, `baselineAt = closedAt`, and
  the row frozen with `expectedQty`, `diffQty`, `unitCost`, `wasteSinceBaseline`.
  Items are independent and ids are deterministic, so a close interrupted in
  `closing` is finished by closing again. The count movement is stamped 1 ms
  before `baselineAt`, because `verify` sums movements at or after the baseline.
- The summary frames merma: bajas already lowered the stock, so the count's whole
  difference is unexplained ("bajas reportadas N + encontrado por el conteo M").
- **Screens.** `/dashboard/inventory/conteos` (`CountList.vue`, refetches when the
  tab regains focus), `/:id` (`CountDoc.vue`: each row saved 400 ms after typing
  stops, Revisar waits for pending saves, a negative is refused with a message),
  `/:id/revisar` (`CountReview.vue`: flagged rows first, close and discard use
  `ConfirmDialog`). The Bodega button opens the open count of the bodega on screen.
- Access: `bakery_admin`, `bakery_staff`, `system_admin`.

### 4.6 Bajas, adjustments, transfers, bodegas

- **Adjust** (`+/−`, required reason, never 0) is an information correction;
  **waste** is a real loss, always negative, reason `damaged | expired | lost |
  other`, kept apart so merma can separate explained from unexplained;
  **transfer** writes two movements (`−` origin, `+` destination) sharing
  `refs.transferId`. All three require an existing stocks doc in the origin bodega.
- **Bodegas.** Stock is held per (item, bodega); the doc id is
  `itemKey__warehouseId`; every movement carries `warehouseId`. Settings default to
  one `{ id: 'main', name: 'Principal', isDefault: true }`. Unknown bodegas are
  refused. With one bodega the UI shows no trace of the concept; a second one
  reveals the filter chips, the per-bodega expander, Transferir and the
  destination pickers (`useWarehouses.multiWarehouse`).

---

## 5. Access

| Action | Roles |
|---|---|
| Read stocks, runs, purchases, providers | any assistant, staff, admin |
| Adjust, waste, transfer; create runs and previews; purchases; providers; counts | `bakery_staff`, `bakery_admin`, `system_admin` |
| Receive, undo, cancel, edit a run line | the above + `production_assistant` (`requireBakeryProduction`) |
| `verify`, `verify-orders`, `reconcile-orders`, `reconcile-costs` | `bakery_admin`, `system_admin` |
| Orders (create, edit, ship) | any assistant (drivers ship) |

Firestore rules: `stocks`, `stockCounts`, `productionRuns` and `orders` are
readable by staff of the bakery and writable only by the API.

### Endpoints (under `/bakeries/:bakeryId`)

- Stocks: `GET /stocks`, `GET /stocks/:itemKey/movements`, `GET /stockMovements?orderId=`,
  `POST /stocks/:itemKey/adjust|waste|transfer`, `GET /stocks/verify`,
  `GET /stocks/verify-orders`, `POST /stocks/reconcile-orders`.
- Providers: `GET/POST /providers`, `GET/PATCH/DELETE /providers/:id`,
  `GET /providers/:id/last-purchase`. Purchases: `POST/GET /purchases`, `GET /purchases/:id`.
- Runs: `GET/POST /productionRuns`, `GET /productionRuns/:id`, `POST /productionRuns/preview`,
  `POST /productionRuns/:id/lines/:lineId/receive|undo|cancel`, `PATCH /productionRuns/:id/lines/:lineId`.
- Counts: `GET/POST /stockCounts`, `GET /stockCounts/:id`,
  `PUT /stockCounts/:id/items/:itemKey`, `POST /stockCounts/:id/close|discard`.
  Errors are 400, except a missing count (404).

---

## 6. Where things are

**Backend:** `services/stockService.js` (ledger, walk, order reconcile, verify),
`services/{purchase,productionRun,stockCount,provider}Service.js`,
`services/recipeGraph.js` (cycles, costing, propagation), `services/recipeService.js`,
`services/{product,ingredient,order}Service.js`, `utils/itemKey.js`,
`models/{Purchase,ProductionRun,StockCount,Provider}.js`, `routes/*Routes.js`,
`firestore.indexes.json`, `firestore.rules`.

**Frontend**

| Screen | Files |
|---|---|
| Bodega (Existencias) | `views/inventory/ShowStock.vue`, `InventoryLayout.vue` |
| Ingreso | `views/inventory/PurchaseDoc.vue` |
| Producción | `views/inventory/ProductionDoc.vue` |
| Conteo | `views/inventory/{CountList,CountDoc,CountReview}.vue` |
| Recetario | `views/recipes/RecipeBookView.vue`, `components/recipes/IngredientCreateCard.vue` |
| Order form | `components/forms/{OrderForm,OrderItemsManager,OrderLineItem}.vue` |
| Kitchen lists | `views/orders/ShowProductionSingleItems.vue`, `ShowProductionGroupedItems.vue` |
| Product mode selector | `components/forms/ProductForm.vue` |

Stores and services: `stockStore` (+ `watchAvailability`), `providerStore`,
`productionRunStore`, `inventoryDocsStore` (Ingreso and Producción drafts, per
bakery, in localStorage), `services/stockCountService.js`. Composables:
`useItemCatalog` (`nameOf`, `costOf`, `kindOf`, `modeOf`; `null` cost means
"unresolved", never `$0`), `useWarehouses`.

---

## 7. Deploy and operations

Deploy in this order; a function deployed before its index is built fails
`GET /stocks`.

1. Composite indexes (`firebase deploy --only firestore:indexes`), including the
   orders `(isDeleted, status, dueDate)`, the purchases `(providerId, date,
   createdAt)` and the movements `(itemKey, timestamp)`. Wait until each shows Enabled.
2. Firestore rules (`stocks`, `stockCounts`, `productionRuns` reads; orders are
   now API-only writes). Before hosting, or the live listeners get permission errors.
3. Functions.
4. Hosting.

Switching a bakery on: first count (Ajustar or Conteo), then the switch, then
`GET /stocks/verify` after the first day; the report must be empty.
`GET /stocks/verify-orders` should be empty too.

Browser checks that still need a person (no test covers the screens):

- **Orders.** Repeat an order for a client with a resale and a recipe product:
  the resale line reads Disponible, the recipe line Disponible only if the stock
  covers it. Duplicar after a hard refresh does the same, and a copy whose stock is
  gone reads Producir. Edit an open order due more than 10 days ago: its Disponible
  figure doesn't include its own lines. Ship two orders quickly: neither
  Existencias nor the order form flickers back to an older figure.
- **Kitchen lists.** An order with only Disponible lines doesn't add its category
  to the filter. A production assistant receives and undoes a Vitrina line; a
  delivery or accounting assistant is refused.
- **Conteo.** Two browsers on one count: rows appear live, the latest number wins,
  a $50.000 row is flagged, `verify` is empty after close, and the closed count
  reopens frozen. Type `-3` in a row: it says so, keeps its saved value and Revisar
  stays until it's fixed. Type and press Revisar at once, then close: the number is
  in the count. Close and discard ask in a dialog (discard names who is counting).
  A count left in `closing` shows the banner on Revisar and "Cerrando" in the list,
  and "Terminar de cerrar" finishes it. The list refetches when you return to the
  tab; with two bodegas the Bodega button opens the open count of the bodega shown.
- **Producción and Ingreso.** "Repetir la producción del {fecha}" shows the last
  day with runs, adds its lines once (pressing it twice adds nothing), and its date
  matches the document's after changing the date quickly. In the evening a new
  document is dated today (local). A recipe-costed resale line on Ingreso offers no
  cost checkbox.

---

## 8. Open and deferred

**Not built**
- A screen to edit an existing ingredient (name, category, unit, storage
  temperature). Ingredients are created in the recetario and their cost edited in
  Existencias; nothing edits the rest.
- The bodega editor in `BakeryFeaturesForm` and a bodega picker on order lines: a
  second bodega is created by editing the settings document.
- Recipe editor extras: choosing between a manual and a computed cost with both
  numbers shown (the lock/unlock switch is the model today); prefilling a scale
  from the option ratio; "apply to all combinations sharing this option".
- Received ≠ planned on a production line.
- A POS screen. A sale born Entregada deducts (the backend handles it); the
  screen doesn't exist.
- A screen for `stockGaps` ("3 ventas sin descargar").
- Per-line context in `ProductionDoc` (what is already scheduled, what is in stock).
- Realtime across browsers for production runs in Existencias.
- A per-keystroke recipe-quantity cost preview endpoint.

**Decisions to make**
- Which roles may record purchases and adjustments (staff and admin today).

**Housekeeping**
- Bring the client guide ("Inventario — Cómo funciona") up to date with counts;
  the open comment about ingredients coming off at receipt is unresolved.
- Optional at go-live: set `fulfillmentSource: 'stock'` on open orders' resale
  lines saved before this existed. They read `produce`; stock is right (a `unit`
  product always counts as committed and deducts itself) but the kitchen lists
  still show them.

**Known limits**
- A shipped order that held only untracked products and is later edited to add a
  tracked one is not deducted for it (a count corrects it).
- `GET /stocks` rereads open orders, runs and resale products every call, `verify`
  reads every movement and `verify-orders` expands every shipped order in the
  window; the `ponytail:` comments name the upgrade for each.
- Customers of a bakery can read its orders through the Firestore SDK
  (`isBakeryStaff` checks only the bakery id); outside this epic.
- Accepted costing gaps in §3.

---

## 9. Decisions worth keeping

- **Recipes anchor to the sellable unit; no fallback.** A base recipe plus a
  scale factor was rejected: proportions aren't linear. Scaling is an entry-time
  assist, never a stored link.
- **Shared preparations are ingredients with a recipe**, not products that aren't
  sold: units come free, nothing leaks into POS or reports, and cost propagation
  already works.
- **Resale is a product mode**, not a second type or flag.
- **An order moves stock when it ships**, not when created or paid: orders are
  edited and cancelled constantly, the ledger is append-only, and a count would
  corrupt it otherwise. Whether it's still sellable is `disponible`, computed.
- **Production runs are their own document**, not orders: an order is a promise
  to a customer with revenue and reports; a run's output is stock, not a sale.
- **Ingredients come off at receipt**, not when baking starts; counts happen at
  closing so the gap doesn't matter.
- **No sharded counters, no per-bodega pricing or permissions, no accounts
  payable, no cross-dimension unit conversions.**
- **Entregada stays toggle-reachable**: the edit form has no status field, so
  locking it would trap orders, and the ledger records both directions.
- **Bulk status is reconciled sequentially**, never in parallel: orders share stocks
  docs and contention could leave one silently unreconciled.
- **Reconcile failures are repaired on demand** (`verify-orders`), not queued: a
  sweep can tell a failed order from an old one only because `shippedAt` exists.
- **The count is one close per chunk**, not one transaction, so the number of
  items doesn't depend on a transaction's write limit.
- **Ingredient spend is never an expense entry.** Inventory and accounting share
  only `costPrice` / `costPerUnit`; the income statement never reads purchases.

---

## 10. Boundary with accounting

The two epics are independent by construction: a business can adopt either, both
or neither, in any order. Five rules keep it that way (mirrored in
`zplanning/accounting/ACCOUNTING-IMPLEMENTATION.md` §13):

1. **The only shared data is `costPrice` / `costPerUnit`.** Accounting consumes
   them (the cost waterfall in the income statement); inventory refreshes them
   (recipe cost propagation). Nothing else crosses. A bakery without inventory
   keeps typing costs by hand and its P&L still works.
2. **The income statement never reads `purchases`; Ingreso never writes
   `accountingEntries`.** A cash view of ingredient spend, if ever wanted, is a
   report over `purchases`, not expense entries.
3. **Ingredient spend is never an expense entry**, whether or not inventory is on:
   flour recorded as an expense double-counts against COGS. The expense form
   guards it with the decoy category (accounting §5).
4. **One tax vocabulary:** `ivaAmount`, `retefuente`, `reteica`, `reteiva`, the
   names `accountingEntries` uses and `purchases` will use when it gains tax
   fields.
5. **Providers are an inventory entity; accounts payable is not.** Accounting may
   later point a counterparty at a provider id, but owing money, due dates and
   payments belong to the balance-sheet phase.

Rent can't be bought on Ingreso (its picker only offers stock items), while flour
can be typed into an expense, so the guard budget sits on the expense form's side
and the merma summary (§4.5) is the backstop that makes a leak visible.
