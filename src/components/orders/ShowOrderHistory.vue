<script setup>
import { onMounted, ref, computed } from 'vue';
import { capitalize } from '@/utils/helpers';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';

const settingsStore = useBakerySettingsStore();
const props = defineProps({
  history: {
    type: Array,
    required: true,
  },
});

const staffData = ref([]);

const getDriverName = (driverId) => {
  if (!driverId) return '-';
  // Access the staff list directly from the store
  const driver = staffData.value?.find(member => member.id === driverId);
  return driver ? `${driver.firstName}` : driverId;
};

const formatDate = (dateString, { includeTime = true } = {}) => {
  if (!dateString) return '-';

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const timeString = includeTime ? date.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).toLowerCase() : '';

  let formattedDate;

  if (date.toDateString() === now.toDateString()) {
    formattedDate = 'Hoy';
  } else if (date.toDateString() === yesterday.toDateString()) {
    formattedDate = 'Ayer';
  } else {
    const dateOptions = {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: now.getFullYear() === date.getFullYear() ? undefined : 'numeric',
    };

    formattedDate = date.toLocaleDateString('es-CO', dateOptions);
    formattedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
  }

  return includeTime ? `${formattedDate} a las ${timeString}` : formattedDate;
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
  card: 'bold',
  transfer: 'transferencia',
  complimentary: 'regalo',
};

const orderItemStatus = {
  0: '-',
  1: 'producido',
  2: 'entregado',
};

const status = {
  0: 'Recibida',
  1: 'En Producción',
  2: 'Preparada',
  3: 'En Camino',
  4: 'Completada',
};

const formatChange = (change, field, currentEntry) => {
  switch (field) {
  // Boolean fields
  case 'isPaid': {
    return change.to ? 'Marcado como pagado' : 'Marcado como no pagado';
  }
  case 'isDeliveryPaid': {
    return change.to ? 'Domicilio marcado como pagado' : 'Domicilio marcado como no pagado';
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
    return `${field === 'preparationDate' ? 'Fecha de preparación' : 'Fecha de entrega'}: ${formatDate(change.from, { includeTime: false })} → ${formatDate(change.to, { includeTime: false })}`;
  }

  // Currency fields 1
  case 'deliveryFee':
  case 'deliveryCost':{
    return `${field === 'deliveryFee' ? 'Domicilio cobrado a cliente' : 'Domicilio pagado a proveedor'
    }: ${formatCurrency(change.from)} → ${formatCurrency(change.to)}`;
  }

  // Currency fields 2
  case 'subtotal':
  case 'total': {
    // Check if any of the changes include isComplimentary
    const hasComplimentaryChange = currentEntry && Object.keys(currentEntry.changes).includes('isComplimentary');
    if (hasComplimentaryChange) return null;
    return `${field === 'subtotal' ? 'Subtotal' : 'Total'}: ${formatCurrency(change.from)} → ${formatCurrency(change.to)}`;
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
    return `Repartidor: ${getDriverName(change.from) || '-'} → ${getDriverName(change.to) || '-'}`;
  }
  case 'numberOfBags': {
    return `Número de bolsas: ${change.from} → ${change.to}`;
  }

  case 'orderItems': {
    if (!change.from || !change.to) return null;

    const changes = {
      removed: [],
      added: [],
      modified: [],
    };

    // Find removed items
    changes.removed = change.from
      .filter(fromItem => !change.to.find(toItem => toItem.id === fromItem.id))
      .map(item => capitalize(item.productName));

    // Find added items
    changes.added = change.to
      .filter(toItem => !change.from.find(fromItem => fromItem.id === toItem.id))
      .map(item => capitalize(item.productName));

    // Find modified items
    const modifiedItems = change.to.filter(toItem => {
      const fromItem = change.from.find(item => item.id === toItem.id);
      return fromItem && JSON.stringify(fromItem) !== JSON.stringify(toItem);
    });

    changes.modified = modifiedItems
      .map(toItem => {
        const fromItem = change.from.find(item => item.id === toItem.id);
        const itemChanges = [];

        if (fromItem.quantity !== toItem.quantity) {
          itemChanges.push(`${capitalize(toItem.productName)}: Cantidad ${fromItem.quantity} → ${toItem.quantity}`);
        }

        if (fromItem.currentPrice !== toItem.currentPrice) {
          itemChanges.push(`${capitalize(toItem.productName)}: Precio ${formatCurrency(fromItem.currentPrice)} → ${formatCurrency(toItem.currentPrice)}`);
        }

        if (JSON.stringify(fromItem.variation) !== JSON.stringify(toItem.variation)) {
          const fromVar = fromItem.variation?.name || 'ninguna';
          const toVar = toItem.variation?.name || 'ninguna';
          itemChanges.push(`${capitalize(toItem.productName)}: Variación ${fromVar} → ${toVar}`);
        }

        if (fromItem.status !== toItem.status) {
          itemChanges.push(`${capitalize(toItem.productName)}: Estado ${orderItemStatus[fromItem.status]} → ${orderItemStatus[toItem.status]}`);
        }

        return itemChanges;
      })
      .flat()
      .filter(Boolean);

    if (changes.removed.length || changes.added.length || changes.modified.length) {
      return {
        type: 'orderItems',
        changes,
      };
    }
    return null;
  }

  default:
    return null;
  }
};

onMounted(async () => {
  await settingsStore.fetchById('default');
  staffData.value = await settingsStore.staff;
});

const filteredHistory = computed(() =>
  props.history.filter(entry =>
    !Object.values(entry.changes).every(change =>
      Object.keys(change).length === 0 || (Array.isArray(change) && change.length === 0),
    ),
  ),
);
</script>

<template>
  <div class="space-y-4">
    <template v-if="filteredHistory.length > 0">
      <div v-for="entry in filteredHistory" :key="entry.id" class="p-3 border-b border-neutral-200 last:border-0">
        <div class="flex justify-between items-start mb-2">
          <span class="text-sm text-neutral-600">{{ formatDate(entry.timestamp) }}</span>
          <span class="text-xs text-neutral-500">{{ entry.editor.email }}</span>
        </div>

        <div class="space-y-2">
          <template v-for="(change, field) in entry.changes" :key="field">
            <!-- Special handling for orderItems -->
            <div v-if="field === 'orderItems' && formatChange(change, field, entry) " class="text-sm">

              <div class="text-sm text-neutral-700">Productos:</div>
              <div class="space-y-1 ml-4">
                <!-- Removed items -->
                <div v-if="formatChange(change, field, entry).changes.removed.length" class="space-y-1">
                  <div class="text-sm text-neutral-700">Eliminados:</div>
                  <div v-for="item in formatChange(change, field, entry).changes.removed"
                       :key="item"
                       class="ml-2 text-neutral-700">
                    • {{ item }}
                  </div>
                </div>

                <!-- Added items -->
                <div v-if="formatChange(change, field, entry).changes.added.length" class="space-y-1">
                  <div class="text-sm text-neutral-700">Agregados:</div>
                  <div v-for="item in formatChange(change, field, entry).changes.added"
                       :key="item"
                       class="ml-2 text-neutral-700">
                    • {{ item }}
                  </div>
                </div>

                <!-- Modified items -->
                <div v-if="formatChange(change, field, entry).changes.modified.length" class="space-y-1">
                  <div class="text-sm text-neutral-700">Modificaciones:</div>
                  <div v-for="item in formatChange(change, field, entry).changes.modified"
                       :key="item"
                       class="ml-2 text-neutral-700">
                    • {{ item }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Other changes -->
            <div v-else-if="formatChange(change, field, entry)" class="text-sm text-neutral-700">

              {{ formatChange(change, field, entry) }}
            </div>
          </template>
        </div>
      </div>
    </template>

    <div v-else class="text-sm text-neutral-500">
      No hay historial de cambios para este pedido.
    </div>
  </div>
</template>

<style scoped lang="scss">
.space-y-4 > :not([hidden]) ~ :not([hidden]) {
  margin-top: 1rem;
}

.space-y-2 > :not([hidden]) ~ :not([hidden]) {
  margin-top: 0.5rem;
}

.space-y-1 > :not([hidden]) ~ :not([hidden]) {
  margin-top: 0.25rem;
}
</style>
