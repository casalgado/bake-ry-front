// Date utilities for consistent timezone handling (Colombian timezone)
// All dates handled in local timezone to avoid UTC conversion issues

/**
 * Get today's date in YYYY-MM-DD format (local timezone)
 * @returns {string} Today's date in ISO format
 */
export const getTodayString = () => {
  const date = new Date();
  return formatDateForInput(date);
};

/**
 * Get tomorrow's date in YYYY-MM-DD format (local timezone)
 * @returns {string} Tomorrow's date in ISO format
 */
export const getTomorrowString = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return formatDateForInput(date);
};

/**
 * Get next business day (skips Sunday) in YYYY-MM-DD format (local timezone)
 * @returns {string} Next business day in ISO format
 */
export const getNextBusinessDayString = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1); // Start with tomorrow

  // If it's Sunday (0), add 1 day to get to Monday
  if (date.getDay() === 0) {
    date.setDate(date.getDate() + 1);
  }

  return formatDateForInput(date);
};

/**
 * Format a date for HTML input[type="date"] elements (YYYY-MM-DD)
 * Uses local timezone to avoid UTC conversion issues
 * @param {Date|string} date - Date object or date string
 * @returns {string} Date in YYYY-MM-DD format
 */
export const formatDateForInput = (date) => {
  if (!date) return '';

  const dateObj = date instanceof Date ? date : new Date(date);

  // Use local timezone methods to avoid UTC conversion
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

/**
 * Format date for display in Spanish locale
 * @param {Date|string} date - Date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export const formatDateDisplay = (date, options = {}) => {
  if (!date) return '';

  const dateObj = date instanceof Date ? date : new Date(date);
  const defaultOptions = {
    day: 'numeric',
    month: 'short',
  };

  return dateObj.toLocaleDateString('es-ES', { ...defaultOptions, ...options })
    .replace('.', '');
};
