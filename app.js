import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://eeelyejmyrjjiusequoh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlZWx5ZWpteXJqaml1c2VxdW9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMjM3NDcsImV4cCI6MjA5NTY5OTc0N30.tnAhrnBjGP07WM2zMC0kRHYAbGFhRwb4yVCPvFgjXoY";

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (id) => document.getElementById(id);
const state = { tasks: [], categories: [] };
const collapsedCats = new Set();
let sortMode = "category"; // "category" | "priority"

const PRIO = {
  acil: { label: "Acil",  bg: "#ff5d5d" },
  orta: { label: "Orta",  bg: "#ffb224" },
  sonra:{ label: "Sonra", bg: "#8a93a3" },
};
const PRIO_ORDER = [null, "acil", "orta", "sonra"];
const PRIO_RANK  = { acil: 0, orta: 1, sonra: 2 };

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
  populateCategorySelect();
  renderTasks();
  renderCategories();
}

/* ---------------- Kategoriler ---------------- */

function catName(area) {
  if (!area) return "Belirsiz";
  return state.categories.find((c) => c.name === area)?.name ?? area;
}

function populateCategorySelect() {
  const sel = $("new-task-area");
  const prev = sel.value;
  sel.innerHTML = '<option value="">Belirsiz</option>';
  state.categories.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat.name;
    opt.textContent = cat.name;
    sel.appendChild(opt);
  });
  if (prev) sel.value = prev;
}

function makeInlineEditor(currentValue, onSave) {
  const input = document.createElement("input");
  input.type = "text";
  input.value = currentValue;
  input.className = "title-input";

  let saved = false;
  async function save() {
    if (saved) return;
    saved = true;
    const newVal = input.value.trim();
    await onSave(newVal);
  }

  input.addEventListener("blur", save);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); input.blur(); }
    if (e.key === "Escape") { saved = true; input.blur(); }
  });
  return input;
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

    const titleEl = document.createElement("div");
    titleEl.className = "title edit-title";
    titleEl.textContent = cat.name;

    const grow = document.createElement("div");
    grow.className = "grow";
    grow.appendChild(titleEl);

    const delBtn = document.createElement("button");
    delBtn.className = "del-btn";
    delBtn.title = "Sil";
    delBtn.textContent = "✕";

    row.appendChild(grow);
    row.appendChild(delBtn);

    titleEl.addEventListener("click", () => {
      const input = makeInlineEditor(cat.name, async (newName) => {
        if (newName && newName !== cat.name) {
          const { error } = await db.from("bos_categories").update({ name: newName }).eq("id", cat.id);
          if (error) { alert("Hata: " + error.message); titleEl.textContent = cat.name; input.replaceWith(titleEl); return; }
          await db.from("bos_tasks").update({ area: newName }).eq("area", cat.name);
        }
        await loadAll();
      });
      titleEl.replaceWith(input);
      input.focus();
      input.select();
    });

    delBtn.addEventListener("click", async () => {
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

/* ---------------- Görevler ---------------- */

function taskRow(task) {
  const row = document.createElement("div");
  row.className = "item" + (task.done ? " done" : "");

  const p = task.priority;
  const prioBg = p ? PRIO[p].bg : "#232830";
  const catOptions = ['<option value="">Belirsiz</option>',
    ...state.categories.map((c) =>
      `<option value="${esc(c.name)}" ${task.area === c.name ? "selected" : ""}>${esc(c.name)}</option>`)
  ].join("");

  row.innerHTML = `
    <button class="prio-btn" style="background:${prioBg}" title="${p ? PRIO[p].label : "Öncelik yok"}"></button>
    <button class="check ${task.done ? "on" : ""}">✓</button>
    <div class="grow">
      <div class="title edit-title">${esc(task.title)}</div>
    </div>
    <select class="cat-sel">${catOptions}</select>
    <button class="del-btn" title="Sil">✕</button>`;

  row.querySelector(".prio-btn").addEventListener("click", async () => {
    const cur = PRIO_ORDER.indexOf(task.priority ?? null);
    const next = PRIO_ORDER[(cur + 1) % PRIO_ORDER.length];
    await db.from("bos_tasks").update({ priority: next }).eq("id", task.id);
    await loadAll();
  });

  row.querySelector(".check").addEventListener("click", () => toggleTask(task));

  const titleEl = row.querySelector(".edit-title");
  titleEl.addEventListener("click", () => {
    const input = makeInlineEditor(task.title, async (newTitle) => {
      if (newTitle && newTitle !== task.title) {
        await db.from("bos_tasks").update({ title: newTitle }).eq("id", task.id);
      }
      await loadAll();
    });
    titleEl.replaceWith(input);
    input.focus();
    input.select();
  });

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

  return row;
}

function renderTasks() {
  const open = state.tasks.filter((x) => !x.done);
  const done = state.tasks.filter((x) => x.done).sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));

  const ob = $("open-tasks");
  ob.innerHTML = "";
  if (open.length === 0) {
    ob.innerHTML = '<p class="empty">Açık görev yok.</p>';
  } else if (sortMode === "priority") {
    const PRIO_GROUPS = [
      { key: "acil",  label: "🔴 Acil"  },
      { key: "orta",  label: "🟡 Orta"  },
      { key: "sonra", label: "⚫ Sonra" },
      { key: null,    label: "— Önceliksiz" },
    ];
    PRIO_GROUPS.forEach(({ key, label }) => {
      const tasks = open.filter((t) => (t.priority ?? null) === key);
      if (tasks.length === 0) return;
      const collapsed = collapsedCats.has(label);
      const grp = document.createElement("div");
      grp.className = "cat-group";
      const header = document.createElement("div");
      header.className = "cat-header";
      header.innerHTML = `<span class="chevron">${collapsed ? "▶" : "▼"}</span> ${label} <span class="muted">${tasks.length}</span>`;
      header.style.cursor = "pointer";
      const body = document.createElement("div");
      body.className = "cat-body" + (collapsed ? " hidden" : "");
      tasks.forEach((task) => body.appendChild(taskRow(task)));
      header.addEventListener("click", () => {
        if (collapsedCats.has(label)) collapsedCats.delete(label);
        else collapsedCats.add(label);
        renderTasks();
      });
      grp.appendChild(header);
      grp.appendChild(body);
      ob.appendChild(grp);
    });
  } else {
    const groups = new Map();
    groups.set("Belirsiz", []);
    state.categories.forEach((c) => groups.set(c.name, []));
    open.forEach((task) => {
      const key = task.area && groups.has(task.area) ? task.area : "Belirsiz";
      groups.get(key).push(task);
    });
    groups.forEach((tasks, name) => {
      if (tasks.length === 0) return;
      tasks.sort((a, b) => (PRIO_RANK[a.priority] ?? 99) - (PRIO_RANK[b.priority] ?? 99));
      const collapsed = collapsedCats.has(name);
      const grp = document.createElement("div");
      grp.className = "cat-group";
      const header = document.createElement("div");
      header.className = "cat-header";
      header.innerHTML = `<span class="chevron">${collapsed ? "▶" : "▼"}</span> ${esc(name)} <span class="muted">${tasks.length}</span>`;
      header.style.cursor = "pointer";
      const body = document.createElement("div");
      body.className = "cat-body" + (collapsed ? " hidden" : "");
      tasks.forEach((task) => body.appendChild(taskRow(task)));
      header.addEventListener("click", () => {
        if (collapsedCats.has(name)) collapsedCats.delete(name);
        else collapsedCats.add(name);
        renderTasks();
      });
      grp.appendChild(header);
      grp.appendChild(body);
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

$("sort-toggle").addEventListener("click", () => {
  sortMode = sortMode === "category" ? "priority" : "category";
  $("sort-toggle").textContent = sortMode === "category" ? "Önceliğe göre" : "Kategoriye göre";
  renderTasks();
});

$("add-task-btn").addEventListener("click", addTask);
$("new-task-title").addEventListener("keydown", (e) => { if (e.key === "Enter") addTask(); });
async function addTask() {
  const title = $("new-task-title").value.trim();
  if (!title) return;
  await db.from("bos_tasks").insert({ title, area: $("new-task-area").value || null, priority: $("new-task-prio").value || null });
  $("new-task-title").value = "";
  await loadAll();
}

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
