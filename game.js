// ── État global ──
let mode = 'both';
let selectedCols = null; // null = toutes les colonnes
let showDiacritics = false; // dakuten + handakuten
let deckSize = 1;
let showRomaji = false;
let score = { ok: 0, err: 0 };
let fullDeck = [], activeDeck = [];
let selectedCard = null, cells = {};
let errorMap = {}, successSet = new Set(), locked = false;

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
    if (selectedCols && !selectedCols.includes(col.label + (col.diacritic ? col.s[0] : ''))) return;
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
  const size = Math.floor(available / ROWS);
  return Math.max(44, size);
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
    if (selectedCols && !selectedCols.includes(col.label + (col.diacritic ? col.s[0] : ''))) return;
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
      }
    }, { passive: false });

    el.addEventListener('touchend', e => {
      document.querySelectorAll('.cell.drag-over').forEach(c => c.classList.remove('drag-over'));
      if (touchMoved) {
        e.preventDefault(); // un vrai glisser ne doit pas déclencher de tap derrière
        el.style.position = ''; el.style.left = ''; el.style.top = '';
        el.style.zIndex = ''; el.style.pointerEvents = ''; el.style.width = '';
        el.classList.remove('dragging');
        if (!locked) {
          const t = e.changedTouches[0];
          const under = document.elementFromPoint(t.clientX, t.clientY);
          const cellUnder = under && under.closest('.cell');
          if (cellUnder) handleDrop(cellUnder, card.id);
        }
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
    if (activeDeck.length === 0 && fullDeck.length > 0) drawMore();
    if (fullDeck.length === 0) setTimeout(() => showBilan(), 600);

  } else {
    score.err++;
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
    setTimeout(() => {
      fullDeck.push(card);
      for (let i = fullDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [fullDeck[i], fullDeck[j]] = [fullDeck[j], fullDeck[i]];
      }
      drawMore();
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
  setTimeout(() => { document.getElementById('feedback').style.display = 'none'; locked = false; }, 3500);
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

function drawMore() {
  if (!fullDeck.length) return;
  const n = Math.min(deckSize, fullDeck.length);
  for (let i = 0; i < n; i++) {
    const c = fullDeck.find(c => !activeDeck.find(a => a.id === c.id));
    if (c) activeDeck.push(c);
  }
  renderDeck();
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

function closeBilan() { document.getElementById('bilan').style.display = 'none'; }

// ── Contrôles ──
function setMode(m, btn) {
  mode = m;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  saveConfigForTrace();
  resetGame();
}

function setDeckSize(n, btn) {
  deckSize = n;
  document.querySelectorAll('.dc-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeDeck = []; drawMore();
}

function toggleHints() {
  showRomaji = !showRomaji;
  document.getElementById('btnhint').textContent = showRomaji ? 'Romaji ✓' : 'Romaji';
  renderDeck();
}

function resetGame() {
  score = { ok: 0, err: 0 }; errorMap = {}; successSet = new Set();
  selectedCard = null; locked = false;
  fullDeck = buildFullDeck(); activeDeck = [];
  buildGrid(); drawMore();
  document.getElementById('msg').textContent = '';
  document.getElementById('bilan').style.display = 'none';
  document.getElementById('feedback').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
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
    const key = col.label + (col.diacritic ? col.s[0] : '');
    const firstKana = col.s.find(v => v);
    const char = (mode === 'katakana' ? K[firstKana] : H[firstKana]) || firstKana || '';
    const isChecked = !selectedCols || selectedCols.includes(key);
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
  const allChecks = document.querySelectorAll('.col-check');
  const checked = [...document.querySelectorAll('.col-check.checked')].map(el => el.dataset.key);
  selectedCols = checked.length === allChecks.length ? null : checked;
  const label = document.getElementById('col-selector-label');
  label.textContent = selectedCols ? `${checked.length} col. ▾` : 'Colonnes ▾';
  document.getElementById('col-selector-panel').style.display = 'none';
  saveConfigForTrace();
  resetGame();
}

// ── Transmettre la config au jeu de tracé via localStorage ──
function saveConfigForTrace() {
  try {
    localStorage.setItem('kana-game-config', JSON.stringify({ mode, selectedCols }));
  } catch (e) { /* localStorage indisponible : on ignore silencieusement */ }
}
