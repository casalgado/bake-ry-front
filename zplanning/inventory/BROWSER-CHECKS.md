# Inventory: browser checks

Everything that no automated test covers, with the edge cases. Tick as you go.
Source of truth for behavior: `zplanning/inventory/INVENTORY.md`.
"Expected" is what must happen; "Edge" is a variation worth trying right after.

---

## 0. Setup, tools and conventions

### Environment
- [ ] Emulators up (backend repo, `npm run serve`): Firestore 8080, Auth 9099, Functions 5001. Emulator UI: http://localhost:4000/firestore. Dev server on 5173.
- [ ] The backend test run **wipes the emulator's Firestore**. Re-seed first (`npm run seed:*` scripts in `functions/package.json`) and check the stock screen has data before you start.
- [ ] Bakery `es-alimento-dev`, inventory switch **on** (system admin, Negocios).
- [ ] Log in yourself; nobody else types credentials. New Chrome windows start logged out.
- [ ] Catalog you need (create what's missing):
  - a **recipe** product with a recipe of stocked ingredients (e.g. Focaccia, "pan");
  - a product **with variations** (e.g. Sourdough Pequeño / Mediano), one combination **with** a recipe and one **without**;
  - a **resale** product (`unit`, e.g. Cold Brew), with some stock;
  - a **none** product (untracked);
  - a **preparación** (ingredient with recipe + yield), `stocked`;
  - a product whose recipe is **missing** (recipe mode, no recipe);
  - a client with **order history** that includes a resale and a recipe product;
  - a provider with a **previous purchase**.
- [ ] Accounts for each role: `bakery_admin`, `bakery_staff`, `production_assistant`, `delivery_assistant`, `accounting_assistant`.

### Reading the ledger (read-only)
```
B='http://localhost:8080/v1/projects/bake-ry/databases/(default)/documents/bakeries/es-alimento-dev'
curl -s -H "Authorization: Bearer owner" "$B/stockMovements?pageSize=300" > mv.json
curl -s -H "Authorization: Bearer owner" "$B/stocks?pageSize=300"        > st.json
```
Values come typed (`stringValue`, `integerValue`, `mapValue`…). Or just use the emulator UI.

### Calling admin endpoints from a shell
Get your ID token: DevTools → Application → IndexedDB → `firebaseLocalStorageDb` → `firebaseLocalStorage` → `stsTokenManager.accessToken`.
```
T=<token>; API=http://localhost:5001/bake-ry/us-central1/api/bakeries/es-alimento-dev   # adjust to your function URL
curl -s -H "Authorization: Bearer $T" "$API/stocks/verify"
curl -s -H "Authorization: Bearer $T" "$API/stocks/verify-orders?days=14"
curl -s -X POST -H "Authorization: Bearer $T" -H "Content-Type: application/json" -d '{}' "$API/stocks/reconcile-orders"
```
`verify` = stocks cache vs ledger. `verify-orders` = shipped orders vs what they should have deducted. Both must be `[]` after a clean session.

### How to read the screens
- **Existencia**: the big number. **disp. N** under it only when different. Detail pane: Disponible, En producción +N, Comprometido −N, each shown only when it means something.
- Keep the **browser console open**: no red errors, no `permission-denied` from listeners, no uncaught promise rejections during any check.
- Run each section at desktop width; sections marked 📱 also at ~390 px.

---

## 1. Order form: sources and the Disponible figure

Stock before you start: Focaccia 10, Cold Brew 24, Sourdough Mediano 6, Pequeño 0.

- [ ] **O1 Resale line.** New order, add Cold Brew ×3. Chip reads **Disponible · 24**, fixed, **no toggle**. Not red.
  - Edge: qty 30 (more than 24) → chip turns red, still saves, no block.
  - Edge: stock 0 → chip "Disponible · 0" red, order still saves.
- [ ] **O2 Recipe line, stock covers.** Add Focaccia ×4 → chip **Disponible · 10** (default). Click it → **Producir**; click again → back.
  - Edge: Focaccia ×11 → default **Producir**; click to Disponible → red "Disponible · 10", saves.
- [ ] **O3 Same product twice in one draft.** Add Focaccia ×6 (Disponible), then Focaccia ×6 again. Second line defaults **Producir** (the first took 6 of 10). Switch the second to Disponible → **both lines red**. Both lines show the **same** figure (10). Change a quantity: the figure never moves, only the red flag reacts.
- [ ] **O4 Variations.** Add Sourdough Pequeño ×1 → reads Pequeño's stock (0, so Producir). Add Mediano ×1 → reads Mediano's (6, Disponible). Each its own row.
- [ ] **O5 Untracked product.** Add the `none` product → **no chip**, no warning. Ship the order later: nothing moves.
- [ ] **O6 Inventory switch off.** In a bakery with the switch off (or after turning it off): the order form looks exactly like before, no chips, lines save as before.
- [ ] **O7 Hard refresh on the form.** Reload the page on New Order, add products: chips fill in once stock arrives (a brief 0 is fine), no stuck "0".

### Repeat and duplicate (lines without a source)
- [ ] **O8 Repeat order.** Pick the client with history. Resale line → Disponible. Recipe line → Disponible only if stock covers it, else Producir.
  - Edge: history has the same recipe product on two lines → they share the stock (second goes Producir if the first took it).
  - Edge: use the **‹ ›** arrows through several past orders: sources are recomputed each time, no leftover from the previous one.
  - Edge: a past order containing a product that is now `none` → no chip.
- [ ] **O9 Duplicar, cold load.** Hard-refresh the Pedidos list, select an order with a recipe line that was Disponible, Duplicar immediately. The copy's recipe line is **Disponible if stock covers it now, Producir if not**; a copy whose stock was used up reads **Producir**.
  - Edge: duplicate an order with a **resale** line → Disponible even if stock is 0 (red).
  - Edge: duplicate, change nothing, save → the saved lines carry a source (check in the emulator UI: `fulfillmentSource` is never missing).
  - Edge: duplicate then wait: sources don't change by themselves once decided.

### Editing an existing order
Setup: Focaccia stock 10. Order A: Focaccia ×5 Disponible, status 0, due today.
- [ ] **O10 Own lines given back (open, inside window).** Edit A: the chip shows **10 free** (not 5). Change qty to 8: figure stays 10. Change to 11: red.
- [ ] **O11 Shipped order.** Ship A (stock 5). Edit A: figure shows **10** again; qty 6 → saves; ledger gets only the delta (−1).
- [ ] **O12 Old open order.** Edit an open order whose **due date is more than 10 days ago**: its own lines are **not** added back (the server no longer holds them), so the figure equals plain Disponible, no inflated number.
  - Edge: the same order moved to a due date inside 10 days → counts again after save.
- [ ] **O13 Old delivered order.** Edit a status-3 order due long ago: its lines **are** given back (they were deducted).
- [ ] **O14 Variations in edit.** Edit an order with a Sourdough Mediano line: figure is Mediano's, not Pequeño's.

### Live refresh
- [ ] **O15 Two tabs.** Tab A: order form open on Focaccia. Tab B: save an order taking 4 Focaccia. Tab A's figure drops within ~1 s, **no reload**.
  - Edge: tab B ships an order → tab A updates (existencia changes).
  - Edge: tab B adjusts stock in Existencias → tab A updates.
  - Edge: save two orders back to back → tab A ends on the **final** figure (matches Existencias), never flickers back to the older one.
  - Edge: leave the form and return → listener restarts, console quiet.

---

## 2. Order lifecycle and the ledger

Use a recipe product (Focaccia: recipe 100 harina each), a resale (Cold Brew), a `none` product. Note starting numbers. After each step, check **Existencias** and the item's history (and `verify` at the end).

- [ ] **S1 Disponible line, full cycle.** Order: Focaccia ×4 Disponible.
  1. Status Recibida: existencia unchanged; Comprometido −4, disponible −4; the kitchen lists **don't** show the line.
  2. Enviada: existencia −4, Comprometido gone. History: "Consumido · pedido xxxxxx".
  3. Back to Producida: existencia back +4; history adds a "Correcciones" line.
  4. Enviada again: −4 (net one deduction; history has sale, compensation, sale).
  5. Entregada (2→3): **no new movement**.
  6. Edit qty to 5 while shipped: only the **−1 delta**.
  7. Delete the order: stock back to start.
- [ ] **S2 Producir line.** Order: Focaccia ×2 Producir. Kitchen shows it **with the customer's name**. Tick it in the kitchen first (flour leaves then, §6b L1), ship: Focaccia −2. Back: Focaccia +2. Unticked: §6b L3.
- [ ] **S3 Switch source on a shipped order.** Shipped, unticked Focaccia ×2 Producir; edit the line to Disponible: the deduction stays Focaccia −2, the `notProduced` gap disappears.
- [ ] **S4 Non-stock edits do nothing.** On a shipped order change payment, driver, notes, delivery fee: **no new movement** (history unchanged).
- [ ] **S5 Resale below zero.** Cold Brew ×30 with stock 24, ship: stock −6, row shows the soft negative wash (not red digits), nothing blocked.
- [ ] **S6 None product.** Ship an order with the `none` product: no movement, no stocks doc.
- [ ] **S7 Missing recipe.** Now shown at the tick, not at shipping: §6b L10.
- [ ] **S8 Deleted product.** Order with a product you then delete (soft) → ship: saves, gap `missingItem`.
- [ ] **S9 Combination without recipe.** At the tick, not at shipping: §6b L10.
- [ ] **S10 Two bodegas.** (needs §10) A Disponible line with a different bodega deducts from that bodega's row.

### Bulk status
- [ ] **S11 Three orders.** Entrega → Mes, select 3 orders, set Enviada: each deducts **once** (history shows one sale each); takes about 1–2 s.
- [ ] **S12 Cap.** Select **21** rows and toggle: toast **"Máximo 20 filas a la vez"**, nothing changes. Select **20**: works (a few seconds), each reconciled once. Same on the driver table.
- [ ] **S13 Calendar toggle** (Recibida/Producida only) is not capped and never moves stock.
- [ ] **S14 Partial failure.** Select orders including one deleted in another tab: the others ship, the failed one is reported, no duplicate rows in the result.

### Switch, pre-tracking and repair (needs emulator UI / shell)
- [ ] **S15 Never-enabled bakery stays silent.** In a second bakery with the switch never turned on: create and ship an order with a resale product. **No** movements, no stocks doc.
- [ ] **S16 Pre-tracking guard.** In that bakery: create an order and ship it (Entregada), **then** turn the switch on (system admin → Negocios) and set up stock. Edit that old order's quantity: **no movement is written** (check ledger). Move it back to Producida and ship again: now it deducts normally.
- [ ] **S17 Off after live keeps the ledger.** In `es-alimento-dev` turn the switch **off**: sidebar loses Inventario, order form loses chips. Ship an order with a resale product: **a sale movement is still written**. Turn it **on**: numbers continue with no gap.
- [ ] **S18 `enabledAt` survives a settings save.** After S17, open the settings document in the emulator UI: `features.inventory.enabledAt` is still there. Save the features form again (Negocios): it is **still there** and the warehouses are intact.
- [ ] **S19 Failed reconcile is found and repaired.** Create an order at Recibida. In the emulator UI edit its document: `status: 2` and `shippedAt` = now (this bypasses the API, so no movement). Run `verify-orders`: the order is listed with a diff per item. Run `reconcile-orders`: it returns it as repaired, the movements exist, and `verify-orders` is `[]`. `verify` stays `[]` throughout.
  - Edge: an order with `shippedAt` **older** than `enabledAt` is **not** listed.
  - Edge: a deleted shipped order whose reversal is missing is listed with the opposite diff.

---

## 3. Existencias (Bodega)

- [ ] **E1 Two-line display.** After S1 step 1: row shows existencia and a brand-coloured `disp. N`; the detail pane shows Disponible, En producción, Comprometido. When disponible equals existencia the extra line disappears. If En producción and Comprometido cancel exactly, all three hide.
- [ ] **E2 Ajustar.** +10 with a reason → number moves, history shows an adjustment. Edge: empty reason refused; quantity **0**, blank or `abc` refused; double-click Guardar → **one** movement.
- [ ] **E3 Baja.** Reason dañado/vencido/perdido/otro; history shows a **baja**, visibly distinct from an adjustment. Edge: positive quantity is refused or sent negative per the form's rule; one idempotency key reused across an adjustment then a baja writes **both** (try two quick submits of different kinds).
- [ ] **E4 Costo (plain ingredient).** Edit the cost: the preview lists affected recipes/products with from→to; saving re-costs recipe-sourced products; manual-cost products untouched. Edge: type the same number → no preview; type a value and keep typing → the preview matches the **last** number.
- [ ] **E5 Costo not offered.** A preparación and a recipe-costed product have **no** cost-edit action. A resale product with manual cost has it; a resale with recipe-sourced cost does not.
- [ ] **E6 Movement summary** by type over a date range: comprado, consumido, producción, ajustes, bajas, conteos; sums match the history rows.
- [ ] **E7 Realtime.** Ship an order in another tab: Existencias updates without reload; leave the screen and return; console quiet.
- [ ] **E8 Silence.** A `none` product never appears. With nothing tracked, the screen shows its empty state, not a crash.
- [ ] **E9 Conteo button.** Shows `n/m` while a count is open; opens that count; with none open goes to the list. With two bodegas it opens the open count of the **bodega shown** (default bodega when "todas").
- [ ] **E10 Search and shelves.** Ingredientes / Preparaciones / Productos; search narrows without hiding totals.

---

## 4. Ingreso (purchases)

- [ ] **P1 Provider first.** Create a provider inline (name only). The doc stays open.
- [ ] **P2 Basket prefill.** Pick the provider with history: lines prefill with last quantities, unit cost shown as "precio anterior". Edge: pick a provider on a doc that **already has lines** → nothing is added. Edge: provider with no history → nothing added, no invented flag.
- [ ] **P3 Price flags.** Type a unit cost above/below the last: "antes $X · subió 9%" / "bajó". No flag without a real previous price; none while the total is only the estimate.
- [ ] **P4 Shelf rule.** Picker offers ingredients **without** recipe and **resale** products only; labels "Insumos" / "Reventa". A preparación and a recipe product are **absent**.
- [ ] **P5 Inline ingredient.** Type an unknown name → create card (unit, cost, category); the new ingredient lands on the shelf. A hint sends preparaciones to the recipe book.
- [ ] **P6 Cost checkboxes.** Lines whose cost changed show a **ticked** box; unticking keeps the old cost. Confirmar shows "· actualiza N costos" and a dialog listing them.
  - Edge: a resale line whose product/combination is **recipe-costed** shows **no** checkbox.
  - Edge: a $0 total line never offers a cost update.
  - Edge: same ingredient on two lines → last line's cost applies; check the ingredient afterwards.
  - Edge: a preparación can't be on this screen.
- [ ] **P7 Confirm.** Rows count up; draft closes; ticked ingredient's `costPerUnit` changes; recipes using it re-cost once (check a recipe-sourced product's cost); unticked lines untouched.
- [ ] **P8 Double click** Confirmar → **one** purchase, one set of movements.
- [ ] **P9 Failure.** (stop the functions emulator, press Confirmar) → inline error, **draft stays**, lines intact; restart and confirm again → exactly one purchase (the key survived).
- [ ] **P10 Validation.** Quantity 0/blank/negative → Confirmar disabled; negative total refused; no provider → disabled.
- [ ] **P11 Draft persistence.** Reload mid-draft → lines, provider and date restored. Switch to another bakery as system admin → that bakery shows **its own** draft (never the other's).
- [ ] **P12 Dates.** A new document is dated **today (local)**. A restored draft keeps its own date (an invoice date can be in the past).
- [ ] **P13 Two bodegas.** (needs §10) A "Entra a" picker appears; the purchase lands in the chosen bodega.
- [ ] 📱 **P14** The doc is usable at 390 px: lines, totals and Confirmar reachable.

---

## 5. Producción

- [ ] **R1 Picker.** Offers `none` and `recipe` products and every preparación; **never** a resale product. Untracked entries carry "se activará el inventario".
- [ ] **R2 Activation.** Adding an untracked product switches it to `recipe` (check ProductForm); a passThrough preparación becomes `stocked`; a stocks row appears in Existencias. Edge: pick the same untracked item twice quickly → **one** line (second bumps the quantity), no double activation error. Edge: activation fails (stop functions) → message "No se pudo activar…", no line added.
- [ ] **R3 Lotes.** A preparación with yield 4 kg: "2 lotes" fills 8. Edge: typing `0`, `1.`, `.5` in the lotes box doesn't wipe or eat characters; blur normalizes. Products have no lotes box.
- [ ] **R4 Preview.** About 0.4 s after you stop typing, "lo que consume" lists components, summed across lines; a shortfall shows as short; gaps ("sin receta — no descuenta nada") are flagged on the line and listed. Edge: change quantity quickly → the panel ends on the **last** quantity. Edge: stop the functions emulator and edit a quantity → the old preview **disappears** (no stale shortfall) and an error message shows.
- [ ] **R5 Enviar.** Success note ("Enviado a producción: N línea(s)"), draft cleared with a **new** key. Existencias: En producción +N, existencia unchanged. Kitchen lists: the lines with "Vitrina". Edge: double-click → one run. Edge: failure → draft stays, error shown; retry → one run.
- [ ] **R6 Repetir la producción del {fecha}.**
  - Appears only if a run exists in the previous 14 days; the date is the **latest day with runs before the document's date**.
  - Press it: adds those lines; **press again → nothing added**; note says how many were added.
  - Edge: a line already in the draft is not duplicated; products sent on two lines that day come in as one summed line.
  - Edge: cancelled lines aren't copied.
  - Edge: an item that is now `unit` or untracked is **skipped** and the note says "N ya no se pueden producir".
  - Edge: a combination output copies as that combination.
  - Edge: change the document date back and forth quickly → the final label matches the final date; no run in range → **no button**.
  - Edge: runs from before the 14-day window are ignored.
- [ ] **R7 Draft date.** A draft restored from yesterday moves to **today (local)**. A new document in the evening is dated today.
- [ ] **R8 Descartar** asks before dropping lines. Reload keeps the draft (localStorage), per bakery.
- [ ] 📱 **R9** Both panes stack and stay usable at 390 px.

### Time-zone trick (the evening bug)
Real evenings are hard to wait for. Instead: DevTools → ⋮ → More tools → Sensors → **Location/Timezone**, pick a zone where the **local date differs from the UTC date right now** (e.g. `Pacific/Auckland` if it's still the same UTC day, or `Pacific/Pago_Pago`). Reload.
- [ ] **T1** A new Ingreso and a new Producción are dated the **local** day, not the UTC day.
- [ ] **T2** A Producción draft dated with the date input to the local today is **not** bumped to "tomorrow".

---

## 6. Kitchen lists

### Individual (`Individual`)
- [ ] **K1 Content.** Order lines show customer in **Cliente** and notes in **Comentarios**; Vitrina lines show "Vitrina" and no comments. **Disponible lines never appear.** Totals per product.
- [ ] **K2 Order row tick.** With inventory on, an order row ticks like a Vitrina row (§6b L1); with it off, straight through (L11).
- [ ] **K3 Vitrina tick.** Tick a pending Vitrina row → dialog **Confirmar producción** listing it and what it consumes → confirm: existencia +planned, components down **exactly** as the dialog said; the row locks (tooltip: "Producido: entró a la bodega y se descontó su receta. Para deshacer, selecciona la fila").
  - Edge: select several rows (mix of order and Vitrina, some already produced) and tick → dialog lists every pending row, sums what they consume, and says "N fila(s) seleccionada(s) no se incluyen" for the produced ones.
  - Edge: cancel in the dialog → nothing moves.
- [ ] **K4 Undo.** Select a produced Vitrina row → **Deshacer producido** → dialog → confirm: stock reverts (exact opposite). Then tick it again → produces again (new receipt). Undo on an **order** row reverts its receipt too (L4).
- [ ] **K5 Edit/remove pending.** One pending Vitrina row → **Editar cantidad** (value must be >0 and different) → saved; planned shown updated; receiving then books the **new** number. **Quitar de producción** on a pending row → disappears; stock and En producción reflect it. Neither action is offered on produced rows.
- [ ] **K6 Failure partway.** Break the connection mid-confirm on several rows: the dialog keeps only the rows still pending and shows the error; retry sends the rest.
- [ ] **K7 Filters.** Category filter lists only collections that are **actually listed** (an order with only Disponible lines doesn't add its category); status filter; period (Individual is day-only).
- [ ] **K8 Realtime.** Send a run from Producción in another tab → appears here; a run dated another day does not.

### Grouped (`Agrupado`)
- [ ] **K9 Read-only status.** The Estado column cannot be clicked (no toggle, no crash, console quiet).
- [ ] **K10 Groups.** Vitrina groups are separate from order groups of the same product; Cliente reads "Vitrina", the client's name, or "N clientes"; filter Clientes / Vitrina; category filter same rule as K7.
- [ ] **K11 Asignar tanda** on a selection with Vitrina groups: order items get the tanda; Vitrina rows are ignored without error.

### Roles
- [ ] **K12** `production_assistant`: can receive, undo, remove and edit Vitrina lines. `bakery_staff`/`bakery_admin`: same.
- [ ] **K13** `delivery_assistant` and `accounting_assistant`: opening the list is fine (if reachable), but receiving/undoing/removing/editing a Vitrina line is **refused** and the dialog shows the error. They can still read.
- [ ] **K14** Create a run as `production_assistant` → refused (staff/admin only). Its preview is allowed (the tick dialog needs it).

---

## 6b. Order-line production (the kitchen tick)

Inventory on. Focaccia (recipe: 100 harina), Cold Brew (`unit`), the `none` product.
Note Focaccia's and harina's existencia first. A tick is a production receipt:
+ the product, − its recipe. Shipping then takes the product.

- [x] **L1 Tick with preview.** Order Focaccia ×4 Producir. Individual: tick → dialog lists the row and **"Descuenta: 400 g harina"** (briefly "Calculando…"). Confirm: Focaccia +4, harina −400, history shows a producción. Comprometido +4, so disponible doesn't move. Hover the row: "Producido: entró a la bodega…".
- [x] **L2 Ship a ticked line.** Enviada: Focaccia −4 (sale), **harina untouched**.
- [x] **L3 Forgotten tick.** Order Focaccia ×2, ship **unticked**: Focaccia −2, harina unchanged, `stockGaps/{orderId}_{lineId}` reason `notProduced`. Tick it now: Focaccia back to 0, harina −200, **gap doc gone**. `verify` and `verify-orders` are `[]`.
- [x] **L4 Undo.** Select a ticked row → Deshacer producido → "La bodega se revierte" → exact opposite (compensation). Tick again: a new receipt, same numbers.
- [x] **L5 Order form cap.** Edit L1's order: tag **Producido 4** (hover explains). `+` disabled at 4; typing 9 snaps to 4. Lower to 3: hover says "las 1 restantes quedan disponibles"; after saving, Focaccia disponible +1. Editor: Origen locked, with the hint.
- [x] **L6 More of the same.** On that order add Focaccia ×2 again: a new line, defaults Producir, no tag; it shows as its own kitchen row and ticks on its own.
- [x] **L7 Remove or delete after the tick.** Remove a produced line, or delete the order: **no movement**, Focaccia stays, disponible rises by that amount.
- [x] **L8 Stale form.** Tab A: order form open. Tab B: tick its line. Tab A: change a note, save. Kitchen still producido, ledger unchanged.
- [x] **L9 Flag-only ticks.** An old order with Cold Brew saved as Producir, and a `none` product line: the dialog says **"No descuenta ingredientes"**; confirm writes nothing.
- [ ] **L10 Missing recipe.** A recipe product with no recipe (or a combination without one): the dialog shows a red **"sin receta — no descuenta nada"** and never uses the product-level recipe for a combination. Confirm: only +N of the product.
- [x] **L11 Inventory off.** In a bakery with the switch off: tick and un-tick go straight through (no dialog, no stock), as before.
- [ ] **L12 Roles.** `production_assistant`: ticks, sees the preview (no 403), undoes. `delivery_assistant`/`accounting_assistant`: the tick is refused and the dialog shows the error.
- [x] **L13 Copies and tanda.** Duplicar or Repetir an order with a ticked line: the copy has **no tag, no cap**. Asignar tanda on a ticked row: it stays producido.

---

## 7. Conteo

Start from an up-to-date stock (a few ingredients, Cold Brew, Focaccia). Have costs set so $50.000 is reachable (e.g. 10 items × $6.000).

### List and join
- [ ] **C1 List.** `Conteos`: "En curso" pins the open count as "Continuar · n/m · names"; below, closed and discarded counts. With **one** bodega, "Empezar conteo" shows only when nothing is open; with an open one, joining is the pinned row.
- [ ] **C2 Open-or-join.** Press Empezar in two tabs at once → both land on the **same** count (one document in `stockCounts`).
- [ ] **C3 Refetch on return.** Start a count in tab B; return to tab A (list) → it appears without reload. Edge: close it elsewhere → the pinned row leaves on return.

### Counting page
- [ ] **C4 Typing saves.** Type a number: ~0.4 s later it's on the server (the other tab shows it). Row then reads "contado por X · sistema decía N · ±d" (**expected appears only after entry**). Edge: type `0` → counted as **0** (not "sin contar"). Edge: clear the box → row back to "sin contar" and the other tab loses it. Edge: decimals `2.5` fine.
- [ ] **C5 Negative.** Type `-3`: row says **"Escribe 0 o más. No se guardó."**, the saved value stays, **Revisar refuses** ("Hay números sin guardar…") until fixed; fix it → Revisar goes through. A negative must **never** clear the row.
- [ ] **C6 Failed save.** DevTools → Network → Offline, type a number: row shows "No se guardó: vuelve a escribirlo." Go online, retype → saves. Pressing Revisar with a failed row retries it first; if it still fails you stay with the message.
- [ ] **C7 Save before Revisar.** Type and press **Revisar immediately** (inside the 0.4 s): button shows "Guardando…", then Revisar opens with that number **included**. Then close fast: the number is in the count.
- [ ] **C8 Leaving another way.** Type then click the sidebar: the number is saved (best effort); reopen to confirm. Edge: type, close the tab → a browser warning may appear; reopen to see what was kept.
- [ ] **C9 Two people.** Two browsers, **different rows**: both appear live, neither overwrites the other. **Same row**: latest wins and the row shows who wrote it. Your own box is **never overwritten while you type** in it.
- [ ] **C10 Search** narrows rows but totals (`n / m`, the bar) count the whole bodega.
- [ ] **C11 Progress and names** in the header update live.
- [ ] 📱 **C12** At 390 px rows, input and "Revisar →" are usable with the keyboard open.

### Revisar and alerts
- [ ] **C13 Contents.** Only counted rows; flagged first, then by money moved; rows with no difference fold away ("Mostrar N sin diferencia"); totals: Contados, Sin contar (no cambian), Con diferencia, Faltante, Sobrante.
- [ ] **C14 Alert threshold.** A row with |diferencia × costo| **just under** $50.000 → no alert; **exactly/over** → "alerta" tag and the button reads "Cerrar conteo con N alerta(s)". Edge: an item with cost **0 or unresolved** shows "sin costo" and is never flagged. Alerts never block closing.
- [ ] **C15 Stale warning.** In the emulator UI set the count's `createdAt` to 13+ hours ago: Revisar warns "Abierto hace N h…". At 11 h: no warning.
- [ ] **C16 Nothing counted:** the close button is **disabled**.
- [ ] **C17 Live while open.** Numbers typed by someone else arrive on Revisar without reload.

### Close
- [ ] **C18 Dialog.** Cerrar → **dialog** ("La existencia de N artículos pasa a ser lo que se contó. Los demás no cambian."), Volver cancels, nothing changes.
- [ ] **C19 Result.** Confirm → page turns into the frozen view: "Cerrado el {fecha} por {nombre}", "Desde el último conteo: bajas reportadas … + encontrado por el conteo … (sin explicar)". Existencias shows the counted numbers; **uncounted items unchanged**; zero-difference items verified (history may show no count movement); each differing item has one **conteos** movement. `verify` is `[]`.
- [ ] **C20 Reopen.** From the list, the closed count opens **frozen** and identical. Counting page for it redirects to Revisar.
- [ ] **C21 Close twice.** Two tabs on Revisar, close in both: the second is refused, no extra movements.
- [ ] **C22 Typing after close.** In a stale Counting tab, type a number after the count closed: refused, no change.
- [ ] **C23 Bajas framing.** Register a baja on an item, then count it: "bajas reportadas" shows that value and the count's difference is the rest.

### The `closing` state (simulate in the emulator UI)
- [ ] **C24 Half-finished close.** On an **open** count with several rows, edit its document: `status: 'closing'`, `closedAt` = now, `closedBy: {userId, name}`. Then:
  - the list shows it under "Anteriores" as **"Cerrando · N contados"**;
  - Revisar shows the **"Cerrando el conteo…" banner** and **"Terminar de cerrar"**; the title reads "Cerrando el … por …";
  - the Counting page redirects to Revisar; typing is impossible; **Descartar** is refused;
  - "Terminar de cerrar" → dialog "Se retoma el cierre donde quedó." → confirm → the count becomes **closed** with every row frozen, movements for the differing rows, `verify` clean.
  - Edge: freeze one row by hand first (add `diffQty`, `expectedQty`, `unitCost`, `wasteSinceBaseline`) → that row is **not** counted twice (no duplicate movement).
- [ ] **C25 Big count.** (needs a script or many seeded stocks) A count of ~450 differing items closes successfully (chunks of 200), `verify` clean, each item one movement.

### Discard
- [ ] **C26 Discard.** On the Counting page: dialog names who is counting; confirm → back to the list, the count is "Descartado · por X · N escritos", opens read-only showing the typed rows, **no movements**, stock unchanged. A new Empezar starts a **fresh** count.
- [ ] **C27 Discard a non-open count** (closed/discarded) is refused.

### Access
- [ ] **C28** `bakery_admin`, `bakery_staff`: full access. `production_assistant`, `delivery_assistant`, `accounting_assistant`: no Conteo link, direct URL refused.

---

## 8. Recipes, costs and ingredients

- [ ] **RC1 Link keeps a typed cost.** Product with a **hand-typed cost** (e.g. 3.500, manual): create its recipe → recipe is linked, **cost stays 3.500 and stays manual** (lock shown). Unlock → follows the recipe (e.g. 4.200).
- [ ] **RC2 Link takes the recipe when cost is empty.** Product with cost 0: creating the recipe sets `costPriceSource: recipe` and the computed cost.
  - Edge: a combination with cost 0 takes it; its sibling with a typed cost stays manual.
- [ ] **RC3 Cost propagation.** Change a plain ingredient's cost (Existencias): recipes recompute; recipe-sourced products follow; manual don't. Chain: ingredient → preparación recipe → preparación cost per unit → product recipe → product cost.
- [ ] **RC4 Preparación.** "Crear preparación" with yield; opens its tab; edit the yield and save → cost per unit rescales; the preparación's cost can't be edited anywhere else.
- [ ] **RC5 Deletion guards.** From the Ingredientes list: delete an ingredient used in recipes → refused, message names the recipes; delete a preparación (has recipe) → refused; delete a product used as a component → refused; delete an unused ingredient → works.
- [ ] **RC6 Stale form can't revert server data.** Open a product's edit form (tab A). In tab B create a recipe for it (or change an ingredient cost so its recipe-sourced cost moves). Save tab A without touching those fields → recipe link and recipe-sourced cost are **not** reverted (check the product afterwards).
  - Edge: the same with a stale Ingredient save (cost of a preparación).
  - Edge: a product bulk update via import doesn't touch recipe links.
- [ ] **RC7 Product mode selector.** Product form (inventory on): three options, default "Sin control"; switching to Reventa/Receta creates the stocks row; switching back keeps history. With the switch off, **no** selector.
- [ ] **RC8 Ingredient screens.** `ingredients` list is read-only apart from delete; there is no create route (`/ingredients/create` → not found/redirect, no "En construcción" page).
- [ ] **RC9 Ingredient unit** has no UI to change; if you can reach it by API, changing a unit on an ingredient that is in a recipe / has its own recipe / has stock is **refused**.

---

## 9. Roles matrix (quick pass)

| Action | admin | staff | production | delivery | accounting |
|---|---|---|---|---|---|
| See Existencias / read stock | ✔ | ✔ | ✔ | ✔ | ✔ |
| Adjust / baja / transfer | ✔ | ✔ | ✖ | ✖ | ✖ |
| Ingreso confirm | ✔ | ✔ | ✖ | ✖ | ✖ |
| Send a run | ✔ | ✔ | ✖ | ✖ | ✖ |
| Receive / undo / remove / edit run line | ✔ | ✔ | ✔ | ✖ | ✖ |
| Tick / un-tick an order line, preview what it consumes | ✔ | ✔ | ✔ | ✖ | ✖ |
| Conteo | ✔ | ✔ | ✖ | ✖ | ✖ |
| Ship orders (Entrega/driver table) | ✔ | ✔ | ✔ | ✔ | ✔ |
| `verify`, `verify-orders`, `reconcile-orders` | ✔ | ✖ | ✖ | ✖ | ✖ |

- [ ] Walk the table with each account; a ✖ shows a clear error, never a silent failure or a broken screen.
- [ ] **Firestore rules.** Orders can't be written from the browser: in the console, try a direct SDK write to `bakeries/es-alimento-dev/orders/x` → `permission-denied`. Creating an order through the app still works. Reads still work (kitchen lists live, order form live).

---

## 10. Module switch, silence and bodegas

- [ ] **G1 Switch off.** A bakery with it off: no Inventario in the sidebar, `/dashboard/inventory` and `/recipe-book` inaccessible, no mode selector, no chips, kitchen lists and order list behave as before.
- [ ] **G2 `none` is silent** across order form, kitchen, Existencias, ProductForm (no inventory UI for that product).
- [ ] **G3 Turning on** (system admin → Negocios → inventory): sidebar appears, selector appears; do a first count **before** shipping real orders.
- [ ] **G4 Second bodega.** Add `{ id: 'branch', name: 'Sucursal' }` to `features.inventory.warehouses` in the settings document (emulator UI). Then:
  - Existencias: filter chips, per-bodega expander on items, **Transferir**, destination pickers appear;
  - Ingreso and Producción: "Entra a" picker;
  - Conteos: a bodega selector, **one open count per bodega** (two bodegas can each have one), counts list the bodega;
  - Transferir: −qty at origin, +qty at destination, both in history, same transfer id; transferring more than origin holds is allowed (negative) and unknown bodega refused;
  - Remove the second bodega → all of the above vanish completely.
- [ ] **G5 Orders ignore the second bodega** (no picker on order lines yet): they deduct from the default bodega.

---

## 11. Data integrity sweep (after a long session)

- [ ] `GET /stocks/verify` → `[]`.
- [ ] `GET /stocks/verify-orders` → `[]`.
- [ ] For three random items: Σ of its movements since its `baselineAt` equals `currentStock`.
- [ ] No `stockMovements` document was edited (compare `timestamp`s; compensation always appears as a **new** doc).
- [ ] `stockGaps` contains only the gaps you created on purpose, and none for orders that were later fixed.
- [ ] Double-submit probes: double-click on Ajustar, Baja, Transferir, Confirmar (Ingreso), Enviar (Producción) each wrote **one** movement set.
- [ ] Console: no `permission-denied`, no unhandled rejections, listeners stop when leaving screens (no duplicate refreshes after navigating around).
- [ ] Loading a screen twice quickly (navigate away and back) never leaves a spinner stuck or a list showing an older fetch.

---

## 12. Not covered here
- Offline mode for orders; POS flows (no POS screen yet); printing/export; the client guide document; production deploy (index/rules/functions/hosting order is in `INVENTORY.md` §7).
