import { h, computed } from 'vue';

export const MoneyRenderer = {
  props: {
    value: Number,
    currency: {
      type: String,
      default: 'COP',
    },
  },
  setup(props) {
    const formatted = computed(() =>
      new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: props.currency,
        minimumFractionDigits: 0,
      }).format(props.value),
    );

    return () => h('span', {}, formatted.value);
  },
};

export const DateRenderer = {
  props: {
    value: String,
    showTime: Boolean,
  },
  setup(props) {
    const formatted = computed(() => {
      const date = new Date(props.value);
      return props.showTime
        ? date.toLocaleString()
        : date.toLocaleDateString();
    });

    return () => h('span', {}, formatted.value);
  },
};

export const ClientRenderer = {
  props: {
    name: String,
    phone: String,
  },
  setup(props) {
    return () => h('div', { class: 'flex flex-col' }, [
      h('span', { class: 'font-medium' }, props.name),
      props.phone && h('span', { class: 'text-sm text-neutral-500' }, props.phone),
    ]);
  },
};

export const ItemsRenderer = {
  props: {
    items: Array,
    maxDisplay: {
      type: Number,
      default: 2,
    },
  },
  setup(props) {
    const displayInfo = computed(() => {
      const shownItems = props.items.slice(0, props.maxDisplay);
      const remaining = props.items.length - props.maxDisplay;

      return {
        shown: shownItems,
        remaining: remaining > 0 ? remaining : 0,
      };
    });

    return () => h('div', { class: 'space-y-1' }, [
      ...displayInfo.value.shown.map(item =>
        h('div', { class: 'flex items-center gap-1' }, [
          h('span', {}, item.productName),
          h('span', { class: 'text-neutral-500 text-sm' }, `×${item.quantity}`),
        ]),
      ),
      displayInfo.value.remaining > 0 && h('div', {
        class: 'text-sm text-neutral-500',
      }, `+${displayInfo.value.remaining} more items`),
    ]);
  },
};
