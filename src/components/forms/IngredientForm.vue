<script setup>
/* Under construction — deliberately emptied 2026-09-01, not abandoned.
 * The previous 451-line version is in git history if you want to read it.
 *
 * Why it went: the form was routed and reachable but could never create an
 * ingredient. It read `ingredientCategories` keyed by ingredient type —
 * `settings.ingredientCategories[formData.type]` — while bakery settings
 * stores that field as a FLAT ARRAY. So the lookup was always undefined, the
 * category dropdown was always empty, and `validate()` required a categoryId
 * that no user could pick. Editing an existing ingredient half-worked only
 * because its categoryId arrived prefilled.
 *
 * Rebuild from scratch with ui-*, don't repair this. Scope for the rebuild:
 * name, description, category, unit, costPerUnit, storage temperature,
 * preferredSupplier, stockBehavior, an optional production recipe (recipeId —
 * a preparación), and free-form custom attributes.
 *
 * NOT `isResale` — that flag is gone. Reventa is a property of a product
 * (`Product.inventoryMode: 'unit'`), not of an ingredient: an ingredient has no
 * price and no collection, and an order line only carries a productId.
 *
 * Until then, RecipeBookView.vue's despensa is where ingredients get created.
 * Its inline form is deliberately smaller — name, unit, cost, category — and
 * reads the categories array correctly. */
</script>

<template>
  <div class="p-6">En construcción.</div>
</template>
