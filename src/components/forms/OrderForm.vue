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

// Order item being edited
const currentItem = ref({
  productId: '',
  productName: '',
  productVariantId: '',
  quantity: 1,
  unitPrice: 0,
  isComplimentary: false,
});

// UI state
const errors = ref({});
const selectedProduct = ref(null);
const showAddItem = ref(false);

// Load products and users
onMounted(async () => {
  await Promise.all([
    productStore.fetchAll(),
    userStore.fetchAll(),
  ]);
});

// Computed properties
const availableVariations = computed(() => {
  if (!selectedProduct.value) return [];

  if (!selectedProduct.value.variations?.length) {
    // Return base product as single option if no variations
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
  return subtotal.value + (formData.value.fulfillmentType === 'delivery' ? formData.value.deliveryFee : 0);
});

// Methods
const handleProductSelect = (productId) => {
  selectedProduct.value = productStore.getById(productId);
  currentItem.value.productId = productId;
  currentItem.value.productName = selectedProduct.value.name;
};

const handleVariationSelect = (variation) => {
  currentItem.value.productVariantId = variation.id === 'base' ? null : variation.id;
  currentItem.value.unitPrice = variation.basePrice;
};

const addOrderItem = () => {
  formData.value.items.push({ ...currentItem.value });

  // Reset current item
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

const handleUserSelect = (userId) => {
  const user = userStore.getById(userId);
  formData.value.userId = userId;
  formData.value.userName = user.name;
};

const validate = () => {
  errors.value = {};

  if (!formData.value.userId) errors.value.userId = 'Client is required';
  if (!formData.value.items.length) errors.value.items = 'At least one item is required';
  if (!formData.value.preparationDate) errors.value.preparationDate = 'Preparation date is required';
  if (!formData.value.dueDate) errors.value.dueDate = 'Due date is required';

  if (new Date(formData.value.dueDate) < new Date(formData.value.preparationDate)) {
    errors.value.dueDate = 'Due date cannot be before preparation date';
  }

  if (formData.value.fulfillmentType === 'delivery' && !formData.value.deliveryAddress) {
    errors.value.deliveryAddress = 'Delivery address is required for delivery orders';
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
    <!-- Client Selection -->
    <div>
      <label>Client</label>
      <select v-model="formData.userId" @change="handleUserSelect($event.target.value)">
        <option value="">Select a client</option>
        <option v-for="user in userStore.items" :key="user.id" :value="user.id">
          {{ user.name }}
        </option>
      </select>
      <span v-if="errors.userId" class="error">{{ errors.userId }}</span>
    </div>

    <!-- Order Items -->
    <div>
      <h3>Order Items</h3>

      <div v-if="formData.items.length" class="items-list">
        <div v-for="(item, index) in formData.items" :key="index" class="item">
          <div>
            {{ item.productName }}
            {{ item.productVariantId ? '(Variant)' : '' }}
            x {{ item.quantity }}
          </div>
          <div v-if="!item.isComplimentary">
            {{ item.unitPrice * item.quantity }}
          </div>
          <div>
            <button type="button" @click="toggleItemComplimentary(index)">
              {{ item.isComplimentary ? 'Make Paid' : 'Make Complimentary' }}
            </button>
            <button type="button" @click="removeOrderItem(index)">Remove</button>
          </div>
        </div>
      </div>

      <button type="button" @click="showAddItem = true" v-if="!showAddItem">
        Add Item
      </button>

      <div v-if="showAddItem" class="add-item-form">
        <div>
          <label>Product</label>
          <select v-model="currentItem.productId" @change="handleProductSelect($event.target.value)">
            <option value="">Select a product</option>
            <option v-for="product in productStore.items" :key="product.id" :value="product.id">
              {{ product.name }}
            </option>
          </select>
        </div>

        <div v-if="selectedProduct">
          <label>Variation</label>
          <select v-model="currentItem.productVariantId" @change="handleVariationSelect($event.target.value)">
            <option value="">Select a variation</option>
            <option v-for="variation in availableVariations" :key="variation.id" :value="variation.id">
              {{ variation.name }} - {{ variation.basePrice }}
            </option>
          </select>
        </div>

        <div>
          <label>Quantity</label>
          <input type="number" v-model="currentItem.quantity" min="1" />
        </div>

        <div>
          <button type="button" @click="addOrderItem">Add</button>
          <button type="button" @click="showAddItem = false">Cancel</button>
        </div>
      </div>

      <span v-if="errors.items" class="error">{{ errors.items }}</span>
    </div>

    <!-- Dates -->
    <div>
      <div>
        <label>Preparation Date</label>
        <input type="date" v-model="formData.preparationDate" :min="tomorrowString" />
        <span v-if="errors.preparationDate" class="error">{{ errors.preparationDate }}</span>
      </div>

      <div>
        <label>Due Date</label>
        <input type="date" v-model="formData.dueDate" :min="formData.preparationDate" />
        <span v-if="errors.dueDate" class="error">{{ errors.dueDate }}</span>
      </div>
    </div>

    <!-- Fulfillment -->
    <div>
      <label>Fulfillment Type</label>
      <select v-model="formData.fulfillmentType">
        <option v-for="type in fulfillmentTypes" :key="type.value" :value="type.value">
          {{ type.label }}
        </option>
      </select>

      <template v-if="formData.fulfillmentType === 'delivery'">
        <div>
          <label>Delivery Address</label>
          <input type="text" v-model="formData.deliveryAddress" />
          <span v-if="errors.deliveryAddress" class="error">{{ errors.deliveryAddress }}</span>
        </div>

        <div>
          <label>Delivery Instructions</label>
          <textarea v-model="formData.deliveryInstructions"></textarea>
        </div>

        <div>
          <label>Delivery Fee</label>
          <input type="number" v-model="formData.deliveryFee" min="0" />
        </div>
      </template>
    </div>

    <!-- Payment -->
    <div>
      <label>Payment Method</label>
      <select v-model="formData.paymentMethod">
        <option v-for="method in paymentMethods" :key="method.value" :value="method.value">
          {{ method.label }}
        </option>
      </select>
    </div>

    <!-- Notes -->
    <div>
      <div>
        <label>Customer Notes</label>
        <textarea v-model="formData.customerNotes"></textarea>
      </div>

      <div>
        <label>Internal Notes</label>
        <textarea v-model="formData.internalNotes"></textarea>
      </div>
    </div>

    <!-- Totals -->
    <div class="totals">
      <div>Subtotal: {{ subtotal }}</div>
      <div v-if="formData.fulfillmentType === 'delivery'">Delivery Fee: {{ formData.deliveryFee }}</div>
      <div>Total: {{ total }}</div>
    </div>

    <!-- Form Actions -->
    <div class="actions">
      <button type="button" @click="$emit('cancel')" :disabled="loading">Cancel</button>
      <button type="submit" :disabled="loading">
        {{ loading ? 'Creating...' : 'Create Order' }}
      </button>
    </div>
  </form>
</template>

<style scoped lang="scss">
.items-list {
  margin: 1rem 0;

  .item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    border-bottom: 1px solid #ddd;
  }
}

.add-item-form {
  margin: 1rem 0;
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.totals {
  margin-top: 1rem;
  padding: 1rem;
  background-color: #f5f5f5;

  > div {
    margin: 0.5rem 0;
  }
}

.actions {
  margin-top: 1rem;
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.error {
  color: red;
  font-size: 0.875rem;
}
</style>
