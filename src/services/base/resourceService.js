// services/base/resourceService.js
import api from '../api';
import { db } from '@/config/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

/**
 * Base service class for handling common API operations
 */
export class BaseService {
  // Define date fields that need conversion
  static dateFields = [
    'createdAt',
    'updatedAt',
    'dueDate',
    'preparationDate',
    'lastLoginAt',
    'deletedAt',
    'completedAt',
  ];

  /**
   * @param {string} resource - The resource endpoint (e.g., 'ingredients', 'recipes')
   * @param {string} basePath - Base path for the API (e.g., '/bakeries/123')
   */
  constructor(resource, basePath) {
    if (!resource) {
      throw new Error('Resource name is required');
    }
    if (!basePath) {
      throw new Error('Base path is required');
    }
    this.resource = resource;
    this.basePath = basePath;
    this.bakeryId = this.extractBakeryId(basePath);
    this.api = api;
    this.listeners = new Map();
  }

  /**
   * Convert Firestore timestamps to JavaScript Date objects
   * @private
   * @param {Object} data - Data object containing timestamps
   * @returns {Object} Data with converted dates
   */
  convertTimestamps(data) {
    const converted = { ...data };
    BaseService.dateFields.forEach((field) => {
      if (converted[field]?.toDate) {
        converted[field] = converted[field].toDate();
      } else if (converted[field] && !(converted[field] instanceof Date)) {
        try {
          converted[field] = new Date(converted[field]);
        } catch (error) {
          console.warn(`Failed to convert date for field ${field}:`, error);
        }
      }
    });
    return converted;
  }

  /**
   * Get full endpoint path
   * @private
   * @returns {string} The complete endpoint path
   */
  getPath() {
    return `${this.basePath}/${this.resource}`;
  }

  /**
   * Safely extract bakeryId from basePath
   * @private
   * @param {string} path - Base path string
   * @returns {string|null} Extracted bakeryId or null
   */
  extractBakeryId(path) {
    if (!path) return null;

    try {
      const segments = path.split('/');
      const bakeryIndex = segments.indexOf('bakeries');
      return bakeryIndex !== -1 && segments[bakeryIndex + 1]
        ? segments[bakeryIndex + 1]
        : null;
    } catch (error) {
      console.warn('Failed to extract bakeryId from path:', path);
      return null;
    }
  }

  async getAll(query = {}) {
    try {
      // Convert the query object to API parameters
      const params = this.formatQueryParams(query);

      const response = await this.api.get(this.getPath(), { params });
      return this.handleResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  formatQueryParams(query) {
    const params = {
      page: query.pagination?.page,
      per_page: query.pagination?.perPage,
    };

    // Add sorting
    if (query.sort) {
      params.sort =
        query.sort.direction === 'desc'
          ? `-${query.sort.field}`
          : query.sort.field;
    }

    // Add date range
    if (query.filters?.dateRange) {
      params.date_field = query.filters.dateRange.dateField;
      params.start_date = query.filters.dateRange.startDate;
      params.end_date = query.filters.dateRange.endDate;
    }

    // Add OR date range
    if (query.filters?.orDateRange) {
      params.or_date_fields = query.filters.orDateRange.dateFields.join(',');
      params.or_start_date = query.filters.orDateRange.startDate;
      params.or_end_date = query.filters.orDateRange.endDate;
    }

    // Add other filters
    Object.entries(query.filters || {}).forEach(([key, value]) => {
      if (key !== 'dateRange') {
        // Skip dateRange as it's already handled
        params[key] = value;
      }
    });

    // Add additional options
    Object.entries(query.options || {}).forEach(([key, value]) => {
      params[key] = value;
    });

    return params;
  }

  /**
   * Get filtered resources for a specific period
   * @param {Object} dateRange - Date range object
   * @param {string} dateRange.startDate - Start date in ISO format
   * @param {string} dateRange.endDate - End date in ISO format
   * @param {Object} [additionalParams] - Additional query parameters
   * @returns {Promise<{data: Array, total?: number, page?: number}>}
   */
  async getAllInPeriod(dateRange, additionalParams = {}) {
    return this.getAll({
      dateRange,
      ...additionalParams,
    });
  }

  /**
   * Get a resource by ID
   * @param {string} id - Resource ID
   * @returns {Promise<Object>} Resource object
   */
  async getById(id) {
    if (!id) {
      throw new Error('ID is required');
    }

    try {
      const response = await this.api.get(`${this.getPath()}/${id}`);
      return this.handleResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Create a new resource
   * @param {Object} data - Resource data
   * @returns {Promise<Object>} Created resource
   */
  async create(data) {
    if (!data) {
      throw new Error('Data is required');
    }
    console.log('creating', data);
    try {
      const response = await this.api.post(this.getPath(), data);
      return this.handleResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Update a resource
   * @param {string} id - Resource ID
   * @param {Object} data - Updated resource data
   * @returns {Promise<Object>} Updated resource
   */
  async update(id, data) {
    if (!id) {
      throw new Error('ID is required');
    }
    if (!data) {
      throw new Error('Data is required');
    }

    try {
      const response = await this.api.put(`${this.getPath()}/${id}`, data);
      return this.handleResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Partially update a resource
   * @param {string} id - Resource ID
   * @param {Object} data - Partial resource data
   * @returns {Promise<Object>} Updated resource
   */
  async patch(id, data) {
    if (!id) {
      throw new Error('ID is required');
    }
    if (!data) {
      throw new Error('Data is required');
    }

    try {
      const response = await this.api.patch(`${this.getPath()}/${id}`, data);
      return this.handleResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async patchAll(updates) {
    if (!updates || !Array.isArray(updates)) {
      throw new Error('Updates array is required');
    }

    try {
      const response = await this.api.patch(`${this.getPath()}/bulk-update`, {
        updates,
      });
      return this.handleResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Delete a resource
   * @param {string} id - Resource ID
   * @returns {Promise<void>}
   */
  async delete(id) {
    if (!id) {
      throw new Error('ID is required');
    }

    try {
      const response = await this.api.delete(`${this.getPath()}/${id}`);
      return this.handleResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Subscribe to collection changes
   * @param {Function} onUpdate - Callback for updates
   * @returns {Function} Unsubscribe function
   */
  subscribeToChanges(onUpdate) {
    const collectionRef = collection(
      db,
      'bakeries',
      this.bakeryId,
      this.resource,
    );
    const q = query(collectionRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const changes = [];
        snapshot.docChanges().forEach((change) => {
          const rawData = {
            id: change.doc.id,
            ...change.doc.data(),
            bakeryId: this.bakeryId,
          };
          // Convert timestamps before sending to store
          const convertedData = this.convertTimestamps(rawData);
          changes.push({ type: change.type, data: convertedData });
        });
        onUpdate(changes);
      },
      (error) => {
        console.error('Firestore subscription error:', error);
      },
    );

    const listenerId = `${this.resource}-${this.bakeryId}`;
    this.listeners.set(listenerId, unsubscribe);

    return unsubscribe;
  }

  /**
   * Unsubscribe from changes
   */
  unsubscribeFromChanges() {
    const listenerId = `${this.resource}-${this.bakeryId}`;
    const unsubscribe = this.listeners.get(listenerId);
    if (unsubscribe) {
      unsubscribe();
      this.listeners.delete(listenerId);
    }
  }

  /**
   * Handle successful API response
   * @protected
   * @param {Object} response - Axios response object
   * @returns {Object} Formatted response
   */
  handleResponse(response) {
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid response format');
    }

    const responseData = response.data;
    const isPaginated =
      responseData &&
      (Array.isArray(responseData.items) || Array.isArray(responseData.data));

    return {
      data: isPaginated
        ? responseData.items || responseData.data
        : responseData,
      total: responseData?.total,
      page: responseData?.page,
      message: responseData?.message,
      status: response.status,
      headers: response.headers,
    };
  }

  /**
   * Handle API errors
   * @protected
   * @param {Error} error - Error object
   * @throws {Error} Formatted error
   */
  handleError(error) {
    if (error.response) {
      const message =
        error.response.data?.message ||
        error.response.data?.error ||
        'Server error';
      const errorObject = new Error(message);
      errorObject.status = error.response.status;
      errorObject.data = error.response.data;
      throw errorObject;
    } else if (error.request) {
      throw new Error('No response from server');
    } else {
      throw new Error(error.message || 'Request failed');
    }
  }

  /**
   * Build query string from parameters
   * @protected
   * @param {Object} params - Query parameters
   * @returns {string} Formatted query string
   */
  buildQueryString(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        query.append(key, value);
      }
    });
    return query.toString();
  }

  /**
   * Make a custom API call
   * @protected
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {Object} [data] - Request data
   * @param {Object} [config] - Axios config
   * @returns {Promise<Object>} Response data
   */
  async customRequest(method, endpoint, data = null, config = {}) {
    try {
      const response = await this.api.request({
        method,
        url: endpoint,
        data,
        ...config,
      });
      return this.handleResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }
}
