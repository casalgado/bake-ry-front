<script setup>
/* Producción: lo que vas a hacer.
 *
 * Future tense throughout, and that is not a wording preference. On Ingreso the
 * numbers already exist — they are printed on the invoice, and the form is
 * transcription. Here the number you type is an OUTPUT: what you intend to make.
 * Confirmar is what makes it past tense.
 *
 * The split is documento / lista: los controles y el total a la izquierda, lo
 * que vas a hacer a la derecha, que es lo que se lee y se corrige.
 *
 * What you can make: productos con inventoryMode 'recipe', y preparaciones
 * (ingredientes que llevan receta propia). Never something you buy — that is
 * Ingreso, and nothing appears on both.
 *
 * No proveedor, no responsable. The ledger records who confirmed the movement
 * server-side, which is more trustworthy than a box anyone can type into.
 * No unit cost either: a production line's cost comes from its recipe. */
import { computed, onMounted, ref } from 'vue';
import { PhX } from '@phosphor-icons/vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import UiItemPicker from '@/components/ui/UiItemPicker.vue';
import { useStockStore } from '@/stores/stockStore';
import { useIngredientStore } from '@/stores/ingredientStore';
import { useProductStore } from '@/stores/productStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { useInventoryDocsStore } from '@/stores/inventoryDocsStore';
import { useItemCatalog, itemOfStock, combosOf } from '@/composables/useItemCatalog';
import { useWarehouses } from '@/composables/useWarehouses';
import { formatMoney, formatQty, parseNumericInput } from '@/utils/helpers';

const stockStore = useStockStore();
const ingredientStore = useIngredientStore();
const productStore = useProductStore();
const recipeStore = useRecipeStore();
const docsStore = useInventoryDocsStore();
const catalog = useItemCatalog();
const { warehouses, multiWarehouse, defaultWarehouseId } = useWarehouses();

docsStore.open('produccion', defaultWarehouseId.value);
const doc = computed(() => docsStore.docs.produccion);

/* Fetched HERE and not in InventoryLayout, which deliberately fetches no
 * recipes: this reads one field, `yield`, off a preparación's own recipe so
 * "2 lotes" can become 8 kg. That is not the component expansion the layout is
 * refusing to do — expansion walks the graph, and stays the server's job. */
onMounted(() => {
  if (!recipeStore.items.length) recipeStore.fetchAll().catch(() => {});
});

const PREP_GROUP = 'Preparaciones';

/* ---------------- what you can make ---------------- */

const identityKey = ({ type, id, combinationId }) =>
  `${type}:${id}:${combinationId ?? ''}`;

/* Across every bodega: identity is not a fact about a place. Only `stockHere`
 * is scoped, because only it is. */
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

const entryOf = (item, name, unit, extra = {}) => {
  const key = identityKey(item);
  return {
    key,
    item,
    name,
    unit,
    cost: catalog.costOf(item),
    kind: catalog.kindOf(item),
    itemKey: stockByIdentity.value.get(key)?.itemKey ?? null,
    ...extra,
  };
};

/* A preparación's rendimiento is what makes "2 lotes" computable, and it lives
 * on the recipe rather than on the ingredient. */
const yieldOf = (ingredient) =>
  recipeStore.items.find((r) => r.id === ingredient.recipeId)?.yield ?? null;

const catalogItems = computed(() => {
  const preparations = ingredientStore.items
    .filter((i) => !i.isDeleted && i.recipeId)
    .map((i) => entryOf(
      { type: 'ingredient', id: i.id, combinationId: null },
      i.name,
      i.unit,
      { batch: yieldOf(i), group: PREP_GROUP },
    ));

  const made = productStore.items
    .flatMap((p) => combosOf(p).map((c) => {
      const item = {
        type: 'product',
        id: p.id,
        combinationId: p.hasVariations ? c.id : null,
      };
      const name = p.hasVariations ? `${p.name} ${c.name}`.trim() : p.name;
      // A product is counted in sellable units; there is no batch size to read.
      return entryOf(item, name, 'unidad', { group: p.collectionName || 'Sin colección' });
    }));

  return [...preparations, ...made].sort((a, b) => a.name.localeCompare(b.name));
});

/* Group order for the picker: Preparaciones first, then product collections
 * alphabetically — the same shelves the recetario shows, keyed by the value we
 * hang on each entry. key === label. */
const pickerTitles = computed(() => {
  const collections = [...new Set(
    catalogItems.value
      .map((e) => e.group)
      .filter((g) => g && g !== PREP_GROUP),
  )].sort((a, b) => a.localeCompare(b));

  const keys = [
    ...(catalogItems.value.some((e) => e.group === PREP_GROUP) ? [PREP_GROUP] : []),
    ...collections,
  ];
  return Object.fromEntries(keys.map((k) => [k, k]));
});

const entryByKey = computed(() => new Map(catalogItems.value.map((e) => [e.key, e])));

const pickerItems = computed(() =>
  catalogItems.value.map((e) => ({
    key: e.key,
    name: e.name,
    kind: e.group,
    sub: e.batch ? `una tanda rinde ${formatQty(e.batch)} ${e.unit}` : '',
    meta: `${formatQty(stockHere(e.key))} ${e.unit}`,
  })));

/* ---------------- the document ---------------- */

const rows = computed(() =>
  doc.value.lines.map((line, i) => {
    const entry = entryByKey.value.get(line.key);
    const unitCost = entry?.cost ?? null;

    return {
      ...line,
      _i: i,
      name: entry?.name ?? line.name ?? line.key,
      unit: entry?.unit ?? line.unit ?? '',
      kind: entry?.kind ?? 'prod',
      batch: entry?.batch ?? null,
      inStock: stockHere(line.key),
      unitCost,
      // Costo, no valor: `costOf` nunca devuelve precio de venta.
      cost: unitCost === null ? null : (line.qty || 0) * unitCost,
    };
  }));

const total = computed(() =>
  rows.value.reduce((sum, row) => sum + (row.cost ?? 0), 0));

const unpricedCount = computed(() => rows.value.filter((r) => r.cost === null).length);

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

  /* Identity is the truth; itemKey is a convenience the backend may not have
   * minted yet — a preparación created this morning has no stocks doc until the
   * first production lands. No itemKey is ever built here (invariant 5). */
  doc.value.lines = [
    ...doc.value.lines,
    {
      key,
      item: entry.item,
      itemKey: entry.itemKey,
      name: entry.name,
      unit: entry.unit,
      // A batch is the natural unit of thought for anything with a rendimiento.
      qty: entry.batch ?? 1,
    },
  ];
}

const setField = (index, field, value) => {
  const next = parseNumericInput(value);
  doc.value.lines = doc.value.lines.map((l, i) =>
    (i === index ? { ...l, [field]: next } : l));
};

/* Bakers think in tandas, not in grams: a masa madre that yields 4 kg is "two
 * batches", and making them type 8 is arithmetic the screen can do. Products
 * have no rendimiento of their own, so they keep counting in units.
 *
 * The draft is what makes it typable. This box is the one input on the screen
 * whose displayed value is DERIVED (qty / batch), and a controlled binding over
 * a derived value re-renders mid-keystroke: `0` renders back as '' and wipes the
 * field, `1.` renders back as '1' and eats the dot — the exact two failures
 * parseNumericInput's docblock describes, reintroduced one layer up. While the
 * box has focus it shows the characters you typed; on blur the draft is dropped
 * and qty takes the display back, which is also what normalises '1.' to 1. */
const batchDrafts = ref({});

// Rounded: 0.1 × 3 ÷ 3 comes back 0.10000000000000002 in binary floating point,
// and that is not something anyone should see in a 4-character box.
const batchesOf = (row) =>
  (row.qty == null ? '' : Math.round((row.qty / row.batch) * 1e4) / 1e4);

const setBatches = (row, value) => {
  batchDrafts.value[row.key] = value;
  const n = parseNumericInput(value);
  setField(row._i, 'qty', n === null ? '' : n * row.batch);
};

const clearDraft = (key) => delete batchDrafts.value[key];

const removeLine = (row) => {
  clearDraft(row.key);
  doc.value.lines = doc.value.lines.filter((_, i) => i !== row._i);
};

/* No hay panel de "esto te va a consumir": la expansión de componentes es una
 * caminata del BACKEND (EXISTENCIAS-BUILD.md §4.1) y `POST /stocks/produce` no
 * existe todavía, así que el panel solo sabía decir que no sabía. Cuando el
 * endpoint llegue, el lugar natural es debajo de las líneas, a la derecha. */

/* ---------------- losing work ---------------- */

function discard() {
  if (!doc.value.lines.length) return;
  if (!confirm(`Se perderán las ${doc.value.lines.length} línea(s) de esta producción. ¿Descartar?`)) return;

  const { warehouseId } = doc.value;
  docsStore.discard('produccion');
  docsStore.open('produccion', warehouseId);
}
</script>

<template>
  <div class="p-4 lg:p-6">
    <PageHeader title="Producción" subtitle="Lo que vas a hacer.">
      <span class="ui-panehead-sub">
        {{ doc.lines.length }} línea{{ doc.lines.length === 1 ? '' : 's' }}
      </span>
    </PageHeader>

    <div class="ui-app">
      <!-- Documento a la izquierda, lista a la derecha: lo que se escribe una
           vez (fecha, bodega, buscador) y lo que se lee y se corrige diez veces
           no compiten por la misma columna. La lista se lleva el ancho. -->
      <div class="ui-panes" style="--panes: minmax(0, 1fr) minmax(0, 1.35fr)">
        <div class="ui-pane">
          <div class="flex flex-wrap gap-2 mb-4">
            <label class="ui-field flex-1 min-w-[8rem]">
              <span class="ui-field-k">Fecha</span>
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
            :titles="pickerTitles"
            placeholder="Agregar lo que vas a hacer…"
            label="Agregar artículo"
            @select="addLine"
          />

          <p v-if="blankQuantities" class="ui-item-desc mt-2">
            {{ blankQuantities }} línea(s) sin cantidad.
          </p>
          <p v-if="unpricedCount" class="ui-item-desc mt-2">
            {{ unpricedCount }} línea(s) sin costo — les falta receta, así que el
            total de abajo se queda corto.
          </p>

          <div
            class="flex flex-wrap items-baseline justify-between gap-x-7 gap-y-3 mt-4 pt-3.5"
            style="border-top: 1px solid var(--ui-line)"
          >
            <!-- Un solo número, y es el COSTO: `costOf` lee costPerUnit /
                 costPrice, nunca el precio de venta. No hay "valor producido"
                 al lado — sería inventarle ingresos a algo que todavía no se
                 vendió, y esto no es una pantalla de ventas. El conteo de
                 líneas ya está en la cabecera y sobre la lista. -->
            <span class="ui-stat">
              <span class="ui-stat-k">Costo de esta producción</span>
              <span class="ui-stat-v">{{ formatMoney(total) }}</span>
            </span>
          </div>

          <!-- ponytail: same rule as Ingreso. POST /bakeries/:bakeryId/stocks/produce
               arrives with expandComponents (EXISTENCIAS-BUILD.md §4.1);
               stockStore.produce is already written against it. -->
          <div class="flex flex-wrap items-center gap-1.5 mt-4">
            <button class="ui-btn ui-btn-solid" disabled>Confirmar producción</button>
            <button
              class="ui-btn ui-btn-danger"
              :disabled="!doc.lines.length"
              @click="discard"
            >Descartar</button>
          </div>
          <p class="ui-item-desc mt-2">
            Todavía no se puede confirmar: falta <code>POST /stocks/produce</code>
            en el servidor. Nada se guarda hasta entonces: este documento vive
            solo en este navegador, así que aguanta una recarga pero no lo vas a
            ver en otro dispositivo.
          </p>
        </div>

        <!-- ---------------- right: what you are making ---------------- -->
        <div class="ui-pane">
          <div class="ui-panehead">
            <span class="ui-panehead-title">Lo que vas a producir</span>
            <span v-if="rows.length" class="ui-panehead-sub">
              {{ rows.length }} línea{{ rows.length === 1 ? '' : 's' }}
            </span>
          </div>

          <div v-if="!rows.length" class="ui-empty">
            <b>Todavía no hay nada en esta producción</b>
            Busca a la izquierda lo que vas a hacer y agrégalo.
          </div>

          <TransitionGroup tag="div" name="ui-cascade" class="flex flex-col gap-1.5">
            <div
              v-for="(row, i) in rows" :key="row.key"
              class="ui-item ui-item-filled"
              :style="{ '--i': i }"
            >
              <span class="ui-tag">{{ row.kind }}</span>

              <span class="min-w-0">
                <span class="ui-item-title block capitalize" :title="row.name">{{ row.name }}</span>
                <span class="ui-item-desc">
                  en bodega {{ formatQty(row.inStock) }} {{ row.unit }}
                  · <template v-if="row.cost === null">sin costo</template>
                  <b v-else class="ui-num" :title="'Lo que cuesta hacer esta línea'">
                    {{ formatMoney(row.cost) }}
                  </b>
                </span>
              </span>

              <span class="ui-item-trail">
                <!-- Batches only where there is a rendimiento to multiply by.
                     A product is counted in sellable units and has none. -->
                <template v-if="row.batch">
                  <input
                    class="ui-input ui-input-num w-16"
                    type="number" min="0" step="any"
                    :value="batchDrafts[row.key] ?? batchesOf(row)"
                    :aria-label="'Tandas de ' + row.name"
                    :title="'Una tanda rinde ' + row.batch + ' ' + row.unit"
                    @input="setBatches(row, $event.target.value)"
                    @blur="clearDraft(row.key)"
                  >
                  <span class="ui-item-meta w-10 shrink-0">lotes</span>
                </template>

                <input
                  class="ui-input ui-input-num w-20"
                  type="number" min="0" step="any"
                  :value="row.qty"
                  :aria-label="'Cantidad de ' + row.name"
                  :aria-invalid="!(row.qty > 0)"
                  @input="setField(row._i, 'qty', $event.target.value)"
                >
                <span class="ui-item-meta w-8 shrink-0">{{ row.unit }}</span>

                <button
                  class="ui-btn ui-btn-icon ui-btn-danger"
                  :aria-label="'Quitar ' + row.name"
                  title="Quitar"
                  @click="removeLine(row)"
                >
                  <PhX :size="13" weight="bold" />
                </button>
              </span>
            </div>
          </TransitionGroup>
        </div>
      </div>
    </div>
  </div>
</template>
