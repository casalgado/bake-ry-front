<script setup>
/* El conteo. One column, because there is nothing to take from: the bodega IS
 * the document. You write what is on the shelf and the system works out the
 * difference — never the other way round. There is no "diferencia" field to
 * type into, and that is the whole design.
 *
 * The expected quantity appears only AFTER you have entered a count. Showing it
 * first anchors the counter to the number the system already believes, which is
 * exactly the error a physical count exists to catch.
 *
 * The item list is not stored on the document: it is whatever the bodega holds
 * right now, so a count opened before the stocks finished loading still fills
 * in, and nothing goes stale.
 *
 * The count itself lives in inventoryDocsStore, so walking away to look
 * something up and coming back finds it where you left it. */
import { ref, computed } from 'vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import UiSearchField from '@/components/ui/UiSearchField.vue';
import { useStockStore } from '@/stores/stockStore';
import { useInventoryDocsStore } from '@/stores/inventoryDocsStore';
import { useItemCatalog, itemOfStock, SHELF_TITLES } from '@/composables/useItemCatalog';
import { useWarehouses } from '@/composables/useWarehouses';
import { formatQty, formatSignedQty } from '@/utils/helpers';

const stockStore = useStockStore();
const docsStore = useInventoryDocsStore();
const catalog = useItemCatalog();
const { warehouses, multiWarehouse, defaultWarehouseId } = useWarehouses();

// Idempotent: reopening the screen returns the count you left, never a new one.
docsStore.open('conteo', defaultWarehouseId.value);
const doc = computed(() => docsStore.docs.conteo);

const search = ref('');

/* A count is scoped to ONE bodega — you physically count one place at a time. */
const allRows = computed(() =>
  stockStore.items
    .filter((s) => s.warehouseId === doc.value.warehouseId)
    .map((stock) => {
      const item = itemOfStock(stock);
      return {
        itemKey: stock.itemKey,
        name: catalog.nameOf(item) || stock.name,
        unit: stock.unit,
        expected: stock.currentStock || 0,
        kind: catalog.kindOf(item),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name)));

/* The search narrows what you SEE. Every total below counts the whole bodega:
 * hiding rows must never make a count look further along than it is. */
const items = computed(() => {
  const q = search.value.trim().toLowerCase();
  return q ? allRows.value.filter((row) => row.name.toLowerCase().includes(q)) : allRows.value;
});

const shelves = computed(() =>
  Object.entries(SHELF_TITLES)
    .map(([key, title]) => ({
      key,
      title,
      items: items.value.filter((row) => row.kind === key),
    }))
    .filter((shelf) => shelf.items.length));

const countedOf = (itemKey) => doc.value.counted[itemKey];
const isCounted = (itemKey) => countedOf(itemKey) !== undefined;

const differenceOf = (row) =>
  isCounted(row.itemKey) ? countedOf(row.itemKey) - row.expected : null;

/* An empty box means "not counted", which is not the same as counting zero —
 * a partial count leaves the items it skipped exactly as they were. So the key
 * is removed rather than set to 0. */
function setCounted(itemKey, value) {
  const next = { ...doc.value.counted };

  if (String(value).trim() === '') {
    delete next[itemKey];
  } else {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    /* You cannot find minus three bags of flour on a shelf. `min="0"` on the
     * input only constrains the spinner — this field is in no <form> and nothing
     * calls checkValidity() — so the refusal has to live here. Dropping the key
     * rather than returning early makes it visible: the row goes back to "sin
     * contar" and the bound '' patches over what was typed. */
    if (n < 0) {
      delete next[itemKey];
    } else {
      next[itemKey] = n;
    }
  }

  doc.value.counted = next;
}

const total = computed(() => allRows.value.length);
const done = computed(() => Object.keys(doc.value.counted).length);
const fill = computed(() => (total.value ? Math.round(done.value / total.value * 100) : 0));

/* What will actually move when this closes. A counted item whose number matches
 * what the system believed writes nothing — it is not an adjustment. */
const changes = computed(() =>
  allRows.value.filter((row) => isCounted(row.itemKey) && differenceOf(row) !== 0).length);

/* A count is scoped to ONE bodega, so its numbers cannot follow you to another:
 * `counted` is keyed by itemKey alone, and left alone it would count items you
 * tallied in Principal against Bodega 2's item list — done could exceed total
 * and every difference would compare one place's shelf to another's ledger.
 *
 * Resetting the <select> on cancel is not optional: the DOM value has already
 * changed by the time we are asked, and re-rendering the same bound value patches
 * nothing, so the box would sit on a bodega the document is not using. */
function changeWarehouse(event) {
  const next = event.target.value;
  if (next === doc.value.warehouseId) return;

  if (done.value &&
      !confirm(`Un conteo es de una sola bodega. Se perderán los ${done.value} artículo(s) que ya contaste. ¿Cambiar de bodega?`)) {
    event.target.value = doc.value.warehouseId;
    return;
  }

  doc.value.counted = {};
  doc.value.warehouseId = next;
}

/* The tab rail's ×, now that there is no rail.
 * ponytail: native confirm(), same ruling as RecipeBookView.vue:790. */
function discard() {
  if (!done.value) return;
  if (!confirm(`Se perderán los ${done.value} artículo(s) que ya contaste. ¿Descartar el conteo?`)) return;

  /* Reopen on the bodega you were counting, not the default one: discarding the
   * numbers is what you asked for, being moved to another bodega is not. */
  const { warehouseId } = doc.value;
  docsStore.discard('conteo');
  docsStore.open('conteo', warehouseId);
}
</script>

<template>
  <PageHeader title="Conteo" subtitle="Escribe lo que hay, no la diferencia." />

  <div class="ui-app">
    <!-- One column: there is nothing to take from, the bodega IS the document.
         Capped and centred so a row's name and its input stay in one glance
         instead of at opposite ends of a wide screen. -->
    <div class="ui-panes" style="--panes: minmax(0, 1fr)">
      <div class="ui-pane max-w-3xl w-full mx-auto">
        <div class="flex flex-wrap items-end gap-2 mb-4">
          <label v-if="multiWarehouse" class="ui-field min-w-[10rem]">
            <span class="ui-field-k">Bodega</span>
            <select
              class="ui-input"
              :value="doc.warehouseId"
              @change="changeWarehouse($event)"
            >
              <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
            </select>
          </label>

          <label class="ui-field min-w-[9rem]">
            <span class="ui-field-k">Fecha</span>
            <input
              class="ui-input"
              type="date"
              :value="doc.date"
              @input="doc.date = $event.target.value"
            >
          </label>

          <label class="ui-field flex-1 min-w-[10rem]">
            <span class="ui-field-k">Responsable</span>
            <input
              class="ui-input"
              type="text"
              :value="doc.party"
              @input="doc.party = $event.target.value"
            >
          </label>
        </div>

        <div class="mb-5">
          <div class="ui-bar" :style="{ '--fill': fill + '%' }" />
          <div class="flex items-baseline justify-between gap-3 mt-1.5 ui-panehead-sub">
            <span>Artículos contados</span>
            <b class="ui-num">{{ done }} / {{ total }}</b>
          </div>
        </div>

        <UiSearchField
          v-model="search"
          class="mb-4"
          placeholder="Buscar artículo…"
          label="Buscar artículo"
        />

        <div v-if="!total" class="ui-empty">
          <b>Esta bodega está vacía</b>
          No hay nada que contar todavía.
        </div>
        <div v-else-if="!items.length" class="ui-empty">
          Nada coincide con esa búsqueda.
        </div>

        <div v-for="shelf in shelves" :key="shelf.key" class="mb-4">
          <div class="ui-sectionhead">{{ shelf.title }}</div>

          <div
            v-for="row in shelf.items" :key="row.itemKey"
            class="ui-item ui-item-divided"
          >
            <span />
            <span class="min-w-0">
              <span class="ui-item-title block capitalize">{{ row.name }}</span>
              <!-- Only after entry: the expected number before it would anchor
                   the count to what the system already believes. -->
              <!-- The reassuring case is the common one, so it gets words
                   rather than a zero you have to read as "fine". Same thing
                   `changes` says by excluding it. -->
              <span v-if="isCounted(row.itemKey)" class="ui-item-desc">
                el sistema decía {{ formatQty(row.expected) }} {{ row.unit }}
                ·
                <template v-if="differenceOf(row) === 0">sin diferencia</template>
                <template v-else>diferencia {{ formatSignedQty(differenceOf(row)) }}</template>
              </span>
              <span v-else class="ui-item-desc">sin contar</span>
            </span>

            <span class="ui-item-trail">
              <input
                class="ui-input ui-input-num w-[6rem]"
                type="number" min="0" step="any"
                placeholder="—"
                :value="countedOf(row.itemKey) ?? ''"
                :aria-label="'Cantidad contada de ' + row.name"
                @input="setCounted(row.itemKey, $event.target.value)"
              >
              <span class="ui-item-meta w-8 shrink-0">{{ row.unit }}</span>
            </span>
          </div>
        </div>

        <div
          class="flex flex-wrap items-baseline justify-between gap-x-7 gap-y-3 mt-4 pt-3.5"
          style="border-top: 1px solid var(--ui-line)"
        >
          <span class="ui-stat">
            <span class="ui-stat-k">Artículos que se moverán</span>
            <span class="ui-stat-v">{{ changes }}</span>
          </span>
        </div>

        <p class="ui-item-desc mt-2">
          Contaste {{ done }} de {{ total }} artículos — los demás se quedan como
          están.
        </p>

        <!-- ponytail: Confirmar stays disabled — el borrador y el cierre viven en
             el servidor y llegan en el commit 4 (EXISTENCIAS-BUILD.md §4.3) como
             POST /stockCounts. Cerrar un conteo pone baselineQty y un movimiento
             `count` por artículo en una sola transacción; no hay forma honesta de
             imitar eso desde aquí, y un ajuste por diferencia escribiría el tipo
             de movimiento equivocado en un libro que no se puede reescribir. -->
        <div class="flex flex-wrap items-center gap-1.5 mt-4">
          <button class="ui-btn ui-btn-solid" disabled>Cerrar conteo</button>
          <button class="ui-btn ui-btn-danger" :disabled="!done" @click="discard">
            Descartar
          </button>
        </div>
        <p class="ui-item-desc mt-2">
          Todavía no se puede cerrar: falta <code>POST /stockCounts</code> en el
          servidor. Mientras tanto el conteo vive solo en esta pestaña — recargar
          la página lo borra.
        </p>
      </div>
    </div>
  </div>
</template>
