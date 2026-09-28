---
id: TASK-415
title: >-
  Aligner le sondage de traduction du transcript sur le pattern
  budget/ré-armement de useProcessingRefresh (task-404/405)
status: To Do
assignee: []
created_date: '2026-09-27 21:46'
labels:
  - mobile
dependencies: []
references:
  - mobile/src/hooks/useProcessingRefresh.ts
  - mobile/src/components/CompletedDetailView.tsx
  - >-
    backlog/tasks/task-405 -
    Refléter-dans-lapp-la-fin-du-traitement-dun-média-sans-action-de-lutilisateur-selon-le-benchmark-validé-task-404.md
priority: medium
type: bug
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Contexte

Feedback testeur `AKsI1Vm2Fgu7CqMkppRaWG8` (rapports de triage `report-2026-09-23.md` et `report-2026-09-27.md`) a révélé, indépendamment du choix de déclenchement de la traduction traité par task-414, un vrai bug d'affichage : dans `mobile/src/components/CompletedDetailView.tsx`, le sondage de la traduction du transcript complet (`TRANSLATION_POLL_MAX_ATTEMPTS = 20` × `TRANSLATION_POLL_DELAY_MS = 3000` = **60 s plafond fixe**) est plus court que la durée réelle mesurée par task-203 (**60-90 s**). Une fois le plafond dépassé, le composant repasse silencieusement en `ready` et affiche le texte original (non traduit) comme s'il s'agissait du résultat final, sans badge ni distinction. Un remontage du composant (balayage entre médias dans le Digest, task-409) remet en plus le compteur de tentatives à zéro au lieu de préserver le budget déjà consommé.

task-411 (refonte de l'onglet Lecture) est désormais mergée (`c407d58`) et vérifiée n'avoir pas touché ce sondage — ses notes d'implémentation listent les statuts `ready` / `translation_pending` / `translation_failed` comme inchangés. Le risque de collision qui justifiait d'attendre est donc levé.

## Solution à reprendre : le pattern déjà validé de task-404/405

`mobile/src/hooks/useProcessingRefresh.ts` résout exactement le même problème (attendre un traitement asynchrone serveur de durée variable) pour les vignettes de l'Accueil/Bibliothèque, avec les deux mêmes symptômes corrigés à l'époque :

- sondage borné en **durée réelle mesurée**, pas en nombre de tentatives fixe : phase rapide (3 s) pendant la première minute, puis phase lente (10 s) jusqu'à un budget total — calibré sur des durées mesurées côté serveur, pas devinées ;
- ré-armement sur focus de l'écran, retour de l'app au premier plan, et pull-to-refresh (ou équivalent pour un écran de détail) — le budget ne se réinitialise jamais « par accident » au simple remontage du composant ;
- désarmement dès que le statut devient terminal ou que l'écran n'est plus visible ;
- **budget épuisé → état `isStalled` explicite**, rendu comme un marqueur figé — jamais comme si le traitement était terminé.

Cette tâche applique le même pattern (pas nécessairement le hook lui-même, qui est câblé sur une liste de vignettes) au sondage de traduction d'un média ouvert, avec un budget couvrant les 60-90 s mesurées par task-203 au lieu du plafond de 60 s actuel.

## Hors scope

- Le choix du déclencheur de la traduction (ingestion vs première lecture) : couvert par task-414, indépendant de ce bug d'affichage.
- Le badge `UNKNOWN` de langue/durée signalé dans le même feedback : non traité ici (arbitrage séparé, cf. `report-2026-09-27.md`).
- Le poll borné de `SourcePreview` (aperçu traduit), qui existe déjà et n'est pas concerné par ce défaut.

## Note pour l'owner (hors AC)

Vérification visuelle sur appareil après merge : partager un média dont la traduction prend plus de 60 s, observer un état « encore en traduction » explicite au lieu du texte anglais présenté comme définitif, puis observer la bascule vers le texte traduit une fois prêt.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le sondage de traduction du transcript complet (CompletedDetailView / TranscriptReader) suit une phase rapide puis une phase lente jusqu'à un budget total couvrant la durée réelle mesurée par task-203 (60-90 s), et non un plafond fixe de 60 s.
- [ ] #2 Le budget de sondage n'est pas remis à zéro par un simple remontage du composant (ex. balayage dans le Digest) ; il ne se ré-arme que via un focus d'écran, un retour au premier plan, ou une action explicite équivalente à celles de useProcessingRefresh.
- [ ] #3 Lorsque le budget est épuisé et que la traduction n'est toujours pas prête, l'écran affiche un état « encore en traduction » explicite et distinct, jamais le texte original présenté comme traduction finale.
- [ ] #4 Le sondage se désarme dès que la traduction passe à un statut terminal (done/failed) ou que l'écran n'est plus visible, sans timer résiduel.
- [ ] #5 npm run typecheck et npm run lint propres dans mobile/.
- [ ] #6 Aucun test automatisé ajouté (règle du projet).
<!-- AC:END -->
