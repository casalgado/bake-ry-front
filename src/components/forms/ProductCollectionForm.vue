<script setup>
/* Second form on the ui-* system; same contract as BakeryUserForm: props and
 * emits unchanged, no width of its own (the host sets 48rem).
 *
 * The legacy per-collection variationTemplates editor is gone. Nothing in the
 * UI could switch it on any more (dimensionTemplates replaced it), and the
 * `...initialData` spread below still carries an old array through on submit. */
import { ref, computed, watch } from 'vue';
import { cleanString } from '@/utils/helpers';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import UiYesNo from '@/components/ui/UiYesNo.vue';
import VariationsManager from '@/components/forms/VariationsManager.vue';

const props = defineProps({
  title: {
    type: String,
    default: 'Crear Categoría',
  },
  initialData: {
    type: Object,
    default: () => null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['submit', 'cancel']);

const hasDimensionTemplates = ref(
  props.initialData?.dimensionTemplates?.dimensions?.length > 0 || false,
);

const formData = ref(
  props.initialData
    ? {
      ...props.initialData,
      variationTemplates: props.initialData.variationTemplates
        ? props.initialData.variationTemplates.map(t => ({ ...t }))
        : [],
      dimensionTemplates: props.initialData.dimensionTemplates || { dimensions: [] },
      defaultUnit: props.initialData.defaultUnit || 'g',
      hasWholeGrainVariations: props.initialData.hasWholeGrainVariations || false,
    }
    : {
      name: '',
      description: '',
      isActive: true,
      displayOrder: 0,
      defaultVariationType: '',
      defaultUnit: 'g',
      hasWholeGrainVariations: false,
      variationTemplates: [],
      dimensionTemplates: { dimensions: [] },
    },
);

const errors = ref({});

const confirmDialog = ref({
  isOpen: false,
  title: '',
  message: '',
  onConfirm: null,
});

// Disabling the toggle with dimensions configured asks first, and reverts it until confirmed.
watch(hasDimensionTemplates, (newValue, oldValue) => {
  if (newValue) return;

  if (formData.value.dimensionTemplates.dimensions.length === 0) {
    formData.value.dimensionTemplates = { dimensions: [] };
    return;
  }

  confirmDialog.value = {
    isOpen: true,
    title: 'Eliminar variaciones',
    message: '¿Estás seguro de que deseas eliminar todas las variaciones? Esta acción no se puede deshacer.',
    onConfirm: () => {
      formData.value.dimensionTemplates = { dimensions: [] };
      confirmDialog.value.isOpen = false;
    },
    onCancel: () => {
      hasDimensionTemplates.value = oldValue;
      confirmDialog.value.isOpen = false;
    },
  };
  hasDimensionTemplates.value = oldValue;
});

const submitButtonText = computed(() => {
  return props.initialData ? 'Actualizar Categoría' : 'Crear Categoría';
});

const loadingText = computed(() => {
  return props.initialData ? 'Actualizando...' : 'Creando...';
});

const validate = () => {
  errors.value = {};

  if (!formData.value.name) {
    errors.value.name = 'Nombre es requerido';
  }
  if (formData.value.name.length < 3) {
    errors.value.name = 'Nombre debe tener al menos 3 caracteres';
  }

  return Object.keys(errors.value).length === 0;
};

const handleSubmit = () => {
  if (!validate()) return;

  formData.value.name = cleanString(formData.value.name);

  emit('submit', formData.value);
};

// Only dimensions are stored on a category; combinations belong to the product.
const handleDimensionTemplateUpdate = (variationData) => {
  formData.value.dimensionTemplates = {
    dimensions: variationData.dimensions || [],
  };
};
</script>

<template>
  <form
    class="ui-card flex flex-col gap-4"
    data-ui-theme="light"
    @submit.prevent="handleSubmit"
  >
    <h2 class="ui-panehead-title">{{ title }}</h2>

    <div class="ui-field">
      <label class="ui-field-k" for="name" data-required>Nombre</label>
      <input
        id="name"
        v-model="formData.name"
        type="text"
        class="ui-input"
        required
        :aria-invalid="!!errors.name"
        :aria-describedby="errors.name ? 'name-e' : undefined"
      >
      <span v-if="errors.name" id="name-e" class="ui-field-error">
        {{ errors.name }}
      </span>
    </div>

    <div class="ui-field">
      <label class="ui-field-k" for="description">Descripción</label>
      <textarea
        id="description"
        v-model="formData.description"
        class="ui-input ui-input-area"
        rows="3"
      ></textarea>
    </div>

    <div class="ui-sectionhead">Variaciones</div>

    <div class="flex flex-col gap-1">
      <UiYesNo
        v-model="hasDimensionTemplates"
        label="¿Los productos de esta categoria tendran variaciones?"
      />
      <span v-if="hasDimensionTemplates" class="ui-field-hint">
        Las variaciones definidas aquí se cargarán automáticamente al crear productos en esta categoría
      </span>
    </div>

    <VariationsManager
      v-if="hasDimensionTemplates"
      :initial-variations="formData.dimensionTemplates"
      :product-name="`Plantilla para ${formData.name || 'Categoría'}`"
      :is-category-template-mode="true"
      @update="handleDimensionTemplateUpdate"
    />

    <!-- Cancelar backs out, so it is danger outline; the one solid button commits. -->
    <div class="flex gap-2 justify-end">
      <button type="button" class="ui-btn ui-btn-danger" :disabled="loading" @click="emit('cancel')">
        Cancelar
      </button>
      <button type="submit" class="ui-btn ui-btn-solid" :disabled="loading">
        {{ loading ? loadingText : submitButtonText }}
      </button>
    </div>

    <ConfirmDialog
      :is-open="confirmDialog.isOpen"
      :title="confirmDialog.title"
      :message="confirmDialog.message"
      confirm-text="Confirmar"
      cancel-text="Cancelar"
      @confirm="confirmDialog.onConfirm"
      @cancel="confirmDialog.onCancel"
    />
  </form>
</template>
