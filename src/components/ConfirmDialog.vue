
<script setup>
import { Dialog, DialogPanel } from '@headlessui/vue';
import { PhWarning } from '@phosphor-icons/vue';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: 'Confirm Action',
  },
  message: {
    type: String,
    default: 'Are you sure you want to proceed?',
  },
  confirmText: {
    type: String,
    default: 'Confirm',
  },
  cancelText: {
    type: String,
    default: 'Cancel',
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['confirm', 'cancel']);

const handleConfirm = () => {
  emit('confirm');
};

const handleCancel = () => {
  emit('cancel');
};
</script>

<template>
  <Dialog :open="isOpen" @close="handleCancel" class="relative z-50">
    <div class="fixed inset-0 bg-black/30" aria-hidden="true" />
    <div class="fixed inset-0 flex items-center justify-center p-4">
      <DialogPanel class="bg-white rounded-lg p-6 max-w-md w-full">
        <div class="flex items-center mb-4">
          <div class="flex-shrink-0 w-10 h-10 mx-auto flex items-center justify-center rounded-full bg-orange-100">
            <PhWarning class="w-6 h-6 text-orange-600" />
          </div>
        </div>

        <div class="text-center">
          <h3 class="text-lg font-semibold text-gray-800 mb-2">
            {{ title }}
          </h3>
          <p class="text-sm text-gray-700 mb-6">
            {{ message }}
          </p>
        </div>

        <div class="flex space-x-3">
          <button
            @click="handleCancel"
            class="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-colors"
            :disabled="loading"
          >
            {{ cancelText }}
          </button>
          <button
            @click="handleConfirm"
            class="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 transition-colors"
            :disabled="loading"
          >
            <span v-if="loading" class="flex items-center justify-center">
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading...
            </span>
            <span v-else>{{ confirmText }}</span>
          </button>
        </div>
      </DialogPanel>
    </div>
  </Dialog>
</template>
