<script setup>
/* One received invoice: where each line goes. A line is an insumo (it enters
 * Compra de insumos with its ingredient and quantity), a gasto or inversión
 * category, or omitted. Nothing is placed for the user: an undecided line blocks
 * Confirmar. */
import { ref, computed, onMounted, useId } from 'vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import { useReceivedInvoiceStore } from '@/stores/receivedInvoiceStore';
import { useIngredientStore } from '@/stores/ingredientStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { formatMoney } from '@/utils/helpers';

const props = defineProps({
  invoice: { type: Object, required: true },
});
const emit = defineEmits(['done', 'cancel']);

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

const rows = ref(props.invoice.lines.map(toForm));
const busy = ref(false);
const error = ref('');

const categories = computed(() => (settingsStore.items[0]?.expenseCategories ?? []).filter((cat) => cat.isActive));
const expenseOptions = computed(() => categories.value.filter((cat) => !cat.isInvestment));
const investmentOptions = computed(() => categories.value.filter((cat) => cat.isInvestment));
const ingredients = computed(() =>
  ingredientStore.items.filter((ingredient) => !ingredient.isDeleted)
    .sort((a, b) => a.name.localeCompare(b.name)));
const unitOf = (id) => ingredients.value.find((ingredient) => ingredient.id === id)?.unit ?? '';

const isInsumoIncomplete = (row) => row.choice === 'insumo' && (!row.ingredientId || !(Number(row.qty) > 0));
const undecided = computed(() => rows.value.filter((row) => !row.choice || isInsumoIncomplete(row)).length);
const needsProvider = computed(() => !props.invoice.providerId);
const isCreditNote = computed(() => props.invoice.kind === 'credit_note');
const canConfirm = computed(() => !isCreditNote.value && !needsProvider.value && !undecided.value && !busy.value);

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

async function saveAndClose() {
  if (await run(save)) emit('done', 'Cambios guardados');
}

async function confirm() {
  if (!canConfirm.value) return;
  if (await run(async () => {
    await save();
    await invoiceStore.confirm(props.invoice.id);
  })) emit('done', 'Factura registrada');
}

const confirmIgnore = ref(false);

async function ignore() {
  const ok = await run(() => invoiceStore.ignore(props.invoice.id));
  confirmIgnore.value = false;
  if (ok) emit('done', 'Factura omitida');
}

async function createProvider() {
  if (await run(() => invoiceStore.createProvider(props.invoice.id))) emit('done', 'Proveedor creado');
}

onMounted(() => {
  if (!settingsStore.items.length) settingsStore.fetchById('default');
  if (!ingredientStore.items.length) ingredientStore.fetchAll();
});
</script>

<template>
  <div class="ui-card flex flex-col gap-4" data-ui-theme="light">
    <div>
      <h2 class="ui-panehead-title">
        {{ isCreditNote ? 'Nota crédito' : 'Factura' }} {{ invoice.invoiceRef }}
      </h2>
      <p class="ui-item-desc">
        {{ invoice.supplier.name }} · {{ invoice.supplier.documentType }} {{ invoice.supplier.nationalId }}
        · {{ formatMoney(invoice.totals.total) }}
      </p>
    </div>

    <p v-if="isCreditNote" class="ui-field-hint">
      Las notas crédito todavía no se pueden registrar. Omítela si no la necesitas.
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
      </div>
    </div>

    <p v-if="undecided" class="ui-item-desc">Falta definir el destino de {{ undecided }} línea(s).</p>
    <p class="ui-item-desc">
      Las líneas de Compra de insumos actualizan el costo de cada ingrediente con el precio de esta factura.
    </p>
    <span v-if="error" class="ui-field-error" role="alert">{{ error }}</span>

    <div class="flex flex-wrap gap-2 justify-end">
      <button type="button" class="ui-btn ui-btn-danger" :disabled="busy" @click="emit('cancel')">Cancelar</button>
      <button type="button" class="ui-btn" :disabled="busy" @click="confirmIgnore = true">Omitir factura</button>
      <button type="button" class="ui-btn" :disabled="busy" @click="saveAndClose">Guardar</button>
      <button type="button" class="ui-btn ui-btn-solid" :disabled="!canConfirm" @click="confirm">
        {{ busy ? 'Procesando…' : 'Confirmar' }}
      </button>
    </div>

    <ConfirmDialog
      :is-open="confirmIgnore"
      title="Omitir factura"
      message="La factura saldrá de la bandeja y no se registrará."
      confirm-text="Omitir"
      cancel-text="Cancelar"
      :loading="busy"
      @confirm="ignore"
      @cancel="confirmIgnore = false"
    />
  </div>
</template>
