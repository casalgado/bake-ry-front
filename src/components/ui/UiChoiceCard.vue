<script setup>
import UiPills from '@/components/ui/UiPills.vue';

/* One-of-several drawn as a card: icon, title, description, and the options as
 * pills underneath. The title doubles as the pills' accessible label, so it is
 * not drawn twice. Same face as UiFeatureCard, different job: that one is an
 * independent on/off, this one is a choice. */
defineProps({
  modelValue: { type: [String, Number, Boolean], default: '' },
  options: { type: Array, required: true }, // [{ value, label }]
  icon: { type: [Object, Function], default: null },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
});
defineEmits(['update:modelValue']);
</script>

<template>
  <div class="ui-card ui-surface-3 flex h-full flex-col gap-3">
    <div class="flex flex-col gap-1.5">
      <span class="flex items-center gap-2.5">
        <component :is="icon" v-if="icon" class="ui-ink-muted h-[22px] w-[22px] shrink-0" />
        <span class="ui-card-title">{{ title }}</span>
      </span>
      <span v-if="description" class="ui-card-body">{{ description }}</span>
    </div>
    <UiPills
      class="mt-auto"
      :model-value="modelValue"
      :options="options"
      :label="title"
      hide-label
      :disabled="disabled"
      @update:model-value="$emit('update:modelValue', $event)"
    />
  </div>
</template>
