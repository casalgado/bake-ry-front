<script setup>
import { ref } from 'vue';

const props = defineProps({
  initialData: {
    type: Object,
    default: () => ({
      name: '',
      description: '',
      isActive: true,
    }),
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['submit', 'cancel']);

// Initialize form data with values from props or defaults
const formData = ref({
  name: props.initialData.name,
  description: props.initialData.description,
  isActive: props.initialData.isActive ?? true,
});

const errors = ref({});

const validate = () => {
  errors.value = {};

  if (!formData.value.name?.trim()) {
    errors.value.name = 'Name is required';
  }

  return Object.keys(errors.value).length === 0;
};

const handleSubmit = () => {
  if (!validate()) return;
  emit('submit', formData.value);
};
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <!-- Basic Information -->
    <div>
      <label>
        Name
        <input
          type="text"
          v-model="formData.name"
          placeholder="Collection name"
          :disabled="props.loading"
        />
      </label>
      <span v-if="errors.name">{{ errors.name }}</span>
    </div>

    <div>
      <label>
        Description
        <textarea
          v-model="formData.description"
          placeholder="Collection description"
          rows="3"
          :disabled="props.loading"
        />
      </label>
    </div>

    <div>
      <label>
        <input
          type="checkbox"
          v-model="formData.isActive"
          :disabled="props.loading"
        />
        Active
      </label>
    </div>

    <div>
      <button
        type="button"
        @click="$emit('cancel')"
        :disabled="props.loading"
      >
        Cancel
      </button>
      <button
        type="submit"
        :disabled="props.loading"
      >
        {{ props.loading ? 'Creating...' : 'Create Collection' }}
      </button>
    </div>
  </form>
</template>

<style scoped>

</style>
