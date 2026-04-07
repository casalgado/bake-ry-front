<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  comments: {
    type: String,
    default: '',
  },
  maxLength: {
    type: Number,
    default: 50,
  },
});

const isExpanded = ref(false);

const truncatedComments = computed(() => {
  if (!props.comments) return '-';

  if (props.comments.length <= props.maxLength) {
    return props.comments;
  }

  if (isExpanded.value) {
    return props.comments;
  }

  return props.comments.substring(0, props.maxLength) + '...';
});

const shouldShowToggle = computed(() => {
  return props.comments && props.comments.length > props.maxLength;
});

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value;
};
</script>

<template>
  <div class="comments-cell">
    <span
      v-if="comments"
      :class="{
        'cursor-pointer hover:text-primary-600': shouldShowToggle,
        'text-neutral-600': !shouldShowToggle
      }"
      @click="shouldShowToggle ? toggleExpanded() : null"
      :title="shouldShowToggle ? 'Click para ' + (isExpanded ? 'contraer' : 'expandir') : comments"
    >
      {{ truncatedComments }}
    </span>
    <span v-else class="text-neutral-400">-</span>
  </div>
</template>

<style scoped>
.comments-cell {
  max-width: 200px;
  word-wrap: break-word;
  line-height: 1.4;
}
</style>
