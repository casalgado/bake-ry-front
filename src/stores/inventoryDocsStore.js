// stores/inventoryDocsStore.js
import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useAuthenticationStore } from '@/stores/authentication';
import { getTodayString } from '@/utils/dateUtils';

/**
 * The documents you have open in Inventario: one Ingreso and one Producción, at
 * most. A Conteo is not here: it lives on the server (stockCountService).
 *
 * They live in a store rather than in a shell component because loading a
 * delivery and planning a production run are long, interruptible tasks — the whole
 * reason they were never modals. A component-owned draft dies the moment you
 * walk over to Pedidos to check something, which is exactly the interruption
 * that was supposed to be survivable. This survives it.
 *
 * A reload survives too, but only in THIS browser: the documents are mirrored to
 * localStorage. These drafts are not on the server, so a delivery entered here
 * cannot be picked up on another device, and every screen that holds one says
 * so out loud.
 *
 * ponytail: one document per kind, not a list. Two deliveries open at once is
 * not a scenario anyone named; a run AND a delivery is, and that already
 * works because they are different kinds. Give the doc an id and the route a
 * param if the second one ever shows up.
 */

const DOC_KINDS = ['ingreso', 'produccion'];

/* The two documents share a date and a bodega and nothing else, so the rest
 * is per kind rather than a union of every field with most of them dead:
 *
 *   ingreso    — `providerId`. One delivery, one proveedor; it belongs to the
 *                document, never to a line. `idempotencyKey` is minted when
 *                the document opens, so a resent Confirmar lands on the same
 *                purchase (backend `retryId`).
 *   produccion — nobody. The server records who sent the run and who received
 *                each line, which beats a free-text box you can type anything
 *                into. `idempotencyKey`, same reason as ingreso: a resent
 *                "Enviar" lands on the same run.
 *
 * Both fill `lines`. */
const blankDoc = (kind, warehouseId) => ({
  kind,
  date: getTodayString(),
  warehouseId,
  ...(kind === 'ingreso' ? { providerId: null } : {}),
  lines: [],
  idempotencyKey: crypto.randomUUID(),
});

/* One slot per kind, filled from `saved` when there is one. Only these kinds are
 * read back from storage; anything else in it is dropped. */
const blankDocs = (saved = {}) =>
  Object.fromEntries(DOC_KINDS.map((kind) => [kind, saved[kind] ?? null]));

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
   * both documents openable rather than taking the section down. */
  function load() {
    try {
      docs.value = blankDocs(JSON.parse(localStorage.getItem(storageKey.value) || '{}'));
    } catch {
      docs.value = blankDocs();
    }
  }

  watch(storageKey, load, { immediate: true });

  /* deep: the screens mutate doc.lines in place. */
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
    // A draft restored from before it carried a key gets one now.
    if (!docs.value[kind].idempotencyKey) {
      docs.value[kind].idempotencyKey = crypto.randomUUID();
    }
    return docs.value[kind];
  }

  const discard = (kind) => { docs.value[kind] = null; };

  /* An empty document is not work — you only opened the screen. Dirty means
   * there is something in it a reload would destroy. */
  function isDirty(kind) {
    return (docs.value[kind]?.lines?.length ?? 0) > 0;
  }

  const anyDirty = computed(() => DOC_KINDS.some(isDirty));

  return { docs, open, discard, anyDirty };
});
