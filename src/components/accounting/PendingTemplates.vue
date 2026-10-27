<script setup>
/* The month's recurring gastos still waiting for a record. Confirming creates the
 * record with the template's values; "Editar" changes this month's amount only. */
import { ref } from 'vue';
import { PhPencilSimple, PhCheck } from '@phosphor-icons/vue';
import UiMoneyInput from '@/components/ui/UiMoneyInput.vue';
import { useAccountingStore } from '@/stores/accountingStore';
import { formatMoney } from '@/utils/helpers';

defineProps({
  templates: { type: Array, required: true },
});

const accountingStore = useAccountingStore();

const editingId = ref(null);
const editedAmount = ref(null);
const busyId = ref(null);
const errors = ref({});

function startEdit(template) {
  editingId.value = template.id;
  editedAmount.value = template.defaultAmount;
}

async function confirm(template) {
  busyId.value = template.id;
  errors.value = { ...errors.value, [template.id]: '' };
  const overrides = editingId.value === template.id ? { amount: editedAmount.value } : {};
  try {
    await accountingStore.confirmTemplate(template.id, overrides);
    if (editingId.value === template.id) editingId.value = null;
  } catch (err) {
    errors.value = { ...errors.value, [template.id]: err?.message || 'No se pudo confirmar' };
  } finally {
    busyId.value = null;
  }
}
</script>

<template>
  <div class="base-card">
    <h3 class="text-lg font-bold text-neutral-800 mb-2">Gastos recurrentes por confirmar</h3>
    <div
      v-for="template in templates"
      :key="template.id"
      class="py-2 border-b border-neutral-200 last:border-0"
    >
      <div class="flex items-center gap-4">
        <div class="min-w-0 flex-1">
          <div class="font-medium text-neutral-800">{{ template.name }}</div>
          <div class="text-xs text-neutral-500">{{ template.categoryName }}</div>
        </div>
        <UiMoneyInput
          v-if="editingId === template.id"
          v-model="editedAmount"
          class="ui-field-unit w-36"
          :aria-label="`Monto de ${template.name}`"
        />
        <span v-else class="whitespace-nowrap">{{ formatMoney(template.defaultAmount) }}</span>
        <button
          v-if="editingId !== template.id"
          class="utility-btn-inactive"
          aria-label="Editar monto"
          title="Editar monto"
          @click="startEdit(template)"
        >
          <PhPencilSimple :size="14" />
        </button>
        <button
          class="action-btn flex items-center gap-1"
          :disabled="busyId === template.id || (editingId === template.id && !(editedAmount > 0))"
          @click="confirm(template)"
        >
          <PhCheck :size="14" weight="bold" /> Confirmar
        </button>
      </div>
      <div v-if="errors[template.id]" class="text-danger text-sm">{{ errors[template.id] }}</div>
    </div>
  </div>
</template>
