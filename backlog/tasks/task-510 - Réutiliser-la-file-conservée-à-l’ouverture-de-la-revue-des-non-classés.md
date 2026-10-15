---
id: TASK-510
title: Réutiliser la file conservée à l’ouverture de la revue des non-classés
status: Done
assignee:
  - codex
created_date: '2026-10-15 08:41'
updated_date: '2026-10-15 08:56'
labels:
  - mobile
  - testflight
dependencies: []
ordinal: 117000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Feedback AO1OWsXSeddiTWtjNEDFFLw, build 14, accepté le 15 octobre 2026 : éviter le spinner systématique de la revue des non-classés lorsque sa file est déjà connue. Conserver l’ordre figé pendant une séance de tri et intégrer les mutations connues. Reprendre l’apprentissage est explicitement exclu.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 La revue initialise sa file depuis la page conservée, y compris une page vide ; le chargement bloquant est réservé à une première lecture.
- [x] #2 La revalidation ne réordonne pas une séance en cours et les suppressions/déplacements connus ne sont pas restaurés par une réponse obsolète.
- [x] #3 Typecheck/lint mobile passent et les limites de validation native sont documentées sans tests automatisés.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Initialiser le snapshot local de séance depuis le cache de dossiers et la page asc/100 existante, y compris vide. Exploiter le défaut déjà connu pour charger les médias sans attendre les dossiers. Revalider en arrière-plan sans remplacer la file de séance connue ; services existants pour mutations et protection des réponses. Garder reprise non bloquante si cache connu, premier spinner sinon. Contrôles statiques et exports.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
InitialQueue lit le dossier par défaut et la page asc/100 du cache de compte, y compris une page vide. Réseau en arrière-plan, lectures dossiers/médias concurrentes si le défaut est connu. Le snapshot de séance n’est jamais remplacé une fois connu ; les services de mutation existants mettent les pages du cache à jour et invalident les lectures obsolètes. Erreur de revalidation non bloquante avec reprise ; premier chargement réel conservé. Documentation du cache mise à jour. Typecheck/lint mobile et exports iOS/Android réussis, aucun test ajouté. Validation native restante documentée.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Les réouvertures de la revue réutilisent immédiatement la file conservée. La revalidation prépare la séance suivante sans réordonner les cartes courantes ; une page connue vide reste utilisable. Contrôles locaux passent, validation appareil après distribution restante.
<!-- SECTION:FINAL_SUMMARY:END -->
