import { useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Heading2,
  Quote,
  Undo2,
  Redo2,
  Eraser,
} from "lucide-react";

/**
 * A small RTL-first rich text editor built on contentEditable.
 *
 * The value is HTML. It is written into the element only when it differs from
 * what the element already holds, so typing never fights the React re-render.
 */

interface RichTextProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: number;
}

interface ToolButton {
  icon: typeof Bold;
  label: string;
  command: string;
  argument?: string;
}

const TOOLS: ToolButton[][] = [
  [
    { icon: Bold, label: "عريض", command: "bold" },
    { icon: Italic, label: "مائل", command: "italic" },
    { icon: Underline, label: "تسطير", command: "underline" },
  ],
  [
    { icon: Heading2, label: "عنوان", command: "formatBlock", argument: "<h3>" },
    { icon: Quote, label: "اقتباس", command: "formatBlock", argument: "<blockquote>" },
  ],
  [
    { icon: List, label: "قائمة نقطية", command: "insertUnorderedList" },
    { icon: ListOrdered, label: "قائمة مرقمة", command: "insertOrderedList" },
  ],
  [
    { icon: Undo2, label: "تراجع", command: "undo" },
    { icon: Redo2, label: "إعادة", command: "redo" },
    { icon: Eraser, label: "إزالة التنسيق", command: "removeFormat" },
  ],
];

export function RichText({
  value,
  onChange,
  placeholder = "اكتب هنا…",
  disabled = false,
  minHeight = 160,
}: RichTextProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);

  // Only push the value in when it is genuinely out of sync, otherwise the
  // caret jumps to the start on every keystroke.
  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== value) el.innerHTML = value || "";
  }, [value]);

  function exec(command: string, argument?: string) {
    ref.current?.focus();
    document.execCommand(command, false, argument);
    onChange(ref.current?.innerHTML ?? "");
  }

  /** Strip formatting from pasted content so the markup stays predictable. */
  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    onChange(ref.current?.innerHTML ?? "");
  }

  const isEmpty = !value || value === "<br>" || value === "<p><br></p>";

  return (
    <div
      className={`rounded-lg border transition-colors ${
        focused ? "border-primary ring-1 ring-primary/30" : "border-input"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-1 border-b border-input bg-muted/40 px-2 py-1.5">
        {TOOLS.map((group, gi) => (
          <div key={gi} className="flex items-center gap-0.5">
            {gi > 0 && <span className="mx-1 h-4 w-px bg-border" />}
            {group.map((t) => (
              <button
                key={t.command + (t.argument ?? "")}
                type="button"
                title={t.label}
                aria-label={t.label}
                disabled={disabled}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => exec(t.command, t.argument)}
                className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:cursor-not-allowed"
              >
                <t.icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="relative">
        {isEmpty && !focused && (
          <span className="pointer-events-none absolute right-3 top-3 text-sm text-muted-foreground">
            {placeholder}
          </span>
        )}
        <div
          ref={ref}
          contentEditable={!disabled}
          dir="rtl"
          role="textbox"
          aria-multiline="true"
          suppressContentEditableWarning
          onInput={() => onChange(ref.current?.innerHTML ?? "")}
          onPaste={handlePaste}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ minHeight }}
          className="prose-sm max-w-none px-3 py-3 text-sm leading-relaxed outline-none [&_blockquote]:border-r-2 [&_blockquote]:border-primary [&_blockquote]:pr-3 [&_blockquote]:text-muted-foreground [&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-base [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pr-5 [&_ul]:list-disc [&_ul]:pr-5"
        />
      </div>
    </div>
  );
}

/** Tags and attributes a submission is allowed to carry. */
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "b",
    "strong",
    "i",
    "em",
    "u",
    "s",
    "h3",
    "h4",
    "ul",
    "ol",
    "li",
    "blockquote",
    "div",
    "span",
    "a",
    "code",
    "pre",
  ],
  ALLOWED_ATTR: ["href", "target", "rel", "dir"],
};

/** Strip anything executable out of author-supplied HTML. */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html || "", SANITIZE_CONFIG);
}

// An address typed or pasted as text: http(s)://… or www.…, stopping before
// trailing punctuation so «راجع الرابط https://x.ps/a.» links without the dot.
const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"'«»]+[^\s<>"'«».,;:!?،؛)\]]/gi;

function hrefOf(url: string): string {
  return url.toLowerCase().startsWith("www.") ? `https://${url}` : url;
}

/**
 * Turn addresses written as plain text into links, in HTML that has already
 * been sanitised. People paste a link into a post and expect to click it;
 * the editor stores it as text. Only text outside an existing link is
 * touched, every link opens in a new tab, and only http(s) addresses are
 * made — nothing here can introduce a script URL.
 */
export function linkifyHtml(html: string): string {
  if (!html || typeof document === "undefined") return html;
  const box = document.createElement("div");
  box.innerHTML = html;
  const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  while (walker.nextNode()) texts.push(walker.currentNode as Text);
  for (const node of texts) {
    if (node.parentElement?.closest("a")) continue;
    const text = node.data;
    const pattern = new RegExp(URL_PATTERN.source, "gi");
    let match: RegExpExecArray | null;
    let last = 0;
    const out = document.createDocumentFragment();
    while ((match = pattern.exec(text))) {
      out.append(text.slice(last, match.index));
      const a = document.createElement("a");
      a.href = hrefOf(match[0]);
      a.textContent = match[0];
      a.dir = "ltr";
      out.append(a);
      last = match.index + match[0].length;
    }
    if (!last) continue;
    out.append(text.slice(last));
    node.replaceWith(out);
  }
  box.querySelectorAll("a[href]").forEach((a) => {
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer");
    a.classList.add("ms-link");
  });
  return box.innerHTML;
}

/** Sanitised, with plain-text addresses made clickable — for showing a post. */
export function displayHtml(html: string): string {
  return linkifyHtml(sanitizeHtml(html));
}

/** Plain text (a comment, a message) with its addresses as links. */
export function LinkifiedText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const pattern = new RegExp(URL_PATTERN.source, "gi");
  let match: RegExpExecArray | null;
  let last = 0;
  while ((match = pattern.exec(text || ""))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(
      <a
        key={match.index}
        href={hrefOf(match[0])}
        target="_blank"
        rel="noopener noreferrer"
        dir="ltr"
        className="ms-link"
      >
        {match[0]}
      </a>,
    );
    last = match.index + match[0].length;
  }
  if (last < (text || "").length) parts.push(text.slice(last));
  return <>{parts}</>;
}

/**
 * Read-only renderer. Submissions are written by students and read by
 * teachers, so the HTML is always sanitised before it reaches the DOM.
 */
export function RichTextView({ html, className = "" }: { html: string; className?: string }) {
  const clean = useMemo(() => displayHtml(html), [html]);
  if (!clean.trim()) return <p className="text-sm text-muted-foreground">لا يوجد محتوى.</p>;
  return (
    <div
      dir="rtl"
      className={`prose-sm max-w-none text-sm leading-relaxed [&_blockquote]:border-r-2 [&_blockquote]:border-primary [&_blockquote]:pr-3 [&_blockquote]:text-muted-foreground [&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-base [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pr-5 [&_ul]:list-disc [&_ul]:pr-5 ${className}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
