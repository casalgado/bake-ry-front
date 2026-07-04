<script setup>
import { ref, computed } from 'vue';

const lang = ref('es');

function setLang(value) {
  lang.value = value;
}

const content = {
  es: {
    eyebrow: 'Hoja de ruta del producto',
    title: 'Esto es lo que estamos horneando.',
    subtitle:
      'Un registro real de lo que estamos construyendo para negocios — panaderías y, a medida que crecemos, otros tipos de negocios también. Esta página refleja en qué punto está realmente cada iniciativa, incluyendo las preguntas abiertas que aún no hemos resuelto.',
    ui: {
      sequenced: 'Cómo está secuenciado',
      resolved: 'Decisiones resueltas',
      open: 'Preguntas abiertas',
    },
    epics: [
      {
        name: 'Inventario',
        description:
              'Un sistema de inventario unificado que soporta operaciones tanto de tipo restaurante (basadas en recetas) como de tipo tienda (comprar/vender), ya que un negocio puede necesitar una, otra, o ambas según cómo vende.',
        subPhases: [
          {
            title: 'Recetas y modelo de stock',
            description:
                  'Los productos pueden tener opcionalmente una receta (una lista de componentes y cantidades). Los componentes de una receta pueden ser ingredientes u otros productos, lo que permite paquetes pre-armados. El stock se registra como un libro de movimientos: el stock actual es igual a la última línea base de conteo más cada movimiento de stock registrado desde entonces. Los combos no tienen stock propio — su disponibilidad se calcula a partir de sus productos componentes.',
          },
          {
            title: 'Deducción automática de stock en la venta',
            description:
                  'Cuando se completa un pedido, el stock se descuenta automáticamente: a nivel de ingrediente si el producto tiene receta, o a nivel de producto si no la tiene.',
          },
          {
            title: '"Hacer inventario" (conteo de stock)',
            description:
                  'Un flujo de captura de datos rápido y simple para contar los ingredientes y productos actuales. Marcar un conteo como completo establece la nueva línea base sobre la que se descontarán las ventas futuras.',
          },
          {
            title: '"Compras"',
            description:
                  'Un flujo para agregar productos o ingredientes comprados al stock — reabastecimiento fuera de un conteo formal.',
          },
        ],
        resolvedDecisions: [
          'Correcciones de stock — las deducciones son entradas inmutables en el libro de movimientos. Las ediciones a un pedido ya completado generan movimientos compensatorios (deltas); los movimientos originales nunca se reescriben. Un conteo de stock absorbe todos los movimientos anteriores, así que solo los movimientos registrados después de un conteo aplican contra la nueva línea base.',
          'Unidades — cada ingrediente tiene una única unidad base, usada de forma consistente en recetas, stock y conteos. Las presentaciones de compra (por ejemplo, "bulto = 25.000 g") son multiplicadores que se aplican al momento de la captura en el flujo de Compras, no conversiones a nivel de modelo. Las conversiones entre dimensiones distintas (tazas a gramos, y similares) quedan intencionalmente fuera de alcance.',
          'Combos — no tienen una entidad de stock propia; su disponibilidad se calcula puramente a partir de sus componentes. Los paquetes pre-armados se modelan como un producto cuya receta contiene otros productos.',
        ],
        openQuestions: [],
      },
      {
        name: 'Contabilidad',
        description:
              'Se construye sobre el reporte de utilidad bruta existente (estado de resultados por pedido), que se dejó deliberadamente acotado porque los gastos operativos aún no se registraban. El objetivo es convertirlo en un estado de resultados completo, y más adelante agregar los estados que requieren seguimiento de activos y pasivos.',
        subPhases: [
          {
            title: 'Costos fijos',
            description:
                  'Costos recurrentes — arriendo, salarios, servicios públicos — que se registran y actualizan mensualmente. La prioridad aquí es la velocidad de captura: plantillas recurrentes que se auto-completan cada mes y solo necesitan confirmarse o ajustarse, no volver a escribirse desde cero.',
          },
          {
            title: 'Ingresos variables y otros ingresos',
            description:
                  'Otras fuentes de ingreso no relacionadas con ventas, agregadas manualmente. El costo de ventas sigue viniendo del costo de producto y receta, conectando directamente con el trabajo de Inventario mencionado arriba.',
          },
          {
            title: 'Estado de resultados completo (P&L)',
            description:
                  'Extiende el reporte de utilidad bruta existente hacia la utilidad neta: ingresos (ventas más otros) menos costo de ventas menos costos fijos y operativos.',
          },
          {
            title: 'Balance general y otros estados',
            description:
                  'Una fase separada y más grande. Requiere seguimiento de activos, pasivos y patrimonio que aún no existe — saldos de caja y bancos, cuentas por cobrar, cuentas por pagar, activos fijos y depreciación, y patrimonio/utilidades retenidas. El estado de flujo de caja también pertenece aquí.',
          },
          {
            title: 'Facturación electrónica en Colombia (DIAN)',
            description: 'Explícitamente más adelante: imprimir y emitir facturas electrónicas para los clientes.',
          },
        ],
        resolvedDecisions: [
          'Categorías, no un plan de cuentas completo — listas de categorías planas y administradas por tipo (gasto / ingreso), con valores por defecto por negocio y categorías personalizadas agregadas por el administrador. Cada entrada referencia una categoría por id, nunca texto libre, para que los reportes se sumen de forma consistente. Una estructura de cuentas completa queda diferida a la fase de balance general.',
        ],
        openQuestions: [
          'Cierre de periodo — nos inclinamos por un "snapshot" al cerrar: cerrar un mes guarda ese estado de resultados como un documento congelado, y ediciones posteriores a los datos subyacentes marcan una diferencia en vez de cambiar silenciosamente un número en el que alguien ya confió.',
          'Impuestos en Colombia — el IVA de ventas ya se registra en productos y pedidos; el faltante es el lado de compras y gastos (IVA descontable, retención en la fuente). El plan es capturar esos campos en los nuevos formularios de gastos/compras desde el primer día, ya que el reporte puede esperar, pero los datos subyacentes no se pueden reconstruir retroactivamente.',
        ],
        note:
              'Énfasis transversal, que también aplica a Inventario: la captura de datos es el verdadero riesgo del producto aquí, no los reportes. Los reportes son baratos una vez que los datos existen — estos esfuerzos solo tienen éxito si registrar costos, compras y conteos es rápido y de baja fricción. Cada flujo de captura se diseña primero como un problema de experiencia de usuario.',
      },
      {
        name: 'Bot de ventas por WhatsApp con IA',
        description:
              'Un proyecto separado con su propio despliegue, que actúa como puente entre el cliente, WhatsApp, una capa conversacional de IA y la pasarela de pagos: conversa con el cliente, responde preguntas, completa la venta, envía un link de pago, confirma el pago, crea el pedido en el backend, y luego envía actualizaciones del estado del pedido.',
        subPhases: [
          {
            title: 'Puente con WhatsApp',
            description:
                  'Integración con la API de WhatsApp Business para recibir y enviar mensajes, con configuración de webhooks. Incluye iniciar la verificación del negocio y la aprobación de plantillas de mensaje desde temprano, ya que ambos procesos tienen tiempos de espera externos.',
          },
          {
            title: 'Capa conversacional',
            description:
                  'Responde preguntas de producto y precio, con respaldo de consultas reales al backend — catálogo, precios, stock — en lugar de improvisar respuestas.',
          },
          {
            title: 'Cierre de venta + link de pago',
            description: 'El bot completa el borrador del pedido y envía un link de pago.',
          },
          {
            title: 'Confirmación de pago (impulsada por webhook)',
            description:
                  'Un pedido solo se crea o se marca como pagado a partir de un webhook verificado de la pasarela de pagos — nunca a partir de que el cliente afirme haber pagado — y el flujo es idempotente para manejar entregas tardías o duplicadas del webhook.',
          },
          {
            title: 'Creación del pedido en el backend',
            description:
                  'Requiere un mecanismo de autenticación a nivel de servicio entre el proyecto del bot y el backend, distinto a un inicio de sesión de usuario normal.',
          },
          {
            title: 'Traspaso a un humano',
            description:
                  'Una salida de emergencia para cuando el bot no puede resolver una solicitud: la traspasa a una persona, con suficiente contexto de la conversación para que el cliente no tenga que repetirse.',
          },
          {
            title: 'Notificaciones de estado del pedido',
            description: 'Mantiene al cliente informado sobre las actualizaciones del pedido después de creado.',
          },
        ],
        resolvedDecisions: [
          'Bot multi-negocio — un único despliegue atiende a todos los negocios, cada uno con su propio número de WhatsApp. Los webhooks entrantes se enrutan según el número que los recibe, mapeado al negocio correspondiente, y el bot se autentica contra el backend con una única credencial de servicio más un mapeo almacenado de a qué negocios puede representar.',
          'Propiedad de la cuenta de WhatsApp — los números de los clientes se mantienen bajo un portafolio de Proveedor Tecnológico (Tech Provider), de modo que dar de alta un nuevo negocio no repite un proceso completo de verificación cada vez. El código del bot es idéntico en cualquier caso; esta decisión afecta la velocidad de puesta en marcha, no cómo se construye.',
          'Estado de la conversación — cada par negocio/cliente tiene un registro de sesión: historial reciente de mensajes, el borrador de pedido actual, y un estado general (explorando, armando pedido, esperando pago, traspasado a humano). Incorporado desde el primer día: manejo seguro de mensajes duplicados, manejo adecuado de ráfagas de mensajes rápidos, un tiempo de expiración de sesión separado del flujo de pago (un link de pago se resuelve correctamente incluso si la sesión de conversación ya expiró), y el traspaso a humano modelado simplemente como otro estado, para que una persona pueda retomar el mismo contexto.',
        ],
        openQuestions: [
          'Evaluar las herramientas de agente de IA nativas de WhatsApp anunciadas recientemente antes de seguir invirtiendo en una capa conversacional totalmente propia — para entender si compiten, complementan, o se pueden ignorar con seguridad, dado que se necesitan respuestas respaldadas por el backend, flujo de pago y creación de pedidos específicos de este sistema.',
        ],
      },
    ],
  },
  en: {
    eyebrow: 'Product roadmap',
    title: 'What we\'re baking next.',
    subtitle:
      'A working record of what we\'re building for businesses — bakeries, and, as we grow, other kinds of businesses too. This page reflects where each piece of work actually stands, including the open questions we haven\'t nailed down yet.',
    ui: {
      sequenced: 'How it\'s sequenced',
      resolved: 'Resolved decisions',
      open: 'Open questions',
    },
    epics: [
      {
        name: 'Inventory',
        description:
              'A unified inventory system supporting both restaurant-style (recipe-based) and store-style (buy/sell) operations, since a business may need either or both depending on how it sells.',
        subPhases: [
          {
            title: 'Recipes & stock model',
            description:
                  'Products can optionally have a recipe (a list of components and quantities). Recipe components can be ingredients or other products, which enables pre-assembled bundles. Stock is tracked as a movement ledger: current stock equals the last count baseline plus every stock movement recorded since. Combos carry no stock of their own — availability is computed from their component products.',
          },
          {
            title: 'Automatic stock deduction on sale',
            description:
                  'When an order is completed, stock is subtracted automatically: at the ingredient level if the product has a recipe, or at the product level otherwise.',
          },
          {
            title: '"Hacer inventario" (stock count)',
            description:
                  'A fast, simple data-entry flow for counting current ingredients and products. Marking a count complete sets the new baseline that future sales subtract from.',
          },
          {
            title: '"Compras" (purchasing)',
            description:
                  'A flow for adding purchased products or ingredients into stock — restocking outside of a formal count.',
          },
        ],
        resolvedDecisions: [
          'Stock corrections — deductions are immutable ledger entries. Edits to a completed order write compensating movements (deltas); the originals are never rewritten. A stock count absorbs every prior movement, so only movements recorded after a count apply against the new baseline.',
          'Units — each ingredient has one base unit, used consistently across recipes, stock, and counts. Purchase presentations (for example, "bulto = 25,000 g") are entry-time multipliers in the Compras flow, not model-level conversions. Cross-dimension conversions (cups to grams, and the like) are intentionally out of scope.',
          'Combos — no dedicated stock entity; availability is purely computed from components. Pre-assembled bundles are modeled as a product whose recipe contains other products.',
        ],
        openQuestions: [],
      },
      {
        name: 'Accounting',
        description:
              'Builds on the existing gross-profit report (income statement by order), which was deliberately scoped down because operating expenses weren’t tracked yet. The goal is to grow it into a full income statement, then later add the statements that require asset and liability tracking.',
        subPhases: [
          {
            title: 'Fixed costs',
            description:
                  'Recurring costs — rent, salaries, utilities — entered and updated monthly. Entry speed is the priority here: recurring templates auto-populate each month and only need confirming or adjusting, not re-typing from scratch.',
          },
          {
            title: 'Variable & other revenue',
            description:
                  'Non-sales revenue streams added manually. Cost of sales continues to come from product and recipe cost, tying directly into the Inventory work above.',
          },
          {
            title: 'Full income statement (P&L)',
            description:
                  'Extends the existing gross-profit report to net profit: revenue (sales plus other) minus cost of goods sold minus fixed and operating costs.',
          },
          {
            title: 'Balance sheet & other statements',
            description:
                  'A separate, larger phase. Requires asset, liability, and equity tracking not yet built — cash and bank balances, accounts receivable, accounts payable, fixed assets and depreciation, and equity/retained earnings. The cash flow statement belongs here too.',
          },
          {
            title: 'Colombia facturación electrónica (DIAN)',
            description: 'Explicitly later: printing and issuing electronic invoices for customers.',
          },
        ],
        resolvedDecisions: [
          'Categories, not a full chart of accounts — flat, managed category lists per type (expense / revenue), with sensible defaults per business plus admin-added custom ones. Every entry references a category by id, never free text, so reports roll up consistently. A full account structure is deferred to the balance-sheet phase.',
        ],
        openQuestions: [
          'Period closing — leaning toward snapshot-on-close: closing a month stores that statement as a frozen document, and later edits to underlying data flag drift instead of silently changing a number someone already relied on.',
          'Colombia tax — sales IVA is already tracked on products and orders; the gap is the purchases and expenses side (IVA descontable, retención en la fuente). Plan is to capture those fields in the new expense/purchase entry forms from day one, since reporting can come later but the underlying data can’t be reconstructed retroactively.',
        ],
        note:
              'Cross-cutting emphasis, and it applies to Inventory too: data entry is the real product risk here, not the reports. Reports are cheap once the data exists — these efforts only succeed if recording costs, purchases, and counts is fast and low-friction. Every entry flow is designed as a UX problem first.',
      },
      {
        name: 'WhatsApp AI sales bot',
        description:
              'A separate project with its own deployment, acting as a bridge between the client, WhatsApp, an AI conversational layer, and the payment processor: it talks to the client, answers questions, completes the sale, sends a payment link, confirms payment, creates the order in the backend, then sends order status updates.',
        subPhases: [
          {
            title: 'WhatsApp bridge',
            description:
                  'WhatsApp Business API integration to receive and send messages, with webhook setup. Includes starting business verification and message-template approval early, since both carry external lead time.',
          },
          {
            title: 'Conversational layer',
            description:
                  'Answers product and pricing questions, grounded via real backend lookups — catalog, prices, stock — rather than freelancing answers.',
          },
          {
            title: 'Sale completion + payment link',
            description: 'The bot completes the order draft and sends a payment link.',
          },
          {
            title: 'Payment confirmation (webhook-driven)',
            description:
                  'An order is only created or marked paid off a verified payment-processor webhook — never off the client’s own claim of having paid — and the flow is idempotent to handle late or duplicate webhook delivery.',
          },
          {
            title: 'Order creation in the backend',
            description:
                  'Requires a service-level auth mechanism between the bot project and the backend, distinct from a normal user login.',
          },
          {
            title: 'Human handoff',
            description:
                  'An escape hatch for when the bot can’t resolve a request: hands off to a person, with enough conversation context passed along that the client doesn’t have to repeat themselves.',
          },
          {
            title: 'Order status notifications',
            description: 'Keeps the client informed of order updates after creation.',
          },
        ],
        resolvedDecisions: [
          'Multi-tenant bot — a single deployment serves every business, with one WhatsApp number each. Incoming webhooks route by the receiving number, mapped to the right business, and the bot authenticates to the backend with one service credential plus a stored mapping of which businesses it may act for.',
          'WhatsApp account ownership — client numbers are held under a Tech Provider portfolio, so onboarding a new business doesn’t repeat a full verification process each time. The bot’s code is identical either way; this decision affects rollout speed, not how it’s built.',
          'Conversation state — each business/customer pair gets a session record: recent message history, the current order draft, and a coarse state (browsing, collecting order, awaiting payment, handed off). Built in from day one: safe handling of duplicate message delivery, graceful handling of rapid-fire messages, a session timeout kept separate from the payment flow (a payment link still resolves correctly even if the conversation session has since expired), and handoff as simply another state so a human can pick up the same context.',
        ],
        openQuestions: [
          'Evaluating recently announced WhatsApp-native AI agent tooling before committing further to a fully custom conversational layer — to understand whether it competes, complements, or is safely ignored given the need for backend-grounded answers, payment flow, and order creation specific to this system.',
        ],
      },
    ],
  },
};

const active = computed(() => content[lang.value]);

const openEpics = ref(new Set(['Inventario', 'Inventory']));

function toggle(name) {
  const next = new Set(openEpics.value);
  if (next.has(name)) {
    next.delete(name);
  } else {
    next.add(name);
  }
  openEpics.value = next;
}

function isOpen(name) {
  return openEpics.value.has(name);
}
</script>

<template>
  <div class="roadmap">
    <header class="roadmap-hero">
      <div class="hero-top">
        <p class="eyebrow">{{ active.eyebrow }}</p>
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

      <h1>{{ active.title }}</h1>
      <p class="hero-sub">{{ active.subtitle }}</p>
    </header>

    <main class="roadmap-body">
        <article v-for="epic in active.epics" :key="epic.name" class="epic-card">
          <button class="epic-header" type="button" @click="toggle(epic.name)">
            <h3>{{ epic.name }}</h3>
            <span class="epic-toggle" :class="{ 'is-open': isOpen(epic.name) }" aria-hidden="true">+</span>
          </button>
          <p class="epic-description">{{ epic.description }}</p>

          <div v-show="isOpen(epic.name)" class="epic-detail">
            <div class="detail-block">
              <h4>{{ active.ui.sequenced }}</h4>
              <ol class="phase-list">
                <li v-for="phase in epic.subPhases" :key="phase.title">
                  <span class="phase-title">{{ phase.title }}</span>
                  <span class="phase-description">{{ phase.description }}</span>
                </li>
              </ol>
            </div>

            <div v-if="epic.resolvedDecisions.length" class="callout callout-resolved">
              <h4>{{ active.ui.resolved }}</h4>
              <ul>
                <li v-for="(item, i) in epic.resolvedDecisions" :key="i">{{ item }}</li>
              </ul>
            </div>

            <div v-if="epic.openQuestions.length" class="callout callout-open">
              <h4>{{ active.ui.open }}</h4>
              <ul>
                <li v-for="(item, i) in epic.openQuestions" :key="i">{{ item }}</li>
              </ul>
            </div>

            <p v-if="epic.note" class="epic-note">{{ epic.note }}</p>
          </div>
        </article>
    </main>
  </div>
</template>

<style scoped>
.roadmap {
  --serif: 'Fraunces', Georgia, serif;
  --sans: 'Inter', sans-serif;
  max-width: 900px;
  margin: 0 auto;
  padding: 48px 24px 96px;
  font-family: var(--sans);
  color: #423628;
}

.roadmap-hero {
  margin-bottom: 56px;
}

.hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.eyebrow {
  font-family: var(--sans);
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

.roadmap-hero h1 {
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
  max-width: 62ch;
  margin: 0 0 36px;
}

.roadmap-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.epic-card {
  border: 1px solid #e6dfd8;
  border-radius: 14px;
  background: #fff;
  padding: 24px 28px;
  margin-bottom: 20px;
}

.epic-header {
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

.epic-header h3 {
  font-family: var(--serif);
  font-weight: 600;
  font-size: 21px;
  color: #744210;
  margin: 0;
}

.epic-toggle {
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

.epic-toggle.is-open {
  transform: rotate(45deg);
}

.epic-description {
  font-size: 15px;
  line-height: 1.6;
  color: #5a4a37;
  margin: 12px 0 0;
}

.epic-detail {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px dashed #e6dfd8;
}

.detail-block h4,
.callout h4 {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 0 0 12px;
}

.detail-block h4 {
  color: #a18e77;
}

.phase-list {
  list-style: none;
  counter-reset: phase;
  margin: 0 0 24px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.phase-list li {
  counter-increment: phase;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-left: 32px;
  position: relative;
}

.phase-list li::before {
  content: counter(phase);
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

.phase-title {
  font-weight: 600;
  font-size: 14.5px;
  color: #423628;
}

.phase-description {
  font-size: 14px;
  line-height: 1.55;
  color: #66553f;
}

.callout {
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 16px;
}

.callout ul {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.callout li {
  font-size: 13.5px;
  line-height: 1.55;
}

.callout-resolved {
  background: #f0faf6;
  border: 1px solid #cdeee0;
}

.callout-resolved h4 {
  color: #0d7a51;
}

.callout-resolved li {
  color: #1f4d3a;
}

.callout-open {
  background: #fdf6ea;
  border: 1px solid #f3e0b8;
}

.callout-open h4 {
  color: #a8730f;
}

.callout-open li {
  color: #5c4318;
}

.epic-note {
  font-size: 13.5px;
  line-height: 1.6;
  color: #7e684d;
  font-style: italic;
  margin: 8px 0 0;
}

@media (max-width: 640px) {
  .roadmap {
    padding: 32px 16px 64px;
  }

  .roadmap-hero h1 {
    font-size: 34px;
  }

  .epic-card {
    padding: 18px 18px;
  }
}
</style>
