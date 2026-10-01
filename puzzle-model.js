// ─────────────────────────────────────────────────────────────────────────────
// Jeu « Puzzle » : le MODÈLE (règles + score). Aucun accès au DOM ici.
//
// Pourquoi séparer ? Ce fichier ne sait pas dessiner : il répond seulement à
// « quelle carte est où ? », « est-elle bien placée ? », « combien de points ? ».
// L'affichage (puzzle.html / puzzle.js) viendra se brancher dessus. Avantage :
// on peut tester toutes les règles dans un terminal, sans téléphone ni navigateur
// (voir tests/puzzle-model.test.js).
//
// Vocabulaire :
//   - une CARTE est identifiée par son romaji (ex. 'ki') : c'est son identifiant.
//   - une CASE (slot) de la grille est identifiée par le romaji de la carte qui
//     DOIT s'y trouver. Donc une carte est bien placée si sa case porte son nom.
//   - COLONNE = la consonne (a, k, s, t...) ; LIGNE = la voyelle (a, i, u, e, o).
// ─────────────────────────────────────────────────────────────────────────────

class PuzzleGame {
  // columns : même forme que COLS dans data.js → [{ label:'k', s:['ka','ki','ku','ke','ko'] }, ...]
  // (les séparateurs 'SEP' doivent déjà être retirés par l'appelant)
  constructor(columns) {
    this.positions = new Map();   // romaji -> { col, row } : où la carte DOIT aller
    columns.forEach((colonne, col) => {
      colonne.s.forEach((romaji, row) => {
        if (romaji) this.positions.set(romaji, { col, row });
      });
    });

    this.placement = new Map();   // carte -> case où elle se trouve (null = dans le tas)
    for (const id of this.positions.keys()) this.placement.set(id, null);

    this.locked = new Set();      // cartes bien placées : elles ne bougent plus
    this.round = 0;               // nombre de vérifications effectuées
  }

  get total() { return this.positions.size; }

  // ── Interrogation ──
  slotOf(cardId) { return this.placement.get(cardId); }

  cardIn(slotKey) {
    for (const [id, slot] of this.placement) if (slot === slotKey) return id;
    return null;
  }

  pileCards() {
    return [...this.placement].filter(([, slot]) => slot === null).map(([id]) => id);
  }

  isFull() {
    let placees = 0;
    for (const slot of this.placement.values()) if (slot !== null) placees++;
    return placees === this.total;
  }

  isFinished() { return this.locked.size === this.total; }

  // ── Actions du joueur ──

  // Pose une carte sur une case. Si la case est déjà occupée :
  //  - la carte venait d'une autre case → les deux cartes s'ÉCHANGENT ;
  //  - la carte venait du tas → l'ancienne occupante retourne dans le tas.
  // Renvoie { ok, displaced } : displaced = la carte qui a été délogée (ou null).
  move(cardId, slotKey) {
    if (!this.placement.has(cardId)) throw new Error('Carte inconnue : ' + cardId);
    if (!this.positions.has(slotKey)) throw new Error('Case inconnue : ' + slotKey);

    if (this.locked.has(cardId)) return { ok: false, reason: 'carte verrouillée' };

    const occupant = this.cardIn(slotKey);
    if (occupant === cardId) return { ok: true, displaced: null };          // déjà là
    if (occupant && this.locked.has(occupant)) return { ok: false, reason: 'case verrouillée' };

    const caseDeDepart = this.placement.get(cardId);                         // null si elle venait du tas
    this.placement.set(cardId, slotKey);
    if (occupant) this.placement.set(occupant, caseDeDepart);                // échange, ou retour au tas
    return { ok: true, displaced: occupant };
  }

  // Remet une carte dans le tas (si elle n'est pas verrouillée)
  remove(cardId) {
    if (this.locked.has(cardId)) return false;
    this.placement.set(cardId, null);
    return true;
  }

  // ── Vérification ──

  // Statut d'une carte posée sur la grille :
  //   'green'  : bonne case
  //   'yellow' : bonne colonne, mauvaise ligne  (il faut monter ou descendre)
  //   'orange' : bonne ligne, mauvaise colonne  (il faut aller à gauche ou à droite)
  //   'red'    : ni la bonne colonne, ni la bonne ligne
  statusOf(cardId) {
    const slot = this.placement.get(cardId);
    if (slot === null) return null;
    if (slot === cardId) return 'green';
    const voulu = this.positions.get(cardId);
    const actuel = this.positions.get(slot);
    const memeColonne = voulu.col === actuel.col;
    const memeLigne = voulu.row === actuel.row;
    if (memeColonne) return 'yellow';
    if (memeLigne) return 'orange';
    return 'red';
  }

  // À appeler quand la grille est pleine. Verrouille les cartes vertes et
  // renvoie le détail pour que l'affichage puisse colorier et faire clignoter.
  check() {
    if (!this.isFull()) throw new Error('La grille n\'est pas complète');
    this.round++;
    const results = [];
    for (const cardId of this.placement.keys()) {
      if (this.locked.has(cardId)) continue;          // déjà verte aux manches précédentes
      const status = this.statusOf(cardId);
      if (status === 'green') this.locked.add(cardId);
      results.push({ cardId, status });
    }
    return {
      round: this.round,
      results,
      wrong: results.filter(r => r.status !== 'green').map(r => r.cardId),
      finished: this.isFinished()
    };
  }

  // Après le clignotement : toutes les cartes non verrouillées retournent dans le tas
  sendWrongBack() {
    for (const cardId of this.placement.keys()) {
      if (!this.locked.has(cardId)) this.placement.set(cardId, null);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Score : un capital de points qui FOND avec le temps.
//   - capital de départ = SCORE_PAR_CARTE × nombre de cartes
//   - on perd PERTE_PAR_SECONDE points chaque seconde ; jamais en dessous de 0
// Avec les valeurs par défaut : 10 s par carte avant d'arriver à zéro
// (25 cartes → 250 points, 46 → 460, 71 → 710).
// Les deux constantes sont les seuls réglages à toucher pour changer la difficulté.
// ─────────────────────────────────────────────────────────────────────────────
const SCORE_PAR_CARTE = 10;
const PERTE_PAR_SECONDE = 1;

class ScoreClock {
  // now : fonction qui donne l'heure en millisecondes (on peut la remplacer dans les tests)
  constructor(cardCount, now = () => Date.now()) {
    this.capital = cardCount * SCORE_PAR_CARTE;
    this.now = now;
    this.elapsedBefore = 0;   // temps déjà écoulé avant la pause en cours
    this.startedAt = null;    // null = chrono arrêté
  }

  start() { if (this.startedAt === null) this.startedAt = this.now(); }       // sans effet s'il tourne déjà
  pause() {                                                                    // utile si l'app passe en arrière-plan
    if (this.startedAt === null) return;
    this.elapsedBefore += this.now() - this.startedAt;
    this.startedAt = null;
  }
  stop() { this.pause(); }

  get running() { return this.startedAt !== null; }
  get elapsedMs() { return this.elapsedBefore + (this.startedAt === null ? 0 : this.now() - this.startedAt); }
  get score() {
    const restant = this.capital - (this.elapsedMs / 1000) * PERTE_PAR_SECONDE;
    return Math.max(0, Math.round(restant));
  }
}

// Permet de charger ce fichier à la fois dans le navigateur (balise <script>) et dans Node (tests)
if (typeof module !== 'undefined') module.exports = { PuzzleGame, ScoreClock, SCORE_PAR_CARTE, PERTE_PAR_SECONDE };
