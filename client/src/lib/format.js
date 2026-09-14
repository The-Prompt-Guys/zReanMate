import { formatNumber } from '../i18n/index.js';

/**
 * Display formatting for values the API returns raw.
 *
 * docs/API-CONTRACT.md D3: the server sends `byteSize` and `durationSeconds`,
 * not "2.4 MB" and "5h 02m". It has to, because t() converts *numbers* to Khmer
 * digits and passes *strings* through untouched — a server-formatted string
 * would render Western digits inside otherwise-Khmer UI.
 *
 * So every function here takes the language and runs its digits through
 * formatNumber, which is the same path t() uses for interpolated numbers.
 */

const UNITS = ['B', 'KB', 'MB', 'GB'];

/**
 * Bytes as a short human size. The unit stays Latin (KB/MB are written that way
 * in Khmer technical copy too); only the digits are localised.
 */
export const formatBytes = (bytes, language = 'en') => {
  if (bytes === null || bytes === undefined || Number.isNaN(Number(bytes))) return '—';

  let value = Number(bytes);
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }

  // Whole bytes read oddly with a decimal ("512.0 B"); everything above gets
  // one, which is what the design's "2.4 MB" shows.
  const rounded = unit === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${formatNumber(rounded, language)} ${UNITS[unit]}`;
};

/** Seconds as h/m, matching the "5h 02m" in the summary header. */
export const formatDuration = (seconds, language = 'en') => {
  if (seconds === null || seconds === undefined) return '—';

  const total = Math.max(0, Math.round(Number(seconds)));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (hours > 0) {
    const padded = String(minutes).padStart(2, '0');
    return `${formatNumber(hours, language)}h ${formatNumber(padded, language)}m`;
  }
  return `${formatNumber(minutes, language)}m`;
};
