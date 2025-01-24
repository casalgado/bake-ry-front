<script setup>
import { ref, onMounted, nextTick, onUnmounted, watch, computed } from 'vue';
import DataTable from '@/components/DataTable/index.vue';
import ClientCell from '@/components/DataTable/renderers/ClientCell.vue';
import ItemsCell from '@/components/DataTable/renderers/ItemsCell.vue';
import CheckboxCell from '@/components/DataTable/renderers/CheckboxCell.vue';
import DateCell from '@/components/DataTable/renderers/DateCell.vue';

import { useOrderStore } from '@/stores/orderStore';
import { useAuthenticationStore } from '@/stores/authentication';
import PeriodSelector from '@/components/common/PeriodSelector.vue';
import { usePeriodStore } from '@/stores/periodStore';

const periodStore = usePeriodStore();
const orderStore = useOrderStore();
const authStore = useAuthenticationStore();
const unsubscribeRef = ref(null);
const toggleLoading = ref({});

// Column definitions
const columns = [
  {
    id: 'userName',
    label: 'Cliente',
    field: 'userName',
    sortable: true,
    component: ClientCell,
    getProps: (row) => ({
      name: row.userName,
      comment: row.internalNotes,
    }),
  },
  {
    id: 'dueDate',
    label: 'Fecha Entrega',
    field: 'dueDate',
    sortable: true,
    component: DateCell,
    getProps: (row) => ({
      value: row.dueDate,
      showTime: true,
    }),
  },
  {
    id: 'items',
    label: 'Items',
    field: 'items',
    sortable: false,
    component: ItemsCell,
    getProps: (row) => ({
      items: row.orderItems,
      maxDisplay: 10,
    }),
  },
  {
    id: 'isProduced',
    label: 'Producido',
    field: 'isProduced',
    sortable: true,
    type: 'toggle',
    options: [{ value: true, displayText: '✓' }, { value: false, displayText: '-' }],
    component: CheckboxCell,
    getProps: (row) => ({
      isChecked: row.isProduced,
    }),
  },
];

const handleToggleUpdate = async ({ rowIds, field, value }) => {
  try {
    rowIds.forEach(id => {
      toggleLoading.value[`${id}-${field}`] = true;
    });

    const updates = rowIds.map(id => ({
      id,
      data: { [field]: value },
    }));

    await orderStore.patchAll(updates);
    await nextTick();
  } catch (error) {
    console.error('Failed to update orders:', error);
  } finally {
    rowIds.forEach(id => {
      toggleLoading.value[`${id}-${field}`] = false;
    });
  }
};

// Watch for period changes and fetch new data
watch(
  () => periodStore.periodRange,
  async (newRange) => {
    try {
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
    console.log('🔄 Real-time updates enabled for production orders');
  } catch (error) {
    console.error('Failed to initialize orders:', error);
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
      <h2 class="text-2xl font-bold text-neutral-800">Producción</h2>
      <PeriodSelector />
    </div>

    <!-- Error State -->
    <div v-if="orderStore.error" class="text-danger text-center py-4">
      {{ orderStore.error }}
    </div>

    <!-- Table -->
    <div>
      <DataTable
        :data="orderStore.items"
        :columns="columns"
        :toggle-loading="toggleLoading"
        :data-loading="orderStore.loading"
        @toggle-update="handleToggleUpdate"
        class="bg-white shadow-lg rounded-lg"
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
