<script setup>
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

  <span>{{ drivers.find(driver => driver.value === driverId)?.displayText || '-' }}</span>
</template>
