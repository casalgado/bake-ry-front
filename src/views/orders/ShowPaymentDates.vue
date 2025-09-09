<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { useOrderStore } from '@/stores/orderStore';
import PeriodSelector from '@/components/common/PeriodSelector.vue';
import SimpleTable from '@/components/common/SimpleTable.vue';
import { usePeriodStore } from '@/stores/periodStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { formatMoney } from '@/utils/helpers';
import { exportPaymentReport, exportProducts } from '@/utils/exportOrders';

const periodStore = usePeriodStore();
const orderStore = useOrderStore();
const settingsStore = useBakerySettingsStore();
const unsubscribeRef = ref(null);
const b2bClients = ref([]);
const loading = ref(false);

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

      await orderStore.fetchAll({
        filters: {
          orDateRange: {
            dateFields: ['paymentDate', 'partialPaymentDate'],
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

const paymentEntries = computed(() => {
  const entries = [];

  orderStore.items.forEach((order) => {
    if (order.isComplimentary) {
      // Skip complimentary orders
      return;
    }
    // Handle partial payments (always show if exists)
    if (order.partialPaymentDate && order.partialPaymentAmount > 0) {
      entries.push({
        id: `${order.id}-partial`,
        paymentDate: order.partialPaymentDate,
        orderDate: order.dueDate,
        userName: `${order.userName}${order.userLegalName ? ` - ${order.userLegalName} -` : ''}`,
        total: order.partialPaymentAmount,
        order: order,
        paymentType: 'parcial',
      });

      // Only show balance payment if order is fully paid
      if (order.isPaid) {
        const remaining = order.total - order.partialPaymentAmount;
        if (remaining > 0 && order.paymentDate) {
          entries.push({
            id: `${order.id}-final`,
            paymentDate: order.paymentDate,
            orderDate: order.dueDate,
            userName: `${order.userName}${order.userLegalName ? ` - ${order.userLegalName} -` : ''}`,
            total: remaining,
            order: order,
            paymentType: 'saldo',
          });
        }
      }
    }
    // Handle full payments only for paid orders with payment date
    else if (order.isPaid && order.paymentDate) {
      entries.push({
        id: order.id,
        paymentDate: order.paymentDate,
        orderDate: order.dueDate,
        userName: `${order.userName}${order.userLegalName ? ` - ${order.userLegalName} -` : ''}`,
        total: order.total,
        order: order,
        paymentType: 'completo',
      });
    }
  });

  // Sort by payment date
  return entries.sort(
    (a, b) => new Date(a.paymentDate || 0) - new Date(b.paymentDate || 0),
  );
});

const shouldAddSpacing = computed(() => {
  return (index) => {
    const currentEntry = paymentEntries.value[index];
    const nextEntry = paymentEntries.value[index + 1];

    if (!nextEntry) return false; // Last item, no spacing needed

    // Compare dates (normalize to same day)
    const currentDate = new Date(currentEntry.paymentDate).toDateString();
    const nextDate = new Date(nextEntry.paymentDate).toDateString();

    return currentDate !== nextDate;
  };
});

// Payment table columns
const paymentColumns = [
  {
    key: 'paymentDate',
    label: 'Fecha de Pago',
    formatter: 'date',
    formatterOptions: {
      locale: 'es-CO',
      options: {
        day: 'numeric',
        month: 'long',
      },
    },
  },
  {
    key: 'orderDate',
    label: 'Fecha del Pedido',
    formatter: 'date',
    formatterOptions: {
      locale: 'es-CO',
      options: {
        day: 'numeric',
        month: 'long',
      },
    },
  },
  {
    key: 'paymentType',
    label: 'Tipo de Pago',
    formatter: (value) => value || '-',
  },
  {
    key: 'userName',
    label: 'Cliente',
  },
  {
    key: 'total',
    label: 'Total',
    formatter: 'money',
  },
];

onMounted(async () => {
  try {
    loading.value = true;
    // First fetch settings to get B2B clients
    periodStore.setPeriodType('month');
    await settingsStore.fetchById('default');
    b2bClients.value = await settingsStore.b2b_clients;

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
    orderStore.error = 'Error al cargar el reporte de ventas';
  } finally {
    loading.value = false;
  }
});

const handleExportWithClients = () => {
  exportPaymentReport(orderStore.items);
};

const handleExportProducts = () => {
  exportProducts(orderStore.items);
};

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
      <h2 class="text-lg sm:text-2xl font-bold text-neutral-800">Fechas de Pago</h2>
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
      <!-- Export Section -->
      <div class="flex flex-col sm:flex-row items-center gap-2 sm:justify-end mt-2 bg-neutral-100 p-2">
        <h3 class="m-0 text-sm sm:text-base">Exportar Reporte:</h3>
        <div class="flex flex-row gap-1 sm:gap-2">
          <button class="btn utility-btn text-xs sm:text-sm" @click="handleExportProducts">
            Productos Consolidados
          </button>
          <button class="btn utility-btn text-xs sm:text-sm" @click="handleExportWithClients">
            Con info Clientes
          </button>
        </div>
      </div>

      <!-- Payment Table -->
      <SimpleTable
        :data="paymentEntries"
        :columns="paymentColumns"
        :showDividers="true"
        :dividerCondition="shouldAddSpacing"
      />
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
