<script setup>
import { computed } from 'vue';

const props = defineProps({
  history: {
    type: Array,
    required: true,
  },
});

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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

const methods = {
  cash: 'efectivo',
  bold: 'bold',
  transfer: 'transferencia',
  complimentary: 'regalo',
};

const status = {
  0: 'Recibida',
  1: 'En Producción',
  2: 'Preparada',
  3: 'En Camino',
  4: 'Completada',
};

const formatOrderItemChange = (from, to) => {
  const changes = [];

  // Check for quantity changes
  if (from.quantity !== to.quantity) {
    changes.push(`Cantidad: ${from.quantity} → ${to.quantity}`);
  }

  // Check for price changes
  if (from.currentPrice !== to.currentPrice) {
    changes.push(`Precio: ${formatCurrency(from.currentPrice)} → ${formatCurrency(to.currentPrice)}`);
  }

  // Check for variation changes
  if (JSON.stringify(from.variation) !== JSON.stringify(to.variation)) {
    const fromVar = from.variation?.name || 'ninguna';
    const toVar = to.variation?.name || 'ninguna';
    changes.push(`Variación: ${fromVar} → ${toVar}`);
  }

  // Check for status changes
  if (from.status !== to.status) {
    changes.push(`Estado: ${status[from.status]} → ${status[to.status]}`);
  }

  return changes.length > 0
    ? `${from.productName}: ${changes.join(', ')}`
    : null;
};

const formatChange = (change, field) => {
  switch (field) {
  // Boolean fields
  case 'isPaid': {
    return change.to ? 'Marcado como pagado' : 'Marcado como no pagado';
  }
  case 'isDeliveryPaid': {
    return change.to ? 'Domicilio marcado como pagado' : 'Domicilio marcado como no pagado';
  }
  case 'isComplimentary': {
    return change.to ? 'Marcado como regalo' : 'Marcado como no regalo';
  }
  case 'isDeleted': {
    return change.to ? 'Pedido eliminado' : 'Pedido restaurado';
  }

  // Enum fields
  case 'fulfillmentType': {
    return `Tipo de entrega: ${change.from === 'delivery' ? 'domicilio' : 'recogen'} → ${change.to === 'delivery' ? 'domicilio' : 'recogen'}`;
  }
  case 'paymentMethod': {
    return `Método de pago: ${methods[change.from]} → ${methods[change.to]}`;
  }
  case 'status': {
    return `Estado: ${status[change.from]} → ${status[change.to]}`;
  }

  // Date fields
  case 'preparationDate':
  case 'dueDate': {
    return `${field === 'preparationDate' ? 'Fecha de preparación' : 'Fecha de entrega'}: ${formatDate(change.from)} → ${formatDate(change.to)}`;
  }

  // Currency fields
  case 'deliveryFee':
  case 'deliveryCost':
  case 'subtotal':
  case 'total': {
    return `${field === 'deliveryFee' ? 'Costo de domicilio' :
      field === 'deliveryCost' ? 'Costo para la panadería' :
        field === 'subtotal' ? 'Subtotal' : 'Total'}: 
        ${formatCurrency(change.from)} → ${formatCurrency(change.to)}`;
  }

  // Text fields
  case 'customerNotes': {
    return `Notas del cliente: "${change.from || '-'}" → "${change.to || '-'}"`;
  }
  case 'internalNotes': {
    return `Notas internas: "${change.from || '-'}" → "${change.to || '-'}"`;
  }
  case 'deliveryAddress': {
    return `Dirección: "${change.from || '-'}" → "${change.to || '-'}"`;
  }
  case 'deliveryInstructions': {
    return `Instrucciones de entrega: "${change.from || '-'}" → "${change.to || '-'}"`;
  }
  case 'deliveryDriverId': {
    return `Repartidor: ${change.from || '-'} → ${change.to || '-'}`;
  }
  case 'numberOfBags': {
    return `Número de bolsas: ${change.from} → ${change.to}`;
  }

  // Complex fields
  case 'orderItems': {
    const itemChanges = [];

    // Find removed items
    const removedItems = change.from.filter(fromItem =>
      !change.to.find(toItem => toItem.id === fromItem.id),
    );

    // Find added items
    const addedItems = change.to.filter(toItem =>
      !change.from.find(fromItem => fromItem.id === toItem.id),
    );

    // Find modified items
    const modifiedItems = change.to.filter(toItem => {
      const fromItem = change.from.find(item => item.id === toItem.id);
      return fromItem && JSON.stringify(fromItem) !== JSON.stringify(toItem);
    });

    // Add changes to array
    if (removedItems.length > 0) {
      itemChanges.push(`Productos eliminados: ${removedItems.map(item => item.productName).join(', ')}`);
    }

    if (addedItems.length > 0) {
      itemChanges.push(`Productos agregados: ${addedItems.map(item => item.productName).join(', ')}`);
    }

    modifiedItems.forEach(toItem => {
      const fromItem = change.from.find(item => item.id === toItem.id);
      const itemChange = formatOrderItemChange(fromItem, toItem);
      if (itemChange) itemChanges.push(itemChange);
    });

    return itemChanges.join('\n');
  }

  default: {
    return null;
  }
  }
};
</script>

<template>
  <div class="space-y-4">
    <template v-if="history.length > 0">
      <div v-for="entry in history" :key="entry.id" class="p-3 border-b border-neutral-200 last:border-0">
        <div class="flex justify-between items-start mb-2">
          <span class="text-sm text-neutral-600">{{ formatDate(entry.timestamp) }}</span>
          <span class="text-xs text-neutral-500">{{ entry.editor.email }}</span>
        </div>

        <div class="space-y-1">
          <template v-for="(change, field) in entry.changes" :key="field">
            <div v-if="formatChange(change, field)" class="text-sm whitespace-pre-line">
              {{ formatChange(change, field) }}
            </div>
          </template>
        </div>
      </div>
    </template>
    <div v-else>
      <p class="text-sm text-neutral-500">No hay historial de cambios para este pedido.</p>
    </div>
  </div>
</template>
