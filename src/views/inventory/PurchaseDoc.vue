<script setup>
/* Ingreso: lo que llegó de afuera.
 *
 * Two panes, like Producción, and for the same reason — not because a delivery
 * is composed from a palette (it is not; it is transcribed off a piece of paper,
 * which is why the right side is never a shelf of chips) but because a purchase
 * has a CONSEQUENCE the left side cannot show:
 *
 *   1. los costos que cambian — lo que pagaste hoy contra el costo guardado,
 *   2. las existencias que deja — lo que había más lo que llegó.
 *
 * Both are computed from data already in this component; neither needs an
 * endpoint. El subtotal y el total se quedan a la izquierda, con las líneas que
 * los producen.
 *
 * What you can buy: ingredientes sin receta, y productos de reventa. Never a
 * product you make yourself — croissants come from Producción, and letting them
 * be "bought" here would put a purchase movement on something that has no
 * supplier. The rule is one expression, in `catalogItems` below.
 *
 * The picker is built against the CATALOG, not against the stocks docs. Buying
 * something for the first time is the normal case, and a shelf made of stocks
 * docs could not represent it — that is the hole this screen used to have.
 * Which means a line carries its IDENTITY (`{ type, id, combinationId }`) as the
 * truth and its `itemKey` only when the item already has one. No itemKey is ever
 * built here: minting them is the backend's job alone (invariant 5), and the
 * purchases endpoint is where a line for a never-stocked item gets one. */
import { ref, computed } from 'vue';
import { PhX } from '@phosphor-icons/vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import UiItemPicker from '@/components/ui/UiItemPicker.vue';
import IngredientCreateCard from '@/components/recipes/IngredientCreateCard.vue';
import { useStockStore } from '@/stores/stockStore';
import { useIngredientStore } from '@/stores/ingredientStore';
import { useProductStore } from '@/stores/productStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { useInventoryDocsStore } from '@/stores/inventoryDocsStore';
import { useItemCatalog, itemOfStock, combosOf } from '@/composables/useItemCatalog';
import { useWarehouses } from '@/composables/useWarehouses';
import { formatMoney, formatUnitCost, formatQty, parseNumericInput } from '@/utils/helpers';

const stockStore = useStockStore();
const ingredientStore = useIngredientStore();
const productStore = useProductStore();
const bakerySettingsStore = useBakerySettingsStore();
const docsStore = useInventoryDocsStore();
const catalog = useItemCatalog();
const { warehouses, multiWarehouse, defaultWarehouseId } = useWarehouses();

/* Opened once, on mount, not inside a computed: creating a document is a side
 * effect and a computed must not have one. Idempotent, so coming back finds the
 * delivery where you left it. */
docsStore.open('ingreso', defaultWarehouseId.value);
const doc = computed(() => docsStore.docs.ingreso);

/* En la cabeza del usuario una Coca-Cola es un producto, no un ingrediente, así
 * que las estanterías se llaman por lo que son aquí — lo que se compra — y no
 * por la tabla en la que viven. */
const TITLES = { ingr: 'Insumos', prod: 'Reventa' };

/* ---------------- the catalog you can buy from ---------------- */

/* One row per sellable unit: a product with variations is bought per
 * combination, because that is what a stocks doc is keyed by. Same split
 * `combosOf` makes everywhere else. */
const identityKey = ({ type, id, combinationId }) =>
  `${type}:${id}:${combinationId ?? ''}`;

/* The identity → stocks doc join, across EVERY bodega. Identity does not depend
 * on where you are looking, and resolving off the destination alone would blank
 * the lines you already wrote the moment you changed where the delivery lands.
 * Only `inStock` below is scoped to a place, because only it is a fact about
 * one. */
const stockByIdentity = computed(() => {
  const byKey = new Map();
  stockStore.items.forEach((stock) => {
    const key = identityKey(itemOfStock(stock));
    if (!byKey.has(key)) byKey.set(key, stock);
  });
  return byKey;
});

const stocksHere = computed(() =>
  stockStore.items.filter((s) => s.warehouseId === doc.value.warehouseId));

const stockHere = (key) =>
  stocksHere.value.find((s) => identityKey(itemOfStock(s)) === key)?.currentStock ?? 0;

const entryOf = (item, name, unit) => {
  const key = identityKey(item);
  return {
    key,
    item,
    name,
    unit,
    cost: catalog.costOf(item),
    kind: catalog.kindOf(item),
    itemKey: stockByIdentity.value.get(key)?.itemKey ?? null,
  };
};

/* THE shelf rule, in one place (HANDOFF-INVENTARIO-UI.md §1):
 *
 *   ingredientes sin recipeId   — harina, azúcar, lo que se compra
 *   productos inventoryMode 'unit' — la gaseosa que revendes tal cual
 *
 * Nothing appears both here and on Producción. An ingredient WITH a recipe is a
 * preparación: you make it, so it is not for sale to you. A product on 'recipe'
 * is a croissant: same reason. 'none' is not tracked in the bodega at all, so
 * receiving one would have nowhere to land. */
const catalogItems = computed(() => {
  const ingredients = ingredientStore.items
    .filter((i) => !i.isDeleted && !i.recipeId)
    .map((i) => entryOf({ type: 'ingredient', id: i.id, combinationId: null }, i.name, i.unit));

  const resale = productStore.items
    .filter((p) => p.inventoryMode === 'unit')
    .flatMap((p) => combosOf(p).map((c) => {
      const item = {
        type: 'product',
        id: p.id,
        combinationId: p.hasVariations ? c.id : null,
      };
      const name = p.hasVariations ? `${p.name} ${c.name}`.trim() : p.name;
      return entryOf(item, name, 'uds');
    }));

  return [...ingredients, ...resale].sort((a, b) => a.name.localeCompare(b.name));
});

const entryByKey = computed(() => new Map(catalogItems.value.map((e) => [e.key, e])));

/* What the picker renders. `meta` is what the destination bodega holds today —
 * the number you are about to change, so it belongs beside the name. */
const pickerItems = computed(() =>
  catalogItems.value.map((e) => ({
    key: e.key,
    name: e.name,
    kind: e.kind,
    sub: e.itemKey ? '' : 'primera compra',
    meta: `${formatQty(stockHere(e.key))} ${e.unit}`,
  })));

/* ---------------- the document ---------------- */

/* A line is identity plus the two numbers the invoice states: CUÁNTO llegó y
 * CUÁNTO costó en total. El costo por unidad no se escribe, se deriva — es una
 * división que la factura ya hizo al revés y que nadie debería tener que
 * rehacer de cabeza.
 *
 * Name, unit and current stock are joined back at render, so a refetch never
 * leaves a stale copy in the document. */
const rows = computed(() =>
  doc.value.lines.map((line, i) => {
    const entry = entryByKey.value.get(line.key);
    const inStock = stockHere(line.key);

    /* Back-compat: drafts written before the line carried a total stored a
     * unitCost instead. Drop this the day no browser can still be holding
     * one. */
    const paid = line.total ?? (line.unitCost != null && line.qty
      ? line.unitCost * line.qty
      : null);

    return {
      ...line,
      _i: i,
      name: entry?.name ?? line.name ?? line.key,
      unit: entry?.unit ?? line.unit ?? '',
      kind: entry?.kind ?? 'ingr',
      inStock,
      isNew: !entry?.itemKey,
      paid,
      /* Sin cantidad no hay costo por unidad: dividir por cero inventaría un
       * número, y `null` ya significa "todavía no se sabe" en toda la pantalla. */
      unitCost: paid !== null && line.qty > 0 ? paid / line.qty : null,
      /* What the catalog believes today — the number the right pane compares
       * against. `null` means the join failed, never $0, or a catalog that did
       * not load would read as "bajó a cero". */
      storedCost: entry?.cost ?? null,
      after: inStock + (line.qty || 0),
    };
  }));

const total = computed(() =>
  rows.value.reduce((sum, row) => sum + (row.paid ?? 0), 0));

const unpricedCount = computed(() => rows.value.filter((r) => r.paid === null).length);

const blankQuantities = computed(
  () => doc.value.lines.filter((l) => !(l.qty > 0)).length);

function addLine(key) {
  const existing = doc.value.lines.find((l) => l.key === key);

  if (existing) {
    doc.value.lines = doc.value.lines.map((l) =>
      (l.key === key ? { ...l, qty: (l.qty || 0) + 1 } : l));
    return;
  }

  const entry = entryByKey.value.get(key);
  if (!entry) return;

  doc.value.lines = [
    ...doc.value.lines,
    {
      key,
      /* Identity is the truth; itemKey is a convenience the backend may not
       * have minted yet. `name`/`unit` ride along ONLY so a line survives a
       * catalog that failed to load — every render prefers the joined value. */
      item: entry.item,
      itemKey: entry.itemKey,
      name: entry.name,
      unit: entry.unit,
      qty: 1,
      /* En blanco, no el último costo conocido: la factura es la que dice qué
       * costó, y precargar el precio del mes pasado sería inventarle un número
       * a un documento que existe justamente para corregirlo. */
      total: null,
    },
  ];
}

const setField = (index, field, value) => {
  const next = parseNumericInput(value);
  doc.value.lines = doc.value.lines.map((l, i) =>
    (i === index ? { ...l, [field]: next } : l));
};

const removeLine = (index) =>
  (doc.value.lines = doc.value.lines.filter((_, i) => i !== index));

/* ---------------- what this changes ---------------- */

/* Los costos que esta compra deja distintos.
 *
 * Lo que pagaste ES el costo: al confirmar, el costo estándar de cada línea
 * queda en el precio de esta factura y las recetas que lo usan se recalculan
 * solas. No hay botón ni pregunta — por eso existe este panel: el cambio es
 * automático, así que tiene que estar a la vista antes de confirmar, nunca
 * después.
 *
 * (EXISTENCIAS-BUILD.md §4.2 pide lo contrario, un prompt por línea. Se cambió a
 * propósito: en la práctica siempre se acepta, y una pregunta que siempre se
 * responde igual es una pregunta de más. Si el documento se actualiza, esto es
 * lo que quedó.)
 *
 * A tolerance and not `!==`: retyping the same number with a trailing zero must
 * not make a row appear and vanish under your cursor. */
const drift = computed(() => rows.value
  .filter((r) => r.storedCost !== null
    && r.unitCost !== null
    && Math.abs(r.unitCost - r.storedCost) > 0.005)
  .map((r) => ({
    ...r,
    /* A stored 0 is "nunca tuvo costo", not a drop from something, so there is
     * no percentage to show for it. */
    pct: r.storedCost > 0 ? (r.unitCost - r.storedCost) / r.storedCost : null,
  })));

/* Solo ingredientes: un artículo de reventa también entra a la bodega, pero lo
 * que se mira antes de confirmar es la materia prima. La nota de abajo dice
 * cuántas líneas quedaron fuera, para que la omisión se lea en pantalla en vez
 * de esconderse. */
const projection = computed(() => rows.value.filter((r) => r.item?.type === 'ingredient'));

const resaleLeftOut = computed(() => rows.value.length - projection.value.length);

/* ---------------- creating what you are buying for the first time ---------- */

const creatingName = ref('');

const categories = computed(() =>
  (bakerySettingsStore.items[0]?.ingredientCategories ?? [])
    .filter((c) => c.isActive !== false));

/* Straight onto the document — you only created it because it is on the invoice
 * in front of you. The refetch is what makes `catalogItems` see it, and the
 * store's create already pushed it, so the entry resolves on the next tick.
 *
 * La cantidad y el total ya se escribieron en la tarjeta, así que la línea nace
 * con ellos: volver a pedirlos sería pedir dos veces lo mismo. */
async function onIngredientCreated(created, purchased) {
  creatingName.value = '';
  await ingredientStore.fetchAll().catch(() => {});

  const key = identityKey({ type: 'ingredient', id: created.id, combinationId: null });
  addLine(key);
  if (!purchased) return;

  doc.value.lines = doc.value.lines.map((l) => (l.key === key
    ? { ...l, qty: purchased.qty ?? l.qty, total: purchased.total }
    : l));
}

/* ---------------- losing work ---------------- */

/* ponytail: native confirm(), same ruling as RecipeBookView — there is no
 * ui-modal and one guard does not earn the first. */
function discard() {
  if (!doc.value.lines.length) return;
  if (!confirm(`Se perderán las ${doc.value.lines.length} línea(s) de este ingreso. ¿Descartar?`)) return;

  /* Reopen on the bodega you were pointing at, not the default one: clearing
   * the lines is what you asked for, silently re-routing the delivery is not. */
  const { warehouseId } = doc.value;
  docsStore.discard('ingreso');
  docsStore.open('ingreso', warehouseId);
}
</script>

<template>
  <div class="p-4 lg:p-6">
    <PageHeader title="Ingreso" subtitle="Lo que llegó de afuera.">
      <span class="ui-panehead-sub">
        {{ doc.lines.length }} línea{{ doc.lines.length === 1 ? '' : 's' }}
      </span>
    </PageHeader>

    <div class="ui-app">
      <!-- Same split as Producción: lo que llegó a la izquierda, lo que eso
           cambia a la derecha. -->
      <div class="ui-panes" style="--panes: minmax(0, 1.35fr) minmax(0, 1fr)">
        <div class="ui-pane">
          <!-- El proveedor primero y solo: casi siempre le compras lo mismo a
               la misma persona, así que es lo que identifica el documento. Vive
               en el documento, nunca en la línea — una entrega, un proveedor. -->
          <label class="ui-field mb-2">
            <span class="ui-field-k">Proveedor</span>
            <input
              class="ui-input"
              type="text"
              :value="doc.provider"
              placeholder="Nombre del proveedor"
              @input="doc.provider = $event.target.value"
            >
          </label>

          <p class="ui-item-desc mb-4">
            Por ahora el proveedor es texto libre. La lista de proveedores llega
            cuando el servidor tenga proveedores como entidad.
          </p>

          <div class="flex flex-wrap gap-2 mb-4">
            <label class="ui-field flex-1 min-w-[8rem]">
              <span class="ui-field-k">Fecha</span>
              <!-- Native date input: the browser already owns the calendar, the
                   locale and the keyboard. -->
              <input
                class="ui-input"
                type="date"
                :value="doc.date"
                @input="doc.date = $event.target.value"
              >
            </label>

            <label v-if="multiWarehouse" class="ui-field flex-1 min-w-[8rem]">
              <span class="ui-field-k">Entra a</span>
              <select
                class="ui-input"
                :value="doc.warehouseId"
                @change="doc.warehouseId = $event.target.value"
              >
                <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
              </select>
            </label>
          </div>

          <UiItemPicker
            class="mb-4"
            :items="pickerItems"
            :titles="TITLES"
            allow-create
            placeholder="Buscar un insumo o un producto de reventa…"
            label="Agregar artículo"
            @select="addLine"
            @create="creatingName = $event"
          />

          <!-- Ingredientes solamente: un artículo de reventa es un PRODUCTO, y
               crear uno aquí sería inventarle variaciones, precio y colección
               desde un formulario de compra. -->
          <template v-if="creatingName">
            <IngredientCreateCard
              :name="creatingName"
              :categories="categories"
              :allow-preparacion="false"
              purchase
              autofocus
              @created="onIngredientCreated"
            />
            <p class="ui-item-desc -mt-2 mb-4">
              Aquí solo se crean ingredientes. Los productos de reventa se
              registran en Productos. Las preparaciones en el Recetario.
            </p>
          </template>

          <div v-if="!rows.length" class="ui-empty">
            <b>Este ingreso no tiene líneas</b>
            Busca arriba el insumo o el producto que vas a registrar.
          </div>

          <TransitionGroup tag="div" name="ui-cascade" class="flex flex-col gap-1.5">
            <div
              v-for="(row, i) in rows" :key="row.key"
              class="ui-item ui-item-filled ui-item-split"
              :style="{ '--i': i }"
            >
              <span class="ui-tag">{{ row.kind }}</span>

              <span class="min-w-0">
                <!-- title, because .ui-item-title ellipses: at a narrow pane the
                     name is the first thing to give way, and a row you cannot
                     read is a row you cannot check. -->
                <span class="ui-item-title block capitalize" :title="row.name">{{ row.name }}</span>
                <!-- El costo por unidad va aquí y no en un input: es lo que la
                     compra DEJA, no lo que se escribe. Mismo lugar que en el
                     recetario, que es donde ya se lee ese número. -->
                <span class="ui-item-desc">
                  <template v-if="row.unitCost === null">sin costo</template>
                  <template v-else>
                    <b class="ui-num">{{ formatUnitCost(row.unitCost) }}</b>/{{ row.unit }}
                  </template>
                  · <template v-if="row.isNew">primera compra</template>
                  <template v-else>en bodega {{ formatQty(row.inStock) }} {{ row.unit }}</template>
                </span>
              </span>

              <span class="ui-item-trail">
                <input
                  class="ui-input ui-input-num w-[5.5rem]"
                  type="number" min="0" step="any"
                  :value="row.qty"
                  :aria-label="'Cantidad de ' + row.name"
                  :aria-invalid="!(row.qty > 0)"
                  @input="setField(row._i, 'qty', $event.target.value)"
                >
                <span class="ui-item-meta w-6 shrink-0">{{ row.unit }}</span>

                <!-- La unidad después del primero y el $ antes del segundo: dos
                     cajas de números seguidas necesitan decir cuál es cuál sin
                     una fila de encabezados. -->
                <span class="ui-item-meta shrink-0">$</span>
                <input
                  class="ui-input ui-input-num w-24"
                  type="number" min="0" step="any"
                  :value="row.paid"
                  placeholder="total"
                  :aria-label="'Total pagado por ' + row.name"
                  title="Lo que dice la factura por esta línea"
                  @input="setField(row._i, 'total', $event.target.value)"
                >

                <button
                  class="ui-btn ui-btn-icon ui-btn-danger"
                  :aria-label="'Quitar ' + row.name"
                  title="Quitar"
                  @click="removeLine(row._i)"
                >
                  <PhX :size="13" weight="bold" />
                </button>
              </span>
            </div>
          </TransitionGroup>

          <p v-if="blankQuantities" class="ui-item-desc mt-2">
            {{ blankQuantities }} línea(s) sin cantidad.
          </p>
          <p v-if="unpricedCount" class="ui-item-desc mt-2">
            {{ unpricedCount }} línea(s) sin costo — el total de abajo se queda corto.
          </p>

          <div
            class="flex flex-wrap items-baseline justify-between gap-x-7 gap-y-3 mt-4 pt-3.5"
            style="border-top: 1px solid var(--ui-line)"
          >
            <span class="ui-stat">
              <span class="ui-stat-k">Total de la compra</span>
              <span class="ui-stat-v">{{ formatMoney(total) }}</span>
            </span>
            <span class="ui-stat">
              <span class="ui-stat-k">Líneas</span>
              <span class="ui-stat-v">{{ doc.lines.length }}</span>
            </span>
          </div>

          <!-- ponytail: Confirmar stays disabled — POST /bakeries/:bakeryId/purchases
               arrives with EXISTENCIAS-BUILD.md §4.2. It is NOT routed through
               /stocks/:itemKey/adjust to make the button work: that would write
               `adjustment` movements for events that are purchases, and an
               append-only ledger can never be re-tagged, so the merma report
               would be wrong forever.
               Disabled with the reason on screen, not only in a title: a button
               that silently does nothing is worse than one that says why. -->
          <div class="flex flex-wrap items-center gap-1.5 mt-4">
            <button class="ui-btn ui-btn-solid" disabled>Confirmar ingreso</button>
            <button
              class="ui-btn ui-btn-danger"
              :disabled="!doc.lines.length"
              @click="discard"
            >Descartar</button>
          </div>
          <p class="ui-item-desc mt-2">
            Todavía no se puede confirmar: falta <code>POST /purchases</code> en
            el servidor. Nada se guarda hasta entonces: este documento vive solo
            en este navegador, así que aguanta una recarga pero no lo vas a ver
            en otro dispositivo.
          </p>
        </div>

        <!-- ---------------- right: the consequence ---------------- -->
        <div class="ui-pane ui-pane-sunken">
          <div class="ui-panehead">
            <span class="ui-panehead-title">Costos que se actualizarán</span>
            <span v-if="drift.length" class="ui-panehead-sub">
              {{ drift.length }} de {{ rows.length }} líneas
            </span>
          </div>

          <div v-if="!rows.length" class="ui-empty">
            Al registrar las líneas aparecerán aquí los costos que cambian.
          </div>
          <div v-else-if="!drift.length" class="ui-empty">
            Ningún costo cambia. Los precios de esta compra coinciden con los
            que ya estaban guardados.
          </div>

          <div v-for="row in drift" :key="row.key" class="ui-item ui-item-divided">
            <span />
            <span class="min-w-0">
              <span class="ui-item-title block capitalize" :title="row.name">{{ row.name }}</span>
              <span class="ui-item-desc">
                <template v-if="row.pct === null">
                  sin costo registrado · ahora
                  <b class="ui-num">{{ formatUnitCost(row.unitCost) }}</b>/{{ row.unit }}
                </template>
                <template v-else>
                  antes <span class="ui-num">{{ formatUnitCost(row.storedCost) }}</span>
                  · ahora
                  <b class="ui-num">{{ formatUnitCost(row.unitCost) }}</b>/{{ row.unit }}
                </template>
              </span>
            </span>
            <span v-if="row.pct !== null" class="ui-item-trail">
              <span class="ui-item-num ui-num">
                {{ row.pct > 0 ? '+' : '' }}{{ Math.round(row.pct * 100) }}<span class="ui-unit">%</span>
              </span>
            </span>
          </div>

          <p v-if="drift.length" class="ui-item-desc mt-3">
            Al confirmar, cada insumo de esta lista queda con el costo de esta
            compra y las recetas que lo usan se recalculan. El cambio es
            automático; esta lista existe para que lo revises antes.
          </p>

          <!-- ---------------- how the bodega ends up ---------------- -->
          <div class="ui-sectionhead mt-6">Existencias después de este ingreso</div>

          <div v-if="!projection.length" class="ui-empty">
            Al agregar insumos aparecerán aquí sus existencias resultantes.
          </div>

          <div v-for="row in projection" :key="row.key" class="ui-item ui-item-divided">
            <span />
            <span class="min-w-0">
              <span class="ui-item-title block capitalize" :title="row.name">{{ row.name }}</span>
              <span class="ui-item-desc">
                <template v-if="row.isNew">primera compra</template>
                <template v-else>hay {{ formatQty(row.inStock) }} {{ row.unit }}</template>
              </span>
            </span>
            <span class="ui-item-trail">
              <span class="ui-item-num ui-num">
                {{ formatQty(row.after) }}<span class="ui-unit">{{ row.unit }}</span>
              </span>
            </span>
          </div>

          <p v-if="resaleLeftOut" class="ui-item-desc mt-3">
            {{ resaleLeftOut }} línea(s) de reventa no se listan aquí. También
            entran a la bodega; esta lista se limita a los insumos, que es lo
            que se revisa antes de confirmar.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
