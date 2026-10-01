// Mémoire commune des quatre jeux (stockée sur l'appareil, dans localStorage).
//
// Deux choses sont partagées :
//   1. les COLONNES que l'élève connaît : un seul réglage pour tous les jeux (menu, tableau, tracé, puzzle, lecture) ;
//   2. la PROGRESSION : ce que chaque jeu enregistre (réussites, erreurs, scores), résumée dans la page « Mes scores ».
//
// Identifiant d'une colonne : le premier kana de la colonne en romaji ('a', 'ka', 'sa', ... 'n', 'ga', 'pa').
// C'est le seul identifiant unique : l'étiquette 'n' existe deux fois (colonne « na » et « n »).
//
// Le module ne dépend pas du navigateur : createStore(storage) reçoit n'importe quel objet getItem/setItem/removeItem,
// ce qui permet de le tester avec Node (tests/shared.test.js).

(function (root) {
  const COLUMNS_KEY = 'kana-columns';
  const PROGRESS_KEY = 'kana-progress';
  const PUZZLE_BEST_KEY = 'kana-puzzle-best';
  const LECTURE_PREFS_KEY = 'kana-lecture-prefs';

  // Colonnes proposées au départ : tout le hiragana de base (sans dakuten ni handakuten)
  const DEFAULT_COLUMNS = ['a', 'ka', 'sa', 'ta', 'na', 'ha', 'ma', 'ya', 'ra', 'wa', 'n'];

  // Identifiant d'une colonne de data.js
  function colKey(col) { return col.s.find(v => v) || null; }

  function readJSON(storage, key, fallback) {
    try {
      const raw = storage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function writeJSON(storage, key, value) {
    try { storage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }

  function emptyProgress() { return { tableau: {}, trace: {}, lecture: {}, since: null }; }

  function createStore(storage) {
    function loadProgress() {
      const p = readJSON(storage, PROGRESS_KEY, null);
      if (!p || typeof p !== 'object') return emptyProgress();
      return Object.assign(emptyProgress(), p);
    }
    function saveProgress(p) { if (!p.since) p.since = Date.now(); writeJSON(storage, PROGRESS_KEY, p); }   // « since » : date du premier enregistrement

    return {
      DEFAULT_COLUMNS,

      // ── Colonnes connues ──
      columns() {
        const c = readJSON(storage, COLUMNS_KEY, null);
        return Array.isArray(c) ? c.slice() : DEFAULT_COLUMNS.slice();
      },
      setColumns(keys) { writeJSON(storage, COLUMNS_KEY, [...new Set(keys)]); },

      // Les jeux du puzzle et de la lecture repèrent une colonne par sa POSITION dans leur liste de colonnes
      columnsAsIndexes(allCols) {
        const keys = new Set(this.columns());
        const out = [];
        allCols.forEach((c, i) => { if (keys.has(colKey(c))) out.push(i); });
        return out;
      },
      setColumnsFromIndexes(allCols, indexes) {
        this.setColumns(indexes.filter(i => allCols[i]).map(i => colKey(allCols[i])));
      },

      // ── Enregistrement de la progression ──
      // script : 'h' (hiragana) ou 'k' (katakana) ; romaji : 'ka', 'si'...
      recordTableau(script, romaji, ok) {
        const p = loadProgress(), k = script + ':' + romaji;
        const e = p.tableau[k] || { ok: 0, err: 0 };
        if (ok) e.ok++; else e.err++;
        p.tableau[k] = e; saveProgress(p);
      },
      recordTrace(script, romaji, pct) {
        const p = loadProgress(), k = script + ':' + romaji;
        const e = p.trace[k] || { n: 0, sum: 0, best: 0 };
        e.n++; e.sum += pct; e.best = Math.max(e.best, pct);
        p.trace[k] = e; saveProgress(p);
      },
      recordLecture(word, foundFirstTry) {
        const p = loadProgress();
        const e = p.lecture[word] || { ok: 0, miss: 0 };
        if (foundFirstTry) e.ok++; else e.miss++;
        p.lecture[word] = e; saveProgress(p);
      },

      // ── Résumé pour la page « Mes scores » ──
      summary() {
        const p = loadProgress();
        const tab = Object.entries(p.tableau);
        const tabOk = tab.reduce((s, [, e]) => s + e.ok, 0), tabErr = tab.reduce((s, [, e]) => s + e.err, 0);
        const tr = Object.entries(p.trace);
        const trN = tr.reduce((s, [, e]) => s + e.n, 0), trSum = tr.reduce((s, [, e]) => s + e.sum, 0);
        const lec = Object.entries(p.lecture);
        const best = readJSON(storage, PUZZLE_BEST_KEY, {});
        const lecPrefs = readJSON(storage, LECTURE_PREFS_KEY, {});

        // Puzzle : le meilleur score par alphabet et niveau (les clés ressemblent à 'h|easy|0,1,2')
        const puzzle = {};
        Object.entries(best).forEach(([key, score]) => {
          const [script, level] = key.split('|');
          const id = script + '|' + level;
          if (!(id in puzzle) || score > puzzle[id]) puzzle[id] = score;
        });

        return {
          since: p.since,
          tableau: {
            kanas: tab.filter(([, e]) => e.ok > 0).length,            // kanas placés au moins une fois
            ok: tabOk, err: tabErr,
            rate: tabOk + tabErr ? Math.round(100 * tabOk / (tabOk + tabErr)) : null,
            toWork: tab.filter(([, e]) => e.err > 0)
              .sort((a, b) => b[1].err - a[1].err).slice(0, 8).map(([k, e]) => ({ key: k, err: e.err }))
          },
          trace: {
            count: trN,
            average: trN ? Math.round(trSum / trN) : null,
            kanas: tr.length,
            toWork: tr.map(([k, e]) => ({ key: k, avg: Math.round(e.sum / e.n) }))
              .filter(x => x.avg < 60).sort((a, b) => a.avg - b.avg).slice(0, 8)
          },
          puzzle: Object.entries(puzzle).map(([id, score]) => { const [script, level] = id.split('|'); return { script, level, score }; }),
          lecture: {
            words: lec.length,
            found: lec.filter(([, e]) => e.ok > 0).length,           // mots trouvés du premier coup au moins une fois
            toReview: Array.isArray(lecPrefs.review) ? lecPrefs.review.slice() : []
          }
        };
      },

      // Remise à zéro de la progression (les colonnes choisies sont conservées)
      resetProgress() {
        try { storage.removeItem(PROGRESS_KEY); storage.removeItem(PUZZLE_BEST_KEY); } catch (e) { /* ignoré */ }
        const lp = readJSON(storage, LECTURE_PREFS_KEY, null);
        if (lp) { lp.review = []; writeJSON(storage, LECTURE_PREFS_KEY, lp); }
      }
    };
  }

  // Dans le navigateur : store prêt à l'emploi sur localStorage (sans planter si le stockage est bloqué)
  const memory = {};
  const fallback = {
    getItem: k => (k in memory ? memory[k] : null),
    setItem: (k, v) => { memory[k] = String(v); },
    removeItem: k => { delete memory[k]; }
  };
  let browserStorage = fallback;
  try { if (root.localStorage) { root.localStorage.getItem('kana-columns'); browserStorage = root.localStorage; } } catch (e) { /* stockage bloqué : mémoire seulement */ }

  const KanaStore = createStore(browserStorage);
  KanaStore.colKey = colKey;
  KanaStore.createStore = createStore;

  if (typeof module !== 'undefined' && module.exports) module.exports = { createStore, colKey, DEFAULT_COLUMNS };
  else root.KanaStore = KanaStore;
})(typeof window !== 'undefined' ? window : globalThis);
