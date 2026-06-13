import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://eeelyejmyrjjiusequoh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlZWx5ZWpteXJqaml1c2VxdW9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMjM3NDcsImV4cCI6MjA5NTY5OTc0N30.tnAhrnBjGP07WM2zMC0kRHYAbGFhRwb4yVCPvFgjXoY";

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (id) => document.getElementById(id);
const state = {
  tasks: [], categories: [],
};

function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayStr() {
  return dateStr(new Date());
}
function localDateOf(ts) {
  return dateStr(new Date(ts));
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
  const [tasks, categories] = await Promise.all([
    db.from("bos_tasks").select("*").order("done").order("created_at"),
    db.from("bos_categories").select("*").order("sort"),
  ]);
  state.tasks = tasks.data ?? [];
  state.categories = categories.data ?? [];
  renderAll();
}

function renderAll() {
  populateCategorySelect();
  renderToday();
  renderTasks();
  renderCategories();
}

/* ---------------- Kategoriler ---------------- */

function catName(area) {
  if (!area) return "Belirsiz";
  const cat = state.categories.find((c) => c.name === area);
  return cat ? cat.name : area;
}

function populateCategorySelect() {
  const sel = $("new-task-area");
  const prev = sel.value;
  sel.innerHTML = "";
  const belirsiz = document.createElement("option");
  belirsiz.value = "";
  belirsiz.textContent = "Belirsiz";
  sel.appendChild(belirsiz);
  state.categories.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat.name;
    opt.textContent = cat.name;
    sel.appendChild(opt);
  });
  if (prev) sel.value = prev;
}

function renderCategories() {
  const box = $("categories-list");
  box.innerHTML = "";
  if (state.categories.length === 0) {
    box.innerHTML = '<p class="empty">Henüz kategori yok.</p>';
    return;
  }
  state.categories.forEach((cat) => {
    const row = document.createElement("div");
    row.className = "item";
    row.innerHTML = `
      <div class="grow"><div class="title edit-title">${esc(cat.name)}</div></div>
      <button class="del-btn" title="Sil">✕</button>`;

    const titleEl = row.querySelector(".edit-title");
    titleEl.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "text";
      input.value = cat.name;
      input.className = "title-input";
      titleEl.replaceWith(input);
      input.focus();
      input.select();

      async function save() {
        const newName = input.value.trim();
        if (newName && newName !== cat.name) {
          await db.from("bos_categories").update({ name: newName }).eq("id", cat.id);
          await db.from("bos_tasks").update({ area: newName }).eq("area", cat.name);
          await loadAll();
        } else {
          input.replaceWith(titleEl);
        }
      }

      input.addEventListener("blur", save);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); input.blur(); }
        if (e.key === "Escape") { input.replaceWith(titleEl); }
      });
    });

    row.querySelector(".del-btn").addEventListener("click", async () => {
      if (confirm(`"${cat.name}" kategorisi silinsin mi?`)) {
        await db.from("bos_categories").delete().eq("id", cat.id);
        await loadAll();
      }
    });
    box.appendChild(row);
  });
}

$("add-cat-btn").addEventListener("click", addCategory);
$("new-cat-name").addEventListener("keydown", (e) => { if (e.key === "Enter") addCategory(); });
async function addCategory() {
  const name = $("new-cat-name").value.trim();
  if (!name) return;
  const maxSort = state.categories.reduce((m, c) => Math.max(m, c.sort ?? 0), 0);
  const { error } = await db.from("bos_categories").insert({ name, sort: maxSort + 10 });
  if (error) { alert("Hata: " + error.message); return; }
  $("new-cat-name").value = "";
  await loadAll();
}

/* ---------------- Bugün ---------------- */

function renderToday() {
  const t = todayStr();
  const box = $("today-tasks");
  const open = state.tasks.filter((x) => !x.done);
  const doneToday = state.tasks.filter((x) => x.done && x.done_at && localDateOf(x.done_at) === t);
  box.innerHTML = "";
  if (open.length === 0) {
    box.innerHTML = '<p class="empty">Açık görev yok. 👌</p>';
  } else {
    open.slice(0, 6).forEach((task) => box.appendChild(taskRow(task, true)));
  }

  const shown = Math.min(open.length, 6);
  $("today-task-cnt").textContent = open.length ? `${open.length} açık` : "";

  const total = doneToday.length + open.length;
  const barWrap = $("today-task-bar-wrap");
  if (doneToday.length > 0) {
    barWrap.classList.remove("hidden");
    $("today-task-bar").style.width = `${Math.round((doneToday.length / total) * 100)}%`;
  } else {
    barWrap.classList.add("hidden");
  }

  $("today-stats").innerHTML = `
    <div class="stat ac-blue"><div class="n">${doneToday.length}/${total || doneToday.length}</div><div class="l">GÖREV</div></div>`;
}

/* ---------------- Görevler ---------------- */

function taskRow(task, compact = false) {
  const row = document.createElement("div");
  row.className = "item" + (task.done ? " done" : "");

  const catOptions = ['<option value="">Belirsiz</option>',
    ...state.categories.map((c) =>
      `<option value="${esc(c.name)}" ${task.area === c.name ? "selected" : ""}>${esc(c.name)}</option>`)
  ].join("");

  row.innerHTML = `
    <button class="check ${task.done ? "on" : ""}">✓</button>
    <div class="grow">
      <div class="title edit-title">${esc(task.title)}</div>
    </div>
    ${compact ? `<span class="badge">${esc(catName(task.area))}</span>` :
      `<select class="cat-sel">${catOptions}</select>
       <button class="del-btn" title="Sil">✕</button>`}`;

  row.querySelector(".check").addEventListener("click", () => toggleTask(task));

  // Inline title editing
  const titleEl = row.querySelector(".edit-title");
  titleEl.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "text";
    input.value = task.title;
    input.className = "title-input";
    titleEl.replaceWith(input);
    input.focus();
    input.select();

    async function save() {
      const newTitle = input.value.trim();
      if (newTitle && newTitle !== task.title) {
        await db.from("bos_tasks").update({ title: newTitle }).eq("id", task.id);
        await loadAll();
      } else {
        input.replaceWith(titleEl);
      }
    }

    input.addEventListener("blur", save);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); input.blur(); }
      if (e.key === "Escape") { input.replaceWith(titleEl); }
    });
  });

  if (!compact) {
    const sel = row.querySelector(".cat-sel");
    sel.addEventListener("change", async () => {
      await db.from("bos_tasks").update({ area: sel.value || null }).eq("id", task.id);
      await loadAll();
    });
    row.querySelector(".del-btn").addEventListener("click", async () => {
      if (confirm("Görev silinsin mi?")) {
        await db.from("bos_tasks").delete().eq("id", task.id);
        await loadAll();
      }
    });
  }

  return row;
}

function renderTasks() {
  const open = state.tasks.filter((x) => !x.done);
  const done = state.tasks.filter((x) => x.done).sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));
  const ob = $("open-tasks");
  ob.innerHTML = "";

  if (open.length === 0) {
    ob.innerHTML = '<p class="empty">Açık görev yok.</p>';
  } else {
    // Group by category
    const groups = new Map();
    groups.set("Belirsiz", []);
    state.categories.forEach((c) => groups.set(c.name, []));

    open.forEach((task) => {
      const key = task.area && groups.has(task.area) ? task.area : "Belirsiz";
      groups.get(key).push(task);
    });

    groups.forEach((tasks, name) => {
      if (tasks.length === 0) return;
      const grp = document.createElement("div");
      grp.className = "cat-group";
      grp.innerHTML = `<div class="cat-header">${esc(name)} <span class="muted">${tasks.length}</span></div>`;
      tasks.forEach((task) => grp.appendChild(taskRow(task)));
      ob.appendChild(grp);
    });
  }

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
    area: $("new-task-area").value || null,
  });
  $("new-task-title").value = "";
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
