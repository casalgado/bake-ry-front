<script setup>
/* La Bodega — the home of Inventario. Left: what we have. Right: the story of
 * one item, and the three ways to correct it.
 *
 * The one rule the screen is shaped by: the number is never editable. It is
 * derived from an append-only ledger, so you record what happened and the
 * number moves. There is no "poner existencia en" field anywhere.
 *
 * Everything in pesos here is a client-side join: a stocks doc carries
 * itemKey/name/unit/currentStock and nothing else, so cost comes from the
 * catalog and an item the catalog cannot resolve renders `—`, never $0.
 *
 * The three actions are inline forms, not modals (the ruling at
 * RecipeBookView.vue:790 — there is no ui-modal and one screen does not earn
 * the first). Picking one replaces the history and returns to it on save. */
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  PhArrowDown, PhSparkle, PhListChecks, PhPackage,
  PhPlusMinus, PhTrash, PhArrowsLeftRight, PhCaretDown,
} from '@phosphor-icons/vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import UiSearchField from '@/components/ui/UiSearchField.vue';
import { useStockStore } from '@/stores/stockStore';
import { useInventoryDocsStore } from '@/stores/inventoryDocsStore';
import { useItemCatalog, itemOfStock, SHELF_TITLES } from '@/composables/useItemCatalog';
import { useWarehouses } from '@/composables/useWarehouses';
import { formatMoney, formatQty, formatSignedQty } from '@/utils/helpers';
import { formatDateDisplay } from '@/utils/dateUtils';

const router = useRouter();
const stockStore = useStockStore();
const docsStore = useInventoryDocsStore();
const catalog = useItemCatalog();
const { warehouses, multiWarehouse, warehouseName } = useWarehouses();

/* ---------------- the three jobs ---------------- */

/* Each is its own route and its own sidebar link, so these buttons navigate
 * rather than open a tab. They also carry what is waiting there — the job the
 * tab rail's badge used to do. The button you would press to get somewhere is
 * the honest place to say what is already sitting there. */
const WORK = [
  { kind: 'ingreso', label: 'Ingreso', icon: PhArrowDown, solid: true },
  { kind: 'produccion', label: 'Producción', icon: PhSparkle, solid: false },
  { kind: 'conteo', label: 'Conteo', icon: PhListChecks, solid: false },
];

const countableIn = (warehouseId) =>
  stockStore.items.filter((s) => s.warehouseId === warehouseId).length;

const progressOf = (kind) => {
  const doc = docsStore.docs[kind];
  if (!doc) return '';

  if (kind === 'conteo') {
    const counted = Object.keys(doc.counted).length;
    return counted ? `${counted}/${countableIn(doc.warehouseId)}` : '';
  }

  return doc.lines.length
    ? `${doc.lines.length} línea${doc.lines.length === 1 ? '' : 's'}`
    : '';
};

const goTo = (kind) => router.push(`/dashboard/inventory/${kind}`);

/* ---------------- left: the shelves ---------------- */

const search = ref('');
const warehouseFilter = ref(null); // null = todas

const scopedStocks = computed(() =>
  stockStore.items.filter(
    (s) => !warehouseFilter.value || s.warehouseId === warehouseFilter.value));

/* Stock is held per (item, bodega), so one item can be several docs. The shelf
 * lists the ITEM: group by itemKey and sum. With one bodega every group has
 * exactly one member and the expander below never renders. */
const groups = computed(() => {
  const byKey = new Map();

  scopedStocks.value.forEach((stock) => {
    const group = byKey.get(stock.itemKey) ?? {
      itemKey: stock.itemKey,
      item: itemOfStock(stock),
      // The catalog is fresher than the stocks doc's denormalized copy, but an
      // item deleted from the catalog still has stock and still needs a label.
      name: catalog.nameOf(itemOfStock(stock)) || stock.name,
      unit: stock.unit,
      qty: 0,
      rows: [],
    };

    group.qty += stock.currentStock || 0;
    group.rows.push(stock);
    byKey.set(stock.itemKey, group);
  });

  return [...byKey.values()]
    .map((group) => ({
      ...group,
      cost: catalog.costOf(group.item),
      kind: catalog.kindOf(group.item),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
});

const valueOf = (group) => (group.cost === null ? null : group.qty * group.cost);

/* The hero ignores the search box on purpose: filtering the list is looking,
 * not changing what the bodega is worth. The bodega chips do narrow it —
 * that IS a different bodega. */
const totalValue = computed(() =>
  groups.value.reduce((sum, g) => sum + (valueOf(g) ?? 0), 0));

/* A cost the catalog could not resolve makes the total silently low, so the
 * screen says so rather than quietly under-reporting. */
const unresolvedCount = computed(
  () => groups.value.filter((g) => g.cost === null).length);

const matchesSearch = (name) => {
  const q = search.value.trim().toLowerCase();
  return !q || (name || '').toLowerCase().includes(q);
};

/* An ingredient WITH a recipe is a preparación, without one an ingrediente; a
 * product is a producto. The split and its labels are the catalog's — the same
 * three shelves the recetario and the two document screens name. */
const shelves = computed(() =>
  Object.entries(SHELF_TITLES)
    .map(([key, title]) => ({
      key,
      title,
      items: groups.value.filter(
        (g) => g.kind === key && matchesSearch(g.name)),
    }))
    .filter((shelf) => shelf.items.length));

const expanded = ref({});

/* ---------------- right: one item ---------------- */

const selectedKey = ref(null);
const selected = computed(
  () => groups.value.find((g) => g.itemKey === selectedKey.value) ?? null);

const movements = ref([]);
const movementsLoading = ref(false);
const movementsError = ref('');

/* One item's history across every bodega it has been held in — that is what the
 * backend's (itemKey, timestamp) index serves, and narrowing to one bodega
 * would have to happen in the query rather than after the limit. */
async function loadMovements(itemKey) {
  movements.value = [];
  if (!itemKey) return;

  movementsLoading.value = true;
  movementsError.value = '';
  try {
    movements.value = await stockStore.getMovements(itemKey, { limit: 200 });
  } catch (err) {
    movementsError.value = err?.message || 'No se pudo leer el historial.';
  } finally {
    movementsLoading.value = false;
  }
}

// Labels the user recognizes — nobody "sells" harina, las ventas la consumen.
const TYPE_LABELS = {
  purchase: 'Comprado',
  sale: 'Consumido',
  production: 'Producción',
  count: 'Conteos',
  adjustment: 'Ajustes',
  waste: 'Bajas',
  transfer: 'Traslados',
  compensation: 'Correcciones',
};

// Stored English, rendered Spanish — the ledger groups by the enum forever.
const WASTE_REASONS = [
  { value: 'damaged', label: 'Dañado' },
  { value: 'expired', label: 'Vencido' },
  { value: 'lost', label: 'Perdido' },
  { value: 'other', label: 'Otro' },
];

const wasteLabel = (reason) =>
  WASTE_REASONS.find((r) => r.value === reason)?.label ?? reason;

/* "¿Cuánto compré, cuánto usé, cuánto perdí?" — totals per movement type over
 * what was fetched. */
const summary = computed(() => {
  const totals = new Map();
  movements.value.forEach((m) => {
    totals.set(m.type, (totals.get(m.type) || 0) + (m.qty || 0));
  });

  return [...totals.entries()].map(([type, qty]) => ({
    type,
    label: TYPE_LABELS[type] || type,
    qty,
  }));
});

const whyOf = (movement) => {
  const refs = movement.refs || {};
  if (refs.orderId) return `pedido ${refs.orderId.slice(0, 6)}`;
  if (refs.purchaseId) return 'compra';
  if (refs.countId) return 'conteo';
  if (refs.productionId) return 'producción';
  if (refs.transferId) {
    return `${movement.qty < 0 ? 'hacia' : 'desde'} otra bodega`;
  }
  if (movement.type === 'waste') {
    return [wasteLabel(movement.reason), movement.note].filter(Boolean).join(' · ');
  }
  return movement.reason || '';
};

/* ---------------- the three corrections ---------------- */

const form = ref(null); // 'adjust' | 'waste' | 'transfer'
const draft = ref({});
const submitting = ref(false);
const formError = ref('');

const FORM_TITLES = {
  adjust: 'Ajustar existencia',
  waste: 'Registrar baja',
  transfer: 'Transferir a otra bodega',
};

/* Changing item drops a half-filled form: it was about the other thing. */
watch(selectedKey, (itemKey) => {
  form.value = null;
  loadMovements(itemKey);
});

function openForm(kind) {
  formError.value = '';
  draft.value = {
    qty: null,
    reason: kind === 'waste' ? 'damaged' : '',
    note: '',
    // A movement is never implicit about its bodega: stock is held per (item,
    // bodega), so the form says which even when there is only one to say.
    warehouseId: selected.value?.rows[0]?.warehouseId ?? warehouses.value[0].id,
    toWarehouseId: '',
    /* The retry contract (backend `retryId`): one key per submission, reused by
     * a retry after a failure, so a request that timed out but landed cannot
     * write a second movement. */
    idempotencyKey: crypto.randomUUID(),
  };
  form.value = kind;
}

const stockIn = (warehouseId) =>
  selected.value?.rows.find((r) => r.warehouseId === warehouseId)?.currentStock ?? 0;

async function submitForm() {
  const item = selected.value;
  const d = draft.value;
  const qty = Number(d.qty);

  formError.value = '';

  if (!Number.isFinite(qty) || qty === 0) {
    formError.value = 'Escribe una cantidad.';
    return;
  }

  if (form.value === 'adjust' && !d.reason.trim()) {
    formError.value = 'Un ajuste necesita un motivo.';
    return;
  }

  if (form.value !== 'adjust' && qty <= 0) {
    formError.value = 'La cantidad debe ser positiva.';
    return;
  }

  if (form.value === 'transfer' && !d.toWarehouseId) {
    formError.value = 'Elige la bodega de destino.';
    return;
  }

  submitting.value = true;
  try {
    if (form.value === 'adjust') {
      await stockStore.adjust(item.itemKey, {
        qty,
        reason: d.reason.trim(),
        warehouseId: d.warehouseId,
        idempotencyKey: d.idempotencyKey,
      });
    } else if (form.value === 'waste') {
      // The form asks how much was lost; the ledger stores the loss as negative.
      await stockStore.waste(item.itemKey, {
        qty: -qty,
        reason: d.reason,
        note: d.note.trim() || null,
        warehouseId: d.warehouseId,
        idempotencyKey: d.idempotencyKey,
      });
    } else {
      await stockStore.transfer(item.itemKey, {
        qty,
        fromWarehouseId: d.warehouseId,
        toWarehouseId: d.toWarehouseId,
        idempotencyKey: d.idempotencyKey,
      });
    }

    form.value = null;
    await loadMovements(item.itemKey);
  } catch (err) {
    formError.value = err?.message || 'No se pudo registrar el movimiento.';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <PageHeader title="Existencias" subtitle="Qué hay ahora mismo, y si ese número es cierto." />

  <div class="ui-app">
    <div class="ui-panes" style="--panes: minmax(0, 1fr) minmax(0, 1.05fr)">
      <!-- ---------------- left: the bodega ---------------- -->
      <div class="ui-pane">
        <div class="ui-panehead">
          <span class="ui-panehead-title">Bodega</span>
          <span class="ui-panehead-sub">
            {{ groups.length }} artículo{{ groups.length === 1 ? '' : 's' }}
          </span>
        </div>

        <div class="ui-stat ui-stat-hero mb-4">
          <span class="ui-stat-k">Valor en bodega</span>
          <span class="ui-stat-v">{{ formatMoney(totalValue) }}</span>
        </div>

        <!-- The one thing you came to do is Ingreso; the other two sit beside it.
             A count after the label means work is parked on that screen. -->
        <div class="flex flex-wrap gap-1.5 mb-4">
          <button
            v-for="w in WORK" :key="w.kind"
            class="ui-btn"
            :class="{ 'ui-btn-solid': w.solid }"
            @click="goTo(w.kind)"
          >
            <component :is="w.icon" :size="14" weight="bold" />
            {{ w.label }}<template v-if="progressOf(w.kind)"> · {{ progressOf(w.kind) }}</template>
          </button>
        </div>

        <!-- Only with more than one bodega. With one, the concept does not exist
             anywhere on this screen. -->
        <div v-if="multiWarehouse" class="flex flex-wrap gap-1.5 mb-3">
          <button
            class="ui-chip"
            :aria-current="warehouseFilter === null"
            @click="warehouseFilter = null"
          >Todas</button>
          <button
            v-for="w in warehouses" :key="w.id"
            class="ui-chip"
            :aria-current="warehouseFilter === w.id"
            @click="warehouseFilter = w.id"
          >{{ w.name }}</button>
        </div>

        <UiSearchField
          v-model="search"
          class="mb-4"
          placeholder="Buscar artículo…"
          label="Buscar artículo"
        />

        <div v-if="stockStore.loading && !groups.length" class="ui-empty">
          Cargando existencias…
        </div>
        <div v-else-if="stockStore.error" class="ui-empty">
          <b>No se pudieron cargar las existencias</b>
          {{ stockStore.error }}
        </div>
        <div v-else-if="!stockStore.items.length" class="ui-empty">
          <b>Todavía no llevas inventario de nada</b>
          Activa el control de existencias en un ingrediente o en un producto y
          aparecerá aquí.
        </div>
        <div v-else-if="!shelves.length" class="ui-empty">
          Nada coincide con esa búsqueda.
        </div>

        <div v-for="shelf in shelves" :key="shelf.key" class="mb-4">
          <div class="ui-sectionhead">{{ shelf.title }}</div>

          <TransitionGroup tag="div" name="ui-cascade" class="flex flex-col">
            <div v-for="(g, i) in shelf.items" :key="g.itemKey" :style="{ '--i': i }">
              <button
                class="ui-item"
                :class="{
                  'ui-item-zero': g.qty === 0,
                  'ui-item-negative': g.qty < 0,
                }"
                :aria-current="selectedKey === g.itemKey"
                @click="selectedKey = g.itemKey"
              >
                <span class="ui-item-icon"><PhPackage :size="16" /></span>
                <span class="min-w-0">
                  <span class="ui-item-title block capitalize">{{ g.name }}</span>
                  <!-- Only with more than one bodega, and only when it says
                       something: one holding is what the row already shows. -->
                  <span
                    v-if="multiWarehouse && g.rows.length > 1"
                    class="ui-item-desc"
                  >en {{ g.rows.length }} bodegas</span>
                </span>
                <span class="ui-item-trail">
                  <span class="ui-item-num ui-num">
                    {{ formatQty(g.qty) }}<span class="ui-unit">{{ g.unit }}</span>
                  </span>
                  <span class="ui-item-meta w-20 text-right shrink-0">
                    {{ valueOf(g) === null ? '—' : formatMoney(valueOf(g)) }}
                  </span>
                </span>
              </button>

              <button
                v-if="multiWarehouse && g.rows.length > 1"
                class="ui-btn ui-btn-icon ml-3 mb-1"
                :aria-label="'Ver bodegas de ' + g.name"
                :aria-expanded="!!expanded[g.itemKey]"
                @click="expanded[g.itemKey] = !expanded[g.itemKey]"
              >
                <PhCaretDown :size="12" weight="bold" />
              </button>

              <div v-if="multiWarehouse && expanded[g.itemKey]" class="pl-8">
                <div
                  v-for="row in g.rows" :key="row.id"
                  class="ui-item ui-item-divided"
                >
                  <span />
                  <span class="ui-item-desc">{{ warehouseName(row.warehouseId) }}</span>
                  <span class="ui-item-trail">
                    <span class="ui-item-meta ui-num">
                      {{ formatQty(row.currentStock) }}<span class="ui-unit">{{ g.unit }}</span>
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </TransitionGroup>
        </div>

        <p v-if="unresolvedCount" class="ui-item-desc mt-2">
          {{ unresolvedCount }} artículo(s) sin costo resuelto — el valor de arriba
          se queda corto hasta que su ingrediente o producto vuelva a existir.
        </p>
      </div>

      <!-- ---------------- right: one item ---------------- -->
      <div class="ui-pane ui-pane-sunken">
        <div v-if="!selected" class="ui-empty">
          <b>Ninguna selección</b>
          Elige un artículo para ver su historia.
        </div>

        <template v-else>
          <div class="ui-panehead">
            <span class="ui-panehead-title capitalize">{{ selected.name }}</span>
            <span class="ui-panehead-sub">
              {{ formatQty(selected.qty) }} {{ selected.unit }}
              · {{ valueOf(selected) === null ? '—' : formatMoney(valueOf(selected)) }}
              · costo
              {{ selected.cost === null
                ? '—'
                : formatMoney(selected.cost, { maxFractionDigits: 1 }) + '/' + selected.unit }}
            </span>
          </div>

          <div class="ui-stat ui-stat-hero mb-4">
            <span class="ui-stat-k">Existencia</span>
            <span class="ui-stat-v">
              {{ formatQty(selected.qty) }}<span class="ui-unit">{{ selected.unit }}</span>
            </span>
          </div>

          <div class="flex flex-wrap gap-1.5 mb-4">
            <button class="ui-btn" @click="openForm('adjust')">
              <PhPlusMinus :size="14" weight="bold" /> Ajustar
            </button>
            <button class="ui-btn" @click="openForm('waste')">
              <PhTrash :size="14" weight="bold" /> Registrar baja
            </button>
            <button v-if="multiWarehouse" class="ui-btn" @click="openForm('transfer')">
              <PhArrowsLeftRight :size="14" weight="bold" /> Transferir
            </button>
          </div>

          <!-- The form takes the history's place and gives it back on save or
               cancel, so the pane never holds two things at once. -->
          <form v-if="form" class="ui-card flex flex-col gap-3" @submit.prevent="submitForm">
            <span class="ui-card-title">{{ FORM_TITLES[form] }}</span>

            <p v-if="form === 'adjust'" class="ui-card-body">
              El ajuste es una corrección de información: escribe cuánto sobra o
              falta, no la existencia final.
            </p>
            <p v-else-if="form === 'waste'" class="ui-card-body">
              Una baja es valor que se perdió. Se registra aparte de los ajustes
              para que la merma se pueda separar después.
            </p>

            <div class="flex flex-wrap gap-2">
              <label class="ui-field flex-1 min-w-[7rem]">
                <span class="ui-field-k">
                  {{ form === 'adjust' ? 'Cantidad (negativa para restar)' : 'Cantidad' }}
                </span>
                <input
                  v-model="draft.qty"
                  class="ui-input ui-input-num"
                  type="number" step="any" placeholder="0"
                >
              </label>

              <label v-if="form === 'waste'" class="ui-field flex-1 min-w-[7rem]">
                <span class="ui-field-k">Motivo</span>
                <select v-model="draft.reason" class="ui-input" required>
                  <option v-for="r in WASTE_REASONS" :key="r.value" :value="r.value">
                    {{ r.label }}
                  </option>
                </select>
              </label>

              <label v-if="multiWarehouse" class="ui-field flex-1 min-w-[8rem]">
                <span class="ui-field-k">
                  {{ form === 'transfer' ? 'Desde' : 'Bodega' }}
                </span>
                <select v-model="draft.warehouseId" class="ui-input">
                  <option v-for="w in warehouses" :key="w.id" :value="w.id">
                    {{ w.name }} · {{ formatQty(stockIn(w.id)) }} {{ selected.unit }}
                  </option>
                </select>
              </label>

              <label v-if="form === 'transfer'" class="ui-field flex-1 min-w-[8rem]">
                <span class="ui-field-k">Hacia</span>
                <select v-model="draft.toWarehouseId" class="ui-input" required>
                  <option value="" disabled>Elige…</option>
                  <option
                    v-for="w in warehouses.filter((x) => x.id !== draft.warehouseId)"
                    :key="w.id" :value="w.id"
                  >{{ w.name }}</option>
                </select>
              </label>
            </div>

            <label v-if="form === 'adjust'" class="ui-field">
              <span class="ui-field-k">Motivo</span>
              <input
                v-model="draft.reason"
                class="ui-input"
                type="text"
                placeholder="carga inicial, sobró de producción…"
                required
              >
            </label>

            <label v-if="form === 'waste'" class="ui-field">
              <span class="ui-field-k">Nota (opcional)</span>
              <input
                v-model="draft.note"
                class="ui-input"
                type="text"
                placeholder="se rompió el bulto…"
              >
            </label>

            <p v-if="formError" class="ui-item-desc">{{ formError }}</p>

            <div class="flex justify-end gap-1.5">
              <button class="ui-btn" type="button" :disabled="submitting" @click="form = null">
                Cancelar
              </button>
              <button class="ui-btn ui-btn-solid" type="submit" :disabled="submitting">
                {{ submitting ? 'Registrando…' : 'Registrar' }}
              </button>
            </div>
          </form>

          <template v-else>
            <div v-if="movementsLoading" class="ui-empty">Cargando movimientos…</div>
            <div v-else-if="movementsError" class="ui-empty">
              <b>No se pudo leer el historial</b>
              {{ movementsError }}
            </div>

            <template v-else>
              <div v-if="summary.length" class="flex flex-wrap gap-x-7 gap-y-3 mb-4">
                <span v-for="row in summary" :key="row.type" class="ui-stat">
                  <span class="ui-stat-k">{{ row.label }}</span>
                  <span class="ui-stat-v">
                    {{ formatSignedQty(row.qty) }}<span class="ui-unit">{{ selected.unit }}</span>
                  </span>
                </span>
              </div>

              <div class="ui-panehead">
                <span class="ui-panehead-title">Movimientos</span>
                <span class="ui-panehead-sub">{{ movements.length }} registros</span>
              </div>

              <div v-if="!movements.length" class="ui-empty">
                <b>Sin movimientos todavía</b>
                Registra un ingreso, una producción o un ajuste y aparecerán aquí.
              </div>

              <div
                v-for="m in movements" :key="m.id"
                class="ui-item ui-item-divided"
              >
                <span class="ui-item-meta w-14 shrink-0">
                  {{ formatDateDisplay(m.timestamp) }}
                </span>
                <span class="min-w-0">
                  <span class="ui-item-title block">
                    {{ TYPE_LABELS[m.type] || m.type }}
                  </span>
                  <span v-if="whyOf(m)" class="ui-item-desc">{{ whyOf(m) }}</span>
                </span>
                <span class="ui-item-trail">
                  <span class="ui-item-num ui-num">
                    {{ formatSignedQty(m.qty) }}<span class="ui-unit">{{ selected.unit }}</span>
                  </span>
                </span>
              </div>
            </template>
          </template>
        </template>
      </div>
    </div>
  </div>
</template>
