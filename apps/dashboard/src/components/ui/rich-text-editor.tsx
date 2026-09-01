"use client";

import { Extension, getMarkRange, mergeAttributes, Node } from "@tiptap/core";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
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
  Menu,
  Pencil,
  Pilcrow,
  Quote,
  Redo2,
  RemoveFormatting,
  SeparatorHorizontal,
  Strikethrough,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useId, useReducer, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MediaLibraryDialog } from "@/features/media/media-library-dialog";
import { uploadMediaFile } from "@/features/media/upload-media-file";
import { cn } from "@/lib/utils";
import { RichTextSlashCommand } from "./rich-text-slash-command";

const RichImage = Node.create({
  name: "image",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
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

const RichTextShortcuts = Extension.create({
  name: "richTextShortcuts",
  priority: 1_000,
  addKeyboardShortcuts() {
    return {
      "Mod-k": () => {
        this.editor.view.dom.dispatchEvent(new CustomEvent("rich-text-link-open"));
        return true;
      },
      "Mod-Shift-b": () => {
        // Consume the exact chord even when blockquote cannot be applied. Otherwise
        // ProseMirror can fall through to the less-specific Mod-b bold shortcut.
        this.editor.chain().focus().toggleBlockquote().run();
        return true;
      },
    };
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
  hint?: string;
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
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <span>{control.label}</span>
            {control.shortcut ? <Kbd>{control.shortcut}</Kbd> : null}
          </span>
          {control.hint ? <span className="text-xs opacity-75">{control.hint}</span> : null}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function LinkControl({ editor, shortcut }: { editor: Editor; shortcut: string }) {
  const labelId = useId();
  const urlId = useId();
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState("");
  const [label, setLabel] = useState("");
  const [range, setRange] = useState({ from: 0, to: 0 });
  const [editingExisting, setEditingExisting] = useState(false);

  const prepare = useCallback(() => {
    const selection = editor.state.selection;
    const linkMark = editor.schema.marks.link;
    const existingRange = linkMark ? getMarkRange(selection.$from, linkMark) : undefined;
    const nextRange = existingRange ?? { from: selection.from, to: selection.to };
    setRange(nextRange);
    setEditingExisting(Boolean(existingRange));
    setHref(existingRange ? String(editor.getAttributes("link").href ?? "") : "");
    setLabel(editor.state.doc.textBetween(nextRange.from, nextRange.to, " "));
  }, [editor]);

  useEffect(() => {
    const openLink = () => {
      prepare();
      setOpen(true);
    };
    editor.view.dom.addEventListener("rich-text-link-open", openLink);
    return () => editor.view.dom.removeEventListener("rich-text-link-open", openLink);
  }, [editor, prepare]);

  function applyLink() {
    const nextHref = href.trim();
    if (!nextHref) return;
    const nextLabel = label.trim() || nextHref;
    editor
      .chain()
      .focus()
      .insertContentAt(range, {
        type: "text",
        text: nextLabel,
        marks: [{ type: "link", attrs: { href: nextHref } }],
      })
      .setTextSelection(range.from + nextLabel.length)
      .run();
    setOpen(false);
  }

  return (
    <Popover
      onOpenChange={(next) => {
        setOpen(next);
        if (next) prepare();
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
          <span className="flex items-center gap-2">
            <span>Add or edit link</span>
            <Kbd>{shortcut}</Kbd>
          </span>
        </TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-80 p-3">
        <form
          className="flex flex-col gap-3"
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
              editor.commands.focus();
            }
          }}
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            applyLink();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" htmlFor={labelId}>
              Link text
            </label>
            <Input
              id={labelId}
              autoFocus
              onChange={(event) => setLabel(event.currentTarget.value)}
              placeholder="Text shoppers will see"
              value={label}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" htmlFor={urlId}>
              Destination
            </label>
            <Input
              id={urlId}
              onChange={(event) => setHref(event.currentTarget.value)}
              placeholder="https://example.com or /products"
              value={href}
            />
            <p className="text-xs text-muted-foreground">
              If link text is empty, the destination becomes the visible text.
            </p>
          </div>
          <div className="flex items-center justify-end gap-2">
            {editingExisting ? (
              <Button
                onClick={() => {
                  editor.chain().focus().setTextSelection(range).unsetLink().run();
                  setOpen(false);
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                Remove
              </Button>
            ) : null}
            <Button disabled={!href.trim()} size="sm" type="submit">
              Apply link
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function ImageControl({
  compactImages,
  editor,
  onCompactImagesChange,
}: {
  compactImages: boolean;
  editor: Editor;
  onCompactImagesChange: (compact: boolean) => void;
}) {
  const altId = useId();
  const compactId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [alt, setAlt] = useState("");
  const [editingImage, setEditingImage] = useState(false);

  const prepare = useCallback(() => {
    const selection = editor.state.selection;
    const isImage = selection instanceof NodeSelection && selection.node.type.name === "image";
    setEditingImage(isImage);
    setAlt(isImage ? String(selection.node.attrs.alt ?? "") : "");
  }, [editor]);

  useEffect(() => {
    const openImages = () => {
      prepare();
      setOpen(true);
    };
    editor.view.dom.addEventListener("rich-text-image-open", openImages);
    return () => editor.view.dom.removeEventListener("rich-text-image-open", openImages);
  }, [editor, prepare]);

  function insertImages(images: Array<{ alt: string; src: string }>) {
    if (!images.length) return;
    const content = images.map(({ alt, src }) => ({ type: "image", attrs: { alt, src } }));
    editor.chain().focus().insertContent(content).run();
    setOpen(false);
  }

  async function uploadImages(files: FileList | null) {
    const selected = Array.from(files ?? []);
    if (!selected.length) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of selected) {
        uploaded.push({ src: await uploadMediaFile(file), alt: file.name });
      }
      insertImages(uploaded);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Images could not be uploaded.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeSelectedImage() {
    editor.chain().focus().deleteSelection().run();
    setOpen(false);
  }

  function saveAltText() {
    if (!editingImage) return;
    editor.chain().focus().updateAttributes("image", { alt: alt.trim() }).run();
    setOpen(false);
  }

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) prepare();
        }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                aria-label="Insert images"
                className="size-8"
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <ImageIcon aria-hidden />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6}>
            {editingImage ? "Edit image" : "Insert images"}
          </TooltipContent>
        </Tooltip>
        <PopoverContent align="start" className="w-72 p-3">
          <div className="flex flex-col gap-1">
            <strong className="text-sm font-medium">
              {editingImage ? "Edit image" : "Insert images"}
            </strong>
            <p className="text-xs text-muted-foreground">
              {editingImage
                ? "Update its description, replace it, or remove it."
                : "Upload new files or choose several existing images."}
            </p>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {editingImage ? (
              <div className="flex flex-col gap-1.5 pb-1">
                <label className="text-xs font-medium" htmlFor={altId}>
                  Alternative text
                </label>
                <Input
                  id={altId}
                  onChange={(event) => setAlt(event.currentTarget.value)}
                  placeholder="Describe the image"
                  value={alt}
                />
                <Button onClick={saveAltText} size="sm" type="button">
                  Save description
                </Button>
              </div>
            ) : null}
            <input
              accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
              className="sr-only"
              multiple={!editingImage}
              onChange={(event) => void uploadImages(event.currentTarget.files)}
              ref={inputRef}
              type="file"
            />
            <Button
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              size="sm"
              type="button"
              variant="outline"
            >
              <Upload data-icon="inline-start" />
              {uploading ? "Uploading…" : editingImage ? "Replace by uploading" : "Upload images"}
            </Button>
            <Button
              onClick={() => {
                setOpen(false);
                setLibraryOpen(true);
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              <ImageIcon data-icon="inline-start" />
              {editingImage ? "Replace from library" : "Choose from library"}
            </Button>
            {editingImage ? (
              <Button onClick={removeSelectedImage} size="sm" type="button" variant="ghost">
                <Trash2 data-icon="inline-start" />
                Remove image
              </Button>
            ) : null}
            <div className="mt-1 flex items-center justify-between gap-3 border-t pt-3">
              <label className="text-xs text-muted-foreground" htmlFor={compactId}>
                Compact images while editing
              </label>
              <Switch
                checked={compactImages}
                id={compactId}
                onCheckedChange={onCompactImagesChange}
                size="sm"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <MediaLibraryDialog
        onOpenChange={setLibraryOpen}
        onSelect={(assets) =>
          insertImages(
            assets.flatMap((asset) =>
              asset.publicUrl
                ? [{ src: asset.publicUrl, alt: asset.altText ?? asset.filename ?? "" }]
                : [],
            ),
          )
        }
        open={libraryOpen}
        selectionMode={editingImage ? "single" : "multiple"}
        showTrigger={false}
      />
    </>
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
  const [compactImages, setCompactImages] = useState(true);
  const [, refreshToolbar] = useReducer((value) => value + 1, 0);
  const [primaryShortcut, setPrimaryShortcut] = useState("Ctrl");
  const editor = useEditor({
    content: value,
    editorProps: {
      attributes: {
        "aria-label": ariaLabel ?? "Rich text editor",
        class:
          "tiptap min-h-44 max-h-80 overflow-y-auto overscroll-contain px-4 py-3 text-sm leading-6 outline-none [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_hr]:my-5 [&_hr]:cursor-pointer [&_hr.ProseMirror-selectednode]:ring-2 [&_hr.ProseMirror-selectednode]:ring-primary/50 [&_img]:my-4 [&_img]:max-h-96 [&_img]:max-w-full [&_img]:rounded-lg [&_img]:object-contain [&_li]:ml-5 [&_ol]:list-decimal [&_p+p]:mt-2 [&_ul]:list-disc",
        ...(id ? { id } : {}),
      },
      handleDOMEvents: {
        blur: () => {
          onBlur?.();
          return false;
        },
        keydown: (_view, event) => {
          // Keep product-form and dashboard shortcuts from handling editor keystrokes.
          // Returning false deliberately leaves the event available to ProseMirror's keymaps.
          event.stopPropagation();
          return false;
        },
        mousedown: (_view, event) => {
          const link = (event.target as HTMLElement | null)?.closest("a");
          if (!link) return false;
          event.preventDefault();
          event.stopPropagation();
          return true;
        },
      },
      handleClick: (view, position, event) => {
        const link = (event.target as HTMLElement | null)?.closest("a");
        if (!link) return false;
        event.preventDefault();
        view.dispatch(
          view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(position))),
        );
        queueMicrotask(() => view.dom.dispatchEvent(new CustomEvent("rich-text-link-open")));
        return true;
      },
      handleClickOn: (view, _position, node, nodePosition) => {
        if (node.type.name === "horizontalRule") {
          view.dispatch(
            view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePosition)),
          );
          return true;
        }
        if (node.type.name !== "image") return false;
        view.dispatch(
          view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePosition)),
        );
        queueMicrotask(() => view.dom.dispatchEvent(new CustomEvent("rich-text-image-open")));
        return true;
      },
    },
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      RichImage,
      RichTextSlashCommand,
      RichTextShortcuts,
    ],
    immediatelyRender: false,
    onUpdate: ({ editor: nextEditor }) => {
      onChange(nextEditor.isEmpty ? "" : nextEditor.getHTML());
      refreshToolbar();
    },
    onSelectionUpdate: () => refreshToolbar(),
    onTransaction: () => refreshToolbar(),
  });

  useEffect(() => {
    if (!editor || editor.getHTML() === value) return;
    if (!value && editor.isEmpty) return;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(mode === "edit");
  }, [editor, mode]);

  useEffect(() => {
    setPrimaryShortcut(/Mac|iPhone|iPad/i.test(navigator.platform) ? "⌘" : "Ctrl");
  }, []);

  if (!editor) {
    return (
      <div className={cn("min-h-52 animate-pulse rounded-xl border bg-muted/40", className)} />
    );
  }
  const inlineControls: EditorControl[] = [
    {
      label: "Bold",
      shortcut: `${primaryShortcut} B`,
      active: editor.isActive("bold"),
      icon: Bold,
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: "Italic",
      shortcut: `${primaryShortcut} I`,
      active: editor.isActive("italic"),
      icon: Italic,
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: "Strikethrough",
      shortcut: `${primaryShortcut} Shift S`,
      active: editor.isActive("strike"),
      icon: Strikethrough,
      run: () => editor.chain().focus().toggleStrike().run(),
    },
  ];
  const headingControls: EditorControl[] = [
    {
      label: "Heading 1",
      shortcut: `${primaryShortcut} Alt 1`,
      active: editor.isActive("heading", { level: 1 }),
      icon: Heading1,
      run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      label: "Heading 2",
      shortcut: `${primaryShortcut} Alt 2`,
      active: editor.isActive("heading", { level: 2 }),
      icon: Heading2,
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: "Heading 3",
      shortcut: `${primaryShortcut} Alt 3`,
      active: editor.isActive("heading", { level: 3 }),
      icon: Heading3,
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      label: "Paragraph",
      shortcut: `${primaryShortcut} Alt 0`,
      active: editor.isActive("paragraph"),
      icon: Pilcrow,
      run: () => editor.chain().focus().setParagraph().run(),
    },
  ];
  const blockControls: EditorControl[] = [
    {
      label: "Numbered list",
      shortcut: `${primaryShortcut} Shift 7`,
      active: editor.isActive("orderedList"),
      icon: ListOrdered,
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "Bulleted list",
      shortcut: `${primaryShortcut} Shift 8`,
      active: editor.isActive("bulletList"),
      icon: List,
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Quote",
      shortcut: `${primaryShortcut} Shift B`,
      active: editor.isActive("blockquote"),
      icon: Quote,
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
  ];
  const historyControls: EditorControl[] = [
    {
      label: "Undo",
      shortcut: `${primaryShortcut} Z`,
      disabled: !editor.can().undo(),
      icon: Undo2,
      run: () => editor.chain().focus().undo().run(),
    },
    {
      label: "Redo",
      shortcut: `${primaryShortcut} Shift Z`,
      disabled: !editor.can().redo(),
      icon: Redo2,
      run: () => editor.chain().focus().redo().run(),
    },
  ];
  const documentControls: EditorControl[] = [
    {
      label: "Horizontal divider",
      hint: "Click an existing divider to select and remove it.",
      icon: SeparatorHorizontal,
      run: () => editor.chain().focus().setHorizontalRule().run(),
    },
    {
      label: "Clear formatting",
      icon: RemoveFormatting,
      run: () => editor.chain().focus().unsetAllMarks().clearNodes().run(),
    },
  ];

  return (
    <TooltipProvider>
      <div className="relative" data-rich-text-editor-root="">
        <div
          className={cn(
            "@container/rich-editor overflow-hidden rounded-xl border bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20",
            className,
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b bg-muted/30 p-1.5">
            <SegmentedControl
              ariaLabel="Description mode"
              className="w-52"
              fullWidth={false}
              onChange={setMode}
              options={[
                {
                  id: "edit",
                  label: (
                    <>
                      <Pencil aria-hidden className="size-3.5" />
                      Edit
                    </>
                  ),
                },
                {
                  id: "preview",
                  label: (
                    <>
                      <Eye aria-hidden className="size-3.5" />
                      Preview
                    </>
                  ),
                },
              ]}
              size="sm"
              value={mode}
            />
            <span className="hidden text-xs text-muted-foreground @md/rich-editor:inline">
              Rich description
            </span>
          </div>

          {mode === "edit" ? (
            <>
              <div
                aria-label="Text formatting"
                className="flex items-center gap-0.5 border-b bg-muted/15 p-1"
                role="toolbar"
              >
                {inlineControls.map((control) => (
                  <ToolbarButton control={control} key={control.label} />
                ))}
                <div className="hidden min-w-0 items-center gap-0.5 @2xl/rich-editor:flex">
                  <span aria-hidden className="mx-1 h-5 w-px bg-border" />
                  {headingControls.map((control) => (
                    <ToolbarButton control={control} key={control.label} />
                  ))}
                  <span aria-hidden className="mx-1 h-5 w-px bg-border" />
                  {blockControls.map((control) => (
                    <ToolbarButton control={control} key={control.label} />
                  ))}
                  <span aria-hidden className="mx-1 h-5 w-px bg-border" />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      aria-label="Text style"
                      aria-pressed={headingControls.some((control) => control.active)}
                      className="@2xl/rich-editor:hidden"
                      size="icon-sm"
                      type="button"
                      variant={
                        headingControls.some((control) => control.active) ? "secondary" : "ghost"
                      }
                    >
                      <Pilcrow aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-52">
                    <DropdownMenuLabel>Text style</DropdownMenuLabel>
                    <DropdownMenuGroup>
                      {headingControls.map((control) => (
                        <DropdownMenuItem key={control.label} onSelect={control.run}>
                          <control.icon aria-hidden />
                          <span>{control.label}</span>
                          {control.shortcut ? (
                            <DropdownMenuShortcut>{control.shortcut}</DropdownMenuShortcut>
                          ) : null}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                <LinkControl editor={editor} shortcut={`${primaryShortcut} K`} />
                <ImageControl
                  compactImages={compactImages}
                  editor={editor}
                  onCompactImagesChange={setCompactImages}
                />
                <div className="hidden min-w-0 items-center gap-0.5 @2xl/rich-editor:flex">
                  <span aria-hidden className="mx-1 h-5 w-px bg-border" />
                  {documentControls.map((control) => (
                    <ToolbarButton control={control} key={control.label} />
                  ))}
                  <span aria-hidden className="mx-1 h-5 w-px bg-border" />
                  {historyControls.map((control) => (
                    <ToolbarButton control={control} key={control.label} />
                  ))}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      aria-label="More formatting options"
                      className="ml-auto @2xl/rich-editor:hidden"
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <Menu aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Blocks</DropdownMenuLabel>
                    <DropdownMenuGroup>
                      {blockControls.map((control) => (
                        <DropdownMenuItem key={control.label} onSelect={control.run}>
                          <control.icon aria-hidden />
                          <span>{control.label}</span>
                          {control.shortcut ? (
                            <DropdownMenuShortcut>{control.shortcut}</DropdownMenuShortcut>
                          ) : null}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Document</DropdownMenuLabel>
                    <DropdownMenuGroup>
                      {documentControls.map((control) => (
                        <DropdownMenuItem key={control.label} onSelect={control.run}>
                          <control.icon aria-hidden />
                          <span>{control.label}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>History</DropdownMenuLabel>
                    <DropdownMenuGroup>
                      {historyControls.map((control) => (
                        <DropdownMenuItem
                          key={control.label}
                          onSelect={control.run}
                          {...(control.disabled === undefined
                            ? {}
                            : { disabled: control.disabled })}
                        >
                          <control.icon aria-hidden />
                          <span>{control.label}</span>
                          {control.shortcut ? (
                            <DropdownMenuShortcut>{control.shortcut}</DropdownMenuShortcut>
                          ) : null}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div
                className={cn(
                  "relative",
                  compactImages &&
                    "[&_.tiptap_img]:!my-2 [&_.tiptap_img]:!max-h-36 [&_.tiptap_img]:!max-w-56 [&_.tiptap_img]:cursor-pointer",
                )}
              >
                {editor.isActive("horizontalRule") ? (
                  <div className="absolute top-2 right-2 z-10">
                    <Button
                      onClick={() => editor.chain().focus().deleteSelection().run()}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      <Trash2 data-icon="inline-start" />
                      Remove divider
                    </Button>
                  </div>
                ) : null}
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
      </div>
    </TooltipProvider>
  );
}
