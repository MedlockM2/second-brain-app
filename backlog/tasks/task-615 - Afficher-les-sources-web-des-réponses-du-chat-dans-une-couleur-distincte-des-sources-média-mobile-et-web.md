---
id: TASK-615
title: >-
  Afficher les sources web des réponses du chat dans une couleur distincte des
  sources média (mobile et web)
status: Done
assignee: []
created_date: '2026-11-06 18:31'
updated_date: '2026-11-06 19:27'
labels:
  - mobile
  - web
  - chat
  - ui
dependencies:
  - TASK-614
references:
  - packages/core/src/chat/markdown.ts
  - mobile/src/components/MarkdownBody.tsx
  - mobile/src/components/chat/ChatThread.tsx
  - mobile/src/components/chat/CopyAnswerButton.tsx
  - mobile/src/components/chat/ChatWaitingIndicator.tsx
  - mobile/src/constants/theme.ts
  - web/src/chat
documentation:
  - mobile-design-mockups/chat_web_sources/code.html
priority: medium
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Responsabilité : agent — code et contrôles statiques dans son worktree. Aucun merge, push, déploiement ni validation propriétaire demandé par les critères.

## Maquette validée par l'owner (2026-11-06) : option B

`mobile-design-mockups/chat_web_sources/code.html`, avec la capture `screen.png` dans le même dossier. L'implémentation suit l'option B de la maquette. En cas d'écart entre la maquette et cette description, la maquette l'emporte.

## Décision de l'owner (2026-11-06)

Le chat peut citer des pages web (TASK-614). Ses sources web ne doivent jamais se confondre avec les sources média : **couleur différente** des citations `[S#]`, qui utilisent aujourd'hui `Colors.highlight` / `Colors.onHighlight` dans `MarkdownBody`.

## Ce qu'il faut faire

- **Le parseur.** `packages/core/src/chat/markdown.ts` reconnaît les tags `[W#]` du contrat de TASK-614 comme une famille distincte des `[S#]`.
- **La citation web dans le texte**, sur mobile et sur le web :
  - nouveaux tokens `webCitation` / `onWebCitation`, en clair `#dfe8fa` / `#24406e` et en sombre `#22344f` / `#c9dafb` ;
  - un globe (`globe-outline`), puis le domaine sans `www.` ;
  - un appui ouvre l'URL dans le navigateur ;
  - elle reste visible dans la conversation d'un média, où `showSources` masque les sources média. Une source web n'est jamais « la page ouverte ».
- **La liste « Pages web consultées »** sous la réponse, au-dessus du bouton de copie :
  - elle n'apparaît que si la réponse cite au moins une page web ;
  - un filet `outlineVariant` la sépare de la réponse, et son en-tête porte un globe et le libellé en `textSubtle` ;
  - une ligne par page, dédupliquée par URL : le titre en `textMain` 14 pt, le domaine en `textSubtle` 13 pt ;
  - chaque ligne fait au moins 44 pt de haut et ouvre la page.
- **Le tour en cours.** Un `[W#]` affiché pendant le flux se résout dès que la source est connue. Pendant une recherche, le point qui respire de `ChatWaitingIndicator` est suivi d'un globe et de « Recherche sur le web… » en `textSubtle` ; le libellé disparaît au premier mot de la réponse. Chaînes en FR et en EN.
- **La copie.** `CopyAnswerButton` copie une citation web sous forme de lien Markdown (`[titre](url)`), pas comme un `[W1]` nu.
- **L'accessibilité.** Le libellé de la citation dit qu'il s'agit d'une page web et donne son titre complet.

Note pour l'owner : contrôle visuel sur l'appareil après la build, en clair et en sombre.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `markdown.ts` produit des spans de citation web distincts des spans de citation média pour les tags `[W#]`
- [x] #2 Mobile et web dessinent une citation web avec des tokens de couleur dédiés (clair et sombre), différents de `highlight` / `onHighlight`, conformément à la maquette validée
- [x] #3 Un appui sur une citation web ouvre son URL ; les citations web restent affichées quand `showSources` est faux
- [x] #4 L'indicateur d'attente affiche « Recherche sur le web… » pendant l'état de recherche du tour, chaîne présente en FR et en EN
- [x] #5 La copie d'une réponse remplace chaque `[W#]` par un lien Markdown vers sa source
- [x] #6 `tsc` et le lint propres sur `mobile`, `web` et `packages/core`
- [x] #7 Sous une réponse qui cite au moins une page web, la liste « Pages web consultées » (titre et domaine, dédupliquée par URL, lignes de 44 pt qui ouvrent la page) est dessinée sur mobile et sur le web ; elle est absente sinon
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implémenté selon l'option B de `mobile-design-mockups/chat_web_sources/code.html`, validée par l'owner.

- **Parseur** (`packages/core/src/chat/markdown.ts`) : nouveau span `webCitation {ref: "W1"}`, distinct de `citation` et jamais groupé avec les `[S#]`. En mode `live`, un `[W` coupé est retenu. `keepCitations` laisse toujours passer les citations web, qui restent donc visibles quand `showSources` est faux.
- **Helpers partagés** (`packages/core/src/chat/webSources.ts`) : `webDomain` (sans `www.`), `webTitle`, `webSourcesByRef`, `citedWebSources` (pages citées, dédupliquées par URL, dans l'ordre de première citation) et `withWebLinks` (copie : `[W#]` → `[titre](url)`).
- **Tokens** : mobile `webCitation` / `onWebCitation` (`#dfe8fa` / `#24406e` en clair, `#22344f` / `#c9dafb` en sombre ; contraste 8,4:1 et 8,9:1). Web : `--web-citation` / `--on-web-citation`.
- **Citation dans le texte** : globe `globe-outline` puis le domaine, sur le fond bleu encre. Mobile : `Linking.openURL` via `lib/openWebPage.ts` (http(s) seulement). Web : lien dans un nouvel onglet. Libellé d'accessibilité « Ouvrir la page web {titre complet} », plus des actions d'accessibilité dans le paragraphe. Un tag dont la source n'est pas encore arrivée n'est pas dessiné.
- **Liste « Pages web consultées »** : `ChatWebSources`, sur mobile et sur le web. Filet `outlineVariant`, en-tête globe + libellé `textSubtle`, titre 14 / domaine 13, une ligne par URL qui ouvre la page. Hauteur des lignes : `TouchTarget.minimum` (48) sur mobile, 44 px sur le web. La liste n'apparaît que si la réponse cite au moins une page.
- **Tour en cours** : la session mobile (`ChatSessionContext`) et le web (`useChat`) gardent `streamingWebSources` (dernière liste cumulée reçue d'un fragment) et `webSearching` (événement `search`, ou `active_generation.web_searching`, remis à faux au premier fragment). `ChatWaitingIndicator` affiche le point, un globe et « Recherche sur le web… » pendant une recherche ; le libellé disparaît avec le premier mot.
- **Copie** : `CopyAnswerButton` (mobile et web) copie `withWebLinks(text, webSources)`.
- **i18n** : 4 clés (`searchingWeb`, `webSourcesTitle`, `webSourceA11y`, `openWebSourceA11y`) dans les 11 catalogues, FR et EN compris.

Vérifications : `tsc` propre sur `mobile`, `web` et `packages/core` ; eslint propre sur les fichiers touchés (mobile, web, core). Parseur et helpers vérifiés à la main avec un script jetable, non commité. Aucun test ajouté.

Note pour l'owner : contrôle visuel sur l'appareil après la build, en clair et en sombre, et dans le panneau web. Le filet au-dessus de la liste est celui de la maquette, qui l'emporte sur la règle « No-Line ».
<!-- SECTION:NOTES:END -->
