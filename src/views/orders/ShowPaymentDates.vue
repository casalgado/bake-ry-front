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
          isPaid: true,
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
        isPaid: true,
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

const reversedOrders = computed(() => {
  return [...orderStore.items].reverse();
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
          <th class="p-2 border-r border-neutral-200 text-left">Fecha de Pago</th>
          <th class="p-2 border-r border-neutral-200 text-left">Nombre de Usuario</th>
          <th class="p-2 border-r border-neutral-200 text-left">Total</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="o in reversedOrders" :key="o.id"   class="border-b border-neutral-200">
          <td class="p-2 border-r border-neutral-200">
          {{   o.paymentDate
              ? new Date(o.paymentDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })
              : 'No pagado' }}
          </td>
          <td class="p-2 border-r border-neutral-200">{{o.userName}}</td>
          <td class="p-2 border-r border-neutral-200">
            {{o.total
              ? formatMoney(o.total, 'COP')
              : 'No disponible'}}
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
