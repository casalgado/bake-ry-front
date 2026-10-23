# Roadmap

## Now

### Inventory
**Status (2026-10-07):** in progress. How it works, what is open and how to deploy it: [inventory/INVENTORY.md](../inventory/INVENTORY.md).
- Done: stock ledger, warehouses, adjust / transfer / waste (backend); Existencias, Compra de insumos, Producción and Conteo screens (frontend).
- Next: providers + Compra de insumos, production runs, orders + availability (deduct on ship), Conteo.

Unified inventory system supporting both restaurant-style (recipe-based) and store-style (buy/sell) operations, since a business may need either or both depending on how it sells.

Sub-phases (sequenced by dependency):

1. **Recipes & stock model**: products can optionally have a recipe (list of components + quantities). Recipe components can be ingredients or other products (enables pre-assembled bundles). Stock is tracked as a movement ledger: current stock = last count baseline + sum of stock movements since. Combos have no stock of their own; availability is computed from component products.
2. **Automatic stock deduction on sale**: when an order is completed, stock is subtracted: ingredient-level if the product has a recipe, product-level otherwise.
3. **"Hacer inventario" (stock count)**: simple, fast data-entry flow for counting current ingredients/products. Marking a count complete sets the new baseline that future sales subtract from.
4. **"Compra de insumos" (purchasing)**: flow to add purchased ingredients and resale products into stock (restocking outside of a formal count). The same screen is the accounting module's purchase door.

Resolved decisions:
- **Stock corrections**: deductions are immutable ledger entries; edits to a completed order write compensating movements (deltas), never rewrite originals. Counts absorb all prior movements; only movements after a count apply to the new baseline.
- **Units**: one base unit per ingredient; recipes, stock, and counts all use it. Purchase presentations ("bulto = 25000 g") are entry-time multipliers in the Compra de insumos flow, not model-level conversions. No cross-dimension conversions (cups→grams).
- **Combos**: no stock entity; purely computed from components. Pre-assembled bundles are modeled as a product whose recipe contains other products.

### E-invoicing (DIAN)
**Status:** issuing and annulling electronic invoices (with credit notes) works against the DIAN habilitación environment. Current status, decisions and known gaps: the backend's `services/dian/README.md`; rules in its `CLAUDE.md`. Its own module, with its own flag (`features.einvoicing.enabled`); it works with or without accounting.

Sub-phases:

1. **Sales invoices and credit notes**: built. Remaining: production numbering resolution and deploy.
2. **Documento soporte**: the buyer's electronic document for purchases from suppliers not obliged to e-invoice (needed to deduct the expense). Lives in Facturas, issuable standalone or from an accounting record or purchase. It may need its own DIAN enablement (a test set in the portal): ask for it early. Not first: every supplier in MAD's sample already e-invoices.
3. **POS equivalent document, partial credit notes, debit notes**: later.

### Accounting
Replaces the accountant's spreadsheet-and-Alegra workflow: gastos, the month view, the P&G, supplier invoices. Design and decisions: [accounting/ACCOUNTING-IMPLEMENTATION.md](../accounting/ACCOUNTING-IMPLEMENTATION.md). Builds on the existing gross-profit report (`IncomeStatement.vue` + `/orders/income_statement`), which stays until the new P&G replaces it.

Sub-phases (sequenced by dependency):

1. **Categories, records, Nuevo gasto**: gasto categories (with optional PUC code and an Inversión kind), the `accountingRecords` collection, a one-off gasto form.
2. **Resumen**: recurring templates that auto-populate each month and only need confirming/adjusting, not re-typing; the month's checklist and completeness warnings.
3. **P&G**: new view: ingresos − costo de ventas − gastos = utilidad neta, with Inversión and "Compras del mes" as memo lines outside the arithmetic.
4. **Shared providers + purchase door**: providers with fiscal data; the Compra de insumos screen gains tax fields and an invoice reference when accounting is on.
5. **Facturas recibidas**: inbox that reads supplier e-invoices from email and routes each line to Compra de insumos, a gasto category or Inversión. The main entry door after Resumen.
6. **Other revenue**: income outside orders (interest, refunds, a used machine sold) added manually. Anything sold to a customer is an order, so it gets invoiced.
7. **Export for the accountant, period close**: the P&G exported with PUC codes; a closed month stored as a frozen statement.
8. **Balance sheet & other statements**: separate, larger phase. Moves up if the accountant needs the balance sheet or journal from MAD to drop Alegra. Requires asset/liability/equity tracking not yet built: cash/bank balances (and bank reconciliation, petty cash), accounts receivable (partial payments already exist), accounts payable, fixed assets & depreciation, equity/retained earnings. Cash flow statement also belongs here.

Resolved decisions:
- **Categories, not chart of accounts**: flat managed category lists per kind (gasto / investment / revenue), with per-business defaults and admin-added custom ones. An optional `pucCode` per category lets the P&G group by account. Full account structure deferred to the balance-sheet phase.
- **Glossary**: ingresos, costo de ventas (automatic, never typed), gastos, Compra de insumos. Bare "compras" and "ingreso" (for stock) are retired.
- **Insumo vs gasto**: in a recipe, or resold, and tracked in stock → Compra de insumos. Everything else, packaging included → gasto.
- **One purchase form, two doors**, and **shared providers**: the form is the same record whether reached from Inventario or Contabilidad.

Open questions / gaps to resolve before implementation (the accountant's answers feed these):
- Period closing: leaning to snapshot-on-close (closing a month stores the statement as a frozen document; later edits to underlying data flag drift instead of silently changing it) rather than hard-locking edits.
- Default categories and PUC codes; class 7 for a bakery; packaging, cleaning and maintenance classification.
- How the mail reaches Facturas recibidas.

Cross-cutting resolved decision (applies to all three epics): **Inventory, Accounting and E-invoicing ship as modules, off by default**, activated per business via `features.inventory.enabled` / `features.accounting.enabled` / `features.einvoicing.enabled` on `BakerySettings` (the existing feature-flag mechanism). The flag gates frontend visibility only (nav, routes, entry points); no backend logic branches on it. Any combination of the three works (accounting and e-invoicing in particular are independent). Details in each implementation doc.

Cross-cutting emphasis: **data entry is the product risk, not the reports**. Reports are cheap once data exists; the epics succeed only if recording costs, purchases, and counts is fast and low-friction. Every entry flow should be designed and reviewed as a UX problem first.

## Next

### WhatsApp AI sales bot
Separate repo/project with its own deployment. Acts as a bridge between the client, Meta (WhatsApp), Claude, and the payment processor: talks to the client, answers questions, completes the sale, sends a payment link, confirms payment, creates the order in the bake-ry database, then sends order status updates.

Sub-phases (sequenced by dependency):

1. **WhatsApp bridge**: Meta WhatsApp Business API integration: receive/send messages, webhook setup. Includes starting Meta's business verification and message-template approval process early, since it has external lead time.
2. **Claude conversational layer**: answers product/pricing questions, grounded via tool calls into the real backend (catalog, prices, stock) rather than freelancing answers.
3. **Sale completion + payment link**: bot completes the order draft and sends a payment link.
4. **Payment confirmation (webhook-driven)**: order is only created/marked paid off a verified payment-processor webhook, never off the client's own claim of having paid; must be idempotent (handles late/duplicate webhook delivery).
5. **Order creation in bake-ry backend**: requires a service-level auth mechanism between the bot project and the backend (not a user login).
6. **Human handoff**: escape hatch for when the AI can't resolve a request: hands off to a human, with enough conversation context passed along that the client doesn't have to repeat themselves.
7. **Order status notifications**: informs the client of order updates after creation.

Resolved decisions:
- **Multi-tenant bot**: one deployment, one WhatsApp number per business, routed by the `phone_number_id` on incoming webhooks mapped to a businessId. Backend auth is a single service credential for the bot plus a stored mapping of which businesses it may act for.
- **WABA ownership**: likely already a Meta Tech Provider (verify account status early, alongside the sub-phase 1 verification work); hold client WABAs under the Tech Provider portfolio so onboarding doesn't repeat Meta business verification per client. Bot code is identical either way, so this gates go-to-market, not development.
- **Session state**: session document per (businessId, customer phone) in Firestore: recent message history, current order draft, coarse state (`browsing`, `collecting_order`, `awaiting_payment`, `handed_off`). Claude is stateless; context is replayed from the session each message. Design-in from day one: webhook idempotency by message id, debounce + per-session lock for message bursts, session expiry (≈24h idle) kept separate from payment lifecycle (payment links key to a persistent order-draft id, not the session), and handoff as a session state so sub-phase 6 reuses the same doc. Cap/summarize message history (last N + running summary) so long relationships don't grow every Claude call.

Open questions to resolve before implementation:
- Evaluate Meta's recently released WhatsApp AI agent offering before building the custom Claude layer — decide whether it competes, complements, or is safely ignored (custom bot still needed for backend-grounded answers, payment flow, and order creation, but Meta's terms and roadmap could affect a custom bot's viability).

## Later

