<script setup>
import { ref, onMounted, nextTick, onUnmounted, watch } from 'vue';
import OrderForm from '@/components/forms/OrderForm.vue';
import DataTable from '@/components/DataTable/index.vue';
import { MoneyRenderer, DateRenderer, ItemsRenderer, ClientRenderer } from '@/components/DataTable/renderers/CellRenderers';
import { PhPen, PhExport } from '@phosphor-icons/vue';
import { useOrderStore } from '@/stores/orderStore';
import PeriodSelector from '@/components/common/PeriodSelector.vue';
import { usePeriodStore } from '@/stores/periodStore';
import { useDebouncedRef } from '@vueuse/core'; // Add this import

const periodStore = usePeriodStore();
const orderStore = useOrderStore();
const unsubscribeRef = ref(null);

const showForm = ref(false);
const selectedOrder = ref(null);
const actionLoading = ref({});

// Column definitions
const columns = [
  {
    id: 'client',
    label: 'Client',
    field: 'userName',
    sortable: true,
    customRender: (row) => ({
      component: ClientRenderer,
      props: {
        name: row.userName,
        phone: row.userPhone,
      },
    }),
  },
  {
    id: 'dueDate',
    label: 'Due Date',
    field: 'dueDate',
    sortable: true,
    customRender: (row) => ({
      component: DateRenderer,
      props: {
        value: row.dueDate,
        showTime: true,
      },
    }),
  },
  {
    id: 'items',
    label: 'Items',
    field: 'items',
    sortable: false,
    customRender: (row) => ({
      component: ItemsRenderer,
      props: {
        items: row.orderItems,
        maxDisplay: 2,
      },
    }),
  },
  {
    id: 'paymentMethod',
    label: 'Payment',
    field: 'paymentMethod',
    sortable: true,
    type: 'toggle',
    options: ['cash', 'card', 'transfer'],
  },
  {
    id: 'fulfillmentType',
    label: 'Fulfillment',
    field: 'fulfillmentType',
    sortable: true,
    type: 'toggle',
    options: ['pickup', 'delivery'],
  },
  {
    id: 'total',
    label: 'Total',
    field: 'total',
    sortable: true,
    customRender: (row) => ({
      component: MoneyRenderer,
      props: {
        value: row.total,
      },
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

// Search filters and state
const searchQuery = useDebouncedRef('', 300);
const dateFilter = ref('');
const filterState = ref({
  filtered: [],
  isFiltering: false,
  error: null,
});

// Pure filtering function
const filterOrders = (orders, query, date) => {
  let filtered = orders;

  if (query) {
    const lowercaseQuery = query.toLowerCase();
    filtered = filtered.filter(order =>
      order.userName?.toLowerCase().includes(lowercaseQuery) ||
      order.items.some(item => item.productName.toLowerCase().includes(lowercaseQuery)),
    );
  }

  if (date) {
    filtered = filtered.filter(order =>
      order.dueDate.startsWith(date),
    );
  }

  return filtered;
};

// Main filtering function
const applyFilters = async () => {
  if (filterState.value.isFiltering) return;

  filterState.value.isFiltering = true;
  filterState.value.error = null;

  try {
    // Wait for any pending store operations
    if (orderStore.loading) {
      await new Promise(resolve => {
        const unwatch = watch(() => orderStore.loading, (isLoading) => {
          if (!isLoading) {
            unwatch();
            resolve();
          }
        });
      });
    }

    filterState.value.filtered = filterOrders(
      orderStore.items,
      searchQuery.value,
      dateFilter.value,
    );
  } catch (error) {
    console.error('Filtering failed:', error);
    filterState.value.error = 'Failed to filter orders';
  } finally {
    filterState.value.isFiltering = false;
  }
};

// Handlers
const handleSelectionChange = (selectedIds) => {
  if (selectedIds.length === 1) {
    selectedOrder.value = orderStore.items.find(order => order.id === selectedIds[0]);
  } else {
    selectedOrder.value = null;
  }
};

const toggleLoading = ref({});

const handleToggleUpdate = async ({ rowIds, field, value }) => {
  try {
    let promises = [];
    rowIds.forEach(id => {
      toggleLoading.value[`${id}-${field}`] = true;
      console.log('patching', id, field, value);
      promises.push(orderStore.patch(id, { [field]: value }));
    });
    await Promise.all(promises);
    await nextTick();
    await applyFilters();
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
      await applyFilters(); // Apply filters after update
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

// Watch for filter changes
watch([searchQuery, dateFilter], async () => {
  await applyFilters();
});

watch(
  () => periodStore.periodRange,
  async (newRange) => {
    const dateRange = {
      startDate: newRange.start.toISOString(),
      endDate: newRange.end.toISOString(),
    };

    try {
      await orderStore.fetchAll({ dateRange });
      await applyFilters(); // Apply filters after fetch
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  },
  { deep: true },
);

onMounted(async () => {
  try {
    await orderStore.fetchAll();
    await applyFilters(); // Initial filter application
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
      <h2 class="text-2xl font-bold">Pedidos</h2>
      <PeriodSelector />
    </div>

    <!-- Filters Section -->
    <div class="bg-white p-4 rounded-lg shadow-sm mb-4 hidden">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Search -->
        <div>
          <label class="block text-sm font-medium text-neutral-700 mb-1">
            Search
          </label>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search orders..."
            class="w-full px-3 py-2 border rounded-lg focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="orderStore.loading" class="text-neutral-600 text-center py-4">
      Loading orders...
    </div>

    <!-- Error State -->
    <div v-if="filterState.error || orderStore.error" class="text-danger text-center py-4">
      {{ filterState.error || orderStore.error }}
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
    <div v-if="!orderStore.loading">
      <DataTable
        :key="'orders-table-' + orderStore.items.length"
        :data="filterState.filtered"
        :columns="columns"
        :actions="tableActions"
        :action-loading="actionLoading"
        :toggle-loading="toggleLoading"
        :loading="filterState.isFiltering"
        @selection-change="handleSelectionChange"
        @toggle-update="handleToggleUpdate"
        @action="handleAction"
        class="bg-white shadow-lg rounded-lg"
      />
    </div>
  </div>
</template>
