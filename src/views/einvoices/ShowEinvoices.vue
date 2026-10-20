<script setup>
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import PageHeader from '@/components/ui/PageHeader.vue';
import PeriodSelector from '@/components/common/PeriodSelector.vue';
import { EinvoiceService } from '@/services/einvoiceService';
import { useAuthenticationStore } from '@/stores/authentication';
import { usePeriodStore } from '@/stores/periodStore';
import { formatMoney } from '@/utils/helpers';

// The register of issued invoices and credit notes, for the period.
const router = useRouter();
const authStore = useAuthenticationStore();
const periodStore = usePeriodStore();
const service = new EinvoiceService(authStore.getBakeryId);

const STATUS_LABELS = {
  draft: 'En preparación', signed: 'Sin enviar', sent: 'Verificando', accepted: 'Aceptada', rejected: 'Rechazada',
};

const docs = ref([]);
const error = ref('');
const status = ref('');

const load = async () => {
  error.value = '';
  try {
    docs.value = await service.list({
      startDate: periodStore.periodRange.start.toISOString(),
      endDate: periodStore.periodRange.end.toISOString(),
    });
  } catch (e) {
    error.value = e.message;
  }
};

const visible = computed(() => docs.value.filter((d) => !status.value || d.status === status.value));

const linkTo = (doc) => ({ name: 'einvoice', params: { orderId: doc.orderId } });
const open = (doc) => router.push(linkTo(doc));
const copy = (text) => navigator.clipboard?.writeText(text);

watch(() => periodStore.periodRange, load, { deep: true, immediate: true });
</script>

<template>
  <div class="ui-app p-4 flex flex-col gap-4">
    <PageHeader title="Facturas" />
    <div class="flex flex-wrap items-center justify-between gap-2">
      <PeriodSelector />
      <select v-model="status" class="ui-input" aria-label="Estado">
        <option value="">Todos los estados</option>
        <option v-for="(label, key) in STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
      </select>
    </div>

    <div v-if="error" class="ui-card ui-item-negative">{{ error }}</div>
    <p v-else-if="!docs.length" class="ui-empty">No hay facturas en este periodo.</p>
    <p v-else-if="!visible.length" class="ui-empty">Ninguna factura con ese estado.</p>

    <div v-if="visible.length" class="ui-card ui-card-flush flex flex-col">
      <!-- The whole row opens the invoice with a mouse; the number is the link,
           so a keyboard reaches it too. -->
      <div
        v-for="doc in visible"
        :key="doc.id"
        class="ui-item ui-item-divided grid grid-cols-[1fr_auto] sm:grid-cols-[8rem_1fr_7rem_8rem_auto] items-center gap-3 cursor-pointer"
        :class="{ 'ui-item-negative': doc.status === 'rejected' }"
        @click="open(doc)"
      >
        <RouterLink :to="linkTo(doc)" class="ui-item-title underline-offset-2 hover:underline" @click.stop>
          {{ doc.kind === 'creditNote' ? 'NC ' : '' }}{{ doc.number }}
        </RouterLink>
        <span class="ui-item-desc">{{ doc.client?.name }}</span>
        <span class="ui-item-meta">{{ doc.issuedAt?.toLocaleDateString('es-CO') }}</span>
        <span class="ui-num">{{ formatMoney(doc.totals?.payable) }}</span>
        <span class="flex items-center gap-2">
          <span class="ui-tag">{{ STATUS_LABELS[doc.status] }}{{ doc.creditNote?.status === 'accepted' ? ' · anulada' : '' }}</span>
          <button v-if="doc.cufe" type="button" class="ui-btn ui-btn-sm" @click.stop="copy(doc.cufe)">CUFE</button>
        </span>
      </div>
    </div>
  </div>
</template>
