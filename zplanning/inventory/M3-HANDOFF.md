# M3 handoff — Orders + availability

Design: `inventory-next-steps.md` §3, §6. Steps: `INVENTORY-BUILD-PLAN.md`
M3.1–M3.10. M3.1–M3.9 are coded and uncommitted; backend tests pass. What's
left is **M3.10, the manual check below.**

House rules: ask before running any test, don't touch git unless asked, explain
diagnosis + diff before editing and wait for "apply it".

## Words

- **Disponible** (order line, `fulfillmentSource: 'stock'`): taken *from* the
  shelf. Hidden from the kitchen.
- **Producir** (`'produce'`): made for this order. Shows on the kitchen list
  with the customer's name and deducts its recipe's ingredients when shipped.
- **Vitrina** (kitchen list only): a production-run line made *for* the shelf.
  Unrelated to orders.
- `disponible = existencia + en producción − comprometido`, computed on read
  and never stored.

## Backend (`back/bake-ry/functions`)

- **`services/stockService.js`**
  - `getStocks` returns `committed`, `incoming` and `available` on every row, and
    accepts `itemKeys` to narrow the rows.
  - `committed` counts open orders (status 0/1, not deleted, `dueDate` within the
    last 10 days or later): their Disponible lines, and every line of a resale
    (`unit`) product whatever its source, at `sourceWarehouseId`, or the default
    warehouse when that is empty.
  - `incoming` counts the pending lines' `plannedQty` on open production runs.
  - `reconcileOrderStock(bakeryId, orderId)`: diff-based. It writes the
    difference between what the order should have deducted and what its
    movements already did. It is a `sale` when the order's net is zero (the
    first shipment, or a re-shipment after everything was given back) and a
    `compensation` otherwise. A line with no recipe becomes a gap at
    `stockGaps/{orderId}_{itemId}` and never blocks.
  - `verify`: a drift report.
- **`services/orderService.js`**: `create`, `update`, `patch`, `remove` and
  `patchAll` call `reconcileIfNeeded` after the order commits.
  - It runs only when stock-relevant fields change. The order deducts while
    `!isDeleted && status >= 2` (Enviada or Entregada).
  - A failed reconcile is logged and never fails the order.
  - The editor is null-safe. This fixed a real bug: orders created directly at
    Enviada or Entregada never deducted.
- **Routes:** `GET /stocks?itemKeys=a,b` and `GET /stocks/verify` (admin only).
- **`firestore.indexes.json`**: a new `orders (isDeleted, status, dueDate)`
  index. **Deploy it before production:**
  `firebase deploy --only firestore:indexes`.
- **Tests:** `__tests__/services/orderStock.test.js` (18 tests, emulator).

## Frontend

- **`models/Order.js`**: `OrderItem` carries `fulfillmentSource` (default
  `'produce'`) and `sourceWarehouseId`. Repeat-order history does not copy
  them.
- **`components/forms/OrderItemsManager.vue`**
  - When inventory is on, it loads every stock row.
  - It matches a line to its row on `productId` + `combinationId` at the
    default warehouse.
  - It sets the default on add (wizard and search): `'unit'` → stock;
    `'recipe'` → stock if disponible ≥ qty, else produce; otherwise produce.
- **`components/forms/OrderLineItem.vue`**
  - Recipe products get a chip, **Disponible · N** ↔ **Producir**. Clicking it
    toggles.
  - Resale products get a fixed **Disponible · N**.
  - The chip turns red when the line takes from stock and N < qty. It warns
    and never blocks.
  - `'none'` products show nothing.
- **`views/orders/ShowProductionSingleItems.vue`** and
  **`ShowProductionGroupedItems.vue`**: Disponible lines are filtered out of
  `flattenedOrderItems`. `ShowProductionAssistantOrders.vue` is untouched, on
  purpose (it lists whole orders).
- **`views/inventory/ShowStock.vue`**
  - A row adds `· disp. N` only when disponible ≠ existencia.
  - The detail pane shows Disponible, En producción +N and Comprometido −N
    next to Existencia, each only when it means something.

## Browser checklist

Setup: a bakery with inventory on. `pan` is a recipe product with a recipe of a
stocked ingredient. `torta` is a recipe product with a recipe. `gaseosa` is
`inventoryMode: 'unit'`. One product stays `'none'`. In Bodega, adjust `pan`
to +10.

**Main path**

- [ ] Order form: add 4 pan. The chip says **Disponible · 10**, not red.
- [ ] Save with status Recibida. Bodega → pan: existencia 10, row shows
      `disp. 6`, detail shows Disponible 6 and Comprometido −4.
- [ ] Kitchen lists (single and grouped): the pan line is **not** there.
- [ ] Mark Enviada. Existencia 6, disponible 6 (Comprometido gone). History
      shows "Consumido · pedido xxxxxx".
- [ ] Back to Producida. Existencia 10, disponible 6. History adds a
      "Correcciones" line.
- [ ] Entregada → 6. Edit the quantity to 5 → 5. Delete the order → 10.
- [ ] New order: 1 torta, chip **Producir**, status Recibida. The kitchen
      list shows it with the customer's name.
- [ ] Mark it Entregada. Its ingredients go down in Bodega; torta's own stock
      doesn't move.

**Edge cases**

- [ ] Pan with stock 2, add qty 5. The default is **Producir**. Click it to
      get **Disponible · 2** in red. Save works. Ship it and existencia goes
      negative (−3). The row gets the soft negative wash, not red digits.
- [ ] Change the quantity on a line after adding it. The choice stays; the
      chip just turns red or back.
- [ ] Gaseosa (resale): no toggle, fixed **Disponible · N**. The sale is
      allowed at 0 stock and goes negative once shipped.
- [ ] A `'none'` product: no chip, and the order deducts nothing.
- [ ] POS / create an order directly as Entregada. It deducts immediately
      (this was the bug).
- [ ] On a shipped order, switch a line Disponible → Producir. The product
      comes back and the ingredients go down.
- [ ] Edit only payment or notes on a shipped order. No new movements.
- [ ] Bulk-change the status of several orders from the list. Each one
      deducts once.
- [ ] A product with variations: the chip reads the stock of *that*
      combination.
- [ ] An open order with `dueDate` 11+ days ago no longer counts toward
      Comprometido.
- [ ] Send a production run for pan (Producción, planned 3). Bodega shows
      En producción +3 and disponible up by 3. The kitchen list shows it as
      "Vitrina".
- [ ] A Producir line for a product with no recipe, shipped. The order saves;
      nothing deducts (gap stored).
- [ ] Bakery with inventory **off**: the order form looks exactly like before.
- [ ] Log in as a role that can't read `/stocks` (if any uses the order form):
      the chips show 0 / Producir and nothing errors.

**Known, not bugs**

- Editing an open order past the 10-day window: N reads high by that order's own
  Disponible lines (they are given back, but the server no longer holds them).
- If En producción and Comprometido cancel exactly, Bodega hides all three
  stats.
- No warehouse picker on order lines until a bakery has two warehouses.
- A failed reconcile is only logged. Nothing retries it and `verify` compares
  each stock's cache with the ledger, not orders with the ledger, so it won't show
  it. The order is corrected the next time a stock-relevant field changes.

**Deferred**

- POS: there is no POS screen yet, only the POS system options. When POS is
  switched on, a sale created straight at Entregada must deduct stock
  immediately. The backend already does (the null-editor fix); the unchecked
  part is the POS screen itself. Run the "created directly as Entregada" check
  then.
