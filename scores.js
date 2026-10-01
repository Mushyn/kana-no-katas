// Page « Mes scores » : affiche le résumé de KanaStore.summary() (voir shared.js).
// Aucun calcul ici : la page ne fait que mettre en forme.
(function () {
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const LEVELS = { easy: 'Facile', mid: 'Moyen', hard: 'Difficile' };
  const SCRIPTS = { h: 'Hiragana', k: 'Katakana' };

  // 'h:ka' -> 'か ka'
  function kanaLabel(key) {
    const [script, romaji] = key.split(':');
    const table = script === 'k' ? K : H;
    return (table[romaji] || '') + ' ' + romaji;
  }

  function stat(parent, value, label) {
    const box = el('div', 'sc-stat');
    box.appendChild(el('div', 'val', value));
    box.appendChild(el('div', 'lbl', label));
    parent.appendChild(box);
  }

  function chips(parent, title, items, cls) {
    parent.innerHTML = '';
    if (!items.length) return;
    parent.appendChild(el('h3', '', title));
    const row = el('div', 'sc-chips');
    items.forEach(([text, extra]) => {
      const c = el('span', 'sc-chip ' + cls, text);
      if (extra) c.appendChild(el('small', '', extra));
      row.appendChild(c);
    });
    parent.appendChild(row);
  }

  function empty(parent, text) { parent.appendChild(el('p', 'sc-empty', text)); }

  function render() {
    const s = KanaStore.summary();
    $('sc-since').textContent = s.since
      ? 'Depuis le ' + new Date(s.since).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'Joue pour voir ta progression ici';

    // Tableau
    const t = s.tableau, ts = $('sc-tableau-stats'); ts.innerHTML = '';
    if (t.ok + t.err === 0) empty(ts, 'Pas encore de partie.');
    else {
      stat(ts, t.kanas, 'kanas placés');
      stat(ts, t.rate + '%', 'de réussite');
      stat(ts, t.ok + t.err, 'réponses');
    }
    chips($('sc-tableau-work'), 'À retravailler', t.toWork.map(x => [kanaLabel(x.key), '✗' + x.err]), 'bad');

    // Tracé
    const tr = s.trace, trs = $('sc-trace-stats'); trs.innerHTML = '';
    if (!tr.count) empty(trs, 'Pas encore de tracé.');
    else {
      stat(trs, tr.count, 'tracés');
      stat(trs, tr.average + '%', 'en moyenne');
      stat(trs, tr.kanas, 'kanas tracés');
    }
    chips($('sc-trace-work'), 'À retravailler (moins de 60 %)', tr.toWork.map(x => [kanaLabel(x.key), x.avg + '%']), 'bad');

    // Puzzle
    const pl = $('sc-puzzle-list'); pl.innerHTML = '';
    if (!s.puzzle.length) empty(pl, 'Pas encore de record.');
    else {
      const order = { easy: 0, mid: 1, hard: 2 };
      s.puzzle.sort((a, b) => (order[a.level] - order[b.level]) || a.script.localeCompare(b.script)).forEach(p => {
        const row = el('div', 'sc-row');
        row.appendChild(el('span', '', (SCRIPTS[p.script] || p.script) + ' · ' + (LEVELS[p.level] || p.level)));
        row.appendChild(el('strong', '', p.score + ' pts'));
        pl.appendChild(row);
      });
      pl.appendChild(el('p', 'sc-note', 'Meilleur score par alphabet et niveau.'));
    }

    // Lecture
    const l = s.lecture, ls = $('sc-lecture-stats'); ls.innerHTML = '';
    if (!l.words) empty(ls, 'Pas encore de séance.');
    else {
      stat(ls, l.found, 'mots trouvés du 1er coup');
      stat(ls, l.words, 'mots vus');
      stat(ls, l.toReview.length, 'à revoir');
    }
    chips($('sc-lecture-review'), 'Mots à revoir', l.toReview.map(w => [w, '']), 'bad kana');
  }

  // Remise à zéro avec confirmation (deux temps : pas de boîte de dialogue du navigateur)
  $('sc-reset').onclick = () => { $('sc-reset').hidden = true; $('sc-confirm').hidden = false; };
  $('sc-cancel').onclick = () => { $('sc-confirm').hidden = true; $('sc-reset').hidden = false; };
  $('sc-yes').onclick = () => { KanaStore.resetProgress(); $('sc-confirm').hidden = true; $('sc-reset').hidden = false; render(); };

  render();
})();
