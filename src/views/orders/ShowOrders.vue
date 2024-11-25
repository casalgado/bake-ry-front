<script setup>
import { ref, onMounted, computed, nextTick } from 'vue';
import { useOrderStore } from '@/stores/orderStore';
import { useRouter } from 'vue-router';
import OrderForm from '@/components/forms/OrderForm.vue';
import DataTable from '@/components/DataTable/index.vue';
import { MoneyRenderer, DateRenderer, ItemsRenderer, ClientRenderer } from '@/components/DataTable/renderers/CellRenderers';
import { PhPen, PhExport } from '@phosphor-icons/vue';

const router = useRouter();
const orderStore = useOrderStore();
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

// Search filters
const searchQuery = ref('');
const dateFilter = ref('');

// Filtered data
const filteredData = computed(() => {
  let filtered = orderStore.items;

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(order =>
      order.userName?.toLowerCase().includes(query) ||
      order.items.some(item => item.productName.toLowerCase().includes(query)),
    );
  }

  if (dateFilter.value) {
    filtered = filtered.filter(order =>
      order.dueDate.startsWith(dateFilter.value),
    );
  }

  return filtered;
});

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
    // Update each selected order
    let promises = [];
    rowIds.forEach(id => {
      console.log('patching', id, field, value);
      promises.push(orderStore.patch(id, { [field]: value }));
    });
    await Promise.all(promises);
    await nextTick();
  } catch (error) {
    console.error('Failed to update orders:', error);
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

onMounted(async () => {
  await orderStore.fetchAll();
});
</script>

<template>
  <div class="container p-4">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-2xl font-bold">Order Management</h2>
      <button
        @click="() => router.push('/dashboard/orders/create')"
        class="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
      >
        New Order
      </button>
    </div>

    <!-- Filters Section -->
    <div class="bg-white p-4 rounded-lg shadow-sm mb-4">
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

        <!-- Date Filter -->
        <div>
          <label class="block text-sm font-medium text-neutral-700 mb-1">
            Due Date
          </label>
          <input
            v-model="dateFilter"
            type="date"
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
    <div v-if="!orderStore.loading">
      <DataTable
        :data="filteredData"
        :columns="columns"
        :actions="tableActions"
        :loading="actionLoading"
        @selection-change="handleSelectionChange"
        @toggle-update="handleToggleUpdate"
        @action="handleAction"
        class="bg-white shadow-lg rounded-lg"
      />
    </div>
  </div>
</template>
