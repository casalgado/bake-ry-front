<script>
// Unsaved choices per invoice id, so closing the dialog or leaving the page keeps them.
// Module scope: survives remounts; a reload or logout (which reloads) clears it.
const drafts = new Map();
</script>

<script setup>
/* One received invoice: where each line goes. A line is an insumo (it enters
 * Compra de insumos with its ingredient and quantity), a gasto or inversión
 * category, or omitted. Nothing is placed for the user: an undecided line blocks
 * Confirmar. */
import { ref, computed, onMounted, onBeforeUnmount, useId } from 'vue';
import SupplierPaymentFields from '@/components/accounting/SupplierPaymentFields.vue';
import UiChoiceCard from '@/components/ui/UiChoiceCard.vue';
import IngredientCreateCard from '@/components/recipes/IngredientCreateCard.vue';
import { PhWallet, PhPlus } from '@phosphor-icons/vue';
import { getTodayString, formatDateDisplay } from '@/utils/dateUtils';
import { useReceivedInvoiceStore } from '@/stores/receivedInvoiceStore';
import { useIngredientStore } from '@/stores/ingredientStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { formatMoney, capitalize } from '@/utils/helpers';

const props = defineProps({
  invoice: { type: Object, required: true },
});
const emit = defineEmits(['done', 'cancel', 'provider-created']);

const uid = useId();
const invoiceStore = useReceivedInvoiceStore();
const ingredientStore = useIngredientStore();
const settingsStore = useBakerySettingsStore();

/* A line's destination as the form edits it: `choice` is the select's value
 * ('', 'insumo', 'ignore', 'expense:<id>', 'investment:<id>'). */
const toForm = (line) => {
  const destination = line.destination;
  if (!destination) return { choice: '', ingredientId: '', qty: '' };
  if (destination.kind === 'insumo') {
    return { choice: 'insumo', ingredientId: destination.item?.id ?? '', qty: destination.qty ?? '' };
  }
  if (destination.kind === 'ignore') return { choice: 'ignore', ingredientId: '', qty: '' };
  return { choice: `${destination.kind}:${destination.categoryId}`, ingredientId: '', qty: '' };
};

const toDestination = ({ choice, ingredientId, qty }) => {
  if (!choice) return null;
  if (choice === 'ignore') return { kind: 'ignore' };
  if (choice === 'insumo') {
    return {
      kind: 'insumo',
      item: ingredientId ? { type: 'ingredient', id: ingredientId, combinationId: null } : null,
      qty: Number(qty) > 0 ? Number(qty) : null,
    };
  }
  const [kind, categoryId] = choice.split(':');
  return { kind, categoryId };
};

const fresh = () => ({
  rows: props.invoice.lines.map(toForm),
  // Owed by default: it goes to Por pagar until someone pays it.
  isPaid: false,
  payment: { paymentDate: getTodayString(), paymentMethod: 'transfer' },
});
const start = drafts.get(props.invoice.id) ?? fresh();
const rows = ref(start.rows);
const isPaid = ref(start.isPaid);
const payment = ref(start.payment);
const paymentStatusOptions = [
  { value: false, label: 'Por pagar' },
  { value: true, label: 'Pagada' },
];
const busy = ref(false);
const error = ref('');

const categories = computed(() => (settingsStore.items[0]?.expenseCategories ?? []).filter((cat) => cat.isActive));
const expenseOptions = computed(() => categories.value.filter((cat) => !cat.isInvestment));
const investmentOptions = computed(() => categories.value.filter((cat) => cat.isInvestment));
const ingredients = computed(() =>
  ingredientStore.items.filter((ingredient) => !ingredient.isDeleted)
    .sort((a, b) => a.name.localeCompare(b.name)));
const unitOf = (id) => ingredients.value.find((ingredient) => ingredient.id === id)?.unit ?? '';

const ingredientCategories = computed(() =>
  (settingsStore.items[0]?.ingredientCategories ?? []).filter((cat) => cat.isActive !== false));
const creatingFor = ref(null); // line index

/* The store's create already pushed it, so the select resolves the id at once. */
function onIngredientCreated(i, created) {
  rows.value[i].ingredientId = created.id;
  creatingFor.value = null;
}

const isInsumoIncomplete = (row) => row.choice === 'insumo' && (!row.ingredientId || !(Number(row.qty) > 0));
const undecided = computed(() => rows.value.filter((row) => !row.choice || isInsumoIncomplete(row)).length);
const needsProvider = computed(() => !props.invoice.providerId);
const isCreditNote = computed(() => props.invoice.kind === 'credit_note');

/* Stored on unmount, and only if it differs from what the server gave us, so an
 * invoice opened and closed untouched picks up later server changes. */
const snapshot = () => JSON.stringify({ rows: rows.value, isPaid: isPaid.value, payment: payment.value });
const untouched = JSON.stringify(fresh());
let keepDraft = true;

onBeforeUnmount(() => {
  drafts.delete(props.invoice.id);
  if (keepDraft && snapshot() !== untouched) drafts.set(props.invoice.id, JSON.parse(snapshot()));
});

const canConfirm = computed(() => !isCreditNote.value && !needsProvider.value && !undecided.value && !busy.value
  && (!isPaid.value || (payment.value.paymentDate && payment.value.paymentMethod)));

async function run(action) {
  busy.value = true;
  error.value = '';
  try {
    await action();
  } catch (err) {
    error.value = err?.message || 'No se pudo completar la acción';
    return false;
  } finally {
    busy.value = false;
  }
  return true;
}

const save = () => invoiceStore.setDestinations(props.invoice.id, rows.value.map(toDestination));

async function confirm() {
  if (!canConfirm.value) return;
  if (await run(async () => {
    await save();
    await invoiceStore.confirm(props.invoice.id, isPaid.value ? { isPaid: true, ...payment.value } : null);
  })) {
    keepDraft = false;
    emit('done', isPaid.value ? 'Factura registrada y pagada' : 'Factura registrada en Por pagar');
  }
}

async function createProvider() {
  if (await run(() => invoiceStore.createProvider(props.invoice.id))) emit('provider-created');
}

onMounted(() => {
  if (!settingsStore.items.length) settingsStore.fetchById('default');
  if (!ingredientStore.items.length) ingredientStore.fetchAll();
});
</script>

<template>
  <div class="ui-card flex flex-col gap-4" data-ui-theme="light">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="ui-panehead-title">
          {{ isCreditNote ? 'Nota crédito' : 'Factura' }} {{ invoice.invoiceRef }}
        </h2>
        <p class="ui-item-desc">
          {{ invoice.supplier.name }} · {{ invoice.supplier.documentType }} {{ invoice.supplier.nationalId }}
          · {{ formatMoney(invoice.totals.total) }}
        </p>
      </div>
    </div>

    <p v-if="isCreditNote" class="ui-field-hint">
      Las notas crédito aún no se pueden registrar.
    </p>

    <p v-if="invoice.buyerMismatch" class="ui-field-hint">
      La factura está emitida a otro NIT ({{ invoice.buyerNationalId }}). Debe verificarse antes de registrarla.
    </p>

    <div v-if="needsProvider" class="ui-item ui-item-filled">
      <span class="min-w-0">
        <span class="ui-item-title block">Proveedor nuevo</span>
        <span class="ui-item-desc">Debe existir como proveedor para registrar la factura.</span>
      </span>
      <span class="ui-item-trail">
        <button type="button" class="ui-btn" :disabled="busy" @click="createProvider">Crear proveedor</button>
      </span>
    </div>

    <div v-if="!isCreditNote" class="flex flex-col gap-3">
      <div v-for="(line, i) in invoice.lines" :key="i" class="flex flex-col gap-2 pb-3" style="border-bottom: 1px solid var(--ui-line)">
        <div class="flex items-baseline justify-between gap-3">
          <span class="ui-item-title min-w-0">{{ line.description }}</span>
          <span class="ui-num shrink-0">{{ formatMoney(line.total) }}</span>
        </div>
        <span class="ui-item-desc">
          {{ line.qty }} {{ line.unit }} · IVA {{ line.ivaPercent ?? 0 }}%
        </span>

        <div class="ui-field">
          <label class="ui-field-k" :for="`${uid}-dest-${i}`">Destino</label>
          <select :id="`${uid}-dest-${i}`" v-model="rows[i].choice" class="ui-input">
            <option value="">Sin definir</option>
            <option value="insumo">Compra de insumos</option>
            <optgroup label="Gasto">
              <option v-for="cat in expenseOptions" :key="cat.id" :value="`expense:${cat.id}`">{{ cat.name }}</option>
            </optgroup>
            <optgroup v-if="investmentOptions.length" label="Inversión">
              <option v-for="cat in investmentOptions" :key="cat.id" :value="`investment:${cat.id}`">{{ cat.name }}</option>
            </optgroup>
            <option value="ignore">Omitir esta línea</option>
          </select>
        </div>

        <div v-if="rows[i].choice === 'insumo'" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="ui-field">
            <label class="ui-field-k" :for="`${uid}-ing-${i}`" data-required>Ingrediente</label>
            <select :id="`${uid}-ing-${i}`" v-model="rows[i].ingredientId" class="ui-input">
              <option value="" disabled>Seleccionar ingrediente</option>
              <option v-for="ingredient in ingredients" :key="ingredient.id" :value="ingredient.id">{{ ingredient.name }}</option>
            </select>
          </div>
          <div class="ui-field">
            <label class="ui-field-k" :for="`${uid}-qty-${i}`" data-required>
              Cantidad{{ unitOf(rows[i].ingredientId) ? ` (${unitOf(rows[i].ingredientId)})` : '' }}
            </label>
            <input :id="`${uid}-qty-${i}`" v-model="rows[i].qty" type="number" min="0" step="any" class="ui-input">
            <span class="ui-field-hint">En la unidad del ingrediente, no en la de la factura.</span>
          </div>
        </div>

        <template v-if="rows[i].choice === 'insumo'">
          <button
            type="button"
            class="ui-btn ui-btn-sm self-start"
            @click="creatingFor = creatingFor === i ? null : i"
          >
            <PhPlus :size="14" weight="bold" />
            {{ creatingFor === i ? 'Cancelar' : 'Nuevo ingrediente' }}
          </button>
          <IngredientCreateCard
            v-if="creatingFor === i"
            :name="capitalize(line.description.toLowerCase())"
            editable-name
            :categories="ingredientCategories"
            :allow-preparacion="false"
            @created="(created) => onIngredientCreated(i, created)"
          />
        </template>
      </div>
    </div>

    <template v-if="!isCreditNote">
      <UiChoiceCard
        v-model="isPaid"
        :icon="PhWallet"
        title="Estado del pago"
        :description="isPaid
          ? 'Se registra como pagada con esta fecha y método.'
          : `Vence ${invoice.dueDate ? formatDateDisplay(invoice.dueDate, { year: 'numeric' }) : 'sin fecha'}. Queda en Por pagar.`"
        :options="paymentStatusOptions"
      />
      <SupplierPaymentFields v-model="payment" :disabled="!isPaid" />
    </template>

    <p v-if="undecided" class="ui-item-desc">Falta definir el destino de {{ undecided }} línea(s).</p>
    <p class="ui-item-desc">
      Las líneas de Compra de insumos actualizan el costo de cada ingrediente con el precio de esta factura.
    </p>
    <span v-if="error" class="ui-field-error" role="alert">{{ error }}</span>

    <div class="flex flex-wrap gap-2 justify-end">
      <button type="button" class="ui-btn" :disabled="busy" @click="emit('cancel')">Cerrar</button>
      <button type="button" class="ui-btn ui-btn-solid" :disabled="!canConfirm" @click="confirm">
        {{ busy ? 'Registrando…' : 'Registrar' }}
      </button>
    </div>
  </div>
</template>
