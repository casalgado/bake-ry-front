<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { useProductStore } from '@/stores/productStore';
import { useBakeryUserStore } from '@/stores/bakeryUserStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { useSystemSettingsStore } from '@/stores/systemSettingsStore';
import UserCombox from '@/components/forms/UserCombox.vue';
import OrderItemsManager from './OrderItemsManager.vue';
import NewClientDialog from './NewClientDialog.vue';
import RadioButtonGroup from './RadioButtonGroup.vue';
import { formatMoney } from '@/utils/helpers';
import { PhCaretLeft, PhCaretRight, PhX } from '@phosphor-icons/vue';
import { cleanString } from '@/utils/helpers';

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

const addBasePricesToOrderItems = (orderItems, products) => {
  return orderItems.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    if (!product) return item;

    if (product.variations?.length > 0) {
      if (item.variation?.id) {
        const matchingVariation = product.variations.find(
          (v) => v.id === item.variation.id,
        );
        if (matchingVariation) {
          return {
            ...item,
            basePrice: matchingVariation.basePrice,
          };
        }
      }
      return {
        ...item,
        basePrice: product.variations[0].basePrice,
      };
    }

    return {
      ...item,
      basePrice: product.basePrice,
    };
  });
};

const showHistoryNavigation = computed(() => {
  return !props.initialData && userHistory.value.length > 0;
});

const emit = defineEmits(['submit', 'cancel']);

const productStore = useProductStore();
const bakerySettingsStore = useBakerySettingsStore();
const systemSettingsStore = useSystemSettingsStore();
const userStore = useBakeryUserStore();
const isNewClientDialogOpen = ref(false);
const originalAddress = ref('');
const fetching = ref(false);
const userCombox = ref(null);
const userHistory = ref([]);
const currentHistoryIndex = ref(0);

// Get next business day
const getNextBusinessDay = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1); // Start with tomorrow

  // If it's Sunday (0), add 1 day to get to Monday
  if (date.getDay() === 0) {
    date.setDate(date.getDate() + 1);
  }

  return date;
};

const tomorrow = getNextBusinessDay();
const tomorrowString = tomorrow.toISOString().split('T')[0];

const formatDateForInput = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
};

const getInitialFormState = () => ({
  userId: '',
  userName: '',
  userEmail: '',
  userPhone: '',
  userNationalId: '',
  orderItems: [],
  preparationDate: tomorrowString,
  dueDate: tomorrowString,
  paymentDate: '',
  partialPaymentAmount: null,
  partialPaymentDate: '',
  dueTime: '',
  fulfillmentType: 'delivery',
  deliveryAddress: '',
  deliveryFee: 7000,
  paymentMethod: 'cash',
  internalNotes: '',
  deliveryNotes: '',
  shouldUpdateClientAddress: false,
});

// Form state
const formData = ref(
  props.initialData
    ? {
      ...props.initialData,
      preparationDate: formatDateForInput(props.initialData.preparationDate),
      dueDate: formatDateForInput(props.initialData.dueDate),
      paymentDate: formatDateForInput(props.initialData.paymentDate),
      partialPaymentDate: formatDateForInput(
        props.initialData.partialPaymentDate,
      ),
      orderItems: addBasePricesToOrderItems(
        props.initialData.orderItems,
        productStore.items,
      ),
    }
    : getInitialFormState(),
);

const errors = ref({});

const resetForm = () => {
  formData.value = getInitialFormState();
  errors.value = {};
  selectedDeliveryFee.value = deliveryFeeOptions[0].value;

  nextTick(() => {
    setTimeout(() => {
      userCombox.value?.focus();
    }, 800);
  });
};

// Expose the resetForm method to the parent component
defineExpose({ resetForm });

// Computed property for submit button text
const submitButtonText = computed(() => {
  return props.initialData ? 'Actualizar Pedido' : 'Crear Pedido';
});

// Computed property for loading text
const loadingText = computed(() => {
  return props.initialData ? 'Actualizando...' : 'Creando...';
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

onMounted(async () => {
  fetching.value = true;
  await Promise.all([
    productStore.fetchAll(),
    userStore.fetchAll(),
    bakerySettingsStore.fetchById('default'),
    systemSettingsStore.fetchSettings(),
  ]);
  fetching.value = false;

  console.log(bakerySettingsStore.items?.[0]);

  if (props.initialData?.userId) {
    const user = userStore.items.find((u) => u.id === props.initialData.userId);
    if (user) {
      handleUserChange(user);
    }
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
    'partialPaymentAmount',
    'partialPaymentDate',
    'deliveryAddress',
    'orderItems',
  ]);
});

const features = computed(() => {
  if (!bakerySettingsStore.items.length) return {};
  return bakerySettingsStore.items[0].features;
});

const handleNewClientClick = () => {
  isNewClientDialogOpen.value = true;
};

const handleClientCreated = (newClient) => {
  handleUserChange(newClient);
};

const handleUserChange = async (user) => {
  formData.value.userId = user.id;
  formData.value.userName = user.name;
  formData.value.userEmail = user.email;
  formData.value.userPhone = user.phone;
  formData.value.userNationalId = user.nationalId || ''; // Added userNationalId
  if (props.initialData) {
    formData.value.deliveryAddress = props.initialData.deliveryAddress;
  } else {
    formData.value.deliveryAddress = user.address;
  }
  originalAddress.value = user.address;

  // Only fetch and set history for new orders
  if (!props.initialData) {
    try {
      userHistory.value = await userStore.getHistory(user.id);
      if (userHistory.value.length > 0) {
        currentHistoryIndex.value = 0;
        const historicalOrder = userHistory.value[0];
        formData.value.orderItems = addBasePricesToOrderItems(
          historicalOrder.orderItems,
          productStore.items,
        );
        formData.value.fulfillmentType = historicalOrder.fulfillmentType;
        formData.value.deliveryFee = historicalOrder.deliveryFee;
        formData.value.paymentMethod = historicalOrder.paymentMethod;

        // Update selectedFeeType based on the historical delivery fee
        const matchingOption = deliveryFeeOptions.find(
          (option) => option.value === historicalOrder.deliveryFee,
        );
        selectedDeliveryFee.value = matchingOption
          ? matchingOption.value
          : 'custom';
      }
    } catch (error) {
      console.warn('Could not fetch user history:', error.message);
      userHistory.value = [];
    }
  }

  await nextTick();
  originalAddress.value = user.address;
  await nextTick();
  setTimeout(() => {
    const nextElement = document.querySelector(
      'input[name="preparation-date"]',
    );
    if (nextElement) {
      nextElement.focus();
    }
  }, 0);
};

const addressHasChanged = computed(() => {
  return (
    formData.value.deliveryAddress !== originalAddress.value &&
    formData.value.deliveryAddress !== '' &&
    originalAddress.value !== ''
  );
});

const scrollToError = async () => {
  await nextTick(); // Wait for the DOM to update
  const firstErrorElement = document.querySelector('.text-danger');
  if (firstErrorElement) {
    firstErrorElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  } else {
    // If no specific error element found, scroll to top of form
    const form = document.querySelector('form');
    if (form) {
      form.scrollIntoView({ behavior: 'smooth' });
    }
  }
};

const validate = () => {
  errors.value = {};

  if (!formData.value.userId) errors.value.userId = 'Cliente es requerido';
  if (!formData.value.orderItems.length)
    errors.value.orderItems = 'Se requiere al menos un producto';
  if (!formData.value.preparationDate)
    errors.value.preparationDate = 'Fecha de preparación es requerida';
  if (!formData.value.dueDate)
    errors.value.dueDate = 'Fecha de entrega es requerida';
  if (
    formData.value.partialPaymentAmount &&
    !formData.value.partialPaymentDate
  ) {
    errors.value.partialPaymentAmount =
      'Fecha de pago parcial es requerida si se ingresa un monto';
  }
  if (
    formData.value.partialPaymentDate &&
    (!formData.value.partialPaymentAmount ||
      formData.value.partialPaymentAmount <= 0)
  ) {
    errors.value.partialPaymentAmount =
      'Monto de pago parcial es requerido si se ingresa una fecha';
  }
  if (
    formData.value.partialPaymentAmount >
    formData.value.partialPaymentAmount >
    total.value
  ) {
    errors.value.partialPaymentAmount =
      'El monto parcial no puede ser mayor o igual al total';
  }
  if (
    formData.value.paymentDate &&
    formData.value.partialPaymentDate > formData.value.paymentDate
  ) {
    errors.value.partialPaymentAmount =
      'La fecha de pago parcial no puede ser posterior a la fecha de pago';
  }
  if (formData.value.dueDate < formData.value.preparationDate) {
    errors.value.dueDate =
      'La fecha de entrega no puede ser anterior a la fecha de preparación';
  }

  console.log(errors.value);

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
  console.log('Form Data:', formData.value);
  emit('submit', formData.value);
};

const subtotal = computed(() => {
  if (formData.value.paymentMethod === 'complimentary') {
    return 0;
  }
  return formData.value.orderItems.reduce((sum, item) => {
    return sum + (item.isComplimentary ? 0 : item.quantity * item.currentPrice);
  }, 0);
});

const total = computed(() => {
  if (formData.value.paymentMethod === 'complimentary') {
    return 0;
  }
  if (formData.value.fulfillmentType === 'pickup') {
    return subtotal.value;
  }
  return subtotal.value + formData.value.deliveryFee;
});

const paymentMethodOptions = computed(() => {
  if (!bakerySettingsStore.items.length) return [];

  const settings = bakerySettingsStore.items[0];
  const availablePaymentMethods = systemSettingsStore.availablePaymentMethods || [];
  const activePaymentMethods = settings.features?.order?.activePaymentMethods || [];

  // Filter available methods to only show active ones
  return availablePaymentMethods.filter(method =>
    activePaymentMethods.includes(method.value),
  );
});

const fulfillmentTypes = [
  { value: 'pickup', label: 'Recoger' },
  { value: 'delivery', label: 'Domicilio' },
];

const deliveryFeeOptions = [
  { value: 6000, label: '6,000' },
  { value: 7000, label: '7,000' },
  { value: 8000, label: '8,000' },
  { value: 9000, label: '9,000' },
  { value: 10000, label: '10,000' },
  { value: 'custom', label: 'Otro' },
];

const selectedDeliveryFee = ref(deliveryFeeOptions[0].value);

watch(selectedDeliveryFee, (newValue) => {
  if (newValue === 'custom') {
    // Don't modify the delivery fee if it's a custom value
    return;
  }
  formData.value.deliveryFee = newValue;
});

// Add a watch for deliveryFee to update selectedFeeType
watch(
  () => formData.value.deliveryFee,
  (newValue) => {
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

// Navigation methods
const handlePrevOrder = () => {
  if (currentHistoryIndex.value < userHistory.value.length - 1) {
    currentHistoryIndex.value++;
    const historicalOrder = userHistory.value[currentHistoryIndex.value];
    formData.value.orderItems = addBasePricesToOrderItems(
      historicalOrder.orderItems,
      productStore.items,
    );
  }
};

const handleNextOrder = () => {
  if (currentHistoryIndex.value > 0) {
    currentHistoryIndex.value--;
    const historicalOrder = userHistory.value[currentHistoryIndex.value];
    formData.value.orderItems = addBasePricesToOrderItems(
      historicalOrder.orderItems,
      productStore.items,
    );
  }
};

// Add this utility function to compare order items
const areOrderItemsEqual = (items1, items2) => {
  if (items1.length !== items2.length) return false;

  return items1.every((item1) => {
    const item2 = items2.find((i) => i.productId === item1.productId);
    if (!item2) return false;

    return (
      item1.quantity === item2.quantity &&
      item1.variation?.id === item2.variation?.id &&
      item1.currentPrice === item2.currentPrice
    );
  });
};

// Add computed property to check if current items match historical items
const isCurrentOrderModified = computed(() => {
  if (!userHistory.value.length) return false;

  const historicalOrder = userHistory.value[currentHistoryIndex.value];
  return !areOrderItemsEqual(
    formData.value.orderItems,
    historicalOrder.orderItems,
  );
});

// Modify the formatOrderDate function
const formatOrderDate = (date) => {
  if (isCurrentOrderModified.value) {
    return 'nueva';
  }
  return new Date(date)
    .toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
    })
    .replace('.', '');
};

const clearUser = () => {
  formData.value.userId = '';
  formData.value.userName = '';
  formData.value.userEmail = '';
  formData.value.userPhone = '';
  formData.value.userNationalId = ''; // Added userNationalId reset
  formData.value.deliveryAddress = '';
  userHistory.value = [];
  currentHistoryIndex.value = 0;

  nextTick(() => {
    userCombox.value?.focus();
  });
};

// Partial payment methods
const handlePartialAmountChange = () => {
  // If amount is entered and no date is set, set date to today
  if (
    formData.value.partialPaymentAmount &&
    !formData.value.partialPaymentDate
  ) {
    formData.value.partialPaymentDate = new Date()
      .toLocaleDateString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      .split('/')
      .reverse()
      .join('-');
  }
};

const clearPartialPayment = () => {
  formData.value.partialPaymentAmount = null;
  formData.value.partialPaymentDate = '';
};
</script>

<template>
  <div class="form-container">
    <h2>{{ title }}</h2>

    <form @submit.prevent="handleSubmit" :class="{ 'opacity-50': fetching }">
      <div class="base-card flex flex-col gap-2">
        <div>
          <label for="client-select">{{
            fetching ? "Clientes..." : "Clientes"
          }}</label>
          <div class="grid grid-cols-[1fr_auto_auto] gap-2">
            <UserCombox
              ref="userCombox"
              v-model="formData.userId"
              :users="userStore.items"
              :error="errors.userId"
              :required="true"
              @change="handleUserChange"
            />
            <button
              type="button"
              class="utility-btn m-0"
              :class="{ 'utility-btn-inactive': !formData.userId }"
              @click="clearUser"
              :disabled="!formData.userId"
            >
              <PhX class="" />
            </button>
            <button
              v-if="!isOffline"
              type="button"
              class="utility-btn m-0"
              @click="handleNewClientClick"
            >
              Nuevo Cliente
            </button>
          </div>
          <span v-if="errors.userId" class="text-danger text-sm">{{
            errors.userId
          }}</span>
        </div>

        <div
          class="grid gap-2"
          :class="features?.order?.timeOfDay ? 'grid-cols-2' : 'grid-cols-1'"
        >
          <div>
            <label for="preparation-date"
              >Fecha de
              {{
                features.order?.defaultDate &&
                features.order.defaultDate === "delivery"
                  ? "Entrega"
                  : "Preparación"
              }}</label
            >
            <input
              id="preparation-date"
              type="date"
              v-model="formData.preparationDate"
              name="preparation-date"
              class="w-full"
            />
            <span v-if="errors.preparationDate" class="text-danger text-sm">{{
              errors.preparationDate
            }}</span>
          </div>

          <div class="hidden">
            <label for="due-date">Fecha de Entrega</label>
            <input
              id="due-date"
              type="date"
              v-model="formData.dueDate"
              :min="formData.preparationDate"
              class="w-full"
            />
            <span v-if="errors.dueDate" class="text-danger text-sm">{{
              errors.dueDate
            }}</span>
          </div>

          <div :class="{ hidden: !features?.order?.timeOfDay }">
            <label for="due-time">Hora de Entrega</label>
            <input
              id="due-time"
              type="time"
              v-model="formData.dueTime"
              class="w-full"
            />
            <span v-if="errors.dueTime" class="text-danger text-sm">{{
              errors.dueTime
            }}</span>
          </div>
        </div>

        <div>
          <label for="payment-date">Fecha de Pago</label>
          <div class="grid grid-cols-[1fr_auto_auto] gap-2">
            <input
              id="payment-date"
              type="date"
              v-model="formData.paymentDate"
              class="w-full"
            />
            <button
              type="button"
              class="utility-btn m-0"
              :class="{ 'utility-btn-inactive': !formData.paymentDate }"
              @click="formData.paymentDate = null"
              :disabled="!formData.paymentDate"
            >
              <PhX class="" />
            </button>
            <button
              class="btn utility-btn m-0"
              type="button"
              @click="
                formData.paymentDate = new Date()
                  .toLocaleDateString('es-CO', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                  })
                  .split('/')
                  .reverse()
                  .join('-')
              "
            >
              Hoy
            </button>
          </div>

          <span v-if="errors.payemntDate" class="text-danger text-sm">{{
            errors.payemntDate
          }}</span>
        </div>

        <div
          class="grid grid-cols-[1fr_1fr] gap-2"
          :class="{ hidden: !features?.order?.allowPartialPayment }"
        >
          <div>
            <label>Valor Pago Parcial</label>
            <div class="grid grid-cols-[1fr] gap-2 items-center">
              <input
                type="number"
                v-model="formData.partialPaymentAmount"
                min="0"
                step="1"
                placeholder="0"
                class="w-full"
                @input="handlePartialAmountChange"
              />
            </div>
          </div>

          <div>
            <label>Fecha Pago Parcial</label>
            <div class="grid grid-cols-[1fr_auto] gap-2 items-center">
              <input
                type="date"
                v-model="formData.partialPaymentDate"
                class="w-full"
              />
              <button
                type="button"
                class="utility-btn m-0 self-stretch"
                :class="{
                  'utility-btn-inactive':
                    !formData.partialPaymentAmount &&
                    !formData.partialPaymentDate,
                }"
                @click="clearPartialPayment"
                :disabled="
                  !formData.partialPaymentAmount && !formData.partialPaymentDate
                "
              >
                <PhX class="" />
              </button>
            </div>
          </div>

          <span
            v-if="errors.partialPaymentAmount"
            class="text-danger text-sm col-span-2"
            >{{ errors.partialPaymentAmount }}</span
          >
        </div>
      </div>

      <NewClientDialog
        v-model:isOpen="isNewClientDialogOpen"
        @client-created="handleClientCreated"
      />

      <div class="base-card flex flex-col gap-2">
        <RadioButtonGroup
          v-model="formData.fulfillmentType"
          :options="fulfillmentTypes"
          name="fulfillment-type"
          label="Tipo de Envío"
        />

        <div v-if="formData.fulfillmentType === 'delivery'">
          <label for="delivery-address">Dirección de Entrega</label>
          <div class="grid grid-cols-[1fr_auto] gap-2">
            <input
              id="delivery-address"
              type="text"
              v-model="formData.deliveryAddress"
              class="w-full"
            />

            <div v-if="addressHasChanged">
              <input
                type="checkbox"
                id="update-address"
                v-model="formData.shouldUpdateClientAddress"
                class="sr-only peer"
              />
              <label
                for="update-address"
                class="utility-btn-inactive cursor-pointer py-1 px-2 rounded-md peer-checked:utility-btn-active peer-focus-visible:ring-2 peer-focus-visible:ring-black inline-block m-0"
              >
                Actualizar Cliente
              </label>
            </div>
          </div>
          <span v-if="errors.deliveryAddress" class="text-danger text-sm">{{
            errors.deliveryAddress
          }}</span>
        </div>

        <RadioButtonGroup
          v-if="formData.fulfillmentType === 'delivery'"
          v-model="selectedDeliveryFee"
          :options="deliveryFeeOptions"
          name="delivery-fee"
          label="Costo de Envío"
          has-custom-option
          custom-option-value="custom"
        >
          <template #custom-input>
            <input
              type="number"
              v-model="formData.deliveryFee"
              min="0"
              step="500"
              placeholder="Ingrese valor personalizado"
              class="mt-2 w-full"
            />
          </template>
        </RadioButtonGroup>

        <RadioButtonGroup
          v-model="formData.paymentMethod"
          :options="paymentMethodOptions"
          name="payment-method"
          label="Método de Pago"
        />
      </div>

      <div class="flex justify-end mb-2" v-if="showHistoryNavigation">
        <div
          class="inline-flex items-center gap-2 bg-neutral-50 p-1 rounded-lg border border-neutral-200"
        >
          <button
            type="button"
            @click="handlePrevOrder"
            :disabled="currentHistoryIndex === userHistory.length - 1"
            class="p-1 my-0 hover:bg-white rounded disabled:opacity-50 disabled:hover:bg-transparent"
          >
            <PhCaretLeft class="w-4 h-4 text-neutral-600" />
          </button>

          <span
            class="text-sm font-medium text-neutral-600 min-w-[60px] text-center"
          >
            {{
              formatOrderDate(
                userHistory[currentHistoryIndex].preparationDate
                  ? userHistory[currentHistoryIndex].preparationDate
                  : userHistory[currentHistoryIndex].dueDate
              )
            }}
          </span>

          <button
            type="button"
            @click="handleNextOrder"
            :disabled="currentHistoryIndex === 0"
            class="p-1 my-0 hover:bg-white rounded disabled:opacity-50 disabled:hover:bg-transparent"
          >
            <PhCaretRight class="w-4 h-4 text-neutral-600" />
          </button>
        </div>
      </div>

         <span v-if="errors.orderItems" class="text-danger text-sm">{{
            errors.orderItems
          }}</span>

      <OrderItemsManager
        v-model="formData.orderItems"
        :products="productStore.items"
      />

      <div class="base-card">
        <div>
          <label for="internal-notes">Comentarios Produccion</label>
          <textarea
            id="internal-notes"
            v-model="formData.internalNotes"
            class="w-full"
            rows="3"
          ></textarea>
        </div>
      </div>

      <div class="base-card">
        <div>
          <label for="delivery-notes">Comentarios Domicilio</label>
          <textarea
            id="delivery-notes"
            v-model="formData.deliveryNotes"
            class="w-full"
            rows="3"
          ></textarea>
        </div>
      </div>

      <div class="base-card">
        <div class="flex flex-col gap-1 mb-4">
          <div class="flex justify-between">
            <span>Subtotal:</span>
            <span>{{ formatMoney(subtotal) }}</span>
          </div>
          <div class="flex justify-between">
            <span>Envío:</span>
            <span>{{
              formData.fulfillmentType === "pickup"
                ? "$0"
                : formatMoney(formData.deliveryFee)
            }}</span>
          </div>
          <div class="flex justify-between font-bold">
            <span>Total:</span>
            <span>{{ formatMoney(total) }}</span>
          </div>
        </div>

        <div class="flex gap-2 justify-end">
          <button type="submit" :disabled="loading" class="action-btn">
            {{ loading ? loadingText : submitButtonText }}
          </button>
          <button
            type="button"
            @click="$emit('cancel')"
            :disabled="loading"
            class="utility-btn"
          >
            Cancelar
          </button>
        </div>
      </div>
    </form>
  </div>
</template>
