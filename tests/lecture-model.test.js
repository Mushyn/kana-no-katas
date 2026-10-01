// Lancer avec :  node --test tests/lecture-model.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { kanaToColumn, columnsOfWord, availableWords, pickSession, pickDistractors, LectureGame } = require('../lecture-model.js');
const { VOCAB } = require('../vocab-data.js');

// Petite table de test : colonnes a, k, s
const COLONNES = [
  { label: 'a', s: ['a', 'i', 'u', 'e', 'o'] },
  { label: 'k', s: ['ka', 'ki', 'ku', 'ke', 'ko'] },
  { label: 's', s: ['sa', 'si', 'su', 'se', 'so'] },
];
const CHARS = { a:'あ', i:'い', u:'う', e:'え', o:'お', ka:'か', ki:'き', ku:'く', ke:'け', ko:'こ', sa:'さ', si:'し', su:'す', se:'せ', so:'そ' };
const M = kanaToColumn(COLONNES, CHARS);
const mot = (kana) => ({ kana, romaji: kana, fr: kana });

// Générateur « aléatoire » prévisible pour les tests
function rngFixe(suite) { let i = 0; return () => suite[i++ % suite.length]; }

test('kanaToColumn : chaque kana connaît sa colonne', () => {
  assert.equal(M.get('あ'), 0);
  assert.equal(M.get('き'), 1);
  assert.equal(M.get('そ'), 2);
  assert.equal(M.get('ん'), undefined);
});

test('columnsOfWord : colonnes nécessaires, ou null si un kana est inconnu', () => {
  assert.deepEqual([...columnsOfWord('いか', M)].sort(), [0, 1]);
  assert.deepEqual([...columnsOfWord('かか', M)], [1]);
  assert.equal(columnsOfWord('いん', M), null);
});

test('availableWords : un mot n\'est jouable que si TOUTES ses colonnes sont choisies', () => {
  const vocab = [mot('いえ'), mot('いか'), mot('かさ')];
  assert.deepEqual(availableWords(vocab, new Set([0]), M).map(m => m.kana), ['いえ']);
  assert.deepEqual(availableWords(vocab, new Set([0, 1]), M).map(m => m.kana), ['いえ', 'いか']);
  assert.deepEqual(availableWords(vocab, new Set([1, 2]), M).map(m => m.kana), ['かさ']);   // pas besoin que les colonnes se touchent
});

test('pickSession : le nombre demandé, et les mots à revoir passent en premier', () => {
  const pool = ['あ', 'い', 'う', 'え', 'お', 'か'].map(mot);
  const s = pickSession(pool, 3, ['か', 'お']);
  assert.equal(s.length, 3);
  assert.ok(s.slice(0, 2).map(m => m.kana).sort().join() === ['お', 'か'].sort().join());
  assert.equal(new Set(s.map(m => m.kana)).size, 3);                  // pas de doublon
  assert.equal(pickSession(pool, null).length, 6);                    // null = tous
  assert.equal(pickSession(pool, 99).length, 6);                      // plus que disponible = tous
});

test('pickDistractors : pas le bon mot, et de préférence la même longueur', () => {
  const pool = ['いえ', 'いか', 'かさ', 'あ', 'おうむ'].map(mot);
  const d = pickDistractors(mot('いえ'), pool, 2);
  assert.equal(d.length, 2);
  assert.ok(!d.some(m => m.kana === 'いえ'));
  assert.ok(d.every(m => [...m.kana].length === 2));                  // il y a assez de mots à 2 kanas
  assert.equal(pickDistractors(mot('いえ'), [mot('いえ'), mot('あ')], 2).length, 1);   // pool trop petit : on rend ce qu'on a
});

test('LectureGame : trois propositions dont la bonne', () => {
  const pool = ['いえ', 'いか', 'かさ', 'あし'].map(mot);
  const g = new LectureGame([pool[0]], pool);
  const c = g.choices();
  assert.equal(c.length, 3);
  assert.ok(c.some(m => m.kana === 'いえ'));
  assert.equal(new Set(c.map(m => m.kana)).size, 3);
});

test('LectureGame : le premier essai compte, une erreur marque « à revoir »', () => {
  const pool = ['いえ', 'いか', 'かさ'].map(mot);
  const g = new LectureGame([pool[0], pool[1]], pool);
  assert.equal(g.answer(pool[2]), false);       // mauvaise réponse
  assert.equal(g.answer(pool[0]), true);        // puis la bonne : ne rattrape pas le premier essai
  assert.equal(g.results.get('いえ'), false);
  g.next();
  assert.equal(g.answer(pool[1]), true);        // trouvé du premier coup
  g.next();
  assert.equal(g.finished, true);
  assert.deepEqual(g.missed(), ['いえ']);
  assert.equal(g.answer(pool[0]), false);       // plus de question : rien ne se passe
});

// ── Contrôle des VRAIES données : chaque mot du vocabulaire est cohérent avec data.js ──
function chargerData() {
  const code = fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8') + '\n;({ COLS, H })';
  return vm.runInNewContext(code);
}

test('données : tous les kanas de chaque mot existent dans data.js, sans doublon de mot', () => {
  const { COLS, H } = chargerData();
  const colonnes = COLS.filter(c => c.label !== 'SEP' && c.label !== 'SEP2');
  const map = kanaToColumn(colonnes, H);
  const inconnus = VOCAB.filter(m => columnsOfWord(m.kana, map) === null).map(m => m.kana);
  assert.deepEqual(inconnus, []);
  assert.equal(new Set(VOCAB.map(m => m.kana)).size, VOCAB.length);
});

test('données : chaque mot a un romaji, un sens et une photo', () => {
  for (const m of VOCAB) {
    assert.ok(m.romaji && m.fr, m.kana + ' : romaji ou sens manquant');
    assert.ok(m.pex || m.img, m.kana + ' : pas de photo');
    assert.ok(m.page, m.kana + ' : pas de page de crédit');
  }
});

test('données : avec les colonnes a, k, s il existe assez de mots pour jouer (au moins 3)', () => {
  const { COLS, H } = chargerData();
  const colonnes = COLS.filter(c => c.label !== 'SEP' && c.label !== 'SEP2');
  const map = kanaToColumn(colonnes, H);
  const idx = l => colonnes.findIndex(c => c.label === l);
  assert.ok(availableWords(VOCAB, new Set([idx('a'), idx('k'), idx('s')]), map).length >= 3);
});
