<script setup>
import { ref, onMounted } from 'vue';
import { Dialog, DialogPanel } from '@headlessui/vue';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { useBakeryUserStore } from '@/stores/bakeryUserStore';
import { PayUService } from '@/services/payuService';
import { useAuthenticationStore } from '@/stores/authentication';

const settingsStore = useBakerySettingsStore();
const bakeryUserStore = useBakeryUserStore();
const authStore = useAuthenticationStore();
const staffData = ref([]);
const b2bClientsData = ref([]);

// Initialize PayU service
const payuService = new PayUService(authStore.getBakeryId);

// Form states - simplified to single form handling
const isFormOpen = ref(false);
const selectedUser = ref(null);

// Payment methods state
const paymentMethods = ref([]);
const newCardForm = ref({
  cardNumber: '',
  expiryDate: '',
  cvv: '',
  cardholderName: '',
  identificationNumber: '',
});
const isAddingCard = ref(false);

onMounted(async () => {
  await settingsStore.fetchById('default');
  staffData.value = await settingsStore.staff;
  b2bClientsData.value = await settingsStore.b2b_clients;
  console.log(b2bClientsData.value);

  // Load stored payment methods
  await loadPaymentMethods();
});

// Load stored payment methods
const loadPaymentMethods = async () => {
  try {
    const response = await payuService.getStoredCards();
    paymentMethods.value = response.data || [];
  } catch (error) {
    console.error('Error loading payment methods:', error);
    paymentMethods.value = [];
  }
};

// Unified form handlers
const handleEdit = async (user) => {
  selectedUser.value = await bakeryUserStore.fetchById(user.id);
  console.log(selectedUser.value);
  isFormOpen.value = true;
  await settingsStore.fetchById('default');
  staffData.value = await settingsStore.staff;
  b2bClientsData.value = await settingsStore.b2b_clients;
};

// Payment methods handlers
const addCard = async () => {
  if (!isValidCard()) return;

  isAddingCard.value = true;
  try {
    const response = await payuService.createToken({
      cardNumber: newCardForm.value.cardNumber.replace(/\s/g, ''), // Remove spaces
      expiryDate: convertExpiryDate(newCardForm.value.expiryDate), // Convert MM/YY to YYYY/MM
      cvv: newCardForm.value.cvv,
      cardholderName: newCardForm.value.cardholderName,
      identificationNumber: newCardForm.value.identificationNumber,
    });

    // Refresh the payment methods list
    await loadPaymentMethods();
    resetForm();

    console.log('Card added successfully:', response);
  } catch (error) {
    console.error('Error adding card:', error);
    // You might want to show an error message to the user here
    alert('Error adding card: ' + (error.message || 'Unknown error'));
  } finally {
    isAddingCard.value = false;
  }
};

const deleteCard = async (cardId) => {
  try {
    await payuService.deleteToken(cardId);
    // Refresh the payment methods list
    await loadPaymentMethods();
    console.log('Card deleted successfully');
  } catch (error) {
    console.error('Error deleting card:', error);
    alert('Error deleting card: ' + (error.message || 'Unknown error'));
  }
};

const resetForm = () => {
  newCardForm.value = {
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardholderName: '',
    identificationNumber: '',
  };
};

const isValidCard = () => {
  const cleanCardNumber = newCardForm.value.cardNumber.replace(/\s/g, '');
  return cleanCardNumber.length >= 15 &&
         newCardForm.value.expiryDate.length === 5 &&
         newCardForm.value.cvv.length >= 3 &&
         newCardForm.value.cardholderName.length > 0 &&
         newCardForm.value.identificationNumber.length > 0;
};

// Format card number input
const formatCardNumber = (event) => {
  const value = event.target.value.replace(/\s/g, '').replace(/[^0-9]/gi, '');
  const formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
  newCardForm.value.cardNumber = formattedValue;
};

// Format expiry date input
const formatExpiryDate = (event) => {
  const value = event.target.value.replace(/\D/g, '');
  if (value.length >= 2) {
    newCardForm.value.expiryDate = value.slice(0, 2) + '/' + value.slice(2, 4);
  } else {
    newCardForm.value.expiryDate = value;
  }
};

// Convert MM/YY to YYYY/MM format for backend
const convertExpiryDate = (mmyy) => {
  const [month, year] = mmyy.split('/');
  const fullYear = '20' + year; // Convert YY to YYYY
  return `${fullYear}/${month}`;
};

// convert YYYY/MM to MM/YY for display
const convertToDisplayFormat = (date) => {
  const [year, month] = date.split('/');
  return `${month}/${year.slice(2)}`; // Convert YYYY/MM to MM/YY
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

      <!-- Payment Methods Section -->
      <section class="">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-semibold text-neutral-800">Métodos de Pago</h3>
        </div>

        <!-- Add Credit Card Form -->
        <div class="bg-white rounded-lg border border-neutral-200 p-6 mb-4">
          <h4 class="text-lg font-medium mb-4">Agregar Tarjeta de Crédito</h4>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-neutral-700 mb-2">
                Número de Tarjeta
              </label>
              <input
                v-model="newCardForm.cardNumber"
                @input="formatCardNumber"
                type="text"
                placeholder="1234 5678 9012 3456"
                maxlength="19"
                class="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-neutral-700 mb-2">
                Fecha de Expiración
              </label>
              <input
                v-model="newCardForm.expiryDate"
                @input="formatExpiryDate"
                type="text"
                placeholder="MM/YY"
                maxlength="5"
                class="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-neutral-700 mb-2">
                CVV
              </label>
              <input
                v-model="newCardForm.cvv"
                type="text"
                placeholder="123"
                maxlength="4"
                class="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-neutral-700 mb-2">
                Nombre del Titular
              </label>
              <input
                v-model="newCardForm.cardholderName"
                type="text"
                placeholder="Juan Pérez"
                class="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-neutral-700 mb-2">
                Número de Identificación
              </label>
              <input
                v-model="newCardForm.identificationNumber"
                type="text"
                placeholder="12345678"
                class="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div class="mt-4">
            <button
              @click="addCard"
              :disabled="!isValidCard() || isAddingCard"
              class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {{ isAddingCard ? 'Agregando...' : 'Agregar Tarjeta' }}
            </button>
          </div>
        </div>

        <!-- Stored Cards List -->
        <div class="bg-white rounded-lg border border-neutral-200 p-6">
          <h4 class="text-lg font-medium mb-4">Tarjetas Guardadas</h4>

          <div v-if="paymentMethods.length === 0" class="text-center py-8 text-neutral-600">
            No hay tarjetas guardadas
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="card in paymentMethods"
              :key="card.id"
              class="flex items-center justify-between p-4 border border-neutral-200 rounded-lg"
            >

              <div class="flex items-center space-x-4">
                <div class="w-12 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded flex items-center justify-center">
                  <span class="text-white text-xs font-bold">💳</span>
                </div>
                <div>
                  <div class="font-medium font-mono">{{ `****-****-****-${card.maskedNumber}` }}</div>
                  <div class="text-sm text-neutral-600">
                    {{ card.cardholderName }} • Exp: {{ convertToDisplayFormat(card.expirationDate) }}
                  </div>
                  <!-- <div class="text-xs text-neutral-500">Token: {{ card.token }}</div> -->
                </div>
              </div>
              <button
                @click="deleteCard(card.id)"
                class="text-red-600 hover:text-red-800 px-3 py-1 text-sm"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      </section>

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
