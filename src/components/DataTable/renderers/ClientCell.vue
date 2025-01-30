<!-- components/DataTable/renderers/ClientCell.vue -->
<script setup>
import { PhCheckFat } from '@phosphor-icons/vue';

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
    {{ name }}
    <a
      v-if="phone"
      :href="`tel:${formatPhoneNumber(phone)}`"
      class="underline cursor-pointer"
    >
      {{ phone }}
    </a>
    <span v-if="comment" class="text-xs text-neutral-500">{{ comment }}</span>
    <PhCheckFat v-if="showIsPaid" weight="fill"  class="absolute top-[2px] left-[-16px]" />
  </div>
</template>
