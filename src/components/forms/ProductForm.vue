<script setup>
import { ref, defineProps, defineEmits, onMounted } from 'vue';
import { useRecipeStore } from '@/stores/recipeStore';
import { useProductCollectionStore } from '@/stores/productCollectionStore';

const recipeStore = useRecipeStore();
const productCollectionStore = useProductCollectionStore();

const props = defineProps({
  initialData: {
    type: Object,
    default: () => ({
      name: '',
      description: '',
      collection: '',
      recipeId: '',
      variations: [],
      hasVariations: false,
      basePrice: 0,
      recipeMultiplier: 1,
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
const selectedCollection = ref(null);
const variationInputs = ref({});

const handleCollectionChange = () => {
  selectedCollection.value = productCollectionStore.items.find(
    col => col.name === formData.value.collection,
  );

  if (selectedCollection.value?.displayType) {
    variationInputs.value = selectedCollection.value.suggestedVariations.reduce((acc, variation) => {
      const existingVariation = formData.value.variations.find(v => v.name === variation.name);

      acc[variation.name] = existingVariation ? {
        value: existingVariation.value,
        basePrice: existingVariation.basePrice,
        recipeMultiplier: existingVariation.recipeMultiplier,
      } : {
        value: variation.value || '',
        basePrice: 0,
        recipeMultiplier: variation.recipeMultiplier || 1,
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
  if (!formData.value.collection) errors.value.collection = 'Collection is required';
  if (!formData.value.recipeId) errors.value.recipeId = 'Recipe is required';

  if (selectedCollection.value?.displayType) {
    const filledVariations = Object.entries(variationInputs.value)
      .filter(([_, v]) => v.value && v.basePrice > 0 && v.recipeMultiplier > 0);

    if (filledVariations.length === 0) {
      errors.value.variations = 'At least one variation must be completely filled out';
    } else {
      filledVariations.forEach(([name, variation]) => {
        if (variation.value || variation.basePrice > 0 || variation.recipeMultiplier > 0) {
          if (!variation.value) {
            errors.value[`${name}_value`] = `${name}: ${selectedCollection.value.displayType === 'weight' ? 'Weight' : 'Quantity'} is required`;
          }
          if (!variation.basePrice || variation.basePrice <= 0) {
            errors.value[`${name}_price`] = `${name}: Base price must be greater than 0`;
          }
          if (!variation.recipeMultiplier || variation.recipeMultiplier <= 0) {
            errors.value[`${name}_multiplier`] = `${name}: Recipe multiplier must be greater than 0`;
          }
        }
      });
    }
  } else if (formData.value.collection) {
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
  if (!validate()) return;

  if (selectedCollection.value?.displayType) {
    formData.value.variations = Object.entries(variationInputs.value)
      .filter(([_, v]) => v.value && v.basePrice > 0 && v.recipeMultiplier > 0)
      .map(([name, v]) => ({
        name,
        value: v.value,
        basePrice: v.basePrice,
        recipeMultiplier: v.recipeMultiplier,
      }));
  } else {
    formData.value.variations = [];
  }

  emit('submit', {
    ...formData.value,
  });
};

onMounted(async () => {
  if (recipeStore.items.length === 0) {
    await recipeStore.fetchAll();
  }

  if (productCollectionStore.items.length === 0) {
    await productCollectionStore.fetchAll();
  }

  if (formData.value.collection) {
    handleCollectionChange();
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
        <span v-if="errors.name" class="error">{{ errors.name }}</span>
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
        <span v-if="errors.recipeId" class="error">{{ errors.recipeId }}</span>
      </div>

      <div>
        <label>
          Collection *
          <select
            v-model="formData.collection"
            @change="handleCollectionChange"
            required
          >
            <option value="">Select collection</option>
            <option
              v-for="collection in productCollectionStore.items"
              :key="collection.id"
              :value="collection.id"
            >
              {{ collection.name }}
            </option>
          </select>
        </label>
        <span v-if="errors.collection" class="error">{{ errors.collection }}</span>
      </div>
    </div>

    <!-- Show fields only if collection is selected -->
    <template v-if="formData.collection">
      <!-- Variations Section -->
      <div v-if="selectedCollection?.displayType">
        <h3>Variations</h3>
        <p>{{ selectedCollection.displayType === 'weight' ? 'Weight (g)' : 'Quantity' }}</p>
        <span v-if="errors.variations" class="error">{{ errors.variations }}</span>

        <div
          v-for="variation in selectedCollection.suggestedVariations"
          :key="variation.name"
          class="variation-input"
        >
          <h4>{{ variation.name }}</h4>

          <div>
            <label>
              {{ selectedCollection.displayType === 'weight' ? 'Weight (g)' : 'Quantity' }}
              <input
                v-model.number="variationInputs[variation.name].value"
                type="number"
                min="0"
                :step="selectedCollection.displayType === 'weight' ? '0.1' : '1'"
              />
            </label>
            <span v-if="errors[`${variation.name}_value`]" class="error">
              {{ errors[`${variation.name}_value`] }}
            </span>
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
            <span v-if="errors[`${variation.name}_price`]" class="error">
              {{ errors[`${variation.name}_price`] }}
            </span>
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
            <span v-if="errors[`${variation.name}_multiplier`]" class="error">
              {{ errors[`${variation.name}_multiplier`] }}
            </span>
          </div>
        </div>
      </div>

      <!-- Single Product Price -->
      <div v-if="!selectedCollection?.displayType">
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
          <span v-if="errors.basePrice" class="error">{{ errors.basePrice }}</span>
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
          <span v-if="errors.recipeMultiplier" class="error">{{ errors.recipeMultiplier }}</span>
        </div>
      </div>
    </template>

    <!-- Form Actions -->
    <div class="button-group">
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

<style scoped lang="scss">
.error {
  color: red;
  font-size: 0.875rem;
  margin-top: 4px;
}

.button-group {
  margin-top: 1rem;
  display: flex;
  gap: 0.5rem;
}

.variation-input {
  margin-bottom: 1rem;
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}
</style>
