# Order form redesign: findings

Status: analysis done, nothing built. Next session starts at "Decisions needed".

## What the form does

`src/components/forms/OrderForm.vue` (1240 lines) is mounted in 8 places: `CreateOrder`, `CreateOfflineOrder`, and 6 list views (`ShowOrders`, `ShowDelivery`, `ShowDeliveryCalendar`, `ShowUnpaidOrders`, `SUPO`, `ExportOrders`), where it opens in a `max-w-4xl` dialog.

Five jobs in one component:

1. **Client:** `UserCombox`, "Nuevo cliente" (`NewClientDialog`), collapsed variant for POS.
2. **When and how:** date, time, pickup or delivery, address, "update client address".
3. **Lines:** `OrderItemsManager` with `ProductWizard` or `ProductSearch`, plus `OrderLineItem` rows. A history navigator swaps the whole cart.
4. **Notes:** production and delivery.
5. **Money:** order discount, delivery fee, payment method, payment date, partial payments (`PartialPaymentsManager`), B2B due days, totals.

Related files: `OrderItemsManager.vue` (278), `OrderLineItem.vue` (360), `ProductWizard.vue` (613), `ProductSearch.vue` (272).

## UX problems

- **Wizard:** 3x3 numpad with an abbreviated breadcrumb. Fast for keyboard and cashier, opaque on touch. Fixed `aspect-square`, so it takes a third of the width on desktop and a full square on mobile.
- **Two entry modes:** Explorar and Buscar tabs plus a localStorage preference force a choice before starting.
- **Line row:** 7 controls in a 4-column grid: qty stepper, discount %, price, advanced toggle, gift, delete, stock pill. Advanced adds IVA and Costo with cramped overlay labels. This is the clutter, and it won't fit 375px.
- **Discounts:** three on screen (line %, line price, order discount). Line % and price edit each other.
- **History arrows:** overwrite the cart with no warning. Cryptic, and sit in the tab row.
- **Payment:** radio-group wall (discount type, fee, method) plus date, partial payments and totals in one card.
- **Smaller:** stray `console.log`s, a hidden `due-date` input, state colors (`text-green-600`, `text-red-700`) that break ui rule 5.

## Plan

Decision: build a new `OrderFormNext.vue` on `ui-*` with the same props and emits as `OrderForm` (`title`, `initialData`, `loading`, `isOffline`; emits `submit`, `cancel`; exposes `resetForm`), so it is a drop-in. Per the "don't migrate old views" rule, do not edit `OrderForm.vue`. Reuse the pure logic (`addBasePricesToOrderItems`, `Order` model pricing, stock helpers in `OrderItemsManager`) instead of rewriting it.

1. Decide the four items below. Draft the layout as one mobile-first sketch.
2. Build `OrderFormNext` in one pass:
   - Mobile: single column, sticky bottom bar with total and submit.
   - Desktop: two panes, lines on the left, client, schedule and payment on the right.
   - Lines: compact row (qty, name, price, total); tap to expand discount, gift, IVA, costo.
3. Add the new pieces to `/system-admin/ux` in the same commit (ui rule 10).
4. Switch `CreateOrder` first, verify, then the other callers one at a time.

Read `src/assets/ui/CLAUDE.md` before writing any view.

## Decisions needed

1. **Wizard:** keep the numpad for POS and make a searchable list the default, or drop it? Recommendation: one entry point (search with collection filter), numpad behind the POS setting.
2. **History arrows:** keep them as a "Repetir pedido anterior" picker, or cut?
3. **Line IVA and costo:** edited often? If not, move out of the row into the expanded part.
4. **Dialog vs page:** keep the dialog on desktop and use a full-height drawer on mobile (recommended), or move edits to a full page?
