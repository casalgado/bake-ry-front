<script setup>
import { computed } from 'vue';
import { getVariationTypeLabel, getUnitTypeLabel } from '@/utils/helpers';
import { useSystemSettingsStore } from '@/stores/systemSettingsStore';
import { useAuthenticationStore } from '@/stores/authentication';
import { PhTrash, PhPlus } from '@phosphor-icons/vue';

const props = defineProps({
  template: {
    type: Object,
    required: true,
  },
  isNew: {
    type: Boolean,
    default: false,
  },
  defaultVariationType: {
    type: String,
    default: 'WEIGHT',
  },
  basePrice: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['remove', 'add', 'update']);

const handleRemove = () => {
  emit('remove');
};

const handleAdd = () => {
  if (!isValidForSubmit.value) {
    return;
  }
  emit('add');
};

const updateTemplate = (field, value) => {
  emit('update', { field, value });
};

const systemSettingsStore = useSystemSettingsStore();
const authStore = useAuthenticationStore();

// Check if current user is system admin
const isSystemAdmin = computed(() => authStore.isSystemAdmin);

const stepValue = computed(() => {
  return props.defaultVariationType === 'WEIGHT' ? 1 : 1;
});

const unitTypeLabel = computed(() => {
  // If template has no unit (empty string), don't show the value input
  if (!props.template.unit || props.template.unit === '') {
    return null; // This will hide the value input
  }

  if (!systemSettingsStore.unitOptions && !systemSettingsStore.settings) {
    return 'Valor';
  }

  // Find the unit object in the unitOptions array
  const unitObj = systemSettingsStore.unitOptions?.find(
    (unit) => unit.symbol === props.template.unit,
  );

  if (unitObj && unitObj.type) {
    return `${getUnitTypeLabel(unitObj.type)} (${props.template.unit})`;
  }

  return `Valor (${props.template.unit})`;
});

// Validation computed property
const isValidForSubmit = computed(() => {
  // Name is always required
  if (!props.template.name) return false;

  // Base price is required when basePrice prop is true
  if (props.basePrice && props.template.basePrice <= 0) return false;

  // Value is required when the value field is visible (has unit)
  if (unitTypeLabel.value && (!props.template.value || props.template.value <= 0)) return false;

  return true;
});
</script>

<template>
  <div
    :class="[
      'p-4 rounded-lg border',
      isNew
        ? 'bg-primary-50 border-2 border-dashed border-primary-200'
        : template.isWholeGrain
        ? 'bg-neutral-150 border border-neutral-200'
        : 'bg-neutral-50 border border-neutral-200',
    ]"
  >
    <div
      v-if="template.isWholeGrain"
      class="absolute top-1 right-1 flex items-center justify-end"
    >
      <span
        class="px-2 py-1 bg-primary-800 text-white rounded text-xs font-medium"
      >
        Integral
      </span>
    </div>
    <div class="flex items-end justify-between gap-4">
      <div
        class="flex-1 grid gap-3"
        :class="[
          basePrice && unitTypeLabel && isSystemAdmin
            ? 'grid-cols-4'
            : basePrice && unitTypeLabel && !isSystemAdmin
            ? 'grid-cols-3'
            : (basePrice && !unitTypeLabel && isSystemAdmin) || (!basePrice && unitTypeLabel && isSystemAdmin)
            ? 'grid-cols-3'
            : (basePrice && !unitTypeLabel && !isSystemAdmin) || (!basePrice && unitTypeLabel && !isSystemAdmin)
            ? 'grid-cols-2'
            : isSystemAdmin
            ? 'grid-cols-2'
            : 'grid-cols-1',
        ]"
      >
        <div>
          <label class="block text-xs font-medium text-neutral-600 mb-1"
            >Nombre</label
          >
          <input
            :value="template.name"
            @input="updateTemplate('name', $event.target.value)"
            type="text"
            placeholder="ej: pequeño, mediano"
            :class="[
              'w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none',
              isNew ? 'border-primary-300 bg-white' : 'border-neutral-300',
            ]"
            :disabled="disabled"
          />
        </div>

        <div v-if="unitTypeLabel">
          <label class="block text-xs font-medium text-neutral-600 mb-1">{{
            unitTypeLabel
          }}</label>
          <div class="relative">
            <input
              :value="template.value"
              @input="updateTemplate('value', Number($event.target.value))"
              type="number"
              min="0"
              :step="stepValue"
              :class="[
                'w-full px-3 py-2 pr-12 text-sm border rounded-md focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none',
                isNew ? 'border-primary-300 bg-white' : 'border-neutral-300',
              ]"
              :disabled="disabled"
            />
          </div>
        </div>

        <div v-if="basePrice">
          <label class="block text-xs font-medium text-neutral-600 mb-1"
            >Precio Base</label
          >
          <div class="relative">
            <input
              :value="template.basePrice"
              @input="updateTemplate('basePrice', Number($event.target.value))"
              type="number"
              min="0"
              step="1"
              :class="[
                'w-full px-3 py-2 pr-8 text-sm border rounded-md focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none',
                isNew ? 'border-primary-300 bg-white' : 'border-neutral-300',
              ]"
              :disabled="disabled"
            />

          </div>
        </div>

        <div v-if="isSystemAdmin">
          <label class="block text-xs font-medium text-neutral-600 mb-1"
            >Orden</label
          >
          <input
            :value="template.displayOrder !== undefined ? template.displayOrder : 0"
            @input="updateTemplate('displayOrder', Number($event.target.value))"
            type="number"
            min="0"
            step="1"
            :class="[
              'w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none',
              isNew ? 'border-primary-300 bg-white' : 'border-neutral-300',
            ]"
            :disabled="disabled"
            title="Orden de visualización de la variación"
          />
        </div>
      </div>

      <div class="flex flex-col gap-2 flex-shrink-0">
        <button
          v-if="isNew"
          type="button"
          @click="handleAdd"
          :disabled="!isValidForSubmit || disabled"
          class="utility-btn text-sm px-3 py-1 self-end m-0 h-[30px]"
          :class="{ 'utility-btn-inactive': !isValidForSubmit || disabled }"
        >
          Agregar
        </button>

        <button
          v-else
          type="button"
          @click="handleRemove"
          class="p-2 py-1 text-danger rounded-md transition-colors self-end m-0"
          title="Eliminar variación"
          :disabled="disabled"
        >
          <PhTrash size="18" />
        </button>
      </div>
    </div>
  </div>
</template>
