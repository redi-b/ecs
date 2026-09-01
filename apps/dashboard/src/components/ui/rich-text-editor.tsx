"use client";

import { mergeAttributes, Node } from "@tiptap/core";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Eye,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Pencil,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MediaLibraryDialog } from "@/features/media/media-library-dialog";
import { cn } from "@/lib/utils";

const RichImage = Node.create({
  name: "image",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "" },
      title: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: "img[src]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes)];
  },
});

type RichTextEditorProps = {
  "aria-label"?: string;
  className?: string;
  id?: string;
  onBlur?: () => void;
  onChange: (html: string) => void;
  placeholder?: string;
  value: string;
};

type EditorControl = {
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  icon: typeof Bold;
  run: () => void;
};

function ToolbarButton({ control }: { control: EditorControl }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={control.label}
          aria-pressed={control.active}
          className="size-8"
          disabled={control.disabled}
          onClick={control.run}
          size="icon-sm"
          type="button"
          variant={control.active ? "secondary" : "ghost"}
        >
          <control.icon aria-hidden className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {control.label}
        {control.shortcut ? <Kbd>{control.shortcut}</Kbd> : null}
      </TooltipContent>
    </Tooltip>
  );
}

function LinkControl({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState("");

  function applyLink() {
    const next = href.trim();
    if (!next) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: next }).run();
    setOpen(false);
  }

  return (
    <Popover
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setHref(editor.getAttributes("link").href ?? "");
      }}
      open={open}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              aria-label="Add or edit link"
              aria-pressed={editor.isActive("link")}
              className="size-8"
              size="icon-sm"
              type="button"
              variant={editor.isActive("link") ? "secondary" : "ghost"}
            >
              <Link2 className="size-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          Add or edit link
        </TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-80 p-3">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            applyLink();
          }}
        >
          <Input
            aria-label="Link URL"
            autoFocus
            onChange={(event) => setHref(event.currentTarget.value)}
            placeholder="https://example.com"
            type="url"
            value={href}
          />
          <Button size="sm" type="submit">
            Apply
          </Button>
        </form>
        {editor.isActive("link") ? (
          <Button
            className="mt-2"
            onClick={() => {
              editor.chain().focus().unsetLink().run();
              setOpen(false);
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            Remove link
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

export function RichTextEditor({
  "aria-label": ariaLabel,
  className,
  id,
  onBlur,
  onChange,
  placeholder,
  value,
}: RichTextEditorProps) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const editor = useEditor({
    content: value,
    editorProps: {
      attributes: {
        "aria-label": ariaLabel ?? "Rich text editor",
        class:
          "tiptap min-h-44 px-4 py-3 text-sm leading-6 outline-none [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_img]:my-4 [&_img]:max-h-96 [&_img]:max-w-full [&_img]:rounded-lg [&_img]:object-contain [&_li]:ml-5 [&_ol]:list-decimal [&_p+p]:mt-2 [&_ul]:list-disc",
        ...(id ? { id } : {}),
      },
      handleDOMEvents: {
        blur: () => {
          onBlur?.();
          return false;
        },
        keydown: (_view, event) => {
          event.stopPropagation();
          return false;
        },
      },
    },
    extensions: [StarterKit.configure({ link: { openOnClick: false } }), RichImage],
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

  useEffect(() => {
    editor?.setEditable(mode === "edit");
  }, [editor, mode]);

  if (!editor) {
    return (
      <div className={cn("min-h-52 animate-pulse rounded-xl border bg-muted/40", className)} />
    );
  }

  const controls: EditorControl[] = [
    {
      label: "Bold",
      shortcut: "Mod B",
      active: editor.isActive("bold"),
      icon: Bold,
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: "Italic",
      shortcut: "Mod I",
      active: editor.isActive("italic"),
      icon: Italic,
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: "Strikethrough",
      active: editor.isActive("strike"),
      icon: Strikethrough,
      run: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      label: "Heading 1",
      active: editor.isActive("heading", { level: 1 }),
      icon: Heading1,
      run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      label: "Heading 2",
      active: editor.isActive("heading", { level: 2 }),
      icon: Heading2,
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: "Heading 3",
      active: editor.isActive("heading", { level: 3 }),
      icon: Heading3,
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      label: "Bulleted list",
      active: editor.isActive("bulletList"),
      icon: List,
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Numbered list",
      active: editor.isActive("orderedList"),
      icon: ListOrdered,
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "Quote",
      active: editor.isActive("blockquote"),
      icon: Quote,
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      label: "Undo",
      shortcut: "Mod Z",
      disabled: !editor.can().undo(),
      icon: Undo2,
      run: () => editor.chain().focus().undo().run(),
    },
    {
      label: "Redo",
      shortcut: "Mod Shift Z",
      disabled: !editor.can().redo(),
      icon: Redo2,
      run: () => editor.chain().focus().redo().run(),
    },
  ];

  return (
    <TooltipProvider>
      <div
        className={cn(
          "overflow-hidden rounded-xl border bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20",
          className,
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b bg-muted/30 p-1.5">
          <Tabs onValueChange={(next) => setMode(next as "edit" | "preview")} value={mode}>
            <TabsList className="h-8">
              <TabsTrigger className="gap-1.5 px-2.5" value="edit">
                <Pencil className="size-3.5" />
                Edit
              </TabsTrigger>
              <TabsTrigger className="gap-1.5 px-2.5" value="preview">
                <Eye className="size-3.5" />
                Preview
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <span className="hidden text-xs text-muted-foreground sm:inline">Rich description</span>
        </div>

        {mode === "edit" ? (
          <>
            <div
              aria-label="Text formatting"
              className="flex flex-wrap items-center gap-0.5 border-b bg-muted/15 p-1"
              role="toolbar"
            >
              {controls.slice(0, 9).map((control) => (
                <ToolbarButton control={control} key={control.label} />
              ))}
              <span aria-hidden className="mx-1 h-5 w-px bg-border" />
              <LinkControl editor={editor} />
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <MediaLibraryDialog
                      onSelect={(assets) => {
                        const asset = assets[0];
                        if (!asset?.publicUrl) return;
                        editor
                          .chain()
                          .focus()
                          .insertContent({
                            type: "image",
                            attrs: {
                              src: asset.publicUrl,
                              alt: asset.altText ?? asset.filename ?? "",
                            },
                          })
                          .run();
                      }}
                      selectionMode="single"
                      triggerClassName="size-8 p-0"
                      triggerContent={
                        <>
                          <ImageIcon className="size-4" />
                          <span className="sr-only">Insert image</span>
                        </>
                      }
                      triggerSize="sm"
                      triggerVariant="ghost"
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6}>
                  Insert image
                </TooltipContent>
              </Tooltip>
              <span aria-hidden className="mx-1 h-5 w-px bg-border" />
              {controls.slice(9).map((control) => (
                <ToolbarButton control={control} key={control.label} />
              ))}
            </div>
            <div className="relative">
              {editor.isEmpty && placeholder ? (
                <span className="pointer-events-none absolute top-3 left-4 text-sm text-muted-foreground">
                  {placeholder}
                </span>
              ) : null}
              <EditorContent editor={editor} />
            </div>
          </>
        ) : (
          <div className="min-h-52 px-4 py-4">
            {editor.isEmpty ? (
              <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
            ) : (
              <EditorContent editor={editor} />
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
