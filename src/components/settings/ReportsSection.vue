<script setup>
import { PhChartBar } from '@phosphor-icons/vue';
import UiFeatureCard from '@/components/ui/UiFeatureCard.vue';
import UiChoiceCard from '@/components/ui/UiChoiceCard.vue';

defineProps({
  disabled: { type: Boolean, default: false },
});

const form = defineModel({ required: true });

const REPORT_FILTER_OPTIONS = [
  { value: 'dueDate', label: 'Fecha de pedido' },
  { value: 'paymentDate', label: 'Fecha de pago' },
];
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="ui-sectionhead">Reportes</div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <UiChoiceCard
        v-model="form.defaultReportFilter"
        :icon="PhChartBar"
        title="Reporte de ventas"
        description="La fecha que usan los reportes: cuando se tomó el pedido o cuando se recibió el pago."
        :options="REPORT_FILTER_OPTIONS"
        :disabled="disabled"
      />
      <UiFeatureCard
        v-model="form.showMultipleReports"
        :icon="PhChartBar"
        title="Múltiples reportes"
        description="Permite alternar entre reportes desde el panel de ventas."
        :disabled="disabled"
      />
    </div>
  </section>
</template>
