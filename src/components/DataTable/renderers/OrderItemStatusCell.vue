<script setup>
import { PhCheckFat, PhMinus } from '@phosphor-icons/vue';
defineProps({
  status: {
    type: Number,
    default: 0,
  },
});
</script>

<template>
  <div v-if="status === 0">
    -
  </div>
  <div v-else-if="status === 1">
    preparado
  </div>
  <div v-else-if="status === 2">
    enviado
  </div>

</template>
