// ─────────────────────────────────────────────────────────────────────────────
// Jeu « Lecture » : la VUE (tout ce qui touche à l'écran et au son).
// Les règles (mots jouables, séance, bonnes et mauvaises réponses) sont dans
// lecture-model.js ; la liste des mots dans vocab-data.js.
//
// Quatre écrans : sélection → découvrir → choisir → bilan.
// Principes (voir « Claude outputs/vocab_maquette.html ») :
//   - photos seulement, liens vers Pexels (rien n'est stocké dans le projet)
//   - romaji et sens masqués par défaut : le but est de lire le kana
//   - un seul son, déclenché par le bouton « Écouter » (rien ne se lance tout seul)
//   - pas de chrono, pas de score, pas de punition : une erreur marque « à revoir »
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  const PREFS_KEY = 'kana-lecture-prefs';
  const SIZES = [{ label: '5', n: 5 }, { label: '10', n: 10 }, { label: 'Tous', n: null }];
  const MIN_WORDS = 3;     // le quiz propose 3 réponses : il faut au moins 3 mots jouables

  // Colonnes disponibles : comme le puzzle (data.js : COLS contient aussi des séparateurs à ignorer)
  const BASE_COLS = COLS.filter(c => c.label !== 'SEP' && c.label !== 'SEP2' && !c.diacritic);
  const DAK_COLS = COLS.filter(c => c.diacritic);
  const ALL_COLS = BASE_COLS.concat(DAK_COLS);
  const KANA_MAP = kanaToColumn(ALL_COLS, H);   // 'か' -> position de sa colonne

  // Romaji d'un kana pour l'affichage sous chaque kana (data.js utilise 'si', 'ti'... : on les met à la japonaise)
  const HEPBURN = { si: 'shi', ti: 'chi', tu: 'tsu', hu: 'fu', zi: 'ji', di: 'ji', du: 'zu' };
  const ROMAJI_OF = new Map();
  ALL_COLS.forEach(c => c.s.forEach(r => { if (r && H[r]) ROMAJI_OF.set(H[r], HEPBURN[r] || r); }));

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

  const photoUrl = w => w.img || 'https://images.pexels.com/photos/' + w.pex + '/pexels-photo-' + w.pex + '.jpeg?auto=compress&cs=tinysrgb&w=800';

  // ═════════ Prononciation : synthèse vocale du navigateur, voix japonaise ═════════
  // Rien ne se lance tout seul : on ne parle que sur un geste (bouton Écouter ou toucher d'un kana).
  let voice = null;
  const canSpeak = 'speechSynthesis' in window;
  function pickVoice() {
    if (!canSpeak) return;
    const vs = speechSynthesis.getVoices();
    voice = vs.find(v => v.lang === 'ja-JP') || vs.find(v => v.lang && v.lang.toLowerCase().startsWith('ja')) || null;
    $('#lc-voice').textContent = voice ? '' : 'Pas de voix japonaise sur cet appareil : la prononciation peut être approximative.';
  }
  function speak(text, btn) {
    if (!canSpeak) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP'; u.rate = 0.9;
    if (voice) u.voice = voice;
    if (btn) {
      btn.classList.add('playing');
      const stop = () => btn.classList.remove('playing');
      u.onend = stop; u.onerror = stop;
    }
    speechSynthesis.speak(u);
  }

  // ═════════ La photo d'un mot ═════════
  // On affiche d'abord un cadre vide, puis la vraie image quand elle est chargée.
  // Si elle ne se charge pas (pas de réseau, lien cassé), le cadre reste avec un message.
  function showPhoto(box, w) {
    box.classList.remove('real');
    box.innerHTML = '';
    const ph = el('div', 'ph');
    ph.innerHTML = '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M3.5 17.5 L9.5 13 L13 16 L16 13.5 L20.5 17"/></svg>';
    const msg = document.createTextNode('chargement…');
    ph.appendChild(msg);
    box.appendChild(ph);
    const img = new Image();
    img.alt = '';
    img.referrerPolicy = 'no-referrer';   // certains hébergeurs refusent les images quand on envoie la page d'origine
    img.onload = () => {
      if (box.dataset.kana !== w.kana) return;      // l'écran est déjà passé à un autre mot
      box.classList.add('real');
      box.innerHTML = '';
      box.appendChild(img);
      const a = el('a', 'src', w.src || 'Pexels');
      a.href = w.page; a.target = '_blank'; a.rel = 'noopener';
      box.appendChild(a);
    };
    img.onerror = () => { msg.textContent = 'Image non chargée (connexion nécessaire pour les photos)'; };
    box.dataset.kana = w.kana;
    img.src = photoUrl(w);
  }

  class LectureApp {
    constructor() {
      // Préférences mémorisées : colonnes choisies, taille de séance, œil, mots à revoir
      this.prefs = loadJSON(PREFS_KEY, { size: 5, romaji: false, review: [] });
      this.prefs.picked = KanaStore.columnsAsIndexes(ALL_COLS);   // colonnes connues : réglage commun à tous les jeux (shared.js)
      this.pool = [];         // mots jouables avec les colonnes choisies
      this.session = [];      // mots de la séance en cours
      this.game = null;       // LectureGame (modèle)
      this.li = 0;            // position dans l'écran Découvrir
      this.answered = false;

      this.initSelect();
      this.initLearn();
      this.initQuiz();
      this.initDone();
      this.applyEye();
      pickVoice();
      if (canSpeak) speechSynthesis.onvoiceschanged = pickVoice;
    }

    save() { saveJSON(PREFS_KEY, this.prefs); }
    show(id) { document.querySelectorAll('.pz-screen').forEach(s => s.classList.toggle('active', s.id === id)); }
    get picked() { return new Set(this.prefs.picked); }

    // ═════════ Écran de sélection ═════════
    initSelect() {
      const seg = $('#lc-size');
      SIZES.forEach(s => {
        const b = el('button', '', s.label);
        b.onclick = () => { this.prefs.size = s.n; this.save(); this.refreshSelect(); };
        b.dataset.n = s.n == null ? 'all' : s.n;
        seg.appendChild(b);
      });
      $('#lc-start').onclick = () => this.startSession();
      this.refreshSelect();
    }

    refreshSelect() {
      // Les colonnes mémorisées doivent exister (si la liste des colonnes change un jour)
      this.prefs.picked = this.prefs.picked.filter(i => i >= 0 && i < ALL_COLS.length);
      this.pool = availableWords(VOCAB, this.picked, KANA_MAP);

      const wrap = $('#lc-chips'); wrap.innerHTML = '';
      ALL_COLS.forEach((c, i) => {
        if (i === BASE_COLS.length) wrap.appendChild(el('div', 'pz-chip-sep', 'Dakuten et handakuten'));
        const chip = el('button', 'pz-chip' + (this.picked.has(i) ? ' on' : ''));
        chip.appendChild(el('span', 'k', H[c.s.find(Boolean)]));
        chip.appendChild(el('span', 'l', c.label));
        chip.onclick = () => this.togglePicked(i);
        wrap.appendChild(chip);
      });

      const n = this.pool.length, cn = $('#lc-count');
      cn.className = 'pz-count' + (n >= MIN_WORDS ? ' full' : ' warn');
      cn.textContent = n + (n > 1 ? ' mots' : ' mot');
      $('#lc-start').disabled = n < MIN_WORDS;
      $('#lc-start').textContent = n < MIN_WORDS ? 'Choisis plus de colonnes (au moins ' + MIN_WORDS + ' mots)' : 'Commencer';

      document.querySelectorAll('#lc-size button').forEach(b => {
        const sizeKey = this.prefs.size == null ? 'all' : String(this.prefs.size);
        b.classList.toggle('active', b.dataset.n === sizeKey);
      });
    }

    togglePicked(i) {
      const set = this.picked;
      if (set.has(i)) set.delete(i); else set.add(i);
      this.prefs.picked = [...set].sort((a, b) => a - b);
      KanaStore.setColumnsFromIndexes(ALL_COLS, this.prefs.picked);
      this.save();
      this.refreshSelect();
    }

    // ═════════ Une séance : on tire les mots, puis Découvrir → Choisir → Bilan ═════════
    startSession() {
      // Les mots à revoir qui ne sont plus jouables (colonne décochée) sont simplement ignorés par pickSession
      this.session = pickSession(this.pool, this.prefs.size, this.prefs.review);
      this.startLearn();
    }

    // ═════════ Écran Découvrir ═════════
    initLearn() {
      $('#lc-prev').onclick = () => { if (this.li > 0) { this.li--; this.renderLearn(); } };
      $('#lc-next').onclick = () => {
        if (this.li < this.session.length - 1) { this.li++; this.renderLearn(); } else this.startQuiz();
      };
      $('#lc-learn-listen').onclick = e => speak(this.session[this.li].kana, e.currentTarget);
      document.querySelectorAll('[data-leave]').forEach(b => b.onclick = () => this.leave());
      document.querySelectorAll('[data-eye]').forEach(b => b.onclick = () => {
        this.prefs.romaji = !this.prefs.romaji; this.save(); this.applyEye();
      });
      // Réglage manuel de la hauteur (viewport.js), comme dans le puzzle et le tracé
      document.querySelectorAll('[data-view]').forEach(b => {
        b.classList.toggle('active', getViewLevel() > 0);
        b.onclick = () => {
          const on = cycleViewLevel() > 0;
          document.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('active', on));
        };
      });
    }

    leave() { if (canSpeak) speechSynthesis.cancel(); this.refreshSelect(); this.show('lc-select'); }

    startLearn() {
      this.li = 0;
      this.renderLearn();
      this.show('lc-learn');
    }

    renderLearn() {
      const w = this.session[this.li];
      $('#lc-learn-count').textContent = (this.li + 1) + ' / ' + this.session.length;
      showPhoto($('#lc-learn-photo'), w);
      const box = $('#lc-word'); box.innerHTML = '';
      [...w.kana].forEach(ch => {
        const k = el('div', 'lc-kana', ch);
        k.appendChild(el('small', '', ROMAJI_OF.get(ch) || ''));
        k.onclick = () => { k.classList.add('sound'); setTimeout(() => k.classList.remove('sound'), 500); speak(ch); };
        box.appendChild(k);
      });
      $('#lc-romaji').textContent = w.romaji;
      $('#lc-sens').textContent = w.fr;
      $('#lc-prev').disabled = this.li === 0;
      $('#lc-next').textContent = this.li === this.session.length - 1 ? 'Jouer' : 'Suivant';
    }

    // L'œil : afficher / masquer le romaji et le sens (masqués au départ)
    applyEye() {
      $('#lc-app').classList.toggle('show-romaji', !!this.prefs.romaji);
      // classe .active = romaji MASQUÉ (même convention que le bouton œil du puzzle)
      document.querySelectorAll('[data-eye]').forEach(b => {
        b.classList.toggle('active', !this.prefs.romaji);
        b.setAttribute('aria-pressed', String(!this.prefs.romaji));
      });
    }

    // ═════════ Écran Choisir ═════════
    initQuiz() {
      $('#lc-quiz-next').onclick = () => {
        this.game.next();
        if (this.game.finished) this.finishQuiz(); else this.renderQuiz();
      };
      $('#lc-quiz-listen').onclick = e => speak(this.game.current.kana, e.currentTarget);
    }

    startQuiz() {
      this.game = new LectureGame(this.session, this.pool);
      this.renderQuiz();
      this.show('lc-quiz');
    }

    renderQuiz() {
      const w = this.game.current;
      this.answered = false;
      $('#lc-quiz-count').textContent = (this.game.index + 1) + ' / ' + this.game.total;
      showPhoto($('#lc-quiz-photo'), w);
      $('#lc-quiz-sens').textContent = w.fr;   // visible seulement si l'œil est ouvert (CSS)
      const fb = $('#lc-feedback'); fb.textContent = ''; fb.className = 'lc-feedback';
      $('#lc-quiz-next').disabled = true;
      const box = $('#lc-choices'); box.innerHTML = '';
      this.game.choices().forEach(c => {
        const b = el('button', 'lc-choice');
        b.appendChild(el('span', 'k', c.kana));
        b.appendChild(el('span', 'r', c.romaji));
        b.onclick = () => this.onChoice(c, b);
        box.appendChild(b);
      });
    }

    onChoice(choice, button) {
      if (this.answered) return;
      const w = this.game.current;
      const fb = $('#lc-feedback');
      const sens = this.prefs.romaji;       // le sens n'est donné que si l'œil est ouvert (« sushi » est déjà du romaji)
      this.answered = true;
      if (this.game.answer(choice)) {
        button.classList.add('good');
        fb.textContent = 'Oui !' + (sens ? ' ' + w.kana + ' : ' + w.fr : '');
        fb.className = 'lc-feedback good';
      } else {
        // Pas d'erreur sanctionnée : on montre la bonne réponse et on la reverra à la prochaine séance
        button.classList.add('try'); button.disabled = true;
        [...$('#lc-choices').children].forEach(x => { if (x.querySelector('.k').textContent === w.kana) x.classList.add('good'); });
        fb.textContent = 'Pas encore. C\'est ' + w.kana + (sens ? ' (' + w.fr + ')' : '') + '. Écoute-le.';
        fb.className = 'lc-feedback try';
      }
      $('#lc-quiz-next').disabled = false;
      $('#lc-quiz-next').textContent = this.game.index === this.game.total - 1 ? 'Bilan' : 'Suivant';
    }

    finishQuiz() {
      // Mise à jour des mots à revoir : un mot raté s'ajoute, un mot trouvé du premier coup en sort
      const review = new Set(this.prefs.review);
      this.session.forEach(m => {
        const r = this.game.results.get(m.kana);
        if (r === false) review.add(m.kana);
        else if (r === true) review.delete(m.kana);
        if (r !== undefined) KanaStore.recordLecture(m.kana, r === true);
      });
      this.prefs.review = [...review];
      this.save();
      this.renderDone();
      this.show('lc-done');
    }

    // ═════════ Écran Bilan ═════════
    initDone() {
      $('#lc-review').onclick = () => this.startLearn();
      $('#lc-again').onclick = () => this.startSession();
    }

    renderDone() {
      const sum = $('#lc-sum'); sum.innerHTML = '';
      this.session.forEach(w => {
        const ko = this.game.results.get(w.kana) === false;
        const row = el('div', 'lc-row');
        const left = el('span', 'w', w.kana);
        left.appendChild(el('span', 'sens', '  ' + w.fr));
        row.appendChild(left);
        row.appendChild(el('span', 'st ' + (ko ? 'again' : 'ok'), ko ? 'à revoir' : 'trouvé'));
        sum.appendChild(row);
      });
    }
  }

  new LectureApp();
})();
