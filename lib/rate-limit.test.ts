import test from 'node:test';
import assert from 'node:assert/strict';
test('rate limiter: memory path blocks after quota, redis error does not block', async () => {
  delete process.env.REDIS_URL;
  const { checkRateLimit } = await import('./rate-limit');
  const r: boolean[] = [];
  for (let i = 0; i < 7; i++) r.push((await checkRateLimit('t1', 'auth')).allowed);
  assert.deepEqual(r, [true,true,true,true,true,false,false]);
});
