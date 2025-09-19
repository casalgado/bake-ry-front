<script setup>
import { ref, defineProps, defineEmits, computed } from 'vue';
import RadioButtonGroup from '@/components/forms/RadioButtonGroup.vue';
import { parseSpanishName } from '@/utils/helpers';

const props = defineProps({
  title: {
    type: String,
    default: 'Crear Usuario',
  },
  formUserType: {
    type: String,
    default: 'client', // or 'staff'
  },
  initialData: {
    type: Object,
    default: () => ({
      email: '',
      password: '',
      role: '', // Will be computed later
      name: '',
      legalName: '',
      category: '', // Will be computed later
      address: '',
      birthday: '',
      comment: '',
      phone: '',
      nationalId: '',
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
  allowedUserTypes: {
    type: Array,
    default: () => [
      'client',
      'company',
      'staff',
      'delivery',
      'production',
      'accounting',
    ],
  },
});

const emit = defineEmits(['submit', 'cancel']);

// Combined options with both role and category values
const userTypeOptions = [
  {
    value: 'client',
    label: 'Cliente',
    role: 'bakery_customer',
    category: 'B2C',
  },
  {
    value: 'company',
    label: 'Empresa',
    role: 'bakery_customer',
    category: 'B2B',
  },
  {
    value: 'staff',
    label: 'Supervisor',
    role: 'bakery_staff',
    category: 'PER',
  },
  {
    value: 'delivery',
    label: 'Asistente Domicilio',
    role: 'delivery_assistant',
    category: 'PER',
  },
  {
    value: 'production',
    label: 'Asistente Produccion',
    role: 'production_assistant',
    category: 'PER',
  },
  {
    value: 'accounting',
    label: 'Asistente Contable',
    role: 'accounting_assistant',
    category: 'PER',
  },
];

// Compute defaults based on allowedUserTypes
const getComputedInitialData = () => {
  const data = { ...props.initialData };

  // If role/category are empty, compute from first allowed user type
  if (!data.role || !data.category) {
    const firstAllowedType = props.allowedUserTypes[0];
    const defaultOption = userTypeOptions.find(
      (opt) => opt.value === firstAllowedType,
    );

    data.role = defaultOption ? defaultOption.role : 'bakery_customer';
    data.category = defaultOption ? defaultOption.category : 'B2C';
  }

  return data;
};

const formData = ref(getComputedInitialData());

// Filter options based on allowedUserTypes prop
const filteredUserTypeOptions = computed(() => {
  return userTypeOptions.filter((option) =>
    props.allowedUserTypes.includes(option.value),
  );
});

// Compute initial selected value based on role and category
const getInitialUserType = () => {
  const { role, category } = formData.value;
  let userType = 'client'; // default

  if (role === 'bakery_customer') {
    userType = category === 'B2B' ? 'company' : 'client';
  } else if (role === 'bakery_staff') {
    userType = 'staff';
  } else if (role === 'delivery_assistant') {
    userType = 'delivery';
  } else if (role === 'production_assistant') {
    userType = 'production';
  } else if (role === 'accounting_assistant') {
    userType = 'accounting';
  }

  // Ensure the computed type is in the allowed types, otherwise use first allowed type
  return props.allowedUserTypes.includes(userType)
    ? userType
    : props.allowedUserTypes[0];
};

const selectedUserType = ref(getInitialUserType());

// Update both role and category when user type changes
const handleUserTypeChange = (value) => {
  const selected = filteredUserTypeOptions.value.find(
    (opt) => opt.value === value,
  );
  if (selected) {
    formData.value.role = selected.role;
    formData.value.category = selected.category;
  }
};

const errors = ref({});

const validate = () => {
  errors.value = {};

  if (!formData.value.role) errors.value.role = 'El rol es requerido';
  if (!formData.value.name) errors.value.name = 'El nombre es requerido';

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (formData.value.email && !emailRegex.test(formData.value.email)) {
    errors.value.email = 'Formato de correo electrónico inválido';
  }

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
    legalName: formData.value.legalName || '',
    ...parseSpanishName(formData.value.name, formData.value.category),
  };

  if (!validate()) return;
  emit('submit', submitData);
};
</script>

<template>
  <div class="form-container">
    <h2>{{ title }}</h2>

    <form @submit.prevent="handleSubmit" class="base-card">
      <div>
        <label>Nombre</label>
        <input type="text" v-model="formData.name" required class="w-full" />
        <span v-if="errors.name" class="text-danger text-sm">{{
          errors.name
        }}</span>
      </div>

      <div>
        <label>Correo Electrónico</label>
        <input type="email" v-model="formData.email" :disabled="isEdit" />
        <span v-if="errors.email" class="text-danger text-sm">{{
          errors.email
        }}</span>
      </div>

      <div>
        <RadioButtonGroup
          v-model="selectedUserType"
          :options="filteredUserTypeOptions"
          name="user-type"
          label="Tipo de Usuario"
          @update:modelValue="handleUserTypeChange"
        />
        <span v-if="errors.role" class="text-danger text-sm">{{
          errors.role
        }}</span>
      </div>

      <div
        v-if="formUserType === 'client'"
        :class="{
          'text-neutral-400': selectedUserType !== 'company',
        }"
      >
        <label>Razon Social</label>
        <input
          type="text"
          v-model="formData.legalName"
          class="w-full"
          :disabled="selectedUserType !== 'company'"
          :class="{
            'bg-neutral-100 text-neutral-400 cursor-default !border-neutral-200':
              selectedUserType !== 'company',
          }"
        />
        <span v-if="errors.legalName" class="text-danger text-sm">{{
          errors.legalName
        }}</span>
      </div>

      <div>
        <label>Teléfono</label>
        <input type="tel" v-model="formData.phone" />
      </div>

      <div>
        <label>Dirección</label>
        <input type="text" v-model="formData.address" />
      </div>

      <div>
        <label>Documento de Identidad</label>
        <input type="text" v-model="formData.nationalId" />
      </div>

      <div>
        <label>Fecha de Nacimiento</label>
        <input type="date" v-model="formData.birthday" />
      </div>

      <div>
        <label>Comentarios</label>
        <textarea v-model="formData.comment" rows="3"></textarea>
      </div>

      <div class="flex gap-2 justify-end">
        <button type="submit" :disabled="loading" class="action-btn">
          {{ loading ? loadingText : submitButtonText }}
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
