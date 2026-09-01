// composables/useUndoSnapshot.js
import { ref, computed, unref } from 'vue';

/**
 * An editable copy of something, with undo by whole-value snapshot.
 *
 * Not to be confused with `DataTable/composables/useUndoHistory.js`, which
 * stores reversible *operations*. This one stores *states*: before each change
 * the caller snaps the whole value, and undo puts the last snap back. Exact by
 * construction — an operation-based undo has to compute an inverse, and a
 * scale-by-1.5 has no exact inverse once its result is rounded.
 *
 * A factory, not a singleton: call it once per thing being edited. The recipe
 * book keeps one per open tab, since two combinations are edited side by side
 * and cannot share a stack.
 *
 * Values must be JSON-safe. That is what makes `clone` a round-trip, which also
 * unwraps Vue's reactive proxy — `structuredClone` throws `DataCloneError` on
 * one, and it throws at the first edit, not on load.
 */
const clone = (v) => (v == null ? null : JSON.parse(JSON.stringify(v)));

export function useUndoSnapshot(source) {
  const copy = ref(null);
  const past = ref([]);

  /** Re-copy from source and drop the history. Call on load and after save. */
  function reset() {
    copy.value = clone(unref(source));
    past.value = [];
  }

  /** Snap the current value BEFORE mutating it. */
  function snap() {
    past.value.push(clone(copy.value));
  }

  function undo() {
    if (past.value.length) copy.value = past.value.pop();
  }

  const canUndo = computed(() => past.value.length > 0);

  /* Compared, not flagged: undoing back to the start makes the copy clean
   * again, so Save disables itself and the close guard stops asking. */
  const isDirty = computed(
    () => JSON.stringify(copy.value) !== JSON.stringify(unref(source) ?? null),
  );

  reset();

  return { copy, canUndo, isDirty, snap, undo, reset };
}
