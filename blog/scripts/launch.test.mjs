import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { once } from 'node:events';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { ensureServer } from './launch.mjs';

test('launcher starts a detached local server, reuses it, and refuses an unrelated server', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'xingyu-launch-test-'));
  const occupied = http.createServer((req, res) => res.end('Another app'));
  occupied.listen(0, '127.0.0.1'); await once(occupied, 'listening');
  const port = occupied.address().port;
  await assert.rejects(ensureServer({ port, directory }), /another app/);
  await new Promise(resolve => occupied.close(resolve));
  let started;
  t.after(async () => {
    if (started) process.kill(started.pid, 'SIGTERM');
    await delay(100);
    await rm(directory, { recursive: true, force: true });
  });
  started = await ensureServer({ port, directory, env: { BLOG_PUBLISH_GIT: '0' } });
  assert.equal(started.started, true);
  assert.equal((await fetch(started.url)).status, 200);
  assert.match(await fetch(started.url).then(response => response.text()), /id="new-post"/);
  assert.equal(new URL(started.url).pathname, '/blog/');
  await assert.rejects(access(path.join(directory, '.admin-password')));
  const again = await ensureServer({ port, directory });
  assert.equal(again.started, false);
  assert.equal(again.pid, started.pid);
  assert.equal(again.url, started.url);
});
