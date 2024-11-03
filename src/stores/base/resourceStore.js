// stores/base/resourceStore.js
import { defineStore } from "pinia";
import { ref, computed } from "vue";

export const createResourceStore = (resourceName, resourceService) => {
  if (!resourceService) {
    throw new Error("Resource service is required");
  }

  return defineStore(`${resourceName}`, () => {
    const items = ref([]);
    const currentItem = ref(null);
    const loading = ref(false);
    const error = ref(null);
    const filters = ref({
      search: "",
      sortBy: "createdAt",
      sortDesc: true,
      page: 1,
      perPage: 1000,
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
            String(value).toLowerCase().includes(searchLower)
          )
        );
      }

      filtered.sort((a, b) => {
        const aValue = a[filters.value.sortBy];
        const bValue = b[filters.value.sortBy];
        const modifier = filters.value.sortDesc ? -1 : 1;

        // Handle different types
        if (typeof aValue === "number" && typeof bValue === "number") {
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

    async function fetchAll() {
      setLoading(true);
      clearError();

      try {
        const response = await resourceService.getAll({
          page: filters.value.page,
          perPage: filters.value.perPage,
          sortBy: filters.value.sortBy,
          sortDesc: filters.value.sortDesc,
          search: filters.value.search,
        });

        items.value = Array.isArray(response.data)
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
      if (!id) throw new Error("ID is required");

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
      if (!data) throw new Error("Data is required for create");

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
      if (!id) throw new Error("ID is required for update");
      if (!formData) throw new Error("Data is required for update");
      console.log("formData", formData);

      const { ...data } = formData;


      

      console.log("data", data);

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

    async function remove(id) {
      if (!id) throw new Error("ID is required for delete");

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
        search: "",
        sortBy: "createdAt",
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
      fetchAll,
      fetchById,
      create,
      update,

      remove,
      resetStore,
    };
  });
};
