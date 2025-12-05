<script setup>
import { ref, computed, onMounted } from 'vue';
import { useProductCollectionStore } from '@/stores/productCollectionStore';
import { useAuthenticationStore } from '@/stores/authentication';
import { OrderService } from '@/services/orderService';
import { exportProductReport } from '@/utils/exportOrders';

const collectionStore = useProductCollectionStore();
const authStore = useAuthenticationStore();

// Form state
const loading = ref(false);
const error = ref(null);

// Get first day of current month as default start
const getDefaultStartDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
};

// Get today as default end
const getDefaultEndDate = () => {
  const now = new Date();
  return now.toISOString().split('T')[0];
};

const formData = ref({
  start_date: getDefaultStartDate(),
  end_date: getDefaultEndDate(),
  categories: [],
  period: '',
  metrics: 'both',
  segment: 'none',
  date_field: 'dueDate',
  outputFormat: 'xlsx',
});

// Options for selects
const periodOptions = [
  { value: '', label: 'Sin agrupar' },
  { value: 'daily', label: 'Diario' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensual' },
];

const metricsOptions = [
  { value: 'both', label: 'Ambos' },
  { value: 'ingresos', label: 'Ingresos' },
  { value: 'cantidad', label: 'Cantidad' },
];

const segmentOptions = [
  { value: 'none', label: 'Combinado' },
  { value: 'all', label: 'Desglose B2B/B2C' },
  { value: 'b2b', label: 'Solo B2B' },
  { value: 'b2c', label: 'Solo B2C' },
];

const dateFieldOptions = [
  { value: 'dueDate', label: 'Fecha de Entrega' },
  { value: 'paymentDate', label: 'Fecha de Pago' },
];

const outputOptions = [
  //{ value: 'console', label: 'Ver en consola' },
  { value: 'csv', label: 'Descargar CSV' },
  { value: 'xlsx', label: 'Descargar Excel' },
];

// Categories from store
const categories = computed(() => collectionStore.items || []);

// Toggle category selection
const toggleCategory = (categoryId) => {
  const index = formData.value.categories.indexOf(categoryId);
  if (index === -1) {
    formData.value.categories.push(categoryId);
  } else {
    formData.value.categories.splice(index, 1);
  }
};

// Check if category is selected
const isCategorySelected = (categoryId) => {
  return formData.value.categories.includes(categoryId);
};

// Select/deselect all categories
const toggleAllCategories = () => {
  if (formData.value.categories.length === categories.value.length) {
    formData.value.categories = [];
  } else {
    formData.value.categories = categories.value.map(c => c.id);
  }
};

const allCategoriesSelected = computed(() => {
  return categories.value.length > 0 &&
    formData.value.categories.length === categories.value.length;
});

// Submit the form
const handleSubmit = async () => {
  loading.value = true;
  error.value = null;

  try {
    const service = new OrderService(authStore.getBakeryId);

    // Build query using the same structure as salesReport
    const query = {
      filters: {
        dateRange: {
          dateField: formData.value.date_field,
          startDate: formData.value.start_date,
          endDate: formData.value.end_date,
        },
      },
      options: {
        metrics: formData.value.metrics,
        segment: formData.value.segment,
      },
    };

    // Add period if selected
    if (formData.value.period) {
      query.options.period = formData.value.period;
    }

    // Add categories if any selected (comma-separated)
    if (formData.value.categories.length > 0) {
      query.filters.categories = formData.value.categories.join(',');
    }

    console.log('Fetching product report with query:', query);
    const response = await service.getProductReport(query);
    console.log('Product Report Response:', response.data);

    exportProductReport(response.data, {
      format: formData.value.outputFormat,
      startDate: formData.value.start_date,
      endDate: formData.value.end_date,
    });
  } catch (err) {
    console.error('Error fetching product report:', err);
    error.value = err.message || 'Error al obtener el reporte';
  } finally {
    loading.value = false;
  }
};

// Load categories on mount
onMounted(async () => {
  if (!collectionStore.items.length) {
    await collectionStore.fetchAll();
  }
});
</script>

<template>
  <div class="bg-white rounded-lg shadow p-4">
    <h3 class="text-lg font-semibold mb-4">Ventas por Producto</h3>

    <form @submit.prevent="handleSubmit" class="space-y-4">
      <!-- Date Range -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-neutral-700 mb-1">
            Fecha Inicio
          </label>
          <input
            type="date"
            v-model="formData.start_date"
            class="form-input w-full"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-neutral-700 mb-1">
            Fecha Fin
          </label>
          <input
            type="date"
            v-model="formData.end_date"
            class="form-input w-full"
          />
        </div>
      </div>

      <!-- Date Field -->
      <div>
        <label class="block text-sm font-medium text-neutral-700 mb-1">
          Campo de Fecha
        </label>
        <select v-model="formData.date_field" class="form-input w-full">
          <option
            v-for="option in dateFieldOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </div>

      <!-- Categories (multi-select checkboxes) -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="block text-sm font-medium text-neutral-700">
            Categorias
          </label>
          <button
            type="button"
            @click="toggleAllCategories"
            class="text-sm text-primary-600 hover:text-primary-800"
          >
            {{ allCategoriesSelected ? 'Deseleccionar todas' : 'Seleccionar todas' }}
          </button>
        </div>
        <div class="border rounded-md p-2">
          <div v-if="categories.length === 0" class="text-neutral-500 text-sm">
            Cargando categorias...
          </div>
          <label
            v-for="category in categories"
            :key="category.id"
            class="flex items-center gap-2 py-1 px-2 hover:bg-neutral-50 rounded cursor-pointer"
          >
            <input
              type="checkbox"
              :checked="isCategorySelected(category.id)"
              @change="toggleCategory(category.id)"
              class="form-checkbox"
            />
            <span class="text-sm capitalize">{{ category.name }}</span>
          </label>
        </div>
        <p class="text-xs text-neutral-500 mt-1">
          {{ formData.categories.length === 0 ? 'Todas las categorias' : `${formData.categories.length} seleccionada(s)` }}
        </p>
      </div>

      <!-- Period -->
      <div>
        <label class="block text-sm font-medium text-neutral-700 mb-1">
          Agrupar por
        </label>
        <select v-model="formData.period" class="form-input w-full">
          <option
            v-for="option in periodOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </div>

      <!-- Metrics -->
      <div>
        <label class="block text-sm font-medium text-neutral-700 mb-1">
          Metricas
        </label>
        <select v-model="formData.metrics" class="form-input w-full">
          <option
            v-for="option in metricsOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </div>

      <!-- Segment -->
      <div>
        <label class="block text-sm font-medium text-neutral-700 mb-1">
          Segmento
        </label>
        <select v-model="formData.segment" class="form-input w-full">
          <option
            v-for="option in segmentOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </div>

      <!-- Output Format -->
      <div>
        <label class="block text-sm font-medium text-neutral-700 mb-1">
          Formato de salida
        </label>
        <select v-model="formData.outputFormat" class="form-input w-full">
          <option
            v-for="option in outputOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </div>

      <!-- Error message -->
      <div v-if="error" class="text-danger text-sm">
        {{ error }}
      </div>

      <!-- Submit -->
      <button
        type="submit"
        :disabled="loading"
        class="btn-primary w-full"
      >
        {{ loading ? 'Generando...' : 'Generar Reporte' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.form-input {
  @apply border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent;
}

.form-checkbox {
  @apply rounded border-neutral-300 text-primary-600 focus:ring-primary;
}

.btn-primary {
  @apply bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed;
}
</style>
