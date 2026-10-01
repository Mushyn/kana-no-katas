// Tests du module commun (colonnes partagées, progression, page « Mes scores »).
// Lancer : node --test tests/shared.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createStore, colKey, DEFAULT_COLUMNS } = require('../shared.js');

// Faux localStorage (en mémoire)
function fakeStorage() {
  const m = {};
  return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; }, _m: m };
}

// Les colonnes réelles de data.js
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8') + '\nthis.COLS = COLS;', ctx);
const COLS = Array.from(ctx.COLS).filter(c => c.label !== 'SEP' && c.label !== 'SEP2');

test('chaque colonne a un identifiant unique (la colonne « n » existe deux fois par son étiquette)', () => {
  const keys = COLS.map(colKey);
  assert.strictEqual(new Set(keys).size, keys.length);
  assert.ok(keys.includes('na') && keys.includes('n'));
});

test('par défaut : tout le hiragana de base, sans dakuten', () => {
  const s = createStore(fakeStorage());
  assert.deepStrictEqual(s.columns(), DEFAULT_COLUMNS);
  assert.strictEqual(DEFAULT_COLUMNS.length, 11);
  assert.ok(DEFAULT_COLUMNS.every(k => COLS.some(c => colKey(c) === k)));
});

test('les colonnes choisies sont mémorisées, sans doublon', () => {
  const st = fakeStorage(), s = createStore(st);
  s.setColumns(['a', 'ka', 'a']);
  assert.deepStrictEqual(createStore(st).columns(), ['a', 'ka']);   // relu par une autre instance (autre page)
});

test('conversion colonnes <-> positions (puzzle, lecture)', () => {
  const s = createStore(fakeStorage());
  s.setColumns(['ka', 'wa', 'ga']);
  assert.deepStrictEqual(s.columnsAsIndexes(COLS), COLS.map(colKey).map((k, i) => ['ka', 'wa', 'ga'].includes(k) ? i : -1).filter(i => i >= 0));
  s.setColumnsFromIndexes(COLS, [0, 1]);
  assert.deepStrictEqual(s.columns(), ['a', 'ka']);
  s.setColumnsFromIndexes(COLS, [0, 99]);      // une position inconnue est ignorée
  assert.deepStrictEqual(s.columns(), ['a']);
});

test('tableau : réussites, erreurs, taux, kanas à retravailler', () => {
  const s = createStore(fakeStorage());
  s.recordTableau('h', 'ka', true); s.recordTableau('h', 'ka', true);
  s.recordTableau('h', 'sa', false); s.recordTableau('h', 'sa', false); s.recordTableau('h', 'sa', true);
  const t = s.summary().tableau;
  assert.strictEqual(t.ok, 3); assert.strictEqual(t.err, 2);
  assert.strictEqual(t.rate, 60);
  assert.strictEqual(t.kanas, 2);
  assert.deepStrictEqual(t.toWork, [{ key: 'h:sa', err: 2 }]);
});

test('tracé : nombre, moyenne, kanas sous 60 %', () => {
  const s = createStore(fakeStorage());
  s.recordTrace('h', 'a', 90); s.recordTrace('h', 'a', 70); s.recordTrace('k', 'ki', 40);
  const t = s.summary().trace;
  assert.strictEqual(t.count, 3);
  assert.strictEqual(t.average, 67);
  assert.deepStrictEqual(t.toWork, [{ key: 'k:ki', avg: 40 }]);
});

test('puzzle : meilleur score par alphabet et niveau', () => {
  const st = fakeStorage(); const s = createStore(st);
  st.setItem('kana-puzzle-best', JSON.stringify({ 'h|easy|0,1': 300, 'h|easy|0,1,2': 450, 'k|mid|': 800 }));
  const p = s.summary().puzzle.sort((a, b) => a.script.localeCompare(b.script));
  assert.deepStrictEqual(p, [{ script: 'h', level: 'easy', score: 450 }, { script: 'k', level: 'mid', score: 800 }]);
});

test('lecture : mots trouvés du premier coup et mots à revoir', () => {
  const st = fakeStorage(); const s = createStore(st);
  st.setItem('kana-lecture-prefs', JSON.stringify({ review: ['いし'] }));
  s.recordLecture('あし', true); s.recordLecture('いし', false); s.recordLecture('いし', true);
  const l = s.summary().lecture;
  assert.strictEqual(l.words, 2); assert.strictEqual(l.found, 2);
  assert.deepStrictEqual(l.toReview, ['いし']);
});

test('remise à zéro : efface la progression et les mots à revoir, garde les colonnes et les autres réglages', () => {
  const st = fakeStorage(); const s = createStore(st);
  s.setColumns(['a', 'ka']);
  st.setItem('kana-lecture-prefs', JSON.stringify({ review: ['いし'], size: 10 }));
  st.setItem('kana-puzzle-best', JSON.stringify({ 'h|mid|': 500 }));
  s.recordTableau('h', 'ka', true);
  s.resetProgress();
  const sum = s.summary();
  assert.strictEqual(sum.tableau.ok, 0); assert.deepStrictEqual(sum.puzzle, []); assert.deepStrictEqual(sum.lecture.toReview, []);
  assert.deepStrictEqual(s.columns(), ['a', 'ka']);
  assert.strictEqual(JSON.parse(st.getItem('kana-lecture-prefs')).size, 10);
});

test('la date de début n\'existe qu\'après le premier enregistrement', () => {
  const s = createStore(fakeStorage());
  assert.strictEqual(s.summary().since, null);
  s.recordTableau('h', 'a', true);
  assert.ok(s.summary().since > 0);
});

test('un stockage illisible ne fait pas planter le module', () => {
  const broken = { getItem() { throw new Error('bloqué'); }, setItem() { throw new Error('bloqué'); }, removeItem() { throw new Error('bloqué'); } };
  const s = createStore(broken);
  assert.deepStrictEqual(s.columns(), DEFAULT_COLUMNS);
  s.recordTableau('h', 'a', true);
  assert.strictEqual(s.summary().tableau.ok, 0);
  s.resetProgress();
});
