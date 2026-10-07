# Inventory Implementation Plan

Ordered steps to build the Inventory epic. Design decisions live in [INVENTORY-IMPLEMENTATION.md](./INVENTORY-IMPLEMENTATION.md) (referenced as §N below); this file is only the sequence and the concrete work items. Rules that shaped the order:

- **Every phase ends with the app working and shippable.** No phase leaves a client broken or half-migrated.
- **No step depends on an open decision.** Remaining open items (forgotten-order window §12.1, role access §12.2) are confirmed inside the step that needs them.
- **Backend before frontend inside each phase** — the frontend builds against real endpoints, not mocks.
- **All changes are additive; there is no data migration anywhere in this plan.** Existing products behave identically until someone opts them in.

Repos:
- **Backend:** `C:\Users\casal\documents\web\back\bake-ry\functions` (`src/models`, `src/services`, `src/controllers`, `src/routes`)
- **Frontend:** this repo (`src/models`, `src/services`, `src/stores`, `src/components`, `src/views`)

Phases 1–4 map 1:1 to the roadmap sub-phases. Phase 0 is pre-existing-defect hygiene. Test-writing steps are listed where they belong; **always ask before running tests** (house convention).

---

## Notes for the implementer — read before writing any code

**Always keep both documents in context.** This plan says *what*; [INVENTORY-IMPLEMENTATION.md](./INVENTORY-IMPLEMENTATION.md) says *why*. Several decisions look like things you could "simplify" — they are not oversights, they are the design. Do not deviate from them:

- **No recipe fallback.** A combination without a recipe never inherits the product's recipe. A missing recipe is a gap marker, never a guess (§2, §6).
- **No unit conversions inside the ledger, ever.** Movement quantities are always in the item's own unit; presentation math happens at entry time only (§6, §8).
- **Gaps never block sales.** Inventory failures degrade to `stockGaps` entries; an order must always be able to complete (§6).
- **`none`-mode products show zero inventory UI.** No badges, no warnings, no empty columns. Silence is the feature (§5, §11.7).

**Non-negotiable invariants** (violating any of these is the bug class that passes casual testing and corrupts ledgers weeks later):

1. **Movements are append-only.** No code path updates or deletes a `stockMovements` doc. Corrections are new `compensation` movements. There are no update/delete endpoints — don't add them "for admin convenience".
2. **Every movement write goes through `writeMovements` (1B.1).** Deduction, reversal, compensation, adjustments, counts, purchases, production — all of them. Never write a movement doc or increment a stocks doc directly anywhere else.
3. **Movement doc + `currentStock` increment land in the same Firestore transaction, always.** One without the other must be impossible.
4. **Firestore transactions read everything before writing anything.** The idempotency check (existing deterministic IDs), the `refs.orderId` lookup for compensation diffs, and the stocks-doc reads all happen first; only then the creates/increments. Interleaving reads after writes throws at runtime only sometimes — order the code correctly, don't rely on the emulator to catch it.
5. **`affectsStock(order)` and `reconcileOrderStock(order)` exist exactly once** — exported from `stockService`. Every call site (create, patch, patchAll, remove) imports them. Never inline or re-derive the logic.
6. **No "already deducted" flag on any document.** Order movements are idempotent through the diff against the order's own movements (§9); hand-entered movements and production-run receipts through deterministic ids.
7. **`itemKey` is built by one function.** Never string-concatenate keys at call sites.
8. **Recipe rows carry no cost or name.** `RecipeComponent` is pure structure (`type`, `id`, `combinationId?`, `quantity`, `unit`, `notes?`). Cost is always computed live (`recipeGraph.computeRecipeCost`) and cached only on the recipe's owner, refreshed by the propagation walk (IMPLEMENTATION §7) — never stored or defaulted onto a row. The frontend recipe editor (1C.2, still unbuilt) must fetch/compute a display cost, not read one off the row.

**Where the subtle-wrongness risk is concentrated.** Most of this plan is pattern-following inside an established codebase (models, factory services, forms, stores). These steps are not — slow down, write the tests alongside the code, and prefer asking over guessing:

- **1B.1 `writeMovements`** — the primitive everything else trusts. Get invariants 3, 4, 6 exactly right here and every later phase inherits correctness.
- **Expansion and order reconciliation** (milestones 2–3) — recursive expansion with pass-through yield scaling, `reconcileOrderStock` threaded through `orderService` (the most business-critical existing service; its current behavior for non-inventory orders must be provably unchanged). The build plan's test list is the correctness contract — implement those tests from their descriptions, not from what the implementation happens to do.
- **`patchAll`** — one reconcile transaction per order. Piggybacking onto the shared 500-op batch is the tempting shortcut that breaks at exactly the wrong scale.
- **Cost propagation's accepted gaps (1A.8, amended in `a905fea`)** — a recipe reached twice in one walk ("diamond") only re-costs on the first hit; a product's cost change doesn't propagate on to recipes that use that product as a component. Both are deliberate, ponytail-tagged debt (backend `tech-debt.md`) with `reconcileOwnerCost` as the backstop — know they exist before treating a stale cached cost as a bug.

---

## Phase 0 — Hygiene (backend, small, independent)

Standalone fixes that reduce risk before anything is built on top. No frontend work.

- [x] **0.1 Fix the dead ingredient-deletion guard** (§1.1)
  - File: `src/services/ingredientService.js` → `remove()`.
  - Replace the `where('ingredients', 'array-contains', ingredientId)` query (never matches — `recipe.ingredients` holds objects) with a check on the ingredient doc's own `usedInRecipes` array (already maintained by `recipeService`).
  - Error message must name the blocking recipes so the user can act ("Usado en: Torta 500g, Croissant…").
- [x] **0.2 Retire `Ingredient.currentStock` reads/writes** (§1.3)
  - Files: `src/models/Ingredient.js` and any service/frontend spot that displays or sets it.
  - Do not delete the field from stored docs; simply stop reading/writing it. ~~Remove from the model constructor on the next natural touch (1A.5).~~ Done here instead — it was one line in each model plus the (non-functional) "Stock Actual" input in `IngredientForm.vue`; splitting it across two phases cost more than doing it. **1A.5's constructor removal is therefore already complete.**

**Done when:** deleting an in-use ingredient returns a clear, named error; a repo-wide grep for `currentStock` shows no live read/write paths (outside the new `stocks` docs built in 1B).

---

## Phase 1 — Recipes & stock model

The largest phase. Three tracks: **1A** recipe/model generalization (backend), **1B** ledger foundation (backend), **1C** frontend. 1A and 1B are independent of each other and can be built in parallel; 1C consumes both. All three must land before phase 2.

### 1A — Recipe & model generalization (backend)

- [x] **1A.1 `Product.inventoryMode`** (§5)
  - File: `src/models/Product.js`.
  - Add `inventoryMode: 'none' | 'unit' | 'recipe'`, default `'none'` in the constructor so every existing doc reads as `'none'` without migration. Validate the enum in the service layer.
  - No behavior attaches to the field yet — this step is model + validation only.
- [x] **1A.2 `Combination.recipeId`** (§2)
  - File: `src/models/Combination.js`.
  - Add nullable `recipeId`, defaulting `null`. Combinations are embedded in the product doc, so this rides existing product writes — no new endpoints.
- [x] **1A.3 Recipe owner generalization** (§2, §4)
  - Files: `src/models/Recipe.js`, `src/services/recipeService.js`.
  - Keep `productId` (existing recipes untouched). Add nullable `combinationId` and `ingredientId`. Validation: **exactly one owner** — `productId` alone (no-variations product), `productId + combinationId` (combination-owned), or `ingredientId` alone.
  - Add `yield` (number, in the owning ingredient's base unit): **required iff ingredient-owned, forbidden otherwise**.
  - Recipe resolution helper (used by costing now, deduction in phase 2): `resolveRecipeId(product, combinationId)` → `product.hasVariations ? combination.recipeId : product.recipeId`. **No fallback** from combination to product (§2).
- [x] **1A.4 Typed components** (§3)
  - Files: `src/models/Recipe.js` (replace/extend `RecipeIngredient`), `src/services/recipeService.js`.
  - `RecipeComponent { type: 'ingredient' | 'product', id, combinationId?, quantity, unit, notes? }` — pure structure, no stored cost or name.
  - **Amended in `a905fea`**: the original `name, costPerUnit` denormalized snapshots and the legacy `ingredientId` read/write compat shim were both removed outright — no production data ever depended on either, and cost is now always computed live, never defaulted or copied onto the row (IMPLEMENTATION §7).
  - `combinationId` required when `type: 'product'` and the target product has variations (a product component must resolve to a sellable unit).
  - Relationship maintenance: extend the existing ingredient↔recipe bookkeeping (`usedInRecipes`) to also track **product** components (either a `usedInRecipes` array on products or an equivalent reverse index) — the deletion guards in 1A.7 need it.
  - Recipe versioning (`src/services/versioning/recipeVersioning.js`) must snapshot the new component shape unchanged — verify, no redesign expected.
- [x] **1A.5 Ingredient recipe + stock behavior** (§4)
  - File: `src/models/Ingredient.js`.
  - Add optional `recipeId` (any ingredient may have one — `isResale` is retired, reventa is `Product.inventoryMode: 'unit'`) and `stockBehavior: 'passThrough' | 'stocked'`, default `'passThrough'`.
  - Remove `currentStock` from the constructor (completes 0.2).
- [x] **1A.6 Save-time guardrails in `recipeService`** (§6)
  - **Cycle detection**: on every recipe create/update, walk the full component graph (product→product, product→ingredient-with-recipe, ingredient→ingredient chains are all expressible). Reject with a message naming the cycle path.
  - **Depth cap 5**: reject a save whose expansion graph exceeds depth 5. This is what makes phase-2 write fan-out provably bounded.
  - **Unit discipline**: component `quantity` is always in the component's own unit (ingredient base unit / product sellable units); reject mismatched units at save time. No conversions, ever (§6, roadmap units decision).
- [x] **1A.7 Widened deletion guards** (§6)
  - Recipe deletion: block if referenced by any `product.recipeId` **or** any `combination.recipeId` **or** any `ingredient.recipeId` (current check only covers products).
  - Product deletion: block if the product is a component of any recipe (uses the reverse index from 1A.4).
  - Ingredient deletion: already fixed in 0.1.
- [x] **1A.8 Costing propagation** (§7, closes defect §1.2)
  - Files: `src/services/recipeGraph.js` (the walk), `src/services/recipeService.js`, `src/services/ingredientService.js`.
  - **Amended in `a905fea`**: there is no stored `Recipe.totalCost` to read — `recipeGraph.computeRecipeCost` computes a recipe's cost live from each component's own source doc, then **one propagation walk** pushes it to the owner's cache (`product.costPrice` / `combination.costPrice` / `ingredient.costPerUnit`), **only when** `costPriceSource === 'recipe'` — a manual override is never silently clobbered.
  - Entered from either side: recipe created/quantities change → recompute → push to owner, continuing outward if the owner is a manufactured ingredient; or an ingredient's cost changes directly → walk every consuming recipe (`usedInRecipes`) → recompute → push, continuing outward. Same mechanism covers both — no separate "ingredient→recipe propagation" machinery.
  - Guard against propagation loops: the cycle check (1A.6) guarantees the graph is acyclic; `MAX_DEPTH` is a runtime backstop.
  - **Shipped alongside this step**: `GET /ingredients/:id/cost-impact` (read-only dry-run preview of a cost change's fan-out) and `POST /recipes/reconcile-costs` (admin, on-demand drift correction for one owner).
  - The income statement's costPrice waterfall (`orderService.getIncomeStatement`) consumes the result unchanged — verify, don't modify.
- [x] **1A.9 Tests for 1A** *(write here; ask before running)*
  - Cycle rejection (direct and 3-hop), depth-cap rejection, exactly-one-owner validation, yield required/forbidden, deletion guards (all three), two-hop cost propagation (ingredient → crema recipe → crema `costPerUnit` → torta recipe → combination `costPrice`), manual `costPriceSource` never overwritten.

### 1B — Ledger foundation (backend)

- [x] **1B.1 `stockService` core: collections + the one write primitive** (§8)
  - New file: `src/services/stockService.js` (+ `stockController`, `stockRoutes` following the factory patterns).
  - Collections: `bakeries/{bakeryId}/stocks/{itemKey}` (StockDoc, §8.1) and `bakeries/{bakeryId}/stockMovements/{movementId}` (StockMovement, §8.2). `itemKey` builder: `ingredient_{id}` | `product_{id}` | `product_{id}_{combinationId}` — one function, used everywhere, never hand-built.
  - **The primitive everything else calls:** `writeMovements(bakeryId, movements[], { transaction? })` — inside one Firestore transaction: for each movement, create the movement doc (deterministic ID when provided, else generated) and `FieldValue.increment(qty)` the matching stocks doc's `currentStock`. Accepts an outer transaction so phase 2 can run it inside the order transaction.
  - Idempotency contract: before creating, read deterministic-ID docs; existing ID → skip both the create and the increment (structural no-op, §8.2).
  - Movements are append-only: no update or delete endpoints exist, period.
- [x] **1B.2 Stocks doc lifecycle** (§8.1)
  - Created when an item opts into tracking: product switched to `inventoryMode: 'unit'` (one doc per sellable unit — per combination if variations), ingredient switched to `stocked`. Hook into `productService.update` / `ingredientService.update`.
  - Initialized with `currentStock: 0, baselineQty: 0, baselineAt: now` and denormalized `name`/`unit`. Name/unit refresh on source rename (cheap, same update path).
  - Never auto-deleted — switching back to `none` orphans the doc harmlessly (history intact); hidden in UI when the item is no longer tracked.
- [x] **1B.3 Read endpoints**
  - `GET /bakeries/:bakeryId/stocks` — list (the backbone for the stock view, coverage UI, and phase-3 counts). Supports the existing query system (filter by itemType, name).
  - `GET /bakeries/:bakeryId/stocks/:itemKey/movements` — per-item history (`itemKey + timestamp desc`, paginated).
  - `GET /bakeries/:bakeryId/stockMovements?orderId=…` — all movements of one order (phase-2 compensation + audit).
- [x] **1B.4 Manual adjustment endpoint**
  - `POST /bakeries/:bakeryId/stocks/:itemKey/adjust` → one `adjustment` movement (signed qty, required `reason`, editor from token) via `writeMovements`.
  - Purpose: makes the ledger usable and hand-testable end-to-end before deduction/counts/purchases exist; remains the permanent escape hatch.
- [x] **1B.5 Firestore indexes** (§8.2)
  - Composite: (`itemKey` asc, `timestamp` desc) and (`type` asc, `timestamp` desc) on `stockMovements`; single-field on `refs.orderId`.
  - Add to the backend's `firestore.indexes.json` and deploy with the phase.
- [x] **1B.6 Tests for 1B** *(write here; ask before running)*
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
  - **Amended note (invariant 8):** rows have no stored cost — the live cost/margin readout must call a live-compute path. The backend only ships the ingredient-cost-impact preview (`GET /ingredients/:id/cost-impact`); the matching per-keystroke preview for *recipe-quantity* edits doesn't exist yet (tracked in backend `bake-td.md`, "Later"). Until it ships, this step either computes client-side from already-fetched component costs or blocks on that endpoint — decide when building.
  - Inline ingredient creation (§11.4): unknown name → "crear ingrediente" in place, three fields (name, unit, cost), no navigation.
  - Totals sanity check (§11.6): when adopting a computed cost over a manual one, show both ("tu costo manual dice 3.500, la receta dice 4.200") with an explicit choice; wires to `costPriceSource` (1A.8).
- [ ] **1C.3 Combination-level recipes: coverage matrix + copy-and-scale** (UX §11.2, §11.3)
  - Coverage matrix on the product detail/edit view: grid of combinations × (has recipe? / cost source / margin). One glance shows what's missing. (Phase 2 adds sale gap markers to this same surface.)
  - Copy-and-scale creation: "Start from: [another combination's recipe / another product's recipe / blank]" with scale factor pre-filled from the dimension option's `value` ratio (500g → 1000g suggests ×2); user adjusts non-linear lines before saving. "Apply to all combinations sharing this option" creates **independent editable copies** — entry-time assist, never a stored link (§2).
- [ ] **1C.4 Ingredient form: production extras** (§4)
  - File: `src/components/forms/IngredientForm.vue`.
  - For any ingredient: optional recipe (opens the same editor from 1C.2, ingredient-owned) with **mandatory yield** ("esta receta produce ___ {unit}"), and the pass-through/stocked toggle explained in plain language ("¿Llevas inventario de esta preparación?" — default no/pass-through).
  - When a recipe exists, `costPerUnit` displays as computed (derived via yield, 1A.8) with manual override.
- [x] **1C.5 Stock view** (first visible inventory screen)
  - New: `src/views/inventory/` + route (admin sidebar entry), backed by the `stocks` list endpoint via `stockStore`.
  - DataTable of tracked items: name, unit, `currentStock`, last movement date. Row → movement history (paginated from 1B.3). Manual adjustment dialog (signed qty + reason → 1B.4).
  - **Per-item movement summary for a date range**: totals grouped by movement `type` — comprado / consumido / ajustes / conteos. This is the "bought vs consumed vs lost" view users actually want (design doc §11.9); it's one `(itemKey, timestamp)` query grouped client-side by type. Ships with the stock view but only becomes fully meaningful once counts (phase 3) and purchases (phase 4) feed it — that's fine, the UI doesn't change.
  - This screen validates the entire ledger end-to-end by hand before any automation exists.

**Done when:** a client can define combination-level recipes with products and ingredients as components; computed costs flow to `costPrice` and the income statement; production ingredients carry recipes with yield; items opt into tracking and their stock is adjustable and auditable by hand. Nothing deducts automatically yet, and clients who ignore all of it see nothing new.

---

## Phases 2–4 — replaced

The remaining work (providers + Ingreso, production runs, orders + availability, Conteo) is sequenced as milestones in [inventory-next-steps.md](./inventory-next-steps.md) §7 and traced step by step in `INVENTORY-BUILD-PLAN.md`.

---

## Deliberately out of scope

- **Sharded stock counters** (§8.5) — only if a single business ever sustains multiple order completions per second; contained fix, not built speculatively.
- **Consumption / COGS-from-movements reports** — `unitCost` on movements (§8.2) preserves the data; reports are cheap once data exists (roadmap cross-cutting rule).
- **Accounts payable** (what is owed to a provider, due dates, payments) — the balance-sheet phase.
- **Cross-dimension unit conversions** (cups→grams) — permanently out (roadmap resolved decision).
