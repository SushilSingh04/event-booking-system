/**
 * Timezone-safe date utility functions for Event Booking System.
 * 
 * MongoDB stores all dates as UTC. When FastAPI returns them, they might be
 * formatted as ISO strings with or without 'Z'. These helpers guarantee that
 * dates are always correctly parsed as UTC and represented in the user's
 * local timezone without unwanted timezone-shifting offsets.
 */

/**
 * Safely parses any date string from the backend into a Date object.
 * If the string lacks a timezone offset, treats it as UTC.
 * 
 * @param {string|Date} dateVal - Date string or Date object
 * @returns {Date|null}
 */
export const parseBackendDate = (dateVal) => {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? null : dateVal;

  let str = String(dateVal).trim();
  // If the ISO string lacks timezone information, append 'Z' so it is parsed as UTC
  if (!str.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(str)) {
    str += 'Z';
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Converts a backend date string into a local YYYY-MM-DDTHH:mm string
 * suitable for HTML datetime-local inputs.
 * 
 * @param {string|Date} dateVal - Backend date string
 * @returns {string} - YYYY-MM-DDTHH:mm
 */
export const toDatetimeLocal = (dateVal) => {
  const d = parseBackendDate(dateVal);
  if (!d) return '';

  const pad = (n) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Formats a backend date into a human-readable localized string.
 * 
 * @param {string|Date} dateVal - Backend date
 * @param {Intl.DateTimeFormatOptions} options - Formatting options
 * @returns {string}
 */
export const formatEventDate = (dateVal, options = {}) => {
  try {
    const d = parseBackendDate(dateVal);
    if (!d) return String(dateVal || '');

    const defaultOptions = {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    };

    return new Intl.DateTimeFormat('en-US', { ...defaultOptions, ...options }).format(d);
  } catch {
    return String(dateVal || '');
  }
};
