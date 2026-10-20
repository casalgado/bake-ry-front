<script setup>
import { ref, computed, onMounted, useId } from 'vue';
import { useProductCollectionStore } from '@/stores/productCollectionStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import UiYesNo from '@/components/ui/UiYesNo.vue';
import UiPills from '@/components/ui/UiPills.vue';
import UiMoneyInput from '@/components/ui/UiMoneyInput.vue';
import VariationsManager from '@/components/forms/VariationsManager.vue';
import AppTooltip from '@/components/common/AppTooltip.vue';
import { PhInfo, PhEye, PhEyeSlash } from '@phosphor-icons/vue';
import { cleanString } from '@/utils/helpers';

const collectionStore = useProductCollectionStore();
const settingsStore = useBakerySettingsStore();

/* Per instance, not per file: ShowProducts mounts this next to a DataTable whose
 * filters have ids of their own, and `#name` would match whichever came first. */
const uid = useId();

const props = defineProps({
  title: {
    type: String,
    default: 'Crear Producto',
  },
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

// Form state with new structure
const formData = ref(
  props.initialData
    ? {
      ...props.initialData,
      variations: props.initialData.variations || { dimensions: [], combinations: [] },
      // Products created before the inventory module have no mode stored, and
      // an undefined radio group shows nothing selected. They behave as 'none',
      // so say so — editing one must not silently change how it deducts.
      inventoryMode: props.initialData.inventoryMode || 'none',
    }
    : {
      name: '',
      description: '',
      collectionId: '',
      collectionName: '',
      taxPercentage: 0,
      isActive: true,
      basePrice: 0,
      costPrice: 0,
      // 'none' keeps a new product behaving exactly like every existing one:
      // selling it moves no stock. Opting in is a deliberate choice below.
      inventoryMode: 'none',
      hasVariations: false,
      variations: {
        dimensions: [],
        combinations: [],
      },
      customAttributes: {},
      accountingCode: '',
    },
);

const errors = ref({});

/* Reventa vs producción is a product mode, not an ingredient flag: an
 * ingredient has no price and no collection, and an order line only carries a
 * productId. Wording per zplanning/inventory/INVENTORY.md §1 — describe what the
 * business does, never the enum. */
const INVENTORY_MODES = [
  { value: 'none', label: 'Sin control' },
  { value: 'unit', label: 'Reventa' },
  { value: 'recipe', label: 'Receta' },
];

// The pills are short on purpose; the consequence of the selected one is spelled
// out here, one line at a time, instead of three sentences competing at once.
const INVENTORY_MODE_HINTS = {
  none: 'Vender este producto no mueve existencias.',
  unit: 'Se compra y se vende. Al vender se descuenta una unidad del stock.',
  recipe: 'Lo preparas con ingredientes. Al vender se descuentan los ingredientes; la receta se arma en el recetario.',
};

const inventoryModeHint = computed(() => INVENTORY_MODE_HINTS[formData.value.inventoryMode]);

/* recipeGraph gates cost propagation on this exact flag (recipeGraph.js:353), so
 * it is also the honest gate for the input: the field is read-only precisely
 * when something else owns the number. */
const isCostFromRecipe = computed(() => formData.value.costPriceSource === 'recipe');

const COST_TOOLTIP = 'El costo se calcula con los ingredientes de la receta y se actualiza solo cuando cambian sus precios. Si necesitas otro costo, edítalo manualmente y la receta dejará de actualizarlo.';

// Picking "Receta" on a product that owns no recipe yet declares the intent, so
// stop inviting a manual number. Leaving the mode takes it back — free to undo,
// since with no recipe there is no computed value to go stale. Once recipeId
// exists the flag belongs to the recipe link, and this never touches it.
const handleInventoryModeChange = (mode) => {
  if (formData.value.recipeId) return;
  formData.value.costPriceSource = mode === 'recipe' ? 'recipe' : 'manual';
};

const unlockCost = () => {
  formData.value.costPriceSource = 'manual';
};

// Confirm dialog state
const confirmDialog = ref({
  isOpen: false,
  title: '',
  message: '',
  onConfirm: null,
});

// Get available categories
const availableCategories = computed(() => {
  return collectionStore.items || [];
});

// Get selected category
const selectedCategory = computed(() => {
  if (!formData.value.collectionId) return null;
  return availableCategories.value.find(cat => cat.id === formData.value.collectionId);
});

// Check if product has variations
const hasVariations = computed(() => {
  return formData.value.hasVariations ||
         (formData.value.variations && formData.value.variations.combinations &&
          formData.value.variations.combinations.length > 0);
});

// Handle category selection
const handleCategoryChange = () => {
  if (!formData.value.collectionId) {
    formData.value.collectionName = '';
    return;
  }

  const category = selectedCategory.value;
  if (category) {
    formData.value.collectionName = category.name;

    // Load category dimension templates if available and product has no existing dimensions
    if (category.dimensionTemplates &&
        category.dimensionTemplates.dimensions &&
        category.dimensionTemplates.dimensions.length > 0 &&
        (!formData.value.variations.dimensions || formData.value.variations.dimensions.length === 0)) {

      // Auto-load category dimensions
      loadCategoryDimensions(category.dimensionTemplates);
    }
  }
};

// Load category dimensions into product variations
const loadCategoryDimensions = (categoryDimensionTemplates) => {
  if (categoryDimensionTemplates && categoryDimensionTemplates.dimensions) {
    formData.value.variations = {
      dimensions: [...categoryDimensionTemplates.dimensions],
      combinations: [],
    };
    formData.value.hasVariations = true;
  }
};

// Handle variation updates from VariationsManager component
const handleVariationUpdate = (variationData) => {
  formData.value.variations = variationData;

  // hasVariations is the user's Sí/No answer, never derived from the contents:
  // removing the last type must leave the section open for the next one.
  // Clear base price and cost price if variations exist
  if (formData.value.hasVariations) {
    formData.value.basePrice = 0;
    formData.value.costPrice = 0;
  }
};

// Toggle variations
const toggleVariations = (newValue, oldValue) => {
  if (!newValue && formData.value.variations.combinations.length > 0) {
    // Show confirmation dialog when disabling variations with existing data
    confirmDialog.value = {
      isOpen: true,
      title: 'Eliminar variaciones',
      message: '¿Estás seguro de que deseas eliminar todas las variaciones? Esta acción no se puede deshacer.',
      onConfirm: () => {
        formData.value.variations = { dimensions: [], combinations: [] };
        formData.value.hasVariations = false;
        confirmDialog.value.isOpen = false;
      },
      onCancel: () => {
        formData.value.hasVariations = true;
        confirmDialog.value.isOpen = false;
      },
    };
  } else if (!newValue) {
    formData.value.variations = { dimensions: [], combinations: [] };
    formData.value.hasVariations = false;
  }
};

// Computed properties for button text
const submitButtonText = computed(() => {
  return props.initialData ? 'Actualizar Producto' : 'Crear Producto';
});

const loadingText = computed(() => {
  return props.initialData ? 'Actualizando...' : 'Creando...';
});

// Validation
const validate = () => {
  errors.value = {};

  if (!formData.value.name) {
    errors.value.name = 'Nombre es requerido';
  }
  if (formData.value.name.length < 3) {
    errors.value.name = 'Nombre debe tener al menos 3 caracteres';
  }
  if (!formData.value.collectionId) {
    errors.value.collectionId = 'Categoría es requerida';
  }

  // Validate base price and cost price if no variations exist
  if (!hasVariations.value) {
    if (!formData.value.basePrice || formData.value.basePrice <= 0) {
      errors.value.basePrice = 'Precio base es requerido para productos sin variaciones';
    }
    if (formData.value.costPrice < 0) {
      errors.value.costPrice = 'Precio de costo no puede ser negativo';
    }
  }

  // Validate variations if they exist
  if (hasVariations.value && formData.value.variations.combinations.length === 0) {
    errors.value.variations = 'Debe configurar al menos una variación con precio';
  }

  return Object.keys(errors.value).length === 0;
};

const handleSubmit = () => {
  if (!validate()) return;

  formData.value.name = cleanString(formData.value.name);
  formData.value.description = cleanString(formData.value.description);
  emit('submit', formData.value);
};

// Load data on mount
onMounted(async () => {
  if (!collectionStore.isLoaded) {
    try {
      await collectionStore.fetchAll();
    } catch (error) {
      console.error('Failed to load product collections:', error);
    }
  }

  // The inventory section is gated on settings, which the sidebar loads at
  // login. Fetch only if this form opened first — a miss would hide the
  // section, not break the form.
  if (!settingsStore.items.length) {
    try {
      await settingsStore.fetchAll();
    } catch (error) {
      console.error('Failed to load bakery settings:', error);
    }
  }

  // Check if initial data has variations
  if (props.initialData && props.initialData.variations) {
    formData.value.hasVariations =
      props.initialData.variations.combinations &&
      props.initialData.variations.combinations.length > 0;
  }
});
</script>

<template>
  <!-- One card, sections divided by .ui-sectionhead. Several cards would show the
       dialog backdrop through the gaps, and the edit dialog's panel has no
       surface of its own (see BakeryUserForm). -->
  <form
    class="ui-card flex flex-col gap-4"
    data-ui-theme="light"
    @submit.prevent="handleSubmit"
  >
    <div class="ui-panehead !mb-0 items-start">
      <div class="flex flex-wrap items-baseline gap-x-3">
        <h2 class="ui-panehead-title">{{ title }}</h2>
        <!-- Off is shown by shape and words, not color (ui rule 5). -->
        <span v-if="!formData.isActive" class="ui-panehead-sub">No aparece en el catálogo de pedidos</span>
      </div>
      <!-- On/off, so a pressed toggle rather than a Sí/No pair (forms gallery, "Elegir"). -->
      <button
        type="button"
        class="ui-btn ui-btn-sm"
        :aria-pressed="formData.isActive"
        @click="formData.isActive = !formData.isActive"
      >
        <PhEye v-if="formData.isActive" :size="12" weight="bold" />
        <PhEyeSlash v-else :size="12" weight="bold" />
        <!-- Both labels share one grid cell, so the button is always as wide as
             the longer one and does not resize on toggle. -->
        <span class="grid">
          <span class="col-start-1 row-start-1" :class="{ invisible: !formData.isActive }">Activo</span>
          <span class="col-start-1 row-start-1" :class="{ invisible: formData.isActive }">Inactivo</span>
        </span>
      </button>
    </div>

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
      <label class="ui-field-k" :for="`${uid}-description`">Descripción</label>
      <textarea
        :id="`${uid}-description`"
        v-model="formData.description"
        class="ui-input ui-input-area"
        rows="3"
      ></textarea>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="ui-field">
        <label class="ui-field-k" :for="`${uid}-collection`" data-required>Categoría</label>
        <select
          :id="`${uid}-collection`"
          v-model="formData.collectionId"
          class="ui-input"
          required
          :aria-invalid="!!errors.collectionId"
          :aria-describedby="errors.collectionId ? `${uid}-collection-e` : undefined"
          @change="handleCategoryChange"
        >
          <option value="">Selecciona una categoría</option>
          <option v-for="category in availableCategories" :key="category.id" :value="category.id">
            {{ category.name }}
          </option>
        </select>
        <span v-if="errors.collectionId" :id="`${uid}-collection-e`" class="ui-field-error">
          {{ errors.collectionId }}
        </span>
      </div>

      <div class="ui-field">
        <label class="ui-field-k" :for="`${uid}-tax`">Porcentaje de Impuesto</label>
        <div class="ui-field-unit" data-unit="%">
          <input
            :id="`${uid}-tax`"
            v-model="formData.taxPercentage"
            type="number"
            class="ui-input ui-input-num"
            min="0"
            max="100"
            step="0.01"
          >
        </div>
      </div>

      <div class="ui-field">
        <label class="ui-field-k" :for="`${uid}-code`">Código</label>
        <input :id="`${uid}-code`" v-model="formData.accountingCode" type="text" class="ui-input">
      </div>
    </div>

    <!-- Inventory: only for businesses with the module on (§14). -->
    <template v-if="settingsStore.isInventoryEnabled">
      <div class="ui-sectionhead">Inventario</div>

      <div class="flex flex-col gap-2">
        <UiPills
          v-model="formData.inventoryMode"
          :options="INVENTORY_MODES"
          label="¿Qué pasa con las existencias al vender este producto?"
          @change="handleInventoryModeChange"
        />
        <span class="ui-field-hint">{{ inventoryModeHint }}</span>
      </div>
    </template>

    <div class="ui-sectionhead">Variaciones</div>

    <UiYesNo
      v-model="formData.hasVariations"
      label="¿Este producto tiene variaciones?"
      @update:model-value="toggleVariations"
    />

    <template v-if="hasVariations">
      <VariationsManager
        :initial-variations="formData.variations"
        :product-name="formData.name"
        :inventory-mode="formData.inventoryMode"
        @update="handleVariationUpdate"
      />

      <span v-if="errors.variations" class="ui-field-error">
        {{ errors.variations }}
      </span>
    </template>

    <!-- Pricing for products without variations -->
    <template v-else>
      <div class="ui-sectionhead">Configuración de Precios</div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="ui-field">
          <label class="ui-field-k" :for="`${uid}-base`">Precio de Venta</label>
          <div class="ui-field-unit" data-unit="$">
            <UiMoneyInput
              :id="`${uid}-base`"
              v-model="formData.basePrice"
              placeholder="0"
              :aria-invalid="!!errors.basePrice"
              :aria-describedby="errors.basePrice ? `${uid}-base-e` : undefined"
            />
          </div>
          <span v-if="errors.basePrice" :id="`${uid}-base-e`" class="ui-field-error">
            {{ errors.basePrice }}
          </span>
        </div>

        <div class="ui-field">
          <label :for="`${uid}-cost`" class="ui-field-k flex items-center gap-1">
            Precio de Costo
            <!-- tabindex: the tooltip wraps static content, so it needs its own
                 tab stop to be reachable without a mouse. -->
            <AppTooltip v-if="isCostFromRecipe" :text="COST_TOOLTIP" tabindex="0">
              <PhInfo class="w-4 h-4 ui-ink-muted" />
            </AppTooltip>
          </label>
          <div class="ui-field-unit" data-unit="$">
            <!-- readonly, not disabled: the value stays selectable and in the
                 tab order — a disabled number input reads as broken, not derived. -->
            <UiMoneyInput
              :id="`${uid}-cost`"
              v-model="formData.costPrice"
              placeholder="0"
              :readonly="isCostFromRecipe"
              :aria-invalid="!!errors.costPrice"
              :aria-describedby="errors.costPrice ? `${uid}-cost-e` : undefined"
            />
          </div>
          <div v-if="isCostFromRecipe" class="ui-field-hint flex items-center gap-2 flex-wrap">
            {{ formData.recipeId ? 'Calculado desde la receta.' : 'Se calculará cuando armes la receta en el recetario.' }}
            <button type="button" class="ui-btn" @click="unlockCost">
              Editar manualmente
            </button>
          </div>
          <span v-if="errors.costPrice" :id="`${uid}-cost-e`" class="ui-field-error">
            {{ errors.costPrice }}
          </span>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="ui-stat">
          <span class="ui-stat-k">Margen de ganancia</span>
          <span class="ui-stat-v">${{ (formData.basePrice - formData.costPrice).toLocaleString('es-CO') }}</span>
        </div>
        <div class="ui-stat">
          <span class="ui-stat-k">Porcentaje de ganancia</span>
          <span class="ui-stat-v">{{ isNaN(parseInt((formData.basePrice - formData.costPrice) / formData.costPrice * 100)) ? 0 : ((formData.basePrice - formData.costPrice) / formData.costPrice * 100).toFixed(1) }}%</span>
        </div>
      </div>

      <span class="ui-field-hint">
        Define los precios de venta y costo para productos sin variaciones. El margen de ganancia se calcula automáticamente.
      </span>
    </template>

    <!-- Cancelar backs out, so it is danger outline; the one solid button commits. -->
    <div class="flex gap-2 justify-end">
      <button type="button" class="ui-btn ui-btn-danger" :disabled="loading" @click="emit('cancel')">
        Cancelar
      </button>
      <button type="submit" class="ui-btn ui-btn-solid" :disabled="loading">
        {{ loading ? loadingText : submitButtonText }}
      </button>
    </div>

    <ConfirmDialog
      :is-open="confirmDialog.isOpen"
      :title="confirmDialog.title"
      :message="confirmDialog.message"
      confirm-text="Confirmar"
      cancel-text="Cancelar"
      @confirm="confirmDialog.onConfirm"
      @cancel="confirmDialog.onCancel"
    />
  </form>
</template>
