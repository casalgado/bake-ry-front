<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { PhPrinter, PhX } from '@phosphor-icons/vue';
import { useOrderStore } from '@/stores/orderStore';
import { useAuthenticationStore } from '@/stores/authentication';
import { deliveryRoundLabels } from '@/utils/deliveryRounds';
import { formatMoney, itemLabel } from '@/utils/helpers';
import { formatDateDisplay } from '@/utils/dateUtils';

const route = useRoute();
const router = useRouter();
const orderStore = useOrderStore();
const authStore = useAuthenticationStore();

const orders = ref([]);
const loading = ref(true);
const error = ref(null);

const originalTitle = document.title;

const labels = deliveryRoundLabels(authStore.getBakeryId) || [];

// A round with no label (unset, or beyond this bakery's list) prints under "Sin ruta"
// rather than disappearing from the sheet.
const roundOf = (order) => (labels[order.deliveryRound - 1] ? order.deliveryRound : 0);

const toCollect = (order) => (order.isPaid ? 0 : Math.max(0, order.total - (order.partialPaymentAmount || 0)));

const notes = (order) => [order.internalNotes, order.deliveryNotes].filter(Boolean).join('. ');

const sheetDate = computed(() => formatDateDisplay(orders.value[0]?.dueDate));

const groups = computed(() =>
  [...labels.map((label, i) => ({ label, round: i + 1 })), { label: 'Sin ruta', round: 0 }]
    .map((group) => {
      const groupOrders = orders.value.filter((order) => roundOf(order) === group.round);
      return {
        ...group,
        orders: groupOrders,
        bags: groupOrders.reduce((sum, order) => sum + (Number(order.numberOfBags) || 0), 0),
        collect: groupOrders.reduce((sum, order) => sum + toCollect(order), 0),
      };
    })
    .filter((group) => group.orders.length),
);

const documentTitle = computed(() => {
  const date = new Date(orders.value[0]?.dueDate || new Date());
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `Ruta_${dd}_${mm}_${date.getFullYear()}`;
});

onMounted(async () => {
  const ids = route.query.orderIds?.split(',') || [];
  if (!ids.length) {
    error.value = 'No se especificaron pedidos para imprimir';
    loading.value = false;
    return;
  }

  // ponytail: one request per order, same as ExportOrders; one dateRange fetchAll if sheets get slow.
  const fetched = await Promise.all(ids.map(async (id) => {
    try {
      return await orderStore.fetchById(id);
    } catch (err) {
      console.error(`Error fetching order ${id}:`, err);
      return null;
    }
  }));

  orders.value = fetched.filter(Boolean);
  if (!orders.value.length) {
    error.value = 'No se encontraron los pedidos';
  } else {
    document.title = documentTitle.value;
  }
  loading.value = false;
});

onUnmounted(() => {
  document.title = originalTitle;
});

const handlePrint = () => {
  document.title = documentTitle.value;
  window.print();
};

const handleClose = () => {
  window.close();
  if (!window.closed) router.back();
};
</script>

<template>
  <div
    class="min-h-screen pb-6"
    data-ui-theme="light"
    style="background: var(--ui-surface-0); color: var(--ui-ink)"
  >
    <div class="print-controls flex justify-between items-center px-8 py-2">
      <h1 class="text-lg font-semibold">Hoja de Ruta</h1>
      <div class="flex gap-2">
        <button
          class="ui-btn ui-btn-solid flex items-center gap-2"
          :disabled="loading || !!error"
          @click="handlePrint"
        >
          <PhPrinter class="h-4 w-4" />
          Imprimir
        </button>
        <button class="ui-btn ui-btn-danger flex items-center gap-1" @click="handleClose">
          <PhX class="h-4 w-4" />
          Cerrar
        </button>
      </div>
    </div>

    <p v-if="loading" class="text-center py-12">Cargando pedidos...</p>
    <p v-else-if="error" class="text-center py-12">{{ error }}</p>

    <div v-else class="sheet mx-auto my-6 p-8">
      <section v-for="group in groups" :key="group.round" class="group">
        <h2 class="group-title">
          RUTA {{ group.label }} — {{ sheetDate }} · {{ group.orders.length }} pedidos
        </h2>

        <table>
          <thead>
            <tr>
              <th class="num">#</th>
              <th>Cliente</th>
              <th>Dirección</th>
              <th>Items</th>
              <th class="num">Bol</th>
              <th class="num">Cobrar</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(order, index) in group.orders" :key="order.id">
              <td class="num">{{ index + 1 }}</td>
              <td>
                <div class="strong">{{ order.userName }}</div>
                <div>{{ order.userPhone }}</div>
              </td>
              <td>
                <div>{{ order.fulfillmentType === 'delivery' ? order.deliveryAddress : 'Recoge' }}</div>
                <div v-if="notes(order)" class="note">{{ notes(order) }}</div>
              </td>
              <td>
                <div v-for="item in order.orderItems" :key="item.id">
                  {{ item.quantity }} {{ itemLabel(item) }}
                </div>
              </td>
              <td class="num">{{ order.numberOfBags }}</td>
              <td class="num strong">
                {{ order.isPaid ? 'pagado' : formatMoney(toCollect(order)) }}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4" class="strong">Total</td>
              <td class="num strong">{{ group.bags }}</td>
              <td class="num strong">{{ formatMoney(group.collect) }}</td>
            </tr>
          </tfoot>
        </table>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* The sheet is paper: black ink on white in both themes, never ui-* surfaces. */
.sheet {
  max-width: 210mm;
  background: #fff;
  color: #000;
  font-size: 10pt;
}

.group + .group {
  margin-top: 2rem;
}

.group-title {
  color: #000;
  font-size: 12pt;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  border-bottom: 1px solid #999;
  padding: 4px 6px;
  text-align: left;
  vertical-align: top;
}

th {
  border-bottom: 2px solid #000;
  font-weight: 700;
}

tfoot td {
  border-top: 2px solid #000;
  border-bottom: 0;
}

.num {
  text-align: right;
  white-space: nowrap;
}

.strong {
  font-weight: 700;
}

.note {
  font-style: italic;
}

@page {
  size: A4;
  margin: 10mm;
}

@media print {
  .print-controls {
    display: none !important;
  }

  .sheet {
    max-width: none;
    margin: 0;
    padding: 0;
  }

  thead {
    display: table-header-group;
  }

  tr {
    break-inside: avoid;
  }

  .group + .group {
    margin-top: 0;
    break-before: page;
  }
}
</style>
