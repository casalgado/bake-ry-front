<script setup>
/* Revisar: the only place a count closes. Open, it is live — numbers typed by
 * someone else arrive while you read. Closed, it is the frozen record: what the
 * system said, what was counted, what it cost, the bajas reported since the
 * last count. Discarded, it shows the rows that were typed and nothing else.
 *
 * Only counted rows appear. Flagged first, then by how much money moved; rows
 * with no difference fold away. An alert warns and never blocks: it rides on
 * the Cerrar button's label instead. */
import { ref, computed, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import PageHeader from '@/components/ui/PageHeader.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import { useAuthenticationStore } from '@/stores/authentication';
import { useStockStore } from '@/stores/stockStore';
import { useItemCatalog, itemOfStock } from '@/composables/useItemCatalog';
import { useWarehouses } from '@/composables/useWarehouses';
import { StockCountService } from '@/services/stockCountService';
import { formatMoney, formatQty, formatSignedQty } from '@/utils/helpers';
import { formatDateDisplay } from '@/utils/dateUtils';

// ponytail: one bakery-wide threshold. A per-item one becomes a field on the
// item when a client asks for it.
const ALERT_VALUE = 50000;
const STALE_HOURS = 12;

const route = useRoute();
const stockStore = useStockStore();
const catalog = useItemCatalog();
const { multiWarehouse, warehouseName } = useWarehouses();
const service = new StockCountService(useAuthenticationStore().getBakeryId);

const countId = route.params.id;
const count = ref(null);
const loaded = ref(false);
const error = ref('');
const closing = ref(false);
const showMatching = ref(false);

const stop = service.subscribeToCount(countId, (value) => {
  count.value = value;
  loaded.value = true;
}, (err) => {
  error.value = err.message;
  loaded.value = true;
});
onBeforeUnmount(stop);

const status = computed(() => count.value?.status);

const stockByKey = computed(() => new Map(stockStore.items
  .filter((s) => s.warehouseId === count.value?.warehouseId)
  .map((s) => [s.itemKey, s])));

const roundQty = (n) => Math.round(n * 1e6) / 1e6;
const signedMoney = (value) => `${value > 0 ? '+' : ''}${formatMoney(value)}`;

/* A row close has measured carries its frozen numbers; any other is live,
 * against the shelf and the catalog. A row with no cost reads "sin costo" and
 * is never flagged. */
const rows = computed(() => Object.entries(count.value?.items ?? {}).map(([itemKey, row]) => {
  const stock = stockByKey.value.get(itemKey);
  const item = stock ? itemOfStock(stock) : null;
  const frozen = row.diffQty !== undefined;

  const expected = frozen ? row.expectedQty : (stock?.currentStock ?? 0);
  const cost = frozen ? row.unitCost : (item ? catalog.costOf(item) : null);
  const diff = frozen ? row.diffQty : roundQty(row.qty - expected);
  const value = cost ? diff * cost : null;

  return {
    itemKey,
    name: (item && catalog.nameOf(item)) || row.name || stock?.name || itemKey,
    unit: row.unit ?? stock?.unit ?? '',
    qty: row.qty,
    by: row.by?.name,
    expected,
    diff,
    cost,
    value,
    waste: row.wasteSinceBaseline ?? 0,
    flagged: value !== null && Math.abs(value) >= ALERT_VALUE,
  };
}));

const changed = computed(() => rows.value
  .filter((row) => row.diff !== 0)
  .sort((a, b) => (b.flagged - a.flagged)
    || Math.abs(b.value ?? 0) - Math.abs(a.value ?? 0)
    || Math.abs(b.diff) - Math.abs(a.diff)));
const matching = computed(() => rows.value.filter((row) => row.diff === 0));

const total = computed(() =>
  (status.value === 'closed' ? count.value.totalItems : stockByKey.value.size));
const uncounted = computed(() => Math.max(0, total.value - rows.value.length));

const sumOf = (list, pick) => list.reduce((sum, row) => sum + (pick(row) || 0), 0);
const shortfall = computed(() => sumOf(changed.value, (r) => (r.value < 0 ? -r.value : 0)));
const surplus = computed(() => sumOf(changed.value, (r) => (r.value > 0 ? r.value : 0)));
const alerts = computed(() => changed.value.filter((row) => row.flagged).length);

/* Bajas already lowered the stock before the count, so everything the count
 * finds is unexplained. */
const wasteValue = computed(() => sumOf(rows.value, (r) => (r.cost ? -r.waste * r.cost : 0)));
const foundValue = computed(() => surplus.value - shortfall.value);

const hoursOpen = computed(() =>
  (count.value?.createdAt ? Math.floor((Date.now() - count.value.createdAt) / 3600000) : 0));

const closeLabel = computed(() => (alerts.value
  ? `Cerrar conteo con ${alerts.value} alerta${alerts.value === 1 ? '' : 's'}`
  : 'Cerrar conteo'));

const endedLabel = computed(() => ({
  discarded: 'Descartado',
  closing: 'Cerrando',
}[status.value] ?? 'Cerrado'));

/* Asks first: closing sets each counted item's stock to what was typed. Once it
 * closes, the listener turns this page into the frozen view. A count stuck in
 * `closing` (the connection dropped mid-close) is finished by closing again. */
const confirmingClose = ref(false);

const closeQuestion = computed(() => {
  if (status.value === 'closing') return 'El cierre continuará donde se detuvo.';
  const n = rows.value.length;
  return `La existencia de ${n} artículo${n === 1 ? '' : 's'} pasa a ser lo que se contó. Los demás no cambian.`;
});

async function close() {
  closing.value = true;
  try {
    await service.close(countId);
    error.value = '';
  } catch (err) {
    error.value = err.message;
  } finally {
    closing.value = false;
    confirmingClose.value = false;
  }
}
</script>

<template>
  <div class="p-4 lg:p-6">
    <PageHeader
      :title="status === 'open' ? 'Revisar conteo' : 'Conteo'"
      :subtitle="count?.closedAt
        ? `${endedLabel} el ${formatDateDisplay(count.closedAt, { year: 'numeric' })} por ${count.closedBy?.name}`
        : ''"
    >
      <router-link class="ui-btn" to="/dashboard/inventory/conteos">Conteos</router-link>
    </PageHeader>

    <div class="ui-app">
      <div class="ui-panes" style="--panes: minmax(0, 1fr)">
        <div class="ui-pane max-w-3xl w-full mx-auto">
          <div v-if="!loaded" class="ui-empty">Cargando conteo…</div>
          <div v-else-if="!count" class="ui-empty">
            <b>{{ error ? 'No se pudo abrir el conteo' : 'Este conteo no existe' }}</b>
            {{ error }}
          </div>

          <!-- Discarded: what was typed, who typed it. Nothing was compared. -->
          <template v-else-if="status === 'discarded'">
            <div v-if="!rows.length" class="ui-empty">Sin artículos contados.</div>
            <div v-for="row in rows" :key="row.itemKey" class="ui-item ui-item-divided">
              <span />
              <span class="min-w-0">
                <span class="ui-item-title block capitalize">{{ row.name }}</span>
                <span class="ui-item-desc">{{ row.by }}</span>
              </span>
              <span class="ui-item-trail ui-num">{{ formatQty(row.qty) }} {{ row.unit }}</span>
            </div>
          </template>

          <template v-else>
            <p v-if="multiWarehouse" class="ui-panehead-sub mb-2">{{ warehouseName(count.warehouseId) }}</p>

            <div v-if="status === 'open' && hoursOpen >= STALE_HOURS" class="ui-empty mb-4" style="padding-block: 12px">
              <b>Abierto hace {{ hoursOpen }} h</b>
              Las ventas de este periodo se reflejan como diferencia del conteo.
            </div>

            <div class="flex flex-wrap gap-x-7 gap-y-3 mb-5">
              <span class="ui-stat">
                <span class="ui-stat-k">Contados</span>
                <span class="ui-stat-v">{{ rows.length }}</span>
              </span>
              <span class="ui-stat">
                <span class="ui-stat-k">Sin contar (no cambian)</span>
                <span class="ui-stat-v">{{ uncounted }}</span>
              </span>
              <span class="ui-stat">
                <span class="ui-stat-k">Con diferencia</span>
                <span class="ui-stat-v">{{ changed.length }}</span>
              </span>
              <span class="ui-stat">
                <span class="ui-stat-k">Faltante</span>
                <span class="ui-stat-v">{{ formatMoney(shortfall) }}</span>
              </span>
              <span class="ui-stat">
                <span class="ui-stat-k">Sobrante</span>
                <span class="ui-stat-v">{{ formatMoney(surplus) }}</span>
              </span>
            </div>

            <p v-if="status === 'closed'" class="ui-item-desc mb-4">
              Desde el último conteo: bajas registradas {{ formatMoney(wasteValue) }}
              · diferencia sin explicar {{ signedMoney(foundValue) }}.
            </p>

            <div v-if="!rows.length" class="ui-empty">
              <b>Sin artículos contados</b>
            </div>

            <div
              v-for="row in changed" :key="row.itemKey"
              class="ui-item ui-item-divided"
            >
              <span>
                <span v-if="row.flagged" class="ui-tag" data-accent="berry">alerta</span>
              </span>
              <span class="min-w-0">
                <span class="ui-item-title block capitalize">{{ row.name }}</span>
                <span class="ui-item-desc">
                  sistema {{ formatQty(row.expected) }} · contado {{ formatQty(row.qty) }}
                  <template v-if="row.by"> · {{ row.by }}</template>
                  <template v-if="status === 'closed' && row.waste"> · bajas {{ formatQty(-row.waste) }}</template>
                </span>
              </span>
              <span class="ui-item-trail flex-col items-end">
                <span class="ui-num">{{ formatSignedQty(row.diff) }} {{ row.unit }}</span>
                <span class="ui-item-meta">{{ row.value === null ? 'sin costo' : signedMoney(row.value) }}</span>
              </span>
            </div>

            <template v-if="matching.length">
              <button
                class="ui-btn mt-3"
                :aria-expanded="showMatching"
                @click="showMatching = !showMatching"
              >
                {{ showMatching ? 'Ocultar' : 'Mostrar' }} {{ matching.length }} sin diferencia
              </button>
              <template v-if="showMatching">
                <div v-for="row in matching" :key="row.itemKey" class="ui-item ui-item-divided">
                  <span />
                  <span class="min-w-0">
                    <span class="ui-item-title block capitalize">{{ row.name }}</span>
                    <span class="ui-item-desc">
                      contado {{ formatQty(row.qty) }}
                      <template v-if="row.by"> · {{ row.by }}</template>
                    </span>
                  </span>
                  <span class="ui-item-trail ui-item-meta">sin diferencia</span>
                </div>
              </template>
            </template>

            <p v-if="error" class="ui-field-error mt-3">{{ error }}</p>

            <div v-if="status === 'closing'" class="ui-empty mt-5" style="padding-block: 12px">
              <b>Cerrando el conteo…</b>
              Si el proceso no termina, continuará donde se detuvo.
              <button class="ui-btn ui-btn-solid mt-2" :disabled="closing" @click="confirmingClose = true">
                Terminar de cerrar
              </button>
            </div>

            <div v-if="status === 'open'" class="flex flex-wrap items-center justify-between gap-1.5 mt-5">
              <router-link class="ui-btn" :to="`/dashboard/inventory/conteos/${countId}`">
                ← Volver al conteo
              </router-link>
              <button
                class="ui-btn ui-btn-solid"
                :disabled="closing || !rows.length"
                @click="confirmingClose = true"
              >
                {{ closeLabel }}
              </button>
            </div>

            <ConfirmDialog
              :is-open="confirmingClose"
              :title="status === 'closing' ? 'Terminar de cerrar el conteo' : 'Cerrar conteo'"
              :message="closeQuestion"
              :confirm-text="status === 'closing' ? 'Terminar' : 'Cerrar conteo'"
              cancel-text="Volver"
              :loading="closing"
              @confirm="close"
              @cancel="confirmingClose = false"
            />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
