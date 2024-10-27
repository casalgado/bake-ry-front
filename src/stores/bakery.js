// stores/bakeryStore.js
import { defineStore } from "pinia";
import { BakeryService } from "@/services/bakeryService";

/**
 * Store for managing bakery state
 */
export const useBakeryStore = defineStore("bakery", {
  state: () => ({
    /** @type {Object|null} - Currently selected bakery */
    currentBakery: null,
    /** @type {Array} - List of all bakeries */
    bakeries: [],
    /** @type {boolean} - Loading state */
    loading: false,
    /** @type {string|null} - Error message */
    error: null,
  }),

  getters: {
    /**
     * Get a bakery by ID
     * @returns {Function} Function to find bakery by ID
     */
    getBakeryById: (state) => {
      return (id) => state.bakeries.find((bakery) => bakery.id === id);
    },

    /**
     * Check if there are any bakeries
     * @returns {boolean}
     */
    hasBakeries: (state) => state.bakeries.length > 0,

    /**
     * Get active bakeries only
     * @returns {Array}
     */
    activeBakeries: (state) =>
      state.bakeries.filter((bakery) => bakery.isActive),

    /**
     * Get bakery count
     * @returns {number}
     */
    bakeryCount: (state) => state.bakeries.length,
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
     * Fetch all bakeries
     */
    async fetchBakeries() {
      this.setLoading(true);
      this.clearError();

      try {
        const bakeries = await BakeryService.getAllBakeries();
        this.bakeries = bakeries;
      } catch (error) {
        this.setError(error);
      } finally {
        this.setLoading(false);
      }
    },

    /**
     * Fetch a single bakery by ID
     * @param {string} id - Bakery ID
     */
    async fetchBakeryById(id) {
      this.setLoading(true);
      this.clearError();

      try {
        const bakery = await BakeryService.getBakeryById(id);
        const index = this.bakeries.findIndex((b) => b.id === id);

        if (index !== -1) {
          this.bakeries[index] = bakery;
        } else {
          this.bakeries.push(bakery);
        }

        this.currentBakery = bakery;
      } catch (error) {
        this.setError(error);
      } finally {
        this.setLoading(false);
      }
    },

    /**
     * Create a new bakery
     * @param {Object} bakeryData - The bakery data
     */
    async createBakery(bakeryData) {
      this.setLoading(true);
      this.clearError();
      console.log("store createBakery", bakeryData);
      // Check authentication first
      if (!localStorage.getItem("AuthToken")) {
        console.log("store createBakery no token");
        const error = new Error("Please log in to create a bakery");
        this.setError(error);
        this.setLoading(false);
        throw error;
      }

      try {
        console.log("store createBakery try");
        const newBakery = await BakeryService.createBakery(bakeryData);
        this.bakeries.push(newBakery);
        return newBakery;
      } catch (error) {
        this.setError(error);
        throw error;
      } finally {
        this.setLoading(false);
      }
    },

    /**
     * Update a bakery
     * @param {string} id - Bakery ID
     * @param {Object} bakeryData - Updated bakery data
     */
    async updateBakery(id, bakeryData) {
      this.setLoading(true);
      this.clearError();
      console.log("store updateBakery", id, bakeryData);

      try {
        const updatedBakery = await BakeryService.updateBakery(id, bakeryData);
        const index = this.bakeries.findIndex((b) => b.id === id);

        if (index !== -1) {
          this.bakeries[index] = updatedBakery;
        }

        if (this.currentBakery?.id === id) {
          this.currentBakery = updatedBakery;
        }

        return updatedBakery;
      } catch (error) {
        this.setError(error);
        throw error;
      } finally {
        this.setLoading(false);
      }
    },

    /**
     * Delete a bakery
     * @param {string} id - Bakery ID
     */
    async deleteBakery(id) {
      this.setLoading(true);
      this.clearError();

      try {
        await BakeryService.deleteBakery(id);
        this.bakeries = this.bakeries.filter((b) => b.id !== id);

        if (this.currentBakery?.id === id) {
          this.currentBakery = null;
        }
      } catch (error) {
        this.setError(error);
        throw error;
      } finally {
        this.setLoading(false);
      }
    },

    /**
     * Set current bakery
     * @param {Object} bakery - Bakery object
     */
    setCurrentBakery(bakery) {
      this.currentBakery = bakery;
    },

    /**
     * Clear current bakery
     */
    clearCurrentBakery() {
      this.currentBakery = null;
    },

    /**
     * Reset store to initial state
     */
    resetStore() {
      this.currentBakery = null;
      this.bakeries = [];
      this.loading = false;
      this.error = null;
    },
  },
});
