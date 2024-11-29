<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { useProductStore } from '@/stores/productStore';
import { useBakeryUserStore } from '@/stores/bakeryUserStore';
import UserCombox from '@/components/forms/UserCombox.vue';
import OrderItemsManager from './OrderItemsManager.vue';
import NewClientDialog from './NewClientDialog.vue';
import RadioButtonGroup from './RadioButtonGroup.vue';

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
});

const emit = defineEmits(['submit', 'cancel']);

const productStore = useProductStore();
const userStore = useBakeryUserStore();
const isNewClientDialogOpen = ref(false);
const originalAddress = ref('');

// Get tomorrow's date
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const tomorrowString = tomorrow.toISOString().split('T')[0];

// Form state
const formData = ref(
  props.initialData || {
    userId: '',
    userName: '',
    userEmail: '',
    userPhone: '',
    orderItems: [],
    preparationDate: tomorrowString,
    dueDate: tomorrowString,
    fulfillmentType: 'delivery',
    deliveryAddress: '',
    deliveryFee: 7000,
    paymentMethod: 'cash',
    internalNotes: '',
    shouldUpdateClientAddress: false,
  },
);

const errors = ref({});

onMounted(async () => {
  await Promise.all([productStore.fetchAll(), userStore.fetchAll()]);

  // Initialize selected fee type if there's an initial value
  const matchingOption = deliveryFeeOptions.find(
    option => option.value === formData.value.deliveryFee,
  );
  if (matchingOption) {
    selectedFeeType.value = matchingOption.value;
  } else if (formData.value.deliveryFee) {
    selectedFeeType.value = 'custom';
  }

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
  formData.value.deliveryAddress = user.address;
  originalAddress.value = user.address;
  await nextTick();
  setTimeout(() => {
    const firstFulfillmentRadio = document.querySelector('input[name="fulfillment-type"]');
    if (firstFulfillmentRadio) {
      firstFulfillmentRadio.focus();
    }
  }, 0);
};

const addressHasChanged = computed(() => {
  return formData.value.deliveryAddress !== originalAddress.value
    && formData.value.deliveryAddress !== ''
    && originalAddress.value !== '';
});

const validate = () => {
  errors.value = {};

  if (!formData.value.userId) errors.value.userId = 'Cliente es requerido';
  if (!formData.value.orderItems.length) errors.value.orderItems = 'Se requiere al menos un producto';
  if (!formData.value.preparationDate) errors.value.preparationDate = 'Fecha de preparación es requerida';
  if (!formData.value.dueDate) errors.value.dueDate = 'Fecha de entrega es requerida';
  if (formData.value.fulfillmentType === 'delivery' && !formData.value.deliveryAddress) {
    errors.value.deliveryAddress = 'Dirección de entrega es requerida';
  }

  if (new Date(formData.value.dueDate) < new Date(formData.value.preparationDate)) {
    errors.value.dueDate = 'La fecha de entrega no puede ser anterior a la fecha de preparación';
  }

  return Object.keys(errors.value).length === 0;
};

const handleSubmit = () => {
  if (!validate()) return;
  emit('submit', formData.value);
};

const subtotal = computed(() => {
  return formData.value.orderItems.reduce((sum, item) => {
    return sum + (item.isComplimentary ? 0 : item.quantity * item.currentPrice);
  }, 0);
});

const total = computed(() => {
  return subtotal.value + formData.value.deliveryFee;
});

const paymentMethods = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'complementary', label: 'Regalo' },
];

const fulfillmentTypes = [
  { value: 'pickup', label: 'Recoger' },
  { value: 'delivery', label: 'Domicilio' },
];

const deliveryFeeOptions = [
  { value: 7000, label: '7,000' },
  { value: 8000, label: '8,000' },
  { value: 9000, label: '9,000' },
  { value: 10000, label: '10,000' },
  { value: 'custom', label: 'Otro' },
];

const selectedFeeType = ref(deliveryFeeOptions[0].value);

watch(selectedFeeType, (newValue) => {
  if (newValue !== 'custom') {
    formData.value.deliveryFee = newValue;
  }
});
</script>

<template>
  <div class="form-container">
    <h2>{{ title }}</h2>
    <form @submit.prevent="handleSubmit">
      <div class="base-card flex flex-col gap-2">
        <div>
          <label for="client-select">Cliente</label>
          <div class="grid grid-cols-[1fr_auto] gap-2">
            <UserCombox
              v-model="formData.userId"
              :users="userStore.items"
              :error="errors.userId"
              :required="true"
              @change="handleUserChange"
            />
            <button
              type="button"
              class="action-btn m-0"
              @click="handleNewClientClick"
            >
              Nuevo Cliente
            </button>
          </div>
          <span v-if="errors.userId">{{ errors.userId }}</span>
        </div>

        <div>
          <label for="preparation-date">Fecha de Preparación</label>
          <input
            id="preparation-date"
            type="date"
            v-model="formData.preparationDate"
            :min="tomorrowString"
          />
          <span v-if="errors.preparationDate">{{ errors.preparationDate }}</span>
        </div>

        <div>
          <label for="due-date">Fecha de Entrega</label>
          <input
            id="due-date"
            type="date"
            v-model="formData.dueDate"
            :min="formData.preparationDate"
          />
          <span v-if="errors.dueDate">{{ errors.dueDate }}</span>
        </div>
      </div>

      <NewClientDialog
        v-model:isOpen="isNewClientDialogOpen"
        @client-created="handleClientCreated"
      />

      <div class="base-card flex flex-col gap-2">

        <!-- Fulfillment Type Section -->
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
            <span v-if="errors.deliveryAddress">{{ errors.deliveryAddress }}</span>
          </div>
        </div>

        <RadioButtonGroup
          v-if="formData.fulfillmentType === 'delivery'"
          v-model="selectedFeeType"
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
          :options="paymentMethods"
          name="payment-method"
          label="Método de Pago"
        />
      </div>

      <OrderItemsManager
        v-model="formData.orderItems"
        :products="productStore.items"
      />

      <div class="base-card">
        <div>
          <label for="internal-notes">Comentarios</label>
          <textarea
            id="internal-notes"
            v-model="formData.internalNotes"
          ></textarea>
        </div>
      </div>

      <div class="base-card">
        <div>
          <div>Subtotal: {{ subtotal }}</div>
          <div>Envío: {{ formData.deliveryFee }}</div>
          <div>Total: {{ total }}</div>
        </div>

        <div class="flex gap-2">
          <button type="submit" :disabled="loading" class="action-btn">
            {{ loading ? 'Creando...' : 'Crear Pedido' }}
          </button>
          <button type="button" @click="$emit('cancel')" :disabled="loading" class="danger-btn">
            Cancelar
          </button>
        </div>
      </div>
    </form>
  </div>
</template>
