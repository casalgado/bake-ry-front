<script setup>
import { ref, defineProps, defineEmits, computed } from 'vue';
import RadioButtonGroup from '@/components/forms/RadioButtonGroup.vue';
import { parseSpanishName } from '@/utils/helpers';

const props = defineProps({
  title: {
    type: String,
    default: 'Crear Usuario',
  },
  initialData: {
    type: Object,
    default: () => ({
      email: '',
      password: '',
      role: 'bakery_customer',
      name: '',
      category: 'B2C',
      address: '',
      birthday: '',
      comment: '',
      phone: '',
      national_id: '',
    }),
  },
  loading: {
    type: Boolean,
    default: false,
  },
  isEdit: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['submit', 'cancel']);

const formData = ref({ ...props.initialData });

// Combined options with both role and category values
const userTypeOptions = [
  { value: 'client', label: 'Cliente', role: 'bakery_customer', category: 'B2C' },
  { value: 'company', label: 'Empresa', role: 'bakery_customer', category: 'B2B' },
  { value: 'staff', label: 'Staff', role: 'bakery_staff', category: 'PER' },
  { value: 'delivery', label: 'Asistente Domicilio', role: 'delivery_assistant', category: 'PER' },
  { value: 'production', label: 'Asistente Produccion', role: 'production_assistant', category: 'PER' },
];

// Compute initial selected value based on role and category
const getInitialUserType = () => {
  const { role, category } = formData.value;
  if (role === 'bakery_customer') {
    return category === 'B2B' ? 'company' : 'client';
  }
  if (role === 'bakery_staff') return 'staff';
  if (role === 'delivery_assistant') return 'delivery';
  if (role === 'production_assistant') return 'production';
  return 'client'; // default
};

const selectedUserType = ref(getInitialUserType());

// Update both role and category when user type changes
const handleUserTypeChange = (value) => {
  const selected = userTypeOptions.find(opt => opt.value === value);
  if (selected) {
    formData.value.role = selected.role;
    formData.value.category = selected.category;
  }
};

const errors = ref({});

const validate = () => {
  errors.value = {};

  if (!formData.value.email) errors.value.email = 'El correo electrónico es requerido';
  if (!formData.value.role) errors.value.role = 'El rol es requerido';
  if (!formData.value.name) errors.value.name = 'El nombre es requerido';

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (formData.value.email && !emailRegex.test(formData.value.email)) {
    errors.value.email = 'Formato de correo electrónico inválido';
  }

  console.log(errors.value);
  return Object.keys(errors.value).length === 0;
};

// Computed property for submit button text
const submitButtonText = computed(() => {
  return props.initialData.id ? 'Actualizar Usuario' : 'Crear Usuario';
});

// Computed property for loading text
const loadingText = computed(() => {
  return props.initialData.id ? 'Actualizando...' : 'Creando...';
});

const handleSubmit = () => {
  const submitData = {
    ...formData.value,
    ...parseSpanishName(formData.value.name, formData.value.category),
  };

  if (!validate()) return;
  console.log('valido');
  emit('submit', submitData);
};
</script>

<template>
  <div class="form-container">
    <h2>{{ title }}</h2>

    <form @submit.prevent="handleSubmit" class="base-card">
      <div>
        <label>Nombre</label>
        <input
          type="text"
          v-model="formData.name"
          required
          class="w-full"
        />
        <span v-if="errors.name" class="text-danger text-sm">{{ errors.name }}</span>
      </div>

      <div>
        <label>Correo Electrónico</label>
        <input
          type="email"
          v-model="formData.email"
          :disabled="isEdit"
          required

        />
        <span v-if="errors.email" class="text-danger text-sm">{{ errors.email }}</span>
      </div>

      <div>
        <RadioButtonGroup
          v-model="selectedUserType"
          :options="userTypeOptions"
          name="user-type"
          label="Tipo de Usuario"
          @update:modelValue="handleUserTypeChange"
        />
        <span v-if="errors.role" class="text-danger text-sm">{{ errors.role }}</span>
      </div>

      <div>
        <label>Teléfono</label>
        <input
          type="tel"
          v-model="formData.phone"

        />
      </div>

      <div>
        <label>Dirección</label>
        <input
          type="text"
          v-model="formData.address"

        />
      </div>

      <div>
        <label>Documento de Identidad</label>
        <input
          type="text"
          v-model="formData.national_id"

        />
      </div>

      <div>
        <label>Fecha de Nacimiento</label>
        <input
          type="date"
          v-model="formData.birthday"

        />
      </div>

      <div>
        <label>Comentarios</label>
        <textarea
          v-model="formData.comment"
          rows="3"

        ></textarea>
      </div>

      <div class="flex gap-2 justify-end">
        <button
          type="submit"
          :disabled="loading"
          class="action-btn"
        >
          {{ loading ? loadingText : submitButtonText}}
        </button>
        <button
          type="button"
          @click="$emit('cancel')"
          :disabled="loading"
          class="danger-btn"
        >
          Cancelar
        </button>

      </div>

    </form>
  </div>
</template>
