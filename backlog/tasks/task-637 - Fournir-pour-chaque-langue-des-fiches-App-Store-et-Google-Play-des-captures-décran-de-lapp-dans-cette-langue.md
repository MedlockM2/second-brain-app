---
id: TASK-637
title: >-
  Fournir, pour chaque langue des fiches App Store et Google Play, des captures
  d'écran de l'app dans cette langue
status: To Do
assignee:
  - owner
created_date: '2026-11-20 15:50'
labels:
  - v1-launch
  - release
  - owner-only
dependencies: []
documentation:
  - docs/store-listing/screenshot-specs.md
  - docs/store-listing/app-store-connect.md
  - docs/store-listing/google-play-store.md
  - docs/store-listing/QA-CHECKLIST.md
priority: high
ordinal: 236000
dispatchable: false
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Objectif

Avant de demander la mise en production à Apple et à Google, chaque fiche localisée de l'App Store et de Google Play doit montrer des captures d'écran dans sa propre langue. L'interface de l'app, les légendes ajoutées sur les visuels et le contenu de démonstration visible (titres de médias, résumés, fiches) doivent tous être dans la langue de la fiche. Une fiche en japonais ne doit pas montrer une app en anglais.

## Contexte

- L'app est traduite en 11 langues (`mobile/locales/` : ar, de, en, es, fr, hi, it, ja, nl, pt, zh). Les métadonnées des abonnements sont déjà prévues dans ces 11 langues (`docs/store-listing/app-store-connect.md`, `google-play-store.md`).
- `docs/store-listing/screenshot-specs.md` impose encore « Use English-language content in all screenshots », et ses légendes n'existent qu'en anglais. Cette règle est contraire à l'objectif : il faut la remplacer, pas la compléter.
- Si une langue de fiche n'a pas ses propres captures, App Store Connect et la Play Console affichent celles de la langue principale. C'est exactement ce qu'on veut éviter.

## Périmètre

1. Relever les langues réellement ouvertes sur chaque fiche (App Store Connect, Google Play) et les comparer aux 11 langues de l'app.
2. Traduire les légendes des captures pour chacune de ces langues. Le contenu de démonstration est choisi par langue, sans contenu protégé par le droit d'auteur.
3. Capturer, dans chaque langue, l'app réglée sur cette langue, aux tailles exigées par les consoles au moment de la capture.
4. Déposer chaque jeu de captures sous la bonne langue, dans chaque console.

Pour l'arabe : vérifier que la capture montre bien la mise en page de droite à gauche.

## Responsabilité

Owner : captures sur simulateur ou appareil, et dépôt dans les consoles. Agent : spécifications, légendes traduites, inventaire. Cette tâche est un prérequis du critère n° 2 de TASK-450 (« Les screenshots correspondent à la version finale »).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `docs/store-listing/screenshot-specs.md` ne demande plus de contenu en anglais pour toutes les captures. Il exige un jeu de captures par langue de fiche, avec interface, légendes et contenu de démonstration dans cette langue.
- [ ] #2 Un fichier sous `docs/store-listing/` liste, pour App Store Connect et pour Google Play, les langues ouvertes sur la fiche. Pour chacune, il indique l'état de son jeu de captures (à faire, capturé, déposé).
- [ ] #3 Les légendes des captures existent dans chaque langue listée, dans un fichier suivi sous `docs/store-listing/`.
- [ ] #4 Aucune langue de fiche ne reprend les captures d'une autre langue. Toute exception est consignée dans l'inventaire, avec sa raison et la décision de l'owner.
<!-- AC:END -->
