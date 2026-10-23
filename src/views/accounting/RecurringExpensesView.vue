<script setup>
/* The recurring gastos (rent, payroll). Each active one shows up as pending in
 * Resumen every month from the month it was created. */
import { ref, computed, onMounted } from 'vue';
import { Dialog, DialogPanel } from '@headlessui/vue';
import { PhPlus, PhPencilSimple, PhTrash } from '@phosphor-icons/vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import TemplateForm from '@/components/accounting/TemplateForm.vue';
import { useAccountingTemplateStore } from '@/stores/accountingTemplateStore';
import { formatMoney } from '@/utils/helpers';

const templateStore = useAccountingTemplateStore();

const templates = computed(() =>
  templateStore.items.filter((template) => !template.isDeleted),
);

// `formKey` remounts the form, so an edit never inherits the last one's typing.
const formOpen = ref(false);
const formKey = ref(0);
const editing = ref(null);

function openForm(template = null) {
  editing.value = template;
  formKey.value++;
  formOpen.value = true;
}

const rowError = ref('');

async function toggleActive(template) {
  rowError.value = '';
  try {
    await templateStore.patch(template.id, { isActive: !template.isActive });
  } catch (err) {
    rowError.value = err?.message || 'No se pudo actualizar el gasto recurrente';
  }
}

const toDelete = ref(null);
const deleting = ref(false);
const deleteError = ref('');

function askDelete(template) {
  deleteError.value = '';
  toDelete.value = template;
}

async function confirmDelete() {
  deleting.value = true;
  deleteError.value = '';
  try {
    await templateStore.remove(toDelete.value.id);
    toDelete.value = null;
  } catch (err) {
    deleteError.value = err?.message || 'No se pudo eliminar el gasto recurrente';
  } finally {
    deleting.value = false;
  }
}

onMounted(() => templateStore.fetchAll());
</script>

<template>
  <div class="p-4 lg:p-6 w-full max-w-4xl">
    <PageHeader title="Gastos recurrentes" subtitle="Gastos que se repiten cada mes. Se listan en Resumen para su confirmación.">
      <button type="button" class="ui-btn ui-btn-solid" @click="openForm()">
        <PhPlus :size="14" weight="bold" /> Nuevo gasto recurrente
      </button>
    </PageHeader>

    <p v-if="rowError" class="ui-field-error" role="alert">{{ rowError }}</p>

    <div v-if="!templates.length && !templateStore.loading" class="ui-empty">
      <b>No hay gastos recurrentes.</b>
    </div>

    <div v-else class="flex flex-col">
      <div v-for="template in templates" :key="template.id" class="ui-item">
        <span class="min-w-0">
          <span class="ui-item-title block">{{ template.name }}</span>
          <span class="ui-item-desc">
            {{ [template.categoryName, template.dayOfMonth ? `pago el día ${template.dayOfMonth}` : ''].filter(Boolean).join(' · ') }}
          </span>
        </span>
        <span class="ui-item-trail">
          <span class="ui-item-num ui-num">{{ formatMoney(template.defaultAmount) }}</span>
          <button
            type="button"
            class="ui-btn ui-btn-sm"
            :aria-pressed="template.isActive"
            @click="toggleActive(template)"
          >
            {{ template.isActive ? 'Activo' : 'Pausado' }}
          </button>
          <button
            type="button"
            class="ui-btn ui-btn-icon"
            aria-label="Editar"
            title="Editar"
            @click="openForm(template)"
          >
            <PhPencilSimple :size="14" />
          </button>
          <button
            type="button"
            class="ui-btn ui-btn-icon ui-btn-danger"
            aria-label="Eliminar"
            title="Eliminar"
            @click="askDelete(template)"
          >
            <PhTrash :size="14" />
          </button>
        </span>
      </div>
    </div>

    <Dialog :open="formOpen" class="relative z-50" @close="formOpen = false">
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="ui-formhost ui-gutter max-h-[90dvh] overflow-y-auto" style="--ui-form-w: 32rem">
          <TemplateForm
            :key="formKey"
            :template="editing"
            @saved="formOpen = false"
            @cancel="formOpen = false"
          />
        </DialogPanel>
      </div>
    </Dialog>

    <ConfirmDialog
      :is-open="!!toDelete"
      title="Eliminar gasto recurrente"
      :message="deleteError || `¿Eliminar ${toDelete?.name ?? ''}? Los registros ya confirmados se conservan.`"
      confirm-text="Eliminar"
      cancel-text="Cancelar"
      :loading="deleting"
      @confirm="confirmDelete"
      @cancel="toDelete = null"
    />
  </div>
</template>
