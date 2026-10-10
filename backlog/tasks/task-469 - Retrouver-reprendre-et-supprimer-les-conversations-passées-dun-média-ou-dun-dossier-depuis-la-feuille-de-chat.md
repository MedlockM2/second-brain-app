---
id: TASK-469
title: >-
  Retrouver, reprendre et supprimer les conversations passées d'un média ou d'un
  dossier depuis la feuille de chat
status: Done
assignee: []
created_date: '2026-10-10 18:01'
updated_date: '2026-10-10 22:40'
labels:
  - mobile
  - chat
  - ui
  - feature
dependencies:
  - TASK-468
references:
  - docs/research/task-430-chatbot-architecture/README.md
  - docs/research/task-434-chatbot-integration-ui/README.md
  - >-
    mobile-design-mockups/chatbot_integration_ui/direction_f_composeur_persistant/code.html
  - mobile-design-mockups/my_design_system/DESIGN.md
modified_files:
  - mobile/src/components/chat/ChatHistoryList.tsx
  - mobile/src/components/chat/ChatSheet.tsx
  - mobile/src/components/chat/ChatDock.tsx
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
ordinal: 76000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

L'architecture du chat, décidée dans `docs/research/task-430-chatbot-architecture/README.md` (section **Owner Validation**, `Decision` du 2026-10-10, source de vérité), fixe au point 1 un « chat multi-tours à portée média et dossier, **avec historique retrouvable** ». L'intégration UI, décidée dans `docs/research/task-434-chatbot-integration-ui/README.md` (Owner Validation, `Decision`), est la direction F : un composeur persistant dans l'onglet Lecture d'un média et l'onglet Sources d'un dossier, qui s'ouvre en feuille de conversation (tâche précédente).

Cette tâche ajoute à cette feuille l'accès aux conversations passées de la **même portée** : un média ou un dossier a plusieurs conversations dans le temps — ne serait-ce que parce que la conversation pleine (plafond de tours) ou un changement des sources du dossier (instantané figé à l'ouverture, README task-430 §11.1) obligent à en ouvrir une nouvelle.

Maquettes de référence : `mobile-design-mockups/chatbot_integration_ui/direction_f_composeur_persistant/` (en-tête de feuille, état « conversation pleine » qui propose une conversation neuve). La maquette ne dessine pas de liste d'historique : la dessiner dans le langage de la feuille et du design system « Amber Clarity » (`mobile-design-mockups/my_design_system/DESIGN.md`), sans nouvel onglet ni nouvelle destination — ce que la décision UI exclut.

## Ce que la tâche livre

- Depuis la feuille : la liste des conversations de la portée courante (plus récentes d'abord, première question ou titre, date, nombre de tours, état du dernier tour), lue par `chatService` (route de liste par portée).
- Reprendre une conversation passée : son fil se recharge, et si une génération y est encore active, le contrôleur reprend son flux.
- Démarrer une nouvelle conversation sur la même portée, y compris depuis l'état « conversation pleine ».
- Supprimer une conversation, avec confirmation, par la route de suppression.
- i18n dans la même tâche : onze catalogues de `mobile/src/i18n/` et `pseudo.ts`. Accessibilité : rôles de liste et de bouton, cibles d'au moins 48 pt, thèmes clair et sombre par `ThemeContext`.

## Règles

Rien n'est déployé : pas de compatibilité. Pas de tests automatisés ; aucune suite Maestro en critère.

## Note à l'owner

Vérification visuelle sur appareil, sur un build de dev pointant l'API dev : plusieurs conversations sur un même média, reprise, suppression, nouvelle conversation après une conversation pleine.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 La feuille de chat donne accès à la liste des conversations de la portée courante, plus récentes d'abord, avec première question ou titre, date, nombre de tours et état du dernier tour
- [x] #2 Choisir une conversation passée recharge son fil et reprend le flux si une génération y est active
- [x] #3 Une nouvelle conversation peut être ouverte sur la même portée, y compris depuis l'état conversation pleine
- [x] #4 Une conversation peut être supprimée après confirmation par la route de suppression
- [x] #5 Aucun nouvel onglet ni nouvelle destination n'est ajouté ; les chaînes nouvelles existent dans les onze catalogues et pseudo.ts, et les cibles tactiles font au moins 48 pt
- [x] #6 npx tsc --noEmit et le lint du projet mobile passent
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Historique des conversations dans la feuille de chat, sans nouvel onglet ni nouvelle destination.

- Bouton « Conversations passées » dans l'en-tête de la feuille. La vue historique remplace le fil, avec un retour annoncé, et masque le composeur pendant ce temps.
- `ChatHistoryList` affiche la liste par portée via `ChatService.listConversations`, plus récentes d'abord, paginée (« Afficher plus », curseur). Chaque ligne donne la première question (ou « sans question »), la date, le nombre de questions (pluriel par `tCount`), l'état du dernier tour (en cours, répondue, échec, interrompue) et marque la conversation ouverte. Rôles liste et bouton, cibles ≥ 48 pt (ligne 56 pt).
- Choisir une ligne appelle `selectConversation` du `ChatSessionContext`, qui recharge le fil et reprend le flux si une génération est active. La suppression passe par une confirmation (`Alert`) puis `deleteConversation` ; si c'est la conversation ouverte, le contexte l'oublie.
- La nouvelle conversation sur la même portée reste disponible dans l'en-tête et dans l'action du refus `conversation_full` (task-468).
- 18 clés `chat.history.*` ajoutées aux onze catalogues (`pseudo.ts` les transforme automatiquement).

Vérifications : `npx tsc --noEmit` passe ; `npm run lint` donne 0 erreur (1 avertissement préexistant).

Note à l'owner : vérification sur un build de dev pointant l'API dev déployée (plusieurs conversations sur un même média, reprise, suppression, nouvelle conversation après une conversation pleine).
<!-- SECTION:FINAL_SUMMARY:END -->
