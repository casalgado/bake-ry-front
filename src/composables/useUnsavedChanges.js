import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';

const clone = (value) => JSON.parse(JSON.stringify(value));

/* An editable copy of server data. `isDirty` compares it with the snapshot taken
 * at the last `load`, so a form is dirty only while it differs from what is
 * stored. */
export function useDraft() {
  const form = ref(null);
  let snapshot = 'null';

  const load = (data) => {
    form.value = data ? clone(data) : null;
    snapshot = JSON.stringify(form.value);
  };
  const reset = () => { form.value = JSON.parse(snapshot); };
  // A refetch that changes nothing must not wipe what the user is typing.
  const isStale = (data) => JSON.stringify(data ?? null) !== snapshot;
  const isDirty = computed(() => JSON.stringify(form.value) !== snapshot);

  return { form, isDirty, load, reset, isStale };
}

/* Asks before a route change or a tab close throws away unsaved edits. The host
 * renders a ConfirmDialog bound to `isOpen`, `leave` and `stay`. */
export function useUnsavedChangesGuard(isDirty) {
  const isOpen = ref(false);
  let answer = null;

  onBeforeRouteLeave(() => {
    if (!isDirty.value) return true;
    answer?.(false); // a navigation still waiting on the dialog is superseded
    isOpen.value = true;
    return new Promise((resolve) => { answer = resolve; });
  });

  const settle = (leaving) => {
    isOpen.value = false;
    answer?.(leaving);
    answer = null;
  };

  const warnOnUnload = (event) => {
    if (!isDirty.value) return;
    event.preventDefault();
    event.returnValue = '';
  };
  onMounted(() => window.addEventListener('beforeunload', warnOnUnload));
  onBeforeUnmount(() => window.removeEventListener('beforeunload', warnOnUnload));

  return { isOpen, leave: () => settle(true), stay: () => settle(false) };
}
