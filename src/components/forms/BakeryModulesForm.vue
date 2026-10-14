<script setup>
/* What only a system admin switches on for a business: POS and the opt-in
 * modules. Same contract as BakeryFeaturesForm — `save` carries a features patch
 * of just these keys, `isDirty` is exposed. */
import { watch } from 'vue';
import { useDraft } from '@/composables/useUnsavedChanges';
import { formToFeatures, ADMIN_FIELDS } from '@/utils/settingsForm';
import PosSection from '@/components/settings/PosSection.vue';
import ModulesSection from '@/components/settings/ModulesSection.vue';

const props = defineProps({
  title: {
    type: String,
    default: 'Configuración',
  },
  initialData: {
    type: Object,
    default: null,
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

const handleSubmit = () => {
  if (isDirty.value) emit('save', formToFeatures(form.value, ADMIN_FIELDS));
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

    <PosSection v-model="form" :disabled="loading" />
    <ModulesSection v-model="form" :disabled="loading" />

    <div class="flex gap-2 justify-end">
      <button type="button" class="ui-btn ui-btn-danger" :disabled="loading || !isDirty" @click="reset">
        Cancelar
      </button>
      <button type="submit" class="ui-btn ui-btn-solid" :disabled="loading || !isDirty">
        {{ loading ? 'Guardando...' : 'Guardar cambios' }}
      </button>
    </div>
  </form>
</template>
