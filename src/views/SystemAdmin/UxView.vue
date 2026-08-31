<script setup>
import { ref, computed } from 'vue';
import { PhFlask, PhPackage, PhX, PhArrowDown } from '@phosphor-icons/vue';

/* The theme lives on this view's wrapper, not on <html>: the rest of the app
 * has no dark styles yet, so flipping globally would only half-work. */
const theme = ref('light');
const toggleTheme = () => { theme.value = theme.value === 'light' ? 'dark' : 'light'; };

const surfaces = ['surface-0', 'surface-1', 'surface-2', 'surface-3'];
const lines = ['line', 'line-strong'];
const inks = ['ink', 'ink-muted'];
const brand = ['brand', 'brand-ink', 'brand-soft', 'danger', 'danger-ink', 'danger-soft'];
const accents = ['berry', 'plum', 'violet', 'sky', 'leaf', 'lime'];

const activeTab = ref('bodega');
const tabs = [
  { id: 'bodega', label: 'Bodega' },
  { id: 'ingreso', label: 'Ingreso', badge: '3', dirty: true, closable: true },
  { id: 'conteo', label: 'Conteo', badge: '34/60', dirty: true, closable: true },
];
const selectedItem = ref('harina');
const dragOver = ref(false);
const counted = ref(4);

const stock = [
  { id: 'harina', name: 'Harina de trigo', qty: '12.4', unit: 'kg', value: '$43,400' },
  { id: 'azucar', name: 'Azúcar', qty: '3', unit: 'kg', value: '$12,600' },
  { id: 'manteq', name: 'Mantequilla', qty: '0', unit: 'kg', value: '$0', state: 'zero' },
  { id: 'levadura', name: 'Levadura fresca', qty: '-0.3', unit: 'kg', value: '-$4,200', state: 'negative' },
];

const itemClass = (state) => ({
  'ui-item-zero': state === 'zero',
  'ui-item-negative': state === 'negative',
});

const pips = computed(() => [true, true, true, true, false, false]);
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
          <h1 class="text-3xl font-extrabold tracking-tight">ui-*</h1>
          <p class="ui-panehead-sub max-w-prose mt-1">
            Tokens en <code>assets/ui/tokens.css</code>, clases en <code>assets/ui/ui.css</code>.
            Tailwind sigue mandando en el acomodo (flex, gap, padding); estas clases solo mandan
            en el color y la forma.
          </p>
        </div>
        <button class="ui-btn" @click="toggleTheme">
          {{ theme === 'light' ? 'Ver oscuro' : 'Ver claro' }}
        </button>
      </header>

      <!-- ---------- tokens ---------- -->
      <section class="flex flex-col gap-6">
        <h2 class="ui-sectionhead">Tokens</h2>

        <div class="flex flex-col gap-5">
          <div v-for="(group, label) in { Superficies: surfaces, Líneas: lines, Texto: inks, Marca: brand, Acentos: accents }" :key="label">
            <div class="ui-stat-k mb-2">{{ label }}</div>
            <div class="flex flex-wrap gap-3">
              <div v-for="name in group" :key="name" class="flex flex-col gap-1.5">
                <div
                  class="w-28 h-14 rounded-lg border"
                  :style="{ background: `var(--ui-${name})`, borderColor: 'var(--ui-line)' }"
                />
                <code class="text-[11px] ui-panehead-sub">--ui-{{ name }}</code>
              </div>
              <div v-if="label === 'Acentos'" class="flex flex-wrap gap-3">
                <div v-for="name in group" :key="`${name}-soft`" class="flex flex-col gap-1.5">
                  <div
                    class="w-28 h-14 rounded-lg border"
                    :style="{ background: `var(--ui-${name}-soft)`, borderColor: 'var(--ui-line)' }"
                  />
                  <code class="text-[11px] ui-panehead-sub">--ui-{{ name }}-soft</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ---------- shell ---------- -->
      <section class="flex flex-col gap-4">
        <h2 class="ui-sectionhead">1—3 · Pestañas, paneles y encabezado</h2>
        <div class="ui-app">
          <div class="ui-tabs" role="tablist">
            <div
              v-for="t in tabs" :key="t.id"
              class="ui-tab" role="tab" tabindex="0"
              :aria-selected="activeTab === t.id"
              @click="activeTab = t.id"
              @keydown.enter="activeTab = t.id"
              @keydown.space.prevent="activeTab = t.id"
            >
              {{ t.label }}
              <span v-if="t.badge" class="ui-tab-badge">{{ t.badge }}</span>
              <span v-if="t.dirty" class="ui-tab-dot" />
              <button
                v-if="t.closable" class="ui-tab-close"
                :aria-label="`Cerrar ${t.label}`" @click.stop
              >
                <PhX :size="11" weight="bold" />
              </button>
            </div>
          </div>
          <div class="ui-panes" style="--panes: minmax(0, 1.15fr) minmax(0, 0.85fr)">
            <div class="ui-pane">
              <div class="ui-panehead">
                <span class="ui-panehead-title">Lo que estás llenando</span>
                <span class="ui-panehead-sub">izquierda</span>
              </div>
              <p class="ui-panehead-sub">
                El panel izquierdo siempre es la cosa que construyes.
              </p>
            </div>
            <div class="ui-pane ui-pane-sunken">
              <div class="ui-panehead">
                <span class="ui-panehead-title">De donde sacas</span>
                <span class="ui-panehead-sub">derecha</span>
              </div>
              <p class="ui-panehead-sub">
                El derecho siempre es de donde tomas. Un paso atrás en superficie.
              </p>
            </div>
          </div>
        </div>
        <p class="ui-panehead-sub">
          Tres columnas 1:2:2 es el mismo componente con un tercer hijo y
          <code>--panes: 1fr 2fr 2fr</code>.
        </p>
      </section>

      <!-- ---------- item ---------- -->
      <section class="flex flex-col gap-4">
        <h2 class="ui-sectionhead">5 · Item</h2>
        <div class="grid md:grid-cols-2 gap-6">

          <div class="ui-card">
            <div class="ui-card-title">Con número y valor</div>
            <div class="flex flex-col gap-1 mt-2">
              <button
                v-for="it in stock" :key="it.id"
                class="ui-item" :class="itemClass(it.state)"
                :aria-current="selectedItem === it.id"
                @click="selectedItem = it.id"
              >
                <span class="ui-item-icon"><PhPackage :size="16" /></span>
                <span class="ui-item-title">{{ it.name }}</span>
                <span class="ui-item-trail">
                  <span class="ui-item-num">{{ it.qty }}<span class="ui-unit">{{ it.unit }}</span></span>
                  <span class="ui-item-meta w-20 text-right">{{ it.value }}</span>
                </span>
              </button>
            </div>
          </div>

          <div class="ui-card">
            <div class="ui-card-title">Con descripción y pips</div>
            <div class="flex flex-col gap-1 mt-2">
              <button class="ui-item">
                <span class="ui-item-icon"><PhFlask :size="16" /></span>
                <span>
                  <span class="ui-item-title block">Torta de chocolate</span>
                  <span class="ui-item-desc">4 de 6 combinaciones con receta</span>
                </span>
                <span class="ui-item-trail">
                  <span class="ui-pips">
                    <span v-for="(on, i) in pips" :key="i" class="ui-pip" :class="{ 'ui-pip-on': on }" />
                  </span>
                  <span class="ui-item-meta">4/6</span>
                </span>
              </button>
              <button class="ui-item">
                <span class="ui-item-icon"><PhFlask :size="16" /></span>
                <span>
                  <span class="ui-item-title block">Croissant</span>
                  <span class="ui-item-desc">sin variaciones</span>
                </span>
                <span class="ui-item-trail">
                  <span class="ui-pips"><span class="ui-pip ui-pip-on" /></span>
                  <span class="ui-item-meta">1/1</span>
                </span>
              </button>
            </div>
          </div>

          <div class="ui-card">
            <div class="ui-card-title">Como historial, dividido</div>
            <div class="flex flex-col mt-2">
              <div v-for="m in [
                { d: '26 ago', why: 'Ingreso · Molinos del Valle', q: '+10' },
                { d: '25 ago', why: 'Producción · pan campesino', q: '-1.2' },
                { d: '24 ago', why: 'Merma · bulto roto', q: '-0.4' },
              ]" :key="m.why" class="ui-item ui-item-divided">
                <span class="ui-item-meta w-12">{{ m.d }}</span>
                <span class="ui-item-title font-normal">{{ m.why }}</span>
                <span class="ui-item-trail">
                  <span class="ui-item-num">{{ m.q }}<span class="ui-unit">kg</span></span>
                </span>
              </div>
            </div>
          </div>

          <div class="ui-card">
            <div class="ui-card-title">Como línea editable</div>
            <div class="flex flex-col gap-1 mt-2">
              <div v-for="l in ['Harina de trigo', 'Mantequilla']" :key="l" class="ui-item">
                <span class="ui-item-icon"><PhPackage :size="16" /></span>
                <span>
                  <span class="ui-item-title block">{{ l }}</span>
                  <span class="ui-item-desc">en bodega 12.4 kg</span>
                </span>
                <span class="ui-item-trail">
                  <input class="ui-input ui-input-num w-20" value="4" >
                  <button class="ui-btn ui-btn-icon ui-btn-danger"><PhX :size="12" weight="bold" /></button>
                </span>
              </div>
            </div>
          </div>

        </div>
      </section>

      <!-- ---------- card ---------- -->
      <section class="flex flex-col gap-4">
        <h2 class="ui-sectionhead">6 · Card</h2>
        <div class="grid md:grid-cols-3 gap-4">
          <div class="ui-card">
            <div class="ui-card-title">Simple</div>
            <p class="ui-card-body">Título y cuerpo. Estático, no levanta.</p>
          </div>
          <button class="ui-card ui-card-action text-left">
            <div class="ui-card-title">Accionable</div>
            <p class="ui-card-body">Al pasar sube un escalón de superficie. Nada se mueve.</p>
          </button>
          <div class="ui-card ui-card-flush">
            <div>
              <div class="ui-card-title">Con imagen</div>
              <p class="ui-card-sub">El título manda; la media va al ras debajo.</p>
            </div>
            <div class="ui-card-media mt-3" />
          </div>
          <div class="ui-card">
            <div class="ui-card-title">Con filas adentro</div>
            <p class="ui-card-sub">Dos combinaciones costeadas</p>
            <div class="flex flex-col mt-2">
              <div v-for="r in ['500 g', '1000 g']" :key="r" class="ui-item ui-item-divided">
                <span />
                <span class="ui-item-title">{{ r }}</span>
                <span class="ui-item-trail"><span class="ui-item-meta">$12,800</span></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ---------- chip, tag ---------- -->
      <section class="flex flex-col gap-4">
        <h2 class="ui-sectionhead">7—8 · Chip y tag</h2>
        <div class="grid md:grid-cols-2 gap-6">
          <div class="ui-card">
            <div class="ui-card-title">Chips</div>
            <p class="ui-card-body mb-3">Cosas que se levantan y se sueltan.</p>
            <div class="flex flex-wrap gap-1.5">
              <div class="ui-chip ui-chip-draggable">
                <span>Harina de trigo</span><span class="ui-chip-meta">12.4 kg</span>
              </div>
              <div class="ui-chip ui-chip-draggable">
                <span>Crema pastelera</span><span class="ui-chip-meta">2.1 kg</span>
              </div>
              <div class="ui-chip ui-chip-draggable">
                <span>Croissant</span><span class="ui-chip-meta">18 und</span>
              </div>
              <div class="ui-chip ui-chip-draggable ui-chip-dragging">
                <span>Arrastrando</span><span class="ui-chip-meta">0.6 kg</span>
              </div>
            </div>
          </div>
          <div class="ui-card">
            <div class="ui-card-title">Tags</div>
            <p class="ui-card-body mb-3">Una palabra sobre algo. Nunca se clickean.</p>
            <div class="flex flex-wrap gap-1.5">
              <span class="ui-tag">neutro</span>
              <span class="ui-tag" data-accent="brand">brand</span>
              <span v-for="a in accents" :key="a" class="ui-tag" :data-accent="a">{{ a }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ---------- stat, bar, pips ---------- -->
      <section class="flex flex-col gap-4">
        <h2 class="ui-sectionhead">9—10 · Stat, barra y pips</h2>
        <div class="grid md:grid-cols-2 gap-6">
          <div class="ui-card flex flex-row flex-wrap gap-x-10 gap-y-4">
            <div class="ui-stat ui-stat-hero">
              <span class="ui-stat-k">Valor en bodega</span>
              <span class="ui-stat-v">$1,284,600</span>
            </div>
            <div class="ui-stat">
              <span class="ui-stat-k">Costo</span>
              <span class="ui-stat-v">$3,500</span>
            </div>
            <div class="ui-stat">
              <span class="ui-stat-k">Margen</span>
              <span class="ui-stat-v">62%</span>
            </div>
          </div>
          <div class="ui-card flex flex-col gap-5">
            <div>
              <div class="ui-bar" :style="{ '--fill': `${(counted / 6) * 100}%` }" />
              <div class="flex justify-between mt-2">
                <span class="ui-panehead-sub">Items contados</span>
                <span class="ui-item-meta"><b class="ui-num">{{ counted }}</b> / 6</span>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="ui-pips">
                <span v-for="i in 6" :key="i" class="ui-pip" :class="{ 'ui-pip-on': i <= counted }" />
              </span>
              <button class="ui-btn ui-btn-icon" @click="counted = Math.max(0, counted - 1)">−</button>
              <button class="ui-btn ui-btn-icon" @click="counted = Math.min(6, counted + 1)">+</button>
            </div>
          </div>
        </div>
      </section>

      <!-- ---------- buttons, inputs ---------- -->
      <section class="flex flex-col gap-4">
        <h2 class="ui-sectionhead">11—12 · Botones y campos</h2>
        <div class="grid md:grid-cols-2 gap-6">
          <div class="ui-card">
            <div class="ui-card-title">Botones</div>
            <p class="ui-card-body mb-3">Uno sólido por grupo: lo que viniste a hacer.</p>
            <div class="flex flex-wrap gap-2">
              <button class="ui-btn ui-btn-solid"><PhArrowDown :size="14" /> Ingreso</button>
              <button class="ui-btn">Producción</button>
              <button class="ui-btn">Conteo</button>
              <button class="ui-btn">Cancelar</button>
              <button class="ui-btn ui-btn-icon"><PhX :size="14" weight="bold" /></button>
              <button class="ui-btn" disabled>Confirmar</button>
            </div>
            <p class="ui-card-body mt-4 mb-3">
              <code>ui-btn-danger</code> solo intercambia el color; se combina con
              sólido e ícono.
            </p>
            <div class="flex flex-wrap gap-2">
              <button class="ui-btn ui-btn-danger">Eliminar</button>
              <button class="ui-btn ui-btn-danger ui-btn-solid">Eliminar bodega</button>
              <button class="ui-btn ui-btn-danger ui-btn-icon"><PhX :size="14" weight="bold" /></button>
            </div>
          </div>
          <div class="ui-card">
            <div class="ui-card-title">Campos</div>
            <p class="ui-card-body mb-3">La etiqueta va arriba; el input se queda con todo el ancho.</p>
            <div class="grid grid-cols-2 gap-3 mb-3">
              <label class="ui-field">
                <span class="ui-field-k">Fecha</span>
                <input class="ui-input" value="27 ago 2026" >
              </label>
              <label class="ui-field">
                <span class="ui-field-k">Proveedor</span>
                <input class="ui-input" value="Molinos del Valle" >
              </label>
            </div>
            <div class="flex gap-2">
              <input class="ui-input ui-input-num w-24" value="12.4" >
              <input class="ui-input w-40" placeholder="Buscar…" >
            </div>
          </div>
        </div>
      </section>

      <!-- ---------- dropzone, empty ---------- -->
      <section class="flex flex-col gap-4">
        <h2 class="ui-sectionhead">13—14 · Zona de suelta y vacío</h2>
        <div class="grid md:grid-cols-2 gap-6">
          <div
            class="ui-dropzone" :class="{ 'ui-dropzone-over': dragOver }"
            @mouseenter="dragOver = true" @mouseleave="dragOver = false"
          >
            <div class="ui-empty">
              <b>Arrastra lo que llegó</b>
              Pasa el mouse por encima para ver el estado activo.
            </div>
          </div>
          <div class="ui-dropzone">
            <div class="flex flex-col gap-1.5">
              <div v-for="l in ['Harina de trigo', 'Azúcar']" :key="l" class="ui-item" style="background: var(--ui-surface-2); border-color: var(--ui-line)">
                <span class="ui-item-icon"><PhPackage :size="16" /></span>
                <span class="ui-item-title">{{ l }}</span>
                <span class="ui-item-trail"><span class="ui-item-num">4<span class="ui-unit">kg</span></span></span>
              </div>
            </div>
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
