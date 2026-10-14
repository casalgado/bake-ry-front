<script setup>
import { useId } from 'vue';
import { PhCheckFat } from '@phosphor-icons/vue';

/* One independent on/off option drawn as a whole card: icon, title, description.
 * A hidden checkbox feeds the label, and `input:checked + .ui-card` in ui.css
 * paints the selected state; the filled check in the corner says it in a glyph
 * too, since there is no switch in the system.
 *
 * The card is the label, so its subtree holds the description as well. The input
 * names itself with aria-labelledby (title only) and takes the description with
 * aria-describedby, which keeps rule 12's "hint is not part of the name". */
defineProps({
  modelValue: { type: Boolean, default: false },
  icon: { type: [Object, Function], default: null },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
});
defineEmits(['update:modelValue']);

const uid = useId();
</script>

<template>
  <div>
    <input
      :id="uid"
      class="sr-only"
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      :aria-labelledby="`${uid}-t`"
      :aria-describedby="description ? `${uid}-d` : undefined"
      @change="$emit('update:modelValue', $event.target.checked)"
    >
    <label class="ui-card ui-surface-3 ui-card-action relative flex h-full flex-col gap-1.5" :for="uid">
      <span class="flex items-center gap-2.5 pr-6">
        <component :is="icon" v-if="icon" class="ui-ink-muted h-[22px] w-[22px] shrink-0" />
        <span :id="`${uid}-t`" class="ui-card-title">{{ title }}</span>
      </span>
      <span v-if="description" :id="`${uid}-d`" class="ui-card-body">{{ description }}</span>
      <PhCheckFat
        v-if="modelValue"
        :size="18"
        weight="fill"
        class="ui-ink-brand absolute right-3 top-3"
      />
    </label>
  </div>
</template>
