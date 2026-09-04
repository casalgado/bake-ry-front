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
 * Rebuild from scratch with ui-*, don't repair this. What the old one covered,
 * so a rebuild knows the scope: name, description, isResale flag,
 * category, unit, costPerUnit, storage temperature, a suppliers list with a
 * preferred supplier, and free-form custom attributes.
 *
 * Until then, RecipeBookView.vue's despensa is where ingredients get created.
 * Its inline form is deliberately smaller — name, unit, cost, category — and
 * reads the categories array correctly. */
</script>

<template>
  <div class="p-6">En construcción.</div>
</template>
