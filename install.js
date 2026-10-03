// Proposition d'installer l'application (PWA) sur l'écran d'accueil.
//
// Trois cas, décidés par installMode() :
//   - 'prompt'   : le navigateur sait installer l'appli (Android, Chrome/Edge sur ordinateur) :
//                  il envoie l'événement « beforeinstallprompt », on le garde et un bouton le déclenche ;
//   - 'ios-tuto' : iPhone / iPad : aucune API, on affiche un mini tutoriel (Partager > Sur l'écran d'accueil) ;
//   - 'none'     : déjà installée (lancée en mode « standalone »), ou navigateur qui ne sait pas faire : rien.
//
// Les fonctions de décision ne touchent ni à la page ni au stockage : on peut les tester avec Node
// (tests/install.test.js). Le reste du fichier (le panneau) ne tourne que dans un navigateur.

(function (root) {
  const DISMISS_KEY = 'kana-install-dismissed';   // date du dernier « Plus tard » (en millisecondes)
  const REMIND_AFTER_DAYS = 7;                    // après « Plus tard », le panneau revient au bout d'une semaine
  const SHOW_DELAY_MS = 1200;                     // le panneau apparaît peu après l'ouverture, sans gêner le premier regard

  // Quel système et l'appli est-elle déjà installée ?
  //   nav : navigator (ou un faux objet en test) ; matchMedia : window.matchMedia (ou un faux)
  // Renvoie { os: 'android' | 'ios' | 'mac' | 'windows' | 'linux' | 'other', standalone: true | false }
  function detectPlatform(nav, matchMedia) {
    const ua = nav.userAgent || '';
    let os = 'other';
    if (/android/i.test(ua)) os = 'android';                                            // à tester avant Linux : l'UA Android contient « Linux »
    else if (/iPhone|iPad|iPod/.test(ua)) os = 'ios';
    else if (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1) os = 'ios';        // un iPad se présente comme un Mac, mais il a un écran tactile
    else if (/Windows/i.test(ua)) os = 'windows';
    else if (/Mac/i.test(ua)) os = 'mac';
    else if (/Linux|X11|CrOS/i.test(ua)) os = 'linux';

    const byMedia = !!(matchMedia && matchMedia('(display-mode: standalone)').matches);
    const standalone = byMedia || nav.standalone === true;   // nav.standalone : propriété propre à iOS
    return { os, standalone };
  }

  // Que proposer ? hasPrompt : le navigateur a-t-il envoyé « beforeinstallprompt » ?
  function installMode(info, hasPrompt) {
    if (info.standalone) return 'none';
    if (hasPrompt) return 'prompt';
    if (info.os === 'ios') return 'ios-tuto';
    return 'none';
  }

  // Faut-il montrer le panneau, ou l'a-t-on fermé il y a peu ? (dismissedAt : null ou une date en ms)
  function shouldRemind(dismissedAt, now) {
    if (!dismissedAt) return true;
    return now - dismissedAt >= REMIND_AFTER_DAYS * 24 * 3600 * 1000;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { detectPlatform, installMode, shouldRemind, REMIND_AFTER_DAYS };
    return;
  }

  // ───────── Dans le navigateur : le panneau ─────────
  const info = detectPlatform(root.navigator, root.matchMedia ? q => root.matchMedia(q) : null);
  let deferred = null;     // l'événement « beforeinstallprompt » gardé de côté
  let panel = null;

  function readDismissed() { try { return Number(root.localStorage.getItem(DISMISS_KEY)) || null; } catch (e) { return null; } }
  function writeDismissed() { try { root.localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) { /* ignoré */ } }

  function hide() { if (panel) { panel.classList.remove('show'); setTimeout(() => { if (panel) { panel.remove(); panel = null; } }, 300); } }

  // Pictogrammes en SVG (pas d'emoji : iOS les dessinerait à sa façon)
  const SHARE_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
  const MORE_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';
  const CHEVRON_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';
  const ADD_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';

  function build(mode) {
    const p = document.createElement('div');
    p.id = 'install-panel';
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-label', 'Installer l\'application');
    p.innerHTML =
      '<div class="ip-text"><strong>Tu aimes cette appli ? Installe-la !</strong>' +
      '<span>Elle s\'ouvrira en plein écran depuis ton écran d\'accueil, comme une vraie appli.</span></div>';

    if (mode === 'ios-tuto') {
      const steps = document.createElement('ol');
      steps.className = 'ip-steps';
      steps.innerHTML =
        '<li>Touche le bouton <b>trois points</b> ' + MORE_ICON + ' dans la barre du navigateur <small>(si tu vois déjà Partager, passe à l\'étape 2)</small></li>' +
        '<li>Touche <b>Partager</b> ' + SHARE_ICON + '</li>' +
        '<li>Dans la liste d\'actions, touche <b>En voir plus</b> ' + CHEVRON_ICON + '</li>' +
        '<li>Choisis <b>Sur l\'écran d\'accueil</b> ' + ADD_ICON + '</li>' +
        '<li>Touche <b>Ajouter</b></li>';
      p.appendChild(steps);
    }

    const row = document.createElement('div');
    row.className = 'ip-btns';
    if (mode === 'prompt') {
      const go = document.createElement('button');
      go.className = 'ip-go'; go.textContent = 'Installer';
      go.onclick = async () => {
        if (!deferred) return;
        deferred.prompt();                                  // la fenêtre d'installation du navigateur
        const choice = await deferred.userChoice;           // 'accepted' ou 'dismissed'
        deferred = null;
        if (choice.outcome !== 'accepted') writeDismissed();
        hide();
      };
      row.appendChild(go);
    }
    const later = document.createElement('button');
    later.className = 'ip-later'; later.textContent = mode === 'ios-tuto' ? 'Compris' : 'Plus tard';
    later.onclick = () => { writeDismissed(); hide(); };
    row.appendChild(later);
    p.appendChild(row);
    return p;
  }

  function show() {
    if (panel || !shouldRemind(readDismissed(), Date.now())) return;
    const mode = installMode(info, !!deferred);
    if (mode === 'none') return;
    panel = build(mode);
    document.body.appendChild(panel);
    requestAnimationFrame(() => requestAnimationFrame(() => panel && panel.classList.add('show')));
  }

  // Le navigateur annonce que l'appli est installable : on garde l'événement, le panneau apparaît peu après
  root.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e;
    setTimeout(show, SHOW_DELAY_MS);
  });
  root.addEventListener('appinstalled', () => { deferred = null; hide(); });

  // iPhone / iPad : pas d'événement, on affiche le tutoriel directement
  document.addEventListener('DOMContentLoaded', () => {
    if (installMode(info, false) === 'ios-tuto') setTimeout(show, SHOW_DELAY_MS);
  });
})(typeof window !== 'undefined' ? window : globalThis);
