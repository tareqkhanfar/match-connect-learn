import { createFileRoute } from "@tanstack/react-router";
import { Bell, Megaphone, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { Textarea } from "@/components/ui/textarea";
import { announcements, messages } from "@/lib/mock-data";

export const Route = createFileRoute("/app/communication")({
  head: () => ({
    meta: [
      { title: "التواصل والإعلانات — Match Education" },
      {
        name: "description",
        content: "لوحة إعلانات المدرسة، رسائل بين المعلمين وأولياء الأمور، وإشعارات فورية.",
      },
      { property: "og:title", content: "التواصل والإعلانات — Match Education" },
      { property: "og:description", content: "أعلن، راسِل، وتابع الإشعارات في مكان واحد." },
    ],
  }),
  component: CommunicationPage,
});

function CommunicationPage() {
  const [text, setText] = useState("");

  return (
    <>
      <PageHeader title="التواصل والإعلانات" subtitle="لوحة الإعلانات والرسائل والإشعارات" />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <SectionCard
            title="إعلان جديد"
            description="سيظهر لجميع أولياء الأمور والطلاب"
            actions={<Megaphone className="size-4 text-primary" />}
          >
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="اكتب نص الإعلان هنا..."
              className="min-h-24 rounded-xl"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {["جميع الطلاب", "أولياء الأمور", "المعلمون"].map((a) => (
                  <Pill key={a} tone="primary">
                    {a}
                  </Pill>
                ))}
              </div>
              <button
                onClick={() => {
                  setText("");
                  toast.success("تم نشر الإعلان");
                }}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground"
              >
                <Send className="size-4" />
                نشر الإعلان
              </button>
            </div>
          </SectionCard>

          <SectionCard title="لوحة الإعلانات" description="الإعلانات المنشورة">
            <ul className="space-y-3">
              {announcements.map((a) => (
                <li key={a.id} className="rounded-xl border border-border p-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <p className="truncate text-sm font-bold">{a.title}</p>
                    <Pill
                      tone={a.type === "تنبيه" ? "danger" : a.type === "حدث" ? "info" : "primary"}
                    >
                      {a.type}
                    </Pill>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{a.body}</p>
                  <p className="num mt-2 text-[11px] text-muted-foreground">
                    {a.date} • {a.audience}
                  </p>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard title="الرسائل" description="بين المعلمين وأولياء الأمور">
            <ul className="space-y-2.5">
              {messages.map((m) => (
                <li
                  key={m.id}
                  className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-xl border p-3 ${m.unread ? "border-primary/30 bg-primary-soft/40" : "border-border"}`}
                >
                  <Avatar name={m.from} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{m.from}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{m.role}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{m.preview}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] text-muted-foreground">{m.time}</p>
                    {m.unread && (
                      <span className="mt-1 inline-block size-2 rounded-full bg-primary" />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard
            title="الإشعارات"
            description="آخر الأنشطة في النظام"
            actions={<Bell className="size-4 text-muted-foreground" />}
          >
            <ul className="space-y-3 text-sm">
              {[
                "تم تسجيل حضور الصف التاسع - شعبة أ",
                "أضاف أ. سلمى الخطيب درجات امتحان الرياضيات",
                "٣ أولياء أمور سددوا القسط الثاني",
                "تحديث جدول الحصص للصف العاشر",
                "طالبان تجاوزا حد الغياب المسموح",
              ].map((n, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
                  <span className="text-muted-foreground">{n}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
