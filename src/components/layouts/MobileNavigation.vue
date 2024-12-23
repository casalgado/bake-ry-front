<script setup>
import { ref } from 'vue';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/vue';
import { PhList } from '@phosphor-icons/vue';
import SidebarLink from '@/components/common/SidebarLink.vue';

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
  <div class="fixed bottom-0 left-0 right-0 h-10 bg-white border-t border-neutral-200 flex items-center justify-center lg:hidden z-50"  @click="isOpen = true">
    <button

      class="flex items-center gap-2 px-4 py-0 text-neutral-600 hover:text-primary"
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
        <div class="flex justify-between items-center px-4 py-0 border-b border-neutral-200">
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
          <SidebarLink
            v-for="link in links"
            :key="link.id"
            :icon="link.icon"
            :text="link.text"
            :isActive="activeRoute === link.path"
            @click="handleNavigation(link)"
          />
        </nav>
      </DialogPanel>
    </div>
  </Dialog>
</template>
