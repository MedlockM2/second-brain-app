---
id: TASK-411
title: >-
  Refondre l’onglet Lecture de la page Média selon le benchmark validé
  (task-410)
status: To Do
assignee: []
created_date: '2026-09-26 12:19'
labels:
  - mobile
  - ui
  - ux
dependencies:
  - TASK-410
priority: medium
type: feature
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Contexte

La page Média doit recevoir une nouvelle composition pour son onglet « Lecture ». Le benchmark task-410 fournit cinq propositions et l’owner choisira la direction à livrer ; la présence d’une vignette / couverture média visible fait partie de la demande.

## Décision qui fait autorité

Avant toute implémentation, lire `docs/research/task-410-media-reading-tab-refonte/README.md`, puis appliquer la décision finale de l’owner dans `Owner Validation` → `Decision`. Si cette décision renvoie à un `complement-response-*.md`, suivre aussi ce document. La recommandation initiale du benchmark ne doit pas être substituée à la décision de l’owner.

La maquette retenue se trouve sous `mobile-design-mockups/media_reading_tab_refonte/`. S’appuyer sur le chemin, les compromis et les états décrits par le benchmark, sans rouvrir le choix d’architecture ou de direction UI.

## Contraintes

- Le rendu utilise l’unique image média déjà exposée par le contrat détail. Si elle est absente, appliquer uniquement le repli choisi par le benchmark ; ne créer ni champ parallèle ni endpoint média.
- Respecter Amber Clarity et les tokens de `mobile/src/constants/theme.ts`. Toute chaîne visible passe par les 11 catalogues i18n.
- iOS et Android gardent la même base React Native ; un écart de plateforme doit être nécessaire et justifié.
- Il n’existe pas de base installée à maintenir : retirer la composition Lecture devenue inutilisée dans le même changement, sans chemin de compatibilité ni double affichage.
- Aucun test automatisé n’est à ajouter sans demande explicite.

## Hors périmètre

- L’onglet IA, la génération des artefacts, l’extraction et la persistance des images de couverture, et les changements de contrat backend.

## Note pour l’owner, hors critères

La validation visuelle sur appareil intervient après merge et publication de la mise à jour ; elle ne peut pas être satisfaite depuis le worktree de l’agent.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Les notes d’implémentation identifient la direction retenue par l’owner dans le README du benchmark task-410, la décision qui la mandate et le chemin de sa maquette.
- [ ] #2 L’onglet « Lecture » est reconstruit conformément à cette direction, y compris sa hiérarchie, son entrée dans le texte complet, le rôle de l’aperçu, ses contrôles et les métadonnées visibles.
- [ ] #3 La vignette ou couverture du média est visiblement rendue à l’emplacement décidé, à partir de l’unique image déjà exposée par le contrat détail ; l’absence d’image suit le repli documenté par le benchmark.
- [ ] #4 La composition précédente et les composants devenus inutilisés sont supprimés dans le même changement ; aucune branche de compatibilité, aucun double affichage et aucune référence morte ne subsistent dans `mobile/`.
- [ ] #5 Les états définis par la direction choisie sont présents et atteignables dans le code, notamment chargement, média sans image, texte non encore disponible, texte disponible et erreur de lecture.
- [ ] #6 Toutes les couleurs, espacements, rayons et tailles typographiques proviennent des tokens existants ; aucun style littéral non justifié n’est introduit.
- [ ] #7 Chaque nouvelle chaîne visible est présente dans les 11 catalogues i18n, sans clé orpheline ni clé manquante.
- [ ] #8 Les contraintes d’accessibilité prévues par la direction retenue sont codées : libellés des actions, ordre de lecture et cibles tactiles utiles.
- [ ] #9 Dans `mobile/`, `npm run lint` et `npx tsc --noEmit` passent sans erreur.
- [ ] #10 Les notes précisent si le changement est distribuable en OTA ou exige un build, et nomment les fichiers qui changeraient le fingerprint Expo le cas échéant.
<!-- AC:END -->
