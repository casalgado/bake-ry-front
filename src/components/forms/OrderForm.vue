<script>
// POS only: remembers the last recoger/domicilio choice for the session.
// Module scope so it survives form resets and remounts; cleared on page reload.
let lastPosFulfillmentType = null;
</script>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch, useId } from 'vue';
import { useProductStore } from '@/stores/productStore';
import { useBakeryUserStore } from '@/stores/bakeryUserStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { useSystemSettingsStore } from '@/stores/systemSettingsStore';
import UserCombox from '@/components/forms/UserCombox.vue';
import OrderItemsManager from './OrderItemsManager.vue';
import ProductWizard from './ProductWizard.vue';
import PartialPaymentsManager from './PartialPaymentsManager.vue';
import NewClientDialog from './NewClientDialog.vue';
import UiPills from '@/components/ui/UiPills.vue';
import UiMoneyInput from '@/components/ui/UiMoneyInput.vue';
import { formatMoney, cleanString } from '@/utils/helpers';
import { paymentIconMap } from '@/utils/paymentIcons';
import { getTodayString, getNextBusinessDayString, formatDateForInput } from '@/utils/dateUtils';
import { PhX, PhPlus, PhNotePencil } from '@phosphor-icons/vue';
import { Order } from '@/models/Order.js';
import { COMMITTED_WINDOW_DAYS, SHIPPED_STATUS } from '@/services/stockService';

const props = defineProps({
  title: {
    type: String,
    default: 'Crear Pedido',
  },
  initialData: {
    type: Object,
    default: () => null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  isOffline: {
    type: Boolean,
    default: false,
  },
});

const addBasePricesToOrderItems = (orderItems, products, preserveCurrentPrice = false) => {
  return orderItems.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    if (!product) return item;

    // Handle combination-based items (new system)
    if (item.combination) {
      const combinationId = item.combination.id;
      const matchingCombination = product.variations.combinations.find(
        (c) => c.id === combinationId,
      );
      const basePrice = matchingCombination?.basePrice || 0;
      const costPrice = preserveCurrentPrice
        ? (item.costPrice ?? item.combination.costPrice ?? matchingCombination?.costPrice ?? 0)
        : (matchingCombination?.costPrice ?? item.combination.costPrice ?? 0);
      const accountingCode = matchingCombination?.accountingCode || item.combination.accountingCode || '';
      const currentPrice = preserveCurrentPrice ? item.currentPrice : item.currentPrice || basePrice;
      return {
        ...item,
        basePrice: basePrice,
        costPrice: costPrice,
        currentPrice: currentPrice,
        // Discount tracking fields - preserve if exists, or initialize
        referencePrice: item.referencePrice ?? (basePrice > 0 ? basePrice : currentPrice),
        discountType: item.discountType ?? null,
        discountValue: item.discountValue ?? 0,
        // Ensure combination object is a plain object with all necessary properties
        combination: {
          id: item.combination.id,
          selection: [...(item.combination.selection || [])],
          name: item.combination.name,
          basePrice: basePrice,
          costPrice: costPrice,
          currentPrice: currentPrice,
          isWholeGrain: item.combination.isWholeGrain || false,
          isActive: item.combination.isActive !== undefined ? item.combination.isActive : true,
          accountingCode: accountingCode,
          getDisplayName: item.combination.getDisplayName || (() => item.combination.name || item.combination.selection?.join(' + ')),
        },
      };
    }

    // Handle legacy variation-based items
    if (product.variations?.length > 0) {
      if (item.variation?.id) {
        const matchingVariation = product.variations.find(
          (v) => v.id === item.variation.id,
        );
        if (matchingVariation) {
          const basePrice = matchingVariation.basePrice;
          const currentPrice = preserveCurrentPrice ? item.currentPrice : basePrice;
          return {
            ...item,
            basePrice: basePrice,
            costPrice: preserveCurrentPrice ? (item.costPrice ?? matchingVariation.costPrice ?? 0) : (matchingVariation.costPrice ?? 0),
            currentPrice: currentPrice,
            // Discount tracking fields
            referencePrice: item.referencePrice ?? (basePrice > 0 ? basePrice : currentPrice),
            discountType: item.discountType ?? null,
            discountValue: item.discountValue ?? 0,
          };
        }
      }
      const basePrice = product.variations[0].basePrice;
      const currentPrice = preserveCurrentPrice ? item.currentPrice : basePrice;
      return {
        ...item,
        basePrice: basePrice,
        costPrice: preserveCurrentPrice ? (item.costPrice ?? product.variations[0].costPrice ?? 0) : (product.variations[0].costPrice ?? 0),
        currentPrice: currentPrice,
        // Discount tracking fields
        referencePrice: item.referencePrice ?? (basePrice > 0 ? basePrice : currentPrice),
        discountType: item.discountType ?? null,
        discountValue: item.discountValue ?? 0,
      };
    }

    // if item has no variation or combination, use product base price
    const basePrice = product.basePrice;
    const currentPrice = preserveCurrentPrice ? item.currentPrice : basePrice;
    return {
      ...item,
      basePrice: basePrice,
      costPrice: preserveCurrentPrice ? (item.costPrice ?? product.costPrice ?? 0) : (product.costPrice ?? 0),
      currentPrice: currentPrice,
      // Discount tracking fields
      referencePrice: item.referencePrice ?? (basePrice > 0 ? basePrice : currentPrice),
      discountType: item.discountType ?? null,
      discountValue: item.discountValue ?? 0,
    };
  });
};

const emit = defineEmits(['submit', 'cancel']);

const uid = useId();
const productStore = useProductStore();
const bakerySettingsStore = useBakerySettingsStore();
const systemSettingsStore = useSystemSettingsStore();
const userStore = useBakeryUserStore();
const isNewClientDialogOpen = ref(false);
const originalAddress = ref('');
const fetching = ref(false);
const formRef = ref(null);
const userCombox = ref(null);
const catalog = ref(null);
const itemsManager = ref(null);
const userHistory = ref([]);

// POS Configuration
const shouldAutoSelectClient = computed(() => bakerySettingsStore.shouldAutoSelectClient);
const shouldAutoMarkPaid = computed(() => bakerySettingsStore.shouldAutoMarkPaid);
const shouldDefaultToCurrentDate = computed(() => bakerySettingsStore.shouldDefaultToCurrentDate);
const shouldHideDeliveryOptions = computed(() => bakerySettingsStore.shouldHideDeliveryOptions);
const posDefaultClientId = computed(() => bakerySettingsStore.posDefaultClientId);

const tomorrowString = getNextBusinessDayString();

const deliveryFeeOptions = [7000, 8000, 9000, 10000]
  .map((value) => ({ value, label: formatMoney(value) }))
  .concat({ value: 'custom', label: 'Otro' });

// Must stay one of the deliveryFeeOptions values, otherwise the pills fall to "Otro"
const DEFAULT_DELIVERY_FEE = 7000;

// Below Tailwind's sm, matching the class breakpoints used everywhere else.
const narrowQuery = window.matchMedia('(max-width: 639px)');
const isNarrow = ref(narrowQuery.matches);
const onNarrowChange = (event) => { isNarrow.value = event.matches; };
narrowQuery.addEventListener('change', onNarrowChange);
onUnmounted(() => narrowQuery.removeEventListener('change', onNarrowChange));

const getInitialFormState = () => {
  return {
    userId: '',
    userName: '',
    userEmail: '',
    userPhone: '',
    userNationalId: '',
    userLegalName: '',
    orderItems: [],
    preparationDate: tomorrowString,
    dueDate: tomorrowString,
    paymentDate: '',
    partialPayments: [],
    dueTime: '',
    fulfillmentType: 'delivery',
    deliveryAddress: '',
    deliveryFee: DEFAULT_DELIVERY_FEE,
    paymentMethod: 'cash',
    internalNotes: '',
    deliveryNotes: '',
    shouldUpdateClientAddress: false,
    orderDiscountType: 'percentage',
    orderDiscountValue: 0,
    invoiceGracePeriod: null,
  };
};

// Helper function to convert legacy partial payment data
const convertLegacyPartialPayments = (initialData) => {
  // If partialPayments array exists, use it
  if (initialData.partialPayments && Array.isArray(initialData.partialPayments)) {
    return initialData.partialPayments.map(payment => ({
      id: Date.now().toString() + Math.random(),
      amount: payment.amount || 0,
      date: formatDateForInput(payment.date),
      method: payment.method || initialData.paymentMethod || 'cash',
    }));
  }

  // Otherwise, convert legacy scalar fields
  if (initialData.partialPaymentAmount > 0 && initialData.partialPaymentDate) {
    return [{
      id: Date.now().toString(),
      amount: initialData.partialPaymentAmount,
      date: formatDateForInput(initialData.partialPaymentDate),
      method: initialData.paymentMethod || 'cash',
    }];
  }

  return [];
};

// Form state
const formData = ref(
  props.initialData
    ? {
      ...props.initialData,
      preparationDate: formatDateForInput(props.initialData.preparationDate),
      dueDate: formatDateForInput(props.initialData.dueDate),
      paymentDate: formatDateForInput(props.initialData.paymentDate),
      partialPayments: convertLegacyPartialPayments(props.initialData),
      orderItems: addBasePricesToOrderItems(
        props.initialData.orderItems,
        productStore.items,
        true,
      ),
      // Safe fallbacks for the single-choice fields
      fulfillmentType: props.initialData.fulfillmentType ?? 'delivery',
      paymentMethod: props.initialData.paymentMethod ?? 'cash',
      orderDiscountType: props.initialData.orderDiscountType ?? 'percentage',
    }
    : getInitialFormState(),
);

// The server holds an order's lines against the stock while the order is shipped,
// or open and not forgotten (due no longer ago than the committed window). Past
// that, its lines are not in the figure and must not be given back.
const heldOnServer = (order) => order.status >= SHIPPED_STATUS
  || new Date(order.dueDate) >= new Date(Date.now() - COMMITTED_WINDOW_DAYS * 86400000);

// The order as saved, for each line's disponible. Copied once, before any edit,
// because edits can reach the very same line objects. A duplicate has no id and
// holds nothing on the server.
const savedLines = props.initialData?.id && heldOnServer(props.initialData)
  ? props.initialData.orderItems.map(({
    productId, combination, sourceWarehouseId, quantity, fulfillmentSource,
  }) => ({
    productId,
    combination: combination ? { id: combination.id } : null,
    sourceWarehouseId,
    quantity,
    fulfillmentSource,
  }))
  : [];

const errors = ref({});

// Optional sections start open when they already hold something.
const showProductionNote = ref(!!formData.value.internalNotes);
const showDeliveryNote = ref(!!formData.value.deliveryNotes);
const showOrderDiscount = ref(!!formData.value.orderDiscountValue);

// Where the cashier's hands go first: the catalog when the client is already
// chosen for them, otherwise the client.
const focusFirstField = () => {
  if (shouldAutoSelectClient.value) catalog.value?.focus();
  else userCombox.value?.focus();
};

const resetForm = () => {
  formData.value = getInitialFormState();
  errors.value = {};
  selectedDeliveryFee.value = DEFAULT_DELIVERY_FEE;
  userHistory.value = [];
  repeated.value = null;
  showProductionNote.value = false;
  showDeliveryNote.value = false;
  showOrderDiscount.value = false;
  applyPOSSettings();
  nextTick(focusFirstField);
};

// Expose the resetForm method to the parent component
defineExpose({ resetForm });

const submitButtonText = computed(() => {
  return props.initialData?.id ? 'Actualizar pedido' : 'Crear pedido';
});

const loadingText = computed(() => {
  return props.initialData ? 'Actualizando…' : 'Creando…';
});

// An invoiced order keeps what its invoice bills: client, lines, prices, fee,
// discount. The backend refuses those edits (orderService); this disables them
// first. A rejected invoice frees the order to be fixed and issued again.
const lockedInvoice = computed(() => {
  const invoice = props.initialData?.id ? props.initialData.einvoice : null;
  return invoice && invoice.status !== 'rejected' ? invoice : null;
});

const clearErrorsOnInput = (fields) => {
  watch(
    () => fields.map((field) => formData.value[field]),
    () => {
      for (const field in errors.value) {
        if (formData.value[field] && errors.value[field]) {
          delete errors.value[field];
        }
      }
    },
    { deep: true },
  );
};

const applyPOSSettings = () => {
  const todayString = getTodayString();

  // Auto-select POS client
  if (shouldAutoSelectClient.value && posDefaultClientId.value) {
    formData.value.userId = posDefaultClientId.value;

    // Find and select the user to populate other fields
    const posUser = userStore.items.find(u => u.id === posDefaultClientId.value);
    if (posUser) {
      handleUserChange(posUser);
    }
  }

  // Auto-mark as paid (pre-fill payment date)
  if (shouldAutoMarkPaid.value) {
    formData.value.paymentDate = todayString;
  }

  // Default to current date
  if (shouldDefaultToCurrentDate.value) {
    formData.value.preparationDate = todayString;
    formData.value.dueDate = todayString;

    // Also set current time if time field is available
    if (features.value?.order?.timeOfDay) {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
      formData.value.dueTime = currentTime;
    }
  }

  // Hide delivery options (force pickup)
  if (shouldHideDeliveryOptions.value) {
    formData.value.fulfillmentType = 'pickup';
  } else if (shouldAutoSelectClient.value && lastPosFulfillmentType) {
    // Restore the cashier's last recoger/domicilio choice
    formData.value.fulfillmentType = lastPosFulfillmentType;
  }
};

// Remember the choice while in POS mode, for the next order in this session
watch(
  () => formData.value.fulfillmentType,
  (newValue) => {
    if (!props.initialData && shouldAutoSelectClient.value && !shouldHideDeliveryOptions.value) {
      lastPosFulfillmentType = newValue;
    }
  },
);

onMounted(async () => {
  fetching.value = true;
  await Promise.all([
    productStore.fetchAll(),
    userStore.fetchAll(),
    bakerySettingsStore.fetchById('default'),
    systemSettingsStore.fetchSettings(),
  ]);
  fetching.value = false;

  // Handle initial user selection - either from props or POS auto-select
  if (props.initialData?.userId) {
    const user = userStore.items.find((u) => u.id === props.initialData.userId);
    if (user) {
      handleUserChange(user);
    }
  } else {
    // Apply POS settings for new orders (including auto-client selection)
    applyPOSSettings();
  }

  // Initialize selected fee type if there's an initial value
  const matchingOption = deliveryFeeOptions.find(
    (option) => option.value === formData.value.deliveryFee,
  );
  if (matchingOption) {
    selectedDeliveryFee.value = matchingOption.value;
  } else if (formData.value.deliveryFee) {
    selectedDeliveryFee.value = 'custom';
  }

  clearErrorsOnInput([
    'userId',
    'preparationDate',
    'dueDate',
    'partialPayments',
    'deliveryAddress',
    'orderItems',
  ]);

  // The form renders only once fetching is done, so the refs exist from here.
  await nextTick();
  focusFirstField();
});

const features = computed(() => {
  if (!bakerySettingsStore.items.length) return {};
  return bakerySettingsStore.items[0].features;
});

const shouldLoadHistoricalOnUserSelection = computed(() => {
  return features.value?.order?.loadHistoricalOnUserSelection || false;
});

// A client someone just chose: fill the form, then move on to the next field.
const pickClient = (user) => handleUserChange(user, { moveFocus: true });

// POS client section collapse state
const isClientSectionCollapsed = ref(true);

// Focus moves only when a person picked the client. Filled in by the form itself
// (POS default, an order being edited), it must not pull focus from wherever the
// cashier already is — the catalog grid, whose letter keys would land in search.
const handleUserChange = async (user, { moveFocus = false } = {}) => {
  formData.value.userId = user.id;
  formData.value.userName = user.name;
  formData.value.userEmail = user.email;
  formData.value.userPhone = user.phone;
  formData.value.userLegalName = user.legalName || '';
  formData.value.userCategory = user.category || '';
  formData.value.userNationalId = user.nationalId || '';
  if (!props.initialData) {
    formData.value.invoiceGracePeriod = user.invoiceGracePeriod || null;
  } else if (formData.value.invoiceGracePeriod === null && user.invoiceGracePeriod > 0) {
    formData.value.invoiceGracePeriod = user.invoiceGracePeriod;
  }
  if (props.initialData) {
    formData.value.deliveryAddress = props.initialData.deliveryAddress;
  } else {
    formData.value.deliveryAddress = user.address;
  }
  originalAddress.value = user.address;

  // Only fetch and set history for new orders
  if (!props.initialData) {
    repeated.value = null;
    try {
      userHistory.value = await userStore.getHistory(user.id);
      const lastOrder = userHistory.value[0];
      if (lastOrder && shouldLoadHistoricalOnUserSelection.value) {
        formData.value.orderItems = addBasePricesToOrderItems(
          lastOrder.orderItems,
          productStore.items,
        );
        formData.value.fulfillmentType = lastOrder.fulfillmentType;
        formData.value.deliveryFee = lastOrder.deliveryFee;
        formData.value.paymentMethod = lastOrder.paymentMethod;
        formData.value.orderDiscountType = lastOrder.orderDiscountType || 'percentage';
        formData.value.orderDiscountValue = lastOrder.orderDiscountValue || 0;
        showOrderDiscount.value = !!formData.value.orderDiscountValue;
      }
    } catch (error) {
      userHistory.value = [];
    }
  }

  if (!moveFocus) return;
  await nextTick();
  if (shouldDefaultToCurrentDate.value) catalog.value?.focus();
  else formRef.value?.querySelector(`#${CSS.escape(`${uid}-date`)}`)?.focus();
};

const addressHasChanged = computed(() => {
  return (
    formData.value.deliveryAddress !== originalAddress.value &&
    formData.value.deliveryAddress !== '' &&
    originalAddress.value !== ''
  );
});

// Past orders, newest first. A few are enough to recognise "lo de siempre";
// further back is the orders list's job.
const PAST_ORDERS_SHOWN = 4;
const pastOrders = computed(() => (props.initialData ? [] : userHistory.value.slice(0, PAST_ORDERS_SHOWN)));

const formatShortDate = (date) => (date
  ? new Date(date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', '')
  : '');

const unitsOf = (items) => items.reduce((sum, item) => sum + (item.quantity || 0), 0);

// Repeating adds the past order's lines after the current ones. Deshacer takes
// exactly those back out, and only while the cart still has the same number of
// lines: once a line is added or removed, "those lines" no longer means anything.
const repeated = ref(null);

const repeatOrder = (order) => {
  const at = formData.value.orderItems.length;
  // A repeat is a new sale: the tax type comes from the product as it is now,
  // since lines saved before products had one carry none.
  const added = addBasePricesToOrderItems(order.orderItems, productStore.items).map((line) => ({
    ...line,
    taxType: productStore.items.find((p) => p.id === line.productId)?.taxType ?? line.taxType,
  }));
  formData.value.orderItems = [...formData.value.orderItems, ...added];
  repeated.value = { at, count: added.length, date: order.preparationDate || order.dueDate };
};

const canUndoRepeat = computed(() => repeated.value
  && formData.value.orderItems.length === repeated.value.at + repeated.value.count);

const undoRepeat = () => {
  formData.value.orderItems = formData.value.orderItems.slice(0, repeated.value.at);
  repeated.value = null;
};

const scrollToError = async () => {
  await nextTick();
  const firstError = formRef.value?.querySelector('.ui-field-error');
  (firstError || formRef.value)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

const validate = () => {
  errors.value = {};

  if (!formData.value.userId) errors.value.userId = 'Elige un cliente';
  if (!formData.value.orderItems.length)
    errors.value.orderItems = 'Agrega al menos un producto';
  if (!formData.value.preparationDate)
    errors.value.preparationDate = 'Elige una fecha';
  if (!formData.value.dueDate)
    errors.value.dueDate = 'Fecha de entrega es requerida';
  // Validate partial payments
  const totalPartialPayments = formData.value.partialPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
  if (totalPartialPayments > total.value) {
    errors.value.partialPayments = 'Los pagos parciales no pueden exceder el total del pedido';
  }

  // Validate individual partial payments
  const hasInvalidPayments = formData.value.partialPayments.some(payment =>
    !payment.amount || payment.amount <= 0 || !payment.date || !payment.method,
  );
  if (hasInvalidPayments) {
    errors.value.partialPayments = 'Todos los pagos parciales deben tener monto, fecha y método válidos';
  }
  if (formData.value.dueDate < formData.value.preparationDate) {
    errors.value.dueDate =
      'La fecha de entrega no puede ser anterior a la fecha de preparación';
  }

  if (Object.keys(errors.value).length > 0) {
    scrollToError();
    return false;
  }

  return true;
};

const handleSubmit = () => {
  if (!validate()) return;
  formData.value.deliveryAddress = cleanString(formData.value.deliveryAddress);
  formData.value.deliveryNotes = cleanString(formData.value.deliveryNotes);
  formData.value.internalNotes = cleanString(formData.value.internalNotes);
  formData.value.isPaid = !!formData.value.paymentDate;

  emit('submit', { ...formData.value, taxMode: currentTaxMode.value });
};

const currentTaxMode = computed(() => {
  return bakerySettingsStore.items[0]?.features?.invoicing?.taxMode || 'inclusive';
});

// Create Order instance for pricing calculations (source of truth)
const orderForPricing = computed(() => {
  return new Order({
    ...formData.value,
    taxMode: currentTaxMode.value,
  });
});

// Pricing computed properties delegated to Order model
const subtotal = computed(() => orderForPricing.value.subtotal);
const preTaxSubtotal = computed(() => orderForPricing.value.preTaxSubtotal);
const preTaxTotal = computed(() => orderForPricing.value.preTaxTotal);
const totalTaxAmount = computed(() => orderForPricing.value.totalTaxAmount);
const orderDiscountAmount = computed(() => orderForPricing.value.orderDiscountAmount);
const total = computed(() => orderForPricing.value.total);

// Original tax before discount (for inclusive display)
const originalTaxAmount = computed(() => subtotal.value - preTaxSubtotal.value);

const itemCount = computed(() => unitsOf(formData.value.orderItems));

const paymentMethodOptions = computed(() => {
  if (!bakerySettingsStore.items.length) return [];

  const settings = bakerySettingsStore.items[0];
  const availablePaymentMethods = systemSettingsStore.availablePaymentMethods || [];
  const activePaymentMethods = settings.features?.order?.activePaymentMethods || [];

  return availablePaymentMethods.filter(method =>
    activePaymentMethods.includes(method.value),
  );
});

const paymentMethodPills = computed(() => paymentMethodOptions.value.map((method) => ({
  ...method,
  icon: paymentIconMap[method.value],
})));

const fulfillmentTypes = [
  { value: 'pickup', label: 'Recoger' },
  { value: 'delivery', label: 'Domicilio' },
];

const discountTypeOptions = [
  { value: 'percentage', label: '%' },
  { value: 'fixed', label: '$' },
];

// Without delivery there is only one kind of note, so it needs no qualifier.
const productionNoteLabel = computed(() =>
  (shouldHideDeliveryOptions.value ? 'Comentarios' : 'Comentarios producción'));

// The business delivers at all (structure) vs this order is a delivery (state):
// the first decides what exists, the second what is enabled.
const hasDelivery = computed(() => !shouldHideDeliveryOptions.value);

const isDelivery = computed(() => formData.value.fulfillmentType === 'delivery' && !shouldHideDeliveryOptions.value);

const dateLabel = computed(() => {
  if (shouldDefaultToCurrentDate.value) return 'Fecha de venta';
  return features.value?.order?.defaultDate === 'delivery' ? 'Fecha de entrega' : 'Fecha de preparación';
});

const paymentStatusOptions = [
  { value: false, label: 'Pendiente' },
  { value: true, label: 'Pagado' },
];

// Paid is a two-state choice; the date is its detail. Pagado fills today, and the
// date stays editable for a payment received another day.
const isPaid = computed({
  get: () => !!formData.value.paymentDate,
  set: (paid) => {
    formData.value.paymentDate = paid ? (formData.value.paymentDate || getTodayString()) : '';
  },
});

const showGracePeriod = computed(() =>
  formData.value.userCategory === 'B2B' && formData.value.invoiceGracePeriod !== null);

const removeOrderDiscount = () => {
  formData.value.orderDiscountValue = 0;
  showOrderDiscount.value = false;
};

// Switching %/$ keeps the discount amount; the typed number converts.
const setOrderDiscountType = (type) => {
  if (type === formData.value.orderDiscountType) return;
  const amount = orderDiscountAmount.value;
  const base = orderForPricing.value.taxMode === 'exclusive'
    ? orderForPricing.value.preTaxSubtotal
    : orderForPricing.value.postTaxSubtotal;
  formData.value.orderDiscountValue = type === 'fixed'
    ? amount
    : (base ? Math.round((amount / base) * 10000) / 100 : 0);
  formData.value.orderDiscountType = type;
};

const selectedDeliveryFee = ref(DEFAULT_DELIVERY_FEE);

watch(selectedDeliveryFee, (newValue) => {
  if (newValue === 'custom') return;
  formData.value.deliveryFee = newValue;
});

// Only on a click of Otro: an order loaded with a custom fee must not steal focus.
const onDeliveryFeePick = (value) => {
  if (value !== 'custom') return;
  nextTick(() => formRef.value?.querySelector(`#${CSS.escape(`${uid}-fee`)}`)?.focus());
};

// A fee from outside (a past order) picks its preset. While typing a custom one
// it stays custom, or typing 8000 would snap back to the pills mid-number.
watch(
  () => formData.value.deliveryFee,
  (newValue) => {
    if (selectedDeliveryFee.value === 'custom') return;
    const matchingOption = deliveryFeeOptions.find(
      (option) => option.value === newValue,
    );
    selectedDeliveryFee.value = matchingOption
      ? matchingOption.value
      : 'custom';
  },
);

watch(
  () => formData.value.preparationDate,
  (newDate) => {
    if (newDate) {
      formData.value.dueDate = newDate;
    }
  },
);

const clearUser = () => {
  formData.value.userId = '';
  formData.value.userName = '';
  formData.value.userEmail = '';
  formData.value.userPhone = '';
  formData.value.userNationalId = '';
  formData.value.userLegalName = '';
  formData.value.deliveryAddress = '';
  userHistory.value = [];
  repeated.value = null;

  nextTick(() => {
    userCombox.value?.focus();
  });
};
</script>

<template>
  <div v-if="fetching" class="ui-app ui-empty" data-ui-theme="light">Cargando…</div>

  <form
    v-else
    ref="formRef"
    class="ui-app"
    data-ui-theme="light"
    @submit.prevent="handleSubmit"
  >
    <!-- Who, when and how: the context every line below belongs to. -->
    <div class="ui-pane flex flex-col gap-4">
      <h2 class="ui-panehead-title">{{ title }}</h2>

      <p v-if="lockedInvoice" class="ui-card ui-card-body">
        <strong>Facturada {{ lockedInvoice.number }}{{ lockedInvoice.annulled ? ' (anulada)' : '' }}.</strong>
        Lo facturado no se puede cambiar.
        {{ lockedInvoice.annulled
          ? 'Para facturarlo de nuevo, duplica el pedido.'
          : 'Para corregirlo, anula la factura con una nota crédito y duplica el pedido.' }}
        El estado, el pago y las notas siguen editables.
      </p>

      <!-- POS: the client is chosen for the cashier, so it stays one line until asked. -->
      <button
        v-if="shouldAutoSelectClient && isClientSectionCollapsed"
        type="button"
        class="ui-item ui-item-filled"
        @click="isClientSectionCollapsed = false"
      >
        <span class="ui-tag">cliente</span>
        <span class="ui-item-title">{{ formData.userName || 'Punto de venta' }}</span>
        <span class="ui-item-meta">Cambiar</span>
      </button>

      <div v-else class="flex flex-wrap items-start gap-3">
        <!-- `contents`: a fieldset only to disable what it holds, never a box. -->
        <fieldset class="contents" :disabled="!!lockedInvoice">
        <div class="ui-field flex-[2_1_16rem]">
          <label class="ui-field-k" :for="`${uid}-client`" data-required>Cliente</label>
          <div class="flex gap-1.5">
            <UserCombox
              :id="`${uid}-client`"
              ref="userCombox"
              v-model="formData.userId"
              class="flex-1 min-w-0"
              :users="userStore.items"
              :invalid="!!errors.userId"
              :described-by="errors.userId ? `${uid}-client-e` : undefined"
              @change="pickClient"
            />
            <button
              v-if="formData.userId"
              type="button"
              class="ui-btn ui-btn-icon ui-btn-field"
              aria-label="Quitar cliente"
              title="Quitar cliente"
              @click="clearUser"
            >
              <PhX :size="13" weight="bold" />
            </button>
            <button
              v-if="!isOffline"
              type="button"
              class="ui-btn ui-btn-field"
              @click="isNewClientDialogOpen = true"
            >
              <PhPlus :size="13" weight="bold" />
              Nuevo
            </button>
          </div>
          <span v-if="errors.userId" :id="`${uid}-client-e`" class="ui-field-error">{{ errors.userId }}</span>
        </div>
        </fieldset>

        <div class="ui-field flex-[1_1_9rem]">
          <label class="ui-field-k" :for="`${uid}-date`" data-required>{{ dateLabel }}</label>
          <input
            :id="`${uid}-date`"
            v-model="formData.preparationDate"
            type="date"
            class="ui-input"
            required
            :aria-invalid="!!(errors.preparationDate || errors.dueDate)"
            :aria-describedby="errors.preparationDate || errors.dueDate ? `${uid}-date-e` : undefined"
          >
          <span v-if="errors.preparationDate || errors.dueDate" :id="`${uid}-date-e`" class="ui-field-error">
            {{ errors.preparationDate || errors.dueDate }}
          </span>
        </div>

        <div v-if="features?.order?.timeOfDay" class="ui-field flex-[1_1_7rem]">
          <label class="ui-field-k" :for="`${uid}-time`">Hora</label>
          <input :id="`${uid}-time`" v-model="formData.dueTime" type="time" class="ui-input">
        </div>

        <fieldset v-if="!shouldHideDeliveryOptions" class="contents" :disabled="!!lockedInvoice">
          <UiPills
            v-model="formData.fulfillmentType"
            class="flex-[1_1_12rem]"
            label="Entrega"
            min-width="5rem"
            :options="fulfillmentTypes"
          />
        </fieldset>
      </div>

      <!-- Disabled on Recoger rather than removed: the form keeps its shape, and
           the address is still there if they switch back. -->
      <div v-if="hasDelivery" class="ui-field">
        <label class="ui-field-k" :for="`${uid}-address`">Dirección</label>
        <div class="flex gap-1.5">
          <input
            :id="`${uid}-address`"
            v-model="formData.deliveryAddress"
            type="text"
            class="ui-input flex-1"
            :disabled="!isDelivery"
          >
          <!-- Only once the address differs from the client's: then it is a real question. -->
          <button
            v-if="addressHasChanged"
            type="button"
            class="ui-btn ui-btn-field"
            :disabled="!isDelivery"
            :aria-pressed="formData.shouldUpdateClientAddress"
            @click="formData.shouldUpdateClientAddress = !formData.shouldUpdateClientAddress"
          >
            Guardar en el cliente
          </button>
        </div>
      </div>

      <div v-if="pastOrders.length && !lockedInvoice" class="ui-field">
        <span class="ui-field-k">Repetir un pedido anterior</span>
        <div class="flex flex-wrap items-center gap-1.5">
          <button
            v-for="order in pastOrders"
            :key="order.id"
            type="button"
            class="ui-chip cursor-pointer"
            @click="repeatOrder(order)"
          >
            {{ formatShortDate(order.preparationDate || order.dueDate) }}
            <span class="ui-chip-meta">{{ unitsOf(order.orderItems) }} prod · {{ formatMoney(order.total || 0) }}</span>
          </button>
        </div>
        <span v-if="canUndoRepeat" class="ui-field-hint flex items-center gap-2">
          Se agregó el pedido del {{ formatShortDate(repeated.date) }}.
          <button type="button" class="ui-btn ui-btn-sm" @click="undoRepeat">Deshacer</button>
        </span>
      </div>
    </div>

    <div
      class="ui-panes"
      style="--panes: minmax(0, 1fr) minmax(0, 1.15fr); border-top: 1px solid var(--ui-line)"
    >
      <!-- The pane you take things from sits one step back (ui-pane-sunken). -->
      <section class="ui-pane ui-pane-sunken" aria-label="Catálogo">
        <div class="ui-panehead">
          <span class="ui-panehead-title">Catálogo</span>
        </div>
        <fieldset class="contents" :disabled="!!lockedInvoice">
          <ProductWizard
            ref="catalog"
            :products="productStore.items"
            @select="!lockedInvoice && itemsManager?.add($event)"
          />
        </fieldset>
      </section>

      <section class="ui-pane flex flex-col gap-4" aria-label="Pedido">
        <div class="ui-panehead !mb-0">
          <span class="ui-panehead-title">Pedido</span>
          <span class="ui-panehead-sub">
            {{ itemCount }} {{ itemCount === 1 ? 'producto' : 'productos' }}
          </span>
        </div>

        <span v-if="errors.orderItems" class="ui-field-error">{{ errors.orderItems }}</span>

        <fieldset class="contents" :disabled="!!lockedInvoice">
          <OrderItemsManager
            ref="itemsManager"
            v-model="formData.orderItems"
            :products="productStore.items"
            :saved-lines="savedLines"
          />
        </fieldset>

        <div class="ui-sectionhead !mb-0">Pago</div>

        <UiPills
          v-model="formData.paymentMethod"
          label="Método"
          min-width="7rem"
          :options="paymentMethodPills"
        />

        <!-- Picked, Otro becomes its own field in the same cell, at the pills'
             height (UiPills sizes them as fields when a selected- slot exists).
             Fixed columns keep Otro last; three on a phone, where five would
             cut "$10,000". -->
        <UiPills
          v-if="hasDelivery"
          v-model="selectedDeliveryFee"
          label="Costo de envío"
          :columns="isNarrow ? 3 : 5"
          :options="deliveryFeeOptions"
          :disabled="!isDelivery || !!lockedInvoice"
          @change="onDeliveryFeePick"
        >
          <template #selected-custom>
            <div class="ui-field-unit" data-unit="$">
              <UiMoneyInput
                :id="`${uid}-fee`"
                v-model="formData.deliveryFee"
                aria-label="Otro costo de envío"
                :disabled="!isDelivery || !!lockedInvoice"
                @focus="$event.target.select()"
              />
            </div>
          </template>
        </UiPills>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
          <UiPills
            v-model="isPaid"
            label="Estado del pago"
            min-width="6rem"
            :options="paymentStatusOptions"
          />
          <!-- Always there, so choosing Pagado fills a field instead of moving the
               layout; disabled while Pendiente, when there is no date to give. -->
          <div class="ui-field">
            <label class="ui-field-k" :for="`${uid}-paid-on`">Fecha de pago</label>
            <input
              :id="`${uid}-paid-on`"
              v-model="formData.paymentDate"
              type="date"
              class="ui-input"
              :disabled="!isPaid"
            >
          </div>
          <div v-if="showGracePeriod" class="ui-field">
            <label class="ui-field-k" :for="`${uid}-grace`">Vence en (días)</label>
            <input
              :id="`${uid}-grace`"
              v-model.number="formData.invoiceGracePeriod"
              type="number"
              class="ui-input ui-input-num"
              min="0"
              max="365"
              @wheel="$event.target.blur()"
            >
          </div>
        </div>

        <div v-if="features?.order?.allowPartialPayment">
          <PartialPaymentsManager
            v-model="formData.partialPayments"
            :total-amount="total"
            :payment-method-options="paymentMethodOptions"
            :payment-date="formData.paymentDate"
            :disabled="loading"
          />
          <span v-if="errors.partialPayments" class="ui-field-error">{{ errors.partialPayments }}</span>
        </div>

        <!-- Comments: two toggles that never move, each opening its own full-width
             box. Closing keeps the text; the pencil says a closed one has some. -->
        <div class="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            class="ui-btn w-full justify-center min-w-0"
            :aria-pressed="showProductionNote"
            :aria-controls="`${uid}-internal`"
            @click="showProductionNote = !showProductionNote"
          >
            <component :is="formData.internalNotes ? PhNotePencil : PhPlus" :size="12" weight="bold" class="flex-none" />
            <span class="truncate">{{ productionNoteLabel }}</span>
          </button>
          <button
            v-if="hasDelivery"
            type="button"
            class="ui-btn w-full justify-center min-w-0"
            :aria-pressed="showDeliveryNote"
            :aria-controls="`${uid}-delivery-notes`"
            :disabled="!isDelivery"
            @click="showDeliveryNote = !showDeliveryNote"
          >
            <component :is="formData.deliveryNotes ? PhNotePencil : PhPlus" :size="12" weight="bold" class="flex-none" />
            <span class="truncate">Comentarios domicilio</span>
          </button>
        </div>

        <div v-if="showProductionNote" class="ui-field">
          <label class="ui-field-k" :for="`${uid}-internal`">{{ productionNoteLabel }}</label>
          <textarea :id="`${uid}-internal`" v-model="formData.internalNotes" class="ui-input ui-input-area" rows="2"></textarea>
        </div>

        <div v-if="hasDelivery && showDeliveryNote" class="ui-field">
          <label class="ui-field-k" :for="`${uid}-delivery-notes`">Comentarios domicilio</label>
          <textarea
            :id="`${uid}-delivery-notes`"
            v-model="formData.deliveryNotes"
            class="ui-input ui-input-area"
            rows="2"
            :disabled="!isDelivery"
          ></textarea>
        </div>

        <!-- The breakdown, read like a receipt: labels left, every amount in one
             right-hand column, so the eye runs straight down to the total. -->
        <div class="flex flex-col gap-1.5 text-sm">
          <template v-if="currentTaxMode === 'inclusive'">
            <div v-if="originalTaxAmount > 0" class="flex justify-between">
              <span class="ui-ink-muted">Antes de impuesto</span><span class="ui-num">{{ formatMoney(preTaxSubtotal) }}</span>
            </div>
            <div v-if="originalTaxAmount > 0" class="flex justify-between">
              <span class="ui-ink-muted">Impuesto</span><span class="ui-num">{{ formatMoney(originalTaxAmount) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="ui-ink-muted">Subtotal</span><span class="ui-num">{{ formatMoney(subtotal) }}</span>
            </div>
          </template>
          <template v-else>
            <div class="flex justify-between">
              <span class="ui-ink-muted">Antes de impuesto</span><span class="ui-num">{{ formatMoney(preTaxSubtotal) }}</span>
            </div>
          </template>

          <div class="flex justify-between items-center gap-2 min-h-[var(--ui-field-h)]">
            <fieldset class="flex items-center gap-1.5 m-0 p-0 border-0 min-w-0" :disabled="!!lockedInvoice">
              <span class="ui-ink-muted">Descuento</span>
              <template v-if="showOrderDiscount">
                <!-- %/$ as one segmented pair on the same line as the value. -->
                <span class="flex" role="group" aria-label="Tipo de descuento">
                  <button
                    v-for="(o, i) in discountTypeOptions"
                    :key="o.value"
                    type="button"
                    class="ui-btn ui-btn-icon ui-btn-field w-8 justify-center"
                    :class="i === 0 ? '!rounded-r-none' : '!rounded-l-none -ml-px'"
                    :aria-label="o.value === 'percentage' ? 'Porcentaje' : 'Valor fijo'"
                    :aria-pressed="formData.orderDiscountType === o.value"
                    @click="setOrderDiscountType(o.value)"
                  >
                    {{ o.label }}
                  </button>
                </span>
                <UiMoneyInput
                  v-if="formData.orderDiscountType === 'fixed'"
                  v-model="formData.orderDiscountValue"
                  class="w-20"
                  placeholder="0"
                  aria-label="Valor del descuento"
                  @focus="$event.target.select()"
                />
                <input
                  v-else
                  v-model.number="formData.orderDiscountValue"
                  type="number"
                  class="ui-input ui-input-num w-20"
                  min="0"
                  max="100"
                  step="any"
                  placeholder="0"
                  aria-label="Valor del descuento"
                  @focus="$event.target.select()"
                >
                <button
                  type="button"
                  class="ui-btn ui-btn-icon ui-btn-field"
                  aria-label="Quitar descuento"
                  title="Quitar descuento"
                  @click="removeOrderDiscount"
                >
                  <PhX :size="13" weight="bold" />
                </button>
              </template>
              <!-- Beside its label: the click lands where the controls will appear. -->
              <button v-else type="button" class="ui-btn ui-btn-sm" @click="showOrderDiscount = true">
                <PhPlus :size="12" weight="bold" />
                Agregar
              </button>
            </fieldset>
            <span v-if="showOrderDiscount" class="ui-num">
              {{ orderDiscountAmount > 0 ? `-${formatMoney(orderDiscountAmount)}` : formatMoney(0) }}
            </span>
          </div>

          <template v-if="currentTaxMode !== 'inclusive'">
            <div v-if="orderDiscountAmount > 0" class="flex justify-between">
              <span class="ui-ink-muted">Subtotal con descuento</span><span class="ui-num">{{ formatMoney(preTaxTotal) }}</span>
            </div>
            <div v-if="totalTaxAmount > 0" class="flex justify-between">
              <span class="ui-ink-muted">Impuesto</span><span class="ui-num">{{ formatMoney(totalTaxAmount) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="ui-ink-muted">Subtotal</span><span class="ui-num">{{ formatMoney(preTaxTotal + totalTaxAmount) }}</span>
            </div>
          </template>

          <div v-if="isDelivery" class="flex justify-between">
            <span class="ui-ink-muted">Envío</span><span class="ui-num">{{ formatMoney(formData.deliveryFee || 0) }}</span>
          </div>
        </div>

        <!-- Always in reach: the total, in the same right-hand column as the
             amounts above it, and the one thing you came to do. -->
        <div
          class="sticky bottom-0 z-10 -mx-[22px] -mb-5 px-[22px] py-3 flex flex-col gap-2.5"
          style="background: var(--ui-surface-2); border-top: 1px solid var(--ui-line)"
        >
          <!-- A sticky box stops at its scroll container's padding edge, and the
               dashboard shell has bottom padding (it clears the mobile nav), so
               the rows scrolling past show through underneath. This fills that
               strip. Once the bar reaches the end of the form, ui-app's
               overflow: clip cuts it off. -->
          <span
            class="absolute inset-x-0 top-full h-24"
            style="background: var(--ui-surface-2)"
            aria-hidden="true"
          />
          <div class="flex justify-between items-baseline">
            <span class="text-base font-bold">Total</span>
            <span class="ui-num text-xl font-bold">{{ formatMoney(total) }}</span>
          </div>
          <div class="flex justify-end gap-2">
            <button type="button" class="ui-btn ui-btn-danger" :disabled="loading" @click="emit('cancel')">
              Cancelar
            </button>
            <button type="submit" class="ui-btn ui-btn-solid" :disabled="loading">
              {{ loading ? loadingText : submitButtonText }}
            </button>
          </div>
        </div>
      </section>
    </div>

    <NewClientDialog
      v-model:isOpen="isNewClientDialogOpen"
      @client-created="pickClient"
    />
  </form>
</template>
