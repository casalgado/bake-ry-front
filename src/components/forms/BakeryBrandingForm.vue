<script setup>
/* The business's identity: contact, legal data, social media, logo and colors.
 * On the ui-* system. `submit` carries the whole form (the parent splits it
 * between the bakery record and the branding settings); `isDirty` is exposed so
 * the page can warn before leaving. ImageUpload and ColorPickerCard are still the
 * old components, sitting inside this card. */
import { ref, computed, watch } from 'vue';
import ImageUpload from './ImageUpload.vue';
import ColorPickerCard from './ColorPickerCard.vue';
import { PhNumberCircleOne, PhNumberCircleTwo } from '@phosphor-icons/vue';
import { useAuthenticationStore } from '@/stores/authentication';

const authStore = useAuthenticationStore();

const props = defineProps({
  title: {
    type: String,
    default: 'Identidad',
  },
  initialData: {
    type: Object,
    default: () => ({}),
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['submit', 'validation-error']);

// One shape for the form, the initial data and the comparison between them.
const normalize = (data = {}) => ({
  email: data.email || '',
  address: data.address || '',
  phone: data.phone || '',
  legalName: data.legalName || '',
  nationalId: data.nationalId || '',
  socialMedia: {
    instagram: data.socialMedia?.instagram || '',
    facebook: data.socialMedia?.facebook || '',
    whatsapp: data.socialMedia?.whatsapp || '',
    website: data.socialMedia?.website || '',
  },
  logos: {
    original: data.logos?.original || '',
    small: data.logos?.small || '',
    medium: data.logos?.medium || '',
    large: data.logos?.large || '',
  },
  primaryColor: data.primaryColor || '',
  secondaryColor: data.secondaryColor || '',
});

const formData = ref(normalize(props.initialData));

const hasChanges = computed(
  () => JSON.stringify(normalize(props.initialData)) !== JSON.stringify(normalize(formData.value)),
);

const handleSubmit = () => {
  emit('submit', formData.value);
};

const handleCancel = () => {
  formData.value = normalize(props.initialData);
};

const handleLogoUploadSuccess = (result) => {
  formData.value = {
    ...formData.value,
    logos: {
      original: result.originalUrl,
      small: result.resizedUrls.small || '',
      medium: result.resizedUrls.medium || '',
      large: result.resizedUrls.large || '',
    },
  };
};

const handleLogoUploadError = (error) => {
  console.error('Logo upload error:', error);
};

const handleLogoValidationError = (error) => {
  console.error('Logo validation error:', error);
  emit('validation-error', error);
};

const getLogoUploadPath = computed(() => {
  const bakeryId = authStore.getBakeryId || 'default';
  return `bakeries/${bakeryId}/branding/logos/`;
});

// A refetch that changes nothing must not wipe what the user is typing.
let loaded = JSON.stringify(normalize(props.initialData));
watch(() => props.initialData, (newData) => {
  if (!newData) return;
  const next = JSON.stringify(normalize(newData));
  if (next === loaded) return;
  loaded = next;
  formData.value = JSON.parse(next);
}, { deep: true });

defineExpose({ isDirty: hasChanges });
</script>

<template>
  <form
    class="ui-card flex flex-col gap-5"
    data-ui-theme="light"
    @submit.prevent="handleSubmit"
  >
    <h2 class="ui-panehead-title">{{ title }}</h2>

    <section class="flex flex-col gap-3">
      <div class="ui-sectionhead">Logo</div>
      <ImageUpload
        v-model="formData.logos.original"
        :upload-path="getLogoUploadPath"
        label="Sube el logo de tu negocio."
        help-text="Arrastra tu logo (PNG o JPG) aquí o haz clic para seleccionar"
        accepted-formats="image/png,image/jpeg"
        :disabled="loading"
        @upload-success="handleLogoUploadSuccess"
        @upload-error="handleLogoUploadError"
        @validation-error="handleLogoValidationError"
      />
    </section>

    <section class="flex flex-col gap-3">
      <div class="ui-sectionhead">Esquema de colores</div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ColorPickerCard
          v-model="formData.primaryColor"
          :icon="PhNumberCircleOne"
          title="Color Principal"
          description="Color primario de tu marca"
          :disabled="loading"
        />
        <ColorPickerCard
          v-model="formData.secondaryColor"
          :icon="PhNumberCircleTwo"
          title="Color Secundario"
          description="Color secundario de tu marca"
          :disabled="loading"
        />
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <div class="ui-sectionhead">Información de contacto</div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="ui-field">
          <label class="ui-field-k" for="bakery-email">Email</label>
          <input
            id="bakery-email"
            v-model="formData.email"
            type="email"
            class="ui-input"
            :disabled="loading"
          >
        </div>

        <div class="ui-field">
          <label class="ui-field-k" for="bakery-phone">Teléfono</label>
          <input
            id="bakery-phone"
            v-model="formData.phone"
            type="tel"
            class="ui-input"
            :disabled="loading"
          >
        </div>

        <div class="ui-field md:col-span-2">
          <label class="ui-field-k" for="bakery-address">Dirección</label>
          <input
            id="bakery-address"
            v-model="formData.address"
            type="text"
            class="ui-input"
            :disabled="loading"
          >
        </div>
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <div class="ui-sectionhead">Información legal</div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="ui-field">
          <label class="ui-field-k" for="bakery-legal-name">Razón social</label>
          <input
            id="bakery-legal-name"
            v-model="formData.legalName"
            type="text"
            class="ui-input"
            :disabled="loading"
          >
        </div>

        <div class="ui-field">
          <label class="ui-field-k" for="bakery-national-id">NIT</label>
          <input
            id="bakery-national-id"
            v-model="formData.nationalId"
            type="text"
            class="ui-input"
            :disabled="loading"
          >
        </div>
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <div class="ui-sectionhead">Redes sociales</div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="ui-field">
          <label class="ui-field-k" for="bakery-instagram">Instagram</label>
          <input
            id="bakery-instagram"
            v-model="formData.socialMedia.instagram"
            type="text"
            class="ui-input"
            placeholder="@minegocio"
            :disabled="loading"
          >
        </div>

        <div class="ui-field">
          <label class="ui-field-k" for="bakery-facebook">Facebook</label>
          <input
            id="bakery-facebook"
            v-model="formData.socialMedia.facebook"
            type="text"
            class="ui-input"
            placeholder="facebook.com/minegocio"
            :disabled="loading"
          >
        </div>

        <div class="ui-field">
          <label class="ui-field-k" for="bakery-whatsapp">WhatsApp</label>
          <input
            id="bakery-whatsapp"
            v-model="formData.socialMedia.whatsapp"
            type="tel"
            class="ui-input"
            placeholder="3001234567"
            :disabled="loading"
          >
        </div>

        <div class="ui-field">
          <label class="ui-field-k" for="bakery-website">Sitio web</label>
          <input
            id="bakery-website"
            v-model="formData.socialMedia.website"
            type="url"
            class="ui-input"
            placeholder="https://minegocio.com"
            :disabled="loading"
          >
        </div>
      </div>
    </section>

    <!-- Cancelar backs out of the edits, so it is danger outline; Guardar is the one solid. -->
    <div class="flex gap-2 justify-end">
      <button
        type="button"
        class="ui-btn ui-btn-danger"
        :disabled="loading || !hasChanges"
        @click="handleCancel"
      >
        Cancelar
      </button>
      <button type="submit" class="ui-btn ui-btn-solid" :disabled="loading || !hasChanges">
        {{ loading ? 'Guardando...' : 'Guardar Cambios' }}
      </button>
    </div>
  </form>
</template>
