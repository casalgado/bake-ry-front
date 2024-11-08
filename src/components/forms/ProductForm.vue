<script setup>
import { ref, defineProps, defineEmits, onMounted } from 'vue';
import { useRecipeStore } from '@/stores/recipeStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';

const recipeStore = useRecipeStore();
const settingsStore = useBakerySettingsStore();

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
const errors = ref({});

const formData = ref({ ...props.initialData });
const settings = ref(null);
const selectedCategory = ref(null);
const variationInputs = ref({});

const handleCategoryChange = () => {
  selectedCategory.value = settings.value.productCategories.find(
    cat => cat.name === formData.value.category,
  );

  if (selectedCategory.value?.suggestedVariations) {
    variationInputs.value = selectedCategory.value.suggestedVariations.reduce((acc, variation) => {
      const existingVariation = formData.value.variations.find(v => v.name === variation.name);

      acc[variation.name] = existingVariation ? {
        value: existingVariation.value,
        basePrice: existingVariation.basePrice,
        recipeMultiplier: existingVariation.recipeMultiplier,
      } : {
        value: '',
        basePrice: 0,
        recipeMultiplier: 1,
      };

      return acc;
    }, {});

    formData.value.hasVariations = true;
  } else {
    formData.value.hasVariations = false;
    variationInputs.value = {};
  }
};

const validate = () => {
  errors.value = {};

  if (!formData.value.name) errors.value.name = 'Name is required';
  if (!formData.value.category) errors.value.category = 'Category is required';
  if (!formData.value.recipeId) errors.value.recipeId = 'Recipe is required';

  if (formData.value.hasVariations) {
    const hasFilledVariations = Object.values(variationInputs.value).some(
      v => v.value && v.basePrice > 0 && v.recipeMultiplier > 0,
    );

    if (!hasFilledVariations) {
      errors.value.variations = 'At least one variation must be completely filled out';
    }
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

const handleSubmit = () => {
  console.log('Submitting form data:', formData.value);
  if (!validate()) return;
  console.log('Form data is valid');
  if (formData.value.hasVariations) {
    formData.value.variations = Object.entries(variationInputs.value)
      .filter(([_, v]) => v.value && v.basePrice > 0 && v.recipeMultiplier > 0)
      .map(([name, v]) => ({
        name,
        value: v.value,
        basePrice: v.basePrice,
        recipeMultiplier: v.recipeMultiplier,
      }));
  }

  emit('submit', {
    ...formData.value,
  });
};

onMounted(async () => {
  if (recipeStore.items.length === 0) {
    await recipeStore.fetchAll();
  }

  settings.value = await settingsStore.fetchById('default');

  if (formData.value.category) {
    handleCategoryChange();
  }
});
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <!-- Basic Information -->
    {{ errors }}
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
          Category *
          <select
            v-model="formData.category"
            @change="handleCategoryChange"
            required
          >
            <option value="">Select category</option>
            <option
              v-for="category in settings?.productCategories"
              :key="category.id"
              :value="category.name"
            >
              {{ category.name }}
            </option>
          </select>
        </label>
        <span v-if="errors.category">{{ errors.category }}</span>
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
    </div>

    <!-- Show fields only if category is selected -->
    <template v-if="formData.category">
      <!-- Variations Section -->
      <div v-if="selectedCategory?.displayType">
        <h3>Variations</h3>
        <p>{{ selectedCategory.displayType === 'weight' ? 'Weight (g)' : 'Quantity' }}</p>
        <span v-if="errors.variations">{{ errors.variations }}</span>

        <div
          v-for="variation in selectedCategory.suggestedVariations"
          :key="variation.name"
          class="variation-input"
        >
          <h4>{{ variation.name }}</h4>

          <div>
            <label>
              {{ selectedCategory.displayType === 'weight' ? 'Weight (g)' : 'Quantity' }}
              <input
                v-model.number="variationInputs[variation.name].value"
                type="number"
                min="0"
                step="1"
              />
            </label>
          </div>

          <div>
            <label>
              Base Price
              <input
                v-model.number="variationInputs[variation.name].basePrice"
                type="number"
                min="0"
                step="1"
              />
            </label>
          </div>

          <div>
            <label>
              Recipe Multiplier
              <input
                v-model.number="variationInputs[variation.name].recipeMultiplier"
                type="number"
                min="0"
                step="0.1"
              />
            </label>
          </div>
        </div>
      </div>

      <!-- Single Product Price - only show if category selected and has no variations -->
      <div v-if="!selectedCategory?.displayType">
        <div>
          <label>
            Base Price *
            <input
              v-model.number="formData.basePrice"
              type="number"
              min="0"
              step="1"
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
              min="0"
              step="0.1"
              required
            />
          </label>
          <span v-if="errors.recipeMultiplier">{{ errors.recipeMultiplier }}</span>
        </div>
      </div>
    </template>

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
