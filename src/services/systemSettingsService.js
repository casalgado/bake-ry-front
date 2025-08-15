// services/systemSettingsService.js
import api from './api';

/**
 * Service for handling system-wide settings API calls
 */
export class SystemSettingsService {
  /**
   * Get current system settings
   * @returns {Promise<Object>} System settings object
   * @throws {Error} If fetching fails
   */
  static async get() {
    try {
      const response = await api.get('/system-settings');
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch system settings');
    }
  }

  /**
   * Update system settings (PATCH - partial update)
   * @param {Object} data - Settings data to update
   * @returns {Promise<Object>} Updated settings object
   * @throws {Error} If update fails
   */
  static async update(data) {
    try {
      const response = await api.patch('/system-settings', data);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to update system settings');
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
    if (!localStorage.getItem('AuthToken')) {
      return new Error('No token provided - please log in');
    }

    if (error.response) {
      const message = error.response.data?.error || defaultMessage;
      return new Error(message);
    } else if (error.request) {
      return new Error('No response from server');
    }

    return new Error(defaultMessage);
  }
}
