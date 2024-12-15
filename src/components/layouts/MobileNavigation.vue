<script setup>
import { ref } from 'vue';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/vue';
import { PhList } from '@phosphor-icons/vue';

const props = defineProps({
  links: {
    type: Array,
    required: true,
  },
  activeRoute: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(['navigate']);
const isOpen = ref(false);

const handleNavigation = (link) => {
  emit('navigate', link);
  isOpen.value = false;
};
</script>

<template>
  <!-- Fixed bottom bar -->
  <div class="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-neutral-200 flex items-center justify-center lg:hidden">
    <button
      @click="isOpen = true"
      class="flex items-center gap-2 px-4 py-2 text-neutral-600 hover:text-primary"
    >
      <PhList class="w-6 h-6" />
      <span>Menu</span>
    </button>
  </div>

  <!-- Full screen dialog for navigation -->
  <Dialog
    :open="isOpen"
    @close="isOpen = false"
    class="relative z-50"
  >
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-black/30" aria-hidden="true" />

    <!-- Full-screen container -->
    <div class="fixed inset-0 flex w-screen">
      <DialogPanel class="w-full bg-white">
        <div class="flex justify-between items-center p-4 border-b border-neutral-200">
          <DialogTitle class="text-lg font-semibold text-neutral-800">
            Menu
          </DialogTitle>
          <button
            @click="isOpen = false"
            class="p-2 text-neutral-600 hover:text-primary"
          >
            ✕
          </button>
        </div>

        <nav class="p-4">
          <button
            v-for="link in links"
            :key="link.id"
            @click="handleNavigation(link)"
            class="w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2"
            :class="[
              activeRoute === link.path
                ? 'bg-primary-100 text-primary-700'
                : 'text-neutral-600 hover:bg-neutral-50'
            ]"
          >
            <component :is="link.icon" class="w-5 h-5" />
            <span>{{ link.text }}</span>
          </button>
        </nav>
      </DialogPanel>
    </div>
  </Dialog>
</template>
