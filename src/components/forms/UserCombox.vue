<script setup>
import { ref, computed, watch } from 'vue';
import {
  Combobox,
  ComboboxInput,
  ComboboxButton,
  ComboboxOptions,
  ComboboxOption,
} from '@headlessui/vue';
import { PhCaretUpDown } from '@phosphor-icons/vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  users: {
    type: Array,
    required: true,
  },
  // The input's id, so the form's <label for> names it.
  id: {
    type: String,
    default: undefined,
  },
  invalid: {
    type: Boolean,
    default: false,
  },
  describedBy: {
    type: String,
    default: undefined,
  },
});

const emit = defineEmits(['update:modelValue', 'change']);

const query = ref('');

// Normalize text to ignore accents except ñ
const normalizeText = (text) => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u0302\u0304-\u036f]/g, '')
    .normalize('NFC')
    .toLowerCase();
};

const filteredUsers = computed(() => {
  if (query.value === '') return props.users.slice(0, 50);

  const normalizedQuery = normalizeText(query.value);

  return props.users.filter((user) => {
    const normalizedName = normalizeText(user.name);
    return normalizedName.includes(normalizedQuery);
  }).slice(0, 50);
});

const handleSelect = (userId) => {
  emit('update:modelValue', userId);
  const user = props.users.find((u) => u.id === userId);
  emit('change', user);
};

watch(
  filteredUsers,
  (users) => {
    if (users.length === 1 && query.value) {
      handleSelect(users[0].id);
    }
  },
  { immediate: true },
);

const root = ref(null);

// The input itself, not ComboboxInput's component ref: its $el is not reliably
// the <input>.
const focus = () => {
  root.value?.querySelector('input')?.focus();
};

defineExpose({ focus });
</script>

<template>
  <Combobox :model-value="modelValue" @update:model-value="handleSelect">
    <div ref="root" class="relative">
      <!-- .ui-search for the room on the right; the caret borrows the clear
           button's glyph-in-the-field look. -->
      <div class="ui-search">
        <ComboboxInput
          :id="id"
          class="ui-input"
          autocomplete="off"
          enterkeyhint="done"
          :aria-invalid="invalid || undefined"
          :aria-describedby="describedBy"
          :display-value="(userId) => users.find((u) => u.id === userId)?.name || ''"
          @change="query = $event.target.value"
        />
        <ComboboxButton class="ui-search-clear" aria-label="Ver clientes">
          <PhCaretUpDown :size="13" weight="bold" />
        </ComboboxButton>
      </div>

      <ComboboxOptions
        class="ui-card absolute z-20 mt-1 w-full max-h-72 overflow-y-auto !p-1"
      >
        <li v-if="!filteredUsers.length" class="ui-empty !py-4">Ningún cliente coincide.</li>
        <ComboboxOption
          v-for="user in filteredUsers"
          :key="user.id"
          v-slot="{ active }"
          :value="user.id"
          as="template"
        >
          <li class="ui-item !py-1.5" :aria-current="active || undefined">
            <span />
            <span class="ui-item-title">{{ user.name }}</span>
            <span v-if="user.category" class="ui-item-meta">{{ user.category }}</span>
          </li>
        </ComboboxOption>
      </ComboboxOptions>
    </div>
  </Combobox>
</template>
