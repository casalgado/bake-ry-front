# Inventory Implementation

Design decisions for the Inventory epic ([ROADMAP.md](../strategy/ROADMAP.md) → Now → Inventory). This document records what was decided and why, the resulting data model, the deduction algorithm, the ledger design, UX requirements, and what remains open. It is the source of truth for the implementation plan.

**Status of each area:**

| Area | Status |
|---|---|
| Recipe anchoring (product vs combination) | ✅ Decided |
| Recipe composition (component types) | ✅ Decided |
| Shared preparations (crema pastelera problem) | ✅ Decided |
| Product inventory behavior (`inventoryMode`) | ✅ Decided |
| Deduction algorithm | ✅ Decided |
| Missing-recipe / gap handling | ✅ Decided |
| Ledger: stocks docs + movements collection | ✅ Decided |
| Stock triggers (which order changes touch stock) | ✅ Decided |
| Trigger predicate (the "shipped" definition) | ✅ Decided (§9) |
| Module activation (opt-in per business) | ✅ Decided (§14) |
| Stock counts (conteo) | ✅ Decided and built (§15) |
| Role access for purchases | 🔶 Open (counts: §15) |

---

## 1. Current backend state (baseline)

What already exists and is reused:

- **`Ingredient`** — bakery-scoped, single base `unit`, `costPerUnit`, categories in `BakerySettings.ingredientCategories`, `usedInRecipes` back-references. Never sellable: reventa is a product mode (§5).
- **`Recipe` + `recipeService`** — `productId` link, components `{ingredientId, quantity, unit, costPerUnit}`, `totalCost` getter, transactional ingredient↔recipe relationship maintenance.
- **Cost propagation** — changing an ingredient's `costPerUnit` transactionally updates every recipe that uses it (`ingredientService.update`).
- **Recipe versioning** — composition changes snapshot to a `history` subcollection; `getVersionAtDate()` exists. Enables costing past sales with the recipe as it was then.
- **`OrderItem`** — carries `productId`, `recipeId`, `quantity`, `combination` snapshot: everything the deduction routine needs is on the order document.
- **Transactional order mutations** — all order changes flow through `orderService` (`patch` / `patchAll`) inside Firestore transactions with an `updateHistory` immutable subcollection. There are **no Firestore triggers**; the deduction hook lives in the request path.

Known defects to fix early (pre-phase-1 hygiene):

1. **`ingredientService.remove` guard is dead code** — queries `where('ingredients', 'array-contains', ingredientId)` but `recipe.ingredients` is an array of objects, so it never matches. Must check `usedInRecipes` instead. Ingredients used in recipes are currently deletable.
2. **Recipe cost does not flow to product cost** — nothing updates `product.costPrice` / `combination.costPrice` from `recipe.totalCost`; the income statement reads the manually-entered fields. Closed by decision §7.
3. **`Ingredient.currentStock`** is a mutable scalar nothing updates. **Resolved:** it is retired; current stock lives on the `stocks` docs (§8). Migration: ignore the field (never trusted today), remove on next model touch.

---

## 2. Decision: recipes anchor to the sellable unit

**The combination is the unit of selling, stocking, and costing; the product is the unit of behavior and identity.**

- If a product **has variations** → recipes attach to **combinations** (`combination.recipeId`). The product-level `recipeId` is not used.
- If a product **has no variations** → `product.recipeId` stays where it is today.
- **No fallback.** A combination without a recipe never inherits the product's recipe — a fallback would silently deduct wrong quantities for every size except the one the recipe was written for. A missing recipe is either fine (mode `none`) or a visible gap (mode `recipe`, see §6).

**Rejected: base recipe per product + per-combination multiplier.** Proportions change non-linearly with size (icing, filling, decoration don't scale with the sponge). A model-level scaling assumption limits users permanently to save typing once. Scaling is an **entry-time UX assist** instead (§10) — same philosophy as the roadmap's units decision (purchase presentations are entry-time multipliers, not model conversions).

**Rejected: normalize "every product has ≥1 combination".** Cleaner schema in a vacuum, but a migration touching orders, POS, product forms, and reports across all tenants. Not worth blocking the epic. The cost is one explicit conditional in the recipe-resolution function: `hasVariations ? combination.recipeId : product.recipeId`.

**Rejected: `recipeId` on dimension options.** With multi-dimension products (size × flavor), an option-level recipe is ambiguous — the "500g" recipe can't know if it's the chocolate or vanilla one. "Apply to all combinations sharing this option" is a bulk-entry UX action that creates independent editable copies, never a stored link.

---

## 3. Decision: recipes are flat

**Recipe components are ingredients and products only. Recipes never contain recipes.**

- No sub-recipe references, no recursion through recipe entities, no yield concept on product/combination recipes.
- Recipe **reuse is copy-at-creation**: the editor offers "start from recipe X" / import, then the copy is independent and editable (§10).
- The shared-preparation use case ("edit crema pastelera once, updates everywhere") is covered by production ingredients (§4), not by recipe nesting.

Component shape:

```
RecipeComponent {
  type: 'ingredient' | 'product',
  id,                    // ingredientId or productId
  combinationId?,        // required when type='product' and the target product has variations
  quantity,              // in the component's unit (ingredient base unit / product sellable units)
  unit,                  // denormalized from the component
  notes?
}
```

**Pure structure — no `name`, no `costPerUnit`.** A row never carries cost or a
display name; cost is computed live from each component's own source doc and
cached only on the recipe's owner (§7, amended in `a905fea`). See the backend
repo's `docs/recipe-costing.md` for the full mechanism.

`combinationId` matters because "torta" is not a stockable thing — "torta 500g" is. A product component must resolve to a sellable unit.

---

## 4. Decision: shared preparations are production ingredients with recipes

The "crema pastelera" problem — an intermediate that is made, consumed by many recipes, never sold — is modeled as an **ingredient optionally carrying a recipe** — a preparación.

Why ingredient and not "product that is not sold":

- **Identity test**: products are sold, ingredients are consumed. Crema is never sold. A not-sold product forces a "but not this one" filter onto POS, catalog, order forms, and reports forever; one leaked filter shows "Crema pastelera — $0" on a client's POS.
- **Units come free**: recipes reference components in the component's base unit. Ingredients have base units ("250 g de crema" works today); products don't — product-crema would need a fake combination or a resurrected yield-on-recipe concept.
- **Plumbing exists**: `RecipeIngredient` already points at ingredients; `ingredientService` cost propagation (crema cost → every recipe using it) already works.
- **Counting/buying stay natural**: crema in the fridge is counted in grams like any ingredient; a business that switches from making crema to buying it changes nothing structurally.

What this adds to the model:

1. **Recipes attachable to ingredients.** `Recipe` gets a generalized owner (product | combination | ingredient) — a widening already required by §2.
2. **Ingredient recipes require a `yield`** — "esta receta produce 1400 g", one field, always in the ingredient's own base unit. Without it `costPerUnit` can't be derived (total component cost ÷ yield). Only ingredient-owned recipes have yield.
3. **Pass-through vs stocked behavior** (same concept as product `inventoryMode`, §5):
   - **Pass-through (default)** — the ingredient holds no stock; when deduction reaches it, its recipe components are deducted instead (scaled by `quantity / yield`). Correct raw-material deduction with zero user effort (no counting crema, no phantom negative stock).
   - **Stocked (opt-in)** — deduction stops here and deducts the ingredient's own stock (grams of crema).

**Known IOU (accepted):** a *stocked* intermediate creates a production gap — selling deducts crema, but nothing deducts flour/eggs when crema is made. In the ledger model, "registrar producción" is one compound movement entry (+1400 g crema, − components per its recipe) — a data-entry flow over the same movement collection (`type: 'production'`, §8), not a new subsystem. Slots into the Compras phase or right after. Pass-through being the default means nobody hits this gap unless they deliberately opt an intermediate into stock tracking.

---

## 5. Decision: `inventoryMode` per product

Not two product types — **one behavior field**. A separate "resale product" type would fork every form, list, POS view, and report; the only thing that actually differs is what happens to stock when a unit is sold.

```
Product.inventoryMode: 'none' | 'unit' | 'recipe'
```

- **`none` (default, incl. all existing products)** — untracked. Sale deducts nothing; cost is the manually-typed `costPrice` (today's behavior, unchanged). Inventory is **opt-in per product**: a client who never touches inventory loses nothing.
- **`unit`** — store-style. Tracks units of the sellable item (the coke, the bag of beans). Sale deducts its own stock; restocked via Compras.
- **`recipe`** — restaurant-style / made-to-order. No stock of its own; sale expands the recipe and deducts components.

Placement rules:

- **Mode lives on the product** (a product resale in one size and made-to-order in another doesn't exist in practice; per-combination modes would double UI complexity for zero real cases).
- **Stock quantities and recipes live on the sellable unit** — combination when variations exist, product otherwise. Coca-Cola 350ml and 1L are different stocked items; product-level stock would be meaningless.

Manufactured ingredients with recipes carry the equivalent choice (pass-through vs stocked, §4).

---

## 6. Decision: the deduction algorithm

**One universal rule: expansion stops at stock-holding nodes and recurses through everything else. Each node's own mode decides.**

On the deduction trigger (§9), for each order item:

```
deduct(node, qty):
  product with mode 'none'      → nothing (skip silently)
  product with mode 'unit'      → ledger entry: −qty on its sellable unit. STOP.
  product with mode 'recipe'    → resolve recipe (combination-level if variations, else product-level)
                                    no recipe → write GAP MARKER, no movement
                                    recipe    → deduct(component, qty × component.quantity) for each component
  ingredient, stocked           → ledger entry: −qty in base unit. STOP.
  ingredient, pass-through      → deduct each of its recipe components, scaled by qty / yield
```

Worked example — burger combo:

> Combo sold → combo is `recipe` → expand: **burger** (product component) → burger is `recipe` → expand its recipe → deduct meat, bread, cheese. **Fries** → `recipe` → deduct potatoes. **Coke** → `unit` → deduct one coke, stop.

No burger stock ever exists because the burger's own mode says so. This is a strict generalization of the roadmap's phase-2 rule ("ingredient-level if recipe, product-level otherwise") applied at every level of the expansion, not only the top.

**Missing recipes and graceful degradation.** Recipes and inventory are optional per client and per product. Two very different "no recipe" situations:

- **Mode `none`, no recipe** — not a gap. This user chose manual costs. Never nag, never warn, never mention inventory on this product. Silence is the feature.
- **Mode `recipe`, combination lacks a recipe** — a real gap. **Never block the sale.** The order completes normally; the deduction pass records no movement for that item and writes a **gap marker** (`bakeries/{id}/stockGaps`: orderId, orderItemId, productId, combinationId, date, reason), surfaced in the coverage UI ("3 ventas sin descargar inventario"). Same treatment for expansion-time anomalies (e.g., component references a deactivated ingredient). Silent wrongness kills trust in inventory numbers; visible, fixable gaps don't.

**Guardrails (required, write-time):**

- **Cycle detection** when saving any recipe: walk the component graph (product→product, product→ingredient, ingredient→ingredient chains are all expressible). Reject cycles.
- **Depth cap (5)** so expansion stays bounded: it is what lets us say "completing an order costs at most X reads and Y writes, always."
- **Widened deletion guards**: recipe deletion must check combinations (`variations.combinations[].recipeId`) and recipes that reference the owner as a component — not just `product.recipeId` (current check). Ingredient deletion must use `usedInRecipes` (fixes defect §1.1).
- **Unit discipline**: movement quantities are always in the item's own unit (ingredient base unit / sellable units). No conversions inside the ledger, ever (roadmap units decision).

---

## 7. Decision: costing

Amended in `a905fea` — cost was originally planned as a stored `Recipe.totalCost`
propagated one hop to the owner; it shipped as a live compute instead, once it
was clear the stored total would just be another cache to keep in sync with the
row data it was summing.

- **Cost is never stored on a recipe row.** `recipeGraph.computeRecipeCost` computes it live: for each component, read the component's own source doc (`ingredient.costPerUnit` / `product.costPrice` / `combination.costPrice`) and sum `quantity × cost`. This closes defect §1.2.
- **The owner's cache is the only stored cost.** Recipe exists → the owner's `costPrice` (product/combination) or `costPerUnit` (ingredient) is computed and cached, tagged `costPriceSource: 'recipe'`; shown as "calculated from recipe", manually overridable (`costPriceSource: 'manual'`, never silently clobbered). No recipe → `costPrice`/`costPerUnit` stays the manual field it is today.
- **One propagation walk keeps the cache honest**, entered from either side: a recipe is created or its quantities change → recompute → push to its owner, continuing outward if that owner is itself a manufactured ingredient; or an ingredient's cost changes directly → walk every recipe that uses it (`usedInRecipes`) → recompute → push to its owner, continuing outward. Ingredient-owned recipes derive `costPerUnit` the same way (total component cost ÷ yield).
- **Two backstops** cover reverse-index drift or missed edges: `GET /ingredients/:id/cost-impact` previews a cost change's fan-out read-only before committing; `POST /recipes/reconcile-costs` (admin) recomputes and corrects one owner on demand, tagged `reason: 'reconciliation'` in its history.
- **Known, accepted gaps** (ponytail-tagged, backend `tech-debt.md`): a recipe reached twice in the same walk (a "diamond") is only re-costed on the first hit; a product's cost change doesn't yet propagate on to recipes that use that product as a component. Both are rare at bakery scale, backstopped by `reconcileOwnerCost` — not blocking, revisit if they turn out common.
- The income statement's existing cost waterfall consumes the owner's cached cost unchanged — reports keep working for everyone regardless of adoption.
- Full mechanism: backend repo `docs/recipe-costing.md`.

---

## 8. Decision: the ledger — stocks docs + one flat movements collection

**The ledger (`stockMovements`) is the system of record. The stocks doc is a derived, disposable cache.** If every stocks doc were deleted, all could be rebuilt from the ledger; the reverse is not true. Compensation diffs, count absorption, drift repair, and consumption reports all lean on this hierarchy.

### 8.1 `bakeries/{bakeryId}/stocks/{itemKey}` — current state, one doc per stocked item

`itemKey` is deterministic: `ingredient_{id}` | `product_{id}` | `product_{id}_{combinationId}`.

```
StockDoc {
  itemKey, itemType,          // 'ingredient' | 'product'
  ingredientId | productId, combinationId?,
  name, unit,                 // denormalized for list views
  currentStock,               // cache: always == baselineQty + Σ movements since baselineAt
  baselineQty, baselineAt,    // set by the last completed count for this item
  updatedAt
}
```

- A stocks doc exists **only once an item opts into tracking** (`unit`/`recipe`-relevant items, stocked ingredients). `none`-mode products never appear. This replaces `Ingredient.currentStock` (§1.3) and gives counts and the coverage UI a single collection to list instead of scanning products + ingredients.
- **Combination stock cannot live inside `product.variations.combinations[]`**: caching there would rewrite the array on every sale inside the order transaction, contending with product edits. The stocks doc is the transactional anchor instead.
- Baselines are **per item** (`baselineAt` on each doc), so stock counts may be partial — counting only the flour and sugar today baselines only those two items.

### 8.2 `bakeries/{bakeryId}/stockMovements/{movementId}` — append-only truth

```
StockMovement {
  itemKey,                    // what moved
  qty,                        // signed, in the item's own unit
  type,                       // 'sale' | 'purchase' | 'count' | 'adjustment' | 'production' | 'compensation'
  refs: { orderId?, orderItemId?, countId?, purchaseId?, compensates? },
  timestamp,
  editor: { userId, email, role },   // same shape as updateHistory
  unitCost?                   // cost snapshot at movement time (feeds future consumption/COGS reports)
}
```

- **Immutable**: movements are never edited or deleted. Corrections are new movements (`compensation`, referencing the original via `refs.compensates`).
- **Idempotency without flags**: order movements are never keyed by a fixed id. Every order change diffs the order's desired deduction against the net of its existing movements (`refs.orderId`) and writes only the delta (§9), so re-running is an empty diff. A fixed sale id would break an order that ships, is pulled back, and ships again. Hand-entered movements and production-run receipts do use deterministic ids. No "already deducted" flag on any document.
- **Flat collection, not per-item subcollections**: the real queries are cross-item — "all movements from order X" (compensation), "everything a count absorbed", "today's purchases". Per-item history is just `where('itemKey' == …)`.
- **Indexes**: composite on (`itemKey`, `timestamp`) for per-item history and drift recompute; single-field on `refs.orderId` for compensation lookups; (`type`, `timestamp`) for purchase/count listings.

### 8.3 Cache maintenance — how `currentStock` stays correct

Every movement is written **in the same Firestore transaction** as the cache increment — one atomic unit:

```
transaction:
  create stockMovements/{order123_item9_ingredient_flour}   qty: -250
  update stocks/ingredient_flour                            currentStock: increment(-250)
```

It is impossible for the movement to exist without the increment or vice versa. **Count completion** is the one special write: sets `baselineQty = counted`, `baselineAt = now`, `currentStock = counted`, plus a `count` movement for the audit trail. Prior movements are not touched — they simply stop participating, because the derivation only sums movements after `baselineAt`. That is what "counts absorb all prior movements" means mechanically.

**Drift verify job** (nightly/on-demand, per bakery): for each stocks doc, recompute `baselineQty + Σ movements since baselineAt`, compare with `currentStock`, flag/repair differences. Not for Firestore failures (atomicity covers those) but for bugs and humans — a future code path that forgets the increment, a console edit, a bad migration. The cache can be wrong, but never silently and permanently.

**Why cache at all**: the hot read is POS/product lists asking availability for dozens of items per render. Cache = one cheap read per item (or one query over `stocks`). Firestore `sum()` aggregations exist but bill per index entries scanned and add latency per item — wrong tool for the hottest read. The cache moves the cost to the rarest operation (movements happen only when something is sold, bought, counted, or produced).

### 8.4 Read paths

- **Current stock / availability (hot)**: read the stocks doc(s). O(1) per item.
- **Availability of a `recipe`-mode product** (combos, roadmap: "availability computed from components"): expand the recipe (same expansion as deduction, read-only) and take `min(floor(componentStock / componentQty))` over stock-holding components; components without stocks docs don't constrain. Computed on demand — never stored.
- **Item history**: `stockMovements where itemKey == … orderBy timestamp desc`.
- **Order audit**: `stockMovements where refs.orderId == …`.

### 8.5 Write-path properties and scale

- **Fan-out is bounded**: a completed order touches N stocks docs + N movement docs, where N is the expanded component count (10-ingredient recipe ≈ 20 writes). The depth cap (§6) is what keeps N predictable. Well within Firestore transaction bounds at bakery scale.
- **Contention is per-document and per-tenant**: stocks docs live under `bakeries/{id}`, so tenants never contend with each other — many users is not the risk dimension. Within one bakery, popular items (flour) absorb one write per completing order; Firestore's guidance (~1 sustained write/sec/doc) means a single bakery would need multiple completions per second, sustained, to hot-spot. If a client ever becomes that business: sharded counters, a contained fix. Not built now.
- **Deduction runs per order, in its own transaction** — never piggybacked on `patchAll`'s shared batch (a bulk edit completing 10 orders would multiply writes into one giant transaction). `patchAll` detecting completion transitions queues per-order deduction transactions.

### 8.6 Compensation (order edits after completion)

Expand the order's **new** item state → diff against the order's **existing** movements (`refs.orderId` lookup) → write only the delta movements (`type: 'compensation'`). Originals are never rewritten (roadmap resolved decision). Edits that don't change the expansion produce an empty diff and zero writes.

---

## 9. Decision: stock triggers — the `affectsStock` predicate

**The ledger records what physically left. An order deducts when it ships, not when it's created or paid.** Order statuses: 0 Recibida · 1 Producida · 2 Enviada · 3 Entregada.

```
affectsStock(order) = !order.isDeleted && order.status >= 2   // Enviada or Entregada
```

**One mechanism for every edge — `reconcileOrderStock(order)`:** expand what the order should have deducted (nothing when the predicate is false) → diff against the net of the order's existing movements (`refs.orderId`) → write only the delta (`sale` for the first deduction, `compensation` after). This single diff is deduction, reversal (shipped order moved back or deleted) and edit compensation (§8.6), and running it twice is an empty diff.

**Per line, by `OrderItem.fulfillmentSource`:** a `stock` line deducts the product; a `produce` line deducts its ingredients through the recipe walk (§6) and never touches the product's own stock — it was made for that customer and never sat on the shelf.

Why ship-time and not creation:

- **An order is a promise; nothing physical happens at creation.** Writing movements for it means a compensation for every edit, quantity change and cancellation — orders get edited constantly, and the ledger is append-only.
- **Counts would corrupt it.** A 3 pm pre-order deducted at 9 am is still on the shelf at a 2 pm count; the count re-baselines it, the pickup has already been deducted, and stock is overstated permanently.
- **"Is it still sellable?" is a different number.** Disponible = existencia + en producción − comprometido, computed from open orders and open production runs on read (`next-steps` §2). The commitment exists from the moment the order does, at zero ledger cost.
- **Payment is not a physical event.** Advance-paid encargos are paid weeks before they ship.

Pickups that jump straight to Entregada are covered by `>= 2`. POS orders must be born Entregada (tracked outside this epic); a counter sale that never reaches Enviada never deducts.

Everything else — driver assignment, payment, notes, delivery fields, invoice tweaks — never enters the stock path. `orderService` already computes `diffObjects(currentOrder, updatedOrder)` on every patch; if the diff neither flips the predicate nor touches `orderItems` while it's true, stock code is not invoked.

---

## 10. Resulting model changes (summary)

| Entity | Change |
|---|---|
| `OrderItem` | + `fulfillmentSource: 'produce' \| 'stock'` (default `'produce'`) + `sourceWarehouseId` — decides what the line deducts when the order ships (§9) |
| `Product` | + `inventoryMode: 'none' \| 'unit' \| 'recipe'` (default `'none'`) |
| `Combination` | + `recipeId` (nullable) |
| `Recipe` | owner generalized: product \| combination \| ingredient; + `yield` (ingredient-owned only); components become typed (`RecipeComponent`, §3) |
| `Ingredient` | `type` enum and the `isResale` boolean that replaced it are both **retired** — reventa is `Product.inventoryMode: 'unit'`, and an ingredient cannot be sold at all (an order line only carries a `productId`); + optional `recipeId` (no longer conditional); + stocked/pass-through flag; `currentStock` retired (§8.1) |
| New: `stocks` collection | per-item current state + baseline (§8.1) |
| New: `stockMovements` collection | append-only ledger (§8.2), composite indexes (§8.2) |
| New: `stockGaps` collection | gap markers: order, item, combination, date, reason (§6) |
| New: stock counts (phase 3) | count doc: items with counted quantities, draft/completed, `completedAt`; completion baselines each included item (§8.3); partial counts supported (§8.1) |
| New: `providers` | `{ name, nationalId?, phone?, isDeleted }` per bakery. NIT because supplier e-invoices identify the issuer by it |
| New: `purchases` | `{ providerId, date, warehouseId, lines: [{ item, qty, unitCost, updateCost }], total }` → one `purchase` movement per line; immutable once confirmed; per-line cost update (on by default, untick to skip) applied in the purchase's transaction (all or nothing). Tax fields join when an accounting screen exists to fill them, named as `AccountingEntry` names them (§13) |
| New: `productionRuns` | `{ date, warehouseId, status: 'open' \| 'closed', lines: [ProductionRunLine] }`; a line `{ item, plannedQty, status: 'pending' \| 'received' \| 'cancelled', receivedQty, receivedAt, receivedBy }`. Pending lines are `incoming`; receiving a line writes + output − components |

New backend surface: `stockService` (movements + cache + expansion/deduction + drift verify), `stockCountService` (phase 3), `purchaseService` (phase 4), with routes following the existing factory patterns. All changes are additive **except the retirement of `Ingredient.isResale`**; otherwise no data migration required (existing products default to `inventoryMode: 'none'`, existing `product.recipeId` untouched, `Ingredient.currentStock` ignored then removed). Retiring `isResale` is applied forward only: an ingredient that carried it stays an ordinary ingredient, and anything that must actually be sold is created as a product and its balance moved with an explicit adjustment at each end. Nothing rewrites the ledger — an item's `itemKey` changes when it changes entity, and the movements collection is append-only. See `PLAN-resale-to-product.md` §5.

---

## 11. UX requirements

The roadmap's cross-cutting rule: **data entry is the product risk, not the reports.** These are the requirements the flows are held to:

1. **Mode selection in plain language, at product creation, defaulting to "none", skippable.** Three phrased behaviors, no jargon: "No controlo inventario de este producto" / "Compro y vendo unidades" / "Lo preparo con ingredientes (receta)."
2. **Coverage matrix per product.** For a `recipe`-mode product with variations: grid of combinations × (has recipe? / cost source / margin). One glance shows what's missing. Gap markers from sales (§6) surface here.
3. **Copy-and-scale as the primary recipe creation path.** "Start from: [another combination's recipe / another product's recipe / blank]" with a scale factor pre-filled from the dimension option's `value` (500g → 1000g suggests ×2; user adjusts the lines that don't scale linearly). "Apply to all combinations sharing this option" creates **independent editable copies** — entry-time assist, never a stored link.
4. **Inline ingredient creation.** Typing an unknown ingredient offers "create it" in place (name, unit, cost — three fields, no navigation). Leaving the editor to create master data is the #1 abandonment point.
5. **Keyboard-first line entry with live cost.** Same pattern as invoice items (save-on-blur, enter advances): ingredient → quantity → next line, with running recipe cost and margin-vs-price updating live. The margin readout is the reward that motivates finishing.
6. **Recipe totals sanity check.** Before adopting a computed cost, show it against the manual one: "tu costo manual dice 3.500, la receta dice 4.200" — a moment of real value, not friction.
7. **Never surface inventory UI on `none`-mode products.**
8. **Counts are fast, partial, and interruptible** (phase 3): filterable item list from the `stocks` collection, big numeric inputs, save-as-draft, complete only what was counted.
9. **Per-item "comprado vs consumido vs merma" summary** in the stock view: for a date range, movement totals grouped by type. The user never sells flour — sales deduct it through recipes — so `purchase` totals vs `sale` totals vs the gap a count reveals answer "¿cuánto compré, cuánto usé, cuánto perdí?". Every count is implicitly a shrinkage report for the period since the last one; the count-completion summary shows counted-vs-expected per item and calls the difference what it is. Consistently high merma on one ingredient means waste **or** an inaccurate recipe — the system can't tell which, but it points at where to look.

---

## 12. Open items

1. **Forgotten orders.** An order never marked shipped commits stock forever. Plan: count only open orders due within a window; the size is undecided.
2. **Role access:** which roles may record purchases and adjustments (`production_assistant`, `accounting_assistant`, `bakery_staff`?). Decide when building routes. Receiving production-run lines includes `production_assistant`. Counts are decided: §15.
3. **Negative stock:** allowed, displayed, never blocks a sale; counts correct it.

---

## 13. Relationship to the Accounting epic

Boundary contract with [ACCOUNTING-IMPLEMENTATION.md](../accounting/ACCOUNTING-IMPLEMENTATION.md) (mirrored there as its §13). The two epics are **independent by construction** — a business can adopt either, both, or neither, in any order — and stay that way by holding five rules:

1. **The only shared data is `costPrice` / `costPerUnit`.** Accounting consumes them (the COGS waterfall in the income statement); inventory refreshes them (recipe cost propagation, §7). No other reads or writes cross the boundary. A client without inventory maintains costs manually — today's behavior — and their P&L still works.
2. **The income statement never reads `purchases`; Compras never writes `accountingEntries`.** If a "cash view of ingredient spend" is ever wanted, it's a report over `purchases` — never expense entries.
3. **Ingredient spend is never an expense entry — universal rule, not inventory-conditional.** Flour recorded as an expense double-counts against COGS whether or not the inventory module exists, because COGS comes from `costPrice` either way. Guarded in the expense form by the decoy category (accounting §5).
4. **One tax vocabulary**: `ivaAmount`, `retefuente`, `reteica`, `reteiva` — the names `accountingEntries` uses, and the names `purchases` will use when it gains tax fields, so future IVA/retención reports union the two collections without translation.
5. **Providers are an inventory entity; accounts payable is not.** `providers` exist because Ingreso is built around them (the last basket, price-change flags). Accounting may later point `counterparty` at a provider id, but owing money, due dates and payments stay in the balance-sheet phase.

Failure asymmetry worth remembering: rent-into-Compras is structurally impossible (the item picker only offers stock items), while flour-into-Gastos types in fine (an entry needs only an amount) — so the entire guard budget sits on the expense form's side, and the merma summary (§11.9) is the backstop that makes anything that leaks through visible instead of permanent.

---

## 14. Decision: module activation (shared with Accounting)

Mirrored verbatim as Accounting §14. Both epics ship as **modules that are off by default** and are switched on per business.

**Mechanism — the existing one, no new machinery.** `BakerySettings.features` already carries per-business behavior flags (`features.pos.enabled`, `features.order.offlineMode`) merged against `DEFAULT_FEATURES` in both the backend and frontend `BakerySettings` model, edited by system admins in `BakeryManagementView.vue`, and already consumed by `AdminSidebar.vue` to splice nav sections in and out. Two more flags join it:

```
features.inventory  = { enabled: false }
features.accounting = { enabled: false }
```

Defaults `false`, so every existing business reads as "off" with no migration — the same trick as `inventoryMode: 'none'` (§5).

**The flag gates doors, never logic.** This is the rule that keeps the toggle from becoming a bug factory:

- **Frontend only**: sidebar sections, route guards (`meta.requiresFeature`), settings tabs, and entry points into product/order forms (the `inventoryMode` selector, §11.1). Off = the business sees no trace of the module, exactly as `none`-mode products see no inventory UI.
- **Never in the backend**: no `if (features.inventory.enabled)` in `orderService`, `stockService`, or the statement computation. Both epics already no-op for a non-adopting business by construction — every product is `inventoryMode: 'none'` so `expandOrderItem` yields nothing, and with no `accountingEntries` the statement's net profit equals its gross profit. A settings check would be a **second kill switch that can drift from the first**, and toggling inventory off for a month would silently stop deductions while sales continued — a hole in an append-only ledger that no count can explain. Data collection is unconditional; only the doors open and close.

**What the flag does not exempt.** Rules marked universal in §13 stay universal: ingredient spend is never an expense entry, and the decoy category (accounting §5) redirects whether or not inventory is enabled. Only its message text is context-aware.

**Self-containment is the §13 contract, not the toggle.** The toggle is visibility; independence is the five data rules above. New code lives in its own directories (`src/views/inventory/`, `src/services/stockService.js`, `src/stores/stockStore.js`; the accounting counterparts) and existing services gain hooks, not knowledge of each other.

---

## 15. Decision: stock counts (conteo)

**A count is a shared, server-side document that several people type into at once; closing it sets each counted item's baseline to what was on the shelf.** Built 2026-10-09. The planning trail is [CONTEO-HANDOFF.md](./CONTEO-HANDOFF.md); where the two differ, this section is what was built.

### 15.1 Rules

1. **You type what is on the shelf, never the difference.** The expected number shows only after a row is entered, so the system's belief cannot anchor the count.
2. **An empty box means "not counted", not zero.** Uncounted items keep their baseline (partial counts, §8.1).
3. **One bodega per count, one open count per bodega.** Pressing Empezar while one is open joins it (open-or-join).
4. **Shared and live.** Each row is its own write; everyone sees everyone's numbers. Two people on one row: the latest number wins, and the row shows who wrote it.
5. **Nothing sells during a count.** Counting happens with the shop closed, and the difference is taken against `currentStock` at close. A count left open more than 12 h gets a warning on Revisar ("sales in that time are absorbed by the count"); it never blocks.
6. **Closing happens only on the review page (Revisar).** The counting page has no submit button.
7. **Alerts warn, never block.** A row is flagged when |difference| × unit cost ≥ **$50.000** (`ALERT_VALUE` in `CountReview.vue`; money only, no percent rule). A row with no cost cannot be flagged. The alert count rides on the button: "Cerrar conteo con 2 alertas". A per-item threshold can become an item field when a client asks.
8. **Merma framing.** Bajas (`waste`) already lowered `currentStock`, so the count's whole difference is *unexplained*. A closed count reads "since the last count: bajas reported N + found by the count M (unexplained)".
9. **Descartar ends the count for everyone and moves nothing.** The count stays listed as "Descartado · por X" with its typed rows: a count dropped right after showing a big shortfall is exactly what an owner needs to see.
10. **Roles:** `bakery_admin`, `bakery_staff` (the supervisor) and `system_admin` (`requireBakeryStaffOrAdmin`), for every count route. `accounting_assistant` waits until accounting asks for merma.
11. **There is no count date or "responsable" field.** The date is the close time (a backdated count would contradict `baselineAt`); who counted is recorded per row.

### 15.2 Data

```
bakeries/{bakeryId}/stockCounts/{id}
  warehouseId
  status: 'open' | 'closed' | 'discarded'
  createdBy: { userId, name }   createdAt
  items: { [itemKey]: { qty, by: { userId, name }, at } }   // a map, not an array
  closedBy, closedAt            // set by close and by discard
  totalItems                    // close only: stocks docs in the bodega ("23 de 60")
  // close also freezes onto each row: name, unit, expectedQty, diffQty,
  //   unitCost (null = could not resolve), wasteSinceBaseline
```

- **A map so rows never collide.** Each typed number is one field write (`items.<itemKey>`), so two people on different rows never overwrite each other.
- **No `isDeleted`.** Discarding is a status, so the list keeps it.
- **Totals (faltante, sobrante, alertas, net value) are computed on read**, never stored.
- **Names** come from the user's doc in `bakeries/{bakeryId}/users`, falling back to email (the auth token carries no name; a `system_admin` therefore shows as an email).
- **Unit cost** follows the same rules as the frontend's `useItemCatalog.costOf`: ingredient `costPerUnit`, product or combination `costPrice`, `null` when the item cannot be resolved.

### 15.3 Close: one transaction

1. **Outside the transaction** (unbounded reads): unit cost and `wasteSinceBaseline` (Σ `waste` movements since the item's `baselineAt`) per counted row, and the bodega's stocks-doc count. A row typed after these reads makes the close measure again (up to 3 tries).
2. **Inside:** the count must still be `open`, so closing twice is refused. Per counted item, `diff = counted − currentStock`:
   - `diff ≠ 0` → one `count` movement (`refs.countId`, deterministic id `count_{countId}_{itemKey}`) through `writeMovements`. Its `stockFields` option merges `baselineQty`/`baselineAt` into that stocks doc's single cache write: one write per doc per transaction, as §8.3 requires.
   - `diff = 0` → no movement, but the baseline is still set (a matching count verifies the item).
   - Every counted item: `baselineQty = counted`, `baselineAt = close time`.
3. **The movement is stamped 1 ms before `baselineAt`.** Drift verify sums movements with `timestamp >= baselineAt`; the baseline already contains this movement, so it must fall just outside. The filter stays `>=` on purpose: `>` would break stocks docs born from a movement, whose seed `baselineAt` can share that movement's millisecond. Covered by a test.

### 15.4 API and access

All under `requireBakeryStaffOrAdmin`:

| Method | Path | Does |
|---|---|---|
| GET | `/stockCounts` | Newest 100 by `createdAt`, as summaries (`counted`, `counters`, `netValue`), without rows |
| GET | `/stockCounts/:id` | One count, with rows |
| POST | `/stockCounts` `{ warehouseId }` | Open-or-join |
| PUT | `/stockCounts/:id/items/:itemKey` `{ qty }` | Set a row (`qty ≥ 0`) or clear it (`null`). The item must have a stocks doc in that bodega; refused once the count is not open |
| POST | `/stockCounts/:id/close` | §15.3 |
| POST | `/stockCounts/:id/discard` | `status: 'discarded'`; no ledger writes |

- **Errors are 400**, like production runs; the shared `handleError` has no 409 path.
- **No index needed.** The list orders by `createdAt` alone; the open-count lookup and the bajas lookup are equality-only.
- **Firestore rule:** `stockCounts` is readable by bakery staff (the live views listen to the doc) and writable only by the API. Deploy the rule before hosting.

### 15.5 Screens

| Route | Screen |
|---|---|
| `/inventory/conteos` | `CountList.vue`: open counts pinned with "Continuar · N/M · names", Empezar, then closed and discarded counts (date, who, how many counted, net value). The sidebar's Conteo link points here |
| `/inventory/conteos/:id` | `CountDoc.vue`: rows by shelf, each saved 400 ms after typing stops (a pending save is flushed when you leave). Shows the server's value unless you are typing in that box. After entry: "contado por X · sistema decía N · ±d". Redirects to Revisar once the count is closed |
| `/inventory/conteos/:id/revisar` | `CountReview.vue`: open = live with Cerrar; closed = frozen, plus bajas; discarded = the typed rows only. Only counted rows, flagged first, then by money moved; rows with no difference fold away |

The Bodega (Existencias) Conteo button opens the open count when there is one and shows its progress. It reads the list once per visit, so it can lag a row saved in the same moment.
