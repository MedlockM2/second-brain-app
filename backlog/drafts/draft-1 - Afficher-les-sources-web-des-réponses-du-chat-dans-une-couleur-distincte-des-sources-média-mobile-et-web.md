---
id: DRAFT-1
title: >-
  Afficher les sources web des réponses du chat dans une couleur distincte des
  sources média (mobile et web)
status: Draft
assignee: []
created_date: '2026-11-06 18:31'
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
priority: medium
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Responsabilité : agent — code et contrôles statiques dans son worktree. Aucun merge, push, déploiement ni validation propriétaire demandé par les critères.

**En Draft tant que l'owner n'a pas validé la maquette.** Selon la règle « maquette avant le code », la maquette se fait dans `mobile-design-mockups/` et l'owner donne son go. Le chemin de la maquette validée sera ajouté ici avant le passage en To Do. L'implémentation suit la maquette validée, pas cette description.

## Décision de l'owner (2026-11-06)

Le chat peut citer des pages web (TASK-614). Ses sources web ne doivent jamais se confondre avec les sources média : **couleur différente** des citations `[S#]`, qui utilisent aujourd'hui `Colors.highlight` / `Colors.onHighlight` dans `MarkdownBody`.

## Ce qu'il faut faire

- **Le parseur.** `packages/core/src/chat/markdown.ts` reconnaît les tags `[W#]` du contrat de TASK-614 comme une famille distincte des `[S#]`.
- **Le rendu, sur mobile et sur le web.**
  - Une citation web a sa propre couleur, avec des tokens de thème ajoutés en clair et en sombre.
  - Elle affiche le nom du site ou le titre de la page.
  - Un appui ouvre l'URL dans le navigateur.
  - Elle reste visible dans la conversation d'un média, où `showSources` masque les sources média. Une source web n'est jamais « la page ouverte ».
- **Le tour en cours.** Un `[W#]` affiché pendant le flux se résout dès que la source est connue. Pendant une recherche, l'attente affiche « Recherche sur le web… » (i18n FR et EN).
- **La copie.** `CopyAnswerButton` copie une citation web sous forme de lien Markdown (`[titre](url)`), pas comme un `[W1]` nu.
- **L'accessibilité.** Le libellé de la citation dit qu'il s'agit d'une page web et la nomme.

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
<!-- AC:END -->
