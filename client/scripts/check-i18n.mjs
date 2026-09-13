/**
 * Fails if km.js and en.js disagree on keys, or if any value is not a string.
 *
 * Dictionary drift is the standard i18n bug: a key is added to one file, the
 * other renders the fallback, and nobody notices until a Khmer screen shows
 * English. Run via `npm run check:i18n` in client/.
 */
import km from '../src/i18n/km.js';
import en from '../src/i18n/en.js';

const flatten = (node, prefix = '', out = new Map()) => {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, path, out);
    } else {
      out.set(path, value);
    }
  }
  return out;
};

const kmKeys = flatten(km);
const enKeys = flatten(en);

const missingInKm = [...enKeys.keys()].filter((k) => !kmKeys.has(k));
const missingInEn = [...kmKeys.keys()].filter((k) => !enKeys.has(k));

const nonString = [
  ...[...kmKeys].filter(([, v]) => typeof v !== 'string').map(([k]) => `km: ${k}`),
  ...[...enKeys].filter(([, v]) => typeof v !== 'string').map(([k]) => `en: ${k}`),
];

// A {placeholder} present in one language but not the other renders a literal
// brace in the UI, so compare the placeholder sets too.
const placeholders = (value) => new Set([...String(value).matchAll(/\{(\w+)\}/g)].map((m) => m[1]));

const placeholderMismatches = [...kmKeys]
  .filter(([key]) => enKeys.has(key))
  .map(([key, kmValue]) => {
    const a = placeholders(kmValue);
    const b = placeholders(enKeys.get(key));
    const onlyKm = [...a].filter((p) => !b.has(p));
    const onlyEn = [...b].filter((p) => !a.has(p));
    return onlyKm.length || onlyEn.length ? { key, onlyKm, onlyEn } : null;
  })
  .filter(Boolean);

const problems = [];
if (missingInKm.length) problems.push(`Missing in km.js:\n  ${missingInKm.join('\n  ')}`);
if (missingInEn.length) problems.push(`Missing in en.js:\n  ${missingInEn.join('\n  ')}`);
if (nonString.length) problems.push(`Non-string values:\n  ${nonString.join('\n  ')}`);
if (placeholderMismatches.length) {
  problems.push(
    `Placeholder mismatches:\n  ${placeholderMismatches
      .map((m) => `${m.key} — km only: [${m.onlyKm}], en only: [${m.onlyEn}]`)
      .join('\n  ')}`,
  );
}

if (problems.length) {
  console.error(`\ni18n check FAILED\n\n${problems.join('\n\n')}\n`);
  process.exit(1);
}

console.log(`i18n check passed — ${kmKeys.size} keys, km and en in sync`);
