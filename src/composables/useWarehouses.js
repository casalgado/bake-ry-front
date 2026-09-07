// composables/useWarehouses.js
import { computed } from 'vue';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';

/**
 * Las bodegas de la panadería, and the single flag that decides whether the
 * concept is visible at all.
 *
 * `multiWarehouse` is the ONLY test any inventory screen may make about the
 * warehouse list. It reveals four things and nothing else: the filter chips,
 * the per-bodega expander, Transferir, and a document's destination picker.
 * With one bodega the screens must contain no trace of the idea — that is
 * locked in INVENTORY-CORRECTIONS §1, and one flag is how it stays true.
 *
 * The fallback mirrors the backend's own default (BakerySettings
 * DEFAULT_FEATURES), so a settings doc that predates the field still resolves
 * to exactly one bodega instead of none.
 */
export function useWarehouses() {
  const bakerySettingsStore = useBakerySettingsStore();

  const warehouses = computed(() => {
    const list = bakerySettingsStore.items[0]?.features?.inventory?.warehouses;
    return list?.length ? list : [{ id: 'main', name: 'Principal', isDefault: true }];
  });

  const multiWarehouse = computed(() => warehouses.value.length > 1);

  const defaultWarehouseId = computed(
    () => (warehouses.value.find((w) => w.isDefault) || warehouses.value[0]).id);

  const warehouseName = (id) =>
    warehouses.value.find((w) => w.id === id)?.name ?? id;

  return { warehouses, multiWarehouse, defaultWarehouseId, warehouseName };
}
