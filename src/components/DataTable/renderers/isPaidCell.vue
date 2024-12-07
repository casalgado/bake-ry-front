<!-- components/DataTable/renderers/ClientCell.vue -->
<script setup>
import { PhCheckFat, PhMinus, PhGift } from '@phosphor-icons/vue';
const props = defineProps({
  isPaid: {
    type: Boolean,
    default: false,
  },
  isComplimentary: {
    type: Boolean,
    default: false,
  },
});

</script>

<template>
  <PhGift v-if="isComplimentary" size="1.3rem" weight="fill"/>
  <PhCheckFat v-else-if="isPaid" size="1.3rem" weight="fill"/>
  <PhMinus v-else size="1.3rem" />
</template>
