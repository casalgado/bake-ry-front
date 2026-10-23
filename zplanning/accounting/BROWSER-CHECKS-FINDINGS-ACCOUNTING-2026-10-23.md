# Accounting browser checks: findings, 2026-10-23

Running log while going through `BROWSER-CHECKS.md`. Batches A, B and C are applied in code and the backend tests for them pass. No frontend change has been checked in the browser yet; do that pass before release. What is still open is under "Not built" below and in "Tech debt".

## Fix order (read this first)

Every item below is described in full further down, under "Checklist changes", "Bugs and rough edges", "Questions" and "Tech debt". Do them in this order, one batch per session or sitting. Decide the **Questions** before batch C touches those areas.

- **Batch A, wrong data (applied):**
  1. Inbox insumo line: Cantidad pre-filled in the supplier's unit.
  2. Excel export and P&G: fractional pesos (round once, in the P&G data).
  3. Compra de insumos: stock shown in the item search with inventory off (`PurchaseDoc.vue:156`).
  4. Inbox credit notes: block them up front, and don't count them in the Resumen banner.
- **Batch B, messages and feedback (applied):** raw `ivaAmount:` error; no toast on inbox Guardar / Confirmar / Omitir and on "Compra registrada"; confirmation for Omitir factura; delete shows no feedback; documento soporte dialog warns about missing provider data only after Emitir; provider form keeps an inactive default category selected.
- **Batch C, display and navigation (applied, except what "Not built" lists):** blank page on `/accounting/compra-de-insumos` and silent redirects; Resumen shows $0 while loading; P&G clipped tag, truncated "Compras de insumo…", "De" capital in month names, no Otros ingresos by category; inbox sort order and unreadable entries without detail; destination select without groups; inactive toggle labelled "Activa"; annulled documento soporte badge; second-tab "cerrar mes" stale screen; `checkAuth` timer warning.
- **Questions, settled:**
  - Monto is gross (IVA included); the expense form now says so.
  - `bakery_staff` and `accounting_assistant` may close and reopen months, as today.
  - "No se sabe" providers keep the document icon; the dialog now warns about missing provider data on open.
  - The six unreadable emails stay for now. New ones store sender and subject, so the inbox shows what they are; decide on filtering noise after seeing them.
  - "Ingreso" in the orders header is left alone: it is the sale plus delivery of every listed order, paid or not.
- **Not built:**
  - The P&G "gastos recurrentes sin confirmar" tag still doesn't say which month.
  - No "No tienes acceso" message on forbidden-URL redirects (there is no global toast).
  - Descartar in Compra de insumos keeps its native `confirm()`.
  - An annulled documento soporte is not re-issued; the purchase gets a new gasto. The gasto row shows "Anulado".
  - Months closed before the rounding change that had fractional cost of sales show "Editado tras cierre" once; reopen and re-close to clear it.
  - The system admin seed password is still in `seedSystemAdmin.js` (emulator only; rotate the real account's password if it is the same).

## Done

- Section 1: rename saves (toast "Cambios guardados"); empty name refused; PUC with letters refused ("1 a 10 dígitos"). Deactivate/reactivate checked by hand.

## Checklist changes

- **1.4 (switch gasto/inversión): drop it.** The edit row only has code and name, so there is nothing to switch. Moving a category between groups is done by creating a new one in the right group and deactivating the old one.
- **2.9 (empty revenue picker): the seed already has "Eventos", "Alquileres" and "Otros ingresos" active.** To see the "activate them in settings" message, deactivate all three first, or seed the business with none active.

## Product decisions

- **Category deletion: not needed for now.** Records keep their category, and P&G groups by it; deactivating hides it from the pickers without breaking history. Revisit only if mistaken categories pile up. If so, allow delete only when no record references it.

## Bugs and rough edges

- **Deleting a record has no feedback.** After confirming, the modal closes but the row stays for 1-2 s before it disappears. Saving shows "Guardando…"; delete should do the same, or remove the row optimistically.
- **Console warning on load:** `Timer 'checkAuth' does not exist` (`src/stores/authentication.js:373`). A `console.timeEnd` runs without a matching `console.time` on that path.

- **Resumen shows $0 totals and an empty list for ~2 s on load**, with no skeleton or spinner. It reads as "nothing this month", and a pending recurring gasto appears only afterwards. Hide the totals until the month has loaded.

- **P&G has no breakdown for Otros ingresos.** Expenses list one row per category with its PUC code, but Otros ingresos is a single line. Check 2.9 expects it "by category". Add one row per revenue category, or drop the expectation.
- **P&G unconfirmed-recurring tag doesn't say which month.** It sits above the table ("1 gasto recurrente sin confirmar"), not on the month column, so with a 6-month range you can't tell where the pending one is.
- **P&G labels:** "Compras de insumo…" is truncated in the first column. Month headers read "Oct De 26" and Resumen "Octubre De 2026": the "De" should be lowercase.

- **Compra de insumos, inventory off: the item search still shows stock** ("Sal Prueba 2,000 g" beside each result). `PurchaseDoc.vue:156` builds `meta` from `stockHere(e.key)` unguarded; the line rows (`:683`) and the Existencias pane (`:844`) check `inventoryOn`. Check 6.1 asks for no stock text.
- **Compra de insumos shows a raw backend field name in an error.** An IVA larger than the total reads `ivaAmount: debe ser un entero de pesos, entre 0 y el total`. The `ivaAmount:` prefix is the API field; the user needs only the sentence. Same pattern likely for retefuente, reteICA and reteIVA.
- **"Compra registrada: 1 línea(s)." is a one-line note under a greyed button.** Easy to miss after confirming; a toast would match the rest of the app ("Cambios guardados").
- **Providers: a default category that was later deactivated is shown selected, as if valid.** Opening the provider and saving fails with "La categoría del destino predeterminado no existe o está inactiva", so any unrelated edit is blocked until the category is changed. Flag or clear it when the form opens.
- **Settings, category toggle: the inactive state is also labelled "Activa"**, only the colour changes (orange vs white). Label it "Inactiva".
- **Compra de insumos, Descartar uses a native `confirm()`** (`PurchaseDoc.vue:534`), unlike every other delete, which uses the in-app modal. It also freezes browser automation until someone answers it. Marked as deliberate in the code, so only change it if you want consistency.

- **Inbox, insumo line: Cantidad is pre-filled with the invoice's quantity, but the field is in the ingredient's unit.** "Harina de trigo x 50 kg, 2 bulto" opens with Cantidad 2 next to a hint saying "en la unidad del ingrediente" (grams). Confirming as-is books 2 g, not 100,000 g, and moves the cost to the wrong price per gram. Leave it empty, so Confirmar stays disabled until the person types it.
- **Inbox, credit notes can be worked as if they could be confirmed.** The dialog is titled "Factura NC-5" and asks for a destination per line; the only refusal ("Las notas crédito todavía no se pueden confirmar") comes after clicking Confirmar. Show the note and disable Confirmar up front. The Resumen banner also counts them as "por registrar".
- **Inbox list is not in date order** (21 oct, 18 oct, 24 sept, 13 oct, 16 oct, …): it follows insertion order. Sort by issue date, newest first.
- **Inbox, unreadable entries say nothing about the email.** Six identical lines "El adjunto no contiene una factura electrónica", with no sender, subject or date, so the person can't tell which one to register by hand.
- **Inbox gives no feedback and no confirmation on its actions.** Guardar, Confirmar and Omitir factura just close the dialog. Omitir factura changes the invoice to ignored with no confirmation, one click from Confirmar.
- **Inbox, destination select is one flat list.** Gastos and inversiones are mixed ("Maquinaria y equipo" sits among the gastos). Group them (Gastos / Inversiones), or tag each option.

- **Documento soporte dialog doesn't warn about missing provider data until you click Emitir.** For a provider with no fiscal data the dialog opens as if ready; only the click returns "Al proveedor le falta: NIT o cédula, dirección, municipio, departamento, código postal (6 dígitos)". Show it on open, with a link to edit the provider.
- **Providers created inline (Nuevo gasto, Compra de insumos) have only a name**, so they always fail that check, and their gastos still show the document icon. See the question below.

- **P&G, the "Cambió tras el cierre" tag is clipped** in the month header ("Cambió tras el cierr…"). Widen the column or shorten the text ("Editado tras cierre").
- **Cerrar mes from a second tab:** the refusal is correct ("El mes ya está cerrado"), but it replaces the dialog's text while the confirm button stays live, and the screen behind keeps showing "Cerrar mes". Refresh the month state when the server says it is already closed.
- **An annulled documento soporte still shows on its gasto as "Doc. soporte SEDS…"**, with nothing saying it was annulled, and the gasto can't be sent again. Show the state on the row, and decide whether an annulled one may be re-issued.

- **The Excel export has fractional pesos the screen hides.** Costo de ventas is `40734.75`, Utilidad bruta `164265.25` and Utilidad neta `-691134.75`, while the screen rounds them to $40,735 / $164,265 / -$691,135. Money is meant to be whole pesos. A column summed in Excel will differ from the screen by cents. Cost of sales comes from per-unit ingredient rates (the known open exception), so round it once in the P&G data, not in each view.

- **`/accounting/compra-de-insumos` renders a blank page** (only the top bar) for `accounting_assistant` and for a driver. The path doesn't exist under the `/accounting` prefix, and the app has no catch-all, so any unknown URL under it is blank. Add a catch-all that redirects to the user's home, or make the route resolve.
- **Forbidden accounting URLs redirect with no message.** `delivery_assistant` is sent to `/driver/orders` and `accounting_assistant` from `/dashboard/providers` to the sales report, silently. It isn't blank, but nothing says why; a short "No tienes acceso" would help.

## Questions

- **Should `bakery_staff` have full accounting access?** Logging in as a plain `bakery_staff` and opening `/dashboard/accounting` shows everything: create, delete, Confirmar, and Cerrar/Reabrir mes. The same goes for `accounting_assistant` on Reabrir mes. If closing the month is meant to be an admin-only act, it needs a role check.

- **Should a provider whose "¿Factura electrónicamente?" is still "No se sabe" show the document-support icon?** Today it does (Molinos "No", Proveedor Inline and Distribuidora La 14 "No se sabe" all showed it; only "Sí" hid it). The check list only names "Sí", no provider and ingresos as the cases without it.

- **Six of the 30 real emails are "unreadable" (no electronic invoice attached).** Are those non-invoice emails (newsletters, receipts)? If so they shouldn't land in the inbox as errors at all.

- **Is Monto gross or net of taxes?** A gasto of 119,000 with IVA 19,000 adds 119,000 to Gastos, and the row doesn't show the IVA. The form doesn't say which it is; a hint under Monto would settle it.

- **Orders header "Ingreso" counts the unpaid order.** October has one paid order (205,000) and one unpaid (187,000); the orders screen shows Ingreso 392,000. P&G is right (198,000 + 7,000 delivery); it's the orders figure that looks off. Outside accounting, confirm what Ingreso means.

## Tech debt: checks not run (deferred on purpose, 2026-10-23)

Skipped because each needs a setup change (modules, backend stopped, forced DIAN failure) or data the seed lacks. Pick them up before a production release of accounting; the checklist item numbers refer to `BROWSER-CHECKS.md`.

- **8.6, "Sin enviar" / "Verificando" refresh button and a rejected document:** every emission was accepted at once, so neither state could be reached. Needs a forced failure (backend offline during emit, or invalid data the DIAN rejects).
- **8.7, e-invoicing off:** needs the module switched off in Negocios. Left for you to say when.

- **7.14, interrupted confirm:** needs the backend stopped between the purchase and the records. For you to run; the backend tests cover the retry.
- **7.10, default destination:** only the display was checked, on a document my script wrote. The ingest-time defaulting is backend-tested, not browser-tested.

- **5.4, inactive default category:** the picker hides inactive categories, so it is only reachable by deactivating a category a provider already uses (see the provider bullet above).
- **6.5 and 6.6:** need inventory on, and all three modules off. Both change the business's modules, so left for you to say when.

- **4.2, annulled order with credit note:** none exists in the data (e-invoicing wasn't set up), so only the unpaid half was checked.
- **2.9, empty revenue picker:** the three seeded revenue categories were already deactivated and two test ones are active, so the "activate them in settings" message wasn't seen. Redo after deactivating all of them.
- **2.11, month stepping flicker:** the end state after rapid prev/prev/next/next is correct, but a flicker needs a human eye on it.
