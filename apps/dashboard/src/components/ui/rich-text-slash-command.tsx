"use client";

import { Extension, type Range } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, {
  type SuggestionKeyDownProps,
  type SuggestionOptions,
  type SuggestionProps,
} from "@tiptap/suggestion";
import {
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  SeparatorHorizontal,
} from "lucide-react";
import { forwardRef, useImperativeHandle, useState } from "react";

import { cn } from "@/lib/utils";

type SlashCommandItem = {
  description: string;
  icon: typeof Pilcrow;
  title: string;
  run: (props: { editor: SuggestionProps["editor"]; range: Range }) => void;
};

type SlashCommandListRef = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
};

const COMMANDS: SlashCommandItem[] = [
  {
    title: "Paragraph",
    description: "Plain text",
    icon: Pilcrow,
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  {
    title: "Heading 1",
    description: "Large section heading",
    icon: Heading1,
    run: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run(),
  },
  {
    title: "Heading 2",
    description: "Medium section heading",
    icon: Heading2,
    run: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run(),
  },
  {
    title: "Heading 3",
    description: "Small section heading",
    icon: Heading3,
    run: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run(),
  },
  {
    title: "Numbered list",
    description: "Create a numbered list",
    icon: ListOrdered,
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: "Bulleted list",
    description: "Create a simple list",
    icon: List,
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: "Quote",
    description: "Emphasize a quotation",
    icon: Quote,
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: "Divider",
    description: "Separate sections",
    icon: SeparatorHorizontal,
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    title: "Image",
    description: "Upload or choose from the media library",
    icon: ImageIcon,
    run: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      editor.view.dom.dispatchEvent(new CustomEvent("rich-text-image-open"));
    },
  },
];

const SlashCommandList = forwardRef<
  SlashCommandListRef,
  SuggestionProps<SlashCommandItem, SlashCommandItem>
>(function SlashCommandList({ command, items }, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const activeIndex = Math.min(selectedIndex, Math.max(items.length - 1, 0));

  const select = (index: number) => {
    const item = items[index];
    if (item) command(item);
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        const direction = event.key === "ArrowDown" ? 1 : -1;
        setSelectedIndex((current) => (current + direction + items.length) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        select(activeIndex);
        return true;
      }
      return false;
    },
  }));

  return (
    <div
      aria-label="Insert a block"
      className="max-h-80 w-72 overflow-y-auto overscroll-contain rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg"
      role="listbox"
    >
      <div className="px-2 py-1.5 text-xs text-muted-foreground">Insert a block</div>
      {items.length ? (
        items.map((item, index) => (
          <button
            aria-selected={index === activeIndex}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left",
              index === activeIndex && "bg-accent text-accent-foreground",
            )}
            key={item.title}
            onClick={() => select(index)}
            onMouseDown={(event) => event.preventDefault()}
            role="option"
            type="button"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-md border bg-background">
              <item.icon aria-hidden className="size-4" />
            </span>
            <span className="flex min-w-0 flex-col">
              <strong className="text-sm font-medium">{item.title}</strong>
              <small className="text-xs text-muted-foreground">{item.description}</small>
            </span>
          </button>
        ))
      ) : (
        <p className="px-2 py-3 text-sm text-muted-foreground">No matching blocks.</p>
      )}
    </div>
  );
});

const suggestion: Omit<SuggestionOptions<SlashCommandItem, SlashCommandItem>, "editor"> = {
  char: "/",
  placement: "bottom-start",
  offset: { mainAxis: 8 },
  startOfLine: false,
  allowSpaces: true,
  items: ({ query }) =>
    COMMANDS.filter((item) =>
      `${item.title} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase()),
    ),
  command: ({ editor, range, props }) => props.run({ editor, range }),
  render: () => {
    let component: ReactRenderer<SlashCommandListRef> | null = null;
    let unmount: (() => void) | null = null;
    return {
      onStart: (props) => {
        component = new ReactRenderer(SlashCommandList, { props, editor: props.editor });
        // The product composer is a modal. Tiptap mounts suggestions under document.body,
        // so the renderer needs to join the application's overlay layer explicitly.
        component.element.style.zIndex = "120";
        unmount = props.mount(component.element);
      },
      onUpdate: (props) => component?.updateProps(props),
      onKeyDown: (props) => {
        if (props.event.key === "Escape") return true;
        return component?.ref?.onKeyDown(props) ?? false;
      },
      onExit: () => {
        unmount?.();
        component?.destroy();
        component = null;
        unmount = null;
      },
    };
  },
};

export const RichTextSlashCommand = Extension.create({
  name: "richTextSlashCommand",
  addProseMirrorPlugins() {
    return [Suggestion({ editor: this.editor, ...suggestion })];
  },
});
