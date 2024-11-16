<script setup>
import { ref, computed, onMounted } from 'vue';
import { useProductStore } from '@/stores/productStore';
import { useBakeryUserStore } from '@/stores/bakeryUserStore';

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
const formData = ref(props.initialData || {
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
});

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
  await Promise.all([
    productStore.fetchAll(),
    userStore.fetchAll(),
  ]);
});

const availableVariations = computed(() => {
  if (!selectedProduct.value) return [];

  if (!selectedProduct.value.variations?.length) {
    return [{
      id: 'base',
      name: selectedProduct.value.name,
      basePrice: selectedProduct.value.basePrice,
    }];
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

  const variation = availableVariations.value.find(v => v.id === variationId);
  currentItem.value.productVariantId = variation.id === 'base' ? null : variation.id;
  currentItem.value.unitPrice = variation.basePrice;
};

const handleUserSelect = (userId) => {
  if (!userId) {
    formData.value.userId = '';
    formData.value.userName = '';
    formData.value.userEmail = '';
    formData.value.userPhone = '';
    formData.value.deliveryAddress = '';
    return;
  }

  const user = userStore.getById(userId);
  formData.value.userId = userId;
  formData.value.userName = user.name;
  formData.value.userEmail = user.email;
  formData.value.userPhone = user.phone;
  formData.value.deliveryAddress = user.address;
};

const addOrderItem = () => {
  errors.value.currentItem = '';

  if (!currentItem.value.productId) {
    errors.value.currentItem = 'Please select a product';
    return;
  }

  if (!currentItem.value.unitPrice) {
    errors.value.currentItem = 'Please select a variation';
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
  formData.value.items[index].isComplimentary = !formData.value.items[index].isComplimentary;
};

const validate = () => {
  errors.value = {};

  if (!formData.value.userId) errors.value.userId = 'Client is required';
  if (!formData.value.items.length) errors.value.items = 'At least one item is required';
  if (!formData.value.preparationDate) errors.value.preparationDate = 'Preparation date is required';
  if (!formData.value.dueDate) errors.value.dueDate = 'Due date is required';
  if (!formData.value.deliveryAddress) errors.value.deliveryAddress = 'Delivery address is required';

  if (new Date(formData.value.dueDate) < new Date(formData.value.preparationDate)) {
    errors.value.dueDate = 'Due date cannot be before preparation date';
  }

  return Object.keys(errors.value).length === 0;
};

const handleSubmit = () => {
  if (!validate()) return;
  emit('submit', formData.value);
};

const paymentMethods = [
  { value: 'cash', label: 'Cash' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'card', label: 'Card' },
];

const fulfillmentTypes = [
  { value: 'pickup', label: 'Pickup' },
  { value: 'delivery', label: 'Delivery' },
];
</script>

<template>
  <form @submit.prevent="handleSubmit">

    <div class="card-base">
      <div>
        <label for="client-select">Client</label>
        <select
          id="client-select"
          v-model="formData.userId"
          @change="handleUserSelect($event.target.value)"
        >
          <option value="">Select a client</option>
          <option v-for="user in userStore.items" :key="user.id" :value="user.id">
            {{ user.name }}
          </option>
        </select>
        <span v-if="errors.userId">{{ errors.userId }}</span>
      </div>
      <div>
        <label for="preparation-date">Preparation Date</label>
        <input
          id="preparation-date"
          type="date"
          v-model="formData.preparationDate"
          :min="tomorrowString"
        />
        <span v-if="errors.preparationDate">{{ errors.preparationDate }}</span>
      </div>

      <div>
        <label for="due-date">Due Date</label>
        <input
          id="due-date"
          type="date"
          v-model="formData.dueDate"
          :min="formData.preparationDate"
        />
        <span v-if="errors.dueDate">{{ errors.dueDate }}</span>
      </div>
    </div>

    <div class="card-base">
      <legend>Fulfillment Type</legend>
      <div>
        <div v-for="type in fulfillmentTypes" :key="type.value">
          <input
            type="radio"
            :id="'fulfillment-' + type.value"
            :value="type.value"
            v-model="formData.fulfillmentType"
          >
          <label :for="'fulfillment-' + type.value">{{ type.label }}</label>
        </div>
      </div>

      <div>
        <label for="delivery-address">Delivery Address</label>
        <input
          id="delivery-address"
          type="text"
          v-model="formData.deliveryAddress"
        />
        <span v-if="errors.deliveryAddress">{{ errors.deliveryAddress }}</span>
      </div>

      <div>
        <label for="delivery-instructions">Delivery Instructions</label>
        <textarea
          id="delivery-instructions"
          v-model="formData.deliveryInstructions"
        ></textarea>
      </div>

      <div>
        <label for="delivery-fee">Delivery Fee</label>
        <input
          id="delivery-fee"
          type="number"
          v-model="formData.deliveryFee"
          min="0"
        />
      </div>
    </div>

    <div class="card-base">
      <legend>Payment Method</legend>
      <div>
        <div v-for="method in paymentMethods" :key="method.value">
          <input
            type="radio"
            :id="'payment-' + method.value"
            :value="method.value"
            v-model="formData.paymentMethod"
          >
          <label :for="'payment-' + method.value">{{ method.label }}</label>
        </div>
      </div>
    </div>

    <div class="card-base">

      <div>
        <label for="internal-notes">Comentarios</label>
        <textarea
          id="internal-notes"
          v-model="formData.internalNotes"
        ></textarea>
      </div>
    </div>

    <div class="card-base">
      <h3>Order Items</h3>

      <div v-if="formData.items.length">
        <div v-for="(item, index) in formData.items" :key="index">
          <span>
            {{ item.productName }}
            {{ item.productVariantId ? '(Variant)' : '' }}
            x {{ item.quantity }}
          </span>
          <span v-if="!item.isComplimentary">
            {{ item.unitPrice * item.quantity }}
          </span>
          <button
            type="button"
            @click="toggleItemComplimentary(index)"
          >
            {{ item.isComplimentary ? 'Make Paid' : 'Make Complimentary' }}
          </button>
          <button
            type="button"
            @click="removeOrderItem(index)"
          >
            Remove
          </button>
        </div>
      </div>

      <button
        type="button"
        @click="showAddItem = true"
        v-if="!showAddItem"
      >
        Add Item
      </button>

      <div v-if="showAddItem">
        <div>
          <label for="product-select">Product</label>
          <select
            id="product-select"
            v-model="currentItem.productId"
            @change="handleProductSelect($event.target.value)"
          >
            <option value="">Select a product</option>
            <option v-for="product in productStore.items" :key="product.id" :value="product.id">
              {{ product.name }}
            </option>
          </select>
        </div>

        <div v-if="selectedProduct">
          <label for="variation-select">Variation</label>
          <select
            id="variation-select"
            v-model="currentItem.productVariantId"
            @change="handleVariationSelect($event.target.value)"
          >
            <option value="">Select a variation</option>
            <option v-for="variation in availableVariations" :key="variation.id" :value="variation.id">
              {{ variation.name }} - {{ variation.basePrice }}
            </option>
          </select>
        </div>

        <div>
          <label for="quantity-input">Quantity</label>
          <input
            id="quantity-input"
            type="number"
            v-model="currentItem.quantity"
            min="1"
          />
        </div>

        <span v-if="errors.currentItem">{{ errors.currentItem }}</span>

        <div>
          <button type="button" @click="addOrderItem">Add</button>
          <button type="button" @click="showAddItem = false">Cancel</button>
        </div>
      </div>

      <span v-if="errors.items">{{ errors.items }}</span>
    </div>

    <div class="card-base">
      <div>
        <div>Subtotal: {{ subtotal }}</div>
        <div>Delivery Fee: {{ formData.deliveryFee }}</div>
        <div>Total: {{ total }}</div>
      </div>

      <div>
        <button type="submit" :disabled="loading">
          {{ loading ? 'Creating...' : 'Create Order' }}
        </button>
        <button type="button" @click="$emit('cancel')" :disabled="loading">Cancel</button>

      </div>

    </div>

  </form>
</template>
