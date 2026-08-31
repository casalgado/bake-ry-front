<script setup>
import { ref, computed, onMounted } from 'vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import { useProductStore } from '@/stores/productStore';
import { formatMoney } from '@/utils/helpers';
import { PhFlask, PhX } from '@phosphor-icons/vue';

const productStore = useProductStore();
const search = ref('');
const selectedId = ref(null);

/* Tab ids are plain strings: 'overview' plus one combination id each. A tab
 * carries productId/comboId rather than the objects themselves, so it survives
 * a refetch and doesn't pin a stale copy of the product. */
const activeTab = ref('overview');
const tabs = ref([{ id: 'overview', label: 'Recetario' }]);

/* fetchAll rethrows after storing the message on the store, so the .catch is
 * what keeps it from becoming an unhandled rejection. The error is rendered,
 * not swallowed: without it a failed fetch reads as "no tienes productos". */
onMounted(() => productStore.fetchAll().catch(() => {}));

/* A product without variations is one combination: itself. That keeps every
 * count below a plain sum instead of two branches everywhere. */
const combosOf = (p) =>
  p.hasVariations ? (p.variations?.combinations ?? []) : [p];

const coveredOf = (p) => combosOf(p).filter((c) => c.recipeId).length;

/* A product standing in for its own combination has no `name`, so fall back to
 * the product's. Same reason combosOf can return the product itself. */
const comboName = (combo, product) => combo.name || product?.name || '';

/* basePrice is what the rest of the app reads (ShowProducts.vue), and the store
 * hands back raw Firestore docs, so currentPrice is simply missing on anything
 * not re-saved since it was added. basePrice first, currentPrice as the
 * fallback, or those rows render as $0. */
const priceOf = (c) => c.basePrice || c.currentPrice || 0;

const marginOf = (c) => {
  const price = priceOf(c);
  return price > 0 ? Math.round((price - c.costPrice) / price * 100) : null;
};

const products = computed(() => {
  const q = search.value.trim().toLowerCase();
  return productStore.items
    .filter((p) => !q || p.name.includes(q))
    .sort((a, b) =>
      (a.collectionName || '').localeCompare(b.collectionName || '') ||
      a.name.localeCompare(b.name),
    );
});

/* Grouped for rendering only — the sectionhead needs the boundary, and a
 * template can't see the previous row. */
const groups = computed(() =>
  products.value.reduce((acc, p) => {
    const key = p.collectionName || 'Sin colección';
    const last = acc.at(-1);
    if (last?.name === key) last.items.push(p);
    else acc.push({ name: key, items: [p] });
    return acc;
  }, []),
);

const totalCombos = computed(() =>
  products.value.reduce((n, p) => n + combosOf(p).length, 0));
const totalCovered = computed(() =>
  products.value.reduce((n, p) => n + coveredOf(p), 0));

/* Resolved off productStore.items for the same reason as `builder` below:
 * typing in the search box must not blank the pane you are looking at. */
const selected = computed(() =>
  productStore.items.find((p) => p.id === selectedId.value) ?? null);

function openCombination(product, combo) {
  if (!tabs.value.some((t) => t.id === combo.id)) {
    tabs.value.push({
      id: combo.id,
      label: comboName(combo, product),
      closable: true,
      productId: product.id,
      comboId: combo.id,
    });
  }
  activeTab.value = combo.id;
}

function closeTab(id) {
  tabs.value = tabs.value.filter((t) => t.id !== id);
  if (activeTab.value === id) activeTab.value = 'overview';
}

/* Resolved off productStore.items, not the filtered list: typing in the search
 * box must not blank an open builder. */
const builder = computed(() => {
  const tab = tabs.value.find((t) => t.id === activeTab.value);
  if (!tab?.comboId) return null;

  const product = productStore.items.find((p) => p.id === tab.productId);
  const combo = product && combosOf(product).find((c) => c.id === tab.comboId);
  return combo ? { product, combo } : null;
});
</script>

<template>
  <!-- The dashboard shell paints neutral-150; this view paints its own ground so
       the ui-* surface ladder starts where the tokens expect it to. -->
  <div
    class="w-full self-start min-h-full p-4 lg:p-6"
    data-ui-theme="light"
    style="background: var(--ui-surface-0); color: var(--ui-ink)"
  >
    <PageHeader title="Recetario" />

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
          <span class="capitalize">{{ t.label }}</span>
          <button
            v-if="t.closable" class="ui-tab-close"
            :aria-label="'Cerrar ' + t.label"
            @click.stop="closeTab(t.id)"
          >
            <PhX :size="11" weight="bold" />
          </button>
        </div>
      </div>

      <!-- Recetario: products left, their combinations right. -->
      <div
        v-if="activeTab === 'overview'"
        class="ui-panes" style="--panes: minmax(0, 1fr) minmax(0, 1.1fr)"
      >
        <div class="ui-pane">
          <div class="ui-panehead">
            <span class="ui-panehead-title">Productos</span>
            <span class="ui-panehead-sub">{{ products.length }} productos</span>
          </div>

          <div class="ui-search mb-3">
            <input
              v-model="search"
              class="ui-input"
              type="text"
              role="searchbox"
              enterkeyhint="search"
              placeholder="Buscar producto…"
              aria-label="Buscar producto"
              @keydown.esc="search = ''"
            >
            <button
              v-if="search"
              class="ui-search-clear"
              type="button"
              aria-label="Limpiar búsqueda"
              @click="search = ''"
            >
              <PhX :size="12" weight="bold" />
            </button>
          </div>

          <div class="mb-4">
            <div
              class="ui-bar"
              :style="{ '--fill': totalCombos ? Math.round(totalCovered / totalCombos * 100) + '%' : '0%' }"
            />
            <div class="flex items-baseline justify-between gap-3 mt-1.5 ui-panehead-sub">
              <span>Combinaciones con receta</span>
              <b class="ui-num">{{ totalCovered }} / {{ totalCombos }}</b>
            </div>
          </div>

          <div v-if="productStore.loading" class="ui-empty">Cargando productos…</div>
          <div v-else-if="productStore.error" class="ui-empty">
            <b>No se pudieron cargar los productos</b>
            {{ productStore.error }}
          </div>
          <div v-else-if="!products.length" class="ui-empty">
            <b>Sin productos</b>
            {{ search ? 'Nada coincide con la búsqueda.' : 'Crea un producto para empezar.' }}
          </div>

          <div v-for="g in groups" :key="g.name" class="mb-3">
            <div class="ui-sectionhead capitalize">{{ g.name }}</div>
            <button
              v-for="p in g.items" :key="p.id"
              class="ui-item"
              :aria-current="selectedId === p.id"
              @click="selectedId = p.id"
            >
              <span class="ui-item-icon"><PhFlask :size="16" /></span>
              <span class="min-w-0">
                <span class="ui-item-title block capitalize">{{ p.name }}</span>
                <span class="ui-item-desc">
                  {{ p.hasVariations ? combosOf(p).length + ' combinaciones' : 'sin variaciones' }}
                </span>
              </span>
              <span class="ui-item-trail">
                <span v-if="combosOf(p).length <= 8" class="ui-pips">
                  <i
                    v-for="(c, i) in combosOf(p)" :key="c.id ?? i"
                    class="ui-pip" :class="{ 'ui-pip-on': c.recipeId }"
                  />
                </span>
                <span class="ui-item-meta">{{ coveredOf(p) }}/{{ combosOf(p).length }}</span>
              </span>
            </button>
          </div>
        </div>

        <div class="ui-pane ui-pane-sunken">
          <div class="ui-panehead">
            <span class="ui-panehead-title capitalize">
              {{ selected ? selected.name : 'Combinaciones' }}
            </span>
            <span v-if="selected" class="ui-panehead-sub">
              {{ coveredOf(selected) }} de {{ combosOf(selected).length }} listas
            </span>
          </div>

          <div v-if="!selected" class="ui-empty">
            <b>Ninguna selección</b>
            Elige un producto para ver sus combinaciones.
          </div>

          <div v-else class="flex flex-col gap-2">
            <button
              v-for="c in combosOf(selected)" :key="c.id"
              class="ui-card ui-card-action text-left"
              @click="openCombination(selected, c)"
            >
              <div class="flex items-start justify-between gap-3">
                <span class="ui-card-title capitalize">{{ comboName(c, selected) }}</span>
                <span class="ui-tag">{{ c.recipeId ? 'con receta' : 'sin receta' }}</span>
              </div>

              <div class="ui-card-sub flex flex-wrap gap-x-4 gap-y-1">
                <span>precio <span class="ui-num">{{ formatMoney(priceOf(c)) }}</span></span>
                <template v-if="c.recipeId">
                  <span>costo <span class="ui-num">{{ formatMoney(c.costPrice) }}</span></span>
                  <span v-if="marginOf(c) !== null">margen <span class="ui-num">{{ marginOf(c) }}%</span></span>
                </template>
                <span v-else>costo sin calcular</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- Builder: the mesa on the left, the despensa on the right. The panes
           swap roles exactly once, here, and never again. -->
      <div
        v-else-if="builder"
        class="ui-panes" style="--panes: minmax(0, 1.15fr) minmax(0, 0.85fr)"
      >
        <div class="ui-pane">
          <div class="ui-panehead">
            <span class="ui-panehead-title capitalize">
              {{ builder.product.name }} · {{ comboName(builder.combo, builder.product) }}
            </span>
            <span class="ui-panehead-sub">
              precio {{ formatMoney(priceOf(builder.combo)) }}
            </span>
          </div>
          <div class="ui-empty">
            <b>La mesa</b>
            Arrastra ingredientes desde la despensa.
          </div>
        </div>

        <div class="ui-pane ui-pane-sunken">
          <div class="ui-panehead">
            <span class="ui-panehead-title">Despensa</span>
            <span class="ui-panehead-sub">arrastra a la mesa</span>
          </div>
          <div class="ui-empty">Los ingredientes llegan en el siguiente paso.</div>
        </div>
      </div>
    </div>
  </div>
</template>
