import test from 'node:test';
import assert from 'node:assert/strict';
import { MarkdownManager } from '@tiptap/markdown';
import { readFile } from 'node:fs/promises';
import { extensions } from '../admin/extensions.mjs';
import { parsePost, renderMarkdown } from './render.mjs';

test('visual editor preserves equations, footnotes, code, tables and nested lists in Markdown', async () => {
  const manager = new MarkdownManager({ extensions: extensions() });
  const sample = parsePost(await readFile(new URL('../_content/sample-post.md', import.meta.url), 'utf8'));
  const markdown = manager.serialize(manager.parse(sample.body));
  const rendered = renderMarkdown({ ...sample, body: markdown }).html;
  for (const pattern of [/class="katex"/, /id="fn1"/, /<table>/, /hljs-string/, /profile.png/]) assert.match(rendered, pattern);
  assert.match(markdown, /\\nabla/);
  const nested = '- First\n  - Nested\n    - Third\n\n## Heading\n\n**Bold** and *italic*.';
  const roundtrip = manager.serialize(manager.parse(nested));
  assert.match(roundtrip, /\n\s+- Nested/);
  assert.match(roundtrip, /\*\*Bold\*\*/);
  assert.match(roundtrip, /## Heading/);
});

import { getSchema } from '@tiptap/core';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { mathInputRule } from '../admin/math-input.mjs';
import { filterCommands, slashMatch } from '../admin/slash-menu.mjs';
const schema = getSchema(extensions());
function stateFor(text, type = 'paragraph', offset = text.length) {
  const doc = schema.node('doc', null, [schema.node(type, null, text ? schema.text(text) : null)]);
  return EditorState.create({ doc, selection: TextSelection.create(doc, 1 + offset) });
}

test('typing an equation replaces both dollar delimiters, leaving adjacent prose intact', () => {
  for (const [prefix, formula] of [['', 'x^2'], ['Energy: ', 'E=mc^2'], ['Compare ', '\\alpha + \\beta']]) {
    const input = `${prefix}$${formula}$`;
    const state = stateFor(input.slice(0, -1));
    const tr = state.tr;
    const rule = mathInputRule(schema.nodes.inlineMath);
    const match = rule.find.exec(input);
    assert.ok(match);
    rule.handler({ state: { tr }, range: { from: prefix.length + 1, to: input.length }, match });
    assert.equal(tr.doc.textContent, prefix);
    const equation = tr.doc.firstChild.lastChild;
    assert.equal(equation.type.name, 'inlineMath'); assert.equal(equation.attrs.latex, formula);
  }
  const inline = mathInputRule(schema.nodes.inlineMath);
  assert.equal(inline.find.exec('$$x$'), null);
  assert.equal(inline.find.exec('\\$x$'), null);
  assert.equal(inline.find.exec('I spent $5 then $'), null);
});

test('display equation input creates one math block without literal delimiters', () => {
  const state = stateFor('$$x^2$'); const tr = state.tr;
  const rule = mathInputRule(schema.nodes.blockMath, true);
  rule.handler({ state: { tr }, range: { from: 1, to: 7 }, match: rule.find.exec('$$x^2$$') });
  assert.equal(tr.doc.childCount, 1); assert.equal(tr.doc.firstChild.type.name, 'blockMath');
  assert.equal(tr.doc.firstChild.attrs.latex, 'x^2'); assert.equal(tr.doc.textContent, '');
});

test('slash commands filter naturally and ignore URLs, code, and ordinary slash characters', () => {
  assert.equal(filterCommands('link')[0].id, 'link');
  assert.equal(filterCommands('heading 2')[0].id, 'heading2');
  assert.equal(filterCommands('todo')[0].id, 'todo');
  assert.deepEqual(filterCommands('not-a-command'), []);
  const context = slashMatch(stateFor('Read /link'));
  assert.deepEqual(context, { from: 6, to: 11, query: 'link' });
  for (const text of ['https://example.com/link', 'path/to/file', '1/2']) assert.equal(slashMatch(stateFor(text)), null);
  assert.equal(slashMatch(stateFor('/link', 'codeBlock')), null);
});
