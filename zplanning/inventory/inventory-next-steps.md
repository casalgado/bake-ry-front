# Inventory — state and decisions

The source of truth for what the inventory epic does next. Decided 2026-10-07.
Where an older doc disagrees with this one, this one wins.

- The *why* of the data model: [INVENTORY-IMPLEMENTATION.md](./INVENTORY-IMPLEMENTATION.md)
- Screen design: [ui/README.md](./ui/README.md), [ui/HANDOFF-INVENTARIO-UI.md](./ui/HANDOFF-INVENTARIO-UI.md), [ui/EXISTENCIAS-BUILD.md](./ui/EXISTENCIAS-BUILD.md)
- Client-facing explanation (Spanish): the Claude doc "Inventario — Cómo funciona"
- Step-by-step build: [INVENTORY-BUILD-PLAN.md](./INVENTORY-BUILD-PLAN.md)

House rules: ask before running any test. Never touch git unless asked.
`warehouse` in code, "bodega" on screen.

---

## 1. Where we are

**Built and live**

- Ledger backend: `stocks` per (item, warehouse), `stockMovements` append-only,
  `writeMovements`, idempotency keys, `adjust` / `waste` / `transfer`. 31 tests.
- Recipe graph: typed components, live cost, cost propagation, cycle and depth
  guards (`recipeGraph.js`).
- `Product.inventoryMode`, `Ingredient.stockBehavior`, `OrderItem.fulfillmentSource`
  (`'produce' | 'stock'`, unused so far).
- Bodega tab (`ShowStock.vue`): adjust, baja and transfer save.
- Recetario (`RecipeBookView.vue`), preparaciones, the shared item picker.
- Ingreso (`PurchaseDoc.vue`) and Producción (`ProductionDoc.vue`): screens built,
  drafts in localStorage, **Confirmar disabled**.
- Conteo (`CountDoc.vue`): screen shell, no backend, no design pass yet.

**Not built:** providers, purchases, production runs, availability, order
deduction, the recipe expansion walk, counts.

---

## 2. The model

### Three numbers

| Number | Meaning | Stored? |
|---|---|---|
| **Existencia** | physically in the store | yes: `stocks.currentStock`, moved only through the ledger |
| **En producción** (`incoming`) | on open production-run lines | no: computed |
| **Comprometido** (`committed`) | on open order lines with `fulfillmentSource: 'stock'` | no: computed |

**Disponible (`available`) = existencia + en producción − comprometido.**

Disponible is never stored. Editing, cancelling or deleting an order before it
ships needs no inventory code: the order *is* the commitment, and the next read
reflects it. Two stored numbers drift; one derived number can't.

### The ledger moves only on physical events

| Event | Movements |
|---|---|
| Purchase confirmed | `purchase`: + each line |
| Production-run line received | `production`: + output, − its components (expansion walk) |
| Order reaches Enviada or Entregada | `sale`: per line, see §3 |
| Adjust / baja / transfer / count | as today |
| Shipped order edited, deleted, or moved back | `compensation`: the delta |

Payment never touches inventory.

---

## 3. Orders

Order statuses (all repos agree since 2026-10-07): **0 Recibida · 1 Producida ·
2 Enviada · 3 Entregada**.

**When — the order decides.** One predicate, edge-triggered:

```
affectsStock(order) = !order.isDeleted && order.status >= 2
```

Every stock-relevant change runs **one** mechanism, `reconcileOrderStock`:
expand what the order *should* have deducted (nothing when the predicate is
false), diff it against the net of the order's existing movements
(`refs.orderId`), write only the delta. That covers:

- false → true: the full deduction.
- true → false (moved back below Enviada, or deleted): the full reversal.
- true, and `orderItems` change: the delta only.
- Re-running on an unchanged order: an empty diff, zero writes. This is the
  idempotency, not deterministic ids: an order shipped, pulled back and shipped
  again must end at one net deduction, and a fixed sale id would skip the second
  deduction and leave it at zero.

Any other patch (driver, payment, notes…) neither flips the predicate nor
touches `orderItems` while it's true, so no stock code runs.

Pickups that jump straight to Entregada are covered by `>= 2`.

**What — each line decides.**

| `fulfillmentSource` | Commits disponible while open | Deducts when the order ships |
|---|---|---|
| `stock` (Vitrina) | yes | − the product |
| `produce` (Producir) | no | − its ingredients, through the recipe walk |

A `'unit'` product (reventa) always deducts itself; a `'none'` product deducts
nothing. A mixed order is just lines of both kinds. Marking a line *producido* never
touches inventory. A `produce` line with no recipe is a gap, never a block.

**OrderForm** shows disponible per line and suggests `stock` when disponible
covers the quantity, `produce` otherwise. It warns, never blocks.

**Kitchen list:** `stock` lines drop off production's flattened list.

**Known dependency:** POS orders must be born Entregada, or counter sales never
deduct. Tracked in `mad-td.md`; not part of this epic.

**Open:** a forgotten order (never marked shipped) commits stock forever. Plan:
only count open orders due within a window. Window size undecided — comment on
the client doc.

---

## 4. Production runs (new entity)

A run is a promise of future stock, so it must live on the server: `incoming`
is computed from open runs, and the counter sends while the kitchen receives.

```
ProductionRun     { id, date, warehouseId, status: 'open' | 'closed', lines[] }
ProductionRunLine { id, item: { type, id, combinationId }, plannedQty,
                    status: 'pending' | 'received' | 'cancelled',
                    receivedQty, receivedAt, receivedBy }
```

- `ProductionRunLine` lives inside `ProductionRun.js`, lines as an array on the
  run doc, the same way `OrderItem` lives in `Order.js`. Not `OrderItem`: that
  is a sales line (price, tax, discounts) and can't hold a preparación.
- Lines are products in `inventoryMode: 'recipe'` or preparaciones (ingredients
  with a recipe).
- **Draft** stays in localStorage. **Send** creates the run; its pending lines
  count as `incoming`.
- **Receive** one line at its planned quantity: + output, − components, in one
  transaction, deterministic movement ids per receipt (the id carries the
  line's receipt number). The editable received quantity is on hold.
- **Undo** a produced line ("Deshacer producido"): the line goes back to
  pending and the bodega goes back with it. The server writes `compensation`
  movements that are the exact opposite of what that receipt wrote (read from
  the ledger, not rebuilt from the recipe); nothing is deleted, and stock may
  end negative. Receiving again writes a new receipt with its own ids.
- **Cancel** a pending line: leaves `incoming`, no movements.
- A sent run changes one line at a time. While pending: edit its planned
  quantity, or remove (cancel) it. Once produced: undo it. Adding is another
  run. The table's generic undo/redo is hidden in the kitchen lists; the undo
  above is an explicit action. Every Vitrina action (the tick included) asks
  for a plain confirmation first, with the product and, for remove, edit and
  undo, one line saying what happens to the bodega. The run closes when no line
  is pending.
- Receiving consumes the output's own recipe. A tracked product used as a
  component of that recipe comes off its own stock, not re-made.
- **Kitchen:** run lines appear in the existing production list next to order
  lines. Run lines carry a "Vitrina" tag, order lines the customer's name,
  because the same tap moves stock on one and not the other.
- Ingredients come off at receipt, not when baking starts. Counts happen at
  closing, so the mid-bake gap doesn't matter (confirm via the client-doc
  comment).
- Producción picker shows products in `'none'` and `'recipe'` (never `'unit'`),
  and every preparación. Adding a `'none'` product flips it to `'recipe'`; adding
  a `passThrough` preparación flips it to `stocked`. Either way the output gets
  a stocks doc to land in; no recipe is required. Show a one-line note in the
  picker. The backend rejects a run line whose output has no stocks doc.
- ProductionDoc should show, per line, what's already scheduled and what's in
  stock (`mad-td` "reu fitbar"). Free once availability exists.

---

## 5. Providers and purchases (new entities)

```
Provider { id, name, nationalId?, phone?, isDeleted }
Purchase { id, providerId, date, warehouseId,
           lines: [{ item: { type, id, combinationId }, qty, unitCost, updateCost }],
           total }
```

- Provider is an entity from day one. `nationalId` (NIT) because supplier
  e-invoices identify the issuer by NIT (backend `ACTIVE_INVOICE_PARSING.md`).
  Soft delete. Created inline from Ingreso with a name only.
- The provider's last basket (items, last unit cost) is computed from their
  latest purchase. Nothing denormalized on the provider.
- `Ingredient.preferredSupplier` (free text) is deleted.
- A purchase is immutable once confirmed. Mistakes are fixed with adjustments.
- One `purchase` movement per line, `unitCost` on the movement, `refs.purchaseId`.
- **Cost update is on by default, per line** (`updateCost`); untick to keep a
  one-off price. Confirmar names the count and asks once before applying.
  Applied in the purchase's
  transaction; all or nothing. The new cost is the last price paid, not an
  average. Ingredients without a recipe (a preparación's cost comes from its
  recipe) and resale products / combinations whose cost is manual (never a
  recipe-costed one). A flagged price change shows
  `antes $3.200 · subió 9%`.
- No tax fields until an accounting screen exists to fill them.
- Draft stays in localStorage.

---

## 6. Availability endpoint

No new route. `GET /bakeries/:bakeryId/stocks` returns `committed`, `incoming`
and `available` on each row, computed server-side. `?itemKeys=` narrows it for
OrderForm. The browser never sums orders or builds item keys.

---

## 7. Milestones

Each ends shipped and used.

| # | Milestone | Backend | Frontend |
|---|---|---|---|
| 1 | **Providers + Ingreso** | Provider CRUD, last-basket read, Purchase create → `purchase` movements, cost update in the same transaction, drop `preferredSupplier` | Provider list on PurchaseDoc, basket prefill, price-change flag, per-line cost checkbox, Confirmar on |
| 2 | **Production runs** | Export `resolveRecipeId` / `normalizeComponent` / `MAX_DEPTH`; `expandComponents`; ProductionRun model + routes (send, edit, receive line, cancel line, preview) | ProductionDoc sends; picker fix; kitchen list shows run lines with "Vitrina" |
| 3 | **Orders + availability** | `committed` / `incoming` / `available` on `GET /stocks`; `affectsStock` edges in `orderService` (create, patch, patchAll, remove); compensation; gaps | Disponible in Bodega and OrderForm; source toggle per line; `stock` lines off the kitchen list |
| 4 | **Conteo** | design conversation first, then `stockCountService` | `CountDoc` saves; explained vs unexplained merma |
| 5 | Multi-bodega UI | — | Bodega editor in settings. Only when a client has two bodegas |

---

## 8. Invariants (unchanged, restated because they bite)

1. Movements are append-only. Corrections are new movements.
2. Every movement goes through `writeMovements`.
3. Movement + `currentStock` increment in one transaction.
4. Transactions read everything before writing. Unbounded walks happen outside.
5. `itemKey` / stock-doc ids are built by one function each. The frontend never builds one.
6. No "already deducted" flags on documents. Idempotency comes from
   deterministic ids (hand-entered movements, run-line receipts) or from the
   order's diff against its own movements (§3).
7. No unit conversions in the ledger.
8. Inventory never blocks a sale.
9. `inventoryMode: 'none'` items show no inventory UI.
