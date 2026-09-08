# ui-* design system

Two files. `tokens.css` = colors. `ui.css` = component classes. Both imported
**last** in `src/assets/main.css`, after the frozen files, so a `ui-*` class
beats an equal-specificity rule in `custom-components.css`. Live gallery at `/system-admin/ux`
(`src/views/SystemAdmin/UxView.vue`) — it is the documentation. Form fields have
their own page at `/system-admin/ux/forms` (`UxFormsView.vue`), split off because
every demo there needs live `v-model` state and the main gallery is static.

Built for the inventory views (`zplanning/inventory-ui/README.md`) and growing
from there. The old Tailwind-class system still runs ~95% of the app.

## Rules

1. **Never edit `tailwind.config.js`, `custom-components.css`, or
   `custom-base.css`.** They are frozen. `ui-*` coexists, it does not replace.
2. **Tailwind owns arrangement, `ui-*` owns color and shape.** Flex, grid, gap,
   padding, width, breakpoints → Tailwind at the call site. Background, border,
   text color, radius → a `ui-*` class. Arrangement does not change between
   themes, so it never belongs in a token.
3. **New views use zero Tailwind color classes.** No `bg-neutral-100`, no
   `text-gray-700`, no `border-neutral-200`. Layout utilities are fine — the ban
   is only on utilities that name a color. If the color you need has no token,
   add the token; never fall back to a Tailwind color class because it is
   faster. That fallback is what leaves a light-mode patch in a dark screen.
4. **Colors sparingly.** Components are neutral by default. An accent appears
   only where someone writes `data-accent="plum"` by hand.
5. **No state colors.** No red numbers. Zero is muted (`ui-item-zero`), negative
   gets a soft row wash (`ui-item-negative`), digits stay readable.
6. **Hover never moves anything.** No lift, no translate. It steps one rung up
   the surface ladder, or fills with the soft.
7. **Softs are derived, never picked.**
   `color-mix(in oklab, <solid> var(--ui-tint), var(--ui-surface-2))` — mixed
   into `surface-2` because that is what cards, chips, buttons and items sit on.
   To change how strong every soft is, change `--ui-tint` (16% light / 28% dark).
8. **Per-instance values ride on CSS variables, not modifier classes.**
   `style="--panes: 1fr 2fr"`, `style="--fill: 40%"`. Do not add
   `.ui-panes--1-2`.
9. **CSS classes first; `.vue` components only when there is state or logic.**
   Extract from real call sites, never from zero. `src/components/ui/` holds
   exactly one component — `PageHeader.vue` — and stays that small on purpose.
   Behaviour is the test, not repetition: `.ui-search` is a class because its
   colors are CSS, while the Escape-to-clear, `role="searchbox"` and
   `enterkeyhint` around it are template, and a CSS file cannot hold those.
10. **Add to the gallery in the same commit** as any new class. A class not in
    `/system-admin/ux` does not exist.
11. **Cursor says what you can do, never what you can't.** Anything clickable is
    `cursor: pointer` — the hand is the only signal an element responds at all,
    since rule 6 already rules out hover movement. Disabled is `cursor: default`,
    not `not-allowed`: the slashed circle reads as an error, and a disabled
    control is not one. Text inputs keep the browser's own text (I-beam) cursor —
    that one is not in scope, it already tells you what to do.
12. **A field is a `<div class="ui-field">`, and the label carries `for`.** Not a
    wrapping `<label>`. Wrapping buys you the missing `id`, but a label's
    accessible name is built from **everything** in its subtree, so a hint or an
    error inside it gets glued onto the name — `"Nombre Nombre debe tener al
    menos 3 caracteres"`. Hint and error sit outside the label and attach with
    `aria-describedby`. `required` goes on the input; `data-required` on
    `.ui-field-k` only paints the asterisk, and an asterisk no screen reader can
    reach announces the field as optional. In a form component rendered more
    than once per page, base the ids on `useId()` (Vue 3.5). The one exception is
    a control that already names itself — `UiSearchField` has its own
    `aria-label`, so its key is a `<span>` and not a second name competing with
    the first.

## The surface ladder

Four rungs, `0` furthest from your face:

| | light | what it is |
|---|---|---|
| `surface-0` | `#ede7e1` | the ground the app sits on — same value the pre-ui dashboard shell paints (`neutral-150`), so a `ui-*` view sits flush on it |
| `surface-1` | `#f5f0eb` | the page, the tab strip, the sunken pane |
| `surface-2` | `#faf8f5` | a column, card, chip or button on it |
| `surface-3` | `#fffdfb` | a row or well inside that — hover fills, inputs, bar troughs |

## Gotchas that already cost time

- `light-dark()` takes **colors only**. `light-dark(16%, 28%)` is invalid and
  silently kills every `color-mix()` that references it.
- Tokens are declared on `:root, [data-ui-theme]`, not `:root` alone.
  `light-dark()` and `var()` inside a custom property resolve on the element
  that **declares** it, so a themed wrapper needs its own declaration or it
  inherits already-resolved light values and does nothing.
- `custom-components.css` puts `rounded-md font-medium text-[13px] my-2 px-2 py-1`
  on every `button` element, and styles bare `h1`–`h6` and `header` with fixed
  light neutrals. The headings are undone once at the top of `ui.css`; the button
  rule **cannot** be, because `[data-ui-theme] button` outranks `.ui-btn` and
  would eat its padding. Every icon-only button therefore resets `margin` and
  `padding` itself — skip the padding and `px-2` leaves a 2px content box that
  squeezes the icon into a dot. Expect similar leaks on any new screen.
- `tailwind.config.js` omits `neutral-500` and `gray-700/800/900`, so
  `text-neutral-500` and friends generate no CSS anywhere in the app.
- **iOS Safari zooms on focus for any input under 16px**, with no CSS opt-out.
  §12 ends with the one breakpoint in this file: 16px and 38px tall under 768px.
  Desktop stays 13.5px — the inventory grids need the density. Any new input-like
  class needs the same bump, or it jerks the viewport on an iPhone.

## Not built yet

- There is no quiet/ghost button — outline is already quiet enough, and a
  borderless button next to a bordered one just reads as broken. Variants compose
  because `.ui-btn` reads `--btn` / `--btn-soft` / `--btn-ink`; a new intent swaps
  those three, it does not repeat the hover math. Built: `ui-btn-icon`,
  `ui-btn-danger`, and the selected state (`aria-pressed` / `aria-current` /
  `:checked +` on a `<label class="ui-btn">` — **not** Tailwind `peer-checked:`,
  which can only apply single classes).
- No form components. `ui-field` + `ui-input` and friends are classes only;
  `RadioButtonGroup.vue` and `YesNoToggle.vue` belong to the old system and stay
  untouched (restyling them would hit ~126 un-migrated sites). Extract a
  `Ui*` equivalent from the second migrated form, not before — that is when you
  learn whether the number-key shortcuts and custom-option slot survive.
- `formatQty` in `src/utils/helpers.js` — number only, max 3 decimals, unit
  rendered as its own `<span class="ui-unit">`.
- `UiSearchField.vue`. `.ui-search` has one real call site today
  (`RecipeBookView.vue`; `ProductSearch.vue` is the old system and off-limits),
  and its ~14 lines of markup plus the Escape handler are copy-pasted at each
  one. **Extract on the second new screen that needs a search box** — two
  examples is enough to know whether it needs debounce, a leading icon, or a
  `clear` event of its own. One is not.
- `ui-inputs.css`. `ui.css` is one file on purpose: the numbered sections are
  already the split, and a third file adds an import-order constraint that fails
  as "this screen looks slightly wrong". The form pass took it past the ~900-line
  mark that was the old trigger, and it is still navigable — the sections held.
  The real trigger now is inputs growing tokens of their own, or §12 needing
  sub-sub-sections.
