<script setup>
import { ref, onMounted } from 'vue';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { useRouter } from 'vue-router';
import DataTable from '@/components/DataTable/index.vue';

const router = useRouter();
void router;
const settingsStore = useBakerySettingsStore();

// Track which sections are being edited
const editingSections = ref({
  ingredientCategories: false,
  orderStatuses: false,
  theme: false,
});

const staffData = ref([]);

const staffColumns = ref([
  { id: 'name', label: 'Nombre', field: 'name' },
  { id: 'role', label: 'Rol', field: 'role' },
]);

onMounted(async () => {
  await settingsStore.fetchById('default');
  staffData.value = await settingsStore.staff;
});

const toggleEdit = (section) => {
  editingSections.value[section] = !editingSections.value[section];
};

// const handleSubmit = async (formData, section) => {
//   try {
//     await settingsStore.patch('default', { [section]: formData });
//     editingSections.value[section] = false;
//   } catch (error) {
//     console.error(`Failed to update ${section}:`, error);
//   }
// };

// const handleCancel = (section) => {
//   editingSections.value[section] = false;
// };
</script>

<template>
  <div>
    <h2>Bakery Settings Management</h2>

    <!-- Loading State -->
    <div v-if="settingsStore.loading">Loading settings...</div>

    <!-- Error State -->
    <div v-if="settingsStore.error">
      {{ settingsStore.error }}
    </div>

    <!-- Settings Sections -->
    <div v-if="!settingsStore.loading && settingsStore.currentItem">

      <section>
        <div class="section-header">
          <h3>Equipo</h3>

        </div>

        <DataTable :data="staffData" :columns="staffColumns" />
      </section>

      <!-- Order Statuses Section -->
      <section>
        <div class="section-header">
          <h3>Order Statuses</h3>
          <button @click="toggleEdit('orderStatuses')">
            {{ editingSections.orderStatuses ? 'Cancel' : 'Edit' }}
          </button>
        </div>

        <ul v-if="!editingSections.orderStatuses">
          <li v-for="status in settingsStore.currentItem.orderStatuses" :key="status">
            {{ status }}
          </li>
        </ul>
      </section>

    </div>

    <div v-else-if="!settingsStore.loading && !settingsStore.currentItem">
      No settings found.
    </div>
  </div>
</template>

<style scoped lang="scss">

</style>
