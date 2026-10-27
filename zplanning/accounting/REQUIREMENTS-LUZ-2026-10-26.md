# Requirements from the meeting with Luz (2026-10-26)

Sources: the transcript (`audio-transcribe/processed/2026_10_26_contabilidad_mad_luz.md`, sections cited as §n) and `notas.txt`. Every "exists" / "missing" below was checked against the code on 2026-10-26.

This is the complete list. It says **what**, not **when**: the build order is decided separately. Suggested priority: **P0** this week (invoicing go-live), **P1** before Nov 1 (gastos move into MAD), **P2** November (first P&G comparison), **P3** later.

Tags: **[L]** Luz asked · **[B]** Beto committed · **[E]** Esteban · **[N]** from `notas.txt` · **[!]** pushback, conflict or a risk found while checking.

## 0. What the meeting answered (update ACCOUNTING-IMPLEMENTATION §12 and HANDOFF §7)

| Open question | Answer |
|---|---|
| Q16: which month gets an order's revenue | The **invoice issue date**. Payment doesn't matter. Invoiced and unpaid = cuenta por cobrar (13) |
| Q1: balance sheet or only P&G | She expects 13, 23, caja/banco and notas de ajuste. Built as a cash book (C1), not double-entry |
| Q3: empaques | Gasto, not recipe (§5). PUC code still missing |
| Q9: nómina | Its own module (F). Electronic nómina unknown |
| Q10: what else she uses in Alegra | Facturas de venta, facturas recurrentes, pagos recibidos, por cobrar per client, bank reconciliation (§19, §20) |
| Costo de ventas timing | Follows the invoice. Stock still discharges on production (§11) |

---

## A. Sales invoicing

**A1. DIAN production go-live [B] P0.** The MUISCA numbering is in hand. Remaining, from `einvoicing/NEXT-STEPS.md` §5: admin form set to Producción, deploy, the secret grant, the Resend domain, then one small real invoice to test.

**A2. Luz can log in to production [L] P0 (§1).** "El link ya tú me lo enviaste" / "tú no puedes entrar todavía". She needs an `accounting_assistant` user on the real business.

**A3. Wrong tax type on invoices [B][N] P0 (§3).** The cold brew changed to IVA 5%, but the invoice still says INC.
- Likely cause, per [N] "que los impuestos se actualicen en pedidos ya creados": order lines snapshot the tax when created.
- Rule: an order that hasn't been invoiced takes the current product tax when it's invoiced; an invoiced order never changes. Confirm the root cause first.
- Same family [N]: "en order form, marcar qué tipo de impuesto es, sale solo IVA".

**A4. Every product's tax checked by Luz before real invoices [L] P0 (§3).** The 5% on coffee was Esteban's guess ("No estoy seguro… El 5%"). A wrong rate on a real invoice needs a credit note to fix. She asked to be able to correct taxes herself, so the accounting role must be able to edit a product's tax type and rate. Verify that it can.

**A5. Batch invoicing [L] P1 (§15, §16).** Luz will invoice the day's B2C orders at 5–5:30 pm, and she invoiced October "pedido por pedido". Add "Facturar seleccionados" on the orders list. Each invoice is still issued one by one and reports its own result.

**A6. Nothing left uninvoiced [L] P0 (§16).** "¿Ves cómo vamos a hacer ahí para que no se nos quede ninguna factura?" Show a "pendientes por facturar" view or filter: paid and/or delivered and not invoiced, from Oct 1. October's B2C backlog has to be invoiced **before Oct 31**, because the DIAN invoice date is the issue date and can't be backdated.

**A7. Re-invoice after a credit note [!] P1 (§2, §15).** An e-invoice's id is the order id (`einvoiceService.js:131`), so an annulled order can never be invoiced again. Fixing a wrong invoice (wrong tax, an order that changed) then means duplicating the order. Decide: allow a new invoice on an annulled order, or document duplicating as the official flow.

**A8. Partial credit notes [L] P3 (§15).** "Si se lo facturó y después hay un cambio del pedido, sería una nota crédito." Today only the whole invoice can be annulled. Invoicing B2B on delivery makes this rare, but returns and short deliveries still happen. Already listed as optional in NEXT-STEPS.

**A9. Printed B2B invoice with a received line [E] P1 (§15).** Esteban sends two printed Alegra invoices with each B2B delivery, and the client signs one as received. When B2B moves to MAD, the PDF needs a "Recibido: nombre / firma / fecha" block and a convenient print. A signed credit invoice is also what makes it collectible.

**A10. B2B cutover from Alegra [!] P1.** Not decided in the meeting. Luz: "esas no las toco porque ya las factura el señor Esteban" in Alegra. Pick a date for Esteban to invoice B2B from MAD. The Alegra resolution expires 2026-12-27.

**A11. Recurring sales invoices [L] P3 (§19).** She mentioned it as something Alegra has. Nobody asked for it. Note it, don't build it.

## B. P&G

**B1. Revenue and costo de ventas by invoice date [L] P1 (§11–13).** Today the P&G filters by `dueDate` and only counts paid orders (`accountingService.js:195`, `orderService.js:849`). Changes:
- Add `issuedAt` (Colombia date) to `Einvoice.toOrderSummary()`.
- Filter the order side by `einvoice.issuedAt` and drop the `isPaid` gate.
- COGS is computed per order from the recipe, so it moves with the revenue with no other change.
- **[!] Conflicts with [N]** "se descuenta el inventario $ cuando se paga". Stock comes off on production, the P&G cost follows the invoice, and neither depends on payment.
- **[!] Open:** with this basis, a business without e-invoicing shows zero revenue. Choose its basis without a backend flag check (ACCOUNTING-IMPLEMENTATION §14).

**B2. A credit note reduces revenue in its own month [!] P1.** `excludeAnnulled` takes an October invoice that was annulled in November out of **October**. That rewrites a closed month, and it no longer matches what the DIAN has, which is the October invoice plus a November credit note. Luz: "la DIAN le tiene el ojo a que los ingresos cuadren" (§12). Required: the invoice counts in its month, and the credit note subtracts in its month.

**B3. P&G revenue reconciles with the DIAN [L] P2 (§12).** A check that P&G revenue equals the invoices issued minus the credit notes in the month. B1 + B2 make it true by construction; the check proves it.

**B4. Domicilios under Otros ingresos [L] P1 (§8).** PUC code to confirm with Luz.

**B5. [!] Delivery cost counted twice [!] P1 (§6, §8).** The P&G already subtracts each order's `deliveryCost` as costo de domicilios. Víctor's cuenta de cobro ($284.000) entered as a gasto or documento soporte would count the same deliveries again. Pick one source: order delivery cost, or the delivery man's actual bill. Ask Luz which she wants on the P&G.

**B6. "Solo datos facturados" banner [B] P1 (§12–13).** It also has to explain the difference to Esteban: the sales report goes by production date and the P&G by invoice date ("¿Tenemos dos contabilidades?"). The sales report stays as it is [B].

**B7. Anticipos [L][B] P1 (§12).** Orders paid but not invoiced at the end of the month.
- Shown **per client**, not only as a total ("con el dato del cliente").
- Should be 0 at month end.
- Derived, never stored. The "cruce" is the invoice being issued.

**B8. Recipes cover everything sold [L] P1 (§3).** "Siempre que tenga cargada la receta." Products without cost already come back as `excludedProducts`. Make sure the P&G shows them as a warning, and fill in the missing recipes before November.

## C. Money: caja/banco, por cobrar, por pagar, reconciliation

**C1. Money accounts with calculated balances [L][B] P1 (§14, §19, §22).** Decided:
- Settings hold a list of accounts (Caja, the bank), each with an opening balance and date, plus a payment-method → account map (cash → caja, transfer → banco).
- Balance = opening + order payments (`isPaid`, `partialPayments[]`) − received invoices paid − gastos paid ± manual movements.
- A small `moneyMovements` collection for movements no other document records: caja → banco deposits, owner withdrawals, notas de ajuste.
- Balances are calculated, never stored, so editing a fecha de pago can't make them drift.
- Month-end check: MAD's balance equals the bank's balance (§22).

**C2. Cuentas por cobrar [L] P1 (§14, §19).** `ShowUnpaidOrders.vue` already exists (B2B/B2C, overdue).
- Give the accounting role the route.
- Add a total owed per client ("tienes que saber cuánto te debe").
- One por cobrar for everyone, B2B and B2C together (§14).
- **[!] No "crédito" payment method:** unpaid already means credit, and the invoice XML already sends crédito (`dian/invoiceData.js:260`).

**C3. Pay several orders at once [E] P1 (§14).** "Botero cancela todos los lunes": one transfer covers a week of invoices. Allow marking selected orders paid with one date and method.

**C4. Cuentas por pagar [L][B] P1 (§4, §14).** Decided:
- A received invoice gets the order payment shape: `isPaid`, `paymentDate`, `paymentMethod`, `partialPayments[]`.
- An invoice from the inbox defaults to unpaid. Paying on the spot is one tap when confirming it.
- Gastos and purchases entered by hand are paid when entered.
- Show an unpaid list like ShowUnpaidOrders: per provider, with the total owed and overdue invoices. Due date from the invoice.

**C5. Retención on payments [!] P2 (§21).** Beto's own invoice came in 11% short because of retención. B2B restaurants may withhold retefuente from what they pay the bakery. Then a por cobrar never closes: the order is $440.000 and $429.000 arrives.
- An order payment needs a withholding amount (it's a tax credit for the bakery, not a discount).
- The reverse applies if the bakery withholds from suppliers. Records already have `retefuente`, `reteica` and `reteiva`.
- Ask Luz whether any client withholds today.

**C6. Cruzar con banco [B][L] P2 (§20, §22).** Upload the Excel statement and match rows against the movements of the banco account (C1) by amount and date (± days). Show matched and unmatched on both sides. Fix unmatched rows by editing the fecha de pago (C8) or adding a nota de ajuste (C1). One bank, Excel format. Waiting on Esteban's file (he sent September's).

**C7. Notas de ajuste [L] P2 (§19, §22).** Covered by C1's manual movements: account, amount, sign, date, reason. Ask Luz whether she also needs journal-style notes between accounts (13 against banco). In MAD that's marking paid.

**C8. Luz edits the fecha de pago [L] P1 (§19).** "Al momento de hacer la conciliación bancaria tal vez quiera modificar la fecha de pago." The accounting role edits payment fields only, never the order's lines.

## D. Gastos, inbox, providers, inventory cost

**D1. Inbox connected in production [B] P1 (§5, §10).** The demo ran locally ("no está conectada con la de verdad"). The forwarding address has to work on the real business before November.

**D2. Provider set from the invoice [B] P1 (§5).** "Me faltó el proveedor, me toca arreglar esto." Confirming a received invoice has to link the provider by NIT, or create it.

**D3. Invoice lines remember where they go [B][N] P1 (§5, §10).**
- (provider, line code or description) → destination: ingredient + unit factor, a gasto category, or inversión. Prefill it on the next invoice ("después él ya aprende").
- [N] "que quede un local en el store que aguante refresh": the review draft survives a page refresh. Confirm that's what you meant.

**D4. Supplier history [L] P1 (§6).** A provider page listing purchases, records, received invoices, documentos soporte and the balance por pagar (C4).

**D5. Documento soporte [L][B] P1 (§6).** Already built: issued from a gasto in Resumen, listed and annulled in `SupportDocsView.vue`. Remaining:
- Check it's accepted in habilitación, then production.
- Add a "Nuevo" entry where Luz looked for it.
- **[!] [N] "documento soporte para todos los gastos"** is wrong as written. It only applies to suppliers who aren't obliged to e-invoice. What did you mean?

**D6. Recurring gasto confirm bug [B] P0 (§7).** Needs steps to reproduce.

**D7. Discount crash [N] P0.** Needs steps to reproduce.

**D8. Categories and PUC codes reviewed by Luz [B] P1 (§4).** "Esto también es para que me corrijas." That covers gasto, ingreso and inversión categories, plus empaques (D9) and domicilios (B4).

**D9. Empaques is a gasto [L] decided (§5).** Bags are not in the recipe. PUC code still missing.

**D10. Average cost [L] open (§10).** Proposal: weighted average, `(onHand·oldCost + qty·unitPrice) / (onHand + qty)`, where `purchaseService` sets `costPerUnit` (~line 203). Fall back to the purchase price when `onHand ≤ 0`. Needs Luz's OK.

**D11. Inventory value at month end for Luz [L] P2 (§10).** "Ah, ese sería mi inventario." The valor en bodega on the last day of the month is her inventory figure. Make it readable for a past date.

**D12. Recurring gastos loaded [B] P1 (§7).** Setup, not code: arriendo ($3.000.000 with IVA, day 5, provider data still to fill in), luz, agua, gas, internet, nómina per person (F).

**D13. Clean the demo data [!] P0.** The pan de queso test product and order, queso costeño at 21, the $12.000 transport gasto and the "servicios de consultoría" category. If any of it was in production, delete it.

## E. The accountant's view

**E1. Pedidos for Luz [L][B] P0 (§17, §19).**
- Columns: client, client type, items, facturado, enviado, método de pago.
- Filters: date range, B2B/B2C, facturado / no facturado.
- Actions: Facturar (A5), export, edit the fecha de pago (C8).
- **[!] Open:** a new `ui-*` list, or open the existing orders table to the role (adding filters edits an old view).

**E2. Export everywhere [L] P1 (§19).** "Me gusta mucho exportar y crear carpetitas." Excel export on P&G, gastos, received invoices, por cobrar, por pagar, anticipos and pedidos. One shared exporter. The P&G already has one.

**E3. Review the role's access [B] P0 (§6).** "Te tengo que mejorar tu vista." The role needs edit rights on product tax (A4), payment fields (C8), invoicing (A5) and annulment (§2).

## F. Nómina (plan, built later)

What Luz described (§9): básico, auxilio de transporte, horas extras, vacaciones; salud and pensión deductions; per quincena, each one booked and paid ("que se vaya cruzando"). Meanwhile, one recurring gasto per person or for the total.

What a real payroll also needs (not from the meeting, verify with Luz): employer contributions (pensión 12%, ARL, caja 4%, salud/SENA/ICBF where not exempt), the PILA, prestaciones (cesantías, intereses, prima, vacaciones provisions), and probably the monthly **nómina electrónica** (its own DIAN schema and test set; the certificate likely works).

| | Phase | Done when |
|---|---|---|
| N1 | Employees + quincena liquidación (devengos, deducciones, neto) | The quincena reaches the P&G as nómina (5105), and paying it moves money out of banco (C1) |
| N2 | Employer contributions + prestaciones (provisions) | The P&G shows the real cost of each employee |
| N3 | Nómina electrónica | The DIAN accepts the monthly document in habilitación |

Ask Luz first: how many employees, who runs the PILA today, and who issues nómina electrónica today.

## G. Process, not code

- **Esteban stops dispatching unpaid B2C orders** (§15). An optional warning when dispatching unpaid B2C orders would help, but nobody asked for it.
- **B2B is invoiced on delivery** (§15). MAD has no delivery trigger, so invoicing stays manual.
- **B2C is invoiced at the end of each day by Luz** (§15), or at the moment of sale.
- **Gastos and received invoices from November in MAD**, with Alegra closing October (§18).
- **End of November: compare MAD's P&G with Alegra's** (§18).
- **Esteban downloads bank statements in Excel** and sends them to Luz (§20).
- **POS terminal** for the café: future (§15).

## H. Questions back

**For Luz:**
- PUC codes: empaques, domicilios.
- Average cost (D10).
- The anticipo definition (B7).
- Delivery cost on the P&G (B5).
- Do clients withhold retención (C5)?
- Journal notes beyond adjustments (C7)?
- The nómina questions (F).
- B2C paid on the 31st and delivered on the 1st: which day gets the invoice?

**For Beto:**
- Revenue basis without e-invoicing (B1).
- Re-invoice after annulment (A7).
- Luz's table: new or old view (E1).
- B2B cutover date (A10).
- Steps to reproduce D6 and D7.
- The two notes in D3 and D5.
