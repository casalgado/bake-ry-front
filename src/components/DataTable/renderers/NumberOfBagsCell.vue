<script setup>
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
  <span v-if="show">{{ numberOfBags }}</span>
</template>
