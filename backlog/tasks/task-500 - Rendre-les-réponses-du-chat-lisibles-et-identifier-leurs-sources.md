---
id: TASK-500
title: Rendre les réponses du chat lisibles et identifier leurs sources
status: Done
assignee:
  - Codex
created_date: '2026-10-12 09:41'
updated_date: '2026-10-12 09:49'
labels:
  - mobile
  - chat
  - testflight
dependencies: []
modified_files:
  - packages/core/src/chat/markdown.ts
  - mobile/src/components/chat/ChatAnswer.tsx
  - mobile/src/components/chat/ChatThread.tsx
  - mobile/src/components/chat/ChatSheet.tsx
  - mobile/src/components/chat/ChatDock.tsx
  - packages/core/src/i18n
type: bug
ordinal: 107000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Feedback AMY-6HZqKdyaRca9HS1nXSs, build 14 : Markdown visible en brut, réponses tassées et citations numériques opaques. Reprendre et revoir feedback/chat-markdown-et-sources. La correction couvre le rendu pendant/après streaming et l'identification des médias cités ; elle ne promet pas d'ancres de passages absentes du contrat ChatSource. Validation sur appareil après OTA : réponse en listes, ouverture d'une source puis retour à la conversation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Les réponses du chat utilisent un rendu Markdown aéré pendant et après streaming, avec les tokens du design system.
- [x] #2 Dans un dossier, les sources citées portent le titre du média et offrent une navigation vers celui-ci avec retour à la conversation.
- [x] #3 Le rendu ne promet pas de citations de passages précis que le contrat API ne fournit pas.
- [x] #4 Le parseur neutre est partagé dans packages/core et n'importe aucune API de plateforme.
- [x] #5 Typecheck et lint mobile/core passent sans nouvelle erreur, et les traductions des onze langues sont cohérentes ; aucun test automatisé ajouté.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Reprendre le rendu et la navigation préparés sur feedback/chat-markdown-et-sources. Déplacer le parseur TS sans API de plateforme dans packages/core/chat/markdown et adapter les imports. Revoir la navigation source/retour et les traductions. Lancer typecheck/lint mobile/core et typecheck web ; aucune nouvelle dépendance ou suite de tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rendu préparé repris : blocs Markdown, emphase et citations traités pendant/après streaming, espacements et couleurs du thème ; titres des médias cités et liste de navigation en dossier. La feuille suit isFocused et reste ouverte dans l'état local : elle se masque pendant la navigation et revient avec la conversation. Le chat média ne promet plus de citation de passages, absents de ChatSource.

Parseur neutre déplacé dans packages/core/src/chat/markdown.ts, import mobile adapté, ancien fichier mobile supprimé. Aucune dépendance ajoutée. npm ci exécuté à la racine du worktree pour obtenir des liens workspace locaux (les liens du node_modules principal résolvaient ses anciens catalogues). Typecheck mobile/core/web et lint mobile/core passent, avec un seul warning préexistant dans purchaseService. Aucun test automatisé ajouté. Streaming et aller-retour source à vérifier sur appareil après OTA.

Revue RTL complémentaire : indentation de liste et bordure de citation utilisent les propriétés logiques Start ; chevron de navigation inversé en RTL. Typecheck mobile et lint ciblé ChatAnswer relancés après cet ajustement, sans erreur.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Le chat rend les réponses en Markdown aéré et identifie les médias cités par leur titre avec navigation depuis les dossiers. Le parseur TS pur est partagé dans packages/core ; onze catalogues adaptés, aucune dépendance native. Typecheck mobile/core/web et lint mobile/core passent, hors warning préexistant purchaseService. Validation visuelle et navigation sur appareil restantes ; aucune ancre de passage ajoutée au contrat.
<!-- SECTION:FINAL_SUMMARY:END -->
