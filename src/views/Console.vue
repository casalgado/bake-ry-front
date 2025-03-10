<script setup>
import { ref, onMounted } from 'vue';
import { useOrderStore } from '@/stores/orderStore';

const orderStore = useOrderStore();

onMounted(async () => {
  console.log('Console');
  await orderStore.fetchAll({
    filters: {
      dateRange: {
        dateField: 'preparationDate',
        startDate: '2025-01-01',
        endDate: '2025-02-01',
      },
    },
  });
  console.log(orderStore.items);
});
const addTaxToCoffee = async () => {
  let report = { coffee: 0, beatriz: 0, margarita: 0, coldBrew: 0, ordersFixed: 0 };
  const ordersToUpdate = [];
  const orderItemsToUpdate = [];

  orderStore.items.forEach((order) => {
    let orderModified = false;

    order.orderItems.forEach((orderItem) => {
      // Track coffee items for the report
      if (orderItem.collectionName === 'cafe el diario') {
        report.coffee += orderItem.quantity;

        if (orderItem.productName === 'beatriz') {
          report.beatriz += orderItem.quantity;
        } else if (orderItem.productName === 'margarita') {
          report.margarita += orderItem.quantity;
        } else if (orderItem.productName === 'cold brew') {
          report.coldBrew += orderItem.quantity;
        }

        // Fix tax for coffee items if not already set
        if (orderItem.taxPercentage === 0) {
          // Just update the taxPercentage property - the model will handle recalculations
          orderItem.taxPercentage = 5;
          orderItemsToUpdate.push(orderItem);
          orderModified = true;
        }
      }
    });

    if (orderModified) {
      // The order model will recalculate everything when we save it
      ordersToUpdate.push(order);
      report.ordersFixed++;
    }
  });

  console.log('Report:', report);
  console.log('Orders to update:', ordersToUpdate.length);
  console.log('Orders to update:', ordersToUpdate.map((order) => {
    return {
      id: order.id,
      orderItems: order.orderItems.map((orderItem) => {
        return {
          id: orderItem.id,
          productName: orderItem.productName,
          taxPercentage: orderItem.taxPercentage,
        };
      }),
    };
  }));
  console.log('Order items to update:', orderItemsToUpdate);

  // Update orders in the database
  if (ordersToUpdate.length > 0) {
    try {
      for (const order of ordersToUpdate) {

        console.log('Order to update:', order);
        //await orderStore.update(order.id, order);
        console.log(`Order ${order.id} updated successfully.`);

      }
      console.log(`All ${ordersToUpdate.length} orders updated successfully.`);
    } catch (error) {
      console.error('Error updating orders:', error);
    }
  }

  return report;
};

</script>

<template>
  <div class="flex flex-col items-start justify-start overflow-hidden w-full">
    <button @click="addTaxToCoffee">add Tax to Coffee Items</button>
    <h1>hello</h1>
    <pre>{{ orderStore.items.length }}</pre>
    <pre>{{ orderStore.items }}</pre>
  </div>
</template>

<style scoped></style>
