// stores/accountingStore.js
import { defineStore, storeToRefs } from 'pinia';
import { ref, computed } from 'vue';
import { AccountingService } from '../services/accountingService';
import { useAuthenticationStore } from './authentication';
import { usePeriodStore } from './periodStore';

const authStore = useAuthenticationStore();
const { getBakeryId } = storeToRefs(authStore);

const service = new AccountingService(getBakeryId.value);

// The month Resumen shows: its records, what is pending and the totals strip.
export const useAccountingStore = defineStore('accounting', () => {
  // The month (YYYY-MM) the global period selector is on.
  const periodStore = usePeriodStore();
  const period = computed(() => {
    const date = periodStore.currentDate;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
  const records = ref([]);
  const pendingTemplates = ref([]);
  const pendingReceivedInvoices = ref(0);
  const totals = ref({ expense: 0, investment: 0, revenue: 0 });
  const loading = ref(false);
  const error = ref(null);

  // Stepping fast fires overlapping loads; only the newest may write.
  let latestLoad = 0;

  async function loadMonth() {
    const thisLoad = ++latestLoad;
    loading.value = true;
    error.value = null;
    try {
      const month = await service.getMonth(period.value);
      if (thisLoad !== latestLoad) return;
      records.value = month.records;
      pendingTemplates.value = month.pendingTemplates;
      pendingReceivedInvoices.value = month.pendingReceivedInvoices;
      totals.value = month.totals;
    } catch (err) {
      if (thisLoad === latestLoad) error.value = err?.message || 'No se pudo cargar el mes';
    } finally {
      if (thisLoad === latestLoad) loading.value = false;
    }
  }

  const statement = ref(null);
  const statementLoading = ref(false);
  const statementError = ref(null);
  let latestStatement = 0;

  async function loadStatement(from, to) {
    const thisLoad = ++latestStatement;
    statementLoading.value = true;
    statementError.value = null;
    try {
      const result = await service.getIncomeStatement(from, to);
      if (thisLoad === latestStatement) statement.value = result;
    } catch (err) {
      if (thisLoad === latestStatement) {
        statement.value = null;
        statementError.value = err?.message || 'No se pudo cargar el P&G';
      }
    } finally {
      if (thisLoad === latestStatement) statementLoading.value = false;
    }
  }

  async function confirmTemplate(templateId, overrides = {}) {
    await service.confirmTemplate(period.value, templateId, overrides);
    await loadMonth();
  }

  return {
    period, records, pendingTemplates, pendingReceivedInvoices, totals, loading, error, loadMonth, confirmTemplate,
    statement, statementLoading, statementError, loadStatement,
  };
});
