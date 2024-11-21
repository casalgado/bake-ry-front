<script setup>
import { ref, computed } from 'vue';
import ProductWizard from '@/components/forms/ProductWizard.vue';

const props = defineProps({
  modelValue: {
    type: Array,
    required: true,
    default: () => [],
  },
  products: {
    type: Array,
    required: true,
    default: () => [],
  },
});

const emit = defineEmits(['update:modelValue']);

const errors = ref({});

const subtotal = computed(() => {
  return props.modelValue.reduce((sum, item) => {
    return sum + (item.isComplimentary ? 0 : item.quantity * item.unitPrice);
  }, 0);
});

const handleWizardSelect = (selection) => {
  const product = props.products.find(p => p.id === selection.product);
  if (!product) return;

  const newItem = {
    productId: selection.product,
    productName: product.name,
    quantity: 1,
    unitPrice: selection.variation ? selection.variation.basePrice : product.basePrice,
    isComplimentary: false,
    category: selection.category,
    variation: selection.variation ? selection.variation.name : null,
  };

  emit('update:modelValue', [...props.modelValue, newItem]);
};

const removeItem = (index) => {
  const newItems = [...props.modelValue];
  newItems.splice(index, 1);
  emit('update:modelValue', newItems);
};

const toggleItemComplimentary = (index) => {
  const newItems = [...props.modelValue];
  newItems[index].isComplimentary = !newItems[index].isComplimentary;
  emit('update:modelValue', newItems);
};
</script>

<template>
  <div class="base-card grid grid-cols-3 gap-x-3">
    <ProductWizard
      @select="handleWizardSelect"
      :products="products"
    />

    <div class="flat-card col-span-2 mb-0">
      <div v-if="modelValue.length === 0" class="text-gray-500">
        No hay productos seleccionados
      </div>

      <div
        v-for="(item, index) in modelValue"
        :key="`${item.productId}-${index}`"
        class="flex justify-between items-center p-2 border-b last:border-b-0"
      >
        <div>
          <div class="font-medium">{{ item.productName }}</div>
          <div class="text-sm text-gray-600">
            {{ item.category }}
            {{ item.variation ? `- ${item.variation}` : '' }}
          </div>
          <div class="text-sm">
            {{ item.quantity }} x {{ item.unitPrice }}
          </div>
        </div>

        <div class="flex gap-2">
          <button
            type="button"
            @click="toggleItemComplimentary(index)"
            :class="{'opacity-50': item.isComplimentary}"
          >
            {{ item.isComplimentary ? 'Cortesía' : 'Cobrar' }}
          </button>
          <button
            type="button"
            @click="removeItem(index)"
            class="text-red-500"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
