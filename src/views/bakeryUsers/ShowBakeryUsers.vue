<script setup>
import { ref, onMounted, computed } from 'vue';
import { useBakeryUserStore } from '@/stores/bakeryUserStore';
import { useRouter } from 'vue-router';
import BakeryUserForm from '@/components/forms/BakeryUserForm.vue';

const router = useRouter();
const bakeryUserStore = useBakeryUserStore();

const showForm = ref(false);
const selectedUser = ref(null);
const searchQuery = ref('');
const selectedCategory = ref('');
const selectedRole = ref('');

// Category options
const categoryOptions = [
  { value: 'B2B', label: 'Empresa' },
  { value: 'B2C', label: 'Consumidor Final' },
];

// Role options
const roleOptions = [
  { value: 'bakery_customer', label: 'Cliente' },
  { value: 'bakery_staff', label: 'Personal' },
  { value: 'bakery_admin', label: 'Administrador' },
];

onMounted(async () => {
  await bakeryUserStore.fetchAll();
});

const filteredUsers = computed(() => {
  return bakeryUserStore.items.filter((user) => {
    const matchesSearch =
      user.name?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      user.national_id?.includes(searchQuery.value);

    const matchesCategory =
      !selectedCategory.value || user.category === selectedCategory.value;

    const matchesRole =
      !selectedRole.value || user.role === selectedRole.value;

    return matchesSearch && matchesCategory && matchesRole;
  });
});

const handleEdit = (user) => {
  selectedUser.value = user;
  showForm.value = true;
};

const handleDelete = async (userId) => {
  if (confirm('¿Está seguro que desea eliminar este usuario?')) {
    try {
      await bakeryUserStore.remove(userId);
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
    }
  }
};

const handleSubmit = async (formData) => {
  try {
    if (selectedUser.value) {
      await bakeryUserStore.update(selectedUser.value.id, formData);
    }
    showForm.value = false;
    selectedUser.value = null;
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
  }
};

const handleCancel = () => {
  showForm.value = false;
  selectedUser.value = null;
};

const navigateToCreate = () => {
  router.push('/dashboard/users/create');
};

const getRoleLabel = (role) => {
  return roleOptions.find(option => option.value === role)?.label || role;
};

const getCategoryLabel = (category) => {
  return categoryOptions.find(option => option.value === category)?.label || category;
};
</script>

<template>
  <div>
    <h2>Gestión de Usuarios</h2>

    <!-- Search and Filter Controls -->
    <div>
      <input
        type="text"
        v-model="searchQuery"
        placeholder="Buscar por nombre, email o documento..."
      />

      <select v-model="selectedCategory">
        <option value="">Todos los tipos</option>
        <option
          v-for="category in categoryOptions"
          :key="category.value"
          :value="category.value"
        >
          {{ category.label }}
        </option>
      </select>

      <select v-model="selectedRole">
        <option value="">Todos los roles</option>
        <option
          v-for="role in roleOptions"
          :key="role.value"
          :value="role.value"
        >
          {{ role.label }}
        </option>
      </select>

      <button @click="navigateToCreate">Nuevo Usuario</button>
    </div>

    <!-- Loading State -->
    <div v-if="bakeryUserStore.loading">Cargando usuarios...</div>

    <!-- Error State -->
    <div v-if="bakeryUserStore.error">
      {{ bakeryUserStore.error }}
    </div>

    <!-- Edit Form Modal -->
    <div v-if="showForm">
      <div>
        <h3>Editar Usuario</h3>
        <BakeryUserForm
          :key="selectedUser.id"
          :initial-data="selectedUser"
          :loading="bakeryUserStore.loading"
          :is-edit="true"
          @submit="handleSubmit"
          @cancel="handleCancel"
        />
      </div>
    </div>

    <!-- Users Table -->
    <div v-if="!bakeryUserStore.loading && filteredUsers.length > 0">
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Email</th>
            <th>Tipo</th>
            <th>Rol</th>
            <th>Teléfono</th>
            <th>Documento</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in filteredUsers" :key="user.id">
            <td>
              <div>{{ user.name }}</div>
              <div v-if="user.address">
                {{ user.address }}
              </div>
            </td>
            <td>{{ user.email }}</td>
            <td>{{ getCategoryLabel(user.category) }}</td>
            <td>{{ getRoleLabel(user.role) }}</td>
            <td>{{ user.phone || '-' }}</td>
            <td>{{ user.national_id || '-' }}</td>
            <td>
              <button @click="handleEdit(user)">Editar</button>
              <button @click="handleDelete(user.id)">Eliminar</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- No Results State -->
    <div v-else-if="!bakeryUserStore.loading && filteredUsers.length === 0">
      No se encontraron usuarios.
    </div>
  </div>
</template>

<style scoped lang="scss">
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}

th,
td {
  padding: 0.5rem;
  text-align: left;
  border: 1px solid #ddd;
}

button + button {
  margin-left: 0.5rem;
}
</style>
