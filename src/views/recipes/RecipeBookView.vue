<script setup>
import { ref, shallowReactive, computed, watch, onMounted, onUnmounted } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import PageHeader from '@/components/ui/PageHeader.vue';
import { useProductStore } from '@/stores/productStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { useIngredientStore } from '@/stores/ingredientStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { useAuthenticationStore } from '@/stores/authentication';
import { useUndoSnapshot } from '@/composables/useUndoSnapshot';
import { formatMoney, UNIT_OPTIONS } from '@/utils/helpers';
import { PhFlask, PhX, PhPlus, PhArrowCounterClockwise } from '@phosphor-icons/vue';

const productStore = useProductStore();
const recipeStore = useRecipeStore();
const ingredientStore = useIngredientStore();
const bakerySettingsStore = useBakerySettingsStore();
const search = ref('');
const selectedId = ref(null);

/* Tab ids are plain strings: 'overview' plus one combination id each. A tab
 * carries productId/comboId rather than the objects themselves, so it survives
 * a refetch and doesn't pin a stale copy of the product. */
const activeTab = ref('overview');
const tabs = ref([{ id: 'overview', label: 'Recetario' }]);

/* fetchAll rethrows after storing the message on the store, so the .catch is
 * what keeps it from becoming an unhandled rejection. The error is rendered,
 * not swallowed: without it a failed fetch reads as "no tienes productos".
 *
 * Ingredients are fetched for one reason: a component row carries a
 * denormalized name/unit/costPerUnit, but not whether the ingredient it points
 * at is something you make. Only the ingredient document knows that. */
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
    bakerySettingsStore.fetchAll().catch(() => {});
  }
  loadPins();
});

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

/* Resolved off productStore.items, not the filtered list: typing in the search
 * box must not blank an open builder. */
const builder = computed(() => {
  const tab = tabs.value.find((t) => t.id === activeTab.value);
  if (!tab?.comboId) return null;

  const product = productStore.items.find((p) => p.id === tab.productId);
  const combo = product && combosOf(product).find((c) => c.id === tab.comboId);
  return combo ? { product, combo } : null;
});

/* ---------------- the bench ---------------- */

/* One editable copy per COMBINATION, not per recipe. A combination with no
 * recipe still needs a bench to build on — that is the state every new bakery
 * is in, and keying by recipe id meant it got nothing at all. */
/* shallowReactive, NOT reactive. A deep-reactive Map wraps every value it
 * hands back, and a reactive object UNWRAPS the refs inside it — so
 * `bench.copy` came back as the bare array and `bench.copy.value` was
 * undefined. Every line read as empty and nothing could be added. Shallow keeps
 * the Map itself tracked (a computed still re-runs when a key is set) while
 * handing the composable's refs back untouched. */
const benches = shallowReactive(new Map());

function benchFor(comboId, productId) {
  if (!benches.has(comboId)) {
    /* A computed over the store, not a plain array: after a save the store
     * swaps in the server's copy and isDirty has to compare against that one.
     * Resolves to [] until a recipe exists, which is the empty mesa. */
    const source = computed(() => {
      const product = productStore.items.find((p) => p.id === productId);
      const combo = product && combosOf(product).find((c) => c.id === comboId);
      const recipe =
        combo?.recipeId &&
        recipeStore.items.find((r) => r.id === combo.recipeId);
      return recipe ? recipe.ingredients ?? [] : [];
    });
    benches.set(comboId, useUndoSnapshot(source));
  }
  return benches.get(comboId);
}

/* Fetch the recipe if there is one, then make sure the tab has a bench either
 * way. Keyed on the combination id so reopening a tab re-reads the store rather
 * than the network. */
watch(
  () => builder.value?.combo.id,
  async (comboId) => {
    if (!comboId || !builder.value) return;
    const { product, combo } = builder.value;

    if (combo.recipeId && !recipeStore.items.some((r) => r.id === combo.recipeId)) {
      await recipeStore.fetchById(combo.recipeId).catch(() => {});
    }
    benchFor(comboId, product.id);
  },
  { immediate: true },
);

/* Unwrapped once here so `.value` stays out of the template. */
const bench = computed(() => {
  const comboId = builder.value?.combo.id;
  return comboId ? benches.get(comboId) ?? null : null;
});
const lines = computed(() => bench.value?.copy.value ?? []);
const canUndo = computed(() => bench.value?.canUndo.value ?? false);
const isDirty = computed(() => bench.value?.isDirty.value ?? false);

/* Which shelf a line came off. `type` is the only thing stored — 'prep' is not
 * a component type, it is an ingredient that carries a recipe of its own, and
 * only the ingredient document says so. */
const ingredientById = computed(
  () => new Map(ingredientStore.items.map((i) => [i.id, i])),
);
const kindOf = (line) =>
  line.type === 'product'
    ? { label: 'prod', title: 'Otro producto' }
    : ingredientById.value.get(line.id)?.recipeId
      ? { label: 'prep', title: 'Preparación con receta propia' }
      : { label: 'ingr', title: 'Ingrediente' };

const lineCost = (line) => (line.quantity || 0) * (line.costPerUnit || 0);

const recipeCost = computed(() =>
  lines.value.reduce((sum, line) => sum + lineCost(line), 0));
const price = computed(() => (builder.value ? priceOf(builder.value.combo) : 0));
const profit = computed(() => price.value - recipeCost.value);

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

const unpricedCount = computed(() => lines.value.filter(isUnpriced).length);

/* The backend refuses the whole recipe over one bad line — resolveComponents
 * throws on `!(quantity > 0)` and names the component by id, which is not a
 * thing anyone can read. So the check lives here too, and Guardar stays off
 * until every line has a quantity. */
const blankQuantities = computed(
  () => lines.value.filter((l) => !(l.quantity > 0)).length);

/* ---------------- putting things on the bench ---------------- */

/* Counted things start at one, measured things at a round hundred. Includes the
 * older stored spellings as well as the current symbols, since existing
 * ingredients carry whatever unit they were saved with. */
const COUNT_UNITS = new Set([
  'uds', 'dz', 'paq', 'und', 'unidad', 'unidades', 'docena', 'paquete',
]);
const startingQuantity = (unit) => (COUNT_UNITS.has(unit) ? 1 : 100);

/* Identity for merging. A product used twice at different sizes is two
 * different lines, so the combination is part of the key. */
const lineKey = (l) => `${l.type}:${l.id}:${l.combinationId ?? ''}`;

const sameComponent = (a, b) => lineKey(a) === lineKey(b);

/* The shape of a line on the bench, in one place. Every shelf builds rows
 * through here, so a field cannot go missing on one path and not another —
 * `combinationId: undefined` reaching the backend is what this prevents. The
 * defaults are also the normalization for lines read back off a stored recipe,
 * which is the one source that can be missing any of them. */
/* `??`/`||` rather than destructuring defaults: those only fire on `undefined`,
 * and a stored line can carry a null cost or an empty type. */
const componentRow = ({
  type, id, combinationId, name, unit, costPerUnit, quantity, notes,
}) => ({
  type: type || 'ingredient',
  id,
  combinationId: combinationId ?? null,
  name,
  unit,
  costPerUnit: costPerUnit ?? 0,
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

  b.snap();
  const merged = [...b.copy.value];

  for (const row of rows) {
    const at = merged.findIndex((l) => sameComponent(l, row));
    if (at >= 0) {
      merged[at] = {
        ...merged[at],
        quantity: (merged[at].quantity || 0) + (row.quantity || 0),
      };
    } else {
      merged.push(row);
    }
  }

  b.copy.value = merged;
}

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
  () => isDirty.value && lines.value.length > 0 && !blankQuantities.value);

async function save() {
  const b = bench.value;
  if (!b || !canSave.value || !builder.value) return;
  const { product, combo } = builder.value;

  saving.value = true;
  saveError.value = '';
  try {
    if (combo.recipeId) {
      /* `update` (PUT), not `patch`. Sending only `ingredients` is safe because
       * the backend merges onto the stored document — but only the PUT route
       * runs recipeService.update, which re-denormalizes name/unit/cost from
       * the source docs, bumps the version and maintains `usedInRecipes`. The
       * PATCH route writes the field and does none of that. */
      await recipeStore.update(combo.recipeId, { ingredients: b.copy.value });
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
      // The pointer landed on the product document, so re-read it — the pips
      // and the "sin receta" tag on the recetario are read from there.
      await productStore.fetchAll().catch(() => {});
    }
    // Re-copy from what came back, so the stack starts clean at the saved state.
    b.reset();
  } catch (err) {
    saveError.value = err?.message || 'No se pudo guardar la receta.';
  } finally {
    saving.value = false;
  }
}

/* ---------------- insumos (the supplies shelf) ---------------- */

/* A cost *per unit* is often a fraction of a peso — harina at 3.5/g — and the
 * default rounds that to 4. One decimal only when there is one, so whole
 * numbers stay clean. */
const formatUnitCost = (value) =>
  formatMoney(Number(value) || 0, { maxFractionDigits: 1 });

/* Stored as a flat array — every seed and every backup has it that way, and
 * `BakerySettings` maps it as one. `IngredientForm.vue` reads it keyed by
 * ingredient type instead, so that dropdown is always empty and no ingredient
 * can be created through it. That file is frozen, so this reads it correctly
 * rather than fixing it there. */
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
const ingredientChip = (i) => ({
  key: `i:${i.id}`,
  name: i.name,
  meta: `${formatUnitCost(i.costPerUnit)}/${i.unit}`,
  rows: [componentRow({
    id: i.id,
    name: i.name,
    unit: i.unit,
    costPerUnit: i.costPerUnit,
    quantity: startingQuantity(i.unit),
  })],
});

const liveIngredients = computed(() =>
  ingredientStore.items.filter((i) => !i.isDeleted && matchesSearch(i.name)));

/* An ingredient with a recipe of its own is a preparación — the split is the
 * same one `kindOf` makes for the badge, and the ingredient document is the
 * only thing that knows. */
const shelfIngredients = computed(() =>
  [...liveIngredients.value].filter((i) => !i.recipeId).sort(byUse).map(ingredientChip));

const shelfPreparations = computed(() =>
  [...liveIngredients.value].filter((i) => i.recipeId).sort(byUse).map(ingredientChip));

/* ---------------- pinned shelves ---------------- */

/* Productos and Recetas are too big to list: products × combinations is 600
 * chips for a mid-size bakery, and the useful set on any day is three or four.
 * So those two invert — search first, and what you pick stays.
 *
 * IDs only, never the rendered chip. The shelf resolves them against the stores
 * below, so anything deleted just drops off instead of leaving a chip that
 * errors when clicked.
 *
 * Same shape as the preference at OrderForm.vue:159, scoped per bakery because
 * a system_admin switches between them. */
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
 * in `unidad` — the backend re-derives both on save (resolveComponents), and
 * its cost is the COMBINATION's costPrice, which is 0 until that combination
 * has a recipe of its own. That zero is exactly what `sin costo` flags. */
const productChips = computed(() => {
  const currentComboId = builder.value?.combo.id;

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
        meta: 'unidad',
        rows: [componentRow({
          type: 'product',
          id: p.id,
          combinationId: p.hasVariations ? c.id : null,
          name,
          unit: 'unidad',
          costPerUnit: c.costPrice,
          quantity: 1,
        })],
      };
    });
});

/* Recipes are the odd shelf: not a component, a paste. Dropping one merges its
 * lines into the bench and nothing ends up pointing at it. */
/* A recipe has no collection of its own — it borrows the one from the product
 * it belongs to, and falls back when that product is gone. */
const productById = computed(
  () => new Map(productStore.items.map((p) => [p.id, p])));

const recipeChips = computed(() => {
  const currentRecipeId = builder.value?.combo.recipeId;
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
const shelves = computed(() => [
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
].filter((s) => s.items.length));

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

const newName = computed(() => suppliesSearch.value.trim());

/* The create row hides on an exact name match. Duplicate ingredients are what
 * makes the shelf unusable, and the search is the only thing standing between
 * you and three kinds of "Harina". */
const nameTaken = computed(() => {
  const n = newName.value.toLowerCase();
  return !!n && ingredientStore.items.some((i) => i.name?.toLowerCase() === n);
});

const newIngredient = ref({ unit: '', costPerUnit: '', categoryId: '' });
const creating = ref(false);
const createError = ref('');

async function createIngredient() {
  const { unit, costPerUnit, categoryId } = newIngredient.value;
  const category = categories.value.find((c) => c.id === categoryId);

  createError.value = '';
  if (!unit || !category) {
    createError.value = 'Elige una unidad y una categoría.';
    return;
  }

  creating.value = true;
  try {
    const created = await ingredientStore.create({
      name: newName.value,
      unit,
      costPerUnit: Number(costPerUnit) || 0,
      // The backend requires both, and stores the name denormalized.
      categoryId: category.id,
      categoryName: category.name,
      /* `stocked`, not the model's `passThrough` default. passThrough deducts
       * an ingredient's own recipe components instead of its stock — right for
       * something you make, wrong for something you buy, which has no recipe
       * for deduction to find. `type` is left to default to 'manufactured',
       * matching every ingredient already in the data. */
      stockBehavior: 'stocked',
    });

    /* Straight onto the mesa. You only created it because you wanted it in this
     * recipe, and a new ingredient has no uses yet — so on the shelf it sorts
     * last, past the cap, invisible. Same rows as its chip, so a created
     * ingredient and a dragged one land identically. */
    putOnBench(ingredientChip(created).rows);

    suppliesSearch.value = '';
    newIngredient.value = { unit: '', costPerUnit: '', categoryId: '' };
  } catch (err) {
    createError.value = err?.message || 'No se pudo crear el ingrediente.';
  } finally {
    creating.value = false;
  }
}

/* ---------------- losing work ---------------- */

const anyDirty = computed(() =>
  [...benches.values()].some((b) => b.isDirty.value));

// ponytail: native confirm(). Swap for a dialog when ui.css grows one — there
// is no ui-modal today and one guard does not earn the first.
function closeTab(id) {
  // A tab id IS its combination id, which is what benches are keyed by.
  const b = benches.get(id);

  if (b?.isDirty.value &&
      !confirm('Esta receta tiene cambios sin guardar. ¿Cerrar de todos modos?')) {
    return;
  }

  benches.delete(id);
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

      <!-- Builder: the mesa de trabajo on the left, Insumos on the right. The
           panes swap roles exactly once, here, and never again. -->
      <div
        v-else-if="builder"
        class="ui-panes" style="--panes: minmax(0, 1fr) minmax(0, 1fr)"
      >
        <div class="ui-pane">
          <div class="ui-panehead">
            <span class="ui-panehead-title capitalize">
              {{ builder.product.name }} · {{ comboName(builder.combo, builder.product) }}
            </span>
            <span class="ui-panehead-sub">
              precio {{ formatMoney(price) }}
            </span>
          </div>

          <!-- Every sibling, the current one selected — the strip doubles as
               "where am I" and "go next". -->
          <div
            v-if="combosOf(builder.product).length > 1"
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

              <button
                class="ui-btn ui-btn-icon"
                :disabled="!canUndo"
                aria-label="Deshacer"
                title="Deshacer"
                @click="bench.undo()"
              >
                <PhArrowCounterClockwise :size="15" />
              </button>
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
                Arrastra un insumo desde la derecha, o haz clic en él, para empezar.
              </div>

              <TransitionGroup tag="div" name="ui-cascade" class="flex flex-col gap-1.5">
                <!-- Keyed on identity, never on the index: with `i` in the key,
                     deleting a row re-keys every row below it and they all
                     re-animate as if newly added. `--i` staggers the entrance,
                     which is what makes a dissolved recipe cascade. -->
                <div
                  v-for="(line, i) in lines" :key="lineKey(line)"
                  class="ui-item ui-item-filled"
                  :class="{ 'ui-item-zero': !line.costPerUnit }"
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

                  <span class="ui-item-trail">
                    <!-- focus arms, the first keystroke snaps: one undo step per
                         edit, not one per keystroke, and none for a row you only
                         tabbed through. -->
                    <input
                      class="ui-input ui-input-num w-[5.5rem]"
                      type="number" min="0" step="any"
                      :value="line.quantity"
                      :aria-label="'Cantidad de ' + line.name"
                      :aria-invalid="!(line.quantity > 0)"
                      @focus="beginQuantityEdit(i)"
                      @input="setQuantity(i, $event.target.value)"
                    >
                    <span class="ui-item-meta">{{ line.unit }}</span>
                    <span v-if="isUnpriced(line)" class="ui-tag">sin costo</span>
                    <span v-else class="ui-item-num ui-num">{{ formatMoney(lineCost(line)) }}</span>
                    <button
                      class="ui-btn ui-btn-icon ui-btn-danger"
                      :aria-label="'Quitar ' + line.name"
                      title="Quitar"
                      @click="removeLine(i)"
                    >
                      <PhX :size="13" weight="bold" />
                    </button>
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
            </div>

            <!-- Actions after the summary: the totals row stays numbers only,
                 and reading top to bottom ends on the thing you press. -->
            <div class="flex flex-wrap items-center gap-1.5 mt-4">
              <button
                class="ui-btn ui-btn-solid"
                :disabled="!canSave || saving"
                :title="!lines.length
                  ? 'Una receta necesita al menos un componente'
                  : blankQuantities ? 'Hay líneas sin cantidad' : ''"
                @click="save"
              >{{ saving ? 'Guardando…' : 'Guardar' }}</button>
              <button class="ui-btn" :disabled="!isDirty || saving" @click="bench.reset()">
                Descartar
              </button>
            </div>
          </template>
        </div>

        <div class="ui-pane ui-pane-sunken">
          <div class="ui-panehead">
            <span class="ui-panehead-title">Insumos</span>
            <span class="ui-panehead-sub">
              {{ ingredientStore.items.length }} ingredientes
            </span>
          </div>

          <div class="ui-search mb-3">
            <input
              v-model="suppliesSearch"
              class="ui-input"
              type="text"
              role="searchbox"
              enterkeyhint="search"
              placeholder="Buscar ingrediente, receta o producto…"
              aria-label="Buscar ingrediente, receta o producto"
              @keydown.esc="suppliesSearch = ''"
            >
            <button
              v-if="suppliesSearch"
              class="ui-search-clear"
              type="button"
              aria-label="Limpiar búsqueda"
              @click="suppliesSearch = ''"
            >
              <PhX :size="12" weight="bold" />
            </button>
          </div>

          <!-- Only route into the feature for a bakery with an empty shelf,
               so it lives with the search rather than behind a separate form. -->
          <form
            v-if="newName && !nameTaken"
            class="ui-card mb-4 flex flex-col gap-2"
            @submit.prevent="createIngredient"
          >
            <!-- The colon does the work the quotes were doing: it separates the
                 verb from the name without asking you to parse punctuation
                 around the thing you just typed. -->
            <span class="ui-card-title">
              Crear: <span class="capitalize">{{ newName }}</span>
            </span>

            <div class="flex flex-wrap gap-2">
              <label class="ui-field flex-1 min-w-[7rem]">
                <span class="ui-field-k">Unidad</span>
                <select v-model="newIngredient.unit" class="ui-input" required>
                  <option value="" disabled>Elige…</option>
                  <option v-for="u in UNIT_OPTIONS" :key="u.symbol" :value="u.symbol">
                    {{ u.symbol }} · {{ u.name }}
                  </option>
                </select>
              </label>

              <label class="ui-field flex-1 min-w-[7rem]">
                <span class="ui-field-k">Costo por unidad</span>
                <input
                  v-model="newIngredient.costPerUnit"
                  class="ui-input ui-input-num"
                  type="number" min="0" step="any" placeholder="0"
                >
              </label>
            </div>

            <label class="ui-field">
              <span class="ui-field-k">Categoría</span>
              <select v-model="newIngredient.categoryId" class="ui-input" required>
                <option value="" disabled>Elige…</option>
                <option v-for="c in categories" :key="c.id" :value="c.id">
                  {{ c.name }}
                </option>
              </select>
            </label>

            <p v-if="!categories.length" class="ui-item-desc">
              Esta panadería no tiene categorías de ingredientes configuradas, y
              el backend las exige. Agrégalas en los ajustes antes de crear.
            </p>
            <p v-if="createError" class="ui-item-desc">{{ createError }}</p>

            <div class="flex justify-end">
              <button
                class="ui-btn ui-btn-solid"
                type="submit"
                :disabled="creating || !categories.length"
              >
                <PhPlus :size="14" weight="bold" />
                {{ creating ? 'Creando…' : 'Crear ingrediente' }}
              </button>
            </div>
          </form>

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
                  <button
                    v-if="shelf.pinnable && !suppliesSearch.trim()"
                    class="ui-tab-close"
                    :aria-label="'Quitar ' + chip.name + ' de la estantería'"
                    title="Quitar de la estantería"
                    @click.stop="unpin(shelf.key, chip.pinId)"
                  >
                    <PhX :size="11" weight="bold" />
                  </button>
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
