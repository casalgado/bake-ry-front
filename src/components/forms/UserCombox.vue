<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import {
  Combobox,
  ComboboxInput,
  ComboboxButton,
  ComboboxOptions,
  ComboboxOption,
  TransitionRoot,
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
  label: {
    type: String,
    default: 'Usuario',
  },
  error: {
    type: String,
    default: '',
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

const inputRef = ref(null);

const focus = () => {
  const input = document.querySelector('[role="combobox"]');
  input?.focus();
};

onMounted(async () => {
  await nextTick();
  focus();
});

defineExpose({ focus });
</script>
<template>
  <div>
    <Combobox :modelValue="modelValue" @update:modelValue="handleSelect">
      <div class="relative">
        <div class="relative w-full">
          <ComboboxInput
            ref="inputRef"
            autocomplete="off"
            enterkeyhint="done"
            @change="query = $event.target.value"
            :displayValue="
              (userId) => props.users.find((u) => u.id === userId)?.name || ''
            "
          />
          <ComboboxButton
            class="absolute inset-y-0 right-0 flex items-center pr-2"
          >
            <PhCaretUpDown />
          </ComboboxButton>
        </div>

        <TransitionRoot
          leave="transition ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <ComboboxOptions
            class="absolute mt-1 w-full rounded-md bg-white py-1 shadow-lg text-[13px] z-10"
          >
            <ComboboxOption
              v-for="user in filteredUsers"
              :key="user.id"
              :value="user.id"
              v-slot="{ selected, active }"
            >
              <div
                class="cursor-default select-none pl-2 py-1"
                :class="{
                  'bg-blue-500 text-white': active,
                  'font-bold': selected,
                }"
              >
                {{ user.name }}
              </div>
            </ComboboxOption>
          </ComboboxOptions>
        </TransitionRoot>
      </div>
    </Combobox>

    <p v-if="error">{{ error }}</p>
  </div>
</template>
