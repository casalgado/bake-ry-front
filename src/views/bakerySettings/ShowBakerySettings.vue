<!-- views/BakerySettings.vue -->
<script setup>
import { ref, onMounted } from 'vue';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import StaffTable from './StaffTable.vue';

const settingsStore = useBakerySettingsStore();
const staffData = ref([]);

// Track which sections are being edited
const editingSections = ref({
  ingredientCategories: false,
  orderStatuses: false,
  theme: false,
});

onMounted(async () => {
  await settingsStore.fetchById('default');
  staffData.value = await settingsStore.staff;
});

const handleEditStaff = (staff) => {
  console.log('Edit staff member:', staff);
  // Implement edit functionality
};

</script>

<template>
  <div class="container p-4 px-0 lg:px-4">
    <div class="flex flex-col lg:flex-row justify-between items-center mb-6">
      <h2 class="text-2xl font-bold text-neutral-800">Configuración</h2>
    </div>

    <!-- Settings Sections -->
    <div v-if="!settingsStore.loading && settingsStore.currentItem"
         class="space-y-6">

      <!-- Staff Section -->
      <section class="">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-semibold text-neutral-800">Equipo</h3>
        </div>

        <StaffTable
          :staff="staffData"
          :loading="settingsStore.loading"
          :error="settingsStore.error"
          @edit="handleEditStaff"
          @delete="handleDeleteStaff"
        />
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

    <div v-else-if="!settingsStore.loading && !settingsStore.currentItem"
         class="text-center py-8 text-neutral-600">
      Configuración no encontrada.
    </div>
  </div>
</template>
