# Order form redesign

Status: built in place on `ui-*`, uncommitted, not yet checked in the browser by
Claude. The e2e order specs still use the old selectors (see "Open").

## Shape

`OrderForm.vue` keeps its contract (`title`, `initialData`, `loading`,
`isOffline`; emits `submit`, `cancel`; exposes `resetForm`). It is mounted in 8
places, all on `ui-formhost` at `--ui-form-w: 72rem`.

- **Context strip:** client (`UserCombox`), date, time, Recoger/Domicilio,
  address with "Guardar en el cliente", and up to 4 past orders as chips.
  Clicking one appends its lines; Deshacer takes them back out while the line
  count is unchanged.
- **Catálogo (left, sunken pane):** `ProductWizard`. 3x3 grid, same key map and
  paging as before (QWE/ASD/ZXC or numpad 789/456/123, Space/0 back, Shift for
  "Otra"). The search box fills the same grid; exactly one match is added at
  once with quantity 1, Enter takes the first result to the quantity step.
  `ProductSearch.vue` is deleted.
- **Pedido (right):** `OrderItemsManager` (stock logic unchanged, catalog moved
  out, exposes `add`) with `OrderLineItem` rows: qty stepper, name, chips
  (descuento, Cortesía, stock), line total; the editor holds price ⇄ discount,
  Cortesía, Origen, IVA, Costo and Quitar.
- **Pago:** method pills with icons, delivery-fee pills, Estado del pago
  (Pendiente/Pagado) with an always-visible Fecha de pago, B2B due days, abonos.
- **Totals:** labels left, amounts in one right column; the sticky bar holds the
  total and Cancelar / Crear pedido.

## Decisions taken

- After adding a product the catalog returns to the categories.
- Line discount is editable as price and as %, each rewriting the other.
- IVA and Costo live at the bottom of the line editor.
- A past order is appended, never swapped in.

## Open

- e2e selectors: `#pos-product-search-input`, `#preparation-date`,
  `#internal-notes`, the "Buscar" tab, `lineOf`/`expectRed` in `inventory-ui.js`
  (old line markup and `.text-red-700`), the line's stock toggle button, and the
  "Cliente es requerido" message (now "Elige un cliente", class `ui-field-error`).
- Wizard bug in the old form (breadcrumb buttons submitting) is gone with the
  rewrite; every button now has `type="button"`.
