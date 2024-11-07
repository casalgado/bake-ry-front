// services/bakeryService.js
import api from './api';

/**
 * Service for handling bakery-related API calls
 */
export class BakeryService {
  /**
   * Create a new bakery
   * @param {Object} bakeryData - The bakery data matching the Bakery model
   * @param {string} bakeryData.name - Name of the bakery
   * @param {string} bakeryData.address - Address of the bakery
   * @param {string} bakeryData.phone - Phone number
   * @param {string} bakeryData.email - Email address
   * @param {Object} bakeryData.operatingHours - Operating hours
   * @param {string} bakeryData.ownerId - Owner's ID
   * @returns {Promise<Object>} The created bakery
   * @throws {Error} If creation fails
   */
  static async createBakery(bakeryData) {
    try {
      const response = await api.post('/bakeries', bakeryData);
      console.log('Bakery created:', response.data);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to create bakery');
    }
  }

  /**
   * Get all bakeries
   * @returns {Promise<Array>} Array of bakery objects
   * @throws {Error} If fetching fails
   */
  static async getAllBakeries() {
    try {
      const response = await api.get('/bakeries');
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch bakeries');
    }
  }

  /**
   * Get a specific bakery by ID
   * @param {string} bakeryId - The bakery ID
   * @returns {Promise<Object>} The bakery object
   * @throws {Error} If fetching fails
   */
  static async getBakeryById(bakeryId) {
    try {
      const response = await api.get(`/bakeries/${bakeryId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch bakery');
    }
  }

  /**
   * Update a bakery
   * @param {string} bakeryId - The bakery ID
   * @param {Object} bakeryData - The updated bakery data
   * @returns {Promise<Object>} The updated bakery
   * @throws {Error} If update fails
   */
  static async updateBakery(bakeryId, bakeryData) {
    try {
      const response = await api.put(`/bakeries/${bakeryId}`, bakeryData);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to update bakery');
    }
  }

  /**
   * Delete a bakery
   * @param {string} bakeryId - The bakery ID
   * @returns {Promise<void>}
   * @throws {Error} If deletion fails
   */
  static async deleteBakery(bakeryId) {
    try {
      await api.delete(`/bakeries/${bakeryId}`);
    } catch (error) {
      throw this.handleError(error, 'Failed to delete bakery');
    }
  }

  /**
   * Get bakery details (protected route)
   * @param {string} bakeryId - The bakery ID
   * @returns {Promise<Object>} Detailed bakery information
   * @throws {Error} If fetching fails
   */
  static async getBakeryDetails(bakeryId) {
    try {
      const response = await api.get(`/bakeries/${bakeryId}/details`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch bakery details');
    }
  }

  /**
   * Handle API errors consistently
   * @private
   * @param {Error} error - The error object from axios
   * @param {string} defaultMessage - Default error message
   * @returns {Error} Formatted error object
   */
  static handleError(error, defaultMessage = 'An error occurred') {
    // Check for missing token
    if (!localStorage.getItem('AuthToken')) {
      return new Error('No token provided - please log in');
    }

    // Handle specific API errors
    if (error.response) {
      // Server responded with error
      const message = error.response.data?.error || defaultMessage;
      return new Error(message);
    } else if (error.request) {
      // Request made but no response
      return new Error('No response from server');
    }

    return new Error(defaultMessage);
  }
}
