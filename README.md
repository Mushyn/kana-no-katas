# Kana no Katas — Hiragana & Katakana

Jeu d'apprentissage des kanas japonais par glisser-déposer avec répétition espacée (SRS).  
Fonctionne hors-ligne une fois installé comme PWA.

## Fonctionnalités

- Grille complète en lecture japonaise (droite → gauche)
- Hiragana, Katakana, ou les deux en alternance
- Dakuten (が/ガ…) et handakuten (ぱ/パ…)
- Cartes 1 par 1 ou 5 par 5
- Double clic sur une carte → révèle le romaji
- Erreur → feedback 2s + réinjection dans ~15 cartes (SRS)
- Bilan de session avec kanas à retravailler
- Dark mode automatique
- Installable comme PWA (hors-ligne)

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
Le service worker vide son cache à chaque nouvelle version (incrémenter `CACHE_NAME` dans `sw.js` si besoin).

---

## Structure du projet

```
kana-no-katas/
├── index.html      # Structure HTML
├── style.css       # Styles + dark mode
├── data.js         # Tables hiragana / katakana
├── game.js         # Logique du jeu + SRS
├── manifest.json   # Config PWA
├── sw.js           # Service Worker (cache offline)
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

## Évolutions prévues

- [ ] Combinaisons (kya/きゃ, sha/しゃ…)
- [ ] Persistance du score entre sessions (localStorage)
- [ ] Version React Native / Expo
