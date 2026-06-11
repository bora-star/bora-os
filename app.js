import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://eeelyejmyrjjiusequoh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlZWx5ZWpteXJqaml1c2VxdW9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMjM3NDcsImV4cCI6MjA5NTY5OTc0N30.tnAhrnBjGP07WM2zMC0kRHYAbGFhRwb4yVCPvFgjXoY";

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (id) => document.getElementById(id);
const state = {
  tasks: [], projects: [], skills: [], ideas: [],
  habits: [], habitChecks: [], checklistItems: [], checklistChecks: [],
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

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isWeekend() {
  const g = new Date().getDay();
  return g === 0 || g === 6;
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
  const [tasks, projects, skills, ideas, habits, habitChecks, clItems, clChecks] = await Promise.all([
    db.from("bos_tasks").select("*").order("done").order("due_date", { ascending: true, nullsFirst: false }).order("created_at"),
    db.from("bos_projects").select("*").order("sort"),
    db.from("bos_skills").select("*").order("name"),
    db.from("bos_ideas").select("*").neq("status", "yapildi").order("created_at", { ascending: false }),
    db.from("bos_habits").select("*").eq("active", true).order("sort"),
    db.from("bos_habit_checks").select("*").eq("date", t),
    db.from("bos_checklist_items").select("*").eq("active", true).order("sort"),
    db.from("bos_checklist_checks").select("*").eq("date", t),
  ]);
  state.tasks = tasks.data ?? [];
  state.projects = projects.data ?? [];
  state.skills = skills.data ?? [];
  state.ideas = ideas.data ?? [];
  state.habits = habits.data ?? [];
  state.habitChecks = habitChecks.data ?? [];
  state.checklistItems = clItems.data ?? [];
  state.checklistChecks = clChecks.data ?? [];
  renderAll();
}

function renderAll() {
  renderToday();
  renderTasks();
  renderProjects();
  renderSkills();
  renderIdeas();
}

/* ---------------- Bugün ---------------- */

function renderToday() {
  const t = todayStr();
  const box = $("today-tasks");
  const todays = state.tasks.filter((x) => !x.done && x.due_date && x.due_date <= t);
  const noDate = state.tasks.filter((x) => !x.done && !x.due_date);
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

  // Alışkanlıklar
  const hb = $("today-habits");
  hb.innerHTML = "";
  state.habits.forEach((h) => {
    const on = state.habitChecks.some((c) => c.habit_id === h.id);
    const chip = document.createElement("button");
    chip.className = "chip" + (on ? " on" : "");
    chip.innerHTML = `${h.icon ?? ""} ${esc(h.name)} ${on ? "✓" : ""}`;
    chip.addEventListener("click", () => toggleHabit(h.id, on));
    hb.appendChild(chip);
  });

  // Trading rutini
  const kind = isWeekend() ? "haftasonu" : "gunluk";
  $("checklist-title").textContent = isWeekend() ? "Hafta sonu rutini" : "Piyasa rutini";
  const cl = $("today-checklist");
  cl.innerHTML = "";
  state.checklistItems.filter((i) => i.kind === kind).forEach((item) => {
    const on = state.checklistChecks.some((c) => c.item_id === item.id);
    const row = document.createElement("div");
    row.className = "item" + (on ? " done" : "");
    row.innerHTML = `<button class="check ${on ? "on" : ""}">✓</button><div class="grow"><div class="title">${esc(item.label)}</div></div>`;
    row.querySelector(".check").addEventListener("click", () => toggleChecklist(item.id, on));
    cl.appendChild(row);
  });
}

async function toggleHabit(habitId, on) {
  if (on) {
    await db.from("bos_habit_checks").delete().eq("habit_id", habitId).eq("date", todayStr());
  } else {
    await db.from("bos_habit_checks").insert({ habit_id: habitId, date: todayStr() });
  }
  await loadAll();
}

async function toggleChecklist(itemId, on) {
  if (on) {
    await db.from("bos_checklist_checks").delete().eq("item_id", itemId).eq("date", todayStr());
  } else {
    await db.from("bos_checklist_checks").insert({ item_id: itemId, date: todayStr() });
  }
  await loadAll();
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
