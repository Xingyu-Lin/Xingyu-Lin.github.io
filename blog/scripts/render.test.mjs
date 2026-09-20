import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parsePost, renderMarkdown } from './render.mjs';
import { build } from './build.mjs';

const input = (overrides = '', body = '## Introduction\n\nHello.') => `---\ntitle: Example\ndate: "2026-09-18"\nslug: example\n${overrides}---\n${body}`;

test('Markdown renders math, highlighted code, tables and usable footnote anchors', () => {
  const post = parsePost(input('', '## Method\n\n$e^{i\\pi}+1=0$\n\n```python\nprint("hello")\n```\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\nNote.[^a]\n\n[^a]: Source.'));
  const { html, headings } = renderMarkdown(post);
  assert.match(html, /class="katex"/);
  assert.match(html, /hljs-string/);
  assert.match(html, /<table>/);
  assert.match(html, /href="#fn1"/);
  assert.match(html, /id="fn1"/);
  assert.deepEqual(headings.map(h => h.id), ['method']);
});

test('dollar amounts stay as text; duplicate and non-English headings get distinct IDs', () => {
  const post = { ...parsePost(input('', '## Notes\n\nI spent $5, then $10.\n\n## Notes\n\n## 随想\n\n## 随想')) };
  const rendered = renderMarkdown(post);
  assert.doesNotMatch(rendered.html, /class="katex"/);
  assert.match(rendered.html, /\$5, then \$10/);
  assert.equal(new Set(rendered.headings.map(h => h.id)).size, 4);
});

test('metadata validates date, boolean flags and output paths', () => {
  for (const source of [input().replace('2026-09-18', '2026-02-31'), input().replace('slug: example', 'slug: ../escape'), input('draft: "false"\n')]) assert.throws(() => parsePost(source));
  assert.match(renderMarkdown(parsePost(input('', '# A heading'))).html, /<h2/);
  assert.throws(() => renderMarkdown(parsePost(input('', '$\\notarealcommand$'))), /invalid math/);
});

test('raw HTML and executable links are not rendered as active content', () => {
  const { html } = renderMarkdown(parsePost(input('', '<script>alert(1)</script>\n\n[bad](javascript:alert(1))')));
  assert.doesNotMatch(html, /<script>|href="javascript:/);
});

test('public build excludes drafts and removes withdrawn generated pages without deleting handwritten files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'xingyu-blog-test-'));
  await mkdir(path.join(root, '_content'));
  await mkdir(path.join(root, 'drafts'));
  await writeFile(path.join(root, '_content/example.md'), input());
  await writeFile(path.join(root, '_content/private.md'), input('visibility: private\n').replace('slug: example', 'slug: private'));
  await writeFile(path.join(root, 'drafts/private.md'), input().replace('slug: example', 'slug: private'));
  await writeFile(path.join(root, 'handwritten.html'), 'Keep me');
  const published = await build({ root });
  assert.deepEqual(published.pages, ['index.html', 'example.html']);
  await assert.rejects(access(path.join(root, 'private.html')));
  const index = await readFile(path.join(root, 'index.html'), 'utf8');
  await build({ root, drafts: true });
  await access(path.join(root, '_preview/private.html'));
  assert.equal(await readFile(path.join(root, 'index.html'), 'utf8'), index);
  await writeFile(path.join(root, '_content/example.md'), input('draft: true\n'));
  await build({ root });
  await assert.rejects(access(path.join(root, 'example.html')));
  assert.equal(await readFile(path.join(root, 'handwritten.html'), 'utf8'), 'Keep me');
});

test('preview paths resolve images correctly and failed builds leave the last public output intact', async () => {
  const post = parsePost(input('', '![alt](assets/figure.png)\n\n[Next](another-post.html)'));
  assert.match(renderMarkdown(post, true).html, /src="..\/assets\/figure.png"/);
  assert.match(renderMarkdown(post, true).html, /href="another-post.html"/);
  const root = await mkdtemp(path.join(os.tmpdir(), 'xingyu-blog-test-'));
  await mkdir(path.join(root, '_content'));
  await writeFile(path.join(root, '_content/example.md'), input());
  await build({ root });
  const original = await readFile(path.join(root, 'index.html'), 'utf8');
  await writeFile(path.join(root, '_content/broken.md'), input().replace('date: "2026-09-18"', 'date: invalid'));
  await assert.rejects(build({ root }));
  assert.equal(await readFile(path.join(root, 'index.html'), 'utf8'), original);
});
