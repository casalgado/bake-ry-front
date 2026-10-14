<script setup>
import { computed, useId, useSlots, nextTick } from 'vue';

const props = defineProps({
  modelValue: { type: [String, Number, Boolean], default: '' },
  options: { type: Array, required: true }, // [{ value, label, icon? }], icon a component
  label: { type: String, required: true },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  hideLabel: { type: Boolean, default: false }, // the label stays for screen readers; a card above already shows the title
  minWidth: { type: String, default: '7rem' }, // narrowest a pill may get before the row wraps
  columns: { type: Number, default: null }, // a fixed count instead of wrapping by minWidth
});
const emit = defineEmits(['update:modelValue', 'change']);

const uid = useId();
const slots = useSlots();

const gridColumns = computed(() => (props.columns
  ? `repeat(${props.columns}, minmax(0, 1fr))`
  : `repeat(auto-fit, minmax(${props.minWidth}, 1fr))`));

// A row whose option can turn into an input takes the input's height, pills
// included, so swapping one for the other never moves the row.
const turnsIntoField = computed(() => Object.keys(slots).some((name) => name.startsWith('selected-')));

// Controlled: repaint from the model once the parent has answered. See UiYesNo.
const pick = (event, value) => {
  emit('update:modelValue', value);
  emit('change', value);
  nextTick(() => { event.target.checked = props.modelValue === value; });
};
</script>

<template>
  <div class="ui-field">
    <span
      :id="`${uid}-k`"
      class="ui-field-k"
      :class="{ 'sr-only': hideLabel }"
      :data-required="required || undefined"
    >{{ label }}</span>
    <div
      class="grid gap-1.5"
      role="radiogroup"
      :aria-labelledby="`${uid}-k`"
      :style="{ gridTemplateColumns: gridColumns }"
    >
      <template v-for="o in options" :key="o.value">
        <input
          :id="`${uid}-${o.value}`"
          class="sr-only"
          type="radio"
          :name="uid"
          :checked="modelValue === o.value"
          :disabled="disabled"
          @change="pick($event, o.value)"
        >
        <!-- `selected-<value>` replaces that option once it is picked, in the same
             cell (Otro → its input). The other options stay, and picking one is
             the way back. -->
        <slot
          v-if="modelValue === o.value && $slots[`selected-${o.value}`]"
          :name="`selected-${o.value}`"
        />
        <!-- With icons, start-aligned so the glyphs form a column; labels of
             different lengths centred around them read as ragged. A label too
             long for its pill ends in "…", and the title carries the rest. -->
        <label
          v-else
          class="ui-btn w-full min-w-0"
          :class="[o.icon ? 'justify-start' : 'justify-center', { 'ui-btn-field': turnsIntoField }]"
          :for="`${uid}-${o.value}`"
          :title="o.label"
        >
          <!-- Sized by class: the brand marks are SVG components with no size prop. -->
          <component :is="o.icon" v-if="o.icon" class="w-3.5 h-3.5 flex-none" aria-hidden="true" />
          <span class="truncate">{{ o.label }}</span>
        </label>
      </template>
    </div>
  </div>
</template>
