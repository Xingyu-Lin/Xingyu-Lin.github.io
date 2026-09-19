import { readdir, readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePost, renderMarkdown, validSlug } from './render.mjs';
import { indexPage, articlePage } from './templates.mjs';

export const blogRoot = fileURLToPath(new URL('../', import.meta.url));

export async function build({ root = blogRoot, drafts = false } = {}) {
  const posts = [];
  for (const folder of drafts ? ['_content', 'drafts'] : ['_content']) {
    const directory = path.join(root, folder);
    const entries = await readdir(directory).catch(error => {
      if (error.code === 'ENOENT') return [];
      throw error;
    });
    for (const filename of entries.filter(name => name.endsWith('.md')).sort()) {
      const post = parsePost(await readFile(path.join(directory, filename), 'utf8'), `${folder}/${filename}`);
      if (folder === 'drafts') post.draft = true;
      if (post.draft && !drafts) continue;
      if (posts.some(other => other.slug === post.slug)) throw new Error(`Duplicate post slug: ${post.slug}`);
      posts.push(post);
    }
  }
  posts.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
  // Render everything before touching generated output, so invalid Markdown cannot erase a post.
  const pages = new Map([['index.html', indexPage(posts, drafts)]]);
  for (const post of posts) pages.set(`${post.slug}.html`, articlePage(post, renderMarkdown(post, drafts), drafts));

  const output = drafts ? path.join(root, '_preview') : root;
  await mkdir(output, { recursive: true });
  const manifestPath = path.join(output, '.generated.json');
  const previous = await readFile(manifestPath, 'utf8').then(JSON.parse).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  if (!Array.isArray(previous) || previous.some(name => typeof name !== 'string' || (name !== 'index.html' && (!name.endsWith('.html') || !validSlug(name.slice(0, -5)))))) throw new Error('Invalid generated-file manifest. No files changed.');

  const katexDist = fileURLToPath(new URL('../node_modules/katex/dist/', import.meta.url));
  const mathAssets = path.join(root, 'assets/katex');
  await mkdir(mathAssets, { recursive: true });
  await cp(path.join(katexDist, 'katex.min.css'), path.join(mathAssets, 'katex.min.css'));
  await cp(path.join(katexDist, 'fonts'), path.join(mathAssets, 'fonts'), { recursive: true });
  await cp(path.join(katexDist, '../LICENSE'), path.join(mathAssets, 'LICENSE'));
  for (const [filename, html] of pages) await writeFile(path.join(output, filename), html);
  for (const filename of previous) {
    if (!pages.has(filename)) await rm(path.join(output, filename), { force: true });
  }
  await writeFile(manifestPath, JSON.stringify([...pages.keys()], null, 2) + '\n');
  return { posts: posts.length, output, pages: [...pages.keys()] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--drafts')) {
    console.error('Usage: npm --prefix blog run build [-- --drafts]');
    process.exitCode = 1;
  } else {
    try {
      const result = await build({ drafts: args.includes('--drafts') });
      console.log(`Built ${result.posts} post(s) in ${result.output}`);
      if (args.includes('--drafts')) console.log('Preview: http://127.0.0.1:8080/blog/_preview/ (run the local server first).');
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
