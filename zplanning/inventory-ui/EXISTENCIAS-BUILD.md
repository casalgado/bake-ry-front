# Existencias · "La Bodega" — implementation handoff

Builds `existencias-prototype.html` in this folder. Design decisions live in
[README.md](./README.md) §"View 2"; the data model's *why* is in
[../strategy/INVENTORY-IMPLEMENTATION.md](../strategy/INVENTORY-IMPLEMENTATION.md)
and the epic sequence in [../inventory-next-steps.md](../inventory-next-steps.md)
(this covers Fase C, plus E and F brought forward).

Written for someone with no context on the conversation that produced it. Read
§0 and §1 before touching anything; they are the difference between building
this and building something that looks like it.

---

## 0. What you are building, and why

Replace `src/views/inventory/ShowStock.vue` — today a `DataTable` of stock rows
with a Headless UI adjustment dialog — with the full Existencias screen from
`zplanning/inventory-ui/existencias-prototype.html`.

The screen answers two questions and refuses the rest: **what do we have right
now, and is that number true?** Not planning, not purchasing decisions, not
reorder alerts.

**The invariant the entire screen is shaped by:** the number on screen is never
editable. It is derived from an append-only ledger. You record *what happened*
and the number moves. This is why Conteo asks what's on the shelf and never asks
for the difference, and why there is no "set stock to" field anywhere.

Four tabs:

| Tab | What it is | Backend state |
|---|---|---|
| **Bodega** | permanent, never closes. A place, not a task. | **exists** |
| **Ingreso** | lo que llega de afuera (compras) | build in commit 3 |
| **Producción** | lo que hacemos (productos y preparaciones) | build in commit 2 |
| **Conteo** | el físico | build in commit 4 |

Layout rule locked across both inventory views (Recetario does the same):

> **Left is always the thing you're building. Right is always where you take
> things from.** Mesa/despensa there; documento/bodega here.

### Required reading before you write code

1. `zplanning/inventory-ui/README.md` §"View 2" — the design decisions, the
   locked vocabulary, and what was deliberately skipped.
2. `zplanning/inventory-ui/existencias-prototype.html` — open it in a browser.
   It is a **layout and interaction** prototype, not the styling target.
3. `zplanning/strategy/INVENTORY-PLAN.md` — "Notes for the implementer", and
   phases 3 and 4.
4. `zplanning/strategy/INVENTORY-CORRECTIONS.md` §1 (bodegas), §2.3
   (producir para stock), §3 (bajas).
5. `src/assets/ui/CLAUDE.md` — the design system's rules. Non-negotiable.
6. `src/views/recipes/RecipeBookView.vue` — the sibling screen. Its shell, its
   drag-and-drop, its dirty-tab guards and its cost join are the patterns to
   follow; do not invent new ones next to it.

### House rules (from `CLAUDE.md`, they override defaults)

- Vue SFC section order is **always** `<script setup>`, then `<template>`, then
  `<style scoped>`.
- **Ask before running any test.** Every time, including mid-task.
- **Never touch git** — no commits, no branches — unless asked.
- Code and stored data are **English**; Spanish is for user-facing copy only.
  `warehouseId` in code, "bodega" on screen. Same for movement reasons:
  `damaged` stored, "dañado" rendered.
- The dev server is always running; don't offer to start it.

---

## 1. Invariants you can break silently

These come from `INVENTORY-PLAN.md`. Violating one produces code that passes
casual testing and corrupts ledgers weeks later.

1. **Movements are append-only.** No code path updates or deletes a
   `stockMovements` doc. Corrections are new movements. Do not add an
   update/delete endpoint "for admin convenience".
2. **Every movement write goes through `writeMovements`** (backend
   `stockService.js`). Never write a movement doc or touch a stocks doc's
   `currentStock` directly, anywhere, for any reason.
3. **Movement doc + `currentStock` increment land in the same transaction.**
4. **Firestore transactions read everything before writing anything.** A walk
   that reads an unbounded number of docs must therefore happen *outside* the
   transaction (see `assertGraphIsSane` in `recipeGraph.js` for the precedent).
5. **`itemKey` and `buildStockDocId` are built by one function each**
   (`stockService.js:66` and `:89`). Never concatenate a key at a call site.
6. **Deterministic ids are the idempotency mechanism** — never an "already
   done" flag on a document.
7. **No unit conversions in the ledger, ever.** A purchase's "bulto = 25000 g"
   is entry-time math; the line stores `baseQty: 25000` in the item's own unit.
8. **Recipe rows carry no cost or name.** Cost is computed live and cached only
   on the recipe's owner.
9. **Inventory never blocks a sale.** Failures degrade to gap markers.
10. **`inventoryMode: 'none'` items show zero inventory UI.** Silence is the
    feature. They have no stocks doc, so this is free — just never special-case
    them back in.

---

## 2. What already exists (do not rebuild it)

### Backend — `C:\Users\casal\documents\web\back\bake-ry\functions`

`src/services/stockService.js` is built and tested:

- `buildItemKey`, `buildStockDocId`, `resolveWarehouseId`, `getWarehouses`
- `writeMovements(bakeryId, movements[], { transaction })` — the one primitive
- `syncStockDoc` / `syncProductStockDocs` / `syncIngredientStockDoc`
- `getStocks`, `getStock`, `getItemMovements`, `getOrderMovements`
- `adjust`, `waste`, `transfer`
- `retryId(idempotencyKey, prefix)` — the retry contract for hand-entered
  movements. **Reuse it** for the three new endpoints; do not invent a second.
- `MOVEMENT_TYPES`: sale, purchase, count, adjustment, production,
  compensation, transfer, waste.

Live routes (`src/routes/stockRoutes.js`): `GET /stocks`,
`GET /stocks/:itemKey/movements`, `GET /stockMovements?orderId=`,
`POST /stocks/:itemKey/adjust`, `.../waste`, `.../transfer`.
Reads are `requireBakeryAssistant`, writes `requireBakeryStaffOrAdmin` —
match this for anything new.

`src/services/recipeGraph.js` owns the recipe graph: `resolveRecipeId`,
`normalizeComponent`, `MAX_DEPTH`, `assertGraphIsSane`, `computeRecipeCost`,
cost propagation.

### Frontend

- `src/services/stockService.js` + `src/stores/stockStore.js` — `fetchAll`,
  `getMovements`, `adjust`. Missing `waste`, `transfer`, `produce`.
- `src/assets/ui/tokens.css` + `ui.css` — the whole design system.
- `/system-admin/ux` (`src/views/SystemAdmin/UxView.vue`) — the live gallery.
  **It is the documentation.**
- `src/views/recipes/RecipeBookView.vue` — the reference implementation.
- `src/components/ui/PageHeader.vue` — the only `ui-*` component so far.
- `formatMoney` in `src/utils/helpers.js`.

### Facts that will bite you

- **Stores hand back raw API objects, not model instances.** `createResourceStore`
  → `BaseService.getAll` does no mapping. So `ingredient.recipeId` and
  `ingredient.stockBehavior` work fine even though `src/models/Ingredient.js`
  doesn't declare them. Don't "fix" the model to make them appear.
- **Stock docs carry no cost.** `stockDocSeed` has `itemKey, warehouseId,
  itemType, ids, name, unit, currentStock, baselineQty, baselineAt`. Any value
  in pesos must be joined client-side (§3.1).
- **Stock docs are per (item, warehouse).** Two bodegas = two docs for one item.
- **The ledger is empty in dev and prod.** There is no
  `stockBehavior: 'stocked'` toggle in `IngredientForm.vue` yet — that is Fase
  B2 and out of scope here. To get test data, `PATCH` an ingredient with
  `{ stockBehavior: 'stocked' }` or write the field in the emulator; the
  backend then creates its stocks doc.
- `custom-components.css` puts padding on every bare `button`, and
  `[data-ui-theme] button` outranks `.ui-btn`. Every icon-only button must
  reset its own margin and padding or the icon collapses to a dot.

---

## 3. Commit 1 — the entire UI, no backend changes

The whole screen is built and reviewable in the browser before an endpoint is
written. This works because only the **writes** are missing: the catalogs, the
stock numbers, the shelves, the drag, the line math and the totals are all live
data today.

**The trade, so you don't get it wrong later:** the request payloads get written
before the endpoints exist, so the backend ends up matching the UI. That is only
acceptable because §4 fixes those shapes from the strategy docs. If a payload
turns out wrong when you build the endpoint, **the UI changes** — the ledger
schema never bends to a screen.

### 3.1 `src/composables/useItemCatalog.js` (new)

The join four call sites need: *given `{ type, id, combinationId }`, what is it
called and what does it cost?*

`RecipeBookView.vue:212-229` (`resolveLine`) already does exactly this walk;
lift it, and leave a three-line adapter behind in that file.

```
combosOf(product)          → product.hasVariations ? combinations : [product]
nameOf({type,id,combinationId})
costOf({type,id,combinationId})
  ingredient → ingredient.costPerUnit
  product    → combinationId ? combination.costPrice : product.costPrice
```

Backed by two id→doc Maps over `ingredientStore.items` / `productStore.items`.
Consumers: Bodega row values and the hero total, Ingreso's suggested unit cost,
Producción's line values, Conteo's item list.

**Unresolved cost returns `null`, and the UI renders `—`, never `$0`.** A
missing join and a genuinely free item must not read the same.

### 3.2 `src/components/ui/UiSearchField.vue` (new)

`src/assets/ui/CLAUDE.md` rule 9 says extract on the **second** new screen, and
this is it. Wraps the `.ui-search` div, the input (`type="text"` — not
`type="search"`, the native clear button can't be tinted), `role="searchbox"`,
`enterkeyhint`, the Escape-to-clear handler and the clear button.

Migrate `RecipeBookView.vue` (two call sites) and `UxView.vue` (one) in the
same commit — rule 10: a class not in the gallery does not exist, and the
gallery must not drift from the real component.

### 3.3 Frontend service + store additions

`src/services/stockService.js` gains `waste`, `transfer` and `produce`,
mirroring `adjust` (same try/catch/`handleError` shape):

```
waste(itemKey,    { qty, reason, note, warehouseId, idempotencyKey })
transfer(itemKey, { qty, fromWarehouseId, toWarehouseId, idempotencyKey })
produce(          { lines, warehouseId, idempotencyKey, preview })
```

`src/stores/stockStore.js` gains matching wrappers that refetch stocks after a
write, exactly as `adjust` already does.

`produce` is written now but its endpoint arrives in commit 2 — the button
that would call it stays disabled until then.

### 3.4 The view — four files

`RecipeBookView.vue` is 1330 lines for *one* tab pair. This is four, so it
splits:

| File | Holds |
|---|---|
| `views/inventory/ShowStock.vue` | the shell: tab rail, open-document state, dirty guards, which pane component renders |
| `components/inventory/BodegaPanes.vue` | left shelves + right item detail, history, type summary, and the three inline forms |
| `components/inventory/EntryDoc.vue` | Ingreso **and** Producción — same layout, a `kind` prop switching shelves, whether lines carry `unitCost`, and the confirm call. The prototype already unifies them (its `KIND` map) |
| `components/inventory/CountDoc.vue` | Conteo: single column, progress bar, expected-after-entry, completion summary |

Delete `src/components/inventory/StockMovementsModal.vue` — the right pane
replaces it and `ShowStock.vue` is its only consumer.

Route (`src/router/index.js:71-75`) and the sidebar entry are unchanged: same
path, same file, new screen.

### 3.5 UI element mapping

Every class below already exists. **No new `ui-*` class is required.**

| Prototype | `ui-*` |
|---|---|
| `.rail` / `.tab` / badge / dot / × | `ui-tabs` `ui-tab` `ui-tab-badge` `ui-tab-dot` `ui-tab-close` |
| `.app` / `.cols` / `.col.right` | `ui-app` `ui-panes` (`--panes` per instance) `ui-pane` `ui-pane-sunken` |
| `.vault` hero + acciones | `ui-stat ui-stat-hero` + a `ui-btn` row (`ui-btn-solid` for the one thing you came to do) |
| `.shelf h3` | `ui-sectionhead` |
| `.srow` / `.zero` / `.neg` | `ui-item` (+`aria-current`) / `ui-item-zero` / `ui-item-negative` |
| `.mv` history row | `ui-item ui-item-divided` — the gallery's "Como historial" card |
| `.doc` dropzone + `.line` | `ui-dropzone` (+`ui-dropzone-over`) + `ui-item ui-item-filled` |
| `.item` draggable chip | `ui-chip ui-chip-draggable` (+`ui-chip-dragging`) |
| `.qty` / `.field` | `ui-input ui-input-num` / `ui-field` + `ui-field-k` |
| `.progress` (conteo) | `ui-bar` with `style="--fill: 42%"` |
| `.empty` | `ui-empty` |
| `.bump` / `.flash` | `<TransitionGroup name="ui-cascade">` with `:style="{'--i': i}"` |

**Deliberate departures from the prototype — these are not oversights:**

- **No state colors.** The prototype paints negatives red and `+` green. Rule 5
  forbids it: negative gets `ui-item-negative`'s soft wash, and `+`/`−` carry
  the sign and nothing else.
- **No hover lift.** `.abtn:hover{transform:translateY(-1px)}` becomes a
  surface step (rule 6). Hover never moves anything.
- **Row accent spines** (`.line.prep` / `.line.prod`) become a leading `ui-tag`
  — the same `ingr`/`prep`/`prod` tag `RecipeBookView` uses, so both views name
  component kinds identically.
- **The three item actions are inline forms, not modals.** There is no
  `ui-modal` and one screen doesn't earn the first one (see the ruling at
  `RecipeBookView.vue:790`). Picking Ajustar / Baja / Transferir replaces the
  history list in the right pane and returns to it on save or cancel.

### 3.6 Bodega tab — fully live

Left pane (`ui-pane`):

- `ui-panehead`: "Bodega" / "N artículos".
- `ui-stat ui-stat-hero`: **Valor en bodega** (Σ `currentStock × costOf(item)`).
- The three work-tab buttons: Ingreso (`ui-btn-solid`), Producción, Conteo.
- `UiSearchField` for name filtering (client-side; the list is tens of rows and
  is already in memory for the shelves and the total).
- Three shelves as `ui-sectionhead`: **Ingredientes · Preparaciones ·
  Productos**. Split rule, identical to `RecipeBookView.vue:198-203`: an
  ingredient **with** `recipeId` is a *preparación*, without one an
  *ingrediente*; `itemType: 'product'` is a *producto*.
- Rows: `ui-item` + `aria-current`, title, `ui-item-num` + `ui-unit` for the
  quantity, `ui-item-meta` for the value. `ui-item-zero` at 0,
  `ui-item-negative` below 0.

Right pane (`ui-pane ui-pane-sunken`):

- `ui-panehead`: item name / `qty unit · valor · costo por unidad`.
- `ui-stat ui-stat-hero` **Existencia**, then a `ui-btn` row: Ajustar,
  Registrar baja, Transferir (multi-bodega only).
- Movement summary by type — comprado / consumido / producción / ajustes /
  bajas / conteos. The grouping already exists at
  `StockMovementsModal.vue:50-64`; move it here rather than rewriting it.
- History as `ui-item ui-item-divided` rows: date, why (type label + `reason`
  or `refs`), signed quantity.
- `ui-empty` for no selection and for no movements.

**Multi-bodega gating.** Read
`bakerySettingsStore.items[0].features.inventory.warehouses` (defaults to one
`{ id: 'main', name: 'Principal', isDefault: true }`). `warehouses.length > 1`
is the **single** flag that reveals: the bodega filter chips, the per-bodega
expander under an item row, the Transferir action, and a document's destination
picker. With one bodega the screen must contain no trace of the concept — this
is locked in CORRECTIONS §1. Group left-pane rows by `itemKey`, summing
`currentStock`; with one bodega every group has one member and the expander
never renders.

### 3.7 The three work tabs — complete, `Confirm` disabled

Build them fully: real chips from the real catalogs showing real current stock,
drag and click-to-add, editable quantities, live totals, the meta fields.

`Confirm` is disabled behind one `ponytail:` comment per tab naming the endpoint
it waits on (`POST /stocks/produce`, `POST /purchases`, `POST /stockCounts`).
**Nothing fakes a write.** In particular: do not route Ingreso or Producción
through the existing `adjust` endpoint to "make it work" — that writes
`adjustment` movements for events that are purchases and production, and an
append-only ledger cannot be re-tagged afterwards. It would corrupt the merma
report permanently.

Tab labels carry progress (`Ingreso 3`, `Conteo 34/60`) via `ui-tab-badge` and
unsaved state via `ui-tab-dot`, so parked work is legible without opening it.

**Dirty guards**: copy the trio at `RecipeBookView.vue:786-814` —
`beforeunload`, `onBeforeRouteLeave`, and a `confirm()` on tab close.

Two limitations of this commit, both erased by commits 2-4. Say them out loud
in the PR:

- **Producción shows no preview.** The expansion walk belongs in the backend
  (§4.1) and Fase D deduction inherits it; a second copy in JS to fill a
  temporary gap is duplication of the most correctness-critical logic in the
  epic. The tab lists its output lines and says components appear on preview.
- **Conteo is session-only**, because drafts are server-side. Fine for review,
  **not shippable**: a count a reload can destroy is the exact failure the
  tab-instead-of-modal design exists to prevent.

---

## 4. Commits 2-4 — one backend each, then wire the tab up

Backend before the frontend that consumes it. Role access matches the existing
stock routes. Tests are written where noted and **never run without asking**.

### 4.1 Commit 2 — Producción

**`expandComponents` in `stockService.js`** — the recursive rule of
IMPLEMENTATION §6, extracted once, because Fase D's `expandOrderItem` is a thin
wrapper over it later:

```
expandComponents(bakeryId, { type, id, combinationId }, qty, warehouseId)
  product 'none'                      → nothing
  product 'unit'                      → −qty of the sellable unit. STOP.
  product 'recipe'                    → resolveRecipeId (NO fallback) → recurse ×qty
                                        missing recipe → gap, never a guess
  ingredient 'stocked'                → −qty in base units. STOP.
  ingredient 'passThrough' + recipe   → recurse into it, scaled by qty / yield
  ingredient 'passThrough', no recipe → NOTHING, and not a gap
```

That last line is the one easy to get wrong. `passThrough` is the **default**,
so most plain purchased ingredients are passThrough with no recipe — deducting
nothing for them is the correct, deliberate configuration ("no llevo inventario
de la harina"), not a failure. A gap means *a movement that should have happened
couldn't resolve how*, which is the missing-product-recipe case only. Confusing
the two floods the gap surface with noise on day one.

Runtime `MAX_DEPTH` guard mirroring the save-time cap. Reads happen **outside**
any transaction (invariant 4) — expand first, then `writeMovements`.

Export `resolveRecipeId`, `normalizeComponent` and `MAX_DEPTH` from
`recipeGraph.js` (all three module-local today, `recipeGraph.js:18-52`) rather
than re-deriving them. Recipe resolution must exist once, or deduction reads the
graph differently from how the cycle check validated it.

**`produce()`** — no document and **no new service**; §4.5 of the plan is
explicit that this is one compound `writeMovements` call, and a
service/controller/routes trio around forty lines with no document of its own is
ceremony. It lives beside `adjust` and `waste`.

```
produce(bakeryId, { lines: [{ item, qty }], warehouseId, idempotencyKey, preview })
```

Expand every line; concatenate `+output` with the `−component` movements;
`type: 'production'`; shared generated `refs.productionId`. `preview: true`
returns the movement list **without writing** — one endpoint, two uses, and the
preview provably matches confirm because it is the same code path. Reuse
`retryId`. Reject producing a `none`-mode product: it holds no stocks doc, so
there is nothing for the output to land in.

Route: `POST /bakeries/:bakeryId/stocks/produce`.

**Tests:** nested product→recipe→product→ingredient expansion; pass-through
yield scaling; missing recipe → gap not a guess; depth guard; preview writes
nothing; confirm writes output and components atomically; same
`idempotencyKey` twice → one set of movements.

**Then the frontend:** turn on the preview panel and `Confirm` in `EntryDoc.vue`.

### 4.2 Commit 3 — Ingreso

`src/models/Purchase.js` extending `BaseModel`: `supplier` (free text — **not**
an entity, that's the balance-sheet epic), `date`, `warehouseId`,
`paymentMethod`, `lines[{ itemKey, item, presentation, presentationQty,
baseQty, unitCost }]`, `subtotal`/`total`, and the flat tax scalars named
**exactly** as `AccountingEntry` names them — `ivaAmount`, `retefuente`,
`reteica`, `reteiva` — so a future IVA report is a union with zero translation.

Tax fields are captured from day one even though nothing reports on them yet:
reporting can be added later, the data cannot be reconstructed retroactively.
Keep them in a collapsed section, off the fast path.

`purchaseService.js` on `createBaseService('purchases', Purchase,
'bakeries/{bakeryId}')` (see `productCollectionService.js` for the shape),
overriding `create` to also write one `purchase` movement per line — positive
qty, `unitCost` snapshot, `refs.purchaseId` — via `writeMovements` **inside the
same transaction**. No update or delete of a posted purchase.

**Presentation is entry-time only** (invariant 7): the line stores `baseQty` in
the item's own unit; `presentation`/`presentationQty` are display memory the
ledger never has to interpret.

**Cost prompt**: when a line's unit cost differs from the item's current cost,
offer "¿actualizar el costo de harina a $X?" per line. Accepting calls
`ingredientService.update({ costPerUnit })`, which already triggers cost
propagation. **Never automatic** — purchase prices fluctuate; the user decides
what the standard cost is.

**Tests:** movement per line in base units; presentation math never reaches the
ledger; accepting the prompt propagates to recipes and product costs.

### 4.3 Commit 4 — Conteo

`src/models/StockCount.js`: `{ status: 'draft' | 'completed', warehouseId,
items: [{ itemKey, name, unit, countedQty, expectedQty }], createdBy,
completedAt }`. A count is scoped to **one bodega** — you physically count one
place at a time.

`stockCountService.js`: draft lifecycle on the factory (create, patch items
incrementally for autosave, any number of sessions).

**`complete()` — one transaction, all reads before any write:** per included
item set `baselineQty = countedQty`, `baselineAt = now`,
`currentStock = countedQty`, plus one `count` movement (`refs.countId`) via
`writeMovements`. Prior movements are **untouched** — they stop counting because
derivation only sums after `baselineAt`. This is what "counts absorb" means;
don't try to reverse anything.

**Partial counts:** items absent from the count keep their old baseline.
Completing an already-completed count is rejected; corrections are a new count.

`explainedWaste`: Σ `waste` movements for the item since its last `baselineAt`,
returned with the completion summary so the UI can split merma **explicada**
from **no explicada** (the residual). That split is the whole reason `waste` is
a separate movement type from `adjustment`.

**UI:** show the expected quantity **after** entry or on demand, never before —
anchoring the counter biases the count. Completion summary reads "contaste 14 de
32 items — los demás no cambian".

**Tests:** baseline absorption (movements before vs after completion); partial
count leaves other items' baselines untouched; double completion rejected.

---

## 5. Deliberately not built

Each of these was considered and rejected; don't add them without a reason that
has changed.

- **A Compras list page.** The Ingreso tab is the entry point; a list of past
  purchases waits until someone needs to look one up.
- **Reorder points / "stock bajo".** There is no `minStock` in the model, so
  "bajo" is undefinable. Only *cero* and *negativo* are honest.
- **A Salida tab.** A merma is one line — an action on an item, not a workspace.
- **Editing a confirmed document.** Corrections are new movements.
- **Server-side stock search/filter.** `getStocks` supports it; the list fits in
  one fetch and is already in memory.
- **A `formatQty` helper.** `ui-unit` + `toFixed(3)` at the call site until a
  second consumer exists.
- **A `ui-modal`.** Inline forms; revisit on the third screen that wants one.
- **Blocking anything on negative stock.** Allowed, displayed, never blocked —
  a sale registered before its purchase is real information, and a count
  corrects it.

---

## 6. Verification

Dev server is already running. The backend needs `npm run serve` (emulators).

**After commit 1 (UI only):** steps 1-4 and 8-10 pass — Bodega is fully live.
Walk the work tabs by hand: open all three, fill them, park one and open
another, confirm the badges track progress and the dot marks unsaved work, and
check `Confirm` is disabled *with a visible reason* rather than silently doing
nothing. Steps 5-7 arrive with their own commits.

1. **Nothing tracked** → `/dashboard/inventory` shows the `ui-empty` state, not
   a crash. This is dev's real starting state.
2. Seed data: `PATCH` an ingredient with `{ stockBehavior: 'stocked' }`, or set
   the field in the emulator. The backend creates its stocks doc.
3. **Ajustar** `+10` "carga inicial" → the row, its value and the hero total all
   move; an `adjustment` row appears in the history.
4. **Baja** 2 · *dañado* → number drops; the history shows `waste`, visibly
   distinct from the adjustment.
5. **Ingreso**: two lines with presentations → purchase doc written, one
   `purchase` movement per line **in base units**, tab closes, rows cascade in.
   Accept the cost prompt on one line → the ingredient's `costPerUnit` changes
   and recipes using it re-cost.
6. **Producción**: a product with a nested recipe → preview lists `+output` and
   the `−components` at depth → confirm writes exactly the previewed set under
   one `refs.productionId`. Resubmitting the same `idempotencyKey` writes
   nothing.
7. **Conteo**: enter half the items, reload the page, reopen → the draft is
   there with its numbers. Complete → only counted items are baselined, the
   summary splits explicada from no explicada, stock equals what was typed.
8. **Negative stock** → `ui-item-negative` wash, digits readable, nothing
   blocked anywhere.
9. **Multi-bodega**: add a second warehouse in settings → the chips, the
   expander, Transferir and the destination picker all appear. Remove it → all
   four vanish completely.
10. `/system-admin/ux` and `/recipes` still render their search boxes after the
    `UiSearchField` extraction, in both light and dark.
11. No Tailwind color class anywhere in the new files (`ui/CLAUDE.md` rule 3):
    no `bg-neutral-*`, no `text-gray-*`, no `border-neutral-*`. Layout
    utilities are fine.
