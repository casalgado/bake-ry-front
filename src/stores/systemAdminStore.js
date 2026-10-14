import { defineStore } from 'pinia';
import { BakeryService } from '@/services/bakeryService';
import { BakerySettingsService } from '@/services/bakerySettingsService';
import { BakeryUserService } from '@/services/bakeryUserService';

export const useSystemAdminStore = defineStore('systemAdmin', {
  state: () => ({
    bakeries: [],
    loading: false,
    error: null,
  }),

  getters: {
    bakeriesWithSettings: (state) => state.bakeries,

    totalBakeries: (state) => state.bakeries.length,

    bakeriesWithErrors: (state) =>
      state.bakeries.filter(bakery => bakery.settingsError),

    bakeriesWithActiveSubscriptions: (state) =>
      state.bakeries.filter(bakery =>
        bakery.settings?.subscription?.status === 'ACTIVE',
      ),

    bakeriesInTrial: (state) =>
      state.bakeries.filter(bakery =>
        bakery.settings?.subscription?.status === 'TRIAL',
      ),
  },

  actions: {
    /**
     * Fetch the bakery list. Settings load per bakery, when one is picked.
     */
    async fetchBakeries() {
      this.loading = true;
      this.error = null;

      try {
        const bakeriesResponse = await BakeryService.getAllBakeries();
        this.bakeries = bakeriesResponse?.items || [];
      } catch (error) {
        this.error = error.message || 'Failed to fetch bakeries';
        this.bakeries = [];
        console.error('Error fetching bakeries:', error);
      } finally {
        this.loading = false;
      }
    },

    /**
     * Get a specific bakery's settings
     */
    async fetchBakerySettings(bakeryId) {
      try {
        const settingsService = new BakerySettingsService(bakeryId);
        const response = await settingsService.api.get(`/bakeries/${bakeryId}/settings/default`);

        // Update the specific bakery in our list
        const bakeryIndex = this.bakeries.findIndex(b => b.id === bakeryId);
        if (bakeryIndex !== -1) {
          this.bakeries[bakeryIndex] = {
            ...this.bakeries[bakeryIndex],
            settings: response.data,
            settingsError: null,
          };
        }

        return response.data;
      } catch (error) {
        // Update error state for this specific bakery
        const bakeryIndex = this.bakeries.findIndex(b => b.id === bakeryId);
        if (bakeryIndex !== -1) {
          this.bakeries[bakeryIndex] = {
            ...this.bakeries[bakeryIndex],
            settings: null,
            settingsError: error.message || 'Failed to load settings',
          };
        }
        throw error;
      }
    },

    /**
     * Create POS client if needed
     */
    async findOrCreatePOSClient(bakeryId) {
      // Create a service instance for the specific bakery
      const bakeryUserService = new BakeryUserService(bakeryId);

      try {
        // Fetch users for the specific bakery
        const usersResponse = await bakeryUserService.getAll();
        const users = usersResponse?.data || [];

        console.log('🏪 All clients for bakery', bakeryId, ':', users.map(c => ({ id: c.id, name: c.name })));

        // Check if "Punto de Venta" client already exists
        const posClient = users.find(client => client.name === 'Punto de Venta');
        if (posClient) {
          console.log('🏪 Found existing POS client:', posClient);
          return posClient;
        }

        console.log('🏪 POS client not found, creating new one for bakery:', bakeryId);
        // Create new "Punto de Venta" client
        const newPosClient = await bakeryUserService.create({
          name: 'Punto de Venta',
          email: `pos-${bakeryId}@system.generated`,
          phone: '',
          address: '',
          role: 'bakery_customer',
          category: 'B2C',
          legalName: '',
          nationalId: '',
        });

        console.log('🏪 Created new POS client:', newPosClient);
        return newPosClient.data;
      } catch (error) {
        console.error('🏪 Error in findOrCreatePOSClient:', error);
        throw error;
      }
    },

    /**
     * Update a specific bakery's settings
     */
    async updateBakerySettings(bakeryId, features) {
      try {
        // `features` is the patch from BakeryModulesForm: only the keys it owns.
        // The backend merges it group by group, so nothing else is touched.
        const bakery = this.bakeries.find(b => b.id === bakeryId);
        const pos = features.pos;

        // Auto-select Client turned on for the first time: make sure the client exists.
        if (pos?.autoSelectClient && !bakery?.settings?.features?.pos?.autoSelectClient) {
          try {
            pos.defaultClientId = (await this.findOrCreatePOSClient(bakeryId)).id;
          } catch (error) {
            console.error('Error creating POS client:', error);
            // Continue with settings update even if client creation fails
          }
        }

        const settingsService = new BakerySettingsService(bakeryId);
        await settingsService.api.patch(`/bakeries/${bakeryId}/settings/default`, { features });
        await this.fetchBakerySettings(bakeryId);

        return { success: true };
      } catch (error) {
        console.error(`Error updating settings for bakery ${bakeryId}:`, error);
        throw error;
      }
    },

    /**
     * Clear the store state
     */
    clearState() {
      this.bakeries = [];
      this.loading = false;
      this.error = null;
    },
  },
});
