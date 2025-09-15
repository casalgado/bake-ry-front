<script setup>
import { computed } from 'vue';
import { formatMoney, sortVariations } from '@/utils/helpers';

const props = defineProps({
  variations: {
    type: Object,
    required: true,
  },
});

</script>

<template>
  <div class="overflow-hidden">
    <table class="min-w-full ">

      <tbody class="">
        <tr v-for="item in variations.combinations" :key="item.id" class="">
          <td class="px-3 py-0 text-sm">
              <span class="">{{ item.name }}</span>
              <!-- <span v-if="item.isWholeGrain"
                    class="bg-primary-100 text-primary-600 text-xs px-2 py-0.5 rounded-full">
                WG
              </span> -->
          </td>

          <td class="px-3 py-2 text-sm text-right font-medium">
            {{ formatMoney(item.basePrice) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
