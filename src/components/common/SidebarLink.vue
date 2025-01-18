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

const handleClick = (e) => {
  // For right clicks, let the browser handle it naturally
  if (e.button !== 2) {
    e.preventDefault();
    emit('click');
  }
};
</script>

<template>
  <div
    @click="handleClick"
    @contextmenu="handleClick"
    :class="{
      'flex items-center w-full gap-2 ml-2 px-3 py-1 rounded-md transition-colors mb-0.5 text-neutral-850 cursor-pointer': true,
      'bg-neutral-200': isActive,
      'hover:bg-neutral-200': !isActive
    }"
  >
    <component :is="icon" :size="20" :weight="isActive ? 'regular' : 'regular'" />
    <h4 class="m-0">{{ text }}</h4>
  </div>
</template>
