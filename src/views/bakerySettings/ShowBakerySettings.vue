<script setup>
import { ref, onMounted } from 'vue';
import { Dialog, DialogPanel } from '@headlessui/vue';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { useBakeryUserStore } from '@/stores/bakeryUserStore';
import StaffTable from './StaffTable.vue';
import B2BClientsTable from './B2BClientsTable.vue';
import BakeryUserForm from '@/components/forms/BakeryUserForm.vue';

const settingsStore = useBakerySettingsStore();
const bakeryUserStore = useBakeryUserStore();
const staffData = ref([]);
const b2bClientsData = ref([]);

// Form states - simplified to single form handling
const isFormOpen = ref(false);
const selectedUser = ref(null);

// Table refs
const staffTable = ref(null);
const b2bTable = ref(null);

onMounted(async () => {
  await settingsStore.fetchById('default');
  staffData.value = await settingsStore.staff;
  b2bClientsData.value = await settingsStore.b2b_clients;
  console.log(b2bClientsData.value);
});

// Unified form handlers
const handleEdit = async (user) => {
  selectedUser.value = await bakeryUserStore.fetchById(user.id);
  console.log(selectedUser.value);
  isFormOpen.value = true;
  await settingsStore.fetchById('default');
  staffData.value = await settingsStore.staff;
  b2bClientsData.value = await settingsStore.b2b_clients;
};

const handleSubmit = async (formData) => {
  try {
    if (selectedUser.value) {
      await bakeryUserStore.update(selectedUser.value.id, formData);
    }

    closeForm();
  } catch (error) {
    console.error('Failed to update user:', error);
  }
};

const closeForm = () => {
  isFormOpen.value = false;
  selectedUser.value = null;
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
          ref="staffTable"
          :staff="staffData"
          :loading="settingsStore.loading"
          :error="settingsStore.error"
          @edit="handleEdit"
        />
      </section>

      <!-- B2B Clients Section -->
      <section class="">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-semibold text-neutral-800">Clientes B2B</h3>
        </div>

        <B2BClientsTable
          ref="b2bTable"
          :clients="b2bClientsData"
          :loading="settingsStore.loading"
          :error="settingsStore.error"
          @edit="handleEdit"
        />
      </section>

      <!-- Unified Form Dialog -->
      <Dialog
        :open="isFormOpen"
        @close="closeForm"
        class="relative z-50"
      >
        <div class="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div class="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel class="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <BakeryUserForm
              v-if="selectedUser"
              :title="`Edit ${selectedUser.role === 'staff' ? 'Staff Member' : 'B2B Client'}`"
              :key="selectedUser.id"
              :initial-data="selectedUser"
              :loading="settingsStore.loading"
              class="w-full"
              @submit="handleSubmit"
              @cancel="closeForm"
            />
          </DialogPanel>
        </div>
      </Dialog>

    </div>

    <div v-else-if="!settingsStore.loading && !settingsStore.currentItem"
         class="text-center py-8 text-neutral-600">
      No settings found.
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
