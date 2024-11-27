<script setup>
defineProps({
  modelValue: {
    type: Boolean,
    default: null,
  },
  label: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(['update:modelValue']);

const setValue = (value) => {
  emit('update:modelValue', value);
};
</script>

<template>
  <div class="form-container">
    <div class="flex items-center gap-1">
      <label>{{ label }}</label>
      <div class="flex gap-1">
        <button
          type="button"
          @click="setValue(false)"
          :class="[
            'utility-btn w-10 p-1',
            modelValue === false ? 'utility-btn-active' : 'utility-btn-inactive'
          ]"
        >
          No
        </button>
        <button
          type="button"
          @click="setValue(true)"
          :class="[
            'utility-btn w-10 p-1',
            modelValue === true ? 'utility-btn-active' : 'utility-btn-inactive'
          ]"
        >
          Sí
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>
