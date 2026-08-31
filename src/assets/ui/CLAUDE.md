# ui-* design system

Two files. `tokens.css` = colors. `ui.css` = component classes. Both imported
**last** in `src/assets/main.css`, after the frozen files, so a `ui-*` class
beats an equal-specificity rule in `custom-components.css`. Live gallery at `/system-admin/ux`
(`src/views/SystemAdmin/UxView.vue`) — it is the documentation.

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
   `color-mix(in oklab, <solid> var(--ui-tint), var(--ui-surface-1))`. To change
   how strong every soft is, change `--ui-tint` (16% light / 28% dark).
8. **Per-instance values ride on CSS variables, not modifier classes.**
   `style="--panes: 1fr 2fr"`, `style="--fill: 40%"`. Do not add
   `.ui-panes--1-2`.
9. **CSS classes first; `.vue` components only when there is state or logic.**
   `src/components/ui/` does not exist yet, on purpose. Extract from three real
   call sites, never from zero.
10. **Add to the gallery in the same commit** as any new class. A class not in
    `/system-admin/ux` does not exist.

## Gotchas that already cost time

- `light-dark()` takes **colors only**. `light-dark(16%, 28%)` is invalid and
  silently kills every `color-mix()` that references it.
- Tokens are declared on `:root, [data-ui-theme]`, not `:root` alone.
  `light-dark()` and `var()` inside a custom property resolve on the element
  that **declares** it, so a themed wrapper needs its own declaration or it
  inherits already-resolved light values and does nothing.
- `custom-components.css` puts `my-2` on every `button` element and styles bare
  `h1`–`h6` and `header` with fixed light neutrals. `ui.css` undoes this once at
  the top; expect similar leaks when migrating a new screen.
- `tailwind.config.js` omits `neutral-500` and `gray-700/800/900`, so
  `text-neutral-500` and friends generate no CSS anywhere in the app.

## Not built yet

- Button toggle/selected variant the 2026-08-28 audit called for (~126 sites,
  must work as a class on `<label>` with `peer-checked:`). Icon-only and danger
  are built: `ui-btn-icon`, `ui-btn-danger`. There is no quiet/ghost button —
  outline is already quiet enough, and a borderless button next to a bordered
  one just reads as broken. Variants compose because `.ui-btn`
  reads `--btn` / `--btn-soft` / `--btn-ink`; a new intent swaps those three, it
  does not repeat the hover math.
- `formatQty` in `src/utils/helpers.js` — number only, max 3 decimals, unit
  rendered as its own `<span class="ui-unit">`.
