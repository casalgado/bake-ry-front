<script setup>
/* A money field that groups thousands while you type. `type="text"` because a
 * number input cannot show separators; the model is always a Number (null when
 * empty) and the formatted string only lives in the DOM. Digits only: money is
 * whole pesos.
 *
 * The root is the <input> itself, so `id`, `aria-*`, `readonly`, `placeholder`
 * fall through and the call site keeps its own `ui-field` markup (CLAUDE.md §12). */
import { formatQty } from '@/utils/helpers';

const model = defineModel({ type: Number, default: null });

// Rounded: a decimal shown here would lose its point on the next keystroke and multiply.
const display = (n) => (n == null ? '' : formatQty(Math.round(n)));

// ponytail: every non-digit is dropped, so pasting `1250.50` reads as 125050.
// Fine while money is whole pesos; needs a decimal mode if that ever changes.
const onInput = (e) => {
  const el = e.target;
  // Digits right of the cursor stay right of it after regrouping.
  const right = el.value.slice(el.selectionEnd).replace(/\D/g, '').length;
  const digits = el.value.replace(/\D/g, '');
  // Never read model.value back here: it stays stale until the parent re-renders.
  const n = digits ? Number(digits) : null;
  model.value = n;
  // Always rewrite: a stray letter leaves the model unchanged, so Vue won't.
  el.value = display(n);
  let pos = el.value.length;
  // `right` can exceed the digits left: `1,050` minus the 1 reads `050` but displays `50`.
  for (let seen = 0; seen < right && pos > 0; pos--) if (/\d/.test(el.value[pos - 1])) seen++;
  el.setSelectionRange(pos, pos);
};

// A comma is not something you delete: step over it so the key removes the digit beside it.
const onKeydown = (e) => {
  const el = e.target;
  const i = el.selectionStart;
  if (i !== el.selectionEnd) return;
  if (e.key === 'Backspace' && el.value[i - 1] === ',') el.setSelectionRange(i - 1, i - 1);
  if (e.key === 'Delete' && el.value[i] === ',') el.setSelectionRange(i + 1, i + 1);
};
</script>

<template>
  <input
    :value="display(model)"
    type="text"
    inputmode="numeric"
    class="ui-input ui-input-num"
    @input="onInput"
    @keydown="onKeydown"
  >
</template>
