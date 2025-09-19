<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import YesNoToggle from '@/components/forms/YesNoToggle.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import VariationCombinationManager from '@/components/forms/VariationCombinationManager.vue';
import { PhPlus, PhTrash, PhX, PhCaretUp, PhCaretDown } from '@phosphor-icons/vue';
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
  isCategoryTemplateMode: {
    type: Boolean,
    default: false,
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
const optionPositionDropdowns = ref(new Map()); // Map of optionKey -> boolean for dropdown visibility

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

    // Normalize display orders on mount
    variationGroup.value.dimensions.forEach(dim => {
      variationGroup.value.normalizeOptionDisplayOrders(dim.id);
    });
    variationGroup.value.normalizeDimensionDisplayOrders();
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
      title: 'Eliminar variación',
      message: '¿Estás seguro de eliminar esta variación? Se perderán todas las opciones y combinaciones asociadas.',
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
  variationGroup.value.normalizeOptionDisplayOrders(dimensionId);
  regenerateCombinations();
};

const removeOptionFromDimension = (dimensionId, optionIndex) => {
  const dimension = variationGroup.value.getDimensionById(dimensionId);
  if (!dimension) return;

  dimension.options.splice(optionIndex, 1);
  variationGroup.value.normalizeOptionDisplayOrders(dimensionId);
  regenerateCombinations();
};

// Combination management
const regenerateCombinations = () => {
  // Skip combination generation in category template mode
  if (props.isCategoryTemplateMode) {
    return;
  }
  console.log('XXX - Regenerating combinations...');
  console.log('existing combinations before regen:', variationGroup.value.combinations);

  // Only regenerate if we have valid dimensions with options
  const hasValidDimensions = variationGroup.value.dimensions.every(
    d => d.options.length > 0 && d.options.every(o => o.name),
  );

  if (!hasValidDimensions) {
    return;
  }

  // Preserve existing combination data with more information for smart matching
  const existingCombinations = {};
  variationGroup.value.combinations.forEach(combo => {
    existingCombinations[combo.name] = {
      basePrice: combo.basePrice,
      costPrice: combo.costPrice,
      selection: combo.selection,
    };
  });
  console.log('Existing combinations map:', existingCombinations);

  // Generate new combinations with wholegrain status
  const newCombinations = variationGroup.value.generateCombinationsWithWholeGrainStatus();

  console.log('Generated combinations:', newCombinations);

  const updatedCombinations = newCombinations.map(combo => {
    let matchedCombination = null;

    // Try exact name match first (for unchanged combinations)
    matchedCombination = existingCombinations[combo.name];

    // If no exact match, try partial matching based on primary dimensions
    if (!matchedCombination) {
      let bestMatch = null;
      let bestMatchCount = 0;

      for (const [oldName, oldData] of Object.entries(existingCombinations)) {
        // Count how many primary dimension values match
        const sharedPrimaryValues = oldData.selection.filter(item => {
          // Check if this item is from a primary dimension (WEIGHT, QUANTITY, SIZE)
          const dim = variationGroup.value.getDimensionForOption(item);
          return dim && ['WEIGHT', 'QUANTITY', 'SIZE'].includes(dim.type) &&
                 combo.selection.includes(item);
        });

        if (sharedPrimaryValues.length > bestMatchCount) {
          bestMatch = oldData;
          bestMatchCount = sharedPrimaryValues.length;
          console.log(`Found better match: "${oldName}" -> "${combo.name}" (${bestMatchCount} shared primary values: ${sharedPrimaryValues.join(', ')})`);
        }
      }

      if (bestMatch) {
        matchedCombination = bestMatch;
      }
    }

    return {
      ...combo,
      basePrice: matchedCombination?.basePrice || 0,
      costPrice: matchedCombination?.costPrice || 0,
    };
  });

  console.log('Updated combinations with prices:', updatedCombinations);
  // Apply existing prices to new combinations
  variationGroup.value.combinations = updatedCombinations;
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
    variationGroup.value.normalizeOptionDisplayOrders(dimensionId);
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
          variationGroup.value.normalizeOptionDisplayOrders(dimensionId);
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

// Option ordering functions
const moveOptionUp = (dimensionId, optionName) => {
  // Use the VariationGroups method which should handle the update
  variationGroup.value.moveOptionUpDown(dimensionId, optionName, 'up');

  // Force a complete re-creation to trigger reactivity
  const plainObj = variationGroup.value.toPlainObject();
  variationGroup.value = new VariationGroups(plainObj);

  regenerateCombinations();
};

const moveOptionDown = (dimensionId, optionName) => {
  // Use the VariationGroups method which should handle the update
  variationGroup.value.moveOptionUpDown(dimensionId, optionName, 'down');

  // Force a complete re-creation to trigger reactivity
  const plainObj = variationGroup.value.toPlainObject();
  variationGroup.value = new VariationGroups(plainObj);

  regenerateCombinations();
};

const moveOptionToPosition = (dimensionId, optionName, newPosition) => {
  // Use the VariationGroups method which should handle the update
  variationGroup.value.moveOptionToPosition(dimensionId, optionName, newPosition);

  // Force a complete re-creation to trigger reactivity
  const plainObj = variationGroup.value.toPlainObject();
  variationGroup.value = new VariationGroups(plainObj);

  regenerateCombinations();

  // Close the dropdown
  const key = `${dimensionId}-${optionName}`;
  optionPositionDropdowns.value.set(key, false);
};

const togglePositionDropdown = (dimensionId, optionName) => {
  const key = `${dimensionId}-${optionName}`;
  const currentState = optionPositionDropdowns.value.get(key) || false;

  // Close all other dropdowns
  optionPositionDropdowns.value.forEach((value, k) => {
    if (k !== key) {
      optionPositionDropdowns.value.set(k, false);
    }
  });

  // Toggle current dropdown
  optionPositionDropdowns.value.set(key, !currentState);
};

const isPositionDropdownOpen = (dimensionId, optionName) => {
  const key = `${dimensionId}-${optionName}`;
  return optionPositionDropdowns.value.get(key) || false;
};

// Dimension ordering functions
const moveDimensionUp = (dimensionId) => {
  variationGroup.value.moveDimensionUpDown(dimensionId, 'up');

  // Force a complete re-creation to trigger reactivity
  const plainObj = variationGroup.value.toPlainObject();
  variationGroup.value = new VariationGroups(plainObj);

  regenerateCombinations();
};

const moveDimensionDown = (dimensionId) => {
  variationGroup.value.moveDimensionUpDown(dimensionId, 'down');

  // Force a complete re-creation to trigger reactivity
  const plainObj = variationGroup.value.toPlainObject();
  variationGroup.value = new VariationGroups(plainObj);

  regenerateCombinations();
};

// Get sorted dimensions for display
const sortedDimensions = computed(() => {
  return variationGroup.value.getSortedDimensions();
});

// Get sorted options for a dimension
const getSortedOptions = (dimensionId) => {
  return variationGroup.value.getSortedOptions(dimensionId);
};

// Get position number for display
const getOptionPosition = (dimensionId, optionName) => {
  const options = getSortedOptions(dimensionId);
  const index = options.findIndex(opt => opt.name === optionName);
  return index !== -1 ? index + 1 : 0;
};

const getDimensionPosition = (dimensionId) => {
  const index = sortedDimensions.value.findIndex(d => d.id === dimensionId);
  return index !== -1 ? index + 1 : 0;
};

// Close dropdowns when clicking outside
const handleClickOutside = (event) => {
  // Check if click is outside all dropdowns
  const dropdownElements = document.querySelectorAll('.position-dropdown-container');
  let clickedInside = false;

  dropdownElements.forEach(el => {
    if (el.contains(event.target)) {
      clickedInside = true;
    }
  });

  if (!clickedInside) {
    // Close all dropdowns
    optionPositionDropdowns.value.clear();
  }
};

// Add/remove click outside listener
watch(optionPositionDropdowns, (newMap) => {
  const hasOpenDropdown = Array.from(newMap.values()).some(v => v);
  if (hasOpenDropdown) {
    document.addEventListener('click', handleClickOutside);
  } else {
    document.removeEventListener('click', handleClickOutside);
  }
});

// Watch for changes and emit updates
watch(
  variationGroup,
  (newVariationGroup) => {
    console.log('emitting update', newVariationGroup);
    emit('update', newVariationGroup.toPlainObject());
  },
  { deep: true },
);

// Watch for dimension option changes to regenerate combinations
watch(
  () => variationGroup.value.dimensions,
  () => {
    console.log('watched dimensions change');
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
  <div class="variations-manager mb-4">

    <!-- Dimension Type Selection -->
    <div class="base-card mb-6">
      <h4 class="text-lg font-medium text-neutral-800 mb-4">
        Seleccionar Tipos de Variación
      </h4>
      <p class="text-sm text-neutral-600 mb-4">
        <span v-if="props.isCategoryTemplateMode">
           Selecciona una o más variaciones. Tambien puedes crear variaciones personalizadas.
          Por ejemplo, puedes combinar peso y aroma.
        </span>
        <span v-else>
          Selecciona una o más variaciones del producto. Tambien puedes crear variaciones personalizadas.
          Por ejemplo, puedes combinar peso y aroma.
        </span>
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
                Crear variación personalizada
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
            Presiona Enter o haz clic en "Agregar" para crear una variación personalizada.
          </p>
        </div>
      </div>
    </div>

    <!-- Dimension Configuration -->
    <div
      v-for="(dimension, dimIndex) in sortedDimensions"
      :key="dimension.id"
      class="base-card mb-6 relative group"
    >
      <div class="flex justify-between items-center mb-4">
        <div class="flex items-center gap-2">
          <!-- Dimension position badge -->
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center justify-center w-6 h-6 text-xs font-semibold text-neutral-600 bg-neutral-200 rounded">
              {{ getDimensionPosition(dimension.id) }}
            </span>
            <div class="flex flex-col -my-1 transition-opacity duration-200" :class="{ 'opacity-0 group-hover:opacity-100': sortedDimensions.length > 1, 'hidden': sortedDimensions.length <= 1 }">
              <button
                type="button"
                @click="moveDimensionUp(dimension.id)"
                :disabled="dimIndex === 0"
                class="p-0 text-neutral-500 hover:text-neutral-700 disabled:opacity-30 leading-none"
                title="Mover arriba"
              >
                <PhCaretUp class="w-3 h-3" />
              </button>
              <button
                type="button"
                @click="moveDimensionDown(dimension.id)"
                :disabled="dimIndex === sortedDimensions.length - 1"
                class="p-0 text-neutral-500 hover:text-neutral-700 disabled:opacity-30 leading-none"
                title="Mover abajo"
              >
                <PhCaretDown class="w-3 h-3" />
              </button>
            </div>
          </div>
          <h5 class="text-md font-medium text-neutral-800">
            {{ dimension.label }}
            <span v-if="dimension.unit" class="text-sm text-neutral-500"
              >({{ dimension.unit }})</span
            >
          </h5>
        </div>
        <button
          type="button"
          @click="toggleDimensionType(dimension.type)"
          class="danger-btn flex items-center gap-1"
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
          label="¿Ofrecer opciones integrales para esta variación?"
        />
        <p class="text-xs text-neutral-500 mt-1">
          Se creará automáticamente una versión integral para cada opción
        </p>
      </div>

      <!-- Options List -->
      <div class="space-y-2 mb-4">
        <div
          v-for="(option, optionIndex) in getSortedOptions(dimension.id)"
          :key="dimension.id + '-' + optionIndex"
          class="flex flex-col sm:flex-row gap-2 sm:gap-2 sm:items-center p-2 sm:p-3 rounded-lg relative group/option"
          :class="option.isWholeGrain ? 'bg-neutral-150' : 'bg-neutral-50'"
        >
          <!-- Mobile: Position controls and delete button row -->
          <div class="flex items-center justify-between sm:contents">
            <!-- Position controls -->
            <div class="flex items-center gap-4 sm:gap-2">
              <!-- Position badge (clickable) -->
              <div class="relative position-dropdown-container">
                <button
                  type="button"
                  @click="togglePositionDropdown(dimension.id, option.name)"
                  class="inline-flex items-center justify-center w-7 h-7 sm:w-6 sm:h-6 text-xs font-semibold text-neutral-600 bg-neutral-200 rounded hover:bg-neutral-300 transition-colors touch-manipulation"
                  title="Cambiar posición"
                >
                  {{ getOptionPosition(dimension.id, option.name) }}
                </button>

                <!-- Position dropdown -->
                <div
                  v-if="isPositionDropdownOpen(dimension.id, option.name)"
                  class="absolute z-10 mt-1 w-36 sm:w-32 bg-white border border-neutral-300 rounded-md shadow-lg position-dropdown left-0 sm:left-auto right-0 sm:right-auto"
                >
                  <div class="p-2">
                    <label class="text-xs text-neutral-600 block mb-1">Mover a posición:</label>
                    <select
                      @change="moveOptionToPosition(dimension.id, option.name, parseInt($event.target.value))"
                      class="w-full text-sm border border-neutral-300 rounded px-2 py-1.5 sm:py-1"
                      :value="getOptionPosition(dimension.id, option.name)"
                    >
                      <option
                        v-for="n in getSortedOptions(dimension.id).length"
                        :key="n"
                        :value="n"
                      >
                        {{ n }}
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Up/Down arrows -->
              <div class="flex gap-4 sm:flex-col sm:-my-1 transition-opacity duration-200" :class="{ 'opacity-50 sm:opacity-0 sm:group-hover/option:opacity-100': getSortedOptions(dimension.id).length > 1, 'hidden': getSortedOptions(dimension.id).length <= 1 }">
                <button
                  type="button"
                  @click="moveOptionUp(dimension.id, option.name)"
                  :disabled="optionIndex === 0"
                  class="p-1 sm:p-0 text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 rounded disabled:opacity-30 leading-none touch-manipulation transition-colors"
                  title="Mover arriba"
                >
                  <PhCaretUp class="w-4 h-4 sm:w-3 sm:h-3" weight="bold" />
                </button>
                <button
                  type="button"
                  @click="moveOptionDown(dimension.id, option.name)"
                  :disabled="optionIndex === getSortedOptions(dimension.id).length - 1"
                  class="p-1 sm:p-0 text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 rounded disabled:opacity-30 leading-none touch-manipulation transition-colors"
                  title="Mover abajo"
                >
                  <PhCaretDown class="w-4 h-4 sm:w-3 sm:h-3" weight="bold"/>
                </button>
              </div>
            </div>

            <!-- Delete button (top row on mobile, end on desktop) -->
            <button
              type="button"
              @click="removeOptionFromDimension(dimension.id, getSortedOptions(dimension.id).findIndex(o => o.name === option.name))"
              class="text-danger hover:text-danger-dark p-1 sm:p-0 touch-manipulation flex-shrink-0 sm:order-last"
              title="Eliminar opción"
            >
              <PhX class="w-4 h-4" />
            </button>
          </div>

          <!-- Input fields row -->
          <div class="flex gap-2 sm:flex-1 sm:min-w-0">
            <div class="flex-1 min-w-0">
              <input
                type="text"
                v-model="option.name"
                placeholder="Nombre de la opción"
                class="w-full px-2 sm:px-3 py-1 border border-neutral-300 rounded-md text-sm"
              />
            </div>

            <div v-if="dimension.unit" class="w-24 flex-shrink-0">
              <div class="input-with-unit compact" :data-unit="dimension.unit">
                <input
                  type="number"
                  v-model="option.value"
                  placeholder="0"
                  class="w-full px-2 sm:px-3 py-1 border border-neutral-300 rounded-md text-sm"
                  min="0"
                  step="1"
                />
              </div>
            </div>
          </div>
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
      v-if="!props.isCategoryTemplateMode"
      :variation-group="variationGroup"
      @update-combination-price="handleUpdateCombinationPrice"
    />

    <!-- Empty State -->
    <div
      v-if="selectedDimensionTypes.length === 0 && !props.isCategoryTemplateMode"
      class="base-card text-center py-12"
    >
      <div class="text-neutral-500 mb-2">
        <PhPlus class="w-12 h-12 mx-auto mb-4 text-neutral-300 " />
        <p class="text-lg font-medium">No hay variaciones seleccionadas</p>
        <p class="text-sm mt-2">
          Selecciona al menos una variación arriba para comenzar a configurar
          las opciones.
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

/* Position badge styles */
.position-badge {
  @apply inline-flex items-center justify-center w-6 h-6 text-xs font-semibold;
  @apply text-neutral-600 bg-neutral-200 rounded;
  @apply transition-all duration-200;
}

.position-badge:hover {
  @apply bg-neutral-300 transform scale-110;
}

/* Arrow button styles */
.arrow-button {
  @apply p-0.5 text-neutral-500 hover:text-neutral-700;
  @apply disabled:opacity-30 disabled:cursor-not-allowed;
  @apply transition-colors duration-150;
}

/* Option and dimension card transitions */
.dimension-card {
  @apply transition-all duration-300 ease-in-out;
}

.option-item {
  @apply transition-all duration-200 ease-in-out;
}

/* Dropdown animation */
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.position-dropdown {
  animation: slideDown 0.2s ease-out;
}

/* Visual feedback for reordering */
.reordering {
  @apply ring-2 ring-blue-400 ring-opacity-50;
}

/* Smooth hover effects */
.option-item:hover {
  @apply shadow-sm;
}

/* Position controls container */
.position-controls {
  @apply flex items-center gap-1;
}

/* Make position badge more prominent on hover */
.position-badge-wrapper:hover .position-badge {
  @apply bg-blue-100 text-blue-700;
}
</style>
