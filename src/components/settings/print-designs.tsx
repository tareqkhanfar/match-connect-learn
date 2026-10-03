import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  Code2,
  FileImage,
  HelpCircle,
  Loader2,
  Palette,
  Printer,
  RotateCcw,
  Save,
  Search,
  Stamp,
  Undo2,
  X,
} from "lucide-react";
import { Pill, SectionCard } from "@/components/shared/ui-kit";
import { ErrorState, Skeleton } from "@/components/shared/states";
import { useConfirm } from "@/components/shared/confirm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fileUrl } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/error-message";
import { printHtml, uploadFormLogo } from "@/lib/api/hooks";
import {
  usePreviewPrintDesign,
  usePrintDesign,
  usePrintDesigns,
  useResetPrintDesign,
  useSavePrintDesign,
  type PrintDesign,
  type PrintDesignDraft,
  type PrintDesignSource,
  type PrintOrientation,
  type PrintTheme,
} from "@/lib/api/print-designs";
import { cn } from "@/lib/utils";

/**
 * «تصاميم الطباعة» in Settings: pick a printed page by name, then edit how it
 * prints — letterhead image, theme, orientation, the Jinja/HTML design and its
 * CSS — with the page redrawn beside the editor as it changes, the way the
 * forms designer works. Saving and restoring the default are the
 * administration's alone; the server refuses anyone else.
 */
export function PrintDesignsSection() {
  const [open, setOpen] = useState<string | null>(null);
  return open ? (
    <PrintDesignEditor document={open} onClose={() => setOpen(null)} />
  ) : (
    <PrintDesignList onOpen={setOpen} />
  );
}

const SOURCE_TONE: Record<PrintDesignSource, "primary" | "info" | "muted"> = {
  saved: "primary",
  school: "info",
  builtin: "muted",
};

/** Arabic search that ignores hamza forms, taa marbuta and diacritics. */
const fold = (text: string) =>
  text
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");

function PrintDesignList({ onOpen }: { onOpen: (document: string) => void }) {
  const { data, isLoading, error, refetch } = usePrintDesigns();
  const [q, setQ] = useState("");
  const needle = fold(q.trim());
  const rows = (data?.documents ?? []).filter(
    (r) => !needle || fold(`${r.title} ${r.page} ${r.description}`).includes(needle),
  );

  return (
    <SectionCard
      title="تصاميم الطباعة"
      description="اختر صفحة وعدّل شكل طباعتها — الترويسة والتصميم والتنسيق. التعديل للإدارة فقط."
      actions={<Printer className="size-4 text-muted-foreground" />}
    >
      <div className="relative mb-3 max-w-sm">
        <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث باسم الصفحة… (مثال: متسع)"
          className="rounded-xl pr-9"
        />
      </div>
      {isLoading ? (
        <div className="grid gap-2.5 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          لا توجد صفحة مطبوعة بهذا الاسم.
        </p>
      ) : (
        <ul className="grid gap-2.5 md:grid-cols-2">
          {rows.map((r) => (
            <li key={r.document}>
              <button
                onClick={() => onOpen(r.document)}
                className="group flex h-full w-full items-start gap-3 rounded-xl border border-border p-3 text-start transition-colors hover:border-primary/40 hover:bg-primary-soft/20"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                  <Printer className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold">{r.title}</span>
                    <Pill tone={SOURCE_TONE[r.source]}>{r.sourceLabel}</Pill>
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">{r.description}</span>
                  <span className="mt-1.5 block text-[11px] text-muted-foreground">
                    تُطبع من: {r.page}
                    {r.modified && (
                      <>
                        {" · "}عُدّل <span className="num">{r.modified}</span>
                        {r.modifiedBy ? ` — ${r.modifiedBy}` : ""}
                      </>
                    )}
                  </span>
                </span>
                <ChevronLeft className="mt-2 size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function PrintDesignEditor({ document, onClose }: { document: string; onClose: () => void }) {
  const { data, isLoading, error, refetch } = usePrintDesign(document);
  if (isLoading || error || !data) {
    return (
      <SectionCard title="تصاميم الطباعة">
        {isLoading ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : (
          <ErrorState error={error} onRetry={() => void refetch()} />
        )}
        <button
          onClick={onClose}
          className="mt-3 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
        >
          رجوع
        </button>
      </SectionCard>
    );
  }
  return <Editor key={data.document} design={data} onClose={onClose} />;
}

const pick = (d: PrintDesign): PrintDesignDraft => ({
  design: d.design,
  css: d.css,
  theme: d.theme,
  orientation: d.orientation,
  logo: d.logo,
});

const THEMES: Array<{ value: PrintTheme; label: string }> = [
  { value: "letter", label: "خطاب رسمي — إطار مزدوج وخط أكبر" },
  { value: "classic", label: "بسيط بلا إطار" },
  { value: "soft", label: "إطار ملوّن بزخرفة" },
];

type Tab = "page" | "design" | "css";

function Editor({ design, onClose }: { design: PrintDesign; onClose: () => void }) {
  const confirm = useConfirm();
  const preview = usePreviewPrintDesign();
  const save = useSavePrintDesign();
  const reset = useResetPrintDesign();

  const [draft, setDraft] = useState<PrintDesignDraft>(() => pick(design));
  // What is saved (or in effect) now, to tell an edited draft from it.
  const [baseline, setBaseline] = useState(() => JSON.stringify(pick(design)));
  const dirty = JSON.stringify(draft) !== baseline;
  const [tab, setTab] = useState<Tab>("design");
  const [help, setHelp] = useState(false);
  const [html, setHtml] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [uploading, setUploading] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);
  const designBox = useRef<HTMLTextAreaElement>(null);

  function set<K extends keyof PrintDesignDraft>(key: K, value: PrintDesignDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function adopt(d: PrintDesign) {
    setDraft(pick(d));
    setBaseline(JSON.stringify(pick(d)));
  }

  // The preview follows the draft. Answers can arrive out of order; only the
  // latest request's is shown.
  const latest = useRef(0);
  const run = useRef(preview.mutate);
  run.current = preview.mutate;
  useEffect(() => {
    const id = ++latest.current;
    const t = setTimeout(() => {
      run.current(
        { document: design.document, draft },
        {
          onSuccess: (res) => {
            if (id !== latest.current) return;
            setHtml(res.html);
            setPreviewError("");
          },
          onError: (e) => {
            if (id === latest.current) setPreviewError(errorMessage(e, "تعذّرت المعاينة"));
          },
        },
      );
    }, 600);
    return () => clearTimeout(t);
  }, [draft, design.document]);

  function persist() {
    save.mutate(
      { document: design.document, draft },
      {
        onSuccess: (d) => {
          adopt(d);
          toast.success(`تم حفظ تصميم «${d.title}» — يُطبع به من الآن`);
        },
        onError: (e) => toast.error(errorMessage(e, "تعذّر حفظ التصميم")),
      },
    );
  }

  async function restore() {
    const where = design.schoolForm
      ? `نموذج المدرسة «${design.schoolForm}»`
      : "التصميم الافتراضي للنظام";
    const ok = await confirm({
      title: "استعادة التصميم الافتراضي",
      description: `سيُحذف التصميم المحفوظ هنا، وتعود «${design.title}» إلى ${where} مع ترويسة المدرسة.`,
      confirmLabel: "استعادة",
      tone: "warning",
    });
    if (!ok) return;
    reset.mutate(design.document, {
      onSuccess: (d) => {
        adopt(d);
        toast.success(
          `عادت «${d.title}» إلى ${d.source === "school" ? where : "التصميم الافتراضي"}`,
        );
      },
      onError: (e) => toast.error(errorMessage(e, "تعذّرت الاستعادة")),
    });
  }

  async function loadBuiltin() {
    if (!design.builtin) return;
    const ok = await confirm({
      title: "تحميل التصميم الأصلي للنظام",
      description:
        "يُستبدل التصميم في المحرر بتصميم النظام الأصلي (بدل نموذج المدرسة). لا يُحفظ شيء حتى تضغط «حفظ التصميم».",
      confirmLabel: "تحميل",
      tone: "question",
    });
    if (ok) setDraft((d) => ({ ...d, ...design.builtin }));
  }

  async function leave() {
    if (
      dirty &&
      !(await confirm({
        title: "تعديلات غير محفوظة",
        description: "لم تُحفظ تعديلاتك على التصميم. الخروج يتجاهلها.",
        confirmLabel: "خروج بلا حفظ",
        tone: "warning",
      }))
    )
      return;
    onClose();
  }

  async function onLogo(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      set("logo", await uploadFormLogo(file));
      toast.success("تم رفع صورة الترويسة");
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر رفع الصورة"));
    } finally {
      setUploading(false);
      if (logoInput.current) logoInput.current.value = "";
    }
  }

  /** Put a snippet where the cursor is in the design. */
  function insert(snippet: string) {
    const box = designBox.current;
    const at = box ? box.selectionStart : draft.design.length;
    const end = box ? box.selectionEnd : at;
    set("design", draft.design.slice(0, at) + snippet + draft.design.slice(end));
    requestAnimationFrame(() => {
      if (!box) return;
      box.focus();
      box.setSelectionRange(at + snippet.length, at + snippet.length);
    });
  }

  function printSample() {
    if (!html) return;
    try {
      printHtml(html, design.title);
    } catch (e) {
      toast.error(errorMessage(e, "تعذّرت الطباعة"));
    }
  }

  const status: Record<PrintDesignSource, string> = {
    saved: `تصميم محفوظ في الإعدادات${design.modified ? ` — عُدّل ${design.modified}${design.modifiedBy ? ` بواسطة ${design.modifiedBy}` : ""}` : ""}.`,
    school: `تُطبع الآن بنموذج المدرسة «${design.schoolForm}». احفظ هنا ليصبح هذا التصميم المعتمد.`,
    builtin: "تُطبع الآن بالتصميم الافتراضي للنظام.",
  };

  const previewPane = (
    <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold">المعاينة</span>
        <span className="text-[11px] text-muted-foreground">على آخر سجل، أو بيانات تجريبية</span>
        {preview.isPending && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
        <button
          onClick={printSample}
          disabled={!html}
          className="ms-auto flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium hover:bg-secondary disabled:opacity-50"
        >
          <Printer className="size-3.5" />
          طباعة تجريبية
        </button>
      </div>
      {previewError && (
        <p className="rounded-lg border border-destructive/30 bg-destructive-soft/50 px-3 py-2 text-xs text-destructive">
          {previewError}
        </p>
      )}
      <PreviewFrame html={html} landscape={draft.orientation === "Landscape"} />
    </div>
  );

  return (
    <SectionCard
      title={`تصميم طباعة «${design.title}»`}
      description={`${design.description} تُطبع من: ${design.page}.`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setHelp(true)}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
          >
            <HelpCircle className="size-3.5" />
            مساعدة
          </button>
          <button
            onClick={() => void leave()}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
          >
            رجوع
          </button>
          {dirty && (
            <button
              onClick={() => setDraft(JSON.parse(baseline) as PrintDesignDraft)}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
            >
              <Undo2 className="size-3.5" />
              تراجع عن التعديلات
            </button>
          )}
          {design.source === "saved" && (
            <button
              onClick={() => void restore()}
              disabled={reset.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-warning/50 px-3 py-1.5 text-xs font-medium text-warm-foreground hover:bg-warning-soft disabled:opacity-50"
            >
              <RotateCcw className="size-3.5" />
              استعادة الافتراضي
            </button>
          )}
          <button
            onClick={persist}
            disabled={save.isPending || (!dirty && design.source === "saved")}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {save.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            حفظ التصميم
          </button>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Pill tone={SOURCE_TONE[design.source]}>{design.sourceLabel}</Pill>
        <span>{status[design.source]}</span>
        {dirty && <Pill tone="warning">تعديلات غير محفوظة</Pill>}
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5 border-b border-border">
        {[
          { key: "page" as const, label: "الترويسة والصفحة", icon: Stamp },
          { key: "design" as const, label: "تصميم الطباعة", icon: Code2 },
          { key: "css" as const, label: "CSS", icon: Palette },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors",
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="size-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {tab === "page" && (
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-[11px] text-muted-foreground">صورة الترويسة</p>
              <div className="rounded-xl border border-border p-3">
                <div className="grid min-h-16 place-items-center overflow-hidden rounded-lg bg-secondary/40 p-2">
                  {draft.logo || design.defaultLogo ? (
                    <img
                      src={fileUrl(draft.logo || design.defaultLogo)}
                      alt="الترويسة"
                      className="max-h-28 w-full object-contain"
                    />
                  ) : (
                    <FileImage className="size-6 text-muted-foreground" />
                  )}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {draft.logo
                    ? "صورة خاصة بهذا التصميم."
                    : design.defaultLogo
                      ? "ترويسة المدرسة — نفس الصورة المستخدمة في خطاباتها."
                      : "لا توجد ترويسة للمدرسة بعد؛ تُرسم الترويسة من اسم المدرسة وشعارها."}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    ref={logoInput}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void onLogo(e.target.files?.[0])}
                  />
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => logoInput.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-50"
                  >
                    {uploading ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <FileImage className="size-3.5" />
                    )}
                    رفع صورة ترويسة أخرى
                  </button>
                  {draft.logo && (
                    <button
                      type="button"
                      onClick={() => set("logo", "")}
                      className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-secondary"
                    >
                      <X className="size-3.5" />
                      العودة إلى ترويسة المدرسة
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                تظهر الترويسة حيث يكتب التصميم <Code>{"{{ banner() }}"}</Code> — صورة واحدة بعرض
                الصفحة (PNG أو JPG حتى 3 ميغابايت).
                {design.note && ` ${design.note}`}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-[11px] text-muted-foreground">شكل الصفحة</p>
                <select
                  value={draft.theme}
                  onChange={(e) => set("theme", e.target.value as PrintTheme)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                >
                  {THEMES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="mb-1 text-[11px] text-muted-foreground">اتجاه الورقة</p>
                <select
                  value={draft.orientation}
                  onChange={(e) => set("orientation", e.target.value as PrintOrientation)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                >
                  <option value="Portrait">عمودي (A4)</option>
                  <option value="Landscape">أفقي (A4)</option>
                </select>
              </div>
            </div>

            {design.builtin && (
              <div className="rounded-xl bg-secondary/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
                <p>
                  للمدرسة نموذج خاص بعنوان «{design.schoolForm}» يُستخدم عند عدم حفظ تصميم هنا.
                  يمكنك البدء بدلاً منه من تصميم النظام الأصلي.
                </p>
                <button
                  onClick={() => void loadBuiltin()}
                  className="mt-2 flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-secondary"
                >
                  <RotateCcw className="size-3" />
                  تحميل التصميم الأصلي للنظام
                </button>
              </div>
            )}
          </div>
        )}

        {tab === "design" && (
          <div className="min-w-0 space-y-2">
            <p className="text-[11px] text-muted-foreground">
              HTML مع صيغة Jinja. المعاينة تتحدّث وحدها؛ اضغط عنصراً من القائمة لإدراجه مكان المؤشر.
            </p>
            <Textarea
              ref={designBox}
              dir="ltr"
              rows={22}
              spellCheck={false}
              className="font-mono text-[11.5px] leading-relaxed md:text-[11.5px]"
              value={draft.design}
              onChange={(e) => set("design", e.target.value)}
            />
            <Snippets
              title="المتاح في التصميم"
              items={design.variables.map((v) => ({ code: v.code, label: v.label }))}
              onPick={insert}
            />
            {design.fields.length > 0 && (
              <Snippets
                title="حقول النموذج"
                items={design.fields.map((f) => ({
                  code: `{{ values.${f.fieldname} }}`,
                  label: f.label,
                }))}
                onPick={insert}
              />
            )}
          </div>
        )}

        {tab === "css" && (
          <div className="min-w-0 space-y-2">
            <p className="text-[11px] text-muted-foreground">
              يُطبَّق بعد التنسيق الأساسي، فيستطيع تغيير أي شيء فيه. اكتب CSS فقط، بلا وسم{" "}
              <Code>{"<style>"}</Code>.
            </p>
            <Textarea
              dir="ltr"
              rows={22}
              spellCheck={false}
              className="font-mono text-[11.5px] leading-relaxed md:text-[11.5px]"
              value={draft.css}
              onChange={(e) => set("css", e.target.value)}
              placeholder={".ms-banner img { max-height: 30mm; }\n.ms-page { font-size: 14px; }"}
            />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              أصناف عامة: <Code>.ms-page</Code> الصفحة، <Code>.theme-letter</Code> إطار الخطاب،{" "}
              <Code>.ms-banner img</Code> صورة الترويسة، <Code>.landscape</Code> الصفحة الأفقية.
            </p>
          </div>
        )}

        {previewPane}
      </div>

      <PrintDesignHelp open={help} onOpenChange={setHelp} design={design} />
    </SectionCard>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code dir="ltr" className="rounded bg-secondary px-1 py-0.5 font-mono text-[10.5px]">
      {children}
    </code>
  );
}

function Snippets({
  title,
  items,
  onPick,
}: {
  title: string;
  items: Array<{ code: string; label: string }>;
  onPick: (code: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="rounded-xl border border-border p-2">
      <p className="mb-1.5 text-[11px] font-bold">{title}</p>
      <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
        {items.map((it) => (
          <button
            key={it.code + it.label}
            type="button"
            title={it.label}
            onClick={() => onPick(it.code)}
            className="flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-secondary/30 px-2 py-1 text-start text-[10.5px] hover:border-primary/40 hover:bg-primary-soft/30"
          >
            <code dir="ltr" className="truncate font-mono">
              {it.code}
            </code>
            <span className="truncate text-muted-foreground">{it.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** A4's printable width at the page margin the print style sets (8mm each side). */
const PAGE_MM = { portrait: 194, landscape: 281 };

/**
 * The page as it will print: laid out at A4 width, shrunk to fit the pane,
 * so a table or a grid wraps where it will on paper rather than where the
 * pane happens to end.
 */
function PreviewFrame({ html, landscape }: { html: string; landscape: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const mm = landscape ? PAGE_MM.landscape : PAGE_MM.portrait;
  const zoom = width ? Math.min(1, (width - 28) / ((mm * 96) / 25.4)) : 1;
  const doc = useMemo(
    () =>
      `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><style>html{background:#eef0f4}body{width:${mm}mm;margin:12px auto;background:#fff;padding:0;zoom:${zoom.toFixed(3)};box-shadow:0 1px 6px rgba(0,0,0,.12)}</style></head><body>${html}</body></html>`,
    [html, mm, zoom],
  );
  return (
    <div ref={box} className="overflow-hidden rounded-xl border border-border bg-white">
      {html ? (
        <iframe title="معاينة الطباعة" className="h-[44rem] w-full" srcDoc={doc} />
      ) : (
        <p className="p-8 text-center text-sm text-muted-foreground">جارِ تجهيز المعاينة…</p>
      )}
    </div>
  );
}

function PrintDesignHelp({
  open,
  onOpenChange,
  design,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  design: PrintDesign;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right">
            <HelpCircle className="size-5 text-primary" />
            مساعدة — تصميم طباعة «{design.title}»
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 text-right text-[13px] leading-relaxed text-muted-foreground">
          <HelpPart n={1} title="بأي تصميم تُطبع الصفحة">
            <ol className="list-decimal space-y-1 pe-1 ps-5">
              <li>التصميم المحفوظ هنا، إن وُجد.</li>
              <li>
                وإلا نموذج المدرسة الذي يحمل اسم الصفحة نفسه (في نماذج المدرسة)، إن وُجد — مثل «قبول
                طالب (متسع)».
              </li>
              <li>وإلا تصميم النظام الافتراضي.</li>
            </ol>
            <p>
              «استعادة الافتراضي» تحذف التصميم المحفوظ هنا فتعود الطباعة إلى الخطوة الثانية أو
              الثالثة. الحفظ والاستعادة للإدارة فقط.
            </p>
          </HelpPart>
          <HelpPart n={2} title="الترويسة والصفحة">
            <p>
              الترويسة صورة واحدة بعرض الصفحة تظهر حيث يكتب التصميم <Code>{"{{ banner() }}"}</Code>.
              بلا صورة خاصة تُستخدم ترويسة المدرسة المستخدمة في خطاباتها. «شكل الصفحة»: خطاب رسمي
              بإطار مزدوج، أو بسيط بلا إطار، أو إطار ملوّن بزخرفة.
            </p>
          </HelpPart>
          <HelpPart n={3} title="التصميم">
            <p>
              HTML عادي مع صيغة Jinja: <Code>{"{{ … }}"}</Code> لقيمة،{" "}
              <Code>{"{% if … %}…{% endif %}"}</Code> لشرط، <Code>{"{% for … %}"}</Code> لتكرار.
              المتاح لهذه الصفحة:
            </p>
            <HelpPairs rows={design.variables.map((v) => [v.code, v.label])} />
            {design.fields.length > 0 && (
              <>
                <p>حقول النموذج — بمعرّفها في values أو باسمها في field(…):</p>
                <HelpPairs
                  rows={design.fields.map((f) => [
                    `values.${f.fieldname}`,
                    `${f.label} · field("${f.label}")`,
                  ])}
                />
              </>
            )}
          </HelpPart>
          <HelpPart n={4} title="المعاينة والحفظ">
            <ul className="list-disc space-y-1 pe-1 ps-5">
              <li>المعاينة تُرسم على آخر سجل في الصفحة، أو على بيانات تجريبية إن لم يوجد سجل.</li>
              <li>خطأ في صيغة التصميم يظهر فوق المعاينة، ولا يُحفظ تصميم فيه خطأ.</li>
              <li>لا يتغيّر شيء في الطباعة حتى تضغط «حفظ التصميم».</li>
            </ul>
          </HelpPart>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HelpPart({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
        <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] text-primary-foreground">
          {n}
        </span>
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function HelpPairs({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table data-no-tools className="w-full text-right text-xs">
        <tbody>
          {rows.map(([a, b]) => (
            <tr key={a} className="border-t border-border/60 first:border-0">
              <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[11px]" dir="ltr">
                {a}
              </td>
              <td className="px-2 py-1.5">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
