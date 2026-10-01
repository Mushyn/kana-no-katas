// ─────────────────────────────────────────────────────────────────────────────
// Jeu « Puzzle » : l'AFFICHAGE et les interactions (doigt, souris).
//
// Ce fichier ne décide pas des règles : il les demande au modèle (puzzle-model.js).
//   - PuzzleGame  : où est chaque carte ? est-elle bien placée ?
//   - ScoreClock  : combien de points reste-t-il ?
// Ici on s'occupe seulement de dessiner l'état et de transformer les gestes
// du joueur en appels au modèle.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  const PILE_W = 44, PILE_H = 54;   // taille d'une carte dans le tas
  const LIFT = 52;                  // la carte tenue est décalée au-dessus du doigt pour rester visible
  const BLINK_MS = 10000;           // durée du clignotement après une vérification
  const PREFS_KEY = 'kana-puzzle-prefs';
  const BEST_KEY = 'kana-puzzle-best';

  const LEVELS = {
    easy: { name: 'Facile',    desc: '5 colonnes de ton choix' },
    mid:  { name: 'Moyen',     desc: 'Toutes les colonnes de base : 46 cartes' },
    hard: { name: 'Difficile', desc: 'Avec dakuten et handakuten : 71 cartes' }
  };

  // Colonnes disponibles (data.js : COLS contient aussi des séparateurs à ignorer)
  const BASE_COLS = COLS.filter(c => c.label !== 'SEP' && c.label !== 'SEP2' && !c.diacritic);
  const DAK_COLS = COLS.filter(c => c.diacritic);
  const ALL_COLS = BASE_COLS.concat(DAK_COLS);

  const $ = s => document.querySelector(s);
  const el = (tag, cls, txt) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  };
  const loadJSON = (key, def) => {
    try { return Object.assign({}, def, JSON.parse(localStorage.getItem(key) || '{}')); } catch (e) { return Object.assign({}, def); }
  };
  const saveJSON = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignoré */ } };
  const clamp01 = x => Math.min(1, Math.max(0, x));

  class PuzzleApp {
    constructor() {
      // Préférences mémorisées (alphabet, niveau, colonnes du niveau Facile, œil)
      this.prefs = loadJSON(PREFS_KEY, { script: 'h', level: 'mid', picked: [0, 1, 2, 3, 4], hints: true });
      this.best = loadJSON(BEST_KEY, {});

      this.game = null;          // PuzzleGame (modèle)
      this.clock = null;         // ScoreClock
      this.phase = 'select';     // 'select' | 'play' | 'check' | 'done'
      this.cards = new Map();    // id de carte -> élément DOM
      this.slotEls = new Map();  // clé de case -> élément DOM
      this.pile = new Map();     // id -> { fx, fy, rot } : position dans le tas, en fractions (0..1) de la zone
      this.zTop = 10;            // pour passer la dernière carte touchée au premier plan
      this.drag = null;
      this.shake = null;
      this.blinkTimer = null;
      this.skipBlink = null;
      this.wasRunning = false;

      this.layer = $('#pz-layer');
      this.pilezone = $('#pz-pilezone');

      this.initSelect();
      this.initGame();
    }

    // ═════════ Écran de sélection ═════════

    get picked() { return new Set(this.prefs.picked); }

    columnsForPrefs() {
      const { level } = this.prefs;
      if (level === 'easy') return ALL_COLS.filter((c, i) => this.picked.has(i));
      return level === 'mid' ? BASE_COLS : ALL_COLS;
    }

    cardCount(columns) { return columns.reduce((n, c) => n + c.s.filter(Boolean).length, 0); }

    // Clé du meilleur score : alphabet + niveau (+ colonnes choisies en Facile)
    bestKey(level = this.prefs.level) {
      const cols = level === 'easy' ? [...this.picked].sort((a, b) => a - b).join(',') : '';
      return this.prefs.script + '|' + level + '|' + cols;
    }

    save() { saveJSON(PREFS_KEY, this.prefs); }

    initSelect() {
      document.querySelectorAll('#pz-script button').forEach(b => {
        b.onclick = () => { this.prefs.script = b.dataset.s; this.save(); this.refreshSelect(); };
      });
      $('#pz-start').onclick = () => this.startGame();
      this.refreshSelect();
    }

    refreshSelect() {
      document.querySelectorAll('#pz-script button').forEach(b => b.classList.toggle('active', b.dataset.s === this.prefs.script));
      this.buildLevels();
      this.buildPicker();
    }

    buildLevels() {
      const box = $('#pz-levels'); box.innerHTML = '';
      Object.keys(LEVELS).forEach(key => {
        const b = el('button', 'pz-level' + (key === this.prefs.level ? ' active' : ''));
        const name = el('span', 'name'); name.appendChild(el('span', '', LEVELS[key].name));
        const best = this.best[this.bestKey(key)];
        if (best != null) name.appendChild(el('span', 'best', 'Meilleur : ' + best));
        b.appendChild(name);
        b.appendChild(el('span', 'desc', LEVELS[key].desc));
        b.onclick = () => { this.prefs.level = key; this.save(); this.refreshSelect(); };
        box.appendChild(b);
      });
    }

    // Niveau Facile : on choisit exactement 5 colonnes parmi les 16
    buildPicker() {
      const easy = this.prefs.level === 'easy';
      $('#pz-picker').style.display = easy ? '' : 'none';
      if (!easy) { $('#pz-start').disabled = false; return; }

      const chars = this.prefs.script === 'h' ? H : K;
      const wrap = $('#pz-chips'); wrap.innerHTML = '';
      ALL_COLS.forEach((c, i) => {
        if (i === BASE_COLS.length) wrap.appendChild(el('div', 'pz-chip-sep', 'Dakuten et handakuten'));
        const chip = el('button', 'pz-chip' + (this.picked.has(i) ? ' on' : ''));
        chip.appendChild(el('span', 'k', chars[c.s.find(Boolean)]));
        chip.appendChild(el('span', 'l', c.label));
        chip.onclick = () => this.togglePicked(i);
        wrap.appendChild(chip);
      });
      const n = this.picked.size, cn = $('#pz-count');
      cn.className = 'pz-count' + (n === 5 ? ' full' : '');
      cn.textContent = n + '/5 colonnes · ' + this.cardCount(this.columnsForPrefs()) + ' cartes';
      $('#pz-start').disabled = n !== 5;
    }

    togglePicked(i) {
      const set = this.picked;
      if (set.has(i)) set.delete(i);
      else if (set.size < 5) set.add(i);
      else {
        const cn = $('#pz-count'); cn.classList.add('warn'); cn.textContent = '5 maximum : retires-en une';
        setTimeout(() => this.buildPicker(), 1400);
        return;
      }
      this.prefs.picked = [...set].sort((a, b) => a - b);
      this.save();
      this.buildLevels();     // le meilleur score dépend des colonnes choisies
      this.buildPicker();
    }

    show(id) { document.querySelectorAll('.pz-screen').forEach(s => s.classList.toggle('active', s.id === id)); }

    // ═════════ Écran de jeu : mise en place ═════════

    initGame() {
      $('#pz-leave').onclick = () => this.leaveGame();
      $('#pz-menu').onclick = () => this.leaveGame();
      $('#pz-again').onclick = () => this.startGame();
      $('#pz-skip').onclick = () => { if (this.skipBlink) this.skipBlink(); };

      // Œil : afficher / masquer les noms de colonnes et de lignes
      $('#pz-eye').onclick = () => { this.prefs.hints = !this.prefs.hints; this.save(); this.applyHints(); };

      // Réglage manuel de la hauteur (viewport.js) : filet de sécurité si l'écran se trompe de taille
      const view = $('#pz-view');
      view.classList.toggle('active', getViewLevel() > 0);
      view.onclick = () => { view.classList.toggle('active', cycleViewLevel() > 0); };

      // Gestes : glisser une carte / remuer le tas
      this.layer.addEventListener('pointerdown', e => this.onCardDown(e));
      this.layer.addEventListener('pointermove', e => { if (this.drag) this.moveDrag(e); });
      this.layer.addEventListener('pointerup', e => this.endDrag(e));
      this.layer.addEventListener('pointercancel', e => this.endDrag(e));
      this.pilezone.addEventListener('pointerdown', e => this.onPileDown(e));
      this.pilezone.addEventListener('pointermove', e => this.onPileMove(e));
      const stopShake = () => { this.shake = null; this.layer.classList.remove('shaking'); };
      this.pilezone.addEventListener('pointerup', stopShake);
      this.pilezone.addEventListener('pointercancel', stopShake);

      // Après un changement de taille de l'écran : on replace tout (le tas garde ses positions relatives)
      window.addEventListener('resize', () => this.relayout());

      // Le chrono se met en pause quand l'app passe en arrière-plan
      document.addEventListener('visibilitychange', () => {
        if (!this.clock) return;
        if (document.hidden) { this.wasRunning = this.clock.running; this.clock.pause(); }
        else if (this.wasRunning) { this.clock.start(); this.wasRunning = false; }
      });
    }

    applyHints() {
      $('#pz-grid').classList.toggle('nohints', !this.prefs.hints);
      const b = $('#pz-eye');
      b.classList.toggle('active', !this.prefs.hints);
      b.setAttribute('aria-pressed', this.prefs.hints ? 'false' : 'true');
    }

    startGame() {
      this.stopTimers();
      this.columns = this.columnsForPrefs();
      this.game = new PuzzleGame(this.columns);
      this.clock = new ScoreClock(this.game.total);
      this.phase = 'idle';
      $('#pz-win').style.display = 'none';
      $('#pz-skip').style.display = 'none';
      $('#pz-gtitle').textContent = (this.prefs.script === 'h' ? 'ひ' : 'カ') + ' ' + LEVELS[this.prefs.level].name;
      this.show('screen-game');
      // On attend que l'écran soit affiché pour mesurer les zones
      requestAnimationFrame(() => {
        this.buildGrid();
        this.buildCards();
        this.phase = 'play';
        this.updateHud();
        this.scoreTimer = setInterval(() => this.updateScore(), 250);
      });
    }

    leaveGame() {
      this.stopTimers();
      if (this.clock) this.clock.stop();
      this.phase = 'select';
      this.refreshSelect();
      this.show('screen-select');
    }

    stopTimers() {
      clearTimeout(this.blinkTimer); this.blinkTimer = null; this.skipBlink = null;
      clearInterval(this.scoreTimer); this.scoreTimer = null;
    }

    buildGrid() {
      const g = $('#pz-grid'); g.innerHTML = ''; this.slotEls.clear();
      const lab = el('div', 'rowlab'); lab.appendChild(el('div', 'hdr', ''));
      ['a', 'i', 'u', 'e', 'o'].forEach(v => lab.appendChild(el('div', 'rl', v)));
      g.appendChild(lab);
      this.columns.forEach(c => {
        const col = el('div', 'col'); col.appendChild(el('div', 'hdr', c.label));
        for (let r = 0; r < 5; r++) {
          const romaji = c.s[r];
          const slot = el('div', 'pz-slot' + (romaji ? '' : ' empty'));
          if (romaji) this.slotEls.set(romaji, slot);
          col.appendChild(slot);
        }
        g.appendChild(col);
      });
      this.applyHints();
      this.sizeGrid();
    }

    sizeGrid() {
      const gz = $('#pz-gridzone').getBoundingClientRect();
      const n = this.columns.length, labelW = 14;
      const cw = Math.max(14, Math.floor((gz.width - 12 - labelW - 2 * n) / n));
      const ch = Math.max(14, Math.floor((gz.height - 12 - 14 - 10) / 5));
      const g = $('#pz-grid');
      g.style.setProperty('--cw', cw + 'px');
      g.style.setProperty('--ch', ch + 'px');
    }

    buildCards() {
      this.layer.innerHTML = ''; this.cards.clear(); this.pile.clear();
      const chars = this.prefs.script === 'h' ? H : K;
      const kind = this.prefs.script === 'h' ? 'hira' : 'kata';
      const pr = this.relRect(this.pilezone);
      for (const id of this.game.positions.keys()) {
        const card = el('div', 'pz-card ' + kind, chars[id]);
        card.dataset.id = id;
        this.layer.appendChild(card);
        this.cards.set(id, card);
        // départ : toutes les cartes au centre du tas, puis elles se dispersent
        this.setBox(id, pr.left + pr.width / 2 - PILE_W / 2, pr.top + pr.height / 2 - PILE_H / 2, PILE_W, PILE_H, 0);
      }
      requestAnimationFrame(() => requestAnimationFrame(() => {
        for (const id of this.cards.keys()) this.sendToPile(id, true);
      }));
    }

    // ═════════ Géométrie et affichage d'une carte ═════════

    // Position d'un élément par rapport à la couche des cartes
    relRect(node) {
      const r = node.getBoundingClientRect(), L = this.layer.getBoundingClientRect();
      return { left: r.left - L.left, top: r.top - L.top, width: r.width, height: r.height };
    }

    setBox(id, l, t, w, h, rot) {
      const card = this.cards.get(id), s = card.style;
      card.dataset.l = l; card.dataset.t = t;
      s.left = l + 'px'; s.top = t + 'px'; s.width = w + 'px'; s.height = h + 'px';
      s.fontSize = Math.round(Math.min(w, h) * 0.62) + 'px';
      s.transform = 'rotate(' + rot + 'deg)';
    }

    // Dessine une carte selon ce que dit le modèle : dans sa case, ou dans le tas
    render(id) {
      const card = this.cards.get(id);
      const slotKey = this.game.slotOf(id);
      if (slotKey) {
        const r = this.relRect(this.slotEls.get(slotKey));
        card.classList.add('in-slot');
        card.style.zIndex = 5;
        this.setBox(id, r.left, r.top, r.width, r.height, 0);
      } else {
        const pr = this.relRect(this.pilezone), p = this.pile.get(id) || { fx: 0.5, fy: 0.5, rot: 0 };
        card.classList.remove('in-slot');
        const l = pr.left + 4 + p.fx * Math.max(1, pr.width - PILE_W - 8);
        const t = pr.top + 4 + p.fy * Math.max(1, pr.height - PILE_H - 26);
        this.setBox(id, l, t, PILE_W, PILE_H, p.rot);
      }
    }

    // Renvoie une carte dans le tas à un endroit aléatoire (avec un tour complet si spin)
    sendToPile(id, spin) {
      this.pile.set(id, { fx: Math.random(), fy: Math.random(), rot: Math.random() * 360 + (spin ? 360 : 0) });
      this.cards.get(id).style.zIndex = ++this.zTop;
      this.render(id);
    }

    relayout() {
      if (!this.game || !$('#screen-game').classList.contains('active')) return;
      this.sizeGrid();
      for (const id of this.cards.keys()) this.render(id);
    }

    // ═════════ Glisser une carte ═════════

    // Case sous un point de l'écran (hors cases verrouillées)
    slotAt(cx, cy) {
      let best = null, bestDist = Infinity;
      for (const [key, node] of this.slotEls) {
        const occupant = this.game.cardIn(key);
        if (occupant && this.game.locked.has(occupant)) continue;
        const r = node.getBoundingClientRect(), pad = 4;
        if (cx < r.left - pad || cx > r.right + pad || cy < r.top - pad || cy > r.bottom + pad) continue;
        const d = Math.hypot(cx - (r.left + r.right) / 2, cy - (r.top + r.bottom) / 2);
        if (d < bestDist) { bestDist = d; best = key; }
      }
      return best;
    }

    onCardDown(e) {
      if (this.phase !== 'play') return;
      const node = e.target.closest('.pz-card'); if (!node) return;
      const id = node.dataset.id;
      if (this.game.locked.has(id)) return;
      e.preventDefault();
      node.setPointerCapture(e.pointerId);
      this.clock.start();                              // le chrono démarre au premier toucher
      this.drag = { id, from: this.game.slotOf(id) };
      node.classList.add('dragging');
      node.style.zIndex = 1000;
      this.moveDrag(e);
    }

    moveDrag(e) {
      const L = this.layer.getBoundingClientRect(), x = e.clientX - L.left, y = e.clientY - L.top;
      this.setBox(this.drag.id, x - PILE_W / 2, y - PILE_H / 2 - LIFT, PILE_W, PILE_H, 0);
      const target = this.slotAt(e.clientX, e.clientY - LIFT);
      for (const [key, node] of this.slotEls) node.classList.toggle('over', key === target);
    }

    endDrag(e) {
      if (!this.drag) return;
      const { id, from } = this.drag; this.drag = null;
      const node = this.cards.get(id);
      node.classList.remove('dragging');
      for (const slot of this.slotEls.values()) slot.classList.remove('over');

      const target = this.slotAt(e.clientX, e.clientY - LIFT);
      if (target) {
        const res = this.game.move(id, target);        // le modèle décide (pose, échange, refus)
        this.render(id);
        if (res.ok && res.displaced) {
          // la carte délogée est partie dans la case d'origine (échange) ou dans le tas
          if (this.game.slotOf(res.displaced) === null) this.sendToPile(res.displaced, false);
          else this.render(res.displaced);
        }
      } else {
        const pr = this.relRect(this.pilezone);
        const l = parseFloat(node.dataset.l), t = parseFloat(node.dataset.t);
        const inPile = t + PILE_H / 2 > pr.top + 4 && t + PILE_H / 2 < pr.top + pr.height;
        if (inPile) {
          // lâchée dans le tas : on la laisse où elle est, avec une inclinaison au hasard
          this.game.remove(id);
          this.pile.set(id, {
            fx: clamp01((l - (pr.left + 4)) / Math.max(1, pr.width - PILE_W - 8)),
            fy: clamp01((t - (pr.top + 4)) / Math.max(1, pr.height - PILE_H - 26)),
            rot: Math.random() * 360
          });
          node.style.zIndex = ++this.zTop;
          this.render(id);
        } else if (from) {
          this.render(id);                              // lâchée dans le vide : retour dans sa case
        } else {
          this.sendToPile(id, false);
        }
      }
      this.updateHud();
      if (this.game.isFull()) this.verify();
    }

    // ═════════ Remuer le tas ═════════

    onPileDown(e) {
      if (this.phase !== 'play' || e.target.closest('.pz-card')) return;
      this.pilezone.setPointerCapture(e.pointerId);
      this.shake = { x: e.clientX, y: e.clientY };
      this.layer.classList.add('shaking');
    }

    onPileMove(e) {
      if (!this.shake) return;
      const dx = e.clientX - this.shake.x, dy = e.clientY - this.shake.y;
      const L = this.layer.getBoundingClientRect(), px = e.clientX - L.left, py = e.clientY - L.top;
      const pr = this.relRect(this.pilezone);
      const spanX = Math.max(1, pr.width - PILE_W - 8), spanY = Math.max(1, pr.height - PILE_H - 26);
      for (const [id, p] of this.pile) {
        if (this.game.slotOf(id) || this.game.locked.has(id)) continue;      // seulement les cartes du tas
        const cl = pr.left + 4 + p.fx * spanX, ct = pr.top + 4 + p.fy * spanY;
        if (Math.hypot(cl + PILE_W / 2 - px, ct + PILE_H / 2 - py) > 70) continue;   // hors du doigt
        p.fx = clamp01(p.fx + (dx * 0.9) / spanX);
        p.fy = clamp01(p.fy + (dy * 0.9) / spanY);
        p.rot += dx * 0.8;
        this.render(id);
      }
      this.shake = { x: e.clientX, y: e.clientY };
    }

    // ═════════ Vérification, clignotement, retour des cartes ═════════

    verify() {
      this.phase = 'check';
      const result = this.game.check();                // le modèle compare avec les bonnes cases
      const symbols = { green: '✓', yellow: '↕', orange: '↔', red: '✗' };
      result.results.forEach(({ cardId, status }) => {
        const card = this.cards.get(cardId);
        card.classList.add('k-' + status);
        card.appendChild(el('span', 'badge', symbols[status]));   // symbole en plus de la couleur (daltonisme)
        if (status === 'green') card.classList.add('locked');
      });
      this.updateHud();
      if (result.finished) { this.finish(result); return; }
      this.blinkThenReturn(result.wrong);
    }

    blinkThenReturn(wrong) {
      const t0 = performance.now();
      let on = true;
      $('#pz-skip').style.display = 'block';

      const finish = () => {
        clearTimeout(this.blinkTimer); this.blinkTimer = null; this.skipBlink = null;
        $('#pz-skip').style.display = 'none';
        this.game.sendWrongBack();                     // le modèle renvoie les cartes non vertes au tas
        wrong.forEach(id => {
          const card = this.cards.get(id);
          card.classList.remove('k-red', 'k-orange', 'k-yellow', 'off');
          const badge = card.querySelector('.badge'); if (badge) badge.remove();
          this.sendToPile(id, true);                   // toutes ensemble, avec un tour complet
        });
        this.phase = 'play';
        this.updateHud();
      };
      this.skipBlink = finish;

      const tick = () => {
        const t = performance.now() - t0;
        if (t >= BLINK_MS) return finish();
        on = !on;
        wrong.forEach(id => this.cards.get(id).classList.toggle('off', !on));
        this.blinkTimer = setTimeout(tick, 700 - 630 * (t / BLINK_MS));   // de 700 ms à 70 ms : de plus en plus vite
      };
      tick();
    }

    // ═════════ Fin de partie et score ═════════

    finish(result) {
      this.phase = 'done';
      this.clock.stop();
      clearInterval(this.scoreTimer); this.scoreTimer = null;
      const score = this.clock.score;
      $('#pz-score').textContent = score + ' pts';

      const key = this.bestKey();
      const previous = this.best[key];
      const record = previous == null || score > previous;
      if (record) { this.best[key] = score; saveJSON(BEST_KEY, this.best); }

      const secs = Math.round(this.clock.elapsedMs / 1000);
      const mmss = Math.floor(secs / 60) + ' min ' + String(secs % 60).padStart(2, '0') + ' s';
      $('#pz-win-score').innerHTML = score + ' <small>/ ' + this.clock.capital + ' pts</small>';
      $('#pz-win-rec').textContent = record ? (previous == null ? 'Premier score enregistré !' : 'Nouveau record !') : 'Record : ' + previous + ' pts';
      $('#pz-win-det').textContent = mmss + ' · ' + result.round + (result.round > 1 ? ' manches' : ' manche');
      $('#pz-win').style.display = 'block';
    }

    // ═════════ Compteurs ═════════

    updateScore() { $('#pz-score').textContent = this.clock.score + ' pts'; }

    updateHud() {
      const g = this.game;
      const placed = g.total - g.pileCards().length;
      const manche = this.phase === 'check' || this.phase === 'done' ? g.round : g.round + 1;
      $('#pz-status').textContent = this.phase === 'check' || this.phase === 'done'
        ? 'Manche ' + manche + ' · ' + g.locked.size + '/' + g.total + ' justes'
        : 'Manche ' + manche + ' · ' + placed + '/' + g.total + ' posées';
      this.updateScore();
    }
  }

  document.addEventListener('DOMContentLoaded', () => { new PuzzleApp(); });
})();
