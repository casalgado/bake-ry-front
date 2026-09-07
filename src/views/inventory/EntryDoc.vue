<script setup>
/* Ingreso and Producción are one component: same layout, same gesture, same
 * line math. What differs is three things — which shelves you take from,
 * whether a line carries a unit cost, and which endpoint confirms it — so they
 * are three entries in one map rather than two files that drift apart. The
 * prototype already unified them; this keeps that.
 *
 * Left is the document you are filling. Right is the bodega you take from.
 * Same rule as the recetario's mesa and despensa.
 *
 * `kind` comes from the route, not from a parent: /dashboard/inventory/ingreso
 * and .../produccion are two routes onto this one component. The document lives
 * in inventoryDocsStore, so walking away and coming back finds it where you
 * left it. */
import { ref, computed } from 'vue';
import { PhX } from '@phosphor-icons/vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import UiSearchField from '@/components/ui/UiSearchField.vue';
import { useStockStore } from '@/stores/stockStore';
import { useInventoryDocsStore } from '@/stores/inventoryDocsStore';
import { useItemCatalog, itemOfStock, SHELF_TITLES } from '@/composables/useItemCatalog';
import { useWarehouses } from '@/composables/useWarehouses';
import { formatMoney, formatQty } from '@/utils/helpers';

const props = defineProps({
  kind: { type: String, required: true },
});

const stockStore = useStockStore();
const docsStore = useInventoryDocsStore();
const catalog = useItemCatalog();
const { warehouses, multiWarehouse, defaultWarehouseId } = useWarehouses();

/* Opened once, on mount, not inside a computed: creating a document is a side
 * effect and a computed must not have one. The layout keys <router-view> on the
 * path, so switching between Ingreso and Producción remounts this and opens the
 * other document rather than leaving `kind` pointing at the wrong one.
 *
 * The feature guard has already loaded settings by the time this runs, so the
 * default bodega is the real one and not the fallback. */
docsStore.open(props.kind, defaultWarehouseId.value);
const doc = computed(() => docsStore.docs[props.kind]);

const KIND = {
  ingreso: {
    label: 'Ingreso',
    lead: 'Lo que llegó de afuera.',
    shelves: ['ingr', 'prod'],
    partyLabel: 'Proveedor',
    dropTitle: 'Arrastra lo que llegó',
    totalLabel: 'Total de la compra',
    confirmLabel: 'Confirmar ingreso',
    // A purchase line carries what it cost; production's cost is derived.
    emptyShelves: 'Ningún ingrediente ni producto lleva control de existencias. Actívalo en uno para poder registrar lo que llega.',
    unitCost: true,
    /* ponytail: Confirmar stays disabled — the purchases endpoint arrives in
     * commit 3 (EXISTENCIAS-BUILD.md §4.2) as POST /bakeries/:bakeryId/purchases.
     * It is NOT routed through /stocks/:itemKey/adjust to make the button work:
     * that would write `adjustment` movements for events that are purchases,
     * and an append-only ledger can never be re-tagged, so the merma report
     * would be wrong forever. */
    waitingOn: 'POST /purchases',
  },
  produccion: {
    label: 'Producción',
    lead: 'Lo que hacemos: productos y preparaciones.',
    shelves: ['prod', 'prep'],
    partyLabel: 'Responsable',
    dropTitle: 'Arrastra lo que se hizo',
    totalLabel: 'Valor producido',
    confirmLabel: 'Confirmar producción',
    emptyShelves: 'Ningún producto ni preparación lleva control de existencias. Actívalo en uno para poder registrar lo que haces.',
    unitCost: false,
    /* ponytail: same rule. POST /bakeries/:bakeryId/stocks/produce arrives with
     * expandComponents in commit 2 (§4.1); stockStore.produce is already
     * written against it. */
    waitingOn: 'POST /stocks/produce',
  },
};

const spec = computed(() => KIND[props.kind]);

/* ---------------- the shelves you take from ---------------- */

const search = ref('');

/* Chips are the real bodega: every item that has a stocks doc in the bodega
 * this document lands in, showing what is actually there right now, so you
 * load a delivery without leaving to go look.
 *
 * ponytail: the shelves are the stocks docs, not the whole catalog, so an item
 * nobody has ever stocked cannot be added here — and it also means no itemKey
 * is ever built on the client (invariant 5: one builder, and it is the
 * backend's). Buying something for the first time therefore needs the item
 * switched to `stocked` first. Revisit with the purchases endpoint (§4.2), which
 * is where a line for an untracked item would have to mint its stocks doc. */
const stocksHere = computed(() =>
  stockStore.items.filter((s) => s.warehouseId === doc.value.warehouseId));

/* What a thing IS — no quantity, because identity does not depend on which
 * bodega you are looking at. */
const identityOf = (stock) => {
  const item = itemOfStock(stock);
  return {
    itemKey: stock.itemKey,
    item,
    name: catalog.nameOf(item) || stock.name,
    unit: stock.unit,
    cost: catalog.costOf(item),
    kind: catalog.kindOf(item),
  };
};

/* Shelf chips are this bodega's stocks, so they carry what is actually here. */
const chips = computed(() =>
  stocksHere.value.map((stock) => ({
    ...identityOf(stock),
    stock: stock.currentStock || 0,
  })));

const shelves = computed(() => {
  const q = search.value.trim().toLowerCase();

  return spec.value.shelves
    .map((key) => ({
      key,
      title: SHELF_TITLES[key],
      items: chips.value
        .filter((c) => c.kind === key && (!q || c.name.toLowerCase().includes(q)))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter((shelf) => shelf.items.length);
});

/* ---------------- the document ---------------- */

/* A line is identity plus what you typed; the name, the unit and what is
 * already in the bodega are joined back at render time, so a refetch never
 * leaves a stale copy sitting in the document.
 *
 * Resolved off EVERY stocks doc, not just this bodega's: changing where a
 * delivery lands must not blank the lines you already wrote. Only `inStock`
 * below is scoped to the destination, because only it is a fact about a place. */
const identityByKey = computed(() => {
  const byKey = new Map();
  stockStore.items.forEach((stock) => {
    if (!byKey.has(stock.itemKey)) byKey.set(stock.itemKey, identityOf(stock));
  });
  return byKey;
});

const stockHere = (itemKey) =>
  stocksHere.value.find((s) => s.itemKey === itemKey)?.currentStock ?? 0;

const rows = computed(() =>
  doc.value.lines.map((line, i) => {
    const chip = identityByKey.value.get(line.itemKey);
    const unitCost = spec.value.unitCost ? line.unitCost : chip?.cost ?? null;

    return {
      ...line,
      _i: i,
      name: chip?.name ?? line.itemKey,
      unit: chip?.unit ?? '',
      inStock: stockHere(line.itemKey),
      unitCost,
      value: unitCost === null ? null : (line.qty || 0) * unitCost,
    };
  }));

const total = computed(() =>
  rows.value.reduce((sum, row) => sum + (row.value ?? 0), 0));

const unpricedCount = computed(() => rows.value.filter((r) => r.value === null).length);

const blankQuantities = computed(
  () => doc.value.lines.filter((l) => !(l.qty > 0)).length);

function addLine(itemKey) {
  const existing = doc.value.lines.find((l) => l.itemKey === itemKey);

  if (existing) {
    doc.value.lines = doc.value.lines.map((l) =>
      l.itemKey === itemKey ? { ...l, qty: (l.qty || 0) + 1 } : l);
    return;
  }

  const chip = identityByKey.value.get(itemKey);
  if (!chip) return;

  doc.value.lines = [
    ...doc.value.lines,
    {
      itemKey,
      item: chip.item,
      qty: 1,
      /* The suggested cost, never the stored one: a purchase is where the price
       * changes, so the line owns its own number from the first keystroke.
       * Whether the ingredient's standard cost follows is a per-line decision
       * the user makes at confirm time (§4.2), never automatic. */
      unitCost: spec.value.unitCost ? chip.cost ?? 0 : null,
    },
  ];
}

/* Two failure modes, one line apart, and this has been wrong in both directions.
 *
 * Coercing '' to 0 snaps the box shut the moment you select the old value to
 * type a new one. Rejecting 0 is worse: every keystroke of `0.5` starts with a
 * `0`, which mapped to null and blanked the field before you could reach the
 * decimal point, so no quantity below one could ever be typed — and a unit cost
 * of exactly zero (agua) was unreachable full stop.
 *
 * So: empty stays empty, zero is a number, negatives are refused. What makes the
 * decimal survive is that patchDOMProp compares against el.value rather than the
 * previous bound value — mid-decimal Chrome's getter returns '' (a trailing dot
 * is not a valid floating-point number), null stringifies to '' too, they match,
 * and no DOM write happens. `blankQuantities` below already treats 0 as blank,
 * so nothing downstream mistakes it for a real quantity. */
const setField = (index, field, value) => {
  const raw = String(value).trim();
  const n = raw === '' ? null : Number(value);
  const next = n === null || !Number.isFinite(n) || n < 0 ? null : n;

  doc.value.lines = doc.value.lines.map((l, i) =>
    i === index ? { ...l, [field]: next } : l);
};

const removeLine = (index) =>
  (doc.value.lines = doc.value.lines.filter((_, i) => i !== index));

/* ---------------- drag and drop ---------------- */

const dragOver = ref(false);
const draggingKey = ref(null);

function onDragStart(event, chip) {
  draggingKey.value = chip.itemKey;
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData('text/plain', chip.itemKey);
}

/* The tab rail's ×, now that there is no rail. A document you emptied is a
 * document you did not have, so the button only bites once there is something
 * in it.
 *
 * ponytail: native confirm(), same ruling as RecipeBookView.vue:790 — there is
 * no ui-modal and one guard does not earn the first. */
function discard() {
  if (!doc.value.lines.length) return;
  if (!confirm(`Se perderán las ${doc.value.lines.length} línea(s) de este ${spec.value.label.toLowerCase()}. ¿Descartar?`)) return;

  /* Reopen on the bodega you were pointing at, not the default one: clearing the
   * lines is what you asked for, silently re-routing the delivery is not. */
  const { warehouseId } = doc.value;
  docsStore.discard(props.kind);
  docsStore.open(props.kind, warehouseId);
}

function onDrop(event) {
  dragOver.value = false;
  const itemKey = event.dataTransfer.getData('text/plain');
  if (itemKey) addLine(itemKey);
}
</script>

<template>
  <!-- The line count rides in the header's slot rather than in a panehead of
       its own: a panehead here would print `spec.label` twelve lines under the
       title that already says it, and the screen would read "Ingreso … Ingreso".
       The right pane keeps its own head because it labels the shelf, not the
       page. -->
  <PageHeader :title="spec.label" :subtitle="spec.lead">
    <span class="ui-panehead-sub">
      {{ doc.lines.length }} línea{{ doc.lines.length === 1 ? '' : 's' }}
    </span>
  </PageHeader>

  <div class="ui-app">
    <div class="ui-panes" style="--panes: minmax(0, 1.35fr) minmax(0, 1fr)">
      <!-- ---------------- left: the document ---------------- -->
      <div class="ui-pane">
        <div class="flex flex-wrap gap-2 mb-4">
          <label class="ui-field flex-1 min-w-[8rem]">
            <span class="ui-field-k">Fecha</span>
            <!-- Native date input: the browser already owns the calendar, the
                 locale and the keyboard. -->
            <input
              class="ui-input"
              type="date"
              :value="doc.date"
              @input="doc.date = $event.target.value"
            >
          </label>

          <label class="ui-field flex-1 min-w-[10rem]">
            <span class="ui-field-k">{{ spec.partyLabel }}</span>
            <input
              class="ui-input"
              type="text"
              :value="doc.party"
              @input="doc.party = $event.target.value"
            >
          </label>

          <label v-if="multiWarehouse" class="ui-field flex-1 min-w-[8rem]">
            <span class="ui-field-k">Entra a</span>
            <select
              class="ui-input"
              :value="doc.warehouseId"
              @change="doc.warehouseId = $event.target.value"
            >
              <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
            </select>
          </label>
        </div>

        <!-- The drop handlers stay on a plain element: on a TransitionGroup they
             would ride on listener fallthrough, and a dragover that quietly fails
             to preventDefault makes the browser refuse every drop with no error. -->
        <div
          class="ui-dropzone"
          :class="{ 'ui-dropzone-over': dragOver }"
          @dragover.prevent="dragOver = true"
          @dragleave="dragOver = false"
          @drop.prevent="onDrop"
        >
          <div v-if="!rows.length" class="ui-empty">
            <b>{{ spec.dropTitle }}</b>
            Haz clic o arrastra desde la bodega, a la derecha.
          </div>

          <TransitionGroup tag="div" name="ui-cascade" class="flex flex-col gap-1.5">
            <div
              v-for="(row, i) in rows" :key="row.itemKey"
              class="ui-item ui-item-filled"
              :style="{ '--i': i }"
            >
              <!-- The same ingr/prep/prod tag the recetario uses, so both views
                   name component kinds identically. -->
              <span class="ui-tag">{{ identityByKey.get(row.itemKey)?.kind ?? '—' }}</span>

              <span class="min-w-0">
                <!-- title, because .ui-item-title ellipses: at a narrow pane the
                     name is the first thing to give way, and a row you cannot
                     read is a row you cannot check. -->
                <span class="ui-item-title block capitalize" :title="row.name">{{ row.name }}</span>
                <!-- The line's own money lives here, not in the trail: the trail
                     sits in an `auto` grid column that never shrinks, so every
                     column added to it comes straight out of the name. Beside the
                     stock it is also simply where it belongs — this line's
                     context, not a column of its own. -->
                <span class="ui-item-desc">
                  en bodega {{ formatQty(row.inStock) }} {{ row.unit }}
                  · <template v-if="row.value === null">sin costo</template>
                  <b v-else class="ui-num">{{ formatMoney(row.value) }}</b>
                </span>
              </span>

              <span class="ui-item-trail">
                <input
                  class="ui-input ui-input-num w-20"
                  type="number" min="0" step="any"
                  :value="row.qty"
                  :aria-label="'Cantidad de ' + row.name"
                  :aria-invalid="!(row.qty > 0)"
                  @input="setField(row._i, 'qty', $event.target.value)"
                >
                <span class="ui-item-meta w-8 shrink-0">{{ row.unit }}</span>

                <input
                  v-if="spec.unitCost"
                  class="ui-input ui-input-num w-20"
                  type="number" min="0" step="any"
                  :value="row.unitCost"
                  :aria-label="'Costo por ' + row.unit + ' de ' + row.name"
                  :title="'Costo por ' + row.unit"
                  @input="setField(row._i, 'unitCost', $event.target.value)"
                >

                <button
                  class="ui-btn ui-btn-icon ui-btn-danger"
                  :aria-label="'Quitar ' + row.name"
                  title="Quitar"
                  @click="removeLine(row._i)"
                >
                  <PhX :size="13" weight="bold" />
                </button>
              </span>
            </div>
          </TransitionGroup>
        </div>

        <p v-if="blankQuantities" class="ui-item-desc mt-2">
          {{ blankQuantities }} línea(s) sin cantidad.
        </p>
        <p v-if="unpricedCount" class="ui-item-desc mt-2">
          {{ unpricedCount }} línea(s) sin costo — el total de abajo se queda corto.
        </p>
        <p v-if="doc.kind === 'produccion'" class="ui-item-desc mt-2">
          Aquí van las salidas de producción. Los ingredientes que se consumieron
          los calcula el servidor a partir de la receta y aparecerán en la vista
          previa cuando el endpoint exista.
        </p>

        <div
          class="flex flex-wrap items-baseline justify-between gap-x-7 gap-y-3 mt-4 pt-3.5"
          style="border-top: 1px solid var(--ui-line)"
        >
          <span class="ui-stat">
            <span class="ui-stat-k">{{ spec.totalLabel }}</span>
            <span class="ui-stat-v">{{ formatMoney(total) }}</span>
          </span>
          <span class="ui-stat">
            <span class="ui-stat-k">Líneas</span>
            <span class="ui-stat-v">{{ doc.lines.length }}</span>
          </span>
        </div>

        <!-- Disabled with the reason on screen, not only in a title: a button
             that silently does nothing is worse than one that says why. -->
        <div class="flex flex-wrap items-center gap-1.5 mt-4">
          <button class="ui-btn ui-btn-solid" disabled>{{ spec.confirmLabel }}</button>
          <button
            class="ui-btn ui-btn-danger"
            :disabled="!doc.lines.length"
            @click="discard"
          >Descartar</button>
        </div>
        <p class="ui-item-desc mt-2">
          Todavía no se puede confirmar: falta <code>{{ spec.waitingOn }}</code> en
          el servidor. Nada se guarda hasta entonces, y este documento no
          sobrevive a recargar la página.
        </p>
      </div>

      <!-- ---------------- right: the bodega ---------------- -->
      <div class="ui-pane ui-pane-sunken">
        <div class="ui-panehead">
          <span class="ui-panehead-title">Bodega</span>
          <span class="ui-panehead-sub">lo que hay ahora</span>
        </div>

        <UiSearchField
          v-model="search"
          class="mb-4"
          placeholder="Buscar artículo…"
          label="Buscar en la bodega"
        />

        <div v-if="!chips.length" class="ui-empty">
          <b>Esta bodega está vacía</b>
          Activa el control de existencias en un ingrediente o en un producto para
          poder registrarlo aquí.
        </div>
        <!-- Three states, not two: an empty search result and "nothing of this
             kind is tracked" look identical from the outside and are fixed by
             completely different things. Blaming the search box when the search
             box is empty sends you looking for a typo that isn't there. -->
        <div v-else-if="!shelves.length && search.trim()" class="ui-empty">
          Nada coincide con esa búsqueda.
        </div>
        <div v-else-if="!shelves.length" class="ui-empty">
          <b>Nada que registrar aquí todavía</b>
          {{ spec.emptyShelves }}
        </div>

        <div v-for="shelf in shelves" :key="shelf.key" class="mb-4">
          <div class="ui-sectionhead">{{ shelf.title }}</div>

          <div class="flex flex-wrap gap-1.5">
            <!-- Click as well as drag: drag does not exist on touch. A div, not a
                 button, for the same reason .ui-tab is one — keyboard support
                 comes back by hand. -->
            <div
              v-for="chip in shelf.items" :key="chip.itemKey"
              class="ui-chip ui-chip-draggable"
              :class="{ 'ui-chip-dragging': draggingKey === chip.itemKey }"
              role="button" tabindex="0"
              draggable="true"
              @dragstart="onDragStart($event, chip)"
              @dragend="draggingKey = null"
              @click="addLine(chip.itemKey)"
              @keydown.enter="addLine(chip.itemKey)"
              @keydown.space.prevent="addLine(chip.itemKey)"
            >
              <span class="capitalize">{{ chip.name }}</span>
              <span class="ui-chip-meta">{{ formatQty(chip.stock) }} {{ chip.unit }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
