/**
 * Fails if km.js and en.js disagree on keys, if any value is not a string, or
 * if a component references a key that neither dictionary defines.
 *
 * Dictionary drift is the standard i18n bug: a key is added to one file, the
 * other renders the fallback, and nobody notices until a Khmer screen shows
 * English. A key referenced but never defined is worse — translate() falls back
 * to printing the key itself, so the UI shows "quiz.takeaways" to a student.
 *
 * Run via `npm run check:i18n` in client/.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import km from '../src/i18n/km.js';
import en from '../src/i18n/en.js';

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

const walk = (dir, files = []) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.(jsx?|mjs)$/.test(entry) && !full.includes(`${'i18n'}`)) files.push(full);
  }
  return files;
};

/** Collects t('some.key') and translate(lang, 'some.key') references. */
const collectUsedKeys = () => {
  const used = new Map();
  for (const file of walk(srcDir)) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/\bt\(\s*'([A-Za-z0-9_.]+)'/g)) {
      if (!used.has(match[1])) used.set(match[1], file);
    }
  }
  return used;
};

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

const usedKeys = collectUsedKeys();
const undefinedKeys = [...usedKeys]
  .filter(([key]) => !kmKeys.has(key) && !enKeys.has(key))
  .map(([key, file]) => `${key}  (${file.split(/[/\\]src[/\\]/).pop()})`);

const problems = [];
if (missingInKm.length) problems.push(`Missing in km.js:\n  ${missingInKm.join('\n  ')}`);
if (missingInEn.length) problems.push(`Missing in en.js:\n  ${missingInEn.join('\n  ')}`);
if (undefinedKeys.length) {
  problems.push(`Referenced in components but defined nowhere:\n  ${undefinedKeys.join('\n  ')}`);
}
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

console.log(
  `i18n check passed — ${kmKeys.size} keys, km and en in sync, ` +
    `${usedKeys.size} referenced in components, all defined`,
);
