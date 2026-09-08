<script setup>
import { computed, ref, watch } from 'vue';
import CombinationGroups from '@/models/frontend/CombinationGroups.js';
import { PhCaretDown, PhCaretUp, PhCaretRight, PhLock, PhInfo, PhArrowCounterClockwise } from '@phosphor-icons/vue';
import AppTooltip from '@/components/common/AppTooltip.vue';

const props = defineProps({
  variationGroup: {
    type: Object,
    required: true,
  },
  inventoryMode: {
    type: String,
    default: 'none',
  },
});

const emit = defineEmits(['update-combination-price']);

// Reactive state for groups
const combinationGroups = ref(null);

/* The cost each row arrived with, so a typed-over recipe cost can be put back.
 * First snapshot per id wins: adding an option re-initializes the groups, and a
 * second pass would record the edited value as the original. */
const originalCosts = ref(new Map());

const snapshotCosts = (combinations) => {
  combinations.forEach(c => {
    if (!originalCosts.value.has(c.id)) {
      originalCosts.value.set(c.id, { costPrice: c.costPrice, costPriceSource: c.costPriceSource });
    }
  });
};

// Initialize groups when variationGroup changes
const initializeGroups = () => {
  if (props.variationGroup?.combinations && props.variationGroup?.dimensions) {
    snapshotCosts(props.variationGroup.combinations);
    combinationGroups.value = new CombinationGroups(
      props.variationGroup.combinations,
      props.variationGroup.dimensions,
    );
  }
};

// Watch for changes in variationGroup structure (not price changes)
watch(() => props.variationGroup, () => {
  if (props.variationGroup) {
    initializeGroups();
  }
}, { immediate: true });

// Also watch for structural changes within the same object
watch(() => [props.variationGroup?.combinations?.length, props.variationGroup?.dimensions?.length], () => {
  if (props.variationGroup) {
    initializeGroups();
  }
});

// Computed properties
const allPossibleCombinations = computed(() => {
  return props.variationGroup?.generateAllCombinations() || [];
});

const groupsArray = computed(() => {
  return combinationGroups.value?.getGroupsArray() || [];
});

const groupingOptions = computed(() => {
  return combinationGroups.value?.getAvailableGroupingOptions() || [];
});

const summaryStats = computed(() => {
  return combinationGroups.value?.getSummaryStats() || {
    withPrices: 0,
    total: 0,
    averagePrice: 0,
    averageCost: 0,
  };
});

const allExpanded = computed(() => {
  return combinationGroups.value?.allExpanded || false;
});

const showGroupControls = computed(() => {
  return groupingOptions.value.length > 1;
});

// Functions
const updateCombinationPrice = (combinationId, field, value) => {
  // Update the groups model
  combinationGroups.value?.updateCombinationPrice(combinationId, field, value);

  // Emit to parent (maintains existing behavior)
  emit('update-combination-price', { combinationId, field, value });
};

const updateGroupPrice = (groupKey, field, value, skipIds = null) => {
  // Update all variants in the group
  const updatedIds = combinationGroups.value?.updateGroupPrice(groupKey, field, value, skipIds) || [];

  // Emit events for all updated combinations
  updatedIds.forEach(combinationId => {
    emit('update-combination-price', { combinationId, field, value });
  });
};

/* Two reasons a cost isn't yours to type. The stored flag: a recipe is linked and
 * the backend's propagation walk owns the number (recipeGraph.js:329). The mode:
 * the product was just declared recipe-costed, so the cost is coming, it just has
 * no recipe yet — a hint, never written to costPriceSource, because stamping
 * 'recipe' on a row with no recipeId would be a lie the backend has to undo.
 *
 * A row that already carries a cost is never re-locked: the number is the
 * evidence that someone claimed it, which is what survives closing the form. */
const manuallyUnlocked = ref(new Set());

const isCostLocked = (variant) =>
  variant.costPriceSource === 'recipe' ||
  (props.inventoryMode === 'recipe' && !manuallyUnlocked.value.has(variant.id) && !variant.costPrice);

const isGroupCostLocked = (group) => group.variants.every(isCostLocked);

const hasLockedCosts = computed(() =>
  groupsArray.value.some(group => group.variants.some(isCostLocked)),
);

/* Unlocking is permission to type, nothing more: it never writes
 * costPriceSource. Detaching every recipe-owned row from propagation because the
 * user wanted to edit one of them would silently freeze costs they never looked
 * at. The flag flips in claimCost, on the row that actually receives a number. */
const unlockAllCosts = () => {
  groupsArray.value.forEach(group => group.variants.forEach(v => manuallyUnlocked.value.add(v.id)));
  manuallyUnlocked.value = new Set(manuallyUnlocked.value);
};

// Typing a cost is what takes ownership from the recipe (recipeGraph.js:329 then
// skips this row for good). A row nobody typed into keeps its source untouched.
const claimCost = (variant) => {
  if (variant.costPriceSource === 'recipe') {
    updateCombinationPrice(variant.id, 'costPriceSource', 'manual');
  }
};

const setCombinationCost = (variant, value) => {
  claimCost(variant);
  updateCombinationPrice(variant.id, 'costPrice', value);
};

/* Typing takes ownership on the first keystroke, so the way back can't be "type
 * the old number again" — it may be long gone from the screen. These two are the
 * undo: which rows were taken from their recipe, and putting them back. */
const claimedFromRecipe = computed(() =>
  groupsArray.value
    .flatMap(group => group.variants)
    .filter(v => v.costPriceSource === 'manual' && originalCosts.value.get(v.id)?.costPriceSource === 'recipe'),
);

const restoreRecipeCosts = () => {
  claimedFromRecipe.value.forEach(variant => {
    const original = originalCosts.value.get(variant.id);
    updateCombinationPrice(variant.id, 'costPrice', original.costPrice);
    updateCombinationPrice(variant.id, 'costPriceSource', 'recipe');
  });
};

const setGroupCost = (group, value) => {
  // Snapshot before claiming: claimCost mutates the flag isCostLocked reads.
  const lockedIds = new Set(group.variants.filter(isCostLocked).map(v => v.id));
  group.variants.forEach(v => !lockedIds.has(v.id) && claimCost(v));
  updateGroupPrice(group.key, 'costPrice', value, lockedIds);
};

const COST_TOOLTIP = 'El costo se calcula con los ingredientes de la receta y se actualiza solo cuando cambian sus precios. Si necesitas otro costo, usa el candado para editarlo manualmente y la receta dejará de actualizarlo.';

const getGroupPriceValue = (groupKey, field) => {
  return combinationGroups.value?.getGroupPriceValue(groupKey, field) || '';
};

const getGroupPriceDisplay = (groupKey, field) => {
  return combinationGroups.value?.getGroupPriceDisplay(groupKey, field) || '';
};

const toggleGroup = (groupKey) => {
  combinationGroups.value?.toggleGroup(groupKey);
};

const toggleAllGroups = () => {
  combinationGroups.value?.toggleAllGroups();
};

const changeGrouping = (dimensionIndex) => {
  combinationGroups.value?.changeGrouping(dimensionIndex);
};

const formatPriceRange = (group) => {
  return combinationGroups.value?.formatPriceRange(group) || '$0.00';
};
</script>

<template>
  <!-- Combinations/Prices Section -->
  <div v-if="variationGroup.combinations.length > 0" class="base-card">
    <!-- Header -->
    <div class="flex justify-between items-center mb-4">
      <h4 class="text-lg font-medium text-neutral-800">
        Precios
        <span v-if="variationGroup.dimensions.length > 1" class="text-sm text-neutral-500"
          >({{ summaryStats.total }} combinaciones)</span
        >
      </h4>
      <div class="text-sm text-neutral-600 hidden">
        Total de combinaciones posibles: {{ allPossibleCombinations.length }}
      </div>
    </div>

    <!-- Controls Row -->
    <div class="flex justify-between items-center mb-4 pb-4 border-b border-neutral-200">
      <div class="flex items-center gap-4">
        <!-- Group by Dropdown (only show if multiple dimensions) -->
        <div v-if="showGroupControls" class="flex items-center gap-2">
          <label class="text-sm font-medium text-neutral-700">Agrupar por:</label>
          <select
            :value="combinationGroups?.groupByDimension || 0"
            @change="changeGrouping(parseInt($event.target.value))"
            class="text-sm border border-neutral-300 rounded px-2 py-1"
          >
            <option
              v-for="option in groupingOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </div>

        <!-- Here rather than beside the "P. Costo" column header: that header row
             is `hidden sm:grid`, and a control that disappears on mobile is a
             lock with no key. -->
        <button
          v-if="hasLockedCosts"
          type="button"
          @click="unlockAllCosts"
          class="text-sm flex items-center gap-1 utility-btn"
        >
          <PhLock class="w-4 h-4" />
          Editar costos manualmente
        </button>

        <button
          v-if="claimedFromRecipe.length"
          type="button"
          @click="restoreRecipeCosts"
          class="text-sm flex items-center gap-1 utility-btn"
        >
          <PhArrowCounterClockwise class="w-4 h-4" />
          Restaurar costos de receta
        </button>
      </div>

      <!-- Expand/Collapse All -->
      <button
        v-if="variationGroup.dimensions.length > 1"
        type="button"
        @click="toggleAllGroups"
        class="text-sm flex items-center gap-1 utility-btn"
      >
        <PhCaretDown v-if="allExpanded" class="w-4 h-4" />
        <PhCaretRight v-else class="w-4 h-4" />
        {{ allExpanded ? 'Contraer todo' : 'Expandir todo' }}
      </button>
    </div>

    <!-- Column Headers (Desktop only) -->
    <div class="hidden sm:grid grid-cols-14 gap-3 mb-2 px-4 py-2 text-xs font-medium text-neutral-600 uppercase tracking-wide">
      <div class="col-span-6">Variante</div>
      <div class="col-span-3">P. Venta</div>
      <div class="col-span-3 flex items-center gap-1">
        P. Costo
        <AppTooltip :text="COST_TOOLTIP" tabindex="0">
          <PhInfo class="w-3.5 h-3.5 text-neutral-400" />
        </AppTooltip>
      </div>
      <div class="col-span-2">Código</div>
    </div>

    <!-- Groups List -->
    <div class="space-y-1">
      <div v-for="group in groupsArray" :key="group.key" class="group-container">

        <!-- Group Header -->
        <div
          class="group-header flex flex-col sm:grid sm:grid-cols-14 gap-2 sm:gap-3 sm:items-center px-4 py-3 hover:bg-neutral-100 border-l-4 border-neutral-300"
          :class="group.expanded ? 'border-blue-400 bg-neutral-50' : ''"
        >
          <!-- Mobile: Group Name row -->
          <div class="flex items-center justify-between sm:col-span-6 sm:justify-start"
               :class="variationGroup.dimensions.length > 1 ? 'cursor-pointer' : ''"
               @click="variationGroup.dimensions.length > 1 ? toggleGroup(group.key) : null">
            <div class="flex items-center">
              <PhCaretDown v-if="variationGroup.dimensions.length > 1 && group.expanded" class="w-4 h-4 mr-3 text-neutral-500" />
              <PhCaretRight v-else-if="variationGroup.dimensions.length > 1" class="w-4 h-4 mr-3 text-neutral-500" />
              <div>
                <span class="font-medium text-neutral-800">{{ group.name }}</span>
                <span v-if="group.variants.length > 1" class="text-sm text-neutral-500 ml-2">
                  {{ group.variants.length }} variantes
                </span>
              </div>
            </div>
          </div>

          <!-- Mobile: Price fields row / Desktop: Inline price fields -->
          <div class="flex gap-2 sm:contents">
            <!-- Base Price -->
            <div class="flex-1 sm:col-span-3" @click.stop="console.log('Group base price div clicked')">
              <label class="block text-xs font-medium text-neutral-600 mb-1 sm:hidden">P. Venta</label>
              <div class="input-with-unit compact" data-unit="$">
                <input
                  type="number"
                  :value="getGroupPriceValue(group.key, 'basePrice')"
                  :placeholder="getGroupPriceDisplay(group.key, 'basePrice')"
                  @input.stop="updateGroupPrice(group.key, 'basePrice', parseFloat($event.target.value) || 0)"
                  @click.stop
                  @focus.stop
                  class="w-full px-2 py-1 border border-neutral-300 rounded text-sm group-price-input"
                  min="0"
                  step="1"
                />
              </div>
            </div>

            <!-- Cost Price -->
            <div class="flex-1 sm:col-span-3" @click.stop>
              <label class="block text-xs font-medium text-neutral-600 mb-1 sm:hidden">P. Costo</label>
              <div class="input-with-unit compact" data-unit="$">
                <!-- Live while any row in the group is still manual; the locked
                     rows are skipped by CombinationGroups.updateGroupPrice. -->
                <input
                  type="number"
                  :value="getGroupPriceValue(group.key, 'costPrice')"
                  :placeholder="getGroupPriceDisplay(group.key, 'costPrice')"
                  :readonly="isGroupCostLocked(group)"
                  @input.stop="setGroupCost(group, parseFloat($event.target.value) || 0)"
                  @click.stop
                  @focus.stop
                  class="w-full px-2 py-1 border border-neutral-300 rounded text-sm group-price-input"
                  min="0"
                  step="1"
                />
              </div>
            </div>

            <!-- Accounting Code -->
            <div class="flex-1 sm:col-span-2" @click.stop>
              <label class="block text-xs font-medium text-neutral-600 mb-1 sm:hidden">Código</label>
              <input
                type="text"
                :value="getGroupPriceValue(group.key, 'accountingCode')"
                :placeholder="getGroupPriceDisplay(group.key, 'accountingCode')"
                @input.stop="updateGroupPrice(group.key, 'accountingCode', $event.target.value)"
                @click.stop
                @focus.stop
                class="w-full px-2 py-1 border border-neutral-300 rounded text-sm group-price-input"
              />
            </div>
          </div>
        </div>

        <!-- Group Variants (Expanded) -->
        <transition name="slide-down">
          <div v-if="group.expanded" class="variants-container bg-neutral-25">
            <div
              v-for="variant in group.variants"
              :key="variant.id"
              class="variant-row flex flex-col sm:grid sm:grid-cols-14 gap-2 sm:gap-3 sm:items-center px-4 py-3 pl-4 sm:pl-8 hover:bg-neutral-75 border-l-4 border-neutral-200"
              :class="variant.isWholeGrain ? 'bg-amber-25' : ''"
            >
              <!-- Variant Name -->
              <div class="sm:col-span-6">
                <div class="flex items-center">
                  <div>
                    <div class="text-xs font-medium text-neutral-800">
                      {{ variant.variantName }}
                    </div>
                    <div class="text-xs text-neutral-500">
                      {{ variant.originalSelection ? variant.originalSelection.join(" • ") : "" }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Mobile: Price fields row / Desktop: Inline price fields -->
              <div class="flex gap-2 sm:contents">
                <!-- Base Price -->
                <div class="flex-1 sm:col-span-3" @click.stop="console.log('🛑 Variant base price div clicked')">
                  <label class="block text-xs font-medium text-neutral-600 mb-1 sm:hidden">P. Venta</label>
                  <div class="input-with-unit compact" data-unit="$">
                    <input
                      type="number"
                      :value="variant.basePrice"
                      @input.stop="
                        console.log('⌨️ Variant base price input:', $event.target.value, 'for variant:', variant.id);
                        updateCombinationPrice(
                          variant.id,
                          'basePrice',
                          parseFloat($event.target.value) || 0
                        )
                      "
                      @click.stop="console.log('🖱️ Option base price input clicked')"
                      @focus.stop="console.log('🎯 Option base price input focused')"
                      placeholder="0"
                      class="w-full px-2 py-1 border border-neutral-300 rounded text-sm"
                      min="0"
                      step="1"
                    />
                  </div>
                </div>

                <!-- Cost Price -->
                <div class="flex-1 sm:col-span-3" @click.stop>
                  <label class="block text-xs font-medium text-neutral-600 mb-1 sm:hidden">P. Costo</label>
                  <div class="input-with-unit compact" data-unit="$">
                    <input
                      type="number"
                      :value="variant.costPrice"
                      :readonly="isCostLocked(variant)"
                      @input.stop="setCombinationCost(variant, parseFloat($event.target.value) || 0)"
                      @click.stop
                      @focus.stop
                      placeholder="0"
                      class="w-full px-2 py-1 border border-neutral-300 rounded text-sm"
                      min="0"
                      step="1"
                    />
                  </div>
                </div>

                <!-- Accounting Code -->
                <div class="flex-1 sm:col-span-2" @click.stop>
                  <label class="block text-xs font-medium text-neutral-600 mb-1 sm:hidden">Código</label>
                  <input
                    type="text"
                    :value="variant.accountingCode"
                    @input.stop="
                      updateCombinationPrice(
                        variant.id,
                        'accountingCode',
                        $event.target.value
                      )
                    "
                    @click.stop
                    @focus.stop
                    placeholder=""
                    class="w-full px-2 py-1 border border-neutral-300 rounded text-sm"
                  />
                </div>
              </div>

            </div>
          </div>
        </transition>
      </div>
    </div>

    <!-- Summary -->
    <div class="mt-6 p-4 bg-neutral-100 rounded-lg">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        <div>
          <div class="text-neutral-600">Con precios definidos:</div>
          <div class="font-medium text-neutral-900">
            {{ summaryStats.withPrices }} / {{ summaryStats.total }}
          </div>
        </div>
        <div>
          <div class="text-neutral-600">Precio promedio:</div>
          <div class="font-medium text-neutral-900">
            ${{ summaryStats.averagePrice.toLocaleString("es-CO") }}
          </div>
        </div>
        <div>
          <div class="text-neutral-600">Costo promedio:</div>
          <div class="font-medium text-neutral-900">
            ${{ summaryStats.averageCost.toLocaleString("es-CO") }}
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Empty State -->
  <div
    v-else-if="variationGroup.dimensions.length > 0"
    class="base-card text-center py-8"
  >
    <div class="text-neutral-500">
      <p class="text-md font-medium">Configurando combinaciones...</p>
      <p class="text-sm mt-2">
        Completa la configuración para ver las combinaciones disponibles.
      </p>
    </div>
  </div>
</template>

<style scoped>
/* A bg utility class can't grey these out: .form-container input
 * (custom-components.css:89) sets bg-gray-50 at (0,1,1), which outranks any
 * single-class utility. The scoped attribute takes this rule to (0,2,1). */
input[readonly] {
  background-color: #E6DFD8; /* neutral-200 */
  color: #725F46; /* neutral-600 */
}

/* Custom 14-column grid (Tailwind only goes up to 12) */
.grid-cols-14 {
  grid-template-columns: repeat(14, minmax(0, 1fr));
}

@media (min-width: 640px) {
  .sm\:grid-cols-14 {
    grid-template-columns: repeat(14, minmax(0, 1fr));
  }
}

/* Group header styling */
.group-header {
  @apply transition-all duration-200 ease-in-out;
}

.group-header:hover {
  @apply bg-neutral-100;
}

.group-header.expanded {
  @apply border-blue-400 bg-neutral-50;
}

/* Variant row styling */
.variant-row {
  @apply transition-all duration-150 ease-in-out;
}

.variant-row:hover {
  @apply bg-neutral-75;
}

/* Slide down transition for expanded variants */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease-in-out;
  overflow: hidden;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  max-height: 0;
  transform: translateY(-10px);
}

.slide-down-enter-to,
.slide-down-leave-from {
  opacity: 1;
  max-height: 1000px;
  transform: translateY(0);
}

/* Custom neutral color utilities for better hierarchy */
.bg-neutral-25 {
  @apply bg-gray-50;
}

.bg-neutral-75 {
  @apply bg-gray-100;
}

.bg-neutral-150 {
  @apply bg-gray-200;
}

.bg-amber-25 {
  @apply bg-amber-50;
}

/* Visual hierarchy enhancements */
.group-container {
  @apply rounded-lg overflow-hidden border border-neutral-200;
}

.group-container:not(:last-child) {
  @apply mb-2;
}

/* Focus states for accessibility */
.group-header:focus-within {
  @apply ring-2 ring-blue-400 ring-opacity-50;
}

input[type="number"]:focus {
  @apply ring-2 ring-blue-400 ring-opacity-50 border-blue-400;
}

/* Prevent input interactions from triggering group toggle */
.variant-row input[type="number"] {
  @apply relative z-10;
}

/* Custom styling for price range display */
.price-range {
  @apply font-mono text-sm;
}

/* Enhanced placeholder visibility for group price inputs */
.group-price-input::placeholder {
  @apply text-neutral-500;
  opacity: 1;
}

.group-price-input::-webkit-input-placeholder {
  @apply text-neutral-500;
  opacity: 1;
}

.group-price-input::-moz-placeholder {
  @apply text-neutral-500;
  opacity: 1;
}

.group-price-input:-ms-input-placeholder {
  @apply text-neutral-500;
  opacity: 1;
}
</style>
