<script setup>
defineProps({
  icon: {
    type: Object,
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['click']);

const handleClick = () => {
  emit('click');
};
</script>

<template>
  <button
    type="button"
    @click="handleClick"
    :class="{
      'flex items-center w-full gap-2 px-3 py-1 rounded-md transition-colors mb-0.5 text-neutral-850': true,
      'bg-neutral-200': isActive,
      'hover:bg-neutral-200': !isActive
    }"
  >
    <component :is="icon" :size="20" :weight="isActive ? 'regular' : 'regular'" />
    <h5 class="m-0 text-neutral-850">{{ text }}</h5>
  </button>
</template>
