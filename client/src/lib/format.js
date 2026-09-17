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

/**
 * A timestamp as "just now" / "5 minutes ago" / "3 days ago".
 *
 * Returns null under a minute so the caller can use its own "just now" wording
 * rather than Intl's, which renders as "in 0 seconds" for a fresh row.
 * Intl.RelativeTimeFormat localises Khmer itself, digits included, so this one
 * does not route through formatNumber.
 */
const STEPS = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
];

export const formatRelativeTime = (iso, language = 'en') => {
  if (!iso) return null;
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return null;

  const seconds = Math.round((at - Date.now()) / 1000);
  const magnitude = Math.abs(seconds);
  if (magnitude < 60) return null;

  const rtf = new Intl.RelativeTimeFormat(language === 'km' ? 'km-KH' : 'en', { numeric: 'auto' });
  const [unit, size] = STEPS.find(([, s]) => magnitude >= s) ?? ['minute', 60];
  return rtf.format(Math.round(seconds / size), unit);
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
