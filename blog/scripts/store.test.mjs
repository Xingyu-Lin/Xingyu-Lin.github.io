import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, access, utimes } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createStore } from './store.mjs';

test('publication sets an automatic date and locks the post; incomplete equations can be drafted', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'xingyu-store-test-'));
  const publicDirectory = path.join(directory, 'source'); await mkdir(publicDirectory);
  let date = new Date('2026-09-18T12:00:00Z');
  const store = createStore({ directory: path.join(directory, 'library'), publicDirectory, now: () => date });
  let post = await store.save({ title: 'Date test', body: 'A draft.' });
  assert.equal(post.date, undefined);
  assert.equal(post.createdAt, '2026-09-18T12:00:00.000Z');
  date = new Date('2026-09-20T12:00:00Z');
  post = await store.save({ ...post, title: 'Updated title', createdAt: '1990-01-01T00:00:00Z' });
  assert.equal(post.createdAt, '2026-09-18T12:00:00.000Z');
  assert.equal(post.updatedAt, '2026-09-20T12:00:00.000Z');
  post = await store.restore(await store.archive(post));
  assert.equal(post.createdAt, '2026-09-18T12:00:00.000Z');
  assert.equal((await store.list())[0].createdAt, post.createdAt);
  date = new Date('2026-10-03T12:00:00Z');
  post = await store.save({ ...post, date: '1990-01-01' }, 'public');
  assert.equal(post.date, '2026-10-03');
  assert.equal(post.createdAt, '2026-09-18T12:00:00.000Z');
  date = new Date('2027-01-01T12:00:00Z');
  await assert.rejects(store.save({ ...post, body: 'Revised.' }, 'public'), /cannot be edited/);
  await assert.rejects(store.save({ ...post, body: 'Revised.' }), /cannot be edited/);
  assert.equal((await store.published())[0].date, '2026-10-03');
  assert.equal((await store.published())[0].body.trim(), 'A draft.');
  const unfinished = await store.save({ title: 'Equation', body: '$\\notfinished$' });
  await assert.rejects(store.save(unfinished, 'public'), /invalid math/);
  assert.equal((await store.list()).find(item => item.slug === unfinished.slug).body.trim(), '$\\notfinished$');
});

test('older drafts use their earliest known date and preserve it on the next save', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'xingyu-draft-date-test-'));
  const publicDirectory = path.join(directory, 'source'); await mkdir(publicDirectory);
  const library = path.join(directory, 'library'); await mkdir(path.join(library, 'drafts'), { recursive: true });
  const file = path.join(library, 'drafts/older.md');
  await writeFile(file, '---\ntitle: Older draft\nslug: older\ndraft: true\nupdatedAt: "2024-05-09T12:00:00.000Z"\n---\nSome writing.\n');
  await utimes(file, new Date('2024-05-08T12:00:00Z'), new Date('2024-05-08T12:00:00Z'));
  const store = createStore({ directory: library, publicDirectory, now: () => new Date('2026-09-19T12:00:00Z') });
  const older = (await store.list())[0];
  assert.equal(older.createdAt, '2024-05-08T12:00:00.000Z');
  const saved = await store.save({ ...older, body: 'Continued writing.' });
  assert.equal(saved.createdAt, older.createdAt);
  assert.match(await readFile(file, 'utf8'), /createdAt: 2024-05-08T12:00:00.000Z/);
  const reopened = createStore({ directory: library, publicDirectory });
  assert.equal((await reopened.list())[0].createdAt, older.createdAt);
});

test('autosave retains title-only, untitled and cleared drafts while publishing still requires content', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'xingyu-partial-draft-test-'));
  const publicDirectory = path.join(directory, 'source'); await mkdir(publicDirectory);
  const store = createStore({ directory: path.join(directory, 'library'), publicDirectory });
  let titleOnly = await store.save({ title: 'An idea', body: '' });
  assert.equal(titleOnly.title, 'An idea'); assert.equal(titleOnly.body.trim(), '');
  await assert.rejects(store.save(titleOnly, 'public'));
  let untitled = await store.save({ title: '', body: 'Remember this thought.' });
  assert.equal(untitled.title, ''); assert.equal(untitled.body.trim(), 'Remember this thought.');
  await assert.rejects(store.save(untitled, 'public'));
  untitled = await store.save({ ...untitled, title: '', body: '' });
  const reopened = (await store.list()).find(post => post.slug === untitled.slug);
  assert.equal(reopened.body.trim(), ''); assert.equal(reopened.title, '');
  assert.equal((await store.published()).length, 0);
});


test('Delete moves published posts to a persistent archive and restore keeps them immutable', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'xingyu-archive-test-'));
  const publicDirectory = path.join(directory, 'source'); await mkdir(publicDirectory);
  const library = path.join(directory, 'library');
  let store = createStore({ directory: library, publicDirectory });
  const post = await store.save({ title: 'Keep this', body: 'Original writing.' }, 'public');
  const archived = await store.archive(post);
  assert.equal(archived.archived, true); assert.equal(archived.readOnly, true);
  assert.equal((await store.list()).length, 0); assert.equal((await store.published()).length, 0);
  assert.match(await readFile(path.join(library, 'archive/keep-this/post.md'), 'utf8'), /Original writing/);
  await assert.rejects(access(path.join(library, 'posts/keep-this.md')));
  await assert.rejects(store.save({ ...post, body: 'Stale edit' }));
  await assert.rejects(store.restore({ ...archived, revision: 'stale' }));
  const other = await store.save({ title: 'Keep this', body: 'New draft.' });
  assert.equal(other.slug, 'keep-this-2');
  store = createStore({ directory: library, publicDirectory });
  assert.equal((await store.published()).length, 0);
  const restored = await store.restore((await store.archived())[0]);
  assert.equal(restored.date, post.date); assert.equal(restored.body, post.body);
  assert.equal(restored.readOnly, true); assert.equal(restored.archived, false);
  assert.equal((await store.archived()).length, 0);
  assert.equal((await store.published()).length, 1);
  await assert.rejects(store.save({ ...restored, title: 'Changed title' }), /cannot be edited/);
});

test('archived drafts restore as editable; private publications remain locked and private', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'xingyu-archive-types-test-'));
  const publicDirectory = path.join(directory, 'source'); await mkdir(publicDirectory);
  const store = createStore({ directory: path.join(directory, 'library'), publicDirectory });
  let draft = await store.save({ title: '', body: 'Unfinished.' });
  draft = await store.restore(await store.archive(draft));
  assert.equal(draft.readOnly, false); assert.equal(draft.title, '');
  draft = await store.save({ ...draft, title: 'Finished' });
  const privatePost = await store.save(draft, 'private');
  await assert.rejects(store.save({ ...privatePost, visibility: 'public' }, 'public'), /cannot be edited/);
  const restored = await store.restore(await store.archive(privatePost));
  assert.equal(restored.visibility, 'private'); assert.equal(restored.readOnly, true);
});

test('legacy public posts disappear when archived and older draft copies are preserved', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'xingyu-legacy-archive-test-'));
  const publicDirectory = path.join(directory, 'source'); await mkdir(publicDirectory);
  const library = path.join(directory, 'library'); await mkdir(path.join(library, 'drafts'), { recursive: true });
  const markdown = '---\ntitle: Legacy\nslug: legacy\ndate: "2024-05-08"\ndraft: false\n---\nOriginal public text.\n';
  await writeFile(path.join(publicDirectory, 'legacy.md'), markdown);
  await writeFile(path.join(library, 'drafts/legacy.md'), markdown.replace('draft: false', 'draft: true').replace('Original public text.', 'Older unpublished edit.'));
  const store = createStore({ directory: library, publicDirectory });
  const post = (await store.list())[0];
  assert.match(post.body, /Original public/); assert.equal(post.readOnly, true);
  const archived = await store.archive(post);
  assert.equal((await store.published()).length, 0);
  assert.match(await readFile(path.join(library, 'archive/legacy/draft.md'), 'utf8'), /Older unpublished edit/);
  assert.equal(await readFile(path.join(publicDirectory, 'legacy.md'), 'utf8'), markdown);
  await store.restore(archived);
  assert.match((await store.list())[0].body, /Original public/);
  assert.match(await readFile(path.join(library, 'drafts/legacy.md'), 'utf8'), /Older unpublished edit/);
});
