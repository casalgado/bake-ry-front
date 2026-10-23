# Accounting: handoff overview

A one-sitting read for a person starting the accounting build. The detailed decisions are in [ACCOUNTING-IMPLEMENTATION.md](ACCOUNTING-IMPLEMENTATION.md) (the source of truth); this page says what we are building, in what order, where the code goes, and what "done" means for each step. A second document for the AI implementing it comes after this one is approved.

Backend: `C:\Users\casal\documents\web\back\bake-ry\functions\src` (`BE`). Frontend: this repo's `src/` (`FE`).

---

## 1. What we are building

An accounting module that lets a bakery drop Alegra: record gastos, see the month as a checklist, read a real P&G (ingresos − costo de ventas − gastos), read supplier invoices from email instead of typing them, and issue the documento soporte when a supplier doesn't e-invoice. It is **opt-in per business** (`features.accounting.enabled`), independent of inventory and of e-invoicing.

**The goal for the first meeting with the accountant (Luz):** phases A to D working with real MAD data, so she can record a month of gastos and see the P&G.

## 2. Five words

| Word | Means |
|---|---|
| **Ingresos** | Money from selling. Automatic, from orders |
| **Costo de ventas** | Cost of what was sold. Automatic, from recipe cost. Never typed |
| **Gastos** | Cost of running the business (rent, utilities, packaging). Typed |
| **Compra de insumos** | Buying what goes into the product or gets resold (the inventory purchase screen) |
| **Registro** | One row in `accountingRecords`: a gasto, an inversión (oven), or other income. **Not an asiento**: single-sided, no debit and credit |

Test: in a recipe, or resold, and tracked in stock → Compra de insumos. Everything else → gasto.

## 3. What already exists and gets reused

- Factories for CRUD in the backend (`serviceFactory`, `controllerFactory`); a caller-supplied `id` is allowed.
- `BakerySettings` with `features.accounting.enabled` (already there, both sides) and the `ingredientCategories` pattern for managed lists.
- `orderService.getIncomeStatement` (order revenue, COGS waterfall): the P&G calls it.
- `Provider` (has `name`, `nationalId`, `phone`) and `Purchase` (immutable) under inventory.
- `requireBakeryBilling` guard (admin, staff, accounting), used by e-invoices.
- Frontend: resource service/store bases, `UiMoneyInput`, `UiPills`, `PageHeader`, `isAccountingEnabled` in `bakerySettingsStore`, `requiresFeature` route meta, the sidebars. Categories are edited the way `IngredientCreateCard` edits ingredient categories: `settingsStore.patch('default', { …whole array })`.

**Not touched:** `IncomeStatement.vue`, the `/orders/income_statement` route, any other older Tailwind view.

## 4. The plan

| | Phase | You can test it when | Size | Needs |
|---|---|---|---|---|
| A | Categories | Settings shows gasto categories with PUC code and an Inversión kind | S | none |
| B | Records + Nuevo gasto | You enter a gasto and see it; picking "Ingredientes" redirects to Compra de insumos | M | A |
| C | Templates + Resumen | Rent is pending each month; one tap confirms it; the month shows what is outstanding | M | B |
| D | P&G | A month shows utilidad neta from real orders and the gastos you entered; Inversión sits outside | M | B, C |
| E | Shared providers + purchase door | Proveedores screen (document type, email, default destination, no duplicate NITs); Compra de insumos shows tax fields and invoice number when accounting is on; Ingreso is renamed | M | A |
| F | Facturas recibidas | A supplier invoice from email becomes one purchase plus records after you confirm the lines | L | B, E |
| G | Documento soporte | You issue a documento soporte from a record and the DIAN accepts it in habilitación | L | E |
| H | Other revenue | Interest or a refund shows under "Otros ingresos" | S | B |
| I | Export for the accountant | The P&G downloads with PUC codes | S | D |
| J | Period close | A closed month is frozen; later edits flag drift | M | D |

A → B → C → D is the spine. E can start after A. Everything ships behind the `accounting` flag.

## 5. Where the code goes

### Backend
| Phase | New | Edited |
|---|---|---|
| A | none | `models/BakerySettings.js` (`expenseCategories`, `revenueCategories`, defaults) |
| B | `models/AccountingRecord.js`, `services/accountingRecordService.js`, `services/accountingService.js` (`getMonth`), `controllers/accountingRecordController.js`, `controllers/accountingController.js`, `routes/accountingRoutes.js` | `index.js` (mount), `firestore.rules` if the stores read Firestore directly |
| C | `models/AccountingTemplate.js`, `services/accountingTemplateService.js`, `controllers/accountingTemplateController.js` | `accountingService.js` (pending templates, confirm), `accountingController.js`, `accountingRoutes.js` |
| D | none | `accountingService.js` (statement), `accountingController.js` |
| E | none | `models/Provider.js`, `models/Purchase.js`, `services/purchaseService.js`, `controllers/providerController.js` (validation) |
| F | `models/ReceivedInvoice.js`, service, controller, routes, intake and parser | `index.js` |
| G | DIAN builders in `services/dian/`, einvoice kind | `services/einvoiceService.js`, `models/Einvoice.js`, `models/Provider.js` (`address`, `issuesEinvoice`) |
| H | none | none |
| I | none | `accountingService.js` or controller (export) |
| J | `closedPeriods` handling | `accountingService.js` |

### Frontend
| Phase | New | Edited |
|---|---|---|
| A | `components/settings/AccountingCategoriesSection.vue` | `views/bakerySettings/ShowBakerySettings.vue`, `models/BakerySettings.js` |
| B | `services/accountingRecordService.js`, `services/accountingService.js`, `stores/accountingRecordStore.js`, `stores/accountingStore.js`, `components/accounting/RecordForm.vue`, `views/accounting/ResumenView.vue` (shell: month stepper, list, Nuevo gasto) | `router/index.js`, `components/layouts/AdminSidebar.vue`, `components/layouts/AccountingSidebar.vue` |
| C | `services/accountingTemplateService.js`, `stores/accountingTemplateStore.js`, `views/accounting/RecurringExpensesView.vue`, `components/accounting/{PendingTemplates,TemplateForm}.vue` | `views/accounting/ResumenView.vue`, `stores/accountingStore.js`, `router/index.js`, both sidebars |
| D | `views/accounting/PygView.vue` | `stores/accountingStore.js` |
| E | `views/providers/ShowProviders.vue`, `components/forms/ProviderForm.vue` | `views/inventory/PurchaseDoc.vue`, `components/layouts/AdminSidebar.vue` (Usuarios section, Ingreso → Compra de insumos), `providerService.js`/`providerStore.js` |
| F | `views/accounting/ReceivedInvoicesView.vue` and review components | router, sidebars |
| G | documento soporte form | `views/einvoices/ShowEinvoices.vue` |
| H | none | `RecordForm.vue` (revenue mode) |
| I | none | `PygView.vue` (export button) |
| J | none | `PygView.vue`, Resumen (close button) |

Any new `ui-*` class is added to the gallery at `/system-admin/ux` in the same change.

## 6. House rules (from this repo)

- Code, enums and stored data in **English**; **Spanish only in UI copy**.
- New views use the `ui-*` system: read `src/assets/ui/CLAUDE.md` first. No Tailwind color classes in new views. Vue files go script, template, style (scoped), with `<script setup>`.
- Never edit older Tailwind views. Never edit `tailwind.config.js`, `custom-components.css` or `custom-base.css`.
- Comments state the current rule only (no "used to be…"). No one-off CSS classes named after a screen.
- Edit with the Edit/Write tools, not shell scripts.
- **Ask before running tests. No eslint after edits. No git actions** (commits, branches) unless asked. Explain the diff and wait for "apply it" before changing existing files.
- The server is always running; do not ask to start it.

## 7. Open questions, and what we build meanwhile

We start building now with a working default for each question. When the answer arrives, the right-hand column says what changes. None of these blocks phases A to D.

| # | Question (who answers) | Working default | If the answer differs |
|---|---|---|---|
| 1 | Does the accountant need the balance sheet or the journal from MAD, or only the P&G? (accountant) | P&G only; records are single-sided | The balance-sheet phase moves up; records may need a "paid from" account. Biggest possible change |
| 2 | Default categories and PUC codes (accountant) | The default lists in the AI doc; `pucCode` left blank | Edit the seeded defaults and fill the codes. No code change |
| 3 | Packaging: inventory/cost or gasto? (accountant) | Gasto (`packaging` category) | Remove the category from the defaults and handle packaging as an ingredient |
| 4 | Cleaning and maintenance as class 5 or 7; does a bakery use class 7? (accountant) | `pucCode` only; the P&G ignores it | A different code in the seeds |
| 5 | Costo de ventas for accounting-only clients: recipe cost or purchases? (accountant) | Recipe cost | A statement option in phase D |
| 6 | How do waste and shrinkage reach the P&G? (accountant) | Not in the P&G | A new line fed by stock waste movements |
| 7 | Non-deductible invoices (personal NIT) and non-expense money (a loan) (accountant) | Phase F shows a warning on a different NIT; nothing in A to E | A flag on records |
| 8 | DIAN receipt events (acuse, recibo, aceptación): our duty? (accountant) | Ignored by the inbox | A feature in the e-invoicing epic |
| 9 | Payroll: electronic payroll obligation? (accountant) | A `payroll` category and a recurring template; no payroll module | A separate payroll epic |
| 10 | What else does she use in Alegra? (accountant) | Nothing beyond this plan | New phases |
| 11 | Who may write records (admin, staff, accounting)? (you) | `requireBakeryBilling` | Change the guard in one file |
| 12 | Does an annulled invoice (credit note) remove the order's revenue in `getIncomeStatement`? (checked) | No: the old report only drops the order if someone also deletes it, so annul without deleting overstates revenue. The new P&G excludes orders whose invoice is annulled, deleted or not. The old report is untouched | Confirm with the accountant; the filter is one line |
| 16 | Which date puts an order's revenue in a month: delivery/preparation date or payment date? Do unpaid orders count? (accountant) | Order date (the one the business shows in its tables), paid orders only, as `getIncomeStatement` does today. Unpaid orders are not counted | Switch to the payment date (cash basis), or count unpaid orders as receivables (accrual) |
| 13 | Does Compra de insumos work with inventory off? (check the code, before phase E) | Unknown | Guard the stock parts of `PurchaseDoc.vue` |
| 14 | Is a separate DIAN test set needed for documento soporte? (you, in the DIAN portal; ask early) | Assumed yes | None to code |
| 15 | How does supplier mail reach the system, and how are the attachments read? (spike on 5 invoices, before phase F) | Undecided | Shapes phase F |

Defaults ship in A with her codes left blank.

## 8. Risks

- **F is the biggest unknown:** mail intake and reading the attachments. Do a one-day spike on 5 real invoices first.
- **G may need its own DIAN test set.** Ask the DIAN for it early; I have not verified that it is required.
- **D reuses a ~260-line function** (`orderService.getIncomeStatement`). Before building the statement, verify how an annulled invoice (a credit note) affects order revenue.
- **Accounting without inventory:** Compra de insumos works without a stock ledger (it follows `enabledAt`). Verify with a business that has accounting only, before E ships.

## 9. Starting the session

Read, in this order: this page, `ACCOUNTING-IMPLEMENTATION.md`, `src/assets/ui/CLAUDE.md`, and the backend `services/dian/CLAUDE.md` (only when touching e-invoicing). Start at phase A and finish a phase before opening the next.
