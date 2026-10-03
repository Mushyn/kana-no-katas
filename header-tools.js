// Les deux boutons du coin haut droit de CHAQUE écran : taille de l'affichage et mode d'emploi.
//
// Dans la page on écrit seulement un repère : <span class="hd-tools" data-tools="ch04"></span>
// (la valeur est le chapitre du guide à ouvrir). Ce fichier le remplace par les deux boutons,
// ce qui garantit le même dessin, la même place et le même comportement partout.
//
// Le bouton « taille de l'affichage » change le niveau de réduction de la hauteur (viewport.js :
// plein écran, puis 40 px, puis 80 px de marge en bas, pour les téléphones dont une barre
// système masque le bas de l'écran). Le niveau est mémorisé et commun à tous les écrans.
(function () {
  const VIEW_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="8 8 12 4 16 8"/><polyline points="8 16 12 20 16 16"/><line x1="12" y1="4" x2="12" y2="20"/></svg>';
  const HELP_ICON = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5.5C3 4.67 3.67 4 4.5 4H10a2 2 0 0 1 2 2v14a1.5 1.5 0 0 0-1.5-1.5H4.5A1.5 1.5 0 0 1 3 17V5.5Z"/><path d="M21 5.5c0-.83-.67-1.5-1.5-1.5H14a2 2 0 0 0-2 2v14a1.5 1.5 0 0 1 1.5-1.5h5.5a1.5 1.5 0 0 0 1.5-1.5V5.5Z"/></svg>';

  // Met à jour l'aspect (actif = affichage réduit) de tous les boutons de la page
  function refresh() {
    const lvl = typeof getViewLevel === 'function' ? getViewLevel() : 0;
    document.querySelectorAll('.view-btn[data-view]').forEach(b => {
      b.classList.toggle('active', lvl > 0);
      b.title = lvl > 0 ? 'Affichage réduit (niveau ' + lvl + ')' : 'Ajuster la hauteur de l\'affichage';
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.hd-tools[data-tools]').forEach(box => {
      box.innerHTML =
        '<button type="button" class="view-btn" data-view aria-label="Ajuster la hauteur de l\'affichage">' + VIEW_ICON + '</button>' +
        '<a class="help-btn" href="guide/index.html#' + box.dataset.tools + '" aria-label="Mode d\'emploi" title="Mode d\'emploi">' + HELP_ICON + '</a>';
    });
    refresh();
  });

  // Un seul gestionnaire pour tous les boutons, y compris ceux créés plus tard
  document.addEventListener('click', e => {
    const b = e.target.closest('.view-btn[data-view]');
    if (!b || typeof cycleViewLevel !== 'function') return;
    cycleViewLevel();
    refresh();
  });
  window.addEventListener('pageshow', refresh);
})();
