<script setup>
import { ref, computed, onMounted, reactive } from 'vue';
import { useOrderStore } from '@/stores/orderStore';
import { useAuthenticationStore } from '@/stores/authentication';
import { exportIncomeStatement } from '@/utils/exportOrders';
import { PhSpinner, PhDownloadSimple, PhCaretDown } from '@phosphor-icons/vue';

const orderStore = useOrderStore();
const authStore = useAuthenticationStore();

const loading = ref(false);
const reportData = ref(null);
const error = ref(null);
const selectedDateFilterType = ref('dueDate');
const dateRange = reactive({
  startDate: '',
  endDate: '',
});
const expandedProducts = ref(false);

const dateFilterOptions = [
  { value: 'dueDate', label: 'Fecha de Entrega' },
  { value: 'paymentDate', label: 'Fecha de Pago' },
];

// Initialize date range to current year
const initializeDateRange = () => {
  const now = new Date();
  const year = now.getFullYear();
  dateRange.startDate = `${year}-01-01`;
  dateRange.endDate = `${year}-12-31`;
};

onMounted(() => {
  initializeDateRange();
});

// Quick filter options with helper to calculate dates
const getQuickFilterDates = (type) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (type) {
  case 'thisMonth':
    return {
      startDate: `${year}-${String(month + 1).padStart(2, '0')}-01`,
      endDate: `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`,
    };
  case 'lastMonth': {
    const lastMonth = month === 0 ? 11 : month - 1;
    const lastYear = month === 0 ? year - 1 : year;
    const daysInLastMonth = new Date(lastYear, lastMonth + 1, 0).getDate();
    return {
      startDate: `${lastYear}-${String(lastMonth + 1).padStart(2, '0')}-01`,
      endDate: `${lastYear}-${String(lastMonth + 1).padStart(2, '0')}-${daysInLastMonth}`,
    };
  }
  case 'last3Months': {
    // Get the last 3 completed months
    const currentMonth = month;
    const startMonthIndex = currentMonth - 3;

    let startMonth, startYear;
    if (startMonthIndex >= 0) {
      startMonth = startMonthIndex;
      startYear = year;
    } else {
      startMonth = startMonthIndex + 12;
      startYear = year - 1;
    }

    const endMonth = currentMonth - 1;
    const endYear = endMonth >= 0 ? year : year - 1;
    const actualEndMonth = endMonth >= 0 ? endMonth : endMonth + 12;

    const daysInEndMonth = new Date(endYear, actualEndMonth + 1, 0).getDate();

    return {
      startDate: `${startYear}-${String(startMonth + 1).padStart(2, '0')}-01`,
      endDate: `${endYear}-${String(actualEndMonth + 1).padStart(2, '0')}-${daysInEndMonth}`,
    };
  }
  case 'thisYear':
    return {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    };
  default:
    return { startDate: '', endDate: '' };
  }
};

const setQuickFilter = (type) => {
  const dates = getQuickFilterDates(type);
  dateRange.startDate = dates.startDate;
  dateRange.endDate = dates.endDate;
};

// Check which filter button is active
const isFilterActive = (type) => {
  const dates = getQuickFilterDates(type);
  return dateRange.startDate === dates.startDate && dateRange.endDate === dates.endDate;
};

// Generate report
const generateReport = async () => {
  if (!dateRange.startDate || !dateRange.endDate) {
    error.value = 'Por favor, selecciona un rango de fechas';
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    // Build query using the queryParser structure
    const query = {
      groupBy: 'month',
      filters: {
        dateRange: {
          dateField: selectedDateFilterType.value,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        },
      },
    };

    console.log('🔍 Income Statement Query:', query);

    const response = await orderStore.getIncomeStatement?.(query);

    // If store method doesn't exist, call service directly
    if (!response) {
      const service = orderStore.$state.service || (await import('@/services/orderService')).OrderService;
      const serviceInstance = service instanceof Function ? new service(authStore.getBakeryId) : service;
      const apiResponse = await serviceInstance.getIncomeStatement(query);
      reportData.value = apiResponse.data;
    } else {
      reportData.value = response;
    }

    console.log('🔍 Income Statement Response:', reportData.value);
  } catch (err) {
    console.error('Error generating report:', err);
    error.value = 'Error al generar el reporte. Por favor, intenta de nuevo.';
  } finally {
    loading.value = false;
  }
};

// Format currency
const formatCurrency = (value) => {
  if (typeof value !== 'number') return '$0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// Format percentage
const formatPercent = (value) => {
  if (typeof value !== 'number') return '0%';
  return `${value.toFixed(1)}%`;
};

// Get coverage status badge
const getCoverageBadge = (percentCovered) => {
  if (percentCovered >= 90) return { status: '✅ BUENA COBERTURA', color: 'text-green-600' };
  if (percentCovered >= 50) return { status: '⚠️ COBERTURA PARCIAL', color: 'text-amber-600' };
  return { status: '❌ DATOS INSUFICIENTES', color: 'text-red-600' };
};

// Format month label
const formatMonthLabel = (monthStr) => {
  const [year, month] = monthStr.split('-');
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${months[parseInt(month) - 1]} ${year}`;
};

// Export functions
const handleExport = (format) => {
  if (!reportData.value) return;

  exportIncomeStatement(reportData.value, {
    format,
    bakeryName: authStore.user?.bakeryName || 'Mi Panaderia',
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });
};

// Computed properties
const hasReport = computed(() => !!reportData.value);
const periods = computed(() => reportData.value?.periods || []);
const totals = computed(() => reportData.value?.totals || {});
const excludedProducts = computed(() => reportData.value?.excludedProducts || []);

// Monthly data for display
const monthlyData = computed(() => {
  if (!periods.value.length) return [];
  return periods.value;
});
</script>

<template>
  <div class="container p-2 sm:p-4 px-2 lg:px-4">
    <!-- Header -->
    <h2 class="text-lg sm:text-2xl font-bold text-neutral-850 mb-4 sm:mb-6">Rentabilidad</h2>

    <!-- Controls Section -->
    <div class="base-card mb-4 sm:mb-6">
      <!-- Date Filter Type Selector -->
      <div class="mb-4">
        <label class="block text-sm font-semibold text-neutral-850 mb-2">Filtrar por:</label>
        <div class="flex gap-4">
          <div v-for="option in dateFilterOptions" :key="option.value" class="flex items-center">
            <input
              :id="`filter-${option.value}`"
              v-model="selectedDateFilterType"
              type="radio"
              :value="option.value"
              class="form-container"
            />
            <label :for="`filter-${option.value}`" class="ml-2 text-sm text-neutral-850 cursor-pointer">
              {{ option.label }}
            </label>
          </div>
        </div>
      </div>

      <!-- Date Range Picker -->
      <div class="grid grid-cols-2 gap-2 mb-4 mt-4">
        <div>
          <label class="block text-sm font-semibold text-neutral-850 mb-1">Inicio:</label>
          <input
            v-model="dateRange.startDate"
            type="date"
            class="form-container input w-full"
          />
        </div>
        <div>
          <label class="block text-sm font-semibold text-neutral-850 mb-1">Fin:</label>
          <input
            v-model="dateRange.endDate"
            type="date"
            class="form-container input w-full"
          />
        </div>
      </div>

      <!-- Quick Filters -->
      <div class="flex flex-wrap gap-2 mb-3">
        <button
          @click="setQuickFilter('thisMonth')"
          :class="isFilterActive('thisMonth') ? 'utility-btn-active' : 'utility-btn-inactive'"
        >
          Este Mes
        </button>
        <button
          @click="setQuickFilter('lastMonth')"
          :class="isFilterActive('lastMonth') ? 'utility-btn-active' : 'utility-btn-inactive'"
        >
          Mes Anterior
        </button>
        <button
          @click="setQuickFilter('last3Months')"
          :class="isFilterActive('last3Months') ? 'utility-btn-active' : 'utility-btn-inactive'"
        >
          Últimos 3 Meses
        </button>
        <button
          @click="setQuickFilter('thisYear')"
          :class="isFilterActive('thisYear') ? 'utility-btn-active' : 'utility-btn-inactive'"
        >
          Este Año
        </button>
      </div>

      <!-- Generate Button -->
      <button
        @click="generateReport"
        :disabled="loading"
        class="action-btn w-full flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <PhSpinner v-if="loading" class="animate-spin" :size="16" />
        {{ loading ? 'Generando...' : 'Generar Reporte' }}
      </button>
    </div>

    <!-- Error Message -->
    <div v-if="error" class="text-danger text-center py-4">
      {{ error }}
    </div>

    <!-- Report Display -->
    <div v-if="hasReport" class="space-y-4 sm:space-y-6">
      <!-- Disclaimer -->
      <div class="bg-neutral-900 border border-warning text-warning rounded-md p-3 text-xs">
        <strong>IMPORTANTE:</strong> Este reporte muestra únicamente Rentabilidad (ingresos menos costo de productos).
        No incluye gastos operativos como arriendo, servicios públicos, salarios, marketing, etc.
      </div>

      <!-- Monthly Table -->
      <div class="overflow-x-auto bg-white rounded-md border border-neutral-300">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-neutral-300">
              <th class="px-3 py-2 text-left font-semibold text-neutral-850">Concepto</th>
              <th
                v-for="period in monthlyData"
                :key="period.month"
                class="px-3 py-2 text-right font-semibold text-neutral-850 whitespace-nowrap"
              >
                {{ formatMonthLabel(period.month) }}
              </th>
              <th class="px-3 py-2 text-right font-semibold text-neutral-850 whitespace-nowrap border-l border-neutral-400">
                TOTAL
              </th>
            </tr>
          </thead>
          <tbody>
            <!-- INGRESOS Section -->
            <tr class="border-b border-neutral-300 font-semibold text-neutral-850">
              <td class="px-3 py-2">INGRESOS</td>
              <td v-for="period in monthlyData" :key="`revenue-${period.month}`" class="px-3 py-2 text-right"></td>
              <td class="px-3 py-2 text-right border-l border-neutral-400"></td>
            </tr>
            <tr class="border-b border-neutral-200">
              <td class="px-3 py-2 text-neutral-700 pl-6">Ventas de Productos</td>
              <td
                v-for="period in monthlyData"
                :key="`sales-${period.month}`"
                class="px-3 py-2 text-right text-neutral-850"
              >
                {{ formatCurrency(period.revenue.productSales) }}
              </td>
              <td class="px-3 py-2 text-right text-neutral-850 border-l border-neutral-400">
                {{ formatCurrency(totals.revenue?.productSales || 0) }}
              </td>
            </tr>
            <tr class="border-b border-neutral-200">
              <td class="px-3 py-2 text-neutral-700 pl-6">Domicilios Cobrados</td>
              <td
                v-for="period in monthlyData"
                :key="`delivery-${period.month}`"
                class="px-3 py-2 text-right text-neutral-850"
              >
                {{ formatCurrency(period.revenue.deliveryFees) }}
              </td>
              <td class="px-3 py-2 text-right text-neutral-850 border-l border-neutral-400">
                {{ formatCurrency(totals.revenue?.deliveryFees || 0) }}
              </td>
            </tr>
            <tr class="border-b border-neutral-200">
              <td class="px-3 py-2 text-neutral-700 pl-6">Impuestos Cobrados</td>
              <td
                v-for="period in monthlyData"
                :key="`taxes-${period.month}`"
                class="px-3 py-2 text-right text-neutral-850"
              >
                {{ formatCurrency(period.revenue.taxesCollected) }}
              </td>
              <td class="px-3 py-2 text-right text-neutral-850 border-l border-neutral-400">
                {{ formatCurrency(totals.revenue?.taxesCollected || 0) }}
              </td>
            </tr>
            <tr class="border-b border-neutral-300 font-semibold text-neutral-850">
              <td class="px-3 py-2">Total Ingresos</td>
              <td
                v-for="period in monthlyData"
                :key="`total-revenue-${period.month}`"
                class="px-3 py-2 text-right"
              >
                {{ formatCurrency(period.revenue.totalRevenue) }}
              </td>
              <td class="px-3 py-2 text-right border-l border-neutral-400">
                {{ formatCurrency(totals.revenue?.totalRevenue || 0) }}
              </td>
            </tr>

            <!-- COSTOS Section -->
            <tr class="border-b border-neutral-300 font-semibold text-neutral-850">
              <td class="px-3 py-2">COSTOS</td>
              <td v-for="period in monthlyData" :key="`costs-${period.month}`" class="px-3 py-2 text-right"></td>
              <td class="px-3 py-2 text-right border-l border-neutral-400"></td>
            </tr>
            <tr class="border-b border-neutral-200">
              <td class="px-3 py-2 text-neutral-700 pl-6">Costo de Productos</td>
              <td
                v-for="period in monthlyData"
                :key="`cogs-${period.month}`"
                class="px-3 py-2 text-right text-neutral-850"
              >
                {{ formatCurrency(period.costs.cogs) }}
              </td>
              <td class="px-3 py-2 text-right text-neutral-850 border-l border-neutral-400">
                {{ formatCurrency(totals.costs?.cogs || 0) }}
              </td>
            </tr>
            <tr class="border-b border-neutral-200">
              <td class="px-3 py-2 text-neutral-700 pl-6">Costo de Domicilios</td>
              <td
                v-for="period in monthlyData"
                :key="`delivery-costs-${period.month}`"
                class="px-3 py-2 text-right text-neutral-850"
              >
                {{ formatCurrency(period.costs.deliveryCosts) }}
              </td>
              <td class="px-3 py-2 text-right text-neutral-850 border-l border-neutral-400">
                {{ formatCurrency(totals.costs?.deliveryCosts || 0) }}
              </td>
            </tr>
            <tr class="border-b border-neutral-300 font-semibold text-neutral-850">
              <td class="px-3 py-2">Total Costos</td>
              <td
                v-for="period in monthlyData"
                :key="`total-costs-${period.month}`"
                class="px-3 py-2 text-right"
              >
                {{ formatCurrency(period.costs.totalCosts) }}
              </td>
              <td class="px-3 py-2 text-right border-l border-neutral-400">
                {{ formatCurrency(totals.costs?.totalCosts || 0) }}
              </td>
            </tr>

            <!-- Rentabilidad Section -->
            <tr class="border-b border-neutral-300 font-semibold text-neutral-850">
              <td class="px-3 py-2">Rentabilidad</td>
              <td v-for="period in monthlyData" :key="`profit-${period.month}`" class="px-3 py-2 text-right"></td>
              <td class="px-3 py-2 text-right border-l border-neutral-400"></td>
            </tr>
            <tr class="border-b border-neutral-200">
              <td class="px-3 py-2 text-neutral-700 pl-6">Utilidad Bruta</td>
              <td
                v-for="period in monthlyData"
                :key="`gross-profit-${period.month}`"
                class="px-3 py-2 text-right font-semibold text-neutral-850"
              >
                {{ formatCurrency(period.grossProfit.amount) }}
              </td>
              <td class="px-3 py-2 text-right font-semibold text-neutral-850 border-l border-neutral-400">
                {{ formatCurrency(totals.grossProfit?.amount || 0) }}
              </td>
            </tr>
            <tr class="border-b border-neutral-300">
              <td class="px-3 py-2 text-neutral-700 pl-6">Margen Bruto %</td>
              <td
                v-for="period in monthlyData"
                :key="`margin-${period.month}`"
                class="px-3 py-2 text-right font-semibold text-neutral-850"
              >
                {{ formatPercent(period.grossProfit.marginPercent) }}
              </td>
              <td class="px-3 py-2 text-right font-semibold text-neutral-850 border-l border-neutral-400">
                {{ formatPercent(totals.grossProfit?.marginPercent || 0) }}
              </td>
            </tr>

            <!-- Coverage Section -->
            <tr class="border-b border-neutral-200">
              <td class="px-3 py-2 text-neutral-700 pl-6">Cobertura de Costos</td>
              <td
                v-for="period in monthlyData"
                :key="`coverage-${period.month}`"
                class="px-3 py-2 text-right"
                :class="getCoverageBadge(period.coverage.percentCovered).color"
              >
                {{ formatPercent(period.coverage.percentCovered) }}
              </td>
              <td
                class="px-3 py-2 text-right border-l border-neutral-400"
                :class="getCoverageBadge(totals.coverage?.percentCovered || 0).color"
              >
                {{ formatPercent(totals.coverage?.percentCovered || 0) }}
              </td>
            </tr>
            <tr class="border-b border-neutral-200">
              <td class="px-3 py-2 text-neutral-700 pl-6 text-xs">
                {{ `${totals.coverage?.itemsWithCost || 0} de ${totals.coverage?.totalItems || 0} items` }}
              </td>
              <td
                v-for="period in monthlyData"
                :key="`coverage-detail-${period.month}`"
                class="px-3 py-2 text-right text-xs text-neutral-600"
              >
                {{ `${period.coverage.itemsWithCost}/${period.coverage.totalItems}` }}
              </td>
              <td class="px-3 py-2 text-right text-xs text-neutral-600 border-l border-neutral-400">
                {{ `${totals.coverage?.itemsWithCost || 0}/${totals.coverage?.totalItems || 0}` }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Excluded Products Section -->
      <div v-if="excludedProducts.length > 0" class="mb-4 sm:mb-8">
        <h3 class="text-base sm:text-lg font-semibold mb-2 sm:mb-4 flex items-center gap-2 cursor-pointer hover:text-primary" @click="expandedProducts = !expandedProducts">
          <PhCaretDown :size="18" :class="{ 'rotate-180': expandedProducts }" class="transition" />
          Productos sin costo definido ({{ excludedProducts.length }})
        </h3>

        <div v-if="expandedProducts" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-neutral-300">
                <th class="px-3 py-2 text-left font-semibold text-neutral-850">Producto</th>
                <th class="px-3 py-2 text-right font-semibold text-neutral-850">Pedidos</th>
                <th class="px-3 py-2 text-right font-semibold text-neutral-850">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="product in excludedProducts" :key="product.id" class="border-b border-neutral-200">
                <td class="px-3 py-2 text-neutral-850">{{ product.name }}</td>
                <td class="px-3 py-2 text-right text-neutral-600">{{ product.orderCount }}</td>
                <td class="px-3 py-2 text-right text-neutral-600">{{ product.totalQuantity }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="text-sm text-neutral-600 mt-3">
          Configura los costos en Productos para mejorar la precisión.
        </p>
      </div>

      <!-- Export Section -->
      <div class="flex gap-3">
        <button
          @click="handleExport('xlsx')"
          class="action-btn flex items-center gap-2"
        >
          <PhDownloadSimple :size="16" />
          Descargar Excel
        </button>
        <button
          @click="handleExport('csv')"
          class="utility-btn-inactive flex items-center gap-2"
        >
          <PhDownloadSimple :size="16" />
          Descargar CSV
        </button>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="!hasReport && !loading" class="text-center py-8">
      <p class="text-sm text-neutral-600">Selecciona un rango de fechas y haz clic en "Generar Reporte".</p>
    </div>
  </div>
</template>

<style scoped>
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
