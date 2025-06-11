// frontend/utils/queryBuilder.js
class QueryBuilder {
  constructor() {
    this.query = {
      pagination: {
        page: 1,
        perPage: 5000,
      },
      sort: {
        field: 'createdAt',
        direction: 'asc',
      },
      filters: {},
      options: {},
    };
  }

  setPagination(page, perPage) {
    this.query.pagination = { page, perPage };
    return this;
  }

  setSort(field, direction = 'asc') {
    this.query.sort = { field, direction };
    return this;
  }

  setOrDateRange(dateFields, startDate, endDate) {
    this.query.filters.orDateRange = { dateFields, startDate, endDate };
    return this;
  }

  addFilter(key, value) {
    this.query.filters[key] = value;
    return this;
  }

  setDateRange(dateField, startDate, endDate) {
    this.query.filters.dateRange = { dateField, startDate, endDate };
    return this;
  }

  setOptions(options) {
    this.query.options = { ...this.query.options, ...options };
    return this;
  }

  build() {
    return this.query;
  }
}

export default QueryBuilder;
