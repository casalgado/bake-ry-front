<script setup>
/* The inbox: supplier invoices that arrived by email and are not booked yet.
 * Each opens to decide where its lines go. */
import { ref, computed, onMounted } from 'vue';
import { Dialog, DialogPanel } from '@headlessui/vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import ToastNotification from '@/components/ToastNotification.vue';
import ReceivedInvoiceReview from '@/components/accounting/ReceivedInvoiceReview.vue';
import { useReceivedInvoiceStore } from '@/stores/receivedInvoiceStore';
import { formatMoney } from '@/utils/helpers';

const invoiceStore = useReceivedInvoiceStore();

const byStatus = (status) => invoiceStore.items.filter((invoice) => invoice.status === status);
const pending = computed(() =>
  byStatus('pending').sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate)));
const unreadable = computed(() => byStatus('unreadable'));

const dateOf = (date) => new Date(date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

// `reviewKey` remounts the review, so one invoice never inherits another's choices.
const reviewing = ref(null);
const reviewKey = ref(0);

function open(invoice) {
  reviewing.value = invoice;
  reviewKey.value++;
}

const toastRef = ref(null);

async function onDone(message) {
  reviewing.value = null;
  toastRef.value?.showSuccess('Facturas recibidas', message);
  await invoiceStore.fetchAll();
}

const dismissError = ref('');

async function dismiss(invoice) {
  dismissError.value = '';
  try {
    await invoiceStore.ignore(invoice.id);
    toastRef.value?.showSuccess('Facturas recibidas', 'Mensaje omitido');
    await invoiceStore.fetchAll();
  } catch (err) {
    dismissError.value = err?.message || 'No se pudo omitir el mensaje';
  }
}

onMounted(() => invoiceStore.fetchAll());
</script>

<template>
  <div class="p-4 lg:p-6 w-full max-w-4xl" data-ui-theme="light">
    <PageHeader title="Facturas recibidas" subtitle="Facturas de proveedores recibidas por correo, pendientes de registrar." />

    <div v-if="!pending.length && !invoiceStore.loading" class="ui-empty">
      <b>No hay facturas pendientes.</b>
    </div>

    <div v-else class="flex flex-col">
      <button v-for="invoice in pending" :key="invoice.id" type="button" class="ui-item" @click="open(invoice)">
        <span class="ui-item-meta w-24 shrink-0">{{ dateOf(invoice.issueDate) }}</span>
        <span class="min-w-0">
          <span class="ui-item-title block">{{ invoice.supplier.name }}</span>
          <span class="ui-item-desc">Factura {{ invoice.invoiceRef }} · {{ invoice.lines.length }} línea(s)</span>
        </span>
        <span class="ui-item-trail">
          <span v-if="invoice.kind === 'credit_note'" class="ui-tag">Nota crédito</span>
          <span v-if="!invoice.providerId" class="ui-tag">Proveedor nuevo</span>
          <span v-if="invoice.buyerMismatch" class="ui-tag">NIT distinto</span>
          <span class="ui-item-num ui-num">{{ formatMoney(invoice.totals.total) }}</span>
        </span>
      </button>
    </div>

    <template v-if="unreadable.length">
      <div class="ui-sectionhead mt-6">Correos que no pudieron leerse</div>
      <p v-if="dismissError" class="ui-field-error" role="alert">{{ dismissError }}</p>
      <div v-for="invoice in unreadable" :key="invoice.id" class="ui-item">
        <span class="ui-item-meta w-24 shrink-0">{{ dateOf(invoice.createdAt) }}</span>
        <span class="min-w-0">
          <span class="ui-item-title block">{{ invoice.email?.subject || 'Correo sin asunto' }}</span>
          <span class="ui-item-desc">{{ [invoice.email?.from, invoice.reason].filter(Boolean).join(' · ') }}</span>
        </span>
        <span class="ui-item-trail">
          <button type="button" class="ui-btn ui-btn-sm" @click="dismiss(invoice)">Omitir</button>
        </span>
      </div>
    </template>

    <Dialog :open="!!reviewing" class="relative z-50" @close="reviewing = null">
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="ui-formhost ui-gutter max-h-[90dvh] overflow-y-auto" style="--ui-form-w: 40rem">
          <ReceivedInvoiceReview
            v-if="reviewing"
            :key="reviewKey"
            :invoice="reviewing"
            @done="onDone"
            @cancel="reviewing = null"
          />
        </DialogPanel>
      </div>
    </Dialog>

    <ToastNotification ref="toastRef" />
  </div>
</template>
