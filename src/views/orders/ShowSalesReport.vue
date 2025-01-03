
<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import DataTable from '@/components/DataTable/index.vue';
import MoneyCell from '@/components/DataTable/renderers/MoneyCell.vue';
import { useOrderStore } from '@/stores/orderStore';
import PeriodSelector from '@/components/common/PeriodSelector.vue';
import { usePeriodStore } from '@/stores/periodStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';

const periodStore = usePeriodStore();
const orderStore = useOrderStore();
const settingsStore = useBakerySettingsStore();
const unsubscribeRef = ref(null);
const b2bClients = ref([]);

// Helper function to check if a client is B2B
const isB2BClient = (userId) => {
  return b2bClients.value.some(client => client.id === userId);
};

// Table columns for product analysis
const columns = [
  {
    id: 'productName',
    label: 'Producto',
    field: 'productName',
    sortable: true,
  },
  {
    id: 'variationName',
    label: 'Variación',
    field: 'variationName',
    sortable: true,
  },
  {
    id: 'quantity',
    label: 'Cantidad',
    field: 'quantity',
    sortable: true,
  },
  {
    id: 'totalAmount',
    label: 'Total',
    field: 'totalAmount',
    sortable: true,
    component: MoneyCell,
    getProps: (row) => ({
      value: row.totalAmount,
    }),
  },
];

// Helper function to calculate sales metrics
const calculateMetrics = (orders) => {
  const total = orders.reduce((sum, order) => sum + order.total, 0);
  const delivery = orders.reduce((sum, order) => sum + (order.deliveryFee || 0), 0);
  return {
    total,
    delivery,
    withoutDelivery: total - delivery,
  };
};

// Computed for valid orders (excluding complementary)
const validOrders = computed(() => {
  return orderStore.items.filter(order => {
    if (order.isComplimentary) return false;
    // Add B2B status to each order based on client ID
    order.isB2B = isB2BClient(order.userId);
    return true;
  });
});

// Compute daily breakdowns
const dailyBreakdown = computed(() => {
  const days = {};

  validOrders.value.forEach(order => {
    const date = new Date(order.dueDate).toISOString().split('T')[0];
    if (!days[date]) {
      days[date] = {
        b2b: [],
        b2c: [],
      };
    }

    // Sort into B2B or B2C
    if (order.isB2B) {
      days[date].b2b.push(order);
    } else {
      days[date].b2c.push(order);
    }
  });

  // Calculate metrics for each day
  return Object.entries(days).map(([date, data]) => ({
    date,
    b2b: calculateMetrics(data.b2b),
    b2c: calculateMetrics(data.b2c),
    total: calculateMetrics([...data.b2b, ...data.b2c]),
  }));
});

// Compute period totals
const periodTotals = computed(() => {
  const b2bOrders = validOrders.value.filter(order => order.isB2B);
  const b2cOrders = validOrders.value.filter(order => !order.isB2B);

  return {
    b2b: calculateMetrics(b2bOrders),
    b2c: calculateMetrics(b2cOrders),
    total: calculateMetrics(validOrders.value),
  };
});

// Compute complementary orders count
const complementaryOrders = computed(() => {
  return orderStore.items.filter(order => order.isComplimentary).length;
});

// Compute product analysis
const productAnalysis = computed(() => {
  const products = {};

  validOrders.value.forEach(order => {
    order.orderItems.forEach(item => {
      const key = `${item.productId}-${item.variation ? item.variation.name : 'default'}`;
      if (!products[key]) {
        products[key] = {
          productName: item.productName,
          variationName: item.variation ? item.variation.name : 'default',
          quantity: 0,
          totalAmount: 0,
        };
      }
      products[key].quantity += item.quantity;
      products[key].totalAmount += item.quantity * item.currentPrice;
    });
  });

  return Object.values(products);
});

// Watch for period changes and fetch new data
watch(
  () => periodStore.periodRange,
  async (newRange) => {
    try {
      // Ensure we have B2B clients first if not already loaded
      if (b2bClients.value.length === 0) {
        await settingsStore.fetchById('default');
        b2bClients.value = await settingsStore.b2b_clients;
      }

      // Then fetch orders
      await orderStore.fetchAll({
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
    await orderStore.fetchAll({
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

    <!-- Period Summary Card -->
    <div class="bg-white shadow-lg rounded-lg p-4 mb-4">
      <h3 class="text-xl font-semibold mb-4">Resumen del Periodo</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- B2B Section -->
        <div class="bg-neutral-50 p-4 rounded-lg">
          <h4 class="font-semibold text-lg mb-2">B2B</h4>
          <div class="space-y-2">
            <p>Total: {{ periodTotals.b2b.total.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }) }}</p>
            <p>Sin Domicilio: {{ periodTotals.b2b.withoutDelivery.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }) }}</p>
            <p>Domicilio: {{ periodTotals.b2b.delivery.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }) }}</p>
          </div>
        </div>
        <!-- B2C Section -->
        <div class="bg-neutral-50 p-4 rounded-lg">
          <h4 class="font-semibold text-lg mb-2">B2C</h4>
          <div class="space-y-2">
            <p>Total: {{ periodTotals.b2c.total.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }) }}</p>
            <p>Sin Domicilio: {{ periodTotals.b2c.withoutDelivery.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }) }}</p>
            <p>Domicilio: {{ periodTotals.b2c.delivery.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }) }}</p>
          </div>
        </div>
      </div>
      <!-- Period Totals -->
      <div class="mt-4 p-4 bg-primary-100 rounded-lg">
        <h4 class="font-semibold text-lg mb-2">Total Periodo</h4>
        <div class="space-y-2">
          <p>Total: {{ periodTotals.total.total.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }) }}</p>
          <p>Sin Domicilio: {{ periodTotals.total.withoutDelivery.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }) }}</p>
          <p>Domicilio: {{ periodTotals.total.delivery.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }) }}</p>
        </div>
      </div>
    </div>

    <!-- Complementary Orders Card -->
    <div class="bg-white shadow-lg rounded-lg p-4 mb-4">
      <h3 class="text-xl font-semibold mb-2">Pedidos Cortesia</h3>
      <p>Total pedidos: {{ complementaryOrders }}</p>
    </div>

    <!-- Daily Breakdown Table -->
    <div class="bg-white shadow-lg rounded-lg p-4 mb-4 overflow-x-auto">
      <h3 class="text-xl font-semibold mb-4">Desglose Diario</h3>
      <table class="min-w-full">
        <thead>
          <tr class="bg-neutral-50">
            <th class="px-4 py-2 text-left">Fecha</th>
            <th class="px-4 py-2 text-center" colspan="3">B2C</th>
            <th class="px-4 py-2 text-center" colspan="3">B2B</th>
            <th class="px-4 py-2 text-center" colspan="3">Total Día</th>
          </tr>
          <tr class="bg-neutral-100">
            <th class="px-4 py-2 text-left"></th>
            <!-- B2B Subheaders -->
            <th class="px-4 py-2 text-right">Venta</th>
            <th class="px-4 py-2 text-right">Domicilio</th>
            <th class="px-4 py-2 text-right">Total</th>
            <!-- B2C Subheaders -->
            <th class="px-4 py-2 text-right">Venta</th>
            <th class="px-4 py-2 text-right">Domicilio</th>
            <th class="px-4 py-2 text-right">Total</th>
            <!-- Day Total Subheaders -->
            <th class="px-4 py-2 text-right">Venta</th>
            <th class="px-4 py-2 text-right">Domicilio</th>
            <th class="px-4 py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="day in dailyBreakdown"
              :key="day.date"
              class="border-b hover:bg-neutral-50">
            <td class="px-4 py-2">
              {{ new Date(day.date).toLocaleDateString('es-CO', { weekday: 'short', month: 'short', day: 'numeric' }) }}
            </td>
            <!-- B2C Data -->
            <td class="px-4 py-2 text-right">
              {{ day.b2c.withoutDelivery.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }) }}
            </td>
            <td class="px-4 py-2 text-right">
              {{ day.b2c.delivery.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }) }}
            </td>
            <td class="px-4 py-2 text-right">
              {{ day.b2c.total.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }) }}
            </td>
            <!-- B2B Data -->
            <td class="px-4 py-2 text-right">
              {{ day.b2b.withoutDelivery.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }) }}
            </td>
            <td class="px-4 py-2 text-right">
              {{ day.b2b.delivery.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }) }}
            </td>
            <td class="px-4 py-2 text-right">
              {{ day.b2b.total.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }) }}
            </td>
            <!-- Day Totals -->
            <td class="px-4 py-2 text-right font-medium">
              {{ day.total.withoutDelivery.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }) }}
            </td>
            <td class="px-4 py-2 text-right font-medium">
              {{ day.total.delivery.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }) }}
            </td>
            <td class="px-4 py-2 text-right font-medium">
              {{ day.total.total.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Product Analysis Table -->
    <div class="bg-white shadow-lg rounded-lg p-4">
      <h3 class="text-xl font-semibold mb-4">Análisis de Productos</h3>
      <DataTable
        :data="productAnalysis"
        :columns="columns"
        :data-loading="orderStore.loading"
        class="bg-white"
      />
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
