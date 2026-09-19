import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import texmath from 'markdown-it-texmath';
import katex from 'katex';
import hljs from 'highlight.js';
import { parse } from 'yaml';

export const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export const slugify = value => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const validSlug = slug => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && !['index', '404'].includes(slug);
export const formatDate = date => new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));

export function parsePost(source, filename = 'post') {
  const match = source.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`${filename}: start with YAML metadata between --- lines.`);
  const data = parse(match[1]);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`${filename}: metadata must be a mapping.`);
  for (const field of ['title', 'slug']) {
    if (typeof data[field] !== 'string' || (!data[field].trim() && !(field === 'title' && data.draft === true))) throw new Error(`${filename}: ${field} must be a nonempty string.`);
  }
  const parsedDate = new Date(`${data.date}T00:00:00Z`);
  if (data.date || !data.draft) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== data.date) throw new Error(`${filename}: use a valid YYYY-MM-DD date.`);
  }
  if (!validSlug(data.slug)) throw new Error(`${filename}: slug must use lowercase letters, numbers, and hyphens, and cannot be index or 404.`);
  for (const field of ['draft', 'toc']) {
    if (data[field] !== undefined && typeof data[field] !== 'boolean') throw new Error(`${filename}: ${field} must be true or false.`);
  }
  if (data.tags !== undefined && (!Array.isArray(data.tags) || data.tags.some(tag => typeof tag !== 'string'))) throw new Error(`${filename}: tags must be a list of strings.`);
  return { ...data, tags: data.tags || [], draft: data.draft ?? false, toc: false, body: match[2] };
}

export function renderMarkdown(post, preview = false) {
  const md = new MarkdownIt({ html: false, linkify: true, typographer: true });
  md.use(footnote);
  // A single post format supports both prose and equations.
  md.use(texmath, { engine: katex, delimiters: 'dollars', katexOptions: { trust: false, throwOnError: true } });
  md.renderer.rules.fence = (tokens, index) => {
    const token = tokens[index];
    const language = token.info.trim().split(/\s+/)[0];
    const code = language && hljs.getLanguage(language)
      ? hljs.highlight(token.content, { language, ignoreIllegals: true }).value : escape(token.content);
    return `<div class="code-block"><div class="code-toolbar"><span>${escape(language || 'Code')}</span><button type="button" class="copy-code" hidden>Copy code</button></div><pre><code class="hljs">${code}</code></pre></div>\n`;
  };
  md.renderer.rules.table_open = () => '<div class="table-scroll" role="region" aria-label="Table" tabindex="0"><table>\n';
  md.renderer.rules.table_close = () => '</table></div>\n';
  const defaultImage = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, index, options, env, renderer) => {
    tokens[index].attrSet('loading', 'lazy');
    tokens[index].attrSet('decoding', 'async');
    return defaultImage(tokens, index, options, env, renderer);
  };
  const env = {};
  const tokens = md.parse(post.body, env);
  const headings = [];
  const usedIds = new Set(['main', 'page-top', 'copy-status', 'mainNav', 'navbarResponsive']);
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type !== 'heading_open') continue;
    if (token.tag === 'h1') { token.tag = 'h2'; const close = tokens.slice(i + 1).find(item => item.type === 'heading_close'); if (close) close.tag = 'h2'; }
    const text = (tokens[i + 1].children || []).map(child => child.content).join('');
    const slug = slugify(text) || 'section';
    const base = /^fn(?:ref)?\d/.test(slug) ? `section-${slug}` : slug;
    let id = base;
    for (let suffix = 2; usedIds.has(id); suffix++) id = `${base}-${suffix}`;
    usedIds.add(id);
    token.attrSet('id', id);
    if (['h2', 'h3'].includes(token.tag)) headings.push({ id, text, level: token.tag });
  }
  // Asset paths are relative to blog/, including when rendering a draft preview.
  function adjustLinks(list) {
    for (const token of list) {
      if (token.type.startsWith('math_')) {
        try { katex.renderToString(token.content, { trust: false, throwOnError: true, displayMode: token.block }); }
        catch (error) { throw new Error(`${post.slug}: invalid math. ${error.message}`); }
      }
      for (const attr of ['src', 'href']) {
        const value = token.attrGet(attr);
        if (preview && value && !/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(value)) {
          if (preview === 'writer') token.attrSet(attr, `/blog/${value}`);
          else if (!/^[a-z\d-]+\.html(?:#.*)?$/.test(value)) token.attrSet(attr, `../${value}`);
        }
      }
      if (token.children) adjustLinks(token.children);
    }
  }
  adjustLinks(tokens);
  const html = md.renderer.render(tokens, md.options, env);
  if (html.includes('katex-error')) throw new Error(`${post.slug}: a math expression could not be rendered. Check its LaTeX syntax.`);
  const minutes = Math.max(1, Math.ceil(post.body.split(/\s+/).filter(Boolean).length / 220));
  return { html, headings, minutes };
}
