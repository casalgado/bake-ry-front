<script setup>
/* The P&G: ventas - costo de ventas + otros ingresos - gastos = utilidad neta, one
 * column per month plus the range total. Compras and Inversiones are memo lines
 * under the net and are never subtracted from it. */
import { ref, computed, watch } from 'vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import { useAccountingStore } from '@/stores/accountingStore';
import { formatMoney, capitalize } from '@/utils/helpers';

const accountingStore = useAccountingStore();

const shiftMonth = (period, delta) => {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const to = ref(accountingStore.period);
const from = ref(shiftMonth(accountingStore.period, -5));

watch([from, to], ([start, end]) => {
  if (start && end) accountingStore.loadStatement(start, end);
}, { immediate: true });

const statement = computed(() => accountingStore.statement);

const columns = computed(() => (statement.value
  ? [...statement.value.months, { period: 'total', ...statement.value.totals }]
  : []));

const columnLabel = (column) => {
  if (column.period === 'total') return 'Total';
  const [year, month] = column.period.split('-').map(Number);
  return capitalize(new Date(year, month - 1, 1).toLocaleDateString('es-CO', { month: 'short', year: '2-digit' }));
};

const money = (value) => (value ? formatMoney(value) : '–');

const line = (label, pick, options = {}) => ({
  label,
  cells: columns.value.map((column) => (options.percent ? `${pick(column)}%` : money(pick(column)))),
  ...options,
});

// One row per category of `group` ('otherRevenue' or 'expenses'), with its PUC code.
const categoryLines = (group) =>
  (statement.value?.totals[group].byCategory ?? []).map((category) => line(
    category.name,
    (column) => column[group].byCategory.find((c) => c.categoryId === category.categoryId)?.total ?? 0,
    { desc: category.pucCode },
  ));

const rows = computed(() => [
  line('Ventas de productos', (c) => c.orders.productSales),
  line('Domicilios', (c) => c.orders.deliveryFees),
  line('Costo de ventas', (c) => c.orders.cogs),
  line('Utilidad bruta', (c) => c.orders.grossProfit, { strong: true }),
  line('Otros ingresos', (c) => c.otherRevenue.total),
  ...categoryLines('otherRevenue'),
  line('Gastos', (c) => c.expenses.total, { strong: true }),
  ...categoryLines('expenses'),
  line('Utilidad neta', (c) => c.netProfit, { strong: true }),
  line('Margen neto', (c) => c.netMarginPct, { percent: true }),
]);

const memoRows = computed(() => [
  line('Compras de insumos', (c) => c.purchasesTotal),
  line('Inversiones', (c) => c.investments.total),
]);

const gridStyle = computed(() => ({
  gridTemplateColumns: `minmax(11rem, 1.4fr) repeat(${columns.value.length}, minmax(8.5rem, 1fr))`,
  minWidth: `${11 + columns.value.length * 8.5}rem`,
}));

const exportError = ref('');

async function download() {
  exportError.value = '';
  try {
    const { exportPyg } = await import('@/utils/exportPyg');
    await exportPyg(statement.value);
  } catch (err) {
    exportError.value = err?.message || 'No se pudo exportar el P&G';
  }
}

const pendingCount = computed(() => statement.value?.totals.warnings.pendingTemplates ?? 0);
const uncostedCount = computed(() => statement.value?.excludedProducts.length ?? 0);
</script>

<template>
  <div class="p-4 lg:p-6 w-full max-w-6xl">
    <PageHeader title="P&G" subtitle="Estado de resultados por mes." />

    <div class="flex flex-wrap items-end gap-4 mb-4">
      <div class="ui-field">
        <label class="ui-field-k" for="pyg-from">Desde</label>
        <input id="pyg-from" v-model="from" type="month" class="ui-input">
      </div>
      <div class="ui-field">
        <label class="ui-field-k" for="pyg-to">Hasta</label>
        <input id="pyg-to" v-model="to" type="month" class="ui-input">
      </div>
      <button type="button" class="ui-btn" :disabled="!statement" @click="download">Exportar a Excel</button>
    </div>
    <p v-if="exportError" class="ui-field-error" role="alert">{{ exportError }}</p>

    <div v-if="pendingCount || uncostedCount" class="flex flex-wrap gap-2 mb-4">
      <span v-if="pendingCount" class="ui-tag">
        {{ pendingCount }} {{ pendingCount === 1 ? 'gasto recurrente sin confirmar' : 'gastos recurrentes sin confirmar' }}
      </span>
      <span v-if="uncostedCount" class="ui-tag">
        {{ uncostedCount }} {{ uncostedCount === 1 ? 'producto sin costo' : 'productos sin costo' }}: el costo de ventas está incompleto
      </span>
    </div>

    <p v-if="accountingStore.statementError" class="ui-field-error" role="alert">
      {{ accountingStore.statementError }}
    </p>

    <div v-if="statement" class="overflow-x-auto">
      <div class="ui-item ui-item-divided" :style="gridStyle">
        <span />
        <span v-for="column in columns" :key="column.period" class="ui-item-meta text-right">
          {{ columnLabel(column) }}
          <span v-if="column.closed" class="ui-tag normal-case">
            {{ column.closed.drifted ? 'Editado tras cierre' : 'Cerrado' }}
          </span>
        </span>
      </div>

      <div v-for="(row, i) in rows" :key="i" class="ui-item ui-item-divided" :style="gridStyle">
        <span class="min-w-0">
          <span class="ui-item-title block">{{ row.label }}</span>
          <span v-if="row.desc" class="ui-item-desc">{{ row.desc }}</span>
        </span>
        <span
          v-for="(cell, index) in row.cells"
          :key="index"
          class="text-right ui-num"
          :class="row.strong ? 'ui-item-num' : 'ui-item-meta'"
        >{{ cell }}</span>
      </div>

      <h2 class="ui-panehead-title mt-6 mb-1 px-3">Partidas informativas (no afectan la utilidad neta)</h2>
      <div v-for="row in memoRows" :key="row.label" class="ui-item ui-item-divided" :style="gridStyle">
        <span class="ui-item-title">{{ row.label }}</span>
        <span v-for="(cell, index) in row.cells" :key="index" class="ui-item-meta text-right ui-num">{{ cell }}</span>
      </div>
    </div>

    <div v-else-if="!accountingStore.statementLoading && !accountingStore.statementError" class="ui-empty">
      <b>Seleccione un rango de meses.</b>
    </div>
  </div>
</template>
