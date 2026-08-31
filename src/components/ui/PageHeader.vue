<script setup>
/* Title on the left, actions on the right. The first component in
 * src/components/ui/ — see assets/ui/CLAUDE.md rule 9.
 *
 * data-ui-theme is load-bearing, not decoration: it activates
 * `[data-ui-theme] :is(h1..h6) { color: var(--ui-ink) }` in ui.css, which is
 * what beats the bare-h2 rule custom-components.css puts on every heading.
 * Without it the title falls back to the old fixed neutral. */
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
});
</script>

<template>
  <div
    data-ui-theme="light"
    class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-5"
  >
    <div class="min-w-0">
      <h2 class="text-2xl font-bold tracking-tight m-0">{{ title }}</h2>
      <p v-if="subtitle" class="ui-panehead-sub">{{ subtitle }}</p>
    </div>

    <div class="flex items-center gap-2 flex-wrap">
      <slot />
    </div>
  </div>
</template>
