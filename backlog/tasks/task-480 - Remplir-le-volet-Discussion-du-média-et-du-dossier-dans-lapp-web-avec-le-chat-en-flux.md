---
id: TASK-480
title: >-
  Remplir le volet Discussion du média et du dossier dans l'app web avec le chat
  en flux
status: To Do
assignee: []
created_date: '2026-10-11 15:57'
updated_date: '2026-10-15 22:02'
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
  - docs/research/task-501-chat-inline/README.md
  - packages/core/src/chat/markdown.ts
  - mobile/src/components/MarkdownBody.tsx
  - mobile/src/components/chat/ChatThread.tsx
priority: medium
type: feature
ordinal: 87000
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

## Évolutions du chat mobile depuis la création de cette tâche (11 → 15 octobre)

La tâche a été rédigée le 11 octobre. Le chat mobile a changé depuis ; le web reprend ces **comportements**, dans la disposition en trois volets de la direction web (le modal plein écran de task-501 est propre au téléphone et ne s'applique pas au bureau) :

- **task-500** — réponses rendues en **Markdown** (titres, listes, citations, code, liens), avec l'analyseur partagé `packages/core/src/chat/markdown.ts` (tableaux compris depuis task-513). Dans un dossier, chaque balise `[S1]` devient un repère portant le titre court du média cité, et une liste « Sources » sous une réponse terminée ouvre chaque média cité. Dans un média, les balises sont omises.
- **task-501 / task-502**, règles du `Decision` de `docs/research/task-501-chat-inline/README.md` qui valent hors du téléphone : composeur **sans limite ni compteur de caractères**, icône de nouvelle conversation `create-outline`, bouton envoyer/arrêter unique, pas de libellé « Génération en cours ».
- **task-503** — question libre, sans compteur.
- **task-519** — une question peut être posée pendant l'extraction du média ; elle attend que la source soit prête.
- **task-505** — interactions du chat corrigées sur TestFlight : lire la tâche et reprendre ce qui n'est pas propre au tactile ou au clavier iOS.

Les libellés existent déjà dans les catalogues partagés (`packages/core/src/i18n`, clés `chat.*`) : les réutiliser.

## Réutiliser `parseSseBlock`

La lecture d'un bloc du flux (`parseSseBlock`) vit dans `packages/core` depuis task-493, sans aucune dépendance Expo. Le client web l'importe de là. Ne pas réécrire d'analyseur propre au web, ne pas créer d'alias vers `mobile/src`, et ne modifier aucun fichier de `mobile/`.

## Règles

- Câblé sur les endpoints existants (`/api/chat` et la façade de flux) : **pas de nouvelle route** d'API.
- Ne modifier aucun fichier de `mobile/`.
- Rien n'est déployé : aucune compatibilité. Pas de tests automatisés.

## Note à l'owner

Après déploiement de task-474 et de l'app : poser une question sur un média et sur un dossier, l'arrêter, recharger la page pendant un flux pour vérifier la reprise, et provoquer un refus de contexte sur un gros dossier. Vérifier aussi le rendu Markdown d'une réponse et la liste « Sources » d'une réponse de dossier.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le volet Discussion du média et du dossier rend le composeur à sa portée, le fil, l'historique, la nouvelle conversation, l'arrêt et la relance
- [ ] #2 Les refus de contexte et de minutes et l'échec partiel sont rendus avec les états de la maquette, et un tour en échec generation_lost ou dispatch_failed se relance comme une nouvelle question, sans événement replaced
- [ ] #3 Le flux est lu par fetch et ReadableStream avec Authorization: Bearer, reprend par after_seq et retombe sur la relecture de la conversation en cas d'échec
- [ ] #4 Le client de chat web ne dépend d'aucune API ni d'aucun paquet Expo, et aucun fichier de mobile/ n'est modifié
- [ ] #5 Les libellés sont présents dans les 11 langues
- [ ] #6 Le build passe, typecheck et lint sont propres
- [ ] #7 Les réponses sont rendues en Markdown par packages/core/src/chat/markdown.ts ; dans un dossier, les balises [Sn] portent le titre court du média cité et une liste Sources ouvre chaque média cité ; dans un média, elles sont omises (task-500)
- [ ] #8 Le composeur n'a ni limite ni compteur de caractères, la nouvelle conversation utilise l'icône create-outline, et une question peut être envoyée pendant l'extraction du média (task-501, task-503, task-519)
<!-- AC:END -->
