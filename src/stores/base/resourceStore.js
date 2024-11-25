// stores/base/resourceStore.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const createResourceStore = (resourceName, resourceService) => {
  if (!resourceService) {
    throw new Error('Resource service is required');
  }

  return defineStore(`${resourceName}`, () => {
    const items = ref([]);
    const currentItem = ref(null);
    const loading = ref(false);
    const error = ref(null);
    const isSubscribed = ref(false);
    const filters = ref({
      page: 1,
      perPage: 1000,
      sort: 'createdAt',
    });

    // Getters
    const getById = computed(() => {
      return (id) => items.value.find((item) => item.id === id);
    });

    const filteredItems = computed(() => {
      let filtered = [...items.value];

      if (filters.value.search) {
        const searchLower = filters.value.search.toLowerCase();
        filtered = filtered.filter((item) =>
          Object.values(item).some((value) =>
            String(value).toLowerCase().includes(searchLower),
          ),
        );
      }

      filtered.sort((a, b) => {
        const aValue = a[filters.value.sortBy];
        const bValue = b[filters.value.sortBy];
        const modifier = filters.value.sortDesc ? -1 : 1;

        // Handle different types
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return modifier * (aValue - bValue);
        }
        if (aValue instanceof Date && bValue instanceof Date) {
          return modifier * (aValue.getTime() - bValue.getTime());
        }
        return modifier * String(aValue).localeCompare(String(bValue));
      });

      return filtered;
    });

    const paginatedItems = computed(() => {
      const start = (filters.value.page - 1) * filters.value.perPage;
      const end = start + filters.value.perPage;
      return filteredItems.value.slice(start, end);
    });

    const totalPages = computed(() => {
      return Math.ceil(filteredItems.value.length / filters.value.perPage);
    });

    // Actions
    function setLoading(status) {
      loading.value = status;
    }

    function setError(err) {
      error.value = err?.message || null;
    }

    function clearError() {
      error.value = null;
    }

    function setCurrentItem(item) {
      currentItem.value = item;
    }

    function updateFilters(newFilters) {
      filters.value = { ...filters.value, ...newFilters };
    }

    // Real-time update handler
    function handleRealtimeUpdate(changes) {
      changes.forEach((change) => {
        switch (change.type) {
        case 'added': {
          // console.log('ADDED REALTIME NOT IMPLEMENTED YET', change.data);
          // const index = items.value.findIndex(item => item.id === change.data.id);
          // if (index === -1) {
          //   items.value.push(change.data);
          // }
          break;
        }
        case 'modified': {
          const index = items.value.findIndex(item => item.id === change.data.id);
          if (index !== -1) {
            const currentItem = items.value[index];

            Object.entries(change.data).forEach(([key, newValue]) => {
              // Skip id field
              if (key === 'id') return;

              // Only update primitive values (string, number, boolean)

              if (
                typeof newValue === 'string' ||
                typeof newValue === 'number' ||
                typeof newValue === 'boolean'
              ) {
                if (currentItem[key] !== newValue) {
                  items.value[index][key] = newValue;
                  console.log('key newValue', key, newValue);
                }
              }
              // For timestamps, arrays, and objects, keep the existing value
              // This preserves the reactive arrays and properly formatted dates
            });
          }
          break;
        }
        case 'removed': {
          console.log('REMOVED REALTIME NOT IMPLEMENTED YET', change.data);
          // items.value = items.value.filter(item => item.id !== change.data.id);
          // if (currentItem.value?.id === change.data.id) {
          //   currentItem.value = null;
          // }
          break;
        }
        }
      });
    }

    async function subscribeToChanges() {
      if (isSubscribed.value) return;

      const unsubscribe = resourceService.subscribeToChanges(
        handleRealtimeUpdate,
      );

      isSubscribed.value = true;
      return unsubscribe;
    }

    function unsubscribe() {
      if (isSubscribed.value) {
        resourceService.unsubscribeFromChanges();
        isSubscribed.value = false;
      }
    }

    async function fetchAll(options = {}) {
      setLoading(true);
      clearError();

      try {
        const { dateRange, ...otherOptions } = options;

        const response = await resourceService.getAll({
          page: filters.value.page,
          perPage: filters.value.perPage,
          sort: filters.value.sort,
          dateRange,
          ...otherOptions,
        });

        console.log('response.data', response.data);

        // problematic line causing the error.
        items.value = Array.isArray(response.data) && response.data.length > 0
          ? response.data
          : response.data.items || response.data.data || [];

        return response;
      } catch (err) {
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    }

    async function fetchById(id) {
      if (!id) throw new Error('ID is required');

      setLoading(true);
      clearError();

      try {
        const response = await resourceService.getById(id);
        const item = response.data;

        const index = items.value.findIndex((i) => i.id === id);
        if (index !== -1) {
          items.value[index] = item;
        } else {
          items.value.push(item);
        }

        setCurrentItem(item);
        return item;
      } catch (err) {
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    }

    async function create(data) {
      if (!data) throw new Error('Data is required for create');

      setLoading(true);
      clearError();

      try {
        const response = await resourceService.create(data);
        const newItem = response.data;
        items.value.push(newItem);
        return newItem;
      } catch (err) {
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    }

    async function update(id, formData) {
      if (!id) throw new Error('ID is required for update');
      if (!formData) throw new Error('Data is required for update');

      const { ...data } = formData;
      setLoading(true);
      clearError();

      try {
        const response = await resourceService.update(id, data);
        const updatedItem = response.data;

        const index = items.value.findIndex((item) => item.id === id);
        if (index !== -1) {
          items.value[index] = updatedItem;
        }

        if (currentItem.value?.id === id) {
          currentItem.value = updatedItem;
        }

        return updatedItem;
      } catch (err) {
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    }

    async function patch(id, data) {
      if (!id) throw new Error('ID is required for patch');
      if (!data) throw new Error('Data is required for patch');

      clearError();

      try {
        const response = await resourceService.patch(id, data);
        const updatedItem = response.data;

        const index = items.value.findIndex((item) => item.id === id);
        if (index !== -1) {
          Object.entries(data).forEach(([key, value]) => {
            items.value[index][key] = value;
          });
        }

        if (currentItem.value?.id === id) {
          currentItem.value = updatedItem;
        }

        return updatedItem;
      } catch (err) {
        setError(err);
        throw err;
      }
    }

    async function remove(id) {
      if (!id) throw new Error('ID is required for delete');

      setLoading(true);
      clearError();

      try {
        await resourceService.delete(id);
        items.value = items.value.filter((item) => item.id !== id);

        if (currentItem.value?.id === id) {
          currentItem.value = null;
        }
      } catch (err) {
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    }

    function resetStore() {
      items.value = [];
      currentItem.value = null;
      loading.value = false;
      error.value = null;
      filters.value = {
        search: '',
        sortBy: 'createdAt',
        sortDesc: true,
        page: 1,
        perPage: 10,
      };
    }

    return {
      // State
      items,
      currentItem,
      loading,
      error,
      filters,
      isSubscribed,

      // Getters
      getById,
      filteredItems,
      paginatedItems,
      totalPages,

      // Actions
      setLoading,
      setError,
      clearError,
      setCurrentItem,
      updateFilters,
      subscribeToChanges,
      unsubscribe,
      fetchAll,
      fetchById,
      create,
      update,
      patch,
      remove,
      resetStore,
    };
  });
};
