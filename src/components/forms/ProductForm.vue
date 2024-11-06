<script setup>
import { ref, defineProps, defineEmits, onMounted } from 'vue';
import { useRecipeStore } from '@/stores/recipeStore';

const recipeStore = useRecipeStore();

const props = defineProps({
  initialData: {
    type: Object,
    default: () => ({
      name: '',
      description: '',
      category: '',
      recipeId: '',
      variations: [],
      hasVariations: false,
      basePrice: 0,
      recipeMultiplier: 1,
      isActive: true,
    }),
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['submit', 'cancel']);

const formData = ref({ ...props.initialData });

const categoryOptions = [
  'Bread',
  'Pastry',
  'Cake',
  'Cookie',
  'Other',
];

const newVariation = ref({
  name: '',
  basePrice: 0,
  recipeMultiplier: 1,
});

const errors = ref({});

const validate = () => {
  errors.value = {};

  if (!formData.value.name) errors.value.name = 'Name is required';
  if (!formData.value.category) errors.value.category = 'Category is required';
  if (!formData.value.recipeId) errors.value.recipeId = 'Recipe is required';

  if (formData.value.hasVariations) {
    if (!formData.value.variations.length) {
      errors.value.variations = 'At least one variation is required';
    }

    if (formData.value.basePrice !== undefined) {
      errors.value.basePrice = 'Products with variations should not have a base price';
    }

    formData.value.variations.forEach((variation, index) => {
      if (!variation.name) {
        errors.value[`variation${index}Name`] = `Variation ${index + 1} requires a name`;
      }

      if (!variation.basePrice || variation.basePrice <= 0) {
        errors.value[`variation${index}Price`] = `Variation ${index + 1} requires a price greater than 0`;
      }

      if (!variation.recipeMultiplier || variation.recipeMultiplier <= 0) {
        errors.value[`variation${index}Multiplier`] = `Variation ${index + 1} requires a recipe multiplier greater than 0`;
      }
    });
  } else {
    if (!formData.value.basePrice || formData.value.basePrice <= 0) {
      errors.value.basePrice = 'Base price must be greater than 0';
    }

    if (!formData.value.recipeMultiplier || formData.value.recipeMultiplier <= 0) {
      errors.value.recipeMultiplier = 'Recipe multiplier must be greater than 0';
    }
  }

  return Object.keys(errors.value).length === 0;
};

const addVariation = () => {
  if (!newVariation.value.name || newVariation.value.basePrice <= 0 || newVariation.value.recipeMultiplier <= 0) {
    return;
  }

  formData.value.variations.push({
    ...newVariation.value,
    id: `var_${Date.now()}`,
  });

  newVariation.value = {
    name: '',
    basePrice: 0,
    recipeMultiplier: 1,
  };
};

const removeVariation = (index) => {
  formData.value.variations.splice(index, 1);
};

const toggleVariations = () => {
  formData.value.hasVariations = !formData.value.hasVariations;

  if (formData.value.hasVariations) {
    delete formData.value.basePrice;
    delete formData.value.recipeMultiplier;
  } else {
    formData.value.basePrice = 0;
    formData.value.recipeMultiplier = 1;
    formData.value.variations = [];
  }
};

const handleSubmit = () => {
  if (!validate()) return;

  emit('submit', {
    ...formData.value,
    updatedAt: new Date(),
    createdAt: formData.value.createdAt || new Date(),
  });
};

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
};

onMounted(async () => {
  console.log('Initial recipeStore items:', recipeStore.items);

  if (recipeStore.items.length === 0) {
    await recipeStore.fetchAll();
    console.log('Fetched recipeStore items:', recipeStore.items);
  }
});
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <!-- Basic Information -->
    <div>
      <h3>Basic Information</h3>

      <div>
        <label>
          Name *
          <input
            v-model="formData.name"
            type="text"
            required
          />
        </label>
        <span v-if="errors.name">{{ errors.name }}</span>
      </div>

      <div>
        <label>
          Description
          <textarea
            v-model="formData.description"
            rows="3"
          ></textarea>
        </label>
      </div>

      <div>
        <label>
          Category *
          <select
            v-model="formData.category"
            required
          >
            <option value="">Select category</option>
            <option
              v-for="category in categoryOptions"
              :key="category"
              :value="category"
            >
              {{ category }}
            </option>
          </select>
        </label>
        <span v-if="errors.category">{{ errors.category }}</span>
      </div>

      <div>
        <label>
          Recipe *
          <select
            v-model="formData.recipeId"
            required
          >
            <option value="">Select recipe</option>
            <option
              v-for="recipe in recipeStore.items"
              :key="recipe.id"
              :value="recipe.id"
            >
              {{ recipe.name }}
            </option>
          </select>
        </label>
        <span v-if="errors.recipeId">{{ errors.recipeId }}</span>
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            v-model="formData.isActive"
          />
          Product is active
        </label>
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            :checked="formData.hasVariations"
            @change="toggleVariations"
          />
          Has variations
        </label>
      </div>
    </div>

    <!-- Single Product Price -->
    <div v-if="!formData.hasVariations">
      <div>
        <label>
          Base Price *
          <input
            v-model.number="formData.basePrice"
            type="number"
            min="0"
            step="0.01"
            required
          />
        </label>
        <span v-if="errors.basePrice">{{ errors.basePrice }}</span>
      </div>

      <div>
        <label>
          Recipe Multiplier *
          <input
            v-model.number="formData.recipeMultiplier"
            type="number"
            min="0.1"
            step="0.1"
            required
          />
        </label>
        <span v-if="errors.recipeMultiplier">{{ errors.recipeMultiplier }}</span>
      </div>
    </div>

    <!-- Variations Section -->
    <div v-if="formData.hasVariations">
      <h3>Variations</h3>
      <span v-if="errors.variations">{{ errors.variations }}</span>

      <!-- Existing Variations -->
      <div v-if="formData.variations.length > 0">
        <div
          v-for="(variation, index) in formData.variations"
          :key="variation.id"
        >
          <div>
            <p>Name: {{ variation.name }}</p>
            <p>Base Price: {{ formatCurrency(variation.basePrice) }}</p>
            <p>Recipe Multiplier: {{ variation.recipeMultiplier }}</p>
          </div>
          <button
            type="button"
            @click="removeVariation(index)"
          >
            Remove
          </button>
          <span v-if="errors[`variation${index}Name`]">{{ errors[`variation${index}Name`] }}</span>
          <span v-if="errors[`variation${index}Price`]">{{ errors[`variation${index}Price`] }}</span>
          <span v-if="errors[`variation${index}Multiplier`]">{{ errors[`variation${index}Multiplier`] }}</span>
        </div>
      </div>

      <!-- Add New Variation -->
      <div>
        <h4>Add New Variation</h4>

        <div>
          <label>
            Name *
            <input
              v-model="newVariation.name"
              type="text"
            />
          </label>
        </div>

        <div>
          <label>
            Base Price *
            <input
              v-model.number="newVariation.basePrice"
              type="number"
              min="0"
              step="0.01"
            />
          </label>
        </div>

        <div>
          <label>
            Recipe Multiplier *
            <input
              v-model.number="newVariation.recipeMultiplier"
              type="number"
              min="0.1"
              step="0.1"
            />
          </label>
        </div>

        <button
          type="button"
          @click="addVariation"
          :disabled="!newVariation.name || newVariation.basePrice <= 0 || newVariation.recipeMultiplier <= 0"
        >
          Add Variation
        </button>
      </div>
    </div>

    <!-- Form Actions -->
    <div>
      <button
        type="button"
        @click="$emit('cancel')"
        :disabled="loading"
      >
        Cancel
      </button>
      <button
        type="submit"
        :disabled="loading"
      >
        {{ loading ? "Saving..." : "Save Product" }}
      </button>
    </div>
  </form>
</template>
