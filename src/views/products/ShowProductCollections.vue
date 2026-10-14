<script setup>
// Vue & Router
import { ref, computed, onMounted } from 'vue';
import { Dialog, DialogPanel } from '@headlessui/vue';
import { useRouter } from 'vue-router';

// DataTable
import DataTable from '@/components/DataTable/index.vue';

// Components
import ProductCollectionForm from '@/components/forms/ProductCollectionForm.vue';

// Store
import { useProductCollectionStore } from '@/stores/productCollectionStore';
import { useProductStore } from '@/stores/productStore';
import { orderCategoryNames } from '@/utils/helpers';

// Icons
import { PhPen, PhTrash, PhArrowUp, PhArrowDown } from '@phosphor-icons/vue';

const router = useRouter();

const productCollectionStore = useProductCollectionStore();
const isFormOpen = ref(false);
const selectedCollection = ref(null);
const actionLoading = ref({});
const dataTable = ref(null);

onMounted(async () => {
  await productCollectionStore.fetchAll();
});

// Same order as the catalog once one is saved; a column header still re-sorts.
const orderedCollections = computed(() =>
  [...productCollectionStore.items].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)));

const columns = [
  {
    id: 'name',
    label: 'Nombre',
    field: 'name',
    sortable: true,
  },
  {
    id: 'description',
    label: 'Descripción',
    field: 'description',
    sortable: true,
  },
];

const tableActions = [
  {
    id: 'edit',
    label: 'Editar',
    icon: PhPen,
    minSelected: 1,
    maxSelected: 1,
    variant: 'primary',
  },
  {
    id: 'delete',
    label: 'Eliminar',
    icon: PhTrash,
    minSelected: 1,
    maxSelected: 1,
    variant: 'danger',
  },
];

const handleAction = async ({ actionId, selectedIds }) => {
  actionLoading.value[actionId] = true;

  try {
    if (actionId === 'edit') {
      selectedCollection.value = productCollectionStore.items.find(
        collection => collection.id === selectedIds[0],
      );
      isFormOpen.value = true;
    } else if (actionId === 'delete') {
      if (window.confirm('¿Estás seguro de querer eliminar esta categoría?')) {
        selectedCollection.value = productCollectionStore.items.find(
          collection => collection.id === selectedIds[0],
        );
        await productCollectionStore.remove(selectedCollection.value.id);
        dataTable.value?.clearSelection();
      }
    }
  } catch (error) {
    console.error('Action failed:', error);
  } finally {
    actionLoading.value[actionId] = false;
  }
};

const handleSelectionChange = (selectedIds) => {
  if (selectedIds.length === 1) {
    selectedCollection.value = productCollectionStore.items.find(
      collection => collection.id === selectedIds[0],
    );
  } else {
    selectedCollection.value = null;
  }
};

const handleSubmit = async (formData) => {
  try {
    if (selectedCollection.value) {
      await productCollectionStore.update(selectedCollection.value.id, formData);
    }
    isFormOpen.value = false;
    selectedCollection.value = null;
  } catch (error) {
    console.error('Failed to update collection:', error);
  }
};

const handleCancel = () => {
  isFormOpen.value = false;
  selectedCollection.value = null;
};

const navigateToCreate = () => {
  router.push('/dashboard/product-collections/create');
};

// ---------- order in the order form's catalog ----------

const productStore = useProductStore();
const ordering = ref(null); // the collections being reordered; null while closed
const orderingError = ref('');
const savingOrder = ref(false);

// Opens on what the catalog shows today: categories in the order it meets them
// in the products, then sorted by displayOrder. Ones without products go last.
const openOrdering = async () => {
  orderingError.value = '';
  // Without products the list still opens, in displayOrder only.
  if (!productStore.items.length) await productStore.fetchAll().catch(() => {});
  const seen = productStore.items
    .filter((p) => p.isActive !== false)
    .map((p) => p.collectionName);
  const names = [...new Set([...seen, ...productCollectionStore.items.map((c) => c.name)])];
  const byName = Object.fromEntries(productCollectionStore.items.map((c) => [c.name, c]));
  ordering.value = orderCategoryNames(names, productCollectionStore.items)
    .map((name) => byName[name])
    .filter(Boolean);
};

const move = (index, by) => {
  const list = ordering.value;
  [list[index], list[index + by]] = [list[index + by], list[index]];
};

// Only the rows whose position changed are sent.
const saveOrdering = async () => {
  savingOrder.value = true;
  orderingError.value = '';
  try {
    await Promise.all(ordering.value
      .map((c, index) => (c.displayOrder === index ? null : productCollectionStore.patch(c.id, { displayOrder: index })))
      .filter(Boolean));
    ordering.value = null;
  } catch (error) {
    orderingError.value = 'No se pudo guardar el orden. Intenta de nuevo.';
    console.error('Failed to save collection order:', error);
  } finally {
    savingOrder.value = false;
  }
};
</script>

<template>
  <div class="container p-4 px-0 lg:px-4">
    <div class="flex justify-between items-center mb-1">
      <h2 class="text-2xl font-bold mb-0">Categorias</h2>
      <div class="flex gap-2">
        <button class="action-btn" @click="openOrdering">
          Ordenar
        </button>
        <button
          label="Crear Categoría"
          class="action-btn"
          @click="navigateToCreate"
        >
          Crear Categoría
        </button>
      </div>
    </div>

    <!-- Order of the categories in the order form's catalog -->
    <Dialog
      :open="!!ordering"
      @close="ordering = null"
      class="relative z-50"
    >
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="ui-formhost ui-gutter max-h-[90dvh] overflow-y-auto" style="--ui-form-w: 28rem">
          <div class="ui-card flex flex-col gap-4" data-ui-theme="light">
            <div>
              <h2 class="ui-panehead-title">Orden de las categorías</h2>
              <p class="ui-field-hint">Así aparecen en el catálogo del pedido.</p>
            </div>

            <ol class="flex flex-col">
              <li
                v-for="(collection, index) in ordering"
                :key="collection.id"
                class="ui-item ui-item-divided"
              >
                <span class="ui-num ui-ink-muted w-5 text-right">{{ index + 1 }}</span>
                <span class="truncate">{{ collection.name }}</span>
                <span class="flex gap-1">
                  <button
                    type="button"
                    class="ui-btn ui-btn-icon"
                    :aria-label="`Subir ${collection.name}`"
                    :disabled="index === 0"
                    @click="move(index, -1)"
                  >
                    <PhArrowUp :size="11" weight="bold" />
                  </button>
                  <button
                    type="button"
                    class="ui-btn ui-btn-icon"
                    :aria-label="`Bajar ${collection.name}`"
                    :disabled="index === ordering.length - 1"
                    @click="move(index, 1)"
                  >
                    <PhArrowDown :size="11" weight="bold" />
                  </button>
                </span>
              </li>
            </ol>

            <span v-if="orderingError" class="ui-field-error">{{ orderingError }}</span>

            <div class="flex gap-2 justify-end">
              <button type="button" class="ui-btn ui-btn-danger" :disabled="savingOrder" @click="ordering = null">
                Cancelar
              </button>
              <button type="button" class="ui-btn ui-btn-solid" :disabled="savingOrder" @click="saveOrdering">
                {{ savingOrder ? 'Guardando…' : 'Guardar orden' }}
              </button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>

    <!-- Loading State -->
    <div
      v-if="productCollectionStore.loading"
      class="text-neutral-600 text-center py-4"
    >
      Cargando categorias...
    </div>

    <!-- Error State -->
    <div
      v-if="productCollectionStore.error"
      class="text-danger text-center py-4"
    >
      {{ productCollectionStore.error }}
    </div>

    <!-- Edit Form Dialog -->
    <Dialog
      :open="isFormOpen"
      @close="handleCancel"
      class="relative z-50"
    >
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />

      <!-- Full-screen container -->
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <!-- No surface of its own: the form is a ui-card and paints itself. -->
        <DialogPanel class="ui-formhost ui-gutter max-h-[90dvh] overflow-y-auto">
          <ProductCollectionForm
            v-if="selectedCollection"
            :key="selectedCollection.id"
            :initial-data="selectedCollection"
            :loading="productCollectionStore.loading"
            @submit="handleSubmit"
            @cancel="handleCancel"
          />
        </DialogPanel>
      </div>
    </Dialog>

    <!-- Table -->
    <div v-if="!productCollectionStore.loading">
      <DataTable
        ref="dataTable"
        :data="orderedCollections"
        :columns="columns"
        :actions="tableActions"
        :action-loading="actionLoading"
        @selection-change="handleSelectionChange"
        @action="handleAction"
        class="bg-white shadow-lg rounded-lg"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
* {
  &::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
