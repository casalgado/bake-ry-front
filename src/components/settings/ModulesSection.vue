<script setup>
import { PhWarehouse, PhCalculator } from '@phosphor-icons/vue';
import UiFeatureCard from '@/components/ui/UiFeatureCard.vue';

defineProps({
  disabled: { type: Boolean, default: false },
});

const form = defineModel({ required: true });
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="ui-sectionhead">Módulos</div>
    <p class="ui-field-hint">
      Desactivados, no aparecen en ninguna parte de la aplicación.
    </p>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <UiFeatureCard
        v-model="form.inventoryEnabled"
        :icon="PhWarehouse"
        title="Inventario"
        description="Recetas, control de stock, conteos y compras."
        :disabled="disabled"
      />
      <UiFeatureCard
        v-model="form.accountingEnabled"
        :icon="PhCalculator"
        title="Contabilidad"
        description="Gastos, facturas de proveedores y estado de resultados (P&G)."
        :disabled="disabled"
      />
    </div>
  </section>
</template>
