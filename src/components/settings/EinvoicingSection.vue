<script setup>
/* DIAN electronic invoicing for one business: switched on and configured by a
 * system admin only (the business never sees it). Everything here is public
 * data from the RUT, the habilitación portal and the numbering resolution; the
 * certificate and the software PIN live in Secret Manager, never in this form.
 * Once it is on, every field is required: an empty one is a DIAN rejection. */
import { computed, useId } from 'vue';
import { PhCaretDown, PhReceipt } from '@phosphor-icons/vue';
import UiFeatureCard from '@/components/ui/UiFeatureCard.vue';
import UiPills from '@/components/ui/UiPills.vue';

defineProps({
  disabled: { type: Boolean, default: false },
});

const form = defineModel({ required: true });
const uid = useId();

const environments = [
  { value: '2', label: 'Pruebas (habilitación)' },
  { value: '1', label: 'Producción' },
];
const personTypes = [
  { value: '1', label: 'Jurídica' },
  { value: '2', label: 'Natural' },
];

const issuerFields = [
  { key: 'issuerLegalName', label: 'Razón social', autocomplete: 'organization' },
  { key: 'issuerTradeName', label: 'Nombre comercial', optional: true, hint: 'Lo que lee el cliente arriba en la factura.' },
  { key: 'issuerNit', label: 'NIT', inputmode: 'numeric', pattern: '\\d+', hint: 'Sin dígito de verificación: se calcula solo.' },
  {
    key: 'issuerTaxLevelCode',
    label: 'Responsabilidades fiscales',
    placeholder: 'O-47',
    hint: 'Del RUT (casilla 53), separadas por ";". O-13 gran contribuyente, O-15 autorretenedor, O-23 agente de retención IVA, O-47 régimen simple, R-99-PN no aplica.',
  },
  {
    key: 'issuerRegime',
    label: 'Régimen en la factura',
    placeholder: 'Régimen simple de tributación · Responsable de IVA',
    hint: 'Se imprime bajo el NIT. Debe indicar si es responsable de IVA.',
  },
  { key: 'issuerPhone', label: 'Teléfono', type: 'tel' },
  { key: 'issuerEmail', label: 'Correo', type: 'email', hint: 'Los clientes responden aquí, y en pruebas las facturas llegan aquí.' },
];

// Name and DANE code side by side: together they answer one question.
const addressRows = [
  [{ key: 'issuerAddressLine', label: 'Dirección' }],
  [
    { key: 'issuerCityName', label: 'Ciudad' },
    { key: 'issuerCityCode', label: 'Código DANE ciudad', inputmode: 'numeric', pattern: '\\d{5}', placeholder: '08001' },
  ],
  [
    { key: 'issuerDeptName', label: 'Departamento' },
    { key: 'issuerDeptCode', label: 'Código DANE departamento', inputmode: 'numeric', pattern: '\\d{2}', placeholder: '08' },
  ],
];

const resolutionRows = [
  [
    { key: 'resolutionNumber', label: 'Número de resolución', inputmode: 'numeric' },
    { key: 'resolutionPrefix', label: 'Prefijo', pattern: '[A-Za-z0-9]{1,4}', placeholder: 'ESA' },
  ],
  [
    {
      key: 'resolutionFrom',
      label: 'Desde',
      type: 'number',
      hint: 'El inicio del rango, tal como lo autorizó la DIAN (pruebas: 990000000), no el próximo número: el consecutivo sigue solo.',
    },
    { key: 'resolutionTo', label: 'Hasta', type: 'number' },
  ],
  [
    { key: 'resolutionStartDate', label: 'Vigente desde', type: 'date' },
    { key: 'resolutionEndDate', label: 'Vigente hasta', type: 'date' },
  ],
  [{ key: 'resolutionTechnicalKey', label: 'Clave técnica', hint: 'La muestra el portal de la DIAN al asociar el rango al software.' }],
];

// Documento soporte numbering: the same fields minus the technical key (its CUDS uses the PIN).
const supportDocResolutionRows = resolutionRows
  .map((row) => row
    .filter((f) => f.key !== 'resolutionTechnicalKey')
    .map((f) => ({
      ...f,
      key: f.key.replace('resolution', 'dsResolution'),
      hint: f.hint && 'El inicio del rango, tal como lo autorizó la DIAN, no el próximo número.',
    })))
  .filter((row) => row.length);

// The notes print one per line on every invoice; stored as a list.
const notesText = computed({
  get: () => (form.value.einvoicingNotes || []).join('\n'),
  set: (text) => { form.value.einvoicingNotes = text.split('\n').map((l) => l.trim()).filter(Boolean); },
});

const isTest = computed(() => form.value.einvoicingEnvironment !== '1');

// Sales are always required once e-invoicing is on; purchases only when the business issues documentos soporte.
const numberings = computed(() => [
  {
    id: 'sales',
    title: 'Resolución de numeración - Facturación electrónica',
    hint: isTest.value
      ? 'La del set de pruebas que muestra el portal de habilitación (prefijo SETP).'
      : 'La autorizada en MUISCA y asociada al software en el portal de la DIAN.',
    rows: resolutionRows,
    required: true,
    noteKey: 'einvoicingCreditNotePrefix',
    noteLabel: 'Prefijo de notas crédito',
    noteHint: 'No necesita resolución; se numeran desde 1.',
  },
  {
    id: 'ds',
    title: 'Resolución de numeración - Documento soporte',
    hint: 'Compras a proveedores no obligados a facturar. Tiene su propia resolución, sin clave técnica. Déjalo vacío si el negocio no emite documentos soporte.',
    rows: supportDocResolutionRows,
    required: false,
    noteKey: 'dsAdjustmentNotePrefix',
    noteLabel: 'Prefijo de notas de ajuste',
    noteHint: 'Anulan un documento soporte. No necesitan resolución; se numeran desde 1.',
    notePlaceholder: 'NA',
  },
]);
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="ui-sectionhead">Facturación electrónica</div>

    <UiFeatureCard
      v-model="form.einvoicingEnabled"
      :icon="PhReceipt"
      title="Facturación electrónica DIAN"
      description="Facturas electrónicas de venta y notas crédito, con software propio."
      :disabled="disabled"
    />

    <!-- A required field inside a closed <details> can't be focused, so the browser would
         block the save without a word; opening its block on invalid lets it show the error. -->
    <fieldset
      v-if="form.einvoicingEnabled"
      class="contents"
      :disabled="disabled"
      @invalid.capture="$event.target.closest('details')?.setAttribute('open', '')"
    >
      <div>
        <UiPills v-model="form.einvoicingEnvironment" :options="environments" label="Ambiente" required min-width="10rem" />
        <span class="ui-field-hint">
          {{ isTest
            ? 'En pruebas las facturas no tienen valor fiscal y el correo llega al negocio, nunca al cliente.'
            : 'En producción cada factura es real: va a la DIAN y al correo del cliente.' }}
        </span>
      </div>

      <details class="group">
        <summary class="ui-sectionhead !mb-0 flex cursor-pointer items-center justify-between">
          Datos del emisor y resolución
          <PhCaretDown class="transition-transform group-open:rotate-180" />
        </summary>
        <div class="mt-4 flex flex-col gap-4">
      <div class="grid sm:grid-cols-2 gap-4">
        <div class="ui-field">
          <label class="ui-field-k" :for="`${uid}-sw`" data-required>Id del software</label>
          <input :id="`${uid}-sw`" v-model.trim="form.einvoicingSoftwareId" class="ui-input" required>
        </div>
        <div v-if="isTest" class="ui-field">
          <label class="ui-field-k" :for="`${uid}-set`">TestSetId</label>
          <input
            :id="`${uid}-set`"
            v-model.trim="form.einvoicingTestSetId"
            class="ui-input"
            :aria-describedby="`${uid}-set-h`"
          >
          <span :id="`${uid}-set-h`" class="ui-field-hint">
            Solo mientras se pasa el set de pruebas. Con el set aceptado, déjalo vacío:
            la DIAN ya no valida lo que llega al set, y sin él cada factura se valida al instante.
          </span>
        </div>
      </div>

      <div class="ui-sectionhead !mb-0">Emisor</div>
      <UiPills v-model="form.issuerPersonType" :options="personTypes" label="Tipo de persona" required min-width="7rem" />
      <div class="grid sm:grid-cols-2 gap-4">
        <div v-for="f in issuerFields" :key="f.key" class="ui-field">
          <label class="ui-field-k" :for="`${uid}-${f.key}`" :data-required="!f.optional || undefined">{{ f.label }}</label>
          <input
            :id="`${uid}-${f.key}`"
            v-model.trim="form[f.key]"
            :type="f.type || 'text'"
            class="ui-input"
            :required="!f.optional"
            :inputmode="f.inputmode"
            :pattern="f.pattern"
            :placeholder="f.placeholder"
            :autocomplete="f.autocomplete"
            :aria-describedby="f.hint ? `${uid}-${f.key}-h` : undefined"
          >
          <span v-if="f.hint" :id="`${uid}-${f.key}-h`" class="ui-field-hint">{{ f.hint }}</span>
        </div>
      </div>
      <div v-for="(row, i) in addressRows" :key="`a${i}`" class="grid sm:grid-cols-2 gap-4">
        <div v-for="f in row" :key="f.key" class="ui-field" :class="{ 'sm:col-span-2': row.length === 1 }">
          <label class="ui-field-k" :for="`${uid}-${f.key}`" data-required>{{ f.label }}</label>
          <input
            :id="`${uid}-${f.key}`"
            v-model.trim="form[f.key]"
            class="ui-input"
            required
            :inputmode="f.inputmode"
            :pattern="f.pattern"
            :placeholder="f.placeholder"
          >
        </div>
      </div>

      <template v-for="n in numberings" :key="n.id">
      <div class="ui-sectionhead !mb-0">{{ n.title }}</div>
      <p class="ui-field-hint">{{ n.hint }}</p>
      <div v-for="(row, i) in n.rows" :key="`${n.id}${i}`" class="grid sm:grid-cols-2 gap-4">
        <div v-for="f in row" :key="f.key" class="ui-field" :class="{ 'sm:col-span-2': row.length === 1 }">
          <label class="ui-field-k" :for="`${uid}-${f.key}`" :data-required="n.required || undefined">{{ f.label }}</label>
          <input
            v-if="f.type === 'number'"
            :id="`${uid}-${f.key}`"
            v-model.number="form[f.key]"
            type="number"
            class="ui-input ui-input-num"
            min="0"
            :required="n.required"
            :aria-describedby="f.hint ? `${uid}-${f.key}-h` : undefined"
            @wheel="$event.target.blur()"
          >
          <input
            v-else
            :id="`${uid}-${f.key}`"
            v-model.trim="form[f.key]"
            :type="f.type || 'text'"
            class="ui-input"
            :required="n.required"
            :inputmode="f.inputmode"
            :pattern="f.pattern"
            :placeholder="f.placeholder"
            :aria-describedby="f.hint ? `${uid}-${f.key}-h` : undefined"
          >
          <span v-if="f.hint" :id="`${uid}-${f.key}-h`" class="ui-field-hint">{{ f.hint }}</span>
        </div>
      </div>

      <div class="grid sm:grid-cols-2 gap-4">
        <div class="ui-field">
          <label class="ui-field-k" :for="`${uid}-${n.noteKey}`" :data-required="n.required || undefined">{{ n.noteLabel }}</label>
          <input
            :id="`${uid}-${n.noteKey}`"
            v-model.trim="form[n.noteKey]"
            class="ui-input"
            :required="n.required"
            pattern="[A-Za-z0-9]{1,4}"
            :placeholder="n.notePlaceholder"
            :aria-describedby="`${uid}-${n.noteKey}-h`"
          >
          <span :id="`${uid}-${n.noteKey}-h`" class="ui-field-hint">{{ n.noteHint }}</span>
        </div>
      </div>
      </template>

      <div class="ui-field">
        <label class="ui-field-k" :for="`${uid}-notes`">Notas impresas en cada factura</label>
        <textarea
          :id="`${uid}-notes`"
          v-model.lazy="notesText"
          class="ui-input ui-input-area"
          rows="3"
          :aria-describedby="`${uid}-notes-h`"
        ></textarea>
        <span :id="`${uid}-notes-h`" class="ui-field-hint">Una por línea, p. ej. "Somos régimen simple, abstenerse de practicar retención".</span>
      </div>
        </div>
      </details>
    </fieldset>
  </section>
</template>
