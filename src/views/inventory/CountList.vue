<script setup>
/* Los conteos. The open one is pinned on top, because joining it is what you
 * usually came for; below it, every closed and discarded count. A discarded one
 * stays listed with who discarded it: a count dropped right after it showed a
 * big shortfall is exactly what an owner needs to see. */
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import PageHeader from '@/components/ui/PageHeader.vue';
import { useAuthenticationStore } from '@/stores/authentication';
import { useStockStore } from '@/stores/stockStore';
import { useWarehouses } from '@/composables/useWarehouses';
import { StockCountService } from '@/services/stockCountService';
import { formatMoney } from '@/utils/helpers';
import { formatDateDisplay } from '@/utils/dateUtils';

const router = useRouter();
const stockStore = useStockStore();
const service = new StockCountService(useAuthenticationStore().getBakeryId);
const { warehouses, multiWarehouse, defaultWarehouseId, warehouseName } = useWarehouses();

const counts = ref([]);
const loading = ref(true);
const error = ref('');
const starting = ref(false);
const warehouseId = ref(defaultWarehouseId.value);

onMounted(async () => {
  try {
    counts.value = await service.list();
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
});

const openCounts = computed(() => counts.value.filter((c) => c.status === 'open'));
const pastCounts = computed(() => counts.value.filter((c) => c.status !== 'open'));
const hasOpenIn = (id) => openCounts.value.some((c) => c.warehouseId === id);

const countableIn = (id) => stockStore.items.filter((s) => s.warehouseId === id).length;

/* Joins the bodega's open count if someone started one meanwhile. */
async function start() {
  starting.value = true;
  try {
    const count = await service.open(warehouseId.value);
    router.push(`/dashboard/inventory/conteos/${count.id}`);
  } catch (err) {
    error.value = err.message;
    starting.value = false;
  }
}

const dateOf = (count) =>
  formatDateDisplay(count.closedAt ?? count.createdAt, { year: 'numeric' });
</script>

<template>
  <div class="p-4 lg:p-6">
    <PageHeader title="Conteos" subtitle="Lo que hay en la bodega, contado a mano." />

    <div class="ui-app">
      <div class="ui-panes" style="--panes: minmax(0, 1fr)">
        <div class="ui-pane max-w-3xl w-full mx-auto">
          <div v-if="error" class="ui-empty mb-4">
            <b>Algo falló</b>
            {{ error }}
          </div>

          <div v-if="loading" class="ui-empty">Cargando conteos…</div>

          <template v-else>
            <div class="ui-sectionhead">En curso</div>

            <router-link
              v-for="count in openCounts" :key="count.id"
              :to="`/dashboard/inventory/conteos/${count.id}`"
              class="ui-item ui-item-divided"
            >
              <span />
              <span class="min-w-0">
                <span class="ui-item-title block">
                  Continuar · {{ count.counted }}/{{ countableIn(count.warehouseId) }}
                </span>
                <span class="ui-item-desc">
                  <template v-if="multiWarehouse">{{ warehouseName(count.warehouseId) }} · </template>
                  empezado {{ dateOf(count) }} por {{ count.createdBy?.name }}
                  <template v-if="count.counters.length"> · {{ count.counters.join(', ') }}</template>
                </span>
              </span>
              <span class="ui-item-trail">→</span>
            </router-link>

            <!-- One open count per bodega: with one bodega, Empezar only shows
                 when nothing is open. -->
            <div
              v-if="multiWarehouse || !openCounts.length"
              class="flex flex-wrap items-end gap-2 mt-2"
            >
              <div v-if="multiWarehouse" class="ui-field min-w-[10rem]">
                <label class="ui-field-k" for="count-warehouse">Bodega</label>
                <select id="count-warehouse" v-model="warehouseId" class="ui-input">
                  <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
                </select>
              </div>
              <button class="ui-btn ui-btn-solid" :disabled="starting" @click="start">
                {{ hasOpenIn(warehouseId) ? 'Unirse al conteo' : 'Empezar conteo' }}
              </button>
            </div>
            <div class="ui-sectionhead mt-6">Anteriores</div>

            <div v-if="!pastCounts.length" class="ui-empty">
              Todavía no hay conteos cerrados.
            </div>

            <router-link
              v-for="count in pastCounts" :key="count.id"
              :to="`/dashboard/inventory/conteos/${count.id}/revisar`"
              class="ui-item ui-item-divided"
            >
              <span />
              <span class="min-w-0">
                <span class="ui-item-title block">{{ dateOf(count) }}</span>
                <span class="ui-item-desc">
                  <template v-if="multiWarehouse">{{ warehouseName(count.warehouseId) }} · </template>
                  <template v-if="count.status === 'discarded'">
                    Descartado · por {{ count.closedBy?.name }} · {{ count.counted }} escritos
                  </template>
                  <template v-else>
                    {{ count.counted }} de {{ count.totalItems }} contados
                    <template v-if="count.counters.length"> · {{ count.counters.join(', ') }}</template>
                  </template>
                </span>
              </span>
              <span class="ui-item-trail ui-num">
                <template v-if="count.status === 'closed'">{{ formatMoney(count.netValue) }}</template>
              </span>
            </router-link>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
