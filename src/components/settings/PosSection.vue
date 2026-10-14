<script setup>
import { PhMoney, PhClock, PhGpsSlash, PhUser } from '@phosphor-icons/vue';
import UiFeatureCard from '@/components/ui/UiFeatureCard.vue';

defineProps({
  disabled: { type: Boolean, default: false },
});

const form = defineModel({ required: true });
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="ui-sectionhead">Punto de venta</div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <UiFeatureCard
        v-model="form.posAutoMarkPaid"
        :icon="PhMoney"
        title="Marcar como pagado"
        description="Marca los pedidos como pagados al crearlos."
        :disabled="disabled"
      />
      <UiFeatureCard
        v-model="form.posDefaultToCurrentDate"
        :icon="PhClock"
        title="Fecha actual por defecto"
        description="Usa la fecha de hoy en lugar del selector de fecha."
        :disabled="disabled"
      />
      <UiFeatureCard
        v-model="form.posHideDeliveryOptions"
        :icon="PhGpsSlash"
        title="Ocultar opciones de entrega"
        description="Oculta las secciones de entrega en formularios y navegación."
        :disabled="disabled"
      />
      <UiFeatureCard
        v-model="form.posAutoSelectClient"
        :icon="PhUser"
        title="Seleccionar cliente POS"
        description="Crea y selecciona automáticamente el cliente «Punto de Venta»."
        :disabled="disabled"
      />
    </div>
  </section>
</template>
