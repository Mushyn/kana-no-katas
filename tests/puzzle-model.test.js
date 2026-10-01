// Lancer avec :  node --test tests/puzzle-model.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { PuzzleGame, ScoreClock } = require('../puzzle-model.js');

// Petite grille de test : colonnes a (5 cartes), k (5 cartes), y (3 cartes : trous aux lignes i et e)
const COLONNES = [
  { label: 'a', s: ['a', 'i', 'u', 'e', 'o'] },
  { label: 'k', s: ['ka', 'ki', 'ku', 'ke', 'ko'] },
  { label: 'y', s: ['ya', null, 'yu', null, 'yo'] },
];

// Pose chaque carte dans sa bonne case
function toutPlacerJuste(g) { for (const id of g.positions.keys()) g.move(id, id); }

test('construction : 13 cartes, toutes dans le tas au départ', () => {
  const g = new PuzzleGame(COLONNES);
  assert.equal(g.total, 13);
  assert.equal(g.pileCards().length, 13);
  assert.equal(g.isFull(), false);
});

test('statut : vert, jaune, orange, rouge', () => {
  const g = new PuzzleGame(COLONNES);
  g.move('ki', 'ki');  assert.equal(g.statusOf('ki'), 'green');
  g.move('ki', 'ka');  assert.equal(g.statusOf('ki'), 'yellow', 'bonne colonne (k), mauvaise ligne');
  g.move('ki', 'i');   assert.equal(g.statusOf('ki'), 'orange', 'bonne ligne (i), mauvaise colonne');
  g.move('ki', 'u');   assert.equal(g.statusOf('ki'), 'red', 'ni l\'une ni l\'autre');
  g.remove('ki');      assert.equal(g.statusOf('ki'), null, 'dans le tas : pas de statut');
});

test('déposer sur une case occupée : retour au tas si la carte venait du tas', () => {
  const g = new PuzzleGame(COLONNES);
  g.move('a', 'ka');
  const r = g.move('i', 'ka');
  assert.deepEqual(r, { ok: true, displaced: 'a' });
  assert.equal(g.slotOf('a'), null);
  assert.equal(g.slotOf('i'), 'ka');
});

test('déposer sur une case occupée : échange si la carte venait de la grille', () => {
  const g = new PuzzleGame(COLONNES);
  g.move('a', 'ka'); g.move('i', 'ki');
  g.move('a', 'ki');                      // a quitte ka pour ki, où se trouve i
  assert.equal(g.slotOf('a'), 'ki');
  assert.equal(g.slotOf('i'), 'ka');      // i prend la place laissée libre
});

test('check() refuse une grille incomplète', () => {
  const g = new PuzzleGame(COLONNES);
  g.move('a', 'a');
  assert.throws(() => g.check(), /pas complète/);
});

test('une grille entièrement juste termine la partie en une manche', () => {
  const g = new PuzzleGame(COLONNES);
  toutPlacerJuste(g);
  const r = g.check();
  assert.equal(r.finished, true);
  assert.equal(r.round, 1);
  assert.equal(r.wrong.length, 0);
});

test('manche avec erreurs : les vertes sont verrouillées, les autres reviennent au tas', () => {
  const g = new PuzzleGame(COLONNES);
  toutPlacerJuste(g);
  g.move('a', 'i');                       // échange a et i : deux erreurs, toutes les autres justes
  const r = g.check();
  assert.equal(r.finished, false);
  assert.deepEqual([...r.wrong].sort(), ['a', 'i']);
  assert.equal(g.locked.size, 11);

  g.sendWrongBack();
  assert.deepEqual([...g.pileCards()].sort(), ['a', 'i']);
  assert.equal(g.move('ka', 'o').ok, false, 'une carte verrouillée ne bouge plus');
  assert.equal(g.move('a', 'ka').ok, false, 'on ne peut pas poser sur une case verrouillée');

  g.move('a', 'a'); g.move('i', 'i');
  const r2 = g.check();
  assert.equal(r2.round, 2);
  assert.equal(r2.finished, true);
  assert.deepEqual(r2.results.map(x => x.cardId).sort(), ['a', 'i'], 'seules les cartes non verrouillées sont réévaluées');
});

test('score : capital de 10 points par carte, qui fond de 1 point par seconde', () => {
  let t = 0;
  const c = new ScoreClock(46, () => t);
  assert.equal(c.capital, 460);
  assert.equal(c.score, 460);
  c.start(); t = 60000;
  assert.equal(c.score, 400);
  c.stop(); t = 999999;                   // le chrono est arrêté : le score ne bouge plus
  assert.equal(c.score, 400);
});

test('score : la pause suspend le décompte et il ne passe jamais sous zéro', () => {
  let t = 0;
  const c = new ScoreClock(25, () => t);
  c.start(); t = 10000; c.pause();        // 10 s écoulées
  t = 500000; c.start();                  // longue pause, on reprend
  t = 505000;                             // +5 s
  assert.equal(c.score, 235);             // 250 - 15
  t = 10 ** 9;
  assert.equal(c.score, 0);
});
