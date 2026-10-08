<script setup>
/* The chrome the four inventory screens share: the ground, the title, the card
 * they sit in, and the catalogs they all read.
 *
 * It stays mounted across the four child routes, so the fetches below happen
 * once for the whole section rather than on every screen. The open documents do
 * NOT live here — they live in inventoryDocsStore, so they also survive leaving
 * inventory altogether, which is the point of the split.
 *
 * There is no tab rail: the sidebar carries the four links, and a second
 * navigation for the same four things is just a second thing to keep in sync.
 * What the rail's badge did — say what is waiting inside without opening it —
 * the three buttons on Bodega do now. */
import { ref, onMounted, onUnmounted } from 'vue';
import { useStockStore } from '@/stores/stockStore';
import { useIngredientStore } from '@/stores/ingredientStore';
import { useProductStore } from '@/stores/productStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { useInventoryDocsStore } from '@/stores/inventoryDocsStore';

const stockStore = useStockStore();
const ingredientStore = useIngredientStore();
const productStore = useProductStore();
const bakerySettingsStore = useBakerySettingsStore();
const docsStore = useInventoryDocsStore();

/* Stocks carry no cost — the doc holds itemKey, name, unit and currentStock and
 * nothing in pesos — so every value on these screens is a client-side join
 * against the two catalogs. That is what the ingredient and product fetches are
 * for.
 *
 * Recipes are deliberately NOT fetched: producción's component expansion is a
 * backend walk (EXISTENCIAS-BUILD.md §4.1), and this section never re-derives
 * it. */

/* Not swallowed like the stocks fetch is: stockStore surfaces its own error,
 * but if a CATALOG fails every name on the screen degrades to a raw itemKey and
 * every cost to `—`, which reads as a broken bakery rather than a failed
 * request. Say so instead. */
const catalogError = ref('');

/* The only guard left. Navigating away no longer loses anything — the store
 * holds the documents — so there is nothing for a route guard to protect, and
 * the nag that used to fire on every exit is gone.
 *
 * preventDefault is the whole API; browsers show their own wording. */
const warnOnUnload = (e) => { if (docsStore.anyDirty) e.preventDefault(); };

/* Existencias refreshes itself while the section is open: the store listens for
 * anything that moves it and refetches. */
let stopWatching = () => {};

onMounted(() => {
  stockStore.fetchAll().catch(() => {});
  stopWatching = stockStore.watchAvailability();

  Promise.all([ingredientStore.fetchAll(), productStore.fetchAll()])
    .catch((err) => {
      catalogError.value = err?.message || 'No se pudieron cargar los catálogos.';
    });

  // The feature guard already read settings to get here, so this is a no-op.
  if (!bakerySettingsStore.items.length) {
    bakerySettingsStore.fetchById('default').catch(() => {});
  }

  window.addEventListener('beforeunload', warnOnUnload);
});

onUnmounted(() => {
  window.removeEventListener('beforeunload', warnOnUnload);
  stopWatching();
});
</script>

<template>
  <!-- The dashboard shell paints neutral-150; this section paints its own ground
       so the ui-* surface ladder starts where the tokens expect it to.

       No padding here: each screen owns its own gutter. Conteo is a phone-in-hand
       screen that wants to go edge to edge, and fighting a parent's padding with
       a negative margin is worse than never having it. -->
  <div
    class="w-full self-start min-h-full"
    data-ui-theme="light"
    style="background: var(--ui-surface-0); color: var(--ui-ink)"
  >
    <!-- Each screen renders its own PageHeader and its own ui-app card: the
         title belongs to the screen, not to a route meta field two files away,
         and the header's action slot is where a screen's own buttons go.
         This layout owns only what all four genuinely share.

         Keyed on the path: Ingreso and Producción are two routes onto ONE
         component, and without a key Vue patches the instance instead of
         remounting it — `kind` would change under a screen that already opened
         the other document. It also keeps each screen's search box and
         selection to itself. -->
    <!-- Carries its own gutter now that the ground has none: this banner sits
         above the screen's own wrapper, so without it it would run edge to edge
         while everything under it is inset. -->
    <p v-if="catalogError" class="ui-empty mx-4 lg:mx-6 mt-4 lg:mt-6" style="padding-block: 12px">
      <b>No se pudieron cargar los catálogos</b>
      Los nombres y los costos de esta pantalla van a salir incompletos.
      {{ catalogError }}
    </p>

    <router-view :key="$route.path" />
  </div>
</template>
