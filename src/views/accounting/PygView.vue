<script setup>
/* The P&G: ventas - costo de ventas + otros ingresos - gastos = utilidad neta, one
 * column per month plus the range total. Compras and Inversiones are memo lines
 * under the net and are never subtracted from it. */
import { ref, computed, watch } from 'vue';
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

// Total first, so it stays in view while the months scroll.
const columns = computed(() => (statement.value
  ? [{ period: 'total', ...statement.value.totals }, ...statement.value.months]
  : []));

const columnLabel = (column) => {
  if (column.period === 'total') return 'Total';
  const [year, month] = column.period.split('-').map(Number);
  return capitalize(new Date(year, month - 1, 1).toLocaleDateString('es-CO', { month: 'short', year: '2-digit' }));
};

const money = (value) => (value ? formatMoney(value) : '–');

const line = (label, pick, options = {}) => ({
  label,
  cells: columns.value.map((column) => {
    const value = pick(column);
    return { text: options.percent ? `${value}%` : money(value), negative: value < 0 };
  }),
  ...options,
});

// One row per category of `group` ('otherRevenue' or 'expenses'), with its PUC code.
const categoryLines = (group) =>
  (statement.value?.totals[group].byCategory ?? []).map((category) => line(
    category.name,
    (column) => column[group].byCategory.find((c) => c.categoryId === category.categoryId)?.total ?? 0,
    { desc: category.pucCode, sub: true },
  ));

const rows = computed(() => [
  line('Ventas de productos', (c) => c.orders.productSales),
  line('Costo de ventas', (c) => c.orders.cogs),
  line('Utilidad bruta', (c) => c.orders.grossProfit, { strong: true }),
  line('Otros ingresos', (c) => c.otherRevenue.total),
  line('Domicilios', (c) => c.orders.deliveryFees, { sub: true }),
  ...categoryLines('otherRevenue'),
  line('Gastos', (c) => c.expenses.total, { strong: true }),
  line('Costo de domicilios', (c) => c.orders.deliveryCosts, { sub: true }),
  ...categoryLines('expenses'),
  line('Utilidad neta', (c) => c.netProfit, { strong: true, net: true }),
  line('Margen neto', (c) => c.netMarginPct, { percent: true }),
]);

const memoRows = computed(() => [
  line('Compras de insumos', (c) => c.purchasesTotal),
  line('Inversiones', (c) => c.investments.total),
]);

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
  <div class="container p-4 px-0 lg:px-4">
    <div class="flex flex-col lg:flex-row justify-between items-center gap-2 mb-4">
      <h2 class="text-2xl font-bold text-neutral-800">P&G</h2>
      <div class="flex flex-wrap items-end gap-4">
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
    </div>

    <!-- Error State -->
    <div v-if="exportError || accountingStore.statementError" class="text-danger text-center py-4">
      {{ exportError || accountingStore.statementError }}
    </div>

    <!-- Warnings -->
    <p v-if="pendingCount || uncostedCount" class="text-sm text-amber-700 mb-2">
      <span v-if="pendingCount">
        {{ pendingCount }} {{ pendingCount === 1 ? 'gasto recurrente sin confirmar' : 'gastos recurrentes sin confirmar' }}.
      </span>
      <span v-if="uncostedCount">
        {{ uncostedCount }} {{ uncostedCount === 1 ? 'producto sin costo' : 'productos sin costo' }}: el costo de ventas está incompleto.
      </span>
    </p>

    <!-- Statement -->
    <div v-if="statement" class="bg-white shadow-lg rounded-lg overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-neutral-100 text-neutral-600">
          <tr>
            <th class="sticky left-0 z-[1] bg-neutral-100 min-w-[13rem]" />
            <th
              v-for="(column, index) in columns"
              :key="column.period"
              class="px-4 py-3 text-right font-semibold whitespace-nowrap"
              :class="{ 'border-r border-neutral-200': index === 0 }"
            >
              {{ columnLabel(column) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, i) in rows"
            :key="i"
            class="border-b border-neutral-100"
            :class="{ 'border-t border-t-neutral-300 font-semibold': row.strong, 'bg-neutral-50': row.net }"
          >
            <td
              class="sticky left-0 z-[1] px-4 py-2 whitespace-nowrap"
              :class="[row.net ? 'bg-neutral-50' : 'bg-white', row.sub ? 'pl-8 text-xs text-neutral-500' : 'text-neutral-800']"
            >
              <span v-if="row.desc">{{ row.desc }} · </span>{{ row.label }}
            </td>
            <td
              v-for="(cell, index) in row.cells"
              :key="index"
              class="px-4 py-2 text-right whitespace-nowrap tabular-nums"
              :class="{
                'text-danger': cell.negative,
                'text-xs text-neutral-500': row.sub && !cell.negative,
                'border-r border-neutral-200': index === 0,
              }"
            >{{ cell.text }}</td>
          </tr>

          <tr>
            <td
              :colspan="columns.length + 1"
              class="px-4 pt-4 pb-1 text-xs font-semibold uppercase text-neutral-500 bg-neutral-50"
            >
              Partidas informativas (no afectan la utilidad neta)
            </td>
          </tr>
          <tr v-for="row in memoRows" :key="row.label" class="border-b border-neutral-100 last:border-0">
            <td class="sticky left-0 z-[1] bg-white px-4 py-2 whitespace-nowrap text-neutral-800">{{ row.label }}</td>
            <td
              v-for="(cell, index) in row.cells"
              :key="index"
              class="px-4 py-2 text-right whitespace-nowrap tabular-nums text-neutral-600"
              :class="{ 'border-r border-neutral-200': index === 0 }"
            >{{ cell.text }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="!accountingStore.statementLoading && !accountingStore.statementError" class="text-neutral-500 text-center py-4">
      Seleccione un rango de meses.
    </div>
  </div>
</template>
