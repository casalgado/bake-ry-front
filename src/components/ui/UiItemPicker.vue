<script setup>
/* Type, arrow, Enter. The one control both document screens are built around:
 * a delivery is twenty lines and the person entering it is reading off a paper
 * invoice, so the hands never leave the keyboard and the input keeps focus on
 * every select. Create is the one exception, and it belongs to the screen: the
 * card that opens is a form with its own fields, so whoever renders it takes the
 * keyboard from here (IngredientCreateCard's `autofocus`).
 *
 * A `.vue` and not a class (assets/ui/CLAUDE.md rule 9) because everything that
 * makes it a picker is behaviour: the filter, the roving active row, the listbox
 * roles. It introduces no new `ui-*` class — the rows are `.ui-item` and the
 * active one is `aria-current`, which already reads as selected.
 *
 * Deliberately NOT a popover. A floating panel needs a stacking context,
 * click-outside and escape-to-dismiss, and buys nothing on a form with the
 * vertical room: the list opens under the input while you are in it and folds
 * away when you leave.
 *
 * `UiSearchField` is not reused here, and not forked either: a combobox has to
 * put `aria-activedescendant`, `role="combobox"` and four key handlers ON THE
 * INPUT, and fallthrough attrs land on that component's wrapper div instead. */
import { ref, computed, useId } from 'vue';
import { SHELF_TITLES } from '@/composables/useItemCatalog';
import { PhX, PhPlus } from '@phosphor-icons/vue';

const props = defineProps({
  /* Normalised by the screen, never by this component: `{ key, name, sub, kind,
   * meta }`. `kind` groups the rows, `meta` is the right-hand number — what the
   * bodega holds, usually. Built against the catalog rather than against stocks
   * docs, so an item that has never been stocked can still be picked. */
  items: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Buscar…' },
  label: { type: String, default: 'Buscar' },
  /* Ingreso says Insumos/Reventa where the recetario says
   * Ingredientes/Productos — same shelves, different words for who is looking. */
  titles: { type: Object, default: () => SHELF_TITLES },
  allowCreate: { type: Boolean, default: false },
  /* Past this the list stops being scannable and the search box is the real
   * interface. Same reasoning as the recetario's SHELF_CAP. */
  cap: { type: Number, default: 40 },
});

const emit = defineEmits(['select', 'create']);

const query = ref('');
const open = ref(false);
const activeIndex = ref(0);
const listId = useId();

/* Case-insensitive substring, the same match every other shelf on these screens
 * uses. Anything cleverer (fuzzy, ranked) would order results differently from
 * the lists beside it. Also matches the visible section heading, so typing a
 * group name (a colección, on Producción) surfaces everything under it. */
const sectionLabel = (i) =>
  (props.titles[i.kind] || i.kind || '').toLowerCase();

const found = computed(() => {
  const q = query.value.trim().toLowerCase();
  return q
    ? props.items.filter((i) =>
      (i.name || '').toLowerCase().includes(q) || sectionLabel(i).includes(q))
    : props.items;
});

const matches = computed(() => found.value.slice(0, props.cap));
const overflow = computed(() => found.value.length - matches.value.length);

/* An exact match hides the create row, for the same reason the recetario's
 * does: duplicates are what make a catalog unusable. */
const canCreate = computed(() => {
  const q = query.value.trim();
  if (!props.allowCreate || !q) return false;
  return !props.items.some((i) => (i.name || '').toLowerCase() === q.toLowerCase());
});

/* One flat list is what the arrows walk. The groups below are rendering only —
 * a keyboard user moving through headings would be counting rows that are not
 * choices. `create` rides at the end as a real option, because reaching it with
 * the same key as everything else is the point of putting it in the list. */
const options = computed(() => [
  ...matches.value.map((item) => ({ kind: 'item', item })),
  ...(canCreate.value ? [{ kind: 'create' }] : []),
]);

const groups = computed(() =>
  Object.entries(props.titles)
    .map(([key, title]) => ({
      key,
      title,
      items: matches.value.filter((i) => i.kind === key),
    }))
    .filter((g) => g.items.length));

/* Index into `options`, so a row's id is stable whichever group renders it. */
const indexOf = (item) => matches.value.indexOf(item);
const optionId = (i) => `${listId}-opt-${i}`;

function move(step) {
  const n = options.value.length;
  if (!n) return;
  open.value = true;
  activeIndex.value = (activeIndex.value + step + n) % n;
}

function choose(index = activeIndex.value) {
  const option = options.value[index];
  if (!option) return;

  if (option.kind === 'create') emit('create', query.value.trim());
  else emit('select', option.item.key);

  /* Cleared, not closed. The next line of the invoice is the next thing you
   * type, and leaving the query behind means the list you are looking at no
   * longer matches what the box says. */
  query.value = '';
  activeIndex.value = 0;
}

function onInput(value) {
  query.value = value;
  open.value = true;
  activeIndex.value = 0;
}

/* Escape empties first and closes only when already empty: the common case is
 * "wrong search", not "wrong screen". */
function onEsc() {
  if (query.value) query.value = '';
  else open.value = false;
}
</script>

<template>
  <div>
    <div class="ui-search">
      <input
        :value="query"
        class="ui-input"
        type="text"
        role="combobox"
        enterkeyhint="done"
        autocomplete="off"
        :placeholder="placeholder"
        :aria-label="label"
        :aria-expanded="open"
        :aria-controls="listId"
        :aria-activedescendant="open && options.length ? optionId(activeIndex) : undefined"
        @focus="open = true"
        @blur="open = false"
        @input="onInput($event.target.value)"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.enter.prevent="choose()"
        @keydown.esc.prevent="onEsc"
      >
      <button
        v-if="query"
        class="ui-search-clear"
        type="button"
        :aria-label="'Limpiar ' + label.toLowerCase()"
        @mousedown.prevent="query = ''"
      >
        <PhX :size="12" weight="bold" />
      </button>
    </div>

    <!-- mousedown.prevent on the whole list: a click blurs the input BEFORE it
         fires, and a blurred input closes the list out from under the click.
         Preventing the default keeps focus on the input and the click still
         lands, which is also what lets you enter a delivery without ever
         touching the keyboard's Tab. -->
    <div
      v-show="open"
      :id="listId"
      class="mt-2 max-h-80 overflow-y-auto"
      role="listbox"
      :aria-label="label"
      @mousedown.prevent
    >
      <div v-if="!options.length" class="ui-empty">
        {{ query ? 'Nada coincide con esa búsqueda.' : 'No hay nada que agregar.' }}
      </div>

      <div v-for="g in groups" :key="g.key" class="mb-2">
        <div class="ui-sectionhead">{{ g.title }}</div>
        <div
          v-for="item in g.items"
          :id="optionId(indexOf(item))"
          :key="item.key"
          class="ui-item"
          role="option"
          :aria-selected="activeIndex === indexOf(item)"
          :aria-current="activeIndex === indexOf(item)"
          @click="choose(indexOf(item))"
          @mousemove="activeIndex = indexOf(item)"
        >
          <span />
          <span class="min-w-0">
            <span class="ui-item-title block capitalize">{{ item.name }}</span>
            <span v-if="item.sub" class="ui-item-desc">{{ item.sub }}</span>
          </span>
          <span v-if="item.meta" class="ui-item-trail">
            <span class="ui-item-meta">{{ item.meta }}</span>
          </span>
        </div>
      </div>

      <p v-if="overflow > 0" class="ui-item-desc mb-2">
        +{{ overflow }} más — sigue escribiendo para acotar.
      </p>

      <!-- Last, and a real option: the same Enter that picks an existing item
           creates the one that does not exist yet. -->
      <div
        v-if="canCreate"
        :id="optionId(options.length - 1)"
        class="ui-item"
        role="option"
        :aria-selected="activeIndex === options.length - 1"
        :aria-current="activeIndex === options.length - 1"
        @click="choose(options.length - 1)"
        @mousemove="activeIndex = options.length - 1"
      >
        <span class="ui-item-icon"><PhPlus :size="14" weight="bold" /></span>
        <span class="min-w-0">
          <span class="ui-item-title block">
            Crear <span class="capitalize">{{ query.trim() }}</span>
          </span>
          <span class="ui-item-desc">No existe todavía en el catálogo.</span>
        </span>
      </div>
    </div>
  </div>
</template>
