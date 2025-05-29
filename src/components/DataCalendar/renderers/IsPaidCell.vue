<!-- components/DataTable/renderers/ClientCell.vue -->
<script setup>
import { PhCheckFat, PhMinus, PhGift, PhOven, PhMoped, PhBuilding } from '@phosphor-icons/vue';
const props = defineProps({
  isPaid: {
    type: Boolean,
    default: false,
  },
  isComplimentary: {
    type: Boolean,
    default: false,
  },
  orderStatus: {
    type: Number,
    default: 0,
  },
});

</script>

<template>
  <!-- <PhOven v-if="orderStatus == 1" class="absolute left-[-5px] top-[-5px]" />
  <PhMoped v-else-if="orderStatus == 2" class="absolute left-[-5px] top-[-5px]" />
  <PhBuilding v-else-if="orderStatus == 3" class="absolute left-[-5px] top-[-5px]" /> -->

  <PhGift v-if="isComplimentary" size="1.3rem" weight="fill"/>
  <PhCheckFat v-else-if="isPaid" size="1.3rem" weight="fill"/>
  <PhMinus v-else size="1.3rem" />
</template>
