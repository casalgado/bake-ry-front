<script setup>
import { ref, computed, onMounted } from 'vue';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { useOrderStore } from '@/stores/orderStore';
import { formatMoney } from '@/utils/helpers';
import { formatDateDisplay } from '@/utils/dateUtils';
import { PhSpinner } from '@phosphor-icons/vue';
import ClientHistoryModal from '@/components/orders/ClientHistoryModal.vue';

const bakerySettingsStore = useBakerySettingsStore();
const orderStore = useOrderStore();

const filters = ref({
  period: 'monthly',
  count: 6,
  segment: 'b2c',
  dateField: 'dueDate',
});

const report = ref(null);
const loading = ref(false);
const error = ref(null);
const activeTab = ref('nuevos');
const selectedBucket = ref('caido');
const historyClient = ref(null);
const sortKey = ref('orderCount');
const sortDir = ref('desc');

const periodOptions = [
  { value: 'weekly', label: 'Semanas' },
  { value: 'biweekly', label: 'Quincenas' },
  { value: 'monthly', label: 'Meses' },
];
const countOptions = [4, 6, 8, 12];
const segmentOptions = [
  { value: 'b2b', label: 'B2B' },
  { value: 'b2c', label: 'B2C' },
];
const dateFieldOptions = [
  { value: 'dueDate', label: 'Fecha de Pedido' },
  { value: 'paymentDate', label: 'Fecha de Pago' },
];

// completePlural carries its own adjective: "semanas completas" but "meses completos".
const periodUnits = {
  weekly: { singular: 'semana', plural: 'semanas', completePlural: 'semanas completas' },
  biweekly: { singular: 'quincena', plural: 'quincenas', completePlural: 'quincenas completas' },
  monthly: { singular: 'mes', plural: 'meses', completePlural: 'meses completos' },
};

const unitsFor = (period) =>
  periodUnits[period] || { singular: period, plural: period, completePlural: period };

const bucketOrder = ['estrella', 'futuraEstrella', 'reactivado', 'intermitente', 'caido', 'perdido'];
const bucketLabels = {
  estrella: 'Estrellas',
  futuraEstrella: 'Futuras Estrellas',
  reactivado: 'Reactivados',
  intermitente: 'Intermitentes',
  caido: 'Caídos',
  perdido: 'Perdidos',
};

const generate = async () => {
  loading.value = true;
  error.value = null;
  try {
    const query = {
      filters: {
        period: filters.value.period,
        count: filters.value.count,
        segment: filters.value.segment,
        date_field: filters.value.dateField,
      },
    };
    const result = await orderStore.getClientReport(query);
    if (!result?.kpis || !result?.periods || !result?.buckets || !result?.nuevosPorPeriodo) {
      throw new Error('Respuesta del servidor inválida.');
    }
    report.value = result;
    activeTab.value = 'nuevos';
    selectedBucket.value = 'caido';
    sortKey.value = 'orderCount';
    sortDir.value = 'desc';
  } catch (err) {
    error.value = err.message || 'Error al obtener el reporte de persistencia';
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  try {
    await bakerySettingsStore.fetchById('default');
    const defaultFilter = bakerySettingsStore.currentItem?.features?.reports?.defaultReportFilter;
    if (defaultFilter) {
      filters.value.dateField = defaultFilter;
    }
  } catch {
    // Settings only provide a default date field; fall back to dueDate.
  }
});

const rangeBarText = computed(() => {
  if (!report.value) return '';
  const { meta } = report.value;
  const dateOpts = { day: 'numeric', month: 'short', year: 'numeric' };
  const range = `${formatDateDisplay(meta.rangeStart, dateOpts)} → ${formatDateDisplay(meta.rangeEnd, dateOpts)}`;
  return `${meta.count} ${unitsFor(meta.period).plural} · ${range}`;
});

const kpiCards = computed(() => {
  if (!report.value) return [];
  const { kpis, meta } = report.value;
  const newPct = kpis.activeClients > 0 ? Math.round(100 * kpis.newClients / kpis.activeClients) : null;
  const units = unitsFor(meta.period);
  return [
    { key: 'clientes', label: 'CLIENTES', value: kpis.activeClients },
    { key: 'nuevos', label: 'NUEVOS', value: newPct !== null ? `${kpis.newClients} (${newPct}%)` : kpis.newClients },
    { key: 'promedio', label: 'PROMEDIO NUEVOS', value: kpis.avgNewPerPeriod, caption: `Clientes nuevos por ${units.singular}, promediando solo ${units.completePlural}.` },
    { key: 'recurrentes', label: '% RECURRENTES', value: kpis.returningPct !== null ? `${kpis.returningPct}%` : '—' },
  ];
});

const nuevosPeriodsReversed = computed(() => {
  if (!report.value) return [];
  return report.value.periods
    .map((period, index) => ({ period, entry: report.value.nuevosPorPeriodo[index] }))
    .reverse();
});

// Clients whose first-ever order landed in the still-open period. The backend
// keeps them out of the buckets (they have no complete-period history to
// classify), so they get their own card here. Mapped to the bucket row shape:
// no vector, and the partial dot is filled by definition.
const nuevosClients = computed(() => {
  if (!report.value) return [];
  const partial = report.value.nuevosPorPeriodo[report.value.nuevosPorPeriodo.length - 1];
  return (partial?.clients || []).map(c => ({
    userId: c.userId,
    name: c.name,
    rangeTotal: c.total,
    orderCount: c.orderCount,
    lastOrderDate: c.lastOrderDate,
    vector: '',
    orderedInPartial: true,
  }));
});

const bucketSummaries = computed(() => {
  if (!report.value) return [];
  const summaries = bucketOrder.map(key => {
    const clients = report.value.buckets[key] || [];
    return {
      key,
      label: bucketLabels[key],
      count: clients.length,
      total: clients.reduce((sum, c) => sum + (c.rangeTotal || 0), 0),
    };
  });
  summaries.unshift({
    key: 'nuevos',
    label: 'Recién Llegados',
    count: nuevosClients.value.length,
    total: nuevosClients.value.reduce((sum, c) => sum + (c.rangeTotal || 0), 0),
  });
  return summaries;
});

const selectedBucketClients = computed(() => {
  if (!report.value) return [];
  if (selectedBucket.value === 'nuevos') return nuevosClients.value;
  return report.value.buckets[selectedBucket.value] || [];
});

const clientColumns = [
  { key: 'name', label: 'Cliente', align: 'left', type: 'text' },
  { key: 'rangeTotal', label: 'Total', align: 'right' },
  { key: 'orderCount', label: 'Pedidos', align: 'right' },
  { key: 'lastOrderDate', label: 'Última orden', align: 'left', type: 'date' },
];

const setSort = (key) => {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = key;
    sortDir.value = 'desc';
  }
};

const sortedBucketClients = computed(() => {
  const rows = [...selectedBucketClients.value];
  const dir = sortDir.value === 'asc' ? 1 : -1;
  const type = clientColumns.find(c => c.key === sortKey.value)?.type;
  rows.sort((a, b) => {
    const av = a[sortKey.value];
    const bv = b[sortKey.value];
    if (type === 'text') return String(av || '').localeCompare(String(bv || '')) * dir;
    if (type === 'date') return (new Date(av) - new Date(bv)) * dir;
    return ((av || 0) - (bv || 0)) * dir;
  });
  return rows;
});

const formatPeriodRange = (period) => {
  const opts = { day: 'numeric', month: 'short' };
  return `${formatDateDisplay(period.start, opts)} – ${formatDateDisplay(period.end, opts)}`;
};

// 'always' so day 2 reads "hace 2 días" rather than "anteayer"; 0 and 1 are spelled out.
const relativeTime = new Intl.RelativeTimeFormat('es', { numeric: 'always' });

const relativeFromNow = (dateValue) => {
  const diffDays = Math.floor((Date.now() - new Date(dateValue).getTime()) / 86400000);
  if (diffDays <= 0) return 'hoy';
  if (diffDays === 1) return 'ayer';
  if (diffDays < 7) return relativeTime.format(-diffDays, 'day');
  if (diffDays < 35) return relativeTime.format(-Math.floor(diffDays / 7), 'week');
  if (diffDays < 365) return relativeTime.format(-Math.floor(diffDays / 30), 'month');
  return relativeTime.format(-Math.floor(diffDays / 365), 'year');
};

const openHistory = (client) => {
  historyClient.value = { userId: client.userId, name: client.name };
};

const closeHistory = () => {
  historyClient.value = null;
};
</script>

<template>
  <div class="container p-2 sm:p-4 px-2 lg:px-4">
    <h2 class="text-lg sm:text-2xl font-bold text-neutral-800 mb-4">
      Comportamiento Clientes
    </h2>

    <div class="base-card flex flex-wrap items-end gap-3">
      <div>
        <label class="block text-xs text-neutral-500 mb-1">Periodo</label>
        <select v-model="filters.period" class="form-input">
          <option v-for="opt in periodOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </div>
      <div>
        <label class="block text-xs text-neutral-500 mb-1">Cantidad</label>
        <select v-model.number="filters.count" class="form-input">
          <option v-for="n in countOptions" :key="n" :value="n">{{ n }}</option>
        </select>
      </div>
      <div>
        <label class="block text-xs text-neutral-500 mb-1">Segmento</label>
        <select v-model="filters.segment" class="form-input">
          <option v-for="opt in segmentOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </div>
      <div>
        <label class="block text-xs text-neutral-500 mb-1">Fecha</label>
        <select v-model="filters.dateField" class="form-input">
          <option v-for="opt in dateFieldOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </div>
      <button
        class="action-btn flex items-center gap-2 px-3 py-2 text-sm my-0 disabled:opacity-50"
        :disabled="loading"
        @click="generate"
      >
        <PhSpinner v-if="loading" class="animate-spin" :size="16" />
        {{ loading ? 'Generando...' : 'Generar Reporte' }}
      </button>
    </div>

    <div v-if="error" class="bg-red-50 text-red-700 rounded-lg p-4 mb-4">
      {{ error }}
    </div>

    <template v-if="loading && !report">
      <div class="base-card animate-pulse space-y-2">
        <div class="h-4 bg-neutral-200 rounded w-1/3"></div>
        <div class="h-4 bg-neutral-200 rounded w-2/3"></div>
        <div class="h-4 bg-neutral-200 rounded w-1/2"></div>
      </div>
    </template>

    <template v-else-if="report">
      <div class="bg-neutral-50 rounded-lg px-3 py-2 mb-4">
        <span class="text-sm font-semibold text-neutral-700">{{ rangeBarText }}</span>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div v-for="card in kpiCards" :key="card.key" class="base-card">
          <div class="text-xs font-semibold text-neutral-500">{{ card.label }}</div>
          <div class="text-2xl font-bold text-neutral-800">{{ card.value }}</div>
          <div v-if="card.caption" class="text-xs font-semibold text-neutral-500 mt-1">{{ card.caption }}</div>
        </div>
      </div>

      <div class="flex gap-2 mb-4">
        <button
          type="button"
          :class="activeTab === 'nuevos' ? 'utility-btn-active' : 'utility-btn-inactive'"
          @click="activeTab = 'nuevos'"
        >
          Nuevos
        </button>
        <button
          type="button"
          :class="activeTab === 'recurrentes' ? 'utility-btn-active' : 'utility-btn-inactive'"
          @click="activeTab = 'recurrentes'"
        >
          Recurrentes
        </button>
      </div>

      <div v-if="activeTab === 'nuevos'" class="flex gap-3 overflow-x-auto pb-2">
        <div
          v-for="{ period, entry } in nuevosPeriodsReversed"
          :key="period.key"
          class="base-card flex-shrink-0 w-64"
        >
          <div class="flex items-center justify-between">
            <div class="font-semibold text-neutral-800">{{ period.label }}</div>
            <div class="text-xs font-semibold text-neutral-500">{{ entry.clients.length }} nuevos</div>
          </div>
          <div class="text-xs text-neutral-400 mb-2">{{ formatPeriodRange(period) }}</div>

          <div v-if="entry.clients.length === 0" class="text-sm text-neutral-400">
            Sin clientes nuevos
          </div>
          <ul v-else class="space-y-1">
            <li
              v-for="client in entry.clients"
              :key="client.userId"
              class="flex justify-between items-baseline text-sm cursor-pointer hover:text-primary-600"
              tabindex="0"
              @click="openHistory(client)"
              @keydown.enter="openHistory(client)"
            >
              <span class="truncate">{{ client.name }}</span>
              <span class="text-neutral-500 whitespace-nowrap ml-2">{{ formatMoney(client.total, { slim: true }) }} · {{ client.orderCount }}p</span>
            </li>
          </ul>
        </div>
      </div>

      <div v-else>
        <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
          <button
            v-for="bucket in bucketSummaries"
            :key="bucket.key"
            type="button"
            class="base-card w-full text-left"
            :class="selectedBucket === bucket.key ? 'border-primary bg-primary-100' : ''"
            @click="selectedBucket = bucket.key"
          >
            <div class="text-xs font-semibold text-neutral-500">{{ bucket.label }}</div>
            <div class="text-xl font-bold text-neutral-800">{{ bucket.count }}</div>
            <div class="text-xs font-semibold text-neutral-500">{{ formatMoney(bucket.total) }}</div>
          </button>
        </div>

        <div v-if="selectedBucketClients.length === 0" class="base-card p-8 text-center text-neutral-500">
          No hay clientes en este grupo.
        </div>
        <div v-else class="base-card p-0 overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-neutral-200">
                <th
                  v-for="col in clientColumns"
                  :key="col.key"
                  :class="col.align === 'right' ? 'text-right' : 'text-left'"
                  class="py-2 px-3 font-medium text-neutral-600 select-none"
                  :aria-sort="sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'"
                >
                  <button type="button" class="font-medium" @click="setSort(col.key)">
                    {{ col.label }}
                    <span v-if="sortKey === col.key">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
                  </button>
                </th>
                <th class="text-left py-2 px-3 font-medium text-neutral-600">Actividad</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="client in sortedBucketClients"
                :key="client.userId"
                class="border-b border-neutral-100 hover:bg-neutral-50 cursor-pointer"
                tabindex="0"
                @click="openHistory(client)"
                @keydown.enter="openHistory(client)"
              >
                <td class="py-2 px-3">{{ client.name }}</td>
                <td class="py-2 px-3 text-right whitespace-nowrap">{{ formatMoney(client.rangeTotal) }}</td>
                <td class="py-2 px-3 text-right">{{ client.orderCount }}</td>
                <td class="py-2 px-3 whitespace-nowrap">{{ relativeFromNow(client.lastOrderDate) }}</td>
                <td class="py-2 px-3">
                  <span class="vector-strip">
                    <span
                      v-for="(cell, i) in (client.vector || '').split('')"
                      :key="i"
                      class="vector-dot"
                      :class="`vector-dot-${cell === '.' ? 'blank' : cell}`"
                    ></span>
                    <span
                      class="vector-dot vector-dot-partial"
                      :class="client.orderedInPartial ? 'vector-dot-partial-active' : 'vector-dot-partial-empty'"
                    ></span>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <div v-else-if="!loading" class="base-card p-8 text-center text-neutral-500">
      Genera el reporte para ver el comportamiento de tus clientes.
    </div>

    <ClientHistoryModal
      :is-open="!!historyClient"
      :user-id="historyClient?.userId"
      :name="historyClient?.name"
      @update:is-open="closeHistory"
    />
  </div>
</template>

<style scoped>
.form-input {
  @apply border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent;
}

.vector-strip {
  display: inline-flex;
  gap: 2px;
}

.vector-dot {
  display: inline-block;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 1px;
}

.vector-dot-blank {
  background: transparent;
  border: 1px solid #e5e5e5;
}

.vector-dot-0 {
  background: #c9c9c9;
}

.vector-dot-1 {
  background: #16a34a;
}

.vector-dot-partial {
  border-radius: 50%;
}

.vector-dot-partial-empty {
  background: #c9c9c9;
}

.vector-dot-partial-active {
  background: #2395ff;
}
</style>
