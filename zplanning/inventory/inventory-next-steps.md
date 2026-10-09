# Inventory: where we are and what's next

The source of truth for the inventory epic. Updated 2026-10-09, after the M3
manual checks.
Where an older doc disagrees with this one, this one wins. Read §0, §1 and §3
to continue; §2 is the contract you must not break.

- Why the data model is what it is: [INVENTORY-IMPLEMENTATION.md](./INVENTORY-IMPLEMENTATION.md)
- Screen design: [ui/README.md](./ui/README.md), [ui/EXISTENCIAS-BUILD.md](./ui/EXISTENCIAS-BUILD.md) (its §4.3 Conteo shape is replaced by INVENTORY-IMPLEMENTATION.md §15)
- Order-side manual checklist and vocabulary: [M3-HANDOFF.md](./M3-HANDOFF.md)
- How M1 to M3 were built, step by step: [INVENTORY-BUILD-PLAN.md](./INVENTORY-BUILD-PLAN.md)
- Client-facing guide (Spanish): the Claude doc "Inventario — Cómo funciona"
- The previous, longer version of this doc (full run and purchase specs, old
  milestone table) is in git: `git show d94e4fc:zplanning/inventory/inventory-next-steps.md`

---

## 0. Working rules and environment

**House rules (the user's, non-negotiable)**
- Ask before running any test (`npm test`, jest). Even mid-task.
- Never touch git unless asked: no commits, branches, worktrees.
- Explain before editing: diagnosis, diff and blast radius as text, then wait for
  "apply it". (A direct "fix X" or "do Y" counts as the go-ahead.)
- No one-off CSS classes. Add a generic color-only utility or compose existing
  `ui-*` classes plus Tailwind for layout. Read `src/assets/ui/CLAUDE.md` before
  touching `ui.css`; a new class also goes in the gallery (`/system-admin/ux`).
- Never migrate old Tailwind views. New screens use `ui-*`.
- No history in comments ("used to be X"). No proactive linting. Patch with the
  Edit tool, not shell scripts. Vue SFC order: script, template, style.
- Code in English, UI in Spanish: `warehouse` in code, "bodega" on screen.
- Commit messages: one subject line, no body, no trailers.
- Critical senior-dev stance: push back on weak ideas, prefer the simplest thing.

**Vocabulary (one meaning each, the mix-up cost us a day)**
- **Disponible** (order line, `fulfillmentSource: 'stock'`): taken from the shelf.
  Hidden from the kitchen.
- **Producir** (`'produce'`): made for this order. On the kitchen list with the
  customer's name; deducts its recipe's ingredients when shipped.
- **Vitrina** (kitchen list only): a production-run line made for the shelf.
- `disponible = existencia + en producción − comprometido`, computed on read,
  never stored. Chips read "N disponibles" / "Producir".
- Order statuses: 0 Recibida, 1 Producida, 2 Enviada, 3 Entregada. Stock moves at
  `status >= 2` and not deleted.

**Environment**
- Dev server is always running (`localhost:5173`); don't start it. Emulators
  (backend repo, `npm run serve`): Firestore 8080, Auth 9099, Functions 5001,
  Storage 9199. Firebase project `bake-ry`. Dev bakery id: `es-alimento-dev`.
- Repos: frontend `web/front/bake-ry-front`, backend `web/back/bake-ry`
  (`functions/src`). Both are committed through M3 (frontend `d94e4fc`, backend
  `f6bfe16`). **Uncommitted from 2026-10-09:** frontend `OrderItemsManager.vue`
  and `OrderLineItem.vue` (live chips, one figure per product); backend
  `orderService.js`, `stockService.js` and `orderStock.test.js` (inventory flag
  check). `functions/src/middleware/requestLogger.js` is also modified and
  unrelated.
- Re-seed: `npm run seed:*` scripts in `functions/package.json`. The emulator
  currently holds the 2026-10-09 test orders (two real ones, 21 `a5seed*` copies,
  one open Vitrina run) and Focaccia at −27; re-seed for clean numbers.
- Dev data: Focaccia (recipe product), Sourdough with combinations Pequeño and
  Mediano, Baguette (combinations), Caja Degustación (recipe), Cold Brew (resale,
  `unit`, 24 in stock). Check the stock screen for the current numbers.
- Request log: every API call is written as JSON to
  `functions/src/middleware/request_logs/` (timestamp, body, response, time).
  Useful for bulk timings and for "did the PATCH happen".

**Reading the ledger straight from the emulator** (read-only, no auth in the
emulator): ledger lines are in `stockMovements`, derived stock in `stocks`.
```
B='http://localhost:8080/v1/projects/bake-ry/databases/(default)/documents/bakeries/es-alimento-dev'
curl -s -H "Authorization: Bearer owner" "$B/stockMovements?pageSize=300" > mv.json
```
Decode Firestore's typed JSON with a small node script (fields are
`{stringValue|integerValue|mapValue…}`). The sum of a stock's movements since its
baseline must equal `stocks.currentStock`; that is what `GET /stocks/verify`
reports. This is how the "Existencias shows 6, should be 0" report was settled:
the ledger summed to 0, the screen was stale.

**Driving the app in a browser (Claude in Chrome)**
- A new Chrome window starts logged out. The user must log in; the bot never types
  credentials. Re-check after any tab-group reset.
- The first click after a navigation is often swallowed (date buttons need the
  page hydrated). Wait, then click again, and screenshot to confirm.
- In Crear Pedido, typing a product into "Buscar" adds three lines. Use Explorar
  (category tile, product tile, quantity tile) instead.
- Changing an order's status: `/dashboard/orders/delivery`, pick Mes, click the
  Estado cell. Icons: `0` Recibida, oven Producida, scooter Enviada, building
  Entregada; one more click wraps to 0 (on the driver table 0 is skipped, 2 and 3
  swap). Clicking Entrega's *Tipo entrega* cell by mistake toggles delivery
  type; the table's undo button reverts it.
- Edit an order: Pedidos, click the row (it selects), then Editar in the bottom
  action bar. Eliminar is in the same bar.
- Existencias: click a row for its detail pane (history, Ajustar, baja). The page
  text read via `get_page_text` only shows the detail after a row is selected.

---

## 1. State

| Milestone | State |
|---|---|
| M1 Providers + Ingreso | Done, committed |
| M2 Production runs | Done, committed (backend `d94cb39`) |
| M3 Orders + availability | Done. Manual checks passed 2026-10-09 (§3A); two fixes from them uncommitted |
| M4 Conteo | Done 2026-10-09, not committed. Backend tests and browser checks passed. Rules: [INVENTORY-IMPLEMENTATION.md §15](./INVENTORY-IMPLEMENTATION.md) |
| M5 Multi-bodega UI | Only when a client has two bodegas |

**Passed by hand so far (2026-10-08):** order form chip and default source;
Disponible line takes no existencia until shipped, committed shows on the stock
screen; kitchen lists (single and grouped) hide Disponible lines; Enviada, back to
Recibida (compensation), re-ship; edit a shipped order's quantity; delete an order
restores stock; Producir path (ingredients deducted, product stock untouched,
kitchen shows the customer); resale chip and sale; a line switched Producir to
Disponible on a shipped order moved stock correctly; bulk status on 3 orders
reconciled each once (0.45 to 1.0 s per call); realtime refresh (before the
listeners moved into the store); the two-line existencia display.

**Passed by hand on 2026-10-09:** everything in §3A, results there.

---

## 2. The contract (do not break)

**Three numbers.** Existencia (`stocks.currentStock`, only moved by the ledger),
En producción (`incoming`: pending lines on open runs), Comprometido
(`committed`: open orders' `stock` lines). Disponible is derived on read.

**The ledger moves only on physical events.**

| Event | Movement |
|---|---|
| Purchase confirmed | `purchase`: + each line |
| Run line received | `production`: + output, − components (recipe walk) |
| Order reaches Enviada or Entregada | `sale`: per line |
| Adjust / baja / transfer / count | as named |
| Shipped order edited, deleted or moved back | `compensation`: the delta |

Payment never touches inventory.

**Orders.** One mechanism, `reconcileOrderStock(bakeryId, orderId)`: expand what
the order should have deducted (nothing when `affectsStock` is false), diff it
against the net of the order's existing movements (`refs.orderId`), write only
the delta. That gives ship, revert, edit and idempotency with no flags. Each line
decides: `stock` deducts the product; `produce` deducts its ingredients through
the recipe walk; a `unit` product always deducts itself; `none` deducts nothing.
A `produce` line with no recipe becomes a gap (`stockGaps/{orderId}_{itemId}`),
never a block. A failed reconcile is logged and never fails the order.
`reconcileIfNeeded` (`orderService.js`) is the gate: it runs after every order
write and calls reconcile only when the order crossed `affectsStock` or a shipped
order's stock signature changed, **and** the bakery's inventory flag is on. With
the flag off nothing is written and past movements stay. The check lives there,
not in `expandOrder`: an empty plan there would be diffed against the order's
past movements and undo them.

**Forgotten orders.** An open order counts as comprometido only while its `dueDate`
is at most 10 days past. The constant is in backend `stockService.js`
(`COMMITTED_WINDOW_DAYS`) and hand-copied in frontend `services/stockService.js`.

**Production runs.** A run lives on the server; send creates it, lines are
received, undone, edited or cancelled one at a time. Receipts have deterministic
movement ids; undo writes the exact opposite of what the receipt wrote (read from
the ledger, not rebuilt from the recipe).
- Ingredients come off **at receipt**, not when baking starts. Counts happen at
  closing, so the mid-bake gap doesn't matter. Still to confirm with the client:
  there is an open comment on the Claude doc "Inventario — Cómo funciona".
- The Producción picker lists products in `none` or `recipe` (never `unit`) and
  every preparación. Adding a `none` product flips it to `recipe`; a
  `passThrough` preparación flips to `stocked`, so the output has a stocks doc to
  land in. The backend rejects a run line whose output has none.
- A pending line can be edited (planned quantity) or removed (cancelled); a
  received line can be undone; adding is another run. The run closes when no line
  is pending. Every Vitrina action asks for a plain confirmation first.
- Received quantity ≠ planned is on hold: until then the difference is a baja.
- Run lines carry a "Vitrina" tag and order lines the customer's name, because the
  same tap moves stock on one and not the other.

**Purchases.** Immutable once confirmed. One `purchase` movement per line. Cost
update is on by default per line (the new cost is the last price paid, not an
average), applied inside the purchase transaction. It covers ingredients without
a recipe **and resale products or combinations with a manual cost** (never a
recipe-costed one; reversed on 2026-10-07 from "products: no update"). Drafts
stay in localStorage. No tax fields until an accounting screen exists.

**Availability.** `GET /bakeries/:bakeryId/stocks` returns `committed`, `incoming`,
`available` per row (`?itemKeys=` narrows). The browser never sums orders.
`GET /stocks/verify` is the drift report (admin only).

**Frontend pieces to know.**
- `OrderItemsManager.vue`: `availableFor(item)` = server figure + the saved
  order's own lines (`savedLines`, edit mode only). One figure per product, the
  same on every line, and editing a quantity never moves it. `isShortFor(item)`:
  the draft's `stock` lines of that product together exceed it. Default source on
  add: resale `stock`; recipe `stock` if what the draft hasn't already taken
  covers the quantity, else `produce`. The form runs
  `stockStore.watchAvailability()` while mounted, so a saved order (here or in
  another tab) updates the chips.
- `OrderLineItem.vue`: the chip; every `stock` line of a short product is red. It
  warns, never blocks.
- `ShowStock.vue`: existencia with a brand-colored `disp. N` line under it, only
  when it differs. `ui-ink-brand` is the generic brand-text utility.
- `stockStore.watchAvailability()` (service `subscribeToAvailability`): listens to
  the `stocks` collection and the open-orders slice, debounced refetch, started by
  `InventoryLayout.vue` and by the order form. Needs the `stocks` read rule in
  `firestore.rules` (any member of the bakery passes it).
- `DataTable` column option `maxBulk: 20` (Entrega and the driver table): refuses
  a status toggle over 20 selected rows with a toast.

**Invariants.**
1. Movements are append-only. Corrections are new movements.
2. Every movement goes through `writeMovements`.
3. Movement and `currentStock` increment in one transaction.
4. Transactions read everything before writing; unbounded walks happen outside.
5. `itemKey` and stock-doc ids come from one function each. The frontend never
   builds one.
6. No "already deducted" flags. Idempotency is a diff against the order's own
   movements, or deterministic ids for hand-entered movements and receipts.
7. No unit conversions in the ledger.
8. Inventory never blocks a sale.
9. `inventoryMode: 'none'` items show no inventory UI.

---

## 3. What to do next, in order

### A. Manual checks: done (2026-10-09)

All run in a logged-in dev session, numbers confirmed against the emulator ledger.

| Check | Result |
|---|---|
| Edit gives back the order's own lines | Pass: 10 free with A's 5 counted; at stock 5, no red |
| Duplicar | Pass: the copy reads 0, red |
| Same draft, two lines of one product | Pass: both red; a line that doesn't fit defaults to Producir |
| Next order in the same Crear Pedido form | **Failed, fixed:** the form loaded stock once and went stale after a save. It now listens live (§2 frontend pieces) |
| Chips of one product differed per line | **Fixed:** one figure per product, red together (§4) |
| Live Existencias across tabs, leave and return | Pass, console quiet |
| Bulk cap | Pass: 21 refused with the toast; 20 shipped in 3.86 s (0.19 s per order), each reconciled once. Cap stays at 20 |
| Shortfall, resale below zero | Pass: both go negative |
| `none` product | Pass: no chip, no movement |
| Variations | Pass: Pequeño reads its own row, Mediano Producir |
| Producir with no recipe | Pass: order saves, `stockGaps` doc |
| Payment-only edit on a shipped order | Pass: no movement |
| Vitrina run, planned 3 | Pass: En producción +3, disponible moved, kitchen shows "Vitrina" |
| Inventory off | Form showed no chips, but the backend still wrote a sale. **Fixed:** flag check in `reconcileIfNeeded` (§2 Orders), with a test |
| Role without `/stocks` | Can't happen: every role that reaches the order form passes `requireBakeryAssistant`; customers have no order form |

Dropped on purpose: the 11-day window. Still worth a look by hand once the fixes
are committed: ship an order with inventory off and confirm the ledger stays
untouched (the test covers it; the emulator run predates the fix).

### B. Before production

1. **Backend tests**, with the user's OK and emulators running: the full suite
   once. `productionRun` has not run since the run-line name/unit change.
   `orderStock.test.js` (19 tests, with the flag check) passed on 2026-10-09; the
   purchase tests passed earlier. `orderService` and `orderController` tests go
   through the changed `reconcileIfNeeded` and haven't run since.
2. **Inventory-off safety.** Done: orders of a bakery with the flag off never
   touch the ledger. Turning the flag off later freezes, not undoes, past
   movements; turning it back on starts from the first count (B5).
3. **Bulk volume.** The backend reconciles bulk-updated orders one at a time
   (0.19 s each in the emulator, 3.86 s for 20). A timeout midway leaves later
   orders unreconciled until touched. The cap of 20 covers it; re-time in prod.
4. **Deploy order:** composite indexes first (including the new orders
   `(isDeleted, status, dueDate)`), wait until each shows Enabled, then Firestore
   rules (`productionRuns` and `stocks` read rules), then functions, then hosting.
   A function deployed before its index is built fails `GET /stocks`.
5. **Switching it on for a real bakery:** do the first count (Ajustar or Conteo)
   before turning the flag on, or shipping produces negatives. After the first
   day, call `GET /stocks/verify`; the drift report must be empty.
6. **Legacy order lines.** Open orders saved before M3 have `fulfillmentSource`
   `'produce'` even for resale products. The backend ignores them for committed;
   the form counts them. They clear when the order ships or leaves the 10-day
   window. Optional at deploy: a one-off update setting `'stock'` on open orders'
   `unit` lines.

### C. Small code leftovers (each is its own small task)

- **ProductionDoc per-line context**: show what is already scheduled and what is
  in stock per line (`mad-td` "reu fitbar"). Availability now exists, and
  `ProductionDoc.vue` does not read `available` or `incoming` yet.
- **`ingredientService.create`** does not call `syncIngredientStockDoc` (only
  update does), so an ingredient created already `stocked` has no stocks doc until
  its first edit. Backend, small.
- **Explicit index** on `stockMovements.refs.orderId`. Works through the automatic
  single-field index today; reconcile now queries it on every ship, so make it
  explicit (`firestore.indexes.json`).
- **Realtime for production runs** (optional): a run sent from another browser
  doesn't refresh Existencias until a stocks or order change fires. Same-tab sends
  already refetch. One more listener in `subscribeToAvailability` if wanted.
- **POS orders born Entregada**: tracked in `mad-td.md`, outside this epic. Without
  it, counter sales never deduct. When POS is switched on, run the "created
  straight at Entregada" check. The backend already handles it.
- Stale text elsewhere: [M3-HANDOFF.md](./M3-HANDOFF.md) is a checklist whose
  checks are all run (§3A); safe to delete.

### D. M4: Conteo

**Built 2026-10-09.** The decisions and how it works are in
[INVENTORY-IMPLEMENTATION.md §15](./INVENTORY-IMPLEMENTATION.md); they replace
`EXISTENCIAS-BUILD.md` §4.3 and the build plan's M4 section. Counts also give the
production switch-on a baseline (B5). Left:
1. Commit, front and back.
2. Deploy: the `stockCounts` read rule goes out with the rules step (B4), before
   hosting, or the live count views get permission errors. No new index.
3. Bring the client guide (Claude doc "Inventario — Cómo funciona") up to date
   with how a count works.
4. Optional: make the Bodega button's count progress live (it reads the list once
   per visit, so a row saved in the same moment shows on the next visit).

### E. M5: Multi-bodega UI

Bodega editor in settings. Only when a client has two bodegas. The code already
supports `warehouseId` everywhere; the order line has no picker until then.

---

## 4. Decisions already made (don't reopen without a reason)

- Entregada stays toggle-reachable. We considered locking it (`lockedValue`) but
  the edit form has no status field, so locking would trap orders, and bulk
  selection can bypass a lock anyway. The ledger records both directions, so
  accidental reverts are visible and reversible. Left as is.
- Bulk status is capped at 20 rows on the two tables that can ship an order; the
  calendar's toggle (0 and 1 only) never moves stock and is uncapped. Parallel
  reconcile was rejected: orders share stock docs, contention could leave an order
  silently unreconciled.
- The same-draft over-promise is fixed in the form; saved lines are given back in
  edit mode, copied once at setup, only for saved orders (Duplicar has no id).
- The chip shows what is free before this order, one figure per product, and
  never moves while quantities are edited; only the red flag reacts to the
  draft. A per-line "left for this line" figure was tried and rejected: two lines
  of one product showed different numbers. A "faltan N" label is not built; red
  says short.
- The inventory flag is checked in `reconcileIfNeeded`, never in `expandOrder`
  (see §2 Orders). Names stay `reconcileOrderStock` / `reconcileIfNeeded`:
  "reconcile" is the accounting sense, making the order and its movements agree.
- Realtime listens to `stocks` plus the open-orders slice, not the whole orders
  collection. The first snapshot of each is skipped.
- Audit items left alone, with reasons: counting `unit` lines (the ship rule is
  `unit` or `stock`, so the frontend is right and the backend `committed` is the
  odd one out); float compare on `available !== qty` (exact when nothing is
  committed); `fulfillmentSource ?? 'produce'` (the API can send null).
- Not doing: unit conversions, tax fields, per-bodega order pickers, a stored
  disponible, deleting movements.
