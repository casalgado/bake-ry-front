<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { useOrderStore } from '@/stores/orderStore';
import PeriodSelector from '@/components/common/PeriodSelector.vue';
import SimpleTable from '@/components/common/SimpleTable.vue';
import { usePeriodStore } from '@/stores/periodStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { useSystemSettingsStore } from '@/stores/systemSettingsStore';
import { formatMoney } from '@/utils/helpers';

const periodStore = usePeriodStore();
const orderStore = useOrderStore();
const settingsStore = useBakerySettingsStore();
const systemSettingsStore = useSystemSettingsStore();
const unsubscribeRef = ref(null);
const b2bClients = ref([]);
const salesReport = ref({});
const loading = ref(false);

// Helper function to safely access nested properties
const safeGet = (obj, path, defaultValue = null) => {
  try {
    return (
      path.split('.').reduce((acc, part) => acc?.[part], obj) ?? defaultValue
    );
  } catch {
    return defaultValue;
  }
};

const periodData = computed(() => {
  const total = safeGet(salesReport.value, 'salesMetrics.total');
  if (!total) return null;

  const { monthly = {}, weekly = {}, daily = {} } = total;

  // If multiple months, return monthly data
  if (Object.keys(monthly).length > 1) {
    return {
      type: 'monthly',
      data: monthly,
      display: 'Mes',
    };
  }

  // If multiple weeks, return complete weeks only
  const completeWeeks = Object.entries(weekly)
    .filter(([_, week]) => week?.days >= 6)
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});

  if (Object.keys(weekly).length > 1 && Object.keys(completeWeeks).length > 0) {
    return {
      type: 'weekly',
      data: completeWeeks,
      display: 'Semana',
    };
  }

  // Otherwise return daily data
  return {
    type: 'daily',
    data: daily,
    display: 'Día',
  };
});

// Summary table data
const summaryData = computed(() => {
  if (!salesReport.value?.summary) return [];

  return [
    { label: 'Total Pedidos', value: safeGet(salesReport.value, 'summary.totalPaidOrders', 0) },
    { label: 'Ingreso Domicilios', value: safeGet(salesReport.value, 'summary.totalDelivery', 0), format: 'money' },
    {
      label: 'Venta B2B',
      value: safeGet(salesReport.value, 'summary.totalB2B', 0),
      percentage: safeGet(salesReport.value, 'summary.percentageB2B', 0),
      format: 'money_percentage',
    },
    {
      label: 'Venta B2C',
      value: safeGet(salesReport.value, 'summary.totalB2C', 0),
      percentage: safeGet(salesReport.value, 'summary.percentageB2C', 0),
      format: 'money_percentage',
    },
    { label: 'Venta Total', value: safeGet(salesReport.value, 'summary.totalSales', 0), format: 'money' },
    { label: 'Ingresos Totales', value: safeGet(salesReport.value, 'summary.totalRevenue', 0), format: 'money' },
  ];
});

const summaryColumns = [
  { key: 'label', label: 'Concepto' },
  {
    key: 'value',
    label: 'Valor',
    formatter: (value, row) => {
      if (row.format === 'money') {
        return formatMoney(value);
      } else if (row.format === 'money_percentage') {
        return `${formatMoney(value)} (${row.percentage.toFixed(1)}%)`;
      }
      return value;
    },
  },
];

// Period data table
const periodTableData = computed(() => {
  if (!periodData.value?.data) return [];

  return Object.entries(periodData.value.data).map(([period, data]) => ({
    period: periodData.value.type === 'weekly'
      ? `${period.split('/')[0].split('-')[2]} - ${period.split('/')[1].split('-')[2]}`
      : period,
    delivery: data?.delivery ?? 0,
    b2bAmount: data?.b2b?.amount ?? 0,
    b2bPercentage: data?.b2b?.percentage ?? 0,
    b2cAmount: data?.b2c?.amount ?? 0,
    b2cPercentage: data?.b2c?.percentage ?? 0,
    sales: data?.sales ?? 0,
    total: data?.total ?? 0,
  }));
});

const periodColumns = [
  { key: 'period', label: 'Período' },
  { key: 'delivery', label: 'Domicilios', formatter: 'money' },
  {
    key: 'b2bAmount',
    label: 'B2B',
    formatter: (value, row) => `${formatMoney(value)} (${row.b2bPercentage.toFixed(1)}%)`,
  },
  {
    key: 'b2cAmount',
    label: 'B2C',
    formatter: (value, row) => `${formatMoney(value)} (${row.b2cPercentage.toFixed(1)}%)`,
  },
  { key: 'sales', label: 'Venta', formatter: 'money' },
  { key: 'total', label: 'Ingresos', formatter: 'money' },
];

// Customer segments data
const customerSegmentsData = computed(() => {
  const segments = safeGet(salesReport.value, 'salesMetrics.byCustomerSegment');
  if (!segments) return [];

  return [
    {
      segment: 'B2B',
      sales: segments.b2b?.total ?? 0,
      salesPercentage: segments.b2b?.percentageSales ?? 0,
      orders: segments.b2b?.orders ?? 0,
      averagePrice: segments.b2b?.averagePrice ?? 0,
    },
    {
      segment: 'B2C',
      sales: segments.b2c?.total ?? 0,
      salesPercentage: segments.b2c?.percentageSales ?? 0,
      orders: segments.b2c?.orders ?? 0,
      averagePrice: segments.b2c?.averagePrice ?? 0,
    },
  ];
});

const customerSegmentsColumns = [
  { key: 'segment', label: 'Segmento' },
  {
    key: 'sales',
    label: 'Ventas',
    formatter: (value, row) => `${formatMoney(value)} (${row.salesPercentage.toFixed(1)}%)`,
  },
  { key: 'orders', label: 'Pedidos' },
  { key: 'averagePrice', label: 'Ticket Promedio', formatter: 'money' },
];

// Payment methods data
const paymentMethodsData = computed(() => {
  const methods = safeGet(salesReport.value, 'salesMetrics.byPaymentMethod');
  if (!methods) return [];

  // Get payment method labels from system settings
  const getPaymentMethodLabel = (methodId) => {
    const availableMethod = systemSettingsStore.availablePaymentMethods?.find(
      method => method.value === methodId,
    );

    return availableMethod?.label || methodId;
  };

  return Object.entries(methods).map(([method, data]) => ({
    method: getPaymentMethodLabel(method),
    total: data?.total ?? 0,
    percentage: data?.percentage ?? 0,
    orders: data?.orders ?? 0,
  }));
});

const paymentMethodsColumns = [
  { key: 'method', label: 'Método' },
  {
    key: 'total',
    label: 'Total',
    formatter: (value, row) => `${formatMoney(value)} (${row.percentage.toFixed(1)}%)`,
  },
  { key: 'orders', label: 'Pedidos' },
];

// Collections data
const collectionsData = computed(() => {
  const collections = safeGet(salesReport.value, 'salesMetrics.byCollection');
  if (!collections) return [];

  return Object.entries(collections)
    .sort((a, b) => (b[1]?.revenue ?? 0) - (a[1]?.revenue ?? 0))
    .map(([name, data]) => ({
      collection: name,
      revenue: data?.revenue ?? 0,
      revenuePercentage: data?.percentageRevenue ?? 0,
      quantity: data?.quantity ?? 0,
      quantityPercentage: data?.percentageQuantity ?? 0,
      averagePrice: data?.averagePrice ?? 0,
    }));
});

const collectionsColumns = [
  { key: 'collection', label: 'Colección', formatter: 'capitalize' },
  {
    key: 'revenue',
    label: 'Ingresos',
    formatter: (value, row) => `${formatMoney(value)} (${row.revenuePercentage.toFixed(1)}%)`,
  },
  {
    key: 'quantity',
    label: 'Cantidad',
    formatter: (value, row) => `${value} (${row.quantityPercentage.toFixed(1)}%)`,
  },
  { key: 'averagePrice', label: 'Precio Promedio', formatter: 'money' },
];

// Best products data
const bestProductsData = computed(() => {
  return safeGet(salesReport.value, 'productMetrics.bestSellers.bySales', []).map(product => ({
    name: product?.name ?? 'N/A',
    collection: product?.collection ?? 'N/A',
    revenue: product?.revenue ?? 0,
    revenuePercentage: product?.percentageOfSales ?? 0,
    quantity: product?.quantity ?? 0,
    quantityPercentage: product?.percentageOfQuantity ?? 0,
    averagePrice: product?.averagePrice ?? 0,
  }));
});

// Worst products data
const worstProductsData = computed(() => {
  return safeGet(salesReport.value, 'productMetrics.lowestSellers.bySales', []).map(product => ({
    name: product?.name ?? 'N/A',
    collection: product?.collection ?? 'N/A',
    revenue: product?.revenue ?? 0,
    revenuePercentage: product?.percentageOfSales ?? 0,
    quantity: product?.quantity ?? 0,
    quantityPercentage: product?.percentageOfQuantity ?? 0,
    averagePrice: product?.averagePrice ?? 0,
  }));
});

const productsColumns = [
  { key: 'name', label: 'Producto', formatter: 'capitalize' },
  { key: 'collection', label: 'Colección', formatter: 'capitalize' },
  {
    key: 'revenue',
    label: 'Ingresos',
    formatter: (value, row) => `${formatMoney(value)} (${row.revenuePercentage.toFixed(1)}%)`,
  },
  {
    key: 'quantity',
    label: 'Cantidad',
    formatter: (value, row) => `${value} (${row.quantityPercentage.toFixed(1)}%)`,
  },
  { key: 'averagePrice', label: 'Precio Promedio', formatter: 'money' },
];

// Delivery metrics data
const deliveryMetricsData = computed(() => {
  const metrics = safeGet(salesReport.value, 'operationalMetrics.deliveryMetrics');
  if (!metrics) return [];

  return [
    { label: 'Pedidos Entregados', value: `${metrics.totalOrders ?? 0}/${safeGet(salesReport.value, 'summary.totalPaidOrders', 0)} - ${((metrics.totalOrders ?? 0) / (safeGet(salesReport.value, 'summary.totalPaidOrders', 0) || 1) * 100).toFixed(1)}%` },
    { label: 'Total Cobrado a Clientes', value: metrics.totalFees ?? 0, format: 'money' },
    { label: 'Promedio Cobrado a Cliente', value: metrics.averageFee ?? 0, format: 'money' },
    { label: 'Total Pagado a Proveedores', value: metrics.totalCost ?? 0, format: 'money' },
    { label: 'Promedio Pagado a Proveedor', value: metrics.averageCost ?? 0, format: 'money' },
    { label: 'Ganancia', value: metrics.deliveryRevenue ?? 0, format: 'money' },
  ];
});

// Tax metrics data
const taxMetricsData = computed(() => {
  const metrics = safeGet(salesReport.value, 'taxMetrics');
  if (!metrics) return [];

  return [
    { label: 'Items Gravables', value: metrics.taxableItems ?? 0 },
    { label: 'Subtotal', value: metrics.preTaxSubtotal ?? 0, format: 'money' },
    { label: 'IVA', value: metrics.totalTax ?? 0, format: 'money' },
    { label: 'Total', value: metrics.total ?? 0, format: 'money' },
  ];
});

const keyValueColumns = [
  { key: 'label', label: 'Concepto' },
  {
    key: 'value',
    label: 'Valor',
    formatter: (value, row) => row.format === 'money' ? formatMoney(value) : value,
  },
];

watch(
  () => periodStore.periodRange,
  async (newRange) => {
    try {
      loading.value = true;
      // Ensure we have B2B clients first if not already loaded
      if (b2bClients.value.length === 0) {
        await settingsStore.fetchById('default');
        b2bClients.value = await settingsStore.b2b_clients;
      }

      // Then fetch report
      salesReport.value = await orderStore.salesReport({
        filters: {
          dateRange: {
            dateField: 'dueDate',
            startDate: newRange.start.toISOString(),
            endDate: newRange.end.toISOString(),
          },
        },
      });
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      orderStore.error = 'Error al cargar el reporte de ventas';
    } finally {
      loading.value = false;
    }
  },
  { deep: true },
);

onMounted(async () => {
  try {
    loading.value = true;
    // First fetch settings to get B2B clients
    periodStore.setPeriodType('month');
    await settingsStore.fetchById('default');
    await systemSettingsStore.fetchSettings();
    b2bClients.value = await settingsStore.b2b_clients;

    // Then fetch orders
    salesReport.value = await orderStore.salesReport({
      filters: {
        dateRange: {
          dateField: 'dueDate',
          startDate: periodStore.periodRange.start.toISOString(),
          endDate: periodStore.periodRange.end.toISOString(),
        },
      },
    });

    unsubscribeRef.value = await orderStore.subscribeToChanges();
    console.log('🔄 Real-time updates enabled for sales report');
  } catch (error) {
    console.error('Failed to initialize sales report:', error);
    orderStore.error = 'Error al cargar el reporte de ventas';
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => {
  if (unsubscribeRef.value) {
    unsubscribeRef.value();
    orderStore.unsubscribe();
  }
});
</script>

<template>
  <div class="container p-2 sm:p-4 px-2 lg:px-4">
    <div class="flex flex-col lg:flex-row justify-between items-center mb-2 sm:mb-4">
      <h2 class="text-lg sm:text-2xl font-bold text-neutral-800">Reporte de Ventas</h2>
      <div class="flex flex-col">
        <PeriodSelector />
      </div>
    </div>

    <!-- Error State -->
    <div v-if="orderStore.error" class="text-danger text-center py-4">
      {{ orderStore.error }}
    </div>

    <!-- Data States -->
    <template v-else>
      <!-- Summary Table -->
      <div v-if="salesReport?.summary" class="mb-4 sm:mb-8">
        <h3 class="text-base sm:text-lg font-semibold mb-2 sm:mb-4">Resumen</h3>
        <SimpleTable
          :data="summaryData"
          :columns="summaryColumns"
          :hasHeaders="false"
        />
      </div>

      <!-- Period Data Table -->
      <div v-if="periodData?.data" class="mb-4 sm:mb-8">
        <h3 class="text-base sm:text-lg font-semibold mb-2 sm:mb-4">
          Datos por {{ periodData.display }}
        </h3>
        <SimpleTable
          :data="periodTableData"
          :columns="periodColumns"
        />
      </div>

      <!-- Customer Segments Table -->
      <div v-if="salesReport?.salesMetrics?.byCustomerSegment" class="mb-4 sm:mb-8">
        <h3 class="text-base sm:text-lg font-semibold mb-2 sm:mb-4">Segmentos de Cliente</h3>
        <SimpleTable
          :data="customerSegmentsData"
          :columns="customerSegmentsColumns"
        />
      </div>

      <!-- Payment Methods Table -->
      <div v-if="salesReport?.salesMetrics?.byPaymentMethod" class="mb-4 sm:mb-8">
        <h3 class="text-base sm:text-lg font-semibold mb-2 sm:mb-4">Métodos de Pago</h3>
        <SimpleTable
          :data="paymentMethodsData"
          :columns="paymentMethodsColumns"
        />
      </div>

      <!-- Collections Table -->
      <div v-if="salesReport?.salesMetrics?.byCollection" class="mb-4 sm:mb-8">
        <h3 class="text-base sm:text-lg font-semibold mb-2 sm:mb-4">Colecciones</h3>
        <SimpleTable
          :data="collectionsData"
          :columns="collectionsColumns"
        />
      </div>

      <!-- Best Products Table -->
      <div
        v-if="salesReport?.productMetrics?.bestSellers?.bySales?.length"
        class="mb-4 sm:mb-8"
      >
        <h3 class="text-base sm:text-lg font-semibold mb-2 sm:mb-4">Productos Más Vendidos</h3>
        <SimpleTable
          :data="bestProductsData"
          :columns="productsColumns"
        />
      </div>

      <!-- Worst Products Table -->
      <div
        v-if="salesReport?.productMetrics?.lowestSellers?.bySales?.length"
        class="mb-4 sm:mb-8"
      >
        <h3 class="text-base sm:text-lg font-semibold mb-2 sm:mb-4">Productos Menos Vendidos</h3>
        <SimpleTable
          :data="worstProductsData"
          :columns="productsColumns"
        />
      </div>

      <!-- Delivery Metrics Table -->
      <div v-if="salesReport?.operationalMetrics?.deliveryMetrics" class="mb-4 sm:mb-8">
        <h3 class="text-base sm:text-lg font-semibold mb-2 sm:mb-4">Métricas de Entrega</h3>
        <SimpleTable
          :data="deliveryMetricsData"
          :columns="keyValueColumns"
          :hasHeaders="false"
        />
      </div>

      <!-- Tax Metrics Table -->
      <div v-if="salesReport?.taxMetrics" class="mb-4 sm:mb-8">
        <h3 class="text-base sm:text-lg font-semibold mb-2 sm:mb-4">Métricas de Impuestos</h3>
        <SimpleTable
          :data="taxMetricsData"
          :columns="keyValueColumns"
          :hasHeaders="false"
        />
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
* {
  &::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
