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
  // Add a 'to' prop for the href attribute of the <a> tag
  to: {
    type: [String, Object], // Can be a string for a simple URL or an object for router-link like behavior
    default: '#', // Default to '#' if no link is provided
  },
});

const emit = defineEmits(['click']);

const handleClick = (e) => {
  // If it's a left click (button 0) and not a modifier key (Ctrl/Cmd, Shift),
  // prevent default to allow our custom click handling.
  // Otherwise, let the browser handle it (e.g., right-click, middle-click, or modifier + click).
  if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
    e.preventDefault();
    emit('click');
  }
  // For right-clicks (button 2) and middle-clicks (button 1),
  // the browser will naturally handle opening in a new tab if 'href' is present.
  // No need to prevent default here.
};
</script>

<template>
  <a
    :href="to"
    @click="handleClick"
    :class="{
      'flex items-center w-full gap-2 ml-2 px-3 py-1 rounded-md transition-colors mb-0.5 text-neutral-850 cursor-pointer': true,
      'bg-neutral-200': isActive,
      'hover:bg-neutral-200': !isActive,
    }"
  >
    <component :is="icon" :size="20" :weight="isActive ? 'regular' : 'regular'" />
    <h4 class="m-0">{{ text }}</h4>
  </a>
</template>
