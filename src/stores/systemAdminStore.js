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
     * Fetch all bakeries with their settings
     */
    async fetchAllBakeriesWithSettings() {
      this.loading = true;
      this.error = null;

      try {
        // Get all bakeries first
        const bakeriesResponse = await BakeryService.getAllBakeries();
        const bakeries = bakeriesResponse?.items || [];

        if (bakeries.length === 0) {
          this.bakeries = [];
          return;
        }

        // Fetch settings for each bakery
        const bakeriesWithSettings = await Promise.allSettled(
          bakeries.map(async (bakery) => {
            try {
              const settingsService = new BakerySettingsService(bakery.id);
              const response = await settingsService.api.get(`/bakeries/${bakery.id}/settings/default`);

              return {
                ...bakery,
                settings: response.data,
                settingsError: null,
              };
            } catch (error) {
              console.warn(`Failed to fetch settings for bakery ${bakery.id}:`, error);
              return {
                ...bakery,
                settings: null,
                settingsError: error.message || 'Failed to load settings',
              };
            }
          }),
        );

        // Map results, keeping both successful and failed attempts
        this.bakeries = Array.isArray(bakeriesWithSettings)
          ? bakeriesWithSettings.map(result =>
            result.status === 'fulfilled' ? result.value : result.reason,
          )
          : [];

      } catch (error) {
        this.error = error.message || 'Failed to fetch bakeries';
        this.bakeries = []; // Ensure bakeries is always an array
        console.error('Error fetching bakeries with settings:', error);
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
        const settings = await settingsService.fetchById('default');

        // Update the specific bakery in our list
        const bakeryIndex = this.bakeries.findIndex(b => b.id === bakeryId);
        if (bakeryIndex !== -1) {
          this.bakeries[bakeryIndex] = {
            ...this.bakeries[bakeryIndex],
            settings: settings.data,
            settingsError: null,
          };
        }

        return settings.data;
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
    async updateBakerySettings(bakeryId, featuresData) {
      try {
        // Get current settings to check if Auto-select Client is being enabled for first time
        const bakeryIndex = this.bakeries.findIndex(b => b.id === bakeryId);
        const currentAutoSelectClient = bakeryIndex !== -1 ?
          this.bakeries[bakeryIndex].settings?.features?.pos?.autoSelectClient : false;

        let posDefaultClientId = featuresData.posDefaultClientId;

        // If Auto-select Client is being enabled for the first time, auto-create client
        if (featuresData.posAutoSelectClient && !currentAutoSelectClient) {
          try {
            const posClient = await this.findOrCreatePOSClient(bakeryId);
            console.log('🏪 Created/found POS client:', posClient);
            posDefaultClientId = posClient.id;
            console.log('🏪 Setting POS client ID to:', posDefaultClientId);
          } catch (error) {
            console.error('Error creating POS client:', error);
            // Continue with settings update even if client creation fails
          }
        }

        // Use the same structure as BakeryFeaturesForm expects
        const settingsPayload = {
          features: {
            order: {
              activePaymentMethods: featuresData.activePaymentMethods,
              allowPartialPayment: featuresData.allowPartialPayment,
              timeOfDay: featuresData.timeOfDay,
              offlineMode: featuresData.offlineMode,
              loadHistoricalOnUserSelection: featuresData.loadHistoricalOnUserSelection,
            },
            reports: {
              defaultReportFilter: featuresData.defaultReportFilter,
              showMultipleReports: featuresData.showMultipleReports,
            },
            products: {
              useProductCost: featuresData.useProductCost,
            },
            invoicing: {
              defaultTermsAndConditions: featuresData.defaultTermsAndConditions || '',
              showProductDescriptions: true,
              showTermsAndConditions: true,
              taxMode: featuresData.taxMode || 'inclusive',
            },
            pos: {
              autoMarkPaid: featuresData.posAutoMarkPaid || false,
              defaultToCurrentDate: featuresData.posDefaultToCurrentDate || false,
              hideDeliveryOptions: featuresData.posHideDeliveryOptions || false,
              autoSelectClient: featuresData.posAutoSelectClient || false,
              defaultClientId: posDefaultClientId,
            },
          },
        };

        const settingsService = new BakerySettingsService(bakeryId);
        await settingsService.api.patch(`/bakeries/${bakeryId}/settings/default`, settingsPayload);

        // Update the bakery in our local state
        if (bakeryIndex !== -1) {
          // Re-fetch the updated settings
          const response = await settingsService.api.get(`/bakeries/${bakeryId}/settings/default`);
          this.bakeries[bakeryIndex].settings = response.data;
        }

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
