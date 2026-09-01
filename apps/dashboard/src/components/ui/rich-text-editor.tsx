"use client";

import {
  RiBold,
  RiDoubleQuotesL,
  RiH2,
  RiH3,
  RiItalic,
  RiListOrdered,
  RiListUnordered,
  RiStrikethrough,
} from "@remixicon/react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RichTextEditorProps = {
  "aria-label"?: string;
  className?: string;
  id?: string;
  onBlur?: () => void;
  onChange: (html: string) => void;
  placeholder?: string;
  value: string;
};

export function RichTextEditor({
  "aria-label": ariaLabel,
  className,
  id,
  onBlur,
  onChange,
  placeholder,
  value,
}: RichTextEditorProps) {
  const editor = useEditor({
    content: value,
    editorProps: {
      attributes: {
        "aria-label": ariaLabel ?? "Rich text editor",
        class:
          "tiptap min-h-36 px-3 py-3 text-sm leading-6 outline-none [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_p+p]:mt-2 [&_ul]:list-disc",
        ...(id ? { id } : {}),
      },
      handleDOMEvents: {
        blur: () => {
          onBlur?.();
          return false;
        },
      },
    },
    extensions: [StarterKit],
    immediatelyRender: false,
    onUpdate: ({ editor: nextEditor }) => {
      onChange(nextEditor.isEmpty ? "" : nextEditor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor || editor.getHTML() === value) return;
    if (!value && editor.isEmpty) return;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  if (!editor) {
    return (
      <div className={cn("min-h-44 animate-pulse rounded-md border bg-muted/40", className)} />
    );
  }

  const controls = [
    {
      label: "Bold",
      active: editor.isActive("bold"),
      icon: RiBold,
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: "Italic",
      active: editor.isActive("italic"),
      icon: RiItalic,
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: "Strikethrough",
      active: editor.isActive("strike"),
      icon: RiStrikethrough,
      run: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      label: "Heading 2",
      active: editor.isActive("heading", { level: 2 }),
      icon: RiH2,
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: "Heading 3",
      active: editor.isActive("heading", { level: 3 }),
      icon: RiH3,
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      label: "Bulleted list",
      active: editor.isActive("bulletList"),
      icon: RiListUnordered,
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Numbered list",
      active: editor.isActive("orderedList"),
      icon: RiListOrdered,
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "Quote",
      active: editor.isActive("blockquote"),
      icon: RiDoubleQuotesL,
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
  ];

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20",
        className,
      )}
    >
      <div
        aria-label="Text formatting"
        className="flex flex-wrap gap-0.5 border-b bg-muted/40 p-1"
        role="toolbar"
      >
        {controls.map((control) => (
          <Button
            aria-label={control.label}
            aria-pressed={control.active}
            className="size-8"
            key={control.label}
            onClick={control.run}
            size="icon-sm"
            title={control.label}
            type="button"
            variant={control.active ? "secondary" : "ghost"}
          >
            <control.icon aria-hidden className="size-4" />
          </Button>
        ))}
      </div>
      <div className="relative">
        {editor.isEmpty && placeholder ? (
          <span className="pointer-events-none absolute top-3 left-3 text-sm text-muted-foreground">
            {placeholder}
          </span>
        ) : null}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
