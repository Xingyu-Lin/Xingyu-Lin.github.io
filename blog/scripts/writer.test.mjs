import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, access, rm } from 'node:fs/promises';
import { request } from 'node:http';
import { once } from 'node:events';
import path from 'node:path';
import os from 'node:os';
import { blogRoot } from './build.mjs';

test('local workspace opens without login, protects against cross-site requests, and preserves publishing and archives', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'xingyu-admin-test-'));
  await writeFile(path.join(directory, '.admin-password'), 'An existing password file is no longer used.');
  const port = 19000 + Math.floor(Math.random() * 1000);
  const server = spawn(process.execPath, [path.join(blogRoot, 'scripts/writer.mjs')], { env: { ...process.env, BLOG_LIBRARY_DIR: directory, PORT: String(port), BLOG_WRITER_PORT: String(port), BLOG_ORIGIN: `http://127.0.0.1:${port}`, BLOG_PUBLISH_GIT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => { server.kill(); await once(server, 'exit'); await rm(directory, { recursive: true, force: true }); });
  await Promise.race([once(server.stdout, 'data'), once(server, 'exit').then(() => { throw new Error('Server exited before listening.'); }), new Promise((_, reject) => { const timeout = setTimeout(() => reject(new Error('Startup timed out.')), 5000); timeout.unref(); })]);
  const origin = `http://127.0.0.1:${port}`;
  assert.equal((await fetch(`${origin}/api/posts`)).status, 200);
  assert.equal((await fetch(`${origin}/api/deployment`)).status, 200);
  const connection = await fetch(`${origin}/api/session`);
  assert.equal(connection.headers.get('set-cookie'), null);
  assert.equal(connection.headers.get('access-control-allow-origin'), null);
  const session = await connection.json();
  assert.match(session.token, /^[a-f0-9]{64}$/);
  const headers = { 'Content-Type': 'application/json', 'X-Writing-Token': session.token };
  for (const route of ['/admin', '/admin/', '/write', '/write/', '/blog/admin']) {
    const redirect = await fetch(origin + route, { redirect: 'manual' });
    assert.equal(redirect.status, 303); assert.equal(redirect.headers.get('location'), '/blog/');
  }
  const admin = await fetch(`${origin}/blog/`);
  assert.equal(admin.status, 200); assert.equal(admin.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.match(admin.headers.get('content-security-policy'), /script-src 'self'/);
  const workspace = await admin.text();
  assert.match(workspace, /data-folder="live"/); assert.match(workspace, /data-folder="drafts"/); assert.match(workspace, /data-folder="archived"/);
  assert.match(workspace, /id="new-post"[^>]*>Write/); assert.match(workspace, /id="post-body"/);
  assert.doesNotMatch(workspace, /href="\/write"|id="posts-dialog"|<select id="visibility"|Sign in|Sign out|login-form|password|logout/);
  assert.match(workspace, /<dialog id="publish-dialog"[\s\S]*name="visibility"/);
  const publicIndex = await readFile(path.join(blogRoot, 'index.html'), 'utf8');
  assert.doesNotMatch(publicIndex, /post-folders|post-body|new-post|publish-dialog/);
  for (const route of ['/api/session', '/api/posts', '/api/archive', '/api/deployment', '/blog/']) {
    for (const site of ['cross-site', 'same-site']) assert.equal((await fetch(origin + route, { headers: { 'Sec-Fetch-Site': site } })).status, 403);
    assert.equal((await fetch(origin + route, { headers: { Origin: 'https://example.com' } })).status, 403);
  }
  const badHost = await new Promise((resolve, reject) => {
    const req = request(`${origin}/api/session`, { headers: { Host: 'attacker.example' } }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject); req.end();
  });
  assert.equal(badHost, 403);
  const send = async (route, value, extra = {}) => fetch(`${origin}/api/${route}`, { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify(value) });
  assert.equal((await send('sync', {}, { 'X-Writing-Token': 'wrong' })).status, 403);
  assert.equal((await send('sync', {}).then(r => r.json())).state, 'disabled');
  const post = { title: 'Private test', body: '## Notes\n\nSecret text.' };
  assert.equal((await send('save', post, { Origin: 'https://example.com' })).status, 403);
  assert.equal((await send('save', post, { 'X-Writing-Token': 'wrong' })).status, 403);
  assert.equal((await send('save', post, { 'X-Writing-Token': '' })).status, 403);
  assert.equal((await send('save', post, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  let draft = await send('save', post).then(r => r.json());
  assert.equal(draft.post.date, undefined);
  assert.match(await readFile(path.join(directory, 'drafts/private-test.md'), 'utf8'), /draft: true/);
  await assert.rejects(access(path.join(blogRoot, 'private-test.html')));
  const stale = { ...draft.post, title: 'Stale' };
  draft = await send('save', { ...draft.post, body: 'Updated secret.' }).then(r => r.json());
  assert.equal((await send('save', stale)).status, 409);
  const published = await send('publish', { ...draft.post, visibility: 'private' }).then(r => r.json());
  assert.equal(published.post.visibility, 'private'); assert.match(published.post.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(await fetch(origin + published.url).then(r => r.text()), /Updated secret/);
  assert.equal((await fetch(origin + published.url, { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  assert.equal((await fetch(origin + '/blog/private-test.html')).status, 404);
  assert.equal((await fetch(origin + '/blog/_content/sample-post.md')).status, 404);
  assert.equal((await fetch(origin + '/blog/scripts/writer.mjs')).status, 404);
  assert.equal((await fetch(origin + '/admin-assets/login.js')).status, 404);
  const publicPost = await send('publish', { title: 'Public test', body: 'Readable.', visibility: 'public', date: '1999-01-01' }).then(r => r.json());
  assert.notEqual(publicPost.post.date, '1999-01-01');
  assert.match(await fetch(origin + publicPost.url).then(r => r.text()), /Readable/);
  assert.equal(publicPost.post.readOnly, true);
  assert.equal((await send('save', { ...publicPost.post, body: 'Unpublished changes.' })).status, 409);
  assert.equal((await send('publish', { ...publicPost.post, body: 'Revised.', visibility: 'public' })).status, 409);
  assert.match(await fetch(origin + publicPost.url).then(r => r.text()), /Readable/);
  assert.equal((await send('archive', publicPost.post, { 'X-Writing-Token': 'wrong' })).status, 403);
  const deleted = await send('archive', publicPost.post).then(r => r.json());
  assert.equal(deleted.post.archived, true);
  assert.equal((await fetch(origin + publicPost.url)).status, 404);
  assert.equal((await fetch(origin + '/api/posts').then(r => r.json())).some(post => post.slug === publicPost.post.slug), false);
  assert.match(await readFile(path.join(directory, 'archive/public-test/post.md'), 'utf8'), /Readable/);
  const archives = await fetch(origin + '/api/archive', { headers }).then(r => r.json());
  assert.equal(archives[0].slug, 'public-test');
  const restored = await send('restore', deleted.post).then(r => r.json());
  assert.equal(restored.post.readOnly, true);
  assert.match(await fetch(origin + publicPost.url).then(r => r.text()), /Readable/);
  assert.equal((await send('save', restored.post)).status, 409);
  const privateArchive = await send('archive', published.post).then(r => r.json());
  assert.equal((await fetch(origin + published.url, { headers })).status, 404);
  const privateRestore = await send('restore', privateArchive.post).then(r => r.json());
  assert.equal(privateRestore.post.visibility, 'private');
  assert.equal((await fetch(origin + published.url)).status, 200);
  const legacy = (await fetch(origin + '/api/posts', { headers }).then(r => r.json())).find(post => post.slug === 'sample-post');
  await send('archive', legacy);
  for (const url of ['/blog/sample-post.html', '/blog//sample-post.html', '/BLOG/SAMPLE-POST.HTML']) assert.equal((await fetch(origin + url)).status, 404);
  assert.equal((await fetch(origin + '/api/auth')).status, 404);
  assert.equal((await send('login', {})).status, 404);
  assert.equal((await send('logout', {})).status, 404);
  assert.equal(await readFile(path.join(directory, '.admin-password'), 'utf8'), 'An existing password file is no longer used.');
});

test('password-free writer refuses a network or public origin', async () => {
  for (const origin of ['http://0.0.0.0:8099', 'https://example.com']) {
    const child = spawn(process.execPath, [path.join(blogRoot, 'scripts/writer.mjs')], { env: { ...process.env, BLOG_ORIGIN: origin, BLOG_PUBLISH_GIT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let error = ''; child.stderr.on('data', chunk => { error += chunk; });
    const [code] = await once(child, 'exit');
    assert.equal(code, 1);
    assert.match(error, /Write Blog runs only on this computer/);
  }
});
