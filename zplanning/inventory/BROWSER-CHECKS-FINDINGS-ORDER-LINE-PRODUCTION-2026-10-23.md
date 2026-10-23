# Order-line production browser checks: findings, 2026-10-23

Running log while going through `BROWSER-CHECKS.md` §6b (L1–L13). Expected behavior comes from `INVENTORY.md` §4.3, "The kitchen tick". Bakery `es-alimento-dev`, inventory switch on.

## Fix order (read this first)

Every item below is described in full further down. Do them in this order, one batch per sitting. Decide the **Questions** before fixing anything in those areas.

- **Batch A, wrong data:**
- **Batch B, messages and feedback:**
- **Batch C, display and navigation:**
- **Questions, settled:**
- **Not built:**

## Baseline

Existencia before L1, recomputed after each step. Harina in grams.

The seeded Focaccia recipe (`recipes/yOC6O1WkU33obmB8Z9hZ`) is, per unit, **800 g Masa Base** (a preparación), 60 ml Aceite de Oliva and 10 g Sal. It has no harina, so the checklist's "100 g harina" doesn't apply; the extra columns track what the tick should actually move. Each row gives expected / seen.

| Step | Focaccia | Harina (g) | Masa Base (g) | Aceite (ml) | Sal (g) | Note |
|------|----------|------------|---------------|-------------|---------|------|
| Start | 0 | 50,000 | 0 | 5,000 | 2,000 | Existencias screen and `stocks` agree. Ledger: 6 `purchase` movements only. |
| L1 tick (order `ABXbVoFxqIOkfWPtstgu`, Focaccia ×4) | 4 / 4 | 50,000 / 50,000 | −3,200 / −3,200 | 4,760 / 4,760 | 1,960 / 1,960 | Focaccia disp. 0, Comprometido −4. Masa Base goes negative: it was never produced. |
| L2 ship (Entrega, status → 2) | 0 / 0 | 50,000 / 50,000 | −3,200 / −3,200 | 4,760 / 4,760 | 1,960 / 1,960 | One `sale` −4 with `refs.orderId`. |
| L3 ship unticked (order `oWAFkwE5JXqIGNKcMo0T`, ×2) | −2 / −2 | 50,000 / 50,000 | −3,200 / −3,200 | 4,760 / 4,760 | 1,960 / 1,960 | `sale` −2; gap `notProduced`. |
| L3 late tick | 0 / 0 | 50,000 / 50,000 | −4,800 / −4,800 | 4,640 / 4,640 | 1,940 / 1,940 | Receipt 1 for that line; gap gone. |
| L4 order C (`RaUBzKaOG3Ka6eRYdiDG`, ×4, open) tick → undo | 0 / 0 | 50,000 / 50,000 | −4,800 / −4,800 | 4,640 / 4,640 | 1,940 / 1,940 | Receipt 1 then its exact compensation. |
| L4 re-tick | 4 / 4 | 50,000 / 50,000 | −8,000 / −8,000 | 4,400 / 4,400 | 1,900 / 1,900 | Receipt 2. |
| L5 order C lowered 4 → 3 | 4 / 4 | 50,000 / 50,000 | −8,000 / −8,000 | 4,400 / 4,400 | 1,900 / 1,900 | No movement. `GET /stocks`: committed 3, available 1. |
| L6 new line ×2 on order C, ticked | 6 / 6 | 50,000 / 50,000 | −9,600 / −9,600 | 4,280 / 4,280 | 1,880 / 1,880 | Line `MagKQNS6okeKz6X4`, receipt 1. Committed 5, available 1. |
| L7 remove that produced ×2 line | 6 / 6 | 50,000 / 50,000 | −9,600 / −9,600 | 4,280 / 4,280 | 1,880 / 1,880 | No movement. Committed 3, available 3. |
| L8 new ×1 line on order C, ticked from tab B | 7 / 7 | 50,000 / 50,000 | −10,400 / −10,400 | 4,220 / 4,220 | 1,870 / 1,870 | Line `BjhbYfOZ5XmLvh77`, receipt 1. Stale save in tab A wrote nothing. |
| L13 duplicate / repeat (cancelled), tanda | 7 / 7 | 50,000 / 50,000 | −10,400 / −10,400 | 4,220 / 4,220 | 1,870 / 1,870 | Nothing moved. |
| L7 delete order C | 7 / 7 | 50,000 / 50,000 | −10,400 / −10,400 | 4,220 / 4,220 | 1,870 / 1,870 | No movement. Committed 0, available 7. |
| L9 / L10 (order `0wKK…`) | 7 / 7 | 50,000 / 50,000 | −10,400 / −10,400 | 4,220 / 4,220 | 1,870 / 1,870 | Only Baguette Otra +1 (receipt 1). Cold brew stays 24. |

## Results

| Check | Result | Evidence |
|-------|--------|----------|
| L1 Tick with preview | Pass | Dialog "Confirmar producción · 4 Focaccia · Descuenta: 3,200 g Masa Base · 240 ml Aceite de Oliva · 40 g Sal" (the recipe ×4; "Calculando…" too fast to catch). Four `production` movements `orderline_ABX…_oDNN…_1_*`, refs `{producedForOrderId, orderItemId, receipt: 1}`, no `orderId`. Line `producedQty 4, receiptNo 1`. Existencias: 4 uds, Disponible 0, Comprometido −4, history "Producción +4". Hover tooltip as written. Console clean. |
| L2 Ship a ticked line | Pass | Status 0 → 1 → 2 on Entrega. Exactly one new movement: `sale` focaccia −4, `refs.orderId`. Masa Base, aceite, sal untouched. No `stockGaps` doc. Console clean. |
| L3 Forgotten tick | Pass | Shipped unticked: `sale` −2 only, `stockGaps/oWAFkwE5JXqIGNKcMo0T_wvf7EPJtMyFEDZXm` with reason `notProduced`. The shipped order's row still shows in Individual and ticks; dialog "1,600 g Masa Base · 120 ml Aceite · 20 g Sal". After the tick: four `production` movements (receipt 1, no `orderId`), Focaccia 0, gap doc deleted, no extra `sale`/`compensation`. `verify` → `200 []`, `verify-orders?days=14` → `200 []`. |
| L4 Undo | Pass | Selected row → bar shows "Deshacer producido" → dialog "Deshacer producción · 4 Focaccia · Vuelve a pendiente. La bodega se revierte." Confirm: four `compensation` movements `undo_orderline_…_1_*`, each the exact opposite, same refs; row back to "-"; line `producedQty 0`, `receiptNo` stays 1. Re-tick: four new `production` movements with receipt 2 (`orderline_…_2_*`), same numbers. Console clean. |
| L5 Order form cap | Pass | Run on order C (open, ticked), per the brief. Editar shows tag "Producido 4"; hover: "La cocina ya lo produjo: 4 uds entraron a la bodega y se descontó su receta. Puedes bajar la cantidad o quitar la línea; para más, agrega otra línea." `+` is `disabled` at 4; typing 9 snaps back to 4. At 3 the hover adds "Este pedido lleva 3; las 1 restantes quedan disponibles." Editor: Origen buttons greyed, hint "…El origen ya no cambia." Saved: line `quantity 3`, `producedQty 4` kept, no movement; `GET /stocks` focaccia `currentStock 4, committed 3, available 1` (was available 0). Console clean. |
| L6 More of the same | Pass | Editing order C, catalog Focaccia → 2 adds a second line (not merged into the first), "Producir", no tag. Saved; Individual shows it as its own row "2 Focaccia" with "-". Tick: dialog for 2 only (1,600 g Masa Base · 120 ml · 20 g), four movements for item `MagKQNS6okeKz6X4` receipt 1; the first line untouched (`producedQty 4, receiptNo 2`). |
| L7 Remove or delete after the tick | Pass | **Remove:** order C, expanded the produced ×2 line ("Producido 2"), "Quitar del pedido", saved. No movement; focaccia stays 6; `GET /stocks` committed 5 → 3, available 1 → 3. The removal has no confirm or mention that the line was produced (fine per §4.3, the surplus just stays). **Delete:** order C (lines 3 "Producido 4" + 1 "Producido 1", after L8 and L13), Eliminar → custom dialog → confirm. `isDeleted: true`, no movement (36 before and after), focaccia stays 7, committed 4 → 0, available 3 → 7. `verify` and `verify-orders` both `200 []`. But see Bugs: an open kitchen list keeps showing the deleted order's rows. |
| L8 Stale form | Pass | Added a ×1 Producir line to order C and saved. Tab A: Editar open on order C. Tab B: ticked "1 Focaccia" (800 g Masa Base · 60 ml · 10 g), receipt 1. Tab A (still showing the line as plain "Producir", no tag): added production note "L8 nota", "Actualizar pedido". Result: note saved, line still `producedQty 1, receiptNo 1, status 1`, ledger unchanged (36 movements before and after), tab B kitchen still "Producido" and shows the note. Console clean. |
| L9 Flag-only ticks | Pass | Order `0wKKTwK21t2nLOrPv8iv`. Cold Brew line set to `produce` in the emulator (the form defaults resale to stock). Cold Brew tick: "Confirmar producción · 1 Cold Brew · No descuenta ingredientes." Tortillas (`none`): "1 Original · No descuenta ingredientes." Confirm on both: rows "Producido", lines `status 1`, `producedQty 0`, `receiptNo 0`, zero movements (36 before and after), cold brew stays 24. |
| L10 Missing recipe | Pass (combination case only) | Baguette Otra (combination with no recipe): dialog "1 Original · No descuenta ingredientes." plus red "Original Otra: sin receta — no descuenta nada". Confirm: exactly one movement, `production` `product_MIbp…_baguette-otra` +1, receipt 1, no `orderId`; line `producedQty 1`. The "never the product-level recipe" half can't be checked: Baguette has none. A recipe product with no recipe at all wasn't tried. |
| L11 Inventory off | Pass | Bakery `ththht-1792796240689` (new, switch off), as its admin `a@a.com`. Created category "panes" and product "Pan L11" (no inventory fields shown), order `a3JNJErIo2thrpJwpoFq` Pan L11 ×2 (no source label in the form). Individual: click → "Producido" at once, no dialog; click again → back to pending, no dialog. Line `status` 1 → 0, `producedQty` 0 throughout; `stockMovements` and `stocks` stay empty. Console clean. |
| L12 Roles | **Fail** (production_assistant gets no preview and no confirm); delivery/accounting pass on the server | **PA:** see Failures. Server side fine: preview 200, tick and undo write the right receipts. **delivery_assistant** (`da@`, lands on `/driver/orders`) and **accounting_assistant** (`aa@`, lands on `/accounting/salesReport`): the router sends both `/production/single` and `/dashboard/orders/production/single` back home, so neither can open the list. Called directly with their tokens: `POST …/items/:id/produce` 403, `…/unproduce` 403, `/orders/produce-preview` 403; no movement, line unchanged. "The dialog shows the error" can't happen because they never reach the dialog (see Checklist changes). |
| L13 Copies and tanda | Pass | Duplicar on order C (lines 3 "Producido 4" + 1 "Producido 1"): "Duplicar Pedido" shows no "Producido" anywhere, both `+` enabled, sources re-defaulted (first "Del stock · 3 disponibles", second "Producir"); cancelled. Repetir (chip "23 de oct · 4 prod · $79,000", order A): one line ×4, "Producir", no tag, `+` enabled; cancelled. Asignar tanda 2 on the ticked "3 Focaccia" row: T column → 2, Estado still "Producido", line `producedQty 4, receiptNo 2` unchanged, no movement. Console clean. |

## Failures

One entry per failing check: steps, expected, actual, screenshot or console error.

### L12 production_assistant: the kitchen list thinks inventory is off

**Setup.** The role accounts were created in bakery `ththht`. With the user's OK: their `bakeryId` claim moved to `es-alimento-dev` (Auth emulator), and their docs were copied to `bakeries/es-alimento-dev/users/{uid}` (originals left in `ththht`).

**Steps.** Log in as `pa@pa.com` → lands on `/production/single` (ProductionDashboard). Select the produced "1 Original Otra" row (order `0wKK…`) → Deshacer producido → confirm. Click its Estado cell.

**Expected (§4.3, L12).** The undo dialog says "…La bodega se revierte." The tick opens "Confirmar producción" with the preview.

**Actual.** The undo dialog says only "Vuelve a pendiente." The tick goes straight through: no dialog, no preview, "Producido" right away. The server still did the right thing: `compensation` −1, then `production` +1 receipt 2. So the stock is right, but the person ticking never sees what it consumes.

**Cause (traced, not fixed).** `ShowProductionSingleItems.vue:71` asks first only when `settingsStore.isInventoryEnabled`. That reads `items[0]` of `bakerySettingsStore`, which nothing on this route loads. `AdminSidebar.vue:58` does `settingsStore.fetchById('default')`, while `ProductionSidebar.vue` doesn't, so under `/production/*` the store is empty (`items.length 0`, flag false). PA can read the settings (`GET /settings/default` → 200). Probably the same for any role whose layout doesn't fetch settings (driver?), and for an admin who lands on a page whose sidebar doesn't load them; not checked.

**Rest of PA's flow is fine.** After `fetchById('default')` from the console (what the fix would do): undo dialog "Vuelve a pendiente. La bodega se revierte."; tick dialog "Confirmar producción · 1 Original · No descuenta ingredientes. · Original Otra: sin receta — no descuenta nada"; confirm writes `production` +1 receipt 3; undo writes its exact compensation. `POST /orders/produce-preview` as PA → 200 with the Focaccia components (no 403). Console clean.

## Checklist changes

- **§6b header, L1, L3: the recipe numbers don't match the seed.** The checklist assumes "Focaccia (recipe: 100 harina)"; the seed has 800 g Masa Base + 60 ml aceite + 10 g sal per unit. Either reword the checks to "what the recipe says" or seed Focaccia as written.
- **§0 "Calling admin endpoints": the URL and the token source are off.** The function is `bake`, not `api`: `http://localhost:5001/bake-ry/us-central1/bake/bakeries/es-alimento-dev` (`src/stores/authentication.js`). The `accessToken` in IndexedDB can be expired (it gave `401 Invalid token`); `await auth.currentUser.getIdToken()` from the page (`import('/src/config/firebase.js')` in the console) always works.
- **L12 / K13: delivery and accounting can't reach the kitchen list.** The router bounces both roles from both kitchen URLs, so "the tick is refused and the dialog shows the error" is untestable in the UI. Reword to: "can't open the list; produce/unproduce/preview called directly → 403." Also, PA lives under `/production/*`, not `/dashboard/*`: say so, since that layout is where the failure is.
- **§0 Accounts: staff passwords are generated.** They're the first name in lowercase padded with `1` to 6 characters, whatever is typed at creation. Worth one line in §0 so the next run doesn't stall on it.
- **L5: run it on a second ticked order that is not shipped.** L2 ships L1's order, and lowering the quantity on a shipped order is a different case.

## Product decisions

- **Staff passwords:** no change. Name-based initial password stays, not shown to the admin.
- **Negative ingredient on a tick:** no warning. The kitchen already made it; Conteo settles it.

## Fixes applied (uncommitted)

- **L12 baker gets no confirm.** Settings load once in the router guard for every logged-in route (above the system-admin early return); the fetches in `AdminSidebar.vue` and `AccountingSidebar.vue` are gone. Re-checked as `pa@`: store loaded, dialog and preview shown, receipt 4 written, console clean.
- **Deleted order stays in the kitchen list.** `orderStore.js` live listener drops an order whose `modified` change has `isDeleted`. The server already refused produce/unproduce/preview on a deleted order (`readOrderDoc` → "Pedido no encontrado"), so it was display only. Re-checked live in `ththht`: the other tab's row vanished on delete, no reload.
- **Wording.** Tooltip singular ("la restante queda disponible") in `OrderLineItem.vue`; tick/undo dialog rows named like the Producto column (combination included); "No descuenta ingredientes." hidden when a red gap line is shown. Dialog re-checked: "1 Original Otra" with only the red line. Tooltip singular not re-checked in the browser.

## Bugs and rough edges

Anything wrong outside the checks.

- **Staff passwords aren't the ones the admin thinks.** `bakeryUserService.js:23` `generateInitialPassword` ignores any password and uses the first name in lowercase, padded with `1` to 6 characters. The staff form has no password field (`password: ''` in `BakeryUserForm.vue` defaults is never used) and nothing tells the admin the generated one. The user expected `pa1234` etc.; the real ones are the first name plus `1111`.
- **A staff login whose doc isn't in its claim's bakery fails as "User not found"** (backend login), after Firebase accepted the password. Fine as a guard; the message could say more.
- **The second failed login in a row clears the form with no error shown.** First attempt shows "Invalid email or password."; the next one empties the fields silently.
- **The tick dialog names the product without its collection.** Tortillas "original" and Baguette "original" both show as "1 Original" in the dialog title, while the row says "1 Original Otra" and the red line says "Original Otra". With several rows selected you can't tell them apart.
- **Missing-recipe dialog says two things.** "No descuenta ingredientes." and, below it in red, "Original Otra: sin receta — no descuenta nada". The grey line is redundant there; the red one alone says it.
- **Kitchen Individual keeps a deleted order's rows until reload.** Tab B on Individual (23 oct), tab A deletes order C from Pedidos. After 5+ s tab B still lists "3 Focaccia" and "1 Focaccia" (Producido, "l8 nota"), selectable, with "Deshacer producido" and "Asignar Tanda" offered. A reload drops them. The same list did pick up tab A's note edit live (L8), so it hears updates but doesn't drop a soft-deleted order. I didn't try undoing a deleted order's line, to keep the ledger clean; whether the server refuses that is worth knowing (see Questions).

- **Singular in the "Producido N" tooltip and hint.** With one unit left over it reads "las 1 restantes quedan disponibles". Should be "la 1 restante queda disponible" (or "1 queda disponible"). Order form, line tag tooltip and the expanded line's hint.
- **No warning when a tick drives an ingredient negative.** Masa Base was at 0 and every Focaccia tick took it further down (−3,200, −4,800, −8,000); the dialog says "Descuenta: 3,200 g Masa Base…" with nothing about there being none. Maybe intended (the kitchen made it anyway); see Questions.

## Questions

- **Should a tick warn when an ingredient goes negative?** The seed's Masa Base was never produced, so every Focaccia tick drove it further below zero (−10,400 g by the end) with no hint in the dialog.
- **Does the server refuse produce/unproduce on a deleted order?** The kitchen list still offers both on a deleted order's rows until reload (see Bugs). Not tested.

## Tech debt: checks not run

- **L10, two halves.** (a) "Never uses the product-level recipe for a combination": the seed has no product-level Baguette recipe, so there's nothing to fall back to. Needs a product with both a product-level recipe and a combination without one. (b) A recipe product with no recipe at all: none in the seed, not created.
- **`verify` / `verify-orders` after L9–L12.** Admin-only, and the session ended logged in as `accounting_assistant`. Instead, `stocks` vs ledger checked by hand: 14 items, 42 movements, 0 mismatches. The last shipped-order change was before L7's run (which returned `[]`), so `verify-orders` shouldn't have moved.

## Emulator state left behind

- Order `0wKKTwK21t2nLOrPv8iv`: Baguette Otra line pending (`receiptNo 3`, undone), Cold Brew and Tortillas flag-ticked.
- Order `RaUBzKaOG3Ka6eRYdiDG` (order C): soft-deleted.
- `pa@`, `da@`, `aa@`: claims `bakeryId: es-alimento-dev`; docs copied to `bakeries/es-alimento-dev/users`, originals still in `ththht`.
- Bakery `ththht`: category "panes", product "Pan L11", order `a3JNJErIo2thrpJwpoFq` (pending).
- Browser: logged in as `aa@aa.com`.
