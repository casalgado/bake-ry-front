<script setup>
import { useId } from 'vue';
import { PhCurrencyDollar } from '@phosphor-icons/vue';
import UiChoiceCard from '@/components/ui/UiChoiceCard.vue';

defineProps({
  disabled: { type: Boolean, default: false },
});

const form = defineModel({ required: true });

const uid = useId();

const TAX_MODE_OPTIONS = [
  { value: 'inclusive', label: 'IVA incluido' },
  { value: 'exclusive', label: 'IVA adicional' },
];
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="ui-sectionhead">Recibos y cotizaciones</div>

    <UiChoiceCard
      v-model="form.taxMode"
      :icon="PhCurrencyDollar"
      title="Modo de IVA"
      description="«IVA incluido»: el precio ya trae el impuesto. «IVA adicional»: el impuesto se suma al precio base."
      :options="TAX_MODE_OPTIONS"
      :disabled="disabled"
    />

    <div class="ui-field">
      <label class="ui-field-k" :for="`${uid}-terms`">Términos y condiciones</label>
      <textarea
        :id="`${uid}-terms`"
        v-model="form.defaultTermsAndConditions"
        class="ui-input ui-input-area"
        rows="4"
        :disabled="disabled"
        :aria-describedby="`${uid}-terms-h`"
      ></textarea>
      <span :id="`${uid}-terms-h`" class="ui-field-hint">
        Aparecen en todos tus recibos y cotizaciones.
      </span>
    </div>
  </section>
</template>
