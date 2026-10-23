// stores/supportDocStore.js
import { defineStore, storeToRefs } from 'pinia';
import { ref, computed } from 'vue';
import { SupportDocService } from '../services/supportDocService';
import { useAuthenticationStore } from './authentication';

const authStore = useAuthenticationStore();
const { getBakeryId } = storeToRefs(authStore);

const service = new SupportDocService(getBakeryId.value);

// The documentos soporte the business has issued. Resumen and the Documentos soporte
// screen read the same list; every action reloads it, since the DIAN moves the status.
export const useSupportDocStore = defineStore('supportDocs', () => {
  const items = ref([]);
  const loading = ref(false);
  const error = ref(null);
  let loaded = false;

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      items.value = await service.list();
      loaded = true;
    } catch (err) {
      error.value = err?.message || 'No se pudieron cargar los documentos soporte';
    } finally {
      loading.value = false;
    }
  }

  // For screens that only need to know which gastos already have one.
  const ensureLoaded = () => (loaded ? Promise.resolve() : load());

  // An adjustment note shows on the document it annuls, not as a row of its own.
  const documents = computed(() => items.value.filter((doc) => doc.kind === 'supportDoc'));
  const bySourceId = (id) => documents.value.find((doc) => doc.source?.id === id);

  async function issue(payload) {
    const doc = await service.issue(payload);
    await load();
    return doc;
  }

  async function checkStatus(id) {
    await service.checkStatus(id);
    await load();
  }

  async function annul(id, reason) {
    await service.annul(id, reason);
    await load();
  }

  return {
    items, documents, loading, error, load, ensureLoaded, bySourceId, issue, checkStatus, annul,
  };
});
