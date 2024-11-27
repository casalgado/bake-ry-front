<script setup>
import { ref, defineProps, defineEmits } from 'vue';
import RadioButtonGroup from '@/components/forms/RadioButtonGroup.vue'; // Adjust path as needed

const props = defineProps({
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

const roleOptions = [
  { value: 'bakery_customer', label: 'Cliente' },
  { value: 'bakery_staff', label: 'Staff' },
  { value: 'delivery_assistant', label: 'Asistente Domicilio' },
  { value: 'production_assistant', label: 'Asistente Produccion' },
];

const categoryOptions = [
  { value: 'B2B', label: 'B2B' },
  { value: 'B2C', label: 'B2C' },
];

const errors = ref({});

const validate = () => {
  errors.value = {};

  if (!formData.value.email) errors.value.email = 'El correo electrónico es requerido';
  if (!props.isEdit && !formData.value.password) errors.value.password = 'La contraseña es requerida';
  if (!formData.value.role) errors.value.role = 'El rol es requerido';
  if (!formData.value.name) errors.value.name = 'El nombre es requerido';
  if (!formData.value.category) errors.value.category = 'El tipo de cliente es requerido';

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (formData.value.email && !emailRegex.test(formData.value.email)) {
    errors.value.email = 'Formato de correo electrónico inválido';
  }

  // Password validation (only for new users)
  if (!props.isEdit && formData.value.password && formData.value.password.length < 6) {
    errors.value.password = 'La contraseña debe tener al menos 6 caracteres';
  }

  return Object.keys(errors.value).length === 0;
};

const handleSubmit = () => {
  if (!validate()) return;

  emit('submit', {
    ...formData.value,
    updatedAt: new Date(),
    createdAt: formData.value.createdAt || new Date(),
  });
};
</script>

<template>
  <form @submit.prevent="handleSubmit" class="base-card">

    <div>
      <label>Nombre</label>
      <input
        type="text"
        v-model="formData.firstName"
        required
        class="w-full"
      />
      <span v-if="errors.name" class="text-danger text-sm">{{ errors.name }}</span>
    </div>

    <div>
      <label>Apellido</label>
      <input
        type="text"
        v-model="formData.lastName"
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
        v-model="formData.role"
        :options="roleOptions"
        name="role"
        label="Rol"

      />
      <span v-if="errors.role" class="text-danger text-sm">{{ errors.role }}</span>
    </div>

    <div>
      <RadioButtonGroup
        v-model="formData.category"
        :options="categoryOptions"
        name="category"
        label="Tipo de Cliente"
      />
      <span v-if="errors.category" class="text-danger text-sm">{{ errors.category }}</span>
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
        {{ loading ? "Guardando..." : (isEdit ? "Actualizar" : "Crear") }}
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
</template>
