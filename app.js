import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://eeelyejmyrjjiusequoh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlZWx5ZWpteXJqaml1c2VxdW9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMjM3NDcsImV4cCI6MjA5NTY5OTc0N30.tnAhrnBjGP07WM2zMC0kRHYAbGFhRwb4yVCPvFgjXoY";

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (id) => document.getElementById(id);
const state = {
  tasks: [], projects: [], skills: [], ideas: [],
  watchlist: [], content: [], goals: [], journal: [],
};

const AREA_LABELS = {
  genel: "Genel", proje: "Proje", ai: "AI",
  trading: "Trading", icerik: "İçerik", gelisim: "Gelişim",
};
const STATUS_LABELS = { aktif: "Aktif", beklemede: "Beklemede", tamamlandi: "Tamamlandı" };
const SKILL_STATUS_LABELS = {
  guncel: "Güncel", yuklenecek: "Web'e yüklenecek",
  "guncelleme-bekliyor": "Güncelleme bekliyor", arsiv: "Arşiv",
};
const IDEA_KIND_LABELS = { skill: "Skill", icerik: "İçerik", ogrenme: "Öğrenme", genel: "Genel" };
const WATCH_STATUS_LABELS = { izlemede: "İzlemede", tetiklendi: "Tetiklendi", cikti: "Çıktı" };
const CHANNEL_LABELS = { skool: "Skool", twitter: "Twitter", youtube: "YouTube" };
const CONTENT_STATUS_LABELS = { fikir: "Fikir", taslak: "Taslak", hazir: "Hazır", yayinlandi: "Yayınlandı" };
const CONTENT_STATUS_ORDER = ["fikir", "taslak", "hazir", "yayinlandi"];
const HORIZON_LABELS = { "3ay": "3 ay", "6ay": "6 ay", "12ay": "12 ay" };

function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayStr() {
  return dateStr(new Date());
}
function fmtDate(s) {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  const aylar = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  return `${parseInt(d)} ${aylar[parseInt(m) - 1]}`;
}
function esc(s) {
  const div = document.createElement("div");
  div.textContent = s ?? "";
  return div.innerHTML;
}

/* ---------------- Auth ---------------- */

async function init() {
  const { data: { session } } = await db.auth.getSession();
  if (session) showApp(); else showLogin();
}

function showLogin() {
  $("login-view").classList.remove("hidden");
  $("app-view").classList.add("hidden");
}

async function showApp() {
  $("login-view").classList.add("hidden");
  $("app-view").classList.remove("hidden");
  const gunler = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
  const aylar = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  const n = new Date();
  $("today-title").textContent = `${n.getDate()} ${aylar[n.getMonth()]} ${gunler[n.getDay()]}`;
  await loadAll();
}

$("login-btn").addEventListener("click", login);
$("login-pass").addEventListener("keydown", (e) => { if (e.key === "Enter") login(); });
async function login() {
  const email = $("login-email").value.trim();
  const password = $("login-pass").value;
  $("login-error").classList.add("hidden");
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    $("login-error").textContent = "Giriş başarısız: e-posta veya şifre hatalı.";
    $("login-error").classList.remove("hidden");
    return;
  }
  showApp();
}

/* ---------------- Veri ---------------- */

async function loadAll() {
  const t = todayStr();
  const [tasks, projects, skills, ideas, watchlist, content, goals, journal] = await Promise.all([
    db.from("bos_tasks").select("*").order("done").order("due_date", { ascending: true, nullsFirst: false }).order("created_at"),
    db.from("bos_projects").select("*").order("sort"),
    db.from("bos_skills").select("*").order("name"),
    db.from("bos_ideas").select("*").neq("status", "yapildi").order("created_at", { ascending: false }),
    db.from("bos_watchlist").select("*").neq("status", "cikti").order("created_at"),
    db.from("bos_content").select("*").order("publish_date", { ascending: true, nullsFirst: false }).order("created_at"),
    db.from("bos_goals").select("*").order("created_at"),
    db.from("bos_journal").select("*").order("date", { ascending: false }).order("created_at", { ascending: false }).limit(10),
  ]);
  state.tasks = tasks.data ?? [];
  state.projects = projects.data ?? [];
  state.skills = skills.data ?? [];
  state.ideas = ideas.data ?? [];
  state.watchlist = watchlist.data ?? [];
  state.content = content.data ?? [];
  state.goals = goals.data ?? [];
  state.journal = journal.data ?? [];
  renderAll();
}

function renderAll() {
  renderToday();
  renderTasks();
  renderProjects();
  renderSkills();
  renderIdeas();
  renderWatchlist();
  renderContent();
  renderGoals();
  renderJournal();
}

/* ---------------- Bugün ---------------- */

function localDateOf(ts) {
  return dateStr(new Date(ts));
}

function renderToday() {
  const t = todayStr();
  const box = $("today-tasks");
  const todays = state.tasks.filter((x) => !x.done && x.due_date && x.due_date <= t);
  const noDate = state.tasks.filter((x) => !x.done && !x.due_date);
  const doneToday = state.tasks.filter((x) => x.done && x.done_at && localDateOf(x.done_at) === t);
  box.innerHTML = "";
  if (todays.length === 0 && noDate.length === 0) {
    box.innerHTML = '<p class="empty">Bugün için görev yok. 👌</p>';
  } else {
    todays.forEach((task) => box.appendChild(taskRow(task, true)));
    if (todays.length === 0) {
      box.innerHTML = '<p class="empty">Bugüne tarihli görev yok — açık görevlerden seçebilirsin:</p>';
      noDate.slice(0, 4).forEach((task) => box.appendChild(taskRow(task, true)));
    }
  }

  // Görev sayacı + ilerleme barı
  const shown = todays.length || Math.min(noDate.length, 4);
  $("today-task-cnt").textContent = shown ? `${shown} açık` : "";
  const totalToday = doneToday.length + todays.length;
  const barWrap = $("today-task-bar-wrap");
  if (totalToday > 0) {
    barWrap.classList.remove("hidden");
    $("today-task-bar").style.width = `${Math.round((doneToday.length / totalToday) * 100)}%`;
  } else {
    barWrap.classList.add("hidden");
  }

  // İstatistik şeridi
  const contentDue = state.content.filter((c) => c.status !== "yayinlandi" && c.publish_date && c.publish_date <= t);
  $("today-stats").innerHTML = `
    <div class="stat ac-blue"><div class="n">${doneToday.length}/${totalToday || doneToday.length}</div><div class="l">GÖREV</div></div>
    <div class="stat ac-purple"><div class="n">${contentDue.length}</div><div class="l">YAYIN</div></div>`;

  // Bugün yayınlanacak içerik
  const dueContent = state.content.filter((c) => c.status !== "yayinlandi" && c.publish_date && c.publish_date <= t);
  const card = $("today-content-card");
  if (dueContent.length === 0) {
    card.classList.add("hidden");
  } else {
    card.classList.remove("hidden");
    const box = $("today-content");
    box.innerHTML = "";
    dueContent.forEach((c) => {
      const late = c.publish_date < t;
      const row = document.createElement("div");
      row.className = "item";
      row.innerHTML = `
        <div class="grow">
          <div class="title">${esc(c.title)}</div>
          <div class="sub">${CONTENT_STATUS_LABELS[c.status] ?? c.status}</div>
        </div>
        <span class="badge ${c.channel}">${CHANNEL_LABELS[c.channel] ?? c.channel}</span>
        ${late ? '<span class="badge late">Gecikti</span>' : ""}`;
      box.appendChild(row);
    });
  }
}

/* ---------------- Görevler ---------------- */

function taskRow(task, compact = false) {
  const t = todayStr();
  const row = document.createElement("div");
  row.className = "item" + (task.done ? " done" : "");
  const proj = state.projects.find((p) => p.id === task.project_id);
  const late = !task.done && task.due_date && task.due_date < t;
  const parts = [];
  if (task.area && task.area !== "genel") parts.push(AREA_LABELS[task.area] ?? task.area);
  if (proj) parts.push(proj.name);
  const dueBadge = task.due_date
    ? `<span class="badge ${late ? "late" : ""}">${late ? "Gecikti · " : ""}${fmtDate(task.due_date)}</span>` : "";
  row.innerHTML = `
    <button class="check ${task.done ? "on" : ""}">✓</button>
    <div class="grow">
      <div class="title">${esc(task.title)}</div>
      ${parts.length ? `<div class="sub">${esc(parts.join(" · "))}</div>` : ""}
    </div>
    ${dueBadge}
    ${compact ? "" : '<button class="del-btn" title="Sil">✕</button>'}`;
  row.querySelector(".check").addEventListener("click", () => toggleTask(task));
  const del = row.querySelector(".del-btn");
  if (del) del.addEventListener("click", async () => {
    if (confirm("Görev silinsin mi?")) {
      await db.from("bos_tasks").delete().eq("id", task.id);
      await loadAll();
    }
  });
  return row;
}

function renderTasks() {
  const open = state.tasks.filter((x) => !x.done);
  const done = state.tasks.filter((x) => x.done).sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));
  const ob = $("open-tasks");
  ob.innerHTML = open.length ? "" : '<p class="empty">Açık görev yok.</p>';
  open.forEach((task) => ob.appendChild(taskRow(task)));
  const dbx = $("done-tasks");
  dbx.innerHTML = done.length ? "" : '<p class="empty">Henüz yok.</p>';
  done.slice(0, 15).forEach((task) => dbx.appendChild(taskRow(task)));
  $("done-count").textContent = done.length ? `(${done.length})` : "";
}

async function toggleTask(task) {
  await db.from("bos_tasks").update({
    done: !task.done,
    done_at: task.done ? null : new Date().toISOString(),
  }).eq("id", task.id);
  await loadAll();
}

$("add-task-btn").addEventListener("click", addTask);
$("new-task-title").addEventListener("keydown", (e) => { if (e.key === "Enter") addTask(); });
async function addTask() {
  const title = $("new-task-title").value.trim();
  if (!title) return;
  await db.from("bos_tasks").insert({
    title,
    area: $("new-task-area").value,
    due_date: $("new-task-due").value || null,
  });
  $("new-task-title").value = "";
  $("new-task-due").value = "";
  await loadAll();
}

/* ---------------- Projeler & AI ---------------- */

function renderProjects() {
  const box = $("projects-list");
  box.innerHTML = "";
  state.projects.forEach((p) => {
    const el = document.createElement("div");
    el.className = "project";
    el.innerHTML = `
      <div class="row1">
        <div class="name">${esc(p.name)}</div>
        <select data-id="${p.id}">
          ${Object.entries(STATUS_LABELS).map(([v, l]) =>
            `<option value="${v}" ${p.status === v ? "selected" : ""}>${l}</option>`).join("")}
        </select>
      </div>
      ${p.description ? `<div class="desc">${esc(p.description)}</div>` : ""}
      ${p.next_step ? `<div class="next">→ ${esc(p.next_step)}</div>` : ""}`;
    el.querySelector("select").addEventListener("change", async (e) => {
      await db.from("bos_projects").update({ status: e.target.value, updated_at: new Date().toISOString() }).eq("id", p.id);
      await loadAll();
    });
    box.appendChild(el);
  });
}

function renderSkills() {
  const box = $("skills-list");
  box.innerHTML = "";
  state.skills.forEach((s) => {
    const row = document.createElement("div");
    row.className = "item";
    row.innerHTML = `
      <div class="grow">
        <div class="title">${esc(s.name)} ${s.version ? `<span class="muted">${esc(s.version)}</span>` : ""}</div>
        ${s.notes ? `<div class="sub">${esc(s.notes)}</div>` : ""}
      </div>
      <span class="badge ${s.status}">${SKILL_STATUS_LABELS[s.status] ?? s.status}</span>`;
    box.appendChild(row);
  });
}

function renderIdeas() {
  const box = $("ideas-list");
  box.innerHTML = state.ideas.length ? "" : '<p class="empty">Havuz boş — aklına gelen fikri buraya at.</p>';
  state.ideas.forEach((idea) => {
    const row = document.createElement("div");
    row.className = "item";
    row.innerHTML = `
      <div class="grow">
        <div class="title">${esc(idea.text)}</div>
        <div class="sub">${IDEA_KIND_LABELS[idea.kind] ?? idea.kind}${idea.related ? " · " + esc(idea.related) : ""}</div>
      </div>
      <button class="del-btn" title="Tamamlandı işaretle">✓</button>`;
    row.querySelector(".del-btn").addEventListener("click", async () => {
      await db.from("bos_ideas").update({ status: "yapildi" }).eq("id", idea.id);
      await loadAll();
    });
    box.appendChild(row);
  });
}

$("add-idea-btn").addEventListener("click", addIdea);
$("new-idea-text").addEventListener("keydown", (e) => { if (e.key === "Enter") addIdea(); });
async function addIdea() {
  const text = $("new-idea-text").value.trim();
  if (!text) return;
  await db.from("bos_ideas").insert({ text, kind: $("new-idea-kind").value });
  $("new-idea-text").value = "";
  await loadAll();
}

/* ---------------- Trading ---------------- */

function renderWatchlist() {
  const box = $("watchlist");
  box.innerHTML = state.watchlist.length ? "" : '<p class="empty">İzleme listesi boş.</p>';
  state.watchlist.forEach((w) => {
    const row = document.createElement("div");
    row.className = "item";
    const subParts = [w.reason, w.level ? "Seviye: " + w.level : null].filter(Boolean);
    row.innerHTML = `
      <div class="grow">
        <div class="title ticker">${esc(w.ticker)}</div>
        ${subParts.length ? `<div class="sub">${esc(subParts.join(" · "))}</div>` : ""}
      </div>
      <select>
        ${Object.entries(WATCH_STATUS_LABELS).map(([v, l]) =>
          `<option value="${v}" ${w.status === v ? "selected" : ""}>${l}</option>`).join("")}
      </select>
      <button class="del-btn" title="Sil">✕</button>`;
    row.querySelector("select").addEventListener("change", async (e) => {
      await db.from("bos_watchlist").update({ status: e.target.value }).eq("id", w.id);
      await loadAll();
    });
    row.querySelector(".del-btn").addEventListener("click", async () => {
      if (confirm(w.ticker + " listeden silinsin mi?")) {
        await db.from("bos_watchlist").delete().eq("id", w.id);
        await loadAll();
      }
    });
    box.appendChild(row);
  });
}

$("add-watch-btn").addEventListener("click", addWatch);
$("new-watch-level").addEventListener("keydown", (e) => { if (e.key === "Enter") addWatch(); });
async function addWatch() {
  const ticker = $("new-watch-ticker").value.trim().toUpperCase();
  if (!ticker) return;
  await db.from("bos_watchlist").insert({
    ticker,
    reason: $("new-watch-reason").value.trim() || null,
    level: $("new-watch-level").value.trim() || null,
  });
  $("new-watch-ticker").value = "";
  $("new-watch-reason").value = "";
  $("new-watch-level").value = "";
  await loadAll();
}

/* ---------------- İçerik ---------------- */

function renderContent() {
  const t = todayStr();

  // Yayın takvimi: tarihi olan, yayınlanmamış içerikler
  const cal = $("content-calendar");
  const upcoming = state.content.filter((c) => c.status !== "yayinlandi" && c.publish_date);
  cal.innerHTML = upcoming.length ? "" : '<p class="empty">Takvimde içerik yok — tarih vererek ekle.</p>';
  upcoming.forEach((c) => {
    const late = c.publish_date < t;
    const row = document.createElement("div");
    row.className = "item";
    row.innerHTML = `
      <span class="badge ${late ? "late" : ""}">${late ? "Gecikti · " : ""}${fmtDate(c.publish_date)}</span>
      <div class="grow"><div class="title">${esc(c.title)}</div></div>
      <span class="badge ${c.channel}">${CHANNEL_LABELS[c.channel] ?? c.channel}</span>`;
    cal.appendChild(row);
  });

  // Üretim hattı
  const pipe = $("content-pipeline");
  pipe.innerHTML = "";
  CONTENT_STATUS_ORDER.forEach((status) => {
    const items = state.content.filter((c) => c.status === status);
    if (status === "yayinlandi" && items.length === 0) return;
    const card = document.createElement("div");
    card.className = "card pipeline-group ac-purple";
    card.innerHTML = `<h2>${CONTENT_STATUS_LABELS[status]} <span class="cnt">${items.length}</span></h2>`;
    if (!items.length) {
      card.insertAdjacentHTML("beforeend", '<p class="empty">Boş.</p>');
    }
    items.slice(0, status === "yayinlandi" ? 10 : 100).forEach((c) => {
      const idx = CONTENT_STATUS_ORDER.indexOf(c.status);
      const row = document.createElement("div");
      row.className = "item";
      row.innerHTML = `
        <div class="grow">
          <div class="title">${esc(c.title)}</div>
          ${c.publish_date ? `<div class="sub">Yayın: ${fmtDate(c.publish_date)}</div>` : ""}
        </div>
        <span class="badge ${c.channel}">${CHANNEL_LABELS[c.channel] ?? c.channel}</span>
        ${idx > 0 ? '<button class="move-btn back" title="Geri al">←</button>' : ""}
        ${idx < 3 ? '<button class="move-btn fwd" title="İlerlet">→</button>' : ""}
        <button class="del-btn" title="Sil">✕</button>`;
      const move = async (dir) => {
        await db.from("bos_content").update({
          status: CONTENT_STATUS_ORDER[idx + dir],
          updated_at: new Date().toISOString(),
        }).eq("id", c.id);
        await loadAll();
      };
      const back = row.querySelector(".back");
      if (back) back.addEventListener("click", () => move(-1));
      const fwd = row.querySelector(".fwd");
      if (fwd) fwd.addEventListener("click", () => move(1));
      row.querySelector(".del-btn").addEventListener("click", async () => {
        if (confirm("İçerik silinsin mi?")) {
          await db.from("bos_content").delete().eq("id", c.id);
          await loadAll();
        }
      });
      card.appendChild(row);
    });
    pipe.appendChild(card);
  });
}

$("add-content-btn").addEventListener("click", addContent);
$("new-content-title").addEventListener("keydown", (e) => { if (e.key === "Enter") addContent(); });
async function addContent() {
  const title = $("new-content-title").value.trim();
  if (!title) return;
  await db.from("bos_content").insert({
    title,
    channel: $("new-content-channel").value,
    publish_date: $("new-content-date").value || null,
  });
  $("new-content-title").value = "";
  $("new-content-date").value = "";
  await loadAll();
}

/* ---------------- Gelişim ---------------- */

function renderGoals() {
  const box = $("goals-list");
  const goals = [...state.goals].sort((a, b) => (a.status === "tamam") - (b.status === "tamam"));
  box.innerHTML = goals.length ? "" : '<p class="empty">Hedef yok — 3-6-12 aylık hedeflerini ekle.</p>';
  goals.forEach((g) => {
    const row = document.createElement("div");
    row.className = "goal-row" + (g.status === "tamam" ? " tamam" : "");
    row.innerHTML = `
      <div class="row1">
        <div class="title">${esc(g.title)}</div>
        <span class="badge">${HORIZON_LABELS[g.horizon] ?? g.horizon}</span>
        ${g.status === "tamam"
          ? '<button class="mini-btn reopen">Geri aç</button>'
          : `<button class="mini-btn minus">−10</button>
             <button class="mini-btn plus">+10</button>`}
        <button class="del-btn" title="Sil">✕</button>
      </div>
      <div class="bar"><div style="width:${g.progress}%"></div></div>`;
    const setProgress = async (p) => {
      p = Math.max(0, Math.min(100, p));
      await db.from("bos_goals").update({ progress: p, status: p >= 100 ? "tamam" : "aktif" }).eq("id", g.id);
      await loadAll();
    };
    const plus = row.querySelector(".plus");
    if (plus) plus.addEventListener("click", () => setProgress(g.progress + 10));
    const minus = row.querySelector(".minus");
    if (minus) minus.addEventListener("click", () => setProgress(g.progress - 10));
    const reopen = row.querySelector(".reopen");
    if (reopen) reopen.addEventListener("click", () => setProgress(90));
    row.querySelector(".del-btn").addEventListener("click", async () => {
      if (confirm("Hedef silinsin mi?")) {
        await db.from("bos_goals").delete().eq("id", g.id);
        await loadAll();
      }
    });
    box.appendChild(row);
  });
}

$("add-goal-btn").addEventListener("click", addGoal);
$("new-goal-title").addEventListener("keydown", (e) => { if (e.key === "Enter") addGoal(); });
async function addGoal() {
  const title = $("new-goal-title").value.trim();
  if (!title) return;
  await db.from("bos_goals").insert({ title, horizon: $("new-goal-horizon").value });
  $("new-goal-title").value = "";
  await loadAll();
}

function renderJournal() {
  const box = $("journal-list");
  box.innerHTML = state.journal.length ? "" : "";
  state.journal.forEach((j) => {
    const row = document.createElement("div");
    row.className = "journal-entry";
    row.innerHTML = `<div class="date2">${fmtDate(j.date)}</div><div class="text">${esc(j.text)}</div>`;
    box.appendChild(row);
  });
}

$("save-journal-btn").addEventListener("click", async () => {
  const text = $("journal-text").value.trim();
  if (!text) return;
  await db.from("bos_journal").insert({ text, date: todayStr() });
  $("journal-text").value = "";
  await loadAll();
});

/* ---------------- Sekmeler ---------------- */

document.querySelectorAll("[data-tab]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll(".tab").forEach((s) => s.classList.add("hidden"));
    $("tab-" + tab).classList.remove("hidden");
    document.querySelectorAll("[data-tab]").forEach((b) =>
      b.classList.toggle("active", b.dataset.tab === tab));
    window.scrollTo(0, 0);
  });
});

/* ---------------- Ayarlar ---------------- */

$("settings-btn").addEventListener("click", () => $("settings-modal").classList.remove("hidden"));
$("close-settings-btn").addEventListener("click", () => $("settings-modal").classList.add("hidden"));
$("logout-btn").addEventListener("click", async () => {
  await db.auth.signOut();
  location.reload();
});
$("change-pass-btn").addEventListener("click", async () => {
  const p = $("new-pass").value;
  if (p.length < 8) { $("settings-msg").textContent = "Şifre en az 8 karakter olmalı."; return; }
  const { error } = await db.auth.updateUser({ password: p });
  $("settings-msg").textContent = error ? "Hata: " + error.message : "Şifre değiştirildi ✓";
  if (!error) $("new-pass").value = "";
});

init();
