<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
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
  users: {  // Parent just passes the users array
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

// Keep search/filter logic in the component
const query = ref('');
const filteredUsers = computed(() => {
  const filtered = query.value === ''
    ? props.users
    : props.users.filter(user => {
      const searchQuery = query.value.toLowerCase();
      const userName = user.name.toLowerCase();
      return userName.includes(searchQuery); // Using startsWith instead of includes
    });

  return filtered.slice(0, 50); // Only show first 50 results
});

const handleSelect = (userId) => {
  emit('update:modelValue', userId);
  const user = props.users.find(u => u.id === userId);
  emit('change', user);
};

const inputRef = ref(null);

onMounted(async () => {
  await nextTick();
  // Find the actual input element
  const input = document.querySelector('[role="combobox"]');
  input?.focus();
});
</script>
<template>
  <div>
    <Combobox
      :modelValue="modelValue"
      @update:modelValue="handleSelect"
    >
      <div class="relative">
        <div class="relative w-full">
          <ComboboxInput
            ref="inputRef"
            @change="query = $event.target.value"
            :displayValue="(userId) => props.users.find(u => u.id === userId)?.name || ''"
          />
          <ComboboxButton class="absolute inset-y-0 right-0 flex items-center pr-2">
            <PhCaretUpDown />
          </ComboboxButton>
        </div>

        <TransitionRoot
          leave="transition ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <ComboboxOptions class="absolute mt-1 w-full  rounded-md bg-white py-1  shadow-lg text-[13px] z-10">
            <ComboboxOption
              v-for="user in filteredUsers"
              :key="user.id"
              :value="user.id"
              v-slot="{ selected, active }"

            >
              <div
                class="cursor-default select-none  pl-2 py-1"
                :class="{
                  'bg-blue-500 text-white': active,
                  'font-bold': selected
                }">
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
