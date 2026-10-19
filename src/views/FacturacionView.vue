<script setup>
import PageHeader from '@/components/ui/PageHeader.vue';

const steps = [
  {
    title: 'Certificado de firma digital',
    detail: 'Archivo .p12 de una entidad autorizada. Unos $120.000 a $495.000 COP según proveedor y vigencia.',
    providers: [
      { name: 'Andes SCD', url: 'https://www.andesscd.com.co', note: 'Todo en línea, emite desde CSR (la llave nunca sale de nuestras manos).' },
      { name: 'GSE', url: 'https://gse.com.co', note: 'Acreditada por ONAC desde 2008, ágil para pymes.' },
      { name: 'Certicámara', url: 'https://web.certicamara.com/servicios/firmas-digitales', note: 'La más conocida, de las cámaras de comercio.' },
      { name: 'Uanataca', url: 'https://uanataca.co', note: 'Publica precios, más pequeña.' },
      { name: 'Camerfirma / Thomas Signe', note: 'Oficinas en cámaras de comercio.' },
      {
        name: 'Revendedores',
        links: [
          { name: 'Sensiyo', url: 'https://sensiyo.co/certificados-digitales/' },
          { name: 'Puvesoft', url: 'https://www.puvesoft.com/certificados-digitales.php' },
          { name: 'POS Colombia', url: 'https://poscolombia.com/blog/certificado-digital-dian-donde-comprar-cuanto-cuesta' },
        ],
        note: 'Más baratos, pero un tercero ve la llave privada.',
      },
    ],
  },
  {
    title: 'Habilitación DIAN',
    detail: 'Portal de habilitación en modo "Software propio" y set de pruebas: 60 facturas, 20 notas crédito, 20 notas débito.',
    where: { label: 'catalogo-vpfe-hab.dian.gov.co', url: 'https://catalogo-vpfe-hab.dian.gov.co' },
    notes: [
      'Antes: registrarse como facturador electrónico con el usuario de la empresa en dian.gov.co.',
      'En el portal: Participantes → Facturador → modo de operación "Software propio".',
      'Los documentos del set se firman con el certificado .p12.',
      'Al pasar el set, el estado cambia de "Registrado" a "Habilitado".',
    ],
  },
  {
    title: 'Resolución de numeración',
    detail: 'Se pide en MUISCA: prefijo y rango de consecutivos.',
    where: { label: 'dian.gov.co → Transaccional → Usuario registrado', url: 'https://www.dian.gov.co' },
    notes: [
      'En MUISCA: Numeración de Facturación → Solicitar Numeración de Facturación.',
      'Antes de pedirla, revisar el RUT: razón social, dirección, responsabilidad de facturar y establecimientos.',
      'El prefijo es de hasta 4 letras o números.',
      'La DIAN entrega el Formato 1876 (rangos y vigencia), que se firma con la firma electrónica DIAN (IFE).',
      'Si un rango vence sin agotarse, se pide su habilitación (ampliar vigencia), no un rango nuevo.',
    ],
  },
];

const sections = [
  {
    title: 'RUT y régimen',
    questions: [
      '¿El RUT de la panadería está vigente y actualizado? ¿Qué responsabilidades tiene (48 IVA, régimen ordinario o Simple)?',
      '¿Cuál es su resolución de numeración actual en Alegra: prefijo, rango, fecha de vigencia y consecutivo en el que van? ¿Hay una resolución aparte para POS?',
      '¿El representante legal tiene su firma electrónica DIAN (IFE) activa?',
    ],
  },
  {
    title: 'Impuestos de los productos',
    questions: [
      '¿Les aplican retenciones (retefuente, reteIVA, reteICA), o se las practican sus clientes? ¿Deben aparecer en la factura?',
    ],
  },
  {
    title: 'Cuándo y a quién se factura',
    questions: [
      '¿En qué momento se debe expedir la factura: al hacer el pedido, al entregar o al cobrar?',
      '¿Qué datos del cliente deben pedirse (tipo y número de documento, correo, ciudad) en B2B y en B2C?',
      'Las ventas de mostrador: ¿van con factura de venta o con documento equivalente POS? ¿Desde qué monto, si hay uno, pueden venderse sin identificar al comprador?',
    ],
  },
  {
    title: 'Casos especiales',
    questions: [
      'Obsequios o cortesías (productos con precio 0): ¿cómo se declaran?',
      'Domicilios o envíos: ¿van aparte? ¿Cómo se facturan?',
      'Pagos parciales y ventas a crédito: ¿cómo se expresan en la factura?',
      'Devoluciones y anulaciones: ¿cuándo se hace una nota crédito y cuándo no? ¿Qué plazo hay?',
    ],
  },
  {
    title: 'Numeración y operación',
    questions: [
      '¿Qué prefijo prefieren y cuántas facturas esperan al mes? ¿Numeración separada para factura y POS?',
      '¿Cómo se están procesando actualmente las facturas de pagos de servicios y otros gastos? ¿Cómo se genera el PyG?',
      'Para que el software nuevo y Alegra convivan sin chocar, proponemos pedir una resolución nueva con un prefijo distinto. ¿Están de acuerdo? ¿Hay algún inconveniente contable en tener dos prefijos activos durante la transición?',
      '¿Cuándo quieren dejar de usar Alegra para facturar, y qué hacen con las facturas históricas que quedan allá?',
      '¿Qué hacen si no hay internet o la DIAN está caída (contingencia)?',
      '¿Cómo procesamos esas facturas una vez las hagamos?',
    ],
  },
];

// Numbering runs across sections, so each section starts where the last ended.
let n = 0;
const numbered = sections.map((s) => ({
  ...s,
  questions: s.questions.map((text) => ({ n: ++n, text })),
}));
</script>

<template>
  <div
    data-ui-theme="light"
    class="min-h-screen px-4 py-10"
    style="background: var(--ui-surface-0)"
  >
    <div class="mx-auto max-w-3xl">
      <PageHeader title="Facturación electrónica" />

      <section class="ui-card mb-10 px-6 py-6">
        <div class="ui-sectionhead" data-accent="brand">Resumen para validar</div>

        <div class="flex flex-col gap-6 text-[14.5px] leading-relaxed">
          <div>
            <div class="ui-stat-k mb-1">Objetivo</div>
            <p>
              Emitir <strong>facturas electrónicas de venta</strong> con
              <strong>software propio</strong>, sin proveedor tecnológico.
              Después, <strong>documento equivalente POS</strong>.
            </p>
          </div>

          <div>
            <div class="ui-stat-k mb-2">Trámites de la panadería (persona jurídica)</div>
            <div class="grid gap-3 sm:grid-cols-3">
              <div
                v-for="(step, i) in steps"
                :key="step.title"
                class="ui-card ui-surface-3 grid gap-1"
                style="grid-row: span 4; grid-template-rows: subgrid"
              >
                <span class="ui-ink-brand ui-num text-xl font-extrabold">{{ i + 1 }}</span>
                <span class="ui-card-title">{{ step.title }}</span>
                <span class="ui-card-body">{{ step.detail }}</span>

                <!-- Subgrid rows keep this divider on one line across the cards. -->
                <details class="mt-3 pt-3 border-t" style="border-color: var(--ui-line)">
                  <summary class="ui-stat-k cursor-pointer select-none">Dónde y cómo</summary>
                  <ul v-if="step.providers" class="mt-2 flex flex-col gap-2">
                    <li v-for="p in step.providers" :key="p.name" class="flex flex-col">
                      <a
                        v-if="p.url"
                        :href="p.url"
                        target="_blank"
                        rel="noopener"
                        class="text-[13px] font-semibold underline underline-offset-2"
                        style="text-decoration-color: var(--ui-line-strong)"
                      >{{ p.name }}</a>
                      <span v-else class="text-[13px] font-semibold">{{ p.name }}</span>
                      <span v-if="p.links" class="text-[12.5px] flex flex-wrap gap-x-2">
                        <a
                          v-for="l in p.links"
                          :key="l.url"
                          :href="l.url"
                          target="_blank"
                          rel="noopener"
                          class="underline underline-offset-2"
                          style="text-decoration-color: var(--ui-line-strong)"
                        >{{ l.name }}</a>
                      </span>
                      <span class="ui-card-body text-[12.5px]">{{ p.note }}</span>
                    </li>
                  </ul>
                  <div v-else class="mt-2 flex flex-col gap-2">
                    <a
                      :href="step.where.url"
                      target="_blank"
                      rel="noopener"
                      class="ui-ink-brand text-[13px] font-semibold underline break-words"
                    >{{ step.where.label }}</a>
                    <ul class="ui-card-body flex flex-col gap-1.5 list-disc pl-4 text-[12.5px]">
                      <li v-for="note in step.notes" :key="note">{{ note }}</li>
                    </ul>
                  </div>
                </details>
              </div>
            </div>
          </div>

          <div>
            <div class="ui-stat-k mb-2">Cómo funciona</div>
            <ul class="flex flex-col gap-2 list-disc pl-5">
              <li>
                Nuestro software genera el XML (UBL 2.1), lo firma con el
                certificado y lo envía a la DIAN, que lo acepta o lo rechaza.
              </li>
              <li>
                La DIAN actualiza el RUT en la fecha de inicio elegida y agrega la
                <strong>responsabilidad 37</strong> (obligado a facturar
                electrónicamente).
              </li>
              <li>
                Número de factura = <strong>prefijo + consecutivo</strong>, único
                por empresa. El <strong>CUFE</strong> (código único de la factura)
                es único a nivel nacional.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section v-for="s in numbered" :key="s.title" class="mb-8">
        <div class="ui-sectionhead">{{ s.title }}</div>
        <div class="flex flex-col gap-3">
          <article
            v-for="q in s.questions"
            :key="q.n"
            class="ui-card flex gap-4 items-center"
          >
            <span class="ui-ink-brand ui-num text-2xl font-extrabold w-8 shrink-0 text-right">
              {{ q.n }}
            </span>
            <p class="text-[15px] leading-relaxed font-medium">{{ q.text }}</p>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>
