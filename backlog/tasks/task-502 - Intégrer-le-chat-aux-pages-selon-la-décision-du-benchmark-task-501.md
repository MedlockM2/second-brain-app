---
id: TASK-502
title: Intégrer le chat aux pages selon la décision du benchmark task-501
status: In Progress
assignee:
  - codex
created_date: '2026-10-12 09:42'
updated_date: '2026-10-12 12:52'
labels:
  - mobile
  - chat
  - testflight
dependencies:
  - TASK-501
documentation:
  - docs/research/task-501-chat-inline/README.md
  - docs/research/task-434-chatbot-integration-ui/README.md
  - AGENTS.md
type: feature
ordinal: 109000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Appliquer la décision finale validée de docs/research/task-501-chat-inline/README.md : modal plein écran sans animation d’entrée, transcript intégral ou sources au début du même fil défilant, historique et nouvelle conversation dans l’en-tête. Conserver streaming, arrêt, reprise, Markdown et citations. Supprimer la présentation de feuille remplacée dans la même passe, sans coexistence héritée. La position et la progression de lecture restent celles de la page derrière le modal. La validation native après distribution relève de la checklist owner, sans AC dépendant d’un déploiement.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Les parcours média et dossier appliquent la décision owner du README de task-501, avec commandes et défilement cohérents.
- [x] #2 La conversation conserve le streaming, l'arrêt, la reprise et l'historique ; les anciennes surfaces remplacées sont supprimées.
- [x] #3 Accessibilité, traductions et contrôles typecheck/lint mobile/core sont couverts sans ajout de tests automatisés.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Apply the validated TASK-501 decision: replace the partial sliding sheet with a full-screen modal without entrance animation.
2. Reuse the full transcript and folder sources as the first block of the conversation; preserve the underlying reader offset and progression.
3. Keep sessions, streaming, stop, retry, history, Markdown and citations; make scrolling respect manual reading and protect drafts when starting a conversation.
4. Reuse accessible controls and all eleven translation catalogues, run mobile/core typecheck and lint, review the diff, commit implementation, then mark Done. Native device validation remains owner follow-up.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Décision appliquée : Owner Validation de TASK-501, validée le 2026-10-12, qui remplace la mention historique sans modal. ChatSheet supprimé au profit de ChatConversationModal plein écran sans animation. TranscriptReader et les cartes de la liste Sources sont réutilisés au début du même ScrollView que ChatThread ; leurs gouttières restent celles des pages. Les pages restent montées, leur scroll/progression ne reçoit aucun événement du modal. L’ouverture reprend un offset relatif à la source ; historique/retour et nouvelle conversation ont un traitement distinct de restauration. Le flux suit le bas après envoi et s’arrête de suivre lors de la relecture manuelle. Le transport et ChatSessionContext sont inchangés : ouverture et nouveau fil ne génèrent rien ; fermer ne demande pas l’arrêt serveur.

Commandes accessibles de 48 minimum : fermeture, historique, nouvelle conversation create-outline, envoyer/arrêter. Un nouveau fil protège le brouillon par confirmation, avec libellés présents dans les 11 catalogues. Aucune limite ni compteur client ; les garde-fous serveur de TASK-503 sont conservés. Les statuts visibles de génération et les anciens libellés de feuille ont été supprimés ; les annonces accessibles et les états terminaux restent explicites.

Vérification locale : npm run typecheck et npm run lint réussis pour mobile et packages/core ; une alerte any préexistante demeure dans purchaseService.ts, fichier non modifié. git diff --check propre, revue des parcours et des lecteurs de traductions effectuée, aucune nouvelle dépendance ni test automatisé. Aucun secret ajouté. Validation native non prétendue : simctl indisponible sur ce poste. Checklist owner après distribution : média et dossier, Digest, clavier iOS/Android et safe areas, ouverture sans glissement, première question après un long transcript, relecture pendant le flux, arrêt/reprise, historique/nouveau fil, conservation du brouillon et retour à la position/progression de lecture.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Intègre le chat plein écran sur place selon TASK-501 : source puis échanges dans un défilement unique, commandes en en-tête, composeur simple et brouillon protégé. Supprime la feuille et ses libellés remplacés, conserve le transport, les sessions, l’historique et les citations. Typecheck/lint mobile et core réussis ; validation native sur appareil laissée à la checklist owner prévue par la tâche.
<!-- SECTION:FINAL_SUMMARY:END -->
