<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { cleanString, getVariationTypeLabel, capitalize } from '@/utils/helpers';
import { useRouter } from 'vue-router';
import { useSystemSettingsStore } from '@/stores/systemSettingsStore';
import TemplateVariation from '@/components/TemplateVariation.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import YesNoToggle from '@/components/forms/YesNoToggle.vue';

const systemSettingsStore = useSystemSettingsStore();

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

// Form state
const hasVariationTemplates = ref(
  props.initialData?.variationTemplates?.length > 0 || false,
);

const formData = ref(
  props.initialData
    ? {
      ...props.initialData,
      variationTemplates: props.initialData.variationTemplates
        ? props.initialData.variationTemplates.map(t => ({ ...t }))
        : [],
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
    },
);

const errors = ref({});

// Confirm dialog state
const confirmDialog = ref({
  isOpen: false,
  title: '',
  message: '',
  onConfirm: null,
});

// Variation template management
const newTemplate = ref({
  name: '',
  value: 0,
  unit: 'g',
  type: 'WEIGHT',
  isWholeGrain: false,
  displayOrder: 0,
});

// Reset template form
const resetTemplateForm = () => {
  newTemplate.value = {
    name: '',
    value: 0,
    unit: formData.value.defaultUnit || 'g',
    type: formData.value.defaultVariationType || 'WEIGHT',
    isWholeGrain: false,
    displayOrder: formData.value.variationTemplates.length,
  };
};

// Get system default templates
const systemDefaultTemplates = computed(() => {
  if (!systemSettingsStore.isLoaded) return {};
  return systemSettingsStore.defaultVariationTemplates;
});

// Get available unit options from system settings, filtered by template
const unitPillOptions = computed(() => {
  const fallbackOptions = [
    { symbol: 'Kg', name: 'Kilogram', type: 'weight', template: 'WEIGHT' },
    { symbol: 'g', name: 'Gram', type: 'weight', template: 'WEIGHT' },
    { symbol: 'L', name: 'Liter', type: 'volume', template: 'WEIGHT' },
    { symbol: 'ml', name: 'Milliliter', type: 'volume', template: 'WEIGHT' },
    { symbol: 'uds', name: 'Units', type: 'count', template: 'QUANTITY' },
    { symbol: 'docena', name: 'Dozen', type: 'count', template: 'QUANTITY' },
    { symbol: 'paquete', name: 'Package', type: 'count', template: 'QUANTITY' },
  ];

  const allOptions = systemSettingsStore.isLoaded
    ? (systemSettingsStore.unitOptions || fallbackOptions)
    : fallbackOptions;

  // Filter by the selected template type
  const filtered = formData.value.defaultVariationType
    ? allOptions.filter(unit => unit.template === formData.value.defaultVariationType)
    : allOptions;

  // Transform to pill options format (value, label)
  return filtered.map(unit => ({
    value: unit.symbol,
    label: unit.symbol,
    name: unit.name,
  }));
});

// Safely check if unit selection should be shown
const showUnitSelection = computed(() => {
  return formData.value.defaultVariationType &&
         systemDefaultTemplates.value[formData.value.defaultVariationType]?.unit;
});

// Load system defaults for selected type
const loadSystemDefaultTemplates = () => {
  const type = formData.value.defaultVariationType;
  if (!type || !systemDefaultTemplates.value[type]) return;

  const templates = systemDefaultTemplates.value[type].defaults.map((template, index) => ({
    name: template.name,
    value: template.value,
    unit: systemDefaultTemplates.value[type].unit || '',
    type: type,
    isWholeGrain: false,
    displayOrder: index,
  }));

  formData.value.variationTemplates = templates;

  // If whole grain variations are enabled, add integral versions
  if (formData.value.hasWholeGrainVariations) {
    addWholeGrainVariations();
  } else {
    // Sort even if no whole grain variations for consistency
    sortTemplatesInPairs();
  }
};

// Generate whole grain variation from regular variation
const createWholeGrainVariation = (regularVariation) => ({
  name: `${regularVariation.name} integral`,
  value: regularVariation.value,
  unit: regularVariation.unit,
  type: regularVariation.type,
  isWholeGrain: true,
  displayOrder: regularVariation.displayOrder,
  // Note: id is intentionally NOT copied to avoid duplicates
});

// Add whole grain variations for all non-whole-grain templates
const addWholeGrainVariations = () => {
  const regularTemplates = formData.value.variationTemplates.filter(t => !t.isWholeGrain && t.name !== 'otra');
  const wholeGrainTemplates = regularTemplates.map(createWholeGrainVariation);
  formData.value.variationTemplates.push(...wholeGrainTemplates);

  // Sort to maintain pairing
  sortTemplatesInPairs();
};

// Remove all whole grain variations
const removeWholeGrainVariations = () => {
  formData.value.variationTemplates = formData.value.variationTemplates.filter(t => !t.isWholeGrain);
};

// Sort templates to maintain pairing (regular, integral, regular, integral)
const sortTemplatesInPairs = () => {
  const regularTemplates = formData.value.variationTemplates.filter(t => !t.isWholeGrain);
  const sorted = [];

  regularTemplates.forEach(regular => {
    sorted.push(regular);
    // Find corresponding integral variation
    const integral = formData.value.variationTemplates.find(
      t => t.isWholeGrain && t.name === `${regular.name} integral`,
    );
    if (integral) {
      sorted.push(integral);
    }
  });

  // Add any remaining integral variations that don't have a regular counterpart
  const remainingIntegrals = formData.value.variationTemplates.filter(
    t => t.isWholeGrain && !sorted.includes(t),
  );
  sorted.push(...remainingIntegrals);

  formData.value.variationTemplates = sorted;
};

// Add new template
const addNewTemplate = () => {
  if (!newTemplate.value.name || !newTemplate.value.value) {
    return;
  }

  // Create a deep copy to avoid reference issues
  const baseTemplate = {
    name: newTemplate.value.name,
    value: newTemplate.value.value,
    unit: newTemplate.value.unit,
    type: newTemplate.value.type,
    isWholeGrain: false,
    displayOrder: newTemplate.value.displayOrder,
  };

  formData.value.variationTemplates.push(baseTemplate);

  // If whole grain variations are enabled, add integral version
  if (formData.value.hasWholeGrainVariations) {
    const wholeGrainTemplate = createWholeGrainVariation(baseTemplate);
    formData.value.variationTemplates.push(wholeGrainTemplate);
  }

  // Sort to maintain pairing
  sortTemplatesInPairs();
  resetTemplateForm();
};

// Update existing template
const updateTemplate = (index, payload) => {
  formData.value.variationTemplates[index][payload.field] = payload.value;
};

// Update new template
const updateNewTemplate = (payload) => {
  newTemplate.value[payload.field] = payload.value;
};

// Remove template - allow removing any variation independently
const removeTemplate = (index) => {
  formData.value.variationTemplates.splice(index, 1);
};

// Track previous value for cancellation
const previousDefaultVariationType = ref(props.initialData?.defaultVariationType || '');

// Handle default variation type change
const handleDefaultTypeChange = () => {
  if (formData.value.variationTemplates.length > 0) {
    confirmDialog.value = {
      isOpen: true,
      title: 'Cargar plantillas por defecto',
      message: '¿Deseas cargar las plantillas por defecto? Esto reemplazará las plantillas actuales.',
      onConfirm: () => {
        previousDefaultVariationType.value = formData.value.defaultVariationType;
        if (formData.value.defaultVariationType) {
          loadSystemDefaultTemplates();
        } else {
          formData.value.variationTemplates = [];
        }
        confirmDialog.value.isOpen = false;
      },
      onCancel: () => {
        formData.value.defaultVariationType = previousDefaultVariationType.value;
        confirmDialog.value.isOpen = false;
      },
    };
    return;
  }

  previousDefaultVariationType.value = formData.value.defaultVariationType;
  if (formData.value.defaultVariationType) {
    loadSystemDefaultTemplates();
  } else {
    formData.value.variationTemplates = [];
  }
};

// Watch for unit changes and update all variations that use units
watch(() => formData.value.defaultUnit, (newUnit) => {
  if (showUnitSelection.value) {
    formData.value.variationTemplates.forEach(template => {
      if (template.type === formData.value.defaultVariationType) {
        template.unit = newUnit;
      }
    });
    // Also update the new template unit
    if (newTemplate.value.type === formData.value.defaultVariationType) {
      newTemplate.value.unit = newUnit;
    }
  }
  // Always reset the template form to ensure reactivity
  resetTemplateForm();
});

// Watch for variation type change and handle confirmation
watch(() => formData.value.defaultVariationType, (newType, oldType) => {
  // Skip if this is the initial value or if we're reverting
  if (oldType === undefined || newType === previousDefaultVariationType.value) {
    return;
  }

  handleDefaultTypeChange();
});

// Watch for variation type change and auto-select default unit
watch(() => formData.value.defaultVariationType, (newType) => {
  if (newType && systemDefaultTemplates.value[newType]?.unit) {
    formData.value.defaultUnit = systemDefaultTemplates.value[newType].unit;
  }
  // Update the new template type and unit
  newTemplate.value.type = newType || 'WEIGHT';
  newTemplate.value.unit = systemDefaultTemplates.value[newType]?.unit || '';
});

// Watch for hasVariationTemplates toggle
watch(() => hasVariationTemplates.value, (newValue, oldValue) => {
  if (!newValue && formData.value.variationTemplates.length > 0) {
    // Show confirmation dialog when disabling templates with existing data
    confirmDialog.value = {
      isOpen: true,
      title: 'Eliminar plantillas de variación',
      message: '¿Estás seguro de que deseas eliminar todas las plantillas de variación? Esta acción no se puede deshacer.',
      onConfirm: () => {
        // Clear template data when templates are disabled
        formData.value.defaultVariationType = '';
        formData.value.variationTemplates = [];
        formData.value.hasWholeGrainVariations = false;
        confirmDialog.value.isOpen = false;
      },
      onCancel: () => {
        hasVariationTemplates.value = oldValue;
        confirmDialog.value.isOpen = false;
      },
    };
    // Revert the toggle until confirmed
    hasVariationTemplates.value = oldValue;
  } else if (!newValue) {
    // Clear template data when no existing templates
    formData.value.defaultVariationType = '';
    formData.value.variationTemplates = [];
    formData.value.hasWholeGrainVariations = false;
  }
});

// Watch for whole grain variations toggle
watch(() => formData.value.hasWholeGrainVariations, (newValue, oldValue) => {
  if (newValue) {
    // Add whole grain variations for existing templates
    addWholeGrainVariations();
  } else {
    // Remove all whole grain variations
    if (formData.value.variationTemplates.some(t => t.isWholeGrain)) {
      confirmDialog.value = {
        isOpen: true,
        title: 'Eliminar variaciones integrales',
        message: '¿Estás seguro de que deseas eliminar todas las variaciones integrales?',
        onConfirm: () => {
          removeWholeGrainVariations();
          confirmDialog.value.isOpen = false;
        },
        onCancel: () => {
          formData.value.hasWholeGrainVariations = oldValue;
          confirmDialog.value.isOpen = false;
        },
      };
      // Revert the toggle until confirmed
      formData.value.hasWholeGrainVariations = oldValue;
    }
  }
});

// Computed properties for button text
const submitButtonText = computed(() => {
  return props.initialData ? 'Actualizar Categoría' : 'Crear Categoría';
});

const loadingText = computed(() => {
  return props.initialData ? 'Actualizando...' : 'Creando...';
});

// Validation
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

const resetForm = () => {
  formData.value = {
    name: '',
    description: '',
    isActive: true,
    displayOrder: 0,
    defaultVariationType: '',
    defaultUnit: 'g',
    hasWholeGrainVariations: false,
    variationTemplates: [],
  };
  hasVariationTemplates.value = false;
  errors.value = {};
  resetTemplateForm();
};

// Load system settings on mount
onMounted(async () => {
  if (!systemSettingsStore.isLoaded) {
    try {
      await systemSettingsStore.fetchSettings();
    } catch (error) {
      console.error('Failed to load system settings:', error);
    }
  }
  // Reset template form to ensure proper initialization
  resetTemplateForm();
});
</script>

<template>
  <div class="form-container">
    <h2>{{ title }}</h2>
    <form @submit.prevent="handleSubmit">
      <!-- Basic Information -->
      <div class="base-card">

        <!-- Name -->
        <div class="mb-4">
          <label
            for="name"
            class="block text-sm font-medium text-neutral-700 mb-1"
          >
            Nombre
          </label>
          <input
            id="name"
            type="text"
            v-model="formData.name"
            class="w-full px-3 py-2 border border-neutral-300 rounded-md"
            :class="{ 'border-danger': errors.name }"
            required
          />
          <span
            v-if="errors.name"
            class="text-sm text-danger mt-1"
          >
            {{ errors.name }}
          </span>
        </div>

        <!-- Description -->
        <div class="mb-4">
          <label
            for="description"
            class="block text-sm font-medium text-neutral-700 mb-1"
          >
            Descripción
          </label>
          <textarea
            id="description"
            v-model="formData.description"
            rows="3"
            class="w-full px-3 py-2 border border-neutral-300 rounded-md"
          />
        </div>

        <!-- Has Variation Templates Toggle -->
        <div class="mb-4">
          <YesNoToggle
            v-model="hasVariationTemplates"
            label="¿Los productos de esta categoría tendrán variaciones?"
          />
        </div>

        <!-- Display Order
        <div class="mb-4">
          <label
            for="displayOrder"
            class="block text-sm font-medium text-neutral-700 mb-1"
          >
            Display Order
          </label>
          <input
            id="displayOrder"
            type="number"
            v-model="formData.displayOrder"
            class="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary"
            min="0"
          />
        </div> -->

        <!-- Default Variation Type -->
        <div v-if="hasVariationTemplates" class="mb-6">
          <label class="block text-sm font-medium text-neutral-700 mb-1">
            Tipo de Variación
          </label>
          <div class="flex gap-1">
            <div class="relative flex-1">
              <input
                type="radio"
                id="variation-type-weight"
                value="WEIGHT"
                name="defaultVariationType"
                v-model="formData.defaultVariationType"
                class="sr-only peer"
              />
              <label
                for="variation-type-weight"
                class="utility-btn-inactive cursor-pointer py-2 px-3 rounded-md peer-checked:utility-btn-active peer-focus-visible:ring-2 peer-focus-visible:ring-black w-full text-center block"
              >
                Peso / Volumen
              </label>
            </div>
            <div class="relative flex-1">
              <input
                type="radio"
                id="variation-type-quantity"
                value="QUANTITY"
                name="defaultVariationType"
                v-model="formData.defaultVariationType"
                class="sr-only peer"
              />
              <label
                for="variation-type-quantity"
                class="utility-btn-inactive cursor-pointer py-2 px-3 rounded-md peer-checked:utility-btn-active peer-focus-visible:ring-2 peer-focus-visible:ring-black w-full text-center block"
              >
                Cantidad
              </label>
            </div>
            <div class="relative flex-1">
              <input
                type="radio"
                id="variation-type-size"
                value="SIZE"
                name="defaultVariationType"
                v-model="formData.defaultVariationType"
                class="sr-only peer"
              />
              <label
                for="variation-type-size"
                class="utility-btn-inactive cursor-pointer py-2 px-3 rounded-md peer-checked:utility-btn-active peer-focus-visible:ring-2 peer-focus-visible:ring-black w-full text-center block"
              >
                Tamaño / Color
              </label>
            </div>
          </div>
          <p class="text-xs text-neutral-500 mt-1">
            Los productos en esta categoría sugerirán variaciones de este tipo.
          </p>
        </div>

        <!-- Unit Selection for types that use units -->
        <div v-if="hasVariationTemplates && showUnitSelection" class="mb-4">
          <label class="block text-sm font-medium text-neutral-700 mb-1">
            Unidad
          </label>
          <div class="flex gap-1">
            <div
              v-for="option in unitPillOptions"
              :key="option.value"
              class="relative flex-1"
            >
              <input
                type="radio"
                :id="`unit-${option.value}`"
                :value="option.value"
                name="defaultUnit"
                v-model="formData.defaultUnit"
                class="sr-only peer"
              />
              <label
                :for="`unit-${option.value}`"
                class="utility-btn-inactive cursor-pointer py-2 px-3 rounded-md peer-checked:utility-btn-active peer-focus-visible:ring-2 peer-focus-visible:ring-black w-full text-center block"
              >

               {{ `${option.name.toLowerCase()}s (${option.label})` }}
              </label>
            </div>
          </div>
          <p class="text-xs text-neutral-500 mt-1">
            Todas las variaciones de peso/volumen usarán esta unidad
          </p>
        </div>

        <!-- Whole Grain Variations Toggle -->
        <div v-if="hasVariationTemplates && formData.defaultVariationType && formData.defaultVariationType !== 'SIZE'" class="mb-4">
          <YesNoToggle
            v-model="formData.hasWholeGrainVariations"
            label="¿Esta categoría ofrece variaciones integrales?"
          />
          <p class="text-xs text-neutral-500 mt-1">
            Se creará automáticamente una versión integral para cada variación
          </p>
        </div>
      </div>

      <!-- Variation Templates -->
      <div v-if="hasVariationTemplates && (formData.defaultVariationType || formData.variationTemplates.length > 0)" class="base-card">
        <div class="flex justify-between items-center mb-4">
          <h4 class="text-lg font-medium text-neutral-800">Plantillas de Variación</h4>
          <span v-if="formData.defaultVariationType" class="px-2 py-1 bg-primary-100 text-primary-800 rounded text-xs font-medium">
            {{ getVariationTypeLabel(formData.defaultVariationType) }}
          </span>
        </div>

        <!-- Templates List - Always Editable -->
        <div class="space-y-3">
          <!-- Existing Templates -->
          <TemplateVariation
            v-for="(template, index) in formData.variationTemplates"
            :key="`template-${index}-${template.id || ''}-${template.isWholeGrain ? 'whole' : 'regular'}`"
            :template="template"
            :is-new="false"
            :default-variation-type="formData.defaultVariationType"
            :base-price="false"
            @remove="removeTemplate(index)"
            @update="(payload) => updateTemplate(index, payload)"
          />

          <!-- Add New Template Form -->
          <TemplateVariation
            :key="`new-template-${formData.defaultUnit}-${formData.defaultVariationType}`"
            :template="newTemplate"
            :is-new="true"
            :default-variation-type="formData.defaultVariationType"
            :base-price="false"
            @add="addNewTemplate"
            @update="(payload) => updateNewTemplate(payload)"
          />
        </div>

        <!-- Load System Defaults Button -->
        <button
          v-if="false &&formData.defaultVariationType && systemDefaultTemplates[formData.defaultVariationType]"
          type="button"
          @click="loadSystemDefaultTemplates"
          class="w-full mt-4 px-3 py-2 border border-neutral-300 rounded-md text-neutral-700 hover:bg-neutral-50 text-sm"
        >
          Cargar plantillas por defecto para {{ getVariationTypeLabel(formData.defaultVariationType) }}
        </button>
      </div>

      <!-- Form Actions -->
      <div class="base-card">
        <div class="flex gap-2 justify-end">
          <button type="submit" :disabled="loading" class="action-btn">
            {{ loading ? loadingText : submitButtonText }}
          </button>
          <button
            type="button"
            @click="$emit('cancel')"
            :disabled="loading"
            class="danger-btn"
          >
            Cancelar
          </button>
        </div>
      </div>
    </form>

    <!-- Confirm Dialog -->
    <ConfirmDialog
      :is-open="confirmDialog.isOpen"
      :title="confirmDialog.title"
      :message="confirmDialog.message"
      confirm-text="Confirmar"
      cancel-text="Cancelar"
      @confirm="confirmDialog.onConfirm"
      @cancel="confirmDialog.onCancel"
    />
  </div>
</template>

<style scoped>
/* Remove browser default outlines from all form elements */
select {
  outline: none !important;
}

select:focus {
  outline: none !important;
}
</style>
