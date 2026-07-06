# Competitor Landscape — Addendum: Fudo/POS, Odoo/Open-Source ERP, Shopify/E-commerce

This adds three clusters to the original wide scan. Same format: Name / what it does / module coverage / category. Ends with an updated "where to focus" view incorporating these findings.

---

## Cluster 1 — POS-focused platforms (like Fudo)

**Modules key:** orders / sales / delivery / accounting / users / balance sheets & financial statements

- **Fudo** — Cloud POS for restaurants/bars/cafés, Argentine-founded (backed by a16z), active in Colombia, Mexico, Chile, Guatemala.
  - Orders: ✅
  - Sales: ✅
  - Delivery: ✅ (native Rappi/Didi Food/Uber Eats/Justo integrations, own online store, QR menu)
  - Accounting: ❌ (basic reports only)
  - Users: ✅ (roles/permissions)
  - Financials: ❌
  Category: **(b) POS/retail-focused**
  Colombia notes: <cite index="1-1">Fudo is active in Colombia from ~$62,900 COP/month, and works only with internet access — no offline mode, a real risk in areas with unstable connectivity.</cite> <cite index="1-1">DIAN e-invoicing is not included in the base plan — it's a separate paid add-on module, and with all relevant modules (tables, delivery apps, KDS, invoicing) the real cost reaches roughly $245,600 COP/month.</cite>

- **Loggro (Restobar)** — Colombia-native restaurant/retail POS + inventory + DIAN invoicing, positions itself as an all-in-one gastronomic management tool.
  - Orders: ✅
  - Sales: ✅
  - Delivery: ✅
  - Accounting: ✅ (native DIAN, basic bookkeeping)
  - Users: ✅
  - Financials: ⚠️ (limited, not full balance sheet)
  Category: **(b) POS/retail-focused**, edges into (c). Colombian-native, positioned in local "best restaurant software" lists alongside Fudo and Siigo POS.

- **WARO** — Colombian POS competitor pitched directly against Fudo.
  - Orders: ✅
  - Sales: ✅
  - Delivery: ✅
  - Accounting: ✅ (native DIAN e-invoicing "included in all plans," works offline)
  - Users: ✅
  - Financials: ❌
  Category: **(b) POS/retail-focused**. <cite index="1-1">Unlike Fudo, DIAN e-invoicing is included in all plans with no extra module or per-document cost, and the system works offline when the signal fails — critical for restaurants with unstable connectivity or during power cuts. Support is local, in Colombian business hours.</cite>

- **Siigo POS (Gastrobar)** — POS module bolted onto Siigo's core accounting suite, aimed at restaurants/bars/cafés.
  - Orders: ✅
  - Sales: ✅
  - Delivery: ✅ (integrations)
  - Accounting: ✅ (native, since it's Siigo)
  - Users: ✅
  - Financials: ✅ (inherits full Siigo accounting engine)
  Category: **(a) all-in-one** dressed as (b) — this is the one POS play that already reaches into your full scope because it's backed by Siigo's accounting core.

- **Gestro** — Colombia-native, restaurant/bar/café-specific POS, positions on price transparency and multi-KDS.
  - Orders: ✅
  - Sales: ✅
  - Delivery: ❌ (not emphasized)
  - Accounting: ✅ (DIAN via Taxxa, included)
  - Users: ✅ (unlimited, no per-seat fee)
  - Financials: ❌
  Category: **(b) POS/retail-focused**

- **GridPOS** — Colombian POS competitor, budget-tier pricing (~$50,000 COP/mo).
  - Orders: ✅
  - Sales: ✅
  - Delivery: ❌
  - Accounting: ⚠️ (invoicing only)
  - Users: ✅
  - Financials: ❌
  Category: **(b) POS/retail-focused**

- **Vendty** — Colombian POS/restaurant tech, known for pricing flexibility, reservations, omnichannel ordering.
  - Orders: ✅
  - Sales: ✅
  - Delivery: ✅
  - Accounting: ⚠️ (invoicing-level)
  - Users: ✅
  - Financials: ❌
  Category: **(b) POS/retail-focused**

**Cluster 1 takeaway:** Restaurant/retail POS is a crowded, price-competitive Colombian niche (Fudo, Loggro, WARO, Gestro, GridPOS, Vendty, Siigo POS all compete head-on). Most are **point solutions** — strong on orders/sales/delivery, weak-to-absent on real accounting depth and financial statements. The exception is **Siigo POS**, which is dangerous precisely because it's a POS front-end wired into a full accounting back-end — i.e., already doing what you're trying to do, just entering from the restaurant-vertical side rather than the general-PYME side. Local players consistently beat Fudo on DIAN-native invoicing and offline resilience, which matters in CO's connectivity reality.

---

## Cluster 2 — Odoo and open-source/modular ERPs

- **Odoo** — Modular, Belgian-origin open-source ERP (Community free / Enterprise paid), globally used, with a dedicated Colombia fiscal localization.
  - Orders: ✅
  - Sales: ✅
  - Delivery: ✅ (via inventory/logistics apps, third-party connectors)
  - Accounting: ✅ (full double-entry, PUC chart of accounts)
  - Users: ✅ (multi-company, roles)
  - Financials: ✅ (full accounting suite)
  Category: **(a) all-in-one ERP/accounting suite** (international player with strong CO localization — also fits (f))
  Colombia notes: <cite index="11-1">Odoo integrates directly with DIAN to issue invoices, credit/debit notes and supporting documents, complying with current regulations, and can manage electronic payroll and exogenous information (información exógena) without needing external modules.</cite> <cite index="17-1">The Colombian localization installs a chart of accounts based on the Plan Único de Cuentas (PUC) and creates the necessary withholding taxes (VAT/IVA, ICA, source tax).</cite> Implementation is typically done through **local partner/implementer firms** (not Odoo directly) — e.g. GarKeM, Odoosistema, Vauxoo Colombia, Pragmatic, Odoo4projects — <cite index="20-1">who bundle managed hosting with a preconfigured DIAN module, typically $150,000–$800,000+ COP/month.</cite> A standard implementation project reportedly takes 3–4 months including training.
  **This is arguably the single most direct existing competitor to your full scope** — it already covers all six of your modules, is price-accessible (free Community core), and has an active Colombian partner ecosystem doing exactly the "digital transformation for PYMES" pitch.

- **ERPNext** — Open-source ERP (Frappe framework), free core, aimed from SMEs up to larger companies, strong in manufacturing/production planning.
  - Orders: ✅
  - Sales: ✅
  - Delivery: ✅ (inventory/stock, less delivery-specific)
  - Accounting: ✅ (full, but DIAN e-invoicing requires a third-party connector, not native)
  - Users: ✅
  - Financials: ✅
  Category: **(a) all-in-one ERP/accounting suite**
  Colombia notes: local implementer **Aliado Informático** offers ERPNext with a Colombia-specialist accountant on staff and DIAN e-invoicing bridged <cite index="33-1">via a provider that enables a web service for connection and sending of electronic invoices</cite> (i.e., not as natively built-in as Odoo's DIAN module). <cite index="39-1">ERPNext is positioned as more powerful/scalable than Dolibarr but with a steeper technical learning curve, and better suited to companies with IT resources.</cite>

- **Dolibarr** — Lightweight open-source ERP/CRM (French origin), aimed squarely at very small businesses/freelancers, simpler than Odoo/ERPNext.
  - Orders: ✅
  - Sales: ✅
  - Delivery: ⚠️ (via e-commerce connectors like WooCommerce, not native logistics)
  - Accounting: ✅ (double-entry, invoicing)
  - Users: ✅
  - Financials: ⚠️ (present but lighter-weight than Odoo/ERPNext)
  Category: **(a) all-in-one**, but aimed at the smallest end of PYME (micro-business/freelancer)
  Colombia notes: a free community-built DIAN e-invoicing module ("Factura Electrónica Colombia DIAN") exists on DoliStore; <cite index="34-1">the general verdict versus ERPNext is that for an SME with simple tax obligations, Dolibarr is sufficient, while ERPNext suits more sophisticated accounting needs.</cite> Much smaller local implementer/partner ecosystem in Colombia than Odoo.

**Cluster 2 takeaway:** This is your **most structurally similar competitor category** — these are genuinely full-stack, multi-module suites, not point solutions. Odoo in particular already checks every box you listed and has real Colombian DIAN-native traction. The open-source angle is a double-edged sword for you: it makes them cheap to start with, but implementation/configuration complexity and reliance on third-party local partners (uneven quality, DIY-feeling UX) is exactly the gap a polished, Colombia-native, PYME-specific "brain" could exploit. ERPNext and Dolibarr are real but noticeably thinner in Colombian localization depth and partner density than Odoo.

---

## Cluster 3 — Shopify and e-commerce-first platforms

- **Shopify** — Global e-commerce platform (Canada-founded), 1.7M+ active stores worldwide, extensive app ecosystem.
  - Orders: ✅
  - Sales: ✅
  - Delivery: ❌ (native shipping label tools, but no LatAm-specific last-mile logistics)
  - Accounting: ❌ (no native DIAN compliance)
  - Users: ❌ (basic staff accounts only, not full HR/team management)
  - Financials: ❌
  Category: **(f) international player entering Colombia** — pure e-commerce point solution here
  Colombia notes: <cite index="26-1">Shopify does not automatically generate Colombian electronic invoicing; if a business is registered with DIAN, it cannot rely only on Shopify's receipts and must issue electronic invoices under the Colombian technical standard.</cite> Colombian PYMES bridge this gap with connector tools like **Moship** (Shopify↔Siigo bridge) or **Alegra Click**, i.e., <cite index="26-1">Alegra is accounting software with integrated e-invoicing that can connect to Shopify via API or third-party bridge tools, and is positioned as useful for businesses that already sell on Shopify and want a simple add-on for compliance.</cite> This is the clearest evidence of the "PYMES stitch tools together" pattern your positioning is built on: Shopify (sales/orders) + Alegra/Siigo (accounting/DIAN) + a delivery app, glued together with connectors.

- **Tiendanube (Tienda Nube)** — Argentine-founded, LatAm-first e-commerce platform, the regional leader.
  - Orders: ✅
  - Sales: ✅
  - Delivery: ✅ (own logistics product "Envío Nube," regional carrier integrations)
  - Accounting: ⚠️ (local payment/e-invoicing support stronger than Shopify, but not a full accounting engine)
  - Users: ❌ (store staff roles only)
  - Financials: ❌
  Category: **(f) international/regional player** — LatAm-native e-commerce specialist
  Colombia notes: <cite index="22-1">More than 180,000 brands across Latin America use Tiendanube, with presence in Brazil, Argentina, Mexico, Colombia and Chile, making it the leading e-commerce platform in the region.</cite> <cite index="25-1">Tiendanube offers good native support for local e-invoicing needs, versus Shopify's more limited support that requires third-party apps.</cite>

- **VTEX** — Brazilian-founded, enterprise-grade e-commerce platform, revenue-based pricing, present in Colombia (two offices).
  - Orders: ✅
  - Sales: ✅
  - Delivery: ✅ (enterprise logistics/marketplace tooling)
  - Accounting: ⚠️ (enterprise-level invoicing support, not a full PYME accounting suite)
  - Users: ❌ (not a full team/HR management layer)
  - Financials: ❌
  Category: **(f) international/regional player**, skews upmarket — <cite index="24-1">VTEX is built for the digitalization of medium and large companies</cite>, so likely less relevant to your PYME-first target than Tiendanube.

- **WooCommerce** — Open-source WordPress e-commerce plugin, self-hosted, globally used including by Colombian small sellers.
  - Orders: ✅
  - Sales: ✅
  - Delivery: ⚠️ (via plugins)
  - Accounting: ❌ (needs external tools, e.g. Dolibarr/Alegra connectors)
  - Users: ❌
  - Financials: ❌
  Category: **(f) international player** — DIY/self-hosted point solution, appears frequently alongside Shopify in local "e-invoicing for e-commerce" guides.

- **Mercado Shops** — Mercado Libre's built-in store builder; **being discontinued Dec 31, 2025**, pushing its Colombian sellers to migrate to Shopify/Tiendanube — worth noting as a live market-share redistribution event you could time-target.

**Cluster 3 takeaway:** E-commerce-first platforms are consistently **pure point solutions on your scope** — strong orders/sales, weak-to-nonexistent on accounting, users/team management, and financial statements. None of them are trying to become a PYME "business brain"; they solve storefront + checkout and expect the rest of the business to be run elsewhere. This is the cluster where the "PYMES stitch together tools" pattern is most explicit and best documented (Shopify+Alegra+Moship being the literal named example in market content).

---

## Updated integration note — where these three clusters land on your scope

| Player | True full-scope threat level | Why |
|---|---|---|
| **Odoo** | 🔴 High — direct competitor | Already covers all 6 modules natively, has DIAN localization, active CO partner ecosystem selling it exactly as "digital transformation for PYMES" |
| **Siigo POS** | 🟠 Medium-high | Full accounting engine underneath a POS front-end — same end-state as you, entering from the restaurant-vertical side |
| **ERPNext** | 🟠 Medium | Full-scope open-source ERP, but thinner CO localization/partner network than Odoo |
| **Dolibarr** | 🟡 Medium-low | Full-scope in principle, but aimed at micro-business simplicity, weak native CO compliance, small partner base |
| **Fudo, Loggro, WARO, Gestro, GridPOS, Vendty** | 🟡 Low-medium individually | Point solutions (POS/orders/delivery), no real accounting depth or financial statements — but collectively they're what PYMES already trust for the "front of house" half of your product |
| **Shopify, Tiendanube, VTEX, WooCommerce** | 🟢 Low as direct competitors, 🟠 Medium as ecosystem lock-in risk | Pure point solutions on sales/orders; but a PYME already living inside Shopify+Alegra+delivery-app may see less reason to switch to a new all-in-one unless you integrate with rather than replace their storefront |

**Bottom line for prioritization:** Add **Odoo** to your top-tier direct-competitor research list from the original scan — on paper it already does everything your product does. Treat **Siigo POS**, **ERPNext**, and **Dolibarr** as secondary-tier direct competitors. Treat the POS players (Fudo and peers) and e-commerce players (Shopify and peers) as **ecosystem/integration considerations** rather than head-on competitors — the real strategic question they raise is whether your product should *replace* these tools for a PYME, or plug into them (e.g., Shopify/Tiendanube for storefront, Fudo/Loggro-style POS for in-person orders) and own only the accounting/financials/team-management layer that none of them do well.