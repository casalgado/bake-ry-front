<script setup>
import { capitalize } from '@/utils/helpers';

const props = defineProps({
  driverId: {
    type: String,
    required: true,
  },
  drivers: {
    type: Array,
    required: true,
  },
});
</script>

<template>

  <span>{{ capitalize(drivers.find(driver => driver.value === driverId)?.displayText) || '-' }}</span>
</template>
