import { InputRule } from '@tiptap/core';

export function mathInputRule(type, block = false) {
  return new InputRule({
    find: block ? /^\$\$(?!\s)([^\n]+?)(?<!\s)\$\$$/ : /(?<![\\$])\$(?![\s$])((?:\\.|[^$\n])+?)(?<!\s)\$$/,
    handler: ({ state, range, match }) => {
      const node = type.create({ latex: match[1] });
      // Input rules run before the final keystroke is inserted. Replace the full
      // existing range; replacing only the capture group leaves literal dollars.
      if (block) {
        const start = state.tr.doc.resolve(range.from);
        state.tr.replaceWith(start.before(), start.after(), node);
      } else state.tr.replaceWith(range.from, range.to, node);
      state.tr.scrollIntoView();
    }
  });
}
