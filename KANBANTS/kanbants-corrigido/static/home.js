// Página inicial: navbar translúcida, ano no rodapé e CTAs conforme a sessão
(() => {
  const nav = document.getElementById("nav");
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 12);
  onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
  document.getElementById("year").textContent = new Date().getFullYear();

  // Se já estiver logado, troca "Entrar/Começar" por "Meus quadros"
  fetch("/api/me", { credentials: "same-origin" }).then(r => {
    if (!r.ok) return;
    document.querySelectorAll("[data-guest]").forEach(e => e.hidden = true);
    document.querySelectorAll("[data-auth]").forEach(e => e.hidden = false);
  }).catch(() => {});
})();
