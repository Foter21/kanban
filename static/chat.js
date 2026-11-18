// Chat lateral "Pergunte ao seu projeto": só fala com o NOSSO back-end (/api/ai/chat).
// A chave da IA nunca chega aqui: ela fica no .env do servidor.
(() => {
  const BOARD = Number(location.pathname.split("/").filter(Boolean).pop());
  const $ = id => document.getElementById(id);
  const panel = $("chatPanel"), log = $("chatLog"), input = $("chatInput"), send = $("chatSend"), suggest = $("chatSuggest");
  let busy = false;

  function setOpen(open) {
    panel.hidden = !open; $("openChat").setAttribute("aria-expanded", String(open));
    if (open) { if (!log.children.length) bubble("bot", "Oi! Pergunte sobre o andamento do projeto. Eu só uso os cards reais deste quadro."); input.focus(); }
  }
  function bubble(who, text, extra) {
    const el = document.createElement("div"); el.className = `msg msg-${who}${extra ? " " + extra : ""}`;
    el.textContent = text; log.appendChild(el); log.scrollTop = log.scrollHeight; return el;
  }
  async function ask(question) {
    question = question.trim();
    if (!question || busy) return;
    busy = true; send.disabled = true; suggest.hidden = true;
    bubble("user", question); input.value = ""; autosize();
    const wait = bubble("bot", "Consultando os cards...", "typing");
    try {
      const res = await api("/ai/chat", { method: "POST", body: { board_id: BOARD, question } });
      wait.className = "msg msg-bot"; wait.textContent = res.answer || "Sem resposta.";
    } catch (e) {
      wait.className = "msg msg-bot msg-error"; wait.textContent = e.message;
    } finally { busy = false; send.disabled = false; log.scrollTop = log.scrollHeight; input.focus(); }
  }
  function autosize() { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 110) + "px"; }

  $("openChat").addEventListener("click", () => setOpen(panel.hidden));
  $("chatClose").addEventListener("click", () => setOpen(false));
  $("chatForm").addEventListener("submit", e => { e.preventDefault(); ask(input.value); });
  input.addEventListener("input", autosize);
  input.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input.value); } });
  suggest.querySelectorAll(".chip-btn").forEach(b => b.addEventListener("click", () => ask(b.textContent)));
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !panel.hidden) setOpen(false); });
})();
