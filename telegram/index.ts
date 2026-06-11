// Bora OS — Telegram entegrasyonu (Supabase edge function yedeği)
// NOT: Gerçek değerler Supabase'deki canlı fonksiyondadır. Bu yedekte
// token / chat id / secret GIZLI-DEGER ile maskelenmiştir (repo herkese açık).
// GET  ?kind=morning|midday|evening&secret=... → günlük özet gönderir (pg_cron çağırır)
// POST (Telegram webhook) → gelen mesajı app'e yazar, buton tıklamalarını işler
import { createClient } from "npm:@supabase/supabase-js@2";

const TOKEN = "GIZLI-DEGER";
const CHAT_ID = "GIZLI-DEGER";
const SECRET = "GIZLI-DEGER";
const USER_ID = "70b814f7-216b-4344-8c1f-79ed84456c08";
const APP_URL = "https://bora-star.github.io/bora-os/";
const API = `https://api.telegram.org/bot${TOKEN}`;

const GUNLER = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const CHANNEL: Record<string, string> = { skool: "Skool", twitter: "Twitter", youtube: "YouTube" };

// Türkiye UTC+3 sabit (yaz saati uygulaması yok)
function ist(offsetDays = 0): Date {
  return new Date(Date.now() + 3 * 3600_000 + offsetDays * 86400_000);
}
function dstr(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function fmt(d: Date): string {
  return `${d.getUTCDate()} ${AYLAR[d.getUTCMonth()]} ${GUNLER[d.getUTCDay()]}`;
}
function istDateOf(timestamptz: string): string {
  return new Date(Date.parse(timestamptz) + 3 * 3600_000).toISOString().slice(0, 10);
}
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendTg(text: string, replyMarkup?: unknown): Promise<Response> {
  return await fetch(`${API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  });
}

async function answerCb(id: string, text: string): Promise<void> {
  try {
    await fetch(`${API}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: id, text }),
    });
  } catch (_) { /* sahte/eskimiş callback id sorun değil */ }
}

/* ---------- Veri ---------- */

async function getData(db: any) {
  const today = dstr(ist());
  const tomorrow = dstr(ist(1));
  const wd = ist().getUTCDay();
  const clKind = wd === 0 || wd === 6 ? "haftasonu" : "gunluk";
  const [tasks, content, habits, habitChecks, clItems, clChecks] = await Promise.all([
    db.from("bos_tasks").select("*").eq("user_id", USER_ID),
    db.from("bos_content").select("*").eq("user_id", USER_ID).neq("status", "yayinlandi"),
    db.from("bos_habits").select("*").eq("user_id", USER_ID).eq("active", true).order("sort"),
    db.from("bos_habit_checks").select("*").eq("user_id", USER_ID).eq("date", today),
    db.from("bos_checklist_items").select("*").eq("user_id", USER_ID).eq("active", true).eq("kind", clKind),
    db.from("bos_checklist_checks").select("*").eq("user_id", USER_ID).eq("date", today),
  ]);
  const all = tasks.data ?? [];
  const open = all.filter((t: any) => !t.done);
  return {
    today, tomorrow, weekend: clKind === "haftasonu",
    open,
    dueToday: open.filter((t: any) => t.due_date && t.due_date <= today),
    dueTomorrow: open.filter((t: any) => t.due_date === tomorrow),
    doneToday: all.filter((t: any) => t.done && t.done_at && istDateOf(t.done_at) === today),
    contentToday: (content.data ?? []).filter((c: any) => c.publish_date && c.publish_date <= today),
    contentTomorrow: (content.data ?? []).filter((c: any) => c.publish_date === tomorrow),
    habits: habits.data ?? [],
    habitChecks: habitChecks.data ?? [],
    clItems: clItems.data ?? [],
    clChecks: clChecks.data ?? [],
  };
}

function taskLines(tasks: any[], today: string, max = 8): string {
  return tasks.slice(0, max)
    .map((t: any) => `• ${esc(t.title)}${t.due_date && t.due_date < today ? " ⚠️ gecikti" : ""}`)
    .join("\n");
}
function contentLines(items: any[]): string {
  return items.map((c: any) => `• ${esc(c.title)} — ${CHANNEL[c.channel] ?? c.channel}`).join("\n");
}
function unmarkedHabits(d: any): any[] {
  const checked = new Set(d.habitChecks.map((c: any) => c.habit_id));
  return d.habits.filter((h: any) => !checked.has(h.id));
}
function taskButtons(tasks: any[], max = 6) {
  const rows = tasks.slice(0, max).map((t: any) => [
    { text: `✓ ${t.title.slice(0, 30)}${t.title.length > 30 ? "…" : ""}`, callback_data: `t:${t.id}` },
  ]);
  return rows.length ? { inline_keyboard: rows } : undefined;
}
function habitButtons(habits: any[]) {
  const rows = habits.map((h: any) => [
    { text: `✓ ${h.icon ?? ""} ${h.name}`.trim(), callback_data: `h:${h.id}` },
  ]);
  return rows.length ? { inline_keyboard: rows } : undefined;
}

/* ---------- Özet mesajları ---------- */

function morning(d: any): { text: string; markup?: unknown } {
  const parts = [`☀️ <b>Günaydın · ${fmt(ist())}</b>`];
  let btnTasks: any[] = [];
  if (d.dueToday.length) {
    parts.push(`📋 <b>Bugün:</b>\n${taskLines(d.dueToday, d.today)}`);
    btnTasks = d.dueToday;
  } else if (d.open.length) {
    parts.push(`📋 Bugüne tarihli görev yok — açık ${d.open.length} görev var:\n${taskLines(d.open, d.today, 4)}`);
    btnTasks = d.open.slice(0, 4);
  } else {
    parts.push("📋 Görev listesi bomboş. 👌");
  }
  if (d.contentToday.length) parts.push(`✍️ <b>Bugün yayın:</b>\n${contentLines(d.contentToday)}`);
  const rutin = d.weekend ? "🧘 Hafta sonu rutini" : "📈 Günlük piyasa rutini";
  if (d.clItems.length) parts.push(`${rutin}: ${d.clItems.length} adım seni bekliyor.`);
  parts.push(`<a href="${APP_URL}">Bora OS'u aç</a>`);
  return { text: parts.join("\n\n"), markup: taskButtons(btnTasks) };
}

function midday(d: any): { text: string; markup?: unknown } {
  const parts = [`🕐 <b>Gün ortası</b>`];
  const line = [`✅ Tamamlanan görev: ${d.doneToday.length}`];
  if (d.dueToday.length) line.push(`📋 Bugüne tarihli açık: ${d.dueToday.length}`);
  parts.push(line.join("\n"));
  if (d.contentToday.length) parts.push(`✍️ <b>Yayın bekliyor:</b>\n${contentLines(d.contentToday)}`);
  const um = unmarkedHabits(d);
  if (um.length) parts.push(`🔁 İşaretlenmemiş alışkanlık — butonla işaretle:`);
  const rutinDone = d.clChecks.filter((c: any) => d.clItems.some((i: any) => i.id === c.item_id)).length;
  if (d.clItems.length) parts.push(`📈 Rutin: ${rutinDone}/${d.clItems.length} adım`);
  return { text: parts.join("\n\n"), markup: habitButtons(um) };
}

function evening(d: any): { text: string; markup?: unknown } {
  const parts = [`🌙 <b>Gün kapanışı · ${fmt(ist())}</b>`];
  const rutinDone = d.clChecks.filter((c: any) => d.clItems.some((i: any) => i.id === c.item_id)).length;
  const ozet = [
    `✅ Görev: ${d.doneToday.length} tamamlandı`,
    `🔥 Alışkanlık: ${d.habitChecks.length}/${d.habits.length}`,
  ];
  if (d.clItems.length) ozet.push(`📈 Rutin: ${rutinDone}/${d.clItems.length} adım`);
  parts.push(ozet.join("\n"));
  const um = unmarkedHabits(d);
  if (um.length) parts.push(`⏳ Son şans — butonla işaretle:`);
  const yarin: string[] = [];
  if (d.dueTomorrow.length) yarin.push(taskLines(d.dueTomorrow, d.tomorrow));
  if (d.contentTomorrow.length) yarin.push(contentLines(d.contentTomorrow));
  parts.push(`📅 <b>Yarın:</b>\n${yarin.length ? yarin.join("\n") : "Yarına tarihli iş yok."}`);
  parts.push(`📓 Bugünden aklında kalan ne? Buraya "not …" yazman yeterli — ya da <a href="${APP_URL}">Journal'a yaz</a>`);
  return { text: parts.join("\n\n"), markup: habitButtons(um) };
}

/* ---------- Webhook: gelen mesaj + buton ---------- */

async function handleUpdate(db: any, u: any): Promise<void> {
  // Buton tıklaması
  if (u.callback_query) {
    const cq = u.callback_query;
    if (String(cq.message?.chat?.id) !== CHAT_ID) { await answerCb(cq.id, ""); return; }
    const [type, id] = String(cq.data ?? "").split(":");
    let note = "✓";
    if (type === "t" && id) {
      await db.from("bos_tasks").update({ done: true, done_at: new Date().toISOString() })
        .eq("id", id).eq("user_id", USER_ID);
      note = "✓ Görev tamamlandı";
    } else if (type === "h" && id) {
      const today = dstr(ist());
      const { data } = await db.from("bos_habit_checks").select("id")
        .eq("habit_id", id).eq("date", today).maybeSingle();
      if (data) {
        note = "Zaten işaretliydi ✓";
      } else {
        await db.from("bos_habit_checks").insert({ user_id: USER_ID, habit_id: id, date: today });
        note = "✓ Alışkanlık işaretlendi";
      }
    }
    await answerCb(cq.id, note);
    return;
  }

  // Gelen mesaj
  const msg = u.message;
  if (!msg || String(msg.chat?.id) !== CHAT_ID || typeof msg.text !== "string") return;
  const text = msg.text.trim();
  if (!text) return;
  const lower = text.toLowerCase();

  if (text.startsWith("/")) {
    await sendTg(
      "🧠 <b>Bora OS</b>\n\nBana yazdığın her şey app'e düşer:\n" +
      "• düz metin → görev\n• <code>fikir …</code> → fikir havuzu\n" +
      "• <code>not …</code> → journal\n• <code>izle NVDA …</code> → izleme listesi\n\n" +
      `<a href="${APP_URL}">Bora OS'u aç</a>`,
    );
    return;
  }

  let reply: string;
  if (lower.startsWith("fikir ")) {
    await db.from("bos_ideas").insert({ user_id: USER_ID, text: text.slice(6).trim(), kind: "genel" });
    reply = "💡 Fikir havuzuna eklendi.";
  } else if (lower.startsWith("not ") || lower.startsWith("journal ")) {
    const body = text.slice(lower.startsWith("not ") ? 4 : 8).trim();
    await db.from("bos_journal").insert({ user_id: USER_ID, text: body, date: dstr(ist()) });
    reply = "📓 Journal'a yazıldı.";
  } else if (lower.startsWith("izle ")) {
    const rest = text.slice(5).trim();
    const [ticker, ...r] = rest.split(/\s+/);
    await db.from("bos_watchlist").insert({
      user_id: USER_ID, ticker: ticker.toUpperCase(), reason: r.join(" ") || null,
    });
    reply = `📈 ${esc(ticker.toUpperCase())} izleme listesine eklendi.`;
  } else {
    const body = lower.startsWith("görev ") || lower.startsWith("gorev ") ? text.slice(6).trim() : text;
    await db.from("bos_tasks").insert({ user_id: USER_ID, title: body, area: "genel" });
    reply = "✅ Görev eklendi.\n<i>İpucu: \"fikir …\", \"not …\", \"izle NVDA …\" da yazabilirsin.</i>";
  }
  await sendTg(reply);
}

/* ---------- Giriş noktası ---------- */

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const headerSecret = req.headers.get("x-telegram-bot-api-secret-token");
  if (url.searchParams.get("secret") !== SECRET && headerSecret !== SECRET) {
    return new Response("forbidden", { status: 403 });
  }
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  if (req.method === "POST") {
    const update = await req.json().catch(() => null);
    if (update) {
      try { await handleUpdate(db, update); } catch (e) { console.error("webhook error:", e); }
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  }

  const kind = url.searchParams.get("kind") ?? "morning";
  const d = await getData(db);
  const m = kind === "midday" ? midday(d) : kind === "evening" ? evening(d) : morning(d);
  const r = await sendTg(m.text, m.markup);
  const body = await r.text();
  return new Response(JSON.stringify({ ok: r.ok, telegram: body.slice(0, 200) }), {
    headers: { "Content-Type": "application/json" },
  });
});
