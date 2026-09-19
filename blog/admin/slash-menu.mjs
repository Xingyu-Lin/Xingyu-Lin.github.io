export const commands = [
  { id: 'text', label: 'Text', icon: 'T', shortcut: '', keywords: 'paragraph plain', run: chain => chain.setParagraph() },
  ...[1, 2, 3, 4].map(level => ({ id: `heading${level}`, label: `Heading ${level}`, icon: `H${level}`, shortcut: '#'.repeat(level), keywords: `h${level} title`, run: chain => chain.setHeading({ level }) })),
  { id: 'bullet', label: 'Bulleted list', icon: '•', shortcut: '-', keywords: 'unordered bullet list', run: chain => chain.toggleBulletList() },
  { id: 'number', label: 'Numbered list', icon: '1.', shortcut: '1.', keywords: 'ordered number list', run: chain => chain.toggleOrderedList() },
  { id: 'todo', label: 'To-do list', icon: '☐', shortcut: '[]', keywords: 'task checkbox checklist todo', run: chain => chain.toggleTaskList() },
  { id: 'quote', label: 'Quote', icon: '❝', shortcut: '>', keywords: 'blockquote', run: chain => chain.toggleBlockquote() },
  { id: 'code', label: 'Code block', icon: '{ }', shortcut: '```', keywords: 'code snippet fenced', run: chain => chain.toggleCodeBlock() },
  { id: 'table', label: 'Table', icon: '▦', keywords: 'grid columns', run: chain => chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }) },
  { id: 'divider', label: 'Divider', icon: '—', shortcut: '---', keywords: 'horizontal rule', run: chain => chain.setHorizontalRule() },
  { id: 'bold', label: 'Bold', icon: 'B', shortcut: '**', keywords: 'strong', run: chain => chain.toggleBold() },
  { id: 'italic', label: 'Italic', icon: 'I', shortcut: '*', keywords: 'emphasis', run: chain => chain.toggleItalic() },
  { id: 'inlinecode', label: 'Inline code', icon: '<>', shortcut: '`', keywords: 'monospace', run: chain => chain.toggleCode() },
  { id: 'link', label: 'Link', icon: '↗', keywords: 'url hyperlink', form: true },
  { id: 'image', label: 'Image', icon: '▧', keywords: 'photo picture', form: true },
  { id: 'equation', label: 'Equation', icon: '∑', shortcut: '$$', keywords: 'math latex formula', form: true }
];
export function filterCommands(query) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return commands.filter(command => words.every(word => `${command.id} ${command.label} ${command.keywords}`.toLowerCase().includes(word)));
}
export function slashMatch(state) {
  const { $from, empty } = state.selection;
  if (!empty || !$from.parent.isTextblock || $from.parent.type.spec.code || $from.marks().some(mark => mark.type.name === 'code')) return null;
  const before = $from.parent.textBetween(0, $from.parentOffset, '\uFFFC', '\uFFFC');
  const match = before.match(/(?:^|\s)\/([a-z\d -]*)$/i);
  return match ? { from: $from.pos - match[1].length - 1, to: $from.pos, query: match[1] } : null;
}
export function createSlashMenu(editor, openForm) {
  const menu = document.querySelector('#slash-menu');
  const options = document.querySelector('#slash-options');
  let match = null, items = [], selected = 0, dismissed = '', previous = '';
  const key = context => context ? `${context.from}:${context.to}:${context.query}` : '';
  function close(dismiss = false) {
    if (dismiss) dismissed = key(match);
    menu.hidden = true; match = null;
    editor.view.dom.removeAttribute('aria-activedescendant');
    editor.view.dom.removeAttribute('aria-controls');
  }
  function highlight() {
    [...options.children].forEach((button, index) => button.setAttribute('aria-selected', String(index === selected)));
    const button = options.children[selected];
    if (button) { editor.view.dom.setAttribute('aria-activedescendant', button.id); button.scrollIntoView({ block: 'nearest' }); }
  }
  function position() {
    if (menu.hidden || !match) return;
    const rect = editor.view.coordsAtPos(match.to);
    const height = menu.offsetHeight;
    const top = innerHeight - rect.bottom >= height + 20 ? rect.bottom + 8 : rect.top - height - 8;
    menu.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - menu.offsetWidth - 12))}px`;
    menu.style.top = `${Math.max(78, Math.min(top, innerHeight - height - 12))}px`;
  }
  function choose(index) {
    if (!match || !items[index]) return;
    const command = items[index]; const range = { from: match.from, to: match.to };
    close(true);
    if (command.form) openForm(command.id, range);
    else command.run(editor.chain().focus().deleteRange(range)).run();
  }
  function update() {
    const context = slashMatch(editor.state);
    if (!context) { dismissed = ''; previous = ''; close(); return; }
    if (!editor.isEditable || !editor.isFocused || key(context) === dismissed) { close(); return; }
    if (key(context) !== previous) selected = 0;
    previous = key(context); match = context; items = filterCommands(match.query);
    selected = Math.min(selected, Math.max(0, items.length - 1));
    options.replaceChildren();
    items.forEach((command, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.id = `slash-option-${command.id}`; button.setAttribute('role', 'option');
      const icon = document.createElement('span'); icon.className = 'slash-icon'; icon.textContent = command.icon; icon.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span'); label.textContent = command.label;
      const hint = document.createElement('small'); hint.textContent = command.shortcut || ''; hint.setAttribute('aria-hidden', 'true');
      button.append(icon, label, hint); button.addEventListener('mousedown', event => event.preventDefault()); button.addEventListener('click', () => choose(index));
      options.append(button);
    });
    if (!items.length) { const empty = document.createElement('p'); empty.textContent = 'No matching commands'; options.append(empty); }
    menu.hidden = false; editor.view.dom.setAttribute('aria-controls', 'slash-options'); position();
    if (items.length) highlight(); else editor.view.dom.removeAttribute('aria-activedescendant');
  }
  function onKeyDown(view, event) {
    if (menu.hidden || event.isComposing) return false;
    if (event.key === 'Escape') { close(true); return true; }
    if (items.length && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; highlight(); return true;
    }
    if (items.length && ['Enter', 'Tab'].includes(event.key)) { choose(selected); return true; }
    return false;
  }
  document.addEventListener('pointerdown', event => { if (!menu.contains(event.target) && !editor.view.dom.contains(event.target)) close(true); });
  window.addEventListener('resize', position); window.addEventListener('scroll', position, true);
  return { update, onKeyDown, close };
}
