// composables/useItemCatalog.js
import { computed } from 'vue';
import { useIngredientStore } from '@/stores/ingredientStore';
import { useProductStore } from '@/stores/productStore';

/**
 * The join every screen that stores *identities* needs back: given
 * `{ type, id, combinationId }`, what is this called and what does it cost?
 *
 * Recipe rows and stock movements both carry structure only — no name, no cost,
 * because the source document is the only honest place for either. So both the
 * recetario and the bodega resolve them at render time, and they have to
 * resolve them the same way or the two screens disagree about what a thing is.
 */

/* A product without variations is one combination: itself. Keeps every count a
 * plain sum instead of two branches everywhere. */
export const combosOf = (product) =>
  product?.hasVariations ? product.variations?.combinations ?? [] : [product];

/* The three shelves every inventory screen groups by. `kindOf` below is what
 * produces these keys, so the labels that go with them live here rather than in
 * a copy per screen. Insertion order is the shelf order. */
export const SHELF_TITLES = {
  ingr: 'Ingredientes',
  prep: 'Preparaciones',
  prod: 'Productos',
};

/* A stocks doc carries the same identity spread over three fields. One place
 * translates, so no call site pokes at ingredientId/productId by hand. */
export const itemOfStock = (stock) => ({
  type: stock.itemType,
  id: stock.itemType === 'product' ? stock.productId : stock.ingredientId,
  combinationId: stock.combinationId ?? null,
});

export function useItemCatalog() {
  const ingredientStore = useIngredientStore();
  const productStore = useProductStore();

  const ingredientById = computed(
    () => new Map(ingredientStore.items.map((i) => [i.id, i])));
  const productById = computed(
    () => new Map(productStore.items.map((p) => [p.id, p])));

  /* A null combinationId resolves to the product itself, same as combosOf. */
  const comboOf = (product, combinationId) =>
    combinationId ? combosOf(product).find((c) => c.id === combinationId) : product;

  const nameOf = ({ type, id, combinationId }) => {
    if (type !== 'product') return ingredientById.value.get(id)?.name ?? '';

    const product = productById.value.get(id);
    if (!product) return '';

    const combo = comboOf(product, combinationId);
    return product.hasVariations
      ? `${product.name} ${combo?.name ?? ''}`.trim()
      : product.name;
  };

  /**
   * `null` means "could not resolve", NOT "free". Callers render `—` for it and
   * never $0: a missing join and a genuinely costless item must not read the
   * same, or a broken catalog silently deflates a total.
   */
  const costOf = ({ type, id, combinationId }) => {
    if (type !== 'product') {
      const ingredient = ingredientById.value.get(id);
      return ingredient ? ingredient.costPerUnit ?? 0 : null;
    }

    const product = productById.value.get(id);
    if (!product) return null;

    const combo = comboOf(product, combinationId);
    return combo ? combo.costPrice ?? 0 : null;
  };

  /* Which shelf it belongs on. `prep` is not a component type — it is an
   * ingredient that carries a recipe of its own, and only the ingredient
   * document says so. Same split the recetario makes for its row badge. */
  const kindOf = ({ type, id }) => {
    if (type === 'product') return 'prod';
    return ingredientById.value.get(id)?.recipeId ? 'prep' : 'ingr';
  };

  /* What a PRODUCT is for, straight off the document: 'unit' is bought and
   * resold as it comes (una Coca-Cola), 'recipe' is made here, 'none' is not
   * tracked in the bodega at all. It is the marker that decides whether a
   * product belongs on Ingreso or on Producción, and there is deliberately no
   * second `isResale` flag — see zplanning/PLAN-resale-to-product.md §0.
   *
   * `null` for an ingredient, because the question does not apply to one:
   * ingredients split on `recipeId`, which is what `kindOf` above already
   * reads. Keeping the two questions separate is why 'prod' stays ONE shelf —
   * splitting it would fork SHELF_TITLES, which the recetario and Existencias
   * also render. */
  const modeOf = ({ type, id }) =>
    (type === 'product' ? productById.value.get(id)?.inventoryMode ?? 'none' : null);

  /* productById is here because the recetario groups recipes by the collection
   * of the product that owns them. combosOf stays a named export, not a member:
   * it needs no store. */
  return { productById, nameOf, costOf, kindOf, modeOf };
}
