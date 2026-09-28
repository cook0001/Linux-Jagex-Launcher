import test from 'node:test';
import assert from 'node:assert';
import { checkMembershipStatus } from '../src/main/membership.ts';

test('Membership resolution logic', async (t) => {
  await t.test('explicit isMember: true returns true', async () => {
    const isMember = await checkMembershipStatus('TestChar', { isMember: true, membership: [] });
    assert.strictEqual(isMember, true);
  });

  await t.test('explicit isMember: false returns false', async () => {
    const isMember = await checkMembershipStatus('TestChar', { isMember: false, membership: [] });
    assert.strictEqual(isMember, false);
  });

  await t.test('active membership array returns true', async () => {
    const isMember = await checkMembershipStatus('TestChar', { membership: ['RS_MEMBERSHIP_ACTIVE'] });
    assert.strictEqual(isMember, true);
  });

  await t.test('empty character name with empty membership returns false', async () => {
    const isMember = await checkMembershipStatus('', { membership: [] });
    assert.strictEqual(isMember, false);
  });

  await t.test('generic Character placeholder with empty membership returns false', async () => {
    const isMember = await checkMembershipStatus('Character', { membership: [] });
    assert.strictEqual(isMember, false);
  });

  await t.test('non-existent character name with empty membership defaults to false (F2P)', async () => {
    const isMember = await checkMembershipStatus('NonExistentFakeCharacter12345XYZ', { membership: [] }, 500);
    assert.strictEqual(isMember, false);
  });
});
