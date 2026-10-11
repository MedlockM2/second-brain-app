---
id: TASK-497
title: >-
  Afficher immédiatement les questions et les réponses en streaming du chat
  mobile
status: Done
assignee:
  - codex
created_date: '2026-10-11 20:51'
updated_date: '2026-10-11 21:02'
labels:
  - mobile
  - chat
  - testflight
dependencies: []
references:
  - >-
    https://github.com/vercel/ai/blob/ba05943b69ad070558bb5bc912da99ec66d7d263/packages/react/src/use-chat.ts
  - >-
    https://github.com/LibreChat-AI/LibreChat/blob/e1dfc10449ff713faffacd60273fddcfe2c0a698/client/src/hooks/Chat/useChatFunctions.ts
  - >-
    https://github.com/assistant-ui/assistant-ui/blob/cc2cece573e5bfc3936a1872f85a494267755cef/packages/core/src/runtimes/local/local-thread-runtime-core.ts
documentation:
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
modified_files:
  - mobile/src/components/chat/ChatComposer.tsx
  - mobile/src/components/chat/ChatDock.tsx
  - mobile/src/components/chat/ChatSheet.tsx
  - mobile/src/components/chat/ChatThread.tsx
  - mobile/src/contexts/ChatSessionContext.tsx
  - packages/core/src/i18n/ar.ts
  - packages/core/src/i18n/de.ts
  - packages/core/src/i18n/en.ts
  - packages/core/src/i18n/es.ts
  - packages/core/src/i18n/fr.ts
  - packages/core/src/i18n/hi.ts
  - packages/core/src/i18n/it.ts
  - packages/core/src/i18n/ja.ts
  - packages/core/src/i18n/nl.ts
  - packages/core/src/i18n/pt.ts
  - packages/core/src/i18n/zh.ts
priority: high
type: bug
ordinal: 104000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Feedback TestFlight AMojvXxaa13DUsqXWVNxTMA du 2026-10-11, build 14 : après Envoyer, aucune réaction visible pendant plusieurs secondes, puis la question et la réponse apparaissent ensemble. L'owner a demandé une comparaison avec Vercel AI SDK, LibreChat et assistant-ui puis autorisé le correctif. Le périmètre couvre le contrôleur mobile partagé média/dossier, l'affichage immédiat, l'envoi et les erreurs, sans modification du protocole backend. Validation visuelle sur appareil à réaliser par l'owner après intégration et distribution OTA.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Les écrans média et dossier consomment les sessions réactives du contrôleur et rendent la question locale avec son indicateur avant toute attente réseau, même sans conversation préexistante.
- [x] #2 Le chemin d'envoi se termine à l'acceptation serveur et libère le champ à ce moment ; le suivi SSE alimente séparément la réponse visible et la commande Arrêter reste câblée.
- [x] #3 Le contrôleur verrouille la soumission avant toute attente ; le chemin d'erreur conserve la question et son identifiant pour une reprise, et l'adoption du tour serveur remplace la question provisoire sans doublon.
- [x] #4 Les résultats asynchrones sont vérifiés avant publication lors des changements de conversation ou de compte ; les chemins de reprise par séquence et d'arrêt explicite serveur sont conservés.
- [x] #5 Les libellés ajoutés couvrent les 11 langues ; typecheck et lint mobile et packages/core terminent sans erreur, sans ajout de tests automatisés.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Publier un snapshot React des sessions dans le contexte, en gardant les références des transports et les accès synchrones du contrôleur.
2. Représenter la question locale en attente, la montrer avec un état traduit et verrouiller l'envoi avant toute attente réseau ; conserver son client_request_id pour une reprise incertaine.
3. Retourner dès l'acceptation, remplacer la question provisoire par le tour accepté et démarrer le suivi SSE sans attendre sa clôture ; libérer le composer à ce moment.
4. Invalider les opérations lors des changements de conversation/compte, protéger les lectures concurrentes et les fragments par identité, et garder la déconnexion distincte de l'arrêt serveur.
5. Mettre à jour les 11 catalogues, examiner les chemins erreur/polling/retour au premier plan, lancer typecheck et lint mobile et core, puis documenter les limites de validation et préparer la branche sans merge ni push.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implémentation dans le worktree isolé /tmp/second-brain-chat-stream-feedback, branche feedback/chat-immediate-stream. Snapshot React réellement publié ; question locale rendue avant le réseau ; adoption immédiate du tour accepté puis suivi SSE indépendant. Erreurs portées par la session plutôt que par un catch local tardif. Les opérations sont bornées par un epoch de conversation et une version de lecture ; le curseur utilise l'état le plus récent après chaque await. La sélection d'historique adopte directement la génération active déjà retournée par l'API. L'ancien startConversation exposé mais devenu sans lecteur est supprimé.
Validation intermédiaire : typecheck mobile/core et lint core passent ; lint mobile passe avec un warning préexistant purchaseService.ts:136 (no-explicit-any). Le resolver TypeScript est installé dans le node_modules mobile du checkout principal : lien local gitignoré ajouté dans le worktree pour le retrouver, aucun changement de dépendances.

AC1–4 reformulés comme chemins de code câblés et vérifiables dans le worktree, à périmètre inchangé, conformément à AGENTS.md : la validation visuelle après distribution appartient à la note owner, pas à un gate d'implémentation. Revue manuelle des chemins : première ouverture et envoi partagent la même question provisoire ; le verrou est posé avant le premier await ; le tour accepté remplace la question locale atomiquement puis le suivi SSE est lancé sans await ; les snapshots de contexte changent à chaque publication. Les callbacks vérifient l'identité du follower, l'epoch et, pour le flux, la conversation/le tour/la tentative ; les lectures emploient une version et conservent le texte/cursor les plus récents. Aucun changement de protocole ni nouvel appel payant de diagnostic.
Vérification finale : typecheck mobile et core exit 0, lint core exit 0, lint mobile exit 0 avec uniquement le warning préexistant purchaseService.ts:136 ; lint ciblé des cinq fichiers mobile modifiés exit 0 après la dernière modification ; git diff --check exit 0. Deux nouvelles clés couvertes par les 11 catalogues, contrôlées par le typage Catalog. Aucun test automatisé ajouté ou exécuté. Aucun rendu sur appareil exercé et aucune latence backend mesurée.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Au tap sur Envoyer, le chat publie désormais la question et l'état d'envoi avant le réseau, puis adopte le tour accepté et affiche les fragments SSE via des snapshots React réellement propagés au contexte. Le composer est libéré à l'acceptation au lieu d'attendre la fin de génération. Les erreurs et la question récupérable restent dans la session ; le retry réutilise son client_request_id. Un verrou synchrone bloque les doubles envois, et les opérations obsolètes sont ignorées après changement de conversation/compte ou de transport.

Validation : typecheck/lint mobile et core sans erreur ; un warning préexistant dans purchaseService. Aucun test automatisé. À vérifier sur appareil après intégration et distribution OTA : premier message et suivants, apparition progressive, Arrêter, retry après coupure réseau, fermeture/réouverture et retour du background, sur média et dossier. Branche feedback/chat-immediate-stream ; aucun merge, push ou déploiement effectué.
<!-- SECTION:FINAL_SUMMARY:END -->
