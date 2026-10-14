<script setup>
import { ref, computed, watch, onMounted, nextTick, useId } from 'vue';
import UiYesNo from '@/components/ui/UiYesNo.vue';
import UiPills from '@/components/ui/UiPills.vue';
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
  productName: {
    type: String,
    default: '',
  },
  isCategoryTemplateMode: {
    type: Boolean,
    default: false,
  },
  // Forwarded to the combinations grid so it can grey out the cost of a
  // variation whose price is about to come from a recipe. Display only —
  // nothing here writes costPriceSource, that stays the recipe link's job.
  inventoryMode: {
    type: String,
    default: 'none',
  },
});

const emit = defineEmits(['update']);

// System settings store
const systemSettingsStore = useSystemSettingsStore();

// Ids are per instance, so two managers on one page never share a `for` target.
const uid = useId();

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
  { value: 'SIZE', label: 'Forma / Tamaño' },
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
const toggleDimensionType = (type, event) => {
  const index = selectedDimensionTypes.value.indexOf(type);

  if (index > -1) {
    /* The browser already flipped the checkbox, but nothing is removed until the
     * user confirms. Cancelling changes no state, so Vue would never repaint it
     * and the pill would stay off while the dimension stays on. */
    if (event) event.target.checked = true;

    // Remove dimension type
    confirmDialog.value = {
      isOpen: true,
      title: 'Eliminar variación',
      message: '¿Estás seguro de eliminar esta variación? Se perderán todas las opciones y combinaciones asociadas, y las recetas vinculadas a esas combinaciones quedarán desvinculadas.',
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

const addOptionToDimension = async (dimensionId) => {
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

  // Focus on the new input field after DOM update
  await nextTick();
  const newOptionIndex = dimension.options.length - 1;
  const inputSelector = `input[data-option-index="${dimensionId}-${newOptionIndex}"]`;
  const newInput = document.querySelector(inputSelector);
  if (newInput) {
    newInput.focus();
  }
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

  // Only regenerate if we have valid dimensions with options
  const hasValidDimensions = variationGroup.value.dimensions.every(
    d => d.options.length > 0 && d.options.every(o => o.name),
  );

  if (!hasValidDimensions) {
    return;
  }

  const existing = variationGroup.value.combinations;
  const afterIds = variationGroup.value.allOptionIds();
  const beforeIds = new Set(existing.flatMap(combo => combo.optionIds || []));

  // A combination id is a foreign key: recipes, stock docs, past order items and
  // sales reports all point at it. So it may only change when the sellable unit
  // it names genuinely changed.
  //
  // Renames, value edits, unit changes and reordering touch no option ids at
  // all, so every combination is the same unit it was — nothing to regenerate,
  // only names to refresh.
  //
  // The count check is what makes this shortcut equivalent to the long path
  // rather than merely usually equivalent: a product can mention every option
  // and still be missing cells of the grid, and those still need generating.
  const sameOptions = afterIds.size === beforeIds.size &&
    [...afterIds].every(id => beforeIds.has(id));
  const expectedCount = variationGroup.value.dimensions.reduce(
    (count, dimension) => count * dimension.options.length,
    1,
  );

  if (sameOptions && afterIds.size > 0 && existing.length === expectedCount) {
    existing.forEach(combo => variationGroup.value.relabel(combo));
    return;
  }

  // Preserve existing combination data with more information for smart matching
  const existingCombinations = {};
  existing.forEach(combo => {
    existingCombinations[combo.name] = {
      basePrice: combo.basePrice,
      costPrice: combo.costPrice,
      selection: combo.selection,
      accountingCode: combo.accountingCode,
    };
  });

  // Generate new combinations with wholegrain status
  const newCombinations = variationGroup.value.generateCombinationsWithWholeGrainStatus();

  // Options present both before and after the edit are the only evidence of
  // what maps to what. One old and one new sharing a key is the same unit; any
  // other count means it was split or merged, and no recipe can follow that.
  const shared = new Set([...beforeIds].filter(id => afterIds.has(id)));
  const keyOf = (optionIds = []) =>
    optionIds.filter(id => shared.has(id)).sort().join('|');

  const countByKey = (combos) => combos.reduce((counts, combo) => {
    const key = keyOf(combo.optionIds);
    counts.set(key, (counts.get(key) || 0) + 1);
    return counts;
  }, new Map());

  const oldCounts = countByKey(existing);
  const newCounts = countByKey(newCombinations);
  const oldByKey = new Map(existing.map(combo => [keyOf(combo.optionIds), combo]));

  const updatedCombinations = newCombinations.map(combo => {
    const key = keyOf(combo.optionIds);

    // An empty key means nothing of this combination survived the edit. It has
    // no ancestor, and must never be paired with another orphan.
    if (key && oldCounts.get(key) === 1 && newCounts.get(key) === 1) {
      // Same unit, new shape: it adopts the candidate's options (it may have
      // gained or lost one) and keeps everything that identifies it.
      const kept = oldByKey.get(key);
      kept.optionIds = combo.optionIds;
      return variationGroup.value.relabel(kept);
    }

    let matchedCombination = null;

    // Try exact name match first (for unchanged combinations)
    matchedCombination = existingCombinations[combo.name];

    // If no exact match, try partial matching based on primary dimensions
    if (!matchedCombination) {
      let bestMatch = null;
      let bestMatchCount = 0;

      for (const oldData of Object.values(existingCombinations)) {
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
        }
      }

      if (bestMatch) {
        matchedCombination = bestMatch;
      }
    }

    // A genuinely new sellable unit. Prices are seeded from its nearest
    // relative because a starting number is a convenience; the recipe link is
    // not seeded, because `combo` is new and no recipe belongs to it yet.
    combo.basePrice = matchedCombination?.basePrice || 0;
    combo.currentPrice = combo.basePrice;
    combo.costPrice = matchedCombination?.costPrice || 0;
    combo.accountingCode = matchedCombination?.accountingCode || '';

    return combo;
  });

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
      label: 'Forma / Tamaño',
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
  <div class="flex flex-col gap-4">
    <p class="ui-field-hint">
      Selecciona una o más variaciones{{ props.isCategoryTemplateMode ? '' : ' del producto' }}.
      También puedes crear variaciones personalizadas. Por ejemplo, puedes combinar peso y aroma.
    </p>

    <!-- Several can be on at once, so these are checkbox pills: the sr-only input
         feeds the label next to it, which `:checked + .ui-btn` paints. The input
         must stay the label's previous sibling. -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
      <template v-for="dimensionType in [...availableDimensionTypes, ...customDimensions]" :key="dimensionType.value">
        <input
          :id="`${uid}-dim-${dimensionType.value}`"
          class="sr-only"
          type="checkbox"
          :value="dimensionType.value"
          :checked="selectedDimensionTypes.includes(dimensionType.value)"
          @change="toggleDimensionType(dimensionType.value, $event)"
        >
        <label class="ui-btn justify-center w-full" :for="`${uid}-dim-${dimensionType.value}`">{{ dimensionType.label }}</label>
      </template>
    </div>

    <div class="ui-field">
      <label class="ui-field-k" :for="`${uid}-custom`">Crear variación personalizada</label>
      <div class="flex gap-2">
        <input
          :id="`${uid}-custom`"
          v-model="newCustomDimension.label"
          type="text"
          class="ui-input"
          placeholder="ej: Sabor, Color, Material..."
          @keydown.enter.prevent="addCustomDimension"
        >
        <button
          type="button"
          class="ui-btn ui-btn-field shrink-0"
          :disabled="!newCustomDimension.label.trim()"
          @click="addCustomDimension"
        >
          <PhPlus class="w-4 h-4" weight="bold" />
          Agregar
        </button>
      </div>
      <span class="ui-field-hint">Presiona Enter o haz clic en "Agregar".</span>
    </div>

    <!-- Dimension Configuration -->
    <section
      v-for="(dimension, dimIndex) in sortedDimensions"
      :key="dimension.id"
      class="flex flex-col gap-3"
    >
      <div class="ui-sectionhead">Variación {{ getDimensionPosition(dimension.id) }}</div>

      <div class="flex items-center gap-2">
        <span class="ui-card-title">
          {{ dimension.label }}
          <span v-if="dimension.unit" class="ui-unit">({{ dimension.unit }})</span>
        </span>
        <template v-if="sortedDimensions.length > 1">
          <button
            type="button"
            class="ui-btn ui-btn-icon"
            aria-label="Mover variación arriba"
            :disabled="dimIndex === 0"
            @click="moveDimensionUp(dimension.id)"
          >
            <PhCaretUp class="w-3.5 h-3.5" weight="bold" />
          </button>
          <button
            type="button"
            class="ui-btn ui-btn-icon"
            aria-label="Mover variación abajo"
            :disabled="dimIndex === sortedDimensions.length - 1"
            @click="moveDimensionDown(dimension.id)"
          >
            <PhCaretDown class="w-3.5 h-3.5" weight="bold" />
          </button>
        </template>
        <button
          type="button"
          class="ui-btn ui-btn-danger ml-auto"
          @click="toggleDimensionType(dimension.type)"
        >
          <PhTrash class="w-4 h-4" />
          Eliminar
        </button>
      </div>

      <UiPills
        v-if="getUnitOptionsForDimension(dimension.type).length > 0"
        v-model="dimension.unit"
        label="Unidad"
        :options="getUnitOptionsForDimension(dimension.type)"
      />

      <div class="flex flex-col gap-1">
        <UiYesNo
          :model-value="getDimensionWholeGrainStatus(dimension.id)"
          label="¿Ofrecer opciones integrales para esta variación?"
          @update:model-value="(value) => toggleWholeGrainForDimension(dimension.id, value)"
        />
        <span class="ui-field-hint">Se creará automáticamente una versión integral para cada opción</span>
      </div>

      <!-- Options List -->
      <!-- The position is a native select, not the popover it replaces: "move to
           position N" was the popover's only job, and a select does it with no
           open/close state and no document click listener. The controls drop to
           their own line below sm, same trick as the combinations grid. -->
      <div class="flex flex-col gap-1.5">
        <div
          v-for="(option, optionIndex) in getSortedOptions(dimension.id)"
          :key="dimension.id + '-' + optionIndex"
          class="ui-item ui-item-filled"
        >
          <select
            class="ui-input w-16"
            aria-label="Posición de la opción"
            :value="getOptionPosition(dimension.id, option.name)"
            @change="moveOptionToPosition(dimension.id, option.name, parseInt($event.target.value))"
          >
            <option v-for="n in getSortedOptions(dimension.id).length" :key="n" :value="n">{{ n }}</option>
          </select>

          <div class="flex items-center gap-2 min-w-0">
            <input
              v-model="option.name"
              type="text"
              class="ui-input"
              placeholder="Nombre de la opción"
              aria-label="Nombre de la opción"
              :data-option-index="`${dimension.id}-${optionIndex}`"
              @keydown.enter.prevent="addOptionToDimension(dimension.id)"
            >
            <span v-if="option.isWholeGrain" class="ui-tag">Integral</span>
          </div>

          <div class="ui-item-trail max-sm:col-span-full max-sm:justify-between">
            <div v-if="dimension.unit" class="ui-field-unit w-24" :data-unit="dimension.unit">
              <input
                v-model="option.value"
                type="number"
                class="ui-input ui-input-num"
                placeholder="0"
                aria-label="Valor de la opción"
                min="0"
                step="1"
                @keydown.enter.prevent="addOptionToDimension(dimension.id)"
              >
            </div>
            <span class="flex gap-1">
              <button
                v-if="getSortedOptions(dimension.id).length > 1"
                type="button"
                class="ui-btn ui-btn-icon"
                aria-label="Mover opción arriba"
                tabindex="-1"
                :disabled="optionIndex === 0"
                @click="moveOptionUp(dimension.id, option.name)"
              >
                <PhCaretUp class="w-3.5 h-3.5" weight="bold" />
              </button>
              <button
                v-if="getSortedOptions(dimension.id).length > 1"
                type="button"
                class="ui-btn ui-btn-icon"
                aria-label="Mover opción abajo"
                tabindex="-1"
                :disabled="optionIndex === getSortedOptions(dimension.id).length - 1"
                @click="moveOptionDown(dimension.id, option.name)"
              >
                <PhCaretDown class="w-3.5 h-3.5" weight="bold" />
              </button>
              <button
                type="button"
                class="ui-btn ui-btn-icon ui-btn-danger"
                aria-label="Eliminar opción"
                tabindex="-1"
                @click="removeOptionFromDimension(dimension.id, getSortedOptions(dimension.id).findIndex(o => o.name === option.name))"
              >
                <PhX class="w-3.5 h-3.5" weight="bold" />
              </button>
            </span>
          </div>
        </div>
      </div>

      <div>
        <button type="button" class="ui-btn" @click="addOptionToDimension(dimension.id)">
          <PhPlus class="w-4 h-4" weight="bold" />
          Agregar opción
        </button>
      </div>
    </section>

    <!-- Combinations/Prices Section -->
    <VariationCombinationManager
      v-if="!props.isCategoryTemplateMode"
      :variation-group="variationGroup"
      :inventory-mode="inventoryMode"
      @update-combination-price="handleUpdateCombinationPrice"
    />

    <!-- Empty State -->
    <div
      v-if="selectedDimensionTypes.length === 0 && !props.isCategoryTemplateMode"
      class="ui-empty"
    >
      <b>No hay variaciones seleccionadas</b>
      Selecciona al menos una variación arriba para comenzar a configurar las opciones.
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
