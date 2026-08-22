<script setup>
import { ref, computed, onMounted } from 'vue';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { useOrderStore } from '@/stores/orderStore';
import { formatMoney } from '@/utils/helpers';
import { exportClientPersistency } from '@/utils/exportOrders';
import { PhSpinner, PhDownloadSimple } from '@phosphor-icons/vue';

const bakerySettingsStore = useBakerySettingsStore();
const orderStore = useOrderStore();

const filters = ref({
  period: 'monthly',
  count: 12,
  segment: 'b2b',
  dateField: 'dueDate',
});

const report = ref(null);
const loading = ref(false);
const error = ref(null);
const sortBy = ref('persistent');
const statusFilter = ref(null);
const minOrders = ref(1);

const periodOptions = [
  { value: 'weekly', label: 'Semanas' },
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
const sortOptions = [
  { value: 'name', label: 'Nombre' },
  { value: 'value', label: 'Valor' },
  { value: 'persistent', label: 'Persistencia' },
  { value: 'new', label: 'Nuevos' },
];
const minOrdersOptions = [1, 2, 5, 10];

const statusLabels = {
  active: 'Activo',
  overdue: 'Atrasado',
  at_risk: 'En riesgo',
  lapsed: 'Perdido',
  one_time: 'Compra única',
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
    report.value = await orderStore.getClientReport(query);
  } catch (err) {
    error.value = err.message || 'Error al obtener el reporte de persistencia';
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  if (window.innerWidth < 640) {
    filters.value.count = 6;
  }

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

const tiles = computed(() => {
  if (!report.value) return [];
  const t = report.value.summary.tiles;
  const newClientsDelta = t.newClients.prevPeriod != null
    ? t.newClients.value - t.newClients.prevPeriod
    : null;

  return [
    {
      key: 'nuevos',
      label: 'NUEVOS',
      value: t.newClients.value,
      caption: newClientsDelta !== null
        ? `${newClientsDelta >= 0 ? '↑' : '↓'} ${Math.abs(newClientsDelta)} periodo ant.`
        : null,
    },
    {
      key: 'regresaron',
      label: 'REGRESARON',
      value: t.returnRate.value !== null ? `${t.returnRate.value}%` : '—',
      caption: `de ${t.returnRate.judged} juzgados${t.returnRate.tooEarly ? ' · ' + t.returnRate.tooEarly + ' muy recientes' : ''}`,
    },
    {
      key: 'at_risk',
      label: 'EN RIESGO',
      value: t.atRisk.count,
      status: 'at_risk',
    },
    {
      key: 'lapsed',
      label: 'PERDIDOS',
      value: t.lapsed.count,
      status: 'lapsed',
    },
  ];
});

const insight = computed(() => {
  if (!report.value) return '';
  const { gained, lost } = report.value.summary.tiles.quickRatio;
  if (gained > lost) return `Tu base está creciendo: entran ${gained}, se van ${lost}.`;
  if (gained < lost) return `Tu base se está reduciendo: entran ${gained}, se van ${lost}.`;
  return `Tu base está estable: entran ${gained}, se van ${lost}.`;
});

const toggleStatusFilter = (status) => {
  statusFilter.value = statusFilter.value === status ? null : status;
};

const filteredSortedClients = computed(() => {
  if (!report.value) return [];
  let list = report.value.clients.filter(c => c.orderCount >= minOrders.value);
  if (statusFilter.value) {
    list = list.filter(c => c.status === statusFilter.value);
  }

  const sorted = [...list];
  if (sortBy.value === 'name') {
    sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } else if (sortBy.value === 'value') {
    sorted.sort((a, b) => b.windowTotal - a.windowTotal);
  } else if (sortBy.value === 'persistent') {
    sorted.sort((a, b) => b.persistentCount - a.persistentCount);
  } else if (sortBy.value === 'new') {
    sorted.sort((a, b) => {
      if (a.firstSeenIndex === -1) return 1;
      if (b.firstSeenIndex === -1) return -1;
      return b.firstSeenIndex - a.firstSeenIndex;
    });
  }
  return sorted;
});

const warningTitle = (client) => {
  const baseline = client.gapRatio ? Math.round(client.daysSinceLast / client.gapRatio) : null;
  if (baseline === null) {
    return `Sin historial suficiente para estimar su ritmo. Han pasado ${client.daysSinceLast} días.`;
  }
  return `Suele pedir cada ${baseline} días. Han pasado ${client.daysSinceLast}.`;
};

const handleExport = () => {
  if (report.value) exportClientPersistency(report.value);
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
        class="action-btn flex items-center gap-2 disabled:opacity-50"
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
      <div class="base-card">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <component
            :is="tile.status ? 'button' : 'div'"
            v-for="tile in tiles"
            :key="tile.key"
            :type="tile.status ? 'button' : null"
            :aria-pressed="tile.status ? statusFilter === tile.status : null"
            class="text-left p-3 rounded-lg border"
            :class="[
              tile.status && statusFilter === tile.status ? 'border-primary bg-primary-100' : 'border-neutral-200',
              tile.status ? 'cursor-pointer hover:border-primary-300' : '',
            ]"
            @click="tile.status && toggleStatusFilter(tile.status)"
          >
            <div class="text-xs font-semibold text-neutral-500">{{ tile.label }}</div>
            <div class="text-2xl font-bold text-neutral-800">{{ tile.value }}</div>
            <div v-if="tile.caption" class="text-xs text-neutral-400 mt-1">{{ tile.caption }}</div>
          </component>
        </div>
        <p class="text-xs text-neutral-400 mt-3">
          Calculado sobre todo el historial, no solo el periodo mostrado.
        </p>
        <p v-if="insight" class="text-sm text-neutral-600 mt-2">
          ▸ {{ insight }}
        </p>
      </div>

      <div class="base-card flex flex-wrap items-center gap-3">
        <span class="text-xs text-neutral-500">Ordenar:</span>
        <button
          v-for="opt in sortOptions"
          :key="opt.value"
          type="button"
          :class="sortBy === opt.value ? 'utility-btn-active' : 'utility-btn-inactive'"
          @click="sortBy = opt.value"
        >
          {{ opt.label }}
        </button>

        <span class="text-xs text-neutral-500 ml-4">Min. pedidos:</span>
        <select v-model.number="minOrders" class="form-input form-input-sm">
          <option v-for="n in minOrdersOptions" :key="n" :value="n">{{ n }}</option>
        </select>

        <button
          v-if="statusFilter"
          type="button"
          class="utility-btn-inactive flex items-center gap-1"
          @click="statusFilter = null"
        >
          {{ statusLabels[statusFilter] || statusFilter }} ✕
        </button>

        <button class="utility-btn-inactive flex items-center gap-2 ml-auto" @click="handleExport">
          <PhDownloadSimple :size="16" />
          Descargar CSV
        </button>
      </div>

      <div v-if="filteredSortedClients.length === 0" class="base-card p-8 text-center text-neutral-500">
        No hay clientes que coincidan con estos filtros.
      </div>

      <div v-else class="base-card p-0 overflow-x-auto">
        <table class="persistency-table">
          <thead>
            <tr>
              <th class="sticky-col">Cliente</th>
              <th v-for="period in report.periods" :key="period.key">{{ period.label }}</th>
            </tr>
          </thead>
          <tbody>
            <tr class="summary-row">
              <td class="sticky-col">Nuevos</td>
              <td v-for="(p, i) in report.summary.perPeriod" :key="i">{{ p.nuevos || '—' }}</td>
            </tr>
            <tr class="summary-row">
              <td class="sticky-col">Activos</td>
              <td v-for="(p, i) in report.summary.perPeriod" :key="i">{{ p.activos || '—' }}</td>
            </tr>
            <tr v-for="client in filteredSortedClients" :key="client.userId">
              <td class="sticky-col">
                {{ client.name }}
                <span
                  v-if="client.status === 'at_risk' || client.status === 'lapsed'"
                  :title="warningTitle(client)"
                  class="text-amber-500"
                >⚠</span>
              </td>
              <td
                v-for="(cell, i) in client.cells"
                :key="i"
                :class="`cell-${cell.status}`"
              >
                {{ cell.total > 0 ? formatMoney(cell.total, { slim: true }) : '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex items-center gap-4 mt-3 text-xs text-neutral-500">
        <span class="flex items-center gap-1"><span class="legend-swatch cell-persistent"></span> Persistente</span>
        <span class="flex items-center gap-1"><span class="legend-swatch cell-new"></span> Nuevo</span>
        <span class="flex items-center gap-1"><span class="legend-swatch cell-old"></span> Antiguo</span>
        <span class="flex items-center gap-1"><span class="cell-absent">—</span> Ausente</span>
      </div>
    </template>

    <div v-else-if="!loading" class="base-card p-8 text-center text-neutral-500">
      Genera el reporte para ver el comportamiento de tus clientes.
    </div>
  </div>
</template>

<style scoped>
.form-input {
  @apply border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent;
}

/* Modifier: use together with .form-input */
.form-input-sm {
  @apply px-2 py-1;
}

.persistency-table {
  border-collapse: collapse;
  width: 100%;
}

.persistency-table th,
.persistency-table td {
  padding: 0.5rem 0.75rem;
  text-align: center;
  white-space: nowrap;
  border-bottom: 1px solid #f1f1f1;
}

.persistency-table th:first-child,
.persistency-table td:first-child {
  text-align: left;
}

.sticky-col {
  position: sticky;
  left: 0;
  background: white;
  z-index: 1;
}

.summary-row {
  background: #fafafa;
  font-weight: 600;
}

.summary-row .sticky-col {
  background: #fafafa;
}

.cell-persistent {
  background: #dcfce7;
}

.cell-new {
  background: #dbeafe;
}

.cell-old {
  background: transparent;
}

.cell-absent {
  color: #b3b3b3;
}

.legend-swatch {
  display: inline-block;
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 2px;
  border: 1px solid #e5e5e5;
}
</style>
