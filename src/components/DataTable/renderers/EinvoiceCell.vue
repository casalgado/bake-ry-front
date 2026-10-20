<script setup>
import { computed } from 'vue';
import {
  PhFileDashed,
  PhSignature,
  PhHourglassMedium,
  PhCheckCircle,
  PhXCircle,
  PhProhibit,
} from '@phosphor-icons/vue';
import AppTooltip from '@/components/common/AppTooltip.vue';

const props = defineProps({
  einvoice: {
    type: Object,
    default: null,
  },
});

const STATES = {
  draft: { label: 'en preparación', icon: PhFileDashed },
  signed: { label: 'sin enviar', icon: PhSignature },
  sent: { label: 'verificando', icon: PhHourglassMedium },
  accepted: { label: 'aceptada', icon: PhCheckCircle },
  rejected: { label: 'rechazada', icon: PhXCircle },
  annulled: { label: 'anulada', icon: PhProhibit },
};

const state = computed(() => {
  if (!props.einvoice) return null;
  return STATES[props.einvoice.annulled ? 'annulled' : props.einvoice.status];
});

const tooltip = computed(() => state.value && `${props.einvoice.number} · ${state.value.label}`);
</script>

<template>
  <AppTooltip v-if="state" :text="tooltip" tabindex="0">
    <component
      :is="state.icon"
      class="w-5 h-5"
      role="img"
      :aria-label="tooltip"
    />
  </AppTooltip>
  <span v-else>-</span>
</template>
