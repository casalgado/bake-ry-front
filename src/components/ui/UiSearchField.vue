<script setup>
/* The behaviour half of `.ui-search` (assets/ui/CLAUDE.md rule 9): the colors
 * are CSS, but `role="searchbox"`, `enterkeyhint` and Escape-to-clear are
 * template, and a CSS file cannot hold those.
 *
 * `type="text"`, never `type="search"`: the native clear button is a
 * browser-drawn bitmap in a fixed blue-grey that `color` cannot reach, so the
 * button is ours and the behaviour it gave away is restored here.
 *
 * Layout classes fall through to the root, so call sites keep writing
 * `class="mb-3"` / `class="w-40"` the way they did around the bare div. */
import { PhX } from '@phosphor-icons/vue';

defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'Buscar…' },
  // Doubles as the input's accessible name and the clear button's, so a screen
  // with two search boxes never announces the same thing twice.
  label: { type: String, default: 'Buscar' },
});

const emit = defineEmits(['update:modelValue']);
</script>

<template>
  <div class="ui-search">
    <input
      :value="modelValue"
      class="ui-input"
      type="text"
      role="searchbox"
      enterkeyhint="search"
      :placeholder="placeholder"
      :aria-label="label"
      @input="emit('update:modelValue', $event.target.value)"
      @keydown.esc="emit('update:modelValue', '')"
    >
    <button
      v-if="modelValue"
      class="ui-search-clear"
      type="button"
      :aria-label="'Limpiar ' + label.toLowerCase()"
      @click="emit('update:modelValue', '')"
    >
      <PhX :size="12" weight="bold" />
    </button>
  </div>
</template>
