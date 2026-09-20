import { readdir, readFile, writeFile, mkdir, rename, rm, cp, stat } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { stringify } from 'yaml';
import { parsePost, renderMarkdown, slugify, validSlug } from './render.mjs';
const revision = post => createHash('sha256').update(JSON.stringify(post)).digest('hex');
const source = post => {
  const { body, revision, hasPublicVersion, readOnly, archived, ...metadata } = post;
  return `---\n${stringify(metadata)}---\n\n${body.trim()}\n`;
};
const view = (post, archived = false) => {
  const value = { ...post, archived, readOnly: archived || post.visibility !== 'draft' };
  return { ...value, revision: revision(value) };
};
const conflict = message => Object.assign(new Error(message), { status: 409 });

export function createStore({ directory, publicDirectory, now = () => new Date() }) {
  const archiveDirectory = path.join(directory, 'archive');
  async function readPost(file, filename) {
    const post = parsePost(await readFile(file, 'utf8'), filename);
    if (post.draft && !post.createdAt) {
      // Older drafts did not record their start time. Keep the earliest known
      // timestamp until the next save persists it as createdAt.
      const info = await stat(file);
      const timestamps = [post.date, post.updatedAt, info.birthtimeMs > 0 ? info.birthtime : undefined, info.mtime]
        .filter(Boolean).map(value => new Date(value).getTime()).filter(Number.isFinite);
      post.createdAt = new Date(Math.min(...timestamps)).toISOString();
    }
    return post;
  }
  async function read(directory) {
    const files = await readdir(directory).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
    return Promise.all(files.filter(name => name.endsWith('.md')).map(name => readPost(path.join(directory, name), name)));
  }
  async function archived() {
    const entries = await readdir(archiveDirectory, { withFileTypes: true }).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
    const posts = await Promise.all(entries.filter(entry => entry.isDirectory() && validSlug(entry.name)).map(async entry => {
      const post = await readPost(path.join(archiveDirectory, entry.name, 'post.md'));
      if (post.slug !== entry.name) throw new Error('Archive folder does not match its post.');
      return view(post, true);
    }));
    return posts.sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
  }
  async function published() {
    const hidden = new Set((await archived()).map(post => post.slug));
    const posts = new Map((await read(publicDirectory)).filter(post => !post.draft && post.visibility !== 'private').map(post => [post.slug, { ...post, visibility: 'public' }]));
    for (const post of await read(path.join(directory, 'posts'))) posts.set(post.slug, post);
    return [...posts.values()].filter(post => !hidden.has(post.slug));
  }
  async function list() {
    const hidden = new Set((await archived()).map(post => post.slug));
    const posts = new Map();
    // Retain older local drafts, but always show the immutable published version
    // when a pre-existing edit draft shares its URL. Both are kept when archived.
    for (const post of [...await read(directory), ...await read(path.join(directory, 'drafts'))]) posts.set(post.slug, { ...post, visibility: 'draft' });
    for (const post of await published()) posts.set(post.slug, post);
    return [...posts.values()].filter(post => !hidden.has(post.slug)).map(post => view(post)).sort((a, b) => (b.updatedAt || b.date || '').localeCompare(a.updatedAt || a.date || ''));
  }
  function check(input, posts) {
    const post = validSlug(input.slug || '') && posts.find(post => post.slug === input.slug);
    if (!post) throw conflict('Post no longer available here. Reopen Posts or Archive.');
    if (input.revision !== post.revision) throw conflict('This post changed in another window. Reopen it before continuing.');
    return post;
  }
  async function writeAtomic(folder, post) {
    await mkdir(folder, { recursive: true, mode: 0o700 });
    const file = path.join(folder, `${post.slug}.md`);
    const temp = `${file}.${randomBytes(8).toString('hex')}.tmp`;
    await writeFile(temp, source(post), { mode: 0o600 });
    await rename(temp, file);
  }
  async function save(input, visibility = 'draft') {
    if (!['draft', 'private', 'public'].includes(visibility)) throw new Error('Choose public or private.');
    const posts = await list();
    const existing = input.slug ? check(input, posts) : null;
    if (existing?.readOnly) throw conflict('Published posts cannot be edited. You can move this post to Archive.');
    let slug = existing?.slug || slugify(String(input.title || '')).slice(0, 100) || `post-${randomBytes(4).toString('hex')}`;
    if (!existing) {
      // An archived URL stays reserved so deletion never silently revives an old link.
      const reserved = new Set([...posts, ...await archived()].map(post => post.slug));
      const base = validSlug(slug) ? slug : `post-${slug}`;
      slug = base;
      for (let n = 2; reserved.has(slug); n++) slug = `${base}-${n}`;
    }
    const timestamp = now().toISOString();
    const date = visibility === 'draft' ? undefined : timestamp.slice(0, 10);
    const post = parsePost(source({ title: String(input.title || '').trim(), slug, ...(date ? { date } : {}), draft: visibility === 'draft', visibility, createdAt: existing?.createdAt || timestamp, updatedAt: timestamp, body: String(input.body || '') }));
    if (visibility !== 'draft' && (!post.title || !post.body.trim())) throw new Error('Add a title and some writing first.');
    if (post.title.length > 300) throw new Error('Keep the title under 300 characters.');
    if (visibility !== 'draft') renderMarkdown(post);
    await writeAtomic(path.join(directory, visibility === 'draft' ? 'drafts' : 'posts'), post);
    await rm(path.join(directory, `${slug}.md`), { force: true });
    if (visibility !== 'draft') await rm(path.join(directory, 'drafts', `${slug}.md`), { force: true });
    return (await list()).find(item => item.slug === slug);
  }
  async function archive(input) {
    const post = check(input, await list());
    await mkdir(archiveDirectory, { recursive: true, mode: 0o700 });
    const staging = path.join(archiveDirectory, `.${post.slug}-${randomBytes(8).toString('hex')}`);
    await mkdir(staging, { mode: 0o700 });
    try {
      await writeFile(path.join(staging, 'post.md'), source({ ...post, archivedAt: now().toISOString() }), { mode: 0o600 });
      // Preserve any older unpublished edits as well as the published article.
      for (const [original, backup] of [[path.join(directory, 'drafts', `${post.slug}.md`), 'draft.md'], [path.join(directory, `${post.slug}.md`), 'legacy-draft.md']]) {
        await cp(original, path.join(staging, backup)).catch(error => { if (error.code !== 'ENOENT') throw error; });
      }
      // Publishing and listing ignore this slug as soon as the complete archive
      // folder is visible. A crash during cleanup cannot expose it again.
      await rename(staging, path.join(archiveDirectory, post.slug));
    } catch (error) { await rm(staging, { recursive: true, force: true }); throw error; }
    for (const folder of [directory, path.join(directory, 'drafts'), path.join(directory, 'posts')]) await rm(path.join(folder, `${post.slug}.md`), { force: true });
    return (await archived()).find(item => item.slug === post.slug);
  }
  async function restore(input) {
    const post = check(input, await archived());
    const { archivedAt, ...restored } = post;
    const folder = path.join(archiveDirectory, post.slug);
    await writeAtomic(path.join(directory, post.visibility === 'draft' ? 'drafts' : 'posts'), restored);
    // Older edit drafts remain preserved, but cannot alter a published article.
    if (post.visibility !== 'draft') {
      for (const [backup, destination] of [['draft.md', path.join(directory, 'drafts')], ['legacy-draft.md', directory]]) {
        const contents = await readFile(path.join(folder, backup)).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
        if (contents !== null) { await mkdir(destination, { recursive: true, mode: 0o700 }); await writeFile(path.join(destination, `${post.slug}.md`), contents, { mode: 0o600 }); }
      }
    }
    const completed = path.join(archiveDirectory, `.restored-${post.slug}-${randomBytes(8).toString('hex')}`);
    await rename(folder, completed);
    await rm(completed, { recursive: true, force: true });
    return (await list()).find(item => item.slug === post.slug);
  }
  return { list, save, published, archived, archive, restore };
}
