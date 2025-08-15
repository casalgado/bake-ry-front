// stores/systemSettingsStore.js
console.log('Initializing store:', 'systemSettings');
import { defineStore } from 'pinia';
import { SystemSettingsService } from '@/services/systemSettingsService';

/**
 * Store for managing system settings state
 */
export const useSystemSettingsStore = defineStore('systemSettings', {
  state: () => ({
    /** @type {Object|null} - Current system settings */
    settings: null,
    /** @type {boolean} - Loading state */
    loading: false,
    /** @type {string|null} - Error message */
    error: null,
  }),

  getters: {
    /**
     * Get order statuses array
     * @returns {Array}
     */
    orderStatuses: (state) => state.settings?.orderStatuses || [],

    /**
     * Get fulfillment types array
     * @returns {Array}
     */
    fulfillmentTypes: (state) => state.settings?.fulfillmentTypes || [],

    /**
     * Get payment methods array
     * @returns {Array}
     */
    paymentMethods: (state) => state.settings?.paymentMethods || [],

    /**
     * Get unit options array
     * @returns {Array}
     */
    unitOptions: (state) => state.settings?.unitOptions || [],

    /**
     * Get storage temperatures array
     * @returns {Array}
     */
    storageTemperatures: (state) => state.settings?.storageTemperatures || [],

    /**
     * Get available payment methods array
     * @returns {Array}
     */
    availablePaymentMethods: (state) => state.settings?.availablePaymentMethods || [],

    /**
     * Check if settings are loaded
     * @returns {boolean}
     */
    isLoaded: (state) => state.settings !== null,
  },

  actions: {
    /**
     * Set loading state
     * @private
     */
    setLoading(isLoading) {
      this.loading = isLoading;
    },

    /**
     * Set error message
     * @private
     */
    setError(error) {
      this.error = error?.message || null;
    },

    /**
     * Clear error message
     */
    clearError() {
      this.error = null;
    },

    /**
     * Fetch system settings
     */
    async fetchSettings() {
      this.setLoading(true);
      this.clearError();

      try {
        const settings = await SystemSettingsService.get();
        this.settings = settings;
      } catch (error) {
        this.setError(error);
        throw error;
      } finally {
        this.setLoading(false);
      }
    },

    /**
     * Update system settings
     * @param {Object} data - Settings data to update
     */
    async updateSettings(data) {
      this.setLoading(true);
      this.clearError();

      try {
        const updatedSettings = await SystemSettingsService.update(data);
        this.settings = updatedSettings;
        return updatedSettings;
      } catch (error) {
        this.setError(error);
        throw error;
      } finally {
        this.setLoading(false);
      }
    },

    /**
     * Reset store to initial state
     */
    resetStore() {
      this.settings = null;
      this.loading = false;
      this.error = null;
    },
  },
});
