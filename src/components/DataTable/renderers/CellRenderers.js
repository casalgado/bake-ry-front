// components/DataTable/renderers/CellRenderers.js
import { h } from 'vue';

export const ClientRenderer = {
  name: 'ClientRenderer',
  props: {
    name: String,
    phone: String,
  },
  render() {
    return h('div', { class: 'flex flex-col' }, [
      h('span', { class: 'font-medium' }, this.name),
      this.phone && h('span', { class: 'text-sm text-neutral-500' }, this.phone),
    ]);
  },
};

export const MoneyRenderer = {
  name: 'MoneyRenderer',
  props: {
    value: Number,
    currency: {
      type: String,
      default: 'COP',
    },
  },
  render() {
    return h('span', {}, new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: this.currency,
      minimumFractionDigits: 0,
    }).format(this.value));
  },
};

export const DateRenderer = {
  name: 'DateRenderer',
  props: {
    value: String,
    showTime: Boolean,
  },
  render() {
    return h('span', {}, new Date(this.value).toLocaleDateString());
  },
};

export const ItemsRenderer = {
  name: 'ItemsRenderer',
  props: {
    items: Array,
    maxDisplay: {
      type: Number,
      default: 2,
    },
  },
  render() {
    return h('div', { class: 'space-y-1' }, [
      ...this.items.slice(0, this.maxDisplay).map(item =>
        h('div', { class: 'flex items-center gap-1' }, [
          h('span', {}, item.productName),
          h('span', { class: 'text-neutral-500 text-sm' }, `×${item.quantity}`),
        ]),
      ),
      this.items.length > this.maxDisplay && h('div', {
        class: 'text-sm text-neutral-500',
      }, `+${this.items.length - this.maxDisplay} more items`),
    ]);
  },
};
