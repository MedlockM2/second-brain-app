---
id: DRAFT-1
title: >-
  Remettre la page « Sur votre téléphone et votre ordinateur » dans l'intro
  mobile une fois l'app web publiée
status: Draft
assignee: []
created_date: '2026-11-02 13:57'
labels:
  - mobile
  - onboarding
dependencies: []
references:
  - backlog/drafts/draft-2
  - mobile/app/onboarding/intro.tsx
  - mobile/src/components/intro/IntroArt.tsx
  - mobile-design-mockups/onboarding_apres_connexion/README.md
  - docs/store-listing/pre-beta-review.md
priority: medium
type: enhancement
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

L'intro affichée une fois après la première connexion (`mobile/app/onboarding/intro.tsx`) avait deux pages : le partage depuis une autre app, puis « Sur votre téléphone et votre ordinateur » (illustration ordinateur + téléphone). Le 2026-11-01, l'owner a retiré la page 2 (commit `23adf23f`) : elle annonçait une app web que les testeurs ne peuvent pas encore ouvrir, puisque le web n'est pas publié. Cette tâche la remet **quand l'app web sera publiée** et accessible aux testeurs.

**Statut Draft volontaire** : à passer en To Do seulement le jour où l'app web est en ligne, sinon la page promettrait de nouveau quelque chose d'inaccessible.

## Ce run réalise aussi DRAFT-2

L'agent de cette tâche réalise **aussi DRAFT-2**, dans le même run et la même branche : « Appliquer la dernière mise à jour OTA dès la première connexion, sans attente au démarrage » (`backlog/drafts/draft-2 - …`). Il lit DRAFT-2 en entier, satisfait ses critères d'acceptation et passe les deux tâches à Done. Raison (owner, 2026-11-03) : un seul build natif et une seule review pour les deux changements. DRAFT-2 n'est jamais dispatchée seule : pour lancer le travail, passer seulement DRAFT-1 en To Do.

## Ce qu'il faut remettre

Tout est dans l'historique git, au commit `6bbde721` (version à deux pages) :
- `mobile/app/onboarding/intro.tsx` : la page 2, le bouton « Suivant » sur la page 1 puis « C'est parti » sur la page 2, et les points de pagination (`PaginationDots`) **sous** le bouton. On n'avance qu'en touchant « Suivant » : pas de glissement au doigt, pas de retour, pas de « Passer » (décisions de l'owner, maquette `mobile-design-mockups/onboarding_apres_connexion`). L'illustration de la page 2 était agrandie (×1,12) pour descendre jusqu'au bouton.
- `EverywhereArt` dans `mobile/src/components/intro/IntroArt.tsx`, sans la légende « web app · app iOS et Android ».
- Les clés `intro.next`, `intro.everywhere.title` et `intro.everywhere.body` dans les 11 catalogues de `packages/core/src/i18n/` (textes d'origine dans le commit `6bbde721`).
- `mobile/.maestro/utils/finish_intro.yaml` : toucher `intro-next-button` puis `intro-start-button`.

Le texte de la page 2 peut alors citer l'adresse réelle de l'app web, si l'owner le souhaite.

## Note pour l'owner (pas un critère)

Après l'OTA, vérifier sur iPhone et Android, après une réinstallation : page 1, « Suivant », page 2, « C'est parti », Accueil. Les notes de review Apple et les instructions d'accès Play décrivent l'intro (« one-screen introduction… tap "Let's go" ») : les repasser à deux pages au même moment (`docs/store-listing/pre-beta-review.md`).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `mobile/app/onboarding/intro.tsx` affiche deux pages : partage, puis « Sur votre téléphone et votre ordinateur » ; « Suivant » sur la page 1, « C'est parti » sur la page 2, points de pagination sous le bouton, sans glissement ni retour
- [ ] #2 `EverywhereArt` est de nouveau exporté par `mobile/src/components/intro/IntroArt.tsx`, sans légende
- [ ] #3 Les clés `intro.next`, `intro.everywhere.title` et `intro.everywhere.body` existent dans les 11 catalogues de `packages/core/src/i18n/`
- [ ] #4 `mobile/.maestro/utils/finish_intro.yaml` touche `intro-next-button` puis `intro-start-button`
- [ ] #5 `npm run typecheck` et `npm run lint` passent dans `mobile/` et `packages/core`
- [ ] #6 `docs/store-listing/pre-beta-review.md` décrit l'intro à deux pages dans les notes de review Apple et les instructions d'accès Play
- [ ] #7 Les critères d'acceptation de DRAFT-2 sont satisfaits dans la même branche, et DRAFT-2 est cochée et passée à Done avec cette tâche
<!-- AC:END -->
