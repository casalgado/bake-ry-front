<script setup>
import { ref, computed } from 'vue';

const lang = ref('es');

function setLang(value) {
  lang.value = value;
}

const moduleDefs = [
  { key: 'orders', label: { es: 'Pedidos', en: 'Orders' } },
  { key: 'sales', label: { es: 'Ventas', en: 'Sales' } },
  { key: 'delivery', label: { es: 'Domicilios', en: 'Delivery' } },
  { key: 'accounting', label: { es: 'Contabilidad', en: 'Accounting' } },
  { key: 'users', label: { es: 'Equipo', en: 'Team' } },
  { key: 'financials', label: { es: 'Estados financieros', en: 'Financials' } },
];

const covSymbol = { yes: '✓', partial: '~', no: '✗' };

// Shorthand: cov('y y n y y y') → coverage object in moduleDefs order
function cov(str) {
  const map = { y: 'yes', p: 'partial', n: 'no' };
  const values = str.split(' ').map((c) => map[c]);
  return Object.fromEntries(moduleDefs.map((m, i) => [m.key, values[i]]));
}

const competitorSections = [
  {
    id: 'colombia',
    title: { es: 'Jugadores nativos de Colombia', en: 'Colombia-native players' },
    intro: {
      es: 'El corazón del mercado: suites contables y administrativas construidas alrededor de la facturación electrónica DIAN.',
      en: 'The heart of the market: accounting and admin suites built around DIAN e-invoicing.',
    },
    competitors: [
      {
        name: 'Siigo',
        category: { es: 'Suite todo-en-uno', en: 'All-in-one suite' },
        coverage: cov('y y n y y y'),
        blurb: {
          es: 'La suite contable/administrativa en la nube líder de Colombia y el proveedor de facturación electrónica autorizado por la DIAN #1. Reporta más de 300.000 clientes en Colombia y más de 1,2 millones en LatAm (opera como Siigo en CO/PE/CL, Contífico en Ecuador, Memory en Uruguay y Aspel en México).',
          en: 'Colombia\'s market-leading cloud accounting/administrative suite and the #1 DIAN-authorized e-invoicing provider. Reports 300K+ clients in Colombia and 1.2M+ across LatAm (operates as Siigo in CO/PE/CL, Contífico in Ecuador, Memory in Uruguay, Aspel in Mexico).',
        },
        notes: {
          es: ['Domicilios solo vía Rappi, y únicamente en el plan POS Gastrobar para restaurantes.'],
          en: ['Delivery only via Rappi, and only in the restaurant-focused POS Gastrobar plan.'],
        },
      },
      {
        name: 'Alegra',
        category: { es: 'Suite todo-en-uno', en: 'All-in-one suite' },
        coverage: cov('y y n y y y'),
        blurb: {
          es: 'Ecosistema moderno en la nube: contabilidad, facturación electrónica, POS, inventario y nómina. El "QuickBooks en español", fundado en 2012 en Medellín. Su propio comunicado de 2020 citó más de 365.000 usuarios registrados en 25+ países; una comparación externa de 2026 cita ~150.000 usuarios entre Colombia y México.',
          en: 'Modern cloud ecosystem: accounting, e-invoicing, POS, inventory, payroll — "QuickBooks in Spanish," founded 2012 in Medellín. Its own 2020 release cited 365K+ registered users across 25+ countries; a 2026 third-party comparison cites ~150K users across Colombia and Mexico.',
        },
        notes: {
          es: ['Sin módulo de domicilios ni integración con apps de delivery en su marketplace publicado — una brecha clara.'],
          en: ['No delivery module or delivery-app integration in its published marketplace — a clear gap.'],
        },
      },
      {
        name: 'Loggro',
        category: { es: 'Suite todo-en-uno', en: 'All-in-one suite' },
        coverage: cov('y y p y y y'),
        blurb: {
          es: 'ERP en la nube para PYMES: contabilidad, inventarios, POS, factura y nómina electrónica. Su línea de restaurantes (Restobar) agrega domicilios propios nativos con DomiLoggro (0% comisión a terceros) más integración con Rappi. Reporta entre 11.000 y 15.000 empresas en Colombia según la fuente.',
          en: 'Cloud ERP for PYMES: accounting, inventory, POS, e-invoicing and e-payroll. Its restaurant line (Restobar) adds native own-delivery via DomiLoggro (0% third-party commission) plus Rappi integration. Reports between 11,000 and 15,000 Colombian businesses depending on the source.',
        },
        notes: {
          es: ['Los domicilios nativos existen solo en la línea Restobar, no en el ERP general — pero prueban que el módulo es viable y valorado.'],
          en: ['Native delivery exists only in the Restobar line, not the general ERP — but it proves the module is feasible and valued.'],
        },
      },
      {
        name: 'World Office',
        category: { es: 'Suite todo-en-uno', en: 'All-in-one suite' },
        coverage: cov('y y n y y y'),
        blurb: {
          es: 'Software contable/ERP colombiano de larga trayectoria: contabilidad, inventario, producción, nómina y activos fijos. Fuerte en empresas medianas con inventario complejo; de escritorio migrando a la nube (la versión cloud recibe críticas de usuarios por latencia).',
          en: 'Long-standing Colombian accounting/ERP: accounting, inventory, production, payroll, fixed assets. Strong for medium companies with complex inventory; desktop migrating to cloud (the cloud version draws user criticism for latency).',
        },
      },
      {
        name: 'Helisa',
        category: { es: 'Contabilidad pura', en: 'Pure accounting' },
        coverage: cov('p y n y y y'),
        blurb: {
          es: 'Software contable y de nómina colombiano con más de 35 años; fuerte entre contadores y empresas medianas. Orientado a contabilidad con rasgos de ERP.',
          en: '35+ year Colombian accounting/payroll software; strong with accountants and medium companies. Accounting-first with ERP leanings.',
        },
      },
      {
        name: 'ContaPyme',
        category: { es: 'Contabilidad / ERP ligero', en: 'Accounting / light ERP' },
        coverage: cov('p y n y y y'),
        blurb: {
          es: 'Software contable NIIF para PYMES: facturación electrónica, nómina electrónica, inventario, POS y exógena DIAN. ERP de compra única (no suscripción). Reporta más de 30.000 contadores y empresarios.',
          en: 'NIIF accounting software for PYMES: e-invoicing, e-payroll, inventory, POS, DIAN exógena. One-time-purchase ERP. Reports 30,000+ accountants and business owners.',
        },
      },
      {
        name: 'Aliaddo',
        category: { es: 'Suite todo-en-uno', en: 'All-in-one suite' },
        coverage: cov('y y n y y y'),
        blurb: {
          es: 'Suite contable y administrativa en la nube para PYMES: facturación, POS, inventario, nómina, CRM y estados financieros, a precio agresivo. Reporta más de 10.000 clientes en Colombia.',
          en: 'Cloud accounting + admin suite for PYMES: invoicing, POS, inventory, payroll, CRM, financial statements, at an aggressive price. Reports 10,000+ clients in Colombia.',
        },
      },
      {
        name: 'Siesa',
        category: { es: 'Suite ERP (enterprise)', en: 'ERP suite (enterprise-leaning)' },
        coverage: cov('y y p y y y'),
        blurb: {
          es: 'ERP colombiano con más de 44 años: Enterprise para empresas grandes y Small Business Suite para PYMES; POS, CRM, e-commerce B2B, RRHH y manufactura. Propiedad mayoritaria de Advent International desde diciembre de 2024.',
          en: '44+ year Colombian ERP; Enterprise for large firms, Small Business Suite for PYMES; POS, CRM, B2B e-commerce, HR, manufacturing. Majority-owned by Advent International since Dec 2024.',
        },
        notes: {
          es: ['Su "logística" es cadena de suministro e inventario, no última milla.'],
          en: ['Its "logistics" means supply chain and inventory, not last-mile.'],
        },
      },
      {
        name: 'Dataico',
        category: { es: 'Facturación electrónica primero', en: 'E-invoicing-first' },
        coverage: cov('y y n y p p'),
        blurb: {
          es: 'Proveedor tecnológico de facturación DIAN que se expandió a un ecosistema: inventario, cartera, compras, cotizaciones, documento soporte y contabilidad, con API para transmisión de documentos electrónicos. Reporta 8.000 PYMES y más de 450.000 documentos al mes.',
          en: 'DIAN e-invoicing tech provider that expanded into an ecosystem: inventory, receivables, purchasing, quotes, documento soporte, accounting; API for e-doc transmission. Reports 8,000 PYMES and 450,000+ docs/month.',
        },
      },
      {
        name: 'Vendty',
        category: { es: 'POS / retail', en: 'POS / retail' },
        coverage: cov('y y y p y n'),
        blurb: {
          es: 'POS colombiano para restaurantes y retail: híbrido online/offline, inventario, recetas, e-commerce — y un módulo nativo de domicilios más integración con Rappi. Conocido por su flexibilidad de precios, reservas y pedidos omnicanal.',
          en: 'Colombian POS for restaurants/retail: hybrid online/offline, inventory, recipes, e-commerce — and a native delivery (domicilios) module plus Rappi. Known for pricing flexibility, reservations, omnichannel ordering.',
        },
      },
      {
        name: 'POS de restaurante (grupo)',
        nameEn: 'Restaurant POS (group)',
        category: { es: 'POS / retail', en: 'POS / retail' },
        coverage: cov('y y p p y n'),
        blurb: {
          es: 'Loggro Restobar, Sistema POS Colombia, POS Colombia Restaurante-Bar: POS de restaurante/retail con facturación electrónica; algunos con integraciones de delivery.',
          en: 'Loggro Restobar, Sistema POS Colombia, POS Colombia Restaurante-Bar: restaurant/retail POS with e-invoicing; some with delivery integrations.',
        },
      },
      {
        name: 'Herramientas micro-PYME (grupo)',
        nameEn: 'Micro-PYME tools (group)',
        category: { es: 'Facturación / contabilidad', en: 'E-invoicing / accounting' },
        coverage: cov('p y n y p p'),
        blurb: {
          es: 'Finante, Lemp, WebSafi, Cuenti, Qenta, Gojana, Orión Plus: herramientas colombianas más pequeñas de contabilidad, facturación electrónica y administración en la nube para micro-PYMES. La cobertura de estados financieros varía.',
          en: 'Finante, Lemp, WebSafi, Cuenti, Qenta, Gojana, Orión Plus: smaller Colombian cloud accounting/e-invoicing/admin tools for micro-PYMES. Financial-statement coverage varies.',
        },
      },
    ],
  },
  {
    id: 'latam',
    title: { es: 'Jugadores regionales de LatAm', en: 'LatAm regional players' },
    intro: {
      es: 'Suites de otros países de la región que operan (o intentan operar) en Colombia.',
      en: 'Suites from elsewhere in the region operating — or trying to operate — in Colombia.',
    },
    competitors: [
      {
        name: 'Xubio',
        category: { es: 'ERP / contabilidad', en: 'ERP / accounting' },
        coverage: cov('p y n y y y'),
        blurb: {
          es: 'ERP contable en la nube de origen argentino (hoy del grupo Visma) para PYMES y contadores; facturación electrónica (DIAN/AFIP/SAT) e inventario. Más de 50.000 empresas entre Argentina, Colombia y México.',
          en: 'Argentine cloud ERP/accounting (now Visma group) for PYMES/accountants; e-invoicing (DIAN/AFIP/SAT), inventory; 50,000+ companies across AR/CO/MX.',
        },
      },
      {
        name: 'Nubox',
        category: { es: 'Contabilidad pura', en: 'Pure accounting' },
        coverage: cov('p y n y y y'),
        blurb: {
          es: 'SaaS contable/administrativo chileno (grupo SUMA/Genesis) para PYMES: reportes, balances, conciliación bancaria. Disponible en Colombia.',
          en: 'Chilean cloud SaaS accounting/admin for PYMES (SUMA/Genesis group); reports, balances, bank reconciliation. Available in Colombia.',
        },
      },
      {
        name: 'Defontana',
        category: { es: 'ERP todo-en-uno', en: 'All-in-one ERP' },
        coverage: cov('y y p y y y'),
        blurb: {
          es: 'ERP 100% web chileno para PYMES: contabilidad, inventario, POS, multi-país LatAm; presente en Colombia.',
          en: '100% web Chilean ERP for PYMES: accounting, inventory, POS, multi-country LatAm; present in Colombia.',
        },
      },
      {
        name: 'Bind ERP',
        category: { es: 'Regional (poco ajuste CO)', en: 'Regional (limited CO fit)' },
        coverage: cov('y y n y y y'),
        blurb: {
          es: 'ERP mexicano en la nube para PYMES comerciales: ventas, compras, inventario, contabilidad, facturación y producción. Localizado para México/SAT — no para Colombia/DIAN, a pesar de su marketing regional.',
          en: 'Mexican cloud ERP for commercial PYMES: sales, purchases, inventory, accounting, invoicing, production. Localized for Mexico/SAT — not for Colombia/DIAN, despite regional marketing.',
        },
      },
    ],
  },
  {
    id: 'global',
    title: { es: 'Jugadores globales', en: 'Global players' },
    intro: {
      es: 'Plataformas internacionales usadas por PYMES colombianas, casi siempre en el segmento medio-alto.',
      en: 'International platforms used by Colombian PYMES, mostly at the upper-PYME end.',
    },
    competitors: [
      {
        name: 'SAP Business One',
        category: { es: 'ERP internacional', en: 'International ERP' },
        coverage: cov('y y p y y y'),
        blurb: {
          es: 'ERP para empresas en crecimiento con localización colombiana: contabilidad, finanzas, ventas, inventario y producción. Segmento PYME-alto / enterprise.',
          en: 'ERP for growing companies with Colombian localization: accounting, finance, sales, inventory, production. Upper-PYME/enterprise segment.',
        },
      },
      {
        name: 'Microsoft Dynamics 365',
        category: { es: 'ERP internacional', en: 'International ERP' },
        coverage: cov('y y p y y y'),
        blurb: {
          es: 'ERP/CRM modular con IA; PYMES grandes y enterprise en Colombia.',
          en: 'Modular ERP/CRM with AI; larger PYMES/enterprise in Colombia.',
        },
      },
      {
        name: 'Oracle NetSuite',
        category: { es: 'ERP internacional', en: 'International ERP' },
        coverage: cov('y y p y y y'),
        blurb: {
          es: 'ERP en la nube (finanzas + pedidos + inventario + CRM + e-commerce) para empresas que superan las herramientas de mercado medio.',
          en: 'Cloud ERP (finance + orders + inventory + CRM + e-commerce) for firms outgrowing mid-market tools.',
        },
      },
      {
        name: 'Zoho (Books / One)',
        category: { es: 'Suite internacional', en: 'International suite' },
        coverage: cov('y y n y y y'),
        blurb: {
          es: 'Contabilidad más una suite de 45 aplicaciones; paquete por usuario competitivo, pero con menor profundidad nativa DIAN.',
          en: 'Accounting + 45-app suite; competitive per-user bundle; weaker native DIAN depth.',
        },
      },
      {
        name: 'Odoo',
        category: { es: 'ERP open-source', en: 'Open-source ERP' },
        coverage: cov('y y p y y y'),
        blurb: {
          es: 'ERP todo-en-uno de código abierto: contabilidad, inventario, POS, CRM y módulos nativos de entrega y rutas. Requiere un partner para la localización DIAN. El más cercano a "todo-en-uno incluyendo logística" — ver el zoom más abajo.',
          en: 'Open-source all-in-one ERP: accounting, inventory, POS, CRM, and native delivery/route modules. Needs a partner for DIAN localization. The closest thing to "all-in-one incl. logistics" — see the deep dive below.',
        },
      },
      {
        name: 'QuickBooks / Xero',
        category: { es: 'Contabilidad SMB', en: 'SMB accounting' },
        coverage: cov('p y n y y y'),
        blurb: {
          es: 'Contabilidad para pequeñas empresas; ajuste local DIAN limitado frente a Alegra o Siigo.',
          en: 'SMB accounting; limited local DIAN fit versus Alegra/Siigo.',
        },
      },
      {
        name: 'Softland',
        category: { es: 'ERP regional', en: 'Regional ERP' },
        coverage: cov('y y p y y y'),
        blurb: {
          es: 'ERP presente en 12 países de LatAm con cumplimiento tributario colombiano.',
          en: 'Regional ERP (12 LatAm countries) with Colombian tax compliance.',
        },
      },
    ],
  },
  {
    id: 'cluster-pos',
    title: { es: 'Zoom: plataformas POS de restaurante', en: 'Deep dive: restaurant POS platforms' },
    intro: {
      es: 'Un nicho colombiano concurrido y competitivo en precio. La mayoría son soluciones puntuales: fuertes en pedidos, ventas y domicilios; débiles o nulas en contabilidad real y estados financieros.',
      en: 'A crowded, price-competitive Colombian niche. Most are point solutions: strong on orders, sales and delivery; weak-to-absent on real accounting depth and financial statements.',
    },
    competitors: [
      {
        name: 'Fudo',
        category: { es: 'POS / retail', en: 'POS / retail' },
        coverage: cov('y y y n y n'),
        blurb: {
          es: 'POS en la nube para restaurantes, bares y cafés, de origen argentino (respaldado por a16z), activo en Colombia, México, Chile y Guatemala. Integraciones nativas con Rappi, Didi Food, Uber Eats y Justo, tienda online propia y menú QR.',
          en: 'Cloud POS for restaurants/bars/cafés, Argentine-founded (a16z-backed), active in Colombia, Mexico, Chile, Guatemala. Native Rappi/Didi Food/Uber Eats/Justo integrations, own online store, QR menu.',
        },
        notes: {
          es: [
            'En Colombia desde ~$62.900 COP/mes, pero solo funciona con internet — sin modo offline, un riesgo real en zonas con conectividad inestable.',
            'La facturación electrónica DIAN no viene en el plan base: es un módulo pago aparte. Con todos los módulos relevantes (mesas, apps de delivery, KDS, facturación) el costo real ronda los $245.600 COP/mes.',
          ],
          en: [
            'Active in Colombia from ~$62,900 COP/month, but works only with internet — no offline mode, a real risk in areas with unstable connectivity.',
            'DIAN e-invoicing is not in the base plan — it\'s a separate paid add-on; with all relevant modules (tables, delivery apps, KDS, invoicing) the real cost reaches roughly $245,600 COP/month.',
          ],
        },
      },
      {
        name: 'Loggro Restobar',
        category: { es: 'POS / retail', en: 'POS / retail' },
        coverage: cov('y y y y y p'),
        blurb: {
          es: 'POS de restaurante/retail nativo de Colombia con inventario y facturación DIAN; se posiciona como herramienta de gestión gastronómica todo-en-uno, en las listas locales de "mejor software para restaurantes" junto a Fudo y Siigo POS. Estados financieros limitados — no balance general completo.',
          en: 'Colombia-native restaurant/retail POS + inventory + DIAN invoicing; positions as an all-in-one gastronomic management tool, listed in local "best restaurant software" round-ups alongside Fudo and Siigo POS. Financials are limited — not a full balance sheet.',
        },
      },
      {
        name: 'WARO',
        category: { es: 'POS / retail', en: 'POS / retail' },
        coverage: cov('y y y y y n'),
        blurb: {
          es: 'POS colombiano posicionado directamente contra Fudo. A diferencia de Fudo, la facturación electrónica DIAN viene incluida en todos los planes sin módulo extra ni costo por documento, y el sistema funciona offline cuando falla la señal — crítico para restaurantes con conectividad inestable o cortes de luz. Soporte local en horario colombiano.',
          en: 'Colombian POS pitched directly against Fudo. Unlike Fudo, DIAN e-invoicing is included in all plans with no extra module or per-document cost, and the system works offline when the signal fails — critical for restaurants with unstable connectivity or power cuts. Local support in Colombian business hours.',
        },
      },
      {
        name: 'Siigo POS (Gastrobar)',
        category: { es: 'Todo-en-uno disfrazado de POS', en: 'All-in-one dressed as POS' },
        coverage: cov('y y y y y y'),
        blurb: {
          es: 'Módulo POS montado sobre la suite contable de Siigo, dirigido a restaurantes, bares y cafés. Es la única jugada POS que ya alcanza el alcance completo, porque hereda el motor contable completo de Siigo — el mismo estado final que perseguimos, entrando por el vertical de restaurantes.',
          en: 'POS module bolted onto Siigo\'s core accounting suite, aimed at restaurants/bars/cafés. The one POS play that already reaches full scope, because it inherits Siigo\'s full accounting engine — the same end-state we\'re building toward, entering from the restaurant vertical.',
        },
      },
      {
        name: 'Gestro',
        category: { es: 'POS / retail', en: 'POS / retail' },
        coverage: cov('y y n y y n'),
        blurb: {
          es: 'POS colombiano específico para restaurantes, bares y cafés; se posiciona en transparencia de precios y multi-KDS. DIAN vía Taxxa, incluido; usuarios ilimitados sin costo por puesto.',
          en: 'Colombia-native, restaurant/bar/café-specific POS; positions on price transparency and multi-KDS. DIAN via Taxxa, included; unlimited users with no per-seat fee.',
        },
      },
      {
        name: 'GridPOS',
        category: { es: 'POS / retail', en: 'POS / retail' },
        coverage: cov('y y n p y n'),
        blurb: {
          es: 'POS colombiano de gama económica (~$50.000 COP/mes); contabilidad limitada a facturación.',
          en: 'Colombian budget-tier POS (~$50,000 COP/month); accounting limited to invoicing.',
        },
      },
    ],
  },
  {
    id: 'cluster-oss',
    title: { es: 'Zoom: ERPs open-source y modulares', en: 'Deep dive: open-source & modular ERPs' },
    intro: {
      es: 'La categoría estructuralmente más parecida a lo que construimos: suites completas multi-módulo, no soluciones puntuales. Baratas para empezar, pero la complejidad de implementación y la dependencia de partners locales de calidad dispareja es exactamente la brecha que una plataforma pulida, nativa de Colombia y hecha para PYMES puede explotar.',
      en: 'The category most structurally similar to what we\'re building: genuinely full-stack, multi-module suites, not point solutions. Cheap to start with, but implementation complexity and reliance on uneven local partners is exactly the gap a polished, Colombia-native, PYME-specific platform can exploit.',
    },
    competitors: [
      {
        name: 'Odoo',
        category: { es: 'ERP open-source', en: 'Open-source ERP' },
        coverage: cov('y y y y y y'),
        blurb: {
          es: 'ERP modular de origen belga y código abierto (Community gratis / Enterprise pago), usado globalmente, con localización fiscal dedicada para Colombia: integra directamente con la DIAN para facturas, notas crédito/débito y documento soporte, y maneja nómina electrónica e información exógena sin módulos externos. La localización instala un plan de cuentas basado en el PUC y crea las retenciones necesarias (IVA, ICA, retefuente).',
          en: 'Modular, Belgian-origin open-source ERP (free Community / paid Enterprise), globally used, with a dedicated Colombia fiscal localization: integrates directly with DIAN for invoices, credit/debit notes and documento soporte, and handles electronic payroll and información exógena without external modules. The localization installs a PUC-based chart of accounts and creates the required withholdings (IVA, ICA, retefuente).',
        },
        notes: {
          es: [
            'La implementación se hace vía firmas partner locales (GarKeM, Odoosistema, Vauxoo Colombia, Pragmatic, Odoo4projects), que empaquetan hosting administrado con módulo DIAN preconfigurado, típicamente entre $150.000 y $800.000+ COP/mes. Un proyecto estándar toma 3–4 meses incluyendo capacitación.',
            'Posiblemente el competidor existente más directo a nuestro alcance completo: ya cubre los seis módulos, es accesible en precio y tiene un ecosistema activo de partners colombianos vendiendo exactamente el discurso de "transformación digital para PYMES".',
          ],
          en: [
            'Implementation is done via local partner firms (GarKeM, Odoosistema, Vauxoo Colombia, Pragmatic, Odoo4projects) bundling managed hosting with a preconfigured DIAN module, typically $150,000–$800,000+ COP/month. A standard project takes 3–4 months including training.',
            'Arguably the single most direct existing competitor to our full scope: it already covers all six modules, is price-accessible, and has an active Colombian partner ecosystem selling exactly the "digital transformation for PYMES" pitch.',
          ],
        },
      },
      {
        name: 'ERPNext',
        category: { es: 'ERP open-source', en: 'Open-source ERP' },
        coverage: cov('y y y y y y'),
        blurb: {
          es: 'ERP de código abierto (framework Frappe), núcleo gratuito, desde PYMES hasta empresas grandes; fuerte en manufactura y planeación de producción. La facturación DIAN requiere un conector de terceros — no es nativa. El implementador local Aliado Informático lo ofrece con un contador especialista en Colombia y la facturación electrónica puenteada vía web service.',
          en: 'Open-source ERP (Frappe framework), free core, from SMEs to larger companies; strong in manufacturing/production planning. DIAN e-invoicing requires a third-party connector — not native. Local implementer Aliado Informático offers it with a Colombia-specialist accountant and e-invoicing bridged via web service.',
        },
        notes: {
          es: ['Más potente y escalable que Dolibarr, pero con curva técnica más empinada; mejor para empresas con recursos de TI.'],
          en: ['More powerful/scalable than Dolibarr but with a steeper technical learning curve; better suited to companies with IT resources.'],
        },
      },
      {
        name: 'Dolibarr',
        category: { es: 'ERP open-source (micro)', en: 'Open-source ERP (micro)' },
        coverage: cov('y y p y y p'),
        blurb: {
          es: 'ERP/CRM ligero de código abierto (origen francés), dirigido a negocios muy pequeños y freelancers; más simple que Odoo o ERPNext. Existe un módulo comunitario gratuito de facturación DIAN en DoliStore. El veredicto general: para una PYME con obligaciones tributarias simples, Dolibarr alcanza; para contabilidad sofisticada, ERPNext. Ecosistema de partners en Colombia mucho más pequeño.',
          en: 'Lightweight open-source ERP/CRM (French origin), aimed at very small businesses/freelancers; simpler than Odoo/ERPNext. A free community DIAN e-invoicing module exists on DoliStore. General verdict: for an SME with simple tax obligations Dolibarr is sufficient; sophisticated accounting suits ERPNext. Much smaller Colombian partner ecosystem.',
        },
      },
    ],
  },
  {
    id: 'cluster-ecom',
    title: { es: 'Zoom: plataformas e-commerce', en: 'Deep dive: e-commerce platforms' },
    intro: {
      es: 'Soluciones puntuales puras dentro de nuestro alcance: fuertes en pedidos y ventas, casi nulas en contabilidad, gestión de equipo y estados financieros. Nadie aquí intenta ser el "cerebro" del negocio — resuelven vitrina y checkout y esperan que el resto se maneje en otra parte. Es el grupo donde el patrón de "las PYMES cosen herramientas" es más explícito.',
      en: 'Pure point solutions on our scope: strong on orders and sales, near-zero on accounting, team management and financial statements. Nobody here is trying to be the business "brain" — they solve storefront + checkout and expect the rest to run elsewhere. This is where the "PYMES stitch tools together" pattern is most explicit.',
    },
    competitors: [
      {
        name: 'Shopify',
        category: { es: 'E-commerce internacional', en: 'International e-commerce' },
        coverage: cov('y y n n n n'),
        blurb: {
          es: 'Plataforma global de e-commerce (origen canadiense), más de 1,7 millones de tiendas activas, con un enorme ecosistema de apps. No genera facturación electrónica colombiana automáticamente: un negocio registrado ante la DIAN no puede depender solo de los recibos de Shopify. Las PYMES colombianas cierran la brecha con conectores como Moship (puente Shopify↔Siigo) o Alegra Click.',
          en: 'Global e-commerce platform (Canada-founded), 1.7M+ active stores, extensive app ecosystem. Does not automatically generate Colombian e-invoicing: a DIAN-registered business can\'t rely on Shopify receipts alone. Colombian PYMES bridge the gap with connectors like Moship (Shopify↔Siigo) or Alegra Click.',
        },
        notes: {
          es: ['La evidencia más clara del patrón que sustenta nuestro posicionamiento: Shopify (ventas/pedidos) + Alegra o Siigo (contabilidad/DIAN) + una app de domicilios, pegados con conectores.'],
          en: ['The clearest evidence of the pattern our positioning is built on: Shopify (sales/orders) + Alegra/Siigo (accounting/DIAN) + a delivery app, glued together with connectors.'],
        },
      },
      {
        name: 'Tiendanube',
        category: { es: 'E-commerce regional', en: 'Regional e-commerce' },
        coverage: cov('y y y p n n'),
        blurb: {
          es: 'Plataforma de e-commerce LatAm-first de origen argentino, líder regional: más de 180.000 marcas en Brasil, Argentina, México, Colombia y Chile. Producto logístico propio ("Envío Nube") e integraciones con transportadoras regionales; mejor soporte nativo de facturación local que Shopify, pero sin un motor contable completo.',
          en: 'Argentine-founded, LatAm-first e-commerce platform and regional leader: 180,000+ brands across Brazil, Argentina, Mexico, Colombia and Chile. Own logistics product ("Envío Nube") and regional carrier integrations; better native local e-invoicing support than Shopify, but not a full accounting engine.',
        },
      },
      {
        name: 'VTEX',
        category: { es: 'E-commerce enterprise', en: 'Enterprise e-commerce' },
        coverage: cov('y y y p n n'),
        blurb: {
          es: 'Plataforma de e-commerce de origen brasileño, grado enterprise, precio basado en ingresos, con dos oficinas en Colombia. Construida para la digitalización de empresas medianas y grandes — menos relevante para el segmento PYME.',
          en: 'Brazilian-founded, enterprise-grade e-commerce platform, revenue-based pricing, two offices in Colombia. Built for digitalizing medium and large companies — less relevant to the PYME-first segment.',
        },
      },
      {
        name: 'WooCommerce',
        category: { es: 'E-commerce DIY', en: 'DIY e-commerce' },
        coverage: cov('y y p n n n'),
        blurb: {
          es: 'Plugin de e-commerce open-source para WordPress, auto-hospedado, usado por pequeños vendedores colombianos. Contabilidad y domicilios solo vía herramientas externas y plugins; aparece con frecuencia junto a Shopify en las guías locales de "facturación electrónica para e-commerce".',
          en: 'Open-source WordPress e-commerce plugin, self-hosted, used by Colombian small sellers. Accounting and delivery only via external tools/plugins; appears frequently alongside Shopify in local "e-invoicing for e-commerce" guides.',
        },
      },
      {
        name: 'Mercado Shops',
        category: { es: 'E-commerce (en retirada)', en: 'E-commerce (winding down)' },
        coverage: cov('y y n n n n'),
        blurb: {
          es: 'El constructor de tiendas de Mercado Libre — descontinuado el 31 de diciembre de 2025, empujando a sus vendedores colombianos a migrar a Shopify o Tiendanube. Un evento vivo de redistribución de mercado que se puede aprovechar en el momento justo.',
          en: 'Mercado Libre\'s built-in store builder — discontinued Dec 31, 2025, pushing its Colombian sellers to migrate to Shopify/Tiendanube. A live market-share redistribution event worth timing.',
        },
      },
    ],
  },
];

const pointSolutionGroups = {
  title: { es: 'Soluciones puntuales y adyacentes', en: 'Adjacent point solutions' },
  intro: {
    es: 'El stack "cosido" que las PYMES realmente usan hoy: cada pieza resuelve una parte, ninguna conecta el todo.',
    en: 'The stitched stack PYMES actually run today: each piece solves one part, none connects the whole.',
  },
  groups: [
    {
      label: { es: 'POS', en: 'POS-focused' },
      body: {
        es: 'Bsale (Chile — con panel nativo de despacho de última milla + POS), Loyverse, Square, Toast, Clover, Odoo POS, Fudo (restaurantes). Cubren ventas, pedidos y equipo; no contabilidad ni estados financieros.',
        en: 'Bsale (Chile — native courier/last-mile dispatch panel + POS), Loyverse, Square, Toast, Clover, Odoo POS, Fudo (restaurants). Cover sales/orders/team, not accounting or financials.',
      },
    },
    {
      label: { es: 'Pagos / datáfono / fintech', en: 'Payments / datáfono / fintech' },
      body: {
        es: 'La puerta de entrada que muchas PYMES adoptan primero. Bold: fintech de pagos con datáfono SmartPro, links de pago, sistema POS, facturación electrónica y crédito; más de 150.000 comercios activos mensuales y ~3% del volumen de pagos electrónicos de Colombia (2024); pasó de 380 a 800+ empleados en su Serie C de octubre 2024; aprobada como institución financiera en 2023. Nequi Negocios (Bancolombia + Wompi): celular como datáfono, QR, links de pago y crédito; más de 2,6 millones de usuarios gestionan la plata de sus negocios ahí (nov 2025), con 27M+ clientes Nequi al cierre de 2025. Además: Wompi, PayU, MercadoPago, Sistecrédito, Addi.',
        en: 'The on-ramp many PYMES adopt first. Bold: payments fintech with the SmartPro datáfono, payment links, POS system, e-invoicing add-on and credit; 150,000+ monthly active merchants and ~3% of Colombia\'s electronic-payment volume (2024); scaled from 380 to 800+ employees at its Oct 2024 Series C; granted financial-institution approval in 2023. Nequi Negocios (Bancolombia + Wompi): phone-as-datáfono, QR, payment links, business credit; 2.6M+ users manage their business money through it (Nov 2025), with 27M+ Nequi clients at end-2025. Plus Wompi, PayU, MercadoPago, Sistecrédito, Addi.',
      },
    },
    {
      label: { es: 'Delivery / logística', en: 'Delivery / logistics' },
      body: {
        es: 'Nuestro espacio diferenciador — todas son soluciones puntuales, no suites. Mensajeros Urbanos: plataforma B2B de última milla con más de 60.000 conductores en México y Colombia y 1,2M+ entregas al mes; adquirida por Moova (mayo 2023); sirve droguerías, restaurantes, bancos y EPS vía API. Pibox: última milla para PYMES con rastreo en tiempo real, app de flota y panel de pedidos. Además: Liftit, Picap, Rappi (Turbo/B2B), 99minutos, Chazki, Coordinadora, Servientrega, Inter Rapidísimo, TCC, Envía Colvanes, Melonn, Instaleap. Jelp Delivery: orquestación de última milla con IA. SaaS de última milla: LastMile, Beetrack/DispatchTrack, Detrack.',
        en: 'Our differentiator space — all point solutions, not suites. Mensajeros Urbanos: B2B last-mile platform, 60,000+ drivers across Mexico and Colombia, 1.2M+ deliveries per month; acquired by Moova (May 2023); serves pharmacies, restaurants, banks, EPS via API. Pibox: last-mile for SMBs with real-time tracking, fleet app, order-management panel. Plus: Liftit, Picap, Rappi (Turbo/B2B), 99minutos, Chazki, Coordinadora, Servientrega, Inter Rapidísimo, TCC, Envía Colvanes, Melonn, Instaleap. Jelp Delivery: AI last-mile orchestration. Last-mile SaaS: LastMile, Beetrack/DispatchTrack, Detrack.',
      },
    },
    {
      label: { es: 'Contabilidad pura', en: 'Pure accounting' },
      body: {
        es: 'Cuéntica, Contasimple (además de ContaPyme, Helisa y Nubox, listados arriba).',
        en: 'Cuéntica, Contasimple (plus ContaPyme, Helisa, Nubox above).',
      },
    },
    {
      label: { es: 'Facturación electrónica DIAN', en: 'DIAN e-invoicing-first' },
      body: {
        es: 'La herramienta gratuita "Facturación Gratuita" de la DIAN (76+ proveedores tecnológicos autorizados), Dataico, Finante, Lemp y decenas de proveedores tecnológicos.',
        en: 'DIAN\'s free "Facturación Gratuita" tool (76+ authorized tech providers), Dataico, Finante, Lemp, and dozens of proveedores tecnológicos.',
      },
    },
    {
      label: { es: 'Cobranza / CRM', en: 'Collections / CRM' },
      body: {
        es: 'Moonflow (cobranza); herramientas CRM empaquetadas dentro de las suites.',
        en: 'Moonflow (collections); CRM tools bundled inside the suites.',
      },
    },
  ],
};

const govPrograms = {
  title: { es: 'Programas de gobierno y banca de desarrollo', en: 'Government & development-bank programs' },
  intro: {
    es: 'Iniciativas de transformación digital para PYMES — competencia indirecta hoy, canales de distribución y subsidio potenciales mañana.',
    en: 'PYME digital-transformation initiatives — indirect competition today, potential distribution and subsidy channels tomorrow.',
  },
  items: [
    {
      name: 'MinTIC + iNNpulsa — Centros de Transformación Digital Empresarial (CTDE)',
      body: {
        es: '24 centros, inversión de ~$8.000M, diagnósticos y hojas de ruta gratuitos; ~20.000 negocios atendidos, 9.190 diagnósticos de madurez; meta de 10.000 mipymes. Aliados: Cámaras de Comercio, Fenalco, Acopi.',
        en: '24 centers, ~$8,000M investment, free diagnostics + roadmaps; ~20,000 businesses attended, 9,190 maturity diagnostics; target 10,000 mipymes. Partners: Cámaras de Comercio, Fenalco, Acopi.',
      },
    },
    {
      name: 'MinTIC — Empresario Digital / MiPyme Vive Digital / Nación Emprendedora .CO',
      body: {
        es: 'Capacitación y kits gratuitos de presencia web (50.000 kits: dominio .CO, correo, hosting).',
        en: 'Training + free web-presence kits (50,000 kits: .CO domain, email, hosting).',
      },
    },
    {
      name: 'MinTIC + iNNpulsa — Colombia PotencIA Digital / Emprendimiento Digital 2025',
      body: {
        es: '~$8.900M, mentoría y formación para 300+ startups digitales; la edición 2025 cubre el 100% del territorio nacional, con meta de ~9.000–9.450 personas formadas.',
        en: '~$8,900M, mentoring/training for 300+ digital startups; the 2025 edition covers 100% of national territory, targeting ~9,000–9,450 trained.',
      },
    },
    {
      name: 'Bancóldex',
      body: {
        es: 'Banca de desarrollo que financia la digitalización y modernización de MiPymes; plataforma de crédito digital NeoCrédito (25.000+ usuarios, 8.000 solicitudes, $10.000M+ desembolsados); una línea de crédito BID con US$123M destinados a digitalizar sistemas productivos; alianzas con las fintech Sempli y Finaktiva; meta declarada de ser un "neobanco de desarrollo" hacia 2026–2027.',
        en: 'Development bank financing MiPyme digitalization/modernization; NeoCrédito digital lending platform (25,000+ users, 8,000 requests, $10,000M+ disbursed); a BID credit line with US$123M earmarked to digitize productive systems; partners with fintechs Sempli and Finaktiva; stated goal of becoming a "development neobank" by 2026–2027.',
      },
    },
    {
      name: 'Colombia Fintech',
      body: {
        es: 'Asociación gremial; contexto de ecosistema para finanzas embebidas en herramientas PYME.',
        en: 'Industry association; ecosystem context for embedded finance in PYME tools.',
      },
    },
  ],
};

const threatTable = {
  title: { es: 'Mapa de amenaza: ¿quién cubre realmente todo el alcance?', en: 'Threat map: who actually covers the full scope?' },
  rows: [
    {
      player: 'Odoo',
      level: 'high',
      levelLabel: { es: 'Alta — competidor directo', en: 'High — direct competitor' },
      why: {
        es: 'Ya cubre los 6 módulos de forma nativa, tiene localización DIAN y un ecosistema activo de partners en Colombia vendiéndolo exactamente como "transformación digital para PYMES".',
        en: 'Already covers all 6 modules natively, has DIAN localization, and an active CO partner ecosystem selling it exactly as "digital transformation for PYMES".',
      },
    },
    {
      player: 'Siigo POS',
      level: 'med-high',
      levelLabel: { es: 'Media-alta', en: 'Medium-high' },
      why: {
        es: 'Motor contable completo debajo de un frente POS — el mismo estado final que nosotros, entrando por el vertical de restaurantes.',
        en: 'Full accounting engine underneath a POS front-end — same end-state as us, entering from the restaurant vertical.',
      },
    },
    {
      player: 'ERPNext',
      level: 'medium',
      levelLabel: { es: 'Media', en: 'Medium' },
      why: {
        es: 'ERP open-source de alcance completo, pero con localización colombiana y red de partners más delgadas que Odoo.',
        en: 'Full-scope open-source ERP, but thinner CO localization/partner network than Odoo.',
      },
    },
    {
      player: 'Dolibarr',
      level: 'med-low',
      levelLabel: { es: 'Media-baja', en: 'Medium-low' },
      why: {
        es: 'Alcance completo en principio, pero apunta a la simplicidad de micro-negocios, con cumplimiento colombiano nativo débil y base de partners pequeña.',
        en: 'Full-scope in principle, but aimed at micro-business simplicity, weak native CO compliance, small partner base.',
      },
    },
    {
      player: 'Fudo, Loggro, WARO, Gestro, GridPOS, Vendty',
      level: 'low-med',
      levelLabel: { es: 'Baja-media (individual)', en: 'Low-medium individually' },
      why: {
        es: 'Soluciones puntuales (POS/pedidos/domicilios), sin profundidad contable real ni estados financieros — pero en conjunto son lo que las PYMES ya usan y en lo que confían para la mitad "front of house" del negocio.',
        en: 'Point solutions (POS/orders/delivery), no real accounting depth or financial statements — but collectively they\'re what PYMES already trust for the "front of house" half of the business.',
      },
    },
    {
      player: 'Shopify, Tiendanube, VTEX, WooCommerce',
      level: 'low',
      levelLabel: { es: 'Baja directa / media como lock-in', en: 'Low direct / medium as ecosystem lock-in' },
      why: {
        es: 'Soluciones puntuales puras en ventas/pedidos; pero una PYME que ya vive en Shopify + Alegra + app de domicilios puede ver menos razón para cambiarse a un nuevo todo-en-uno, a menos que integremos su vitrina en lugar de reemplazarla.',
        en: 'Pure point solutions on sales/orders; but a PYME already living inside Shopify + Alegra + a delivery app may see less reason to switch to a new all-in-one unless we integrate with rather than replace their storefront.',
      },
    },
  ],
};

const recommendations = {
  title: { es: 'Dónde estamos profundizando', en: 'Where we\'re digging deeper' },
  introTop: {
    es: 'Los 9 competidores con mayor traslape real de alcance, en orden de prioridad de investigación:',
    en: 'The 9 competitors with the highest true scope overlap, in research-priority order:',
  },
  top: [
    {
      name: 'Siigo',
      why: {
        es: 'El incumbente: la mayor huella PYME y la madurez DIAN más profunda. Cubre todo excepto domicilios.',
        en: 'The incumbent: broadest PYME footprint + deepest DIAN maturity. Covers everything except delivery.',
      },
    },
    {
      name: 'Alegra',
      why: {
        es: 'UX moderna y un canal fuerte de PYMES y contadores; los domicilios son una brecha clara que podemos explotar.',
        en: 'Modern UX, strong PYME/accountant funnel; delivery is a clear gap we can exploit.',
      },
    },
    {
      name: 'Loggro',
      why: {
        es: 'El más cercano filosóficamente ("gestión integral"); ya despacha domicilios propios (DomiLoggro) en su línea de restaurantes — lo estudiamos como competidor y como prueba de que el módulo de domicilios es viable y valorado.',
        en: 'Closest philosophically ("gestión integral"); already ships native own-delivery (DomiLoggro) in its restaurant line — we study it as both a competitor and proof the delivery module is feasible and valued.',
      },
    },
    {
      name: 'World Office',
      why: {
        es: 'Dominante en empresas medianas con inventario y producción complejos; su UX anticuada es una oportunidad de desplazamiento.',
        en: 'Dominant for medium companies with complex inventory/production; dated UX = displacement opportunity.',
      },
    },
    {
      name: 'Aliaddo',
      why: {
        es: 'Todo-en-uno a precio agresivo, 10.000+ clientes; traslapa fuertemente en pedidos, ventas, contabilidad, equipo y estados financieros.',
        en: 'All-in-one at an aggressive price, 10,000+ clients; overlaps heavily on orders/sales/accounting/team/financials.',
      },
    },
    {
      name: 'Dataico',
      why: {
        es: 'Ecosistema nacido de la facturación electrónica que se expande hacia el todo-en-uno; seguimos su hoja de ruta de módulos.',
        en: 'E-invoicing-first ecosystem expanding toward all-in-one; we watch its module roadmap.',
      },
    },
    {
      name: 'Odoo (con partner de localización DIAN)',
      nameEn: 'Odoo (with a Colombian DIAN-localization partner)',
      why: {
        es: 'La única plataforma de uso amplio que genuinamente abarca contabilidad + inventario + POS + CRM + módulos de entrega y rutas; nuestro rival más creíble en "todo-en-uno incluyendo logística".',
        en: 'The only widely-used platform that genuinely spans accounting + inventory + POS + CRM + delivery/route modules; our most credible "all-in-one incl. logistics" rival.',
      },
    },
    {
      name: 'Siesa (Small Business Suite)',
      why: {
        es: 'Respaldada por Advent, con ERP profundo incluyendo cadena de suministro; amenaza hacia arriba a medida que escalamos.',
        en: 'Advent-backed, deep ERP incl. supply chain; upmarket threat as we scale.',
      },
    },
    {
      name: 'Siigo POS / ERPNext / Dolibarr',
      why: {
        es: 'Nivel secundario de competidores directos, sumados tras el análisis de POS y open-source.',
        en: 'Secondary tier of direct competitors, added after the POS and open-source deep dives.',
      },
    },
  ],
  introStages: {
    es: 'El trabajo está organizado por etapas, cada una con un umbral explícito que cambiaría el plan:',
    en: 'The work is staged, each stage with an explicit threshold that would change the plan:',
  },
  stages: [
    {
      label: { es: 'Etapa 1 (ahora)', en: 'Stage 1 (now)' },
      body: {
        es: 'Análisis a fondo del top 3 (Siigo, Alegra, Loggro): niveles de precio, empaquetado de módulos, certificación DIAN, y confirmación de la brecha de domicilios funcionalidad por funcionalidad. Umbral: si 2 o más lanzan última milla nativa en los próximos 2–3 trimestres, el diferenciador de domicilios se erosiona — se re-prioriza.',
        en: 'Deep-dive the top 3 (Siigo, Alegra, Loggro): pricing tiers, module packaging, DIAN certification, and confirming the delivery gap feature-by-feature. Threshold: if 2+ of them ship native last-mile within the next 2–3 quarters, the delivery differentiator erodes — re-prioritize.',
      },
    },
    {
      label: { es: 'Etapa 2', en: 'Stage 2' },
      body: {
        es: 'Mapear el "stack cosido" que las PYMES realmente usan (suite contable + Bold/Nequi + una transportadora). Nuestra cuña es unificar pedidos → domicilios → contabilidad en un solo cerebro. Umbral: validar que las PYMES objetivo usan 3 o más herramientas desconectadas antes de apostar la propuesta de valor central a la consolidación.',
        en: 'Map the stitched stack PYMES actually run (accounting suite + Bold/Nequi + a courier). Our wedge is unifying orders → delivery → accounting in one brain. Threshold: validate that target PYMES currently use 3+ disconnected tools before betting on consolidation as the core value prop.',
      },
    },
    {
      label: { es: 'Etapa 3', en: 'Stage 3' },
      body: {
        es: 'Acercarnos a los programas CTDE de MinTIC/iNNpulsa y a Bancóldex como canales de distribución y subsidio, no como competidores. Umbral: perseguirlos activamente si un programa ofrece cofinanciación o un listado de proveedores certificados.',
        en: 'Engage MinTIC/iNNpulsa CTDE and Bancóldex programs as distribution/subsidy channels rather than competitors. Threshold: pursue actively if a program offers co-financing or a certified-vendor listing.',
      },
    },
    {
      label: { es: 'Etapa 4', en: 'Stage 4' },
      body: {
        es: 'Monitorear a los partners de Odoo y a Siesa Small Business Suite a medida que el alcance se expande hacia arriba. La pregunta estratégica que dejan los POS y el e-commerce: ¿nuestro producto debe reemplazar esas herramientas, o integrarse con ellas (Shopify/Tiendanube como vitrina, un POS estilo Fudo/Loggro para pedidos presenciales) y ser dueño de la capa de contabilidad, finanzas y equipo que ninguna hace bien?',
        en: 'Monitor Odoo partners and Siesa Small Business Suite as scope expands upmarket. The strategic question the POS and e-commerce players raise: should our product replace those tools, or plug into them (Shopify/Tiendanube for storefront, a Fudo/Loggro-style POS for in-person orders) and own the accounting/financials/team layer none of them does well?',
      },
    },
  ],
};

const caveats = {
  title: { es: 'Advertencias sobre los datos', en: 'Caveats about the data' },
  items: [
    {
      es: 'Las marcas de cobertura de módulos son direccionales: compiladas de sitios de proveedores y portales colombianos de comparación de software (comparasoftware, programascontabilidad, guiadesoftware). El marketing de los proveedores exagera lo "integral" — verificar funcionalidad por funcionalidad.',
      en: 'Module coverage marks are directional, compiled from vendor sites and Colombian software-comparison portals (comparasoftware, programascontabilidad, guiadesoftware); vendor marketing overstates "integral" — verify feature-by-feature.',
    },
    {
      es: 'Las cifras de escala mezclan "usuarios", "usuarios registrados", "negocios activos" y "clientes", y algunas provienen de reseñas de terceros o marketing; tratarlas como indicativas, no auditadas. Los conteos regionales grandes de Alegra que circulan en línea no están verificados (su propio comunicado de 2020 citó 365K usuarios registrados; una fuente externa de 2026 cita ~150K entre CO y MX). La cifra de Siigo en Colombia es 300K+ según su propio sitio; borradores anteriores que citaban ~700K estaban sobreestimados. Loggro varía entre ~11.000 y 15.000 según la fuente.',
      en: 'Scale figures mix "users," "registered users," "active businesses," and "clients," and some come from third-party reviews or vendor marketing; treat as indicative, not audited. Alegra\'s larger regional user counts circulating online are unverified (its own 2020 release cited 365K registered users; a 2026 third-party source cites ~150K across CO+MX). Siigo\'s Colombia figure is 300K+ per its own site; earlier drafts citing ~700K were overstated. Loggro ranges ~11,000–15,000 by source.',
    },
    {
      es: '"Domicilios/logística" es el módulo menos cubierto y el que más rápido se mueve; el delivery de las líneas de restaurante (DomiLoggro, Siigo Gastrobar–Rappi) y el panel de mensajería de Bsale en Chile son las excepciones — confirmar la disponibilidad actual en Colombia directamente.',
      en: '"Delivery/logistics" is the least-covered module and the fastest-moving; restaurant-line delivery (DomiLoggro, Siigo Gastrobar–Rappi) and Bsale\'s Chilean courier panel are the exceptions — confirm current Colombian availability directly.',
    },
    {
      es: 'Bind ERP está localizado para México/SAT y no es un ajuste colombiano real hoy, a pesar de su marketing regional.',
      en: 'Bind ERP is Mexico/SAT-localized and not a true Colombian fit today despite regional marketing.',
    },
    {
      es: 'Las cifras y fechas de programas de gobierno abarcan varias administraciones (2016–2025); algunas iniciativas pueden haber cambiado de nombre o cerrado — verificar su estado actual.',
      en: 'Government-program figures/dates span multiple administrations (2016–2025); some initiatives may be renamed or wound down — verify current status.',
    },
    {
      es: 'Mensajeros Urbanos fue adquirida por Moova (2023); confirmar su marca y operación actual antes de tratarla como socio o competidor independiente.',
      en: 'Mensajeros Urbanos was acquired by Moova (2023); confirm current branding/operations before treating it as an independent partner or competitor.',
    },
  ],
};

const ui = {
  es: {
    eyebrow: 'Panorama competitivo',
    title: 'Así se ve el terreno de juego.',
    subtitle:
      'Un escaneo honesto del mercado de software de gestión todo-en-uno para PYMES en Colombia: quién existe, qué cubre cada uno, y por qué el espacio que estamos construyendo — pedidos, ventas, domicilios, contabilidad, equipo y estados financieros en un solo cerebro — sigue abierto.',
    tldrTitle: 'Lo esencial',
    tldr: [
      {
        title: 'Nadie cubre el alcance completo',
        body: 'Ningún competidor cubre limpiamente pedidos + ventas + domicilios/logística + contabilidad + equipo + estados financieros. El mercado lo dominan suites que nacen de la contabilidad y la facturación electrónica (Siigo, Alegra, Loggro, World Office, Aliaddo): excelentes en ventas, contabilidad y estados financieros, pero la última milla es un espacio en blanco — prácticamente ninguna tiene despacho nativo de domicilios.',
      },
      {
        title: 'Los rivales más peligrosos: las suites nube todo-en-uno',
        body: 'Siigo (líder del mercado: 300K+ clientes en Colombia, 1,2M+ en LatAm), Alegra (retador moderno), Loggro (15.000+ negocios en Colombia), más World Office, Aliaddo, Siesa y Dataico — porque ya empaquetan ventas, contabilidad, POS, inventario, facturación electrónica y estados financieros.',
      },
      {
        title: 'Las PYMES cosen soluciones puntuales',
        body: 'En la práctica arman su stack con piezas: una suite contable + un POS (Vendty, Bsale) + pagos/datáfono (Bold, Nequi Negocios) + una transportadora de última milla (Mensajeros Urbanos, Pibox, Rappi). Un "cerebro del negocio" compite tanto contra ese stack cosido — y contra los programas estatales de transformación digital (MinTIC/iNNpulsa, Bancóldex) — como contra cualquier suite individual.',
      },
    ],
    findingsTitle: 'Hallazgos clave',
    findings: [
      'Estructura del mercado: se divide en (a) suites ERP/contables todo-en-uno, (b) POS/retail, (c) facturación electrónica DIAN primero, (d) delivery/logística, (e) contabilidad pura, y (f) jugadores internacionales. La facturación electrónica DIAN es la cuña regulatoria que metió a la mayoría de PYMES al software en primer lugar.',
      'Nuestro diferenciador es domicilios/logística: la funcionalidad nativa de última milla y despacho no existe en las suites contables principales. Aparece solo en productos de restaurante (DomiLoggro de Loggro Restobar; el enlace con Rappi de Siigo POS Gastrobar) y en el panel de mensajería de Bsale en Chile. Cuando las suites anuncian "procesos logísticos", se refieren a inventario y bodega, no a última milla.',
      'Los estados financieros (balance general / estado de resultados) son estándar entre las suites contables: Siigo, Alegra, Loggro, Aliaddo, ContaPyme, World Office y Helisa los generan todos.',
      'Pedidos y gestión de equipo/usuarios están ampliamente cubiertos (roles multi-usuario; flujos de cotización → pedido → factura) por las suites de grado ERP (Loggro, Siigo, World Office, Siesa, Bind).',
    ],
    legendTitle: 'Cómo leer las tarjetas',
    legendBody: 'Cada competidor muestra su cobertura de los seis módulos de nuestro alcance:',
    legendCov: [
      { symbol: '✓', label: 'cubierto' },
      { symbol: '~', label: 'parcial' },
      { symbol: '✗', label: 'no cubierto' },
    ],
    threatWhy: 'Por qué',
    footnote:
      'Este documento es un análisis de trabajo, no una auditoría del mercado. Se actualiza a medida que el panorama cambia.',
  },
  en: {
    eyebrow: 'Competitive landscape',
    title: 'Here\'s the playing field.',
    subtitle:
      'An honest scan of the all-in-one business-management software market for PYMES in Colombia: who\'s out there, what each covers, and why the space we\'re building — orders, sales, delivery, accounting, team, and financial statements in one brain — is still open.',
    tldrTitle: 'The short version',
    tldr: [
      {
        title: 'No one covers the full scope',
        body: 'No single competitor cleanly covers orders + sales + delivery/logistics + accounting + team + financial statements. The market is dominated by accounting/e-invoicing-first suites (Siigo, Alegra, Loggro, World Office, Aliaddo) that nail sales, accounting and financial statements but treat last-mile logistics as a white space — virtually none has native delivery dispatch.',
      },
      {
        title: 'The most dangerous rivals: cloud all-in-one suites',
        body: 'Siigo (market leader: 300K+ Colombian clients, 1.2M+ across LatAm), Alegra (modern challenger), Loggro (15,000+ Colombian businesses), plus World Office, Aliaddo, Siesa and Dataico — because they already bundle sales, accounting, POS, inventory, e-invoicing and financial statements.',
      },
      {
        title: 'PYMES stitch together point solutions',
        body: 'In practice they build a stack from pieces: an accounting suite + a POS (Vendty, Bsale) + payments/datáfono (Bold, Nequi Negocios) + a last-mile carrier (Mensajeros Urbanos, Pibox, Rappi). A "business brain" competes as much against that stitched stack — and against government digital-transformation programs (MinTIC/iNNpulsa, Bancóldex) — as against any one suite.',
      },
    ],
    findingsTitle: 'Key findings',
    findings: [
      'Market structure: it splits into (a) all-in-one ERP/accounting suites, (b) POS/retail, (c) DIAN e-invoicing-first, (d) delivery/logistics, (e) pure accounting, and (f) international players. DIAN e-invoicing is the regulatory wedge that pulled most PYMES into software in the first place.',
      'Our differentiator is delivery/logistics: native last-mile/dispatch functionality does not exist in the mainstream accounting suites. It appears only in restaurant-focused products (Loggro Restobar\'s DomiLoggro; Siigo POS Gastrobar\'s Rappi link) and in Bsale\'s Chilean courier dispatch panel. When suites advertise "procesos logísticos," they mean inventory/warehouse, not last-mile.',
      'Financial statements (balance sheet / P&L) are table stakes among accounting-first suites — Siigo, Alegra, Loggro, Aliaddo, ContaPyme, World Office and Helisa all generate them.',
      'Orders and team/user management are widely covered (multi-user roles; quote → order → invoice flows) by the ERP-grade suites (Loggro, Siigo, World Office, Siesa, Bind).',
    ],
    legendTitle: 'How to read the cards',
    legendBody: 'Each competitor shows its coverage of the six modules in our scope:',
    legendCov: [
      { symbol: '✓', label: 'covered' },
      { symbol: '~', label: 'partial' },
      { symbol: '✗', label: 'not covered' },
    ],
    threatWhy: 'Why',
    footnote:
      'This document is a working analysis, not a market audit. It\'s updated as the landscape shifts.',
  },
};

const t = computed(() => ui[lang.value]);

const openSections = ref(new Set(['colombia']));

function toggle(id) {
  const next = new Set(openSections.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  openSections.value = next;
}

function isOpen(id) {
  return openSections.value.has(id);
}

function displayName(item) {
  return lang.value === 'en' && item.nameEn ? item.nameEn : item.name;
}
</script>

<template>
  <div class="landscape">
    <header class="landscape-hero">
      <div class="hero-top">
        <p class="eyebrow">{{ t.eyebrow }}</p>
        <div class="lang-toggle" role="group" aria-label="Language / Idioma">
          <button
            type="button"
            class="lang-btn"
            :class="{ 'is-active': lang === 'es' }"
            @click="setLang('es')"
          >
            ES
          </button>
          <button
            type="button"
            class="lang-btn"
            :class="{ 'is-active': lang === 'en' }"
            @click="setLang('en')"
          >
            EN
          </button>
        </div>
      </div>

      <h1>{{ t.title }}</h1>
      <p class="hero-sub">{{ t.subtitle }}</p>
    </header>

    <section class="tldr">
      <h2>{{ t.tldrTitle }}</h2>
      <div class="tldr-grid">
        <div v-for="card in t.tldr" :key="card.title" class="tldr-card">
          <h3>{{ card.title }}</h3>
          <p>{{ card.body }}</p>
        </div>
      </div>
    </section>

    <section class="findings">
      <h2>{{ t.findingsTitle }}</h2>
      <ul>
        <li v-for="(item, i) in t.findings" :key="i">{{ item }}</li>
      </ul>
    </section>

    <section class="legend">
      <h2>{{ t.legendTitle }}</h2>
      <p>{{ t.legendBody }}</p>
      <div class="legend-modules">
        <span v-for="m in moduleDefs" :key="m.key" class="module-chip">{{ m.label[lang] }}</span>
      </div>
      <div class="legend-cov">
        <span v-for="c in t.legendCov" :key="c.symbol" class="legend-cov-item">
          <span class="cov-badge" :class="c.symbol === '✓' ? 'cov-yes' : c.symbol === '~' ? 'cov-partial' : 'cov-no'">{{ c.symbol }}</span>
          {{ c.label }}
        </span>
      </div>
    </section>

    <main class="landscape-body">
      <article v-for="section in competitorSections" :key="section.id" class="section-card">
        <button class="section-header" type="button" @click="toggle(section.id)">
          <h3>{{ section.title[lang] }}</h3>
          <span class="section-toggle" :class="{ 'is-open': isOpen(section.id) }" aria-hidden="true">+</span>
        </button>
        <p class="section-intro">{{ section.intro[lang] }}</p>

        <div v-show="isOpen(section.id)" class="section-detail">
          <div v-for="comp in section.competitors" :key="comp.name" class="competitor">
            <div class="competitor-head">
              <h4>{{ displayName(comp) }}</h4>
              <span class="category-tag">{{ comp.category[lang] }}</span>
            </div>
            <p class="competitor-blurb">{{ comp.blurb[lang] }}</p>
            <div class="coverage-row">
              <span
                v-for="m in moduleDefs"
                :key="m.key"
                class="coverage-chip"
                :class="`cov-${comp.coverage[m.key]}`"
              >
                <span class="cov-symbol">{{ covSymbol[comp.coverage[m.key]] }}</span>
                {{ m.label[lang] }}
              </span>
            </div>
            <ul v-if="comp.notes" class="competitor-notes">
              <li v-for="(note, i) in comp.notes[lang]" :key="i">{{ note }}</li>
            </ul>
          </div>
        </div>
      </article>

      <article class="section-card">
        <button class="section-header" type="button" @click="toggle('point-solutions')">
          <h3>{{ pointSolutionGroups.title[lang] }}</h3>
          <span class="section-toggle" :class="{ 'is-open': isOpen('point-solutions') }" aria-hidden="true">+</span>
        </button>
        <p class="section-intro">{{ pointSolutionGroups.intro[lang] }}</p>

        <div v-show="isOpen('point-solutions')" class="section-detail">
          <div v-for="group in pointSolutionGroups.groups" :key="group.label.en" class="group-block">
            <h4>{{ group.label[lang] }}</h4>
            <p>{{ group.body[lang] }}</p>
          </div>
        </div>
      </article>

      <article class="section-card">
        <button class="section-header" type="button" @click="toggle('gov')">
          <h3>{{ govPrograms.title[lang] }}</h3>
          <span class="section-toggle" :class="{ 'is-open': isOpen('gov') }" aria-hidden="true">+</span>
        </button>
        <p class="section-intro">{{ govPrograms.intro[lang] }}</p>

        <div v-show="isOpen('gov')" class="section-detail">
          <div v-for="item in govPrograms.items" :key="item.name" class="group-block">
            <h4>{{ item.name }}</h4>
            <p>{{ item.body[lang] }}</p>
          </div>
        </div>
      </article>

      <article class="section-card threat-card">
        <h3 class="static-title">{{ threatTable.title[lang] }}</h3>
        <div class="threat-list">
          <div v-for="row in threatTable.rows" :key="row.player" class="threat-row">
            <div class="threat-head">
              <span class="threat-player">{{ row.player }}</span>
              <span class="threat-level" :class="`level-${row.level}`">{{ row.levelLabel[lang] }}</span>
            </div>
            <p class="threat-why">{{ row.why[lang] }}</p>
          </div>
        </div>
      </article>

      <article class="section-card">
        <h3 class="static-title">{{ recommendations.title[lang] }}</h3>
        <p class="section-intro">{{ recommendations.introTop[lang] }}</p>
        <ol class="top-list">
          <li v-for="item in recommendations.top" :key="item.name">
            <span class="top-name">{{ displayName(item) }}</span>
            <span class="top-why">{{ item.why[lang] }}</span>
          </li>
        </ol>
        <p class="section-intro stages-intro">{{ recommendations.introStages[lang] }}</p>
        <div class="stages">
          <div v-for="stage in recommendations.stages" :key="stage.label.en" class="stage">
            <h4>{{ stage.label[lang] }}</h4>
            <p>{{ stage.body[lang] }}</p>
          </div>
        </div>
      </article>

      <article class="section-card caveats-card">
        <h3 class="static-title">{{ caveats.title[lang] }}</h3>
        <ul class="caveats-list">
          <li v-for="(item, i) in caveats.items" :key="i">{{ item[lang] }}</li>
        </ul>
      </article>

      <p class="footnote">{{ t.footnote }}</p>
    </main>
  </div>
</template>

<style scoped>
.landscape {
  --serif: 'Fraunces', Georgia, serif;
  --sans: 'Inter', sans-serif;
  max-width: 960px;
  margin: 0 auto;
  padding: 48px 24px 96px;
  font-family: var(--sans);
  color: #423628;
}

.landscape-hero {
  margin-bottom: 48px;
}

.hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.eyebrow {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #b86d1f;
  margin: 0;
}

.lang-toggle {
  display: flex;
  border: 1px solid #e6dfd8;
  border-radius: 999px;
  padding: 3px;
  background: #faf8f5;
  flex-shrink: 0;
}

.lang-btn {
  border: none;
  background: none;
  padding: 5px 14px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #a18e77;
  border-radius: 999px;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.lang-btn.is-active {
  background: #d9842a;
  color: #fff;
}

.landscape-hero h1 {
  font-family: var(--serif);
  font-weight: 600;
  font-size: 48px;
  line-height: 1.08;
  letter-spacing: -0.01em;
  color: #2a231a;
  margin: 0 0 20px;
}

.hero-sub {
  font-size: 17px;
  line-height: 1.65;
  color: #5a4a37;
  max-width: 66ch;
  margin: 0;
}

.tldr h2,
.findings h2,
.legend h2 {
  font-family: var(--serif);
  font-weight: 600;
  font-size: 24px;
  color: #2a231a;
  margin: 0 0 16px;
}

.tldr {
  margin-bottom: 40px;
}

.tldr-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.tldr-card {
  border: 1px solid #f3e0b8;
  background: #fdf6ea;
  border-radius: 14px;
  padding: 20px;
}

.tldr-card h3 {
  font-size: 15px;
  font-weight: 600;
  color: #744210;
  margin: 0 0 8px;
}

.tldr-card p {
  font-size: 13.5px;
  line-height: 1.6;
  color: #5c4318;
  margin: 0;
}

.findings {
  margin-bottom: 40px;
}

.findings ul {
  margin: 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.findings li {
  font-size: 14.5px;
  line-height: 1.6;
  color: #5a4a37;
}

.legend {
  margin-bottom: 40px;
  border: 1px solid #e6dfd8;
  background: #faf8f5;
  border-radius: 14px;
  padding: 20px 24px;
}

.legend p {
  font-size: 14px;
  color: #5a4a37;
  margin: 0 0 12px;
}

.legend-modules {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.module-chip {
  font-size: 12px;
  font-weight: 600;
  color: #8b7355;
  background: #fff;
  border: 1px solid #e6dfd8;
  border-radius: 999px;
  padding: 4px 12px;
}

.legend-cov {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.legend-cov-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #66553f;
}

.cov-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
}

.landscape-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-card {
  border: 1px solid #e6dfd8;
  border-radius: 14px;
  background: #fff;
  padding: 24px 28px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  text-align: left;
}

.section-header h3,
.static-title {
  font-family: var(--serif);
  font-weight: 600;
  font-size: 21px;
  color: #744210;
  margin: 0;
}

.static-title {
  margin-bottom: 12px;
}

.section-toggle {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  line-height: 1;
  color: #d9842a;
  background: #fff1e4;
  transition: transform 0.2s ease;
}

.section-toggle.is-open {
  transform: rotate(45deg);
}

.section-intro {
  font-size: 14.5px;
  line-height: 1.6;
  color: #5a4a37;
  margin: 12px 0 0;
}

.section-detail {
  margin-top: 20px;
  padding-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.competitor {
  border-top: 1px dashed #e6dfd8;
  padding-top: 20px;
}

.competitor-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 8px;
}

.competitor-head h4 {
  font-size: 16px;
  font-weight: 600;
  color: #2a231a;
  margin: 0;
}

.category-tag {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #a18e77;
  background: #faf8f5;
  border: 1px solid #e6dfd8;
  border-radius: 999px;
  padding: 3px 10px;
}

.competitor-blurb {
  font-size: 14px;
  line-height: 1.6;
  color: #66553f;
  margin: 0 0 12px;
}

.coverage-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.coverage-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 999px;
  padding: 4px 10px;
  border: 1px solid transparent;
}

.cov-symbol {
  font-weight: 700;
  font-size: 11px;
}

.cov-yes {
  background: #f0faf6;
  border-color: #cdeee0;
  color: #0d7a51;
}

.cov-partial {
  background: #fdf6ea;
  border-color: #f3e0b8;
  color: #a8730f;
}

.cov-no {
  background: #faf8f5;
  border-color: #e6dfd8;
  color: #b0a191;
}

.competitor-notes {
  margin: 12px 0 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.competitor-notes li {
  font-size: 13px;
  line-height: 1.55;
  color: #7e684d;
}

.group-block {
  border-top: 1px dashed #e6dfd8;
  padding-top: 16px;
}

.group-block h4 {
  font-size: 14px;
  font-weight: 600;
  color: #2a231a;
  margin: 0 0 6px;
}

.group-block p {
  font-size: 13.5px;
  line-height: 1.6;
  color: #66553f;
  margin: 0;
}

.threat-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 8px;
}

.threat-row {
  border-top: 1px dashed #e6dfd8;
  padding-top: 14px;
}

.threat-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 6px;
}

.threat-player {
  font-size: 14.5px;
  font-weight: 600;
  color: #2a231a;
}

.threat-level {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  border-radius: 999px;
  padding: 3px 10px;
}

.level-high {
  background: #fdeaea;
  color: #b3261e;
}

.level-med-high {
  background: #fdf0e4;
  color: #b45309;
}

.level-medium {
  background: #fdf0e4;
  color: #c07a1f;
}

.level-med-low,
.level-low-med {
  background: #fdf6ea;
  color: #a8730f;
}

.level-low {
  background: #f0faf6;
  color: #0d7a51;
}

.threat-why {
  font-size: 13.5px;
  line-height: 1.6;
  color: #66553f;
  margin: 0;
}

.top-list {
  list-style: none;
  counter-reset: top;
  margin: 20px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.top-list li {
  counter-increment: top;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-left: 32px;
  position: relative;
}

.top-list li::before {
  content: counter(top);
  position: absolute;
  left: 0;
  top: 1px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #faf8f5;
  border: 1px solid #d4c8bc;
  font-size: 11px;
  font-weight: 600;
  color: #8b7355;
  display: flex;
  align-items: center;
  justify-content: center;
}

.top-name {
  font-weight: 600;
  font-size: 14.5px;
  color: #423628;
}

.top-why {
  font-size: 13.5px;
  line-height: 1.55;
  color: #66553f;
}

.stages-intro {
  margin-top: 28px;
}

.stages {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 16px;
}

.stage {
  background: #faf8f5;
  border: 1px solid #e6dfd8;
  border-radius: 10px;
  padding: 14px 18px;
}

.stage h4 {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #a18e77;
  margin: 0 0 6px;
}

.stage p {
  font-size: 13.5px;
  line-height: 1.6;
  color: #5a4a37;
  margin: 0;
}

.caveats-card {
  background: #faf8f5;
}

.caveats-list {
  margin: 8px 0 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.caveats-list li {
  font-size: 13px;
  line-height: 1.6;
  color: #7e684d;
}

.footnote {
  font-size: 13px;
  font-style: italic;
  color: #a18e77;
  text-align: center;
  margin: 16px 0 0;
}

@media (max-width: 720px) {
  .tldr-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .landscape {
    padding: 32px 16px 64px;
  }

  .landscape-hero h1 {
    font-size: 34px;
  }

  .section-card {
    padding: 18px 18px;
  }
}
</style>
