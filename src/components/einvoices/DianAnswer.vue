<script setup>
// Everything the DIAN said about a rejected document. A rejection can come with
// no `errors` and its reason only in the description, or only in the raw answer.
defineProps({
  dian: { type: Object, default: null },
});
</script>

<template>
  <div class="ui-card-body flex flex-col gap-1">
    <span class="ui-stat-k">Respuesta de la DIAN{{ dian?.statusCode ? ` (código ${dian.statusCode})` : '' }}</span>
    <span v-if="dian?.statusDescription">{{ dian.statusDescription }}</span>
    <span v-if="dian?.statusMessage">{{ dian.statusMessage }}</span>
    <ul v-if="dian?.errors?.length" class="list-disc pl-5">
      <li v-for="e in dian.errors" :key="e">{{ e }}</li>
    </ul>
    <details v-if="dian?.raw">
      <summary class="cursor-pointer">Respuesta completa</summary>
      <pre class="whitespace-pre-wrap break-all text-xs">{{ dian.raw }}</pre>
    </details>
  </div>
</template>
