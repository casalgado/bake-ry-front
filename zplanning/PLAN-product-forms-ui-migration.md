# PLAN — Migrate ProductForm and ProductCollectionForm to the ui-* system

> Handoff document. Written to be executed phase by phase in a fresh session.
> On approval, copy to `zplanning/PLAN-product-forms-ui-migration.md`.

## Context

The `ui-*` system (`src/assets/ui/tokens.css` + `ui.css`, live gallery at
`/system-admin/ux` and `/system-admin/ux/forms`) already runs one real screen:
`BakeryUserForm.vue`, migrated in commit `e3c6911`. **Read
`src/assets/ui/CLAUDE.md` before writing a single line** — it holds the 13 rules this
plan assumes, and `BakeryUserForm.vue` is the reference implementation: same props and
emits, the host owns the width, `data-ui-theme="light"` explicit on the form root.

Still on the old system: both product forms and their variations subtree — roughly
2,400 lines across five components and four host views. Two of those components carry a
scoped `input[readonly]` patch that exists only because `.form-container input`
(`custom-components.css:89`, specificity (0,1,1)) outranks any single-class utility.
`ui.css` §12 already names that patch as something it replaces.

**Hard constraint:** all logic, props, emits, event names and data shapes stay identical.
This is a paint job, not a behavior change — with two deliberate exceptions flagged under
*Known risks*.

**Done looks like:** both product forms and their variations subtree look and behave like
`BakeryUserForm`, carry zero Tailwind color classes, have no scoped CSS fighting the old
system, and `YesNoToggle.vue` is dead and deleted.

---

## Inventory: what moves, what is frozen

| File | Lines | Status |
|---|---|---|
| `src/assets/ui/ui.css` | 989 | **Edit** — 3 new classes (Phase 1) |
| `src/views/SystemAdmin/UxView.vue` | 590 | **Edit** — gallery entries for those 3 (rule 10) |
| `src/components/forms/ProductForm.vue` | 634 | **Migrate** (Phase 2) |
| `src/views/products/CreateProduct.vue` | 66 | **Edit** — drop `.form-container` (Phase 2) |
| `src/views/products/ShowProducts.vue` | ~300 | **Edit** — the `DialogPanel` only (Phase 2) |
| `src/components/forms/VariationCombinationManager.vue` | 635 | **Migrate** (Phase 3) |
| `src/components/forms/VariationsManager.vue` | 1063 | **Migrate** (Phase 4) |
| `src/components/forms/ProductCollectionForm.vue` | 755 | **Migrate** (Phase 5) |
| `src/views/products/CreateProductCollection.vue` | 32 | **Edit** — add width wrapper (Phase 5) |
| `src/views/products/ShowProductCollections.vue` | ~200 | **Edit** — the `DialogPanel` only (Phase 5) |
| `src/components/forms/__tests__/ProductCollectionForm.test.js` | 630 | **Edit** — YesNoToggle stub (Phase 5) |
| `src/components/forms/YesNoToggle.vue` | 52 | **Delete** last (Phase 6) |
| `RadioButtonGroup.vue` | 124 | **FROZEN** — OrderForm (×4) and NewClientDialog still use it |
| `ConfirmDialog.vue` | 90 | **FROZEN** — 7 call sites; stays as-is (decided) |
| `AppTooltip.vue` | 118 | **Already migrated** — emits `ui-tooltip` / `ui-tooltip-text`, use as-is |
| `TemplateVariation.vue` | — | **Out of scope** — only reached by the dead `hasVariationTemplates` branch |

`YesNoToggle` has exactly three call sites (ProductForm ×2, ProductCollectionForm ×2,
VariationsManager ×1) and all three are in this plan, which is why it can be deleted at the
end. `RadioButtonGroup` is not, which is why ProductForm inlines its replacement instead of
touching it.

---

## Replacement patterns (apply across all phases)

Learn these once. Every one of them is demonstrated live in `UxFormsView.vue`.

**Text / number / select / textarea field**
```html
<div class="ui-field">
  <label class="ui-field-k" :for="`${uid}-name`" data-required>Nombre</label>
  <input :id="`${uid}-name`" v-model="formData.name" type="text" class="ui-input"
         required :aria-invalid="!!errors.name"
         :aria-describedby="errors.name ? `${uid}-name-e` : undefined">
  <span v-if="errors.name" :id="`${uid}-name-e`" class="ui-field-error">{{ errors.name }}</span>
</div>
```
`ui-field` is a `<div>` and the label carries `for` (rule 12: a wrapping `<label>` glues the
hint onto the field's accessible name). `textarea` → `class="ui-input ui-input-area"`.
`select` → plain `class="ui-input"`. `required` goes on the input; `data-required` on the
label only paints the asterisk.

**Field with a unit ($ or %)** — the wrapper goes *inside* `ui-field`, around the input only:
```html
<div class="ui-field-unit" data-unit="$">
  <input class="ui-input ui-input-num" type="number" ...>
</div>
```

**Radio pills** (replaces both `RadioButtonGroup` and `YesNoToggle`):
```html
<div class="ui-field">
  <span :id="`${uid}-mode-k`" class="ui-field-k">¿Qué pasa con las existencias?</span>
  <div class="grid grid-cols-3 gap-1.5" role="radiogroup" :aria-labelledby="`${uid}-mode-k`">
    <template v-for="o in INVENTORY_MODES" :key="o.value">
      <input :id="`${uid}-mode-${o.value}`" v-model="formData.inventoryMode" class="sr-only"
             type="radio" :name="`${uid}-inventory-mode`" :value="o.value"
             @change="handleInventoryModeChange(o.value)">
      <label class="ui-btn justify-center w-full" :for="`${uid}-mode-${o.value}`">{{ o.label }}</label>
    </template>
  </div>
</div>
```
The `<input>` is `sr-only` (position: absolute, so it claims no grid track) and stays the
label's previous sibling — that is what `:checked + .ui-btn` and
`input:focus-visible + .ui-btn` need in `ui.css` §11. **Not** Tailwind `peer-checked:`: it
can only apply single classes and three properties move here. `role="radiogroup"` goes on a
plain `div`, never `fieldset`/`legend` — `.ui-field` is `display: flex` and a `<legend>` is
not laid out as a normal flex item in every engine.

**Checkbox pills** (the dimension-type pickers in VariationsManager): identical markup with
`type="checkbox"` and `v-model` bound to an array. The same `input:checked + .ui-btn` rule
paints them — no new CSS needed.

**Buttons** (rule 13): exactly one `ui-btn-solid` per footer — the thing you came to do.
Anything that leaves, abandons or wipes work in progress (`Cancelar`, `Limpiar`,
`Eliminar variación`) is `ui-btn ui-btn-danger` outline. Neutral peers that neither commit
nor abandon (mode switches, "Agregar opción", "Expandir todo") are plain `ui-btn`.
Icon-only buttons are `ui-btn ui-btn-icon` with `weight="bold"` on the glyph and an
`aria-label`.

**Banned:** every Tailwind color class (rule 3). `text-neutral-700`, `bg-neutral-50`,
`border-neutral-300`, `text-danger`, `bg-amber-25`, `bg-primary-100` → tokens. Tailwind
layout utilities (flex, grid, gap, padding, `w-*`, breakpoints) stay — that is rule 2.

**Ids:** `ProductForm` uses `useId()` like `BakeryUserForm` — it mounts inside
`ShowProducts.vue` next to a `DataTable` with its own filter inputs, and today it uses ids
as generic as `#name` and `#collection`. `ProductCollectionForm` **keeps static ids**
(`#name`, `#description`, `#variation-type-weight`, `name="defaultUnit"`) because its test
suite queries them by selector; it never mounts twice on one page, so rule 12 does not force
`useId()` there.

**Form root:** `data-ui-theme="light"` explicitly on every migrated form. The hosts sit
inside the old dashboard shell, which declares no theme, and tokens resolve on the element
that declares them.

**Width:** no form declares a width. The host sets it, same split as `BakeryUserForm`.

---

## Phase 1 — Three new classes in `ui.css` + gallery

Self-contained; nothing outside the gallery changes visually. Goes first because Phases 3
and 4 depend on it.

### `.ui-nudge` — the stacked up/down arrow pair
Reordering an option or a dimension. `ui-btn-icon` is ~28px, far too big for a stacked pair
inside a 32px row. Borrow `.ui-tab-close`'s hover (fill solid, flip the glyph) without
borrowing its markup. Center with flex, not line-height — the glyph is an inline SVG and a
text baseline parks it high. Reset `margin` and `padding`: `custom-components.css` puts
`my-2 px-2 py-1` on every `button`, and 16px of padding inside a 14px box collapses the icon
to a dot.

- `.ui-nudge` — `display: flex; flex-direction: column;` no gap.
- `.ui-nudge-btn` — 14×14, `border-radius: 4px`, color `--ui-ink-muted`, hover to
  `--ui-ink` on `--ui-surface-3`, `:disabled` → `opacity: .3; cursor: default`
  (rule 11 — never `not-allowed`).
- Add both to the shared `:focus-visible` list at the top of `ui.css`.

### `.ui-badge-num` — the numbered position badge
The little square holding an item's order number. Clickable in VariationsManager (it opens
the position menu), static elsewhere.

- 22×22 (24 under 768px), `border-radius: 6px`, `background: var(--ui-surface-3)`,
  `border: 1px solid var(--ui-line)`, 11.5px / 600, `font-variant-numeric: tabular-nums`,
  color `--ui-ink-muted`.
- `button.ui-badge-num` → `cursor: pointer` and hover `border-color: var(--ui-line-strong)`
  — the same idiom `.ui-chip` already uses. No cursor on the static form (rule 11: cursor
  says what you *can* do).
- Reset `margin`/`padding` for the same `custom-components.css` leak.

### `.ui-menu` — the small floating panel
For the "move to position" dropdown. Nothing covers this today: §15 states the tooltip is
the only component that floats and therefore the only one carrying a shadow. This is its
interactive sibling.

- `background: var(--ui-surface-3)`, `border: 1px solid var(--ui-line-strong)`,
  `border-radius: 9px`, the same shadow as `.ui-tooltip`
  (`0 6px 20px color-mix(in srgb, var(--ui-ink) 18%, transparent)`), `padding: 8px`.
- **No `position`, no `z-index`.** That is arrangement and belongs to the call site in
  Tailwind (`absolute z-10 mt-1 w-36`), the same way `AppTooltip` sets its own inline.
- **Click-outside does not change.** It is JavaScript (`VariationsManager.vue:581-609` —
  the `Map`, the `watch`, the `document` listener), not CSS. This class only paints the
  panel; the listener stays verbatim.

### Gallery (rule 10 — a class not in `/system-admin/ux` does not exist)
New section in `UxView.vue`, after "11—12 · Botones y campos". One `ui-card` containing: a
`ui-item` row showing badge + nudge + name (the real use — reordering a list), an open,
static `ui-menu` beside it, and one line stating that click-outside belongs to the call site
and not to the class. Wire minimal reactive state so the arrows actually move rows —
`UxView` already does this with `counted` and `cascadeRows`.

**Verify:** open `/system-admin/ux`, toggle light/dark, Tab through to confirm the focus
ring lands on the badge and the nudge buttons.

---

## Phase 2 — `ProductForm.vue` + its two hosts

### `ProductForm.vue`
`<script setup>` is nearly untouched:
- Remove `import YesNoToggle` and `import RadioButtonGroup`.
- Add `useId()` (`const uid = useId()`), same as `BakeryUserForm.vue:66`.
- Delete the four `console.log` calls (`:255`, `:261`, `:281`).
- Everything else — `formData`, `INVENTORY_MODES`, `INVENTORY_MODE_HINTS`,
  `isCostFromRecipe`, `handleInventoryModeChange`, `unlockCost`, `handleCategoryChange`,
  `loadCategoryDimensions`, `handleVariationUpdate`, `toggleVariations`, `validate`,
  `handleSubmit`, `onMounted` — **stays exactly as it is**.

Template: **one single `ui-card`** (decided). Today's four `base-card` blocks become
sections separated by `ui-sectionhead` (the small uppercase label with a hairline running
to the edge).

```
<form class="ui-card flex flex-col gap-4" data-ui-theme="light" @submit.prevent="handleSubmit">
  <h2 class="ui-panehead-title">{{ title }}</h2>

  Nombre                     ui-field + ui-input, error via aria-invalid
  Descripción                ui-field + ui-input ui-input-area
  grid md:grid-cols-3 gap-3  Categoría (select.ui-input) · Impuesto (ui-field-unit %) · Código
  variations / active        two yes/no pill groups (replacing YesNoToggle)

  <h3 class="ui-sectionhead">Inventario</h3>   v-if="settingsStore.isInventoryEnabled"
  mode pills                 the radio grid above; DELETE the scoped .inventory-modes CSS
  hint                       <p class="ui-field-hint">{{ inventoryModeHint }}</p>

  <VariationsManager v-if="hasVariations" ... />   unchanged (migrated in Phase 4)
  <span v-if="errors.variations" class="ui-field-error">

  <h3 class="ui-sectionhead">Precios</h3>      v-else
  grid md:grid-cols-2 gap-3  P. Venta (ui-field-unit $) · P. Costo (ui-field-unit $, :readonly)
  margin block               two ui-stat (ui-stat-k / ui-stat-v) replacing the bg-neutral-50 box

  footer                     flex gap-2 justify-end: Cancelar (ui-btn ui-btn-danger),
                             submit (ui-btn ui-btn-solid) — that order, left to right
</form>
<ConfirmDialog ... />        unchanged
```

Traps:
- **`YesNoToggle` fires `@update:modelValue="toggleVariations"`**, and `toggleVariations`
  only reads the first argument. A `<input type="radio" v-model>` will not call that
  handler. Either wire `@change="toggleVariations($event.target.value === 'true')"` or,
  cleaner, add a `watch` on `formData.hasVariations`. **Verify in the browser that the
  confirm dialog still appears when turning variations off on a product that already has
  combinations** — this is the one real behavioral risk in the phase.
- **Cost price:** `:readonly="isCostFromRecipe"`, never `disabled` (§12 separates them
  deliberately: readonly means someone else owns the number and it is still worth reading).
  The scoped `input[readonly]` rule goes away — `.ui-input[readonly]` covers it.
- **`AppTooltip`** stays; only swap `PhInfo class="w-4 h-4 text-neutral-400"` for a
  token-colored equivalent.
- **"Editar manualmente"** is an inline button inside a `<p>`; `ui-btn` would look wrong
  there. Keep it a bare `<button>` with `text-decoration: underline` and a token color.
- The `<style scoped>` block ends up empty: `.inventory-modes` gone, `input[readonly]` gone,
  and the `select { outline: none !important }` rules gone — §12 gives `.ui-input:focus` a
  brand outline and those `!important`s kill it.

### `CreateProduct.vue`
Drop `class="form-container"` from the wrapper. That `div` keeps its fade transition — the
scoped `.form-container` rule in that file should be renamed (e.g. `.form-fade`), since the
name currently collides with the global class. Width moves to the host, same as the user
create pages: `p-4 lg:p-6 w-full max-w-[48rem]`.

This is mandatory, not cosmetic: `.form-container input` at (0,1,1) beats `.ui-input` at
(0,1,0), so without this the migration simply does not render.

### `ShowProducts.vue` (the `DialogPanel` at `:272` only)
`bg-white rounded-lg p-6` → `max-w-[48rem] w-full max-h-[90vh] overflow-y-auto` and nothing
else; the form's own `ui-card` already brings surface, border and padding. Remove the
`<h3>Edit Product</h3>` — the form renders its own title. Remove `class="w-full"` from the
`<ProductForm>` tag.

**Verify:** create a product with no variations from `/dashboard/products/create`; edit an
existing one from the table dialog; toggle variations on and off and confirm the
`ConfirmDialog` still fires; with the inventory module enabled, switch inventory mode and
confirm the hint text changes and that Cost Price locks when you pick "Receta".

---

## Phase 3 — `VariationCombinationManager.vue`

The price grid — the densest file and the one with the most hand-painting. `<script setup>`
is **not touched at all** (the `isCostLocked` / `claimCost` / `restoreRecipeCosts` logic is
correct and fragile), except for removing the `console.log` calls embedded inside the
`@input` / `@click` / `@focus` handlers on lines 318, 398 and 404-413 — those live inside
template expressions, so edit carefully and leave the surviving expression intact.

| Today | ui-* |
|---|---|
| `div.base-card` (container) | `div.ui-card` |
| `h4.text-lg text-neutral-800` | `div.ui-card-title` |
| `(N combinaciones)` | `span.ui-card-sub` or `span.ui-item-meta` |
| controls row + `border-b border-neutral-200` | `div.ui-sectionhead`, or a `border-b` using `var(--ui-line)` |
| `select.text-sm border border-neutral-300` (Agrupar por) | `select.ui-input` inside a horizontal `ui-field` |
| `.utility-btn` ×3 (Editar costos / Restaurar / Expandir) | `button.ui-btn` (neutral peers, rule 13) |
| column headers `text-xs uppercase text-neutral-600` | `span.ui-field-k` (already an uppercase micro-label) |
| `div.group-header … hover:bg-neutral-100 border-l-4` | `div.ui-item.ui-item-filled`, plus `data-accent` if the spine is wanted |
| `border-blue-400 bg-neutral-50` (expanded group) | `aria-expanded="true"` + `ui-item[aria-current='true']` |
| `div.variant-row … bg-neutral-25` | `div.ui-item.ui-item-divided` |
| `bg-amber-25` (whole-grain row) | a `span.ui-tag` with `data-accent="lime"` on the row — no background wash (rule 5) |
| `.input-with-unit compact` + `input.px-2 py-1 border` | `div.ui-field-unit[data-unit="$"]` + `input.ui-input.ui-input-num` |
| summary block `bg-neutral-100 rounded-lg` | three `div.ui-stat` (`ui-stat-k` / `ui-stat-v`) inside a `ui-card` |
| empty state `base-card text-center py-8` | `div.ui-empty` with `<b>` for the headline |
| `PhInfo class="text-neutral-400"` | token color |

Keep untouched: the 14-column grid (`grid-cols-14` — arrangement), the `slide-down`
transition (component-owned motion, not color — rule 6 bans movement on *hover*, not
expand/collapse), and every `@click.stop` / `@focus.stop` that keeps typing a price from
collapsing its group.

Delete from `<style scoped>`: `input[readonly]` (covered by `.ui-input[readonly]`),
`.bg-neutral-25/75/150`, `.bg-amber-25`, `.group-header:hover`, `.variant-row:hover`,
`input[type=number]:focus` (covered by `.ui-input:focus`), all four `::placeholder` rules
(covered by `.ui-input::placeholder`), and `.group-container` (covered by `ui-card`).
Only `grid-cols-14` and `slide-down` survive.

**Verify:** a product with two dimensions — expand/collapse groups, type a group price and
confirm it propagates to the variants, exercise "Editar costos manualmente" and "Restaurar
costos de receta" on a product in Receta mode, and confirm that typing in an input does not
collapse its group.

---

## Phase 4 — `VariationsManager.vue`

`<script setup>` untouched except for removing `import YesNoToggle`. All of
`regenerateCombinations` — the option-id matching, which is the dangerous part of this file
— stays byte-for-byte.

| Today | ui-* |
|---|---|
| `div.base-card` ×3 | `div.ui-card` |
| `h4.text-lg text-neutral-800` | `div.ui-card-title` |
| `p.text-sm text-neutral-600` | `p.ui-card-body` |
| dimension-type checkboxes with `peer-checked:utility-btn-active` | `input.sr-only[type=checkbox]` + `label.ui-btn` |
| "Crear variación personalizada" (input + button) | `ui-field` + `ui-input`, `button.ui-btn` with `PhPlus` |
| dimension position badge (`w-6 h-6 bg-neutral-200`) | `span.ui-badge-num` (**Phase 1**) |
| dimension up/down arrows | `div.ui-nudge` (**Phase 1**) |
| `.danger-btn` "Eliminar" | `button.ui-btn.ui-btn-danger` |
| unit pills (`peer-checked:` radios) | `input.sr-only[type=radio]` + `label.ui-btn justify-center w-full` |
| `YesNoToggle` (whole grain) | yes/no pills; keep the `(value) => toggleWholeGrainForDimension(dim.id, value)` handler, now fired from `@change` |
| option row `bg-neutral-50` / `bg-neutral-150` (whole grain) | `div.ui-item.ui-item-filled`; mark whole-grain with a `span.ui-tag` (rule 5), not an amber fill |
| option position badge (a button) | `button.ui-badge-num` (**Phase 1**) |
| dropdown panel `bg-white border shadow-lg` | `div.ui-menu` (**Phase 1**) + the Tailwind positioning it already has |
| `select` inside the dropdown | `select.ui-input` |
| X button removing an option | `button.ui-btn.ui-btn-icon.ui-btn-danger` with an `aria-label` |
| `.utility-btn` "Agregar Opción" | `button.ui-btn` |
| empty state `base-card text-center py-12` | `div.ui-empty` |

**Click-outside does not change.** `handleClickOutside`, the `watch` on
`optionPositionDropdowns` and the `document` listener stay verbatim; the
`.position-dropdown-container` selector stays in the markup as the JS hook, sitting
alongside `ui-menu`.

`<style scoped>` ends up nearly empty: drop `.position-badge`, `.arrow-button`,
`.option-item`, `.reordering`, `.position-badge-wrapper`, `.dimension-card` and
`.position-controls` (several were already dead code). Keep `@keyframes slideDown` and
`.position-dropdown`.

**Verify:** create a product with two dimensions, add and remove options, reorder with both
the arrows and the position dropdown (including dismissing it by clicking outside), toggle
whole-grain options on and off, and confirm combinations regenerate without losing prices
already typed.

---

## Phase 5 — `ProductCollectionForm.vue` + hosts + test

`<script setup>` untouched except `import YesNoToggle`. The six `watch` blocks (which drive
the confirm dialogs and toggle reversions) stay as they are — with radio pills they still
receive `(newValue, oldValue)` exactly as today, because they still watch the same `ref`.

Template: same single-`ui-card` structure as ProductForm.
- `.form-container` comes off **the component's own root** (here it is not on the host).
- Nombre / Descripción → `ui-field` + `ui-input`, **keeping static ids `#name` and
  `#description`**.
- Both `YesNoToggle` instances → yes/no pills.
- Variation-type pills → `input.sr-only` + `label.ui-btn`, **keeping
  `id="variation-type-weight|quantity|size"`** and `name="defaultVariationType"`.
- Unit pills → same, **keeping `name="defaultUnit"`**.
- `p.text-xs text-neutral-500` (the hints) → `p.ui-field-hint`.
- Type badge `bg-primary-100 text-primary-800` → `span.ui-tag` with a `data-accent`.
- Footer follows rule 13; keep the `<h2>` title element (the test queries it).
- The `hasVariationTemplates` / `TemplateVariation` block is effectively dead
  (`hasVariationTemplates` is never set true outside `initialData`) — migrate only its
  wrapper (`base-card` → `ui-card`, the buttons) and leave `TemplateVariation` alone.

Hosts:
- `CreateProductCollection.vue` — has no wrapper; add
  `<div class="p-4 lg:p-6 w-full max-w-[48rem]">` around the form.
- `ShowProductCollections.vue:163` — `DialogPanel`: drop `bg-white rounded-lg p-6`, keep
  `max-w-[48rem] w-full max-h-[90vh] overflow-y-auto`; remove the
  `<h3>Edit Collection</h3>` and the `class="w-full"` on the form.

Test (`__tests__/ProductCollectionForm.test.js`):
- Delete `MockYesNoToggle` (`:130-140`) and its registration in `global.components` (`:172`).
- Rewrite the assertions that reach for it (around `:352` and `:363`,
  `wholeGrainToggles.find(...)`) to drive the new radio instead:
  `await wrapper.find('input[name="…"][value="true"]').setValue(true)`.
- Everything else survives because the ids and `name` attributes were deliberately kept:
  `#name`, `#description`, `#variation-type-*`, `input[name="defaultUnit"]`,
  `button[type="submit"]`, `buttons.find(b => b.text() === 'Cancelar')`, `find('h2')`,
  `find('form').trigger('submit.prevent')`.
- **Ask permission before running `npx vitest`** — project rule, no exceptions.

**Verify:** create a category; edit it from the table dialog; turn "¿tendrán variaciones?"
on and confirm the already-migrated VariationsManager appears; turn it off with dimensions
loaded and confirm the dialog fires and that cancelling reverts the toggle.

---

## Phase 6 — Cleanup

1. Delete `src/components/forms/YesNoToggle.vue` — no call sites remain after Phase 5.
   Confirm with `grep -rn "YesNoToggle" src/`.
2. Check that no `<style scoped>` block in the four migrated components kept dead rules or
   an `!important` fighting `ui.css`.
3. `grep -rn "form-container\|base-card\|utility-btn\|input-with-unit\|danger-btn\|action-btn" src/components/forms/Product* src/components/forms/Variation*` must come back empty.
4. Grep the same files for Tailwind color classes (`text-neutral-`, `bg-neutral-`,
   `border-neutral-`, `text-danger`, `bg-amber-`, `bg-gray-`, `text-gray-`, `border-blue-`,
   `bg-primary-`) — must come back empty (rule 3).
5. **Do not touch** `RadioButtonGroup.vue`, `ConfirmDialog.vue`, `TemplateVariation.vue`,
   `tailwind.config.js`, `custom-components.css`, or `custom-base.css`.

---

## Known risks

**The window between Phase 2 and Phase 4.** Removing `.form-container` from
`CreateProduct.vue` costs `VariationsManager` and `VariationCombinationManager` (still on
the old system at that point) the `.form-container input { bg-gray-50; border-neutral-850 }`
rule. Nothing breaks — every input in those files carries its own explicit classes
(`px-3 py-2 border border-neutral-300 rounded-md`) — but they will render with a white
background and a lighter border until Phases 3 and 4 land. Cosmetic and temporary; worth
knowing before someone files it as a bug.

**Number-key shortcuts are lost.** `RadioButtonGroup` binds keys 1/2/3 to its options.
Replacing it inline in ProductForm drops that shortcut, exactly as `BakeryUserForm` already
did. This is a deliberate behavior loss. If it turns out to matter, the answer is to extract
a `UiRadioPills.vue` — this migration produces the second and third examples that
`src/assets/ui/CLAUDE.md` asks for before extracting a component — but that is a separate
task, not this one.

**Width changes.** All four hosts settle on `max-w-[48rem]`, matching the user pages.
Previously the create page was `max-w-[800px] w-10/12` and the dialogs were `max-w-2xl`
(672px), so the dialogs will render ~100px wider. That is intentional and is the same fix
documented in `BakeryUserForm.vue:6-10`.

**No git without permission.** Each phase ends in a commit-ready state, but nothing gets
committed unless asked.
