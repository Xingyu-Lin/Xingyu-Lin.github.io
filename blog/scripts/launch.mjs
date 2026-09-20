import { spawn, execFile } from 'node:child_process';
import { mkdir, open } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { application, repoRoot, workspaceId, libraryDirectory } from './local-config.mjs';

export async function ensureServer({ port = Number(process.env.BLOG_WRITER_PORT || 8080), directory = libraryDirectory(), env = {} } = {}) {
  const origin = `http://127.0.0.1:${port}`;
  async function probe() {
    let response;
    try { response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1200) }); }
    catch (error) {
      if (error.cause?.code === 'ECONNREFUSED') return null;
      throw new Error(`Port ${port} is not responding. Close the old blog server and open Write Blog again.`);
    }
    const health = await response.json().catch(() => null);
    if (!response.ok || health?.application !== application || health.workspace !== workspaceId) {
      throw new Error(`Port ${port} is being used by another app or an older blog server. Close that server and open Write Blog again.`);
    }
    return { url: `${origin}/blog/`, pid: health.pid };
  }
  const existing = await probe();
  if (existing) return { ...existing, started: false };
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const logPath = path.join(directory, 'server.log');
  const log = await open(logPath, 'a', 0o600);
  let child;
  try {
    child = spawn(process.execPath, [path.join(repoRoot, 'blog/scripts/writer.mjs')], {
      cwd: repoRoot, detached: true, stdio: ['ignore', log.fd, log.fd],
      env: { ...process.env, ...env, BLOG_LIBRARY_DIR: directory, PORT: String(port), BLOG_WRITER_PORT: String(port), BLOG_ORIGIN: origin }
    });
  } finally { await log.close(); }
  let failed = false;
  child.on('error', () => { failed = true; });
  child.unref();
  // Concurrent launches may race to bind; both open the one successful server.
  for (let attempt = 0; attempt < 60; attempt++) {
    await delay(200);
    const ready = await probe();
    if (ready) return { ...ready, started: ready.pid === child.pid };
    if (failed || child.exitCode !== null) break;
  }
  throw new Error(`The blog server could not start. Details are in ${logPath}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const server = await ensureServer();
    if (!process.argv.includes('--no-open')) await promisify(execFile)('/usr/bin/open', [server.url]);
    console.log(`${server.started ? 'Started' : 'Opened'} Write Blog: ${server.url}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
