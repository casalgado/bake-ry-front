<script setup>
/* The documentos soporte the business has issued: what it bought from suppliers
 * not obliged to invoice. They are issued from a gasto in Resumen. */
import { ref, onMounted } from 'vue';
import { PhArrowsClockwise, PhProhibit } from '@phosphor-icons/vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import DianAnswer from '@/components/einvoices/DianAnswer.vue';
import { isAnnulled } from '@/services/supportDocService';
import { useSupportDocStore } from '@/stores/supportDocStore';
import { useProviderStore } from '@/stores/providerStore';
import { formatMoney } from '@/utils/helpers';

const STATUS_LABELS = {
  draft: 'En preparación', signed: 'Sin enviar', sent: 'Verificando', accepted: 'Aceptado', rejected: 'Rechazado',
};

const supportDocStore = useSupportDocStore();
const providerStore = useProviderStore();

const error = ref('');

const providerName = (doc) => providerStore.items.find((p) => p.id === doc.providerId)?.name ?? doc.supplier?.name ?? '';
const dateOf = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

const busyId = ref(null);

async function refresh(doc) {
  busyId.value = doc.id;
  error.value = '';
  try {
    await supportDocStore.checkStatus(doc.id);
  } catch (err) {
    error.value = err?.message || 'No se pudo consultar el estado';
  } finally {
    busyId.value = null;
  }
}

const toAnnul = ref(null);
const annulling = ref(false);
const annulError = ref('');

async function confirmAnnul() {
  annulling.value = true;
  annulError.value = '';
  try {
    await supportDocStore.annul(toAnnul.value.id, 'Anulación del documento soporte');
    toAnnul.value = null;
  } catch (err) {
    annulError.value = err?.message || 'No se pudo anular el documento';
  } finally {
    annulling.value = false;
  }
}

onMounted(() => {
  supportDocStore.load();
  if (!providerStore.items.length) providerStore.fetchAll();
});
</script>

<template>
  <div class="p-4 lg:p-6 w-full max-w-4xl" data-ui-theme="light">
    <PageHeader title="Documentos soporte" subtitle="Compras a proveedores no obligados a facturar. Se emiten desde un gasto en Resumen." />

    <p v-if="error || supportDocStore.error" class="ui-field-error" role="alert">{{ error || supportDocStore.error }}</p>

    <div v-if="!supportDocStore.documents.length && !supportDocStore.loading" class="ui-empty">
      <b>No hay documentos soporte emitidos.</b>
    </div>

    <div v-else class="flex flex-col">
      <div v-for="doc in supportDocStore.documents" :key="doc.id" class="flex flex-col">
        <div class="ui-item">
          <span class="ui-item-meta w-24 shrink-0">{{ doc.date ? dateOf(doc.date) : '' }}</span>
          <span class="min-w-0">
            <span class="ui-item-title block">{{ providerName(doc) }}</span>
            <span class="ui-item-desc">{{ doc.number }}</span>
          </span>
          <span class="ui-item-trail">
            <span class="ui-tag">{{ isAnnulled(doc) ? 'Anulado' : STATUS_LABELS[doc.status] }}</span>
            <span class="ui-item-num ui-num">{{ formatMoney(doc.totals?.payable ?? 0) }}</span>
            <button
              v-if="['signed', 'sent'].includes(doc.status)"
              type="button"
              class="ui-btn ui-btn-icon"
              aria-label="Actualizar estado"
              title="Actualizar estado"
              :disabled="busyId === doc.id"
              @click="refresh(doc)"
            >
              <PhArrowsClockwise :size="14" />
            </button>
            <button
              v-if="doc.status === 'accepted' && !doc.adjustmentNote"
              type="button"
              class="ui-btn ui-btn-icon ui-btn-danger"
              aria-label="Anular"
              title="Anular"
              @click="annulError = ''; toAnnul = doc"
            >
              <PhProhibit :size="14" />
            </button>
          </span>
        </div>
        <DianAnswer v-if="doc.status === 'rejected'" :dian="doc.dian" />
      </div>
    </div>

    <ConfirmDialog
      :is-open="!!toAnnul"
      title="Anular documento soporte"
      :message="annulError || `Se emitirá una nota de ajuste que anula el documento ${toAnnul?.number ?? ''}.`"
      confirm-text="Anular"
      cancel-text="Cancelar"
      :loading="annulling"
      @confirm="confirmAnnul"
      @cancel="toAnnul = null"
    />
  </div>
</template>
