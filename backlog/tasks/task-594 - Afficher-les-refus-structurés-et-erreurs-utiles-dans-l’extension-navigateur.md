---
id: TASK-594
title: Afficher les refus structurés et erreurs utiles dans l’extension navigateur
status: Done
assignee:
  - '@codex'
created_date: '2026-11-04 19:16'
updated_date: '2026-11-04 22:52'
labels:
  - web
  - v1-launch
  - agent
  - extension
dependencies: []
references:
  - extension/lib/api.ts
  - extension/entrypoints/popup/main.ts
  - extension/entrypoints/background.ts
  - extension/scripts/messages.py
  - packages/core/src/errors/quotaError.ts
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
priority: high
type: bug
ordinal: 201000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Responsabilité : agent — code/configuration/documentation et contrôles statiques dans son worktree. Aucun merge, push, déploiement, publication ou validation propriétaire demandé par les critères.

Audit extension du 2026-11-04 : lib/api.ts remplace toute réponse non OK par request_failed_<status>, puis la popup affiche seulement saveFailed ; le menu contextuel n’affiche qu’un badge d’échec. Le budget épuisé, le fournisseur suspendu, la source refusée et une panne réseau deviennent donc indiscernables. Le contrat budgétaire a évolué depuis TASK-487 : réutiliser ses codes stables et les règles de présentation existantes sans prix, achat, crédits ni données techniques brutes. Cette tâche porte l’extension, pas une nouvelle API ou une nouvelle méthode de facturation.

Préserver la sélection/destination et la possibilité de reprendre après refus ; garder les erreurs d’appairage volontairement neutres vis-à-vis de l’existence d’une adresse. Le badge du menu contextuel ne doit jamais annoncer un succès sur un refus ; documenter la façon de consulter l’explication depuis la popup sans stocker inutilement le contenu sélectionné. Validation réelle après livraison par les tâches propriétaire TASK-592/593. Ne pas ajouter de permissions navigateur ni lire le DOM des pages pour traiter ces erreurs.

Contraintes : aucun nouveau test automatisé. Ne pas modifier le sync Spotify, la livraison email, la génération des quiz, Whisper ni la facturation à crédits. Aucun secret, identité de compte ou compte reviewer dans les fichiers suivis. Les contrats restent sous /api/media et /api/artifacts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 La couche API de l’extension conserve les codes de refus utiles et distingue réseau, session expirée/révoquée, quota/capacité, indisponibilité fournisseur et source refusée ; les messages bruts du backend ne sont pas affichés.
- [x] #2 La popup fournit des explications et actions cohérentes avec mobile/web pour les refus budgétaires, sans proposition d’achat ; une erreur conserve la destination et permet une reprise explicite sans sauvegarde automatique supplémentaire.
- [x] #3 Les retours du menu contextuel distinguent succès et échec et la consultation de l’explication est documentée ; aucun texte sélectionné ni credential n’est ajouté aux journaux ou à un historique de diagnostic.
- [x] #4 Les libellés ajoutés existent dans les 11 catalogues ; typecheck, lint et builds Chromium/Firefox passent, avec contrôles core/mobile si le code partagé change.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Conserver les codes structurés via le parseur HTTP commun ; classer seulement les refus connus, le réseau, la session et la source, sans afficher les messages serveur.
2. Présenter ces refus dans la popup avec les mêmes libellés budgétaires que les apps, en conservant le dossier et un nouvel essai manuel ; laisser les erreurs de code d’appairage neutres.
3. Garder seulement le dernier code d’échec du menu contextuel en storage.session (et une date de remise à zéro validée), le consommer dans la popup et documenter la reprise de sélection ; ne conserver ni texte, URL, compte ni credential dans ce diagnostic.
4. Générer les libellés des 11 catalogues en réutilisant les traductions existantes de core et exécuter typecheck, lint et builds Chromium/Firefox. Aucun changement des permissions ni de core.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Typecheck, lint, builds Chromium et Firefox passent avec des origines locales explicites de compilation. Les 11 catalogues sont générés depuis messages.py, avec reprise des libellés budget/réseau/source de core. Revue statique : messages serveur jamais affichés ; session rejetée après rotation => liaison expirée ; refus en popup => dossier inchangé et bouton réactivé ; aucun nouvel envoi automatique après refus. Le dernier échec contextuel ne conserve que le code autorisé et la date validée dans storage.session, puis est consommé à l’ouverture de la popup. Les échecs du diagnostic ne changent pas une sauvegarde acceptée en échec. Permissions inchangées, aucun code partagé modifié, aucun test ajouté.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Affiche les refus utiles de sauvegarde au lieu d’un échec générique : réseau, session, source et capacité bêta. Réutilise les messages budgétaires des apps sans achat ni texte brut serveur. Le menu contextuel conserve un diagnostic éphémère minimal consultable dans la popup, sans sélection ni URL. Les contrôles statiques et les deux builds passent.
<!-- SECTION:FINAL_SUMMARY:END -->
