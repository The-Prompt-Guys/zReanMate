import { env } from '../config/env.js';
import { createMockNotifier } from './mock.js';

/**
 * The only entry point for OTP and email delivery.
 *
 * Same mock-fallback shape as the AI layer: no provider credentials means the
 * mock, plus one warning at boot. When a real SMS/email provider is chosen,
 * add ./<provider>.js exporting the same { sendSms, sendEmail } surface and
 * select it here — nothing upstream changes.
 */

let notifier = null;
let warned = false;

const hasRealProvider = () => Boolean(env.smsProvider || env.emailProvider);

const buildNotifier = () => {
  if (!hasRealProvider()) {
    if (!warned) {
      console.warn(
        '[notify] No SMS or email provider configured — using the mock notifier. ' +
          'Codes are printed to this console and kept in an in-memory outbox.',
      );
      warned = true;
    }
    return createMockNotifier();
  }

  // No real provider is implemented yet; the branch exists so wiring one is a
  // single import rather than a refactor.
  if (!warned) {
    console.warn(
      `[notify] Provider "${env.smsProvider ?? env.emailProvider}" is configured but not ` +
        'implemented yet — using the mock notifier',
    );
    warned = true;
  }
  return createMockNotifier();
};

export const getNotifier = () => {
  notifier ??= buildNotifier();
  return notifier;
};

export const isMockNotifier = () => getNotifier().name === 'mock';

export const resetNotifier = () => {
  notifier = null;
  warned = false;
};
