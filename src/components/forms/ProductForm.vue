<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useProductCollectionStore } from '@/stores/productCollectionStore';
import { useSystemSettingsStore } from '@/stores/systemSettingsStore';
import TemplateVariation from '@/components/TemplateVariation.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import YesNoToggle from '@/components/forms/YesNoToggle.vue';
import { cleanString, getVariationTypeLabel } from '@/utils/helpers';

const systemSettingsStore = useSystemSettingsStore();
const collectionStore = useProductCollectionStore();

const props = defineProps({
  title: {
    type: String,
    default: 'Crear Producto',
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

// Get all available unit options (shared between functions)
const getAllUnitOptions = () => {
  const fallbackOptions = [
    { symbol: 'Kg', name: 'Kilogram', type: 'weight', template: 'WEIGHT' },
    { symbol: 'g', name: 'Gram', type: 'weight', template: 'WEIGHT' },
    { symbol: 'L', name: 'Liter', type: 'volume', template: 'WEIGHT' },
    { symbol: 'ml', name: 'Milliliter', type: 'volume', template: 'WEIGHT' },
    { symbol: 'uds', name: 'Units', type: 'count', template: 'QUANTITY' },
    { symbol: 'docena', name: 'Dozen', type: 'count', template: 'QUANTITY' },
    { symbol: 'paquete', name: 'Package', type: 'count', template: 'QUANTITY' },
  ];

  return systemSettingsStore.isLoaded
    ? (systemSettingsStore.unitOptions || fallbackOptions)
    : fallbackOptions;
};

// Extract variation type and default unit from existing variations
const extractVariationSettings = (variations) => {
  if (!variations || variations.length === 0) {
    return { type: '', unit: 'g' };
  }

  // Get the type and unit from the first variation (all should be consistent)
  const firstVariation = variations[0];
  const extractedType = firstVariation.type || 'WEIGHT';
  const extractedUnit = firstVariation.unit || 'g';

  // Type defaults
  const typeDefaults = {
    'WEIGHT': 'g',
    'QUANTITY': 'uds',
    'SIZE': '',
  };

  // Check if the extracted unit exists in the available options for this type
  const allOptions = getAllUnitOptions();
  const validUnit = allOptions.some(option =>
    option.symbol === extractedUnit && option.template === extractedType,
  );

  return {
    type: extractedType,
    unit: validUnit ? extractedUnit : (typeDefaults[extractedType] || 'g'),
  };
};

// Form state
const formData = ref(
  props.initialData
    ? {
      ...props.initialData,
      variations: props.initialData.variations || [],
    }
    : {
      name: '',
      description: '',
      collectionId: '',
      collectionName: '',
      variations: [],
      taxPercentage: 0,
      isActive: true,
      basePrice: 0,
      customAttributes: {},
    },
);

const errors = ref({});

// Confirm dialog state
const confirmDialog = ref({
  isOpen: false,
  title: '',
  message: '',
  onConfirm: null,
});

// Extract variation settings from initial data if editing
const initialVariationSettings = props.initialData
  ? extractVariationSettings(props.initialData.variations)
  : { type: '', unit: 'g' };

// Variation management state
const variationType = ref(initialVariationSettings.type);
const defaultUnit = ref(initialVariationSettings.unit);
const hasWholeGrainVariations = ref(
  props.initialData?.variations?.some(v => v.isWholeGrain) || false,
);

// New variation template
const newVariation = ref({
  name: '',
  value: 0,
  basePrice: 0,
  unit: 'g',
  type: 'WEIGHT',
  isWholeGrain: false,
  displayOrder: 0,
});

// Debounce timer for proportional pricing
let proportionalPricingTimeout = null;

// Get available categories
const availableCategories = computed(() => {
  return collectionStore.items || [];
});

// Get selected category
const selectedCategory = computed(() => {
  if (!formData.value.collectionId) return null;
  return availableCategories.value.find(cat => cat.id === formData.value.collectionId);
});

// Check if selected category has variation templates
const categoryHasTemplates = computed(() => {
  return selectedCategory.value?.variationTemplates?.length > 0;
});

// Get system default templates
const systemDefaultTemplates = computed(() => {
  if (!systemSettingsStore.isLoaded) return {};
  return systemSettingsStore.defaultVariationTemplates;
});

// Get available unit options from system settings, filtered by template
const unitPillOptions = computed(() => {
  const allOptions = getAllUnitOptions();

  // Filter by the selected variation type
  const filtered = variationType.value
    ? allOptions.filter(unit => unit.template === variationType.value)
    : allOptions;

  // Transform to pill options format (value, label)
  return filtered.map(unit => ({
    value: unit.symbol,
    label: unit.symbol,
  }));
});

// Show unit selection when needed
const showUnitSelection = computed(() => {
  return variationType.value &&
         systemDefaultTemplates.value[variationType.value]?.unit;
});

// Reset variation template form
const resetVariationForm = () => {
  newVariation.value = {
    name: '',
    value: 0,
    basePrice: 0,
    unit: defaultUnit.value || 'g',
    type: variationType.value || 'WEIGHT',
    isWholeGrain: false,
    displayOrder: formData.value.variations.length,
  };
};

// Load system default templates
const loadSystemDefaultTemplates = () => {
  const type = variationType.value;
  if (!type || !systemDefaultTemplates.value[type]) return;

  const templates = systemDefaultTemplates.value[type].defaults.map((template, index) => ({
    name: template.name,
    value: template.value,
    basePrice: 0, // Products need pricing set
    unit: systemDefaultTemplates.value[type].unit || '',
    type: type,
    isWholeGrain: false,
    displayOrder: index,
  }));

  formData.value.variations = templates;

  // If whole grain variations are enabled, add integral versions
  if (hasWholeGrainVariations.value) {
    addWholeGrainVariations();
  } else {
    // Sort even if no whole grain variations for consistency
    sortVariationsInPairs();
  }
};

// Load category templates
const loadCategoryTemplates = () => {
  if (!selectedCategory.value?.variationTemplates?.length) return;

  const templates = selectedCategory.value.variationTemplates.map((template, index) => ({
    name: template.name,
    value: template.value,
    basePrice: 0, // Products need pricing set
    unit: template.unit || '',
    type: template.type || 'WEIGHT',
    isWholeGrain: template.isWholeGrain || false,
    displayOrder: index,
  }));

  formData.value.variations = templates;
  variationType.value = templates[0]?.type || 'WEIGHT';
  defaultUnit.value = templates[0]?.unit || 'g';

  // Sort variations to maintain pairing
  sortVariationsInPairs();
};

// Generate whole grain variation from regular variation
const createWholeGrainVariation = (regularVariation) => ({
  name: `${regularVariation.name} integral`,
  value: regularVariation.value,
  basePrice: regularVariation.basePrice,
  unit: regularVariation.unit,
  type: regularVariation.type,
  isWholeGrain: true,
  displayOrder: regularVariation.displayOrder,
});

// Add whole grain variations for all non-whole-grain variations
const addWholeGrainVariations = () => {
  const regularVariations = formData.value.variations.filter(v => !v.isWholeGrain && v.name !== 'otra');
  const wholeGrainVariations = regularVariations.map(createWholeGrainVariation);
  formData.value.variations.push(...wholeGrainVariations);

  // Sort to maintain pairing
  sortVariationsInPairs();
};

// Remove all whole grain variations
const removeWholeGrainVariations = () => {
  formData.value.variations = formData.value.variations.filter(v => !v.isWholeGrain);
};

// Sort variations to maintain pairing (regular, integral, regular, integral)
const sortVariationsInPairs = () => {
  const regularVariations = formData.value.variations.filter(v => !v.isWholeGrain);
  const sorted = [];

  regularVariations.forEach(regular => {
    sorted.push(regular);
    // Find corresponding integral variation
    const integral = formData.value.variations.find(
      v => v.isWholeGrain && v.name === `${regular.name} integral`,
    );
    if (integral) {
      sorted.push(integral);
    }
  });

  // Add any remaining integral variations that don't have a regular counterpart
  const remainingIntegrals = formData.value.variations.filter(
    v => v.isWholeGrain && !sorted.includes(v),
  );
  sorted.push(...remainingIntegrals);

  formData.value.variations = sorted;
};

// Calculate proportional prices based on reference variation
const calculateProportionalPrices = (referenceIndex, referencePrice) => {
  if (!referencePrice || !formData.value.variations.length) return;

  const referenceVariation = formData.value.variations[referenceIndex];
  if (!referenceVariation || !referenceVariation.value) return;

  const referenceValue = referenceVariation.value;
  const pricePerUnit = referencePrice / referenceValue;

  // Calculate proportional prices for variations that have zero prices
  formData.value.variations.forEach((variation, index) => {
    if (index !== referenceIndex && variation.value > 0 && variation.basePrice === 0) {
      const proportionalPrice = variation.value * pricePerUnit;
      // Round to nearest 100
      variation.basePrice = Math.round(proportionalPrice / 100) * 100;
    }
  });
};

// Debounced version of proportional pricing calculation
const debouncedProportionalPricing = (referenceIndex, referencePrice) => {
  // Clear existing timeout
  if (proportionalPricingTimeout) {
    clearTimeout(proportionalPricingTimeout);
  }

  // Set new timeout
  proportionalPricingTimeout = setTimeout(() => {
    calculateProportionalPrices(referenceIndex, referencePrice);
  }, 800);
};

// Add new variation
const addNewVariation = () => {
  if (!newVariation.value.name || !newVariation.value.value || newVariation.value.basePrice < 0) {
    return;
  }

  // Create a deep copy to avoid reference issues
  const baseVariation = {
    name: newVariation.value.name,
    value: newVariation.value.value,
    basePrice: newVariation.value.basePrice,
    unit: newVariation.value.unit,
    type: newVariation.value.type,
    isWholeGrain: false,
    displayOrder: newVariation.value.displayOrder,
  };

  formData.value.variations.push(baseVariation);

  // If whole grain variations are enabled, add integral version
  if (hasWholeGrainVariations.value) {
    const wholeGrainVariation = createWholeGrainVariation(baseVariation);
    formData.value.variations.push(wholeGrainVariation);
  }

  // Sort to maintain pairing
  sortVariationsInPairs();
  resetVariationForm();
};

// Update existing variation
const updateVariation = (index, payload) => {
  formData.value.variations[index][payload.field] = payload.value;

  // Trigger proportional pricing calculation if base price was updated
  if (payload.field === 'basePrice' && payload.value > 0) {
    debouncedProportionalPricing(index, payload.value);
  }
};

// Update new variation
const updateNewVariation = (payload) => {
  newVariation.value[payload.field] = payload.value;
};

// Remove variation
const removeVariation = (index) => {
  formData.value.variations.splice(index, 1);
};

// Handle category selection
const handleCategoryChange = () => {
  if (!formData.value.collectionId) {
    formData.value.collectionName = '';
    return;
  }

  const category = selectedCategory.value;
  if (category) {
    formData.value.collectionName = category.name;

    // Auto-load category templates if available
    if (category.variationTemplates?.length > 0) {
      variationType.value = 'CATEGORY_TEMPLATES';
      loadCategoryTemplates();
    } else {
      variationType.value = '';
      formData.value.variations = [];
    }
  }
};

// Handle variation type change
const handleVariationTypeChange = () => {
  if (formData.value.variations.length > 0) {
    confirmDialog.value = {
      isOpen: true,
      title: 'Cambiar tipo de variación',
      message: '¿Deseas cambiar el tipo de variación? Esto reemplazará las variaciones actuales.',
      onConfirm: () => {
        applyVariationTypeChange();
        confirmDialog.value.isOpen = false;
      },
    };
    return;
  }

  applyVariationTypeChange();
};

const applyVariationTypeChange = () => {
  if (variationType.value === 'CATEGORY_TEMPLATES') {
    loadCategoryTemplates();
  } else if (variationType.value) {
    loadSystemDefaultTemplates();
  } else {
    formData.value.variations = [];
  }
};

// Watch for unit changes and update all variations that use units
watch(() => defaultUnit.value, (newUnit) => {
  if (showUnitSelection.value) {
    formData.value.variations.forEach(variation => {
      if (variation.type === variationType.value) {
        variation.unit = newUnit;
      }
    });
    // Also update the new variation unit
    if (newVariation.value.type === variationType.value) {
      newVariation.value.unit = newUnit;
    }
  }
  // Always reset the variation form to ensure reactivity
  resetVariationForm();
});

// Watch for variation type change and auto-select default unit
watch(() => variationType.value, (newType) => {
  if (newType && newType !== 'CATEGORY_TEMPLATES' && systemDefaultTemplates.value[newType]?.unit) {
    defaultUnit.value = systemDefaultTemplates.value[newType].unit;
  }
  // Update the new variation type and unit
  newVariation.value.type = newType || 'WEIGHT';
  newVariation.value.unit = systemDefaultTemplates.value[newType]?.unit || '';
});

// Watch for whole grain variations toggle
watch(() => hasWholeGrainVariations.value, (newValue, oldValue) => {
  if (newValue) {
    // Add whole grain variations for existing variations
    addWholeGrainVariations();
  } else {
    // Remove all whole grain variations
    if (formData.value.variations.some(v => v.isWholeGrain)) {
      confirmDialog.value = {
        isOpen: true,
        title: 'Eliminar variaciones integrales',
        message: '¿Estás seguro de que deseas eliminar todas las variaciones integrales?',
        onConfirm: () => {
          removeWholeGrainVariations();
          confirmDialog.value.isOpen = false;
        },
      };
      // Revert the toggle until confirmed
      hasWholeGrainVariations.value = oldValue;
    }
  }
});

// Computed properties for button text
const submitButtonText = computed(() => {
  return props.initialData ? 'Actualizar Producto' : 'Crear Producto';
});

const loadingText = computed(() => {
  return props.initialData ? 'Actualizando...' : 'Creando...';
});

// Validation
const validate = () => {
  errors.value = {};

  if (!formData.value.name) {
    errors.value.name = 'Nombre es requerido';
  }
  if (formData.value.name.length < 3) {
    errors.value.name = 'Nombre debe tener al menos 3 caracteres';
  }
  if (!formData.value.collectionId) {
    errors.value.collectionId = 'Categoría es requerida';
  }

  // Validate base price if no variations exist
  if (formData.value.variations.length === 0) {
    if (!formData.value.basePrice || formData.value.basePrice <= 0) {
      errors.value.basePrice = 'Precio base es requerido para productos sin variaciones';
    }
  }

  // Validate variations if they exist
  if (formData.value.variations.length > 0) {
    formData.value.variations.forEach((variation, index) => {
      if (!variation.name) {
        errors.value[`variation_${index}_name`] = 'Nombre de variación es requerido';
      }
      if (!variation.value && variation.value !== 0) {
        errors.value[`variation_${index}_value`] = 'Valor de variación es requerido';
      }
      if (variation.basePrice < 0) {
        errors.value[`variation_${index}_price`] = 'Precio debe ser mayor o igual a 0';
      }
    });
  }

  return Object.keys(errors.value).length === 0;
};

const handleSubmit = () => {
  if (!validate()) return;

  formData.value.name = cleanString(formData.value.name);
  formData.value.description = cleanString(formData.value.description);

  emit('submit', formData.value);
};

const resetForm = () => {
  formData.value = {
    name: '',
    description: '',
    collectionId: '',
    collectionName: '',
    variations: [],
    taxPercentage: 0,
    isActive: true,
    basePrice: 0,
    customAttributes: {},
  };
  errors.value = {};
  variationType.value = '';
  defaultUnit.value = 'g';
  hasWholeGrainVariations.value = false;
  resetVariationForm();
};

// Load data on mount
onMounted(async () => {
  if (!collectionStore.isLoaded) {
    try {
      await collectionStore.fetchAll();
    } catch (error) {
      console.error('Failed to load product collections:', error);
    }
  }

  if (!systemSettingsStore.isLoaded) {
    try {
      await systemSettingsStore.fetchSettings();
    } catch (error) {
      console.error('Failed to load system settings:', error);
    }
  }

  // Reset variation form to ensure proper initialization
  resetVariationForm();
});

// Cleanup on unmount
onUnmounted(() => {
  if (proportionalPricingTimeout) {
    clearTimeout(proportionalPricingTimeout);
  }
});
</script>

<template>
  <div class="form-container">
    <h2>{{ title }}</h2>
    <form @submit.prevent="handleSubmit">
      <!-- Basic Information -->
      <div class="base-card">
        <!-- Name -->
        <div class="mb-4">
          <label
            for="name"
            class="block text-sm font-medium text-neutral-700 mb-1"
          >
            Nombre
          </label>
          <input
            id="name"
            type="text"
            v-model="formData.name"
            class="w-full px-3 py-2 border border-neutral-300 rounded-md"
            :class="{ 'border-danger': errors.name }"
            required
          />
          <span
            v-if="errors.name"
            class="text-sm text-danger mt-1"
          >
            {{ errors.name }}
          </span>
        </div>

        <!-- Description -->
        <div class="mb-4">
          <label
            for="description"
            class="block text-sm font-medium text-neutral-700 mb-1"
          >
            Descripción
          </label>
          <textarea
            id="description"
            v-model="formData.description"
            rows="3"
            class="w-full px-3 py-2 border border-neutral-300 rounded-md"
          />
        </div>

        <!-- Category Selection -->
        <div class="mb-4">
          <label
            for="collection"
            class="block text-sm font-medium text-neutral-700 mb-1"
          >
            Categoría
          </label>
          <select
            id="collection"
            v-model="formData.collectionId"
            @change="handleCategoryChange"
            class="w-full px-3 py-2 border border-neutral-300 rounded-md"
            :class="{ 'border-danger': errors.collectionId }"
            required
          >
            <option value="">Selecciona una categoría</option>
            <option
              v-for="category in availableCategories"
              :key="category.id"
              :value="category.id"
            >
              {{ category.name }}
            </option>
          </select>
          <span
            v-if="errors.collectionId"
            class="text-sm text-danger mt-1"
          >
            {{ errors.collectionId }}
          </span>
        </div>

        <!-- Tax Percentage -->
        <div class="mb-4">
          <label
            for="taxPercentage"
            class="block text-sm font-medium text-neutral-700 mb-1"
          >
            Porcentaje de Impuesto (%)
          </label>
          <input
            id="taxPercentage"
            type="number"
            v-model="formData.taxPercentage"
            class="w-full px-3 py-2 border border-neutral-300 rounded-md"
            min="0"
            max="100"
            step="0.01"
          />
        </div>

        <!-- Base Price -->
        <div class="mb-4">
          <label
            for="basePrice"
            class="block text-sm font-medium mb-1"
            :class="formData.variations.length > 0 ? 'text-neutral-400' : 'text-neutral-700'"
          >
            Precio ($)
          </label>
          <input
            id="basePrice"
            type="number"
            v-model="formData.basePrice"
            class="w-full px-3 py-2 border border-neutral-300 rounded-md"
            :class="{
              'border-danger': errors.basePrice,
              'bg-neutral-100 text-neutral-400 cursor-not-allowed': formData.variations.length > 0
            }"
            :disabled="formData.variations.length > 0"
            min="0"
            step="100"
            placeholder="0"
          />
          <span
            v-if="errors.basePrice"
            class="text-sm text-danger mt-1"
          >
            {{ errors.basePrice }}
          </span>
          <p v-if="formData.variations.length > 0" class="text-xs text-neutral-400 mt-1">
            Los precios se configuran en las variaciones del producto
          </p>
          <p v-else class="text-xs text-neutral-500 mt-1">
            Precio para productos sin variaciones
          </p>
        </div>

        <!-- Active Status -->
        <div class="mb-4">
          <YesNoToggle
            v-model="formData.isActive"
            label="Producto activo"
          />
        </div>
      </div>

      <!-- Variation Type Selection -->
      <div class="base-card">
        <div class="mb-6">
          <label class="block text-sm font-medium text-neutral-700 mb-1">
            Tipo de Variación
          </label>
          <div class="flex gap-1">
            <div class="relative flex-1">
              <input
                type="radio"
                id="variation-type-none"
                value=""
                name="variationType"
                v-model="variationType"
                @change="handleVariationTypeChange"
                class="sr-only peer"
              />
              <label
                for="variation-type-none"
                class="utility-btn-inactive cursor-pointer py-2 px-3 rounded-md peer-checked:utility-btn-active peer-focus-visible:ring-2 peer-focus-visible:ring-black w-full text-center block"
              >
                Sin variaciones
              </label>
            </div>
            <div class="relative flex-1">
              <input
                type="radio"
                id="variation-type-weight"
                value="WEIGHT"
                name="variationType"
                v-model="variationType"
                @change="handleVariationTypeChange"
                class="sr-only peer"
              />
              <label
                for="variation-type-weight"
                class="utility-btn-inactive cursor-pointer py-2 px-3 rounded-md peer-checked:utility-btn-active peer-focus-visible:ring-2 peer-focus-visible:ring-black w-full text-center block"
              >
                Peso / Volumen
              </label>
            </div>
            <div class="relative flex-1">
              <input
                type="radio"
                id="variation-type-quantity"
                value="QUANTITY"
                name="variationType"
                v-model="variationType"
                @change="handleVariationTypeChange"
                class="sr-only peer"
              />
              <label
                for="variation-type-quantity"
                class="utility-btn-inactive cursor-pointer py-2 px-3 rounded-md peer-checked:utility-btn-active peer-focus-visible:ring-2 peer-focus-visible:ring-black w-full text-center block"
              >
                Cantidad
              </label>
            </div>
            <div class="relative flex-1">
              <input
                type="radio"
                id="variation-type-size"
                value="SIZE"
                name="variationType"
                v-model="variationType"
                @change="handleVariationTypeChange"
                class="sr-only peer"
              />
              <label
                for="variation-type-size"
                class="utility-btn-inactive cursor-pointer py-2 px-3 rounded-md peer-checked:utility-btn-active peer-focus-visible:ring-2 peer-focus-visible:ring-black w-full text-center block"
              >
                Tamaño / Color
              </label>
            </div>
            <div
              v-if="categoryHasTemplates"
              class="relative flex-1"
            >
              <input
                type="radio"
                id="variation-type-category"
                value="CATEGORY_TEMPLATES"
                name="variationType"
                v-model="variationType"
                @change="handleVariationTypeChange"
                class="sr-only peer"
              />
              <label
                for="variation-type-category"
                class="utility-btn-inactive cursor-pointer py-2 px-3 rounded-md peer-checked:utility-btn-active peer-focus-visible:ring-2 peer-focus-visible:ring-black w-full text-center block"
              >
                Usar categoría
              </label>
            </div>
          </div>
          <p class="text-xs text-neutral-500 mt-1">
            Selecciona el tipo de variaciones que tendrá este producto
          </p>
        </div>

        <!-- Unit Selection for types that use units -->
        <div v-if="showUnitSelection" class="mb-4">
          <label class="block text-sm font-medium text-neutral-700 mb-1">
            Unidad por Defecto
          </label>
          <div class="flex gap-1">
            <div
              v-for="option in unitPillOptions"
              :key="option.value"
              class="relative flex-1"
            >
              <input
                type="radio"
                :id="`unit-${option.value}`"
                :value="option.value"
                name="defaultUnit"
                v-model="defaultUnit"
                class="sr-only peer"
              />
              <label
                :for="`unit-${option.value}`"
                class="utility-btn-inactive cursor-pointer py-2 px-3 rounded-md peer-checked:utility-btn-active peer-focus-visible:ring-2 peer-focus-visible:ring-black w-full text-center block"
              >
                {{ option.label }}
              </label>
            </div>
          </div>
          <p class="text-xs text-neutral-500 mt-1">
            Todas las variaciones de peso/volumen usarán esta unidad
          </p>
        </div>

        <!-- Whole Grain Variations Toggle -->
        <div v-if="variationType && variationType !== 'SIZE' && variationType !== 'CATEGORY_TEMPLATES'" class="mb-4">
          <YesNoToggle
            v-model="hasWholeGrainVariations"
            label="¿Este producto ofrece variaciones integrales?"
          />
          <p class="text-xs text-neutral-500 mt-1">
            Se creará automáticamente una versión integral para cada variación
          </p>
        </div>
      </div>

      <!-- Variations -->
      <div v-if="variationType || formData.variations.length > 0" class="base-card">
        <div class="flex justify-between items-center mb-4">
          <h4 class="text-lg font-medium text-neutral-800">Variaciones del Producto</h4>
          <span v-if="variationType" class="px-2 py-1 bg-primary-100 text-primary-800 rounded text-xs font-medium">
            {{ variationType === 'CATEGORY_TEMPLATES' ? 'Plantillas de Categoría' : getVariationTypeLabel(variationType) }}
          </span>
        </div>

        <!-- Variations List -->
        <div class="space-y-3">
          <!-- Existing Variations -->
          <TemplateVariation
            v-for="(variation, index) in formData.variations"
            :key="`variation-${index}-${variation.id || ''}-${variation.name}-${variation.isWholeGrain ? 'whole' : 'regular'}`"
            :template="variation"
            :is-new="false"
            :default-variation-type="variationType"
            :base-price="true"
            @remove="removeVariation(index)"
            @update="(payload) => updateVariation(index, payload)"
          />

          <!-- Add New Variation Form -->
          <TemplateVariation
            v-if="variationType && variationType !== 'CATEGORY_TEMPLATES'"
            :key="`new-variation-${defaultUnit}-${variationType}`"
            :template="newVariation"
            :is-new="true"
            :default-variation-type="variationType"
            :base-price="true"
            @add="addNewVariation"
            @update="(payload) => updateNewVariation(payload)"
          />
        </div>
      </div>

      <!-- Form Actions -->
      <div class="base-card">
        <div class="flex gap-2 justify-end">
          <button type="submit" :disabled="loading" class="action-btn">
            {{ loading ? loadingText : submitButtonText }}
          </button>
          <button
            type="button"
            @click="$emit('cancel')"
            :disabled="loading"
            class="danger-btn"
          >
            Cancelar
          </button>
        </div>
      </div>
    </form>

    <!-- Confirm Dialog -->
    <ConfirmDialog
      :is-open="confirmDialog.isOpen"
      :title="confirmDialog.title"
      :message="confirmDialog.message"
      confirm-text="Confirmar"
      cancel-text="Cancelar"
      @confirm="confirmDialog.onConfirm"
      @cancel="confirmDialog.isOpen = false"
    />
  </div>
</template>

<style scoped>
/* Remove browser default outlines from all form elements */
select {
  outline: none !important;
}

select:focus {
  outline: none !important;
}
</style>
