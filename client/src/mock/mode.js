/** The one backend-free switch. Normal builds use the real API. */
const parseFlag = (value) => {
  if (value === undefined || value === null || value === '') return false;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  if (import.meta.env.DEV) console.warn(`[mode] VITE_DEMO="${value}" is invalid; demo mode is off.`);
  return false;
};

export const DEMO = parseFlag(import.meta.env.VITE_DEMO);
export const isDemo = () => DEMO;

/** Fixtures are loaded only after the explicit demo-mode branch is taken. */
export const loadDemoFixtures = async () => {
  if (!DEMO) throw new Error('Demo fixtures requested while VITE_DEMO is off');
  return import('./fixtures.js');
};

export const settle = (value, ms = 220) =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

if (import.meta.env.DEV) console.info(`[mode] ${DEMO ? 'demo fixtures' : 'live API'}`);
