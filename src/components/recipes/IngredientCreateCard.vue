<script setup>
/* The only route into creating an insumo: you typed a name, nothing matched, so
 * the card offers to make it. It lives with the search box rather than behind a
 * separate form, because "no existe todavía" is the moment you find out.
 *
 * It owns the writes so a second screen (Ingreso) can reuse the whole gesture
 * instead of re-implementing "what a new ingredient looks like". It emits what
 * it made; the screen decides what to do with it. */
import { ref, computed, watch, onMounted } from 'vue';
import { useIngredientStore } from '@/stores/ingredientStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { UNIT_OPTIONS, formatUnitCost, capitalize } from '@/utils/helpers';
import {
  Combobox,
  ComboboxLabel,
  ComboboxInput,
  ComboboxButton,
  ComboboxOptions,
  ComboboxOption,
} from '@headlessui/vue';
import { PhPlus, PhCaretUpDown } from '@phosphor-icons/vue';

const props = defineProps({
  /* The name typed into whichever search box owns this card. */
  name: { type: String, required: true },
  /* Flat array from bakerySettings. The backend requires id AND name. */
  categories: { type: Array, default: () => [] },
  /* Ingreso turns this off: a preparación needs a recipe, and you cannot buy
   * one anyway. */
  allowPreparacion: { type: Boolean, default: true },
  /* Se está llenando desde una factura: pregunta lo que la factura dice —
   * cantidad y total — y deriva el costo por unidad, en vez de pedir una
   * división que el papel ya trae hecha al revés. Los dos números salen además
   * en el `created`, para que la línea del ingreso no vuelva a pedirlos. */
  purchase: { type: Boolean, default: false },
  /* Hand the card the keyboard as soon as it appears. Off by default because on
   * the recetario the card shows up UNDER a search box you are still typing in —
   * stealing focus there would eat the next character. On Ingreso the card only
   * exists because you pressed Crear, so the gesture is finished and the form is
   * where you are going next. */
  autofocus: { type: Boolean, default: false },
  /* Off where the name comes from a search box you just typed in. On where it
   * comes from somewhere else (an invoice line) and needs correcting. */
  editableName: { type: Boolean, default: false },
});

const emit = defineEmits(['created', 'created-preparacion']);

const ingredientStore = useIngredientStore();
const recipeStore = useRecipeStore();
const settingsStore = useBakerySettingsStore();

const TYPES = [
  { id: 'ingrediente', label: 'Ingrediente', hint: 'se compra' },
  { id: 'preparacion', label: 'Preparación', hint: 'se produce' },
];

const type = ref('ingrediente');
const itemName = ref(props.name);
watch(() => props.name, (v) => { itemName.value = v; });
const draft = ref({ unit: '', costPerUnit: '', qty: '', total: '', categoryName: '' });
const creating = ref(false);
const createError = ref('');

/* La categoría se escribe, no se elige: la lista sugiere las que existen y el
 * campo acepta cualquier otra cosa, que se crea al enviar. Una panadería nueva
 * no tiene ninguna y el backend las exige, así que un select sería un callejón
 * sin salida en el primer minuto de uso.
 *
 * Headless UI deja el modelo en null al vaciar el input, así que el nombre pasa
 * siempre por este getter y nunca se le llama .trim() a un null. */
const categoryQuery = ref('');
const categoryName = computed(() => (draft.value.categoryName || '').trim());

const filteredCategories = computed(() => {
  const q = categoryQuery.value.trim().toLowerCase();
  return q
    ? props.categories.filter((c) => c.name.toLowerCase().includes(q))
    : props.categories;
});

const matchedCategory = computed(() => {
  const name = categoryName.value.toLowerCase();
  return props.categories.find((c) => c.name.trim().toLowerCase() === name) || null;
});

/* Sin coincidencia exacta, lo escrito es una opción más: el mismo Enter que
 * elige, crea — igual que la fila Crear de UiItemPicker. */
const canCreateCategory = computed(() => {
  const q = categoryQuery.value.trim();
  return !!q && !props.categories.some(
    (c) => c.name.trim().toLowerCase() === q.toLowerCase());
});

/* Abrir la lista al enfocar el campo. La prop `immediate` de Headless UI hace
 * justo esto, pero la 1.7.23 la declara en sus tipos y NO la incluye en
 * `dist/headlessui.esm.js`, que es el bundle que carga Vite: pasarla no hace
 * nada. El botón sí sabe abrir, así que se le da el clic — y solo si está
 * cerrada, porque su handler es un toggle y lo cerraría al volver el foco. */
const categoryButton = ref(null);
function onCategoryFocus(open) {
  categoryQuery.value = '';
  if (!open) categoryButton.value?.$el?.click();
}

/* Escribir crea, así que la tarjeta lo dice antes de que pase: un dedo torpe no
 * debería inventar "Harians" en los ajustes de la panadería sin avisar. */
const isNewCategory = computed(
  () => !!categoryName.value && !matchedCategory.value);

/* El costo con el que nace el ingrediente. En una compra sale de la factura;
 * en el catálogo se escribe directo. Sin cantidad no hay división posible, y
 * cero es lo mismo que decir "todavía no se sabe": el primer ingreso lo
 * corrige. */
const costPerUnit = computed(() => {
  if (!props.purchase) return Number(draft.value.costPerUnit) || 0;
  const qty = Number(draft.value.qty);
  const total = Number(draft.value.total);
  return qty > 0 && total > 0 ? total / qty : 0;
});

/* The first field in the card's own top-to-bottom order, not the most
 * interesting one: Costo and Categoría are one Tab away, and landing anywhere
 * else would make the form start in the middle of itself. */
const unitEl = ref(null);
onMounted(() => { if (props.autofocus) unitEl.value?.focus(); });

const clear = () => {
  draft.value = { unit: '', costPerUnit: '', qty: '', total: '', categoryName: '' };
  categoryQuery.value = '';
};

/* Shared by both paths — the backend requires both fields and stores the
 * category name denormalized. Returns null and sets the error when incomplete,
 * so each caller is one `if` rather than a repeated validation block.
 *
 * Un nombre que no existe se crea aquí mismo, en los ajustes, con el mismo
 * `patch('default')` que usa la pantalla de ajustes. El backend reconstruye el
 * modelo, así que una categoría sin id recibe uno allá y vuelve en la respuesta:
 * no hay id que inventar en el front. */
async function requireCategory() {
  /* Se normaliza al guardar, no al mostrar: el CSS `capitalize` escribiría
   * "Harinas Y Almidones", y el nombre queda copiado en cada ingrediente
   * (`categoryName`), así que lo que se guarda mal se propaga. */
  const name = capitalize(categoryName.value);
  createError.value = '';
  if (!itemName.value.trim() || !draft.value.unit || !name) {
    createError.value = 'Nombre, unidad y categoría son obligatorios.';
    return null;
  }

  if (matchedCategory.value) return matchedCategory.value;

  try {
    const settings = await settingsStore.patch('default', {
      ingredientCategories: [
        ...(settingsStore.items[0]?.ingredientCategories ?? []),
        { name },
      ],
    });

    /* Por nombre y no por posición: el id lo pone el backend y el orden del
     * arreglo que vuelve no es una promesa de nadie. */
    const created = settings?.ingredientCategories?.find((c) => c.name === name);
    if (created) return created;
    createError.value = `Se guardó la categoría «${name}», pero el servidor no la devolvió. Intentar de nuevo.`;
  } catch (err) {
    createError.value = err?.message || 'No se pudo crear la categoría.';
  }
  return null;
}

async function createIngredient() {
  creating.value = true;
  const category = await requireCategory();
  if (!category) {
    creating.value = false;
    return;
  }

  /* Read before the await: `clear()` runs after the emit, and the caller needs
   * what was typed, not the emptied form. */
  const purchased = {
    qty: Number(draft.value.qty) || null,
    total: Number(draft.value.total) || null,
  };

  try {
    const created = await ingredientStore.create({
      name: itemName.value.trim(),
      unit: draft.value.unit,
      costPerUnit: costPerUnit.value,
      categoryId: category.id,
      categoryName: category.name,
      /* `stocked`, not the model's `passThrough` default. passThrough deducts an
       * ingredient's own recipe components instead of its stock — right for
       * something you make, wrong for something you buy, which has no recipe for
       * the deduction to find. */
      stockBehavior: 'stocked',
    });

    /* Primero el emit, y sin nada asíncrono antes: el recetario muestra esta
     * tarjeta con un `v-if` que la creación misma vuelve falso — el ingrediente
     * entra al store y ya "existe", así que la tarjeta se desmonta. Todo lo que
     * quede después de un await corre sobre un componente que el padre ya sacó
     * del árbol. */
    emit('created', created, props.purchase ? purchased : null);
    clear();
  } catch (err) {
    createError.value = err?.message || 'No se pudo crear el ingrediente.';
  } finally {
    creating.value = false;
  }
}

/* Two writes, and the second can fail after the first succeeded. There is no
 * honest rollback — deleting the ingredient would destroy something the server
 * already accepted and may already have linked — so the error says exactly what
 * exists and what does not, and the user finishes the job from la estantería. */
async function createPreparacion() {
  creating.value = true;
  const category = await requireCategory();
  if (!category) {
    creating.value = false;
    return;
  }

  let created = null;
  try {
    /* No costPerUnit: it is derived from the recipe and the first save
     * overwrites anything set here. */
    created = await ingredientStore.create({
      name: itemName.value.trim(),
      unit: draft.value.unit,
      categoryId: category.id,
      categoryName: category.name,
      stockBehavior: 'stocked',
    });

    /* Empty recipe on purpose — the point of the gesture is to land in the mesa
     * de trabajo with it open. `yield: 1` is the smallest value validateOwner
     * accepts; the real rendimiento is edited there, next to the lines that give
     * it meaning. */
    await recipeStore.create({
      ingredientId: created.id,
      yield: 1,
      name: created.name,
      ingredients: [],
    });

    /* El refetch que necesita la pestaña —para resolver la receta por el
     * recipeId recién escrito— lo hace el padre: aquí ya no hay a quién
     * esperar, la tarjeta se desmonta en cuanto la preparación existe. */
    emit('created-preparacion', created);
    clear();
  } catch (err) {
    createError.value = created
      ? `Se creó «${created.name}», pero no su receta: ${
        err?.message || 'error desconocido'
      }. La receta se puede crear seleccionándolo en la lista.`
      : err?.message || 'No se pudo crear la preparación.';
  } finally {
    creating.value = false;
  }
}

const submit = () =>
  (type.value === 'preparacion' ? createPreparacion() : createIngredient());
</script>

<template>
  <form class="ui-card mb-4 flex flex-col gap-2" @submit.prevent="submit">
    <span class="ui-card-title">
      <template v-if="editableName">Crear ingrediente</template>
      <template v-else>Crear: <span class="capitalize">{{ itemName }}</span></template>
    </span>

    <label v-if="editableName" class="ui-field">
      <span class="ui-field-k">Nombre</span>
      <input v-model="itemName" class="ui-input" required>
    </label>

    <!-- The toggle replaces the paragraph that used to explain the difference:
         you pick what you are making and the form asks only for that. Ingreso
         has no second option, so it gets no toggle. -->
    <div v-if="allowPreparacion" class="flex gap-1.5">
      <button
        v-for="t in TYPES"
        :key="t.id"
        class="ui-chip"
        type="button"
        :aria-current="type === t.id"
        @click="type = t.id"
      >
        {{ t.label }}
        <span class="ui-chip-meta">{{ t.hint }}</span>
      </button>
    </div>

    <div class="flex flex-wrap gap-2">
      <label class="ui-field flex-1 min-w-[7rem]">
        <span class="ui-field-k">Unidad</span>
        <select ref="unitEl" v-model="draft.unit" class="ui-input" required>
          <option value="" disabled>Elige…</option>
          <option v-for="u in UNIT_OPTIONS" :key="u.symbol" :value="u.symbol">
            {{ u.symbol }} · {{ u.name }}
          </option>
        </select>
      </label>

      <!-- A preparación's cost comes from its recipe, so there is nothing to
           type here and anything typed would be overwritten. -->
      <template v-if="type === 'ingrediente'">
        <!-- Desde una factura se pregunta lo que la factura dice. El costo por
             unidad se muestra debajo, calculado, para que el número que queda
             guardado no sea una sorpresa. -->
        <template v-if="purchase">
          <label class="ui-field flex-1 min-w-[7rem]">
            <span class="ui-field-k">Cantidad</span>
            <input
              v-model="draft.qty"
              class="ui-input ui-input-num"
              type="number" min="0" step="any" placeholder="0"
            >
          </label>

          <label class="ui-field flex-1 min-w-[7rem]">
            <span class="ui-field-k">Total pagado</span>
            <input
              v-model="draft.total"
              class="ui-input ui-input-num"
              type="number" min="0" step="any" placeholder="0"
            >
          </label>
        </template>

        <label v-else class="ui-field flex-1 min-w-[7rem]">
          <span class="ui-field-k">Costo por unidad</span>
          <input
            v-model="draft.costPerUnit"
            class="ui-input ui-input-num"
            type="number" min="0" step="any" placeholder="0"
          >
        </label>
      </template>

      <!-- Combobox y no select: la lista sugiere las que existen y el campo
           acepta cualquier otro nombre, que se crea al enviar. Mismo Combobox de
           Headless UI que usa el formulario de pedidos, pero pintado con las
           clases de acá: el panel es .ui-card y las filas .ui-item. -->
      <Combobox
        v-slot="{ open }"
        v-model="draft.categoryName"
        as="div"
        class="ui-field flex-1 min-w-[7rem]"
        @update:model-value="categoryQuery = ''"
      >
        <ComboboxLabel class="ui-field-k">Categoría</ComboboxLabel>
        <div class="relative">
          <!-- El filtro se limpia al entrar al campo y al elegir: abrir la lista
               es "ver qué hay", y una búsqueda vieja escondiendo la mitad de las
               categorías es exactamente lo contrario. -->
          <ComboboxInput
            class="ui-input w-full"
            autocomplete="off"
            enterkeyhint="done"
            placeholder="Escribe o elige…"
            :display-value="(v) => v || ''"
            @focus="onCategoryFocus(open)"
            @change="categoryQuery = $event.target.value"
          />
          <!-- m-0: custom-components.css le pone `my-2` a todo <button>, y con
               inset-y-0 eso lo empuja fuera del campo. -->
          <ComboboxButton
            ref="categoryButton"
            class="absolute inset-y-0 right-0 flex items-center px-2 m-0 cursor-pointer"
            aria-label="Ver categorías"
            @click="categoryQuery = ''"
          >
            <PhCaretUpDown :size="14" />
          </ComboboxButton>

          <ComboboxOptions
            class="ui-card absolute z-10 mt-1 w-full max-h-56 overflow-y-auto p-1"
          >
            <div
              v-if="!filteredCategories.length && !canCreateCategory"
              class="ui-empty"
            >
              Sin categorías. Escribir un nombre para crear una.
            </div>

            <ComboboxOption
              v-for="c in filteredCategories"
              :key="c.id"
              v-slot="{ active }"
              :value="c.name"
            >
              <div class="ui-item cursor-pointer" :aria-current="active">
                <span />
                <span class="ui-item-title">{{ c.name }}</span>
              </div>
            </ComboboxOption>

            <!-- Última y una opción de verdad: llegar a ella con la misma tecla
                 que a las demás es el punto de ponerla en la lista. -->
            <ComboboxOption
              v-if="canCreateCategory"
              v-slot="{ active }"
              :value="categoryQuery.trim()"
            >
              <div class="ui-item cursor-pointer" :aria-current="active">
                <span class="ui-item-icon"><PhPlus :size="14" weight="bold" /></span>
                <span class="ui-item-title">{{ capitalize(categoryQuery.trim()) }} (nueva)</span>
              </div>
            </ComboboxOption>
          </ComboboxOptions>
        </div>
      </Combobox>
    </div>

    <p v-if="isNewCategory" class="ui-item-desc">
      «{{ capitalize(categoryName) }}» no existe: se creará como categoría nueva.
    </p>

    <p v-if="purchase && type === 'ingrediente'" class="ui-item-desc">
      <template v-if="costPerUnit > 0">
        Costo por {{ draft.unit || 'unidad' }}:
        <b class="ui-num">{{ formatUnitCost(costPerUnit) }}</b>. Se guarda como
        costo del insumo y se puede corregir en la próxima compra.
      </template>
      <template v-else>
        Con la cantidad y el total se calcula el costo por unidad. Sin ellos el
        insumo se crea sin costo.
      </template>
    </p>

    <p v-if="createError" class="ui-item-desc">{{ createError }}</p>

    <div class="flex justify-end">
      <button
        class="ui-btn ui-btn-solid"
        type="submit"
        :disabled="creating"
      >
        <PhPlus :size="14" weight="bold" />
        <template v-if="creating">Creando…</template>
        <template v-else-if="type === 'preparacion'">Crear preparación</template>
        <template v-else>Crear ingrediente</template>
      </button>
    </div>
  </form>
</template>
