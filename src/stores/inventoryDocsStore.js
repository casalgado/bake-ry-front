// stores/inventoryDocsStore.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

/**
 * The documents you have open in Inventario: one Ingreso, one Producción, one
 * Conteo, at most.
 *
 * They live in a store rather than in a shell component because loading a
 * delivery and counting a bodega are long, interruptible tasks — the whole
 * reason they were never modals. A component-owned draft dies the moment you
 * walk over to Pedidos to check something, which is exactly the interruption
 * that was supposed to be survivable. This survives it.
 *
 * What it does NOT survive is a reload: drafts are server-side and arrive with
 * their own endpoints (EXISTENCIAS-BUILD.md §4.2, §4.3). Until then every
 * screen that holds one says so out loud.
 *
 * ponytail: one document per kind, not a list. Two deliveries open at once is
 * not a scenario anyone named; a count AND a delivery is, and that already
 * works because they are different kinds. Give the doc an id and the route a
 * param if the second one ever shows up.
 */

const DOC_KINDS = ['ingreso', 'produccion', 'conteo'];

const blankDoc = (kind, warehouseId) => ({
  kind,
  date: new Date().toISOString().slice(0, 10),
  party: '',
  warehouseId,
  // Ingreso/Producción fill `lines`; Conteo fills `counted` (itemKey → qty),
  // because a count's item list IS the bodega and never needs seeding.
  lines: [],
  counted: {},
});

export const useInventoryDocsStore = defineStore('inventoryDocs', () => {
  const docs = ref({ ingreso: null, produccion: null, conteo: null });

  /* Idempotent: visiting the screen again returns the work you left there.
   * Safe to call on every mount, which is what the views do. */
  function open(kind, warehouseId) {
    if (!docs.value[kind]) docs.value[kind] = blankDoc(kind, warehouseId);
    return docs.value[kind];
  }

  const discard = (kind) => { docs.value[kind] = null; };

  /* An empty document is not work — you only opened the screen. Dirty means
   * there is something in it a reload would destroy. */
  function isDirty(kind) {
    const doc = docs.value[kind];
    if (!doc) return false;
    return kind === 'conteo'
      ? Object.keys(doc.counted).length > 0
      : doc.lines.length > 0;
  }

  const anyDirty = computed(() => DOC_KINDS.some(isDirty));

  return { docs, open, discard, anyDirty };
});
