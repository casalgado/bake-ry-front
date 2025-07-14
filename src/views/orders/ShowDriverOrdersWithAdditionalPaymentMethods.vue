<script setup>
// Vue Core
import { ref, computed, watch } from 'vue';
import { Dialog, DialogPanel } from '@headlessui/vue';

// DataTable Core
import DataTable from '@/components/DataTable/index.vue';
import { useDataTable } from '@/components/DataTable/composables/useDataTable.js';

// DataTable Renderers
import ClientCell from '@/components/DataTable/renderers/ClientCell.vue';
import ItemsCell from '@/components/DataTable/renderers/ItemsCell.vue';
import CheckboxCell from '@/components/DataTable/renderers/CheckboxCell.vue';
import MoneyCell from '@/components/DataTable/renderers/MoneyCell.vue';
import NumberOfBagsCell from '@/components/DataTable/renderers/NumberOfBagsCell.vue';

// Stores
import { usePeriodStore } from '@/stores/periodStore';
import { useOrderStore } from '@/stores/orderStore';
import { useAuthenticationStore } from '@/stores/authentication';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';

// Components
import PeriodSelector from '@/components/common/PeriodSelector.vue';

// Icons
import {
  PhMoney,
  PhCreditCard,
  PhDeviceMobile,
  PhGift,
  PhMoped,
  PhBuilding,
  PhListNumbers,
} from '@phosphor-icons/vue';
import BancolombiaIcon from '@/assets/icons/bancolombia.svg';
import DaviviendaIcon from '@/assets/icons/outline_davivenda.svg';

const periodStore = usePeriodStore();
const orderStore = useOrderStore();
const authStore = useAuthenticationStore();
const settingsStore = useBakerySettingsStore();
const isSequenceDialogOpen = ref(false);
const selectedSequence = ref(1);

const userId = computed(() => authStore.getUserData?.uid);

// Data processing function to filter orders by driver
const processData = (orders) => {
  return orders.filter((order) => order.deliveryDriverId === userId.value);
};

// Initialize useDataTable with custom handlers
const {
  toggleLoading,
  actionLoading,
  selectedItems,
  isLoading,
  tableData,
  handleSelectionChange,
  handleToggleUpdate,
  handleAction,
  clearSelection,
} = useDataTable(orderStore, {
  processData,
  subscribeToChanges: true,
  async onBeforeFetch() {
    await settingsStore.fetchById('default');
  },
  async onAction({ actionId }) {
    switch (actionId) {
    case 'set_sequence':
      selectedSequence.value = 1;
      isSequenceDialogOpen.value = true;
      console.log('set_sequence');
      break;
    }
  },
  fetchAll: {
    filters: {
      dateRange: {
        dateField: 'dueDate',
        startDate: periodStore.periodRange.start.toISOString(),
        endDate: periodStore.periodRange.end.toISOString(),
      },
    },
  },
});

// get Bakery Features from settings
const features = computed(() => {
  if (!settingsStore.items.length) return {};
  return settingsStore.items[0].features;
});

// Helper function to check if a payment method should be skipped
const shouldSkipPaymentMethod = (paymentMethod) => {
  const additionalMethods = ['bancolombia', 'davivienda'];

  // If it's not an additional method, use existing skipWhenToggled logic
  if (!additionalMethods.includes(paymentMethod)) {
    return false;
  }

  // If features aren't loaded yet, skip additional methods by default
  if (!features.value?.order?.additionalPaymentMethods) {
    return true;
  }

  // Skip if the payment method is not in the bakery's additional payment methods
  return !features.value.order.additionalPaymentMethods.includes(paymentMethod);
};

const closeSequenceDialog = () => {
  isSequenceDialogOpen.value = false;
  selectedSequence.value = 0;
};

// Add with other submit handlers
const handleSequenceSubmit = async () => {
  try {
    actionLoading.value['set_sequence'] = true;
    const updates = selectedItems.value.map((item) => ({
      id: item.id,
      data: { deliverySequence: selectedSequence.value },
    }));
    await orderStore.patchAll(updates);
    isSequenceDialogOpen.value = false;
    clearSelection();
  } catch (error) {
    console.error('Failed to update sequence:', error);
  } finally {
    actionLoading.value['set_sequence'] = false;
  }
};

const tableActions = [
  {
    id: 'set_sequence',
    label: 'Secuencia',
    icon: PhListNumbers,
    minSelected: 1,
    variant: 'primary',
  },
];

// Column definitions (now computed to handle dynamic payment methods)
const columns = computed(() => [
  {
    id: 'deliverySequence',
    label: 'ORD',
    field: 'deliverySequence',
    sortable: true,
    type: 'action',
    onClick: (row) => {
      selectedSequence.value = row.deliverySequence || 0;
      isSequenceDialogOpen.value = true;
    },
  },
  {
    id: 'userName',
    label: 'Cliente',
    field: 'userName',
    sortable: true,
    component: ClientCell,
    getProps: (row) => ({
      name: row.userName,
      phone: row.userPhone,
      comment: row.deliveryNotes,
      showIsPaid: row.isPaid,
      dueTime: row.dueTime,
    }),
  },
  {
    id: 'deliveryAddress',
    label: 'Dirección',
    field: 'deliveryAddress',
    sortable: true,
  },
  {
    id: 'deliveryCost',
    label: 'Domi',
    field: 'deliveryCost',
    sortable: true,
    component: MoneyCell,
    getProps: (row) => ({
      value: row.deliveryCost,
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
    id: 'numberOfBags',
    label: 'Bolsas',
    field: 'numberOfBags',
    sortable: true,
    component: NumberOfBagsCell,
    getProps: (row) => ({
      numberOfBags: row.numberOfBags,
      show: true,
    }),
  },
  {
    id: 'total',
    label: '$Tot',
    field: 'total',
    sortable: true,
    component: MoneyCell,
    getProps: (row) => ({
      value: row.total,
    }),
  },
  {
    id: 'paymentMethod',
    label: 'Pago',
    field: 'paymentMethod',
    sortable: true,
    type: 'toggle',
    options: [
      { value: 'cash', displayText: 'E', icon: PhMoney },
      { value: 'transfer', displayText: 'T', icon: PhDeviceMobile },
      {
        value: 'card',
        displayText: 'B',
        icon: PhCreditCard,
        skipWhenToggled: true,
      },
      {
        value: 'bancolombia',
        displayText: 'B',
        icon: BancolombiaIcon,
        skipWhenToggled: shouldSkipPaymentMethod('bancolombia'),
      },
      {
        value: 'davivienda',
        displayText: 'D',
        icon: DaviviendaIcon,
        skipWhenToggled: shouldSkipPaymentMethod('davivienda'),
      },
      {
        value: 'complimentary',
        displayText: 'R',
        icon: PhGift,
        skipWhenToggled: true,
      },
    ],
  },
  {
    id: 'driverMarkedAsPaid',
    label: 'Pagado',
    field: 'driverMarkedAsPaid',
    sortable: true,
    type: 'toggle',
    options: [
      { value: true, displayText: '✓' },
      { value: false, displayText: '-' },
    ],
    component: CheckboxCell,
    getProps: (row) => ({
      isChecked: row.driverMarkedAsPaid,
    }),
  },
  {
    id: 'status',
    label: 'Estado',
    field: 'status',
    sortable: true,
    type: 'toggle',
    options: [
      { value: 0, displayText: '0', skipWhenToggled: true },
      { value: 2, displayText: '', icon: PhMoped },
      { value: 3, displayText: '', icon: PhBuilding },
    ],
  },
]);

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
</script>
