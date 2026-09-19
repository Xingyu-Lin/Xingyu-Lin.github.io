import { Node } from '@tiptap/core';
import { mathInputRule } from './math-input.mjs';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import katex from 'katex';

function mathNode(name, block) {
  const expression = block ? /^\$\$\s*\n?([\s\S]+?)\n?\$\$(?:\n|$)/ : /^\$(?![\s$])((?:\\.|[^$\n])+?)(?<!\s)\$(?!\d)/;
  return Node.create({
    name, group: block ? 'block' : 'inline', inline: !block, atom: true,
    addAttributes: () => ({ latex: { default: '' } }),
    parseHTML: () => [{ tag: `[data-math="${name}"]` }],
    renderHTML: ({ node }) => [block ? 'div' : 'span', { 'data-math': name, 'data-latex': node.attrs.latex }, node.attrs.latex],
    markdownTokenizer: { name, level: block ? 'block' : 'inline', start: src => src.indexOf(block ? '$$' : '$'), tokenize(src) { const match = src.match(expression); if (match) return { type: name, raw: match[0], latex: match[1].trim() }; } },
    parseMarkdown: (token, helpers) => helpers.createNode(name, { latex: token.latex }),
    renderMarkdown: node => block ? `$$\n${node.attrs.latex}\n$$` : `$${node.attrs.latex}$`,
    addInputRules() { return [mathInputRule(this.type, block)]; },
    addNodeView() {
      return ({ node, editor, getPos }) => {
        const dom = document.createElement(block ? 'div' : 'span');
        dom.className = block ? 'editor-math block-math' : 'editor-math';
        if (editor.isEditable) { dom.title = 'Click to edit equation'; dom.setAttribute('role', 'button'); dom.tabIndex = 0; }
        katex.render(node.attrs.latex, dom, { displayMode: block, throwOnError: false, trust: false });
        const edit = () => {
          if (!editor.isEditable) return;
          const latex = window.prompt('Equation (LaTeX)', node.attrs.latex);
          if (latex !== null && typeof getPos() === 'number') editor.chain().focus().setNodeSelection(getPos()).updateAttributes(name, { latex }).run();
        };
        dom.addEventListener('click', edit);
        dom.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); edit(); } });
        return { dom };
      };
    }
  });
}
const Footnote = Node.create({
  name: 'footnoteReference', group: 'inline', inline: true, atom: true,
  addAttributes: () => ({ label: { default: '' } }),
  parseHTML: () => [{ tag: 'sup[data-footnote]' }],
  renderHTML: ({ node }) => ['sup', { 'data-footnote': node.attrs.label }, `[${node.attrs.label}]`],
  markdownTokenizer: { name: 'footnoteReference', level: 'inline', start: src => src.indexOf('[^'), tokenize(src) { const match = src.match(/^\[\^([^\]]+)\]/); if (match) return { type: 'footnoteReference', raw: match[0], label: match[1] }; } },
  parseMarkdown: (token, helpers) => helpers.createNode('footnoteReference', { label: token.label }),
  renderMarkdown: node => `[^${node.attrs.label}]`
});
const FootnoteDefinition = Node.create({
  name: 'footnoteDefinition', group: 'block', content: 'inline*',
  addAttributes: () => ({ label: { default: '' } }),
  parseHTML: () => [{ tag: 'div[data-footnote-definition]' }],
  renderHTML: ({ node }) => ['div', { class: 'footnote-definition', 'data-footnote-definition': node.attrs.label }, ['span', { contenteditable: 'false' }, `[${node.attrs.label}] `], ['span', {}, 0]],
  markdownTokenizer: { name: 'footnoteDefinition', level: 'block', start: src => src.search(/^\[\^[^\]]+\]:/m), tokenize(src, tokens, helpers) { const match = src.match(/^\[\^([^\]]+)\]:[ \t]*(.*(?:\n[ \t]{4}.+)*)\n*/); if (match) return { type: 'footnoteDefinition', raw: match[0], label: match[1], tokens: helpers.inlineTokens(match[2].replace(/\n {4}/g, '\n')) }; } },
  parseMarkdown: (token, helpers) => helpers.createNode('footnoteDefinition', { label: token.label }, helpers.parseInline(token.tokens)),
  renderMarkdown: (node, helpers) => `[^${node.attrs.label}]: ${helpers.renderChildren(node.content).replace(/\n/g, '\n    ')}`
});
export const extensions = () => [
  StarterKit.configure({ heading: { levels: [1, 2, 3, 4] }, underline: false, link: { openOnClick: false } }),
  Markdown, Placeholder.configure({ placeholder: 'Start writing, or type / for commands…' }), Image.configure({ allowBase64: false }),
  TableKit.configure({ table: { resizable: false } }), TaskList, TaskItem.configure({ nested: true }),
  mathNode('inlineMath', false), mathNode('blockMath', true), Footnote, FootnoteDefinition
];
