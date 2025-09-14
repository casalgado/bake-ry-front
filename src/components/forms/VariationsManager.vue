<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import YesNoToggle from '@/components/forms/YesNoToggle.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import VariationCombinationManager from '@/components/forms/VariationCombinationManager.vue';
import { PhPlus, PhTrash, PhX } from '@phosphor-icons/vue';
import VariationGroups from '@/models/VariationGroups';
import { generateId, capitalize } from '@/utils/helpers';
import { useSystemSettingsStore } from '@/stores/systemSettingsStore';

const props = defineProps({
  initialVariations: {
    type: Object,
    default: () => ({ dimensions: [], combinations: [] }),
  },
  categoryTemplates: {
    type: Array,
    default: () => [],
  },
  productName: {
    type: String,
    default: '',
  },
  collectionId: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['update']);

// System settings store
const systemSettingsStore = useSystemSettingsStore();

// Core data structure - VariationGroups instance
const variationGroup = ref(new VariationGroups(props.initialVariations));

// UI State
const selectedDimensionTypes = ref([]);
const customDimensions = ref([]);
const newCustomDimension = ref({ label: '', value: '' });
const dimensionWholeGrainStatus = ref(new Map()); // Map of dimensionId -> boolean

// Fixed dimension types
const availableDimensionTypes = [
  { value: 'WEIGHT', label: 'Peso / Volumen' },
  { value: 'QUANTITY', label: 'Cantidad' },
  { value: 'SIZE', label: 'Tamaño' },
];

// Confirm dialog state
const confirmDialog = ref({
  isOpen: false,
  title: '',
  message: '',
  onConfirm: () => {},
  onCancel: () => {
    confirmDialog.value.isOpen = false;
  },
});

// Initialize from props if provided
onMounted(() => {
  if (props.initialVariations?.dimensions?.length > 0) {
    variationGroup.value = new VariationGroups(props.initialVariations);

    // Populate selected dimension types
    const types = variationGroup.value.dimensions.map(d => d.type);
    selectedDimensionTypes.value = [...new Set(types)];

    // Extract custom dimensions
    const standardTypes = ['WEIGHT', 'QUANTITY', 'SIZE'];
    const customTypes = types.filter(t => !standardTypes.includes(t));
    customDimensions.value = customTypes.map(type => {
      const dim = variationGroup.value.dimensions.find(d => d.type === type);
      return { value: type, label: dim?.label || type };
    });

    // Initialize wholegrain status from existing dimensions
    variationGroup.value.dimensions.forEach(dim => {
      const hasWholeGrain = variationGroup.value.dimensionHasWholeGrainOptions(dim.id);
      if (hasWholeGrain) {
        dimensionWholeGrainStatus.value.set(dim.id, true);
      }
    });
  }

  // Load system settings if not already loaded
  if (!systemSettingsStore.isLoaded) {
    systemSettingsStore.fetchSettings();
  }
});

// Dimension management functions
const toggleDimensionType = (type) => {
  const index = selectedDimensionTypes.value.indexOf(type);

  if (index > -1) {
    // Remove dimension type
    confirmDialog.value = {
      isOpen: true,
      title: 'Eliminar dimensión',
      message: '¿Estás seguro de eliminar esta dimensión? Se perderán todas las opciones y combinaciones asociadas.',
      onConfirm: () => {
        selectedDimensionTypes.value.splice(index, 1);
        removeDimensionFromVariations(type);
        confirmDialog.value.isOpen = false;
      },
      onCancel: () => {
        confirmDialog.value.isOpen = false;
      },
    };
  } else {
    // Add dimension type
    selectedDimensionTypes.value.push(type);
    addDimensionToVariations(type);
  }
};

const addDimensionToVariations = (type) => {
  const dimensionConfig = getDimensionConfig(type);
  const template = systemSettingsStore.defaultVariationTemplates[dimensionConfig.templateKey];

  // Create dimension with default options from template
  const options = template?.defaults?.map(opt => ({
    name: opt.name,
    value: opt.value,
    displayOrder: opt.displayOrder,
  })) || [];

  const dimensionId = variationGroup.value.addDimension(
    type,
    dimensionConfig.label,
    options,
    template?.unit || dimensionConfig.defaultUnit,
    variationGroup.value.dimensions.length,
    generateId(),
  );

  // Initialize wholegrain status for new dimension
  dimensionWholeGrainStatus.value.set(dimensionId, false);

  regenerateCombinations();
};

const removeDimensionFromVariations = (type) => {
  // Remove wholegrain status for dimensions of this type
  const dimensionsToRemove = variationGroup.value.dimensions.filter(d => d.type === type);
  dimensionsToRemove.forEach(dim => {
    dimensionWholeGrainStatus.value.delete(dim.id);
  });

  // Remove all dimensions of this type
  variationGroup.value.dimensions = variationGroup.value.dimensions.filter(d => d.type !== type);

  // If it's a custom dimension, remove it from the list
  const customIndex = customDimensions.value.findIndex(d => d.value === type);
  if (customIndex > -1) {
    customDimensions.value.splice(customIndex, 1);
  }

  regenerateCombinations();
};

const addCustomDimension = () => {
  const label = capitalize(newCustomDimension.value.label.trim());
  if (!label) return;
  // Generate a unique type identifier
  const type = `CUSTOM_${label.toUpperCase().replace(/\s+/g, '_')}_${Date.now()}`;

  // Add to custom dimensions list
  customDimensions.value.push({ value: type, label });

  // Add to selected types and create dimension
  selectedDimensionTypes.value.push(type);
  const dimensionId = variationGroup.value.addDimension(
    type,
    label,
    [],
    '',
    variationGroup.value.dimensions.length,
    generateId(),
  );

  // Initialize wholegrain status for new custom dimension
  dimensionWholeGrainStatus.value.set(dimensionId, false);

  // Clear input
  newCustomDimension.value.label = '';

  regenerateCombinations();
};

const addOptionToDimension = (dimensionId) => {
  const dimension = variationGroup.value.getDimensionById(dimensionId);
  if (!dimension) return;

  const newOption = {
    name: '',
    value: dimension.unit ? 0 : 1,
    displayOrder: dimension.options.length,
  };

  variationGroup.value.addOptionToDimension(dimensionId, newOption);
  regenerateCombinations();
};

const removeOptionFromDimension = (dimensionId, optionIndex) => {
  const dimension = variationGroup.value.getDimensionById(dimensionId);
  if (!dimension) return;

  dimension.options.splice(optionIndex, 1);
  regenerateCombinations();
};

// Combination management
const regenerateCombinations = () => {
  // Only regenerate if we have valid dimensions with options
  const hasValidDimensions = variationGroup.value.dimensions.every(
    d => d.options.length > 0 && d.options.every(o => o.name),
  );

  if (!hasValidDimensions) {
    variationGroup.value.combinations = [];
    return;
  }

  const allCombos = variationGroup.value.generateAllCombinations();

  // Preserve existing combination prices if they exist
  const existingPrices = {};
  variationGroup.value.combinations.forEach(combo => {
    const key = combo.selection.join('|');
    existingPrices[key] = {
      basePrice: combo.basePrice,
      costPrice: combo.costPrice,
    };
  });

  // Generate new combinations with wholegrain status
  const newCombinations = variationGroup.value.generateCombinationsWithWholeGrainStatus();

  // Apply existing prices to new combinations
  variationGroup.value.combinations = newCombinations.map(combo => {
    const key = combo.selection.join('|');
    const existing = existingPrices[key];

    return {
      ...combo,
      basePrice: existing?.basePrice || 0,
      costPrice: existing?.costPrice || 0,
    };
  });
};

const handleUpdateCombinationPrice = ({ combinationId, field, value }) => {
  const combination = variationGroup.value.findCombinationById(combinationId);
  if (combination) {
    combination[field] = value;
  }
};

// Helper functions
const getDimensionConfig = (type) => {
  const configs = {
    WEIGHT: {
      label: 'Peso / Volumen',
      templateKey: 'WEIGHT',
      defaultUnit: 'g',
    },
    QUANTITY: {
      label: 'Cantidad',
      templateKey: 'QUANTITY',
      defaultUnit: 'uds',
    },
    SIZE: {
      label: 'Tamaño',
      templateKey: 'SIZE',
      defaultUnit: '',
    },
  };

  // For custom dimensions
  const customDim = customDimensions.value.find(d => d.value === type);
  if (customDim) {
    return {
      label: customDim.label,
      templateKey: null,
      defaultUnit: '',
    };
  }

  return configs[type] || { label: type, templateKey: null, defaultUnit: '' };
};

const getUnitOptionsForDimension = (type) => {
  if (!systemSettingsStore.unitOptions) return [];

  // Map dimension types to unit types
  const unitTypeMap = {
    WEIGHT: ['weight', 'volume'],
    QUANTITY: ['count'],
    SIZE: [],
  };

  const allowedTypes = unitTypeMap[type] || [];
  if (allowedTypes.length === 0) return [];

  return systemSettingsStore.unitOptions
    .filter(unit => allowedTypes.includes(unit.type))
    .map(unit => ({
      value: unit.symbol,
      label: `${unit.name} (${unit.symbol})`,
    }));
};

// Wholegrain functionality
const getDimensionWholeGrainStatus = (dimensionId) => {
  return dimensionWholeGrainStatus.value.get(dimensionId) || false;
};

const toggleWholeGrainForDimension = (dimensionId, enabled) => {
  const hasWholeGrainOptions = variationGroup.value.dimensionHasWholeGrainOptions(dimensionId);

  if (enabled) {
    // Enable wholegrain variations
    dimensionWholeGrainStatus.value.set(dimensionId, true);
    variationGroup.value.addWholeGrainOptionsForDimension(dimensionId);
    regenerateCombinations();
  } else {
    // Disable wholegrain variations
    if (hasWholeGrainOptions) {
      confirmDialog.value = {
        isOpen: true,
        title: 'Eliminar variaciones integrales',
        message: '¿Estás seguro de que deseas eliminar todas las variaciones integrales de esta dimensión?',
        onConfirm: () => {
          dimensionWholeGrainStatus.value.set(dimensionId, false);
          variationGroup.value.removeWholeGrainOptionsFromDimension(dimensionId);
          regenerateCombinations();
          confirmDialog.value.isOpen = false;
        },
        onCancel: () => {
          confirmDialog.value.isOpen = false;
        },
      };
    } else {
      dimensionWholeGrainStatus.value.set(dimensionId, false);
    }
  }
};

// Watch for changes and emit updates
watch(
  variationGroup,
  (newVariationGroup) => {
    emit('update', newVariationGroup.toPlainObject());
  },
  { deep: true },
);

// Watch for dimension option changes to regenerate combinations
watch(
  () => variationGroup.value.dimensions,
  () => {
    // Debounce regeneration to avoid excessive updates
    clearTimeout(window.variationsDebounceTimer);
    window.variationsDebounceTimer = setTimeout(() => {
      const hasValidOptions = variationGroup.value.dimensions.every(
        d => d.options.length > 0 && d.options.every(o => o.name),
      );
      if (hasValidOptions) {
        regenerateCombinations();
      }
    }, 500);
  },
  { deep: true },
);
</script>

<template>
  <div class="variations-manager">
    <!-- Dimension Type Selection -->
    <div class="base-card mb-6">
      <h4 class="text-lg font-medium text-neutral-800 mb-4">
        Seleccionar Dimensiones de Variación
      </h4>
      <p class="text-sm text-neutral-600 mb-4">
        Selecciona una o más dimensiones para crear variaciones del producto.
        Por ejemplo, puedes combinar peso y sabor.
      </p>

      <div class="space-y-4">
        <!-- Fixed Dimension Types -->
        <div class="flex flex-wrap gap-2">
          <div
            v-for="dimensionType in availableDimensionTypes"
            :key="dimensionType.value"
            class="relative"
          >
            <input
              type="checkbox"
              :id="`dimension-${dimensionType.value}`"
              :value="dimensionType.value"
              :checked="selectedDimensionTypes.includes(dimensionType.value)"
              @change="toggleDimensionType(dimensionType.value)"
              class="sr-only peer"
            />
            <label
              :for="`dimension-${dimensionType.value}`"
              class="utility-btn-inactive cursor-pointer py-2 px-3 rounded-md peer-checked:utility-btn-active peer-focus-visible:ring-2 peer-focus-visible:ring-black text-center block"
            >
              {{ dimensionType.label }}
            </label>
          </div>
          <div
            v-for="customDim in customDimensions"
            :key="customDim.value"
            class="relative"
          >
            <input
              type="checkbox"
              :id="`dimension-${customDim.value}`"
              :value="customDim.value"
              :checked="selectedDimensionTypes.includes(customDim.value)"
              @change="toggleDimensionType(customDim.value)"
              class="sr-only peer"
            />
            <label
              :for="`dimension-${customDim.value}`"
              class="utility-btn-inactive cursor-pointer py-2 px-3 rounded-md peer-checked:utility-btn-active peer-focus-visible:ring-2 peer-focus-visible:ring-black text-center block"
            >
              {{ customDim.label }}
            </label>
          </div>
        </div>

        <!-- Add Custom Dimension Form -->
        <div class="border-t pt-4">
          <div class="flex gap-2 items-end">
            <div class="flex-1">
              <label class="block text-sm font-medium text-neutral-700 mb-1">
                Crear dimensión personalizada
              </label>
              <input
                type="text"
                v-model="newCustomDimension.label"
                placeholder="ej: Sabor, Color, Material..."
                class="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
                @keydown.enter.prevent="addCustomDimension"
              />
            </div>
            <button
              type="button"
              @click="addCustomDimension"
              :disabled="!newCustomDimension.label.trim()"
              class="utility-btn flex items-center gap-1 mb-1"
              :class="{
                'utility-btn-inactive':
                  !newCustomDimension.label.trim(),
              }"
            >
              <PhPlus class="w-4 h-4" />
              Agregar
            </button>
          </div>
          <p class="text-xs text-neutral-500 mt-1">
            Las dimensiones personalizadas te permiten crear variaciones
            específicas para tu producto
          </p>
        </div>
      </div>
    </div>

    <!-- Dimension Configuration -->
    <div
      v-for="dimension in variationGroup.dimensions"
      :key="dimension.id"
      class="base-card mb-6"
    >
      <div class="flex justify-between items-center mb-4">
        <h5 class="text-md font-medium text-neutral-800">
          {{ dimension.label }}
          <span v-if="dimension.unit" class="text-sm text-neutral-500"
            >({{ dimension.unit }})</span
          >
        </h5>
        <button
          type="button"
          @click="toggleDimensionType(dimension.type)"
          class="danger-btn-small flex items-center gap-1"
        >
          <PhTrash class="w-4 h-4" />
          Eliminar
        </button>
      </div>

      <!-- Unit Selection for dimensions that support it -->
      <div
        v-if="getUnitOptionsForDimension(dimension.type).length > 0"
        class="mb-4"
      >
        <label class="block text-sm font-medium text-neutral-700 mb-2"
          >Unidad</label
        >
        <div class="flex gap-1">
          <div
            v-for="unitOption in getUnitOptionsForDimension(dimension.type)"
            :key="unitOption.value"
            class="relative flex-1"
          >
            <input
              type="radio"
              :id="`unit-${dimension.id}-${unitOption.value}`"
              :value="unitOption.value"
              :name="`unit-${dimension.id}`"
              v-model="dimension.unit"
              class="sr-only peer"
            />
            <label
              :for="`unit-${dimension.id}-${unitOption.value}`"
              class="utility-btn-inactive cursor-pointer py-1 px-2 rounded-md peer-checked:utility-btn-active peer-focus-visible:ring-2 peer-focus-visible:ring-black w-full text-center block text-sm"
            >
              {{ unitOption.label }}
            </label>
          </div>
        </div>
      </div>

      <!-- Wholegrain Toggle -->
      <div class="mb-4">
        <YesNoToggle
          :model-value="getDimensionWholeGrainStatus(dimension.id)"
          @update:modelValue="(value) => toggleWholeGrainForDimension(dimension.id, value)"
          label="¿Ofrecer variaciones integrales para esta dimensión?"
        />
        <p class="text-xs text-neutral-500 mt-1">
          Se creará automáticamente una versión integral para cada opción
        </p>
      </div>

      <!-- Options List -->
      <div class="space-y-2 mb-4">
        <div
          v-for="(option, optionIndex) in dimension.options"
          :key="optionIndex"
          class="flex gap-3 items-center p-3 rounded-lg"
          :class="option.isWholeGrain ? 'bg-neutral-150' : 'bg-neutral-50'"
        >
          <div class="flex-1">
            <input
              type="text"
              v-model="option.name"
              placeholder="Nombre de la opción"
              class="w-full px-3 py-1 border border-neutral-300 rounded-md text-sm"
            />
          </div>

          <div v-if="dimension.unit" class="w-24">
            <input
              type="number"
              v-model="option.value"
              :placeholder="dimension.unit"
              class="w-full px-3 py-1 border border-neutral-300 rounded-md text-sm"
              min="0"
              step="1"
            />
          </div>

          <button
            type="button"
            @click="removeOptionFromDimension(dimension.id, optionIndex)"
            class="text-danger hover:text-danger-dark"
          >
            <PhX class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Add Option Button -->
      <button
        type="button"
        @click="addOptionToDimension(dimension.id)"
        class="utility-btn flex items-center gap-2"
      >
        <PhPlus class="w-4 h-4" />
        Agregar Opción
      </button>
    </div>

    <!-- Combinations/Prices Section -->
    <VariationCombinationManager
      :variation-group="variationGroup"
      @update-combination-price="handleUpdateCombinationPrice"
    />

    <!-- Empty State -->
    <div
      v-if="selectedDimensionTypes.length === 0"
      class="base-card text-center py-12"
    >
      <div class="text-neutral-500 mb-2">
        <PhPlus class="w-12 h-12 mx-auto mb-4 text-neutral-300" />
        <p class="text-lg font-medium">No hay dimensiones seleccionadas</p>
        <p class="text-sm mt-2">
          Selecciona al menos una dimensión arriba para comenzar a configurar
          las variaciones.
        </p>
      </div>
    </div>

    <!-- Confirm Dialog -->
    <ConfirmDialog
      :is-open="confirmDialog.isOpen"
      :title="confirmDialog.title"
      :message="confirmDialog.message"
      confirm-text="Confirmar"
      cancel-text="Cancelar"
      @confirm="confirmDialog.onConfirm"
      @cancel="confirmDialog.onCancel"
    />
  </div>
</template>

<style scoped>
/* Additional styles for better visual hierarchy */
.variations-manager {
  @apply space-y-6;
}
</style>
