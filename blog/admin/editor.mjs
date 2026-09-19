import { Editor } from '@tiptap/core';
import { extensions } from './extensions.mjs';
import { createSlashMenu } from './slash-menu.mjs';
const $ = selector => document.querySelector(selector);
const title = $('#post-title');
const state = $('#save-state');
const message = $('#action-message');
let token, current = null, dirty = false, timer, change = 0, inFlight = null, retryDelay = 3000;
let originalBody = '', bodyChanged = false, slash;
let folder = 'live', composing = false, busy = false;
const editor = new Editor({
  element: $('#post-body'), extensions: extensions(), content: '', contentType: 'markdown',
  editorProps: {
    attributes: { role: 'textbox', 'aria-label': 'Post content', 'aria-multiline': 'true', spellcheck: 'true' },
    handleKeyDown: (view, event) => slash?.onKeyDown(view, event) || false
  },
  onUpdate: () => { bodyChanged = true; changed(); slash?.update(); },
  onSelectionUpdate: () => slash?.update()
});
function status(text, error = false) { message.textContent = text; message.classList.toggle('error', error); }
async function api(route, data) {
  const response = await fetch(`/api/${route}`, { method: data ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'X-Writing-Token': token }, body: data ? JSON.stringify(data) : undefined });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error || 'Unable to save. Retrying…'), { status: response.status });
  return result;
}
function body() { return bodyChanged ? editor.getMarkdown() : originalBody; }
function values() { return { title: title.value, body: body(), slug: current?.slug, revision: current?.revision }; }
function resize() { title.style.height = 'auto'; title.style.height = `${title.scrollHeight}px`; }
function changed() {
  if (!composing || current?.readOnly || title.readOnly) return;
  dirty = true; change++; state.textContent = 'Unsaved'; status(''); clearTimeout(timer);
  retryDelay = 3000; timer = setTimeout(() => save(), 900);
}
function setEditing(editable) {
  title.readOnly = !editable;
  editor.setEditable(editable, false);
  editor.view.dom.setAttribute('aria-readonly', String(!editable));
  $('.document-editor').classList.toggle('read-only', !editable);
  editor.view.dom.querySelectorAll('.editor-math').forEach(node => {
    node.title = editable ? 'Click to edit equation' : '';
    if (editable) { node.setAttribute('role', 'button'); node.tabIndex = 0; }
    else { node.removeAttribute('role'); node.removeAttribute('tabindex'); }
  });
  if (!editable) slash?.close(true);
}
function syncControls() {
  const locked = Boolean(current?.readOnly);
  setEditing(composing && !locked && !busy);
  $('#archive-post').hidden = !current || current.archived;
  $('#restore-post').hidden = !current?.archived;
  $('#publish-post').hidden = locked;
  document.querySelectorAll('#post-folders button, #logout, #new-post, .writing-bar button, .post-open, .row-action, #publish-form button, #publish-form input').forEach(control => { control.disabled = busy || !token; });
}
function populate(post) {
  clearTimeout(timer); slash?.close(true); current = post; originalBody = post?.body || ''; bodyChanged = false;
  title.value = post?.title || '';
  editor.commands.setContent(originalBody, { contentType: 'markdown', emitUpdate: false });
  syncControls();
  state.textContent = !post ? '' : post.archived ? 'Archived' : post.visibility === 'draft' ? 'Draft saved' : 'Published · read-only';
  dirty = false; status(''); resize();
}
async function save(visibility = null) {
  const publish = Boolean(visibility);
  clearTimeout(timer);
  if (!composing || current?.readOnly) return true;
  if (inFlight) { await inFlight; return dirty || publish ? save(visibility) : true; }
  if (!token) { if (dirty) timer = setTimeout(() => save(), 1000); return false; }
  if (!publish && !dirty) return true;
  if (publish && (!title.value.trim() || !body().trim())) { status('Add a title and some writing before publishing.', true); if (dirty) timer = setTimeout(() => save(), 900); return false; }
  if (!publish && !current && !title.value.trim() && !body().trim()) { dirty = false; state.textContent = ''; return true; }
  const version = change; const snapshot = values();
  if (publish) snapshot.visibility = visibility;
  if (publish) setEditing(false);
  state.textContent = publish ? 'Publishing…' : 'Saving…';
  inFlight = (async () => {
    try {
      // Keep a draft even when publishing fails (for example an unfinished equation).
      if (publish && dirty) {
        const draft = await api('save', snapshot); current = draft.post;
        snapshot.slug = current.slug; snapshot.revision = current.revision;
        if (version === change) dirty = false;
      }
      const result = await api(publish ? 'publish' : 'save', snapshot);
      current = result.post;
      if (version === change) dirty = false;
      state.textContent = dirty ? 'Unsaved' : publish ? 'Published' : 'Draft saved';
      syncControls();
      retryDelay = 3000;
      status('');
      if (publish) {
        populate(current);
        folder = 'live'; selectFolder(); status('Published.');
        const link = document.createElement('a'); link.href = result.url; link.target = '_blank'; link.rel = 'noopener'; link.textContent = ' View post'; message.append(link);
      }
      return true;
    } catch (error) {
      state.textContent = dirty ? 'Not saved' : 'Draft saved'; status(error.message, true);
      if (!error.status || error.status >= 500 || error.status === 429) {
        timer = setTimeout(() => save(), retryDelay); retryDelay = Math.min(retryDelay * 2, 30000);
      }
      return false;
    } finally {
      inFlight = null;
      syncControls();
      if (dirty && version !== change) { clearTimeout(timer); timer = setTimeout(() => save(), 900); }
    }
  })();
  return inFlight;
}
async function leave() { await save(); return !dirty && !inFlight; }
async function action(callback) {
  if (busy || !token) return;
  busy = true; syncControls();
  try { await callback(); } catch (error) { status(error.message, true); }
  finally { busy = false; syncControls(); }
}
function selectFolder() {
  document.querySelectorAll('#post-folders button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.folder === folder)));
}
async function showLibrary(nextFolder = folder, focus = false) {
  const archived = nextFolder === 'archived';
  const all = await api(archived ? 'archive' : 'posts');
  const posts = all.filter(post => archived || (nextFolder === 'drafts' ? post.visibility === 'draft' : post.visibility !== 'draft'));
  if (nextFolder === 'live') posts.sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.slug.localeCompare(b.slug));
  folder = nextFolder; composing = false; populate(null); selectFolder();
  $('#editor-view').hidden = true; $('#library-view').hidden = false;
  $('#library-heading').textContent = folder === 'live' ? 'Blog' : folder === 'drafts' ? 'Drafts' : 'Archived';
  const container = $('#post-library'); container.replaceChildren();
  container.setAttribute('aria-label', `${folder === 'live' ? 'Live' : folder === 'drafts' ? 'Draft' : 'Archived'} posts`);
  container.setAttribute('aria-busy', 'false');
  for (const post of posts) {
    const row = document.createElement('li'); row.className = 'library-row';
    const button = document.createElement('button'); button.type = 'button'; button.className = 'post-open'; button.textContent = post.title || 'Untitled'; button.title = post.title || 'Untitled';
    button.addEventListener('click', () => action(async () => {
      if (!await leave()) return;
      const latest = (await api(archived ? 'archive' : 'posts')).find(item => item.slug === post.slug);
      if (!latest) { await showLibrary(); status('This post was moved in another window.'); return; }
      openEditor(latest);
    }));
    row.append(button);
    const date = post.visibility === 'draft' ? post.createdAt?.slice(0, 10) : post.date;
    if (date) {
      const time = document.createElement('time'); time.dateTime = date;
      if (post.visibility === 'draft') time.title = 'Draft started';
      time.textContent = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
      row.append(time);
    }
    const move = document.createElement('button'); move.type = 'button'; move.className = 'row-action'; move.textContent = archived ? 'Restore' : 'Archive';
    move.setAttribute('aria-label', `${move.textContent} ${post.title || 'Untitled'}`);
    move.addEventListener('click', () => movePost(post, archived));
    row.append(move); container.append(row);
  }
  if (!posts.length) { const empty = document.createElement('li'); empty.className = 'empty-posts'; empty.textContent = folder === 'live' ? 'No live posts.' : folder === 'drafts' ? 'No drafts.' : 'No archived posts.'; container.append(empty); }
  syncControls();
  if (focus) $('#library-heading').focus();
}
function openEditor(post) {
  composing = true; $('#library-view').hidden = true; $('#editor-view').hidden = false;
  populate(post); title.focus();
}
title.addEventListener('input', () => { resize(); changed(); });
$('#new-post').addEventListener('click', () => action(async () => {
  if (!await leave()) return;
  folder = 'drafts'; selectFolder(); openEditor(null);
}));
$('#back-to-posts').addEventListener('click', () => action(async () => { if (await leave()) await showLibrary(folder, true); }));
document.querySelectorAll('#post-folders button').forEach(button => button.addEventListener('click', () => action(async () => {
  if (await leave()) await showLibrary(button.dataset.folder, true);
})));
async function movePost(post, restore) {
  await action(async () => {
    if (!post || !await leave()) return;
    // Autosave may have advanced the open draft's revision before this action.
    const latest = current?.slug === post.slug ? current : post;
    await api(restore ? 'restore' : 'archive', { slug: latest.slug, revision: latest.revision });
    await showLibrary(folder, true);
    status(restore ? `Restored to ${post.visibility === 'draft' ? 'Drafts' : 'Live'}.` : 'Moved to Archived.');
  });
}
$('#archive-post').addEventListener('click', () => movePost(current, false));
$('#restore-post').addEventListener('click', () => movePost(current, true));
$('#logout').addEventListener('click', () => action(async () => {
  if (!await leave()) return;
  await api('logout', {}); location.assign('/blog/');
}));
$('#publish-post').addEventListener('click', () => action(async () => {
  if (!await leave()) return;
  if (!title.value.trim() || !body().trim()) { status('Add a title and some writing before publishing.', true); return; }
  $('#publish-form').reset(); $('#publish-error').textContent = '';
  $('#publish-dialog').showModal();
}));
$('#cancel-publish').addEventListener('click', () => $('#publish-dialog').close());
$('#publish-dialog').addEventListener('cancel', event => { if (busy) event.preventDefault(); });
$('#publish-form').addEventListener('submit', event => {
  event.preventDefault();
  const visibility = new FormData(event.currentTarget).get('visibility');
  action(async () => {
    $('#publish-error').textContent = '';
    if (await save(visibility)) $('#publish-dialog').close();
    else $('#publish-error').textContent = message.textContent;
  });
});

let insertion;
function openInsert(kind, range) {
  if (!editor.isEditable) return;
  insertion = { kind, range };
  const names = { link: 'Insert link', image: 'Insert image', equation: 'Insert equation' };
  $('#insert-heading').textContent = names[kind]; $('#insert-error').textContent = '';
  const container = $('#insert-fields'); container.replaceChildren();
  const fields = kind === 'equation' ? [['latex', 'Equation (LaTeX)', true], ['style', 'Display', false]] : [['url', kind === 'link' ? 'URL' : 'Image URL', true], ['text', kind === 'link' ? 'Link text' : 'Image description', false]];
  for (const [name, labelText, required] of fields) {
    const label = document.createElement('label'); label.textContent = labelText;
    const input = document.createElement(name === 'style' ? 'select' : 'input'); input.name = name; input.required = required;
    if (name === 'style') { for (const [value, text] of [['blockMath', 'On its own line'], ['inlineMath', 'Within the text']]) { const option = document.createElement('option'); option.value = value; option.textContent = text; input.append(option); } }
    else { input.type = 'text'; input.autocomplete = 'off'; }
    label.append(input); container.append(label);
  }
  $('#insert-dialog').showModal();
  container.querySelector('input')?.focus();
}
slash = createSlashMenu(editor, openInsert);
$('#cancel-insert').addEventListener('click', () => { $('#insert-dialog').close(); editor.commands.focus(); });
$('#insert-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!editor.isEditable) return;
  const fields = event.currentTarget.elements;
  const { kind, range } = insertion;
  let content;
  if (kind === 'equation') content = { type: fields.namedItem('style').value, attrs: { latex: fields.namedItem('latex').value.trim() } };
  else {
    const url = fields.namedItem('url').value.trim();
    let parsed;
    try { parsed = new URL(url, location.origin); } catch { $('#insert-error').textContent = 'Enter a valid URL.'; return; }
    if (!['http:', 'https:', ...(kind === 'link' ? ['mailto:'] : [])].includes(parsed.protocol)) { $('#insert-error').textContent = 'Use a web address' + (kind === 'link' ? ' or mailto: link.' : '.'); return; }
    const text = fields.namedItem('text').value.trim();
    content = kind === 'link' ? { type: 'text', text: text || url, marks: [{ type: 'link', attrs: { href: url } }] } : { type: 'image', attrs: { src: url, alt: text } };
  }
  $('#insert-dialog').close();
  editor.chain().focus().insertContentAt(range, content).run();
});
window.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && event.key === 's') { event.preventDefault(); save(); } });
window.addEventListener('online', () => { if (dirty) save(); });
window.addEventListener('beforeunload', event => { if (dirty || inFlight) { event.preventDefault(); event.returnValue = ''; } });
document.addEventListener('visibilitychange', () => { if (document.hidden && dirty) save(); });
syncControls();
fetch('/api/auth').then(response => response.json()).then(session => {
  if (!session.authenticated) location.replace('/admin');
  else { token = session.token; return action(() => showLibrary()); }
}).catch(() => status('Unable to connect. Your writing is still in this window. Reload after reconnecting.', true));
