<script setup>
/* Issues the documento soporte of one gasto: the supplier did not invoice, so the
 * business issues the document itself and sends it to the DIAN. The lines start as
 * the gasto's amount and can be split; the backend issues one document per gasto. */
import { ref, computed, useId } from 'vue';
import { PhPlus, PhX } from '@phosphor-icons/vue';
import DianAnswer from '@/components/einvoices/DianAnswer.vue';
import UiMoneyInput from '@/components/ui/UiMoneyInput.vue';
import { useSupportDocStore } from '@/stores/supportDocStore';
import { formatMoney } from '@/utils/helpers';
import { formatDateForInput } from '@/utils/dateUtils';

const props = defineProps({
  record: { type: Object, required: true },
  provider: { type: Object, default: null },
});
const emit = defineEmits(['cancel']);

const uid = useId();
const supportDocStore = useSupportDocStore();

// DIAN means of payment: 10 efectivo, 42 consignación bancaria.
const MEANS = { cash: '10', transfer: '42' };

const date = ref(formatDateForInput(props.record.date));
const lines = ref([{
  description: props.record.description || props.record.categoryName,
  quantity: 1,
  unitPrice: props.record.amount,
}]);
const issued = ref(null);
const busy = ref(false);
const error = ref('');

const total = computed(() =>
  lines.value.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0), 0));
const differs = computed(() => total.value !== props.record.amount);
// Same fiscal data the backend demands (dian/supportDocData.js `toSupplier`); it only warns,
// the backend stays the authority.
const missing = computed(() => {
  const address = props.provider?.address || {};
  return [
    !String(props.provider?.nationalId || '').replace(/\D/g, '') && 'NIT o cédula',
    !address.line && 'dirección',
    !address.cityCode && 'municipio',
    !address.deptCode && 'departamento',
    !/^\d{6}$/.test(address.postalCode || '') && 'código postal (6 dígitos)',
  ].filter(Boolean);
});
const canIssue = computed(() => !busy.value && !issued.value && total.value > 0
  && lines.value.every((line) => line.description.trim() && Number(line.quantity) > 0 && Number(line.unitPrice) > 0));

async function issue() {
  if (!canIssue.value) return;
  busy.value = true;
  error.value = '';
  try {
    issued.value = await supportDocStore.issue({
      source: { type: 'accountingRecord', id: props.record.id },
      providerId: props.record.providerId,
      date: date.value,
      payment: { form: '1', meansCode: MEANS[props.record.paymentMethod] || '10' },
      lines: lines.value.map((line) => ({
        description: line.description.trim(),
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
      })),
    });
  } catch (err) {
    error.value = err?.message || 'No se pudo emitir el documento soporte';
  } finally {
    busy.value = false;
  }
}

const addLine = () => lines.value.push({ description: '', quantity: 1, unitPrice: null });
const removeLine = (index) => lines.value.splice(index, 1);
</script>

<template>
  <div class="ui-card flex flex-col gap-4" data-ui-theme="light">
    <div>
      <h2 class="ui-panehead-title">Documento soporte</h2>
      <p class="ui-item-desc">{{ provider?.name }} ·{{ record.categoryName }} · {{ formatMoney(record.amount) }}</p>
    </div>

    <template v-if="!issued">
      <div class="ui-field">
        <label class="ui-field-k" :for="`${uid}-date`" data-required>Fecha de la compra</label>
        <input :id="`${uid}-date`" v-model="date" type="date" class="ui-input" required>
      </div>

      <div v-for="(line, i) in lines" :key="i" class="flex flex-col gap-2 pb-3" style="border-bottom: 1px solid var(--ui-line)">
        <div class="ui-field">
          <label class="ui-field-k" :for="`${uid}-desc-${i}`" data-required>Descripción</label>
          <input :id="`${uid}-desc-${i}`" v-model="line.description" class="ui-input">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="ui-field">
            <label class="ui-field-k" :for="`${uid}-qty-${i}`" data-required>Cantidad</label>
            <input :id="`${uid}-qty-${i}`" v-model="line.quantity" type="number" min="0" step="any" class="ui-input">
          </div>
          <div class="ui-field">
            <label class="ui-field-k" :for="`${uid}-price-${i}`" data-required>Valor unitario</label>
            <UiMoneyInput :id="`${uid}-price-${i}`" v-model="line.unitPrice" class="ui-field-unit" />
          </div>
        </div>
        <button v-if="lines.length > 1" type="button" class="ui-btn ui-btn-sm self-end" @click="removeLine(i)">
          <PhX :size="12" weight="bold" /> Quitar línea
        </button>
      </div>

      <button type="button" class="ui-btn ui-btn-sm self-start" @click="addLine">
        <PhPlus :size="12" weight="bold" /> Agregar línea
      </button>

      <p class="ui-item-desc">
        Total del documento: <b class="ui-num">{{ formatMoney(total) }}</b>
        <template v-if="differs"> · difiere del valor del gasto ({{ formatMoney(record.amount) }}).</template>
      </p>
      <p v-if="missing.length" class="ui-field-hint">
        Al proveedor le falta: {{ missing.join(', ') }}. Complétalo en Proveedores antes de emitir.
      </p>
      <p class="ui-item-desc">
        Se emite una sola vez por gasto y se envía a la DIAN de inmediato. Sin IVA ni retenciones.
      </p>
    </template>

    <template v-else>
      <p>
        <span class="ui-tag">{{ issued.status === 'accepted' ? 'Aceptado' : issued.status === 'rejected' ? 'Rechazado' : 'En verificación' }}</span>
        {{ issued.number }}
      </p>
      <DianAnswer v-if="issued.status === 'rejected'" :dian="issued.dian" />
    </template>

    <span v-if="error" class="ui-field-error" role="alert">{{ error }}</span>

    <div class="flex gap-2 justify-end">
      <button type="button" class="ui-btn ui-btn-danger" :disabled="busy" @click="emit('cancel')">
        {{ issued ? 'Cerrar' : 'Cancelar' }}
      </button>
      <button v-if="!issued" type="button" class="ui-btn ui-btn-solid" :disabled="!canIssue" @click="issue">
        {{ busy ? 'Emitiendo…' : 'Emitir documento soporte' }}
      </button>
    </div>
  </div>
</template>
