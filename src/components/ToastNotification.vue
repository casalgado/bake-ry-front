
<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { PhCheckCircle, PhWarningCircle, PhInfo, PhX } from '@phosphor-icons/vue';

const toasts = ref([]);

const addToast = (toast) => {
  const id = Date.now() + Math.random();
  const newToast = {
    id,
    type: 'info',
    duration: 5000,
    ...toast,
  };

  toasts.value.push(newToast);

  // Auto remove after duration
  setTimeout(() => {
    removeToast(id);
  }, newToast.duration);

  return id;
};

const removeToast = (id) => {
  const index = toasts.value.findIndex(t => t.id === id);
  if (index > -1) {
    toasts.value.splice(index, 1);
  }
};

// Global toast functions
const showSuccess = (title, message = '', duration = 5000) => {
  return addToast({ type: 'success', title, message, duration });
};

const showError = (title, message = '', duration = 7000) => {
  return addToast({ type: 'error', title, message, duration });
};

const showInfo = (title, message = '', duration = 5000) => {
  return addToast({ type: 'info', title, message, duration });
};

// Expose methods to parent
defineExpose({
  showSuccess,
  showError,
  showInfo,
  addToast,
  removeToast,
});
</script>

<template>
  <div class="fixed top-4 right-4 z-50 space-y-2">
    <TransitionGroup
      name="toast"
      tag="div"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="min-w-80 w-full bg-white shadow-xl rounded-lg pointer-events-auto ring-1 ring-gray-200 overflow-hidden border border-gray-100"
      >
        <div class="p-4">
          <div class="flex items-start">
            <div class="flex-shrink-0">
              <PhCheckCircle v-if="toast.type === 'success'" class="h-6 w-6 text-green-500" />
              <PhWarningCircle v-else-if="toast.type === 'error'" class="h-6 w-6 text-red-500" />
              <PhInfo v-else class="h-6 w-6 text-blue-500" />
            </div>
            <div class="ml-3 w-0 flex-1 pt-0.5">
              <p class="text-sm font-semibold text-gray-800">
                {{ toast.title }}
              </p>
              <p v-if="toast.message" class="mt-1 text-sm text-gray-700">
                {{ toast.message }}
              </p>
            </div>
            <div class="ml-4 flex-shrink-0 flex">
              <button
                @click="removeToast(toast.id)"
                class="bg-white rounded-md inline-flex text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-colors"
              >
                <span class="sr-only">Close</span>
                <PhX class="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.toast-move {
  transition: transform 0.3s ease;
}
</style>
