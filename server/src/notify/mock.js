import { isDevelopment } from '../config/env.js';

/**
 * Mock delivery provider for SMS and email.
 *
 * CLAUDE.md requires this be testable end to end, so it does two things rather
 * than one: it prints the code to the console for a human running the dev
 * server, and it keeps the last N messages in an in-memory outbox that tests
 * (and the dev-only inspection route) can read back. A stub that only
 * console.log'd would make the OTP flow impossible to assert on.
 *
 * The outbox is per-process and deliberately not persisted.
 */

const MAX_OUTBOX = 50;
const outbox = [];

const record = (entry) => {
  const message = { id: `mock_${Date.now()}_${outbox.length}`, sentAt: new Date().toISOString(), ...entry };
  outbox.unshift(message);
  if (outbox.length > MAX_OUTBOX) outbox.length = MAX_OUTBOX;
  return message;
};

const BANNER_WIDTH = 44;

const banner = (channel, to, code) => {
  // Loud on purpose: this is how a developer gets the code during signup.
  const line = (text) => `  │ ${text.padEnd(BANNER_WIDTH).slice(0, BANNER_WIDTH)} │`;
  const rule = (left, right) => `  ${left}${'─'.repeat(BANNER_WIDTH + 2)}${right}`;

  console.log(
    [
      '',
      rule('┌', '┐'),
      line(`${channel.toUpperCase()} to ${to}`),
      line(`code: ${code}`),
      rule('└', '┘'),
      '',
    ].join('\n'),
  );
};

export const createMockNotifier = () => ({
  name: 'mock',

  async sendSms({ to, body, code = null }) {
    if (isDevelopment && code) banner('sms', to, code);
    return { ok: true, providerMessageId: record({ channel: 'sms', to, body, code }).id };
  },

  async sendEmail({ to, subject, body, code = null }) {
    if (isDevelopment && code) banner('email', to, code);
    return { ok: true, providerMessageId: record({ channel: 'email', to, subject, body, code }).id };
  },

  /** Test/dev helpers — not part of the provider contract the app depends on. */
  outbox: {
    all: () => [...outbox],
    latest: (predicate) => (predicate ? outbox.find(predicate) : outbox[0]) ?? null,
    latestFor: (to) => outbox.find((m) => m.to === to) ?? null,
    clear: () => {
      outbox.length = 0;
    },
  },
});
