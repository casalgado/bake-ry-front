// stores/base/resourceStore.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import QueryBuilder from '@/utils/queryBuilder';

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

    // Getters
    const getById = computed(() => {
      return (id) => items.value.find((item) => item.id === id);
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

    // Real-time update handler
    function handleRealtimeUpdate(changes) {
      console.log('handleRealtimeUpdate', changes);
      changes.forEach((change) => {
        switch (change.type) {
        case 'added': {
          const index = items.value.findIndex(item => item.id === change.data.id);
          // Only add if it doesn't already exist and if not initial load
          // the changes < 5 are to prevent the initial load from setting the store to all items.
          // it could be less < 1 here because only one order is added a a time, chose < 5 for safety

          if (index === -1 && changes.length < 3) {
            // Add to beginning of array to match typical Firestore behavior
            items.value.push(change.data);

          }
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

    // stores/base/resourceStore.js

    async function fetchAll(request = {}) {
      setLoading(true);
      clearError();

      try {
        const queryBuilder = new QueryBuilder();

        // Add date range if provided
        if (request.dateRange) {
          queryBuilder.setDateRange(request.dateRange.dateField, request.dateRange.startDate, request.dateRange.endDate);
        }

        // Add any other filters
        if (request.filters) {
          Object.entries(request.filters).forEach(([key, value]) => {
            queryBuilder.addFilter(key, value);
          });
        }

        const query = queryBuilder.build();
        const response = await resourceService.getAll(query);

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
          items.value[index] = updatedItem;
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

    const patchAll = async (updates) => {
      try {
        const response = await resourceService.patchAll(updates);

        // Update local state
        updates.forEach(({ id, data }) => {
          const index = items.value.findIndex(item => item.id === id);
          if (index !== -1) {
            items.value[index] = { ...items.value[index], ...data };
          }
        });

        return response;
      } catch (error) {
        setError(error);
        throw error;
      }
    };

    async function remove(id) {
      if (!id) throw new Error('ID is required for delete');

      setLoading(true);
      clearError();
      console.log('remove', id);

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
      queryParams.value = {
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
      isSubscribed,

      // Getters
      getById,

      // Actions
      setLoading,
      setError,
      clearError,
      setCurrentItem,
      subscribeToChanges,
      unsubscribe,
      fetchAll,
      fetchById,
      create,
      update,
      patch,
      patchAll,
      remove,
      resetStore,
    };
  });
};
