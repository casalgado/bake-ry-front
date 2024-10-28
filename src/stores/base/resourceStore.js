// stores/base/resourceStore.js
import { defineStore } from "pinia";

/**
 * Creates a base resource store with common CRUD operations
 * @param {string} resourceName - The name of the resource (e.g., 'ingredients')
 * @param {import('../base/resourceService').BaseService} resourceService - The service instance for the resource
 * @returns {Object} A Pinia store with base CRUD functionality
 */
export const createResourceStore = (resourceName, resourceService) => {
  if (!resourceService) {
    throw new Error("Resource service is required");
  }

  return defineStore(`${resourceName}`, {
    state: () => ({
      items: [],
      currentItem: null,
      loading: false,
      error: null,
      filters: {
        search: "",
        sortBy: "createdAt",
        sortDesc: true,
        page: 1,
        perPage: 10,
      },
    }),

    getters: {
      // Get item by id
      getById: (state) => {
        return (id) => state.items.find((item) => item.id === id);
      },

      // Get filtered items
      filteredItems: (state) => {
        let filtered = [...state.items];

        // Apply search filter if present
        if (state.filters.search) {
          const searchLower = state.filters.search.toLowerCase();
          filtered = filtered.filter((item) =>
            Object.values(item).some((value) =>
              String(value).toLowerCase().includes(searchLower)
            )
          );
        }

        // Apply sorting
        filtered.sort((a, b) => {
          const modifier = state.filters.sortDesc ? -1 : 1;
          return (
            modifier *
            String(a[state.filters.sortBy]).localeCompare(
              String(b[state.filters.sortBy])
            )
          );
        });

        return filtered;
      },

      // Get paginated items
      paginatedItems: (state) => {
        const start = (state.filters.page - 1) * state.filters.perPage;
        const end = start + state.filters.perPage;
        return state.filteredItems.slice(start, end);
      },

      // Get total pages
      totalPages: (state) => {
        return Math.ceil(state.filteredItems.length / state.filters.perPage);
      },
    },

    actions: {
      // Set loading state
      setLoading(status) {
        this.loading = status;
      },

      // Set error state
      setError(error) {
        this.error = error?.message || null;
      },

      // Clear error state
      clearError() {
        this.error = null;
      },

      // Set current item
      setCurrentItem(item) {
        this.currentItem = item;
      },

      // Update filters
      updateFilters(newFilters) {
        this.filters = { ...this.filters, ...newFilters };
      },

      // Fetch all items
      async fetchAll() {
        this.setLoading(true);
        this.clearError();

        try {
          // Pass filters to service
          const response = await resourceService.getAll({
            page: this.filters.page,
            perPage: this.filters.perPage,
            sortBy: this.filters.sortBy,
            sortDesc: this.filters.sortDesc,
            search: this.filters.search,
          });

          // Handle both array and paginated responses
          this.items = Array.isArray(response.data)
            ? response.data
            : response.data.items || response.data.data || [];

          return response;
        } catch (error) {
          this.setError(error);
          throw error;
        } finally {
          this.setLoading(false);
        }
      },

      // Fetch single item
      async fetchById(id) {
        if (!id) {
          throw new Error("ID is required");
        }

        this.setLoading(true);
        this.clearError();

        try {
          const response = await resourceService.getById(id);
          const item = response.data;

          // Update in items array if exists
          const index = this.items.findIndex((i) => i.id === id);
          if (index !== -1) {
            this.items[index] = item;
          } else {
            this.items.push(item);
          }

          this.setCurrentItem(item);
          return item;
        } catch (error) {
          this.setError(error);
          throw error;
        } finally {
          this.setLoading(false);
        }
      },

      // Create item
      async create(data) {
        if (!data) {
          throw new Error("Data is required for create");
        }

        this.setLoading(true);
        this.clearError();

        try {
          const response = await resourceService.create(data);
          const newItem = response.data;
          this.items.push(newItem);
          return newItem;
        } catch (error) {
          this.setError(error);
          throw error;
        } finally {
          this.setLoading(false);
        }
      },

      // Update item
      async update(id, data) {
        if (!id) {
          throw new Error("ID is required for update");
        }

        if (!data) {
          throw new Error("Data is required for update");
        }

        this.setLoading(true);
        this.clearError();

        try {
          const response = await resourceService.update(id, data);
          const updatedItem = response.data;

          const index = this.items.findIndex((item) => item.id === id);
          if (index !== -1) {
            this.items[index] = updatedItem;
          }

          if (this.currentItem?.id === id) {
            this.currentItem = updatedItem;
          }

          return updatedItem;
        } catch (error) {
          this.setError(error);
          throw error;
        } finally {
          this.setLoading(false);
        }
      },

      // Delete item
      async delete(id) {
        if (!id) {
          throw new Error("ID is required for delete");
        }

        this.setLoading(true);
        this.clearError();

        try {
          await resourceService.delete(id);
          this.items = this.items.filter((item) => item.id !== id);

          if (this.currentItem?.id === id) {
            this.currentItem = null;
          }
        } catch (error) {
          this.setError(error);
          throw error;
        } finally {
          this.setLoading(false);
        }
      },

      // Reset store state
      resetStore() {
        this.items = [];
        this.currentItem = null;
        this.loading = false;
        this.error = null;
        this.filters = {
          search: "",
          sortBy: "createdAt",
          sortDesc: true,
          page: 1,
          perPage: 10,
        };
      },
    },
  });
};
