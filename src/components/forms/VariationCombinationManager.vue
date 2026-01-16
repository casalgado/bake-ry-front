<script setup>
import { computed, ref, watch } from 'vue';
import CombinationGroups from '@/models/frontend/CombinationGroups.js';
import { PhCaretDown, PhCaretUp, PhCaretRight } from '@phosphor-icons/vue';

const props = defineProps({
  variationGroup: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['update-combination-price']);

// Reactive state for groups
const combinationGroups = ref(null);

// Initialize groups when variationGroup changes
const initializeGroups = () => {
  if (props.variationGroup?.combinations && props.variationGroup?.dimensions) {
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

const updateGroupPrice = (groupKey, field, value) => {
  // Update all variants in the group
  const updatedIds = combinationGroups.value?.updateGroupPrice(groupKey, field, value) || [];

  // Emit events for all updated combinations
  updatedIds.forEach(combinationId => {
    emit('update-combination-price', { combinationId, field, value });
  });
};

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
      <div class="col-span-3">P. Costo</div>
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
                <input
                  type="number"
                  :value="getGroupPriceValue(group.key, 'costPrice')"
                  :placeholder="getGroupPriceDisplay(group.key, 'costPrice')"
                  @input.stop="updateGroupPrice(group.key, 'costPrice', parseFloat($event.target.value) || 0)"
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
                placeholder=""
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
                      @input.stop="
                        updateCombinationPrice(
                          variant.id,
                          'costPrice',
                          parseFloat($event.target.value) || 0
                        )
                      "
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
