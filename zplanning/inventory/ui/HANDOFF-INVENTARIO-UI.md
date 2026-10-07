# Handoff — Preparaciones, Ingreso, Producción, Conteo

**Created:** 2026-09-07
**Status:** phases 0–4 built 2026-09-07; 3.4 and 4.3 wait on milestones 1–2 (`../inventory-next-steps.md` §7), phase 5 not started
**Scope:** frontend `bake-ry-front` only, except where marked **[BACKEND]**

Written for someone with no context on the conversation that produced it. Read
§0, §1 and §2 before touching anything.

**Related documents — read in this order:**

1. [`../PLAN-resale-to-product.md`](../PLAN-resale-to-product.md) — settles what
   a "resale product" is. **Its conclusion is a hard input to this plan.**
2. [`../inventory-next-steps.md`](../inventory-next-steps.md) — the epic's
   decisions and milestones. **Wins wherever this document disagrees.**
3. [`EXISTENCIAS-BUILD.md`](./EXISTENCIAS-BUILD.md) — the already-built
   Existencias screen. Its §4 is the backend shape this plan waits on.
4. [`../INVENTORY-IMPLEMENTATION.md`](../INVENTORY-IMPLEMENTATION.md)
   — the *why* of the data model.

**House rules that apply to every task here** (from `CLAUDE.md`):

- Vue SFC section order is **always** `<script setup>`, then `<template>`, then
  `<style scoped>`.
- New views use the `ui-*` system for colour and Tailwind for arrangement.
  **Read `src/assets/ui/CLAUDE.md` before writing any new view or touching
  `tokens.css` / `ui.css`.**
- Do **not** migrate old Tailwind views. Only build the new screens named here.
- **Never run tests without asking first.** Write them where indicated, run them
  only on explicit permission.
- No proactive linting.
- Explain the diagnosis, the diff and the blast radius as text, and wait for
  "apply it", before editing.

---

## 0. Corrections to earlier assumptions — read first

Three things were assumed during design and turned out to be wrong. If you
inherited any of them verbally, drop them.

| Assumed | Actual |
|---|---|
| Add `Product.isResale` for resale items | **No.** `Product.inventoryMode: 'unit'` already exists and already means this. `PLAN-resale-to-product.md` §0 rejects a second flag outright. |
| A preparación can be created with an empty recipe | **No.** `back/src/services/recipeService.js:63` requires `yield > 0` on any recipe owned by an ingredient. The create form must collect it. |
| `Ingredient.isResale` distinguishes buyable items | **Vestigial.** Its only live effect is blocking `recipeId`. It is being retired by `PLAN-resale-to-product.md`. Do not build anything new on it. |

---

## 1. The target model

The rule every screen in this plan derives from. No item appears on both
document screens.

| Concept | Entity | Marker | Sellable | Produced | Purchased |
|---|---|---|---|---|---|
| Croissant | `Product` | `inventoryMode: 'recipe'` | ✅ | ✅ | ❌ |
| Coca-Cola | `Product` | `inventoryMode: 'unit'` | ✅ | ❌ | ✅ |
| Untracked product | `Product` | `inventoryMode: 'none'` | ✅ | — | — |
| Harina | `Ingredient` | `recipeId: null` | ❌ | ❌ | ✅ |
| Masa madre (preparación) | `Ingredient` | `recipeId` set, `stockBehavior: 'stocked'` | ❌ | ✅ | ❌ |

**Shelf rules:**

```
Ingreso     = ingredients without recipeId  +  products with inventoryMode === 'unit'
Producción  = ingredients with recipeId     +  products with inventoryMode === 'recipe'
```

Today `EntryDoc.vue:45-78` declares `ingreso: ['ingr','prod']`, which lets a user
"buy" their own croissants. **Do not patch that file** — it is deleted in Phase 3.
Apply the rule directly in the new files.

**Decisions already taken, do not relitigate:**

- A new preparación is created with `stockBehavior: 'stocked'` (confirmed by the
  user 2026-09-07). It is held in the bodega and produced as its own event.
- The provider lives on the **document**, never on the line. One delivery, one
  provider.
- Confirming a purchase updates the cost of every changed line by default,
  never silently: each is a pre-ticked checkbox, Confirmar names the count, and
  a confirmation lists them. Untick to keep a one-off price.

---

## 2. Prerequisites outside this plan

These block parts of it. Check status before starting the phase that needs them.

| Needed by | Prerequisite | Where |
|---|---|---|
| ~~Phase 3 (Ingreso)~~ | ~~**B1 — `ProductForm` inventory-mode selector.**~~ **Already built** — `ProductForm.vue:531-577`, three radios behind `settingsStore.isInventoryEnabled`. This plan called it blocking in error; `inventory-next-steps.md` had it ticked all along. | `inventory-next-steps.md` B1 |
| Phase 3 confirm | **[BACKEND]** `POST /bakeries/:bakeryId/purchases` | `EXISTENCIAS-BUILD.md` §4.2 |
| Phase 3 providers | **[BACKEND]** provider entity + last-purchase-per-provider query (§5.4) | new — see §9 |
| Phase 4 confirm | **[BACKEND]** `POST /bakeries/:bakeryId/stocks/produce` with `expandComponents` | `EXISTENCIAS-BUILD.md` §4.1 |
| Phase 5 confirm | **[BACKEND]** `POST /stockCounts` | `EXISTENCIAS-BUILD.md` §4.3 |

Phases 0–4 are all buildable **before** those endpoints land. Every screen that
holds an unsendable document must keep its disabled Confirmar button with the
missing endpoint named on screen — that pattern already exists in
`EntryDoc.vue:423-434` and `CountDoc.vue:270-280`. Preserve it.

---

## 3. Phase 0 — cleanups

Small, independent, no prerequisites. Do these first.

### 0.1 Move section padding out of the layout

`src/views/inventory/InventoryLayout.vue:72` carries `p-4 lg:p-6` on the ground
div, so all four screens are padded identically. Conteo (Phase 5) needs to go
edge-to-edge on a phone, and fighting a parent's padding with negative margin is
worse than not having it.

- Remove `p-4 lg:p-6` from the layout's ground div. Keep the div — it paints
  `--ui-surface-0` and sets `data-ui-theme="light"`, both of which are load-bearing.
- Each of `ShowStock.vue`, `EntryDoc.vue` (later `PurchaseDoc`/`ProductionDoc`)
  and `CountDoc.vue` currently renders `<PageHeader>` and `<div class="ui-app">`
  as **sibling roots** (a fragment). Wrap each screen's template in a single
  `<div class="p-4 lg:p-6">`.

**Verification:** all four screens look unchanged.

- [x] 0.1 done

### 0.2 Persist open documents across a reload

`src/stores/inventoryDocsStore.js` holds the three open documents in memory only.
Server-side drafts arrive with §4.2/§4.3 and will replace this, but "eventually"
is doing a lot of work in that sentence, and Conteo is a twenty-minute
walk-around on a phone.

- On store setup, hydrate `docs` from `localStorage` key `inventoryDocs`, inside
  `try/catch`. A parse failure must fall back to `{ ingreso: null, produccion:
  null, conteo: null }`, never throw.
- `watch(docs, …, { deep: true })` writes `JSON.stringify` back. Wrap in
  `try/catch` — quota and private-mode both throw.
- Do **not** remove the `beforeunload` guard in `InventoryLayout.vue:47`. It now
  warns about something recoverable rather than something lost, which is still
  the honest signal while the server has no draft.
- Update the store's header comment: it currently states drafts do not survive a
  reload. After this they do, locally.
- The three "no sobrevive a recargar la página" notices on screen
  (`EntryDoc.vue:430-434`, `CountDoc.vue:276-280`) become false. Reword to say
  the document lives only in this browser until the endpoint exists.

**Verification:** add two lines to Ingreso, hard-refresh, lines are still there.

- [x] 0.2 done — key is `inventoryDocs.{bakeryId}`, not the bare `inventoryDocs`
  named above: an unscoped key reopens another bakery's document after a
  system_admin switches tenant.

---

## 4. Phase 1 — Preparaciones in the recetario

**Why first:** a preparación is an `Ingredient` with a `recipeId`. Nothing in the
frontend can create one today, so Producción's `prep` shelf can only ever be
empty. This phase is on the critical path for Phase 4.

All work is in `src/views/recipes/RecipeBookView.vue` (1318 lines) unless noted.

### 1.1 Understand the constraint before writing anything

`back/src/services/recipeService.js:46-72` — `validateOwner`:

- Exactly one owner: `productId`, `productId + combinationId`, or `ingredientId`.
- **`ingredientId` requires `yield > 0`.** Expressed in the owning ingredient's
  base unit. It is what makes the preparación costable:
  `costPerUnit = recipe total ÷ yield`.
- A recipe **without** `ingredientId` must not carry a `yield`.
- `recipeService.js:232` writes the `recipeId` pointer onto the ingredient in the
  same transaction as the recipe. There is no window where one exists without the
  other. Do not write the pointer from the client.
- The old `recipeId && isResale` guard in `back/src/models/Ingredient.js` is
  **gone** — `PLAN-resale-to-product.md` landed and `isResale` no longer exists.
  Any ingredient may carry a recipe.

### 1.2 Teach the tab system to open a preparación

**This is the bulk of the phase.** Everything in the builder is keyed to product
combinations and cannot represent an ingredient-owned recipe.

Current shapes:

| Symbol | Line | Today |
|---|---|---|
| `tabs` | `:27` | `{ id, label, closable, productId, comboId }` |
| `builder` | `:126` | walks `productStore` → `combosOf` → combo, returns `{ product, combo }` or `null` |
| `benchFor` | `:148` | `source` computed walks product → combo → `recipeId` → `recipeStore` |
| `bench` watcher | `:169` | keyed on `builder.value?.combo.id` |
| `save` | `:438` | branches on `combo.recipeId`: update, else create with `productId`/`combinationId` |
| `closeTab` | `:808` | keyed by combination id |

Target:

```js
// tab
{ id, label, closable, kind: 'combo' | 'prep',
  productId?, comboId?,          // kind === 'combo'
  ingredientId? }                // kind === 'prep'
```

- `builder` returns a **normalised** object for both kinds:
  `{ kind, recipeId, ownerName, product?, combo?, ingredient? }`, or `null`.
  `recipeId` is `null` for a combination that has no recipe yet; it is **always
  set** for a prep, because 1.3 creates the recipe at the same moment as the
  ingredient.
- `benchFor(tabId, resolveRecipeId)` — key on the **tab id** (already a plain
  string; an ingredient id works as well as a combination id). The `source`
  computed resolves `recipeId → recipeStore.items` for both kinds. Keep the
  `computed`-over-the-store shape and the `shallowReactive` Map: the comments at
  `:137-145` explain two bugs that cost real time. Do not "simplify" them.
- The watcher at `:169` keys on the tab id instead of `combo.id`, and fetches by
  `builder.value.recipeId` when the store misses it.
- `save` gets three branches:
  - `kind === 'combo'` + no `recipeId` → create (unchanged, `:458-467`).
  - `kind === 'combo'` + `recipeId` → update (unchanged, `:453`).
  - `kind === 'prep'` → **always update.** The recipe exists.
  - Keep `productStore.fetchAll()` after a combo save (`:477`) and the reason
    comment. For a prep save, refetch `ingredientStore` instead — the cost
    rollup writes `costPerUnit` onto the ingredient.
- `closeTab` (`:808`) needs no logic change, but its comment ("A tab id IS its
  combination id") becomes wrong. Update it.
- `openCombination` (`:111`) gains a sibling `openPreparacion(ingredient)`.

**Verification:** manually set a `recipeId` on an ingredient in the emulator, open
it from the overview, add a line, save, reopen — the line persists.

- [x] 1.2 done

### 1.3 "Crear preparación" in the ingredient create card

The card at `:1176-1235` appears in the Insumos pane when `newName && !nameTaken`.
Keep everything about it; add a second path.

- Two buttons in the footer, **`Crear preparación` to the left of
  `Crear ingrediente`**. Both `ui-btn`; keep `ui-btn-solid` on the ingredient one
  (it stays the common case) unless the design review says otherwise.
- **One field swaps.** `Costo por unidad` (`:1199-1206`) is replaced by
  **`Rendimiento`** when the preparación path is active — the unit label beside
  it is the unit selected above.
  - Rationale: a preparación's cost is derived from its recipe. Offering a cost
    field invites a number that is silently overwritten on first save.
  - Suggested control: a small segmented toggle or hovering/focusing the button
    switches the field. Pick one and keep it obvious which mode is active — a
    form that changes shape without saying so is worse than two forms.
- `Unidad` and `Categoría` stay required for both paths.
- `createPreparacion()`:
  1. `ingredientStore.create({ name, unit, categoryId, categoryName,
     stockBehavior: 'stocked' })` — **no `costPerUnit`**, it is derived.
     (`isResale` no longer exists; nothing to send.)
  2. `recipeStore.create({ ingredientId: created.id, yield: Number(rendimiento),
     name: created.name, ingredients: [] })`.
  3. `ingredientStore.fetchAll()` so the new `recipeId` is visible locally.
  4. `openPreparacion(created)` — the new tab becomes active.
  5. Clear `suppliesSearch` and the draft fields, exactly as `createIngredient`
     does at `:792-793`.
- **Failure handling:** step 2 can fail after step 1 succeeded, leaving an
  ingredient with no recipe. Surface the error in `createError` and say plainly
  that the ingredient was created but its recipe was not, so the user is not left
  guessing. Do **not** attempt to delete the ingredient to "roll back".
- Validation before submitting: unit and category chosen (as today), plus
  `Number(rendimiento) > 0`. The backend rejects `yield <= 0`; catching it here
  gives a better message.
- Reuse the duplicate-name guard at `:751` unchanged.

- [x] 1.3 done — **deviation:** `Costo por unidad` and `Rendimiento` are both
  visible, each tied to its own button, instead of one field swapping under a
  mode. A form that changes shape as the mouse moves is worse than one extra
  box, and hover has no meaning on the phone this screen also runs on. The card
  now lives in `src/components/recipes/IngredientCreateCard.vue` and owns its
  own writes, so §5.2 can mount it in Ingreso unchanged.

### 1.4 Put the create card on the overview tab too

Today the card lives only in the Insumos pane, which renders **only inside an
open recipe tab**. So creating a preparación requires first opening an unrelated
product's recipe. That is backwards.

- Extract the card into a local component or a template block reused by both
  panes. It needs `newName` (derived from whichever search box owns it),
  `newIngredient`, `categories`, `creating`, `createError`.
- On the overview, drive it from the left pane's `search` ref (`:20`) instead of
  `suppliesSearch` (`:~745`). Show it under the same condition: a non-empty query
  that matches no existing product **and** no existing ingredient.
- Keep it in the Insumos pane as well. Creating mid-recipe is the reason it exists
  there.

- [x] 1.4 done

### 1.5 Overview becomes "Productos y preparaciones"

Left pane, `:869-929`.

- Panehead title `Productos` → **`Productos y preparaciones`**; sub becomes
  `{n} productos · {m} preparaciones`.
- After the collection groups, render a **`Preparaciones`** `ui-sectionhead`
  listing `ingredientStore.items.filter(i => i.recipeId)`, sorted by name.
- A preparación row shows name + `rinde {yield} {unit}` as its `ui-item-desc`.
  It has **no pips and no `n/m` trail** — those describe combination coverage,
  which does not apply.
- **Clicking a preparación opens its tab directly** via `openPreparacion`. It does
  not set `selectedId`. There is exactly one recipe, so the intermediate
  combinations pane would be a click that shows a list of one.
- The `search` box (`:875`) filters both sections.
- The coverage bar (`:882-891`) stays about **product combinations only**. Do not
  fold preparaciones into it — one number must mean one thing.
- Empty state: when a bakery has no preparaciones the section is simply absent.
  Do not add an empty-state block for it; the create card is the discovery path.

- [x] 1.5 done

### 1.6 Let the yield be edited

A `yield` typed wrong at creation is otherwise permanent, and it silently scales
every cost that depends on the preparación.

- In a `kind === 'prep'` bench, show `Rendimiento` as an editable field in the
  pane head, beside the name.
- It is part of the recipe document, so it saves through the same `save()` —
  include it in the update payload and count it in `isDirty`.

- [x] 1.6 done

### 1.7 Regenerate the frontend models

`front/src/models/Ingredient.js` is missing `recipeId`, `stockBehavior` and
`preferredSupplier`, all of which the backend model has. Harmless today because
the stores pass raw API JSON, but anything that constructs the class drops three
fields silently.

- Run `node scripts/syncModels.js` from `back/functions`.
- Review the diff before committing — the script overwrites `front/src/models/`.
- Confirm `front/src/models/Product.js` comes back with `inventoryMode`.

- [x] 1.7 done — **nothing to fix.** `Ingredient.js` already carried `recipeId`,
  `stockBehavior` and `preferredSupplier`, and `Product.js` already carried
  `inventoryMode`; the backend `isResale` work brought them into line. The sync
  DID rewrite seven unrelated models (`Order`, `VariationGroups`, `Combination`,
  `BakerySettings`, `SystemSettings`, `SalesReport`, `User`) and add three new
  ones. Reverted: `Order`, `VariationGroups` and `Combination` are imported by
  `OrderForm.vue`, `VariationsManager.vue` and a DataTable renderer, all with
  tests, and that drift deserves its own pass rather than riding along inside an
  inventory feature.

---

## 5. Phase 2 — the shared item picker

Both document screens need it. There is no combobox in this codebase —
`src/components/ui/` contains only `PageHeader.vue` and `UiSearchField.vue`.

### 2.1 `src/components/ui/UiItemPicker.vue`

- **Props:** `items` (normalised `{ key, name, sub, kind, meta }[]`),
  `placeholder`, `label`, `allowCreate` (boolean).
- **Emits:** `select(key)`, `create(name)`.
- **Behaviour:** type to filter (case-insensitive substring, same as
  `EntryDoc.vue:129`), `↑`/`↓` to move, `Enter` to add, `Esc` to clear. The
  input keeps focus after a selection so a delivery can be entered without
  touching the mouse.
- Group results by `kind` using `SHELF_TITLES` from `useItemCatalog`, so the
  picker names shelves the same way the recetario and Existencias do.
- `meta` renders on the right of a row — Ingreso puts current stock there,
  Producción puts what the bodega holds.
- Reuse `UiSearchField` for the input if it composes cleanly; otherwise the
  picker owns its own `<input>`. Do not fork `UiSearchField`.
- Build it against the **full catalog shape**, not against stocks docs. Screens
  filter what they pass in. That is what makes 2.2 possible and keeps the
  "cannot receive a new item" hole from being baked into the component.

**Accessibility:** `role="listbox"` / `role="option"`, `aria-activedescendant`,
and a visible focus ring on the active row. Do not skip this — the whole point of
the component is keyboard entry.

- [x] 2.1 done

### 2.2 Inline ingredient creation from the picker

- When `allowCreate` and the query matches nothing, the last row is a create
  affordance that emits `create(name)`.
- The consuming screen (Ingreso) renders the same three-field card as the
  recetario: unit, cost, category. Extract or duplicate deliberately — if the
  recetario's card was made reusable in 1.4, reuse it here.
- **No preparación creation here.** A preparación needs a recipe, and Ingreso
  cannot buy one anyway. Offer a quiet link instead: *"¿es una preparación?
  créala en el recetario →"*.

- [x] 2.2 done

---

## 6. Phase 3 — Ingreso (`PurchaseDoc.vue`)

### 3.1 Split `EntryDoc.vue`

`src/views/inventory/EntryDoc.vue` is one component serving two routes via a
`KIND` map (`:44-79`). Five differences now separate the screens: shelves,
providers, responsable, inline creation, and the consumption preview. The map has
stopped paying for itself.

- Create `src/views/inventory/PurchaseDoc.vue` and
  `src/views/inventory/ProductionDoc.vue`.
- Delete `EntryDoc.vue`. Delete the `KIND` map.
- `src/router/index.js:89-103` — two routes, two components, drop the `props: { kind }`.
- The `:key="$route.path"` on `<router-view>` (`InventoryLayout.vue:92`) can stay;
  it is now redundant for these two but still keeps each screen's search and
  selection to itself.
- Carry forward, do not lose:
  - `setField` (`:220-227`) — the numeric-input handling. Its comment documents
    two opposite bugs that were both shipped. Copy it verbatim into both files or
    lift it into `utils/helpers.js`.
  - The identity-resolved-at-render pattern (`:144-169`) — lines store `itemKey`
    plus what was typed; name, unit and stock are joined back at render so a
    refetch never leaves a stale copy in the document.
  - `identityByKey` resolving off **every** stocks doc, not just the destination
    bodega (`:141-143`), so changing the destination does not blank written lines.

- [x] 3.1 done

### 3.2 Correct the shelf rule

- Ingreso offers **ingredients without `recipeId`** plus **products with
  `inventoryMode === 'unit'`**.
- Add `modeOf(item)` to `src/composables/useItemCatalog.js` — option A of
  `PLAN-resale-to-product.md` §4.6. Do **not** split `'prod'` into
  `'prod_unit'`/`'prod_recipe'`; `SHELF_TITLES` is shared with the recetario and
  Existencias.
- Shelf labels here are **`Insumos`** and **`Reventa`**, not "Ingredientes" and
  "Productos". In the user's head the Coke *is* a product; calling it an
  ingredient reads as broken.

- [x] 3.2 done

### 3.3 Single-column form

- Drop `ui-panes`. Drop the right-hand chip shelf, the drag-and-drop handlers,
  `chips`, `shelves`, `onDragStart`, `onDrop`, `dragOver`, `draggingKey`
  (~80 lines).
- Layout top to bottom: provider block → date → destination bodega (only when
  `multiWarehouse`) → picker → lines → totals → confirm.
- Lines keep the existing shape: `ui-item ui-item-filled` with qty, unit, unit
  cost and a remove button in `ui-item-trail`, money in `ui-item-desc`. The
  comments at `:343-359` explain why money sits in the desc and not the trail —
  the trail's grid column never shrinks and eats the name. Respect that.
- Keep `blankQuantities` and `unpricedCount` notices.

- [x] 3.3 done

### 3.4 Providers

The centre of the redesign. The insight: **you buy the same things from the same
people at the same price, except when it changes.** So the form's job is
confirmation with exception-flagging, not data entry.

1. Provider is the **first and most prominent** field. A list, not a text box.
2. Selecting one **prefills the document** with that provider's usual basket:
   the items from their last purchase, **unit cost and quantity prefilled**.
3. The user corrects what differs on today's invoice. Most lines are never touched.
4. A **changed price is flagged on the line**: `antes $3.200 · subió 9%`. Use
   `ui-item-desc`; a rise and a fall should be distinguishable at a glance.
5. Each line whose price differs from the stored cost gets a pre-ticked
   checkbox; untick to keep the current cost. Confirmar names the count and
   asks once before applying.

Store change: `blankDoc` in `inventoryDocsStore.js:27` has a generic `party`
string. Ingreso's becomes `providerId`; Producción drops it entirely (see 4.1).
Keep `blankDoc` honest — do not leave a dead `party` field on either.

**[BACKEND] contract** — confirmed, milestone 1 (`next-steps` §5,
`EXISTENCIAS-BUILD.md` §4.2): a `providers` entity, `GET
.../providers/:id/last-purchase` returning the latest purchase's lines, and
`POST /purchases` carrying `providerId`. **Do not fake a price history** — an
invented "antes" is worse than no flag.

- [~] 3.4 **partial — blocked.** El proveedor is now the first and most
  prominent field on the document, and `blankDoc` carries `provider` for
  `ingreso` only (Producción has no party field at all, Conteo keeps `party` as
  el responsable). The list, the basket prefill and the price-change flags need
  the provider entity; the screen says so on itself rather than faking a
  history. **Do not build the flags against invented data.**

### 3.5 Inline ingredient creation

Wire `UiItemPicker`'s `create` event to the three-field card, plus a **Reventa**
consideration: a resale item is a *product*, not an ingredient, and creating a
product inline is out of scope (variations, prices, collections). So the card
creates ingredients only, and offers a link to the product form for resale items.

- [x] 3.5 done

### 3.6 Confirm stays disabled

`POST /purchases` does not exist. Keep the disabled button with the missing
endpoint named on screen (`EntryDoc.vue:421-434` is the pattern). **Do not route
a purchase through `/stocks/:itemKey/adjust` to make the button work** — it would
write `adjustment` movements for events that are purchases, and the ledger is
append-only, so the merma report would be wrong forever. That reasoning is
recorded at `EntryDoc.vue:56-62`; keep a version of it in the new file.

- [x] 3.6 done

---

## 7. Phase 4 — Producción (`ProductionDoc.vue`)

### 4.1 Shape

- Shelf rule: **ingredients with `recipeId`** plus **products with
  `inventoryMode === 'recipe'`**.
- **No provider. No responsable.** The ledger already records who confirmed the
  movement, server-side, which is more trustworthy than a free-text box.
- No unit-cost input. A production line's cost is derived from the recipe.
- Copy: the document is filled in the **future tense** — *"Lo que vas a hacer"*,
  not *"lo que se hizo"*. Confirmar is what makes it past. `EntryDoc.vue:69`
  currently says `Arrastra lo que se hizo`; that wording is wrong and does not
  survive the rewrite.

- [x] 4.1 done

### 4.2 The consumption preview — the reason this screen exists

The asymmetry with Ingreso: in a purchase you already know the numbers, they are
printed on the invoice. In production the number you type is an **output**, and
what you do not know is the **consequence**.

```
Vas a hacer                      Esto te va a consumir
─────────────────────            ─────────────────────────────────
Croissant        40 und          Harina       8.0 kg  (hay 12.4) ✓
Pan de queso     20 und          Mantequilla  3.2 kg  (hay 2.1)  ⚠ faltan 1.1
                                 Levadura     0.4 kg  (hay 6.0)  ✓
```

- Driven by the production-run preview action (`EXISTENCIAS-BUILD.md` §4.1).
  `stockStore.produce` targets an endpoint that will never exist; it goes when
  the production-run store lands.
- Component expansion is a **backend walk** (`EXISTENCIAS-BUILD.md` §4.1). This
  screen must never re-derive it client-side — that is why `InventoryLayout.vue`
  deliberately does not fetch recipes (`:31-34`).
- A shortfall renders red **before** confirm, not after the stock has gone
  negative. It warns; it does not block.
- Debounce the preview call. Every keystroke in a quantity field must not fire a
  request.
- Until the endpoint exists, the panel shows the placeholder already worded at
  `EntryDoc.vue:400-404`.

- [x] 4.2 done

### 4.3 Two multipliers on top

- **"Repetir la producción de ayer"** — production repeats. Same insight as the
  provider basket, and probably the highest-value button on the screen.
- **Batches, not only units.** If a recipe yields 20, let someone enter `2 lotes`
  and see 40 units. Bakers think in batches. The recipe's `yield` is what makes
  this computable — which is the same field Phase 1 introduces.

- [~] 4.3 **partial.** Lotes are built: anything with a rendimiento gets a
  second input, and typing `2` fills the quantity with `2 × yield`. Products
  keep counting in units — they have no rendimiento to multiply by.
  **"Repetir la producción de ayer" is blocked and deliberately not faked:**
  there is no yesterday to repeat until production runs exist. Once they do,
  "repetir" copies yesterday's run lines into a new draft.

### 4.4 Confirm stays disabled

Same rule as 3.6. Missing endpoint named on screen.

- [x] 4.4 done

---

## 8. Phase 5 — Conteo (deferred, needs its own design pass)

**Do not start this from this document.** The user has explicitly reserved it for
a dedicated conversation: *"this conteo bit is really important and I want the UX
here to be very very efficient for the task."*

What is already settled and must survive whatever is designed:

- **You write what is on the shelf. The system computes the difference.** There
  is no "diferencia" field to type into, anywhere.
- The expected quantity appears **only after** a count is entered. Showing it
  first anchors the counter to the number the count exists to challenge.
  (`CountDoc.vue:226-231`.)
- An empty box means "not counted", which is not counting zero. A partial count
  leaves skipped items untouched. (`CountDoc.vue:78-99`.)
- Search narrows what you *see*; every total counts the whole bodega.
- A count is scoped to **one** bodega. Switching wipes `counted`, with a confirm.
- The item list is never stored on the document — it is whatever the bodega holds
  right now.

Existing related plan: `inventory-next-steps.md` **E1/E2** already specifies a
category-guided flow (`ingredientCategories.displayOrder`), resumable draft, and
a final summary splitting **explained** merma (Σ waste) from **unexplained** (the
count's residual). Read it before redesigning; that summary split is a good idea
that predates this conversation.

- [ ] 5.0 design conversation held
- [ ] 5.1 built

---

## 9. What comes next

The remaining work — providers, production runs, availability, order
deduction, Conteo — is in [`../inventory-next-steps.md`](../inventory-next-steps.md)
§7. Producción is both a plan and a record: *Enviar* makes it a promise
(en producción), receiving a line makes it real (`next-steps` §4).

---

## 10. Open questions

1. **`seedIngredients.js:19` forces `stockBehavior: STOCKED` for every seeded
   ingredient.** Probably wrong (the design default is `passThrough`), noted in
   `PLAN-resale-to-product.md` §9.4. Separate issue; do not fix it here.

---

## 11. Completion tracking

| # | Task | Phase | Blocked by | Done |
|---|---|---|---|---|
| 0.1 | Move section padding out of the layout | 0 | — | ☑ |
| 0.2 | Persist open documents to localStorage | 0 | — | ☑ |
| 1.2 | Tab system opens a preparación | 1 | — | ☑ |
| 1.3 | "Crear preparación" button + rendimiento field | 1 | 1.2 | ☑ |
| 1.4 | Create card on the overview tab | 1 | 1.3 | ☑ |
| 1.5 | Overview = "Productos y preparaciones" | 1 | 1.2 | ☑ |
| 1.6 | Yield editable in the bench | 1 | 1.2 | ☑ |
| 1.7 | `syncModels.js` — fix model drift | 1 | — | ☑ |
| 2.1 | `UiItemPicker.vue` | 2 | — | ☑ |
| 2.2 | Inline ingredient creation in the picker | 2 | 2.1 | ☑ |
| B1 | ProductForm inventory-mode selector | — | — | ☑ already built |
| 3.1 | Split `EntryDoc` into two files | 3 | 2.1 | ☑ |
| 3.2 | Correct shelf rule + `modeOf` | 3 | 3.1, B1 | ☑ |
| 3.3 | Single-column purchase form | 3 | 3.1 | ☑ |
| 3.4 | Providers: list, basket prefill, price flags | 3 | 3.3, **[BACKEND]** | ◐ field only |
| 3.5 | Inline creation wired into Ingreso | 3 | 2.2, 3.3 | ☑ |
| 3.6 | Confirm disabled, endpoint named | 3 | 3.3 | ☑ |
| 4.1 | `ProductionDoc` shape, copy in future tense | 4 | 3.1 | ☑ |
| 4.2 | Live consumption preview | 4 | 4.1, **[BACKEND]** | ☑ wired |
| 4.3 | Repeat-yesterday + batches | 4 | 4.1 | ◐ lotes only |
| 4.4 | Confirm disabled, endpoint named | 4 | 4.1 | ☑ |
| 5.0 | Conteo design conversation | 5 | — | ☐ |
| 5.1 | Conteo build | 5 | 5.0 | ☐ |

**Marking a task done:** tick the checkbox in its section **and** the row here.
A task is done when its stated verification passes, not when the code compiles.
