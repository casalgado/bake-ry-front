<script setup>
import { ref } from "vue";

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

// Category options in Spanish
const categoryOptions = [
  "Harinas y Almidones",
  "Líquidos Base",
  "Sazonadores Básicos",
  "Fermentos",
  "Lácteos y Proteínas",
  "Semillas y Granos",
  "Frutas y Vegetales",
  "Especias y Aromáticos",
  "Chocolates y Cocoa",
];

// Unit options in Spanish
const unitOptions = ["kg", "g", "L", "ml", "unidades", "docena", "paquete"];

// Storage temperature options
const storageTempOptions = ["Ambiente", "Refrigeracion", "Congelacion"];

// Initialize form data
const formData = ref(
  props.initialData || {
    name: "test",
    description: "test_ingredient",
    category: "",
    unit: "",
    costPerUnit: 10,
    suppliers: [],
    storageTemp: "",
  }
);

// For managing supplier inputs
const newSupplier = ref({
  name: "",
  contact: "",
  address: "",
});

const errors = ref({});

const validate = () => {
  errors.value = {};

  if (!formData.value.name) errors.value.name = "El nombre es requerido";
  if (!formData.value.category)
    errors.value.category = "La categoría es requerida";
  if (!formData.value.unit) errors.value.unit = "La unidad es requerida";
  if (!formData.value.costPerUnit)
    errors.value.costPerUnit = "El costo por unidad es requerido";
  if (formData.value.costPerUnit <= 0)
    errors.value.costPerUnit = "El costo por unidad debe ser mayor que 0";
  if (!formData.value.storageTemp)
    errors.value.storageTemp = "La temperatura de almacenamiento es requerida";

  return Object.keys(errors.value).length === 0;
};

const addSupplier = () => {
  if (newSupplier.value.name && newSupplier.value.contact) {
    formData.value.suppliers.push({ ...newSupplier.value });
    // Reset the new supplier form
    newSupplier.value = {
      name: "",
      contact: "",
      address: "",
    };
  }
};

const removeSupplier = (index) => {
  formData.value.suppliers.splice(index, 1);
};

const handleSubmit = async () => {
  if (!validate()) return;
  emit("submit", formData.value);
};

const emit = defineEmits(["submit", "cancel"]);
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <!-- Nombre -->
    <div>
      <label>Nombre</label>
      <input
        type="text"
        v-model="formData.name"
        placeholder="Nombre del ingrediente"
      />
      <span v-if="errors.name">{{ errors.name }}</span>
    </div>

    <!-- Descripción -->
    <div>
      <label>Descripción</label>
      <textarea
        v-model="formData.description"
        rows="3"
        placeholder="Descripción del ingrediente"
      ></textarea>
    </div>

    <!-- Categoría -->
    <div>
      <label>Categoría</label>
      <select v-model="formData.category">
        <option value="">Seleccione una categoría</option>
        <option
          v-for="category in categoryOptions"
          :key="category"
          :value="category"
        >
          {{ category }}
        </option>
      </select>
      <span v-if="errors.category">{{ errors.category }}</span>
    </div>

    <!-- Unidad -->
    <div>
      <label>Unidad</label>
      <select v-model="formData.unit">
        <option value="">Seleccione una unidad</option>
        <option v-for="unit in unitOptions" :key="unit" :value="unit">
          {{ unit }}
        </option>
      </select>
      <span v-if="errors.unit">{{ errors.unit }}</span>
    </div>

    <!-- Costo por Unidad -->
    <div>
      <label>Costo por Unidad</label>
      <input type="number" v-model="formData.costPerUnit" step="0.01" min="0" />
      <span v-if="errors.costPerUnit">{{ errors.costPerUnit }}</span>
    </div>

    <!-- Temperatura de Almacenamiento -->
    <div>
      <label>Temperatura de Almacenamiento</label>
      <select v-model="formData.storageTemp">
        <option value="">Seleccione temperatura de almacenamiento</option>
        <option v-for="temp in storageTempOptions" :key="temp" :value="temp">
          {{ temp }}
        </option>
      </select>
      <span v-if="errors.storageTemp">{{ errors.storageTemp }}</span>
    </div>

    <!-- Proveedores -->
    <div>
      <label>Proveedores</label>

      <!-- Formulario de nuevo proveedor -->
      <div>
        <input
          type="text"
          v-model="newSupplier.name"
          placeholder="Nombre del proveedor"
        />
        <input
          type="text"
          v-model="newSupplier.contact"
          placeholder="Información de contacto"
        />
        <input
          type="text"
          v-model="newSupplier.address"
          placeholder="Dirección"
        />
        <button type="button" @click="addSupplier">Agregar Proveedor</button>
      </div>

      <!-- Lista de proveedores -->
      <div v-if="formData.suppliers.length > 0">
        <div v-for="(supplier, index) in formData.suppliers" :key="index">
          <div>
            <strong>{{ supplier.name }}</strong>
            <div>Contacto: {{ supplier.contact }}</div>
            <div>Dirección: {{ supplier.address }}</div>
            <button type="button" @click="removeSupplier(index)">
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Botones de acción -->
    <div>
      <button type="button" @click="$emit('cancel')" :disabled="loading">
        Cancelar
      </button>
      <button type="submit" :disabled="loading">
        {{ loading ? "Guardando..." : "Guardar" }}
      </button>
    </div>
  </form>
</template>
