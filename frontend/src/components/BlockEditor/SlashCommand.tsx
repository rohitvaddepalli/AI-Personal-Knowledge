import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';

export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }: any) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addExtensions() {
    return [Suggestion.configure(this.options.suggestion)];
  },
});
