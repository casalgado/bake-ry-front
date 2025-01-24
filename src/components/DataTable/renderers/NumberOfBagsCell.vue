<script setup>
import { PhBag } from  '@phosphor-icons/vue';
const props = defineProps({
  numberOfBags: {
    type: Number,
    required: true,
  },
  show: {
    type: Boolean,
    required: true,
  },
});
</script>

<template>
  <div v-if="show" class="flex items-center justify-center gap-1"> <PhBag weight="regular" size="1.3rem"  /> <span>{{ numberOfBags }}</span></div>
</template>
