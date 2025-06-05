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

const paymentEntries = computed(() => {
  const entries = [];

  orderStore.items.forEach((order) => {

    // Handle partial payments
    if (order.partialPaymentDate && order.partialPaymentAmount > 0) {
      entries.push({
        id: `${order.id}-partial`,
        paymentDate: order.partialPaymentDate,
        userName: order.userName,
        total: order.partialPaymentAmount,
        order: order,
        paymentType: 'parcial',
      });

      // Calculate remaining amount
      const remaining = order.total - order.partialPaymentAmount;
      if (remaining > 0) {
        entries.push({
          id: `${order.id}-final`,
          paymentDate: order.paymentDate,
          userName: order.userName,
          total: remaining,
          order: order,
          paymentType: 'saldo',
        });
      }
    }
    // Handle full payments
    else if (order.paymentDate) {
      entries.push({
        id: order.id,
        paymentDate: order.paymentDate,
        userName: order.userName,
        total: order.total,
        order: order,
        paymentType: 'completo',
      });
    }
  });

  // Sort by payment date
  return entries.sort(
    (a, b) => new Date(a.paymentDate) - new Date(b.paymentDate),
  );
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
      <h2 class="text-2xl font-bold text-neutral-800">Fechas de Pago</h2>
      <PeriodSelector />
    </div>

    <pre>{{
      orderStore.items.map((e) => ({
        id: e.id,
        isPaid: e.isPaid,
        partialPaymentAmount: e.partialPaymentAmount,
        paymentDate: e.paymentDate,
        userName: e.userName,
        total: e.total,
        orderId: e.order?.id,
      }))
    }}</pre>
    <!-- Error State -->
    <div v-if="orderStore.error" class="text-danger text-center py-4">
      {{ orderStore.error }}
    </div>

    <!-- Data States -->
    <template v-else>
      <!-- Summary Table -->

      <table class="w-full border-collapse border border-neutral-200 bg-white">
        <thead>
          <tr class="bg-neutral-100">
            <th class="p-2 border-r border-neutral-200 text-left">
              Fecha de Pago
            </th>
            <th class="p-2 border-r border-neutral-200 text-left">
              Fecha del Pedido
            </th>
            <th class="p-2 border-r border-neutral-200 text-left">
              Tipo de Pago
            </th>

            <th class="p-2 border-r border-neutral-200 text-left">Cliente</th>
            <th class="p-2 border-r border-neutral-200 text-left">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="o in paymentEntries"
            :key="o.id"
            class="border-b border-neutral-200"
          >
            <td class="p-2 border-r border-neutral-200">
              {{
                o.paymentDate
                  ? new Date(o.paymentDate).toLocaleDateString("es-CO", {
                      day: "numeric",
                      month: "long",
                    })
                  : "No Asignada"
              }}
            </td>
            <td class="p-2 border-r border-neutral-200">
              {{
                o.order.dueDate
                  ? new Date(o.order.dueDate).toLocaleDateString("es-CO", {
                      day: "numeric",
                      month: "long",
                    })
                  : "No Asignada"
              }}
            </td>
            <td class="p-2 border-r border-neutral-200">
              {{ o.paymentType || "-" }}
            </td>
            <td class="p-2 border-r border-neutral-200">{{ o.userName }}</td>
            <td class="p-2 border-r border-neutral-200">
              {{ formatMoney(o.total, "COP") }}
            </td>
          </tr>
        </tbody>
      </table>
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
