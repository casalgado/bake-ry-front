<script setup>
import { ref, computed } from 'vue';
import { RouterLink } from 'vue-router';
import { PhTrash, PhX } from '@phosphor-icons/vue';
import UiSearchField from '@/components/ui/UiSearchField.vue';

/* Same local theme as the main gallery: the rest of the app has no dark styles,
 * so the flip lives on this view's wrapper and not on <html>. */
const theme = ref('light');
const toggleTheme = () => { theme.value = theme.value === 'light' ? 'dark' : 'light'; };

/* Every demo is live. A field gallery where nothing types is a screenshot, and
 * a screenshot cannot tell you the select and the input still line up. */
const demo = ref({
  name: 'Croissant de mantequilla',
  text: 'Croissant de mantequilla',
  price: 4800,
  tax: 19,
  date: '2026-09-08',
  time: '07:30',
  collection: 'panaderia',
  notes: 'Hornear la noche anterior, dejar levar 12 h.',
  search: 'Harina',
  color: '#d9842a',
  cost: 1820,
  legalName: '',
});

const invalidName = ref('');
const nameError = computed(() =>
  invalidName.value.length > 0 && invalidName.value.length < 3
    ? 'Nombre debe tener al menos 3 caracteres'
    : '',
);

/* Radio pills. The input is sr-only and the <label class="ui-btn"> next to it is
 * what you see, which is what `:checked + .ui-btn` in ui.css §11 paints. */
const inventoryMode = ref('recipe');
const INVENTORY_MODES = [
  { value: 'none', label: 'Sin control' },
  { value: 'unit', label: 'Reventa' },
  { value: 'recipe', label: 'Receta' },
];

const hasVariations = ref(false);
const isActive = ref(true);

const paymentMethods = ref(['cash']);
const PAYMENT_METHODS = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'credit', label: 'Crédito' },
];

const plan = ref('pos');
const PLANS = [
  { value: 'pos', title: 'Punto de venta', body: 'Cobra en mostrador. Cliente por defecto y fecha de hoy.' },
  { value: 'orders', title: 'Pedidos', body: 'Toma pedidos con fecha de entrega y pagos parciales.' },
];

/* The assembled form at the bottom. Reset is why it exists — a form with only
 * submit and cancel never shows what the third button is for. */
const BLANK = { name: '', price: 0, collection: '', active: true };
const form = ref({ ...BLANK });
const saved = ref('');
const submit = () => { saved.value = form.value.name || '(sin nombre)'; };
const reset = () => { form.value = { ...BLANK }; saved.value = ''; };
</script>

<template>
  <div
    class="w-full self-start min-h-screen p-8" :data-ui-theme="theme"
    style="background: var(--ui-surface-0); color: var(--ui-ink)"
  >
    <div class="max-w-5xl mx-auto flex flex-col gap-12">

      <header class="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div class="ui-stat-k">Sistema de diseño</div>
          <h1 class="text-3xl font-extrabold tracking-tight">Formularios</h1>
          <p class="ui-panehead-sub max-w-prose mt-1">
            Las clases de campo viven en <code>assets/ui/ui.css</code> §12, junto a
            los inputs que ya existían. Los botones no cambian: son los mismos de
            <RouterLink class="underline" :to="{ name: 'system-admin-ux' }">la galería principal</RouterLink>,
            con un estado <code>seleccionado</code> nuevo.
          </p>
        </div>
        <button class="ui-btn" @click="toggleTheme">
          {{ theme === 'light' ? 'Ver oscuro' : 'Ver claro' }}
        </button>
      </header>

      <!-- ---------- anatomy ---------- -->
      <section class="flex flex-col gap-4">
        <h2 class="ui-sectionhead">1 · Anatomía de un campo</h2>
        <div class="grid md:grid-cols-2 gap-6">
          <div class="ui-card">
            <div class="ui-card-title">Etiqueta, campo, ayuda</div>
            <p class="ui-card-body mb-3">
              <code>ui-field</code> es un <code>&lt;div&gt;</code> y la etiqueta
              lleva <code>for</code>. Envolver el input en el
              <code>&lt;label&gt;</code> ahorraba el <code>id</code>, pero el
              nombre accesible del campo se arma con <b>todo</b> lo que hay
              dentro de la etiqueta: la ayuda de abajo terminaba pegada al
              nombre. Con <code>for</code>/<code>id</code> el nombre es solo
              «Nombre», y la ayuda se ata aparte con
              <code>aria-describedby</code>.
            </p>
            <div class="ui-field">
              <label class="ui-field-k" for="f-nombre" data-required>Nombre</label>
              <input
                id="f-nombre" v-model="demo.name" class="ui-input"
                required aria-describedby="f-nombre-h"
              >
              <span id="f-nombre-h" class="ui-field-hint">
                Como aparece en el pedido y en la factura.
              </span>
            </div>
          </div>

          <div class="ui-card">
            <div class="ui-card-title">Con error</div>
            <p class="ui-card-body mb-3">
              El borde se marca con <code>aria-invalid</code>, no con una clase:
              es lo que lee un lector de pantalla, así que estilo y anuncio no
              pueden separarse. El texto reemplaza a la ayuda, nunca se suman, y
              el mismo <code>id</code> sirve para los dos.
            </p>
            <div class="ui-field">
              <label class="ui-field-k" for="f-error" data-required>Nombre</label>
              <input
                id="f-error" v-model="invalidName" class="ui-input"
                required :aria-invalid="!!nameError" aria-describedby="f-error-h"
                placeholder="Escribe una o dos letras"
              >
              <span v-if="nameError" id="f-error-h" class="ui-field-error">{{ nameError }}</span>
              <span v-else id="f-error-h" class="ui-field-hint">Mínimo 3 caracteres.</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ---------- the family ---------- -->
      <section class="flex flex-col gap-4">
        <h2 class="ui-sectionhead">2 · La familia</h2>
        <div class="ui-card">
          <p class="ui-card-body mb-4 max-w-prose">
            Un solo <code>ui-input</code> para texto, correo, teléfono, número,
            fecha, hora y <code>&lt;select&gt;</code>. La altura está fija en 32px
            justamente para esto: un select con su flecha nativa se mide solo y
            quedaba 4px más alto que el input de al lado.
          </p>

          <div class="grid md:grid-cols-3 gap-3">
            <div class="ui-field">
              <label class="ui-field-k" for="f-texto">Texto</label>
              <input id="f-texto" v-model="demo.text" class="ui-input" >
            </div>
            <div class="ui-field">
              <label class="ui-field-k" for="f-fecha">Fecha</label>
              <input id="f-fecha" v-model="demo.date" type="date" class="ui-input" >
            </div>
            <div class="ui-field">
              <label class="ui-field-k" for="f-hora">Hora</label>
              <input id="f-hora" v-model="demo.time" type="time" class="ui-input" >
            </div>
            <div class="ui-field">
              <label class="ui-field-k" for="f-categoria">Categoría</label>
              <select id="f-categoria" v-model="demo.collection" class="ui-input">
                <option value="panaderia">Panadería</option>
                <option value="pasteleria">Pastelería</option>
                <option value="cafeteria">Cafetería</option>
              </select>
            </div>
            <div class="ui-field">
              <label class="ui-field-k" for="f-precio">Precio</label>
              <div class="ui-field-unit" data-unit="$">
                <input id="f-precio" v-model.number="demo.price" type="number" class="ui-input ui-input-num" >
              </div>
            </div>
            <div class="ui-field">
              <label class="ui-field-k" for="f-impuesto">Impuesto</label>
              <div class="ui-field-unit" data-unit="%">
                <input id="f-impuesto" v-model.number="demo.tax" type="number" class="ui-input ui-input-num" >
              </div>
            </div>
          </div>

          <div class="grid md:grid-cols-3 gap-3 mt-3">
            <div class="ui-field md:col-span-2">
              <label class="ui-field-k" for="f-notas">Comentarios</label>
              <textarea
                id="f-notas" v-model="demo.notes"
                class="ui-input ui-input-area" aria-describedby="f-notas-h"
              />
              <span id="f-notas-h" class="ui-field-hint">
                <code>ui-input-area</code> suelta la altura fija y el peso 600 —
                esto es prosa, no un valor en una columna.
              </span>
            </div>
            <div class="flex flex-col gap-3">
              <!-- Un <span>, no un <label>: UiSearchField ya se nombra solo con
                   su propio aria-label, y dos nombres compiten. -->
              <div class="ui-field">
                <span class="ui-field-k">Buscar</span>
                <UiSearchField v-model="demo.search" />
              </div>
              <div class="ui-field">
                <label class="ui-field-k" for="f-color">Color</label>
                <input id="f-color" v-model="demo.color" type="color" class="ui-swatch" >
              </div>
            </div>
          </div>

          <p class="ui-card-body mt-4 max-w-prose">
            La unidad se pone por instancia:
            <code>&lt;div class="ui-field-unit" data-unit="$"&gt;</code>. Va al
            final del campo, igual que el <code>input-with-unit</code> viejo que
            reemplaza, para que migrar un formulario sea cambiar la clase y nada
            más.
          </p>
        </div>
      </section>

      <!-- ---------- states ---------- -->
      <section class="flex flex-col gap-4">
        <h2 class="ui-sectionhead">3 · Estados</h2>
        <div class="ui-card">
          <p class="ui-card-body mb-4 max-w-prose">
            <b class="font-semibold" style="color: var(--ui-ink)">Bloqueado</b> y
            <b class="font-semibold" style="color: var(--ui-ink)">inhabilitado</b>
            se parecen y no significan lo mismo. Bloqueado es un número que alguien
            más calcula: sigue vigente y vale la pena leerlo, así que conserva la
            tinta completa. Inhabilitado es un campo que no aplica ahora mismo: no
            hay nada que leer, así que se apaga.
          </p>
          <div class="grid md:grid-cols-3 gap-3">
            <div class="ui-field">
              <label class="ui-field-k" for="f-costo">Costo</label>
              <div class="ui-field-unit" data-unit="$">
                <input
                  id="f-costo" v-model.number="demo.cost"
                  class="ui-input ui-input-num" readonly aria-describedby="f-costo-h"
                >
              </div>
              <span id="f-costo-h" class="ui-field-hint">Calculado desde la receta.</span>
            </div>
            <div class="ui-field">
              <label class="ui-field-k" for="f-razon">Razón social</label>
              <input
                id="f-razon" v-model="demo.legalName" class="ui-input"
                disabled placeholder="Solo para empresas" aria-describedby="f-razon-h"
              >
              <span id="f-razon-h" class="ui-field-hint">No aplica a una persona.</span>
            </div>
            <div class="ui-field">
              <label class="ui-field-k" for="f-precio-mal">Precio</label>
              <div class="ui-field-unit" data-unit="$">
                <input
                  id="f-precio-mal" class="ui-input ui-input-num" value="0"
                  aria-invalid="true" aria-describedby="f-precio-mal-e"
                >
              </div>
              <span id="f-precio-mal-e" class="ui-field-error">Precio base es requerido</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ---------- choice ---------- -->
      <section class="flex flex-col gap-4">
        <h2 class="ui-sectionhead">4 · Elegir</h2>

        <div class="grid md:grid-cols-2 gap-6">
          <div class="ui-card">
            <div class="ui-card-title">Una de varias</div>
            <p class="ui-card-body mb-3">
              Un <code>&lt;input type="radio"&gt;</code> con <code>sr-only</code> y
              un <code>&lt;label class="ui-btn"&gt;</code> al lado. Lo pinta
              <code>:checked + .ui-btn</code>, no <code>peer-checked:</code>: esa
              utilidad solo aplica clases sueltas y aquí se mueven tres
              propiedades juntas.
            </p>
            <div class="flex flex-wrap gap-1.5">
              <div v-for="m in INVENTORY_MODES" :key="m.value">
                <input
                  :id="`mode-${m.value}`" v-model="inventoryMode" class="sr-only"
                  type="radio" name="inventory-mode" :value="m.value"
                >
                <label class="ui-btn" :for="`mode-${m.value}`">{{ m.label }}</label>
              </div>
            </div>

            <p class="ui-card-body mt-4 mb-3">
              A ancho completo es el mismo marcado dentro de un
              <code>grid</code>. La forma la pone el llamador; la clase solo pinta.
            </p>
            <div class="grid grid-cols-3 gap-1.5">
              <div v-for="m in INVENTORY_MODES" :key="m.value">
                <input
                  :id="`mode2-${m.value}`" v-model="inventoryMode" class="sr-only"
                  type="radio" name="inventory-mode-2" :value="m.value"
                >
                <label class="ui-btn justify-center w-full" :for="`mode2-${m.value}`">{{ m.label }}</label>
              </div>
            </div>
          </div>

          <div class="ui-card">
            <div class="ui-card-title">Sí o no</div>
            <p class="ui-card-body mb-3">
              Dos opciones excluyentes siguen siendo radios. El botón suelto de
              abajo es otra cosa: se prende y se apaga solo, y eso es
              <code>aria-pressed</code>.
            </p>
            <div class="flex items-center gap-3 flex-wrap">
              <span class="ui-check-k">¿Tiene variaciones?</span>
              <div class="flex gap-1.5">
                <div v-for="o in [{ v: false, l: 'No' }, { v: true, l: 'Sí' }]" :key="o.l">
                  <input
                    :id="`var-${o.l}`" v-model="hasVariations" class="sr-only"
                    type="radio" name="has-variations" :value="o.v"
                  >
                  <label class="ui-btn w-12 justify-center" :for="`var-${o.l}`">{{ o.l }}</label>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-3 mt-4">
              <span class="ui-check-k">Producto activo</span>
              <button class="ui-btn" :aria-pressed="isActive" @click="isActive = !isActive">
                {{ isActive ? 'Activo' : 'Inactivo' }}
              </button>
            </div>

            <p class="ui-card-body mt-4 mb-3">
              Varias a la vez, independientes: casillas de verdad.
              Una tira de píldoras aquí leería como una sola elección.
            </p>
            <div class="flex flex-col gap-2">
              <label v-for="p in PAYMENT_METHODS" :key="p.value" class="flex items-center gap-2">
                <input v-model="paymentMethods" class="ui-check" type="checkbox" :value="p.value" >
                <span class="ui-check-k">{{ p.label }}</span>
              </label>
            </div>
          </div>
        </div>

        <div class="ui-card">
          <div class="ui-card-title">Una tarjeta entera como opción</div>
          <p class="ui-card-body mb-3 max-w-prose">
            Cuando la opción necesita explicarse. Mismo mecanismo,
            <code>:checked + .ui-card</code> — y pinta fondo y borde nada más: si
            tocara <code>color</code>, todo el texto de la tarjeta se volvería
            naranja.
          </p>
          <div class="grid md:grid-cols-2 gap-3">
            <div v-for="p in PLANS" :key="p.value">
              <input
                :id="`plan-${p.value}`" v-model="plan" class="sr-only"
                type="radio" name="plan" :value="p.value"
              >
              <label class="ui-card ui-card-action block" :for="`plan-${p.value}`">
                <div class="ui-card-title">{{ p.title }}</div>
                <p class="ui-card-body mt-1">{{ p.body }}</p>
              </label>
            </div>
          </div>
        </div>
      </section>

      <!-- ---------- assembled ---------- -->
      <section class="flex flex-col gap-4">
        <h2 class="ui-sectionhead">5 · Un formulario completo</h2>
        <div class="ui-card">
          <p class="ui-card-body mb-4 max-w-prose">
            Los cuatro botones que necesita cualquier formulario, y ninguno más.
            <b class="font-semibold" style="color: var(--ui-ink)">Guardar</b> es el
            único sólido: es a lo que viniste.
            <b class="font-semibold" style="color: var(--ui-ink)">Cancelar</b> y
            <b class="font-semibold" style="color: var(--ui-ink)">Limpiar</b> son
            <code>ui-btn-danger</code> en contorno: te vas del formulario o borras
            lo que escribiste.
            <b class="font-semibold" style="color: var(--ui-ink)">Eliminar</b> es
            <code>ui-btn-danger ui-btn-solid</code> — contorno contra sólido separa
            «salir» de «borrar el producto guardado», el color es el mismo.
          </p>

          <form class="flex flex-col gap-3" @submit.prevent="submit">
            <div class="grid md:grid-cols-3 gap-3">
              <div class="ui-field md:col-span-2">
                <label class="ui-field-k" for="f-form-nombre" data-required>Nombre</label>
                <input id="f-form-nombre" v-model="form.name" class="ui-input" required >
              </div>
              <div class="ui-field">
                <label class="ui-field-k" for="f-form-precio">Precio</label>
                <div class="ui-field-unit" data-unit="$">
                  <input id="f-form-precio" v-model.number="form.price" type="number" class="ui-input ui-input-num" >
                </div>
              </div>
            </div>

            <div class="flex items-center justify-between gap-4 flex-wrap pt-1">
              <label class="flex items-center gap-2">
                <input v-model="form.active" class="ui-check" type="checkbox" >
                <span class="ui-check-k">Producto activo</span>
              </label>

              <div class="flex gap-2">
                <button class="ui-btn ui-btn-danger ui-btn-icon" type="button" aria-label="Eliminar">
                  <PhTrash :size="14" weight="bold" />
                </button>
                <button class="ui-btn ui-btn-danger" type="button" @click="reset">Limpiar</button>
                <button class="ui-btn ui-btn-danger" type="button">Cancelar</button>
                <button class="ui-btn ui-btn-solid" type="submit">Guardar</button>
              </div>
            </div>
          </form>

          <div v-if="saved" class="ui-item ui-item-filled mt-3">
            <span class="ui-tag" data-accent="leaf">ok</span>
            <span class="ui-item-title">Guardado: {{ saved }}</span>
            <span class="ui-item-trail">
              <button class="ui-btn ui-btn-icon" aria-label="Cerrar" @click="saved = ''">
                <PhX :size="12" weight="bold" />
              </button>
            </span>
          </div>
        </div>
      </section>

    </div>
  </div>
</template>

<style scoped>
code {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.9em;
}
</style>
