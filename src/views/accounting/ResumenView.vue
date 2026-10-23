<script setup>
/* The month at a glance: totals strip and the month's records. Stepping months
 * uses its own state in accountingStore, not the global period selector. */
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { Dialog, DialogPanel } from '@headlessui/vue';
import { PhCaretLeft, PhCaretRight, PhPlus, PhArrowsClockwise, PhTrash, PhFileText } from '@phosphor-icons/vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import RecordForm from '@/components/accounting/RecordForm.vue';
import PendingTemplates from '@/components/accounting/PendingTemplates.vue';
import SupportDocForm from '@/components/accounting/SupportDocForm.vue';
import { isAnnulled } from '@/services/supportDocService';
import { useSupportDocStore } from '@/stores/supportDocStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { useAccountingStore } from '@/stores/accountingStore';
import { useAccountingRecordStore } from '@/stores/accountingRecordStore';
import { useProviderStore } from '@/stores/providerStore';
import { formatMoney, capitalize } from '@/utils/helpers';

const accountingStore = useAccountingStore();
const recordStore = useAccountingRecordStore();
const providerStore = useProviderStore();

const monthLabel = computed(() => {
  const [year, month] = accountingStore.period.split('-').map(Number);
  return capitalize(new Date(year, month - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }));
});

// Totals read as zero until the month arrives; show a dash instead of a false "nothing this month".
const money = (value) => (accountingStore.loading ? '–' : formatMoney(value));

// The same screen lives under both dashboards; the link stays in the one it is in.
const route = useRoute();
const pygRoute = computed(() => (route.name === 'accounting-resumen' ? 'accounting-pyg' : 'admin-accounting-pyg'));

const receivedRoute = computed(() => (route.name === 'accounting-resumen' ? 'accounting-received' : 'admin-accounting-received'));

const pendingCount = computed(() => accountingStore.pendingTemplates.length);

const providerName = (id) => providerStore.items.find((p) => p.id === id)?.name ?? '';
const dayOf = (date) => new Date(date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });

// `formKey` remounts the form, so a repeat never inherits the last one's typing.
const formOpen = ref(false);
const formKey = ref(0);
const prefill = ref(null);
const editing = ref(null);

const newType = ref('expense');

// `repeat` starts a new record from a stored one; otherwise the record is edited.
// `type` only matters for a blank form: a stored record brings its own.
function openForm(record = null, { repeat = false, type = 'expense' } = {}) {
  newType.value = type;
  prefill.value = repeat ? record : null;
  editing.value = repeat ? null : record;
  formKey.value++;
  formOpen.value = true;
}

async function onSaved() {
  formOpen.value = false;
  await accountingStore.loadMonth();
}

const closeDialog = ref(false);
const closing = ref(false);

// Closing and reopening are the same dialog: what the month is now decides which.
// A refusal usually means another tab changed the month, so reload it before saying why.
async function toggleClose() {
  closing.value = true;
  try {
    if (accountingStore.closed) await accountingStore.reopenPeriod();
    else await accountingStore.closePeriod();
    closeDialog.value = false;
  } catch (err) {
    closeDialog.value = false;
    await accountingStore.loadMonth();
    accountingStore.error = err?.message || 'No se pudo actualizar el cierre del mes';
  } finally {
    closing.value = false;
  }
}

const closedOn = computed(() => (accountingStore.closed
  ? new Date(accountingStore.closed.closedAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
  : ''));

const toDelete = ref(null);
const deleting = ref(false);
const deleteError = ref('');

function askDelete(record) {
  deleteError.value = '';
  toDelete.value = record;
}

async function confirmDelete() {
  deleting.value = true;
  deleteError.value = '';
  try {
    await recordStore.remove(toDelete.value.id);
    await accountingStore.loadMonth();
    toDelete.value = null;
  } catch (err) {
    deleteError.value = err?.message || 'No se pudo eliminar el registro';
  } finally {
    deleting.value = false;
  }
}

// Documento soporte: only with e-invoicing on, for a gasto whose supplier does not invoice.
const settingsStore = useBakerySettingsStore();
const supportDocStore = useSupportDocStore();
const supportDocOf = (record) => supportDocStore.bySourceId(record.id);
const providerOf = (record) => providerStore.items.find((provider) => provider.id === record.providerId);

const canIssueSupportDoc = (record) => settingsStore.isEinvoicingEnabled
  && record.type === 'expense'
  && !!record.providerId
  && providerOf(record)?.issuesEinvoice !== true
  && !supportDocOf(record);

const supportDocRecord = ref(null);

onMounted(async () => {
  accountingStore.loadMonth();
  if (!providerStore.items.length) providerStore.fetchAll();
  if (!settingsStore.items.length) await settingsStore.fetchById('default');
  if (settingsStore.isEinvoicingEnabled) supportDocStore.ensureLoaded();
});
</script>

<template>
  <div class="p-4 lg:p-6 w-full max-w-4xl">
    <PageHeader title="Resumen" subtitle="Gastos, inversiones y otros ingresos del mes.">
      <button type="button" class="ui-btn" @click="openForm(null, { type: 'revenue' })">
        <PhPlus :size="14" weight="bold" /> Nuevo ingreso
      </button>
      <button type="button" class="ui-btn ui-btn-solid" @click="openForm()">
        <PhPlus :size="14" weight="bold" /> Nuevo gasto
      </button>
    </PageHeader>

    <div class="flex items-center gap-2 mb-4">
      <button type="button" class="ui-btn ui-btn-icon" aria-label="Mes anterior" @click="accountingStore.stepMonth(-1)">
        <PhCaretLeft :size="14" weight="bold" />
      </button>
      <span class="ui-panehead-title min-w-40 text-center">{{ monthLabel }}</span>
      <button type="button" class="ui-btn ui-btn-icon" aria-label="Mes siguiente" @click="accountingStore.stepMonth(1)">
        <PhCaretRight :size="14" weight="bold" />
      </button>
    </div>

    <div class="flex flex-wrap items-center gap-3 mb-4">
      <span v-if="accountingStore.closed" class="ui-tag">Mes cerrado el {{ closedOn }}</span>
      <button type="button" class="ui-btn ui-btn-sm" @click="closeDialog = true">
        {{ accountingStore.closed ? 'Reabrir mes' : 'Cerrar mes' }}
      </button>
    </div>

    <p class="mb-4">
      <RouterLink :to="{ name: pygRoute }" class="underline">Ver P&G</RouterLink>
    </p>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
      <div class="ui-stat">
        <span class="ui-stat-k">Gastos</span>
        <span class="ui-stat-v">{{ money(accountingStore.totals.expense) }}</span>
      </div>
      <div class="ui-stat">
        <span class="ui-stat-k">Inversiones</span>
        <span class="ui-stat-v">{{ money(accountingStore.totals.investment) }}</span>
      </div>
      <div class="ui-stat">
        <span class="ui-stat-k">Otros ingresos</span>
        <span class="ui-stat-v">{{ money(accountingStore.totals.revenue) }}</span>
      </div>
    </div>

    <p v-if="pendingCount" class="mb-4">
      <span class="ui-tag">
        {{ pendingCount }} {{ pendingCount === 1 ? 'gasto recurrente sin confirmar' : 'gastos recurrentes sin confirmar' }}
      </span>
    </p>

    <p v-if="accountingStore.pendingReceivedInvoices" class="mb-4">
      <RouterLink :to="{ name: receivedRoute }" class="ui-tag">
        {{ accountingStore.pendingReceivedInvoices }}
        {{ accountingStore.pendingReceivedInvoices === 1 ? 'factura recibida por registrar' : 'facturas recibidas por registrar' }}
      </RouterLink>
    </p>

    <p v-if="accountingStore.error || supportDocStore.error" class="ui-field-error" role="alert">
      {{ accountingStore.error || supportDocStore.error }}
    </p>

    <PendingTemplates v-if="pendingCount" :templates="accountingStore.pendingTemplates" />

    <div v-if="!accountingStore.records.length && !accountingStore.loading" class="ui-empty">
      <b>No hay registros este mes.</b>
    </div>

    <div v-else class="flex flex-col">
      <div v-for="record in accountingStore.records" :key="record.id" class="ui-item">
        <span class="ui-item-meta w-14 shrink-0">{{ dayOf(record.date) }}</span>
        <button type="button" class="min-w-0 text-left !m-0 !p-0" @click="openForm(record)">
          <span class="ui-item-title block">{{ record.categoryName }}</span>
          <span class="ui-item-desc block">
            {{ [record.description, record.counterparty, providerName(record.providerId), record.invoiceRef && `Factura ${record.invoiceRef}`].filter(Boolean).join(' · ') }}
          </span>
        </button>
        <span class="ui-item-trail">
          <span v-if="record.isInvestment" class="ui-tag">Inversión</span>
          <span v-if="record.type === 'revenue'" class="ui-tag">Ingreso</span>
          <span v-if="supportDocOf(record)" class="ui-tag">
            Doc. soporte {{ supportDocOf(record).number }}{{ isAnnulled(supportDocOf(record)) ? ' · Anulado' : '' }}
          </span>
          <button
            v-else-if="canIssueSupportDoc(record)"
            type="button"
            class="ui-btn ui-btn-icon"
            aria-label="Emitir documento soporte"
            title="Emitir documento soporte"
            @click="supportDocRecord = record"
          >
            <PhFileText :size="14" />
          </button>
          <span class="ui-item-num ui-num">{{ formatMoney(record.amount) }}</span>
          <button
            type="button"
            class="ui-btn ui-btn-icon"
            aria-label="Repetir"
            title="Repetir"
            @click="openForm(record, { repeat: true })"
          >
            <PhArrowsClockwise :size="14" />
          </button>
          <button
            type="button"
            class="ui-btn ui-btn-icon ui-btn-danger"
            aria-label="Eliminar"
            title="Eliminar"
            @click="askDelete(record)"
          >
            <PhTrash :size="14" />
          </button>
        </span>
      </div>
    </div>

    <Dialog :open="formOpen" class="relative z-50" @close="formOpen = false">
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="ui-formhost ui-gutter max-h-[90dvh] overflow-y-auto" style="--ui-form-w: 32rem">
          <RecordForm
            :key="formKey"
            :period="accountingStore.period"
            :prefill="prefill"
            :record="editing"
            :type="newType"
            @saved="onSaved"
            @cancel="formOpen = false"
          />
        </DialogPanel>
      </div>
    </Dialog>

    <Dialog :open="!!supportDocRecord" class="relative z-50" @close="supportDocRecord = null">
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="ui-formhost ui-gutter max-h-[90dvh] overflow-y-auto" style="--ui-form-w: 36rem">
          <SupportDocForm
            v-if="supportDocRecord"
            :key="supportDocRecord.id"
            :record="supportDocRecord"
            :provider="providerOf(supportDocRecord)"
            @cancel="supportDocRecord = null"
          />
        </DialogPanel>
      </div>
    </Dialog>

    <ConfirmDialog
      :is-open="closeDialog"
      :title="accountingStore.closed ? 'Reabrir mes' : 'Cerrar mes'"
      :message="accountingStore.closed
        ? 'Al reabrir, el mes deja de compararse con sus cifras de cierre.'
        : 'Se conservan las cifras actuales del mes. Si luego se modifica un registro, el P&G lo indicará.'"
      :confirm-text="accountingStore.closed ? 'Reabrir' : 'Cerrar mes'"
      cancel-text="Cancelar"
      :loading="closing"
      @confirm="toggleClose"
      @cancel="closeDialog = false"
    />

    <ConfirmDialog
      :is-open="!!toDelete"
      title="Eliminar registro"
      :message="deleteError || `¿Eliminar ${toDelete?.categoryName ?? ''} por ${formatMoney(toDelete?.amount ?? 0)}?`"
      confirm-text="Eliminar"
      cancel-text="Cancelar"
      :loading="deleting"
      @confirm="confirmDelete"
      @cancel="toDelete = null"
    />
  </div>
</template>
