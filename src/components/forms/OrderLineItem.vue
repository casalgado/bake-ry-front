<script setup>
/* One line of the order, read like a receipt: quantity, what, how much. The row
 * shows only what differs from the default (a discount, cortesía, stock); the
 * rest lives in the editor that opens under it. */
import { ref, shallowRef, computed, useId } from 'vue';
import UiPills from '@/components/ui/UiPills.vue';
import UiMoneyInput from '@/components/ui/UiMoneyInput.vue';
import { formatMoney } from '@/utils/helpers';
import { PhMinus, PhPlus, PhCaretDown, PhTrash } from '@phosphor-icons/vue';

const open = ref(false);
const uid = useId();

const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
  index: {
    type: Number,
    required: true,
  },
  inventoryMode: {
    type: String,
    default: 'none',
  },
  available: {
    type: Number,
    default: 0,
  },
  // Units the order's stock lines of this product, together, ask for beyond `available`.
  shortBy: {
    type: Number,
    default: 0,
  },
});

const emit = defineEmits([
  'update:quantity',
  'update:item',
  'update:costPrice',
  'update:taxPercentage',
  'toggle-complimentary',
  'remove',
]);

// Determine if this is a variable price product (basePrice = 0)
const isVariablePrice = computed(() => {
  return props.item.basePrice === 0;
});

// Get the reference price for discount calculations
const effectiveReferencePrice = computed(() => {
  if (isVariablePrice.value) {
    return props.item.referencePrice || props.item.currentPrice;
  }
  return props.item.basePrice;
});

const variantName = computed(() => {
  const { combination, variation } = props.item;
  if (combination) return combination.getDisplayName ? combination.getDisplayName() : combination.name;
  return variation?.name || '';
});

// Read from the line itself, never kept: a row reused for another line (the cart
// replaced by a past order) must not show the previous line's discount.
const discount = computed(() => {
  const { discountType, discountValue, currentPrice } = props.item;
  if (discountType === 'percentage' && discountValue > 0) return discountValue;
  const refPrice = effectiveReferencePrice.value;
  // A price above the list is a surcharge, not a negative discount.
  return refPrice > 0 ? Math.max(0, Math.round(((refPrice - currentPrice) / refPrice) * 100)) : 0;
});

// A cortesía's discount is moot: its total column already says Cortesía.
const hasDiscount = computed(() => !props.item.isComplimentary && discount.value > 0);

const lineTotal = computed(() => (props.item.isComplimentary ? 0 : props.item.currentPrice * props.item.quantity));

// Resale always takes from stock. A shortfall warns, never blocks: stock may go negative.
const fromStock = computed(() =>
  props.inventoryMode === 'unit' || props.item.fulfillmentSource === 'stock');
const isShort = computed(() => fromStock.value && props.shortBy > 0);

// Names the source, not just a figure: "24 disponibles" alone reads as a fact,
// not as "this comes off the shelf". Disponible / Producir stay the inventory's
// words (zplanning/inventory/INVENTORY.md). A shortfall adds "faltan N" beside
// it, so "disponibles" shortens to keep the line from wrapping.
const sourceLabel = computed(() => {
  if (!fromStock.value) return 'Producir';
  if (isShort.value) return `Del stock · ${props.available} disp.`;
  return `Del stock · ${props.available} ${props.available === 1 ? 'disponible' : 'disponibles'}`;
});

const sourceOptions = computed(() => [
  { value: 'stock', label: `Del stock (${props.available})` },
  { value: 'produce', label: 'Producir' },
]);

const setFulfillmentSource = (source) => {
  emit('update:item', props.index, { fulfillmentSource: source });
};

const costValidationError = computed(() => {
  if (props.item.costPrice < 0) return 'El costo no puede ser negativo.';
  if (props.item.costPrice > props.item.currentPrice) return 'El costo supera el precio de venta.';
  return null;
});

const handleQuantityChange = (delta) => {
  const newQuantity = props.item.quantity + delta;
  if (newQuantity >= 1) {
    emit('update:quantity', props.index, newQuantity);
  }
};

// Armed for one version of the line: any edit replaces the item and disarms it.
const armedItem = shallowRef(null);
const confirmRemove = computed(() => armedItem.value === props.item);

// At 1 the minus becomes a remove; the first tap arms it, the second removes.
const handleMinus = () => {
  if (props.item.quantity > 1) return handleQuantityChange(-1);
  if (confirmRemove.value) return emit('remove', props.index);
  armedItem.value = props.item;
};

const handleQuantityInput = (event) => {
  const newValue = parseInt(event.target.value) || 1;
  if (newValue >= 1) {
    emit('update:quantity', props.index, newValue);
  }
};

// Price and discount are one value seen two ways: editing either rewrites the other.
const handlePriceChange = (value) => {
  const newPrice = value ?? 0;

  if (isVariablePrice.value) {
    emit('update:item', props.index, {
      currentPrice: newPrice,
      referencePrice: newPrice,
      discountType: null,
      discountValue: 0,
    });
  } else {
    const discountVal = Math.max(0, Math.round(((props.item.basePrice - newPrice) / props.item.basePrice) * 100));
    emit('update:item', props.index, {
      currentPrice: newPrice,
      discountType: 'percentage',
      discountValue: discountVal,
    });
  }
};

const handleDiscountChange = (event) => {
  const percent = Math.min(100, Math.max(0, Number(event.target.value)));
  const newPrice = Math.round(effectiveReferencePrice.value * (1 - percent / 100));
  emit('update:item', props.index, {
    currentPrice: newPrice,
    discountType: 'percentage',
    discountValue: percent,
  });
};

const handleCostPriceChange = (value) => {
  emit('update:costPrice', props.index, value ?? 0);
};

const handleTaxPercentageChange = (event) => {
  emit('update:taxPercentage', props.index, Math.max(0, Math.min(100, Number(event.target.value))));
};

</script>

<template>
  <div
    class="ui-item ui-item-filled !items-start !gap-x-3 !gap-y-2"
    style="grid-template-columns: auto minmax(0, 1fr) auto auto"
  >
    <!-- Quantity stays in the row: it is the edit made most. Centred on the
         summary line; the open editor is a grid row of its own below it. -->
    <div class="flex items-center gap-1 self-center">
      <button
        type="button"
        class="ui-btn ui-btn-icon"
        :class="{ 'ui-btn-danger': confirmRemove }"
        :aria-label="item.quantity > 1 ? 'Uno menos' : (confirmRemove ? 'Confirmar quitar' : 'Quitar del pedido')"
        @click="handleMinus"
        @blur="armedItem = null"
      >
        <PhMinus v-if="item.quantity > 1" :size="11" weight="bold" />
        <PhTrash v-else :size="11" weight="bold" />
      </button>
      <input
        type="number"
        class="ui-input ui-input-num !text-center !px-1 w-10"
        :value="item.quantity"
        min="1"
        step="1"
        :aria-label="`Cantidad de ${item.productName}`"
        @input="handleQuantityInput"
        @focus="$event.target.select()"
        @wheel.prevent
      >
      <button
        type="button"
        class="ui-btn ui-btn-icon"
        aria-label="Uno más"
        @click="handleQuantityChange(1)"
      >
        <PhPlus :size="11" weight="bold" />
      </button>
    </div>

    <button
      type="button"
      class="min-w-0 text-left self-center !m-0 !p-0"
      :aria-expanded="open"
      :aria-controls="`${uid}-editor`"
      @click="open = !open"
    >
      <!-- What, read as a path: the collection is context, so muted. -->
      <span class="ui-item-title !whitespace-normal line-clamp-2 block">
        <span class="ui-ink-muted font-normal">{{ item.collectionName }} · </span>{{ item.productName }}<template v-if="variantName"> · {{ variantName }}</template>
      </span>
      <!-- Only what differs from the default, as one muted line of text; with
           nothing to say there is no second line. A shortfall is the one part
           in full ink and weight: emphasis, not a red word (ui rule 5). -->
      <span
        v-if="hasDiscount || inventoryMode === 'recipe' || inventoryMode === 'unit'"
        class="ui-item-desc block mt-0.5"
      >
        <template v-if="hasDiscount">-{{ discount }}%</template>
        <template v-if="hasDiscount && (inventoryMode === 'recipe' || inventoryMode === 'unit')"> · </template>
        <template v-if="inventoryMode === 'recipe' || inventoryMode === 'unit'">{{ sourceLabel }}</template>
        <span v-if="isShort" class="font-semibold" style="color: var(--ui-ink)"> · {{ shortBy === 1 ? 'falta' : 'faltan' }} {{ shortBy }}</span>
      </span>
    </button>

    <span class="flex flex-col items-end self-center">
      <span class="ui-item-num">{{ formatMoney(lineTotal) }}</span>
      <!-- Shown at every quantity, so the unit price is always in view and the
           card never changes height. On a cortesía it says why the total is $0. -->
      <span class="ui-item-desc ui-num">
        <template v-if="item.isComplimentary">Cortesía</template>
        <template v-else>{{ item.quantity }} × {{ formatMoney(item.currentPrice) }}</template>
      </span>
    </span>

    <button
      type="button"
      class="ui-btn ui-btn-icon self-center"
      :aria-label="open ? 'Cerrar detalle' : 'Editar línea'"
      :aria-expanded="open"
      :aria-controls="`${uid}-editor`"
      @click="open = !open"
    >
      <PhCaretDown :size="12" weight="bold" :class="{ 'rotate-180': open }" />
    </button>

    <!-- The editor: everything that is not quantity. -->
    <div
      v-if="open"
      :id="`${uid}-editor`"
      class="col-span-full flex flex-col gap-3 pb-1"
    >
      <div class="grid grid-cols-2 gap-3">
        <div class="ui-field">
          <label class="ui-field-k" :for="`${uid}-price`">Precio unitario</label>
          <div class="ui-field-unit" data-unit="$">
            <UiMoneyInput
              :id="`${uid}-price`"
              :model-value="item.currentPrice"
              :disabled="item.isComplimentary"
              @update:model-value="handlePriceChange"
              @focus="$event.target.select()"
            />
          </div>
        </div>
        <div class="ui-field">
          <label class="ui-field-k" :for="`${uid}-discount`">Descuento</label>
          <div class="ui-field-unit" data-unit="%">
            <input
              :id="`${uid}-discount`"
              type="number"
              class="ui-input ui-input-num"
              :value="discount"
              min="0"
              max="100"
              :disabled="item.isComplimentary"
              @input="handleDiscountChange"
              @focus="$event.target.select()"
              @wheel.prevent
            >
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-end gap-3">
        <button
          type="button"
          class="ui-btn"
          :aria-pressed="!!item.isComplimentary"
          @click="emit('toggle-complimentary', index)"
        >
          Cortesía
        </button>
        <UiPills
          v-if="inventoryMode === 'recipe'"
          class="flex-1 min-w-[12rem]"
          label="Origen"
          min-width="7rem"
          :model-value="fromStock ? 'stock' : 'produce'"
          :options="sourceOptions"
          @update:model-value="setFulfillmentSource"
        />
      </div>

      <div class="ui-sectionhead !mb-0">Impuesto y costo</div>
      <div class="grid grid-cols-2 gap-3">
        <div class="ui-field">
          <label class="ui-field-k" :for="`${uid}-tax`">IVA</label>
          <div class="ui-field-unit" data-unit="%">
            <input
              :id="`${uid}-tax`"
              type="number"
              class="ui-input ui-input-num"
              :value="item.taxPercentage || 0"
              min="0"
              max="100"
              step="0.5"
              :disabled="item.isComplimentary"
              @input="handleTaxPercentageChange"
              @focus="$event.target.select()"
              @wheel.prevent
            >
          </div>
        </div>
        <div class="ui-field">
          <label class="ui-field-k" :for="`${uid}-cost`">Costo</label>
          <div class="ui-field-unit" data-unit="$">
            <UiMoneyInput
              :id="`${uid}-cost`"
              :model-value="item.costPrice || 0"
              :disabled="item.isComplimentary"
              :aria-invalid="!!costValidationError"
              :aria-describedby="costValidationError ? `${uid}-cost-e` : undefined"
              @update:model-value="handleCostPriceChange"
              @focus="$event.target.select()"
            />
          </div>
          <span v-if="costValidationError" :id="`${uid}-cost-e`" class="ui-field-hint">
            {{ costValidationError }}
          </span>
        </div>
      </div>

      <!-- Takes the line out of the draft: a back-out, so danger outline. -->
      <div class="flex justify-end">
        <button type="button" class="ui-btn ui-btn-danger" @click="emit('remove', index)">
          <PhTrash :size="13" weight="bold" />
          Quitar del pedido
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
input[type='number'] {
  -moz-appearance: textfield;
  appearance: textfield;
}

input[type='number']::-webkit-outer-spin-button,
input[type='number']::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
