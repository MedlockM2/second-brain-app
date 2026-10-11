---
id: TASK-480
title: >-
  Remplir le volet Discussion du média et du dossier dans l'app web avec le chat
  en flux
status: To Do
assignee: []
created_date: '2026-10-11 15:57'
labels:
  - web
  - chat
  - feature
dependencies:
  - TASK-474
  - TASK-477
  - TASK-478
references:
  - docs/research/task-424-website-and-browser-extension/README.md
  - >-
    docs/research/task-424-website-and-browser-extension/complement-response-2026-10-11.md
  - mobile-design-mockups/web_app_owner_direction/README.md
  - mobile-design-mockups/web_app_owner_direction/code.html
  - mobile/src/services/chatService.ts
  - mobile/src/contexts/ChatSessionContext.tsx
  - mobile/src/types/chat.ts
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
priority: medium
type: feature
ordinal: 87000
dispatchable: true
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Source de vérité : `docs/research/task-424-website-and-browser-extension/README.md`, section **Owner Validation**, champ `Decision` du 2026-10-11, tel que précisé par `complement-response-2026-10-11.md` (même répertoire), qui prime sur la Recommendation et sur les §8 à §12 du README. Cette tâche est l'élément **W-10** du §3 du complément.

L'interface est la direction de l'owner : `mobile-design-mockups/web_app_owner_direction/README.md` **fait foi** (lignes « Média en trois volets » et « Dossier en trois volets », volet **Discussion** du milieu). La maquette `code.html` contient les états du chat : envoi, arrêt, reprise, refus de contexte, minutes épuisées, historique. Le volet Discussion est l'emplacement laissé par task-477 (média) et task-478 (dossier). La façade de flux a son CORS depuis task-474.

## Périmètre

- Le composeur **« Ce média »** et **« Ce dossier · N sources »**, le fil, l'historique des conversations, la nouvelle conversation, l'**arrêt** et la **relance**.
- Les **refus** (contexte, minutes) et l'**échec partiel**, avec les états de la maquette.
- Les paragraphes cités par la réponse sont surlignés dans le volet Lecture du média (ligne « Média en trois volets »).
- **Le flux** : lu par `fetch` et `ReadableStream` avec `Authorization: Bearer` sur l'URL `execute-api` de la façade. `EventSource` ne permet pas d'en-tête (README §6.3, point 6). La reprise se fait par `after_seq` ; la relecture de la conversation prend le relais en cas d'échec, comme le contrôleur mobile (task-467, `mobile/src/contexts/ChatSessionContext.tsx`).
- **Le contrat est celui de task-470** : pas d'événement `replaced`. Un tour perdu revient en échec (`generation_lost`, `dispatch_failed`) et se relance comme une nouvelle question.

## Réutiliser `parseSseBlock`

La lecture d'un bloc du flux (`parseSseBlock`) vit dans `packages/core` depuis task-493, sans aucune dépendance Expo. Le client web l'importe de là. Ne pas réécrire d'analyseur propre au web, ne pas créer d'alias vers `mobile/src`, et ne modifier aucun fichier de `mobile/`.

## Règles

- Câblé sur les endpoints existants (`/api/chat` et la façade de flux) : **pas de nouvelle route** d'API.
- Ne modifier aucun fichier de `mobile/`.
- Rien n'est déployé : aucune compatibilité. Pas de tests automatisés.

## Note à l'owner

Après déploiement de task-474 et de l'app : poser une question sur un média et sur un dossier, l'arrêter, recharger la page pendant un flux pour vérifier la reprise, et provoquer un refus de contexte sur un gros dossier.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le volet Discussion du média et du dossier rend le composeur à sa portée, le fil, l'historique, la nouvelle conversation, l'arrêt et la relance
- [ ] #2 Les refus de contexte et de minutes et l'échec partiel sont rendus avec les états de la maquette, et un tour en échec generation_lost ou dispatch_failed se relance comme une nouvelle question, sans événement replaced
- [ ] #3 Le flux est lu par fetch et ReadableStream avec Authorization: Bearer, reprend par after_seq et retombe sur la relecture de la conversation en cas d'échec
- [ ] #4 Le client de chat web ne dépend d'aucune API ni d'aucun paquet Expo, et aucun fichier de mobile/ n'est modifié
- [ ] #5 Les libellés sont présents dans les 11 langues
- [ ] #6 Le build passe, typecheck et lint sont propres
<!-- AC:END -->
