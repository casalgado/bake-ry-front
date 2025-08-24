<script setup>
import { ref, computed } from 'vue';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';

const props = defineProps({
  initialData: {
    type: Object,
    default: () => null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['submit', 'cancel']);

// Get categories from bakery settings
const bakerySettingsStore = useBakerySettingsStore();
const ingredientTypes = {
  manufactured: 'Fabricado',
  resale: 'Reventa',
};

// Computed properties for categories based on type
const categories = computed(() => {
  if (!formData.value.type) return [];
  return bakerySettingsStore.items?.[0]?.ingredientCategories?.[formData.value.type] || [];
});

// Unit options from bakery settings
const unitOptions = bakerySettingsStore.items?.[0]?.unitOptions || [
  { symbol: 'kg', name: 'Kilogram', type: 'weight' },
  { symbol: 'g', name: 'Gram', type: 'weight' },
  { symbol: 'L', name: 'Liter', type: 'volume' },
  { symbol: 'ml', name: 'Milliliter', type: 'volume' },
  { symbol: 'uds', name: 'Units', type: 'count' },
  { symbol: 'docena', name: 'Dozen', type: 'count' },
  { symbol: 'paquete', name: 'Package', type: 'count' },
];

// Storage temperature options from bakery settings
const storageTempOptions = bakerySettingsStore.items?.[0]?.storageTemperatures || [
  'Ambiente', 'Refrigeracion', 'Congelacion',
];

// Initialize form data
const formData = ref(
  props.initialData || {
    name: '',
    description: '',
    type: 'manufactured',
    categoryId: '',
    categoryName: '',
    notes: '',
    costPerUnit: 0,
    currency: 'COP',
    currentStock: 0,
    unit: '',
    suppliers: [],
    preferredSupplierId: null,
    storageTemp: '',
    isActive: true,
    isDiscontinued: false,
    customAttributes: {},
  },
);

// For managing supplier inputs
const newSupplier = ref({
  name: '',
  contact: '',
  address: '',
});

// For managing custom attributes
const newAttribute = ref({
  key: '',
  value: '',
});

const errors = ref({});

const validate = () => {
  errors.value = {};

  if (!formData.value.name) errors.value.name = 'El nombre es requerido';
  if (!formData.value.type) errors.value.type = 'El tipo es requerido';
  if (!formData.value.categoryId) errors.value.categoryId = 'La categoría es requerida';
  if (!formData.value.unit) errors.value.unit = 'La unidad es requerida';
  if (formData.value.costPerUnit < 0) errors.value.costPerUnit = 'El costo no puede ser negativo';
  if (!formData.value.storageTemp) errors.value.storageTemp = 'La temperatura de almacenamiento es requerida';
  if (formData.value.currentStock < 0) errors.value.currentStock = 'El stock no puede ser negativo';

  return Object.keys(errors.value).length === 0;
};

const handleCategoryChange = (event) => {
  const category = categories.value.find(cat => cat.id === event.target.value);
  if (category) {
    formData.value.categoryId = category.id;
    formData.value.categoryName = category.name;
  }
};

const addSupplier = () => {
  if (newSupplier.value.name && newSupplier.value.contact) {
    const supplier = { ...newSupplier.value, id: Date.now().toString() };
    formData.value.suppliers.push(supplier);

    // If this is the first supplier, set it as preferred
    if (formData.value.suppliers.length === 1) {
      formData.value.preferredSupplierId = supplier.id;
    }

    // Reset the form
    newSupplier.value = {
      name: '',
      contact: '',
      address: '',
    };
  }
};

const removeSupplier = (index) => {
  const supplier = formData.value.suppliers[index];
  formData.value.suppliers.splice(index, 1);

  // If removing preferred supplier, update preferredSupplierId
  if (supplier.id === formData.value.preferredSupplierId) {
    formData.value.preferredSupplierId = formData.value.suppliers[0]?.id || null;
  }
};

const addCustomAttribute = () => {
  if (newAttribute.value.key && newAttribute.value.value) {
    formData.value.customAttributes[newAttribute.value.key] = newAttribute.value.value;
    newAttribute.value = { key: '', value: '' };
  }
};

const removeCustomAttribute = (key) => {
  delete formData.value.customAttributes[key];
  formData.value.customAttributes = { ...formData.value.customAttributes };
};

const handleSubmit = async () => {
  if (!validate()) return;
  console.log('Submitting form data:', formData.value);
  emit('submit', formData.value);
};
</script>

<template>
  <form @submit.prevent="handleSubmit" class="space-y-6">
    <!-- Basic Information -->
    <div class="space-y-4">
      <h3 class="text-lg font-medium">Información Básica</h3>

      <!-- Name -->
      <div>
        <label class="block">Nombre</label>
        <input
          type="text"
          v-model="formData.name"
          class="form-input"
          :class="{ 'error': errors.name }"
        />
        <span v-if="errors.name" class="error-text">{{ errors.name }}</span>
      </div>

      <!-- Type -->
      <div>
        <label class="block">Tipo</label>
        <select
          v-model="formData.type"
          class="form-select"
          :class="{ 'error': errors.type }"
        >
          <option v-for="(label, type) in ingredientTypes" :key="type" :value="type">
            {{ label }}
          </option>
        </select>
        <span v-if="errors.type" class="error-text">{{ errors.type }}</span>
      </div>

      <!-- Category -->
      <div>
        <label class="block">Categoría</label>
        <select
          :value="formData.categoryId"
          @change="handleCategoryChange"
          class="form-select"
          :class="{ 'error': errors.categoryId }"
        >
          <option value="">Seleccione una categoría</option>
          <option
            v-for="category in categories"
            :key="category.id"
            :value="category.id"
          >
            {{ category.name }}
          </option>
        </select>
        <span v-if="errors.categoryId" class="error-text">{{ errors.categoryId }}</span>
      </div>

      <!-- Description -->
      <div>
        <label class="block">Descripción</label>
        <textarea
          v-model="formData.description"
          rows="3"
          class="form-textarea"
        ></textarea>
      </div>

      <!-- Notes -->
      <div>
        <label class="block">Notas</label>
        <textarea
          v-model="formData.notes"
          rows="2"
          class="form-textarea"
        ></textarea>
      </div>
    </div>

    <!-- Cost and Inventory -->
    <div class="space-y-4">
      <h3 class="text-lg font-medium">Costos e Inventario</h3>

      <!-- Cost Per Unit -->
      <div class="flex gap-4">
        <div class="flex-1">
          <label class="block">Costo por Unidad</label>
          <input
            type="number"
            v-model="formData.costPerUnit"
            step="0.01"
            min="0"
            class="form-input"
            :class="{ 'error': errors.costPerUnit }"
          />
          <span v-if="errors.costPerUnit" class="error-text">{{ errors.costPerUnit }}</span>
        </div>

        <div>
          <label class="block">Moneda</label>
          <input
            type="text"
            v-model="formData.currency"
            class="form-input"
            readonly
          />
        </div>
      </div>

      <!-- Current Stock -->
      <div>
        <label class="block">Stock Actual</label>
        <input
          type="number"
          v-model="formData.currentStock"
          step="0.01"
          min="0"
          class="form-input"
          :class="{ 'error': errors.currentStock }"
        />
        <span v-if="errors.currentStock" class="error-text">{{ errors.currentStock }}</span>
      </div>

      <!-- Unit -->
      <div>
        <label class="block">Unidad</label>
        <select
          v-model="formData.unit"
          class="form-select"
          :class="{ 'error': errors.unit }"
        >
          <option value="">Seleccione una unidad</option>
          <option v-for="unit in unitOptions" :key="unit.symbol" :value="unit.symbol">
            {{ unit.symbol }} - {{ unit.name }}
          </option>
        </select>
        <span v-if="errors.unit" class="error-text">{{ errors.unit }}</span>
      </div>
    </div>

    <!-- Storage and Status -->
    <div class="space-y-4">
      <h3 class="text-lg font-medium">Almacenamiento y Estado</h3>

      <!-- Storage Temperature -->
      <div>
        <label class="block">Temperatura de Almacenamiento</label>
        <select
          v-model="formData.storageTemp"
          class="form-select"
          :class="{ 'error': errors.storageTemp }"
        >
          <option value="">Seleccione temperatura</option>
          <option v-for="temp in storageTempOptions" :key="temp" :value="temp">
            {{ temp }}
          </option>
        </select>
        <span v-if="errors.storageTemp" class="error-text">{{ errors.storageTemp }}</span>
      </div>

      <!-- Status Toggles -->
      <div class="space-y-2">
        <div class="flex items-center gap-2">
          <input
            type="checkbox"
            v-model="formData.isActive"
            class="form-checkbox"
          />
          <label>Activo</label>
        </div>

        <div class="flex items-center gap-2">
          <input
            type="checkbox"
            v-model="formData.isDiscontinued"
            class="form-checkbox"
          />
          <label>Descontinuado</label>
        </div>
      </div>
    </div>

    <!-- Suppliers -->
    <div class="space-y-4">
      <h3 class="text-lg font-medium">Proveedores</h3>

      <!-- New Supplier Form -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <input
          type="text"
          v-model="newSupplier.name"
          placeholder="Nombre"
          class="form-input"
        />
        <input
          type="text"
          v-model="newSupplier.contact"
          placeholder="Contacto"
          class="form-input"
        />
        <input
          type="text"
          v-model="newSupplier.address"
          placeholder="Dirección"
          class="form-input"
        />
      </div>
      <button
        type="button"
        @click="addSupplier"
        class="btn-secondary"
      >
        Agregar Proveedor
      </button>

      <!-- Suppliers List -->
      <div v-if="formData.suppliers.length > 0" class="space-y-4">
        <div
          v-for="(supplier, index) in formData.suppliers"
          :key="supplier.id"
          class="p-4 border rounded-lg space-y-2"
        >
          <div class="flex items-center justify-between">
            <strong>{{ supplier.name }}</strong>
            <div class="flex items-center gap-2">
              <input
                type="radio"
                :name="'preferred-supplier'"
                :value="supplier.id"
                v-model="formData.preferredSupplierId"
                class="form-radio"
              />
              <label>Preferido</label>
              <button
                type="button"
                @click="removeSupplier(index)"
                class="btn-danger"
              >
                Eliminar
              </button>
            </div>
          </div>
          <div>Contacto: {{ supplier.contact }}</div>
          <div>Dirección: {{ supplier.address }}</div>
        </div>
      </div>
    </div>

    <!-- Custom Attributes -->
    <div class="space-y-4">
      <h3 class="text-lg font-medium">Atributos Personalizados</h3>

      <!-- New Attribute Form -->
      <div class="flex gap-4">
        <input
          type="text"
          v-model="newAttribute.key"
          placeholder="Nombre del atributo"
          class="form-input"
        />
        <input
          type="text"
          v-model="newAttribute.value"
          placeholder="Valor"
          class="form-input"
        />
        <button
          type="button"
          @click="addCustomAttribute"
          class="btn-secondary"
        >
          Agregar
        </button>
      </div>

      <!-- Attributes List -->
      <div v-if="Object.keys(formData.customAttributes).length > 0" class="space-y-2">
        <div
          v-for="(value, key) in formData.customAttributes"
          :key="key"
          class="flex items-center justify-between p-2 border rounded"
        >
          <div>
            <strong>{{ key }}:</strong> {{ value }}
          </div>
          <button
            type="button"
            @click="removeCustomAttribute(key)"
            class="btn-danger-sm"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>

    <!-- Form Actions -->
    <div class="flex justify-end gap-4">
      <button
        type="button"
        @click="$emit('cancel')"
        :disabled="loading"
        class="btn-secondary"
      >
        Cancelar
      </button>
      <button
        type="submit"
        :disabled="loading"
        class="btn-primary"
      >
        {{ loading ? "Guardando..." : "Guardar" }}
      </button>
    </div>
  </form>
</template>
