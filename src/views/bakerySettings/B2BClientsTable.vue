<!-- components/b2b/B2BClientsTable.vue -->
<script setup>
import { ref } from 'vue';
import DataTable from '@/components/DataTable/index.vue';
import { PhPen, PhTrash } from '@phosphor-icons/vue';

const props = defineProps({
  loading: Boolean,
  error: String,
  clients: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['edit', 'delete']);

const dataTable = ref(null);
const selectedClient = ref(null);
const actionLoading = ref({});

const columns = [
  {
    id: 'name',
    label: 'Nombre',
    field: 'name',
    sortable: true,
  },
  {
    id: 'email',
    label: 'Email',
    field: 'email',
    sortable: true,
  },
  {
    id: 'phone',
    label: 'Teléfono',
    field: 'phone',
    sortable: true,
  },
  {
    id: 'address',
    label: 'Dirección',
    field: 'address',
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

const handleSelectionChange = (selectedIds) => {
  if (selectedIds.length === 1) {
    selectedClient.value = props.clients.find(client => client.id === selectedIds[0]);
  } else {
    selectedClient.value = null;
  }
};

const handleAction = async ({ actionId, selectedIds }) => {
  actionLoading.value[actionId] = true;
  try {
    switch (actionId) {
    case 'edit':
      emit('edit', props.clients.find(client => client.id === selectedIds[0]));
      break;
    case 'delete':
      if (window.confirm('¿Estás seguro de querer eliminar este cliente B2B?')) {
        emit('delete', selectedIds[0]);
      }
      break;
    }
  } catch (error) {
    console.error('Action failed:', error);
  } finally {
    actionLoading.value[actionId] = false;
  }
};
</script>

<template>
  <div>
    <!-- Error State -->
    <div v-if="error" class="text-danger text-center py-4">
      {{ error }}
    </div>

    <!-- Table -->
    <div>
      <DataTable
        ref="dataTable"
        :data="clients"
        :columns="columns"
        :actions="tableActions"
        :action-loading="actionLoading"
        :data-loading="loading"
        @selection-change="handleSelectionChange"
        @action="handleAction"
        :wrapper-class="`bg-white shadow-lg rounded-lg`"
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
