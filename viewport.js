// Hauteur réelle de la zone visible, exposée en CSS sous --app-h (en pixels).
//
// Pourquoi : en PWA installé sur certains Android, `100dvh` peut rester figé sur une
// valeur obsolète (ex. la hauteur au lancement, avant l'apparition des barres système).
// Le conteneur est alors plus haut que l'écran et la barre de boutons du bas est
// coupée. On remesure donc window.innerHeight (fiable) et on le pose nous-mêmes.
(function () {
  const root = document.documentElement;
  let last = null;

  function sync() {
    const h = Math.round(window.innerHeight);
    const changed = last !== null && h !== last;
    last = h;
    // On réécrit la valeur à chaque passage : si quelque chose l'a faussée, elle est corrigée.
    root.style.setProperty('--app-h', h + 'px');
    // Les pages calculent la taille de leurs éléments (canvas, grille...) sur l'évènement
    // « resize » : on le relance si la hauteur a changé sans que le navigateur l'ait fait.
    if (changed) window.dispatchEvent(new Event('resize'));
  }

  sync();
  window.addEventListener('resize', sync);
  window.addEventListener('orientationchange', sync);
  window.addEventListener('pageshow', sync);
  document.addEventListener('visibilitychange', sync);
  // Filet de sécurité : certaines barres système changent la hauteur sans évènement.
  // Le coût est nul (une lecture par seconde, aucune écriture si rien ne change).
  setInterval(sync, 1000);
})();
