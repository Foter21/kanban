const ROLE_LABEL = { OWNER: "Dono", EDITOR: "Editor", VIEWER: "Leitor" };
const ACCENTS = ["#1a936f", "#2f7fd1", "#8a5cd6", "#d9822b", "#c4477a", "#12a3a8"];
const $ = id => document.getElementById(id);
let mineAll = [], toastTimer = null, pendingDelete = null, meId = null;

function toast(message) { const t = $("toast"); t.textContent = message; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3200); }
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
function plural(n, one, many) { return `${n} ${n === 1 ? one : many}`; }
const ICON = {
  users: '<svg viewBox="0 0 24 24"><path d="M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 20v-1a4 4 0 0 0-3-3.9M16 4.1a3.5 3.5 0 0 1 0 6.8"/></svg>',
  task: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/></svg>',
  arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  board: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="13" rx="1.5"/></svg>',
  share: '<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/></svg>'
};

function card(board, shared) {
  const accent = ACCENTS[board.id % ACCENTS.length];
  const wrap = el("div", "bp-card"); wrap.style.setProperty("--ac", accent);
  const a = el("a", "bp-link"); a.href = `/board/${board.id}`; a.setAttribute("aria-label", `Abrir quadro ${board.name}`);
  const top = el("div", "bp-top");
  const badge = el("span", "bp-ico"); badge.innerHTML = shared ? ICON.share : ICON.board;
  const role = el("span", `role-badge r-${board.role}`, ROLE_LABEL[board.role]); role.style.margin = "0";
  top.append(badge, role);
  const h = el("h3", "bp-name", board.name);
  const sub = el("p", "bp-sub", shared ? `Compartilhado por ${board.owner_name}` : (board.owner_id === meId ? "Criado por você" : `Você é dono · criado por ${board.owner_name}`));
  const meta = el("div", "bp-meta");
  const m1 = el("span"); m1.innerHTML = ICON.task; m1.append(plural(board.task_count, "tarefa", "tarefas"));
  const m2 = el("span"); m2.innerHTML = ICON.users; m2.append(plural(board.member_count, "membro", "membros"));
  meta.append(m1, m2);
  const go = el("div", "bp-go"); go.append("Abrir quadro "); const ar = el("i"); ar.innerHTML = ICON.arrow; go.appendChild(ar);
  a.append(top, h, sub, meta, go); wrap.appendChild(a);
  if (board.role === "OWNER") {
    const del = el("button", "bp-del"); del.type = "button"; del.title = "Excluir quadro";
    del.setAttribute("aria-label", `Excluir quadro ${board.name}`); del.innerHTML = ICON.trash;
    del.addEventListener("click", () => askDelete(board));
    wrap.appendChild(del);
  }
  return wrap;
}
function emptyState(title, text) {
  const e = el("div", "bp-empty"); const i = el("span", "bp-empty-ico"); i.innerHTML = ICON.board;
  e.append(i, el("b", "", title), el("span", "", text)); return e;
}
function fill(boxId, countId, items, shared, title, text) {
  const box = $(boxId); box.textContent = "";
  $(countId).textContent = items.length ? String(items.length) : "";
  if (!items.length) { box.classList.add("is-empty"); box.appendChild(emptyState(title, text)); return; }
  box.classList.remove("is-empty"); items.forEach(b => box.appendChild(card(b, shared)));
}
function renderMine() {
  const q = $("search").value.trim().toLowerCase();
  const list = q ? mineAll.filter(b => b.name.toLowerCase().includes(q)) : mineAll;
  if (mineAll.length && !list.length) { $("mine").textContent = ""; $("mine").classList.add("is-empty"); $("mine").appendChild(emptyState("Nada encontrado", `Nenhum quadro com “${$("search").value.trim()}”.`)); return; }
  fill("mine", "mineCount", list, false, "Comece seu primeiro quadro", "Use o campo acima, dê um nome e organize suas tarefas em colunas.");
}
function skeleton(boxId) { const box = $(boxId); box.textContent = ""; box.classList.remove("is-empty"); for (let i = 0; i < 3; i++) box.appendChild(el("div", "bp-card bp-skel")); }

function askDelete(board) {
  pendingDelete = board;
  $("delText").textContent = `“${board.name}” tem ${plural(board.task_count, "tarefa", "tarefas")}. Todas as tarefas, comentários e acessos serão apagados e isso não pode ser desfeito.`;
  $("delDialog").showModal();
}
$("delCancel").addEventListener("click", () => $("delDialog").close());
$("delOk").addEventListener("click", async () => {
  if (!pendingDelete) return;
  const b = pendingDelete; $("delOk").disabled = true;
  try { await api(`/boards/${b.id}`, { method: "DELETE" }); $("delDialog").close(); toast("Quadro excluído."); load(); }
  catch (e) { toast(e.message); }
  finally { $("delOk").disabled = false; pendingDelete = null; }
});

async function load() {
  skeleton("mine");
  try {
    const [{ user }, lists] = await Promise.all([api("/me"), api("/boards")]);
    $("accName").textContent = user.name; $("avatar").textContent = initials(user.name);
    $("greeting").textContent = `Olá, ${String(user.name).trim().split(/\s+/)[0]}`;
    meId = user.id; mineAll = lists.mine;
    $("stBoards").textContent = lists.mine.length; $("stShared").textContent = lists.shared.length;
    $("stTasks").textContent = [...lists.mine, ...lists.shared].reduce((n, b) => n + (b.task_count || 0), 0);
    $("stats").hidden = false; $("searchWrap").hidden = lists.mine.length < 5;
    renderMine();
    fill("shared", "sharedCount", lists.shared, true, "Nada compartilhado ainda", "Quando alguém convidar você para um quadro, ele aparece aqui.");
  } catch (e) { toast(e.message); }
}
$("search").addEventListener("input", renderMine);
$("newBoardForm").addEventListener("submit", async event => {
  event.preventDefault();
  const name = $("newBoardName").value.trim(); if (!name) { $("newBoardName").focus(); return; }
  const btn = $("createBtn"); btn.disabled = true;
  try { const board = await api("/boards", { method: "POST", body: { name } }); location.href = `/board/${board.id}`; }
  catch (e) { toast(e.message); btn.disabled = false; }
});
$("logout").addEventListener("click", doLogout);
load();
