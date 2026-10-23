# Plan: producing an order line moves stock (receipt), shipping issues the product

Status: **built, folded into `INVENTORY.md`** (§1, §2, §4.2, §4.3, §8, §9) and `BROWSER-CHECKS.md` §6b. Safe to delete.
Backend root `C:\Users\casal\documents\web\back\bake-ry\functions\src` (`BE`), frontend `src/` of this repo (`FE`).
Rules that apply while building: code and stored data in English, UI copy in Spanish; `ui-*` for any new view; ask
before running tests; no commits unless asked; do not edit old Tailwind views beyond what is needed here.

---

## 1. The problem

Test in the emulator: an order of 166 breads, marked Producida, moved **no** inventory until the order was shipped.

Cause (BE `services/stockService.js`): `affectsStock(order)` is `status >= SHIPPED_STATUS (2)`, and `expandOrder` returns
nothing below that. A `produce` line on a `recipe` product then deducts only its **recipe's ingredients**, at shipping.
`INVENTORY.md` §1 and §9 state this as the design ("when the order ships it deducts its recipe's ingredients"; "an order
moves stock when it ships").

Why that is a poor fit:
- The flour is gone when the kitchen bakes, not when the van leaves. Counts taken in between show unexplained variance.
- If the order is cancelled or reduced after baking, the bread physically exists but the ledger knows nothing about it.
- Two parallel ways exist to record one baking session: a production run (receive = +product, -ingredients) and an order's
  produce line (ingredients at ship). Nothing links them.

What already exists (FE `views/orders/ShowProductionSingleItems.vue`):
- Ticking a **order row** sets `OrderItem.status = 1` ("producido") through `patchOrderItems`, which rewrites the whole
  `orderItems` array via the order PATCH. It moves **no stock**.
- Ticking a **Vitrina row** (a run line) opens a confirm dialog and calls `productionRunStore.receiveLine`. It moves stock.
- Order statuses: 0 Recibida, 1 Producida, 2 Enviada, 3 Entregada. The order-level 0/1 toggle never moves stock; that does
  not change.

## 2. Why status-driven deduction was rejected

First idea: deduct ingredients when the **order** reaches status 1. Rejected because:
- Status is a soft flag clicked early, in bulk (`bulk-update`) or by mistake; it should not write a ledger.
- Moving it back would have to mean "undo the production", but "order cancelled after baking" means the opposite (the
  bread exists, the flour is gone). The system cannot tell the two apart.
- It leaves two events recording one act (run + order).

## 3. Industry pattern (researched)

Production is one act (consume ingredients + receive finished goods); the sale/delivery is a separate act (issue finished
goods). Order status never consumes ingredients; it only commits/reserves.
- Craftybase: a "manufacture" lowers materials, raises product stock; an order lowers product stock.
- ERPNext: the Manufacture stock entry takes raw materials out and puts the finished item in; the Delivery Note reduces stock.
- Katana: make-to-order creates a manufacturing order permanently linked to the sales order; completing it moves
  ingredients and product; delivery is a separate status.
- Odoo: MTO creates a manufacturing order; "Produce All", then validate the delivery. Docs say "adjust, don't cancel";
  a done MO is reversed with "Unbuild".
- SAP/backflushing pitfalls: auto-deducting from the standard recipe hides variance; late/missing confirmations leave
  stock wrong; reverse with the real reversal, not a negative confirmation (double-counts). Negative stock is allowed and
  balanced later.
- Restaurants (Toast) deplete at **sale** because the dish is made on demand; batch/prep recipes deplete at production.
  Our current rule is the restaurant pattern.
- Not found in any source: what happens to produced goods when the order is cancelled after production. That edge is ours
  to design (see §5).

## 4. Decisions (all confirmed by the user unless marked open)

1. **Rule B.** Shipping always issues the **product** for a `produce` line of a `recipe` product. No branch on whether the
   line was ticked. A forgotten tick shows as negative bread; the fix is ticking the kitchen row afterwards
   (adds the bread back to 0 and takes the flour out). Chosen over "ship backflushes the recipe if unticked" because that
   failure is silent.
2. **A produced line is locked against growth.** Quantity may only go **down** (`quantity <= producedQty`); product,
   combination and source are locked; **removing** the line is always allowed. More bread = add **another line** of the
   same product (new item id, its own tick). Undo unlocks the line.
3. Lowering 166 -> 150 is allowed; the 16 extra breads stay in stock (a baja if thrown away).
4. The order form shows the cap and a hint (see §6).
5. **Custom / non-reusable items** (a cake with a name on it): deferred. Later a per-product `madeToOrder` flag meaning
   "tick = flag only, nothing lands in stock".
6. **Run + order double entry** (bake 200 via a run AND tick the order's 166 doubles the flour): not preventable in code.
   If a run covers the bread, the order line should be **Disponible**. A line in the kitchen guide, nothing more.
7. **Link = refs + server-owned fields, not run lines.** Auto-generating run docs per order line would require syncing
   every order edit/cancel (the problem Katana solves with a permanent link). Reuse the receive primitive instead.
8. **Cutover: skip.** Emulator only, no bakery is live on inventory. (Orders shipped under the old rule carry ingredient
   movements; editing one would make `reconcileOrderStock` return the flour and deduct the bread. Reset emulator data
   instead of guarding.)

## 5. Behavior after the change

| Event | Ledger |
|---|---|
| Kitchen ticks a `produce` line (recipe product) | `production` movements: `+producedQty` product, `-` each component (same as a run receive) |
| Kitchen un-ticks it | exact opposite of that receipt, read from the ledger, as `compensation`; line unlocks |
| Order ships | `sale`: `-quantity` of the product (same as a `stock` line). Unticked line: same, plus a `stockGaps` entry `notProduced` |
| Order cancelled / line removed after tick | nothing written; bread stays; `committed` drops, so `available` rises for the next order |
| Quantity lowered after tick | nothing written; surplus stays in stock |
| Quantity raised after tick | refused; add another line |
| Order moved back below Enviada | existing reconcile diff compensates the product, as today |

`committed` for an open order's produced `produce` line = its quantity (always <= `producedQty`). `incoming` unchanged.
Untracked (`none`) products and bakeries whose inventory never went live: the tick stays a plain flag, as today.

## 6. Implementation steps

### Backend
1. **Extract the receive helper.** Move the body of `productionRunService.receiveLine` (output `+qty`, components `-qty`,
   `type: production`, deterministic ids, `receiptNo`, `expandRecipe` outside the transaction) into one helper in
   `stockService` and use it from runs and orders. Undo reuses `undoLine`'s approach (`getMovementsByRefs`,
   `reverseMovements`, `idFor: undo_<id>`).
2. **Endpoints** `POST /orders/:orderId/items/:itemId/produce` and `/unproduce` (routes + controller + `orderService`).
   Roles: same as run receive (`requireBakeryProduction`: staff, admin, system_admin, production_assistant).
   **One door for every order-row tick**: the endpoint accepts any line and the server decides. A `produce` line on a
   `recipe` product with inventory live gets a receipt; anything else (`none`, `unit`, legacy resale lines saved as
   `produce`, inventory never live) only gets the flag, no movements.
   Receipt path, one transaction: re-read the order; require the line is not produced; write the receipt;
   set `item.status = 1`, `item.producedQty = quantity`, `item.receiptNo += 1`. Reads before writes; a changed quantity
   since measuring is refused (`La cantidad cambió, intenta de nuevo`), like runs. Receipt `refs`:
   `{ producedForOrderId, orderItemId, receipt }`; ids `orderline_${orderId}_${itemId}_${receipt}_${itemKey}`;
   warehouse = `line.sourceWarehouseId || default`.
   If the order already ships stock (`affectsStock`), call `reconcileOrderStock` once after the commit: its movement diff
   is empty, it only rewrites the line's `stockGaps` doc, so a `notProduced` gap does not go stale (the tick does not
   change `stockSignature`, so `reconcileIfNeeded` would skip it).
3. **Different ref key on purpose.** `reconcileOrderStock` / `getOrderMovements` / `findUnreconciledOrders` net every
   movement with `refs.orderId`; receipts under that key would be diffed as shipping movements. Use `producedForOrderId`.
   Add `refs.producedForOrderId` to the documented refs list in `INVENTORY.md` §2.
4. **`expandOrder`**: a `produce` line on a `recipe` product takes the product itself (like a `stock` line), always.
   `stockSignature` carries `Boolean(producedQty)`: it moves no shipping movement (rule B), but it decides the gap, so
   a tick on a shipped order re-runs the normal `reconcileIfNeeded` (empty diff, gap rewritten). If the line has no receipt (`!item.producedQty`), add a
   `lineGap` with reason `notProduced` (existing `stockGaps` doc `${orderId}_${itemId}`; never blocks).
   Remove the recipe-walk branch for order lines only if nothing else needs it (runs still use `expandRecipe`).
5. **`getCommittedAndIncoming`**: count a produced `produce` line of an open order as committed (its quantity).
6. **Server-owned order-item fields** (`status`, `producedQty`, `receiptNo`, on every line): on any order create/update/
   `patchAll` path in `orderService`, merge them from the stored order by item id and ignore client values (precedent:
   `shippedAt`, recipe fields). Enforce the lock: reject a quantity increase and a product/combination/source change on a
   produced line, with a Spanish message; removal allowed. A new line cannot arrive already produced.
7. `OrderItem` model (`models/Order.js`): add `producedQty = 0`, `receiptNo = 0`; keep `status` (0/1/2).

### Frontend
1. `services/orderService.js` + `stores/orderStore.js`: `produceItem(orderId, itemId)` / `unproduceItem(...)`.
2. `ShowProductionSingleItems.vue`: **every** order row ticks through `produceItem` and un-ticks through `unproduceItem`
   (the server decides receipt vs flag). A `produce` row on a `recipe` product shows the existing run confirm dialog first
   (what it consumes, via the preview endpoint or the line's recipe walk); other rows tick without a dialog. Stop sending
   order-row `status` through `patchOrderItems`. Tooltip like the Vitrina one ("Para deshacer la producción, selecciona la
   fila").
3. `ShowProductionGroupedItems.vue`: stays read-only for status.
4. Order form (`components/forms/OrderItemsManager.vue`, `OrderLineItem.vue`): produced line shows a "producido (N)" chip;
   quantity capped at `producedQty` with the hint "Ya producido (N). Para más, agrega otra línea."; product / variation /
   source disabled. `takenBy` (saved lines and draft) also counts `produce` lines with `producedQty > 0`, mirroring the new
   committed rule; otherwise lowering or removing a produced line frees nothing on screen until save. Existing
   default-source logic already makes the second line default to Producir (the first line's bread is committed).

Deferred, add when asked: a toast when deleting an order with produced lines; an Existencias label
"Producción · pedido xxxxxx" for `producedForOrderId` movements.

### Docs
`INVENTORY.md`: §1 Words (Producir), §2 refs list, §4.2 (receipt shared by runs and order lines), §4.3 (ship rule,
committed, lock, `notProduced` gap), §9 (amend "an order moves stock when it ships": ingredients come off at the line's
receipt, the product leaves at ship; keep the reason: only an explicit tick writes, order edits never do).
`BROWSER-CHECKS.md`: update S2, K2-K4; add cancel-after-tick, reduce-after-tick, add-another-line, forgotten-tick-then-tick.

## 7. Tests (ask before running anything)

BE `__tests__/services/orderStock.test.js` and a new produce-line test:
- tick: `+product`, `-ingredients`, committed up, other orders' `available` down
- ship after tick: `-product` only, no ingredient movement
- ship unticked: `-product`, gap `notProduced`; then tick: bread back to 0, flour out; verify and verify-orders empty
- remove line / cancel order after tick: no movements, bread available again
- reduce 166 -> 150 ok (16 left); increase refused; product/combination/source change refused; remove allowed
- un-tick: exact opposite, line unlocks; double tick writes one receipt (idempotent id)
- a stale `OrderForm` save cannot clear `status` / `producedQty` / `receiptNo`
- `none` product, `unit` product on a `produce` line, and never-live inventory: flag only, no movements
- ship unticked, then tick: the `notProduced` gap doc is gone
- `reconcileOrderStock` ignores `producedForOrderId` movements

## 8. Verification (emulator, bakery `es-alimento-dev`)

Setup as BROWSER-CHECKS §0. Then: new order with one `produce` line (recipe product, e.g. Focaccia) and one `stock` line ->
tick the kitchen row (confirm dialog, ingredients drop, product up) -> ship (product down, nothing else) -> cancel/remove
variants -> forgotten tick variant -> `GET /stocks/verify` and `GET /stocks/verify-orders` both `[]`.

## 9. Known limits after this change

- Custom items become phantom stock until a count or baja corrects them (until the `madeToOrder` flag exists).
- A bakery that ships without ever using the kitchen screen sees negative bread and no flour deducted (plus `notProduced`
  gaps); the fix is process, not code.
- Run + order double entry is a habit problem (§4.6).
- A mistaken tick on a line that is then removed (or an order then deleted) cannot be un-ticked: the row is gone. The
  receipt stays; correct it with a baja or a count.
