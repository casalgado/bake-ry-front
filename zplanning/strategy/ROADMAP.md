# Roadmap

## Now

## Next

### Inventory
Unified inventory system supporting both restaurant-style (recipe-based) and store-style (buy/sell) operations, since a business may need either or both depending on how it sells.

Sub-phases (sequenced by dependency):

1. **Recipes & stock model** — products can optionally have a recipe (list of components + quantities). Recipe components can be ingredients or other products (enables pre-assembled bundles). Stock is tracked as a movement ledger: current stock = last count baseline + sum of stock movements since. Combos have no stock of their own; availability is computed from component products.
2. **Automatic stock deduction on sale** — when an order is completed, stock is subtracted: ingredient-level if the product has a recipe, product-level otherwise.
3. **"Hacer inventario" (stock count)** — simple, fast data-entry flow for counting current ingredients/products. Marking a count complete sets the new baseline that future sales subtract from.
4. **"Compras" (purchasing)** — flow to add purchased products/ingredients into stock (restocking outside of a formal count).

Resolved decisions:
- **Stock corrections** — deductions are immutable ledger entries; edits to a completed order write compensating movements (deltas), never rewrite originals. Counts absorb all prior movements; only movements after a count apply to the new baseline.
- **Units** — one base unit per ingredient; recipes, stock, and counts all use it. Purchase presentations ("bulto = 25000 g") are entry-time multipliers in the Compras flow, not model-level conversions. No cross-dimension conversions (cups→grams).
- **Combos** — no stock entity; purely computed from components. Pre-assembled bundles are modeled as a product whose recipe contains other products.

### Accounting
Builds on the existing gross-profit report (`IncomeStatement.vue` + `/orders/income_statement`), which was deliberately scoped down because operating expenses weren't tracked yet. Goal: turn it into a full income statement, then later add the statements that require asset/liability tracking.

Sub-phases (sequenced by dependency):

1. **Fixed costs** — recurring costs (rent, salaries, utilities) entered and updated monthly. Entry UX is the priority: recurring templates that auto-populate each month and only need confirming/adjusting, not re-typing.
2. **Variable/other revenue** — non-sales revenue streams added manually; cost of sales continues to come from product/recipe cost (ties into Inventory epic above).
3. **Full income statement (P&L)** — extend the existing gross-profit report to net profit: revenue (sales + other) − COGS − fixed/operating costs.
4. **Balance sheet & other statements** — separate, larger phase. Requires asset/liability/equity tracking not yet built: cash/bank balances, accounts receivable (partial payments already exist), accounts payable, fixed assets & depreciation, equity/retained earnings. Cash flow statement also belongs here.
5. **Colombia facturación electrónica (DIAN)** — explicitly later; print/issue electronic invoices for customers.

Resolved decisions:
- **Categories, not chart of accounts** — flat managed category lists per type (expense / revenue), with per-business defaults and admin-added custom ones. Entries reference categories by id (never free text). Full account structure deferred to the balance-sheet phase.

Open questions / gaps to resolve before implementation:
- Period closing: leaning to snapshot-on-close (closing a month stores the statement as a frozen document; later edits to underlying data flag drift instead of silently changing it) rather than hard-locking edits.
- Colombia tax: sales IVA already tracked on products/orders; the gap is the purchases/expenses side (IVA descontable, retención). Include those fields in the new expense/purchase entry forms from day one — reporting can come later, but the data can't be reconstructed retroactively.

Cross-cutting resolved decision (applies to both epics): **Inventory and Accounting ship as modules, off by default**, activated per business via a `features.inventory.enabled` / `features.accounting.enabled` flag on `BakerySettings` — the existing feature-flag mechanism. The flag gates frontend visibility only (nav, routes, entry points); no backend logic branches on it, since both epics already no-op for a non-adopting business. Details in each implementation doc's §14.

Cross-cutting emphasis (applies to Inventory too): **data entry is the product risk, not the reports**. Reports are cheap once data exists; the epics succeed only if recording costs, purchases, and counts is fast and low-friction. Every entry flow should be designed and reviewed as a UX problem first.

### WhatsApp AI sales bot
Separate repo/project with its own deployment. Acts as a bridge between the client, Meta (WhatsApp), Claude, and the payment processor: talks to the client, answers questions, completes the sale, sends a payment link, confirms payment, creates the order in the bake-ry database, then sends order status updates.

Sub-phases (sequenced by dependency):

1. **WhatsApp bridge** — Meta WhatsApp Business API integration: receive/send messages, webhook setup. Includes starting Meta's business verification and message-template approval process early, since it has external lead time.
2. **Claude conversational layer** — answers product/pricing questions, grounded via tool calls into the real backend (catalog, prices, stock) rather than freelancing answers.
3. **Sale completion + payment link** — bot completes the order draft and sends a payment link.
4. **Payment confirmation (webhook-driven)** — order is only created/marked paid off a verified payment-processor webhook, never off the client's own claim of having paid; must be idempotent (handles late/duplicate webhook delivery).
5. **Order creation in bake-ry backend** — requires a service-level auth mechanism between the bot project and the backend (not a user login).
6. **Human handoff** — escape hatch for when the AI can't resolve a request: hands off to a human, with enough conversation context passed along that the client doesn't have to repeat themselves.
7. **Order status notifications** — informs the client of order updates after creation.

Resolved decisions:
- **Multi-tenant bot** — one deployment, one WhatsApp number per business, routed by the `phone_number_id` on incoming webhooks mapped to a businessId. Backend auth is a single service credential for the bot plus a stored mapping of which businesses it may act for.
- **WABA ownership** — likely already a Meta Tech Provider (verify account status early, alongside the sub-phase 1 verification work); hold client WABAs under the Tech Provider portfolio so onboarding doesn't repeat Meta business verification per client. Bot code is identical either way, so this gates go-to-market, not development.
- **Session state** — session document per (businessId, customer phone) in Firestore: recent message history, current order draft, coarse state (`browsing`, `collecting_order`, `awaiting_payment`, `handed_off`). Claude is stateless; context is replayed from the session each message. Design-in from day one: webhook idempotency by message id, debounce + per-session lock for message bursts, session expiry (≈24h idle) kept separate from payment lifecycle (payment links key to a persistent order-draft id, not the session), and handoff as a session state so sub-phase 6 reuses the same doc. Cap/summarize message history (last N + running summary) so long relationships don't grow every Claude call.

Open questions to resolve before implementation:
- Evaluate Meta's recently released WhatsApp AI agent offering before building the custom Claude layer — decide whether it competes, complements, or is safely ignored (custom bot still needed for backend-grounded answers, payment flow, and order creation, but Meta's terms and roadmap could affect a custom bot's viability).

## Later
