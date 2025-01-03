<!-- views/BakerySettings.vue -->
<script setup>
import { ref, onMounted } from 'vue';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import StaffTable from './StaffTable.vue';
import B2BClientsTable from './B2BClientsTable.vue';

const settingsStore = useBakerySettingsStore();
const staffData = ref([]);
const b2bClientsData = ref([]);

// Track which sections are being edited
const editingSections = ref({
  ingredientCategories: false,
  orderStatuses: false,
  theme: false,
});

onMounted(async () => {
  await settingsStore.fetchById('default');
  staffData.value = await settingsStore.staff;
  b2bClientsData.value = await settingsStore.b2b_clients;
});

const handleEditStaff = (staff) => {
  console.log('Edit staff member:', staff);
  // Implement edit functionality
};

const handleEditB2BClient = (client) => {
  console.log('Edit B2B client:', client);
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

      <!-- B2B Clients Section -->
      <section class="">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-semibold text-neutral-800">Clientes B2B</h3>
        </div>

        <B2BClientsTable
          :clients="b2bClientsData"
          :loading="settingsStore.loading"
          :error="settingsStore.error"
          @edit="handleEditB2BClient"
          @delete="handleDeleteB2BClient"
        />
      </section>

    </div>

    <div v-else-if="!settingsStore.loading && !settingsStore.currentItem"
         class="text-center py-8 text-neutral-600">
      No settings found.
    </div>
  </div>
</template>
