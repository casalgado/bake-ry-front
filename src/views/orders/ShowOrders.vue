<script setup>
import { ref, onMounted, nextTick, onUnmounted, watch } from 'vue';

import OrderForm from '@/components/forms/OrderForm.vue';
import DataTable from '@/components/DataTable/index.vue';
import ClientCell from '@/components/DataTable/renderers/ClientCell.vue';
import DateCell from '@/components/DataTable/renderers/DateCell.vue';
import ItemsCell from '@/components/DataTable/renderers/ItemsCell.vue';
import MoneyCell from '@/components/DataTable/renderers/MoneyCell.vue';
import IsPaidCell from '@/components/DataTable/renderers/IsPaidCell.vue';

import { PhPen, PhExport } from '@phosphor-icons/vue';
import { useOrderStore } from '@/stores/orderStore';

import PeriodSelector from '@/components/common/PeriodSelector.vue';
import { usePeriodStore } from '@/stores/periodStore';

const periodStore = usePeriodStore();
const orderStore = useOrderStore();
const unsubscribeRef = ref(null);

const showForm = ref(false);
const selectedOrder = ref(null);
const actionLoading = ref({});
const toggleLoading = ref({});

// Column definitions / "id must be the same as field for sorting to work"
const columns = [
  {
    id: 'userName',
    label: 'Client',
    field: 'userName',
    sortable: true,
    component: ClientCell,
    getProps: (row) => ({
      name: row.userName,
    }),
  },
  {
    id: 'dueDate',
    label: 'Due Date',
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
      maxDisplay: 2,
    }),
  },

  {
    id: 'paymentMethod',
    label: 'Pago',
    field: 'paymentMethod',
    sortable: true,
    type: 'toggle',
    options: ['cash', 'card', 'transfer'],
  },
  {
    id: 'fulfillmentType',
    label: 'Entrega',
    field: 'fulfillmentType',
    sortable: true,
    type: 'toggle',
    options: ['pickup', 'delivery'],
  },
  {
    id: 'isPaid',
    label: 'Pagado',
    field: 'isPaid',
    sortable: true,
    type: 'toggle',
    options: [true, false],
    component: IsPaidCell,
    getProps: (row) => ({
      isPaid: row.isPaid,
    }),
  },
  {
    id: 'total',
    label: 'Total',
    field: 'total',
    sortable: true,
    component: MoneyCell,
    getProps: (row) => ({
      value: row.total,
    }),
  },
];

// Table actions
const tableActions = [
  {
    id: 'edit',
    label: 'Edit',
    icon: PhPen,
    minSelected: 1,
    maxSelected: 1,
    variant: 'secondary',
  },
  {
    id: 'export',
    label: 'Export',
    icon: PhExport,
    minSelected: 1,
    variant: 'primary',
  },
];

// Handlers
const handleSelectionChange = (selectedIds) => {
  if (selectedIds.length === 1) {
    selectedOrder.value = orderStore.items.find(order => order.id === selectedIds[0]);
  } else {
    selectedOrder.value = null;
  }
};

const handleToggleUpdate = async ({ rowIds, field, value }) => {
  try {
    const promises = rowIds.map(id => {
      toggleLoading.value[`${id}-${field}`] = true;
      return orderStore.patch(id, { [field]: value });
    });
    await Promise.all(promises);
    await nextTick();
  } catch (error) {
    console.error('Failed to update orders:', error);
  } finally {
    rowIds.forEach(id => {
      toggleLoading.value[`${id}-${field}`] = false;
    });
  }
};

const handleAction = async ({ actionId, selectedIds }) => {
  actionLoading.value[actionId] = true;

  try {
    switch (actionId) {
    case 'edit':
      selectedOrder.value = orderStore.items.find(order => order.id === selectedIds[0]);
      showForm.value = true;
      break;

    case 'export':
      console.log('Exporting orders:', selectedIds);
      break;
    }
  } catch (error) {
    console.error('Action failed:', error);
  } finally {
    actionLoading.value[actionId] = false;
  }
};

const handleSubmit = async (formData) => {
  try {
    if (selectedOrder.value) {
      await orderStore.update(selectedOrder.value.id, formData);
    }
    showForm.value = false;
    selectedOrder.value = null;
  } catch (error) {
    console.error('Failed to update order:', error);
  }
};

const handleCancel = () => {
  showForm.value = false;
  selectedOrder.value = null;
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
    await orderStore.fetchAll({ filters: {
      dateRange: {
        dateField: 'dueDate',
        startDate: periodStore.periodRange.start.toISOString(),
        endDate: periodStore.periodRange.end.toISOString(),
      },
    } });
    unsubscribeRef.value = await orderStore.subscribeToChanges();

    console.log('🔄 Real-time updates enabled for orders');
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
  <div class="container p-4">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-2xl font-bold text-neutral-800">Pedidos</h2>
      <PeriodSelector />
    </div>

    <!-- Error State -->
    <div v-if="orderStore.error" class="text-danger text-center py-4">
      {{ orderStore.error }}
    </div>

    <!-- Edit Form Modal -->
    <div
      v-if="showForm"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
    >
      <div class="bg-white rounded-lg p-6 max-w-2xl w-full">
        <h3 class="text-xl font-bold mb-4">Edit Order</h3>
        <OrderForm
          :key="selectedOrder.id"
          :initial-data="selectedOrder"
          :loading="orderStore.loading"
          @submit="handleSubmit"
          @cancel="handleCancel"
        />
      </div>
    </div>

    <!-- Table -->
    <div>
      <DataTable
        :data="orderStore.items"
        :columns="columns"
        :actions="tableActions"
        :action-loading="actionLoading"
        :toggle-loading="toggleLoading"
        :data-loading="orderStore.loading"
        @selection-change="handleSelectionChange"
        @toggle-update="handleToggleUpdate"
        @action="handleAction"
        class="bg-white shadow-lg rounded-lg"
      />
    </div>
  </div>
</template>
