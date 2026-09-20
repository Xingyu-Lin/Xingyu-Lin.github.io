import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { stringify } from 'yaml';
import { build } from './build.mjs';

const exec = promisify(execFile);
export async function findGit() {
  for (const candidate of [process.env.BLOG_GIT, 'git', '/opt/homebrew/bin/git', path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/git')].filter(Boolean)) {
    try { await exec(candidate, ['--version'], { timeout: 5000 }); return candidate; } catch {}
  }
  throw new Error('Git is unavailable. Install Git, then retry publishing.');
}

export function createPublisher({ repoRoot, directory, store, enabled = true }) {
  const statusFile = path.join(directory, '.publishing.json');
  let running;
  async function status() {
    if (!enabled) return { state: 'disabled' };
    return readFile(statusFile, 'utf8').then(JSON.parse).catch(error => {
      if (error.code === 'ENOENT') return { state: 'idle' };
      throw error;
    });
  }
  async function record(value) {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(`${statusFile}.tmp`, JSON.stringify(value), { mode: 0o600 });
    await rename(`${statusFile}.tmp`, statusFile);
    return value;
  }
  async function deploy() {
    let temporary, checkout, git;
    const run = async (cwd, args) => (await exec(git, args, {
      cwd, timeout: 45000, maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GH_PROMPT_DISABLED: '1' }
    })).stdout.trim();
    try {
      await record({ state: 'pending', message: 'The website has changes waiting to publish.' });
      git = await findGit();
      // Build on the remote branch in isolation. Never stage or push unrelated
      // edits or commits from the owner's working checkout.
      const branch = await run(repoRoot, ['config', '--get', 'branch.master.merge']);
      if (branch !== 'refs/heads/master') throw new Error('The Pages branch is not configured.');
      await run(repoRoot, ['fetch', 'origin', 'refs/heads/master']);
      const base = await run(repoRoot, ['rev-parse', 'FETCH_HEAD']);
      temporary = await mkdtemp(path.join(os.tmpdir(), 'xingyu-publish-'));
      checkout = path.join(temporary, 'site');
      await run(repoRoot, ['worktree', 'add', '--detach', checkout, base]);
      const content = path.join(checkout, 'blog/_content');
      await mkdir(content, { recursive: true });
      // The Markdown in this public folder contains only explicitly public
      // writing. Drafts, private posts, credentials and archives stay on disk.
      for (const post of (await store.published()).filter(post => post.visibility === 'public')) {
        const metadata = { title: post.title, date: post.date, slug: post.slug };
        await writeFile(path.join(content, `${post.slug}.md`), `---\n${stringify(metadata)}---\n\n${post.body.trim()}\n`);
      }
      for (const post of (await store.archived()).filter(post => post.visibility === 'public')) {
        await rm(path.join(content, `${post.slug}.md`), { force: true });
      }
      await build({ root: path.join(checkout, 'blog') });
      await run(checkout, ['add', '-A', '--', 'blog']);
      const changes = await run(checkout, ['diff', '--cached', '--name-only']);
      if (changes) {
        await run(checkout, ['commit', '-m', 'Publish blog updates']);
        // A concurrent remote change safely rejects this push; Retry rebuilds
        // on the new remote head instead of overwriting it.
        await run(checkout, ['push', 'origin', 'HEAD:refs/heads/master']);
      }
      return await record({ state: 'sent', message: 'Sent to GitHub. The live site will update shortly.', updatedAt: new Date().toISOString() });
    } catch {
      // Local publication is already safely stored. Return its new revision
      // even when offline so the editor cannot accidentally republish a copy.
      return record({ state: 'pending', message: 'Saved on this Mac. The live website has not updated. Check your connection and GitHub sign-in, then retry.' });
    } finally {
      if (checkout && git) await run(repoRoot, ['worktree', 'remove', '--force', checkout]).catch(() => {});
      if (temporary) await rm(temporary, { recursive: true, force: true });
    }
  }
  function sync() {
    if (!enabled) return Promise.resolve({ state: 'disabled' });
    if (!running) running = deploy().finally(() => { running = null; });
    return running;
  }
  return { status, sync };
}
