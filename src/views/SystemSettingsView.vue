<script setup>
import { ref, onMounted, computed } from 'vue';
import { useSystemSettingsStore } from '@/stores/systemSettingsStore';

const systemSettingsStore = useSystemSettingsStore();
const isLoading = ref(true);

// Load settings on mount
onMounted(async () => {
  try {
    await systemSettingsStore.fetchSettings();
  } catch (error) {
    console.error('Error loading system settings:', error);
  } finally {
    isLoading.value = false;
  }
});

const settings = computed(() => systemSettingsStore.settings);
</script>

<template>
  <div class="form-container">
    <h1 class="text-2xl font-bold text-neutral-800 mb-6">Configuraciones del Sistema</h1>

    <div v-if="isLoading" class="flex justify-center items-center py-12">
      <div class="text-neutral-600">Cargando configuraciones...</div>
    </div>

    <div v-else-if="settings" class="space-y-6">
      <!-- Default Variation Templates -->
      <div class="base-card">
        <h3 class="text-lg font-semibold text-neutral-800 mb-4">Plantillas de Variaciones por Defecto</h3>
        <div class="bg-neutral-50 p-4 rounded-md border">
          <pre class="text-xs bg-white p-3 rounded border overflow-auto max-h-80 whitespace-pre-wrap">{{ JSON.stringify(settings.defaultVariationTemplates, null, 2) }}</pre>
        </div>
      </div>

      <!-- Available Payment Methods -->
      <div class="base-card">
        <h3 class="text-lg font-semibold text-neutral-800 mb-4">Métodos de Pago Disponibles</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="method in settings.availablePaymentMethods" :key="method.value" class="bg-neutral-50 p-3 rounded-md border">
            <div class="text-sm font-medium text-neutral-700">{{ method.label }}</div>
            <div class="text-xs text-neutral-600 mt-1">Valor: {{ method.value }}</div>
            <div class="text-xs text-neutral-600">Texto: {{ method.displayText }}</div>
          </div>
        </div>
      </div>

      <!-- Order Statuses -->
      <div class="base-card">
        <h3 class="text-lg font-semibold text-neutral-800 mb-4">Estados de Pedidos</h3>
        <div class="flex flex-wrap gap-2">
          <div v-for="status in settings.orderStatuses" :key="status" class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
            {{ status }}
          </div>
        </div>
      </div>

      <!-- Fulfillment Types -->
      <div class="base-card">
        <h3 class="text-lg font-semibold text-neutral-800 mb-4">Tipos de Entrega</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div v-for="type in settings.fulfillmentTypes" :key="type.key" class="bg-neutral-50 p-3 rounded-md border">
            <div class="text-sm font-medium text-neutral-700">{{ type.value }}</div>
            <div class="text-xs text-neutral-600 mt-1">Clave: {{ type.key }}</div>
          </div>
        </div>
      </div>

      <!-- Unit Options -->
      <div class="base-card">
        <h3 class="text-lg font-semibold text-neutral-800 mb-4">Opciones de Unidades</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="unit in settings.unitOptions" :key="unit.symbol" class="bg-neutral-50 p-3 rounded-md border">
            <div class="text-sm font-medium text-neutral-700">{{ unit.name }}</div>
            <div class="text-xs text-neutral-600 mt-1">Símbolo: {{ unit.symbol }}</div>
            <div class="text-xs text-neutral-600">Tipo: {{ unit.type }}</div>
            <div class="text-xs text-neutral-600">Plantilla: {{ unit.template }}</div>
          </div>
        </div>
      </div>

      <!-- Storage Temperatures -->
      <div class="base-card">
        <h3 class="text-lg font-semibold text-neutral-800 mb-4">Temperaturas de Almacenamiento</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div v-for="temp in settings.storageTemperatures" :key="temp.key" class="bg-neutral-50 p-3 rounded-md border">
            <div class="text-sm font-medium text-neutral-700">{{ temp.value }}</div>
            <div class="text-xs text-neutral-600 mt-1">Clave: {{ temp.key }}</div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="text-center py-12 text-neutral-600">
      No se pudieron cargar las configuraciones del sistema.
    </div>
  </div>
</template>

<style scoped>
.form-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}
</style>
