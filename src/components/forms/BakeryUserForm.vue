<script setup>
/* First form on the ui-* system. The props and emits are unchanged from the
 * Tailwind version, so all six call sites — three create pages and three edit
 * dialogs — keep working without an edit.
 *
 * It declares no width. Both hosts set the same 48rem — `p-4 lg:p-6 w-full
 * max-w-[48rem]` on a create page, `max-w-[48rem]` on the DialogPanel — so the
 * form does not change shape when it moves. That split is the point:
 * `.form-container` used to set the width AND theme every input inside it,
 * which is why a 896px dialog rendered an 800px form. */
import { ref, computed, useId } from 'vue';
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
      invoiceGracePeriod: null,
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

/* Ids have to be unique per instance, not per file: ShowStaff and ShowB2BClients
 * can both hold a mounted copy, and a duplicate id sends `for` and
 * aria-describedby to whichever one the browser finds first. */
const uid = useId();

// Combined options with both role and category values
const userTypeOptions = [
  {
    value: 'client',
    label: 'Persona',
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

    /* The two company fields are disabled for anyone else, but disabling an
     * input does not empty it, so without this a legalName typed as Empresa
     * still ships when you switch back to Persona. Only fires on a user's
     * @change, never on mount, so editing an existing company keeps its data. */
    if (selected.category !== 'B2B') {
      formData.value.legalName = '';
      formData.value.invoiceGracePeriod = null;
    }
  }
};

const errors = ref({});

const validate = () => {
  errors.value = {};

  if (!formData.value.role) errors.value.role = 'El rol es requerido';
  if (!formData.value.name) errors.value.name = 'El nombre es requerido';

  // Team roles sign in with this address; the backend would otherwise invent a fake one.
  const isTeam = formData.value.category === 'PER';
  if (isTeam && !formData.value.email) {
    errors.value.email = 'El correo es requerido para el equipo';
  }

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
  if (!validate()) return;

  emit('submit', {
    ...formData.value,
    legalName: formData.value.legalName || '',
    invoiceGracePeriod: formData.value.invoiceGracePeriod === '' ? null : formData.value.invoiceGracePeriod,
    ...parseSpanishName(formData.value.name, formData.value.category),
  });
};
</script>

<template>
  <!-- One column. The eight questions here are unrelated to each other, and two
       columns only earn their ambiguity when the pair answers ONE question
       (price + unit, date + time). None of these do.

       data-ui-theme is explicit rather than inherited: the create pages sit
       inside the old dashboard shell, which declares no theme, and tokens
       resolve on the element that declares them. -->
  <form
    class="ui-card flex flex-col gap-4"
    data-ui-theme="light"
    @submit.prevent="handleSubmit"
  >
    <h2 class="ui-panehead-title">{{ title }}</h2>

    <div class="ui-field">
      <label class="ui-field-k" :for="`${uid}-name`" data-required>Nombre</label>
      <input
        :id="`${uid}-name`"
        v-model="formData.name"
        type="text"
        class="ui-input"
        required
        :aria-invalid="!!errors.name"
        :aria-describedby="errors.name ? `${uid}-name-e` : undefined"
      >
      <span v-if="errors.name" :id="`${uid}-name-e`" class="ui-field-error">
        {{ errors.name }}
      </span>
    </div>

    <div class="ui-field">
      <label class="ui-field-k" :for="`${uid}-email`">Correo Electrónico</label>
      <input
        :id="`${uid}-email`"
        v-model="formData.email"
        type="email"
        class="ui-input"
        :disabled="isEdit"
        :aria-invalid="!!errors.email"
        :aria-describedby="errors.email ? `${uid}-email-e` : undefined"
      >
      <span v-if="errors.email" :id="`${uid}-email-e`" class="ui-field-error">
        {{ errors.email }}
      </span>
    </div>

    <!-- Was RadioButtonGroup, which belongs to the old system and still runs its
         other call sites. This is the gallery's raw markup: an sr-only radio
         with the label next to it doing the painting, so `:checked + .ui-btn`
         can reach it. Not Tailwind peer-checked:, which applies one class.

         radiogroup on a div, not fieldset/legend: .ui-field is display:flex and
         a <legend> is not laid out as a normal flex item in every engine.
         The radios sit directly in the grid — .sr-only is position:absolute, so
         an input claims no track and stays the label's previous sibling, which
         is what `input:focus-visible + .ui-btn` needs. -->
    <div class="ui-field">
      <span :id="`${uid}-type-k`" class="ui-field-k" data-required>Tipo de Usuario</span>
      <div
        class="grid grid-cols-2 sm:grid-cols-3 gap-1.5"
        role="radiogroup"
        :aria-labelledby="`${uid}-type-k`"
      >
        <template v-for="option in filteredUserTypeOptions" :key="option.value">
          <input
            :id="`${uid}-type-${option.value}`"
            v-model="selectedUserType"
            class="sr-only"
            type="radio"
            :name="`${uid}-user-type`"
            :value="option.value"
            @change="handleUserTypeChange(option.value)"
          >
          <label class="ui-btn justify-center w-full" :for="`${uid}-type-${option.value}`">
            {{ option.label }}
          </label>
        </template>
      </div>
      <span v-if="errors.role" class="ui-field-error">{{ errors.role }}</span>
    </div>

    <!-- The two company fields share a row, and both are shown-but-disabled
         rather than hidden. Persona and Empresa then have the same number of
         rows, so switching the pill above does not shuffle everything below it
         under your cursor.
         This is the exception to the one-column rule earning its keep: not
         because the two answer one question, but because they appear and go
         quiet as a set. .ui-input:disabled already reads as "not applicable" —
         the four Tailwind color classes this used to carry are what rule 3
         bans. -->
    <div v-if="formUserType === 'client'" class="grid sm:grid-cols-2 gap-4">
      <div class="ui-field">
        <label class="ui-field-k" :for="`${uid}-legal`">Razón Social</label>
        <input
          :id="`${uid}-legal`"
          v-model="formData.legalName"
          type="text"
          class="ui-input"
          :disabled="selectedUserType !== 'company'"
          :placeholder="selectedUserType === 'company' ? '' : 'Solo para empresas'"
        >
      </div>

      <div class="ui-field">
        <label class="ui-field-k" :for="`${uid}-grace`">Días de crédito</label>
        <input
          :id="`${uid}-grace`"
          v-model.number="formData.invoiceGracePeriod"
          type="number"
          class="ui-input ui-input-num"
          :disabled="selectedUserType !== 'company'"
          :placeholder="selectedUserType === 'company' ? '' : 'Solo para empresas'"
          @wheel="$event.target.blur()"
        >
      </div>
    </div>

    <div class="ui-field">
      <label class="ui-field-k" :for="`${uid}-phone`">Teléfono</label>
      <input :id="`${uid}-phone`" v-model="formData.phone" type="tel" class="ui-input">
    </div>

    <div class="ui-field">
      <label class="ui-field-k" :for="`${uid}-address`">Dirección</label>
      <input :id="`${uid}-address`" v-model="formData.address" type="text" class="ui-input">
    </div>

    <div class="ui-field">
      <label class="ui-field-k" :for="`${uid}-nid`">Documento de Identidad</label>
      <input :id="`${uid}-nid`" v-model="formData.nationalId" type="text" class="ui-input">
    </div>

    <div class="ui-field">
      <label class="ui-field-k" :for="`${uid}-birthday`">Fecha de Nacimiento</label>
      <input :id="`${uid}-birthday`" v-model="formData.birthday" type="date" class="ui-input">
    </div>

    <div class="ui-field">
      <label class="ui-field-k" :for="`${uid}-comment`">Comentarios</label>
      <textarea
        :id="`${uid}-comment`"
        v-model="formData.comment"
        class="ui-input ui-input-area"
        rows="3"
      ></textarea>
    </div>

    <!-- Cancelar backs out of the form, so it is ui-btn-danger outline. Guardar
         (solid) is the only non-danger button; the row reads left to right:
         leave, then commit. -->
    <div class="flex gap-2 justify-end">
      <button type="button" class="ui-btn ui-btn-danger" :disabled="loading" @click="emit('cancel')">
        Cancelar
      </button>
      <button type="submit" class="ui-btn ui-btn-solid" :disabled="loading">
        {{ loading ? loadingText : submitButtonText }}
      </button>
    </div>
  </form>
</template>
