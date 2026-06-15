// ── État global ──
let mode = 'both';
let deckSize = 1;
let showRomaji = false;
let score = { ok: 0, err: 0 };
let fullDeck = [], activeDeck = [];
let selectedCard = null, cells = {};
let errorMap = {}, successSet = new Set(), locked = false;
let dragCard = null;

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
    if (col.s && col.s.includes(romaji)) return col.label;
  }
  return '';
}

// ── Paquet ──
function buildFullDeck() {
  const cards = [];
  COLS.forEach(col => {
    if (col.label === 'SEP' || col.label === 'SEP2') return;
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
  const HDR = 26;      // col-hdr
  const PADDING = 16;  // padding grid-scroll haut+bas
  const GAP = 4;       // gap * (ROWS-1)
  const available = zoneH - HDR - PADDING - (GAP * (ROWS - 1));
  const size = Math.floor(available / ROWS);
  return Math.max(52, size);
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
      // Tap (sélection en 2 temps)
      cell.addEventListener('click', () => { if (!locked) handleCellClick(cell); });
      // Touch drop
      cell.addEventListener('touchend', e => {
        e.preventDefault();
        if (!locked && dragCard) { handleDrop(cell, dragCard); dragCard = null; }
      }, { passive: false });

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
    el.className = 'card' + (card.errors > 0 ? ' retry-card' : '');
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

    // Touch drag
    el.addEventListener('touchstart', () => {
      if (locked) return;
      dragCard = card.id;
      document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));
      el.classList.add('selected');
    }, { passive: true });
    el.addEventListener('touchend', () => {
      el.classList.remove('selected');
    }, { passive: true });

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
    const s = document.createElement('span'); s.textContent = card.char; cd.appendChild(s);

    if (fullDeck.filter(c => c.romaji === romaji).length === 0) {
      cell.classList.add('correct'); successSet.add(romaji);
    } else {
      cell.style.borderColor = '#63992299'; cell.style.background = 'var(--green-light)';
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
    showFeedback(card);
    const cc = cells[card.romaji];
    if (cc) { cc.classList.add('highlight'); setTimeout(() => cc.classList.remove('highlight'), 2400); }
    activeDeck.splice(idx, 1);
    const at = Math.min(idx + 13 + Math.floor(Math.random() * 5), activeDeck.length);
    activeDeck.splice(at, 0, card);
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
  setTimeout(() => { document.getElementById('feedback').style.display = 'none'; locked = false; }, 2000);
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
  successSet.forEach(r => {
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
  selectedCard = null; locked = false; dragCard = null;
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
