// ── État global ──
let mode = 'both';
let deckSize = 1;
let showRomaji = false;
let score = { ok: 0, err: 0 };
let fullDeck = [];
let activeDeck = [];
let selectedCard = null;
let cells = {};
let errorMap = {};    // id -> { card, count }
let successSet = new Set();
let locked = false;

// ── Utilitaires ──
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function colLabelFor(romaji) {
  for (const col of COLS) {
    if (col.label === 'SEP' || col.label === 'SEP2') continue;
    if (col.syllabes && col.syllabes.includes(romaji)) return col.label;
  }
  return '';
}

// ── Construction du paquet ──
function buildFullDeck() {
  const cards = [];
  COLS.forEach(col => {
    if (col.label === 'SEP' || col.label === 'SEP2') return;
    col.syllabes.forEach(v => {
      if (!v) return;
      if (mode === 'both' || mode === 'hiragana')
        cards.push({ romaji: v, char: H[v], type: 'h', id: 'h-' + v, errors: 0 });
      if (mode === 'both' || mode === 'katakana')
        cards.push({ romaji: v, char: K[v], type: 'k', id: 'k-' + v, errors: 0 });
    });
  });
  return shuffle(cards);
}

// ── Construction de la grille ──
function buildGrid() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  cells = {};

  COLS.forEach(col => {
    if (col.label === 'SEP' || col.label === 'SEP2') {
      const sep = document.createElement('div');
      sep.className = 'sep-col';
      grid.appendChild(sep);
      return;
    }

    const colEl = document.createElement('div');
    colEl.className = 'kana-col';

    const hdr = document.createElement('div');
    hdr.className = 'col-hdr';
    hdr.textContent = col.label;
    colEl.appendChild(hdr);

    ROWS_LABELS.forEach((v, i) => {
      const romaji = col.syllabes[i];
      const cell = document.createElement('div');

      if (!romaji) {
        cell.className = 'cell empty-slot';
        colEl.appendChild(cell);
        return;
      }

      cell.className = 'cell';
      cell.dataset.romaji = romaji;

      const rhint = document.createElement('div');
      rhint.className = 'rhint';
      rhint.textContent = romaji;
      cell.appendChild(rhint);

      // Drag & drop desktop
      cell.addEventListener('dragover', e => {
        e.preventDefault();
        if (!locked) cell.classList.add('drag-over');
      });
      cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
      cell.addEventListener('drop', e => {
        e.preventDefault();
        cell.classList.remove('drag-over');
        if (!locked) handleDrop(cell, e.dataTransfer.getData('cid'));
      });

      // Touch mobile
      cell.addEventListener('click', () => {
        if (!locked) handleCellClick(cell);
      });

      cells[romaji] = cell;
      colEl.appendChild(cell);
    });

    grid.appendChild(colEl);
  });
}

// ── Rendu du paquet de cartes ──
function renderDeck() {
  const deckEl = document.getElementById('deck');
  deckEl.innerHTML = '';

  activeDeck.forEach(card => {
    const el = document.createElement('div');
    el.className = 'card' + (card.errors > 0 ? ' retry-card' : '');
    el.id = 'card-' + card.id;
    el.draggable = true;
    el.dataset.flipped = '0';

    // Badge erreur
    const badge = document.createElement('div');
    badge.className = 'err-badge';
    badge.textContent = '✗' + card.errors;
    el.appendChild(badge);

    // Caractère
    const charSpan = document.createElement('span');
    charSpan.textContent = card.char;
    el.appendChild(charSpan);

    if (showRomaji) {
      const r = document.createElement('div');
      r.className = 'card-romaji';
      r.textContent = card.romaji;
      el.appendChild(r);
    }

    // Double clic → retourner la carte
    let clickTimer = null;
    el.addEventListener('click', () => {
      if (locked) return;
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
        flipCard(el, card);
      } else {
        clickTimer = setTimeout(() => {
          clickTimer = null;
          if (el.dataset.flipped === '1') return;
          if (selectedCard === card.id) {
            selectedCard = null;
            el.classList.remove('selected');
          } else {
            document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));
            selectedCard = card.id;
            el.classList.add('selected');
          }
        }, 220);
      }
    });

    // Drag desktop
    el.addEventListener('dragstart', e => {
      if (locked) { e.preventDefault(); return; }
      e.dataTransfer.setData('cid', card.id);
      el.classList.add('dragging');
      selectedCard = null;
      document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));
    });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));

    deckEl.appendChild(el);
  });

  updateScores();
}

// ── Retourner une carte (double clic) ──
function flipCard(el, card) {
  if (el.dataset.flipped === '1') {
    el.dataset.flipped = '0';
    el.classList.remove('flipped');
    el.innerHTML = '';
    const badge = document.createElement('div');
    badge.className = 'err-badge';
    badge.textContent = '✗' + card.errors;
    el.appendChild(badge);
    const c = document.createElement('span');
    c.textContent = card.char;
    el.appendChild(c);
    if (showRomaji) {
      const r = document.createElement('div');
      r.className = 'card-romaji';
      r.textContent = card.romaji;
      el.appendChild(r);
    }
  } else {
    el.dataset.flipped = '1';
    el.classList.add('flipped');
    el.innerHTML = '';
    const r = document.createElement('span');
    r.textContent = card.romaji;
    el.appendChild(r);
  }
}

// ── Gestion du dépôt ──
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
  const isCorrect = card.romaji === romaji;

  if (isCorrect) {
    score.ok++;
    activeDeck.splice(idx, 1);
    fullDeck = fullDeck.filter(c => c.id !== cardId);

    // Afficher le char dans la case
    let charsDiv = cell.querySelector('.chars');
    if (!charsDiv) {
      charsDiv = document.createElement('div');
      charsDiv.className = 'chars';
      cell.insertBefore(charsDiv, cell.firstChild);
    }
    const s = document.createElement('span');
    s.textContent = card.char;
    charsDiv.appendChild(s);

    const done = fullDeck.filter(c => c.romaji === romaji).length === 0;
    if (done) {
      cell.classList.add('correct');
      successSet.add(romaji);
    } else {
      cell.style.borderColor = '#63992299';
      cell.style.background = 'var(--green-light)';
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

    // Feedback visuel
    showFeedback(card);
    const correctCell = cells[card.romaji];
    if (correctCell) {
      correctCell.classList.add('highlight');
      setTimeout(() => correctCell.classList.remove('highlight'), 2400);
    }

    // Réinjection SRS : ~15 cartes plus tard
    activeDeck.splice(idx, 1);
    const insertAt = Math.min(idx + 13 + Math.floor(Math.random() * 5), activeDeck.length);
    activeDeck.splice(insertAt, 0, card);
  }

  renderDeck();
}

// ── Feedback erreur ──
function showFeedback(card) {
  locked = true;
  const fb = document.getElementById('feedback');
  const colLabel = colLabelFor(card.romaji);
  document.getElementById('fb-char').textContent = card.char;
  document.getElementById('fb-romaji').textContent = card.romaji;
  document.getElementById('fb-col').textContent = 'colonne « ' + colLabel + ' » — ' + card.romaji;
  fb.style.display = 'block';
  setTimeout(() => {
    fb.style.display = 'none';
    locked = false;
  }, 2000);
}

// ── Message rapide ──
function showMsg(text, type) {
  const el = document.getElementById('msg');
  el.textContent = text;
  el.style.color = type === 'ok' ? 'var(--green)' : 'var(--red)';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.textContent = ''; }, 1600);
}

// ── Scores ──
function updateScores() {
  const retryCount = Object.keys(errorMap).length;
  document.getElementById('s-ok').textContent = '✓ ' + score.ok;
  document.getElementById('s-err').textContent = '✗ ' + score.err;
  document.getElementById('s-left').textContent = '◎ ' + fullDeck.length;
  const retryEl = document.getElementById('s-retry');
  if (retryCount > 0) {
    retryEl.style.display = '';
    retryEl.textContent = '↺ ' + retryCount;
  } else {
    retryEl.style.display = 'none';
  }
}

// ── Piocher des cartes ──
function drawMore() {
  if (fullDeck.length === 0) return;
  const n = Math.min(deckSize, fullDeck.length);
  for (let i = 0; i < n; i++) {
    const card = fullDeck.find(c => !activeDeck.find(a => a.id === c.id));
    if (card) activeDeck.push(card);
  }
  renderDeck();
}

// ── Bilan ──
function showBilan() {
  const total = score.ok + score.err;
  const pct = total > 0 ? Math.round((score.ok / total) * 100) + '%' : '—';
  document.getElementById('b-ok').textContent = score.ok;
  document.getElementById('b-err').textContent = score.err;
  document.getElementById('b-pct').textContent = pct;

  const errGrid = document.getElementById('b-errors');
  errGrid.innerHTML = '';
  const errCards = Object.values(errorMap).sort((a, b) => b.count - a.count);

  if (errCards.length === 0) {
    document.getElementById('b-errors-section').style.display = 'none';
  } else {
    document.getElementById('b-errors-section').style.display = '';
    errCards.forEach(({ card, count }) => {
      const c = document.createElement('div');
      c.className = 'bilan-card bc-err';
      c.innerHTML = card.char + '<span>' + card.romaji + '</span><span class="err-cnt">✗' + count + '</span>';
      errGrid.appendChild(c);
    });
  }

  const okGrid = document.getElementById('b-ok-grid');
  okGrid.innerHTML = '';
  successSet.forEach(romaji => {
    const hChar = H[romaji] || '';
    const kChar = K[romaji] || '';
    const c = document.createElement('div');
    c.className = 'bilan-card bc-ok';
    c.innerHTML = (hChar && kChar ? hChar + kChar : hChar || kChar) + '<span>' + romaji + '</span>';
    okGrid.appendChild(c);
  });

  document.getElementById('bilan').style.display = 'block';
}

function closeBilan() {
  document.getElementById('bilan').style.display = 'none';
}

// ── Contrôles utilisateur ──
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
  activeDeck = [];
  drawMore();
}

function toggleHints() {
  showRomaji = !showRomaji;
  document.getElementById('btnhint').textContent = showRomaji ? 'Romaji on' : 'Romaji off';
  renderDeck();
}

// ── Reset ──
function resetGame() {
  score = { ok: 0, err: 0 };
  errorMap = {};
  successSet = new Set();
  selectedCard = null;
  locked = false;
  fullDeck = buildFullDeck();
  activeDeck = [];
  buildGrid();
  drawMore();
  document.getElementById('msg').textContent = '';
  document.getElementById('bilan').style.display = 'none';
  document.getElementById('feedback').style.display = 'none';
}

// ── PWA : bannière d'installation ──
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  const banner = document.getElementById('install-banner');
  if (banner) banner.style.display = 'flex';
});

function installPWA() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(() => {
    deferredPrompt = null;
    const banner = document.getElementById('install-banner');
    if (banner) banner.style.display = 'none';
  });
}

function closeBanner() {
  const banner = document.getElementById('install-banner');
  if (banner) banner.style.display = 'none';
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => resetGame());
