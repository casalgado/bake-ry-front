<script setup>
/* Categories for gastos, inversiones and otros ingresos. Every change patches the
 * whole array (the backend replaces arrays whole and refuses to drop a category:
 * they are disabled, never deleted). The group you add from decides the kind. */
import { ref, computed } from 'vue';
import { PhPlus } from '@phosphor-icons/vue';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import ToastNotification from '@/components/ToastNotification.vue';

const settingsStore = useBakerySettingsStore();
const toastRef = ref(null);

const groups = [
  { key: 'expense', title: 'Gastos', field: 'expenseCategories', isInvestment: false },
  { key: 'investment', title: 'Inversiones', field: 'expenseCategories', isInvestment: true },
  { key: 'revenue', title: 'Otros ingresos', field: 'revenueCategories', isInvestment: false },
];

/* Every row is as tall as the edit row (input + 9px padding + 1px border, each side),
 * so toggling or editing never moves the rows below. */
const rowH = 'min-h-[calc(var(--ui-field-h)+20px)]';

const settings = computed(() => settingsStore.items[0]);

const rowsOf = (group) =>
  settings.value[group.field].filter((cat) => Boolean(cat.isInvestment) === group.isInvestment);

/* Clicking a card toggles it and saves. `editing` is the inline form that takes
 * a card's place: `draft` is its copy, `group` says where it saves and, for a
 * new category, which kind it is. A new draft is shown after the group's cards. */
const editing = ref(null);
const saving = ref(false);

// By key: `editing` holds a reactive copy of the group, never the same object.
const isNewIn = (group) => editing.value?.isNew && editing.value.group.key === group.key;
const cellsOf = (group) => (isNewIn(group) ? [...rowsOf(group), editing.value.draft] : rowsOf(group));
const isEditing = (cell) =>
  Boolean(editing.value) && (editing.value.draft === cell || (!editing.value.isNew && editing.value.draft.id === cell.id));

function openNew(group) {
  editing.value = { group, draft: { name: '', pucCode: '', isActive: true }, isNew: true };
}

function openEdit(group, cat) {
  editing.value = { group, draft: { ...cat, pucCode: cat.pucCode ?? '' }, isNew: false };
}

/* Writes the whole array; the caller reports the outcome. */
function persist(group, next) {
  return settingsStore.patch('default', { [group.field]: next });
}

async function toggle(group, cat, isActive) {
  try {
    await persist(group, settings.value[group.field].map((c) => (c.id === cat.id ? { ...c, isActive } : c)));
  } catch (err) {
    toastRef.value?.showError('Categorías', err?.message || 'No se pudo guardar.');
  }
}

async function save() {
  const { group, draft, isNew } = editing.value;
  const name = draft.name.trim();
  if (!name) {
    toastRef.value?.showError('Categorías', 'Escribe un nombre.');
    return;
  }
  const current = settings.value[group.field];
  const item = { ...draft, name, pucCode: draft.pucCode.trim() };
  const next = isNew
    ? [...current, { ...item, isInvestment: group.isInvestment, displayOrder: current.length }]
    : current.map((cat) => (cat.id === item.id ? item : cat));

  saving.value = true;
  try {
    await persist(group, next);
    editing.value = null;
    toastRef.value?.showSuccess('Categorías', 'Cambios guardados');
  } catch (err) {
    toastRef.value?.showError('Categorías', err?.message || 'No se pudo guardar.');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section v-if="settings" class="ui-card flex flex-col gap-4">
    <div>
      <h2 class="ui-panehead-title">Contabilidad</h2>
      <p class="ui-field-hint">
        Las categorías no se eliminan: desactívalas. El código PUC es opcional y sirve para agrupar el estado de resultados.
      </p>
    </div>

    <section v-for="group in groups" :key="group.key" class="flex flex-col gap-3">
      <div class="ui-sectionhead">{{ group.title }}</div>

      <div class="flex flex-col gap-2">
        <template v-for="cat in cellsOf(group)" :key="cat.id ?? 'new'">
          <form v-if="isEditing(cat)" class="ui-item ui-item-filled" :class="rowH" @submit.prevent="save">
            <input
              v-model="editing.draft.pucCode"
              class="ui-input w-28"
              aria-label="Código PUC"
              placeholder="PUC"
              inputmode="numeric"
              pattern="\d{1,10}"
              title="De 1 a 10 dígitos. Déjalo vacío si no aplica."
            >
            <input
              v-model="editing.draft.name"
              class="ui-input min-w-0"
              aria-label="Nombre"
              placeholder="Nombre"
              required
              autofocus
            >
            <div class="flex gap-2">
              <button type="button" class="ui-btn ui-btn-sm ui-btn-danger" :disabled="saving" @click="editing = null">
                Cancelar
              </button>
              <button type="submit" class="ui-btn ui-btn-sm ui-btn-solid" :disabled="saving">Guardar</button>
            </div>
          </form>

          <div v-else class="ui-item ui-item-filled" :class="[rowH, { 'ui-ink-muted': !cat.isActive }]">
            <span class="ui-tag">{{ cat.pucCode || 'sin código' }}</span>
            <button type="button" class="min-w-0 text-left !m-0 !p-0" @click="openEdit(group, cat)">
              <span class="ui-item-title block">{{ cat.name }}</span>
            </button>
            <button
              type="button"
              class="ui-btn ui-btn-sm"
              :aria-pressed="cat.isActive"
              @click="toggle(group, cat, !cat.isActive)"
            >
              {{ cat.isActive ? 'Activa' : 'Inactiva' }}
            </button>
          </div>
        </template>

        <button v-if="!isNewIn(group)" type="button" class="ui-item ui-item-filled" :class="rowH" @click="openNew(group)">
          <PhPlus :size="16" weight="bold" class="ui-ink-muted" />
          <span class="ui-item-title">Agregar</span>
          <span />
        </button>
      </div>
    </section>

    <ToastNotification ref="toastRef" />
  </section>
</template>
