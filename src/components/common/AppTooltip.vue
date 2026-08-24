<script setup>
import { ref, computed, useId, useSlots, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  text: { type: String, default: '' },
  placement: {
    type: String,
    default: 'top',
    validator: (v) => ['top', 'right', 'bottom', 'left'].includes(v),
  },
  disabled: { type: Boolean, default: false },
});

// Gap (px) between trigger and panel, same for every placement.
const GAP = 8;

const PANEL_TRANSFORMS = {
  top: 'translate(-50%, -100%)',
  bottom: 'translateX(-50%)',
  left: 'translate(-100%, -50%)',
  right: 'translateY(-50%)',
};

const ARROW_CLASSES = {
  top: 'top-full left-1/2 -translate-x-1/2 -translate-y-1/2',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 translate-y-1/2',
  left: 'left-full top-1/2 -translate-x-1/2 -translate-y-1/2',
  right: 'right-full top-1/2 translate-x-1/2 -translate-y-1/2',
};

// A panel carrying markup is a different object from a panel carrying a
// sentence: it needs the width the dark bubble denies it, and reads as a small
// card rather than a label. The arrow is dropped there.
const slots = useSlots();
const rich = computed(() => !!slots.content);

const visible = ref(false);
const tooltipId = useId();
const rootEl = ref(null);
// Viewport coordinates: the panel is teleported to <body> and positioned fixed,
// so it escapes any scrollable/overflow ancestor that would otherwise clip it.
const anchor = ref({ top: 0, left: 0 });

function updateAnchor() {
  if (!rootEl.value) return;
  const r = rootEl.value.getBoundingClientRect();
  const positions = {
    top: { top: r.top - GAP, left: r.left + r.width / 2 },
    bottom: { top: r.bottom + GAP, left: r.left + r.width / 2 },
    left: { top: r.top + r.height / 2, left: r.left - GAP },
    right: { top: r.top + r.height / 2, left: r.right + GAP },
  };
  anchor.value = positions[props.placement];
}

const panelStyle = computed(() => ({
  position: 'fixed',
  top: `${anchor.value.top}px`,
  left: `${anchor.value.left}px`,
  transform: PANEL_TRANSFORMS[props.placement],
}));

// pointer-events-none: the panel sits over the page in a fixed layer, and nothing
// in it is interactive — it must never swallow a click meant for what's underneath.
const panelClasses = computed(() =>
  rich.value
    ? 'pointer-events-none z-[1000] w-max rounded-md border border-neutral-200 bg-white text-left text-xs text-neutral-800 shadow-lg'
    : 'pointer-events-none z-[1000] w-max max-w-[220px] whitespace-pre-line break-words rounded-md bg-black px-2.5 py-1.5 text-left text-xs leading-snug text-white shadow-sm',
);

function show() {
  if (props.disabled) return;
  updateAnchor();
  visible.value = true;
}

function hide() {
  visible.value = false;
}

function handleReposition() {
  if (visible.value) updateAnchor();
}

onMounted(() => {
  // capture: true — scroll doesn't bubble, so this is the only way to hear a
  // scroll on an inner scrollable ancestor from here.
  window.addEventListener('scroll', handleReposition, true);
  window.addEventListener('resize', handleReposition);
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleReposition, true);
  window.removeEventListener('resize', handleReposition);
});
</script>

<template>
  <!-- Keyboard reachability is the caller's call: wrapping something focusable
       (a button, a link) needs nothing, wrapping static content needs
       tabindex="0" on this component so the tooltip can be opened by keyboard. -->
  <span
    ref="rootEl"
    class="relative inline-flex items-center"
    :aria-describedby="visible ? tooltipId : undefined"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
    @keydown.esc="hide"
  >
    <!-- describedBy is exposed so a caller whose tab stop is *inside* the slot (a
         button, a link) can put it on that element: aria-describedby on this
         wrapper is not conveyed when AT announces the inner control. -->
    <slot :described-by="visible ? tooltipId : undefined" />
    <Teleport to="body">
      <!-- div, not span: teleported to <body>, so nothing inline depends on it
           and rich content nests legally inside. -->
      <div
        v-if="visible"
        :id="tooltipId"
        role="tooltip"
        :class="panelClasses"
        :style="panelStyle"
      >
        <slot name="content">{{ text }}</slot>
        <span
          v-if="!rich"
          class="absolute h-2 w-2 rotate-45 bg-black"
          :class="ARROW_CLASSES[placement]"
        />
      </div>
    </Teleport>
  </span>
</template>
