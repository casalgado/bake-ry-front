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
import UiPills from '@/components/ui/UiPills.vue';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';

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
    label: 'Contador',
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

/* Electronic invoicing. The document number decides who the invoice is for,
 * and the backend infers its kind (dian/invoiceData.js toBuyer): none →
 * consumidor final, a company's → NIT, anyone else's → cédula. `fiscal.idType`
 * is stored only as an override of that: a foreign ID, a person with a NIT, or
 * '00' for someone who asks not to be named. Codes are the DIAN's (13 CC,
 * 31 NIT, 22 CE, 41 pasaporte). The NIT's check digit is computed, and the city
 * is the business's own. */
const settingsStore = useBakerySettingsStore();
const ANONYMOUS = '00';
const idTypeOptions = [
  { value: ANONYMOUS, label: 'Consumidor final' },
  { value: '13', label: 'Cédula' },
  { value: '31', label: 'NIT' },
  { value: '22', label: 'Cédula extranjería' },
  { value: '41', label: 'Pasaporte' },
];
const yesNo = [{ value: true, label: 'Sí' }, { value: false, label: 'No' }];
const showFiscal = computed(() => props.formUserType === 'client' && settingsStore.isEinvoicingEnabled);
const fiscal = ref({ idType: '', ivaResponsible: false, email: '', ...(props.initialData.fiscal || {}) });

// Same rule as the backend's toBuyer, so the pills show what the invoice will say.
const inferredIdType = computed(() => {
  if (!String(formData.value.nationalId || '').trim()) return ANONYMOUS;
  return formData.value.category === 'B2B' ? '31' : '13';
});
const idType = computed({
  get: () => fiscal.value.idType || inferredIdType.value,
  // Picking what would be inferred anyway stores no override, so the type keeps
  // following the client if it later turns from Persona into Empresa.
  set: (value) => { fiscal.value.idType = value === inferredIdType.value ? '' : value; },
});

const nidLabel = computed(() =>
  (idType.value !== ANONYMOUS ? idTypeOptions.find((o) => o.value === idType.value)?.label : null)
  ?? (selectedUserType.value === 'company' ? 'NIT' : 'Documento de identidad'));

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
  // Only while the section is shown: a stored override must not block saving a
  // client after e-invoicing is turned off.
  if (showFiscal.value && idType.value !== ANONYMOUS && !String(formData.value.nationalId || '').trim()) {
    errors.value.nationalId = 'Para facturarle a su nombre hace falta el número de documento';
  }
  if (showFiscal.value && fiscal.value.email && !emailRegex.test(fiscal.value.email)) {
    errors.value.fiscalEmail = 'Formato de correo electrónico inválido';
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
    // Kept as it was unless the block was shown: a staff form never touches it.
    ...(showFiscal.value ? {
      // Spread first: fields this form doesn't edit (personType, taxLevelCode,
      // city) stay as stored. A stored email can be null.
      fiscal: {
        ...fiscal.value,
        ivaResponsible: idType.value === '31' && fiscal.value.ivaResponsible,
        email: idType.value === ANONYMOUS ? '' : (fiscal.value.email || '').trim(),
      },
    } : {}),
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

    <div>
      <UiPills
        v-model="selectedUserType"
        :options="filteredUserTypeOptions"
        label="Tipo de Usuario"
        required
        min-width="11rem"
        @change="handleUserTypeChange"
      />
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
      <label class="ui-field-k" :for="`${uid}-nid`">{{ nidLabel }}</label>
      <input
        :id="`${uid}-nid`"
        v-model="formData.nationalId"
        type="text"
        class="ui-input"
        :placeholder="nidLabel === 'NIT' ? 'Sin dígito de verificación' : ''"
        :aria-invalid="!!errors.nationalId"
        :aria-describedby="errors.nationalId ? `${uid}-nid-e` : undefined"
      >
      <span v-if="errors.nationalId" :id="`${uid}-nid-e`" class="ui-field-error">
        {{ errors.nationalId }}
      </span>
    </div>

    <section v-if="showFiscal" class="flex flex-col gap-4">
      <div class="ui-sectionhead !mb-0">Facturación electrónica</div>
      <div>
        <UiPills
          v-model="idType"
          :options="idTypeOptions"
          label="Factura a nombre de"
          min-width="8rem"
        />
        <span class="ui-field-hint">
          Sale solo del documento: sin documento, consumidor final; con documento, cédula
          para una persona y NIT para una empresa (con su razón social y el dígito de
          verificación calculado). Cámbialo solo para otro tipo de documento o si el
          cliente pide no salir con su nombre.
        </span>
      </div>
      <UiPills
        v-if="idType === '31'"
        v-model="fiscal.ivaResponsible"
        :options="yesNo"
        label="Responsable de IVA"
        min-width="5rem"
      />
      <div v-if="idType !== ANONYMOUS" class="ui-field">
        <label class="ui-field-k" :for="`${uid}-fiscal-email`">Correo para facturas</label>
        <input
          :id="`${uid}-fiscal-email`"
          v-model="fiscal.email"
          type="email"
          class="ui-input"
          placeholder="Si se deja vacío, el correo del cliente"
          :aria-invalid="!!errors.fiscalEmail"
          :aria-describedby="errors.fiscalEmail ? `${uid}-fiscal-email-e` : undefined"
        >
        <span v-if="errors.fiscalEmail" :id="`${uid}-fiscal-email-e`" class="ui-field-error">
          {{ errors.fiscalEmail }}
        </span>
      </div>
    </section>

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
