<script setup>
import { useId, nextTick } from 'vue';

const props = defineProps({
  modelValue: { type: [String, Number, Boolean], default: '' },
  options: { type: Array, required: true }, // [{ value, label }]
  label: { type: String, required: true },
  required: { type: Boolean, default: false },
  minWidth: { type: String, default: '7rem' }, // narrowest a pill may get before the row wraps
});
const emit = defineEmits(['update:modelValue', 'change']);

const uid = useId();

// Controlled: repaint from the model once the parent has answered. See UiYesNo.
const pick = (event, value) => {
  emit('update:modelValue', value);
  emit('change', value);
  nextTick(() => { event.target.checked = props.modelValue === value; });
};
</script>

<template>
  <div class="ui-field">
    <span :id="`${uid}-k`" class="ui-field-k" :data-required="required || undefined">{{ label }}</span>
    <div
      class="grid gap-1.5"
      role="radiogroup"
      :aria-labelledby="`${uid}-k`"
      :style="{ gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}, 1fr))` }"
    >
      <template v-for="o in options" :key="o.value">
        <input
          :id="`${uid}-${o.value}`"
          class="sr-only"
          type="radio"
          :name="uid"
          :checked="modelValue === o.value"
          @change="pick($event, o.value)"
        >
        <label class="ui-btn justify-center w-full" :for="`${uid}-${o.value}`">{{ o.label }}</label>
      </template>
    </div>
  </div>
</template>
