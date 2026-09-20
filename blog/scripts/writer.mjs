import http from 'node:http';
import { readFile, stat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { blogRoot } from './build.mjs';
import { articlePage, indexPage } from './templates.mjs';
import { renderMarkdown } from './render.mjs';
import { loginPage, adminBlogPage } from './admin-pages.mjs';
import { createAuth } from './auth.mjs';
import { createStore } from './store.mjs';
import { createPublisher } from './publisher.mjs';
import { application, repoRoot, workspaceId, libraryDirectory } from './local-config.mjs';

const directory = libraryDirectory();
const port = Number(process.env.PORT || process.env.BLOG_WRITER_PORT || 8080);
const origin = new URL(process.env.BLOG_ORIGIN || `http://127.0.0.1:${port}`);
const secure = origin.protocol === 'https:';
const local = ['127.0.0.1', 'localhost'].includes(origin.hostname);
if (!local && !secure) throw new Error('The online admin requires an HTTPS BLOG_ORIGIN.');
const auth = createAuth({ directory, secure, allowSetup: local, configuredHash: process.env.ADMIN_PASSWORD_HASH });
const store = createStore({ directory, publicDirectory: path.join(blogRoot, '_content') });
const publisher = createPublisher({ repoRoot, directory, store, enabled: local && process.env.BLOG_PUBLISH_GIT !== '0' });
let writing = false;
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.bib': 'text/plain' };
function json(res, status, value) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); }
function html(res, value) { res.writeHead(200, { 'Content-Type': mime['.html'] }); res.end(value); }
function redirect(res, location) { res.writeHead(303, { Location: location }); res.end(); }
async function body(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new Error('Expected JSON.');
  let value = ''; for await (const chunk of req) { value += chunk; if (value.length > 2_000_000) throw new Error('This post is too large.'); }
  return JSON.parse(value);
}
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Cache-Control', 'no-store');
  if (req.headers.host !== origin.host || req.headers.origin && req.headers.origin !== origin.origin) return json(res, 403, { error: 'Use this website’s own address.' });
  try {
    const url = new URL(req.url, origin);
    const route = path.posix.normalize(decodeURIComponent(url.pathname));
    const session = auth.session(req);
    if (route.startsWith('/admin') || route.startsWith('/write') || route.startsWith('/private') || session && ['/blog', '/blog/', '/blog/index.html'].includes(route.toLowerCase())) {
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https: data:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'");
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    }
    if (route.startsWith('/api/')) {
      if (route === '/api/health' && req.method === 'GET') return json(res, 200, { application, workspace: workspaceId, pid: process.pid });
      if (route === '/api/auth' && req.method === 'GET') return json(res, 200, await auth.info(req, res, url.searchParams.get('login') === '1'));
      if (route === '/api/login' && req.method === 'POST') return json(res, 200, await auth.login(req, res, await body(req)));
      if (!session) return json(res, 401, { error: 'Sign in to continue. Your unsaved writing is still in this window.' });
      if (route === '/api/posts' && req.method === 'GET') return json(res, 200, await store.list());
      if (route === '/api/archive' && req.method === 'GET') return json(res, 200, await store.archived());
      if (route === '/api/deployment' && req.method === 'GET') return json(res, 200, await publisher.status());
      if (req.method !== 'POST') return json(res, 405, { error: 'Unsupported request.' });
      if (req.headers['x-writing-token'] !== session.token) return json(res, 403, { error: 'Reload to reconnect securely.' });
      if (route === '/api/logout') { auth.logout(req, res); return json(res, 200, { ok: true }); }
      if (!['/api/save', '/api/publish', '/api/archive', '/api/restore', '/api/sync'].includes(route)) return json(res, 404, { error: 'Not found.' });
      if (writing) return json(res, 503, { error: 'Another save or publication is running. Retrying…' });
      writing = true;
      try {
        const input = await body(req);
        if (route === '/api/sync') return json(res, 200, await publisher.sync());
        if (route === '/api/archive' || route === '/api/restore') {
          const post = await store[route === '/api/archive' ? 'archive' : 'restore'](input);
          const deployment = post.visibility === 'public' ? await publisher.sync() : await publisher.status();
          return json(res, 200, { post, deployment });
        }
        const visibility = route === '/api/save' ? 'draft' : input.visibility;
        if (route === '/api/publish' && !['public', 'private'].includes(visibility)) throw new Error('Choose public or private.');
        const post = await store.save(input, visibility);
        const deployment = visibility === 'public' ? await publisher.sync() : undefined;
        return json(res, 200, { post, deployment, url: visibility === 'public' ? `/blog/${post.slug}.html` : visibility === 'private' ? `/private/${post.slug}` : null });
      } finally { writing = false; }
    }
    if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, { error: 'Unsupported request.' });
    if (['/admin', '/admin/','/blog/admin', '/blog/admin/'].includes(route)) return session ? redirect(res, '/blog/') : html(res, loginPage());
    if (['/write', '/write/'].includes(route)) return redirect(res, session ? '/blog/' : '/admin');
    if (route.startsWith('/private/')) {
      if (!session) return redirect(res, '/admin');
      const post = (await store.published()).find(post => post.slug === route.slice(9) && post.visibility === 'private');
      if (!post) return json(res, 404, { error: 'Not found.' });
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      return html(res, articlePage(post, renderMarkdown(post, 'writer'), false, true));
    }
    if (['/blog', '/blog/', '/blog/index.html'].includes(route.toLowerCase())) {
      if (route === '/blog') return redirect(res, '/blog/');
      if (session) return html(res, adminBlogPage());
      const posts = (await store.published()).filter(post => post.visibility === 'public').sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
      return html(res, indexPage(posts));
    }
    const match = route.toLowerCase().match(/^\/blog\/([a-z0-9-]+)\.html$/);
    if (match) {
      const post = (await store.published()).find(post => post.slug === match[1] && post.visibility === 'public');
      if (!post) return json(res, 404, { error: 'Not found.' });
      return html(res, articlePage(post, renderMarkdown(post)));
    }
    let filename;
    if (route.startsWith('/admin-assets/')) {
      const name = route.slice(14);
      if (!['editor.css', 'editor.bundle.js', 'login.js'].includes(name)) return json(res, 404, { error: 'Not found.' });
      filename = path.join(blogRoot, 'admin', name);
    } else {
      if (route.split('/').some(part => part.startsWith('.') || ['node_modules', 'drafts', '_preview', '_content', 'scripts', 'templates', 'editor', 'admin'].includes(part))) return json(res, 404, { error: 'Not found.' });
      filename = path.resolve(repoRoot, `.${route}`);
      if (filename !== repoRoot && !filename.startsWith(repoRoot + path.sep)) return json(res, 404, { error: 'Not found.' });
      if ((await stat(filename)).isDirectory()) filename = path.join(filename, 'index.html');
    }
    if (!(await realpath(filename)).startsWith(repoRoot + path.sep)) return json(res, 404, { error: 'Not found.' });
    const type = mime[path.extname(filename)];
    if (!type) return json(res, 404, { error: 'Not found.' });
    const content = await readFile(filename);
    res.writeHead(200, { 'Content-Type': type }); res.end(req.method === 'HEAD' ? undefined : content);
  } catch (error) { json(res, error.status || (error.code === 'ENOENT' ? 404 : 400), { error: error.code === 'ENOENT' ? 'Not found.' : error.message }); }
});
server.listen(port, local ? '127.0.0.1' : '0.0.0.0', () => console.log(`Website: ${origin.origin}/\nAdmin: ${origin.origin}/admin\nPrivate data: ${directory}`));
