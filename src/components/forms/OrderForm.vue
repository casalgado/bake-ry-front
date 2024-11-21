<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useProductStore } from '@/stores/productStore';
import { useBakeryUserStore } from '@/stores/bakeryUserStore';
import UserCombox from '@/components/forms/UserCombox.vue';
import OrderItemsManager from './OrderItemsManager.vue';

const props = defineProps({
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
    items: [],
    preparationDate: tomorrowString,
    dueDate: tomorrowString,
    fulfillmentType: 'delivery',
    deliveryAddress: '',
    deliveryFee: 0,
    paymentMethod: 'cash',
    internalNotes: '',
  },
);

const errors = ref({});
onMounted(async () => {
  await Promise.all([productStore.fetchAll(), userStore.fetchAll()]);
});

const subtotal = computed(() => {
  return formData.value.items.reduce((sum, item) => {
    return sum + (item.isComplimentary ? 0 : item.quantity * item.unitPrice);
  }, 0);
});

const total = computed(() => {
  return subtotal.value + formData.value.deliveryFee;
});

const fulfillmentTypeInput = ref(null);

const handleUserChange = async (user) => {
  formData.value.userId = user.id;
  formData.value.userName = user.name;
  formData.value.userEmail = user.email;
  formData.value.userPhone = user.phone;
  formData.value.deliveryAddress = user.address;
  await nextTick();
  setTimeout(() => {
    console.log(fulfillmentTypeInput);
    fulfillmentTypeInput.value[0].focus();
  }, 0);
};

const validate = () => {
  errors.value = {};

  if (!formData.value.userId) errors.value.userId = 'Cliente es requerido';
  if (!formData.value.items.length) errors.value.items = 'Se requiere al menos un producto';
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

const paymentMethods = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
];

const fulfillmentTypes = [
  { value: 'pickup', label: 'Recoger' },
  { value: 'delivery', label: 'Domicilio' },
];
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <div class="base-card">
      <div>
        <label for="client-select">Cliente</label>
        <UserCombox
          v-model="formData.userId"
          :users="userStore.items"
          :error="errors.userId"
          :required="true"
          @change="handleUserChange"
        />
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

    <div class="base-card">
      <legend>Envio</legend>
      <div>
        <div v-for="type in fulfillmentTypes" :key="type.value">
          <input
            type="radio"
            :id="'fulfillment-' + type.value"
            :value="type.value"
            v-model="formData.fulfillmentType"
            ref="fulfillmentTypeInput"
          />
          <label :for="'fulfillment-' + type.value">{{ type.label }}</label>
        </div>
      </div>

      <div v-if="formData.fulfillmentType === 'delivery'">
        <label for="delivery-address">Dirección de Entrega</label>
        <input
          id="delivery-address"
          type="text"
          v-model="formData.deliveryAddress"
          ref="deliveryAddressInput"
        />
        <span v-if="errors.deliveryAddress">{{ errors.deliveryAddress }}</span>
      </div>

      <div v-if="formData.fulfillmentType === 'delivery'">
        <label for="delivery-fee">Costo de Envío</label>
        <input
          id="delivery-fee"
          type="number"
          v-model="formData.deliveryFee"
          min="0"
        />
      </div>
    </div>

    <div class="base-card">
      <legend>Pago</legend>
      <div>
        <div v-for="method in paymentMethods" :key="method.value">
          <input
            type="radio"
            :id="'payment-' + method.value"
            :value="method.value"
            v-model="formData.paymentMethod"
          />
          <label :for="'payment-' + method.value">{{ method.label }}</label>
        </div>
      </div>
    </div>

    <div class="base-card">
      <div>
        <label for="internal-notes">Comentarios</label>
        <textarea
          id="internal-notes"
          v-model="formData.internalNotes"
        ></textarea>
      </div>
    </div>

    <OrderItemsManager
      v-model="formData.items"
      :products="productStore.items"
    />

    <div class="base-card">
      <div>
        <div>Subtotal: {{ subtotal }}</div>
        <div>Envío: {{ formData.deliveryFee }}</div>
        <div>Total: {{ total }}</div>
      </div>

      <div>
        <button type="submit" :disabled="loading">
          {{ loading ? 'Creando...' : 'Crear Pedido' }}
        </button>
        <button type="button" @click="$emit('cancel')" :disabled="loading">
          Cancelar
        </button>
      </div>
    </div>
  </form>
</template>
