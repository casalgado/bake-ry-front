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
  <div class="mb-5">
    <h2 class="ui-panehead-title mb-2">Por confirmar</h2>
    <div class="flex flex-col">
      <div v-for="template in templates" :key="template.id" class="flex flex-col">
        <div class="ui-item">
          <span class="min-w-0">
            <span class="ui-item-title block">{{ template.name }}</span>
            <span class="ui-item-desc">{{ template.categoryName }}</span>
          </span>
          <span class="ui-item-trail">
            <UiMoneyInput
              v-if="editingId === template.id"
              v-model="editedAmount"
              class="ui-field-unit w-36"
              :aria-label="`Monto de ${template.name}`"
            />
            <span v-else class="ui-item-num ui-num">{{ formatMoney(template.defaultAmount) }}</span>
            <button
              v-if="editingId !== template.id"
              type="button"
              class="ui-btn ui-btn-icon"
              aria-label="Editar monto"
              title="Editar monto"
              @click="startEdit(template)"
            >
              <PhPencilSimple :size="14" />
            </button>
            <button
              type="button"
              class="ui-btn ui-btn-solid"
              :disabled="busyId === template.id || (editingId === template.id && !(editedAmount > 0))"
              @click="confirm(template)"
            >
              <PhCheck :size="14" weight="bold" /> Confirmar
            </button>
          </span>
        </div>
        <span v-if="errors[template.id]" class="ui-field-error" role="alert">
          {{ errors[template.id] }}
        </span>
      </div>
    </div>
  </div>
</template>
