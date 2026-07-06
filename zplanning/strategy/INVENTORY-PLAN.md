# Inventory Implementation Plan

Ordered steps to build the Inventory epic. Design decisions live in [INVENTORY-IMPLEMENTATION.md](./INVENTORY-IMPLEMENTATION.md) (referenced as §N below); this file is only the sequence and the concrete work items. Rules that shaped the order:

- **Every phase ends with the app working and shippable.** No phase leaves a client broken or half-migrated.
- **No step depends on an open decision.** The trigger predicate is decided (§9): `affectsStock(order) = status >= 1 OR (salesChannel === 'pos' && fully paid)`. The remaining open items — negative-stock display policy (§12.4) and role access (§12.2) — are each confirmed inside the phase that needs them.
- **Backend before frontend inside each phase** — the frontend builds against real endpoints, not mocks.
- **All changes are additive; there is no data migration anywhere in this plan.** Existing products behave identically until someone opts them in.

Repos:
- **Backend:** `C:\Users\casal\documents\web\back\bake-ry\functions` (`src/models`, `src/services`, `src/controllers`, `src/routes`)
- **Frontend:** this repo (`src/models`, `src/services`, `src/stores`, `src/components`, `src/views`)

Phases 1–4 map 1:1 to the roadmap sub-phases. Phase 0 is pre-existing-defect hygiene. Test-writing steps are listed where they belong; **always ask before running tests** (house convention).

---

## Phase 0 — Hygiene (backend, small, independent)

Standalone fixes that reduce risk before anything is built on top. No frontend work.

- [ ] **0.1 Fix the dead ingredient-deletion guard** (§1.1)
  - File: `src/services/ingredientService.js` → `remove()`.
  - Replace the `where('ingredients', 'array-contains', ingredientId)` query (never matches — `recipe.ingredients` holds objects) with a check on the ingredient doc's own `usedInRecipes` array (already maintained by `recipeService`).
  - Error message must name the blocking recipes so the user can act ("Usado en: Torta 500g, Croissant…").
- [ ] **0.2 Retire `Ingredient.currentStock` reads/writes** (§1.3)
  - Files: `src/models/Ingredient.js` and any service/frontend spot that displays or sets it.
  - Do not delete the field from stored docs; simply stop reading/writing it. Remove from the model constructor on the next natural touch (1A.5).

**Done when:** deleting an in-use ingredient returns a clear, named error; a repo-wide grep for `currentStock` shows no live read/write paths (outside the new `stocks` docs built in 1B).

---

## Phase 1 — Recipes & stock model

The largest phase. Three tracks: **1A** recipe/model generalization (backend), **1B** ledger foundation (backend), **1C** frontend. 1A and 1B are independent of each other and can be built in parallel; 1C consumes both. All three must land before phase 2.

### 1A — Recipe & model generalization (backend)

- [ ] **1A.1 `Product.inventoryMode`** (§5)
  - File: `src/models/Product.js`.
  - Add `inventoryMode: 'none' | 'unit' | 'recipe'`, default `'none'` in the constructor so every existing doc reads as `'none'` without migration. Validate the enum in the service layer.
  - No behavior attaches to the field yet — this step is model + validation only.
- [ ] **1A.2 `Combination.recipeId`** (§2)
  - File: `src/models/Combination.js`.
  - Add nullable `recipeId`, defaulting `null`. Combinations are embedded in the product doc, so this rides existing product writes — no new endpoints.
- [ ] **1A.3 Recipe owner generalization** (§2, §4)
  - Files: `src/models/Recipe.js`, `src/services/recipeService.js`.
  - Keep `productId` (existing recipes untouched). Add nullable `combinationId` and `ingredientId`. Validation: **exactly one owner** — `productId` alone (no-variations product), `productId + combinationId` (combination-owned), or `ingredientId` alone.
  - Add `yield` (number, in the owning ingredient's base unit): **required iff ingredient-owned, forbidden otherwise**.
  - Recipe resolution helper (used by costing now, deduction in phase 2): `resolveRecipeId(product, combinationId)` → `product.hasVariations ? combination.recipeId : product.recipeId`. **No fallback** from combination to product (§2).
- [ ] **1A.4 Typed components** (§3)
  - Files: `src/models/Recipe.js` (replace/extend `RecipeIngredient`), `src/services/recipeService.js`.
  - `RecipeComponent { type: 'ingredient' | 'product', id, combinationId?, quantity, unit, name, costPerUnit, notes? }`.
  - Backward compatibility on **read**: rows without `type` default to `'ingredient'` with `id = ingredientId` — stored docs are never rewritten in bulk.
  - `combinationId` required when `type: 'product'` and the target product has variations (a product component must resolve to a sellable unit).
  - Relationship maintenance: extend the existing ingredient↔recipe bookkeeping (`usedInRecipes`) to also track **product** components (either a `usedInRecipes` array on products or an equivalent reverse index) — the deletion guards in 1A.7 need it.
  - Recipe versioning (`src/services/versioning/recipeVersioning.js`) must snapshot the new component shape unchanged — verify, no redesign expected.
- [ ] **1A.5 Ingredient recipe + stock behavior** (§4)
  - File: `src/models/Ingredient.js`.
  - Add optional `recipeId` (manufactured type only — reject on `resale`) and `stockBehavior: 'passThrough' | 'stocked'`, default `'passThrough'`.
  - Remove `currentStock` from the constructor (completes 0.2).
- [ ] **1A.6 Save-time guardrails in `recipeService`** (§6)
  - **Cycle detection**: on every recipe create/update, walk the full component graph (product→product, product→ingredient-with-recipe, ingredient→ingredient chains are all expressible). Reject with a message naming the cycle path.
  - **Depth cap 5**: reject a save whose expansion graph exceeds depth 5. This is what makes phase-2 write fan-out provably bounded.
  - **Unit discipline**: component `quantity` is always in the component's own unit (ingredient base unit / product sellable units); reject mismatched units at save time. No conversions, ever (§6, roadmap units decision).
- [ ] **1A.7 Widened deletion guards** (§6)
  - Recipe deletion: block if referenced by any `product.recipeId` **or** any `combination.recipeId` **or** any `ingredient.recipeId` (current check only covers products).
  - Product deletion: block if the product is a component of any recipe (uses the reverse index from 1A.4).
  - Ingredient deletion: already fixed in 0.1.
- [ ] **1A.8 Costing propagation** (§7, closes defect §1.2)
  - Files: `src/services/recipeService.js`, `src/services/ingredientService.js`, `src/services/productService.js`.
  - Recipe `totalCost` change → update owning `product.costPrice` or `combination.costPrice`, in the same transaction, **only when** the owner's cost is flagged as computed. Add `costPriceSource: 'manual' | 'recipe'` to product/combination so a manual override is never silently clobbered.
  - Ingredient-owned recipe → derive `ingredient.costPerUnit = totalCost / yield`, then let the **existing** ingredient→recipe cost propagation carry it into every consuming recipe (crema cost change fans out correctly with no new machinery).
  - Guard against propagation loops: derivation runs ingredient→recipes one hop at a time and the cycle check (1A.6) guarantees the graph is acyclic.
  - The income statement's costPrice waterfall (`orderService.getIncomeStatement`) consumes the result unchanged — verify, don't modify.
- [ ] **1A.9 Tests for 1A** *(write here; ask before running)*
  - Cycle rejection (direct and 3-hop), depth-cap rejection, exactly-one-owner validation, yield required/forbidden, deletion guards (all three), two-hop cost propagation (ingredient → crema recipe → crema `costPerUnit` → torta recipe → combination `costPrice`), manual `costPriceSource` never overwritten.

### 1B — Ledger foundation (backend)

- [ ] **1B.1 `stockService` core: collections + the one write primitive** (§8)
  - New file: `src/services/stockService.js` (+ `stockController`, `stockRoutes` following the factory patterns).
  - Collections: `bakeries/{bakeryId}/stocks/{itemKey}` (StockDoc, §8.1) and `bakeries/{bakeryId}/stockMovements/{movementId}` (StockMovement, §8.2). `itemKey` builder: `ingredient_{id}` | `product_{id}` | `product_{id}_{combinationId}` — one function, used everywhere, never hand-built.
  - **The primitive everything else calls:** `writeMovements(bakeryId, movements[], { transaction? })` — inside one Firestore transaction: for each movement, create the movement doc (deterministic ID when provided, else generated) and `FieldValue.increment(qty)` the matching stocks doc's `currentStock`. Accepts an outer transaction so phase 2 can run it inside the order transaction.
  - Idempotency contract: before creating, read deterministic-ID docs; existing ID → skip both the create and the increment (structural no-op, §8.2).
  - Movements are append-only: no update or delete endpoints exist, period.
- [ ] **1B.2 Stocks doc lifecycle** (§8.1)
  - Created when an item opts into tracking: product switched to `inventoryMode: 'unit'` (one doc per sellable unit — per combination if variations), ingredient switched to `stocked`. Hook into `productService.update` / `ingredientService.update`.
  - Initialized with `currentStock: 0, baselineQty: 0, baselineAt: now` and denormalized `name`/`unit`. Name/unit refresh on source rename (cheap, same update path).
  - Never auto-deleted — switching back to `none` orphans the doc harmlessly (history intact); hidden in UI when the item is no longer tracked.
- [ ] **1B.3 Read endpoints**
  - `GET /bakeries/:bakeryId/stocks` — list (the backbone for the stock view, coverage UI, and phase-3 counts). Supports the existing query system (filter by itemType, name).
  - `GET /bakeries/:bakeryId/stocks/:itemKey/movements` — per-item history (`itemKey + timestamp desc`, paginated).
  - `GET /bakeries/:bakeryId/stockMovements?orderId=…` — all movements of one order (phase-2 compensation + audit).
- [ ] **1B.4 Manual adjustment endpoint**
  - `POST /bakeries/:bakeryId/stocks/:itemKey/adjust` → one `adjustment` movement (signed qty, required `reason`, editor from token) via `writeMovements`.
  - Purpose: makes the ledger usable and hand-testable end-to-end before deduction/counts/purchases exist; remains the permanent escape hatch.
- [ ] **1B.5 Firestore indexes** (§8.2)
  - Composite: (`itemKey` asc, `timestamp` desc) and (`type` asc, `timestamp` desc) on `stockMovements`; single-field on `refs.orderId`.
  - Add to the backend's `firestore.indexes.json` and deploy with the phase.
- [ ] **1B.6 Tests for 1B** *(write here; ask before running)*
  - Atomicity: movement + increment land together or not at all. Idempotency: same deterministic ID twice → one movement, one increment. Lifecycle: opting in creates docs per combination; adjustment updates cache and appends movement.

### 1C — Frontend

Frontend plumbing first: `src/services/stockService.js` + `src/stores/stockStore.js` mirroring the existing service/store pattern; extend `src/models` (Product, Recipe, Ingredient frontend models) with the new fields.

- [ ] **1C.1 Product form: mode selector** (UX §11.1, §11.7)
  - Files: `src/components/forms/ProductForm.vue` (and `ProductWizard.vue` if it duplicates the flow).
  - Three plain-language options, radio-card style (reuse `RadioFeatureCard.vue`): "No controlo inventario de este producto" / "Compro y vendo unidades" / "Lo preparo con ingredientes (receta)". Defaults to the first; skippable; changeable later.
  - **Hard rule:** `none` products show zero inventory UI anywhere — no badges, no empty stock columns, no nags (§11.7, "silence is the feature").
- [ ] **1C.2 Recipe editor rework** (UX §11.4–11.6)
  - Files: `src/components/forms/RecipeForm.vue`, `IngredientSelector.vue` (extend or add a component selector handling both types).
  - Typed component rows: picker searches ingredients **and** products; picking a product with variations requires choosing the combination.
  - Keyboard-first line entry: same save-on-blur / enter-advances pattern as invoice items; running recipe cost and margin-vs-price update live per keystroke (§11.5 — "the margin readout is the reward").
  - Inline ingredient creation (§11.4): unknown name → "crear ingrediente" in place, three fields (name, unit, cost), no navigation.
  - Totals sanity check (§11.6): when adopting a computed cost over a manual one, show both ("tu costo manual dice 3.500, la receta dice 4.200") with an explicit choice; wires to `costPriceSource` (1A.8).
- [ ] **1C.3 Combination-level recipes: coverage matrix + copy-and-scale** (UX §11.2, §11.3)
  - Coverage matrix on the product detail/edit view: grid of combinations × (has recipe? / cost source / margin). One glance shows what's missing. (Phase 2 adds sale gap markers to this same surface.)
  - Copy-and-scale creation: "Start from: [another combination's recipe / another product's recipe / blank]" with scale factor pre-filled from the dimension option's `value` ratio (500g → 1000g suggests ×2); user adjusts non-linear lines before saving. "Apply to all combinations sharing this option" creates **independent editable copies** — entry-time assist, never a stored link (§2).
- [ ] **1C.4 Ingredient form: manufactured extras** (§4)
  - File: `src/components/forms/IngredientForm.vue`.
  - For `manufactured` ingredients only: optional recipe (opens the same editor from 1C.2, ingredient-owned) with **mandatory yield** ("esta receta produce ___ {unit}"), and the pass-through/stocked toggle explained in plain language ("¿Llevas inventario de esta preparación?" — default no/pass-through).
  - When a recipe exists, `costPerUnit` displays as computed (derived via yield, 1A.8) with manual override.
- [ ] **1C.5 Stock view** (first visible inventory screen)
  - New: `src/views/inventory/` + route (admin sidebar entry), backed by the `stocks` list endpoint via `stockStore`.
  - DataTable of tracked items: name, unit, `currentStock`, last movement date. Row → movement history (paginated from 1B.3). Manual adjustment dialog (signed qty + reason → 1B.4).
  - This screen validates the entire ledger end-to-end by hand before any automation exists.

**Done when:** a client can define combination-level recipes with products and ingredients as components; computed costs flow to `costPrice` and the income statement; manufactured ingredients carry recipes with yield; items opt into tracking and their stock is adjustable and auditable by hand. Nothing deducts automatically yet, and clients who ignore all of it see nothing new.

---

## Phase 2 — Automatic deduction on completed sale

- [ ] **2.1 ⚠️ DECIDE FIRST: the "completed" trigger** (§12.1)
  - `Order.status` is a bare number indexed into a configurable settings list ("Completada" = index 4 by convention) — the trigger needs a firm, tenant-safe definition, including POS orders that may never walk the status ladder (candidate: POS orders with `autoMarkPaid` complete immediately).
  - Also confirm here: **negative stock policy** (§12.4 — proposed: allow it, display prominently, never block sales) and whether deduction failures inside the order transaction abort the order or degrade to a gap (recommendation: degrade — inventory must never block a sale, §6).
  - This is the only open decision in the plan; nothing before this step waits on it.
- [ ] **2.2 Expansion + deduction resolver in `stockService`** (§6)
  - `expandOrderItem(bakeryId, orderItem) → { movements[], gaps[] }` implementing the universal rule:
    - product `none` → nothing; product `unit` → −qty on its sellable unit, stop; product `recipe` → resolve recipe via 1A.3's helper (**no fallback**) → no recipe: gap marker; recipe: recurse into components ×quantity.
    - ingredient `stocked` → −qty base unit, stop; ingredient `passThrough` → recurse into its recipe components scaled by `qty / yield`.
  - Deterministic sale-movement IDs: `{orderId}_{orderItemId}_{itemKey}` (§8.2).
  - Gap markers → `bakeries/{bakeryId}/stockGaps` docs (orderId, orderItemId, productId, combinationId, date, reason) for missing recipes **and** expansion anomalies (deactivated component, depth exceeded at runtime). Gaps never block the sale (§6).
  - Runtime depth guard mirrors the save-time cap (defense in depth — data saved before 1A.6 could exist).
- [ ] **2.3 Order hook: the `diffObjects` gate** (§9)
  - File: `src/services/orderService.js` (`patch`, `patchAll`, `remove`).
  - Stock code runs **only** when the diff shows: (a) status transition **into** completed → full deduction via `expandOrderItem` + `writeMovements` (idempotent by ID); (b) status transition **out of** completed, or deletion of a completed order → full reversal (compensating movements for everything the order's movements show, from the `refs.orderId` lookup); (c) `orderItems` changes on an already-completed order → 2.4.
  - Everything else — driver assignment, payment marking, notes, delivery fields — never enters the stock path. Zero inventory cost for mundane patches.
  - `patchAll`: detect completion transitions per order and run **one deduction transaction per order** — never piggyback all deductions onto the shared 500-op batch (§8.5).
- [ ] **2.4 Compensation on item edits** (§8.6)
  - Expand the order's **new** item state → diff against the order's **existing** movements (`refs.orderId`) → write only delta movements (`type: 'compensation'`, `refs.compensates` pointing at the originals). Empty diff → zero writes. Originals never rewritten.
- [ ] **2.5 Drift verify job** (§8.3)
  - `stockService.verify(bakeryId)`: per stocks doc, recompute `baselineQty + Σ movements since baselineAt`, compare to `currentStock`, report and optionally repair (repair writes an `adjustment` movement, keeping the ledger honest — never a silent cache overwrite).
  - Expose as an on-demand admin endpoint first; schedule (Cloud Scheduler) later only if drift is ever actually observed.
- [ ] **2.6 Tests for phase 2** *(the highest-value suite of the epic; ask before running)*
  - Burger-combo expansion (recipe→product→recipe→ingredients, mixed with a `unit` coke); pass-through intermediate scaling by yield; no-fallback gap on missing combination recipe; idempotent re-completion (run twice, one set of movements); un-complete reversal restores stock exactly; quantity-edit compensation writes only the delta; mundane patch (driver assigned) triggers zero stock reads/writes; runtime depth guard.
- [ ] **2.7 Frontend: gaps + negative stock**
  - Coverage matrix (1C.3) and stock view (1C.5) surface gap markers: "N ventas sin descargar inventario", linking to the order and the missing recipe.
  - Negative `currentStock` displayed prominently per the 2.1 policy (red, explanatory tooltip "ventas registradas antes de la compra — corrige con un conteo"), never blocking anything.

**Done when:** completing an order moves stock correctly for `unit` and `recipe` products at any nesting depth; editing/uncompleting/deleting compensates exactly; re-running any trigger is a structural no-op; gaps are visible and actionable; mundane order edits are provably free.

---

## Phase 3 — "Hacer inventario" (stock counts)

- [ ] **3.1 Decide role access for counts** (§12.2) — which roles may record counts (`bakery_staff`? `production_assistant`?). Needed before routes; a settings-level toggle is acceptable if clients differ.
- [ ] **3.2 `stockCountService`** (§8.3)
  - New: `src/services/stockCountService.js` + controller/routes. Count doc: `bakeries/{bakeryId}/stockCounts/{id}` — `{ status: 'draft' | 'completed', items: [{ itemKey, countedQty, unit, name }], createdBy, completedAt }`.
  - Draft lifecycle: create, update items incrementally (autosave), any number of sessions.
  - **Completion transaction, per included item:** set `baselineQty = countedQty`, `baselineAt = now`, `currentStock = countedQty` on the stocks doc + one `count` movement (`refs.countId`) via `writeMovements`. Prior movements are untouched — they stop participating because derivation only sums after `baselineAt` ("counts absorb", §8.3).
  - **Partial counts:** only items present in the count are baselined; everything else keeps its old baseline (§8.1). Completed counts are immutable (corrections = new count or adjustment).
- [ ] **3.3 Count UI** (UX §11.8 — designed as a data-entry problem first)
  - New views under `src/views/inventory/`: count list + count entry screen.
  - Item list pulled from `stocks` (filter by type/category/name), big touch-friendly numeric inputs, enter-advances, save-as-draft and resume across sessions, complete-with-summary ("contaste 14 de 32 items — los demás no cambian").
  - Show the expected (current) stock next to the input **after** entry or on demand, not before — anchoring the counter biases the count.
- [ ] **3.4 Tests for phase 3** *(ask before running)*
  - Baseline absorption: movements before completion stop affecting derived stock, movements after apply. Partial count leaves excluded items' baselines untouched. Completing twice is rejected. Drift verify (2.5) agrees with post-count state.

**Done when:** a staff member can count a shelf in minutes across interruptions, completion resets counted items to physical reality with a full audit trail, and uncounted items are unaffected.

---

## Phase 4 — "Compras" (purchasing)

- [ ] **4.1 Decide role access for purchases** (§12.2) — likely `accounting_assistant` + admins; same settings-toggle escape hatch as 3.1.
- [ ] **4.2 `purchaseService`** (§10)
  - New: `src/services/purchaseService.js` + controller/routes. Purchase doc: `bakeries/{bakeryId}/purchases/{id}` — supplier (free text now, entity later), date, payment method, lines `[{ itemKey, presentation?, presentationQty?, baseQty, unitCost, ivaDescontable?, retencion? }]`, totals.
  - **Presentation multipliers are entry-time only** ("bulto = 25000 g" → the line stores `baseQty: 25000` in the item's base unit; the presentation fields are display memory, never model conversions — roadmap units decision).
  - Saving a purchase → one `purchase` movement per line (positive qty, `unitCost` snapshot, `refs.purchaseId`) via `writeMovements`.
  - **IVA descontable / retención fields captured from day one** (roadmap accounting note: reporting can come later, the data can't be reconstructed retroactively). No tax reports in this phase — capture only.
- [ ] **4.3 Cost update prompt** (§10)
  - When a line's effective unit cost differs from the ingredient's current `costPerUnit`: optional, per-line prompt "actualizar costo de harina a $X?" → rides the existing ingredient cost-propagation chain (which now reaches product `costPrice` via 1A.8). Never automatic — purchase prices fluctuate; the user decides what the standard cost is.
- [ ] **4.4 Purchase entry UI**
  - New views under `src/views/inventory/` (or a Compras section): purchase list + entry form.
  - Same keyboard-first line-entry pattern as recipes/invoices: item search → presentation or base qty → cost → next line; live total; per-line presentation multiplier with remembered last presentation per item.
  - IVA/retención entry kept out of the fast path (collapsed section) so day-to-day speed doesn't pay for tax completeness.
- [ ] **4.5 Production entries for stocked intermediates** (§12.3 — the accepted IOU)
  - "Registrar producción" for a stocked manufactured ingredient: one compound `writeMovements` call — `+N × yield` of the intermediate, `−` its recipe components scaled by N (`type: 'production'`, shared `refs.productionId`).
  - Thin flow: pick ingredient, enter batches, preview movements, confirm. Fits here because it's the same entry-UX family; **can slip to a follow-up without blocking anything** (pass-through default means few clients hit it).
- [ ] **4.6 Tests for phase 4** *(ask before running)*
  - Purchase → movement per line in base units; presentation math applied at entry only; cost prompt updates propagate to recipes/product costs; production writes the compound movement set atomically.

**Done when:** restocking happens through Compras instead of manual adjustments, purchase costs can refresh ingredient costs on the user's say-so, IVA data accumulates from day one, and stocked intermediates can register production.

---

## Deliberately out of scope

- **Sharded stock counters** (§8.5) — only if a single business ever sustains multiple order completions per second; contained fix, not built speculatively.
- **Consumption / COGS-from-movements reports** — `unitCost` on movements (§8.2) preserves the data; reports are cheap once data exists (roadmap cross-cutting rule).
- **Balance-sheet-grade purchase accounting** (supplier entities, accounts payable) — the Accounting epic; Compras captures only the IVA fields it must not lose.
- **Cross-dimension unit conversions** (cups→grams) — permanently out (roadmap resolved decision).
