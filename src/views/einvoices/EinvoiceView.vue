<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Dialog, DialogPanel } from '@headlessui/vue';
import {
  PhPen, PhPaperPlaneTilt, PhFilePdf, PhArrowsClockwise, PhEnvelope, PhProhibit, PhX,
} from '@phosphor-icons/vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import OrderForm from '@/components/forms/OrderForm.vue';
import DianAnswer from '@/components/einvoices/DianAnswer.vue';
import { EinvoiceService } from '@/services/einvoiceService';
import { useAuthenticationStore } from '@/stores/authentication';
import { useOrderStore } from '@/stores/orderStore';

/* One order's electronic invoice, drawn like its PDF: the preview before
 * issuing, the invoice after. The toolbar works like Imprimir's (export-orders):
 * edit the order in place, act, close the tab. */
const route = useRoute();
const router = useRouter();
const authStore = useAuthenticationStore();
const orderStore = useOrderStore();
const service = new EinvoiceService(authStore.getBakeryId);
const orderId = route.params.orderId;

const STATUS_LABELS = {
  draft: 'En preparación',
  signed: 'Firmada, sin enviar',
  sent: 'Verificando en la DIAN…',
  accepted: 'Aceptada por la DIAN',
  rejected: 'Rechazada por la DIAN',
};
const ID_TYPE_LABELS = { 13: 'CC', 22: 'CE', 31: 'NIT', 41: 'Pasaporte' };
// The DIAN's number for an anonymous buyer (backend invoiceData.js CONSUMIDOR_FINAL).
const CONSUMIDOR_FINAL_ID = '222222222222';
const PAYMENT_FORMS = { 1: 'Contado', 2: 'Crédito' };
const PAYMENT_MEANS = { 10: 'Efectivo', 31: 'Transferencia', 1: 'No definido' };

const loading = ref(true);
const busy = ref(false);
const error = ref('');
const issuer = ref(null);
const invoice = ref(null); // what issuing would send
const einvoice = ref(null); // the issued invoice, once there is one
const creditNote = ref(null);
const qr = ref(null); // the issued invoice's QR, as a data URL from the server
const confirm = ref(null); // 'issue' | 'annul'
const isFormOpen = ref(false);
const order = ref(null);

// A rejected invoice previews its rebuild; anything else issued shows itself.
const isIssued = computed(() => einvoice.value && einvoice.value.status !== 'rejected');
const doc = computed(() => (isIssued.value ? einvoice.value : invoice.value));
const isDiscounted = computed(() => doc.value?.totals?.discount > 0);
// Same rule as the PDF (invoicePdf.js): a business whose prices include tax
// reads its lines with it (8,000, not 7,407.41) and its discount as given.
// Documents issued before the gross fields existed print net.
const isGross = computed(() => doc.value?.taxIncluded && doc.value?.totals?.discountGross !== undefined);
const unitOf = (line) => {
  if (line.free) return 0;
  if (isGross.value) return line.listUnitGross;
  return isDiscounted.value ? line.listUnitPrice : line.unitPrice;
};
const discountOf = (line) => (isGross.value ? line.discountGross : line.discount);
const lineTotalOf = (line) => (isGross.value ? line.base + line.taxAmount : line.base);
const isCredit = computed(() => doc.value?.payment?.form === '2');

// Same as the PDF: whole pesos as they are, anything with cents with two.
const money = (n) => {
  const value = Number(n || 0);
  const cents = Number.isInteger(value) ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  return `${value < 0 ? '-' : ''}$${Math.abs(value).toLocaleString('es-CO', cents)}`;
};
const idLabel = ({ idType, idNumber, checkDigit }) =>
  `${ID_TYPE_LABELS[idType] || idType} ${idNumber}${checkDigit != null ? `-${checkDigit}` : ''}`;
// "2026-10-20 12:37:17" in Colombia's time, as the PDF prints it.
const dateTime = (d) => (d ? new Date(d).toLocaleString('sv-SE', { timeZone: 'America/Bogota' }) : '');

const load = async () => {
  loading.value = true;
  error.value = '';
  try {
    const data = await service.preview(orderId);
    issuer.value = data.issuer;
    invoice.value = data.invoice;
    einvoice.value = data.einvoice;
    qr.value = data.qr || null;
    creditNote.value = data.einvoice?.creditNote ? await service.get(data.einvoice.creditNote.id) : null;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
};

const run = async (fn) => {
  busy.value = true;
  error.value = '';
  try {
    await fn();
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
    confirm.value = null;
  }
};

// Reloaded after: a rejection previews its rebuild, an acceptance brings its QR.
const issue = () => run(async () => {
  await service.issue(orderId);
  await load();
});
const annul = () => run(async () => {
  creditNote.value = await service.annul(orderId, '');
});
// Runs a server action on the invoice or its credit note, and shows the result.
const refresh = (target, call) => run(async () => {
  const updated = await call(target.id);
  if (target.kind === 'creditNote') creditNote.value = updated;
  else einvoice.value = updated;
});
const checkStatus = (target) => refresh(target, (id) => service.checkStatus(id));
const deliver = (target) => refresh(target, (id) => service.deliver(id));

// The tab opens on the click itself: one opened after the PDF arrives is no
// longer the user's action, and Safari (Chrome after ~5 s) blocks it.
const openPdf = (target) => {
  const tab = window.open('', '_blank');
  return run(async () => {
    try {
      if (!tab) throw new Error('El navegador bloqueó la ventana del PDF: permite ventanas emergentes para este sitio');
      const url = URL.createObjectURL(await service.pdf(target.id));
      tab.location = url;
      // The tab has loaded it by then; until revoked the blob stays in memory.
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      tab?.close();
      throw e;
    }
  });
};

// Editing happens here, like in Imprimir: the preview rebuilds from the saved order.
const openForm = () => run(async () => {
  order.value = await orderStore.fetchById(orderId);
  isFormOpen.value = true;
});
const saveOrder = (formData) => run(async () => {
  await orderStore.update(orderId, formData);
  isFormOpen.value = false;
  await load();
});

const close = () => {
  window.close();
  // A tab not opened by script can't close itself.
  if (!window.closed) router.back();
};

onMounted(load);
</script>

<template>
  <div data-ui-theme="light" class="ui-app min-h-screen pb-10" style="background: var(--ui-surface-0)">
    <!-- Toolbar: one solid button, the thing you came to do (Emitir). -->
    <header
      class="sticky top-0 z-10 px-4 py-2 flex flex-wrap items-center justify-between gap-2"
      style="background: var(--ui-surface-2); border-bottom: 1px solid var(--ui-line)"
    >
      <span class="ui-panehead-title">{{ isIssued ? 'Factura electrónica' : 'Facturar pedido' }}</span>
      <div v-if="!loading" class="flex flex-wrap gap-2">
        <button v-if="!isIssued" type="button" class="ui-btn" :disabled="busy" @click="openForm">
          <PhPen :size="14" /> Editar pedido
        </button>
        <template v-if="einvoice?.status === 'accepted'">
          <button type="button" class="ui-btn" :disabled="busy" @click="openPdf(einvoice)">
            <PhFilePdf :size="14" /> PDF
          </button>
          <button
            v-if="einvoice.deliveryEmail || einvoice.delivery"
            type="button" class="ui-btn" :disabled="busy" @click="deliver(einvoice)"
          >
            <PhEnvelope :size="14" /> Reenviar correo
          </button>
          <button v-if="!creditNote" type="button" class="ui-btn ui-btn-danger" :disabled="busy" @click="confirm = 'annul'">
            <PhProhibit :size="14" /> Anular con nota crédito
          </button>
        </template>
        <button v-if="einvoice?.status === 'sent'" type="button" class="ui-btn" :disabled="busy" @click="checkStatus(einvoice)">
          <PhArrowsClockwise :size="14" /> Consultar
        </button>
        <button v-if="!isIssued && invoice" type="button" class="ui-btn ui-btn-solid" :disabled="busy" @click="confirm = 'issue'">
          <PhPaperPlaneTilt :size="14" /> {{ einvoice ? 'Reintentar' : 'Emitir factura' }}
        </button>
        <button type="button" class="ui-btn ui-btn-danger" @click="close">
          <PhX :size="14" /> Cerrar
        </button>
      </div>
    </header>

    <div class="mx-auto max-w-[216mm] px-4 pt-6 flex flex-col gap-4">
      <p v-if="loading" class="ui-empty">Cargando…</p>
      <div v-if="error" class="ui-card ui-item-negative">{{ error }}</div>

      <template v-if="!loading && doc">
        <!-- Where it stands: preview, or the DIAN's verdict and what followed. -->
        <section class="ui-card flex flex-col gap-2">
          <template v-if="!einvoice">
            <span class="ui-card-title">Vista previa</span>
            <p class="ui-card-body">
              El número se asigna al emitir. Una factura emitida no admite modificaciones.
            </p>
          </template>
          <template v-else>
            <span class="ui-card-title">{{ einvoice.number }} · {{ STATUS_LABELS[einvoice.status] }}</span>
            <template v-if="einvoice.status === 'rejected'">
              <DianAnswer :dian="einvoice.dian" />
              <p class="ui-card-body">
                Abajo, la factura como se reenviaría. Si el problema está en el pedido, edítalo; al reintentar sale con el mismo número.
              </p>
            </template>
            <p v-if="einvoice.delivery" class="ui-card-body">
              Correo a {{ einvoice.delivery.to }}:
              {{ einvoice.delivery.status === 'sent' ? 'enviado' : `falló (${einvoice.delivery.error})` }}
            </p>
          </template>

          <!-- By its document number: consumidor final's id type (13) is a cédula's too. -->
          <p v-if="!isIssued && doc.buyer.idNumber === CONSUMIDOR_FINAL_ID" class="ui-card-body">
            Cliente sin documento registrado: se emite a consumidor final.
          </p>
          <p v-if="!isIssued && !doc.deliveryEmail" class="ui-card-body">
            Cliente sin correo registrado: la factura no se enviará por email.
          </p>
        </section>

        <!-- The credit note that annuls it. -->
        <section v-if="creditNote" class="ui-card flex flex-col gap-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="ui-card-title">Nota crédito {{ creditNote.number }} · {{ STATUS_LABELS[creditNote.status] }}</span>
            <div class="flex gap-2">
              <button v-if="creditNote.status === 'accepted'" type="button" class="ui-btn" :disabled="busy" @click="openPdf(creditNote)">
                <PhFilePdf :size="14" /> PDF
              </button>
              <button v-if="creditNote.status === 'sent'" type="button" class="ui-btn" :disabled="busy" @click="checkStatus(creditNote)">
                <PhArrowsClockwise :size="14" /> Consultar
              </button>
              <button v-if="creditNote.status === 'rejected'" type="button" class="ui-btn" :disabled="busy" @click="annul">
                <PhArrowsClockwise :size="14" /> Reintentar
              </button>
            </div>
          </div>
          <DianAnswer v-if="creditNote.status === 'rejected'" :dian="creditNote.dian" />
        </section>

        <!-- The document, drawn like its PDF: a letter-width sheet, the same type
             scale, rules and order. Helvetica on purpose: it is the PDF's face. -->
        <article
          class="ui-card ui-surface-3 flex flex-col gap-5 p-6 sm:p-[14mm] text-[12.5px] leading-snug"
          style="font-family: Helvetica, Arial, sans-serif; border-radius: 4px"
        >
          <div class="flex flex-wrap justify-between gap-6">
            <div class="flex flex-col">
              <span class="text-[19px] font-bold leading-tight">{{ issuer.tradeName || issuer.legalName }}</span>
              <span class="ui-ink-muted mt-1">
                <template v-if="issuer.tradeName">{{ issuer.legalName }}<br></template>
                NIT {{ issuer.nit }}-{{ issuer.checkDigit }}<br>
                {{ issuer.address?.line }}<br>
                {{ issuer.address?.cityName }}, {{ issuer.address?.deptName }}<br>
                {{ [issuer.phone, issuer.email].filter(Boolean).join(' · ') }}
              </span>
            </div>
            <div class="flex flex-col sm:items-end sm:text-right">
              <span class="ui-ink-muted text-[11px] font-bold uppercase tracking-wide">Factura electrónica de venta</span>
              <span class="ui-num text-[21px] font-bold leading-tight">{{ isIssued ? einvoice.number : `${issuer.prefix} — por asignar` }}</span>
              <span class="ui-ink-muted mt-1">
                <template v-if="isIssued">
                  Emitida {{ dateTime(einvoice.issuedAt) }}
                  <template v-if="einvoice.acceptedAt"><br>Validada DIAN {{ dateTime(einvoice.acceptedAt) }}</template>
                </template>
                <template v-else>Vista previa</template>
                <br>Pago: {{ PAYMENT_FORMS[doc.payment.form] }} · {{ PAYMENT_MEANS[doc.payment.meansCode] }}
                <template v-if="isCredit && doc.payment.dueDate"><br>Vence {{ doc.payment.dueDate }}</template>
              </span>
            </div>
          </div>

          <div
            v-if="(isIssued ? einvoice.environment : issuer.environment) === '2'"
            class="text-center text-[11.5px] font-bold tracking-wide py-1.5"
            style="border: 1px solid currentColor"
          >
            DOCUMENTO DE PRUEBA (HABILITACIÓN DIAN) · SIN VALIDEZ FISCAL
          </div>

          <div class="flex flex-col pt-3" style="border-top: 1px solid var(--ui-line)">
            <span class="ui-ink-muted text-[11px] font-bold uppercase tracking-wide">Cliente</span>
            <span class="text-[13.5px] font-bold uppercase">{{ doc.buyer.name }}</span>
            <span class="ui-ink-muted">
              {{ [idLabel(doc.buyer), doc.buyer.email, doc.buyer.address?.line].filter(Boolean).join(' · ') }}
            </span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full" style="border-collapse: collapse">
              <colgroup>
                <col :style="{ width: isDiscounted ? '37%' : '46%' }">
                <col :style="{ width: isDiscounted ? '7%' : '9%' }">
                <col style="width: 16%">
                <col v-if="isDiscounted" style="width: 14%">
                <col style="width: 11%">
                <col style="width: 16%">
              </colgroup>
              <thead class="ui-ink-muted">
                <tr style="border-bottom: 1px solid var(--ui-line)">
                  <th class="py-1.5 pr-2 font-bold text-left">Descripción</th>
                  <th class="py-1.5 px-2 font-bold text-right">Cant.</th>
                  <th class="py-1.5 px-2 font-bold text-right">Valor unit.</th>
                  <th v-if="isDiscounted" class="py-1.5 px-2 font-bold text-right">Desc.</th>
                  <th class="py-1.5 px-2 font-bold text-right">Impuesto</th>
                  <th class="py-1.5 pl-2 font-bold text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="line in doc.lines" :key="line.id">
                  <td class="py-1 pr-2">{{ line.description }}<span v-if="line.free"> (cortesía)</span></td>
                  <td class="py-1 px-2 text-right ui-num">{{ line.quantity }}</td>
                  <td class="py-1 px-2 text-right ui-num">{{ money(unitOf(line)) }}</td>
                  <td v-if="isDiscounted" class="py-1 px-2 text-right ui-num">{{ discountOf(line) > 0 ? money(-discountOf(line)) : '' }}</td>
                  <td class="py-1 px-2 text-right">{{ line.taxRate > 0 ? `${line.taxType} ${line.taxRate}%` : 'Excluido' }}</td>
                  <td class="py-1 pl-2 text-right ui-num">{{ money(lineTotalOf(line)) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <dl
            class="self-end grid grid-cols-[auto_auto] gap-x-10 gap-y-1 pt-3 min-w-[min(100%,20rem)]"
            style="border-top: 1px solid var(--ui-line)"
          >
            <!-- Tax included: what the customer paid first, then the breakdown. -->
            <template v-if="isGross">
              <template v-if="isDiscounted">
                <dt class="ui-ink-muted text-right">Total antes de descuento</dt>
                <dd class="text-right ui-num">{{ money(doc.totals.payable + doc.totals.discountGross) }}</dd>
                <dt class="ui-ink-muted text-right">Descuento</dt>
                <dd class="text-right ui-num">{{ money(-doc.totals.discountGross) }}</dd>
              </template>
              <dt class="text-right font-bold text-[14.5px] pt-1">Total</dt>
              <dd class="text-right ui-num font-bold text-[14.5px] pt-1">{{ money(doc.totals.payable) }}</dd>
              <dt class="ui-ink-muted text-right pt-2">Subtotal sin impuestos</dt>
              <dd class="text-right ui-num pt-2">{{ money(doc.totals.lineExtension) }}</dd>
              <template v-for="t in doc.taxes" :key="`${t.type}-${t.rate}`">
                <dt class="ui-ink-muted text-right">{{ t.type }} {{ t.rate }}% (base {{ money(t.base) }})</dt>
                <dd class="text-right ui-num">{{ money(t.amount) }}</dd>
              </template>
            </template>
            <template v-else>
              <template v-if="isDiscounted">
                <dt class="ui-ink-muted text-right">Subtotal antes de descuento</dt>
                <dd class="text-right ui-num">{{ money(doc.totals.lineExtension + doc.totals.discount) }}</dd>
                <dt class="ui-ink-muted text-right">Descuento</dt>
                <dd class="text-right ui-num">{{ money(-doc.totals.discount) }}</dd>
              </template>
              <dt class="ui-ink-muted text-right">Subtotal</dt>
              <dd class="text-right ui-num">{{ money(doc.totals.lineExtension) }}</dd>
              <template v-for="t in doc.taxes" :key="`${t.type}-${t.rate}`">
                <dt class="ui-ink-muted text-right">{{ t.type }} {{ t.rate }}% (base {{ money(t.base) }})</dt>
                <dd class="text-right ui-num">{{ money(t.amount) }}</dd>
              </template>
              <dt class="text-right font-bold text-[14.5px] pt-1">Total</dt>
              <dd class="text-right ui-num font-bold text-[14.5px] pt-1">{{ money(doc.totals.payable) }}</dd>
            </template>
          </dl>

          <!-- Legal text left, QR right, as at the foot of the PDF. -->
          <footer class="flex gap-6 items-start pt-2 text-[11px]">
            <div class="ui-ink-muted flex-1 min-w-0 flex flex-col gap-1">
              <span v-for="note in issuer.notes" :key="note">{{ note }}</span>
              <span v-if="issuer.resolution">
                Autorización de numeración de facturación DIAN No. {{ issuer.resolution.number }}, vigente del
                {{ issuer.resolution.startDate }} al {{ issuer.resolution.endDate }}, prefijo {{ issuer.resolution.prefix }}
                del {{ issuer.resolution.from }} al {{ issuer.resolution.to }}.
              </span>
              <template v-if="isIssued && einvoice.cufe">
                <strong class="mt-1" style="color: var(--ui-ink)">CUFE</strong>
                <span class="break-all">{{ einvoice.cufe }}</span>
                <span class="mt-1">
                  Representación gráfica de la factura electrónica. Software propio de {{ issuer.legalName }},
                  NIT {{ issuer.nit }}-{{ issuer.checkDigit }}.
                </span>
              </template>
            </div>
            <img v-if="isIssued && qr" :src="qr" alt="Código QR de la factura en la DIAN" class="w-[92px] h-[92px] shrink-0">
          </footer>
        </article>
      </template>
    </div>

    <Dialog :open="isFormOpen" class="relative z-50" @close="isFormOpen = false">
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <!-- No surface of its own: the form is a ui-app and paints itself. -->
        <DialogPanel class="ui-formhost ui-gutter max-h-[90dvh] overflow-y-auto" style="--ui-form-w: 72rem">
          <OrderForm
            v-if="order"
            :key="order.id"
            title="Editar pedido"
            :initial-data="order"
            :loading="busy"
            class="w-full"
            @submit="saveOrder"
            @cancel="isFormOpen = false"
          />
        </DialogPanel>
      </div>
    </Dialog>

    <ConfirmDialog
      :is-open="confirm === 'issue'"
      title="Emitir factura electrónica"
      message="No se puede deshacer. Una factura solo se corrige con nota crédito."
      confirm-text="Emitir"
      cancel-text="Cancelar"
      :loading="busy"
      @confirm="issue"
      @cancel="confirm = null"
    />
    <ConfirmDialog
      :is-open="confirm === 'annul'"
      title="Anular con nota crédito"
      message="La nota crédito anula toda la factura y no se puede deshacer. Para volver a facturar, duplica el pedido."
      confirm-text="Anular"
      cancel-text="Cancelar"
      :loading="busy"
      @confirm="annul"
      @cancel="confirm = null"
    />
  </div>
</template>
