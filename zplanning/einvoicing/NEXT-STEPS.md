# Facturación electrónica: next steps

Where we stopped on 2026-10-20. The backend's `functions/src/services/dian/README.md` is the source of truth for how it works; this is the to-do list.

## Where it stands

Works end to end in DIAN habilitación (test environment), via SendBillSync:

- Invoices accepted: SETP990000010, -14 (INC 8% with quantity, buyer by NIT), -15 (order discount).
- Credit note NC1 accepted (annuls SETP990000010).
- Email with PDF + AttachedDocument sent through Resend (locally).
- Screens: preview/issue (`/factura/:orderId`), Facturas list, lock on invoiced orders, client fiscal data, admin config (`EinvoicingSection.vue`), IVA/INC on products.

## Before wiping the emulator

The backend test suite deletes **all** emulator data (`clearFirestoreData`), and the emulator persists nothing.

1. Read the counters (`bakeries/es-alimento-dev/einvoiceCounters/SETP` and `/NC`, field `last`).
2. Update `LAST_USED` in `functions/src/seeds/runners/seedEinvoice.js` to those values (currently SETP 990000015, NC 1). The DIAN rejects a number it already received.
3. After the tests, reseed (`node src/seeds/runners/seedEinvoice.js` after the base seed).
4. Decide the seed's issuer email: in habilitación every email goes to the issuer, and the seed has the business's real accountant (contabilidadproductorash@gmail.com).

## 1. Tests (run 2026-10-20)

- Backend: **881/881 pass** (49 suites). Fixed along the way: test orders lacked `preparationDate` and line `collectionId`/`variation` (real ones have them); the two tests that race issues on purpose got a 30 s timeout (emulator contention takes seconds, and a timeout leaked a transaction into the next test).
- Frontend: e-invoicing tests pass (`BakeryUserForm`, `BakeryModulesForm`, `settingsForm`, 25 tests). Still failing, all from before this work (same failures in the old `.claude/worktrees/inventory-ui-design` copy): `Product`, `OrderInvoice`, `ImageUpload`, `NewClientDialog`, `ProductCollectionForm`, `ProductForm`, `VariationsManager` (`formatQty` missing from its helpers mock), `ShowBakeryUsers`, `ExportOrders`, `CombinedProductionInfoCell`, `IsPaidCell`. Several are the same cause: `bakerySettingsStore` touches Pinia at import, so a component test must mock it (see `BakeryUserForm.test.js`).
- Vitest also runs the tests inside `.claude/worktrees/`, doubling the noise: exclude that folder in the vitest config, or remove the stale worktree.
- The backend run **wipes the emulator**: reseed before testing in the app again.

## 2. Commit

Both repos have large uncommitted changes (backend ~1,500 lines; frontend views, forms, models, router, sidebars). Subject-line-only messages.

## 3. Finish testing in habilitación

- [ ] IVA 19% and IVA 5% on one order
- [ ] Paid INC order → annul with credit note
- [ ] Transfer payment (means code 31)
- [ ] Cortesía line (see accountant Q9)
- [ ] Client with cédula; client with pasaporte (override)
- [ ] Rest of the checklist: lock (edit/delete/duplicate/R-D toggle), Facturas list, accounting role, PDF + QR

When the DIAN rejects something, the reason is in "Respuesta completa" (`dian.raw`). The toolbox XSL predates annex v1.9 and flags valid things.

## 4. Accountant

- Is the tax-included layout (gross lines, "INC 8% (base $X)") fine as the representación gráfica?
- Any conditional discounts (pronto pago)? Those must not go through the order discount.
- Q9: how to declare cortesías (price 0 lines).
- Production numbering from MUISCA (form 1302, new prefix e.g. ESA, plus contingency range), linked to the software in the portal.

## 5. Go-live

- Admin form: Ambiente → Producción, production resolution, prefix, range, technical key. TestSetId empty.
- Deploy functions + hosting.
- Grant the functions' service account `secretmanager.secretAccessor` on `resend-api-key` (same account as `einvoice-cert-901417532`).
- Verify `mentedigital.app` in Resend (DNS) if not done.
- First real invoice: one small order, check the DIAN portal and the client's email.
- Alegra keeps its own numbering (ESFE) until the cutover; its resolution expires 2026-12-27.

## Optional

- "Traer de la DIAN" button (`GetNumberingRange`) so the technical key is never typed.
- Products table tax column: `format` isn't read by the DataTable, so it shows a bare number.
- Credit-note email (delivery works for both kinds, untested for notes).
- Partial credit notes, debit notes, POS, contingency.
