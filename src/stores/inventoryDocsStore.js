// stores/inventoryDocsStore.js
import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useAuthenticationStore } from '@/stores/authentication';

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
 * A reload survives too, but only in THIS browser: the documents are mirrored to
 * localStorage. Real drafts are server-side and arrive with their own endpoints
 * (EXISTENCIAS-BUILD.md §4.2, §4.3) — until then a delivery entered here cannot
 * be picked up on another device, and every screen that holds one says so out
 * loud.
 *
 * ponytail: one document per kind, not a list. Two deliveries open at once is
 * not a scenario anyone named; a count AND a delivery is, and that already
 * works because they are different kinds. Give the doc an id and the route a
 * param if the second one ever shows up.
 */

const DOC_KINDS = ['ingreso', 'produccion', 'conteo'];

/* The three documents share a date and a bodega and nothing else, so the rest
 * is per kind rather than a union of every field with most of them dead:
 *
 *   ingreso    — `provider`. One delivery, one proveedor; it belongs to the
 *                document, never to a line.
 *   produccion — nobody. The ledger records who confirmed the movement
 *                server-side, which beats a free-text box you can type anything
 *                into.
 *   conteo     — `party`, el responsable del conteo.
 *
 * Ingreso/Producción fill `lines`; Conteo fills `counted` (itemKey → qty),
 * because a count's item list IS the bodega and never needs seeding. */
const blankDoc = (kind, warehouseId) => ({
  kind,
  date: new Date().toISOString().slice(0, 10),
  warehouseId,
  ...(kind === 'ingreso' ? { provider: '' } : {}),
  ...(kind === 'conteo' ? { party: '', counted: {} } : { lines: [] }),
});

const blankDocs = () => ({ ingreso: null, produccion: null, conteo: null });

export const useInventoryDocsStore = defineStore('inventoryDocs', () => {
  const docs = ref(blankDocs());

  /* Scoped per bakery, same shape as the recetario's pins
   * (RecipeBookView.vue:562), because a system_admin switches between them and
   * a restored document carries warehouseIds and itemKeys that belong to ONE
   * tenant. An unscoped key would quietly reopen another bakery's delivery.
   *
   * Read inside the setup, not at module scope: stockStore.js:7-10 freezes the
   * bakery id at import time and that is a known trap, not a pattern to copy. */
  const authStore = useAuthenticationStore();
  const storageKey = computed(() => `inventoryDocs.${authStore.getBakeryId ?? 'none'}`);

  /* Reading can THROW, not merely return null — a private window or a browser
   * set to block site data rejects the accessor itself. Every path has to leave
   * the three documents openable rather than taking the section down. */
  function load() {
    try {
      docs.value = { ...blankDocs(), ...JSON.parse(localStorage.getItem(storageKey.value) || '{}') };
    } catch {
      docs.value = blankDocs();
    }
  }

  watch(storageKey, load, { immediate: true });

  /* deep: the screens mutate doc.lines and doc.counted in place. */
  watch(docs, (value) => {
    try {
      localStorage.setItem(storageKey.value, JSON.stringify(value));
    } catch {
      // Storage full or unavailable. The documents still work for this session.
    }
  }, { deep: true });

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
      ? Object.keys(doc.counted ?? {}).length > 0
      : (doc.lines?.length ?? 0) > 0;
  }

  const anyDirty = computed(() => DOC_KINDS.some(isDirty));

  return { docs, open, discard, anyDirty };
});
