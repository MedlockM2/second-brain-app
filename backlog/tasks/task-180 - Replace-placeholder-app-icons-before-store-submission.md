---
id: task-180
title: Replace placeholder app icons before store submission
status: Done
assignee:
  - owner
created_date: '2026-06-10 13:48'
updated_date: '2026-10-30 14:42'
labels:
  - mobile
  - release
  - phase-5
  - blocker-store-submission
dependencies: []
priority: high
dispatchable: false
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Périmètre actuel — audit du 2026-10-30

Remplacer les trois placeholders SB par le logo Deepn dans mobile/assets/icon.png, adaptive-icon.png et splash.png. Livrables intégrés par 94459581 puis c2d7a94e (2026-10-26). La source graphique actuelle est web/public/favicon.svg ; mobile/scripts/make_icons.py produit les variantes mobiles et web.

L’ancien brief docs/store-listing/icon-and-graphics.md (directions A/B et mentions de placeholders) est historique et ne définit plus le dessin à livrer. Les contraintes de format iOS, transparence Android et protection des éléments essentiels du logo restent applicables. Le fond adaptatif est #ffcb05 ; le splash transparent se compose sur #fcf9f6.

La règle Android protège les éléments essentiels dans un cercle central de diamètre 66 dp sur un canevas de 108 dp ; elle ne constitue pas un contrôle exigeant zéro pixel d’anticrénelage à l’extérieur. Référence : https://developer.android.com/codelabs/basic-android-kotlin-compose-training-change-app-icon

La production des visuels était owner/designer ; cet audit ne les redessine pas. Les livraisons natives et fiches stores relèvent de task-449 et task-450, pas de cette clôture du travail dans le dépôt.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 mobile/assets/icon.png est un PNG RGB 1024×1024 sans alpha portant le logo Deepn intégré, dont la source est web/public/favicon.svg et le générateur mobile/scripts/make_icons.py
- [x] #2 mobile/assets/adaptive-icon.png est un PNG RGBA 1024×1024 dont les éléments essentiels du logo restent dans la zone de sécurité Android (cercle central de diamètre 66 dp sur un canevas de 108 dp)
- [x] #3 mobile/assets/splash.png est un PNG 1024×1024 cohérent avec backgroundColor #fcf9f6
- [x] #4 expo prebuild --clean termine sans erreur après remplacement des assets
- [x] #5 Aucune mention « SB » placeholder ne subsiste dans les visuels finaux
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Retrouver les livrables et les décisions graphiques intégrées.
2. Vérifier formats, configuration, prebuild et portée actuelle des recommandations Android.
3. Corriger les critères périmés et documenter la clôture sans changer les assets.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-30 — Audit demandé par l’owner : le statut To Do est périmé, les trois placeholders ont été remplacés. Commit 94459581 puis c2d7a94e (2026-10-26) ; génération reproductible par mobile/scripts/make_icons.py à partir de web/public/favicon.svg. Inspection visuelle des trois PNG : logo Deepn, aucune lettre SB. Pillow confirme icon.png RGB 1024×1024 sans alpha ; adaptive-icon.png RGBA 1024×1024 ; splash.png RGBA 1024×1024, transparent autour du disque ambre, composé sur #fcf9f6 par la configuration Expo. Le fond adaptatif Android est désormais #ffcb05, conformément au générateur, et non le fond blanc cassé de la description historique.

Vérification locale : expo prebuild --clean --no-install sort 0 pour iOS et Android dans une copie temporaire du HEAD avec les dépendances existantes ; aucun projet natif du workspace modifié, aucun build ni déploiement. AC #3, #4 et #5 vérifiés. AC #1 laissé non coché : format iOS conforme, mais docs/store-listing/icon-and-graphics.md décrit toujours des placeholders et des directions graphiques anciennes ; la conformité intégrale à cette spec ne peut pas être attestée. AC #2 laissé non coché : le rayon maximal des pixels non transparents est 314,12 px pour une safe zone 66/108 de rayon 312,89 px à 1024 px ; 29 pixels d’anticrénelage dépassent, dont aucun totalement opaque. Dépassement minime de 1,23 px, à corriger pour une conformité stricte. Aucun asset modifié pendant cet audit. Statut In Progress : livrables intégrés, clôture stricte non encore justifiée.

2026-10-30 — Réexamen de validité demandé par l’owner, qui remplace la conclusion trop stricte de l’audit précédent. AC #1 : formats toujours pertinents et satisfaits ; rattacher le dessin aux directions A/B d’un ancien brief est périmé depuis le logo intégré en octobre. Le critère référence désormais la source graphique effectivement utilisée. AC #2 : la zone de sécurité reste pertinente, mais le codelab officiel Android demande que les informations essentielles y restent et autorise du contenu non essentiel à l’extérieur. Le contrôle zéro pixel semi-transparent hors cercle était une interprétation excessive, pas une exigence de la tâche ni un motif de refus store démontré. Tous les pixels totalement opaques de la source restent dans le cercle. Les cinq tailles générées par prebuild (108, 162, 216, 324, 432 px) conservent également leurs pixels opaques dans le cercle ; seuls quelques pixels de bord semi-transparents dépassent. Les éléments essentiels sont préservés. AC #2 précisé et satisfait ; aucune réduction de logo nécessaire. Référence : https://developer.android.com/codelabs/basic-android-kotlin-compose-training-change-app-icon, section Launcher Icons / safe zone.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Les trois placeholders sont remplacés par le logo Deepn ; formats vérifiés et prebuild iOS/Android réussi en copie isolée. Le brief graphique historique et l’interprétation excessivement stricte de la zone de sécurité ont été corrigés dans la tâche. Les éléments essentiels du logo sont protégés ; aucune modification d’asset requise. Clôture du livrable dans le dépôt, sans build distant ni déploiement.
<!-- SECTION:FINAL_SUMMARY:END -->
