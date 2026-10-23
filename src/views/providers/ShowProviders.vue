<script setup>
/* The business's providers: who it buys from. Shared by inventory (Compra de
 * insumos), accounting (gastos) and e-invoicing (documento soporte). */
import { ref, computed, onMounted } from 'vue';
import { Dialog, DialogPanel } from '@headlessui/vue';
import { PhPlus, PhPencilSimple, PhTrash } from '@phosphor-icons/vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import ProviderForm from '@/components/providers/ProviderForm.vue';
import { useProviderStore } from '@/stores/providerStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';

const providerStore = useProviderStore();
const settingsStore = useBakerySettingsStore();

const providers = computed(() =>
  providerStore.items
    .filter((provider) => !provider.isDeleted)
    .sort((a, b) => a.name.localeCompare(b.name)),
);

const KIND_LABELS = { insumo: 'Compra de insumos', expense: 'Gasto', investment: 'Inversión' };

function describe(provider) {
  const destination = provider.defaultDestination;
  const category = destination?.categoryId
    && settingsStore.items[0]?.expenseCategories?.find((cat) => cat.id === destination.categoryId)?.name;
  return [
    provider.nationalId && `${provider.documentType || 'NIT'} ${provider.nationalId}`,
    provider.email,
    destination && [KIND_LABELS[destination.kind], category].filter(Boolean).join(' · '),
  ].filter(Boolean).join(' · ');
}

// `formKey` remounts the form, so an edit never inherits the last one's typing.
const formOpen = ref(false);
const formKey = ref(0);
const editing = ref(null);

function openForm(provider = null) {
  editing.value = provider;
  formKey.value++;
  formOpen.value = true;
}

const toDelete = ref(null);
const deleting = ref(false);
const deleteError = ref('');

function askDelete(provider) {
  deleteError.value = '';
  toDelete.value = provider;
}

async function confirmDelete() {
  deleting.value = true;
  deleteError.value = '';
  try {
    await providerStore.remove(toDelete.value.id);
    toDelete.value = null;
  } catch (err) {
    deleteError.value = err?.message || 'No se pudo eliminar el proveedor';
  } finally {
    deleting.value = false;
  }
}

onMounted(() => {
  providerStore.fetchAll();
  if (!settingsStore.items.length) settingsStore.fetchById('default');
});
</script>

<template>
  <div class="p-4 lg:p-6 w-full max-w-4xl" data-ui-theme="light">
    <PageHeader title="Proveedores" subtitle="Terceros a quienes el negocio compra insumos, bienes o servicios.">
      <button type="button" class="ui-btn ui-btn-solid" @click="openForm()">
        <PhPlus :size="14" weight="bold" /> Nuevo proveedor
      </button>
    </PageHeader>

    <div v-if="!providers.length && !providerStore.loading" class="ui-empty">
      <b>No hay proveedores.</b>
    </div>

    <div v-else class="flex flex-col">
      <div v-for="provider in providers" :key="provider.id" class="ui-item">
        <span class="min-w-0">
          <span class="ui-item-title block">{{ provider.name }}</span>
          <span class="ui-item-desc">{{ describe(provider) }}</span>
        </span>
        <span class="ui-item-trail">
          <button
            type="button"
            class="ui-btn ui-btn-icon"
            aria-label="Editar"
            title="Editar"
            @click="openForm(provider)"
          >
            <PhPencilSimple :size="14" />
          </button>
          <button
            type="button"
            class="ui-btn ui-btn-icon ui-btn-danger"
            aria-label="Eliminar"
            title="Eliminar"
            @click="askDelete(provider)"
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
          <ProviderForm
            :key="formKey"
            :provider="editing"
            @saved="formOpen = false"
            @cancel="formOpen = false"
          />
        </DialogPanel>
      </div>
    </Dialog>

    <ConfirmDialog
      :is-open="!!toDelete"
      title="Eliminar proveedor"
      :message="deleteError || `¿Eliminar ${toDelete?.name ?? ''}? Las compras ya registradas se conservan.`"
      confirm-text="Eliminar"
      cancel-text="Cancelar"
      :loading="deleting"
      @confirm="confirmDelete"
      @cancel="toDelete = null"
    />
  </div>
</template>
