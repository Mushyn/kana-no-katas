// ── État global ──
let mode = 'both';
// Colonnes connues : réglage commun à tous les jeux (voir shared.js). Identifiant d'une colonne : KanaStore.colKey(col).
let selectedCols = KanaStore.columns();
const isDiacriticKey = key => COLS.some(c => c.diacritic && KanaStore.colKey(c) === key);
let showDiacritics = selectedCols.some(isDiacriticKey); // dakuten + handakuten : affichés dès qu'une de leurs colonnes est choisie
let deckSize = 1;
let showRomaji = false;
let score = { ok: 0, err: 0 };
let fullDeck = [], activeDeck = [];
let selectedCard = null, cells = {};
let errorMap = {}, successSet = new Set(), locked = false;
let pendingTimers = []; // minuteries liées à la partie en cours (annulées au reset)

// setTimeout "rattaché à la partie" : si on recommence, tout ce qui était
// programmé pour l'ancienne partie est annulé et ne peut plus la polluer.
function later(fn, ms) {
  const id = setTimeout(() => {
    pendingTimers = pendingTimers.filter(t => t !== id);
    fn();
  }, ms);
  pendingTimers.push(id);
  return id;
}
function clearPendingTimers() {
  pendingTimers.forEach(clearTimeout);
  pendingTimers = [];
}

// ── Utilitaires ──
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function toggleDiacritics(btn) {
  showDiacritics = !showDiacritics;
  const dia = COLS.filter(c => c.diacritic).map(c => KanaStore.colKey(c));
  selectedCols = showDiacritics ? [...new Set(selectedCols.concat(dia))] : selectedCols.filter(k => !dia.includes(k));
  KanaStore.setColumns(selectedCols);
  btn.classList.toggle('active', showDiacritics);
  btn.setAttribute('aria-pressed', showDiacritics ? 'true' : 'false');
  document.getElementById('diac-switch-state').textContent = showDiacritics ? 'on' : 'off';
  resetGame();
}

function colLabelFor(romaji) {
  for (const col of COLS) {
    if (col.label === 'SEP' || col.label === 'SEP2') continue;
    if (col.s && col.s.includes(romaji)) return col.label;
  }
  return '';
}

// ── Paquet ──
function buildFullDeck() {
  const cards = [];
  COLS.forEach(col => {
    if (col.label === 'SEP' || col.label === 'SEP2') return;
    if (!showDiacritics && col.diacritic) return;
    if (!selectedCols.includes(KanaStore.colKey(col))) return;
    col.s.forEach(v => {
      if (!v) return;
      if (mode === 'both' || mode === 'hiragana')
        cards.push({ romaji: v, char: H[v], type: 'h', id: 'h-' + v, errors: 0 });
      if (mode === 'both' || mode === 'katakana')
        cards.push({ romaji: v, char: K[v], type: 'k', id: 'k-' + v, errors: 0 });
    });
  });
  return shuffle(cards);
}

// ── Calcul dynamique de la taille des cellules ──
function calcCellSize() {
  const zone = document.getElementById('grid-zone');
  const zoneH = zone.getBoundingClientRect().height;
  const ROWS = 5;
  const HDR = 30;       // col-hdr height
  const PADDING = 20;   // padding grid-scroll haut+bas + marge sécu
  const GAP = 4;        // gap entre cellules (ROWS-1 fois)
  const EXTRA = 8;      // marge de sécurité pour éviter tout débordement
  const available = zoneH - HDR - PADDING - (GAP * (ROWS - 1)) - EXTRA;
  const hSize = Math.max(44, Math.floor(available / ROWS));

  // Largeur : toute la grille doit tenir sur un écran (comme dans le puzzle), sans défilement horizontal.
  const { cols, seps } = countVisibleColumns();
  const SEP_W = 10;     // largeur d'un séparateur (.sep-col)
  const SIDE = 20 + 4;  // padding gauche + droite de #grid-scroll + marge de sécurité
  const zoneW = zone.getBoundingClientRect().width;
  const gaps = GAP * Math.max(0, cols + seps - 1);
  const wSize = Math.floor((zoneW - SIDE - gaps - SEP_W * seps) / Math.max(1, cols));

  // Plancher de 14 px (comme le puzzle) : en dessous, la grille redevient défilable plutôt que illisible
  const size = Math.max(14, Math.min(hSize, wSize));
  // Cartes du paquet : aussi grandes que la zone du bas le permet (au moins 78 px, au plus 128 px)
  const deck = document.getElementById('deck-scroll');
  if (deck) {
    const dh = deck.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--card-size', Math.max(78, Math.min(128, Math.floor(dh - 24))) + 'px');
  }
  // Case plus haute que large quand la largeur est le facteur limitant (comme le puzzle : --cw / --ch)
  document.documentElement.style.setProperty('--cell-h', Math.max(size, Math.min(hSize, Math.round(size * 1.6))) + 'px');
  return size;
}

// Nombre de colonnes de kanas et de séparateurs réellement affichés (mêmes règles que buildGrid)
function countVisibleColumns() {
  let cols = 0, seps = 0;
  COLS.forEach(col => {
    if (col.label === 'SEP' || col.label === 'SEP2') { if (showDiacritics) seps++; return; }
    if (!showDiacritics && col.diacritic) return;
    if (!selectedCols.includes(KanaStore.colKey(col))) return;
    cols++;
  });
  return { cols, seps };
}

// ── Loupe pendant le glisser d'une carte ──
// La grille ne bouge pas. Une loupe (bulle fixe) montre, agrandies, la case visée et ses 8 voisines (3 x 3).
// Les vraies cases restent seules à recevoir le doigt : la loupe n'intercepte aucun toucher (pointer-events: none).
let lensEl = null, lensCenter = null;
const LENS_CELL = 54, LENS_GAP = 4;

function startGridZoom() { /* la loupe est créée au premier déplacement */ }
function endGridZoom() {
  if (lensEl) { lensEl.remove(); lensEl = null; }
  lensCenter = null;
}

function updateLens(x, y, cellUnder) {
  if (!cellUnder || cellUnder.classList.contains('empty-slot')) { if (lensEl) lensEl.style.display = 'none'; return; }
  if (!lensEl) {
    lensEl = document.createElement('div');
    lensEl.id = 'lens';
    document.body.appendChild(lensEl);
  }
  lensEl.style.display = 'grid';
  // On ne reconstruit le contenu que si la case visée change
  if (lensCenter !== cellUnder) { lensCenter = cellUnder; fillLens(cellUnder); }
  // Position : au-dessus du doigt (et de la carte glissée), sinon en dessous si on est trop haut
  const size = 3 * LENS_CELL + 2 * LENS_GAP + 16;
  const left = Math.max(6, Math.min(window.innerWidth - size - 6, x - size / 2));
  let top = y - 76 - size;
  if (top < 4) top = y + 76;
  lensEl.style.left = left + 'px';
  lensEl.style.top = top + 'px';
}

// Remplit la loupe avec des copies des 3 x 3 cases autour de la case visée
function fillLens(center) {
  const colEl = center.parentElement;
  const cols = [...document.querySelectorAll('#grid > .kana-col')];   // ordre du DOM : de la droite vers la gauche
  const ci = cols.indexOf(colEl);
  const rows = [...colEl.querySelectorAll('.cell')];
  const ri = rows.indexOf(center);
  lensEl.innerHTML = '';
  lensEl.style.setProperty('--cell-size', LENS_CELL + 'px');
  lensEl.style.setProperty('--cell-h', LENS_CELL + 'px');
  // direction: rtl : la première colonne du DOM s'affiche à droite, comme dans la vraie grille
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const col = cols[ci + dc];
      const src = col ? col.querySelectorAll('.cell')[ri + dr] : null;
      let c;
      if (!src) { c = document.createElement('div'); c.className = 'cell empty-slot'; }
      else { c = src.cloneNode(true); c.classList.remove('drag-over'); }
      if (dr === 0 && dc === 0) c.classList.add('drag-over');
      lensEl.appendChild(c);
    }
  }
}

// ── Grille ──
function buildGrid() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  cells = {};

  const cellSize = calcCellSize();
  document.documentElement.style.setProperty('--cell-size', cellSize + 'px');

  COLS.forEach(col => {
    if (col.label === 'SEP' || col.label === 'SEP2') {
      if (!showDiacritics) return; // cacher séparateur aussi
      const sep = document.createElement('div');
      sep.className = 'sep-col';
      grid.appendChild(sep);
      return;
    }
    if (!showDiacritics && col.diacritic) return;
    if (!selectedCols.includes(KanaStore.colKey(col))) return;
    const colEl = document.createElement('div');
    colEl.className = 'kana-col';

    const hdr = document.createElement('div');
    hdr.className = 'col-hdr';
    hdr.textContent = col.label;
    colEl.appendChild(hdr);

    ['a','i','u','e','o'].forEach((v, i) => {
      const romaji = col.s[i];
      const cell = document.createElement('div');
      if (!romaji) {
        cell.className = 'cell empty-slot';
        colEl.appendChild(cell);
        return;
      }
      cell.className = 'cell';
      cell.dataset.romaji = romaji;
      const rh = document.createElement('div');
      rh.className = 'rhint';
      rh.textContent = romaji;
      cell.appendChild(rh);

      // Desktop drag
      cell.addEventListener('dragover', e => { e.preventDefault(); if (!locked) cell.classList.add('drag-over'); });
      cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
      cell.addEventListener('drop', e => {
        e.preventDefault();
        cell.classList.remove('drag-over');
        if (!locked) handleDrop(cell, e.dataTransfer.getData('cid'));
      });
      // Tap (sélection en 2 temps) — fonctionne aussi au tactile via le
      // click synthétisé par le navigateur après un tap simple (aucun
      // preventDefault ici qui pourrait l'empêcher).
      cell.addEventListener('click', () => { if (!locked) handleCellClick(cell); });

      cells[romaji] = cell;
      colEl.appendChild(cell);
    });
    grid.appendChild(colEl);
  });
}

// ── Cartes ──
function renderDeck() {
  const deckEl = document.getElementById('deck-scroll');
  deckEl.innerHTML = '';

  activeDeck.forEach(card => {
    const el = document.createElement('div');
    el.className = 'card' + (card.type === 'k' ? ' card-kata' : ' card-hira') + (card.errors > 0 ? ' retry-card' : '');
    el.id = 'card-' + card.id;
    el.draggable = true;
    el.dataset.flipped = '0';

    const badge = document.createElement('div');
    badge.className = 'err-badge';
    badge.textContent = '✗' + card.errors;
    el.appendChild(badge);

    const cs = document.createElement('span');
    cs.textContent = card.char;
    el.appendChild(cs);

    if (showRomaji) {
      const r = document.createElement('div');
      r.className = 'card-romaji';
      r.textContent = card.romaji;
      el.appendChild(r);
    }

    // Double tap → retourner
    let tapTimer = null;
    el.addEventListener('click', () => {
      if (locked) return;
      if (tapTimer) {
        clearTimeout(tapTimer); tapTimer = null;
        flipCard(el, card);
      } else {
        tapTimer = setTimeout(() => {
          tapTimer = null;
          if (el.dataset.flipped === '1') return;
          if (selectedCard === card.id) {
            selectedCard = null; el.classList.remove('selected');
          } else {
            document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));
            selectedCard = card.id; el.classList.add('selected');
          }
        }, 220);
      }
    });

    // Desktop drag
    el.addEventListener('dragstart', e => {
      if (locked) { e.preventDefault(); return; }
      e.dataTransfer.setData('cid', card.id);
      el.classList.add('dragging');
      selectedCard = null;
      document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));
    });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));

    // Touch drag (glisser au doigt) + tap (sélection en 2 temps)
    // Les Touch Events gardent toujours leur cible d'origine (la carte),
    // contrairement aux événements souris : il faut donc suivre le doigt
    // soi-même et déterminer la case sous le doigt au lâcher avec
    // document.elementFromPoint, plutôt que d'attendre un "drop" qui
    // n'arrivera jamais sur la case.
    let touchStart = null, touchMoved = false;

    el.addEventListener('touchstart', e => {
      if (locked) return;
      const t = e.touches[0];
      touchStart = { x: t.clientX, y: t.clientY };
      touchMoved = false;
    }, { passive: true });

    el.addEventListener('touchmove', e => {
      if (locked || !touchStart) return;
      const t = e.touches[0];
      const dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
      if (!touchMoved && Math.hypot(dx, dy) > 8) {
        touchMoved = true;
        const r = el.getBoundingClientRect();
        el.dataset.ox = r.left; el.dataset.oy = r.top;
        el.style.width = r.width + 'px';
        el.style.position = 'fixed';
        el.style.zIndex = '1000';
        el.style.pointerEvents = 'none';
        el.classList.add('dragging');
        startGridZoom();
        document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));
        selectedCard = null;
      }
      if (touchMoved) {
        e.preventDefault(); // empêche le scroll de la page pendant le glisser
        el.style.left = (parseFloat(el.dataset.ox) + dx) + 'px';
        el.style.top = (parseFloat(el.dataset.oy) + dy) + 'px';
        document.querySelectorAll('.cell.drag-over').forEach(c => c.classList.remove('drag-over'));
        const under = document.elementFromPoint(t.clientX, t.clientY);
        const cellUnder = under && under.closest('.cell');
        if (cellUnder) cellUnder.classList.add('drag-over');
        updateLens(t.clientX, t.clientY, cellUnder);
      }
    }, { passive: false });

    el.addEventListener('touchend', e => {
      document.querySelectorAll('.cell.drag-over').forEach(c => c.classList.remove('drag-over'));
      if (touchMoved) {
        e.preventDefault(); // un vrai glisser ne doit pas déclencher de tap derrière
        el.style.position = ''; el.style.left = ''; el.style.top = '';
        el.style.zIndex = ''; el.style.pointerEvents = ''; el.style.width = '';
        el.classList.remove('dragging');
        const t = e.changedTouches[0];
        const under = document.elementFromPoint(t.clientX, t.clientY);
        const cellUnder = under && under.closest('.cell');
        endGridZoom();
        if (!locked && cellUnder) handleDrop(cellUnder, card.id);
      }
      // Si ce n'était qu'un tap (touchMoved === false), on ne fait rien ici :
      // le click synthétisé par le navigateur prendra le relais normalement
      // pour la sélection en 2 temps gérée plus haut.
      touchStart = null; touchMoved = false;
    }, { passive: false });

    deckEl.appendChild(el);
  });

  updateScores();
}

function flipCard(el, card) {
  if (el.dataset.flipped === '1') {
    el.dataset.flipped = '0'; el.classList.remove('flipped'); el.innerHTML = '';
    const b = document.createElement('div'); b.className = 'err-badge'; b.textContent = '✗' + card.errors; el.appendChild(b);
    const c = document.createElement('span'); c.textContent = card.char; el.appendChild(c);
    if (showRomaji) { const r = document.createElement('div'); r.className = 'card-romaji'; r.textContent = card.romaji; el.appendChild(r); }
  } else {
    el.dataset.flipped = '1'; el.classList.add('flipped'); el.innerHTML = '';
    const r = document.createElement('span'); r.textContent = card.romaji; el.appendChild(r);
  }
}

// ── Dépôt ──
function handleCellClick(cell) {
  if (!selectedCard) return;
  handleDrop(cell, selectedCard);
  selectedCard = null;
  document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));
}

function handleDrop(cell, cardId) {
  if (!cardId || locked) return;
  const idx = activeDeck.findIndex(c => c.id === cardId);
  if (idx === -1) return;
  const card = activeDeck[idx];
  const romaji = cell.dataset.romaji;

  if (card.romaji === romaji) {
    score.ok++;
    KanaStore.recordTableau(card.type, card.romaji, true);
    activeDeck.splice(idx, 1);
    fullDeck = fullDeck.filter(c => c.id !== cardId);

    let cd = cell.querySelector('.chars');
    if (!cd) { cd = document.createElement('div'); cd.className = 'chars'; cell.insertBefore(cd, cell.firstChild); }
    const s = document.createElement('span');
    s.textContent = card.char;
    s.className = card.type === 'k' ? 'ch-kata' : 'ch-hira';
    cd.appendChild(s);

    if (fullDeck.filter(c => c.romaji === romaji).length === 0) {
      cell.classList.add('correct'); successSet.add(romaji);
    } else {
      cell.style.borderColor = 'var(--green)'; cell.style.background = 'var(--green-light)';
    }
    showMsg('✓ ' + card.char + ' → ' + romaji, 'ok');
    if (activeDeck.length === 0 && fullDeck.length > 0) fillDeck();
    if (fullDeck.length === 0) later(() => showBilan(), 600);

  } else {
    score.err++;
    KanaStore.recordTableau(card.type, card.romaji, false);
    card.errors = (card.errors || 0) + 1;
    errorMap[card.id] = { card, count: card.errors };
    cell.classList.add('wrong');
    setTimeout(() => cell.classList.remove('wrong'), 400);

    // 1. Retirer de activeDeck ET de fullDeck immédiatement
    activeDeck.splice(idx, 1);
    fullDeck = fullDeck.filter(c => c.id !== card.id);
    selectedCard = null;
    document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));
    renderDeck(); // deck sans la carte ratée

    // 2. Afficher feedback + highlight case correcte
    showFeedback(card);
    const cc = cells[card.romaji];
    if (cc) { cc.classList.add('highlight'); setTimeout(() => cc.classList.remove('highlight'), 3200); }

    // 3. Après 3.5s : réinsérer en fin de fullDeck, mélanger, piocher
    later(() => {
      fullDeck.push(card);
      for (let i = fullDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [fullDeck[i], fullDeck[j]] = [fullDeck[j], fullDeck[i]];
      }
      fillDeck(); // complète jusqu'à deckSize, sans dépasser
    }, 3500);
    return;
  }
  renderDeck();
}

// ── Feedback ──
function showFeedback(card) {
  locked = true;
  document.getElementById('fb-char').textContent = card.char;
  document.getElementById('fb-romaji').textContent = card.romaji;
  document.getElementById('fb-col').textContent = 'colonne « ' + colLabelFor(card.romaji) + ' » — ' + card.romaji;
  document.getElementById('feedback').style.display = 'block';
  later(() => { document.getElementById('feedback').style.display = 'none'; locked = false; }, 3500);
}

function showMsg(text, type) {
  const el = document.getElementById('msg');
  el.textContent = text;
  el.style.color = type === 'ok' ? 'var(--green)' : 'var(--red)';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.textContent = ''; }, 1600);
}

function updateScores() {
  const rc = Object.keys(errorMap).length;
  document.getElementById('s-ok').textContent = '✓ ' + score.ok;
  document.getElementById('s-err').textContent = '✗ ' + score.err;
  document.getElementById('s-left').textContent = '◎ ' + fullDeck.length;
  const re = document.getElementById('s-retry');
  if (rc > 0) { re.style.display = ''; re.textContent = '↺ ' + rc; } else re.style.display = 'none';
}

// Pioche n cartes de fullDeck qui ne sont pas déjà affichées
function drawCards(n) {
  for (let i = 0; i < n; i++) {
    const c = fullDeck.find(c => !activeDeck.find(a => a.id === c.id));
    if (!c) break;
    activeDeck.push(c);
  }
  renderDeck();
}

// Complète le paquet visible jusqu'à deckSize cartes (jamais au-delà)
function fillDeck() {
  drawCards(deckSize - activeDeck.length);
}

// Bouton « + » : ajoute volontairement deckSize cartes en plus
function drawMore() {
  drawCards(deckSize);
}

// ── Bilan ──
function showBilan() {
  const total = score.ok + score.err;
  document.getElementById('b-ok').textContent = score.ok;
  document.getElementById('b-err').textContent = score.err;
  document.getElementById('b-pct').textContent = total > 0 ? Math.round(score.ok / total * 100) + '%' : '—';

  const eg = document.getElementById('b-errors'); eg.innerHTML = '';
  const ec = Object.values(errorMap).sort((a, b) => b.count - a.count);
  document.getElementById('b-errors-section').style.display = ec.length ? '' : 'none';
  ec.forEach(({ card, count }) => {
    const c = document.createElement('div'); c.className = 'bilan-card bc-err';
    c.innerHTML = card.char + '<span>' + card.romaji + '</span><span class="err-cnt">✗' + count + '</span>';
    eg.appendChild(c);
  });

  const og = document.getElementById('b-ok-grid'); og.innerHTML = '';
  const gojuonOrder = Object.keys(H); // ordre canonique a,i,u,e,o,ka,ki,ku... défini dans data.js
  const sortedSuccess = [...successSet].sort((a, b) => gojuonOrder.indexOf(a) - gojuonOrder.indexOf(b));
  sortedSuccess.forEach(r => {
    const c = document.createElement('div'); c.className = 'bilan-card bc-ok';
    c.innerHTML = ((H[r] || '') + (K[r] || '')) + '<span>' + r + '</span>';
    og.appendChild(c);
  });
  document.getElementById('bilan').style.display = 'block';
}

// ── Contrôles ──
function setMode(m, btn) {
  mode = m;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  resetGame();
}

function setDeckSize(n, btn) {
  deckSize = n;
  document.querySelectorAll('.dc-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeDeck = []; fillDeck();
}

function toggleHints() {
  showRomaji = !showRomaji;
  document.getElementById('btnhint').textContent = showRomaji ? 'Romaji ✓' : 'Romaji';
  renderDeck();
}

function resetGame() {
  clearPendingTimers();
  score = { ok: 0, err: 0 }; errorMap = {}; successSet = new Set();
  selectedCard = null; locked = false;
  fullDeck = buildFullDeck(); activeDeck = [];
  buildGrid(); fillDeck();
  document.getElementById('msg').textContent = '';
  document.getElementById('bilan').style.display = 'none';
  document.getElementById('feedback').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  // État du bouton « Diacritiques » et du libellé des colonnes, d'après le réglage commun
  const dbtn = document.getElementById('diac-switch');
  dbtn.classList.toggle('active', showDiacritics);
  dbtn.setAttribute('aria-pressed', showDiacritics ? 'true' : 'false');
  document.getElementById('diac-switch-state').textContent = showDiacritics ? 'on' : 'off';
  updateColLabel();
  // Attendre que le layout soit calculé avant de mesurer les hauteurs
  requestAnimationFrame(() => {
    requestAnimationFrame(() => resetGame());
  });
});
window.addEventListener('resize', () => {
  document.documentElement.style.setProperty('--cell-size', calcCellSize() + 'px');
  buildGrid();
});

// ── Sélecteur de colonnes ──
function buildColSelector() {
  const container = document.getElementById('col-checkboxes');
  if (!container) return;
  container.innerHTML = '';
  COLS.forEach(col => {
    if (col.label === 'SEP' || col.label === 'SEP2') return;
    if (!showDiacritics && col.diacritic) return;
    const key = KanaStore.colKey(col);
    const firstKana = col.s.find(v => v);
    const char = (mode === 'katakana' ? K[firstKana] : H[firstKana]) || firstKana || '';
    const isChecked = selectedCols.includes(key);
    const el = document.createElement('div');
    el.className = 'col-check' + (isChecked ? ' checked' : '');
    el.dataset.key = key;
    el.innerHTML = `<span class="col-check-kana">${char}</span><span>${col.label}</span>`;
    el.addEventListener('click', () => el.classList.toggle('checked'));
    container.appendChild(el);
  });
}

function toggleColSelector() {
  const panel = document.getElementById('col-selector-panel');
  const isOpen = window.getComputedStyle(panel).display !== 'none';
  if (!isOpen) buildColSelector();
  panel.style.display = isOpen ? 'none' : 'block';
}

function selectAllCols() {
  document.querySelectorAll('.col-check').forEach(el => el.classList.add('checked'));
}

function selectNoneCols() {
  document.querySelectorAll('.col-check').forEach(el => el.classList.remove('checked'));
}

function applyColSelection() {
  const checked = [...document.querySelectorAll('.col-check.checked')].map(el => el.dataset.key);
  // Les colonnes avec dakuten, masquées dans le panneau quand le bouton est sur « off », ne sont jamais dans la sélection
  selectedCols = checked;
  KanaStore.setColumns(selectedCols);
  updateColLabel();
  document.getElementById('col-selector-panel').style.display = 'none';
  resetGame();
}

function updateColLabel() {
  const visible = COLS.filter(c => c.label !== 'SEP' && c.label !== 'SEP2' && (showDiacritics || !c.diacritic)).length;
  const n = selectedCols.filter(k => showDiacritics || !isDiacriticKey(k)).length;
  document.getElementById('col-selector-label').textContent = n === visible ? 'Colonnes ▾' : n + ' col. ▾';
}

// ── Œil : afficher / masquer les sons (romaji) dans la grille ──
const GRID_ROMAJI_KEY = 'kana-grid-romaji-hidden';

function applyGridRomaji(hidden) {
  document.getElementById('grid-zone').classList.toggle('romaji-off', hidden);
  const btn = document.getElementById('eye-btn');
  btn.classList.toggle('active', hidden);
  btn.setAttribute('aria-pressed', hidden ? 'true' : 'false');
  btn.setAttribute('aria-label', hidden ? 'Afficher les sons dans la grille' : 'Masquer les sons dans la grille');
}

function toggleGridRomaji() {
  const hidden = !document.getElementById('grid-zone').classList.contains('romaji-off');
  applyGridRomaji(hidden);
  try { localStorage.setItem(GRID_ROMAJI_KEY, hidden ? '1' : '0'); } catch (e) { /* ignoré */ }
}

document.addEventListener('DOMContentLoaded', () => {
  let hidden = false;
  try { hidden = localStorage.getItem(GRID_ROMAJI_KEY) === '1'; } catch (e) {}
  applyGridRomaji(hidden);
});

