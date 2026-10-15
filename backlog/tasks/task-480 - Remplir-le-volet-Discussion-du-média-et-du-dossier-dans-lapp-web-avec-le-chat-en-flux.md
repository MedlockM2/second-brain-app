---
id: TASK-480
title: >-
  Remplir le volet Discussion du média et du dossier dans l'app web avec le chat
  en flux
status: Done
assignee: []
created_date: '2026-10-11 15:57'
updated_date: '2026-10-15 22:25'
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
- [x] #1 Le volet Discussion du média et du dossier rend le composeur à sa portée, le fil, l'historique, la nouvelle conversation, l'arrêt et la relance
- [x] #2 Les refus de contexte et de minutes et l'échec partiel sont rendus avec les états de la maquette, et un tour en échec generation_lost ou dispatch_failed se relance comme une nouvelle question, sans événement replaced
- [x] #3 Le flux est lu par fetch et ReadableStream avec Authorization: Bearer, reprend par after_seq et retombe sur la relecture de la conversation en cas d'échec
- [x] #4 Le client de chat web ne dépend d'aucune API ni d'aucun paquet Expo, et aucun fichier de mobile/ n'est modifié
- [x] #5 Les libellés sont présents dans les 11 langues
- [x] #6 Le build passe, typecheck et lint sont propres
- [x] #7 Le composeur n'a ni limite ni compteur de caractères, la nouvelle conversation utilise l'icône create-outline, et une question peut être envoyée pendant l'extraction du média (task-501, task-503, task-519)
- [x] #8 Les réponses sont rendues en Markdown par packages/core/src/chat/markdown.ts ; dans un dossier, les balises [Sn] deviennent le titre court du média cité, un lien qui l'ouvre ; dans un média, elles sont omises (task-500, état actuel du mobile)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fait le 2026-10-16.

- `web/src/chat/chatClient.ts` : routes REST `/api/chat` et lecture du flux par `fetch` + `ReadableStream` avec `Authorization: Bearer` (via `sendAuthenticated`), blocs lus par `parseSseBlock` de `packages/core`.
- `web/src/chat/useChat.ts` : contrôleur d'une portée, portage du `ChatSessionContext` mobile : reprise par `after_seq`, `reconnect`, 409 qui adopte la génération vivante, repli sur la relecture toutes les 2 s si le flux est indisponible ; quitter la page ne fait que déconnecter, seul « Arrêter » appelle `/stop`. Un tour `failed` (dont `generation_lost`, `dispatch_failed`) se relance comme nouvelle question avec un nouveau `client_request_id`. Question pendant l'extraction : gardée localement (« En attente de l'extraction… »), envoyée quand le texte est prêt, annulable (task-519). À l'ouverture, le volet reprend la dernière conversation de la portée, flux compris (rechargement pendant un flux).
- `web/src/components/chat/useChatPane.tsx` : fil, composeur (Entrée envoie, Maj+Entrée va à la ligne, pas de limite ni de compteur, un seul bouton envoyer/arrêter), historique paginé avec suppression confirmée, nouvelle conversation (`create-outline`), refus traduits avec leur action (nouvelle conversation, formules).
- `web/src/components/MarkdownView.tsx` : rendu web du Markdown partagé, citations en liens vers le média.
- `packages/core/src/chat/refusal.ts` : `describeChatRefusal` mis en commun (copie mobile laissée telle quelle, aucun fichier `mobile/` touché par cette tâche).
- Config : `VITE_CHAT_STREAM_URL` (`web/.env.example`, `config.ts`). Libellés : réutilisation des clés `chat.*` partagées, plus `chat.emptyMedia` et `chat.emptyFolder` dans les 11 catalogues web.

Écarts assumés :
- La liste « Sources » sous une réponse (task-500) n'existe plus dans le mobile actuel : les citations en ligne ouvrent les médias. L'AC a été corrigé en conséquence.
- Le surlignage des paragraphes cités dans le volet Lecture n'est pas faisable : une citation désigne un média (`[S1]`), jamais un paragraphe, et dans une conversation de média les balises sont omises.

Contrôles : `tsc`, ESLint et `vite build` du web OK ; core typecheck et lint OK. Note owner : après déploiement de task-474, poser une question sur un média et un dossier, l'arrêter, recharger pendant un flux, provoquer un refus de contexte sur un gros dossier.
<!-- SECTION:NOTES:END -->
