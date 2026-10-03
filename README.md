# Kana no Katas — Hiragana & Katakana

Application d'apprentissage des kanas japonais avec quatre jeux : le tableau (glisser-déposer avec répétition espacée, SRS), le tracé (écriture à la main), le puzzle (reconstituer le tableau) et la lecture (lire des mots illustrés par une photo).  
L'application s'ouvre sur un menu (`index.html`) : c'est le pivot de la navigation. Il propose les quatre jeux, le réglage des colonnes connues (commun à tous les jeux) et la page « Mes scores » ; chaque jeu a une flèche ← pour y revenir. Les jeux ne se renvoient plus les uns aux autres.  
Fonctionne hors-ligne une fois installé comme PWA.

## Fonctionnalités

### Jeu 1 : le tableau

- Grille complète en lecture japonaise (droite → gauche)
- Hiragana, Katakana, ou les deux en alternance
- Dakuten (が/ガ…) et handakuten (ぱ/パ…)
- Cartes 1 par 1 ou 5 par 5
- Bouton œil : affiche ou masque les sons (romaji) de la grille
- Double clic sur une carte → révèle le romaji
- Erreur → feedback 2s + réinjection dans ~15 cartes (SRS)
- Bilan de fin de partie avec kanas à retravailler (la progression complète est dans « Mes scores »)

### Jeu 2 : le tracé (`trace.html`)

- Tracé à la main dans une grille genkō yōshi, comparé à la référence (réussite à partir de 60 %)
- Contrôle de l'ordre des traits
- Mode romaji, longueur de session réglable

### Jeu 3 : le puzzle (`puzzle.html`)

- Une grille vide en haut, une pile de cartes mélangées et tournées en bas, à placer par glisser-déposer
- Niveaux Facile et Difficile : vérification quand la grille est pleine : vert (bien placée), jaune (bonne colonne), orange (bonne ligne), rouge (ni l'une ni l'autre)
- Clignotement des cartes fausses pendant 10 s, puis retour dans la pile ; les cartes vertes restent verrouillées
- Trois niveaux : Facile (on choisit les colonnes de départ, une colonne s'ajoute à chaque grille sans faute), Moyen (46 kanas), Difficile (71 kanas avec dakuten)
- Niveau Moyen : chaque carte est jugée dès qu'on la dépose. Bonne case : elle reste, flash vert et « ting ». Ni la bonne colonne ni la bonne ligne : flash, son d'échec, retour dans la pile. Une seule des deux juste : message « Pas la bonne ligne ! » ou « Pas la bonne colonne ! », prononciation du kana de la carte (synthèse vocale de l'appareil), retour dans la pile. Les sons sont fabriqués par le navigateur (Web Audio), sans fichier
- Score : 10 points par carte, moins 1 point par seconde ; meilleur score conservé par alphabet, niveau et colonnes
- Bouton œil pour masquer les noms des colonnes et lignes

### Jeu 4 : la lecture (`lecture.html`)

- Lire de vrais mots japonais (109, de 2 à 4 kanas) illustrés par une photo : on découvre le mot, puis on retrouve le bon parmi trois
- Sélecteur de colonnes : un mot n'est proposé que si tous ses kanas sont dans les colonnes choisies (pas forcément voisines)
- Séances de 5 ou 10 mots, ou tous ; les mots ratés reviennent en premier à la séance suivante
- Sans chrono, sans score, sans punition : une erreur montre la bonne réponse et marque le mot « à revoir »
- Romaji et sens masqués par défaut (bouton œil pour les afficher) ; un seul son, déclenché par le bouton « Écouter » (voix japonaise du navigateur), rien ne se lance tout seul
- Les photos sont des liens vers Pexels (ou quelques sites externes), aucune image n'est stockée dans le projet : elles demandent une connexion, le reste du jeu fonctionne hors-ligne. Licence et crédits des photographes : à confirmer

### Commun

- Dark mode automatique
- Installable comme PWA (hors-ligne)
- Bouton de hauteur d'affichage (`viewport.js`) pour les téléphones dont la barre du bas masque l'interface

---

## Déploiement sur GitHub Pages (gratuit)

### 1. Créer le dépôt GitHub

```bash
git init
git add .
git commit -m "init: kana SRS PWA"
```

Sur github.com → **New repository** → nom : `kana-no-katas` → Public → Create.

```bash
git remote add origin https://github.com/TON_USERNAME/kana-no-katas.git
git branch -M main
git push -u origin main
```

### 2. Activer GitHub Pages

Dans le dépôt GitHub :  
**Settings** → **Pages** → Source : `Deploy from a branch` → Branch : `main` → `/root` → **Save**

L'URL sera : `https://TON_USERNAME.github.io/kana-no-katas/`

> ⚠️ Mettre à jour `start_url` dans `manifest.json` si le dépôt n'est pas à la racine :
> ```json
> "start_url": "/kana-no-katas/"
> ```

### 3. Installer sur mobile

**iOS (Safari)** : ouvrir l'URL → icône Partage → **Sur l'écran d'accueil**  
**Android (Chrome)** : ouvrir l'URL → menu ⋮ → **Installer l'application**

---

## Mise à jour

Tout `git push` met à jour l'app automatiquement.  
Le service worker vide son cache à chaque nouvelle version : **incrémenter `CACHE_NAME` dans `sw.js` à chaque déploiement** (et ajouter tout nouveau fichier à la liste `ASSETS`). Les appareils déjà installés affichent alors un bandeau « Nouvelle version disponible ». GitHub Pages met environ 10 minutes à servir la nouvelle version.

---

## Structure du projet

```
kana-no-katas/
├── index.html          # Page d'accueil : choix du jeu (quatre cartes), première page du site
├── tableau.html        # Jeu 1 : le tableau
├── menu.html           # Ancienne adresse du menu : redirige vers index.html (anciens liens, icônes déjà installées)
├── menu.css            # Styles du menu
├── menu.js             # Menu : réglage des colonnes connues
├── scores.html         # Page « Mes scores » (progression des quatre jeux)
├── scores.css          # Styles de la page de scores
├── scores.js           # Mise en forme du résumé de progression
├── shared.js           # Mémoire commune : colonnes choisies + progression (sans DOM, testable)
├── style.css           # Styles + dark mode
├── data.js             # Tables hiragana / katakana
├── game.js             # Logique du jeu 1 + SRS
├── trace.html          # Jeu 2 : le tracé
├── strokes/            # Données de tracé de référence
├── puzzle.html         # Jeu 3 : le puzzle
├── puzzle.css          # Styles du puzzle
├── puzzle.js           # Interface du puzzle (classe PuzzleApp)
├── puzzle-model.js     # Règles et score du puzzle (sans DOM, testable)
├── install.js          # Panneau « Installer l'application » du menu (détection Android / iOS, testable)
├── header-tools.js     # Boutons du coin haut droit de chaque écran : hauteur de l'affichage + mode d'emploi
├── lecture.html        # Jeu 4 : la lecture
├── lecture.css         # Styles de la lecture
├── lecture.js          # Interface de la lecture (classe LectureApp)
├── lecture-model.js    # Règles de la lecture (mots jouables, séance, réponses ; sans DOM, testable)
├── vocab-data.js       # Liste des mots et liens des photos
├── viewport.js         # Hauteur d'affichage mesurée + réglage manuel
├── guide/              # Guide d'apprentissage utilisateur
├── tests/              # Tests des modèles et du module commun (puzzle, lecture, shared)
├── manifest.json       # Config PWA
├── sw.js               # Service Worker (cache offline)
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

## Tests

```bash
node --test tests/puzzle-model.test.js
node --test tests/lecture-model.test.js
node --test tests/shared.test.js
```

## Évolutions prévues

- [ ] Combinaisons (kya/きゃ, sha/しゃ…)
- [ ] Persistance de la progression SRS entre sessions (les meilleurs scores du puzzle sont déjà conservés)
- [ ] Version React Native / Expo
