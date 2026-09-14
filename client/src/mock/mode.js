/**
 * Per-flow prototype switches.
 *
 * The backend lands one vertical slice at a time, so the client has to run
 * half-mocked: kits reading fixtures while classes already talks to /api. One
 * global flag can't express that — flipping it moves every screen at once, and
 * a shape mismatch anywhere looks like a mismatch everywhere.
 *
 * So each flow gets its own switch. A flow in prototype mode reads
 * src/mock/fixtures.js and never calls the API; a flow that is live calls the
 * API and has no fixture fallback. Flip one flow, fix what breaks, move on.
 *
 * Resolution, per flow, first match wins:
 *
 *   1. VITE_PROTOTYPE_<FLOW>   explicit per-flow override
 *   2. VITE_PROTOTYPE          the global default (flows marked inheritsGlobal)
 *   3. the flow's own default  prototype for everything still on fixtures
 *
 * These are build-time constants. Changing an env var needs a dev-server
 * restart, not a reload.
 */

/**
 * Every switchable flow, and what it does with no env vars set at all.
 *
 * `auth` is the exception on both counts: it is live, and it deliberately does
 * NOT inherit the global flag. VITE_PROTOTYPE defaults to prototype, so an
 * inheriting `auth` would silently drop back to the fixture user and the
 * pass-through guards the moment someone set the global — re-mocking a flow
 * that is finished and verified. Only an explicit VITE_PROTOTYPE_AUTH moves it.
 *
 * Auth and onboarding are one entry because they are one flow in the client:
 * AuthContext owns register/login *and* chooseRole/submitSurvey, guards.jsx
 * covers both, and docs/screens groups them as 01-auth-onboarding.
 */
const FLOWS = {
  auth: { fallback: false, inheritsGlobal: false },
  kits: { fallback: true, inheritsGlobal: true },
  study: { fallback: true, inheritsGlobal: true },
  chat: { fallback: true, inheritsGlobal: true },
  quiz: { fallback: true, inheritsGlobal: true },
  practice: { fallback: true, inheritsGlobal: true },
  flashcards: { fallback: true, inheritsGlobal: true },
  classes: { fallback: true, inheritsGlobal: true },
  assignments: { fallback: true, inheritsGlobal: true },
  profile: { fallback: true, inheritsGlobal: true },
};

/**
 * Read statically, one line per flow, rather than building the key from the
 * flow name. Vite 8 does resolve `import.meta.env[key]` (it emits the whole env
 * as an object literal), but dynamic access is not a documented guarantee and
 * breaks under a `define`-based setup. Spelling each one out also makes the
 * supported flags greppable — this list is the API.
 */
const RAW = {
  auth: import.meta.env.VITE_PROTOTYPE_AUTH,
  kits: import.meta.env.VITE_PROTOTYPE_KITS,
  study: import.meta.env.VITE_PROTOTYPE_STUDY,
  chat: import.meta.env.VITE_PROTOTYPE_CHAT,
  quiz: import.meta.env.VITE_PROTOTYPE_QUIZ,
  practice: import.meta.env.VITE_PROTOTYPE_PRACTICE,
  flashcards: import.meta.env.VITE_PROTOTYPE_FLASHCARDS,
  classes: import.meta.env.VITE_PROTOTYPE_CLASSES,
  assignments: import.meta.env.VITE_PROTOTYPE_ASSIGNMENTS,
  profile: import.meta.env.VITE_PROTOTYPE_PROFILE,
};

const RAW_GLOBAL = import.meta.env.VITE_PROTOTYPE;

const envName = (flow) => `VITE_PROTOTYPE_${flow.toUpperCase()}`;

/**
 * Strict on purpose. The old flag was `!== 'false'`, which reads every typo as
 * prototype mode — `VITE_PROTOTYPE_KITS=flase` would leave kits on fixtures
 * while you believed it was live, which is exactly the confusion this split
 * exists to remove.
 *
 * Returns undefined for "not set", so resolution falls through to the next
 * level. An unrecognised value is also undefined, but warns first.
 */
const parseFlag = (value, name) => {
  if (value === undefined || value === null || value === '') return undefined;

  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;

  if (import.meta.env.DEV) {
    console.warn(
      `[mode] ${name}="${value}" is not true/false — ignoring it and falling back. ` +
        `Use true or false.`,
    );
  }
  return undefined;
};

const resolve = (flow) => {
  const { fallback, inheritsGlobal } = FLOWS[flow];

  const own = parseFlag(RAW[flow], envName(flow));
  if (own !== undefined) return own;

  if (inheritsGlobal) {
    const global = parseFlag(RAW_GLOBAL, 'VITE_PROTOTYPE');
    if (global !== undefined) return global;
  }

  return fallback;
};

/**
 * The resolved answer for every flow, frozen. Prefer isPrototype() at call
 * sites — it catches a misspelled flow name, which this object cannot.
 */
export const PROTOTYPE_FLOWS = Object.freeze(
  Object.fromEntries(Object.keys(FLOWS).map((flow) => [flow, resolve(flow)])),
);

/**
 * True when `flow` should read fixtures instead of calling the API.
 *
 * Throws on an unknown flow rather than returning false: a typo'd name would
 * otherwise read as "live" and send a half-built screen at the real API.
 *
 * @param {keyof typeof FLOWS} flow
 */
export const isPrototype = (flow) => {
  if (!Object.hasOwn(PROTOTYPE_FLOWS, flow)) {
    throw new Error(
      `[mode] unknown flow "${flow}". Known flows: ${Object.keys(FLOWS).join(', ')}`,
    );
  }
  return PROTOTYPE_FLOWS[flow];
};

/**
 * There is deliberately no `PROTOTYPE` export any more. A boolean-to-object
 * rename would have left every existing `if (PROTOTYPE)` truthy and silently
 * pinned that flow to fixtures for good; dropping the name turns each stale
 * import into a build error instead.
 */

/** Simulates network latency so loading states are visible in the prototype. */
export const settle = (value, ms = 220) =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

// One line at boot so it is obvious which half of the app is talking to the
// server — the first thing worth knowing when a screen renders the wrong data.
if (import.meta.env.DEV) {
  const group = (wanted) =>
    Object.entries(PROTOTYPE_FLOWS)
      .filter(([, isMock]) => isMock === wanted)
      .map(([flow]) => flow)
      .join(', ') || 'none';

  console.info(`[mode] fixtures: ${group(true)}\n[mode] live API: ${group(false)}`);
}
