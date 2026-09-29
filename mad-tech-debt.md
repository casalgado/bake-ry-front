# Mad Tech Debt

Known shortcuts we've decided to live with, and what it'd take to pay them off.

---

## 1. The `changes.length < 2` guard swallows real inserts

**Where**

- `src/stores/base/resourceStore.js:51`
- `src/stores/orderStore.js:187`

**Status:** deferred, not fixed. Documented 2026-09-01.

### The whiteboard story

The order table is a whiteboard. Two things write to it:

- the **waiter** — your HTTP `create()` response
- the **security camera** — the Firestore realtime listener

When the camera switches on, it doesn't only see new orders. It sees *every order
that has ever existed* and reports all of them as "new". Write those to the
whiteboard and you get thousands of rows.

So someone added a rule:

> "If the camera reports more than one thing at once, ignore it — that must be
> the camera booting up."

```js
if (index === -1 && changes.length < 2) {
  items.value.push(change.data);
}
```

Rough, but it worked.

### Why it's debt now

**That boot-up problem is already solved one layer down.**
`src/services/base/resourceService.js:299` keeps an `isInitialLoad` flag and
throws away the camera's entire first look before the store ever sees it:

```js
if (isInitialLoad) {
  isInitialLoad = false;
  return;          // the whole first snapshot never reaches the store
}
```

Boot-up never reaches the handler. The guard in the store no longer guards
anything — it only misfires.

### What it actually breaks

Any time two changes land in the same Firestore snapshot, the guard concludes
"camera booting" and **drops both**. Silent. No error, no log.

| Scenario | What arrives | What happens |
|---|---|---|
| You duplicate an order while a colleague toggles another | `[added, modified]` → length 2 | Your duplicate never appears |
| Tab backgrounded a moment, two orders land together | `[added, added]` | Neither appears |
| Backend writes the order + touches a sibling doc in one batch | `[added, modified]` | Order never appears |
| Two people create at the same instant | `[added, added]` | Neither appears |

Symptom in all four: **the row is just missing until you refresh.** Which is why
nobody has filed it — a refresh looks like normal app behaviour.

It's also inconsistent on its face: the `modified` and `removed` branches have no
such guard. Only `added` does.

### The fix

Delete `&& changes.length < 2` from both files. That's it — the layer below
already does the job.

```js
// resourceStore.js:51 and orderStore.js:187
if (index === -1) {
  items.value.push(change.data);
}
```

### Why we haven't

Blast radius is wider than it looks. It touches the realtime path for **every**
subscribed view:

- via `useDataTable` — `ShowOrders`, `ShowDelivery`, `ShowDeliveryCalendar`,
  `SUPO`, `ShowUnpaidOrders`, `ShowDriverOrders`
- calling `orderStore.subscribeToChanges()` directly — `ShowDeliverySummary`,
  `ShowSalesReport`, `ShowPaymentDates`, `ShowProductionSingleItems`,
  `ShowProductionGroupedItems`, `ShowProductionAssistantOrders`

**For orders it's well fenced.** `orderStore`'s handler still gates every insert
through `isOrderInCurrentPeriod()`, so nothing outside the selected period can
sneak in.

**The generic handler in `resourceStore` has no such filter.** Today only orders
subscribes, so this is theoretical — but the moment a second resource turns on
realtime, a batch of remote inserts would enter the list ignoring whatever
filters that view is showing. That risk already exists for single inserts; this
change alters its magnitude, not its kind.

### Pay it off when

A second resource subscribes to realtime, or someone reports missing rows that a
refresh fixes. At that point do both together: drop the length guard **and** give
the generic handler a filter hook, so inserts respect the view's own query
instead of relying on the resource-specific override that only `orderStore` has.

### Related, already fixed

`resourceStore.js` `create()` used to `push()` unconditionally while the listener
also inserted the same doc — a race that produced two rows with the same id, so
clicking one selected both. Now guarded by id. Same family of bug, opposite
direction: that one *added* a phantom, this one *hides* a real row.

---

## 2. Two stagers write to the same product document

**Where** *(backend — `documents/Web/back/bake-ry/functions`)*

- `src/services/recipeService.js:227-290` — `planOwnerLink`
- `src/services/recipeGraph.js:232-252` — `planRecipeCostPropagation`

**Status:** deferred, not fixed. Documented 2026-09-01.

### The story

`recipeGraph` is the office that schedules every change to a product document.
It has a proper clipboard for the job — `stage()`, `stagedData()`,
`planWrites()` — so that two changes to the same document in one run merge
instead of overwriting each other.

`recipeService` needed one write that the graph deliberately refuses to make:
stamping `recipeId` and flipping `costPriceSource` to `'recipe'` on the owner.
Propagation skips it on purpose, because it only fires on documents *already*
set to `'recipe'` and the owner is still `'manual'` at that moment.

So `recipeService` brought its own clipboard:

```js
// recipeService.js:244 — hand-rolled equivalent of stagedData()
const existing = writes.find((w) => w.ref.path === ref.path);
...
// recipeService.js:284 — hand-rolled equivalent of stage()
if (existing) {
  existing.data = { ...existing.data, ...data };
  return writes;
}
```

Two clipboards, one desk.

### Why it's debt

Not the combination mapping — that part legitimately differs. The graph writes
only `costPrice` and bails when `costPriceSource !== 'recipe'`; the service
writes three fields and overrides that guard on purpose, and throws
`NotFoundError` where the graph returns silently. Those differences are the
feature.

The duplication that matters is **the staging protocol**. There are two
implementations of "merge onto a pending write to the same document," and only
one of them would be updated if the plan's shape ever changed. The other would
keep compiling and silently stop merging.

### What it breaks today

Nothing. Both are correct, and both run inside the same transaction, so a
mismatch would surface as a lost field rather than corrupt data.

### The fix

Export a shared `replaceCombination(variations, comboId, patch)` from
`recipeGraph` — the delicate blob rewrite in one place — and let `planOwnerLink`
stage through the graph's plan instead of its own `writes` array.

### Pay it off when

Either function is touched for another reason, or a third writer to product
documents appears. It's a four-line helper; it isn't worth a dedicated PR, and
it is worth doing while you're already in the file.

---

## 3. `seedRecipes.js` reports success on total failure

**Where** *(backend)*

- `functions/src/seeds/runners/seedRecipes.js:34-68`

**Status:** deferred, not fixed. Documented 2026-09-01.

### The story

The seeder never sets `productId` or `combinationId`, so every recipe it builds
is ownerless. `validateOwner` rejects those, which would be fine — except each
recipe is wrapped in a catch that logs and moves on:

```js
} catch (error) {
  console.error(`Error creating recipe ${recipe.name}:`, error);
  continue;   // ← and the runner still exits 0
}
```

A dishwasher that runs the full cycle, beeps that it's done, and the dishes are
dirty. A crash would be better, because you'd know.

### What it breaks

Nothing in production — it's a dev seeder and nobody currently runs it. The
hazard is the next person who does, trusts the green exit, and spends an hour
wondering why the recetario is empty.

### The fix

Set the owner on each seeded recipe, and rethrow instead of `continue` so a
failed seed fails the run. The rethrow is the more important half and is one
line: it converts a silent wrong result into an obvious one, without needing to
understand the ownership rules at all.

### Pay it off when

Someone needs seeded recipe data. Until then it misleads nobody, because nobody
runs it.

---

## 4. Unit symbols exist in two places and disagree

**Where**

- `src/utils/helpers.js` — `UNIT_OPTIONS` (`dz`, `paq`)
- `src/views/recipes/RecipeBookView.vue` — `COUNT_UNITS`
- historical: `IngredientForm.vue` wrote `docena`, `paquete` (stubbed 2026-09-01)

**Status:** half fixed. The second code list went out with the ingredient form;
the divergence in **stored data** remains. Documented 2026-09-01.

### The story

Two independent fallback lists of measurement units drifted apart. The old
ingredient form saved `docena` and `paquete`; the despensa saves `dz` and
`paq`. Same collection, two spellings for one unit.

The tell was `COUNT_UNITS` in `RecipeBookView.vue`, which has to carry **both**
spellings to work:

```js
const COUNT_UNITS = new Set([
  'uds', 'dz', 'paq', 'und', 'unidad', 'unidades', 'docena', 'paquete',
]);
```

Stubbing the old form removed one of the two writers, so nothing new is being
saved with the old spellings. Existing ingredients still carry them.

### Why it's still debt

`COUNT_UNITS` is a hand-maintained set answering "which units are counted rather
than measured" — and the old list already encoded that as a field:

```js
{ symbol: 'docena', name: 'Dozen', type: 'count' }
```

That `type` was dropped when the list moved to `helpers.js`, so a property that
used to be data is now a string set somebody has to remember to update every
time a unit is added.

Underneath it: neither file should own "what units exist." `settings.unitOptions`
should, and the old form already read it (`settingsStore...unitOptions || [...]`)
— nothing ever seeded it, and `BakerySettings` declares no default, so the
fallback became the source of truth.

### The fix

1. Seed `unitOptions` on bakery settings, with the `type` field restored.
2. Read it in `helpers.js` with the current array as the fallback.
3. Derive counted-ness from `type === 'count'` and delete `COUNT_UNITS`.
4. Migrate stored ingredients: `docena → dz`, `paquete → paq`.

Step 4 is the real work and the reason this is deferred — it's a data migration,
not an edit.

### Pay it off when

Before Existencias ships, since stock arithmetic on a unit spelled two ways is a
wrong number rather than a cosmetic glitch. Scope it by counting affected
ingredients first.

---

## 5. The order-item label is written out three times

**Where**

- `src/components/DataTable/renderers/ItemsCell.vue:31`
- `src/components/DataCalendar/renderers/ItemsCell.vue:31`
- `src/components/orders/ClientHistoryModal.vue:25` — `itemLabel`

**Status:** deferred, not fixed. Documented 2026-09-01.

### The story

"How do you name an order item to a human" is one rule: category, product, and
the combination if there is one, each capitalized. It is currently three
hand-written copies of the same expression — two inlined in a template, one
extracted into a local helper.

The fallback chain is the fiddly part, and it exists because `Combination.name`
can be empty:

```js
item.combination?.name || item.combination?.selection?.join(' + ') || item.variation?.name
```

The backend already owns this rule — `Combination.getDisplayName()` at
`functions/src/models/Combination.js:44` is exactly `this.name ||
this.selection.join(' + ')`. But order items are stored as plain objects, so the
method doesn't survive the round trip, and each frontend caller re-derives it.

The two `ItemsCell.vue` copies still probe for `combination.getDisplayName` before
falling back — a leftover from when the live model object was in hand.

### What it breaks

Nothing today. The hazard is drift: when the shape gains a field, or the
separator changes from `+`, the third copy is the one nobody updates, and the
same order reads differently in the table than in the client history.

### The fix

Move `itemLabel` from `ClientHistoryModal.vue` into `@/utils/helpers` and import
it in all three. Net deletion — two long template expressions collapse to a call,
and the dead `getDisplayName` probe goes with them.

### Pay it off when

A fourth caller appears, or either `ItemsCell` is touched for another reason.
It's a move, not a redesign — worth doing while you're already in the file.

---

## 6. `utils/helpers.js` imports from `models`

**Where**

- `src/utils/helpers.js:1` — `import SystemSettings from '@/models/SystemSettings'`
- `src/utils/helpers.js:175` — `const UNIT_OPTIONS = SystemSettings.UNIT_OPTIONS`

**Status:** deferred, not fixed. Documented 2026-09-29.

### The story

Units now have one source, `SystemSettings.UNIT_OPTIONS`, and `helpers.js`
re-exports it so `IngredientCreateCard.vue` keeps its import. That points a util
at a model, while `BakerySettings`, `Combination`, `Order`, `ProductCollection`,
`ProductVariation`, `User` and `VariationGroups` all point the other way.

### What it breaks

Nothing today: `SystemSettings` and `BaseModel` import nothing from `helpers`, so
there is no cycle. The day `SystemSettings` needs `generateId` or `capitalize`,
`UNIT_OPTIONS` evaluates to `undefined` at load time, with no error.

### The fix

Drop the `UNIT_OPTIONS` export from `helpers.js` and have
`IngredientCreateCard.vue:13` import `SystemSettings.UNIT_OPTIONS` directly.

### Pay it off when

`SystemSettings` needs anything from `helpers`, or `IngredientCreateCard.vue` is
touched for another reason.

---

## 7. The ingredient dropdown gained `lb` without anyone deciding it

**Where**

- `src/components/recipes/IngredientCreateCard.vue:295`
- `src/models/SystemSettings.js:32` — `UNIT_OPTIONS`

**Status:** deferred, not verified. Documented 2026-09-29.

### The story

Unifying the unit lists made `UNIT_OPTIONS` the union of the front and the
backend. The old `helpers.js` list had no `lb`; the backend one does. So the
ingredient create dropdown now offers Libra as a side effect of a refactor.

### What it breaks

Unknown. If recipe or ingredient cost math assumes only `g`, `kg`, `ml`, `L`,
`uds`, `dz` and `paq`, an ingredient saved as `lb` prices wrong.

### The fix

Check how `formatUnitCost` and the recipe cost code treat `lb`. Either support it
or filter it out of this dropdown.

### Pay it off when

Before Existencias ships, same reason as #4: stock arithmetic on an unhandled
unit is a wrong number.

---

## 8. Collections saved with the old unit symbols match no pill

**Where**

- `src/components/forms/ProductCollectionForm.vue:101` — `unitPillOptions`
- stored `defaultUnit` on product collections

**Status:** deferred, count unknown. Documented 2026-09-29.

### The story

The form's fallback list used `Kg`, `docena`, `paquete`, and the front
`UNIT_OPTIONS` used `pkt`. The unified list uses `kg`, `dz` and `paq`. A
collection saved with an old spelling has a `defaultUnit` that no pill carries,
so it opens with nothing selected.

Same family as #4: one unit, several spellings in stored data.

### The fix

Count collections whose `defaultUnit` is not in `UNIT_OPTIONS`, then migrate:
`Kg → kg`, `docena → dz`, `paquete → paq`, `pkt → paq`. Fold it into the #4
migration so the data is touched once.

### Pay it off when

Together with #4, before Existencias ships.
