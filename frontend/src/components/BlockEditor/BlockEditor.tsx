import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import Suggestion from '@tiptap/suggestion';
import { useEffect, useCallback, forwardRef, useImperativeHandle, useRef, useState } from 'react';
import tippy from 'tippy.js';
import './styles.css';

export interface BlockEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
}

export interface BlockEditorRef {
  insertContent: (content: string) => void;
  clearContent: () => void;
}

// Command items for slash menu
const getCommandItems = () => [
  {
    title: 'Heading 1',
    description: 'Large section heading',
    icon: 'H1',
    searchTerms: ['heading', 'h1', 'title'],
    command: ({ editor, range }: any) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: 'H2',
    searchTerms: ['heading', 'h2', 'subtitle'],
    command: ({ editor, range }: any) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
    },
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: 'H3',
    searchTerms: ['heading', 'h3'],
    command: ({ editor, range }: any) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
    },
  },
  {
    title: 'Bullet List',
    description: 'Create a simple bullet list',
    icon: '•',
    searchTerms: ['list', 'bullet', 'unordered'],
    command: ({ editor, range }: any) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: 'Numbered List',
    description: 'Create a numbered list',
    icon: '1.',
    searchTerms: ['list', 'numbered', 'ordered'],
    command: ({ editor, range }: any) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: 'Task List',
    description: 'Create a checklist with checkboxes',
    icon: '☑',
    searchTerms: ['task', 'checklist', 'todo', 'checkbox'],
    command: ({ editor, range }: any) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: 'Quote',
    description: 'Insert a blockquote',
    icon: '❝',
    searchTerms: ['quote', 'blockquote', 'citation'],
    command: ({ editor, range }: any) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: 'Code Block',
    description: 'Insert a code block',
    icon: '</>',
    searchTerms: ['code', 'block', 'snippet'],
    command: ({ editor, range }: any) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: 'Divider',
    description: 'Insert a horizontal divider',
    icon: '─',
    searchTerms: ['divider', 'horizontal', 'rule', 'separator'],
    command: ({ editor, range }: any) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: 'Image',
    description: 'Insert an image from URL',
    icon: '🖼',
    searchTerms: ['image', 'picture', 'photo'],
    command: ({ editor, range }: any) => {
      editor.chain().focus().deleteRange(range).run();
      const url = window.prompt('Enter image URL:');
      if (url) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    },
  },
];

// Slash command popup component
function CommandPopup({ items, command }: { items: any[]; command: any }) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = items[index];
    if (item) {
      command(item);
    }
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % items.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        selectItem(selectedIndex);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, items, command]);

  if (items.length === 0) {
    return <div className="slash-command-empty">No results found</div>;
  }

  return (
    <div className="slash-command-popup">
      {items.map((item, index) => (
        <button
          key={index}
          className={`slash-command-item ${index === selectedIndex ? 'is-selected' : ''}`}
          onClick={() => selectItem(index)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <span className="slash-command-icon">{item.icon}</span>
          <div className="slash-command-text">
            <div className="slash-command-title">{item.title}</div>
            <div className="slash-command-desc">{item.description}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

// Custom slash command extension with React renderer
const SlashCommandExt = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        startOfLine: false,
        command: ({ editor, range, props }: any) => {
          props.command({ editor, range });
        },
        allow: ({ editor }: any) => {
          const { state } = editor;
          const $head = state.selection.$head;
          const parent = $head.parent;
          return parent.type.name === 'paragraph';
        },
        items: ({ query }: { query: string }) => {
          return getCommandItems().filter((item) => {
            const searchStr = `${item.title} ${item.searchTerms.join(' ')}`.toLowerCase();
            return searchStr.includes(query.toLowerCase());
          });
        },
        render: () => {
          let component: ReactRenderer | null = null;
          let popup: any | null = null;

          return {
            onStart: (props: any) => {
              component = new ReactRenderer(CommandPopup, {
                props: {
                  items: props.items,
                  command: (item: any) => {
                    props.command({ editor: props.editor, range: props.range, props: item });
                  },
                },
                editor: props.editor,
              });

              popup = tippy(document.body, {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
              });
            },

            onUpdate(props: any) {
              component?.updateProps({
                items: props.items,
                command: (item: any) => {
                  props.command({ editor: props.editor, range: props.range, props: item });
                },
              });

              popup?.[0]?.setProps({
                getReferenceClientRect: props.clientRect,
              });
            },

            onKeyDown(props: any) {
              if (props.event.key === 'Escape') {
                popup?.[0]?.hide();
                return true;
              }
              return false;
            },

            onExit() {
              popup?.[0]?.destroy();
              component?.destroy();
            },
          };
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion(this.options.suggestion),
    ];
  },
});

export const BlockEditor = forwardRef<BlockEditorRef, BlockEditorProps>(
  ({ value, onChange, placeholder = 'Type \'/\' for commands, or start writing...', className, editable = true }, ref) => {
    const editorRef = useRef<any>(null);

    const editor = useEditor({
      editable,
      extensions: [
        StarterKit.configure({
          bulletList: {
            HTMLAttributes: {
              class: 'list-disc list-outside ml-4',
            },
          },
          orderedList: {
            HTMLAttributes: {
              class: 'list-decimal list-outside ml-4',
            },
          },
          codeBlock: {
            HTMLAttributes: {
              class: 'bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-sm overflow-x-auto',
            },
          },
          blockquote: {
            HTMLAttributes: {
              class: 'border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-600 dark:text-gray-400',
            },
          },
          heading: {
            levels: [1, 2, 3],
          },
        }),
        Underline,
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: 'text-blue-500 underline cursor-pointer',
          },
        }),
        Image.configure({
          inline: true,
          HTMLAttributes: {
            class: 'max-w-full rounded-lg my-2',
          },
        }),
        TaskList.configure({
          HTMLAttributes: {
            class: 'not-prose pl-2',
          },
        }),
        TaskItem.configure({
          nested: true,
          HTMLAttributes: {
            class: 'flex items-start gap-2 py-1',
          },
        }),
        Placeholder.configure({
          placeholder,
        }),
        SlashCommandExt,
      ],
      content: value,
      onUpdate: ({ editor }) => {
        onChange(editor.getHTML());
      },
      editorProps: {
        attributes: {
          class: 'prose prose-lg dark:prose-invert max-w-none focus:outline-none min-h-[300px] px-4 py-2',
        },
      },
    });

    editorRef.current = editor;

    useImperativeHandle(
      ref,
      () => ({
        insertContent: (content: string) => {
          editor?.chain().focus().insertContent(content).run();
        },
        clearContent: () => {
          editor?.chain().focus().clearContent().run();
        },
      }),
      [editor]
    );

    useEffect(() => {
      if (editor && value !== editor.getHTML()) {
        const currentContent = editor.getHTML();
        // Only update if the content is actually different
        if (value !== currentContent) {
          editor.commands.setContent(value);
        }
      }
    }, [value, editor]);

    const setLink = useCallback(() => {
      if (!editor) return;
      const url = window.prompt('Enter URL:');
      if (url === null) return;
      if (url === '') {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
        return;
      }
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }, [editor]);

    const addImage = useCallback(() => {
      if (!editor) return;
      const url = window.prompt('Enter image URL:');
      if (url) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    }, [editor]);

    if (!editor) {
      return (
        <textarea
          className="textarea"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={{ minHeight: '300px', resize: 'vertical' }}
        />
      );
    }

    return (
      <div className={`block-editor-container ${className || ''}`}>
        <div className="editor-toolbar">
          <div className="toolbar-group">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={editor.isActive('bold') ? 'is-active' : ''}
              title="Bold (Ctrl+B)"
            >
              <strong>B</strong>
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={editor.isActive('italic') ? 'is-active' : ''}
              title="Italic (Ctrl+I)"
            >
              <em>I</em>
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={editor.isActive('underline') ? 'is-active' : ''}
              title="Underline (Ctrl+U)"
            >
              <u>U</u>
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className={editor.isActive('strike') ? 'is-active' : ''}
              title="Strikethrough"
            >
              <s>S</s>
            </button>
          </div>

          <div className="toolbar-divider" />

          <div className="toolbar-group">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}
              title="Heading 1"
            >
              H1
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
              title="Heading 2"
            >
              H2
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}
              title="Heading 3"
            >
              H3
            </button>
          </div>

          <div className="toolbar-divider" />

          <div className="toolbar-group">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={editor.isActive('bulletList') ? 'is-active' : ''}
              title="Bullet List"
            >
              • List
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={editor.isActive('orderedList') ? 'is-active' : ''}
              title="Numbered List"
            >
              1. List
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleTaskList().run()}
              className={editor.isActive('taskList') ? 'is-active' : ''}
              title="Task List"
            >
              ☑ Task
            </button>
          </div>

          <div className="toolbar-divider" />

          <div className="toolbar-group">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className={editor.isActive('blockquote') ? 'is-active' : ''}
              title="Quote"
            >
              ❝ Quote
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              className={editor.isActive('codeBlock') ? 'is-active' : ''}
              title="Code Block"
            >
              {'</>'} Code
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              title="Divider"
            >
              ─
            </button>
          </div>

          <div className="toolbar-divider" />

          <div className="toolbar-group">
            <button type="button" onClick={addImage} title="Insert Image">
              🖼 Image
            </button>
            <button type="button" onClick={setLink} title="Insert Link">
              🔗 Link
            </button>
          </div>
        </div>

        <EditorContent editor={editor} />
      </div>
    );
  }
);

BlockEditor.displayName = 'BlockEditor';
