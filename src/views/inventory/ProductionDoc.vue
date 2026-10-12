<script setup>
/* Producción: lo que vas a hacer.
 *
 * Future tense throughout, and that is not a wording preference. On Ingreso the
 * numbers already exist — they are printed on the invoice, and the form is
 * transcription. Here the number you type is an OUTPUT: what you intend to make.
 * Enviar sends it to the kitchen as a production run; nothing moves until the
 * kitchen receives each line, and that is what makes it past tense.
 *
 * The split is documento / lista: los controles y el total a la izquierda, lo
 * que vas a hacer a la derecha, que es lo que se lee y se corrige.
 *
 * What you can make: productos que no se compran (inventoryMode 'none' o
 * 'recipe'), y preparaciones (ingredientes que llevan receta propia). Never
 * something you buy — that is Ingreso, and nothing appears on both. Adding one
 * that isn't tracked yet switches its inventory on, so the output has a stock
 * row to land in.
 *
 * No proveedor, no responsable. The server records who sent and who received,
 * which is more trustworthy than a box anyone can type into. No unit cost
 * either: a production line's cost comes from its recipe. */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { PhX, PhWarning } from '@phosphor-icons/vue';
import AppTooltip from '@/components/common/AppTooltip.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import UiItemPicker from '@/components/ui/UiItemPicker.vue';
import { useStockStore } from '@/stores/stockStore';
import { useIngredientStore } from '@/stores/ingredientStore';
import { useProductStore } from '@/stores/productStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { useProductionRunStore } from '@/stores/productionRunStore';
import { useInventoryDocsStore } from '@/stores/inventoryDocsStore';
import { useItemCatalog, itemOfStock, combosOf } from '@/composables/useItemCatalog';
import { useWarehouses } from '@/composables/useWarehouses';
import { formatMoney, formatQty, parseNumericInput } from '@/utils/helpers';
import { formatDateDisplay, getTodayString } from '@/utils/dateUtils';

const stockStore = useStockStore();
const ingredientStore = useIngredientStore();
const productStore = useProductStore();
const recipeStore = useRecipeStore();
const productionRunStore = useProductionRunStore();
const docsStore = useInventoryDocsStore();
const catalog = useItemCatalog();
const { warehouses, multiWarehouse, defaultWarehouseId } = useWarehouses();

docsStore.open('produccion', defaultWarehouseId.value);
const doc = computed(() => docsStore.docs.produccion);

// A production plan is for today or later: a draft restored from an earlier day
// moves up to today (the local day, not the UTC one).
const today = getTodayString();
if (doc.value.date < today) doc.value.date = today;

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

/* `activate` is the record to switch on when the line is added: an untracked
 * product goes to 'recipe', a passThrough preparación to 'stocked'. */
const catalogItems = computed(() => {
  const preparations = ingredientStore.items
    .filter((i) => !i.isDeleted && i.recipeId)
    .map((i) => entryOf(
      { type: 'ingredient', id: i.id, combinationId: null },
      i.name,
      i.unit,
      {
        batch: yieldOf(i),
        group: PREP_GROUP,
        activate: i.stockBehavior === 'stocked' ? null : { store: ingredientStore, record: i, stockBehavior: 'stocked' },
      },
    ));

  // 'unit' products are bought, never made: they live on Ingreso.
  const made = productStore.items
    .filter((p) => !p.isDeleted && p.inventoryMode !== 'unit')
    .flatMap((p) => combosOf(p).map((c) => {
      const item = {
        type: 'product',
        id: p.id,
        combinationId: p.hasVariations ? c.id : null,
      };
      // A product is counted in sellable units; there is no batch size to read.
      return entryOf(item, catalog.nameOf(item), 'uds', {
        // The picker already groups by colección, so its rows drop the prefix.
        shortName: catalog.nameOf(item, { withCollection: false }),
        group: p.collectionName || 'Sin colección',
        activate: p.inventoryMode === 'recipe' ? null : { store: productStore, record: p, inventoryMode: 'recipe' },
      });
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
    name: e.shortName ?? e.name,
    kind: e.group,
    sub: [
      e.batch ? `una tanda rinde ${formatQty(e.batch)} ${e.unit}` : '',
      e.activate ? 'se activará el inventario' : '',
    ].filter(Boolean).join(' · '),
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

/* Switches an untracked item's inventory on, so the run's output has a stock
 * row to land in. Sent as the full record: the PUT validates the whole
 * document. The server's update path creates the stocks doc. */
async function activate({ store, record, ...change }) {
  await store.update(record.id, { ...record, ...change });
  await stockStore.fetchAll().catch(() => {});
}

const bumpLine = (key) => {
  doc.value.lines = doc.value.lines.map((l) =>
    (l.key === key ? { ...l, qty: (l.qty || 0) + 1 } : l));
};

async function addLine(key) {
  savedNote.value = '';
  if (doc.value.lines.some((l) => l.key === key)) return bumpLine(key);

  const entry = entryByKey.value.get(key);
  if (!entry) return;

  if (entry.activate) {
    formError.value = '';
    try {
      await activate(entry.activate);
    } catch (err) {
      formError.value = `No se pudo activar el inventario de ${entry.name}: ${err?.message || 'error'}`;
      return;
    }
    // A second pick of the same item can land while this one was activating.
    if (doc.value.lines.some((l) => l.key === key)) return bumpLine(key);
  }

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

/* ---------------- repeat the last production ---------------- */

/* Production repeats: the most recent day with a run before this document's
 * date (up to two weeks back; a closed day or a weekend is no reason to find
 * nothing). Its lines come in as they were planned. */
const LOOKBACK_DAYS = 14;
const lastRun = ref(null); // { label, lines: [{ item, plannedQty }] }
// A newer search (the date changed meanwhile) wins; an older one stops here.
let lastRunSeq = 0;

async function findLastRun() {
  const seq = ++lastRunSeq;
  lastRun.value = null;
  const end = new Date(`${doc.value.date}T00:00:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - LOOKBACK_DAYS);

  try {
    await productionRunStore.fetchAll({
      filters: {
        dateRange: {
          dateField: 'date',
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        },
      },
    });
  } catch {
    return; // a convenience: no history, no button
  }
  if (seq !== lastRunSeq) return;

  const before = productionRunStore.items.filter((run) => new Date(run.date) < end);
  if (!before.length) return;

  const day = (run) => String(run.date).slice(0, 10);
  const latest = before.map(day).sort().at(-1);
  const lines = before.filter((run) => day(run) === latest)
    .flatMap((run) => run.lines || [])
    .filter((line) => line.status !== 'cancelled')
    .map((line) => ({ item: line.item, plannedQty: line.plannedQty }));

  if (lines.length) lastRun.value = { label: formatDateDisplay(new Date(`${latest}T12:00:00`)), lines };
}

watch(() => doc.value.date, findLastRun, { immediate: true });

/* Adds what is not already in the document, summing a product that was sent in
 * more than one line. What can no longer be made (untracked or bought now) is
 * skipped, and the note says how many. */
function repeatLast() {
  if (!lastRun.value) return;

  const planned = new Map();
  lastRun.value.lines.forEach(({ item, plannedQty }) => {
    const key = identityKey(item);
    planned.set(key, (planned.get(key) || 0) + plannedQty);
  });

  const have = new Set(doc.value.lines.map((l) => l.key));
  const added = [];
  let skipped = 0;

  planned.forEach((qty, key) => {
    if (have.has(key)) return;
    const entry = entryByKey.value.get(key);
    if (!entry || entry.activate) { skipped += 1; return; }
    added.push({ key, item: entry.item, itemKey: entry.itemKey, name: entry.name, unit: entry.unit, qty });
  });

  doc.value.lines = [...doc.value.lines, ...added];
  savedNote.value = `Se agregaron ${added.length} línea(s) de la producción del ${lastRun.value.label}`
    + (skipped ? `; ${skipped} ya no se pueden producir.` : '.');
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

/* ---------------- what it will consume ---------------- */

/* The expansion is the server's walk (stockService.expandRecipe), the same one
 * receiving runs, so what this shows is what the kitchen's tick will move.
 * Debounced: every keystroke in a quantity box changes the request. A sequence
 * number drops answers that arrive after a newer one was asked. */
const preview = ref([]);
const previewError = ref('');
let previewSeq = 0;
let previewTimer = null;

const previewLines = computed(() => rows.value
  .filter((r) => r.qty > 0)
  .map((r) => ({ item: r.item, plannedQty: r.qty })));

async function runPreview() {
  const lines = previewLines.value;
  const seq = ++previewSeq;
  if (!lines.length) {
    preview.value = [];
    previewError.value = '';
    return;
  }
  try {
    const result = await productionRunStore.preview(lines);
    if (seq !== previewSeq) return;
    preview.value = result;
    previewError.value = '';
  } catch (err) {
    if (seq !== previewSeq) return;
    // The old answer is for numbers that have since changed: don't keep showing it.
    preview.value = [];
    previewError.value = err?.message || 'No se pudo calcular lo que consume.';
  }
}

watch(() => JSON.stringify(previewLines.value), () => {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(runPreview, 400);
}, { immediate: true });

onUnmounted(() => clearTimeout(previewTimer));

// The catalog's name (colección first); the server's when the catalog lacks it.
const displayName = (item, fallback) => catalog.nameOf(item) || fallback;

/* Summed across lines: two products using harina show one harina row. Short
 * when the bodega holds less than this takes. It warns, never blocks. */
const consumption = computed(() => {
  const byKey = new Map();
  preview.value.forEach((line) => line.components.forEach((c) => {
    const key = identityKey(c.item);
    const current = byKey.get(key)
      ?? { key, name: displayName(c.item, c.name), unit: c.unit, qty: 0 };
    current.qty += c.qty;
    byKey.set(key, current);
  }));
  return [...byKey.values()]
    .map((c) => ({ ...c, inStock: stockHere(c.key), short: c.qty > stockHere(c.key) }))
    .sort((a, b) => a.name.localeCompare(b.name));
});

const GAP_TEXT = {
  missingRecipe: 'sin receta — no descuenta nada',
  depthExceeded: 'receta demasiado profunda — se detuvo ahí',
  missingItem: 'ya no existe — no descuenta nada',
};

// What the warning icon says on hover.
const GAP_TIP = {
  missingRecipe: 'Este producto no tiene receta',
  depthExceeded: 'Su receta es demasiado profunda',
  missingItem: 'Este producto ya no existe',
};

const gaps = computed(() => {
  const byKey = new Map();
  preview.value.forEach((line) => line.gaps.forEach((g) => {
    const key = `${identityKey(g.item)}:${g.reason}`;
    byKey.set(key, {
      key,
      name: displayName(g.item, g.name),
      text: GAP_TEXT[g.reason] ?? g.reason,
      tip: GAP_TIP[g.reason] ?? g.reason,
    });
  }));
  return [...byKey.values()];
});

/* The lines the walk could not follow, to flag them on their own card (item key
 * → what to say). A gap on a nested component is not this line's: it only
 * matches when the gap's item IS the line's item. Same keys as `rows`, so it is
 * one lookup. */
const gapTips = computed(() => new Map(
  preview.value.flatMap((line) => line.gaps.map((g) => [identityKey(g.item), GAP_TIP[g.reason] ?? g.reason]))));

/* ---------------- sending ---------------- */

const submitting = ref(false);
const formError = ref('');
const savedNote = ref('');

const canSend = computed(() => rows.value.length > 0 && rows.value.every((r) => r.qty > 0));

/* Creates the run; no stock moves until the kitchen receives each line. The
 * document's idempotencyKey makes a resend land on the same run. On error the
 * draft stays. */
async function send() {
  if (!canSend.value || submitting.value) return;
  formError.value = '';
  savedNote.value = '';
  const lineCount = rows.value.length;

  submitting.value = true;
  try {
    await productionRunStore.create({
      date: doc.value.date,
      warehouseId: doc.value.warehouseId,
      idempotencyKey: doc.value.idempotencyKey,
      lines: rows.value.map((r) => ({ item: r.item, plannedQty: r.qty })),
    });
    reset();
    savedNote.value = `Enviado a producción: ${lineCount} línea(s). La cocina lo ve en su lista.`;
  } catch (err) {
    formError.value = err?.message || 'No se pudo enviar a producción.';
  } finally {
    submitting.value = false;
  }
}

/* ---------------- losing work ---------------- */

/* Reopen on the bodega you were pointing at. A fresh document also mints a
 * fresh idempotencyKey. */
function reset() {
  const { warehouseId } = doc.value;
  batchDrafts.value = {};
  docsStore.discard('produccion');
  docsStore.open('produccion', warehouseId);
}

function discard() {
  if (!doc.value.lines.length) return;
  if (!confirm(`Se perderán las ${doc.value.lines.length} línea(s) de esta producción. ¿Descartar?`)) return;
  reset();
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

          <button v-if="lastRun" class="ui-btn mb-4" @click="repeatLast">
            Repetir la producción del {{ lastRun.label }}
          </button>

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

          <div class="flex flex-wrap items-center gap-1.5 mt-4">
            <button
              class="ui-btn ui-btn-solid"
              :disabled="!canSend || submitting"
              @click="send"
            >{{ submitting ? 'Enviando…' : 'Enviar a producción' }}</button>
            <button
              class="ui-btn ui-btn-danger"
              :disabled="!doc.lines.length || submitting"
              @click="discard"
            >Descartar</button>
          </div>
          <p v-if="formError" class="ui-field-error mt-2">{{ formError }}</p>
          <p v-if="savedNote" class="ui-item-desc mt-2">{{ savedNote }}</p>
          <p class="ui-item-desc mt-2">
            Al enviar, la cocina lo ve en su lista. La bodega cambia cuando la
            cocina marca cada línea como producida. Hasta que lo envíes, este
            documento vive solo en este navegador.
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
              class="ui-item ui-item-filled ui-item-split"
              :style="{ '--i': i }"
            >
              <span class="ui-tag">{{ row.kind }}</span>

              <span class="min-w-0">
                <span class="ui-item-title flex items-center gap-1.5 capitalize">
                  <AppTooltip v-if="gapTips.has(row.key)" class="shrink-0" :text="gapTips.get(row.key)">
                    <PhWarning :size="14" weight="bold" role="img" :aria-label="gapTips.get(row.key)" />
                  </AppTooltip>
                  <span class="min-w-0 truncate" :title="row.name">{{ row.name }}</span>
                </span>
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
                <span class="ui-item-meta w-6 shrink-0">{{ row.unit }}</span>

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

          <!-- ---------------- what it will consume ---------------- -->
          <template v-if="rows.length">
            <div class="ui-sectionhead mt-6">Lo que va a consumir</div>

            <p v-if="previewError" class="ui-field-error">{{ previewError }}</p>
            <div v-else-if="!consumption.length && !gaps.length" class="ui-empty">
              Esta producción no descuenta nada de la bodega.
            </div>

            <div v-for="c in consumption" :key="c.key" class="ui-item ui-item-divided">
              <span />
              <span class="min-w-0">
                <span class="ui-item-title block capitalize" :title="c.name">{{ c.name }}</span>
                <span class="ui-item-desc">
                  hay {{ formatQty(c.inStock) }} {{ c.unit }}
                  <template v-if="c.short"> · <b>no alcanza</b></template>
                </span>
              </span>
              <span class="ui-item-trail">
                <span class="ui-item-num ui-num">
                  {{ formatQty(c.qty) }}<span class="ui-unit">{{ c.unit }}</span>
                </span>
              </span>
            </div>

            <div v-for="g in gaps" :key="g.key" class="ui-item ui-item-divided">
              <span />
              <span class="min-w-0">
                <span class="ui-item-title flex items-center gap-1.5 capitalize">
                  <AppTooltip class="shrink-0" :text="g.tip">
                    <PhWarning :size="14" weight="bold" role="img" :aria-label="g.tip" />
                  </AppTooltip>
                  <span class="min-w-0 truncate" :title="g.name">{{ g.name }}</span>
                </span>
                <span class="ui-item-desc">{{ g.text }}</span>
              </span>
              <span />
            </div>

            <p v-if="consumption.some((c) => c.short)" class="ui-item-desc mt-3">
              Puedes enviarlo igual: la bodega queda en negativo hasta que
              registres el ingreso o corrijas el conteo.
            </p>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
