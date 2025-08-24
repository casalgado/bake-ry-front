<script setup>
import { computed } from 'vue';
import { getVariationTypeLabel, getUnitTypeLabel } from '@/utils/helpers';
import { useSystemSettingsStore } from '@/stores/systemSettingsStore';
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
  if (!props.template.name || !props.template.value) {
    return;
  }
  emit('add');
};

const updateTemplate = (field, value) => {
  emit('update', { field, value });
};

const systemSettingsStore = useSystemSettingsStore();

const stepValue = computed(() => {
  return props.defaultVariationType === 'WEIGHT' ? 1 : 1;
});

const unitTypeLabel = computed(() => {
  console.log(props.template);
  // If template has no unit (empty string), don't show the value input
  if (!props.template.unit || props.template.unit === '') {
    return null; // This will hide the value input
  }

  if (!systemSettingsStore.unitOptions) {
    return 'Valor';
  }

  // Find the unit object in the unitOptions array
  const unitObj = systemSettingsStore.unitOptions.find(
    unit => unit.symbol === props.template.unit,
  );

  if (unitObj && unitObj.type) {
    return `${getUnitTypeLabel(unitObj.type)} (${props.template.unit})`;
  }

  return `Valor (${props.template.unit})`;
});
</script>

<template>
  <div
    :class="[
      'p-4 rounded-lg border',
      isNew
        ? 'bg-primary-50 border-2 border-dashed border-primary-200'
        : 'bg-neutral-50 border border-neutral-200'
    ]"
  >
    <div class="flex items-end justify-between gap-4">
      <div class="flex-1 grid gap-3" :class="[
        basePrice && unitTypeLabel ? 'grid-cols-3' :
        (basePrice && !unitTypeLabel) || (!basePrice && unitTypeLabel) ? 'grid-cols-2' :
        'grid-cols-1'
      ]">
        <div>
          <label class="block text-xs font-medium text-neutral-600 mb-1">Nombre</label>
          <input
            :value="template.name"
            @input="updateTemplate('name', $event.target.value)"
            type="text"
            placeholder="ej: pequeño, mediano"
            :class="[
              'w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none',
              isNew
                ? 'border-primary-300 bg-white'
                : 'border-neutral-300'
            ]"
            :disabled="disabled"
          />
        </div>

        <div v-if="unitTypeLabel">
          <label class="block text-xs font-medium text-neutral-600 mb-1">{{ unitTypeLabel }}</label>
          <div class="relative">
            <input
              :value="template.value"
              @input="updateTemplate('value', Number($event.target.value))"
              type="number"
              min="0"
              :step="stepValue"
              :class="[
                'w-full px-3 py-2 pr-12 text-sm border rounded-md focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none',
                isNew
                  ? 'border-primary-300 bg-white'
                  : 'border-neutral-300'
              ]"
              :disabled="disabled"
            />
            <div class="absolute inset-y-0 right-0 flex items-center pr-8 text-xs text-neutral-500 font-medium">
              {{ template.unit }}
            </div>
          </div>
        </div>

        <div v-if="basePrice">
          <label class="block text-xs font-medium text-neutral-600 mb-1">Precio Base</label>
          <div class="relative">
            <input
              :value="template.basePrice"
              @input="updateTemplate('basePrice', Number($event.target.value))"
              type="number"
              min="0"
              step="0.01"
              :class="[
                'w-full px-3 py-2 pr-8 text-sm border rounded-md focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none',
                isNew
                  ? 'border-primary-300 bg-white'
                  : 'border-neutral-300'
              ]"
              :disabled="disabled"
            />
            <div class="absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-neutral-500 font-medium">
              $
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-2 flex-shrink-0">
        <div v-if="template.isWholeGrain" class="flex items-center justify-end">
          <span class="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-medium">
            Integral
          </span>
        </div>

        <button
          v-if="isNew"
          type="button"
          @click="handleAdd"
          :disabled="!template.name || !template.value || disabled"
          class="action-btn text-sm px-3 py-1 self-end m-0 h-[30px]"
        >
          Agregar
        </button>

        <button
          v-else
          type="button"
          @click="handleRemove"
          class="p-2 py-1 text-danger hover:bg-danger-50 border border-danger-200 hover:border-danger-300 rounded-md transition-colors self-end m-0"
          title="Eliminar variación"
          :disabled="disabled"
        >
          <PhTrash size="18" />
        </button>
      </div>
    </div>
  </div>
</template>
