<!-- components/DataTable/renderers/ClientCell.vue -->
<script setup>
import { PhCheckFat } from '@phosphor-icons/vue';
import { formatTime } from '@/utils/helpers';

defineProps({
  name: String,
  phone: String,
  showIsPaid: {
    type: Boolean,
    default: false,
  },
  comment: {
    type: String,
    default: null,
  },
  dueTime: {
    type: String,
    default: null,
  },
});

const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  // Remove any non-digit characters for the href
  const cleanPhone = phone.replace(/\D/g, '');
  return cleanPhone;
};
</script>

<template>
  <div class="flex flex-col">
    <span class="flex items-center gap-2">
      {{ name }}
      <PhCheckFat v-if="showIsPaid" weight="fill" class="w-3 h-3 flex-shrink-0" />
    </span>
    <a
      v-if="phone"

      :href="`tel:${formatPhoneNumber(phone)}`"
      class="underline cursor-pointer"

    >
      {{ phone }}
    </a>
    <span v-if="dueTime" class="text-xs text-neutral-500">{{ formatTime(dueTime) }}</span>
    <span v-if="comment" class="text-xs text-neutral-500">{{ comment }}</span>

  </div>
</template>
