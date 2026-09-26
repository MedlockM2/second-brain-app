---
id: TASK-410
title: Benchmarker 5 directions de refonte UI de l’onglet Lecture de la page Média
status: To Do
assignee: []
created_date: '2026-09-26 12:18'
labels:
  - benchmark
  - mobile
  - ui
  - ux
dependencies: []
priority: medium
type: spike
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Objectif

Produire cinq propositions UI réellement distinctes pour refondre l’onglet « Lecture » de la page Média. La vignette / image de couverture du média doit être visible dans chacune ; tout le reste de la hiérarchie, de la navigation, de l’entrée dans la lecture et des contrôles est volontairement à challenger.

Le benchmark doit s’inspirer des pratiques les plus pertinentes pour une page mobile de lecture de contenu sauvegardé, sans recopier une interface existante. Il compare les partis pris et permet à l’owner de choisir une direction avant toute implémentation.

## Périmètre et faits à examiner

- Écran actuel : `mobile/app/media/[id].tsx`, branche de l’onglet « Lecture », et ses composants de présentation, notamment l’aperçu de source et le lecteur de texte. La task-363 a déjà ajouté l’aperçu au-dessus du texte ; elle ne fixe pas la composition globale de cette page.
- La couverture est déjà disponible sur le contrat détail sous la forme de l’image média issue de l’unique carrier `user_media.thumbnail_url` (task-304). Le benchmark décrit comment chaque direction la rend visible, ainsi que son traitement quand la source n’en fournit pas. Aucun nouvel endpoint média ni second champ image ne fait partie de ce benchmark.
- Design system : Amber Clarity ; tokens autoritaires dans `mobile/src/constants/theme.ts` et références dans `mobile-design-mockups/my_design_system/`.
- Convention de maquette : HTML autonome et capture rendue, sans dépendance distante, comme les répertoires existants de `mobile-design-mockups/`.
- Le projet n’a pas d’ancienne base installée à préserver : une direction peut remplacer directement la composition actuelle une fois retenue.

## Livrable attendu

Créer le répertoire racine `mobile-design-mockups/media_reading_tab_refonte/`. Il contient cinq sous-répertoires, un par direction, chacun avec `code.html` et `screen.png`, plus un `README.md` d’index si nécessaire pour comparer les cinq pistes. La recherche et la recommandation sont documentées dans `docs/research/task-XX-media-reading-tab-refonte/README.md`, où `XX` est l’identifiant de cette tâche.

## Hors périmètre

- Implémentation React Native, modification du contrat backend ou des pipelines d’extraction de couverture.
- Refondre l’onglet IA, les artefacts, le titre générique ou les règles de génération de l’aperçu.
- Ajouter des tests automatisés.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 L’écran « Lecture » actuel est inventorié : composition, composants, données rendues, interactions et états déjà pris en charge, avec les fichiers et symboles concernés dans `mobile/`.
- [ ] #2 Le benchmark vérifie le chemin de l’image média existante de la persistance au type mobile et définit, pour cette page, un comportement de repli cohérent quand aucune couverture source n’est disponible, sans proposer de second carrier ni de nouvel endpoint.
- [ ] #3 Une revue web sourcée couvre les recommandations pertinentes d’Apple et Material ainsi qu’au moins cinq références d’apps ou services de lecture / contenus sauvegardés ; chaque constat cite son URL et sa date de consultation.
- [ ] #4 Cinq directions de design distinctes sont livrées sous `mobile-design-mockups/media_reading_tab_refonte/`, dans cinq sous-répertoires nommés ; chacun contient un `code.html` autonome et un `screen.png`.
- [ ] #5 Les cinq maquettes montrent visiblement une image de vignette ou couverture du média ; chacune explicite son cadrage, sa place dans la hiérarchie et son comportement de repli sans image.
- [ ] #6 Chaque direction prend explicitement parti sur la hiérarchie de la page, le rôle de l’aperçu, l’accès au texte complet, les actions réellement nécessaires et la place des métadonnées ; elle indique ce qu’elle supprime ou dégrade par rapport à l’écran actuel.
- [ ] #7 Chaque direction respecte les tokens et règles Amber Clarity existants ; tout écart est nommé, justifié et proposé comme évolution explicite plutôt que codé en dur.
- [ ] #8 Chaque maquette est rendue à 414x896 pt et à 320 pt de large ; les défauts éventuels, débordements et adaptations sont documentés.
- [ ] #9 Le README de recherche compare les cinq directions selon la lisibilité, la mise en valeur de la couverture, la densité de contrôles, la continuité de lecture, l’accessibilité et la faisabilité React Native, puis formule une recommandation et un repli.
- [ ] #10 Le livrable de recherche est `docs/research/task-XX-media-reading-tab-refonte/README.md`, avec front-matter `owner_decision: pending` et une section `Owner Validation` prête à être complétée ; la tâche reste à `To Do` dans l’attente de cette décision.
<!-- AC:END -->
