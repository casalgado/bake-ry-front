<script setup>
defineProps({
  variations: {
    type: Array,
    required: true,
  },
});

const formatPrice = (price) => new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
}).format(price);
</script>

<template>
  <div class="overflow-hidden">
    <table class="min-w-full ">

      <tbody class="">
        <tr v-for="item in variations" :key="item.id" class="">
          <td class="px-3 py-2 text-sm">
            <div class="flex items-center gap-2">
              <span class="capitalize">{{ item.name }}</span>
              <!-- <span v-if="item.isWholeGrain"
                    class="bg-primary-100 text-primary-600 text-xs px-2 py-0.5 rounded-full">
                WG
              </span> -->
            </div>
          </td>

          <td class="px-3 py-2 text-sm text-right font-medium">
            {{ formatPrice(item.currentPrice) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
