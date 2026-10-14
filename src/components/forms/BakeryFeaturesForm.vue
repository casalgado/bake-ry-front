<script setup>
/* The business owner's settings: orders, reports, invoicing. Third form on the
 * ui-* system. Nothing saves on its own: the parent gets `save` with a features
 * patch holding only the keys this form owns (the backend merges it group by
 * group), and `isDirty` is exposed so the page can warn before leaving. */
import { computed, watch } from 'vue';
import { useDraft } from '@/composables/useUnsavedChanges';
import { formToFeatures, hasChosenPaymentMethod, OWNER_FIELDS } from '@/utils/settingsForm';
import OrdersSection from '@/components/settings/OrdersSection.vue';
import ReportsSection from '@/components/settings/ReportsSection.vue';
import InvoicingSection from '@/components/settings/InvoicingSection.vue';

const props = defineProps({
  title: {
    type: String,
    default: 'Configuración',
  },
  // Flat form values, see featuresToForm. null until the settings are loaded.
  initialData: {
    type: Object,
    default: null,
  },
  paymentMethods: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['save']);

const { form, isDirty, load, reset, isStale } = useDraft();

watch(() => props.initialData, (data) => {
  if (isStale(data)) load(data);
}, { immediate: true, deep: true });

const canSave = computed(() => isDirty.value && hasChosenPaymentMethod(form.value));

const handleSubmit = () => {
  if (canSave.value) emit('save', formToFeatures(form.value, OWNER_FIELDS));
};

defineExpose({ isDirty });
</script>

<template>
  <form
    v-if="form"
    class="ui-card flex flex-col gap-5"
    data-ui-theme="light"
    @submit.prevent="handleSubmit"
  >
    <h2 class="ui-panehead-title">{{ title }}</h2>

    <OrdersSection v-model="form" :payment-methods="paymentMethods" :disabled="loading" full />
    <ReportsSection v-model="form" :disabled="loading" />
    <InvoicingSection v-model="form" :disabled="loading" />

    <!-- Cancelar backs out of the edits, so it is danger outline; Guardar is the one solid. -->
    <div class="flex gap-2 justify-end">
      <button type="button" class="ui-btn ui-btn-danger" :disabled="loading || !isDirty" @click="reset">
        Cancelar
      </button>
      <button type="submit" class="ui-btn ui-btn-solid" :disabled="loading || !canSave">
        {{ loading ? 'Guardando...' : 'Guardar cambios' }}
      </button>
    </div>
  </form>
</template>
