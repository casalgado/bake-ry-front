<script setup>
import { ref, onMounted, computed } from 'vue';
import { useOrderStore } from '@/stores/orderStore';
import { useRouter } from 'vue-router';
import OrderForm from '@/components/forms/OrderForm.vue';

const router = useRouter();
const orderStore = useOrderStore();

const showForm = ref(false);
const selectedOrder = ref(null);
const searchQuery = ref('');
const dateFilter = ref('');

onMounted(async () => {
  await orderStore.fetchAll();
});

const filteredOrders = computed(() => {
  return orderStore.items.filter((order) => {
    const matchesSearch =
      order.userName?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      order.items.some(item =>
        item.productName.toLowerCase().includes(searchQuery.value.toLowerCase()),
      );

    const matchesDate = !dateFilter.value || order.dueDate === dateFilter.value;

    return matchesSearch && matchesDate;
  });
});

const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const handleEdit = (order) => {
  selectedOrder.value = order;
  showForm.value = true;
};

const handleDelete = async (orderId) => {
  if (confirm('Are you sure you want to delete this order?')) {
    try {
      await orderStore.remove(orderId);
    } catch (error) {
      console.error('Failed to delete order:', error);
    }
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

const navigateToCreate = () => {
  router.push('/dashboard/orders/create');
};

const getItemsSummary = (items) => {
  return items.map(item =>
    `${item.productName} (${item.quantity}${item.isComplimentary ? ' - Complimentary' : ''})`,
  ).join(', ');
};
</script>

<template>
  <div>
    <h2>Order Management</h2>

    <!-- Search and Filter Controls -->
    <div>
      <input
        type="text"
        v-model="searchQuery"
        placeholder="Search orders..."
      />

      <input
        type="date"
        v-model="dateFilter"
        placeholder="Filter by due date"
      />

      <button @click="navigateToCreate">New Order</button>
    </div>

    <!-- Loading State -->
    <div v-if="orderStore.loading">Loading orders...</div>

    <!-- Error State -->
    <div v-if="orderStore.error">
      {{ orderStore.error }}
    </div>

    <!-- Edit Form Modal -->
    <div v-if="showForm">
      <div>
        <h3>Edit Order</h3>
        <OrderForm
          :key="selectedOrder.id"
          :initial-data="selectedOrder"
          :loading="orderStore.loading"
          @submit="handleSubmit"
          @cancel="handleCancel"
        />
      </div>
    </div>

    <!-- Orders Table -->
    <div v-if="!orderStore.loading && filteredOrders.length > 0">
      <table>
        <thead>
          <tr>
            <th>Client</th>
            <th>Due Date</th>
            <th>Items</th>
            <th>Total</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in filteredOrders" :key="order.id">
            <td>
              <div>{{ order.userName }}</div>
              <div>{{ order.userPhone }}</div>
            </td>
            <td>{{ order.dueDate }}</td>
            <td>{{ getItemsSummary(order.items) }}</td>
            <td>{{ formatCurrency(order.total) }}</td>
            <td>
              <button @click="handleEdit(order)">Edit</button>
              <button @click="handleDelete(order.id)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- No Results State -->
    <div v-else-if="!orderStore.loading && filteredOrders.length === 0">
      No orders found.
    </div>
  </div>
</template>
