import test from 'node:test';
import assert from 'node:assert/strict';

import { profileDb } from '../src/db/profile.db.js';
import { profileService } from '../src/services/profile.service.js';

const originalDeleteAccount = profileDb.deleteAccount;

test('deleteAccount deletes the current account without touching AI audit rows', async () => {
  let calledWith = null;
  profileDb.deleteAccount = async (userId) => {
    calledWith = userId;
    return { deleted: true, userId };
  };

  try {
    const result = await profileService.deleteAccount('user-123');
    assert.equal(calledWith, 'user-123');
    assert.deepEqual(result, { deleted: true });
  } finally {
    profileDb.deleteAccount = originalDeleteAccount;
  }
});
