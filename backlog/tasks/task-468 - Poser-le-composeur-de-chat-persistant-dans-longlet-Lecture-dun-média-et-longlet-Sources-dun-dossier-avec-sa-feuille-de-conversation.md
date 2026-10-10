---
id: TASK-468
title: >-
  Poser le composeur de chat persistant dans l'onglet Lecture d'un média et
  l'onglet Sources d'un dossier, avec sa feuille de conversation
status: Done
assignee: []
created_date: '2026-10-10 18:01'
updated_date: '2026-10-10 22:38'
labels:
  - mobile
  - chat
  - ui
  - feature
dependencies:
  - TASK-467
references:
  - docs/research/task-434-chatbot-integration-ui/README.md
  - docs/research/task-430-chatbot-architecture/README.md
  - >-
    mobile-design-mockups/chatbot_integration_ui/direction_f_composeur_persistant/code.html
  - >-
    mobile-design-mockups/chatbot_integration_ui/direction_f_composeur_persistant/screen.png
  - mobile-design-mockups/chatbot_integration_ui/README.md
  - mobile/src/components/CompletedDetailView.tsx
  - 'mobile/app/media/folders/[id].tsx'
  - 'mobile/app/(tabs)/digest/[period].tsx'
  - mobile/src/lib/quotaError.ts
  - mobile/src/lib/artifactRefusal.ts
  - mobile-design-mockups/my_design_system/DESIGN.md
modified_files:
  - mobile/src/components/chat/ChatDock.tsx
  - mobile/src/components/chat/ChatSheet.tsx
  - mobile/src/components/chat/ChatThread.tsx
  - mobile/src/components/chat/ChatComposer.tsx
  - mobile/src/lib/chatRefusal.ts
  - mobile/src/components/CompletedDetailView.tsx
  - 'mobile/app/media/folders/[id].tsx'
  - mobile/src/i18n/en.ts
  - mobile/src/i18n/fr.ts
  - mobile/src/i18n/es.ts
  - mobile/src/i18n/de.ts
  - mobile/src/i18n/it.ts
  - mobile/src/i18n/pt.ts
  - mobile/src/i18n/nl.ts
  - mobile/src/i18n/ja.ts
  - mobile/src/i18n/zh.ts
  - mobile/src/i18n/ar.ts
  - mobile/src/i18n/hi.ts
priority: medium
type: feature
ordinal: 75000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

L'intégration UI du chat est décidée par l'owner dans `docs/research/task-434-chatbot-integration-ui/README.md`, section **Owner Validation**, champ `Decision` — **source de vérité**, qui prime sur la Recommendation du benchmark (direction D, feuille invocable, plus E2) :

> direction F composeur persistant au niveau d'un media et au niveau d'un dossier mais pas au niveau de la biliothèque. Seulement visible dans l'onglet Lecture d'un media ou dans l'onglet Sources d'un dossier.

L'architecture est décidée dans `docs/research/task-430-chatbot-architecture/README.md`, section Owner Validation, `Decision` du 2026-10-10 : réponse **en flux SSE reprenable**, portées média et dossier dès la première livraison aux testeurs, bibliothèque hors périmètre.

**Maquettes de la direction retenue : `mobile-design-mockups/chatbot_integration_ui/direction_f_composeur_persistant/`** (`code.html` et `screen.png`, clair et sombre, 414 × 896 et 320 × 568) : le champ « Poser une question sur cet épisode… » au repos, le tapotement qui l'ouvre en feuille où **le même champ devient le composeur** (croissance jusqu'à 4 lignes puis défilement interne, compteur, envoi et arrêt distincts), le fil avec citations de source et actions, l'attente en flux avec bouton d'arrêt, l'erreur, le refus de quota, la conversation pleine. Le README de task-434 §6.1 et §6.7 liste les pièces (`ChatComposer`, `ChatThread`, `ChatSheet`) ; §1.7 rappelle que l'app n'a aujourd'hui aucun champ multiligne ni feuille de bas d'écran.

## Ce qui change par rapport à la direction F telle que benchmarkée — à lire avant de coder

La direction F du benchmark est un `NativeTabs.BottomAccessory` au-dessus de la barre d'onglets (iOS 26+, avec un repli JS sur Android et iOS 18). **Ce mécanisme ne s'applique pas à la décision de l'owner** : `media/[id]` et `media/folders/[id]` sont des écrans de la pile racine (`mobile/app/_layout.tsx`), hors du groupe `(tabs)`, donc sans barre d'onglets, et l'owner limite le composeur à deux onglets internes de ces écrans. Le composeur est donc **un composant d'écran** en React Native, le même sur iOS et Android, ancré en bas de :

- l'onglet **Lecture** (`reader`) de `mobile/src/components/CompletedDetailView.tsx` (portée média) ;
- l'onglet **Sources** de `mobile/app/media/folders/[id].tsx` (portée dossier).

Il n'apparaît **ni** dans l'onglet IA de ces écrans, **ni** sur la bibliothèque, **ni** sur les écrans de la barre d'onglets. `mobile/app/(tabs)/_layout.tsx`, `ScreenTabs.tsx`, `ArtifactsPanel.tsx` et `MediaReaderBar.tsx` ne sont pas modifiés ; `minimizeBehavior="never"` reste tel quel.

**Digest — tranché par l'owner le 2026-10-10 : le composeur y apparaît.** `CompletedDetailView` est aussi monté comme page du carrousel du Digest (`mobile/app/(tabs)/digest/[period].tsx`, README task-434 §1.6), donc l'onglet Lecture d'un média y porte aussi le composeur, à portée de ce média. Le benchmark signale qu'il y ouvre le clavier dans un pager horizontal : faire en sorte que l'ouverture du clavier et de la feuille ne fasse pas défiler le carrousel vers une autre page, et que changer de page ferme proprement la saisie en cours.

## Ce que la tâche livre

- Le composeur au repos, ancré en bas de l'onglet, avec le libellé de portée (« cet épisode », « ce dossier »), et l'ouverture en feuille de conversation portée par le `ChatSessionContext` de la tâche précédente (la conversation et la génération survivent à la fermeture de la feuille et au changement d'écran).
- Le fil : bulles question/réponse, **références de source citables** rendues lisibles (le prompt impose une référence de source par citation), texte qui s'écrit en flux, état **interrompu** et **échec partiel** visibles comme tels, y compris une réponse coupée par le plafond de sortie (Decision task-430 point 6), action d'arrêt explicite pendant la génération, nouvelle tentative qui ouvre une nouvelle génération.
- Les refus typés du contrat (`docs/CANONICAL_MEDIA_API_CONTRACT.md`) : question trop longue, conversation pleine, tour déjà en vol, budget de contexte dépassé, `out_of_minutes` et `item_too_long` (réutiliser `mobile/src/lib/quotaError.ts` et les clés `quota.refusal.*`, qui suppriment la route vers le paywall sous `beta_access`), `scope_empty` / `scope_too_large` (`mobile/src/lib/artifactRefusal.ts`).
- Clavier (`KeyboardAvoidingView` comme les dialogues existants), thèmes clair et sombre par `ThemeContext`, cibles tactiles d'au moins 48 pt (`TouchTarget.minimum`), accessibilité : focus à l'ouverture et au retour, fermeture par bouton et pas seulement par geste, annonce du texte qui arrive sans saturer le lecteur d'écran (README task-434 §5.5).
- **i18n dans la même tâche** : toutes les chaînes dans les onze catalogues de `mobile/src/i18n/` (`ar`, `de`, `en`, `es`, `fr`, `hi`, `it`, `ja`, `nl`, `pt`, `zh`) et `pseudo.ts`.

## Règles

Design system « Amber Clarity » (`mobile-design-mockups/my_design_system/DESIGN.md`, `mobile/src/constants/theme.ts`). Rien n'est déployé : pas de compatibilité. Pas de tests automatisés ; aucune suite Maestro en critère.

## Notes à l'owner

- Vérification visuelle sur appareil, iOS et Android, petit et grand écran, clair et sombre, sur un build de dev pointant l'API dev déployée : envoyer une question sur un média puis sur un dossier, quitter l'écran pendant le flux et revenir, passer l'app en arrière-plan et revenir, arrêter une réponse, déclencher un refus.
- Decision task-430 point 7 : « La qualité réelle doit être évaluée sur les contenus de l'app ». C'est une évaluation de l'owner sur les premiers tours réels, pas un critère de cette tâche.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Un composeur de chat est ancré en bas de l'onglet Lecture de CompletedDetailView et de l'onglet Sources de folders/[id].tsx, et n'apparaît ni dans les onglets IA, ni sur la bibliothèque, ni sur les écrans de la barre d'onglets
- [x] #2 (tabs)/_layout.tsx, ScreenTabs.tsx, ArtifactsPanel.tsx et MediaReaderBar.tsx ne sont pas modifiés
- [x] #3 Le tapotement ouvre une feuille de conversation où le même champ devient le composeur, multiligne jusqu'à 4 lignes puis défilement, avec compteur, envoi et arrêt distincts, conformément aux maquettes de direction_f_composeur_persistant/
- [x] #4 Le fil affiche le texte en flux, les références de source, l'état interrompu et l'échec partiel comme tels, et la conversation survit à la fermeture de la feuille et au changement d'écran par ChatSessionContext
- [x] #5 Chaque refus typé du contrat du chat a un rendu, en réutilisant quotaError.ts, artifactRefusal.ts et les clés quota.refusal.* existantes
- [x] #6 Les thèmes clair et sombre passent par ThemeContext, aucune cible tactile n'est sous 48 pt, et la feuille se ferme par un bouton annoncé ; toutes les chaînes nouvelles existent dans les onze catalogues et pseudo.ts
- [x] #7 npx tsc --noEmit et le lint du projet mobile passent
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Composeur de chat persistant (direction F adaptée en composant d'écran, iOS et Android identiques).

- `ChatDock` est ancré sous le contenu de l'onglet **Lecture** de `CompletedDetailView`, donc aussi sur les pages média du Digest, et de l'onglet **Sources** de `folders/[id].tsx`, hors chargement et erreur. Il est absent des onglets IA, de la bibliothèque et des écrans de la barre d'onglets. Au repos, c'est un champ qui nomme sa portée (« …sur cette source », « …sur ce dossier ») ou dit « Une réponse est en cours… ». `(tabs)/_layout.tsx`, `ScreenTabs.tsx`, `ArtifactsPanel.tsx` et `MediaReaderBar.tsx` ne sont pas modifiés.
- `ChatSheet` : feuille modale montant du bas, `KeyboardAvoidingView`, en-tête avec titre, « Nouvelle conversation » et bouton de fermeture annoncé (le scrim ferme aussi). Le focus va au titre et au champ à l'ouverture, puis revient au dock à la fermeture. En modale, le clavier ne fait pas défiler le carrousel du Digest. La feuille est masquée quand l'écran perd le focus ; la réponse continue.
- `ChatComposer` : champ multiligne qui grandit jusqu'à 4 lignes puis défile, compteur `n / 1 000`, plafond à 1 000 caractères, boutons Envoyer et Arrêter distincts (Arrêter seulement pendant une génération ; c'est le seul appel à la route d'arrêt).
- `ChatThread` : questions et réponses, texte en flux, attente « Lecture des sources… ». Les références `[Sn]` sont rendues en étiquettes et lues avec le titre de la source. Les états interrompu (arrêt, plafond de sortie, erreur avec partiel conservé) et échec sont affichés comme tels. « Reposer la question » lance un nouveau tour, donc une nouvelle génération.
- `lib/chatRefusal.ts` : rendu de chaque refus du contrat (`question_too_long`, `conversation_full`, `turn_in_flight`, `context_budget_exceeded`, `scope_preparing`, `turn_count_changed`, `generation_stale`, `conversation_not_found`). Il réutilise `quotaError.ts` (clés `quota.refusal.*`, sans paywall sous `beta_access`) et `artifactRefusal.ts` (`scope_empty`, `scope_too_large`). Actions proposées : « Voir les offres » ou « Nouvelle conversation ».
- Thèmes via `useThemedStyles` et `ThemeContext`, cibles ≥ `TouchTarget.minimum`, annonces lecteur d'écran au début et à la fin d'une réponse seulement. 35 clés `chat.*` ajoutées aux onze catalogues ; `pseudo.ts` les transforme automatiquement, il ne porte pas de clés.

Vérifications : `npx tsc --noEmit` passe ; `npm run lint` donne 0 erreur (1 avertissement préexistant).

Note à l'owner : vérification visuelle à faire sur appareil (iOS et Android, petit et grand écran, clair et sombre). Le flux ne fonctionnera qu'une fois `EXPO_PUBLIC_CHAT_STREAM_URL` renseignée (task-467) ; avant cela, les réponses apparaissent par relecture.
<!-- SECTION:FINAL_SUMMARY:END -->
