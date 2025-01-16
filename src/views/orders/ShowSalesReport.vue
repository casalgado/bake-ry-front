<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { useOrderStore } from '@/stores/orderStore';
import PeriodSelector from '@/components/common/PeriodSelector.vue';
import { usePeriodStore } from '@/stores/periodStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { formatMoney } from '@/utils/helpers';

const periodStore = usePeriodStore();
const orderStore = useOrderStore();
const settingsStore = useBakerySettingsStore();
const unsubscribeRef = ref(null);
const b2bClients = ref([]);
const salesReport = ref({});
const loading = ref(false);

// Helper function to safely access nested properties
const safeGet = (obj, path, defaultValue = null) => {
  try {
    return path.split('.').reduce((acc, part) => acc?.[part], obj) ?? defaultValue;
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
    await settingsStore.fetchById('default');
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
  <div class="container p-4 px-0 lg:px-4">
    <div class="flex flex-col lg:flex-row justify-between items-center mb-4">
      <h2 class="text-2xl font-bold text-neutral-800">Reporte de Ventas</h2>
      <PeriodSelector />
    </div>

    <!-- Error State -->
    <div v-if="orderStore.error" class="text-danger text-center py-4">
      {{ orderStore.error }}
    </div>

    <!-- Empty State -->
    <div v-else-if="!salesReport?.summary" class="text-center py-4">
      <p class="text-neutral-600">No hay datos disponibles para el período seleccionado</p>
    </div>

    <!-- Data States -->
    <template v-else>
      <!-- Summary Table -->
      <div v-if="salesReport?.summary" class="mb-8">
        <h3 class="text-lg font-semibold mb-4">Resumen</h3>
        <table class="w-full border-collapse border border-neutral-200 bg-white">
          <tbody>
            <tr class="border-b border-neutral-200">
              <td class="p-2 border-r border-neutral-200">Total Pedidos</td>
              <td class="p-2">{{ safeGet(salesReport, 'summary.totalPaidOrders', 0) }}</td>
            </tr>
            <tr class="border-b border-neutral-200">
              <td class="p-2 border-r border-neutral-200">Ingreso Domicilios</td>
              <td class="p-2">{{ formatMoney(safeGet(salesReport, 'summary.totalDelivery', 0)) }}</td>
            </tr>
            <tr class="border-b border-neutral-200">
              <td class="p-2 border-r border-neutral-200">Venta B2B</td>
              <td class="p-2">
                {{ formatMoney(safeGet(salesReport, 'summary.totalB2B', 0)) }}
                ({{ safeGet(salesReport, 'summary.percentageB2B', 0).toFixed(1) }}%)
              </td>
            </tr>
            <tr class="border-b border-neutral-200">
              <td class="p-2 border-r border-neutral-200">Venta B2C</td>
              <td class="p-2">
                {{ formatMoney(safeGet(salesReport, 'summary.totalB2C', 0)) }}
                ({{ safeGet(salesReport, 'summary.percentageB2C', 0).toFixed(1) }}%)
              </td>
            </tr>
            <tr class="border-b border-neutral-200">
              <td class="p-2 border-r border-neutral-200">Venta Total</td>
              <td class="p-2">{{ formatMoney(safeGet(salesReport, 'summary.totalSales', 0)) }}</td>
            </tr>
            <tr>
              <td class="p-2 border-r border-neutral-200">Ingresos Totales</td>
              <td class="p-2">{{ formatMoney(safeGet(salesReport, 'summary.totalRevenue', 0)) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Period Data Table -->
      <div v-if="periodData?.data" class="mb-8">
        <h3 class="text-lg font-semibold mb-4">Datos por {{ periodData.display }}</h3>
        <table class="w-full border-collapse border border-neutral-200 bg-white">
          <thead>
            <tr class="bg-neutral-100">
              <th class="p-2 border-r border-neutral-200 text-left">Período</th>
              <th class="p-2 border-r border-neutral-200 text-left">Domicilios</th>
              <th class="p-2 border-r border-neutral-200 text-left">B2B</th>
              <th class="p-2 border-r border-neutral-200 text-left">B2C</th>
              <th class="p-2 border-r border-neutral-200 text-left">Venta</th>
              <th class="p-2 text-left">Ingresos</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(data, period) in periodData.data"
                :key="period"
                class="border-b border-neutral-200">
              <td class="p-2 border-r border-neutral-200">
                {{ periodData.type === 'weekly' ? `${period.split('/')[0].split('-')[2]} - ${period.split('/')[1].split('-')[2]}` : period }}
              </td>
              <td class="p-2 border-r border-neutral-200">{{ formatMoney(data?.delivery ?? 0) }}</td>
              <td class="p-2 border-r border-neutral-200">
                {{ formatMoney(data?.b2b?.amount ?? 0) }}
                ({{ (data?.b2b?.percentage ?? 0).toFixed(1) }}%)
              </td>
              <td class="p-2 border-r border-neutral-200">
                {{ formatMoney(data?.b2c?.amount ?? 0) }}
                ({{ (data?.b2c?.percentage ?? 0).toFixed(1) }}%)
              </td>
              <td class="p-2 border-r border-neutral-200">{{ formatMoney(data?.sales ?? 0) }}</td>
              <td class="p-2">{{ formatMoney(data?.total ?? 0) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Customer Segments Table -->
      <div v-if="salesReport?.salesMetrics?.byCustomerSegment" class="mb-8">
        <h3 class="text-lg font-semibold mb-4">Segmentos de Cliente</h3>
        <table class="w-full border-collapse border border-neutral-200 bg-white">
          <thead>
            <tr class="bg-neutral-100">
              <th class="p-2 border-r border-neutral-200 text-left">Segmento</th>
              <th class="p-2 border-r border-neutral-200 text-left">Ventas</th>
              <th class="p-2 border-r border-neutral-200 text-left">Pedidos</th>
              <th class="p-2 text-left">Ticket Promedio</th>
            </tr>
          </thead>
          <tbody>
            <tr class="border-b border-neutral-200">
              <td class="p-2 border-r border-neutral-200">B2B</td>
              <td class="p-2 border-r border-neutral-200">
                {{ formatMoney(safeGet(salesReport, 'salesMetrics.byCustomerSegment.b2b.total', 0)) }}
                ({{ safeGet(salesReport, 'salesMetrics.byCustomerSegment.b2b.percentageSales', 0).toFixed(1) }}%)
              </td>
              <td class="p-2 border-r border-neutral-200">
                {{ safeGet(salesReport, 'salesMetrics.byCustomerSegment.b2b.orders', 0) }}
              </td>
              <td class="p-2">
                {{ formatMoney(safeGet(salesReport, 'salesMetrics.byCustomerSegment.b2b.averagePrice', 0)) }}
              </td>
            </tr>
            <tr>
              <td class="p-2 border-r border-neutral-200">B2C</td>
              <td class="p-2 border-r border-neutral-200">
                {{ formatMoney(safeGet(salesReport, 'salesMetrics.byCustomerSegment.b2c.total', 0)) }}
                ({{ safeGet(salesReport, 'salesMetrics.byCustomerSegment.b2c.percentageSales', 0).toFixed(1) }}%)
              </td>
              <td class="p-2 border-r border-neutral-200">
                {{ safeGet(salesReport, 'salesMetrics.byCustomerSegment.b2c.orders', 0) }}
              </td>
              <td class="p-2">
                {{ formatMoney(safeGet(salesReport, 'salesMetrics.byCustomerSegment.b2c.averagePrice', 0)) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Payment Methods Table -->
      <div v-if="salesReport?.salesMetrics?.byPaymentMethod" class="mb-8">
        <h3 class="text-lg font-semibold mb-4">Métodos de Pago</h3>
        <table class="w-full border-collapse border border-neutral-200 bg-white">
          <thead>
            <tr class="bg-neutral-100">
              <th class="p-2 border-r border-neutral-200 text-left">Método</th>
              <th class="p-2 border-r border-neutral-200 text-left">Total</th>
              <th class="p-2 text-left">Pedidos</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(data, method) in salesReport.salesMetrics.byPaymentMethod" :key="method">
              <tr class="border-b border-neutral-200">
                <td class="p-2 border-r border-neutral-200 capitalize">{{ method }}</td>
                <td class="p-2 border-r border-neutral-200">
                  {{ formatMoney(data?.total ?? 0) }}
                  ({{ (data?.percentage ?? 0).toFixed(1) }}%)
                </td>
                <td class="p-2">{{ data?.orders ?? 0 }}</td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Collections Table -->
      <div v-if="salesReport?.salesMetrics?.byCollection" class="mb-8">
        <h3 class="text-lg font-semibold mb-4">Colecciones</h3>
        <table class="w-full border-collapse border border-neutral-200 bg-white">
          <thead>
            <tr class="bg-neutral-100">
              <th class="p-2 border-r border-neutral-200 text-left">Colección</th>
              <th class="p-2 border-r border-neutral-200 text-left">Ingresos</th>
              <th class="p-2 border-r border-neutral-200 text-left">Cantidad</th>
              <th class="p-2 text-left">Precio Promedio</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(collection, index) in Object.entries(salesReport.salesMetrics.byCollection ?? {})
              .sort((a, b) => (b[1]?.revenue ?? 0) - (a[1]?.revenue ?? 0))" :key="index">
              <tr class="border-b border-neutral-200">
                <td class="p-2 border-r border-neutral-200 capitalize">{{ collection[0] }}</td>
                <td class="p-2 border-r border-neutral-200">
                  {{ formatMoney(collection[1]?.revenue ?? 0) }}
                  ({{ (collection[1]?.percentageRevenue ?? 0).toFixed(1) }}%)
                </td>
                <td class="p-2 border-r border-neutral-200">
                  {{ collection[1]?.quantity ?? 0 }}
                  ({{ (collection[1]?.percentageQuantity ?? 0).toFixed(1) }}%)
                </td>
                <td class="p-2">{{ formatMoney(collection[1]?.averagePrice ?? 0) }}</td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Best Products Table -->
      <div v-if="salesReport?.productMetrics?.bestSellers?.bySales?.length" class="mb-8">
        <h3 class="text-lg font-semibold mb-4">Productos Más Vendidos</h3>
        <table class="w-full border-collapse border border-neutral-200 bg-white">
          <thead>
            <tr class="bg-neutral-100">
              <th class="p-2 border-r border-neutral-200 text-left">Producto</th>
              <th class="p-2 border-r border-neutral-200 text-left">Colección</th>
              <th class="p-2 border-r border-neutral-200 text-left">Ingresos</th>
              <th class="p-2 border-r border-neutral-200 text-left">Cantidad</th>
              <th class="p-2 text-left">Precio Promedio</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="product in salesReport.productMetrics.bestSellers.bySales"
                :key="product.productId"
                class="border-b border-neutral-200">
              <td class="p-2 border-r border-neutral-200 capitalize">{{ product?.name ?? 'N/A' }}</td>
              <td class="p-2 border-r border-neutral-200 capitalize">{{ product?.collection ?? 'N/A' }}</td>
              <td class="p-2 border-r border-neutral-200">
                {{ formatMoney(product?.revenue ?? 0) }}
                ({{ (product?.percentageOfSales ?? 0).toFixed(1) }}%)
              </td>
              <td class="p-2 border-r border-neutral-200">
                {{ product?.quantity ?? 0 }}
                ({{ (product?.percentageOfQuantity ?? 0).toFixed(1) }}%)
              </td>
              <td class="p-2">{{ formatMoney(product?.averagePrice ?? 0) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Worst Products Table -->
      <div v-if="salesReport?.productMetrics?.lowestSellers?.bySales?.length" class="mb-8">
        <h3 class="text-lg font-semibold mb-4">Productos Menos Vendidos</h3>
        <table class="w-full border-collapse border border-neutral-200 bg-white">
          <thead>
            <tr class="bg-neutral-100">
              <th class="p-2 border-r border-neutral-200 text-left">Producto</th>
              <th class="p-2 border-r border-neutral-200text-left">Colección</th>
              <th class="p-2 border-r border-neutral-200 text-left">Ingresos</th>
              <th class="p-2 border-r border-neutral-200 text-left">Cantidad</th>
              <th class="p-2 text-left">Precio Promedio</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="product in salesReport.productMetrics.lowestSellers.bySales"
                :key="product.productId"
                class="border-b border-neutral-200">
              <td class="p-2 border-r border-neutral-200 capitalize">{{ product?.name ?? 'N/A' }}</td>
              <td class="p-2 border-r border-neutral-200 capitalize">{{ product?.collection ?? 'N/A' }}</td>
              <td class="p-2 border-r border-neutral-200">
                {{ formatMoney(product?.revenue ?? 0) }}
                ({{ (product?.percentageOfSales ?? 0).toFixed(1) }}%)
              </td>
              <td class="p-2 border-r border-neutral-200">
                {{ product?.quantity ?? 0 }}
                ({{ (product?.percentageOfQuantity ?? 0).toFixed(1) }}%)
              </td>
              <td class="p-2">{{ formatMoney(product?.averagePrice ?? 0) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Delivery Metrics Table -->
      <div v-if="salesReport?.operationalMetrics?.deliveryMetrics" class="mb-8">
        <h3 class="text-lg font-semibold mb-4">Métricas de Entrega</h3>
        <table class="w-full border-collapse border border-neutral-200 bg-white">
          <tbody>
            <tr class="border-b border-neutral-200">
              <td class="p-2 border-r border-neutral-200">Pedidos Entregados</td>
              <td class="p-2">{{ safeGet(salesReport, 'operationalMetrics.deliveryMetrics.totalOrders', 0) }}</td>
            </tr>
            <tr class="border-b border-neutral-200">
              <td class="p-2 border-r border-neutral-200">Total Cobrado a Clientes</td>
              <td class="p-2">{{ formatMoney(safeGet(salesReport, 'operationalMetrics.deliveryMetrics.totalFees', 0)) }}</td>
            </tr>
            <tr class="border-b border-neutral-200">
              <td class="p-2 border-r border-neutral-200">Promedio Cobrado a Cliente</td>
              <td class="p-2">{{ formatMoney(safeGet(salesReport, 'operationalMetrics.deliveryMetrics.averageFee', 0)) }}</td>
            </tr>
            <tr class="border-b border-neutral-200">
              <td class="p-2 border-r border-neutral-200">Total Pagado a Proveedores</td>
              <td class="p-2">{{ formatMoney(safeGet(salesReport, 'operationalMetrics.deliveryMetrics.totalCost', 0)) }}</td>
            </tr>
            <tr class="border-b border-neutral-200">
              <td class="p-2 border-r border-neutral-200">Promedio Pagado a Proveedor</td>
              <td class="p-2">{{ formatMoney(safeGet(salesReport, 'operationalMetrics.deliveryMetrics.averageCost', 0)) }}</td>
            </tr>
            <tr>
              <td class="p-2 border-r border-neutral-200">Ganancia</td>
              <td class="p-2">{{ formatMoney(safeGet(salesReport, 'operationalMetrics.deliveryMetrics.deliveryRevenue', 0)) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Tax Metrics Table -->
      <div v-if="salesReport?.taxMetrics" class="mb-8">
        <h3 class="text-lg font-semibold mb-4">Métricas de Impuestos</h3>
        <table class="w-full border-collapse border border-neutral-200 bg-white">
          <tbody>
            <tr class="border-b border-neutral-200">
              <td class="p-2 border-r border-neutral-200">Items Gravables</td>
              <td class="p-2">{{ safeGet(salesReport, 'taxMetrics.taxableItems', 0) }}</td>
            </tr>
            <tr class="border-b border-neutral-200">
              <td class="p-2 border-r border-neutral-200">Subtotal</td>
              <td class="p-2">{{ formatMoney(safeGet(salesReport, 'taxMetrics.preTaxSubtotal', 0)) }}</td>
            </tr>
            <tr class="border-b border-neutral-200">
              <td class="p-2 border-r border-neutral-200">IVA</td>
              <td class="p-2">{{ formatMoney(safeGet(salesReport, 'taxMetrics.totalTax', 0)) }}</td>
            </tr>
            <tr>
              <td class="p-2 border-r border-neutral-200">Total</td>
              <td class="p-2">{{ formatMoney(safeGet(salesReport, 'taxMetrics.total', 0)) }}</td>
            </tr>
          </tbody>
        </table>
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
