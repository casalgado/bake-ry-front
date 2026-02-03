<script setup>
import { ref, onMounted, computed } from 'vue';
import { PhDownload, PhUpload, PhCheck, PhWarning, PhX } from '@phosphor-icons/vue';
import { useProductStore } from '@/stores/productStore';
import ToastNotification from '@/components/ToastNotification.vue';
import {
  exportProducts,
  parseProductsFile,
  computeProductChanges,
  applyProductUpdates,
} from '@/utils/productImportExport';

const productStore = useProductStore();
const toastRef = ref(null);

// Export state
const exportFormat = ref('xlsx');
const isExporting = ref(false);

// Import state
const selectedFile = ref(null);
const parsedRows = ref([]);
const changePreview = ref(null);
const isParsingFile = ref(false);
const isApplyingChanges = ref(false);
const isDragOver = ref(false);

onMounted(async () => {
  if (!productStore.items.length) {
    await productStore.fetchAll();
  }
});

const hasChanges = computed(() => changePreview.value?.changes?.length > 0);
const hasErrors = computed(() => changePreview.value?.errors?.length > 0);

// Export functions
async function handleExport() {
  if (productStore.items.length === 0) {
    toastRef.value?.showError('No hay productos para exportar');
    return;
  }

  isExporting.value = true;
  try {
    const result = exportProducts(productStore.items, exportFormat.value);
    toastRef.value?.showSuccess(`Exportados ${result.rowCount} registros`);
  } catch (error) {
    console.error('Export failed:', error);
    toastRef.value?.showError('Error al exportar', error.message);
  } finally {
    isExporting.value = false;
  }
}

// Import functions
function handleDragOver(event) {
  event.preventDefault();
  isDragOver.value = true;
}

function handleDragLeave() {
  isDragOver.value = false;
}

function handleDrop(event) {
  event.preventDefault();
  isDragOver.value = false;
  const files = event.dataTransfer.files;
  if (files.length > 0) {
    processFile(files[0]);
  }
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    processFile(file);
  }
}

async function processFile(file) {
  // Validate file type
  const validTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
  ];
  const validExtensions = ['.xlsx', '.xls', '.csv'];
  const hasValidExtension = validExtensions.some(ext =>
    file.name.toLowerCase().endsWith(ext),
  );

  if (!validTypes.includes(file.type) && !hasValidExtension) {
    toastRef.value?.showError('Formato no válido', 'Por favor sube un archivo Excel o CSV');
    return;
  }

  selectedFile.value = file;
  isParsingFile.value = true;
  changePreview.value = null;

  try {
    parsedRows.value = await parseProductsFile(file);
    changePreview.value = computeProductChanges(parsedRows.value, productStore.items);

    if (changePreview.value.changes.length === 0 && changePreview.value.errors.length === 0) {
      toastRef.value?.showSuccess('No se detectaron cambios');
    }
  } catch (error) {
    console.error('Parse failed:', error);
    toastRef.value?.showError('Error al procesar archivo', error.message);
    selectedFile.value = null;
    parsedRows.value = [];
  } finally {
    isParsingFile.value = false;
  }
}

async function handleApplyChanges() {
  if (!changePreview.value?.changes?.length) return;

  isApplyingChanges.value = true;
  try {
    const result = await applyProductUpdates(changePreview.value.changes, productStore);

    if (result.success > 0) {
      toastRef.value?.showSuccess(
        `Actualizados ${result.success} productos`,
        result.failed > 0 ? `${result.failed} fallaron` : undefined,
      );
    }

    if (result.failed > 0 && result.success === 0) {
      toastRef.value?.showError('Error al aplicar cambios', result.errors.join(', '));
    }

    // Refresh products and clear state
    await productStore.fetchAll();
    clearImportState();
  } catch (error) {
    console.error('Apply changes failed:', error);
    toastRef.value?.showError('Error al aplicar cambios', error.message);
  } finally {
    isApplyingChanges.value = false;
  }
}

function clearImportState() {
  selectedFile.value = null;
  parsedRows.value = [];
  changePreview.value = null;
}

function formatValue(value, field) {
  if (field === 'costPrice' || field === 'basePrice') {
    return `$${Number(value || 0).toLocaleString()}`;
  }
  return value || '-';
}
</script>

<template>
  <div class="container p-2 sm:p-4 px-2 lg:px-4">
    <h2 class="text-lg sm:text-2xl font-bold text-neutral-800 mb-4">Importar / Exportar Productos</h2>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      <!-- Export Section -->
      <div class="base-card">
        <h3 class="text-base sm:text-lg font-semibold mb-2 sm:mb-4 flex items-center gap-2">
          <PhDownload class="w-5 h-5" />
          Exportar Productos
        </h3>

        <p class="text-neutral-600 mb-4">
          Descarga todos los productos en formato Excel o CSV para editar precios y códigos contables.
        </p>

        <div class="mb-4">
          <label class="block text-sm font-medium text-neutral-700 mb-2">
            Formato
          </label>
          <div class="flex gap-4">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                v-model="exportFormat"
                type="radio"
                value="xlsx"
                class="text-blue-600"
              >
              <span>Excel (.xlsx)</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                v-model="exportFormat"
                type="radio"
                value="csv"
                class="text-blue-600"
              >
              <span>CSV</span>
            </label>
          </div>
        </div>

        <button
          class="action-btn w-full flex items-center justify-center gap-2 py-2 disabled:opacity-50"
          :disabled="isExporting || productStore.loading"
          @click="handleExport"
        >
          <PhDownload class="w-4 h-4" />
          {{ isExporting ? 'Exportando...' : 'Exportar' }}
        </button>

        <p class="text-sm text-neutral-500 mt-3">
          {{ productStore.items.length }} productos disponibles
        </p>
      </div>

      <!-- Import Section -->
      <div class="base-card">
        <h3 class="text-base sm:text-lg font-semibold mb-2 sm:mb-4 flex items-center gap-2">
          <PhUpload class="w-5 h-5" />
          Importar Productos
        </h3>

        <p class="text-neutral-600 mb-4">
          Sube un archivo Excel o CSV para actualizar precios y códigos contables.
          Solo se actualizarán las celdas con valores.
        </p>

        <!-- File Drop Zone -->
        <div
          class="border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer"
          :class="{
            'border-blue-500 bg-blue-50': isDragOver,
            'border-neutral-300 hover:border-neutral-400': !isDragOver && !selectedFile,
            'border-green-500 bg-green-50': selectedFile && !isParsingFile,
          }"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @drop="handleDrop"
          @click="$refs.fileInput.click()"
        >
          <input
            ref="fileInput"
            type="file"
            accept=".xlsx,.xls,.csv"
            class="hidden"
            @change="handleFileSelect"
          >

          <div v-if="isParsingFile" class="text-neutral-600">
            <div class="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
            Procesando archivo...
          </div>

          <div v-else-if="selectedFile" class="text-green-700">
            <PhCheck class="w-8 h-8 mx-auto mb-2" />
            {{ selectedFile.name }}
            <button
              class="block mx-auto mt-2 text-sm text-neutral-500 hover:text-neutral-700"
              @click.stop="clearImportState"
            >
              Cambiar archivo
            </button>
          </div>

          <div v-else class="text-neutral-500">
            <PhUpload class="w-8 h-8 mx-auto mb-2" />
            <p>Arrastra un archivo aquí o haz clic para seleccionar</p>
            <p class="text-sm mt-1">Formatos: Excel (.xlsx, .xls) o CSV</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Changes Preview -->
    <div v-if="changePreview" class="mt-4 sm:mt-6 base-card">
      <h3 class="text-base sm:text-lg font-semibold mb-2 sm:mb-4">Vista Previa de Cambios</h3>

      <!-- Summary -->
      <div class="flex flex-wrap gap-2 sm:gap-4 mb-2 sm:mb-4 text-sm">
        <span class="px-3 py-1 rounded bg-neutral-100">
          {{ changePreview.summary.totalRows }} filas procesadas
        </span>
        <span
          v-if="hasChanges"
          class="px-3 py-1 rounded bg-blue-100 text-blue-800"
        >
          {{ changePreview.summary.changesCount }} cambios detectados
        </span>
        <span
          v-if="hasErrors"
          class="px-3 py-1 rounded bg-red-100 text-red-800"
        >
          {{ changePreview.summary.errorsCount }} errores
        </span>
      </div>

      <!-- Errors -->
      <div v-if="hasErrors" class="mb-2 sm:mb-4 p-4 bg-red-50 rounded-lg">
        <h4 class="font-medium text-red-800 flex items-center gap-2 mb-2">
          <PhWarning class="w-5 h-5" />
          Errores encontrados
        </h4>
        <ul class="text-sm text-red-700 space-y-1">
          <li v-for="error in changePreview.errors" :key="error.row">
            Fila {{ error.row }}: {{ error.message }}
          </li>
        </ul>
      </div>

      <!-- Changes Table -->
      <div v-if="hasChanges" class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b bg-neutral-50">
              <th class="text-left p-3">Producto</th>
              <th class="text-left p-3">Variación</th>
              <th class="text-left p-3">Campo</th>
              <th class="text-left p-3">Valor Actual</th>
              <th class="text-left p-3">Nuevo Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(change, index) in changePreview.changes"
              :key="index"
              class="border-b hover:bg-neutral-50"
            >
              <td class="p-3">{{ change.productName }}</td>
              <td class="p-3">{{ change.combinationName || '-' }}</td>
              <td class="p-3">{{ change.fieldLabel }}</td>
              <td class="p-3 text-red-600">
                {{ formatValue(change.oldValue, change.field) }}
              </td>
              <td class="p-3 text-green-600 font-medium">
                {{ formatValue(change.newValue, change.field) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- No Changes Message -->
      <div
        v-else-if="!hasErrors"
        class="text-center text-neutral-500 py-8"
      >
        <PhCheck class="w-12 h-12 mx-auto mb-2 text-green-500" />
        No se detectaron cambios en el archivo importado.
      </div>

      <!-- Apply Button -->
      <div v-if="hasChanges" class="mt-4 sm:mt-6 flex justify-end gap-4">
        <button
          class="px-4 py-2 text-neutral-600 hover:text-neutral-800"
          :disabled="isApplyingChanges"
          @click="clearImportState"
        >
          Cancelar
        </button>
        <button
          class="action-btn flex items-center gap-2 disabled:opacity-50"
          :disabled="isApplyingChanges"
          @click="handleApplyChanges"
        >
          <PhCheck class="w-4 h-4" />
          {{ isApplyingChanges ? 'Aplicando...' : 'Confirmar Importación' }}
        </button>
      </div>
    </div>

    <!-- Toast Notification -->
    <ToastNotification ref="toastRef" />
  </div>
</template>
