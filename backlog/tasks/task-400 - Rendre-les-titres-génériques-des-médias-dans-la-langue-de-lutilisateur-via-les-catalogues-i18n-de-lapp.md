---
id: TASK-400
title: >-
  Rendre les titres génériques des médias dans la langue de l'utilisateur via
  les catalogues i18n de l'app
status: To Do
assignee: []
created_date: '2026-09-16 12:45'
labels:
  - backend
  - mobile
  - i18n
  - ingestion
dependencies: []
priority: medium
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Origine : feedback beta TestFlight (build 9, 2026-09-10) — un utilisateur fr-FR voit « Article — 10 Sep 2026 ». Décision de l'owner le 2026-09-16 : le titre générique n'est plus une chaîne stockée, c'est l'app qui le rend depuis ses catalogues.

## Constat
`core/media_ingestion/title_derivation.py` : quand aucun vrai titre ne survit, `fallback_title` stocke `f"{label} — {date:%d %b %Y}"` avec des libellés anglais codés en dur (`_MEDIA_TYPE_LABELS`, `_PLATFORM_LABELS`, `_file_label` : `Photo`, `Document`, `Article`, `Podcast episode`, `Shared note`, `Audio note`, `Voice note`, `Instagram video`, `TikTok video`, `Saved item`…) et une date en locale C. Aucune langue n'est transmise. Ce titre n'est pas propre aux échecs : un worker ne le remplace que s'il trouve un vrai titre (`select_title`). Sur dev le 2026-09-16, 21 médias portaient un titre générique, dont 14 traités avec succès (12 photos importées).

## Comportement cible
- Le backend ne fabrique plus de chaîne de titre générique : il enregistre et expose de quoi la rendre (le libellé comme **clé** stable — type, et plateforme quand elle précise le libellé — et la date d'enregistrement), dans les contrats de liste et de détail que lit le mobile.
- Le mobile rend « <libellé> — <date> » via i18n, dans la langue courante de l'utilisateur, avec une date formatée selon la locale, partout où il affiche `item.title`.
- Une clé par libellé dans les 11 catalogues.
- Le dictionnaire de libellés anglais et la construction de chaîne côté backend sont **supprimés**, pas conservés en repli (rien n'est déployé). Les médias dev existants au titre générique n'ont pas à être migrés : il suffit qu'ils soient ré-enregistrables ; l'implémenteur documente s'il faut purger ou non.

## Points que l'implémenteur tranche et documente
- **Algolia** : `title` est l'attribut recherchable le mieux classé et ne peut pas être vide (docstring de `fallback_title`). Définir ce qui est indexé pour un titre générique.
- **Consommateurs serveur du titre** : `push_notification_worker.py` et `digest/scheduler.py` lisent le titre ; ils doivent produire un texte correct pour un média au titre générique, dans la langue de l'utilisateur.
- Tout autre lecteur de `title` (artefacts, export, recherche) trouvé en chemin.

## Note owner (hors AC)
Partie mobile en TypeScript seul → OTA attendue. Vérification visuelle après déploiement : une photo importée en fr-FR s'affiche « Photo — 16 sept. 2026 » et suit un changement de langue.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 title_derivation.py ne contient plus de libellés anglais ni de formatage de date pour le titre générique ; un média sans vrai titre est enregistré avec une clé de libellé et une date, sans chaîne générique construite côté backend
- [ ] #2 Les contrats de liste et de détail lus par le mobile exposent la clé de libellé et la date d'un titre générique
- [ ] #3 Le mobile rend le titre générique via i18n avec une date formatée selon la locale à chaque endroit qui affiche le titre d'un média ; les 11 catalogues contiennent chaque clé
- [ ] #4 Le traitement d'Algolia, des notifications push et des digests pour un titre générique est implémenté et décrit dans les notes d'implémentation
- [ ] #5 ruff et mypy passent sur les fichiers backend modifiés ; npm run typecheck et npm run lint passent dans mobile/
<!-- AC:END -->
