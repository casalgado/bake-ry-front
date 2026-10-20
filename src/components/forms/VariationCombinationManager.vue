<script setup>
import { computed, ref, watch, useId } from 'vue';
import CombinationGroups from '@/models/frontend/CombinationGroups.js';
import { PhCaretDown, PhCaretRight, PhLock, PhLockOpen, PhInfo, PhArrowCounterClockwise } from '@phosphor-icons/vue';
import AppTooltip from '@/components/common/AppTooltip.vue';
import UiMoneyInput from '@/components/ui/UiMoneyInput.vue';

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

// Ids are per instance: ids built from group keys alone would collide across forms.
const uid = useId();

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

/* "Waiting for a recipe" only describes a row that has none. One that is linked
 * and whose source is 'manual' is frozen by the user, not pending: showing it
 * locked at 0 would pass a frozen cost off as an automatic one. */
const isCostLocked = (variant) =>
  !manuallyUnlocked.value.has(variant.id) &&
  (variant.costPriceSource === 'recipe' ||
    (props.inventoryMode === 'recipe' && !variant.recipeId && !variant.costPrice));

const isGroupCostLocked = (group) => group.variants.every(isCostLocked);

const hasLockedCosts = computed(() =>
  groupsArray.value.some(group => group.variants.some(isCostLocked)),
);

const costsUnlocked = computed(() => manuallyUnlocked.value.size > 0);

/* The toggle has to outlive the locks it removes: once everything is unlocked
 * hasLockedCosts is false, and a button that vanished the moment you pressed it
 * could never be pressed back. */
const showCostToggle = computed(() => hasLockedCosts.value || costsUnlocked.value);

/* Unlocking is permission to type, nothing more: it never writes
 * costPriceSource. Detaching every recipe-owned row from propagation because the
 * user wanted to edit one of them would silently freeze costs they never looked
 * at. The flag flips in claimCost, on the row that actually receives a number.
 * Locking again only forgets the permission: a row someone already typed into
 * has left its recipe (source 'manual') and stays editable. */
const toggleCostLock = () => {
  if (costsUnlocked.value) {
    manuallyUnlocked.value = new Set();
    return;
  }
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

const restoreRecipeCost = (variant) => {
  const original = originalCosts.value.get(variant.id);
  updateCombinationPrice(variant.id, 'costPrice', original.costPrice);
  updateCombinationPrice(variant.id, 'costPriceSource', 'recipe');
};

const restoreRecipeCosts = () => claimedFromRecipe.value.forEach(restoreRecipeCost);

/* A zero is "no cost", which is how the backend reads it too when it links a
 * recipe (recipeService followsRecipe). On a row taken from its recipe that
 * means: go back to it. Applied when the field is left, not while typing —
 * clearing a number to type another passes through 0 on the way. */
const isClaimed = (variant) => claimedFromRecipe.value.some(v => v.id === variant.id);

const commitCost = (variant) => {
  if (!(variant.costPrice > 0) && isClaimed(variant)) restoreRecipeCost(variant);
};

const commitGroupCost = (group) => group.variants.forEach(commitCost);

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
</script>

<template>
  <!-- The price columns are one decision made in three places: the .ui-listhead
       labels, the group rows and the variant rows all use w-28 / w-28 / w-24, and
       .ui-item-trail's 14px gap is what the head's gap matches. Change one and the
       labels drift off their numbers. Below sm the head is gone and every field
       carries its own visible label instead. -->
  <div v-if="variationGroup.combinations.length > 0" class="flex flex-col gap-3">
    <div class="ui-sectionhead">
      Precios
      <span v-if="variationGroup.dimensions.length > 1" class="ui-unit">
        ({{ summaryStats.total }} combinaciones)
      </span>
    </div>

    <div class="flex flex-wrap items-end gap-2">
      <div v-if="showGroupControls" class="ui-field w-48">
        <label class="ui-field-k" :for="`${uid}-group-by`">Agrupar por</label>
        <select
          :id="`${uid}-group-by`"
          class="ui-input"
          :value="combinationGroups?.groupByDimension || 0"
          @change="changeGrouping(parseInt($event.target.value))"
        >
          <option v-for="option in groupingOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>

      <!-- Here rather than beside the "P. Costo" column header: that header row
           is hidden below sm, and a control that disappears on mobile is a
           lock with no key. -->
      <button
        v-if="showCostToggle"
        type="button"
        class="ui-btn"
        :aria-pressed="costsUnlocked"
        @click="toggleCostLock"
      >
        <PhLockOpen v-if="costsUnlocked" class="w-4 h-4" />
        <PhLock v-else class="w-4 h-4" />
        Editar costos manualmente
      </button>

      <button v-if="claimedFromRecipe.length" type="button" class="ui-btn" @click="restoreRecipeCosts">
        <PhArrowCounterClockwise class="w-4 h-4" />
        Restaurar costos de receta
      </button>

      <button
        v-if="variationGroup.dimensions.length > 1"
        type="button"
        class="ui-btn ml-auto"
        @click="toggleAllGroups"
      >
        <PhCaretDown v-if="allExpanded" class="w-4 h-4" />
        <PhCaretRight v-else class="w-4 h-4" />
        {{ allExpanded ? 'Contraer todo' : 'Expandir todo' }}
      </button>
    </div>

    <span v-if="showCostToggle" class="ui-field-hint">
      {{ costsUnlocked
        ? 'Puedes escribir los costos. Cada costo que cambies deja de calcularse desde la receta; déjalo en 0 para que vuelva a ella.'
        : 'Los costos bloqueados se calculan con las recetas y se actualizan solos. Actívalo para escribirlos tú.' }}
    </span>

    <div class="ui-listhead hidden sm:flex">
      <span class="ui-sectionhead">Variante</span>
      <span class="ui-listhead-col w-28">P. Venta</span>
      <span class="ui-listhead-col w-28">
        P. Costo
        <AppTooltip :text="COST_TOOLTIP" tabindex="0">
          <PhInfo class="w-3.5 h-3.5 ui-ink-muted" />
        </AppTooltip>
      </span>
      <span class="ui-listhead-col w-24">Código</span>
    </div>

    <div class="flex flex-col gap-2">
      <div v-for="(group, gi) in groupsArray" :key="group.key">
        <div class="ui-item ui-item-filled">
          <span class="ui-item-icon w-4">
            <template v-if="variationGroup.dimensions.length > 1">
              <PhCaretDown v-if="group.expanded" class="w-4 h-4" />
              <PhCaretRight v-else class="w-4 h-4" />
            </template>
          </span>

          <div
            class="min-w-0"
            :class="variationGroup.dimensions.length > 1 ? 'cursor-pointer' : ''"
            @click="variationGroup.dimensions.length > 1 ? toggleGroup(group.key) : null"
          >
            <span class="ui-item-title">{{ group.name }}</span>
            <span v-if="group.variants.length > 1" class="ui-item-desc ml-2">
              {{ group.variants.length }} variantes
            </span>
          </div>

          <div class="ui-item-trail max-sm:col-span-full max-sm:justify-between">
            <div class="ui-field w-28 max-sm:flex-1">
              <label class="ui-field-k sm:sr-only" :for="`${uid}-g${gi}-price`">P. Venta</label>
              <div class="ui-field-unit" data-unit="$">
                <UiMoneyInput
                  :id="`${uid}-g${gi}-price`"
                  :model-value="getGroupPriceValue(group.key, 'basePrice') || null"
                  :placeholder="getGroupPriceDisplay(group.key, 'basePrice')"
                  @update:model-value="v => updateGroupPrice(group.key, 'basePrice', v ?? 0)"
                />
              </div>
            </div>

            <div class="ui-field w-28 max-sm:flex-1">
              <label class="ui-field-k sm:sr-only" :for="`${uid}-g${gi}-cost`">P. Costo</label>
              <div class="ui-field-unit" data-unit="$">
                <!-- Live while any row in the group is still manual; the locked
                     rows are skipped by CombinationGroups.updateGroupPrice. -->
                <UiMoneyInput
                  :id="`${uid}-g${gi}-cost`"
                  :model-value="getGroupPriceValue(group.key, 'costPrice') || null"
                  :placeholder="getGroupPriceDisplay(group.key, 'costPrice')"
                  :readonly="isGroupCostLocked(group)"
                  @update:model-value="v => setGroupCost(group, v ?? 0)"
                  @change="commitGroupCost(group)"
                />
              </div>
            </div>

            <div class="ui-field w-24 max-sm:flex-1">
              <label class="ui-field-k sm:sr-only" :for="`${uid}-g${gi}-code`">Código</label>
              <input
                :id="`${uid}-g${gi}-code`"
                type="text"
                class="ui-input"
                :value="getGroupPriceValue(group.key, 'accountingCode')"
                :placeholder="getGroupPriceDisplay(group.key, 'accountingCode')"
                @input="updateGroupPrice(group.key, 'accountingCode', $event.target.value)"
              >
            </div>
          </div>
        </div>

        <div v-if="group.expanded" class="flex flex-col gap-1 mt-1 pl-4 sm:pl-6">
          <div v-for="variant in group.variants" :key="variant.id" class="ui-item">
            <span></span>

            <div class="min-w-0">
              <div class="ui-item-title">
                {{ variant.variantName }}
                <span v-if="variant.isWholeGrain" class="ui-tag ml-1">Integral</span>
              </div>
              <div v-if="variant.originalSelection" class="ui-item-desc">
                {{ variant.originalSelection.join(' • ') }}
              </div>
            </div>

            <div class="ui-item-trail max-sm:col-span-full max-sm:justify-between">
              <div class="ui-field w-28 max-sm:flex-1">
                <label class="ui-field-k sm:sr-only" :for="`${uid}-${variant.id}-price`">P. Venta</label>
                <div class="ui-field-unit" data-unit="$">
                  <UiMoneyInput
                    :id="`${uid}-${variant.id}-price`"
                    :model-value="variant.basePrice"
                    placeholder="0"
                    @update:model-value="v => updateCombinationPrice(variant.id, 'basePrice', v ?? 0)"
                  />
                </div>
              </div>

              <div class="ui-field w-28 max-sm:flex-1">
                <label class="ui-field-k sm:sr-only" :for="`${uid}-${variant.id}-cost`">P. Costo</label>
                <div class="ui-field-unit" data-unit="$">
                  <UiMoneyInput
                    :id="`${uid}-${variant.id}-cost`"
                    :model-value="variant.costPrice"
                    :readonly="isCostLocked(variant)"
                    placeholder="0"
                    @update:model-value="v => setCombinationCost(variant, v ?? 0)"
                    @change="commitCost(variant)"
                  />
                </div>
              </div>

              <div class="ui-field w-24 max-sm:flex-1">
                <label class="ui-field-k sm:sr-only" :for="`${uid}-${variant.id}-code`">Código</label>
                <input
                  :id="`${uid}-${variant.id}-code`"
                  type="text"
                  class="ui-input"
                  :value="variant.accountingCode"
                  @input="updateCombinationPrice(variant.id, 'accountingCode', $event.target.value)"
                >
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="ui-stat">
        <span class="ui-stat-k">Con precios definidos</span>
        <span class="ui-stat-v">{{ summaryStats.withPrices }} / {{ summaryStats.total }}</span>
      </div>
      <div class="ui-stat">
        <span class="ui-stat-k">Precio promedio</span>
        <span class="ui-stat-v">${{ summaryStats.averagePrice.toLocaleString('es-CO') }}</span>
      </div>
      <div class="ui-stat">
        <span class="ui-stat-k">Costo promedio</span>
        <span class="ui-stat-v">${{ summaryStats.averageCost.toLocaleString('es-CO') }}</span>
      </div>
    </div>
  </div>

  <div v-else-if="variationGroup.dimensions.length > 0" class="ui-empty">
    <b>Configurando combinaciones...</b>
    Completa la configuración para ver las combinaciones disponibles.
  </div>
</template>
