// services/base/resourceService.js
import api from "../api";

/**
 * Base service class for handling common API operations
 */
export class BaseService {
  /**
   * @param {string} resource - The resource endpoint (e.g., 'ingredients', 'recipes')
   */
  constructor(resource) {
    if (!resource) {
      throw new Error("Resource name is required");
    }
    this.resource = resource;
    this.api = api;
  }

  /**
   * Get all resources
   * @param {Object} params - Query parameters
   * @param {number} [params.page] - Page number
   * @param {number} [params.perPage] - Items per page
   * @param {string} [params.sortBy] - Sort field
   * @param {boolean} [params.sortDesc] - Sort direction
   * @param {string} [params.search] - Search term
   * @returns {Promise<{data: Array, total?: number, page?: number}>}
   */
  async getAll(params = {}) {
    try {
      // Convert params to API-friendly format
      const queryParams = {
        page: params.page,
        per_page: params.perPage,
        sort_by: params.sortBy,
        sort_desc: params.sortDesc,
        search: params.search,
      };

      const response = await this.api.get(`/${this.resource}`, {
        params: queryParams,
      });
      return this.handleResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get a resource by ID
   * @param {string} id - Resource ID
   * @returns {Promise<Object>} Resource object
   */
  async getById(id) {
    if (!id) {
      throw new Error("ID is required");
    }

    try {
      const response = await this.api.get(`/${this.resource}/${id}`);
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
      throw new Error("Data is required");
    }

    try {
      const response = await this.api.post(`/${this.resource}`, data);
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
      throw new Error("ID is required");
    }

    if (!data) {
      throw new Error("Data is required");
    }

    try {
      const response = await this.api.put(`/${this.resource}/${id}`, data);
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
      throw new Error("ID is required");
    }

    if (!data) {
      throw new Error("Data is required");
    }

    try {
      const response = await this.api.patch(`/${this.resource}/${id}`, data);
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
      throw new Error("ID is required");
    }

    try {
      const response = await this.api.delete(`/${this.resource}/${id}`);
      return this.handleResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Handle successful API response
   * @protected
   * @param {Object} response - Axios response object
   * @returns {Object} Formatted response
   */
  handleResponse(response) {
    // Handle both paginated and non-paginated responses
    const isPaginated =
      response.data.hasOwnProperty("items") ||
      response.data.hasOwnProperty("data");

    return {
      data: isPaginated
        ? response.data.items || response.data.data
        : response.data,
      total: response.data.total,
      page: response.data.page,
      message: response.data?.message,
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
      // Server responded with error status
      const message =
        error.response.data?.message ||
        error.response.data?.error ||
        "Server error";
      const errorObject = new Error(message);
      errorObject.status = error.response.status;
      errorObject.data = error.response.data;
      throw errorObject;
    } else if (error.request) {
      // Request made but no response received
      throw new Error("No response from server");
    } else {
      // Error in request setup
      throw new Error(error.message || "Request failed");
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
