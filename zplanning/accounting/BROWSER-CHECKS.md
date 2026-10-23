# Accounting: browser checks

What no automated test covers. Tick as you go. Source of truth: `ACCOUNTING-IMPLEMENTATION.md`.
"Expected" is what must happen; "Edge" is a variation worth trying right after.

---

## 0. Setup

- [ ] Emulators and dev server up. The backend test run wipes the emulator's Firestore: re-seed before starting.
- [ ] Business with **accounting on**, inventory **off** (system admin, Negocios). Repeat sections 5 and 6 once with inventory on.
- [ ] Log in yourself. Roles to try at least once: `bakery_admin`, `bakery_staff`, `accounting_assistant`.
- [ ] Data you need: two providers, one **paid** order and one **unpaid** order in the current month, one order **annulled** with a credit note but not deleted, one ingredient.
- [ ] Keep the console open: no red errors and no failed requests (Network tab) during any check.

---

## 1. Categories (settings)

- [ ] Rename a category and save. Expected: the new name shows in the Nuevo gasto picker; old records keep the name they were created with.
- [ ] Deactivate a category. Expected: gone from the picker; an old record in it still edits.
- [ ] **Agregar** in Gastos, Inversiones and Otros ingresos. Expected: a row opens, saves, appears. Edge: empty name is refused; a PUC code with letters is refused.
- [ ] Try to switch a category between gasto and inversión. Expected: refused.

## 2. Nuevo gasto and Resumen

- [ ] Save a gasto with provider, N.º de factura and taxes. Expected: appears in Resumen; the Gastos total moves by the amount.
- [ ] Same provider, same number, **same category**. Expected: refused. Edge: a **different category** is accepted (one invoice can be split).
- [ ] Pick "Ingredientes y materia prima". Expected: Guardar stays disabled and the link goes to Compra de insumos.
- [ ] Save an inversión. Expected: counted in Inversiones, not in Gastos.
- [ ] Create a provider inline. Expected: it is selected afterwards.
- [ ] Click a row to **edit** it: change amount, category, invoice number, date. Expected: the form is prefilled (date included); the list and totals update.
- [ ] **Repetir** a row. Expected: a new gasto with today's date and no invoice number.
- [ ] Delete a row. Expected: confirmation, then gone from the list and the totals.
- [ ] **Nuevo ingreso** with no active revenue category. Expected: the picker is empty and the form says where to activate them. Activate "Eventos" in settings, then save one with a client name. Expected: tagged "Ingreso" in the list; Otros ingresos total moves; the P&G shows it under Otros ingresos, by category.
- [ ] The ingreso form has no provider, invoice number or taxes. Edit it and **Repetir** it. Expected: stays an ingreso.
- [ ] Step months with the arrows quickly. Expected: no flicker of the wrong month.

## 3. Gastos recurrentes

- [ ] Create one. Expected: it shows under **Por confirmar** in Resumen **and the month's records stay visible below it**.
- [ ] Edit the amount of a pending one, then Confirmar. Expected: a record with the edited amount; the template keeps its default.
- [ ] Confirm, then delete the record. Expected: the template is pending again.
- [ ] Pause a template. Expected: no longer pending. Edge: a template created this month is not pending in earlier months.
- [ ] Delete a template. Expected: confirmed records stay.

## 4. P&G

- [ ] Open with the default range and compare one month by hand with Resumen and the orders report.
- [ ] Unpaid order: **not** counted. Annulled-with-credit-note order that is not deleted: **not** counted.
- [ ] Investments and "Compras de insumos" appear only under "Partidas informativas", never in the net profit.
- [ ] A month with an unconfirmed recurring gasto shows the warning tag.
- [ ] Hasta before Desde, and a range over 24 months. Expected: a clear message, no crash.

## 5. Providers

- [ ] Create one with NIT typed `900.123.456-7`. Expected: stored and shown as `900123456`.
- [ ] A second provider with the same type and number. Expected: refused. Same number with type **CC**: accepted.
- [ ] Bad email. Expected: refused. Same email as another provider. Expected: a hint naming the other provider, saving still works.
- [ ] Default destination: Gasto without a category is blocked; an inactive category is refused.
- [ ] Delete a provider, then create another with the same NIT. Expected: accepted.

## 6. Compra de insumos

- [ ] With inventory **off**: opens under Contabilidad, no "en bodega" text, no "Existencias" pane, Impuestos and N.º de factura visible.
- [ ] Confirmar stays disabled while a provider, a quantity or a line total is missing, and the line under the button says which.
- [ ] Create an ingredient inline, add a line, confirm. Expected: "Compra registrada"; the draft clears.
- [ ] Repeat the same invoice number for the same provider. Expected: refused.
- [ ] A tax larger than the total. Expected: refused with a message.
- [ ] With inventory **on**: the link appears once (under Contabilidad if accounting is on); stock and cost updates behave as before.
- [ ] With all three modules off, `/dashboard/providers` redirects to the dashboard.

## 7. Facturas recibidas (inbox)

The real mail path needs a DKIM-signed email delivered to the deployed receiver, so locally, seed an invoice by hand:
create a document in `bakeries/<id>/receivedInvoices` with `status: "pending"`, `kind: "invoice"`, `supplier {documentType "NIT", nationalId, name}`, `invoiceRef`, `issueDate`, `lines [{description, qty, unit, net, iva, ivaPercent, total, destination: null}]`, `totals {net, iva, total}`, `providerId: null`.

- [ ] The sidebar shows **Facturas recibidas** and Resumen shows "N facturas recibidas por registrar", linking to it.
- [ ] The list shows the invoice with the "Proveedor nuevo" tag. Open it; Confirmar is disabled.
- [ ] **Crear proveedor**. Expected: it closes; reopening shows no tag; the provider exists in Proveedores.
- [ ] Leave a line "Sin definir". Expected: Confirmar disabled and a count of undecided lines.
- [ ] Set one line to **Compra de insumos** without an ingredient. Expected: the server refuses with "indique el ingrediente y la cantidad".
- [ ] Set lines to a gasto category, an inversión category, insumo (ingredient + quantity) and one **omitida**. Confirmar. Expected: one purchase with the insumo lines, one record per category, none for the omitted line; every record carries the invoice number and provider; Resumen totals move; the invoice leaves the list.
- [ ] The ingredient's cost changed to the invoice price (insumo lines update costs).
- [ ] **Guardar** with half the lines decided, close, reopen. Expected: the choices are kept.
- [ ] **Omitir factura**. Expected: it leaves the list and nothing is booked.
- [ ] A provider with a **default destination**: a new invoice from it arrives with every line preset.
- [ ] An invoice made out to another NIT shows "NIT distinto" and the warning in the dialog.
- [ ] A credit note shows "Nota crédito" and Confirmar is refused.
- [ ] An `unreadable` entry shows under "Correos que no pudieron leerse" with Omitir.
- [ ] Interrupt a confirm (stop the backend between the purchase and the records), start it again, Confirmar. Expected: one purchase, no duplicate records.

## 8. Documento soporte (needs e-invoicing on, environment habilitación)

- [ ] Provider form: the "Datos fiscales" section shows only with e-invoicing on. Fill it for a provider (address, 6-digit postal code, DIVIPOLA codes) and mark "No: sus compras requieren documento soporte". Save, reopen. Expected: everything kept.
- [ ] A gasto from that provider shows the document icon. A gasto from a provider marked "Sí, envía factura electrónica", a gasto with no provider and an ingreso do **not**.
- [ ] Emit it. Expected: the dialog shows the number (`SEDS…`) and "Aceptado"; the row now shows "Doc. soporte <number>" instead of the icon. Edge: split into two lines and change the total; the dialog notes it differs from the gasto.
- [ ] Emit again from the same gasto (reload first). Expected: no icon, so it cannot be asked twice; the Documentos soporte list shows one document.
- [ ] A provider missing fiscal data. Expected: the dialog shows "Al proveedor le falta: …" and no number is consumed (compare the counter in `einvoiceCounters/SEDS`).
- [ ] Documentos soporte list: a "Sin enviar" or "Verificando" row has a refresh button; an accepted one can be annulled (confirmation, then "Anulado"). A rejected one lists the DIAN's answer.
- [ ] With e-invoicing off, none of this appears: no icon, no sidebar entry, no fiscal section, and `/dashboard/accounting/documentos-soporte` redirects.

## 9. Export and period close

- [ ] P&G, **Exportar a Excel**. Expected: an .xlsx with one column per month plus Total, the PUC code beside each expense category, amounts as numbers (sum a column in Excel), memo lines last. Compare with the screen.
- [ ] Resumen, **Cerrar mes**. Expected: a "Mes cerrado el …" tag and the button becomes "Reabrir mes". The P&G column for that month shows "Cerrado".
- [ ] Edit or add a gasto in the closed month. Expected: the P&G column changes to "Cambió tras el cierre"; Resumen still opens the month normally (nothing is blocked).
- [ ] Reopen the month. Expected: the tag disappears from both screens. Closing a month twice from two tabs: the second is refused.

## 10. Roles and navigation

- [ ] `accounting_assistant` sees Resumen, Recurrentes, P&G and Facturas recibidas under `/accounting`, and can create gastos. Compra de insumos and Proveedores are not offered.
- [ ] A role without billing access gets a refusal, not a blank page, on every accounting URL.
- [ ] Compra de insumos appears once in the sidebar, never twice.
