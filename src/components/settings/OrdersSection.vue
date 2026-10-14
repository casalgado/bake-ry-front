<script setup>
import {
  PhMoney,
  PhCalendarBlank,
  PhCircleHalf,
  PhClock,
  PhWifiX,
  PhUser,
  PhGrains,
} from '@phosphor-icons/vue';
import { paymentIconMap } from '@/utils/paymentIcons';
import { hasChosenPaymentMethod } from '@/utils/settingsForm';
import UiFeatureCard from '@/components/ui/UiFeatureCard.vue';
import UiChoiceCard from '@/components/ui/UiChoiceCard.vue';

/* How the business takes orders. Signup shows the short version; business
 * settings pass `full` for the rest. */
defineProps({
  paymentMethods: { type: Array, default: () => [] }, // [{ value, label }]
  full: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
});

const form = defineModel({ required: true });

const DEFAULT_DATE_OPTIONS = [
  { value: 'delivery', label: 'Entrega' },
  { value: 'production', label: 'Preparación' },
];

const togglePaymentMethod = (value, on) => {
  const methods = new Set(form.value.activePaymentMethods);
  if (on) methods.add(value);
  else methods.delete(value);
  form.value.activePaymentMethods = [...methods];
};
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="ui-sectionhead">Pedidos</div>

    <div class="flex flex-col gap-2">
      <div>
        <span class="ui-field-k">Métodos de pago</span>
        <p class="ui-field-hint">Selecciona los métodos de pago que acepta tu negocio.</p>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <UiFeatureCard
          v-for="method in paymentMethods"
          :key="method.value"
          :model-value="form.activePaymentMethods.includes(method.value)"
          :icon="paymentIconMap[method.value] || PhMoney"
          :title="method.label"
          :disabled="disabled"
          @update:model-value="togglePaymentMethod(method.value, $event)"
        />
      </div>
      <span v-if="!hasChosenPaymentMethod(form)" class="ui-field-error">
        Selecciona al menos un método de pago
      </span>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <UiChoiceCard
        v-model="form.defaultDate"
        :icon="PhCalendarBlank"
        title="Fecha por defecto"
        description="¿Te organizas mejor por cuándo produces o cuándo entregas?"
        :options="DEFAULT_DATE_OPTIONS"
        :disabled="disabled"
      />
      <UiFeatureCard
        v-model="form.allowPartialPayment"
        :icon="PhCircleHalf"
        title="Pagos parciales"
        description="Permite a los clientes pagar una parte del pedido."
        :disabled="disabled"
      />
      <UiFeatureCard
        v-model="form.timeOfDay"
        :icon="PhClock"
        title="Hora de entrega"
        description="Muestra un campo para elegir la hora específica de entrega."
        :disabled="disabled"
      />

      <template v-if="full">
        <UiFeatureCard
          v-model="form.offlineMode"
          :icon="PhWifiX"
          title="Modo sin conexión"
          description="Habilita un formulario para crear pedidos sin internet."
          :disabled="disabled"
        />
        <UiFeatureCard
          v-model="form.loadHistoricalOnUserSelection"
          :icon="PhUser"
          title="Repetir el último pedido"
          description="Al elegir un cliente, carga los productos y el pago de su pedido anterior."
          :disabled="disabled"
        />
        <UiFeatureCard
          v-model="form.offersWholeGrain"
          :icon="PhGrains"
          title="Opciones integrales"
          description="Pregunta si cada variación de un producto ofrece una versión integral."
          :disabled="disabled"
        />
      </template>
    </div>
  </section>
</template>
