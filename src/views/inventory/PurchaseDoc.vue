<script setup>
/* Ingreso: lo que llegó de afuera.
 *
 * Two panes, like Producción, and for the same reason — not because a delivery
 * is composed from a palette (it is not; it is transcribed off a piece of paper,
 * which is why the right side is never a shelf of chips) but because a purchase
 * has a CONSEQUENCE the left side cannot show:
 *
 *   1. los costos que cambian — lo que pagaste hoy contra el costo guardado,
 *   2. las existencias que deja — lo que había más lo que llegó.
 *
 * Both are computed from data already in this component; neither needs an
 * endpoint. El subtotal y el total se quedan a la izquierda, con las líneas que
 * los producen.
 *
 * What you can buy: ingredientes sin receta, y productos de reventa. Never a
 * product you make yourself — croissants come from Producción, and letting them
 * be "bought" here would put a purchase movement on something that has no
 * supplier. The rule is one expression, in `catalogItems` below.
 *
 * The picker is built against the CATALOG, not against the stocks docs. Buying
 * something for the first time is the normal case, and a shelf made of stocks
 * docs could not represent it — that is the hole this screen used to have.
 * Which means a line carries its IDENTITY (`{ type, id, combinationId }`) as the
 * truth and its `itemKey` only when the item already has one. No itemKey is ever
 * built here: minting them is the backend's job alone (invariant 5), and the
 * purchases endpoint is where a line for a never-stocked item gets one. */
import { ref, computed, onMounted, useId } from 'vue';
import { PhX } from '@phosphor-icons/vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import ToastNotification from '@/components/ToastNotification.vue';
import UiMoneyInput from '@/components/ui/UiMoneyInput.vue';
import UiItemPicker from '@/components/ui/UiItemPicker.vue';
import IngredientCreateCard from '@/components/recipes/IngredientCreateCard.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import { useStockStore } from '@/stores/stockStore';
import { useIngredientStore } from '@/stores/ingredientStore';
import { useProductStore } from '@/stores/productStore';
import { useProviderStore } from '@/stores/providerStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { useInventoryDocsStore } from '@/stores/inventoryDocsStore';
import { useItemCatalog, itemOfStock, combosOf } from '@/composables/useItemCatalog';
import { useWarehouses } from '@/composables/useWarehouses';
import { formatMoney, formatUnitCost, formatQty, parseNumericInput } from '@/utils/helpers';

const stockStore = useStockStore();
const ingredientStore = useIngredientStore();
const productStore = useProductStore();
const providerStore = useProviderStore();
const bakerySettingsStore = useBakerySettingsStore();
const docsStore = useInventoryDocsStore();
const catalog = useItemCatalog();
const { warehouses, multiWarehouse, defaultWarehouseId } = useWarehouses();

/* Opened once, on mount, not inside a computed: creating a document is a side
 * effect and a computed must not have one. Idempotent, so coming back finds the
 * delivery where you left it. */
docsStore.open('ingreso', defaultWarehouseId.value);
const doc = computed(() => docsStore.docs.ingreso);

/* The same screen serves a business with inventory, one with accounting, or
 * both. The stock-only parts show with inventory; the invoice taxes with
 * accounting. The invoice fields are local: they are not part of the saved
 * draft in inventoryDocsStore. */
const uid = useId();
const inventoryOn = computed(() => bakerySettingsStore.isInventoryEnabled);
const accountingOn = computed(() => bakerySettingsStore.isAccountingEnabled);
const blankInvoice = () => ({ ref: '', iva: null, retefuente: null, reteica: null, reteiva: null });
const invoice = ref(blankInvoice());

/* En la cabeza del usuario una Coca-Cola es un producto, no un ingrediente, así
 * que las estanterías se llaman por lo que son aquí — lo que se compra — y no
 * por la tabla en la que viven. */
const TITLES = { ingr: 'Insumos', prod: 'Reventa' };

/* ---------------- the catalog you can buy from ---------------- */

/* One row per sellable unit: a product with variations is bought per
 * combination, because that is what a stocks doc is keyed by. Same split
 * `combosOf` makes everywhere else. */
const identityKey = ({ type, id, combinationId }) =>
  `${type}:${id}:${combinationId ?? ''}`;

/* The identity → stocks doc join, across EVERY bodega. Identity does not depend
 * on where you are looking, and resolving off the destination alone would blank
 * the lines you already wrote the moment you changed where the delivery lands.
 * Only `inStock` below is scoped to a place, because only it is a fact about
 * one. */
const stockByIdentity = computed(() => {
  const byKey = new Map();
  stockStore.items.forEach((stock) => {
    const key = identityKey(itemOfStock(stock));
    if (!byKey.has(key)) byKey.set(key, stock);
  });
  return byKey;
});

const stocksHere = computed(() =>
  stockStore.items.filter((s) => s.warehouseId === doc.value.warehouseId));

const stockHere = (key) =>
  stocksHere.value.find((s) => identityKey(itemOfStock(s)) === key)?.currentStock ?? 0;

const entryOf = (item, name, unit) => {
  const key = identityKey(item);
  return {
    key,
    item,
    name,
    unit,
    cost: catalog.costOf(item),
    kind: catalog.kindOf(item),
    itemKey: stockByIdentity.value.get(key)?.itemKey ?? null,
  };
};

/* THE shelf rule, in one place (zplanning/inventory/INVENTORY.md §4.1):
 *
 *   ingredientes sin recipeId   — harina, azúcar, lo que se compra
 *   productos inventoryMode 'unit' — la gaseosa que revendes tal cual
 *
 * Nothing appears both here and on Producción. An ingredient WITH a recipe is a
 * preparación: you make it, so it is not for sale to you. A product on 'recipe'
 * is a croissant: same reason. 'none' is not tracked in the bodega at all, so
 * receiving one would have nowhere to land. */
const catalogItems = computed(() => {
  const ingredients = ingredientStore.items
    .filter((i) => !i.isDeleted && !i.recipeId)
    .map((i) => entryOf({ type: 'ingredient', id: i.id, combinationId: null }, i.name, i.unit));

  const resale = productStore.items
    .filter((p) => p.inventoryMode === 'unit')
    .flatMap((p) => combosOf(p).map((c) => {
      const item = {
        type: 'product',
        id: p.id,
        combinationId: p.hasVariations ? c.id : null,
      };
      // Full name, colección first: this picker groups by Insumos/Reventa, not
      // by colección, so nothing else on the row says which "Original" it is.
      return entryOf(item, catalog.nameOf(item), 'uds');
    }));

  return [...ingredients, ...resale].sort((a, b) => a.name.localeCompare(b.name));
});

const entryByKey = computed(() => new Map(catalogItems.value.map((e) => [e.key, e])));

/* What the picker renders. `meta` is what the destination bodega holds today —
 * the number you are about to change, so it belongs beside the name. */
const pickerItems = computed(() =>
  catalogItems.value.map((e) => ({
    key: e.key,
    name: e.name,
    kind: e.kind,
    sub: e.itemKey ? '' : 'primera compra',
    meta: inventoryOn.value ? `${formatQty(stockHere(e.key))} ${e.unit}` : '',
  })));

/* ---------------- the provider ---------------- */

const PROVIDER_TITLES = { prov: 'Proveedores' };

const providerItems = computed(() =>
  providerStore.items
    .filter((p) => !p.isDeleted)
    .map((p) => ({
      key: p.id,
      name: p.name,
      kind: 'prov',
      sub: p.nationalId ? `NIT ${p.nationalId}` : '',
    })));

const providerName = computed(() =>
  providerStore.items.find((p) => p.id === doc.value.providerId)?.name ?? 'Proveedor');

/* identityKey → what this provider charged per unit last time. A line's total
 * follows qty × that price until the invoice's number is typed, and a typed
 * price that differs gets flagged against it. */
const lastPrices = ref(new Map());
const loadingLast = ref(false);

async function loadLastPurchase(providerId) {
  lastPrices.value = new Map();
  if (!providerId) return null;

  loadingLast.value = true;
  try {
    const last = await providerStore.getLastPurchase(providerId);
    // The provider changed while this was in flight: its prices are not ours.
    if (doc.value.providerId !== providerId) return null;
    lastPrices.value = new Map((last?.lines ?? []).map((l) => [identityKey(l.item), l.unitCost]));
    return last;
  } catch {
    return null;
  } finally {
    // A request for a provider no longer picked doesn't own the flag.
    if (doc.value.providerId === providerId) loadingLast.value = false;
  }
}

/* The basket: casi siempre le compras lo mismo, en las mismas cantidades, a la
 * misma persona. Only onto an empty document; a provider picked after lines
 * exist brings prices, not lines. You correct what differs on today's invoice. */
async function selectProvider(id) {
  doc.value.providerId = id;
  const last = await loadLastPurchase(id);
  if (!last || doc.value.lines.length) return;

  doc.value.lines = last.lines
    .map((l) => ({ entry: entryByKey.value.get(identityKey(l.item)), qty: l.qty }))
    .filter(({ entry }) => entry)
    .map(({ entry, qty }) => ({ ...lineOf(entry), qty }));
}

function clearProvider() {
  doc.value.providerId = null;
  lastPrices.value = new Map();
}

async function createProvider(name) {
  formError.value = '';
  try {
    const created = await providerStore.create({ name });
    await selectProvider(created.id);
  } catch (err) {
    formError.value = err?.message || 'No se pudo crear el proveedor.';
  }
}

onMounted(() => {
  if (!providerStore.items.length) providerStore.fetchAll().catch(() => {});
  loadLastPurchase(doc.value.providerId);
});

/* ---------------- the document ---------------- */

/* A line is identity plus the two numbers the invoice states: CUÁNTO llegó y
 * CUÁNTO costó en total. El costo por unidad no se escribe, se deriva — es una
 * división que la factura ya hizo al revés y que nadie debería tener que
 * rehacer de cabeza.
 *
 * Name, unit and current stock are joined back at render, so a refetch never
 * leaves a stale copy in the document. */
const rows = computed(() =>
  doc.value.lines.map((line, i) => {
    const entry = entryByKey.value.get(line.key);
    const inStock = stockHere(line.key);
    const lastUnitCost = lastPrices.value.get(line.key) ?? null;

    /* Back-compat: drafts written before the line carried a total stored a
     * unitCost instead. Drop this the day no browser can still be holding
     * one. */
    const typed = line.total ?? (line.unitCost != null && line.qty
      ? line.unitCost * line.qty
      : null);

    /* No total typed yet: the provider's last price fills in, marked as such. It
     * shows even before a quantity is typed; the total waits for the quantity. */
    const estimated = typed === null && lastUnitCost !== null;
    const paid = estimated
      ? (line.qty > 0 ? line.qty * lastUnitCost : null)
      : typed;
    const unitCost = estimated
      ? lastUnitCost
      : (paid !== null && line.qty > 0 ? paid / line.qty : null);

    return {
      ...line,
      _i: i,
      name: entry?.name ?? line.name ?? line.key,
      unit: entry?.unit ?? line.unit ?? '',
      kind: entry?.kind ?? 'ingr',
      inStock,
      isNew: !entry?.itemKey,
      paid,
      estimated,
      /* Sin cantidad no hay costo por unidad: dividir por cero inventaría un
       * número, y `null` ya significa "todavía no se sabe" en toda la pantalla. */
      unitCost,
      lastUnitCost,
      /* Against this provider's last price. No last price, no flag: never an
       * invented baseline. */
      priceChange: !estimated && lastUnitCost > 0 && unitCost !== null
        && Math.abs(unitCost - lastUnitCost) > 0.005
        ? (unitCost - lastUnitCost) / lastUnitCost
        : null,
      /* What the catalog believes today — the number the right pane compares
       * against. `null` means the join failed, never $0, or a catalog that did
       * not load would read as "bajó a cero". */
      storedCost: entry?.cost ?? null,
      after: inStock + (line.qty || 0),
    };
  }));

const total = computed(() =>
  rows.value.reduce((sum, row) => sum + (row.paid ?? 0), 0));

const unpricedCount = computed(() => rows.value.filter((r) => r.paid === null).length);

const blankQuantities = computed(
  () => doc.value.lines.filter((l) => !(l.qty > 0)).length);

const lineOf = (entry) => ({
  key: entry.key,
  /* Identity is the truth; itemKey is a convenience the backend may not have
   * minted yet. `name`/`unit` ride along ONLY so a line survives a catalog that
   * failed to load — every render prefers the joined value. */
  item: entry.item,
  itemKey: entry.itemKey,
  name: entry.name,
  unit: entry.unit,
  qty: 1,
  /* Blank. Until a total is typed, `rows` uses qty × the provider's last price,
   * marked "precio anterior", and that estimate is what Confirmar sends: the
   * basket exists so you only correct what changed on today's invoice. */
  total: null,
});

function addLine(key) {
  const existing = doc.value.lines.find((l) => l.key === key);

  if (existing) {
    doc.value.lines = doc.value.lines.map((l) =>
      (l.key === key ? { ...l, qty: (l.qty || 0) + 1 } : l));
    return;
  }

  const entry = entryByKey.value.get(key);
  if (!entry) return;

  doc.value.lines = [...doc.value.lines, lineOf(entry)];
}

const setField = (index, field, value) => {
  const next = parseNumericInput(value);
  doc.value.lines = doc.value.lines.map((l, i) =>
    (i === index ? { ...l, [field]: next } : l));
};

const removeLine = (index) =>
  (doc.value.lines = doc.value.lines.filter((_, i) => i !== index));

/* ---------------- what this changes ---------------- */

/* Los artículos cuyo costo esta compra podría cambiar: insumos y productos de
 * reventa. On by default: the last price paid is almost always the right cost.
 * A line only stores `updateCost: false` when it's unticked, to keep a one-off
 * price (a sale, a bad invoice) out of the catalog. Ticked lines take this
 * invoice's unit cost at confirm, in the purchase's own transaction, and the
 * recipes using a ticked ingredient re-cost. Preparaciones never reach this
 * screen.
 *
 * A tolerance and not `!==`: retyping the same number with a trailing zero must
 * not make a row appear and vanish under your cursor. */
/* A resale product (or combination) whose cost comes from a recipe is never
 * overwritten by a purchase, so it offers no cost update. */
const costFromRecipe = (item) => {
  if (item?.type !== 'product') return false;
  const product = productStore.items.find((p) => p.id === item.id);
  const source = item.combinationId
    ? product?.variations?.combinations?.find((c) => c.id === item.combinationId)?.costPriceSource
    : product?.costPriceSource;
  return source === 'recipe';
};

const drift = computed(() => rows.value
  // A $0 line (a gift, a sample) never sets a cost; the backend skips it too.
  .filter((r) => r.storedCost !== null
    && r.unitCost > 0
    && !costFromRecipe(r.item)
    && Math.abs(r.unitCost - r.storedCost) > 0.005)
  .map((r) => ({
    ...r,
    /* A stored 0 is "nunca tuvo costo", not a drop from something, so there is
     * no percentage to show for it. */
    pct: r.storedCost > 0 ? (r.unitCost - r.storedCost) / r.storedCost : null,
  })));

const setUpdateCost = (index, value) => {
  doc.value.lines = doc.value.lines.map((l, i) =>
    (i === index ? { ...l, updateCost: value } : l));
};

const willUpdateCost = (row) => row.updateCost !== false;

const costUpdates = computed(() => drift.value.filter(willUpdateCost));

/* Solo ingredientes: un artículo de reventa también entra a la bodega, pero lo
 * que se mira antes de confirmar es la materia prima. La nota de abajo dice
 * cuántas líneas quedaron fuera, para que la omisión se lea en pantalla en vez
 * de esconderse. */
const projection = computed(() => rows.value.filter((r) => r.item?.type === 'ingredient'));

const resaleLeftOut = computed(() => rows.value.length - projection.value.length);

/* ---------------- creating what you are buying for the first time ---------- */

const creatingName = ref('');

const categories = computed(() =>
  (bakerySettingsStore.items[0]?.ingredientCategories ?? [])
    .filter((c) => c.isActive !== false));

/* Straight onto the document — you only created it because it is on the invoice
 * in front of you. The refetch is what makes `catalogItems` see it, and the
 * store's create already pushed it, so the entry resolves on the next tick.
 *
 * La cantidad y el total ya se escribieron en la tarjeta, así que la línea nace
 * con ellos: volver a pedirlos sería pedir dos veces lo mismo. */
async function onIngredientCreated(created, purchased) {
  creatingName.value = '';
  await ingredientStore.fetchAll().catch(() => {});

  const key = identityKey({ type: 'ingredient', id: created.id, combinationId: null });
  addLine(key);
  if (!purchased) return;

  doc.value.lines = doc.value.lines.map((l) => (l.key === key
    ? { ...l, qty: purchased.qty ?? l.qty, total: purchased.total }
    : l));
}

/* ---------------- confirming ---------------- */

const submitting = ref(false);
const formError = ref('');
const toastRef = ref(null);

const canConfirm = computed(() => Boolean(doc.value.providerId)
  && rows.value.length > 0
  && rows.value.every((r) => r.qty > 0 && r.paid !== null));

/* Why Confirmar is disabled, in the order the document is filled. */
const blocker = computed(() => {
  if (!rows.value.length) return '';
  if (!doc.value.providerId) return 'Seleccione el proveedor para poder confirmar.';
  if (blankQuantities.value) return `Falta la cantidad en ${blankQuantities.value} línea(s).`;
  if (unpricedCount.value) return `Falta el total pagado en ${unpricedCount.value} línea(s). Se registra según la factura.`;
  return '';
});

/* Cost changes are on by default, so they're spelled out once more before they
 * happen. Cancel goes back to the screen, where unticking a row keeps its cost. */
const costDialogOpen = ref(false);

const costDialogNote = computed(() => {
  const recipes = costUpdates.value.some((r) => r.item?.type === 'ingredient')
    ? 'Las recetas que utilizan estos insumos se recalcularán. '
    : '';
  return `${recipes}Para conservar el costo actual de un artículo, debe desmarcarse `
    + 'su línea antes de confirmar.';
});

function confirmPurchase() {
  if (!canConfirm.value || submitting.value) return;
  if (costUpdates.value.length) {
    costDialogOpen.value = true;
    return;
  }
  submitPurchase();
}

function onCostDialogConfirm() {
  costDialogOpen.value = false;
  submitPurchase();
}

/* The document's idempotencyKey makes a resend after a lost response land on
 * the same purchase. On error the draft stays as it was. */
async function submitPurchase() {
  if (!canConfirm.value || submitting.value) return;
  formError.value = '';

  // Only rows still in the list update: a price retyped back to the stored cost
  // has nothing to update, whatever its checkbox said.
  const updateKeys = new Set(costUpdates.value.map((r) => r.key));
  const updatesCost = (r) => updateKeys.has(r.key);
  const costChanged = updateKeys.size > 0;
  const lineCount = rows.value.length;

  submitting.value = true;
  try {
    await stockStore.purchase({
      providerId: doc.value.providerId,
      date: doc.value.date,
      warehouseId: doc.value.warehouseId,
      idempotencyKey: doc.value.idempotencyKey,
      lines: rows.value.map((r) => ({
        item: r.item,
        qty: r.qty,
        total: r.paid,
        updateCost: updatesCost(r),
      })),
      ...(accountingOn.value && {
        invoiceRef: invoice.value.ref.trim(),
        ivaAmount: invoice.value.iva || 0,
        retefuente: invoice.value.retefuente || 0,
        reteica: invoice.value.reteica || 0,
        reteiva: invoice.value.reteiva || 0,
      }),
    });

    reset();
    toastRef.value?.showSuccess('Compra de insumos', `Compra registrada: ${lineCount} línea(s).`);
    if (costChanged) {
      Promise.all([ingredientStore.fetchAll(), productStore.fetchAll()]).catch(() => {});
    }
  } catch (err) {
    formError.value = err?.message || 'No se pudo registrar la compra.';
  } finally {
    submitting.value = false;
  }
}

/* ---------------- losing work ---------------- */

/* Reopen on the bodega you were pointing at, not the default one: clearing the
 * lines is what you asked for, silently re-routing the delivery is not. A fresh
 * document also mints a fresh idempotencyKey. */
function reset() {
  const { warehouseId } = doc.value;
  docsStore.discard('ingreso');
  docsStore.open('ingreso', warehouseId);
  lastPrices.value = new Map();
  invoice.value = blankInvoice();
}

/* ponytail: native confirm(), same ruling as RecipeBookView — there is no
 * ui-modal and one guard does not earn the first. */
function discard() {
  if (!doc.value.lines.length) return;
  if (!confirm(`Se perderán las ${doc.value.lines.length} línea(s) de esta compra. ¿Descartar?`)) return;
  reset();
}
</script>

<template>
  <div class="p-4 lg:p-6">
    <PageHeader title="Compra de insumos" subtitle="Insumos y productos de reventa recibidos de un proveedor.">
      <span class="ui-panehead-sub">
        {{ doc.lines.length }} línea{{ doc.lines.length === 1 ? '' : 's' }}
      </span>
    </PageHeader>

    <div class="ui-app">
      <!-- Same split as Producción: lo que llegó a la izquierda, lo que eso
           cambia a la derecha. -->
      <div class="ui-panes" style="--panes: minmax(0, 1.35fr) minmax(0, 1fr)">
        <div class="ui-pane">
          <!-- El proveedor primero y solo: casi siempre le compras lo mismo a
               la misma persona, así que es lo que identifica el documento. Vive
               en el documento, nunca en la línea — una entrega, un proveedor. -->
          <div v-if="doc.providerId" class="mb-4">
            <span class="ui-field-k">Proveedor</span>
            <div class="ui-item ui-item-filled mt-1">
              <span class="ui-tag">prov</span>
              <span class="min-w-0">
                <span class="ui-item-title block" :title="providerName">{{ providerName }}</span>
                <span class="ui-item-desc">
                  <template v-if="loadingLast">buscando su última compra…</template>
                  <template v-else-if="lastPrices.size">con los precios de su última compra</template>
                  <template v-else>sin compras anteriores</template>
                </span>
              </span>
              <span class="ui-item-trail">
                <button
                  class="ui-btn ui-btn-icon"
                  aria-label="Cambiar proveedor"
                  title="Cambiar proveedor"
                  @click="clearProvider"
                >
                  <PhX :size="13" weight="bold" />
                </button>
              </span>
            </div>
          </div>

          <UiItemPicker
            v-else
            class="mb-4"
            :items="providerItems"
            :titles="PROVIDER_TITLES"
            allow-create
            placeholder="Buscar o crear un proveedor…"
            label="Proveedor"
            @select="selectProvider"
            @create="createProvider"
          />

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

          <div v-if="accountingOn" class="ui-field mb-4">
            <label class="ui-field-k" :for="`${uid}-ref`">N.º de factura</label>
            <input :id="`${uid}-ref`" v-model="invoice.ref" class="ui-input">
          </div>

          <UiItemPicker
            class="mb-4"
            :items="pickerItems"
            :titles="TITLES"
            allow-create
            placeholder="Buscar un insumo o un producto de reventa…"
            label="Agregar artículo"
            @select="addLine"
            @create="creatingName = $event"
          />

          <!-- Ingredientes solamente: un artículo de reventa es un PRODUCTO, y
               crear uno aquí sería inventarle variaciones, precio y colección
               desde un formulario de compra. -->
          <template v-if="creatingName">
            <IngredientCreateCard
              :name="creatingName"
              :categories="categories"
              :allow-preparacion="false"
              purchase
              autofocus
              @created="onIngredientCreated"
            />
            <p class="ui-item-desc -mt-2 mb-4">
              Aquí solo se crean ingredientes. Los productos de reventa se
              registran en Productos. Las preparaciones en el Recetario.
            </p>
          </template>

          <div v-if="!rows.length" class="ui-empty">
            <b>Esta compra no tiene líneas</b>
            Los artículos se agregan desde el buscador.
          </div>

          <TransitionGroup tag="div" name="ui-cascade" class="flex flex-col gap-1.5">
            <div
              v-for="(row, i) in rows" :key="row.key"
              class="ui-item ui-item-filled ui-item-split"
              :style="{ '--i': i }"
            >
              <span class="ui-tag">{{ row.kind }}</span>

              <span class="min-w-0">
                <!-- title, because .ui-item-title ellipses: at a narrow pane the
                     name is the first thing to give way, and a row you cannot
                     read is a row you cannot check. -->
                <span class="ui-item-title block capitalize" :title="row.name">{{ row.name }}</span>
                <!-- El costo por unidad va aquí y no en un input: es lo que la
                     compra DEJA, no lo que se escribe. Mismo lugar que en el
                     recetario, que es donde ya se lee ese número. -->
                <span class="ui-item-desc">
                  <template v-if="row.unitCost === null">sin costo</template>
                  <template v-else>
                    <b class="ui-num">{{ formatUnitCost(row.unitCost) }}</b>/{{ row.unit }}
                  </template>
                  <template v-if="row.estimated"> · precio anterior</template>
                  <template v-else-if="row.priceChange !== null">
                    · antes <span class="ui-num">{{ formatUnitCost(row.lastUnitCost) }}</span>
                    · {{ row.priceChange > 0 ? 'subió' : 'bajó' }}
                    {{ Math.abs(Math.round(row.priceChange * 100)) }}%
                  </template>
                  <template v-if="inventoryOn">
                    · <template v-if="row.isNew">primera compra</template>
                    <template v-else>en bodega {{ formatQty(row.inStock) }} {{ row.unit }}</template>
                  </template>
                </span>
              </span>

              <span class="ui-item-trail">
                <input
                  class="ui-input ui-input-num w-[5.5rem]"
                  type="number" min="0" step="any"
                  :value="row.qty"
                  :aria-label="'Cantidad de ' + row.name"
                  :aria-invalid="!(row.qty > 0)"
                  @input="setField(row._i, 'qty', $event.target.value)"
                >
                <span class="ui-item-meta w-6 shrink-0">{{ row.unit }}</span>

                <!-- La unidad después del primero y el $ antes del segundo: dos
                     cajas de números seguidas necesitan decir cuál es cuál sin
                     una fila de encabezados. -->
                <span class="ui-item-meta shrink-0">$</span>
                <input
                  class="ui-input ui-input-num w-24"
                  type="number" min="0" step="any"
                  :value="row.paid"
                  placeholder="total"
                  :aria-label="'Total pagado por ' + row.name"
                  title="Lo que dice la factura por esta línea"
                  @input="setField(row._i, 'total', $event.target.value)"
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

          <div
            class="flex flex-wrap items-baseline justify-between gap-x-7 gap-y-3 mt-4 pt-3.5"
            style="border-top: 1px solid var(--ui-line)"
          >
            <span class="ui-stat">
              <span class="ui-stat-k">Total de la compra</span>
              <span class="ui-stat-v">{{ formatMoney(total) }}</span>
            </span>
            <span class="ui-stat">
              <span class="ui-stat-k">Líneas</span>
              <span class="ui-stat-v">{{ doc.lines.length }}</span>
            </span>
          </div>

          <details v-if="accountingOn" class="mt-4">
            <summary class="ui-field-k cursor-pointer">Impuestos</summary>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
              <div class="ui-field">
                <label class="ui-field-k" :for="`${uid}-iva`">IVA</label>
                <UiMoneyInput :id="`${uid}-iva`" v-model="invoice.iva" class="ui-field-unit" />
              </div>
              <div class="ui-field">
                <label class="ui-field-k" :for="`${uid}-rf`">Retefuente</label>
                <UiMoneyInput :id="`${uid}-rf`" v-model="invoice.retefuente" class="ui-field-unit" />
              </div>
              <div class="ui-field">
                <label class="ui-field-k" :for="`${uid}-ri`">ReteICA</label>
                <UiMoneyInput :id="`${uid}-ri`" v-model="invoice.reteica" class="ui-field-unit" />
              </div>
              <div class="ui-field">
                <label class="ui-field-k" :for="`${uid}-rv`">ReteIVA</label>
                <UiMoneyInput :id="`${uid}-rv`" v-model="invoice.reteiva" class="ui-field-unit" />
              </div>
            </div>
          </details>

          <div class="flex flex-wrap items-center gap-1.5 mt-4">
            <button
              class="ui-btn ui-btn-solid"
              :disabled="!canConfirm || submitting"
              @click="confirmPurchase"
            >
              <template v-if="submitting">Registrando…</template>
              <template v-else>
                Confirmar compra<template v-if="costUpdates.length">
                  · actualiza {{ costUpdates.length }} costo{{ costUpdates.length === 1 ? '' : 's' }}</template>
              </template>
            </button>
            <button
              class="ui-btn ui-btn-danger"
              :disabled="!doc.lines.length || submitting"
              @click="discard"
            >Descartar</button>
          </div>
          <p v-if="formError" class="ui-field-error mt-2">{{ formError }}</p>
          <p v-if="blocker" class="ui-item-desc mt-2">{{ blocker }}</p>
          <p class="ui-item-desc mt-2">Borrador guardado solo en este navegador.</p>
        </div>

        <!-- ---------------- right: the consequence ---------------- -->
        <div class="ui-pane ui-pane-sunken">
          <div class="ui-panehead">
            <span class="ui-panehead-title">Costos que se actualizarán</span>
            <span v-if="drift.length" class="ui-panehead-sub">
              {{ costUpdates.length }} de {{ drift.length }}
            </span>
          </div>

          <div v-if="!rows.length" class="ui-empty">
            Al registrar las líneas aparecerán aquí los costos que cambian.
          </div>
          <div v-else-if="!drift.length" class="ui-empty">
            Ningún costo cambia. Los precios de esta compra coinciden con los
            que ya estaban guardados.
          </div>

          <div v-for="row in drift" :key="row.key" class="ui-item ui-item-divided">
            <input
              class="ui-check"
              type="checkbox"
              :checked="willUpdateCost(row)"
              :aria-label="'Actualizar el costo de ' + row.name"
              @change="setUpdateCost(row._i, $event.target.checked)"
            >
            <span class="min-w-0">
              <span class="ui-item-title block capitalize" :title="row.name">{{ row.name }}</span>
              <span class="ui-item-desc">
                <template v-if="row.pct === null">
                  sin costo registrado · ahora
                  <b class="ui-num">{{ formatUnitCost(row.unitCost) }}</b>/{{ row.unit }}
                </template>
                <template v-else>
                  antes <span class="ui-num">{{ formatUnitCost(row.storedCost) }}</span>
                  · ahora
                  <b class="ui-num">{{ formatUnitCost(row.unitCost) }}</b>/{{ row.unit }}
                </template>
              </span>
            </span>
            <span v-if="row.pct !== null" class="ui-item-trail">
              <span class="ui-item-num ui-num">
                {{ row.pct > 0 ? '+' : '' }}{{ Math.round(row.pct * 100) }}<span class="ui-unit">%</span>
              </span>
            </span>
          </div>

          <p v-if="drift.length" class="ui-item-desc mt-3">
            Al confirmar, los artículos marcados quedan con el costo de esta
            compra y las recetas que utilizan esos insumos se recalculan. Para
            conservar el costo actual de un artículo, por ejemplo ante un precio
            de oferta, debe desmarcarse su línea.
          </p>

          <!-- ---------------- how the bodega ends up ---------------- -->
          <div v-if="inventoryOn" class="ui-sectionhead mt-6">Existencias después de esta compra</div>

          <div v-if="inventoryOn && !projection.length" class="ui-empty">
            Al agregar insumos aparecerán aquí sus existencias resultantes.
          </div>

          <div v-for="row in inventoryOn ? projection : []" :key="row.key" class="ui-item ui-item-divided">
            <span />
            <span class="min-w-0">
              <span class="ui-item-title block capitalize" :title="row.name">{{ row.name }}</span>
              <span class="ui-item-desc">
                <template v-if="row.isNew">primera compra</template>
                <template v-else>hay {{ formatQty(row.inStock) }} {{ row.unit }}</template>
              </span>
            </span>
            <span class="ui-item-trail">
              <span class="ui-item-num ui-num">
                {{ formatQty(row.after) }}<span class="ui-unit">{{ row.unit }}</span>
              </span>
            </span>
          </div>

          <p v-if="inventoryOn && resaleLeftOut" class="ui-item-desc mt-3">
            {{ resaleLeftOut }} línea(s) de reventa no se listan aquí. También
            entran a la bodega; esta lista se limita a los insumos, que es lo
            que se revisa antes de confirmar.
          </p>
        </div>
      </div>
    </div>

    <ConfirmDialog
      :is-open="costDialogOpen"
      title="Actualizar costos"
      confirm-text="Confirmar compra"
      cancel-text="Volver"
      @confirm="onCostDialogConfirm"
      @cancel="costDialogOpen = false"
    >
      <!-- Left-aligned inside the dialog's centred body: a centred table is
           harder to scan. The dialog's own (old-system) colors, not ui-*. -->
      <table class="w-full text-sm text-left text-gray-800 mb-3">
        <thead>
          <tr>
            <th class="py-1 font-medium">Artículo</th>
            <th class="py-1 font-medium text-right">Costo</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in costUpdates" :key="r.key" class="border-t border-gray-200">
            <td class="py-1.5 pr-2 capitalize">{{ r.name }}</td>
            <td class="py-1.5 text-right whitespace-nowrap">
              {{ r.pct === null ? 'sin costo' : formatUnitCost(r.storedCost) }}
              →
              <b>{{ formatUnitCost(r.unitCost) }}</b>/{{ r.unit }}
            </td>
          </tr>
        </tbody>
      </table>
      <p class="text-sm text-gray-800 text-left mb-6">{{ costDialogNote }}</p>
    </ConfirmDialog>

    <ToastNotification ref="toastRef" />
  </div>
</template>
