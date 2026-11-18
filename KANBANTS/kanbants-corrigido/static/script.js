// Quadro Kanban compartilhado: dados vêm da API (/api/boards/:id)
const BOARD_ID = Number(location.pathname.split("/").filter(Boolean).pop());
const PALETTE = ["#2563eb", "#4f46e5", "#7c3aed", "#0ea5e9", "#0f9d83", "#d97706", "#db4777"];
const EMPTY_TEXT = "Arraste tarefas para esta coluna ou use o botão +.";
const ROLE_LABEL = { OWNER: "Dono", EDITOR: "Editor", VIEWER: "Leitor" };
const PRIO_LABEL = { baixa: "Baixa", media: "Média", alta: "Alta" };
const ICON = {
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'
};
let state = null, role = "VIEWER", draggedId = null, lastJson = "", toastTimer = null, chosenColor = PALETTE[0];
const $ = id => document.getElementById(id);
const board = $("board"), projectInput = $("projectName"), taskModal = $("taskModal"), taskForm = $("taskForm");
const colSelect = $("colSelect"), columnModal = $("columnModal"), columnForm = $("columnForm"), swatchBox = $("swatches");
const canEdit = () => role === "OWNER" || role === "EDITOR";
const isOwner = () => role === "OWNER";

function setSync(status, message) { $("syncStatus").className = `sync-status ${status || ""}`.trim(); $("syncText").textContent = message; }
function notify(message) { const t = $("toast"); t.textContent = message; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3200); }
function fail(error) {
  if (error.status === 403 || error.status === 404) { notify(error.message); setTimeout(() => { if (error.status === 404) location.href = "/boards"; }, 1200); }
  else notify(error.message);
  refresh(true);
}

async function refresh(force) {
  try {
    const data = await api(`/boards/${BOARD_ID}`);
    const json = JSON.stringify(data);
    setSync("", "Sincronizado");
    if (!force && json === lastJson) return;
    lastJson = json; state = data; role = data.role; render();
  } catch (error) {
    setSync("error", "Sem conexão com o servidor");
    if (error.status === 404 || error.status === 403) location.href = "/boards";
  }
}
function userIsBusy() {
  const a = document.activeElement;
  return draggedId || document.querySelector("dialog[open]") || a === projectInput || (a && a.classList && a.classList.contains("col-name"));
}

function render() {
  const edit = canEdit();
  $("openColumnModal").hidden = $("openTaskModal").hidden = $("openGenerate").hidden = !edit;
  $("roleBadge").textContent = ROLE_LABEL[role]; $("roleBadge").className = `role-badge r-${role}`;
  $("accName").textContent = state.me.name; $("avatar").textContent = initials(state.me.name);
  projectInput.readOnly = !edit;
  if (document.activeElement !== projectInput) projectInput.value = state.board.name;
  document.title = `${state.board.name} | KANBANTS`;
  board.textContent = "";
  state.columns.forEach(col => board.appendChild(buildColumn(col)));
  if (edit) {
    const add = document.createElement("button");
    add.type = "button"; add.className = "add-column"; add.innerHTML = ICON.plus + "Nova coluna";
    add.addEventListener("click", openColumnModal); board.appendChild(add);
  }
}
function iconButton(svg, label, onClick) {
  const button = document.createElement("button");
  button.type = "button"; button.className = "icon-btn"; button.innerHTML = svg;
  button.title = label; button.setAttribute("aria-label", label); button.addEventListener("click", onClick);
  return button;
}
function buildColumn(col) {
  const items = state.tasks.filter(t => t.column_id === col.id);
  const section = document.createElement("section");
  section.className = "column"; section.style.setProperty("--c", col.color); section.setAttribute("aria-label", col.name);
  const head = document.createElement("div"); head.className = "col-head";
  const dot = document.createElement("span"); dot.className = "dot"; dot.setAttribute("aria-hidden", "true");
  const name = document.createElement("h2"); name.className = "col-name"; name.textContent = col.name;
  if (canEdit()) {
    name.contentEditable = "true"; name.spellcheck = false; name.title = "Clique para renomear a coluna";
    name.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); name.blur(); } });
    name.addEventListener("blur", async () => {
      const value = name.textContent.trim().slice(0, 30);
      if (!value) { name.textContent = col.name; return; }
      if (value !== col.name) { try { await api(`/columns/${col.id}`, { method: "PATCH", body: { name: value } }); refresh(true); } catch (e) { fail(e); } }
    });
  } else name.style.cursor = "default";
  const count = document.createElement("span"); count.className = "count"; count.textContent = items.length;
  head.append(dot, name, count);
  if (canEdit()) {
    head.append(iconButton(ICON.plus, `Adicionar tarefa em ${col.name}`, () => openTaskModal(col.id)));
    const del = iconButton(ICON.trash, `Excluir coluna ${col.name}`, () => deleteColumn(col));
    if (state.columns.length <= 1) { del.disabled = true; del.title = "O quadro precisa ter pelo menos uma coluna"; }
    head.append(del);
  }
  const list = document.createElement("div"); list.className = "cards";
  if (!items.length) { const e = document.createElement("div"); e.className = "empty"; e.textContent = EMPTY_TEXT; list.appendChild(e); }
  else items.forEach(t => list.appendChild(buildCard(t)));
  if (canEdit()) attachDrop(list, col.id);
  section.append(head, list);
  return section;
}
function buildCard(task) {
  const card = document.createElement("article");
  card.className = "card" + (canEdit() ? "" : " readonly"); card.draggable = canEdit(); card.dataset.id = task.id;
  const title = document.createElement("h3");
  const link = document.createElement("a");
  link.href = `/tasks/${task.id}`; link.target = "_blank"; link.rel = "noopener"; link.draggable = false;
  link.textContent = task.title; link.title = "Abrir tarefa em nova aba";
  title.appendChild(link); card.appendChild(title);
  if (task.description) { const p = document.createElement("p"); p.textContent = task.description; card.appendChild(p); }
  if (task.labels.length) {
    const chips = document.createElement("div"); chips.className = "chips";
    task.labels.forEach(l => { const c = document.createElement("span"); c.className = "chip"; c.textContent = l; chips.appendChild(c); });
    card.appendChild(chips);
  }
  if (task.last_comment) {
    const lc = document.createElement("div"); lc.className = "card-comment";
    const who = document.createElement("b"); who.textContent = task.last_comment.author + ": ";
    const txt = document.createElement("span");
    txt.textContent = task.last_comment.text.length > 90 ? task.last_comment.text.slice(0, 90) + "…" : task.last_comment.text;
    lc.append(who, txt); card.appendChild(lc);
  }
  const meta = document.createElement("div"); meta.className = "card-meta";
  const prio = document.createElement("span"); prio.className = `prio prio-${task.priority}`; prio.textContent = PRIO_LABEL[task.priority]; meta.appendChild(prio);
  if (task.due_date) {
    const due = document.createElement("span"); due.className = "due";
    const today = new Date().toISOString().slice(0, 10);
    if (task.due_date < today) due.classList.add("late");
    due.textContent = "Prazo " + fmtDay(task.due_date); meta.appendChild(due);
  }
  if (task.checklist.length) { const c = document.createElement("span"); c.textContent = `☑ ${task.checklist.filter(i => i.done).length}/${task.checklist.length}`; meta.appendChild(c); }
  if (task.comment_count) { const c = document.createElement("span"); c.textContent = `💬 ${task.comment_count}`; meta.appendChild(c); }
  if (task.assignee_id) { const a = document.createElement("span"); a.className = "avatar-sm"; a.textContent = initials(task.assignee_name); a.title = `Responsável: ${task.assignee_name}`; meta.appendChild(a); }
  card.appendChild(meta);
  if (canEdit()) {
    card.appendChild(iconButton(ICON.trash, `Excluir tarefa ${task.title}`, async () => {
      if (!confirm(`Excluir a tarefa “${task.title}”?`)) return;
      try { await api(`/tasks/${task.id}`, { method: "DELETE" }); refresh(true); } catch (e) { fail(e); }
    }));
    card.addEventListener("dragstart", event => {
      draggedId = task.id; event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(task.id));
      requestAnimationFrame(() => card.classList.add("dragging"));
    });
    card.addEventListener("dragend", () => { draggedId = null; card.classList.remove("dragging"); document.querySelectorAll(".cards.over").forEach(el => el.classList.remove("over")); });
  }
  return card;
}
async function deleteColumn(col) {
  const amount = state.tasks.filter(t => t.column_id === col.id).length;
  const question = amount ? `Excluir “${col.name}” e as ${amount} tarefa(s) dentro dela?` : `Excluir a coluna “${col.name}”?`;
  if (!confirm(question)) return;
  try { await api(`/columns/${col.id}`, { method: "DELETE" }); refresh(true); } catch (e) { fail(e); }
}
function cardAfter(list, y) {
  let closest = { offset: Number.NEGATIVE_INFINITY, el: null };
  list.querySelectorAll(".card:not(.dragging)").forEach(el => {
    const box = el.getBoundingClientRect(); const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) closest = { offset, el };
  });
  return closest.el;
}
function attachDrop(list, columnId) {
  list.addEventListener("dragover", e => { if (!draggedId) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; list.classList.add("over"); });
  list.addEventListener("dragleave", e => { if (!list.contains(e.relatedTarget)) list.classList.remove("over"); });
  list.addEventListener("drop", async e => {
    e.preventDefault(); list.classList.remove("over");
    const id = draggedId || Number(e.dataTransfer.getData("text/plain")); if (!id) return;
    const after = cardAfter(list, e.clientY);
    const others = [...list.querySelectorAll(".card:not(.dragging)")].map(el => Number(el.dataset.id));
    const index = after ? others.indexOf(Number(after.dataset.id)) : others.length;
    draggedId = null;
    try { await api(`/tasks/${id}/move`, { method: "POST", body: { column_id: columnId, index } }); } catch (err) { notify(err.message); }
    refresh(true);
  });
}

// --- IA extra B: auto-classificação (tag + prioridade) no modal "Nova tarefa"
let classifySeq = 0, classifyTouched = false, pendingClassify = null;
function setAiHint(text, isError) { const h = $("aiHint"); h.textContent = text; h.classList.toggle("err", !!isError); }
async function classifyTask(manual) {
  const title = $("title").value.trim();
  if (title.length < 3) { if (manual) { setAiHint("Escreva o título da tarefa primeiro.", true); $("title").focus(); } return; }
  const seq = ++classifySeq, btn = $("aiClassify");
  btn.disabled = true; setAiHint("A IA está classificando...");
  const job = (async () => {
    try {
      const r = await api(`/boards/${BOARD_ID}/ai/classify`, { method: "POST", body: { title, description: $("desc").value } });
      if (seq !== classifySeq) return;                      // o usuário mudou o título enquanto isso
      $("prio").value = r.priority; $("tags").value = r.labels.join(", "); classifyTouched = false;
      setAiHint(`✨ IA sugeriu: tag ${r.labels.join(", ")} · prioridade ${PRIO_LABEL[r.priority]}. Você pode ajustar.`);
    } catch (e) { if (seq === classifySeq) setAiHint(manual ? e.message : "", true); }
    finally { if (seq === classifySeq) { btn.disabled = false; pendingClassify = null; } }
  })();
  pendingClassify = job; return job;
}
$("aiClassify").addEventListener("click", () => classifyTask(true));
// sugestão automática ao sair do título, enquanto o usuário não tiver escolhido prioridade/tag à mão
$("title").addEventListener("change", () => { if (!classifyTouched && taskModal.open) classifyTask(false); });
["prio", "tags"].forEach(id => $(id).addEventListener("input", () => { classifyTouched = true; }));

// --- IA extra C: gerador em lote ("Crie 5 cards para app de delivery")
const genModal = $("generateModal"), genForm = $("generateForm");
let genBusy = false;
$("openGenerate").addEventListener("click", () => {
  genForm.reset(); $("genError").textContent = ""; $("genCol").textContent = "";
  state.columns.forEach(c => { const o = document.createElement("option"); o.value = c.id; o.textContent = c.name; $("genCol").appendChild(o); });
  genModal.showModal(); $("genPrompt").focus();
});
$("genSuggest").querySelectorAll(".chip-btn").forEach(b => b.addEventListener("click", () => { $("genPrompt").value = b.textContent; $("genPrompt").focus(); }));
genForm.addEventListener("submit", async event => {
  event.preventDefault(); if (genBusy) return;
  const prompt = $("genPrompt").value.trim(); if (!prompt) return;
  genBusy = true; $("genError").textContent = ""; $("genSubmit").disabled = $("genCancel").disabled = true; $("genSubmit").textContent = "Gerando cards...";
  try {
    const r = await api(`/boards/${BOARD_ID}/ai/generate`, { method: "POST", body: { prompt, column_id: Number($("genCol").value) } });
    genModal.close(); await refresh(true);
    notify(`${r.created} card(s) criado(s) em “${r.column}”.`);
  } catch (e) { $("genError").textContent = e.message; }
  finally { genBusy = false; $("genSubmit").disabled = $("genCancel").disabled = false; $("genSubmit").textContent = "Gerar cards"; }
});
genModal.addEventListener("cancel", e => { if (genBusy) e.preventDefault(); });   // Esc não fecha durante a geração

// --- tarefas e colunas
function openTaskModal(columnId) {
  taskForm.reset(); colSelect.textContent = "";
  state.columns.forEach(c => { const o = document.createElement("option"); o.value = c.id; o.textContent = c.name; colSelect.appendChild(o); });
  colSelect.value = typeof columnId === "number" ? columnId : state.columns[0].id;
  classifyTouched = false; classifySeq++; pendingClassify = null; setAiHint("");
  $("aiClassify").disabled = false;
  taskModal.showModal(); $("desc").style.height = ""; $("title").focus();
}
$("openTaskModal").addEventListener("click", () => openTaskModal());
taskForm.addEventListener("submit", async event => {
  event.preventDefault();
  const title = $("title").value.trim(); if (!title) return;
  if (pendingClassify) await pendingClassify;   // se a IA ainda está sugerindo, espera (no máx. alguns segundos)
  const labels = $("tags").value.split(",").map(x => x.trim()).filter(Boolean);
  try {
    await api(`/boards/${BOARD_ID}/tasks`, { method: "POST", body: { title, description: $("desc").value.trim(), column_id: Number(colSelect.value), priority: $("prio").value, labels } });
    taskModal.close(); refresh(true);
  } catch (e) { taskModal.close(); fail(e); }
});
function paintSwatches() {
  swatchBox.textContent = "";
  PALETTE.forEach(color => {
    const b = document.createElement("button"); b.type = "button"; b.className = "swatch";
    b.style.setProperty("--sw", color); b.setAttribute("aria-label", `Cor ${color}`); b.setAttribute("aria-pressed", String(color === chosenColor));
    b.addEventListener("click", () => { chosenColor = color; paintSwatches(); }); swatchBox.appendChild(b);
  });
}
function openColumnModal() { columnForm.reset(); chosenColor = PALETTE[state.columns.length % PALETTE.length]; paintSwatches(); columnModal.showModal(); $("colName").focus(); }
$("openColumnModal").addEventListener("click", openColumnModal);
columnForm.addEventListener("submit", async event => {
  event.preventDefault(); const name = $("colName").value.trim(); if (!name) return;
  try {
    await api(`/boards/${BOARD_ID}/columns`, { method: "POST", body: { name, color: chosenColor } });
    columnModal.close(); await refresh(true); board.scrollTo({ left: board.scrollWidth, behavior: "smooth" });
  } catch (e) { columnModal.close(); fail(e); }
});
let renameTimer = null;
projectInput.addEventListener("input", () => {
  clearTimeout(renameTimer);
  renameTimer = setTimeout(async () => {
    const name = projectInput.value.trim(); if (!name || !canEdit()) return;
    try { await api(`/boards/${BOARD_ID}`, { method: "PATCH", body: { name } }); document.title = `${name} | KANBANTS`; } catch (e) { notify(e.message); }
  }, 500);
});
projectInput.addEventListener("keydown", e => { if (e.key === "Enter") projectInput.blur(); });

// --- compartilhamento: vários donos; dono convida, altera papéis e remove acesso
const ROLE_OPTIONS = [["OWNER", "Dono"], ["EDITOR", "Editor"], ["VIEWER", "Leitor"]];
const ownerCount = () => state.members.filter(m => m.role === "OWNER").length;
function renderMembers() {
  const list = $("memberList"); list.textContent = "";
  state.members.forEach(m => {
    const li = document.createElement("li"); li.className = "member-row";
    const av = document.createElement("span"); av.className = "account-avatar"; av.textContent = initials(m.name);
    const who = document.createElement("div"); who.className = "who";
    const b = document.createElement("b"); b.textContent = m.name + (m.id === state.me.id ? " (você)" : "");
    const s = document.createElement("span"); s.textContent = m.email; who.append(b, s);
    li.append(av, who);
    if (isOwner() && m.id !== state.me.id) {
      const sel = document.createElement("select"); sel.setAttribute("aria-label", `Papel de ${m.name}`);
      ROLE_OPTIONS.forEach(([v, t]) => { const o = document.createElement("option"); o.value = v; o.textContent = t; sel.appendChild(o); });
      sel.value = m.role;
      sel.addEventListener("change", async () => {
        if (sel.value === "OWNER" && !confirm(`Tornar ${m.name} dono do quadro? Donos têm controle total, inclusive excluir o quadro e remover outros membros.`)) { sel.value = m.role; return; }
        try { await api(`/boards/${BOARD_ID}/members/${m.id}`, { method: "PATCH", body: { role: sel.value } }); await refresh(true); }
        catch (e) { notify(e.message); await refresh(true); }
        renderMembers();
      });
      const rm = iconButton(ICON.trash, `Remover acesso de ${m.name}`, async () => {
        if (!confirm(`Remover o acesso de ${m.name}?`)) return;
        try { await api(`/boards/${BOARD_ID}/members/${m.id}`, { method: "DELETE" }); await refresh(true); renderMembers(); } catch (e) { notify(e.message); }
      });
      li.append(sel, rm);
    } else { const r = document.createElement("span"); r.className = `role-badge r-${m.role}`; r.textContent = ROLE_LABEL[m.role]; li.appendChild(r); }
    list.appendChild(li);
  });
  $("inviteForm").hidden = !isOwner();
  // dono só pode sair se existir outro dono (o quadro nunca fica sem dono)
  $("leaveBoard").hidden = isOwner() && ownerCount() < 2;
}
$("openShare").addEventListener("click", () => { $("inviteError").textContent = ""; $("inviteRole").value = "EDITOR"; renderMembers(); $("shareModal").showModal(); });
$("inviteForm").addEventListener("submit", async event => {
  event.preventDefault(); $("inviteError").textContent = "";
  if ($("inviteRole").value === "OWNER" && !confirm("Convidar como dono? Donos têm controle total do quadro, inclusive excluí-lo e remover outros membros.")) return;
  try {
    await api(`/boards/${BOARD_ID}/members`, { method: "POST", body: { email: $("inviteEmail").value.trim(), role: $("inviteRole").value } });
    $("inviteEmail").value = ""; $("inviteRole").value = "EDITOR"; await refresh(true); renderMembers();
  } catch (e) { $("inviteError").textContent = e.message; }
});
$("leaveBoard").addEventListener("click", async () => {
  if (!confirm("Sair deste quadro?")) return;
  try { await api(`/boards/${BOARD_ID}/members/${state.me.id}`, { method: "DELETE" }); location.href = "/boards"; } catch (e) { notify(e.message); }
});

// --- histórico
$("openActivity").addEventListener("click", async () => {
  const list = $("activityList"); list.textContent = "";
  try {
    const { items } = await api(`/boards/${BOARD_ID}/activity`);
    if (!items.length) { const li = document.createElement("li"); li.textContent = "Nenhuma atividade ainda."; list.appendChild(li); }
    items.forEach(i => { const li = document.createElement("li"); li.textContent = `${i.user_name || "Alguém"} ${i.text}`; const s = document.createElement("small"); s.textContent = fmtDateTime(i.created_at); li.appendChild(s); list.appendChild(li); });
    $("activityModal").showModal();
  } catch (e) { notify(e.message); }
});

$("logout").addEventListener("click", doLogout);
document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => { if (!genBusy) $(b.dataset.close).close(); }));
[taskModal, columnModal, genModal, $("shareModal"), $("activityModal")].forEach(m => m.addEventListener("click", e => { if (e.target === m && !(m === genModal && genBusy)) m.close(); }));

refresh(true);
setInterval(() => { if (!userIsBusy() && !document.hidden) refresh(false); }, 4000); // atualização quase em tempo real
