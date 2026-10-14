<script setup>
/* The order form's catalog: a 3x3 grid walked category → product → variation →
 * quantity, with a search box that fills the same grid. One way in, not two: a
 * search result is a slot like any other, so the keys work on it too.
 *
 * Keys work while the grid has focus, laid out like a numpad: QWE / ASD / ZXC,
 * or the numpad's own 789 / 456 / 123. A slot fires on key UP, so the press can
 * be seen first. Space or 0 goes back a step, Shift opens "Otra" on quantity.
 * The letter chips show only while the grid has focus — when the keys work. */
import { ref, computed, nextTick, watch, useId } from 'vue';
import UiSearchField from '@/components/ui/UiSearchField.vue';
import { formatMoney, orderCategoryNames } from '@/utils/helpers';
import { useProductCollectionStore } from '@/stores/productCollectionStore';
import { PhArrowLeft } from '@phosphor-icons/vue';

const props = defineProps({
  products: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['select']);

// Slot order is top row first. Letters read left to right; the numpad's digits
// are bottom-up, so its top row is 7 8 9.
const LETTER_KEYS = ['q', 'w', 'e', 'a', 's', 'd', 'z', 'x', 'c'];
const DIGIT_KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3'];
const PER_PAGE = 8;

// A step behind you in the trail: a small link. The frozen base styles every
// <button> with 13px text, padding and margin, so size and spacing are reset here.
const CRUMB = 'ui-ink-muted text-[11.5px] font-normal m-0 p-0 cursor-pointer hover:underline truncate';
const QUANTITIES = [1, 2, 3, 4, 5, 6, 7, 8];

const slotOfKey = (key) => {
  const letter = LETTER_KEYS.indexOf(key.toLowerCase());
  if (letter >= 0) return letter;
  const digit = DIGIT_KEYS.indexOf(key);
  return digit >= 0 ? digit : null;
};

const uid = useId();
const root = ref(null);
const grid = ref(null);
const customInput = ref(null);

const step = ref('category');
const category = ref(null);
const product = ref(null);
const dimIndex = ref(0);
const picks = ref([]); // option name per dimension, in dimension order
// A search result already names its combination or variation, so quantity is all that is left.
const resolved = ref(null);
const page = ref(0);
const pressed = ref(null);
const gridFocused = ref(false);
const query = ref('');
const customOpen = ref(false);
const customQty = ref('');

// ---------- catalog ----------

const activeProducts = computed(() => props.products.filter((p) => p.isActive !== false));

// Ordered as set in Categorías › Ordenar; until then, first seen in the products.
const collectionStore = useProductCollectionStore();
// Without them the catalog still works, in first-seen order.
if (!collectionStore.items.length) collectionStore.fetchAll().catch(() => {});
const categories = computed(() => orderCategoryNames(
  [...new Set(activeProducts.value.map((p) => p.collectionName))],
  collectionStore.items,
));

const categoryProducts = computed(() =>
  activeProducts.value.filter((p) => p.collectionName === category.value));

const dimensions = computed(() => product.value?.variations?.dimensions || []);
const dimension = computed(() => dimensions.value[dimIndex.value]);

// Case-insensitive, and a combination's selection may come in any order.
const findMatchingCombination = (prod, selections) => {
  const normalize = (s) => s.toLowerCase().trim();
  const wanted = selections.map(normalize);
  return prod?.variations?.combinations?.find((combo) =>
    combo.selection?.length === wanted.length
    && wanted.every((s) => combo.selection.map(normalize).includes(s)));
};

// "desde" when the variations differ: the cheapest is the honest headline.
const priceLabel = (prod) => {
  const combos = prod.variations?.combinations;
  if (!combos?.length) return prod.basePrice ? formatMoney(prod.basePrice) : '';
  const prices = combos.map((c) => c.basePrice || 0).filter((p) => p > 0);
  if (!prices.length) return '';
  const min = Math.min(...prices);
  return prices.some((p) => p !== min) ? `desde ${formatMoney(min)}` : formatMoney(min);
};

// Only the last dimension pins a combination down, so only there does an option have a price.
const optionPrice = (option) => {
  if (dimIndex.value !== dimensions.value.length - 1) return '';
  const combo = findMatchingCombination(product.value, [...picks.value.slice(0, dimIndex.value), option.name]);
  return combo?.basePrice ? formatMoney(combo.basePrice) : '';
};

// ---------- search ----------

// Accents ignored except ñ, same as the client search.
const normalizeText = (text) => text
  .normalize('NFD')
  .replace(/[\u0300-\u0302\u0304-\u036f]/g, '')
  .normalize('NFC')
  .toLowerCase();

// "Pan de bono · Grande" and "pan de bono grande" are the same full name.
const asWords = (text) => normalizeText(text).replace(/·/g, ' ').split(/\s+/).filter(Boolean).join(' ');

// One entry per thing you can actually put on a line: each combination, each
// legacy variation, or the product itself.
const searchable = computed(() => activeProducts.value.flatMap((prod) => {
  const base = [prod.name, prod.description, prod.accountingCode];
  const entry = (extra, label, price, pick, code) => ({
    product: prod,
    ...pick,
    label,
    price: price ? formatMoney(price) : '',
    text: normalizeText([...base, ...extra].filter(Boolean).join(' ')),
    // What counts as typing the whole thing: its full name or its own code.
    exact: [label, code, prod.accountingCode].filter(Boolean).map(asWords),
  });

  if (prod.variations?.combinations?.length) {
    return prod.variations.combinations.map((combo) => entry(
      [combo.name, ...(combo.selection || []), combo.accountingCode],
      `${prod.name} · ${combo.name}`,
      combo.basePrice,
      { combination: combo },
      combo.accountingCode,
    ));
  }
  if (Array.isArray(prod.variations) && prod.variations.length) {
    return prod.variations.map((variation) => entry(
      [variation.name, variation.accountingCode],
      `${prod.name} · ${variation.name}`,
      variation.basePrice,
      { variation },
      variation.accountingCode,
    ));
  }
  return [entry([], prod.name, prod.basePrice, {})];
}));

const searching = computed(() => query.value.trim().length >= 2);

const results = computed(() => {
  if (!searching.value) return [];
  const terms = normalizeText(query.value).split(/\s+/).filter(Boolean);
  return searchable.value.filter((item) => terms.every((t) => item.text.includes(t)));
});

// Typing a code or a full name that names exactly one thing adds it at once,
// quantity 1: the till's scan-and-go. A partial word that happens to leave one
// result does not ("bag" mid-way to "baguette integral"); that waits for Enter.
watch(query, (typed) => {
  const words = asWords(typed);
  if (words.length < 2) return;
  const named = searchable.value.filter((item) => item.exact.includes(words));
  // Typing is one keystroke at a time (a scanner too): "croissant" is a whole
  // name on the way to "croissant almendras", code 12 on the way to 123. While
  // something longer still starts with it, wait; Enter settles it.
  const longer = searchable.value.some((item) =>
    item.exact.some((e) => e !== words && e.startsWith(words)));
  if (named.length === 1 && !longer) addNow(named[0], 1);
});

watch(query, () => { page.value = 0; });

// ---------- the grid ----------

const options = computed(() => {
  if (searching.value) {
    return results.value.map((r) => ({ label: r.label, sub: r.product.collectionName, price: r.price, result: r }));
  }
  switch (step.value) {
  case 'category':
    return categories.value.map((c) => {
      const n = activeProducts.value.filter((p) => p.collectionName === c).length;
      return { label: c, sub: `${n} ${n === 1 ? 'producto' : 'productos'}`, value: c };
    });
  case 'product':
    return categoryProducts.value.map((p) => ({ label: p.name, price: priceLabel(p), value: p }));
  case 'dimension':
    return (dimension.value?.options || []).map((o) => ({ label: o.name, price: optionPrice(o), value: o }));
  default:
    return QUANTITIES.map((n) => ({ label: String(n), value: n, big: true }));
  }
});

// Eight per page with the ninth slot for paging: the same positions the
// cashiers already know by hand.
const slots = computed(() => {
  if (!searching.value && step.value === 'quantity') {
    return [...options.value, { other: true, label: 'Otra…' }];
  }
  const start = page.value * PER_PAGE;
  const items = options.value.slice(start, start + PER_PAGE);
  const rest = options.value.length - start - PER_PAGE;
  if (rest > 0) items.push({ next: true, label: `Más (${rest})` });
  if (page.value > 0 && items.length < 9) items.push({ prev: true, label: 'Anteriores' });
  return items;
});

const resultsLabel = computed(() => {
  const n = results.value.length;
  return n ? `${n} ${n === 1 ? 'resultado' : 'resultados'}` : 'Nada coincide';
});

const atRoot = computed(() => !searching.value && step.value === 'category');

// ---------- moving through it ----------

const reset = () => {
  step.value = 'category';
  category.value = null;
  product.value = null;
  dimIndex.value = 0;
  picks.value = [];
  resolved.value = null;
  page.value = 0;
  customOpen.value = false;
  customQty.value = '';
};

const toCategory = () => {
  step.value = 'product';
  product.value = null;
  picks.value = [];
  resolved.value = null;
  page.value = 0;
};

const toDimension = (index) => {
  step.value = 'dimension';
  dimIndex.value = index;
  picks.value = picks.value.slice(0, index);
  page.value = 0;
};

const emitSelection = (quantity) => {
  let pick = { variation: resolved.value?.variation ?? null };
  if (resolved.value?.combination) {
    pick = { combination: resolved.value.combination };
  } else if (picks.value.length) {
    const combination = findMatchingCombination(product.value, picks.value);
    if (!combination) return;
    pick = { combination };
  }
  emit('select', { category: category.value, product: product.value, ...pick, quantity });
  reset();
};

function addNow(result, quantity) {
  category.value = result.product.collectionName;
  product.value = result.product;
  resolved.value = { combination: result.combination, variation: result.variation };
  query.value = '';
  emitSelection(quantity);
}

const pickResult = (result) => {
  category.value = result.product.collectionName;
  product.value = result.product;
  resolved.value = { combination: result.combination, variation: result.variation };
  picks.value = [];
  step.value = 'quantity';
  query.value = '';
  // On to quantity with the hands still on the keys.
  nextTick(() => grid.value?.focus());
};

const choose = (index) => {
  const slot = slots.value[index];
  if (!slot) return;
  if (slot.next) { page.value++; return; }
  if (slot.prev) { page.value--; return; }
  if (slot.other) { openCustom(); return; }
  if (slot.result) { pickResult(slot.result); return; }

  switch (step.value) {
  case 'category':
    category.value = slot.value;
    step.value = 'product';
    break;
  case 'product':
    product.value = slot.value;
    picks.value = [];
    dimIndex.value = 0;
    step.value = dimensions.value.length ? 'dimension' : 'quantity';
    break;
  case 'dimension':
    picks.value = [...picks.value.slice(0, dimIndex.value), slot.value.name];
    if (dimIndex.value < dimensions.value.length - 1) dimIndex.value++;
    else step.value = 'quantity';
    break;
  case 'quantity':
    emitSelection(slot.value);
    return;
  }
  page.value = 0;
};

const back = () => {
  if (searching.value) { query.value = ''; return; }
  customOpen.value = false;
  page.value = 0;
  if (step.value === 'product') {
    reset();
  } else if (step.value === 'dimension') {
    if (dimIndex.value > 0) toDimension(dimIndex.value - 1);
    else toCategory();
  } else if (step.value === 'quantity') {
    if (resolved.value || !dimensions.value.length) toCategory();
    else toDimension(dimensions.value.length - 1);
  }
};

function openCustom() {
  customOpen.value = true;
  nextTick(() => customInput.value?.focus());
}

const closeCustom = () => {
  customOpen.value = false;
  customQty.value = '';
  grid.value?.focus();
};

const addCustom = () => {
  const quantity = parseInt(customQty.value, 10);
  if (quantity > 0) {
    emitSelection(quantity);
    grid.value?.focus();
  }
};

// ---------- keys ----------

const onKeydown = (event) => {
  if (event.key === 'Shift' && step.value === 'quantity' && !searching.value) {
    event.preventDefault();
    openCustom();
    return;
  }
  const slot = slotOfKey(event.key);
  if (slot !== null) {
    event.preventDefault();
    pressed.value = slot;
  } else if (event.key === '0' || event.key === ' ') {
    event.preventDefault();
  }
};

const onKeyup = (event) => {
  const slot = slotOfKey(event.key);
  if (slot !== null) {
    event.preventDefault();
    if (pressed.value === slot) choose(slot);
    pressed.value = null;
  } else if (event.key === '0' || event.key === ' ') {
    event.preventDefault();
    back();
  }
};

// Enter takes what was typed exactly (a full name or code), else the first
// result. The list is in catalog order, not by match, so "croissant" + Enter
// must not land on "Croissant almendras" just because it is listed first.
const onSearchEnter = () => {
  const words = asWords(query.value);
  const pick = searchable.value.find((item) => item.exact.includes(words)) ?? results.value[0];
  if (pick) pickResult(pick);
};

const focus = () => {
  root.value?.querySelector('input')?.focus();
};

defineExpose({ focus });
</script>

<template>
  <div ref="root" class="flex flex-col gap-3">
    <UiSearchField
      v-model="query"
      placeholder="Buscar por nombre o código…"
      label="Buscar producto"
      @keydown.enter.prevent="onSearchEnter"
    />

    <!-- tabindex: the grid takes the keys itself, so it needs to hold focus. -->
    <div
      ref="grid"
      class="grid grid-cols-3 gap-2"
      tabindex="0"
      role="group"
      aria-label="Catálogo: teclas Q W E, A S D, Z X C; espacio vuelve atrás"
      @keydown="onKeydown"
      @keyup="onKeyup"
      @focusin="gridFocused = true"
      @focusout="gridFocused = false; pressed = null"
    >
      <button
        v-for="i in 9"
        :key="i"
        type="button"
        tabindex="-1"
        class="ui-btn relative h-[4.5rem] flex-col justify-center !gap-0.5 text-left !px-2.5"
        :class="[slots[i - 1]?.big ? '!items-center' : '!items-start', { invisible: !slots[i - 1] }]"
        :aria-pressed="pressed === i - 1"
        @click="choose(i - 1)"
      >
        <span
          v-if="gridFocused"
          class="ui-tag absolute top-1 right-1 !px-1.5 !py-0 uppercase"
          aria-hidden="true"
        >{{ LETTER_KEYS[i - 1] }}</span>
        <span
          class="line-clamp-2 leading-tight"
          :class="slots[i - 1]?.big ? 'text-xl' : 'pr-4'"
        >{{ slots[i - 1]?.label }}</span>
        <span
          v-if="slots[i - 1]?.price || slots[i - 1]?.sub"
          class="ui-item-desc truncate max-w-full"
        >{{ slots[i - 1]?.price || slots[i - 1]?.sub }}</span>
      </button>
    </div>

    <div v-if="customOpen" class="flex gap-1.5 items-end">
      <div class="ui-field flex-1">
        <label class="ui-field-k" :for="`${uid}-qty`">Otra cantidad</label>
        <input
          :id="`${uid}-qty`"
          ref="customInput"
          v-model="customQty"
          type="number"
          min="1"
          step="1"
          class="ui-input ui-input-num"
          @keydown.enter.prevent="addCustom"
          @keydown.esc.prevent="closeCustom"
        >
      </div>
      <button type="button" class="ui-btn ui-btn-field" @click="addCustom">Agregar</button>
    </div>

    <div class="flex items-center justify-between gap-2">
      <button type="button" class="ui-btn ui-btn-sm" :disabled="atRoot" @click="back">
        <PhArrowLeft :size="12" weight="bold" />
        Atrás
      </button>
      <span class="ui-item-desc text-right">
        <template v-if="gridFocused">Espacio: atrás<template v-if="step === 'quantity'"> · Shift: otra cantidad</template></template>
        <template v-else>Clic en el catálogo para usar el teclado</template>
      </span>
    </div>

    <!-- The trail: its own line, fixed height, small. Under the grid so the
         slots never move as it grows. A step behind you is a link back; where
         you are is plain text. -->
    <nav
      class="flex flex-nowrap items-center gap-1 h-5 overflow-hidden whitespace-nowrap text-[11.5px]"
      aria-label="Pasos del catálogo"
    >
      <span v-if="searching" class="ui-ink-muted">{{ resultsLabel }}</span>
      <template v-else>
        <span v-if="step === 'category'" class="font-semibold">Categorías</span>
        <button v-else type="button" :class="CRUMB" @click="reset">Categorías</button>
        <template v-if="category">
          <span class="ui-ink-muted" aria-hidden="true">›</span>
          <span v-if="step === 'product'" class="font-semibold truncate">{{ category }}</span>
          <button v-else type="button" :class="CRUMB" @click="toCategory">{{ category }}</button>
        </template>
        <template v-if="product">
          <span class="ui-ink-muted" aria-hidden="true">›</span>
          <button
            v-if="dimensions.length && !resolved && !(step === 'dimension' && dimIndex === 0)"
            type="button"
            :class="CRUMB"
            @click="toDimension(0)"
          >
            {{ product.name }}
          </button>
          <span v-else class="font-semibold truncate">
            {{ product.name }}<template v-if="resolved?.combination || resolved?.variation">
              · {{ (resolved.combination || resolved.variation).name }}</template>
          </span>
        </template>
        <template v-for="(name, i) in picks" :key="i">
          <template v-if="step === 'quantity' || i < dimIndex">
            <span class="ui-ink-muted" aria-hidden="true">›</span>
            <button type="button" :class="CRUMB" @click="toDimension(i)">{{ name }}</button>
          </template>
        </template>
      </template>
    </nav>
  </div>
</template>
