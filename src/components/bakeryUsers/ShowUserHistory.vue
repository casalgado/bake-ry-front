<script setup>
import { computed } from 'vue';

const props = defineProps({
  orders: {
    type: Array,
    required: true,
  },
});

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatCurrency = (value) => {
  return value?.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

const sortedOrders = computed(() => {
  return [...props.orders].sort((a, b) =>
    new Date(b.createdAt) - new Date(a.createdAt),
  );
});

const totals = computed(() => {
  return props.orders.reduce((acc, order) => {
    acc.total += order.total || 0;
    acc.count += 1;
    return acc;
  }, { total: 0, count: 0 });
});
</script>

<template>
  <div class="space-y-4">
    <div v-if="sortedOrders.length > 0">
      <div class="mb-4 p-3 bg-neutral-50 rounded-lg flex justify-between text-sm">
        <span>Total de pedidos: <strong>{{ totals.count }}</strong></span>
        <span>Total acumulado: <strong>{{ formatCurrency(totals.total) }}</strong></span>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-neutral-200">
              <th class="text-left py-2 px-2 font-medium text-neutral-600">Fecha</th>
              <th class="text-left py-2 px-2 font-medium text-neutral-600">Productos</th>
              <th class="text-right py-2 px-2 font-medium text-neutral-600">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="order in sortedOrders"
              :key="order.id"
              class="border-b border-neutral-100 hover:bg-neutral-50"
            >
              <td class="py-2 px-2 whitespace-nowrap">
                {{ formatDate(order.dueDate) }}
              </td>
              <td class="py-2 px-2">
                <div class="max-w-xs">
                  <span
                    v-for="(item, index) in order.orderItems"
                    :key="item.id"
                  >
                    {{ item.quantity }}x {{ item.productName }}{{ index < order.orderItems.length - 1 ? ', ' : '' }}
                  </span>
                </div>
              </td>
              <td class="py-2 px-2 text-right whitespace-nowrap">
                {{ formatCurrency(order.total) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-else class="text-sm text-neutral-500 text-center py-8">
      Este usuario no tiene pedidos registrados.
    </div>
  </div>
</template>

<style scoped>
.space-y-4 > :not([hidden]) ~ :not([hidden]) {
  margin-top: 1rem;
}
</style>
