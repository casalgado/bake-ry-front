<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useProductStore } from '@/stores/productStore';
import { useBakeryUserStore } from '@/stores/bakeryUserStore';
import UserCombox from '@/components/forms/UserCombox.vue';

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
    deliveryInstructions: '',
    deliveryFee: 0,
    paymentMethod: 'cash',
    customerNotes: '',
    internalNotes: '',
  }
);

const currentItem = ref({
  productId: '',
  productName: '',
  productVariantId: '',
  quantity: 1,
  unitPrice: 0,
  isComplimentary: false,
});

const errors = ref({});
const selectedProduct = ref(null);
const showAddItem = ref(false);

onMounted(async () => {
  await Promise.all([productStore.fetchAll(), userStore.fetchAll()]);
});

const availableVariations = computed(() => {
  if (!selectedProduct.value) return [];

  if (!selectedProduct.value.variations?.length) {
    return [
      {
        id: 'base',
        name: selectedProduct.value.name,
        basePrice: selectedProduct.value.basePrice,
      },
    ];
  }

  return selectedProduct.value.variations;
});

const subtotal = computed(() => {
  return formData.value.items.reduce((sum, item) => {
    return sum + (item.isComplimentary ? 0 : item.quantity * item.unitPrice);
  }, 0);
});

const total = computed(() => {
  return subtotal.value + formData.value.deliveryFee;
});

const handleProductSelect = (productId) => {
  if (!productId) {
    selectedProduct.value = null;
    currentItem.value.productId = '';
    currentItem.value.productName = '';
    currentItem.value.unitPrice = 0;
    return;
  }

  selectedProduct.value = productStore.getById(productId);
  currentItem.value.productId = productId;
  currentItem.value.productName = selectedProduct.value.name;
};

const handleVariationSelect = (variationId) => {
  if (!variationId) {
    currentItem.value.productVariantId = '';
    currentItem.value.unitPrice = 0;
    return;
  }

  const variation = availableVariations.value.find((v) => v.id === variationId);
  currentItem.value.productVariantId =
    variation.id === 'base' ? null : variation.id;
  currentItem.value.unitPrice = variation.basePrice;
};

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

const addOrderItem = () => {
  errors.value.currentItem = '';

  if (!currentItem.value.productId) {
    errors.value.currentItem = 'Por favor seleccione un producto';
    return;
  }

  if (!currentItem.value.unitPrice) {
    errors.value.currentItem = 'Por favor seleccione una variación';
    return;
  }

  formData.value.items.push({ ...currentItem.value });

  currentItem.value = {
    productId: '',
    productName: '',
    productVariantId: '',
    quantity: 1,
    unitPrice: 0,
    isComplimentary: false,
  };

  selectedProduct.value = null;
  showAddItem.value = false;
};

const removeOrderItem = (index) => {
  formData.value.items.splice(index, 1);
};

const toggleItemComplimentary = (index) => {
  formData.value.items[index].isComplimentary =
    !formData.value.items[index].isComplimentary;
};

const validate = () => {
  errors.value = {};

  if (!formData.value.userId) errors.value.userId = 'Cliente es requerido';
  if (!formData.value.items.length)
    errors.value.items = 'Se requiere al menos un producto';
  if (!formData.value.preparationDate)
    errors.value.preparationDate = 'Fecha de preparación es requerida';
  if (!formData.value.dueDate)
    errors.value.dueDate = 'Fecha de entrega es requerida';
  if (!formData.value.deliveryAddress)
    errors.value.deliveryAddress = 'Dirección de entrega es requerida';

  if (
    new Date(formData.value.dueDate) < new Date(formData.value.preparationDate)
  ) {
    errors.value.dueDate =
      'La fecha de entrega no puede ser anterior a la fecha de preparación';
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
      <div v-if="formData.fulfillmentType == 'delivery'">
        <label for="delivery-address">Dirección de Entrega</label>
        <input
          id="delivery-address"
          type="text"
          v-model="formData.deliveryAddress"
          ref="deliveryAddressInput"
        />
        <span v-if="errors.deliveryAddress">{{ errors.deliveryAddress }}</span>
      </div>

      <div v-if="formData.fulfillmentType == 'delivery'">
        <label for="delivery-fee">Costo de Envío</label>
        <input
          id="delivery-fee"
          type="number"
          v-model="formData.deliveryFee"
          min="0"
        />
      </div>

      <!-- <div>
        <label for="delivery-instructions">Instrucciones de Entrega</label>
        <textarea
          id="delivery-instructions"
          v-model="formData.deliveryInstructions"
        ></textarea>
      </div> -->
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

    <div class="base-card">
      <h3>Productos</h3>

      <div v-if="formData.items.length">
        <div v-for="(item, index) in formData.items" :key="index">
          <span>
            {{ item.productName }}
            {{ item.productVariantId ? '(Variante)' : '' }}
            x {{ item.quantity }}
          </span>
          <span v-if="!item.isComplimentary">
            {{ item.unitPrice * item.quantity }}
          </span>
          <button type="button" @click="toggleItemComplimentary(index)">
            {{ item.isComplimentary ? 'Hacer Pagado' : 'Hacer Cortesía' }}
          </button>
          <button type="button" @click="removeOrderItem(index)">
            Eliminar
          </button>
        </div>
      </div>

      <button type="button" @click="showAddItem = true" v-if="!showAddItem">
        Agregar Producto
      </button>

      <div v-if="showAddItem">
        <div>
          <label for="product-select">Producto</label>
          <select
            id="product-select"
            v-model="currentItem.productId"
            @change="handleProductSelect($event.target.value)"
          >
            <option value="">Seleccionar producto</option>
            <option
              v-for="product in productStore.items"
              :key="product.id"
              :value="product.id"
            >
              {{ product.name }}
            </option>
          </select>
        </div>

        <div v-if="selectedProduct">
          <label for="variation-select">Variación</label>
          <select
            id="variation-select"
            v-model="currentItem.productVariantId"
            @change="handleVariationSelect($event.target.value)"
          >
            <option value="">Seleccionar variación</option>
            <option
              v-for="variation in availableVariations"
              :key="variation.id"
              :value="variation.id"
            >
              {{ variation.name }} - {{ variation.basePrice }}
            </option>
          </select>
        </div>

        <div>
          <label for="quantity-input">Cantidad</label>
          <input
            id="quantity-input"
            type="number"
            v-model="currentItem.quantity"
            min="1"
          />
        </div>

        <span v-if="errors.currentItem">{{ errors.currentItem }}</span>

        <div>
          <button type="button" @click="addOrderItem">Agregar</button>
          <button type="button" @click="showAddItem = false">Cancelar</button>
        </div>
      </div>

      <span v-if="errors.items">{{ errors.items }}</span>
    </div>

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
