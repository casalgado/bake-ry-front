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
 * The count lives on the server and several people type into it at once: each
 * row is saved on its own, and what the box shows is the server's number unless
 * you are typing in it. Two people on one row: the latest number wins, and the
 * row says who wrote it. There is no submit here; closing happens on Revisar. */
import { ref, reactive, computed, watch, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageHeader from '@/components/ui/PageHeader.vue';
import UiSearchField from '@/components/ui/UiSearchField.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import { useAuthenticationStore } from '@/stores/authentication';
import { useStockStore } from '@/stores/stockStore';
import { useItemCatalog, itemOfStock, SHELF_TITLES } from '@/composables/useItemCatalog';
import { useWarehouses } from '@/composables/useWarehouses';
import { StockCountService } from '@/services/stockCountService';
import { formatQty, formatSignedQty } from '@/utils/helpers';

const SAVE_DELAY_MS = 400;

const route = useRoute();
const router = useRouter();
const stockStore = useStockStore();
const catalog = useItemCatalog();
const { multiWarehouse, warehouseName } = useWarehouses();
const service = new StockCountService(useAuthenticationStore().getBakeryId);

const countId = route.params.id;
const count = ref(null);
const loaded = ref(false);
const error = ref('');

const stop = service.subscribeToCount(countId, (value) => {
  count.value = value;
  loaded.value = true;
}, (err) => {
  error.value = err.message;
  loaded.value = true;
});

/* A closed or discarded count is read on Revisar, never typed into. */
watch(() => count.value?.status, (status) => {
  if (status && status !== 'open') router.replace(`/dashboard/inventory/conteos/${countId}/revisar`);
});

const search = ref('');

/* A count is scoped to ONE bodega — you physically count one place at a time. */
const allRows = computed(() => {
  if (!count.value) return [];
  return stockStore.items
    .filter((s) => s.warehouseId === count.value.warehouseId)
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
    .sort((a, b) => a.name.localeCompare(b.name));
});

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

const rowOf = (itemKey) => count.value?.items[itemKey];

const differenceOf = (row) => {
  const counted = rowOf(row.itemKey);
  return counted ? counted.qty - row.expected : null;
};

/* What you are typing, per row, until the server has it. Without it the
 * listener would write the saved value back under your cursor mid-number. */
const drafts = reactive({});
const timers = new Map();
/* Rows whose last save failed. Their draft stays in the box and the row says
 * so; typing again retries. */
const failed = reactive(new Set());
/* Rows holding a number a shelf cannot have (below 0). Nothing is sent for them
 * and the row keeps its saved value; fixing the box clears the flag. */
const invalid = reactive(new Set());
/* Saves on their way, so leaving can wait for them. */
const inFlight = new Set();

const shownValue = (itemKey) => drafts[itemKey] ?? rowOf(itemKey)?.qty ?? '';

/* An empty box means "not counted", which is not the same as counting zero —
 * a partial count leaves the items it skipped exactly as they were. So it
 * clears the row rather than saving 0. You cannot find minus three bags of flour
 * on a shelf either: `min="0"` only constrains the spinner, so a negative is
 * refused and said so, never turned into a cleared row. */
function save(itemKey) {
  timers.delete(itemKey);
  const typed = drafts[itemKey];
  if (typed === undefined) return Promise.resolve();

  const n = Number(typed);
  const blank = String(typed).trim() === '' || !Number.isFinite(n);
  if (!blank && n < 0) {
    invalid.add(itemKey);
    return Promise.resolve();
  }
  invalid.delete(itemKey);

  const request = (async () => {
    try {
      await service.setItem(countId, itemKey, blank ? null : n);
      failed.delete(itemKey);
      // Typed again while this one was in flight: that one saves next.
      if (drafts[itemKey] === typed) delete drafts[itemKey];
    } catch {
      failed.add(itemKey);
    }
  })();

  inFlight.add(request);
  request.finally(() => inFlight.delete(request));
  return request;
}

function onInput(itemKey, value) {
  drafts[itemKey] = value;
  invalid.delete(itemKey);
  clearTimeout(timers.get(itemKey));
  timers.set(itemKey, setTimeout(() => save(itemKey), SAVE_DELAY_MS));
}

/* Every number typed so far reaches the server: the ones still waiting out the
 * delay, the ones whose save failed, and the ones on their way. */
async function flush() {
  new Set([...timers.keys(), ...failed]).forEach((itemKey) => {
    clearTimeout(timers.get(itemKey));
    save(itemKey);
  });
  await Promise.all([...inFlight]);
}

/* Revisar waits for the flush: a number saved after the count closes is refused
 * and would be lost without a word. */
const leaving = ref(false);
async function goReview() {
  error.value = '';
  leaving.value = true;
  await flush();
  leaving.value = false;

  if (failed.size || invalid.size) {
    error.value = 'Hay cantidades sin guardar. Corregir antes de revisar.';
    return;
  }
  router.push(`/dashboard/inventory/conteos/${countId}/revisar`);
}

/* Leaving any other way (the sidebar): one more try, best effort. */
onBeforeUnmount(() => {
  stop();
  flush();
});

const total = computed(() => allRows.value.length);
const done = computed(() => allRows.value.filter((row) => rowOf(row.itemKey)).length);
const fill = computed(() => (total.value ? Math.round(done.value / total.value * 100) : 0));

const counters = computed(() =>
  [...new Set(Object.values(count.value?.items ?? {}).map((row) => row.by?.name).filter(Boolean))]);

const confirmingDiscard = ref(false);
const discarding = ref(false);

async function discard() {
  discarding.value = true;
  try {
    await service.discard(countId);
    router.push('/dashboard/inventory/conteos');
  } catch (err) {
    error.value = err.message;
    confirmingDiscard.value = false;
  } finally {
    discarding.value = false;
  }
}
</script>

<template>
  <div class="p-4 lg:p-6">
    <PageHeader title="Conteo">
      <router-link class="ui-btn" to="/dashboard/inventory/conteos">Conteos</router-link>
    </PageHeader>

    <div class="ui-app">
      <!-- One column: there is nothing to take from, the bodega IS the document.
           Capped and centred so a row's name and its input stay in one glance
           instead of at opposite ends of a wide screen. -->
      <div class="ui-panes" style="--panes: minmax(0, 1fr)">
        <div class="ui-pane max-w-3xl w-full mx-auto">
          <div v-if="!loaded" class="ui-empty">Cargando conteo…</div>
          <div v-else-if="!count" class="ui-empty">
            <b>{{ error ? 'No se pudo abrir el conteo' : 'Este conteo no existe' }}</b>
            {{ error }}
            <router-link to="/dashboard/inventory/conteos">Volver a los conteos</router-link>
          </div>

          <template v-else>
            <div class="mb-5">
              <div class="ui-bar" :style="{ '--fill': fill + '%' }" />
              <div class="flex items-baseline justify-between gap-3 mt-1.5 ui-panehead-sub">
                <span>
                  <template v-if="multiWarehouse">{{ warehouseName(count.warehouseId) }} · </template>
                  {{ counters.length ? counters.join(', ') : 'Sin conteos registrados' }}
                </span>
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
              <b>Bodega sin artículos</b>
            </div>
            <div v-else-if="!items.length" class="ui-empty">
              Sin resultados.
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
                  <span v-if="failed.has(row.itemKey)" class="ui-field-error block">
                    No se guardó. Ingresar el valor de nuevo.
                  </span>
                  <span v-else-if="invalid.has(row.itemKey)" class="ui-field-error block">
                    Valor inválido: debe ser 0 o mayor.
                  </span>
                  <!-- Only after entry: the expected number before it would anchor
                       the count to what the system already believes. -->
                  <span v-if="rowOf(row.itemKey)" class="ui-item-desc">
                    contado por {{ rowOf(row.itemKey).by?.name }}
                    · sistema: {{ formatQty(row.expected) }}
                    ·
                    <template v-if="differenceOf(row) === 0">sin diferencia</template>
                    <template v-else>{{ formatSignedQty(differenceOf(row)) }}</template>
                  </span>
                  <span v-else class="ui-item-desc">sin contar</span>
                </span>

                <span class="ui-item-trail">
                  <input
                    class="ui-input ui-input-num w-[6rem]"
                    type="number" min="0" step="any"
                    placeholder="—"
                    :value="shownValue(row.itemKey)"
                    :aria-label="'Cantidad contada de ' + row.name"
                    @input="onInput(row.itemKey, $event.target.value)"
                  >
                  <span class="ui-item-meta w-6 shrink-0">{{ row.unit }}</span>
                </span>
              </div>
            </div>

            <p class="ui-item-desc mt-4">
              {{ done }} de {{ total }} artículos contados. Los no contados conservan
              su existencia. Los cambios se guardan automáticamente.
            </p>
            <p v-if="error" class="ui-field-error mt-2">{{ error }}</p>

            <div class="flex flex-wrap items-center gap-1.5 mt-4">
              <button class="ui-btn ui-btn-solid" :disabled="leaving" @click="goReview">
                {{ leaving ? 'Guardando…' : 'Revisar →' }}
              </button>
              <button class="ui-btn ui-btn-danger" @click="confirmingDiscard = true">Descartar</button>
            </div>

            <ConfirmDialog
              :is-open="confirmingDiscard"
              title="Descartar conteo"
              message="Al descartar, el conteo se cierra para todos sin modificar existencias."
              confirm-text="Descartar"
              cancel-text="Volver"
              :loading="discarding"
              @confirm="discard"
              @cancel="confirmingDiscard = false"
            />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
