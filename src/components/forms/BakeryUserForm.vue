<script setup>
import { ref, defineProps, defineEmits } from 'vue';

const props = defineProps({
  initialData: {
    type: Object,
    default: () => ({
      email: '',
      password: '',
      role: 'bakery_customer',
      name: '',
      category: 'B2B',
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
  <form @submit.prevent="handleSubmit">
    <div>
      <label>Correo Electrónico *</label>
      <input
        type="email"
        v-model="formData.email"
        :disabled="isEdit"
        required
      />
      <span v-if="errors.email">{{ errors.email }}</span>
    </div>

    <div v-if="!isEdit">
      <label>Contraseña *</label>
      <input
        type="password"
        v-model="formData.password"
        required
      />
      <span v-if="errors.password">{{ errors.password }}</span>
    </div>

    <div>
      <label>Nombre Completo *</label>
      <input
        type="text"
        v-model="formData.name"
        required
      />
      <span v-if="errors.name">{{ errors.name }}</span>
    </div>

    <div>
      <label>Tipo de Cliente *</label>
      <div>
        <div v-for="option in categoryOptions" :key="option.value">
          <input
            type="radio"
            :id="option.value"
            :value="option.value"
            v-model="formData.category"
            required
          />
          <label :for="option.value">{{ option.label }}</label>
        </div>
      </div>
      <span v-if="errors.category">{{ errors.category }}</span>
    </div>

    <div>
      <label>Rol *</label>
      <div>
        <div v-for="option in roleOptions" :key="option.value">
          <input
            type="radio"
            :id="option.value"
            :value="option.value"
            v-model="formData.role"
            required
          />
          <label :for="option.value">{{ option.label }}</label>
        </div>
      </div>
      <span v-if="errors.role">{{ errors.role }}</span>
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

    <div>
      <button
        type="button"
        @click="$emit('cancel')"
        :disabled="loading"
      >
        Cancelar
      </button>
      <button
        type="submit"
        :disabled="loading"
      >
        {{ loading ? "Guardando..." : (isEdit ? "Actualizar" : "Crear") }}
      </button>
    </div>
  </form>
</template>
