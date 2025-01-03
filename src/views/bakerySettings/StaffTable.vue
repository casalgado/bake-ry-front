<script setup>
import { ref } from 'vue';
import DataTable from '@/components/DataTable/index.vue';
import { PhPen, PhTrash } from '@phosphor-icons/vue';

const props = defineProps({
  loading: Boolean,
  error: String,
  staff: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['edit', 'delete']);

const dataTable = ref(null);
const selectedStaff = ref(null);
const actionLoading = ref({});

const columns = [
  {
    id: 'first_name',
    label: 'Nombre',
    field: 'first_name',
    sortable: true,
  },
  {
    id: 'role',
    label: 'Rol',
    field: 'role',
    sortable: true,
    displayText: {
      'admin': 'Admin',
      'bakery_staff': 'Staff',
      'delivery_assistant': 'Domiciliario',
      'production_assistant': 'Producción',
    },
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
];

const handleSelectionChange = (selectedIds) => {
  if (selectedIds.length === 1) {
    selectedStaff.value = props.staff.find(staff => staff.id === selectedIds[0]);
  } else {
    selectedStaff.value = null;
  }
};

const handleAction = async ({ actionId, selectedIds }) => {
  actionLoading.value[actionId] = true;
  try {
    switch (actionId) {
    case 'edit':
      emit('edit', props.staff.find(staff => staff.id === selectedIds[0]));
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
        :data="staff"
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
