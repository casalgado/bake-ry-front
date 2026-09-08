# Inventory: making Ingreso and Producción save

*Written 2026-09-07, end of day. Nothing has been implemented yet. This exists
so a fresh session can pick the work up cold.*

> Lives beside `HANDOFF-INVENTARIO-UI.md` and `EXISTENCIAS-BUILD.md`, which hold
> the design context. This document is only the state of one open decision:
> what is missing before the two documents can save, and the three questions to
> answer before writing any code.

---

## What this is about

Two screens are finished on the outside but save nothing:

- `src/views/inventory/PurchaseDoc.vue` — **Ingreso** (what arrived from outside)
- `src/views/inventory/ProductionDoc.vue` — **Producción** (what you are going to make)

Both have their *Confirmar* button hardcoded `disabled`, with on-screen copy
saying the endpoint is missing. The document lives in `localStorage`: it
survives a refresh, but it does not exist on the server or on any other device.

No code was written in this session. Everything was read, and the decisions were
sorted out.

---

## What we found (the facts)

**The ledger already exists and is well built.**
`back/bake-ry/functions/src/services/stockService.js` holds all the hard parts:

- `writeMovements()` — the only legal way to move inventory. Writes the movement
  document and updates the cached `currentStock` in the same transaction,
  collapses several movements against one (item, warehouse) into a single net
  delta, and creates the `stocks` doc when the item has never been stocked.
- `buildItemKey()` — the only thing allowed to mint an `itemKey`. **The frontend
  never builds one.** That is why lines carry `item: { type, id, combinationId }`
  as the truth, with `itemKey: null` when the item is new.
- `retryId()` — send the same `idempotencyKey` twice and the movement is written
  once. A retry duplicates nothing.
- `purchase` and `production` **are already in the movement-type enum**. Nothing
  writes them yet.

**What does NOT exist:**

| Missing | Status |
|---|---|
| `POST /bakeries/:id/purchases` | no model, no service, no route |
| `POST /bakeries/:id/stocks/produce` | nothing at all, not even a stub |
| `expandComponents` (the recipe walk that deducts components) | does not exist anywhere |

**⚠️ Correction to an earlier assumption.** It was believed that *"the backend
already does that walk."* It does not. `recipeGraph.js` does walk the recipe
graph, but **only for costs and cycle detection**. Its own header says so
(`recipeGraph.js:7-9`):

> *"Stock deduction is a third walk of this graph, but it belongs to
> stockService — it runs inside the order transaction and yields movements, not
> validations."*

And `orderService.js` does not reference `stock` even once.
`OrderItem.fulfillmentSource` (`'produce'` / `'stock'`) is modeled but unused:
*"Nothing consumes this yet: deduction is phase 2."*

**Translation:** today the server never deducts anything on its own. The only
thing that moves inventory is adjust / waste / transfer, **by hand**.

**The template to copy on the frontend** is `ShowStock.vue:225-350` — the only
inventory screen that actually writes. It has the whole pattern: `submitting` /
`formError`, an `idempotencyKey: crypto.randomUUID()` generated when the form
opens (not when it submits), and the error rendered inline. *There are no toasts
anywhere in the inventory section.* (Note: `CountDoc.vue` does not save either —
it is blocked exactly like the other two.)

---

## What is already decided

**Preview: no, for now.** The "this is what it will consume" panel before
confirming is skipped entirely.

**Purchase document: start simple.** `EXISTENCIAS-BUILD.md §4.2` asked for IVA,
retefuente, reteica, reteiva, payment method, presentation/baseQty and
`providerId`. **The screen asks for none of that.** Save only what the screen
sends — date, provider (free text), warehouse, and the lines with quantity and
total. The tax fields get added the day an accounting screen exists to fill
them.

---

## The orders conversation

The open question that came up: *is inventory deducted when an order is created,
or when production marks it as made?*

**The question dissolves, and one rule is left instead of two.**

Framing it as "order creation **or** production" treats them as two places
competing to do the same deduction. They are not. They deduct **different
things**:

```
Production   →   − flour, + croissants
Delivery     →   − croissants
Order        →   nothing
```

That is one croissant's life, both ends. There is no double counting. So the
real question is smaller: *does an order deduct the finished goods at creation,
or at delivery?*

**At delivery.** Because:

1. **Nothing physical happens when an order is created.** It is a promise. A
   movement recorded there is a movement for a non-event — and the ledger is
   append-only, so every edit and every cancellation would need a compensating
   movement, forever. That is exactly the mess that was sensed. (`COMPENSATION`
   is in the enum precisely because someone already saw it coming.)
2. **Orders get edited ten times. Deliveries do not get un-delivered.** Put the
   write on the stable event.
3. What you actually want at order creation is **"is there enough?"** — and that
   is **not the ledger**. It is `currentStock − what is promised on open
   orders`: a query over orders, zero movements. Conflating *committed* with
   *gone* is what makes order-time deduction feel wrong.

The other worry — *"what if production never marks it as made?"* — is real, but
the fix is not to move the deduction earlier. If nobody confirms the bake, the
ledger correctly says the croissants do not exist. **Recording a bake that may
not have happened is worse than recording nothing**; the count is what corrects
reality.

And the consistency point was right: **production deducts on confirm.** Same
rule as delivery — *stock moves when the thing moves*. One policy, applied
twice.

**None of this blocks the two screens.** Producción's *Confirmar* means the same
thing under either orders policy.

---

## What is still to be decided

### 1. Do we build `expandComponents` in this pass? ⬅ the big one

The initial answer was "now", but assuming it already existed. It does not. So
the question is open again, this time with the price visible.

**Option A — build it now.** Producción confirms `+output` and `−components` in
one transaction. It is the single largest piece of this work. It is also what
makes Producción mean anything: without it you make 100 croissants and the flour
never goes down.

The rules are already written in `EXISTENCIAS-BUILD.md §4.1`:

```
product 'none'                     → nothing
product 'unit'                     → −qty and STOP
product 'recipe'                   → resolveRecipeId (no fallback) → recurse ×qty
                                     missing recipe = gap, never a guess
ingredient 'stocked'               → −qty and STOP
ingredient 'passThrough' + recipe  → recurse, scaled by qty / yield
ingredient 'passThrough', no recipe → nothing, and not a gap
```

Reuse `resolveRecipeId`, `normalizeComponent` and `MAX_DEPTH` from
`recipeGraph.js` (module-local today — they need exporting) rather than
re-deriving them. Reads happen **outside** the transaction (invariant 4).

**Option B — `+output` only for now.** Both screens come off `disabled`
immediately. Ingreso is genuinely complete. Producción adds what was made but
does not draw down the inputs, and that is fixed in a follow-up pass that is
almost entirely backend.

### 2. What do we do with the orders policy?

Write it down and stop (so it is no longer an open question, but build it
separately), or fold it into the same pass — which grows things considerably: it
touches `orderService`, the status transitions, and the edit and cancel paths.

### 3. Confirm the automatic cost update

The Ingreso screen updates ingredient costs **automatically** on confirm (that
is why the right-hand "Costos que se actualizarán" panel exists).
`EXISTENCIAS-BUILD.md §4.2` asked for the opposite, a prompt per line. The
screen states the change was deliberate, and that if the document is updated,
the screen is what stands.

The assumption is that **automatic** is correct (already decided in code and
argued there). It just needs confirming.

Technical detail: the cost update has to run **after** the purchase commits, not
inside it — because `ingredientService.update()` triggers cost propagation into
recipes, which walks an unbounded graph, and that cannot live inside a
transaction (invariant 4).

### 4. Producción picker: let `'none'` products in, and opt them in on add

*Added 2026-09-08. Deferred on purpose — noted here so it is not re-litigated
from scratch.*

`ProductionDoc.vue:104` lists **every** product because it has no `inventoryMode`
filter (`productStore.items.flatMap(...)`). That is a bug against the shelf rule
in `PurchaseDoc.vue:111` and this doc's own §1: a `'unit'` product (Coca-Cola)
and a `'none'` product both show up as things you can produce, and the `'unit'`
ones then appear on Ingreso too, breaking the exclusivity.

The obvious fix is `.filter((p) => p.inventoryMode === 'recipe')`, mirroring
`PurchaseDoc.vue:117`. **We are not taking that fix as-is.** Legacy products
default to `'none'` (`Product.js:39`, no migration), and a business starting to
migrate wants to add a product to a production run *before* its recipe exists,
so the switch to tracking is gradual and painless.

**Decision (to build later):** the Producción picker shows products in `'none'`
**and** `'recipe'` (still never `'unit'` — that is Ingreso, exclusivity holds).
When a `'none'` product is added to the document, adding it **flips the product
to `'recipe'`** (`productStore.update`, then refetch — same dance as
`onIngredientCreated` in `PurchaseDoc.vue`). A recipe is not required: `'recipe'`
mode with no recipe is already valid end to end — `syncProductStockDocs`
(`stockService.js:362`) mints the stock doc for any non-`'none'` mode, and
`expandComponents` treats a missing recipe on a product as a gap, not a guess
(§4.1). The day the recipe is written, Confirmar starts deducting components with
no further opt-in.

Open sub-questions for the build:

- **Confirm or silent?** Flipping a product's mode from a search-result click is
  a side effect the user did not explicitly ask for. Probably a one-line note in
  the picker ("se activará el control de producción para este producto") rather
  than a modal — there is no `ui-modal` and this doc's Ingreso ruling already
  leans on inline copy over prompts.
- **Undo.** If they remove the line right after, do we flip the product back?
  Leaning no — the mode is cheap to carry and reverting it is another write for a
  non-event, the same argument as the orders policy above.
- **Variations.** `'recipe'` mode on a product with variations creates one stock
  doc per combination. Adding one combination to Producción opts in the whole
  product, which is correct — you cannot produce one variant "untracked".
- **Where the write lives.** Frontend only (`productStore.update`), fired from
  `addLine`. No backend change: the enum already accepts `'recipe'`, and
  `productService` validates nothing but the enum.

Until this is built, the picker keeps listing everything (the current bug). It
is cosmetic noise, not a data risk — nothing saves yet.

---

## How to resume

Open this file, answer the three questions above, and the full implementation
plan follows from them.





## For the Human

---

The ELI5 version

Where you are. Two screens — Ingreso and Producción — look finished but the Confirmar button is greyed out. Everything you type lives only in your browser. Nothing reaches the server.

The good news. The hard part is already built. The server has a proper ledger: it knows how to write a stock movement and update the count in one atomic step, it's the only thing allowed to name an item, and if you accidentally press Confirmar twice it only counts once. It even already has "purchase" and "production" in its list of movement types — nobody has just written one yet.

The bad news, and this is the correction from last night. You thought the server already knew how to read a recipe and figure out that 100 croissants means 4 kg of flour. It doesn't. There is code that walks through recipes, but only to add up costs and to stop you making a recipe that contains itself. Its own comment says the stock version "belongs to stockService" — i.e. someone wrote a note saying this still needs building. That note is the whole job.

What's missing: a place to save a purchase, a place to save a production, and the recipe walk.

---

The orders puzzle you were chewing on. You framed it as "deduct when the order comes in, or when production says it's baked?" — as if two things were fighting to do the same job.

They're not fighting. They do different jobs:

- Baking: flour goes out, croissants come in
- Delivering: croissants go out
- Ordering: nothing happens

Same croissant, both ends of its life. So the only real question is whether an order takes croissants off the shelf when it's placed or when it's delivered. Answer: delivered — because when someone places an order, nothing has physically moved yet. It's a promise. And your ledger can never be edited, only added to, so if you record a promise and then the customer changes their mind, you're stuck writing correction entries forever. That's the exact mess you felt coming.

The thing you actually want when taking an order is "do I have enough?" — and that's just a question you ask, not something you write down. Stock on hand minus what's already promised. No ledger entry needed.

One rule covers everything: stock moves when the thing moves.

---

Three things to decide when you're fresh:

1. The big one: build the recipe walk now (producción really deducts flour), or ship producción as "just add the croissants" and fix the flour in a follow-up? Both screens come unblocked either way — the difference is whether your flour count is honest.
2. The orders rule — just write it down, or build it too? (Building it is a lot more: order editing, cancelling, status changes.)
3. A small one I never got to ask: Ingreso currently updates ingredient costs automatically when you confirm. An old doc wanted it to ask you first, line by line. The screen says it changed that on purpose. I assume automatic is right — just confirm it.
4. Producción's search box currently lists every product (a bug). The fix isn't just "hide the untracked ones" — a business mid-migration should be able to grab a product for a production run before its recipe is written. Decision: show untracked products too, and adding one to the run quietly switches it to "tracked". Details and open sub-questions in §4 above.