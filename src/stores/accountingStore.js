// stores/accountingStore.js
import { defineStore, storeToRefs } from 'pinia';
import { ref } from 'vue';
import { AccountingService } from '../services/accountingService';
import { useAuthenticationStore } from './authentication';

const authStore = useAuthenticationStore();
const { getBakeryId } = storeToRefs(authStore);

const service = new AccountingService(getBakeryId.value);

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

// The month Resumen shows: its records, what is pending and the totals strip.
export const useAccountingStore = defineStore('accounting', () => {
  const period = ref(currentMonth());
  const records = ref([]);
  const pendingTemplates = ref([]);
  const pendingReceivedInvoices = ref(0);
  const closed = ref(null);
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
      closed.value = month.closed;
      totals.value = month.totals;
    } catch (err) {
      if (thisLoad === latestLoad) error.value = err?.message || 'No se pudo cargar el mes';
    } finally {
      if (thisLoad === latestLoad) loading.value = false;
    }
  }

  function stepMonth(delta) {
    const [year, month] = period.value.split('-').map(Number);
    const next = new Date(year, month - 1 + delta, 1);
    period.value = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    return loadMonth();
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

  async function closePeriod() {
    await service.closePeriod(period.value);
    await loadMonth();
  }

  async function reopenPeriod() {
    await service.reopenPeriod(period.value);
    await loadMonth();
  }

  async function confirmTemplate(templateId, overrides = {}) {
    await service.confirmTemplate(period.value, templateId, overrides);
    await loadMonth();
  }

  return {
    period, records, pendingTemplates, pendingReceivedInvoices, closed, closePeriod, reopenPeriod, totals, loading, error, loadMonth, stepMonth, confirmTemplate,
    statement, statementLoading, statementError, loadStatement,
  };
});
