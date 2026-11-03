---
id: TASK-578
title: >-
  Remettre la page « Sur votre téléphone et votre ordinateur » dans l'intro
  mobile
status: Done
assignee: []
created_date: '2026-11-02 13:57'
updated_date: '2026-11-03 10:24'
labels:
  - mobile
  - onboarding
dependencies: []
references:
  - >-
    backlog/drafts/draft-2 -
    Appliquer-la-dernière-mise-à-jour-OTA-dès-la-première-connexion-sans-attente-au-démarrage.md
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

L'intro affichée une fois après la première connexion (`mobile/app/onboarding/intro.tsx`) avait deux pages : le partage depuis une autre app, puis « Sur votre téléphone et votre ordinateur » (illustration ordinateur + téléphone). Le 2026-11-01, l'owner a retiré la page 2 (commit `23adf23f`) : elle annonçait une app web que les testeurs ne peuvent pas encore ouvrir, puisque le web n'est pas publié. Cette tâche la remet.

**Remise avant la publication du web (owner, 2026-11-03)** : l'owner veut soumettre au plus vite un build qui contient à la fois cette page et DRAFT-2, sans attendre que le web soit en ligne. La page annonce donc l'app web avant qu'elle soit accessible : c'est un choix assumé, à ne pas contester. Le texte de la page 2 reste celui d'origine et ne cite aucune adresse web.

## Ce run réalise aussi DRAFT-2

L'agent de cette tâche réalise **aussi DRAFT-2**, dans le même run et la même branche : « Appliquer la dernière mise à jour OTA dès la première connexion, sans attente au démarrage » (`backlog/drafts/draft-2 - …`). Il lit DRAFT-2 en entier, satisfait ses critères d'acceptation et passe les deux tâches à Done. Raison (owner, 2026-11-03) : un seul build natif et une seule review pour les deux changements. DRAFT-2 reste en Draft et n'est jamais lancée seule : c'est cette tâche qui la porte.

## Ce qu'il faut remettre

Tout est dans l'historique git, au commit `6bbde721` (version à deux pages) :
- `mobile/app/onboarding/intro.tsx` : la page 2, le bouton « Suivant » sur la page 1 puis « C'est parti » sur la page 2, et les points de pagination (`PaginationDots`) **sous** le bouton. On n'avance qu'en touchant « Suivant » : pas de glissement au doigt, pas de retour, pas de « Passer » (décisions de l'owner, maquette `mobile-design-mockups/onboarding_apres_connexion`). L'illustration de la page 2 était agrandie (×1,12) pour descendre jusqu'au bouton.
- `EverywhereArt` dans `mobile/src/components/intro/IntroArt.tsx`, sans la légende « web app · app iOS et Android ».
- Les clés `intro.next`, `intro.everywhere.title` et `intro.everywhere.body` dans les 11 catalogues de `packages/core/src/i18n/` (textes d'origine dans le commit `6bbde721`).
- `mobile/.maestro/utils/finish_intro.yaml` : toucher `intro-next-button` puis `intro-start-button`.

## Note pour l'owner (pas un critère)

Après le merge, faire le build manuel décrit dans DRAFT-2 et le soumettre en review (iOS : ajouter le build au groupe externe depuis le site ; Play : nouvelle version Alpha). Après l'OTA, vérifier sur iPhone et Android, après une réinstallation : page 1, « Suivant », page 2, « C'est parti », Accueil. Les notes de review Apple et les instructions d'accès Play décrivent l'intro (« one-screen introduction… tap "Let's go" ») : les repasser à deux pages au même moment (`docs/store-listing/pre-beta-review.md`).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `mobile/app/onboarding/intro.tsx` affiche deux pages : partage, puis « Sur votre téléphone et votre ordinateur » ; « Suivant » sur la page 1, « C'est parti » sur la page 2, points de pagination sous le bouton, sans glissement ni retour
- [x] #2 `EverywhereArt` est de nouveau exporté par `mobile/src/components/intro/IntroArt.tsx`, sans légende
- [x] #3 Les clés `intro.next`, `intro.everywhere.title` et `intro.everywhere.body` existent dans les 11 catalogues de `packages/core/src/i18n/`
- [x] #4 `mobile/.maestro/utils/finish_intro.yaml` touche `intro-next-button` puis `intro-start-button`
- [x] #5 `npm run typecheck` et `npm run lint` passent dans `mobile/` et `packages/core`
- [x] #6 `docs/store-listing/pre-beta-review.md` décrit l'intro à deux pages dans les notes de review Apple et les instructions d'accès Play
- [x] #7 Les critères d'acceptation de DRAFT-2 sont satisfaits dans la même branche, et DRAFT-2 est cochée et passée à Done avec cette tâche
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
J'ai annulé le commit `23adf23f` (`git revert`), ce qui rend l'intro à deux pages telle qu'elle était au commit `6bbde721` :
- dans `intro.tsx` : « Suivant », puis « C'est parti », les points de pagination sous le bouton, et l'illustration de la page 2 à ×1,12 ;
- `EverywhereArt` ;
- les clés `intro.next` et `intro.everywhere.*` dans les 11 catalogues ;
- l'étape Next → Start de Maestro, modifiée mais pas lancée.

Le dessin de la feuille de partage dans le téléphone, ajouté par le commit `0ad4c0c4`, est conservé. Le commentaire de l'écran note que la page revient avant la publication du web, par choix de l'owner.

Les notes de review Apple et les instructions Play de `docs/store-listing/pre-beta-review.md` décrivent maintenant deux écrans, ainsi que le redémarrage possible après la connexion. Elles restent à recopier dans les consoles.

DRAFT-2 a été réalisée dans le même run. `npm run typecheck` et `npm run lint` passent dans `mobile/` et `packages/core`. Le seul avertissement restant existait déjà, dans `purchaseService.ts`. Mise en œuvre directe par Claude à la demande de l'owner, sans dispatch.
<!-- SECTION:FINAL_SUMMARY:END -->
