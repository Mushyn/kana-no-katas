// ─────────────────────────────────────────────────────────────────────────────
// Jeu « Lecture » : le MODÈLE (règles). Aucun accès au DOM ici.
//
// Même idée que puzzle-model.js : ce fichier ne sait pas dessiner. Il répond
// seulement à des questions comme « ce mot est-il jouable avec ces colonnes ? »,
// « quels mots mettre dans la séance ? », « quelles réponses proposer ? ».
// L'écran (lecture.html / lecture.js) viendra se brancher dessus, et on peut tout
// tester dans un terminal : node --test tests/lecture-model.test.js
//
// Vocabulaire :
//   - une COLONNE est une série de kanas (a, k, s, t...), repérée par sa POSITION
//     dans la liste des colonnes (0 = a, 1 = k...), comme dans le puzzle.
//   - un MOT est jouable quand TOUS ses kanas appartiennent aux colonnes choisies.
//   - la SÉANCE est le petit lot de mots travaillé d'un coup (5, 10 ou tous).
//   - le POOL est l'ensemble des mots jouables : il sert aussi à fabriquer les
//     mauvaises réponses du quiz.
// ─────────────────────────────────────────────────────────────────────────────

// Pour chaque kana, la position de sa colonne.
//   columns : forme de COLS dans data.js, séparateurs déjà retirés
//             → [{ label:'k', s:['ka','ki','ku','ke','ko'] }, ...]
//   chars   : la table des caractères (H dans data.js) → { ka:'か', ki:'き', ... }
// Résultat : Map  'か' -> 1, 'き' -> 1, ...
function kanaToColumn(columns, chars) {
  const map = new Map();
  columns.forEach((colonne, index) => {
    colonne.s.forEach(romaji => {
      if (romaji && chars[romaji]) map.set(chars[romaji], index);
    });
  });
  return map;
}

// Les colonnes dont un mot a besoin (un ensemble de positions).
// Retourne null si un kana du mot est inconnu (ce qui révèle une faute de frappe dans les données).
function columnsOfWord(kana, kanaMap) {
  const needed = new Set();
  for (const ch of kana) {
    if (!kanaMap.has(ch)) return null;
    needed.add(kanaMap.get(ch));
  }
  return needed;
}

// Les mots jouables avec les colonnes choisies.
//   picked : ensemble (Set) de positions de colonnes choisies
function availableWords(vocab, picked, kanaMap) {
  return vocab.filter(mot => {
    const needed = columnsOfWord(mot.kana, kanaMap);
    return needed !== null && [...needed].every(c => picked.has(c));
  });
}

// Mélange de Fisher-Yates : renvoie une copie mélangée.
// `rng` est une fonction qui rend un nombre entre 0 et 1 (Math.random par défaut) ;
// les tests en passent une fausse pour obtenir un résultat prévisible.
function shuffle(list, rng = Math.random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Les mots de la séance : d'abord ceux « à revoir » (ratés la dernière fois), puis des mots tirés au hasard.
//   count    : nombre de mots voulu (null = tous)
//   toReview : liste de kanas à revoir en priorité
function pickSession(pool, count, toReview = [], rng = Math.random) {
  if (count == null || count >= pool.length) return shuffle(pool, rng);
  const review = new Set(toReview);
  const prioritaires = shuffle(pool.filter(m => review.has(m.kana)), rng);
  const autres = shuffle(pool.filter(m => !review.has(m.kana)), rng);
  return prioritaires.concat(autres).slice(0, count);
}

// Les mauvaises réponses d'une question : n mots du pool, différents du bon.
// On préfère des mots qui ont autant de kanas que le bon : sinon la longueur du mot
// suffirait à deviner la réponse sans savoir lire.
function pickDistractors(word, pool, n = 2, rng = Math.random) {
  const autres = pool.filter(m => m.kana !== word.kana);
  const memeLongueur = shuffle(autres.filter(m => [...m.kana].length === [...word.kana].length), rng);
  const reste = shuffle(autres.filter(m => [...m.kana].length !== [...word.kana].length), rng);
  return memeLongueur.concat(reste).slice(0, n);
}

class LectureGame {
  // session : les mots à poser, dans l'ordre ; pool : tous les mots jouables
  constructor(session, pool, rng = Math.random) {
    this.session = session;
    this.pool = pool;
    this.rng = rng;
    this.index = 0;               // question en cours
    this.results = new Map();     // kana du mot -> true (trouvé du premier coup) ou false (à revoir)
  }

  get total() { return this.session.length; }
  get finished() { return this.index >= this.session.length; }
  get current() { return this.finished ? null : this.session[this.index]; }

  // Les trois propositions de la question en cours, dans le désordre
  choices() {
    const mot = this.current;
    if (!mot) return [];
    return shuffle([mot].concat(pickDistractors(mot, this.pool, 2, this.rng)), this.rng);
  }

  // On répond avec un mot. Retourne true si c'est le bon.
  // Pas de sanction : une erreur marque seulement le mot « à revoir ».
  // Seul le PREMIER essai compte : retrouver le bon mot ensuite ne l'efface pas.
  answer(chosen) {
    const mot = this.current;
    if (!mot) return false;
    const juste = chosen.kana === mot.kana;
    if (!this.results.has(mot.kana)) this.results.set(mot.kana, juste);
    return juste;
  }

  next() { if (!this.finished) this.index++; }

  // Les kanas des mots ratés (à proposer en priorité à la prochaine séance)
  missed() { return this.session.filter(m => this.results.get(m.kana) === false).map(m => m.kana); }
}

// Permet de charger ce fichier à la fois dans le navigateur (balise <script>) et dans Node (tests)
if (typeof module !== 'undefined') {
  module.exports = { kanaToColumn, columnsOfWord, availableWords, shuffle, pickSession, pickDistractors, LectureGame };
}
