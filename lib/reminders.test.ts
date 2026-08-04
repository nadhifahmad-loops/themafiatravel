import test from 'node:test';
import assert from 'node:assert/strict';
import { getReminderWindow } from './reminders';

test('returns H-3 and H-1 windows for the expected days', () => {
  const now = new Date('2026-08-01T10:00:00.000Z');

  assert.equal(getReminderWindow(new Date('2026-08-04T10:00:00.000Z'), now), 'H-3');
  assert.equal(getReminderWindow(new Date('2026-08-02T10:00:00.000Z'), now), 'H-1');
  assert.equal(getReminderWindow(new Date('2026-08-05T10:00:00.000Z'), now), null);
});
