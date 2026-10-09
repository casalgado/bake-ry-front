# Conteo (M4): handoff

> **Status: built 2026-10-09.** This is the planning trail. What was built, and
> where it differs from this plan (400 not 409, no composite index, no
> `subscribeToOpenCount`, the verify boundary), is in
> [INVENTORY-IMPLEMENTATION.md §15](./INVENTORY-IMPLEMENTATION.md). That section wins.

Planning for the stock count, front and back. Started 2026-10-09. When this doc
says **Decided**, the user confirmed it. **Proposed** means it still needs a yes.
Once planning is finished, the decisions move into `inventory-next-steps.md` §3D
and a new session implements from here.

House rules and environment: `inventory-next-steps.md` §0. The contract you must
not break: §2 of the same doc.

---

## 1. What exists today

- **Frontend:** `src/views/inventory/CountDoc.vue` is a working shell. It covers
  one bodega, groups rows by shelf, has search, treats an empty box as "sin
  contar", and shows expected, difference and how many items will move, all only
  after entry. The draft lives in `inventoryDocsStore` (kind `conteo`) in
  localStorage. "Cerrar conteo" is disabled.
- **Backend:** `MOVEMENT_TYPES.COUNT` exists. Stocks docs carry `baselineQty`
  and `baselineAt`. `verify()` sums movements with `timestamp >= baselineAt`.
  There is no model, service, route or test for counts yet.
- `EXISTENCIAS-BUILD.md` §4.3 is the older shape. This doc replaces it: the
  items become a map instead of an array, there is no localStorage draft, and
  there are no date or responsable fields.

---

## 2. Decisions (confirmed by the user)

1. **Shared, server-side, realtime.** A count lives on the server. Several people
   count the same one, each on their own device, and see each other's numbers
   live.
2. **Roles:** `bakery_admin` and `bakery_staff` (staff is "supervisor"), plus
   `system_admin`. That is `requireBakeryStaffOrAdmin`, for everything count
   related.
3. **Two people, same item: the latest number wins.** Each row shows who
   counted it.
4. **Nothing sells during a count.** Counting happens with the shop closed. The
   difference is computed against `currentStock` at close.
5. **Review is a page, not a popup.** You can only submit from the review page.
   The counting page has no submit button.
6. **Alert threshold:** a row is flagged when |difference| × unit cost ≥
   **$50.000**. Money only, no percent rule. One frontend constant for now. A
   per-product threshold can come later, as a field on the item, when a client
   asks. Alerts warn and never block. The button label carries them: "Cerrar
   conteo con 2 alertas".
7. **Where the mismatch lives:** in the closed count document itself (frozen
   expected, counted, difference, cost, bajas since the last count, who counted
   each row), plus the `count` movements in the ledger. No analysis tab until
   several counts exist to compare.
8. **Merma framing:** bajas (`waste`) already lowered `currentStock` before the
   count, so the count's whole difference is *unexplained*. The summary reads
   "since the last count: bajas reported N + found by the count M (unexplained)".
9. Kept from the original design: you type what is on the shelf; the expected
   number shows only after entry; an empty box means "not counted", not zero; a
   count covers one bodega; uncounted items keep their baseline; closing is one
   transaction.

---

## 3. Proposed: screens and routes

Each count is its own resource with an id. The URL carries the id, so a link
can be shared ("join this count") and the past-count view reuses the same
route.

| Route | Screen |
|---|---|
| `/inventory/conteos` | List. The open count (if any) is pinned on top with "Continuar · 23/60 · Ana, Luis"; with no open count, the top shows "Empezar conteo". Below it, closed counts: date, who counted, items counted, net value. The sidebar "Conteo" link points here. |
| `/inventory/conteos/:id` | **Counting** (today's `CountDoc.vue`, now live). If the count is closed, redirect to `revisar`. |
| `/inventory/conteos/:id/revisar` | **Review.** Open: live, with Cerrar. Closed: frozen, read-only, adds the bajas-since-last-count column. Same component. |

The Bodega (Existencias) Conteo button deep-links to the open count when there
is one, and its label shows progress.

**Counting page:** rows per shelf, a box per row; after entry: "contado por Ana ·
sistema decía 10 · −3". Header: progress `23 / 60` and who has counted so far.
Actions: "Revisar →" and "Descartar". The Fecha and Responsable fields are
removed: the date is the close time (a backdated count would contradict
`baselineAt`), and who counted is recorded per row.

**Review page:**
```
Contados 23 · Sin contar 37 (no cambian)
Con diferencia 6 · Faltante $84.000 · Sobrante $6.000
⚠ Mantequilla   sistema 10   contado 2   −8   −$64.000   Ana
  Harina        sistema 10   contado 7   −3   −$12.000   Ana
  Cold Brew     sistema 24   contado 25  +1    +$6.000   Luis
  … mostrar 17 sin diferencia
[← Volver a contar]                 [Cerrar conteo con 1 alerta]
```
- Only counted rows appear, sorted by |difference value|, flagged rows first.
  Rows with no difference are collapsed.
- A row with no cost shows "sin costo" and can't be flagged.
- Live while open: numbers typed by another person arrive during review.
- Closing asks once (native `confirm()`, same as the rest of the section), then
  the page turns into the frozen view.

**Descartar** (open counts only) asks first, names who has been counting, and
ends the count for everyone. A discarded count stays in the list as
"Descartado · por Ana", read-only, with its typed rows. A count discarded right
after showing a big shortfall is exactly what an owner needs to see, so it is
never hidden.

**Stale warning:** when an open count was started more than 12 h ago, the review
page shows "Abierto hace 14 h: las ventas de ese tiempo quedan absorbidas por el
conteo". It warns and never blocks.

---

## 4. Proposed: backend

### Model: `src/models/StockCount.js` (`BaseModel`, like `ProductionRun.js`)

```
bakeries/{bakeryId}/stockCounts/{id}
  warehouseId
  status: 'open' | 'closed' | 'discarded'
  createdBy: { userId, name }      createdAt
  items: {                          // map keyed by itemKey, not an array
    [itemKey]: { qty, by: { userId, name }, at }
  }
  closedBy, closedAt                // set by close AND by discard; status tells them apart
  // close only:
  totalItems                        // stocks in the bodega at close ("23 de 60")
  items[itemKey] also gains: name, unit, expectedQty, diffQty,
                             unitCost (null = no cost), wasteSinceBaseline
```
No `isDeleted`: discarding is a status, so the list keeps showing it.
Why a map: each typed number is a single field write (`items.<itemKey>`), so two
people on different rows never overwrite each other. Item keys
(`ingredient_<id>`, `product_<id>_<comboId>`) are safe as field paths. Totals
(faltante, sobrante, alertas) are computed on read, not stored.

### Endpoints (`requireBakeryStaffOrAdmin` on all of them)

| Method | Path | Does |
|---|---|---|
| GET | `/stockCounts` | List (factory query: `status`, sort by `closedAt`) |
| GET | `/stockCounts/:id` | One |
| POST | `/stockCounts` `{ warehouseId }` | Open a count. **If one is already open for that bodega, return it** (open-or-join, so two people pressing Empezar at once end up on the same count). A transaction queries `status == 'open' && warehouseId`. |
| PUT | `/stockCounts/:id/items/:itemKey` `{ qty }` | Set one row (`qty ≥ 0`), or clear it (`qty: null` → `FieldValue.delete()`). Rejected when closed. The itemKey must have a stocks doc in that bodega. |
| POST | `/stockCounts/:id/close` | See below |
| POST | `/stockCounts/:id/discard` | Descartar. Only while open. Sets `status: 'discarded'`, `closedBy`, `closedAt`. Writes nothing to the ledger |

No generic PATCH: items only change through the per-row PUT.

### Close: one transaction

1. **Outside the transaction** (invariant 4, unbounded reads):
   - unit cost per item, the same rules as the frontend's `useItemCatalog.costOf`
     (ingredient `costPerUnit`, product combination `costPrice`);
   - `wasteSinceBaseline`: the sum of `waste` movements for the item since its
     `baselineAt`.
2. **Inside:**
   - read the count (it must be `open`, else 409; closing twice is rejected), the
     counted items' stocks docs, and the number of stocks docs in the bodega;
   - per counted item: `diff = qty − currentStock`. When `diff ≠ 0`, write one
     `count` movement (`refs.countId`) through `writeMovements(..., { transaction })`;
   - every counted item, diff or not, gets `baselineQty = qty` and
     `baselineAt = closeTime` (a zero-diff count still verifies the item);
   - freeze the item fields above; `status = 'closed'`.

**Two traps for the implementer:**
- `writeMovements` makes one cache write per stocks doc. Don't add a second
  `t.update` on the same doc for the baseline. Give `writeMovements` an option to
  merge extra fields into that one write (`stockFields` per stocks doc id), and
  handle zero-diff items, which have no movement, with a plain update.
- `verify()` keeps movements with `timestamp >= baselineAt`. If the count
  movement and `baselineAt` share the same instant, the delta gets added on top
  of the new baseline and every counted item shows drift. Change the filter to
  `>`, or stamp the movement 1 ms before `baselineAt`. Decide on purpose and
  cover it with a test.

### Firestore

- `firestore.rules`: `match /stockCounts/{id}`, read for `isBakeryStaff(bakeryId)`,
  write `false` (same as `productionRuns`).
- Index: `stockCounts (status, closedAt desc)` for the list
  (`status in ['closed', 'discarded']`). The open-count lookup is equality-only
  and needs no composite index.

### Tests (write them; run only with the user's OK)

Open-or-join returns the same id twice. PUT and clear a row. PUT on a closed
count is rejected. Close: the baseline absorbs earlier movements; uncounted
items are untouched; a zero-diff item gets a baseline but no movement;
`verify()` is clean right after close; closing twice is rejected; descartar
writes no movement; descartar or close on a non-open count is rejected.

---

## 5. Proposed: frontend

- `services/stockCountService.js` on `resourceService`, plus
  `subscribeToCount(id)` (`onSnapshot` on the doc) and `subscribeToOpenCount()`
  (query `status == 'open'`), following the existing
  `stockService.subscribeToAvailability` pattern.
- `CountDoc.vue`: reads the doc live; each input sends a debounced PUT per row;
  the shown value is the server's. Drops the Fecha and Responsable fields,
  Confirmar and the localStorage path.
- `CountReview.vue`: open and closed modes; `ALERT_VALUE = 50000` lives here.
- `CountList.vue`: `/inventory/conteos`.
- `inventoryDocsStore`: remove the `conteo` kind (ingreso and producción keep
  their drafts).
- Bodega button and sidebar link point to the new routes.
- All new screens use `ui-*` (read `src/assets/ui/CLAUDE.md`), no one-off classes.

---

## 6. Resolved on 2026-10-09 (the user delegated these)

1. **A count left open for hours:** warn on the review page past 12 h (§3).
   Never block.
2. **The sidebar "Conteo" link goes to the list.** The list pins the open count,
   so it is one click either way, and it is the only page that also works when
   no count is open.
3. **Descartar keeps the count visible** as "descartado · por X". It is a
   status, not a soft delete (§4). Hiding a discarded count would hide the one
   event an owner most wants to see.
4. **Only admin and staff see counts.** `accounting_assistant` has its own
   dashboard and no inventory routes. Giving it access means building into that
   dashboard, so it waits until accounting asks for merma.
5. **Saving rows:** a debounced PUT per row, about 400 ms after the last
   keystroke. 60 to 500 rows, one request each, is fine.

The whole plan (§2 to §5) is the agreed design. Next step: implement, §7.

---

## 7. Implementation order (for the next session)

1. Backend: model, service (open-or-join, set row, close, discard), the
   `writeMovements` option, the `verify` boundary fix, routes, rules, index,
   tests (ask before running).
2. Frontend: service and listeners, routes, `CountList`, live `CountDoc`,
   `CountReview`, wire Bodega and the sidebar, remove `conteo` from
   `inventoryDocsStore`.
3. Manual check: two browsers on the same count (live rows, latest number wins);
   review flags a $50.000+ row; close; Existencias shows the counted numbers;
   `GET /stocks/verify` is empty; the closed count reopens frozen from the list.
4. Move decisions into `inventory-next-steps.md` §3D, mark M4 done.
