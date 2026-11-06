---
id: TASK-615
title: >-
  Afficher les sources web des réponses du chat dans une couleur distincte des
  sources média (mobile et web)
status: To Do
assignee: []
created_date: '2026-11-06 18:31'
updated_date: '2026-11-06 18:39'
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
- [ ] #1 `markdown.ts` produit des spans de citation web distincts des spans de citation média pour les tags `[W#]`
- [ ] #2 Mobile et web dessinent une citation web avec des tokens de couleur dédiés (clair et sombre), différents de `highlight` / `onHighlight`, conformément à la maquette validée
- [ ] #3 Un appui sur une citation web ouvre son URL ; les citations web restent affichées quand `showSources` est faux
- [ ] #4 L'indicateur d'attente affiche « Recherche sur le web… » pendant l'état de recherche du tour, chaîne présente en FR et en EN
- [ ] #5 La copie d'une réponse remplace chaque `[W#]` par un lien Markdown vers sa source
- [ ] #6 `tsc` et le lint propres sur `mobile`, `web` et `packages/core`
- [ ] #7 Sous une réponse qui cite au moins une page web, la liste « Pages web consultées » (titre et domaine, dédupliquée par URL, lignes de 44 pt qui ouvrent la page) est dessinée sur mobile et sur le web ; elle est absente sinon
<!-- AC:END -->
