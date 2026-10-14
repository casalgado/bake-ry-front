<script setup>
import { ref, shallowReactive, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import PageHeader from '@/components/ui/PageHeader.vue';
import UiSearchField from '@/components/ui/UiSearchField.vue';
import IngredientCreateCard from '@/components/recipes/IngredientCreateCard.vue';
import AppTooltip from '@/components/common/AppTooltip.vue';
import { useProductStore } from '@/stores/productStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { useIngredientStore } from '@/stores/ingredientStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { useAuthenticationStore } from '@/stores/authentication';
import { useUndoSnapshot } from '@/composables/useUndoSnapshot';
import { useItemCatalog, combosOf } from '@/composables/useItemCatalog';
import { formatMoney, formatUnitCost } from '@/utils/helpers';
import {
  PhFlask, PhX, PhArrowCounterClockwise, PhArrowsLeftRight, PhCheckFat,
} from '@phosphor-icons/vue';

const productStore = useProductStore();
const recipeStore = useRecipeStore();
const ingredientStore = useIngredientStore();
const bakerySettingsStore = useBakerySettingsStore();
const search = ref('');
const selectedId = ref(null);

/* Tab ids are plain strings: 'overview', plus one per open recipe. A tab carries
 * ids rather than the objects themselves, so it survives a refetch and doesn't
 * pin a stale copy of the product.
 *
 * Two kinds of recipe can be open, and they have different owners:
 *
 *   { kind: 'combo', productId, comboId }  — a product combination's recipe.
 *   { kind: 'prep',  ingredientId }        — a preparación's own recipe.
 *
 * `kind` is what everything downstream branches on. Its absence is what marks
 * the overview tab, so `!tab.kind` still means "no recipe open". */
const activeTab = ref('overview');
const tabs = ref([{ id: 'overview', label: 'Recetario' }]);

/* fetchAll rethrows after storing the message on the store, so the .catch is
 * what keeps it from becoming an unhandled rejection. The error is rendered,
 * not swallowed: without it a failed fetch reads as "no tienes productos".
 *
 * Ingredients are fetched because a component row is pure structure — id,
 * quantity, unit — and nothing else. The name, the current cost, and whether
 * this is something you make all live on the ingredient document. */
onMounted(() => {
  productStore.fetchAll().catch(() => {});
  ingredientStore.fetchAll().catch(() => {});
  /* The Recetas shelf dissolves a recipe into its lines, so it needs the whole
   * documents, not a summary — this is the heaviest request on the screen and
   * the only one the shelves add. The per-tab fetchById below stays as the
   * fallback for a recipe this misses.
   *
   * ponytail: unbounded — getAll applies no limit unless the query asks for one,
   * so this is every recipe with every line. Fine into the low hundreds; if a
   * bakery outgrows it, the shelf wants a name+count projection and a fetch of
   * the full document only at the moment one is dissolved. */
  recipeStore.fetchAll().catch(() => {});
  // The route guard already reads settings, so this is usually a no-op.
  if (!bakerySettingsStore.items.length) {
    bakerySettingsStore.fetchById('default').catch(() => {});
  }
  loadPins();
});

/* combosOf, nameOf, costOf and the ingr/prep/prod split all live in
 * useItemCatalog now — la bodega resolves the same identities off the same two
 * catalogs, and two copies of that walk is how two screens start disagreeing
 * about what a thing is called. */
const catalog = useItemCatalog();

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
    // Lowercased on both sides: `q` already is, and without this "Croissant"
    // matched nothing you could actually type.
    .filter((p) => !q || p.name.toLowerCase().includes(q))
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

/* Preparaciones sit under the products in the same pane and answer the same
 * question — "what do I have a recipe for?" — so the overview lists both. They
 * are ingredients, not products: an ingredient that carries a recipe of its
 * own, which is the only place that fact is recorded. */
const preparations = computed(() => {
  const q = search.value.trim().toLowerCase();
  return ingredientStore.items
    .filter((i) => !i.isDeleted && i.recipeId &&
      (!q || (i.name || '').toLowerCase().includes(q)))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
});

/* The rendimiento lives on the recipe, not on the ingredient, so a preparación
 * whose recipe has not arrived yet simply shows no line rather than "rinde
 * undefined". */
const yieldOfIngredient = (i) =>
  recipeStore.items.find((r) => r.id === i.recipeId)?.yield ?? null;

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
      kind: 'combo',
      productId: product.id,
      comboId: combo.id,
    });
  }
  activeTab.value = combo.id;
}

/* An ingredient id makes as good a tab id as a combination id: both are plain
 * Firestore ids and neither can collide with the other's collection. */
function openPreparacion(ingredient) {
  if (!tabs.value.some((t) => t.id === ingredient.id)) {
    tabs.value.push({
      id: ingredient.id,
      label: ingredient.name,
      closable: true,
      kind: 'prep',
      ingredientId: ingredient.id,
    });
  }
  activeTab.value = ingredient.id;
}

const tabOf = (id) => tabs.value.find((t) => t.id === id) ?? null;

/* Resolved off the stores, never off a filtered list: typing in a search box
 * must not blank an open builder. Taken by tab rather than read off `builder`,
 * because a bench outlives the tab being active — the bench for a background
 * tab still has to resolve its source. */
const comboOfTab = (tab) => {
  const product = productStore.items.find((p) => p.id === tab.productId);
  return product ? combosOf(product).find((c) => c.id === tab.comboId) ?? null : null;
};

const recipeIdOfTab = (tab) => (tab.kind === 'prep'
  ? ingredientStore.items.find((i) => i.id === tab.ingredientId)?.recipeId ?? null
  : comboOfTab(tab)?.recipeId ?? null);

/* Normalised: everything below reads `kind`, `recipeId` and `ownerName` without
 * knowing which of the two owners it got. `product`/`combo`/`ingredient` are
 * there for the parts that genuinely differ — a price and a sibling strip only
 * exist for a combination, a rendimiento only for a preparación.
 *
 * `recipeId` is null for a combination with no recipe yet — that is the empty
 * mesa every new bakery starts on. It is never null for a preparación: the
 * recipe is created in the same gesture as the ingredient. */
const builder = computed(() => {
  const tab = tabOf(activeTab.value);
  if (!tab?.kind) return null;

  if (tab.kind === 'prep') {
    const ingredient = ingredientStore.items.find((i) => i.id === tab.ingredientId);
    return ingredient
      ? {
        kind: 'prep',
        recipeId: ingredient.recipeId ?? null,
        ownerName: ingredient.name,
        ingredient,
      }
      : null;
  }

  const product = productStore.items.find((p) => p.id === tab.productId);
  const combo = comboOfTab(tab);
  return combo
    ? {
      kind: 'combo',
      recipeId: combo.recipeId ?? null,
      ownerName: `${product.name} · ${comboName(combo, product)}`,
      product,
      combo,
    }
    : null;
});

/* ---------------- the bench ---------------- */

/* One editable copy per TAB, not per recipe. A combination with no recipe still
 * needs a bench to build on — that is the state every new bakery is in, and
 * keying by recipe id meant it got nothing at all. Keying by tab also means the
 * two kinds of owner need no separate bookkeeping. */
/* shallowReactive, NOT reactive. A deep-reactive Map wraps every value it
 * hands back, and a reactive object UNWRAPS the refs inside it — so
 * `bench.copy` came back as the bare array and `bench.copy.value` was
 * undefined. Every line read as empty and nothing could be added. Shallow keeps
 * the Map itself tracked (a computed still re-runs when a key is set) while
 * handing the composable's refs back untouched. */
const benches = shallowReactive(new Map());

function benchFor(tab) {
  if (!benches.has(tab.id)) {
    /* A computed over the store, not a plain array: after a save the store
     * swaps in the server's copy and isDirty has to compare against that one.
     * Resolves to [] until a recipe exists, which is the empty mesa. */
    const source = computed(() => {
      const recipeId = recipeIdOfTab(tab);
      const recipe = recipeId && recipeStore.items.find((r) => r.id === recipeId);
      return recipe ? recipe.ingredients ?? [] : [];
    });
    /* `order` rides on the bench rather than in a parallel map: created with it,
     * discarded with it when the tab closes. See `resort`. */
    benches.set(tab.id, { ...useUndoSnapshot(source), order: ref([]) });
  }
  return benches.get(tab.id);
}

/* Fetch the recipe if there is one, then make sure the tab has a bench either
 * way.
 *
 * Keyed on the tab id but ONLY once `builder` resolves, which is the part that
 * matters: useUndoSnapshot copies its source once, at construction. Build the
 * bench before the catalogs have loaded and it copies the empty array, then the
 * real lines arrive on the source alone — the mesa renders empty and reads as
 * dirty against a recipe it never showed you. */
watch(
  () => (builder.value ? activeTab.value : null),
  async (id) => {
    const tab = id && tabOf(id);
    if (!tab) return;

    const recipeId = recipeIdOfTab(tab);
    if (recipeId && !recipeStore.items.some((r) => r.id === recipeId)) {
      await recipeStore.fetchById(recipeId).catch(() => {});
    }
    benchFor(tab);
  },
  { immediate: true },
);

/* Unwrapped once here so `.value` stays out of the template. */
const bench = computed(() =>
  (builder.value ? benches.get(activeTab.value) ?? null : null));
const lines = computed(() => bench.value?.copy.value ?? []);
const canUndo = computed(() => bench.value?.canUndo.value ?? false);

/* ---------------- modo reemplazo ---------------- */

/* El índice REAL en `lines`, no la posición renderizada: `rows` va ordenado por
 * costo y `_i` es lo único que apunta al array que se guarda. `null` es el
 * estado normal de la pantalla — no estamos reemplazando nada.
 *
 * Armado desde una fila, consumido por el siguiente chip de la estantería. Es
 * el único modo de esta pantalla, y por eso la cabecera de Insumos lo anuncia:
 * un clic que hace algo distinto sin decirlo es una trampa. */
const replacingIndex = ref(null);

/* Resuelto contra `lines`, no copiado al armar el modo: la línea puede cambiar
 * de cantidad mientras el modo está activo, y el reemplazo tiene que conservar
 * la cantidad que hay AHORA, no la que había al pulsar ⇄. */
const replacingLine = computed(() =>
  (replacingIndex.value === null ? null : lines.value[replacingIndex.value] ?? null));

const cancelReplace = () => { replacingIndex.value = null; };

/* Un modo que sobrevive al cambio de pestaña apuntaría a la línea de otra
 * receta — el índice sigue siendo válido, que es lo que lo hace peligroso. */
watch(activeTab, cancelReplace);

/* ---------------- rendimiento (preparaciones only) ---------------- */

/* The yield lives on the RECIPE document, not on the bench: useUndoSnapshot
 * copies the ingredients array and nothing else. Rather than reshape the bench
 * into an object — which every mutation, every snapshot and every save would
 * have to learn — the draft is held beside it, keyed by tab, and folded into
 * isDirty. Undo does not cover it, which is the honest trade: it is one number
 * you can retype, not eight lines you would have to rebuild.
 *
 * A tab with no entry here is showing the stored value, so "not present" is how
 * a clean field is represented. */
const yieldDrafts = ref({});

const yieldOfTab = (tab) => {
  const recipeId = recipeIdOfTab(tab);
  return recipeId
    ? recipeStore.items.find((r) => r.id === recipeId)?.yield ?? null
    : null;
};

const yieldDirtyOf = (tab) =>
  tab.kind === 'prep' &&
  tab.id in yieldDrafts.value &&
  Number(yieldDrafts.value[tab.id]) !== Number(yieldOfTab(tab) ?? 0);

const storedYield = computed(() => {
  const tab = tabOf(activeTab.value);
  return tab?.kind === 'prep' ? yieldOfTab(tab) : null;
});

const yieldDraft = computed({
  get: () => yieldDrafts.value[activeTab.value] ?? storedYield.value ?? '',
  set: (v) => {
    yieldDrafts.value = { ...yieldDrafts.value, [activeTab.value]: v };
  },
});

const yieldDirty = computed(() => {
  const tab = tabOf(activeTab.value);
  return tab ? yieldDirtyOf(tab) : false;
});

/* The backend refuses `yield <= 0` on an ingredient-owned recipe, and refuses
 * the whole save with it — so Guardar stays off rather than round-tripping to
 * find out. */
const yieldValid = computed(() =>
  builder.value?.kind !== 'prep' || Number(yieldDraft.value) > 0);

const isDirty = computed(
  () => (bench.value?.isDirty.value ?? false) || yieldDirty.value);

/* Dropping the draft is how the field goes back to showing the stored value —
 * there is no "clean" entry, only the absence of one. */
function clearYieldDraft(id) {
  if (!(id in yieldDrafts.value)) return;
  const next = { ...yieldDrafts.value };
  delete next[id];
  yieldDrafts.value = next;
}

/* Both halves of a tab's edits, dropped together: bench.reset() alone would
 * leave a typed rendimiento sitting there looking saved. */
function resetBench() {
  bench.value?.reset();
  clearYieldDraft(activeTab.value);
  cancelReplace();
}

/* Which shelf a line came off. The split is the catalog's; only the tooltip
 * wording is this screen's. */
const { productById } = catalog;

const KIND_TITLES = {
  prod: 'Otro producto',
  prep: 'Preparación con receta propia',
  ingr: 'Ingrediente',
};

const kindOf = (line) => {
  const label = catalog.kindOf(line);
  return { label, title: KIND_TITLES[label] };
};

/* A stored line carries no name and no cost — the backend strips both, because
 * the source document is the only honest place for either (docs/recipe-costing).
 * The catalog joins them back on; the mesa only decides what an unresolved cost
 * means here, and here it is zero, which `isUnpriced` below then flags. */
const resolveLine = (line) => ({
  name: catalog.nameOf(line),
  costPerUnit: catalog.costOf(line) ?? 0,
});

/* What the bench RENDERS. `lines` stays the thing that gets saved — joining
 * name/cost onto the rows the mutations write would put the denormalized fields
 * straight back into the document the backend just finished removing them from.
 * A plain map, so an index into `rows` is the same index into `lines`. */
const lineCost = (line) => (line.quantity || 0) * (line.costPerUnit || 0);

/* Identity for merging and for the frozen order below. A product used twice at
 * different sizes is two different lines, so the combination is part of the
 * key. */
const lineKey = (l) => `${l.type}:${l.id}:${l.combinationId ?? ''}`;

/* The order is state of its own, a list of keys, recomputed ONLY while the bench
 * is untouched: on opening the recipe, on switching tab, and when a cost arrives
 * late from the catalog. The first edit freezes it until the recipe is reopened
 * — a row that moves out from under the cursor on the first digit typed makes
 * the numbers impossible to follow.
 *
 * It lives on the bench (`bench.order`), one list per tab, created and discarded
 * with the bench it orders. One shared list would drop a frozen tab back to the
 * raw array order on return. */
const sortOrder = computed(() => bench.value?.order.value ?? []);

const resort = () => {
  const b = bench.value;
  if (!b || b.isDirty.value) return;
  b.order.value = lines.value
    .map((l) => ({ key: lineKey(l), cost: lineCost({ ...l, ...resolveLine(l) }) }))
    .sort((a, b2) => b2.cost - a.cost)
    .map((x) => x.key);
};

/* Keys and unit costs, deliberately NOT quantities — that is the whole point.
 * The tab is part of the key so opening another one always sorts, even when it
 * carries the same lines at the same costs as the last. */
watch(
  () => [
    activeTab.value,
    ...lines.value.map((l) => `${lineKey(l)}:${resolveLine(l).costPerUnit}`),
  ].join('|'),
  resort,
  { immediate: true },
);

/* `_i` carries the row's real index into `lines`/`bench.copy.value` — sorting
 * this computed reorders the display, but setQuantity/removeLine still mutate
 * the underlying array by its original position, not by render order. */
const rows = computed(() => {
  // A line not in the frozen order yet (just dropped) sits last, which is
  // exactly where you put it.
  const at = (l) => {
    const i = sortOrder.value.indexOf(lineKey(l));
    return i < 0 ? Infinity : i;
  };
  return lines.value
    .map((l, i) => ({ ...l, ...resolveLine(l), _i: i }))
    .sort((a, b) => at(a) - at(b));
});

const recipeCost = computed(() =>
  rows.value.reduce((sum, line) => sum + lineCost(line), 0));
/* A preparación has no price: it is never sold, it is consumed by the recipes
 * above it. What it has instead is a cost per unit — the recipe total divided
 * by the rendimiento, exactly the number the backend derives on save. Showing a
 * margin here would be inventing a sale that does not happen. */
const price = computed(() =>
  (builder.value?.combo ? priceOf(builder.value.combo) : 0));
const profit = computed(() => price.value - recipeCost.value);

const prepUnitCost = computed(() => {
  const amount = Number(yieldDraft.value);
  return amount > 0 ? recipeCost.value / amount : null;
});

/* Both stay blank until there is something to divide. An empty recipe costs
 * nothing, which arithmetically means a 100% margin — a number that flatters a
 * recipe nobody has built yet. */
const marginPct = computed(() =>
  lines.value.length && price.value > 0
    ? Math.round(profit.value / price.value * 100)
    : null);

/* A plain ingredient is allowed to cost nothing — agua does, and flagging it is
 * noise. What is never legitimately zero is a cost that gets DERIVED: a
 * preparación or another product resolves to zero only when its own recipe is
 * missing or empty, and then the total below is silently low. */
const isUnpriced = (line) => !line.costPerUnit && kindOf(line).label !== 'ingr';

const unpricedCount = computed(() => rows.value.filter(isUnpriced).length);

/* The backend refuses the whole recipe over one bad line — resolveComponents
 * throws on `!(quantity > 0)` and names the component by id, which is not a
 * thing anyone can read. So the check lives here too, and Guardar stays off
 * until every line has a quantity. */
const blankQuantities = computed(
  () => lines.value.filter((l) => !(l.quantity > 0)).length);

/* ---------------- putting things on the bench ---------------- */

const sameComponent = (a, b) => lineKey(a) === lineKey(b);

/* The shape of a line on the bench, in one place. Every shelf builds rows
 * through here, so a field cannot go missing on one path and not another —
 * `combinationId: undefined` reaching the backend is what this prevents. The
 * defaults are also the normalization for lines read back off a stored recipe,
 * which is the one source that can be missing any of them. */
/* `??`/`||` rather than destructuring defaults: those only fire on `undefined`,
 * and a stored line can carry an empty type. */
/* Name and cost are deliberately absent: a row is structure only, and
 * `resolveLine` puts the display values back on at render time. */
const componentRow = ({ type, id, combinationId, unit, quantity, notes }) => ({
  type: type || 'ingredient',
  id,
  combinationId: combinationId ?? null,
  unit,
  quantity: quantity ?? 0,
  notes: notes || '',
});

/* Everything that lands on the bench comes through here — one chip, or the
 * whole of another recipe dissolving. One snapshot per gesture either way, so
 * dropping a recipe is a single undo rather than eight.
 *
 * Every mutation replaces the array rather than editing rows in place, so a
 * snapshot can never share objects with what comes after it. */
function putOnBench(rows) {
  const b = bench.value;
  if (!b || !rows?.length) return;

  const merged = [...b.copy.value];
  let changed = false;
  let focusAt = null;

  for (const row of rows) {
    const at = merged.findIndex((l) => sameComponent(l, row));
    if (at < 0) {
      merged.push(row);
      changed = true;
    } else if (row.quantity) {
      /* Dissolving a recipe does carry quantities, and those add onto a line
       * already on the bench. */
      merged[at] = {
        ...merged[at],
        quantity: (merged[at].quantity || 0) + row.quantity,
      };
      changed = true;
    } else {
      /* A loose chip arrives with no quantity. When the line is already there,
       * adding zero would change nothing and the gesture would look broken, so
       * the cursor goes to the quantity it already has — the only thing left to
       * do with it. No snap, because nothing moved. */
      focusAt = at;
    }
  }

  /* The snap sits here rather than at the top: `merged` is a copy, so
   * `copy.value` is still untouched — and a gesture that changes nothing must
   * leave no undo step and must not mark the bench dirty. */
  if (changed) {
    b.snap();
    b.copy.value = merged;
  }

  /* The index into `merged` is the index into `lines`, which is the `_i` each
   * row carries into the DOM. */
  if (focusAt !== null) {
    nextTick(() => document.querySelector(`[data-qty="${focusAt}"]`)?.focus());
  }
}

/* Una combinación hermana con receta es el arranque más común: la misma receta
 * en otro tamaño, y después ×1.5. Copia, no vínculo — sus líneas se disuelven
 * en la mesa igual que una receta de la estantería, y nada queda apuntando a
 * ella.
 *
 * Se resuelve contra recipeStore, que ya trae todas las recetas en el
 * onMounted. Una hermana cuya receta no haya llegado simplemente no aparece,
 * en vez de ofrecer una pill que no pega nada. */
const starterCombos = computed(() => {
  const b = builder.value;
  if (b?.kind !== 'combo') return [];

  return combosOf(b.product)
    .filter((c) => c.id !== b.combo.id && c.recipeId)
    .map((c) => ({ c, r: recipeStore.items.find((x) => x.id === c.recipeId) }))
    .filter(({ r }) => r?.ingredients?.length)
    .map(({ c, r }) => ({
      id: c.id,
      name: comboName(c, b.product),
      count: r.ingredients.length,
      rows: r.ingredients.map(componentRow),
    }));
});

/* Focus arms an editing session, the first keystroke takes the snapshot: one
 * undo entry per editing session instead of one per keystroke, and none at all
 * for an input you merely tabbed through. Snapping on focus itself left a dead
 * press of Deshacer behind every row you passed over.
 *
 * A plain `let`: nothing renders from it. */
let armedRow = null;

const beginQuantityEdit = (index) => { armedRow = index; };

function setQuantity(index, value) {
  const b = bench.value;
  if (!b) return;

  if (armedRow === index) {
    b.snap();
    armedRow = null;
  }

  const q = Number(value);
  b.copy.value = b.copy.value.map((l, i) =>
    i === index ? { ...l, quantity: Number.isFinite(q) && q > 0 ? q : 0 } : l);
}

function removeLine(index) {
  const b = bench.value;
  if (!b) return;
  b.snap();
  b.copy.value = b.copy.value.filter((_, i) => i !== index);
  // Los índices de abajo se corren al quitar una fila, así que un modo armado
  // sobre otra línea ahora apunta a la equivocada. Cancelar es lo honesto.
  cancelReplace();
}

/* Cambia la identidad, conserva cantidad y notas. La unidad SÍ viaja con el
 * insumo nuevo: el backend la re-deriva del documento origen al guardar
 * (resolveComponents), así que dejar la vieja solo mentiría en pantalla hasta
 * el siguiente refetch.
 *
 * Colisión: si el insumo elegido ya está en la mesa se FUNDE sumando, igual que
 * putOnBench. Dejar dos filas con el mismo lineKey duplicaría la `:key` del
 * TransitionGroup — un aviso de Vue y un render roto, no un detalle cosmético. */
function replaceLine(index, row) {
  const b = bench.value;
  const old = b?.copy.value[index];
  if (!old) return;

  b.snap();
  const next = { ...row, quantity: old.quantity, notes: old.notes };
  const dup = b.copy.value.findIndex((l, i) => i !== index && sameComponent(l, next));

  b.copy.value = dup >= 0
    ? b.copy.value
      .map((l, i) => (i === dup
        ? { ...l, quantity: (l.quantity || 0) + (next.quantity || 0) }
        : l))
      .filter((_, i) => i !== index)
    : b.copy.value.map((l, i) => (i === index ? next : l));

  cancelReplace();
}

function scale(factor) {
  const b = bench.value;
  if (!b || !lines.value.length) return;
  b.snap();
  b.copy.value = lines.value.map((line) => ({
    ...line,
    quantity: Math.round((line.quantity || 0) * factor * 100) / 100,
  }));
}

/* ---------------- drag and drop ---------------- */

const dragOverBench = ref(false);
const draggingId = ref(null);

/* The payload carries everything taking a chip means — the rows to put on the
 * bench, and the pin to remember it by. Both drop and click hand it to
 * `applyChip`, so the two gestures cannot drift apart: they did once, when drop
 * called putOnBench directly and dragging a product never pinned it. */
function chipPayload(shelf, chip) {
  return {
    rows: chip.rows,
    pin: shelf.pinnable ? { shelf: shelf.key, id: chip.pinId } : null,
  };
}

function applyChip(payload) {
  if (!payload?.rows?.length) return;

  /* Con el modo armado, TODO chip reemplaza: el clic y el arrastre entran los
   * dos por aquí, y esa es la razón de que este desvío viva en un solo sitio.
   * Sin pin — fijar en la estantería es una decisión sobre lo que quieres a
   * mano, no un efecto secundario de corregir una línea. */
  if (replacingIndex.value !== null) {
    // Solo chips de una línea. Una receta trae varias y no puede reemplazar a
    // una sola conservando su cantidad — por eso su repisa no se ofrece aquí.
    if (payload.rows.length === 1) replaceLine(replacingIndex.value, payload.rows[0]);
    return;
  }

  putOnBench(payload.rows);
  if (payload.pin) pin(payload.pin.shelf, payload.pin.id);
}

function onDragStart(event, shelf, chip) {
  draggingId.value = chip.key;
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData('text/plain', JSON.stringify(chipPayload(shelf, chip)));
}

function onDrop(event) {
  dragOverBench.value = false;
  try {
    applyChip(JSON.parse(event.dataTransfer.getData('text/plain')));
  } catch {
    // Something dragged in from outside the app. Ignore it.
  }
}

/* ---------------- saving ---------------- */

const saving = ref(false);
const saveError = ref('');

const canSave = computed(
  () => isDirty.value && lines.value.length > 0 && !blankQuantities.value &&
    yieldValid.value);

async function save() {
  const b = bench.value;
  if (!b || !canSave.value || !builder.value) return;
  const { kind, recipeId, product, combo } = builder.value;
  const tabId = activeTab.value;
  // Read now, not after the await: yieldDraft follows the ACTIVE tab, and this
  // save belongs to the tab it started on.
  const yieldValue = Number(yieldDraft.value);

  saving.value = true;
  saveError.value = '';
  try {
    /* A preparación's recipe is created in the same gesture as the ingredient,
     * so there is nothing here that could create one — and the create branch
     * below would reach for a product that does not exist. If the pointer is
     * gone the ingredient document has drifted, and that is not something this
     * screen can repair by writing a second recipe. */
    if (kind === 'prep' && !recipeId) {
      throw new Error(
        'Esta preparación perdió el vínculo con su receta. Revísala en los ingredientes.',
      );
    }

    if (recipeId) {
      /* `update` (PUT), not `patch`. Sending only `ingredients` is safe because
       * the backend merges onto the stored document — but only the PUT route
       * runs recipeService.update, which re-derives each line's unit from its
       * source doc, bumps the version, maintains `usedInRecipes` and runs the
       * cost propagation walk. The PATCH route writes the field and does none
       * of that.
       *
       * `yield` only on a preparación: validateOwner refuses it on any other
       * owner, and update merges onto the stored document, so sending it on a
       * combination would fail the whole save. */
      await recipeStore.update(recipeId, {
        ingredients: b.copy.value,
        ...(kind === 'prep' ? { yield: yieldValue } : {}),
      });
    } else {
      /* One call. The backend writes the recipe document and the owner's
       * recipeId in the same Firestore transaction (recipeService.create), so
       * there is no window in which a recipe exists that nothing points at. */
      await recipeStore.create({
        productId: product.id,
        // Only a product WITH variations owns its recipe per combination;
        // without them the product itself is the owner (see validateOwner).
        combinationId: product.hasVariations ? combo.id : null,
        name: product.hasVariations
          ? `${product.name} · ${comboName(combo, product)}`
          : product.name,
        ingredients: b.copy.value,
      });
    }

    /* Both paths, not just create. The write lands on the PRODUCT document —
     * the recipeId pointer on create, and on either the recomputed
     * combination.costPrice that propagation just pushed. Realtime won't bring
     * that back: handleRealtimeUpdate only syncs primitive fields, and a
     * combination's cost lives inside variations.combinations[]. Without this
     * the pips, the "sin receta" tag and every costo on the recetario stay at
     * whatever they were before the save.
     *
     * A preparación's rollup lands on the INGREDIENT instead — the cost
     * propagation writes costPerUnit there — so that is the catalog to re-read.
     * Refetching the wrong one leaves the chip on the shelf quoting the old
     * price of something you just changed. */
    if (kind === 'prep') await ingredientStore.fetchAll().catch(() => {});
    else await productStore.fetchAll().catch(() => {});

    /* Re-copy from what came back, so the stack starts clean at the saved
     * state. `b`, not bench.value: the refetch above swaps the store's array,
     * and reading the bench back through the active tab would miss it if the
     * user switched tabs while the request was in flight. */
    b.reset();
    clearYieldDraft(tabId);
    cancelReplace();
  } catch (err) {
    saveError.value = err?.message || 'No se pudo guardar la receta.';
  } finally {
    saving.value = false;
  }
}

/* ---------------- insumos (the supplies shelf) ---------------- */

/* Stored as a flat array — every seed and every backup has it that way, and
 * `BakerySettings` maps it as one. */
const categories = computed(() =>
  (bakerySettingsStore.items[0]?.ingredientCategories ?? [])
    .filter((c) => c.isActive !== false));

const suppliesSearch = ref('');

/* One search across all four shelves. Past a hundred items nobody scans a wall
 * of chips, they type — so the search is the real interface and the shelves are
 * what you see before you have typed anything. */
const matchesSearch = (name) => {
  const q = suppliesSearch.value.trim().toLowerCase();
  return !q || (name || '').toLowerCase().includes(q);
};

/* Ranked by how often it is already used, then by name. `usedInRecipes` is
 * maintained on ingredients AND products by the backend's
 * updateComponentRelationships, so this popularity score costs nothing to read.
 * It is what makes the cap below useful instead of an alphabetical truncation:
 * harina is in forty recipes, cardamomo in one. */
const byUse = (a, b) =>
  (b.usedInRecipes?.length ?? 0) - (a.usedInRecipes?.length ?? 0) ||
  (a.name || '').localeCompare(b.name || '');

/* Every chip is the same shape whatever shelf it came off: a label, a bit of
 * metadata, and the rows it puts on the bench. The template loops once. */
/* `unit` suelto además de dentro de `meta`: el modo reemplazo particiona por
 * unidad y no va a volver a parsear la cadena que acaba de componer. */
const ingredientChip = (i) => ({
  key: `i:${i.id}`,
  name: i.name,
  unit: i.unit,
  meta: `${formatUnitCost(i.costPerUnit)}/${i.unit}`,
  // No quantity: the line arrives empty and the first number typed is the only
  // one. `blankQuantities` is what keeps it from being saved that way.
  rows: [componentRow({ id: i.id, unit: i.unit })],
});

const liveIngredients = computed(() =>
  ingredientStore.items.filter((i) => !i.isDeleted && matchesSearch(i.name)));

/* An ingredient with a recipe of its own is a preparación — the split is the
 * same one `kindOf` makes for the badge, and the ingredient document is the
 * only thing that knows. */
const shelfIngredients = computed(() =>
  [...liveIngredients.value].filter((i) => !i.recipeId).sort(byUse).map(ingredientChip));

/* Minus the one you are standing in: a preparación cannot be an ingredient of
 * itself. Same rule the Productos shelf applies to the open combination — the
 * server catches deeper cycles on save, this catches the one-step case before
 * you can make it. */
const shelfPreparations = computed(() => {
  const selfId = builder.value?.ingredient?.id;
  return [...liveIngredients.value]
    .filter((i) => i.recipeId && i.id !== selfId)
    .sort(byUse)
    .map(ingredientChip);
});

/* ---------------- pinned shelves ---------------- */

/* Productos and Recetas are too big to list: products × combinations is 600
 * chips for a mid-size bakery, and the useful set on any day is three or four.
 * So those two invert — search first, and what you pick stays.
 *
 * IDs only, never the rendered chip. The shelf resolves them against the stores
 * below, so anything deleted just drops off instead of leaving a chip that
 * errors when clicked.
 *
 * Scoped per bakery because a system_admin switches between them. */
const authStore = useAuthenticationStore();
const pinsKey = computed(
  () => `recipeBook.pins.${authStore.getBakeryId ?? 'none'}`);

const pins = ref({ products: [], recipes: [] });

/* Reading can THROW, not merely return null — a private window or a browser set
 * to block site data rejects the accessor itself. Every path here has to leave
 * the shelves rendering empty rather than taking the pane down. */
function loadPins() {
  try {
    const raw = JSON.parse(localStorage.getItem(pinsKey.value) || '{}');
    pins.value = {
      products: Array.isArray(raw.products) ? raw.products : [],
      recipes: Array.isArray(raw.recipes) ? raw.recipes : [],
    };
  } catch {
    pins.value = { products: [], recipes: [] };
  }
}

function savePins() {
  try {
    localStorage.setItem(pinsKey.value, JSON.stringify(pins.value));
  } catch {
    // Storage unavailable. The pins still work for this session.
  }
}

function pin(shelfKey, id) {
  const list = shelfKey === 'rec' ? 'recipes' : 'products';
  if (pins.value[list].includes(id)) return;
  pins.value = { ...pins.value, [list]: [...pins.value[list], id] };
  savePins();
}

function unpin(shelfKey, id) {
  const list = shelfKey === 'rec' ? 'recipes' : 'products';
  pins.value = {
    ...pins.value,
    [list]: pins.value[list].filter((x) => x !== id),
  };
  savePins();
}

/* A product component always resolves to a sellable unit and is always counted
 * in `uds` — the backend re-derives both on save (resolveComponents), and
 * its cost is the COMBINATION's costPrice, which is 0 until that combination
 * has a recipe of its own. That zero is exactly what `sin costo` flags. */
const productChips = computed(() => {
  const currentComboId = builder.value?.combo?.id;

  return productStore.items
    .flatMap((p) => combosOf(p).map((c) => ({ p, c })))
    // You cannot be an ingredient of yourself. Deeper cycles are the server's
    // job — assertGraphIsSane walks the whole graph on save.
    .filter(({ c }) => c.id !== currentComboId)
    // Collection first, because these get grouped by it; usage decides the
    // order inside a collection.
    .sort((a, b) =>
      (a.p.collectionName || '').localeCompare(b.p.collectionName || '') ||
      byUse(a.p, b.p))
    .map(({ p, c }) => {
      const name = p.hasVariations ? `${p.name} ${c.name}`.trim() : p.name;
      return {
        key: `p:${p.id}:${c.id}`,
        pinId: `${p.id}:${c.id}`,
        collection: p.collectionName,
        name,
        unit: 'uds',
        meta: 'uds',
        rows: [componentRow({
          type: 'product',
          id: p.id,
          combinationId: p.hasVariations ? c.id : null,
          unit: 'uds',
          quantity: 1,
        })],
      };
    });
});

/* Recipes are the odd shelf: not a component, a paste. Dropping one merges its
 * lines into the bench and nothing ends up pointing at it. */
/* A recipe has no collection of its own — it borrows the one from the product
 * it belongs to, and falls back when that product is gone. `productById` is the
 * same map `resolveLine` joins against. */
const recipeChips = computed(() => {
  const currentRecipeId = builder.value?.recipeId;
  const collectionOf = (r) =>
    productById.value.get(r.productId)?.collectionName || '';

  return recipeStore.items
    .filter((r) => r.id !== currentRecipeId && r.ingredients?.length)
    .sort((a, b) =>
      collectionOf(a).localeCompare(collectionOf(b)) ||
      (a.name || '').localeCompare(b.name || ''))
    .map((r) => ({
      key: `r:${r.id}`,
      pinId: r.id,
      collection: collectionOf(r),
      name: r.name,
      meta: `${r.ingredients.length} líneas`,
      rows: r.ingredients.map(componentRow),
    }));
});

/* Empty box → your pins. Typing → the whole collection, and picking one pins
 * it. That is what keeps the shelf small without hiding anything. */
const searchFirst = (chips, pinned) =>
  suppliesSearch.value.trim()
    ? chips.filter((c) => matchesSearch(c.name))
    : chips.filter((c) => pinned.includes(c.pinId));

const shelfProducts = computed(() =>
  searchFirst(productChips.value, pins.value.products));

const shelfRecipes = computed(() =>
  searchFirst(recipeChips.value, pins.value.recipes));

/* Twelve keeps the pane about one screen tall no matter how big the bakery
 * gets. Combined with the usage sort, the twelve you see are the twelve you
 * reach for; everything else is one keystroke away in the search box. */
const SHELF_CAP = 12;
const expandedShelves = ref({});

/* `pinnable` marks the two shelves whose chips carry an × and whose contents
 * come from a pin list rather than the whole collection. */
/* Reemplazar algo por sí mismo no es un reemplazo. Ofrecerlo solo invita a un
 * clic que no hace nada y deja al usuario dudando de si el modo funcionó. */
const notSelf = (chips) =>
  chips.filter((c) => !sameComponent(c.rows[0], replacingLine.value));

const shelves = computed(() => {
  const target = replacingLine.value;

  /* En modo reemplazo la estantería cambia de pregunta: ya no es "qué le añado
   * a esta receta" sino "por qué cambio ESTA línea". El corte es `type`, no la
   * insignia: `ingr` y `prep` son los dos type 'ingredient', y cambiar la salsa
   * comprada por la de la casa es justo el caso que motiva la función.
   *
   * Recetas no aparece: se disuelve en N líneas, y "reemplaza esta línea por
   * ocho conservando su cantidad" no significa nada. */
  if (target) {
    /* Un producto solo se reemplaza por otro producto, y todos se cuentan en
     * `uds` — particionar por unidad daría "Misma unidad (uds)" y una repisa
     * vacía al lado. Una sola repisa dice lo mismo mejor. */
    if (target.type === 'product') {
      return [{
        key: 'prod',
        title: 'Productos',
        items: notSelf(shelfProducts.value),
      }].filter((s) => s.items.length);
    }

    const pool = notSelf([...shelfIngredients.value, ...shelfPreparations.value]);
    return [
      {
        key: 'same',
        title: `Misma unidad (${target.unit})`,
        items: pool.filter((c) => c.unit === target.unit),
      },
      {
        key: 'other',
        title: 'Otras unidades',
        hint: 'La cantidad se conserva tal cual, así que revísala después.',
        items: pool.filter((c) => c.unit !== target.unit),
      },
    ].filter((s) => s.items.length);
  }

  return [
    { key: 'ing', title: 'Ingredientes', hint: '', items: shelfIngredients.value },
    {
      key: 'prep',
      title: 'Preparaciones',
      hint: 'Entran como una sola línea y conservan su receta.',
      items: shelfPreparations.value,
    },
    {
      key: 'rec',
      title: 'Recetas',
      hint: 'Se disuelven en sus líneas al soltarlas. Puedes escalarlas después.',
      items: shelfRecipes.value,
      pinnable: true,
      grouped: true,
    },
    {
      key: 'prod',
      title: 'Productos',
      hint: 'Otro producto vendible, contado en unidades.',
      items: shelfProducts.value,
      pinnable: true,
      grouped: true,
    },
  ].filter((s) => s.items.length);
});

/* Products and recipes are grouped by collection — the same way the recetario's
 * left pane groups products, so the screen states one idea once. The category
 * lands in a heading instead of on every chip, which is what keeps chips short.
 *
 * Ingredientes and Preparaciones stay flat on purpose: their order is
 * `usedInRecipes` descending, and that sort is the only thing that makes the
 * 12-item cap honest rather than an arbitrary cut.
 *
 * Ungrouped shelves come back as one nameless group so the template has a
 * single path. Adjacent-run grouping like `groups` above — the lists are sorted
 * by collection first, so a run is a group. */
const chipGroups = (shelf) => {
  const items = visibleChips(shelf);
  if (!shelf.grouped) return [{ name: '', items }];

  return items.reduce((acc, chip) => {
    const key = chip.collection || 'Sin colección';
    const last = acc.at(-1);
    if (last?.name === key) last.items.push(chip);
    else acc.push({ name: key, items: [chip] });
    return acc;
  }, []);
};

/* One click: onto the mesa, and onto the shelf so it is there next time. */
const takeChip = (shelf, chip) => applyChip(chipPayload(shelf, chip));

const visibleChips = (shelf) =>
  expandedShelves.value[shelf.key] || shelf.items.length <= SHELF_CAP
    ? shelf.items
    : shelf.items.slice(0, SHELF_CAP);

/* The card hides on an exact name match. Duplicate ingredients are what makes
 * the shelf unusable, and the search is the only thing standing between you and
 * three kinds of "Harina".
 *
 * Takes the name rather than reading a fixed ref: the same card hangs off two
 * different search boxes — the Insumos one inside a recipe, and the overview's
 * own, because creating a preparación should not require first opening somebody
 * else's recipe to reach the form. */
const nameTaken = (name) => {
  const n = name.trim().toLowerCase();
  return !!n && ingredientStore.items.some((i) => i.name?.toLowerCase() === n);
};

/* Refs alimentados por un watcher, y NO computeds, aunque el valor se derive de
 * la búsqueda. Un computed también depende de `ingredientStore.items` a través
 * de `nameTaken`, y crear el ingrediente es justo lo que cambia esa lista: el
 * `v-if` se volvía falso y Vue desmontaba la tarjeta durante el `await` del
 * create — antes de que corriera su propio `emit`, que en un componente
 * desmontado es un no-op (`runtime-core`, `emit()`: `if (instance.isUnmounted)
 * return`). El ingrediente se creaba y el recetario nunca se enteraba.
 *
 * Con el watcher, la tarjeta solo desaparece cuando cambia el texto de la
 * búsqueda: al escribir, o cuando el handler lo limpia — después de haber hecho
 * su trabajo. */
const suppliesNewName = ref('');
watch(suppliesSearch, (v) => {
  const n = v.trim();
  suppliesNewName.value = n && !nameTaken(n) ? n : '';
});

/* On the overview the bar is higher: the query has to match no product either,
 * or the card offers to create an ingredient while the thing you were looking
 * for is listed right underneath it. */
const overviewNewName = ref('');
watch(search, (v) => {
  const n = v.trim();
  overviewNewName.value =
    !n || nameTaken(n) || products.value.length || preparations.value.length ? '' : n;
});

/* Creating is a catalog gesture: the supply goes onto the shelf and no further.
 * Putting it on the bench would be guessing why it was created, and dragging it
 * costs one click.
 *
 * The search is NOT cleared: `liveIngredients` filters by it, so the new chip is
 * exactly what stays in view under the text that created it. What is withdrawn
 * is the card, and since its `v-if` hangs off these refs (see the comment
 * above), they are switched off here by hand. */
function onIngredientCreated() {
  suppliesNewName.value = '';
  overviewNewName.value = '';
}

/* A preparación opens instead of landing on a bench: it was created with an
 * empty recipe, and that recipe is the thing you actually came to fill in. */
async function onPreparacionCreated(created) {
  suppliesSearch.value = '';
  search.value = '';
  /* La pestaña resuelve su receta por el recipeId recién escrito, así que el
   * refetch va aquí y no en la tarjeta: la tarjeta ya se desmontó —su `v-if`
   * deja de cumplirse en cuanto la preparación existe— y nadie habría esperado
   * este await. */
  await ingredientStore.fetchAll().catch(() => {});
  openPreparacion(created);
}

/* ---------------- losing work ---------------- */

/* Both halves of every tab, not only the active one — a rendimiento typed on a
 * tab you navigated away from is still work a reload would destroy. */
const anyDirty = computed(() =>
  [...benches.values()].some((b) => b.isDirty.value) ||
  tabs.value.some(yieldDirtyOf));

// ponytail: native confirm(). Swap for a dialog when ui.css grows one — there
// is no ui-modal today and one guard does not earn the first.
function closeTab(id) {
  // Benches and yield drafts are both keyed by tab id, whichever kind of owner
  // the tab has.
  const b = benches.get(id);
  const tab = tabOf(id);

  if ((b?.isDirty.value || (tab && yieldDirtyOf(tab))) &&
      !confirm('Esta receta tiene cambios sin guardar. ¿Cerrar de todos modos?')) {
    return;
  }

  benches.delete(id);
  clearYieldDraft(id);
  tabs.value = tabs.value.filter((t) => t.id !== id);
  if (activeTab.value === id) activeTab.value = 'overview';
}

onBeforeRouteLeave(() =>
  !anyDirty.value ||
  confirm('Hay recetas con cambios sin guardar. ¿Salir de todos modos?'));

/* preventDefault is the whole API — browsers show their own wording and ignore
 * any message you pass. */
const warnOnUnload = (e) => { if (anyDirty.value) e.preventDefault(); };
onMounted(() => window.addEventListener('beforeunload', warnOnUnload));
onUnmounted(() => window.removeEventListener('beforeunload', warnOnUnload));
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
            <span class="ui-panehead-title">Productos y preparaciones</span>
            <span class="ui-panehead-sub">
              {{ products.length }} {{ products.length === 1 ? 'producto' : 'productos' }} ·
              {{ preparations.length }} {{ preparations.length === 1 ? 'preparación' : 'preparaciones' }}
            </span>
          </div>

          <UiSearchField
            v-model="search"
            class="mb-3"
            placeholder="Buscar producto o preparación…"
            label="Buscar producto o preparación"
          />

          <!-- The discovery path for a preparación: nothing matched what you
               typed, so the card offers to make it. Same component the Insumos
               pane uses — creating one should not require first opening
               somebody else's recipe to find the form. -->
          <IngredientCreateCard
            v-if="overviewNewName"
            :name="overviewNewName"
            :categories="categories"
            @created="onIngredientCreated"
            @created-preparacion="onPreparacionCreated"
          />

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
          <div v-else-if="!products.length && !preparations.length" class="ui-empty">
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

          <!-- No pips, no n/m: those count how many of a product's combinations
               have a recipe, and a preparación has exactly one. It also opens
               its tab directly rather than filling the right pane, which would
               be a click to show a list of one. -->
          <div v-if="preparations.length" class="mb-3">
            <div class="ui-sectionhead">Preparaciones</div>
            <button
              v-for="i in preparations" :key="i.id"
              class="ui-item"
              @click="openPreparacion(i)"
            >
              <span class="ui-item-icon"><PhFlask :size="16" /></span>
              <span class="min-w-0">
                <span class="ui-item-title block capitalize">{{ i.name }}</span>
                <span v-if="yieldOfIngredient(i)" class="ui-item-desc">
                  rinde {{ yieldOfIngredient(i) }} {{ i.unit }}
                </span>
              </span>
              <span class="ui-item-trail">
                <span class="ui-item-meta">{{ formatUnitCost(i.costPerUnit) }}/{{ i.unit }}</span>
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
                <span
                  v-if="c.recipeId"
                  class="ui-tag inline-flex items-center justify-center !p-1"
                  data-accent="brand"
                  aria-label="con receta"
                >
                  <PhCheckFat :size="12" weight="fill" />
                </span>
                <span v-else class="ui-tag" data-accent="brand">sin receta</span>
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

      <!-- Builder: the mesa de trabajo on the left, Insumos on the right. The
           panes swap roles exactly once, here, and never again. -->
      <div
        v-else-if="builder"
        class="ui-panes" style="--panes: minmax(0, 1fr) minmax(0, 1fr)"
      >
        <div class="ui-pane">
          <div class="ui-panehead">
            <span class="ui-panehead-title capitalize">{{ builder.ownerName }}</span>
            <span v-if="builder.kind === 'combo'" class="ui-panehead-sub">
              precio {{ formatMoney(price) }}
            </span>
          </div>

          <!-- Editable, and deliberately so: a rendimiento typed wrong at
               creation is otherwise permanent, and it silently scales the cost
               of everything this preparación goes into. It is part of the
               recipe document, so it saves through the same Guardar. -->
          <label
            v-if="builder.kind === 'prep'"
            class="ui-field max-w-[14rem] mb-4"
          >
            <span class="ui-field-k">Rendimiento</span>
            <span class="flex items-center gap-1.5">
              <input
                v-model="yieldDraft"
                class="ui-input ui-input-num flex-1"
                type="number" min="0" step="any" placeholder="0"
                :aria-invalid="!yieldValid"
              >
              <span class="ui-item-meta w-6 shrink-0">{{ builder.ingredient.unit }}</span>
            </span>
          </label>

          <!-- Every sibling, the current one selected — the strip doubles as
               "where am I" and "go next". -->
          <div
            v-if="builder.kind === 'combo' && combosOf(builder.product).length > 1"
            class="flex flex-wrap gap-1.5 mb-4"
          >
            <button
              v-for="s in combosOf(builder.product)" :key="s.id"
              class="ui-chip"
              :aria-current="s.id === builder.combo.id"
              @click="openCombination(builder.product, s)"
            >
              <i class="ui-pip" :class="{ 'ui-pip-on': s.recipeId }" />
              <span class="capitalize">{{ comboName(s, builder.product) }}</span>
            </button>
          </div>

          <div v-if="!bench && recipeStore.loading" class="ui-empty">
            Cargando receta…
          </div>

          <template v-else-if="bench">
            <div class="flex flex-wrap items-center gap-1.5 mb-3">
              <span class="ui-stat-k mr-1">Escalar la receta</span>
              <button
                v-for="f in [1.5, 2, 3, 0.5]" :key="f"
                class="ui-btn ui-num"
                :disabled="!lines.length"
                @click="scale(f)"
              >×{{ f }}</button>

              <span class="flex-1" />

              <AppTooltip text="Deshacer">
                <button
                  class="ui-btn ui-btn-icon"
                  :disabled="!canUndo"
                  aria-label="Deshacer"
                  @click="bench.undo()"
                >
                  <PhArrowCounterClockwise :size="15" />
                </button>
              </AppTooltip>
            </div>

            <!-- The drop handlers stay on a plain element. Putting them on the
                 TransitionGroup would rely on listener fallthrough to its
                 rendered tag, and a dragover that quietly fails to
                 preventDefault means the browser refuses every drop with no
                 error at all — the exact failure this screen already had once. -->
            <div
              class="ui-dropzone"
              :class="{ 'ui-dropzone-over': dragOverBench }"
              @dragover.prevent="dragOverBench = true"
              @dragleave="dragOverBench = false"
              @drop.prevent="onDrop"
            >
              <div v-if="!lines.length" class="ui-empty">
                <b>La mesa de trabajo está vacía</b>
                Haz clic o arrastra insumos de la derecha:
                ingredientes, preparaciones, otros productos o sus recetas.

                <template v-if="starterCombos.length">
                  <span class="block mt-3">
                    O comienza desde una combinación de este producto.
                  </span>
                  <!-- Copian, no navegan. La tira de hermanas de arriba hace lo
                       contrario con el mismo chip, y el conteo de líneas es lo
                       que separa a las dos. -->
                  <span class="flex flex-wrap justify-center gap-1.5 mt-2">
                    <button
                      v-for="s in starterCombos" :key="s.id"
                      class="ui-chip"
                      @click="putOnBench(s.rows)"
                    >
                      <span class="capitalize">{{ s.name }}</span>
                      <span class="ui-chip-meta">{{ s.count }} líneas</span>
                    </button>
                  </span>
                </template>
              </div>

              <TransitionGroup tag="div" name="ui-cascade" class="flex flex-col gap-1.5">
                <!-- Keyed on identity, never on the index: with `i` in the key,
                     deleting a row re-keys every row below it and they all
                     re-animate as if newly added. `--i` staggers the entrance,
                     which is what makes a dissolved recipe cascade. -->
                <div
                  v-for="(line, i) in rows" :key="lineKey(line)"
                  class="ui-item ui-item-filled ui-item-split"
                  :class="{ 'ui-item-zero': isUnpriced(line) }"
                  :aria-current="replacingIndex === line._i"
                  :style="{ '--i': i }"
                >
                  <span class="ui-tag" :title="kindOf(line).title">{{ kindOf(line).label }}</span>
                  <span class="min-w-0">
                    <span class="ui-item-title block capitalize">{{ line.name }}</span>
                    <span class="ui-item-desc">
                      {{ formatUnitCost(line.costPerUnit) }}/{{ line.unit }}
                      <template v-if="line.notes"> · {{ line.notes }}</template>
                    </span>
                  </span>

                  <!-- Its own grid cell, not part of the trail: in a narrow pane
                       the controls drop to their own line and the cost stays up
                       beside the name that gives it meaning (.ui-item-split).
                       Fixed width so the figure lands in the same place on
                       every row. -->
                  <span class="w-20 text-right shrink-0">
                    <span v-if="isUnpriced(line)" class="ui-tag">sin costo</span>
                    <span v-else class="ui-item-num ui-num">{{ formatMoney(lineCost(line)) }}</span>
                  </span>

                  <span class="ui-item-trail">
                    <!-- focus arms, the first keystroke snaps: one undo step per
                         edit, not one per keystroke, and none for a row you only
                         tabbed through. -->
                    <input
                      class="ui-input ui-input-num w-[5.5rem]"
                      type="number" min="0" step="any"
                      :data-qty="line._i"
                      :value="line.quantity || ''"
                      :aria-label="'Cantidad de ' + line.name"
                      :aria-invalid="!(line.quantity > 0)"
                      @focus="beginQuantityEdit(line._i)"
                      @input="setQuantity(line._i, $event.target.value)"
                    >
                    <span class="ui-item-meta w-6 shrink-0">{{ line.unit }}</span>
                    <!-- Alterna: pulsarlo en la fila ya armada cancela, que es
                         lo que espera quien lo pulsó por error. -->
                    <AppTooltip text="Reemplazar por otro insumo">
                      <button
                        class="ui-btn ui-btn-icon"
                        :aria-label="'Reemplazar ' + line.name"
                        :aria-pressed="replacingIndex === line._i"
                        @click="replacingIndex = replacingIndex === line._i ? null : line._i"
                      >
                        <PhArrowsLeftRight :size="13" />
                      </button>
                    </AppTooltip>
                    <AppTooltip text="Quitar">
                      <button
                        class="ui-btn ui-btn-icon ui-btn-danger"
                        :aria-label="'Quitar ' + line.name"
                        @click="removeLine(line._i)"
                      >
                        <PhX :size="13" weight="bold" />
                      </button>
                    </AppTooltip>
                  </span>
                </div>
              </TransitionGroup>
            </div>

            <p v-if="blankQuantities" class="ui-item-desc mt-2">
              {{ blankQuantities }} línea(s) sin cantidad — ponles una para poder
              guardar.
            </p>
            <p v-if="unpricedCount" class="ui-item-desc mt-2">
              {{ unpricedCount }} componente(s) sin costo — el total de abajo se
              queda corto hasta que tengan receta o precio.
            </p>
            <p v-if="saveError" class="ui-item-desc mt-2">{{ saveError }}</p>

            <!-- One hairline, one call site: a token in a style attribute, not
                 a new class and not a Tailwind border color. -->
            <div
              class="flex flex-wrap items-baseline justify-between gap-x-7 gap-y-3 mt-4 pt-3.5"
              style="border-top: 1px solid var(--ui-line)"
            >
              <span class="ui-stat">
                <span class="ui-stat-k">Costo receta</span>
                <span class="ui-stat-v">{{ formatMoney(recipeCost) }}</span>
              </span>

              <!-- A preparación is never sold, so precio, utilidad y margen
                   would be a sale that does not happen. What it has instead is
                   the number the backend derives on save: the total divided by
                   el rendimiento. -->
              <span v-if="builder.kind === 'prep'" class="ui-stat">
                <span class="ui-stat-k">Costo por {{ builder.ingredient.unit }}</span>
                <span class="ui-stat-v">
                  {{ prepUnitCost === null ? '—' : formatUnitCost(prepUnitCost) }}
                </span>
              </span>

              <template v-else>
                <span class="ui-stat">
                  <span class="ui-stat-k">Precio</span>
                  <span class="ui-stat-v">{{ formatMoney(price) }}</span>
                </span>
                <span class="ui-stat">
                  <span class="ui-stat-k">Utilidad</span>
                  <span class="ui-stat-v">
                    {{ lines.length ? formatMoney(profit) : '—' }}
                  </span>
                </span>
                <span class="ui-stat">
                  <span class="ui-stat-k">Margen</span>
                  <span class="ui-stat-v">{{ marginPct === null ? '—' : marginPct + '%' }}</span>
                </span>
              </template>
            </div>

            <!-- Actions after the summary: the totals row stays numbers only,
                 and reading top to bottom ends on the thing you press. -->
            <div class="flex flex-wrap items-center gap-1.5 mt-4">
              <button
                class="ui-btn ui-btn-solid"
                :disabled="!canSave || saving"
                :title="!lines.length
                  ? 'Una receta necesita al menos un componente'
                  : blankQuantities ? 'Hay líneas sin cantidad'
                    : !yieldValid ? 'Una preparación necesita un rendimiento mayor que cero' : ''"
                @click="save"
              >{{ saving ? 'Guardando…' : 'Guardar' }}</button>
              <button class="ui-btn ui-btn-danger" :disabled="!isDirty || saving" @click="resetBench()">
                Descartar
              </button>
            </div>
          </template>
        </div>

        <!-- Escape cancela desde cualquier parte del panel, incluida la caja de
             búsqueda: es la salida que la mano ya busca. `tabindex="-1"` para
             que el keydown llegue aunque el foco esté en el panel y no en un
             control. -->
        <div
          class="ui-pane ui-pane-sunken"
          tabindex="-1"
          @keydown.esc="cancelReplace"
        >
          <div class="ui-panehead">
            <span class="ui-panehead-title">Insumos</span>
            <span v-if="replacingLine" class="ui-panehead-sub flex items-center gap-2">
              <!-- resolveLine, no `.name`: una línea guardada no lleva nombre,
                   el backend lo quita y el catálogo lo vuelve a unir. -->
              <span>
                Reemplazando «<span class="capitalize">{{ resolveLine(replacingLine).name }}</span>»
              </span>
              <button class="ui-btn ui-btn-danger" @click="cancelReplace">Cancelar</button>
            </span>
            <span v-else class="ui-panehead-sub">
              {{ ingredientStore.items.length }} ingredientes
            </span>
          </div>

          <UiSearchField
            v-model="suppliesSearch"
            class="mb-3"
            placeholder="Buscar ingrediente, receta o producto…"
            label="Buscar insumo"
          />

          <!-- Only route into the feature for a bakery with an empty shelf,
               so it lives with the search rather than behind a separate form. -->
          <IngredientCreateCard
            v-if="suppliesNewName"
            :name="suppliesNewName"
            :categories="categories"
            @created="onIngredientCreated"
            @created-preparacion="onPreparacionCreated"
          />

          <div v-if="ingredientStore.loading && !shelves.length" class="ui-empty">
            Cargando insumos…
          </div>
          <div
            v-else-if="!shelves.length && !ingredientStore.items.length"
            class="ui-empty"
          >
            <b>No tienes insumos</b>
            Escribe un nombre arriba para crear tu primer ingrediente.
          </div>
          <div v-else-if="!shelves.length" class="ui-empty">
            Nada coincide con esa búsqueda.
          </div>

          <!-- One loop: every shelf hands over the same chip shape, and the
               only thing that differs is the rows it puts on the bench. -->
          <div v-for="shelf in shelves" :key="shelf.key" class="mb-4">
            <div class="ui-sectionhead">{{ shelf.title }}</div>
            <p v-if="shelf.hint" class="ui-item-desc mb-2">{{ shelf.hint }}</p>

            <!-- A flat shelf comes back as one nameless group, so grouped and
                 ungrouped share a single path and the chip markup exists once. -->
            <div
              v-for="g in chipGroups(shelf)" :key="g.name"
              :class="g.name ? 'mb-2' : ''"
            >
              <!-- ui-stat-k, not ui-sectionhead: that one is already spent on
                   the shelf title above and would compete with it. -->
              <div v-if="g.name" class="ui-stat-k mb-1.5 capitalize">{{ g.name }}</div>

              <div class="flex flex-wrap gap-1.5">
                <!-- `capitalize` sits on the name, not the chip: on the chip it
                     also transforms the unit, and `kg` became `Kg`.
                     Click as well as drag: drag does not exist on touch.
                     A div, not a button, for the same reason `.ui-tab` is one:
                     the × has to be a real button and buttons cannot nest, so
                     keyboard support comes back by hand. -->
                <div
                  v-for="chip in g.items" :key="chip.key"
                  class="ui-chip ui-chip-draggable"
                  :class="{ 'ui-chip-dragging': draggingId === chip.key }"
                  role="button" tabindex="0"
                  draggable="true"
                  @dragstart="onDragStart($event, shelf, chip)"
                  @dragend="draggingId = null"
                  @click="takeChip(shelf, chip)"
                  @keydown.enter="takeChip(shelf, chip)"
                  @keydown.space.prevent="takeChip(shelf, chip)"
                >
                  <span class="capitalize">{{ chip.name }}</span>
                  <span class="ui-chip-meta">{{ chip.meta }}</span>
                  <!-- Reuses .ui-tab-close: already a small × that fills danger
                       on hover. Rename it if a third call site shows up. -->
                  <AppTooltip
                    v-if="shelf.pinnable && !suppliesSearch.trim()"
                    text="Quitar de la estantería"
                  >
                    <button
                      class="ui-tab-close"
                      :aria-label="'Quitar ' + chip.name + ' de la estantería'"
                      @click.stop="unpin(shelf.key, chip.pinId)"
                    >
                      <PhX :size="11" weight="bold" />
                    </button>
                  </AppTooltip>
                </div>
              </div>
            </div>

            <!-- Outside the group loop: the cap is per shelf, not per group. -->
            <button
              v-if="shelf.items.length > SHELF_CAP"
              class="ui-btn mt-1"
              @click="expandedShelves[shelf.key] = !expandedShelves[shelf.key]"
            >
              {{ expandedShelves[shelf.key]
                ? 'Ver menos'
                : '+' + (shelf.items.length - SHELF_CAP) + ' más' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
