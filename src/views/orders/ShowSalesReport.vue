
<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { useOrderStore } from '@/stores/orderStore';
import PeriodSelector from '@/components/common/PeriodSelector.vue';
import { usePeriodStore } from '@/stores/periodStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';

const periodStore = usePeriodStore();
const orderStore = useOrderStore();
const settingsStore = useBakerySettingsStore();
const unsubscribeRef = ref(null);
const b2bClients = ref([]);
const salesReport = ref({});

const periodData = computed(() => {
  if (!salesReport.value?.salesMetrics?.total) return null;

  const { monthly, weekly, daily } = salesReport.value.salesMetrics.total;

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
    .filter(([_, week]) => week.days >= 6)
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
      // Ensure we have B2B clients first if not already loaded
      if (b2bClients.value.length === 0) {
        await settingsStore.fetchById('default');
        b2bClients.value = await settingsStore.b2b_clients;
      }

      // Then fetch report
      salesReport.value = await orderStore.sales_report({
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
    }
  },
  { deep: true },
);

onMounted(async () => {
  try {
    // First fetch settings to get B2B clients
    await settingsStore.fetchById('default');
    b2bClients.value = await settingsStore.b2b_clients;

    // Then fetch orders
    salesReport.value = await orderStore.sales_report({
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
  }
});

onUnmounted(() => {
  if (unsubscribeRef.value) {
    unsubscribeRef.value();
    orderStore.unsubscribe();
  }
});

const formatMoney = (value) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value);
};
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

    <!-- Summary Table -->
    <div v-if="salesReport?.summary" class="mb-8">
      <h3 class="text-lg font-semibold mb-4">Resumen</h3>
      <table class="w-full border-collapse border border-neutral-200 bg-white">
        <tbody>
          <tr class="border-b border-neutral-200">
            <td class="p-2 border-r border-neutral-200">Total Pedidos</td>
            <td class="p-2">{{ salesReport.summary.totalPaidOrders }}</td>
          </tr>
          <tr class="border-b border-neutral-200">
            <td class="p-2 border-r border-neutral-200">Ingreso Domicilios</td>
            <td class="p-2">{{ formatMoney(salesReport.summary.totalDelivery) }}</td>
          </tr>
          <tr class="border-b border-neutral-200">
            <td class="p-2 border-r border-neutral-200">Venta B2B</td>
            <td class="p-2">{{ formatMoney(salesReport.summary.totalB2B) }} ({{ salesReport.summary.percentageB2B }}%)</td>
          </tr>
          <tr class="border-b border-neutral-200">
            <td class="p-2 border-r border-neutral-200">Venta B2C</td>
            <td class="p-2">{{ formatMoney(salesReport.summary.totalB2C) }} ({{ salesReport.summary.percentageB2C }}%)</td>
          </tr>

          <tr class="border-b border-neutral-200">
            <td class="p-2 border-r border-neutral-200">Venta Total</td>
            <td class="p-2">{{ formatMoney(salesReport.summary.totalSales) }}</td>
          </tr>
          <tr >
            <td class="p-2 border-r border-neutral-200">Ingresos Totales</td>
            <td class="p-2">{{ formatMoney(salesReport.summary.totalRevenue) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Period Data Table -->
    <div v-if="periodData" class="mb-8">
      <h3 class="text-lg font-semibold mb-4">Datos por {{ periodData.display }}</h3>
      <table class="w-full border-collapse border border-neutral-200 bg-white">
        <thead>
          <tr class="bg-neutral-100">
            <th class="p-2 border-r border-neutral-200 text-left">Período</th>
            <th class="p-2 border-r border-neutral-200 text-left">Total</th>
            <th class="p-2 border-r border-neutral-200 text-left">Ventas</th>
            <th class="p-2 border-r border-neutral-200 text-left">Domicilios</th>
            <th class="p-2 border-r border-neutral-200 text-left">B2B</th>
            <th class="p-2 text-left">B2C</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(data, period) in periodData.data"
              :key="period"
              class="border-b border-neutral-200">
            <td class="p-2 border-r border-neutral-200">{{ periodData.type === 'weekly' ? `${period.split('/')[0].split('-')[2]} - ${period.split('/')[1].split('-')[2]}` :  period }}</td>
            <td class="p-2 border-r border-neutral-200">{{ formatMoney(data.total) }}</td>
            <td class="p-2 border-r border-neutral-200">{{ formatMoney(data.sales) }}</td>
            <td class="p-2 border-r border-neutral-200">{{ formatMoney(data.delivery) }}</td>
            <td class="p-2 border-r border-neutral-200">
              {{ formatMoney(data.b2b.amount) }} ({{ data.b2b.percentage.toFixed(1) }}%)
            </td>
            <td class="p-2">
              {{ formatMoney(data.b2c.amount) }} ({{ data.b2c.percentage.toFixed(1) }}%)
            </td>
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
            <th class="p-2 text-left">Promedio</th>
          </tr>
        </thead>
        <tbody>
          <tr class="border-b border-neutral-200">
            <td class="p-2 border-r border-neutral-200">B2B</td>
            <td class="p-2 border-r border-neutral-200">
              {{ formatMoney(salesReport.salesMetrics.byCustomerSegment.b2b.total) }}
              ({{ salesReport.salesMetrics.byCustomerSegment.b2b.percentageSales.toFixed(1) }}%)
            </td>
            <td class="p-2 border-r border-neutral-200">{{ salesReport.salesMetrics.byCustomerSegment.b2b.orders }}</td>
            <td class="p-2">{{ formatMoney(salesReport.salesMetrics.byCustomerSegment.b2b.averagePrice) }}</td>
          </tr>
          <tr>
            <td class="p-2 border-r border-neutral-200">B2C</td>
            <td class="p-2 border-r border-neutral-200">
              {{ formatMoney(salesReport.salesMetrics.byCustomerSegment.b2c.total) }}
              ({{ salesReport.salesMetrics.byCustomerSegment.b2c.percentageSales.toFixed(1) }}%)
            </td>
            <td class="p-2 border-r border-neutral-200">{{ salesReport.salesMetrics.byCustomerSegment.b2c.orders }}</td>
            <td class="p-2">{{ formatMoney(salesReport.salesMetrics.byCustomerSegment.b2c.averagePrice) }}</td>
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
                {{ formatMoney(data.total) }} ({{ data.percentage.toFixed(1) }}%)
              </td>
              <td class="p-2">{{ data.orders }}</td>
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
          <template v-for="(collection, index) in Object.entries(salesReport.salesMetrics.byCollection).sort((a, b) => b[1].revenue - a[1].revenue)" :key="index">
            <tr class="border-b border-neutral-200">
              <td class="p-2 border-r border-neutral-200 capitalize">{{ collection[0] }}</td>
              <td class="p-2 border-r border-neutral-200">
                {{ formatMoney(collection[1].revenue) }} ({{ collection[1].percentageRevenue.toFixed(1) }}%)
              </td>
              <td class="p-2 border-r border-neutral-200">
                {{ collection[1].quantity }} ({{ collection[1].percentageQuantity.toFixed(1) }}%)
              </td>
              <td class="p-2">{{ formatMoney(collection[1].averagePrice) }}</td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Best Products Table -->
    <div v-if="salesReport?.productMetrics?.bestSellers?.bySales" class="mb-8">
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
            <td class="p-2 border-r border-neutral-200 capitalize">{{ product.name }}</td>
            <td class="p-2 border-r border-neutral-200 capitalize">{{ product.collection }}</td>
            <td class="p-2 border-r border-neutral-200">
              {{ formatMoney(product.revenue) }} ({{ product.percentageOfSales.toFixed(1) }}%)
            </td>
            <td class="p-2 border-r border-neutral-200">
              {{ product.quantity }} ({{ product.percentageOfQuantity.toFixed(1) }}%)
            </td>
            <td class="p-2">{{ formatMoney(product.averagePrice) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Worst Products Table -->
    <div v-if="salesReport?.productMetrics?.lowestSellers?.bySales" class="mb-8">
      <h3 class="text-lg font-semibold mb-4">Productos Menos Vendidos</h3>
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
          <tr v-for="product in salesReport.productMetrics.lowestSellers.bySales"
              :key="product.productId"
              class="border-b border-neutral-200">
            <td class="p-2 border-r border-neutral-200 capitalize">{{ product.name }}</td>
            <td class="p-2 border-r border-neutral-200 capitalize">{{ product.collection }}</td>
            <td class="p-2 border-r border-neutral-200">
              {{ formatMoney(product.revenue) }} ({{ product.percentageOfSales.toFixed(1) }}%)
            </td>
            <td class="p-2 border-r border-neutral-200">
              {{ product.quantity }} ({{ product.percentageOfQuantity.toFixed(1) }}%)
            </td>
            <td class="p-2">{{ formatMoney(product.averagePrice) }}</td>
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
            <td class="p-2 border-r border-neutral-200">Total Pedidos</td>
            <td class="p-2">{{ salesReport.operationalMetrics.deliveryMetrics.totalOrders }}</td>
          </tr>
          <tr class="border-b border-neutral-200">
            <td class="p-2 border-r border-neutral-200">Total Cobrado</td>
            <td class="p-2">{{ formatMoney(salesReport.operationalMetrics.deliveryMetrics.totalFees) }}</td>
          </tr>
          <tr class="border-b border-neutral-200">
            <td class="p-2 border-r border-neutral-200">Promedio por Pedido</td>
            <td class="p-2">{{ formatMoney(salesReport.operationalMetrics.deliveryMetrics.averageFee) }}</td>
          </tr>
          <tr class="border-b border-neutral-200">
            <td class="p-2 border-r border-neutral-200">Costo Total</td>
            <td class="p-2">{{ formatMoney(salesReport.operationalMetrics.deliveryMetrics.totalCost) }}</td>
          </tr>
          <tr>
            <td class="p-2 border-r border-neutral-200">Ganancia</td>
            <td class="p-2">{{ formatMoney(salesReport.operationalMetrics.deliveryMetrics.deliveryRevenue) }}</td>
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
            <td class="p-2">{{ salesReport.taxMetrics.taxableItems }}</td>
          </tr>
          <tr class="border-b border-neutral-200">
            <td class="p-2 border-r border-neutral-200">Subtotal</td>
            <td class="p-2">{{ formatMoney(salesReport.taxMetrics.preTaxSubtotal) }}</td>
          </tr>
          <tr class="border-b border-neutral-200">
            <td class="p-2 border-r border-neutral-200">IVA</td>
            <td class="p-2">{{ formatMoney(salesReport.taxMetrics.totalTax) }}</td>
          </tr>
          <tr>
            <td class="p-2 border-r border-neutral-200">Total</td>
            <td class="p-2">{{ formatMoney(salesReport.taxMetrics.total) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
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
