---
id: TASK-580
title: >-
  Garder les sections de l’Accueil en haut lorsqu’une revue des non classés est
  présente
status: Done
assignee:
  - codex
created_date: '2026-11-03 13:53'
updated_date: '2026-11-03 13:55'
labels:
  - mobile
  - testflight
dependencies: []
references:
  - docs/testflight-feedback-log.md
modified_files:
  - mobile/app/(tabs)/inbox.tsx
  - mobile/src/constants/homeRhythm.ts
  - docs/testflight-feedback-log.md
priority: medium
type: bug
ordinal: 184000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Feedback TestFlight AMZL5AOuEvnOpek_vH5LWIQ, reçu le 3 novembre 2026 sur le build iOS 24 (iPhone 11, 414 × 896 pt). Lorsque la revue des non classés et les ajouts récents sont visibles sans apprentissage en cours, ces deux sections se retrouvent centrées au milieu de l’écran. Le propriétaire demande la même cohérence visuelle qu’avec les trois sections. Le centrage précédemment validé pour un Accueil sans revue des non classés reste à conserver. Le web suit une disposition de bureau distincte, sans cette carte et déjà alignée en haut. Validation visuelle iPhone/Android après distribution : deux puis trois sections, écran étroit et grands caractères.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le placement des sections mobiles avec une revue des non classés est ancré en haut indépendamment de la présence de la section d’apprentissage.
- [x] #2 Le centrage de l’Accueil sans revue des non classés reste explicite, après résolution du compteur ; les espaces réservés au chargement suivent la disposition avec revue.
- [x] #3 Le rythme entre sections, la réserve des boutons flottants et le défilement du contenu sont conservés ; typecheck et lint mobile passent sans nouvelle erreur.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Limiter le centrage vertical de la colonne aux comptes dont le compteur des non classés est chargé et nul ; garder l’ancrage en haut pendant le chargement du compteur et dès qu’une revue est présente. Ne pas conditionner la disposition à la présence des engagements.
2. Conserver flexGrow, HOME_BLOCK_GAP, le padding réservé aux boutons, les placeholders et les contrôles de défilement ; actualiser les commentaires du layout et du rythme.
3. Vérifier typecheck et lint mobile, ainsi que l’export iOS/Android si l’environnement le permet. Aucun test automatisé ajouté. Relire le diff et les identifiants sensibles.
4. Consigner le diagnostic et la validation dans le registre TestFlight et la tâche, committer avec Feedback-Id et Web: n/a (rendu natif de l’Accueil ; le bureau est déjà aligné en haut), puis fusionner localement sur main selon la demande du propriétaire. Pas de push ni de distribution.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Diagnostic : capture TestFlight inspectée (build 24, 414 × 896 pt), un seul nouveau retour parmi 17 collectés sur les deux dernières semaines. Le commit b183c3db centrait tous les états de l’Accueil alors que son cas validé était l’absence de revue. La colonne est maintenant flex-start par défaut ; scrollContentCentered ne s’applique qu’après hasLoadedUnsortedCount et unsortedCount === 0. La présence des engagements n’intervient pas dans cette condition. Les placeholders restent ancrés en haut en attendant le compteur.

Vérifications locales : npm run typecheck --workspace mobile et npm run lint --workspace mobile terminent à 0 ; seul warning existant purchaseService.ts:136 (comparé au main inchangé). Exports Expo Hermes iOS et Android terminés à 0 dans /tmp, aucune distribution. Le premier lint du worktree manquait la dépendance déjà installée sous mobile/node_modules ; les liens locaux aux dépendances du checkout principal ont permis de relancer la commande standard, sans changer les dépendances. git diff --check passe. Revue du diff : HOME_BLOCK_GAP, flexGrow, réserve des boutons, contrôles de défilement et placeholders conservés. Aucune garde de plateforme ni test automatisé ajouté.

Parité : web/src/pages/HomePage.tsx et web/src/styles.css inspectés ; disposition desktop sans carte de revue et déjà ancrée en haut. Aucun changement web nécessaire pour ce rendu natif. Validation visuelle iPhone/Android non effectuée ; elle reste à faire après distribution OTA. Le propriétaire a explicitement demandé le commit et la fusion locale sur main, sans demande de push ou de distribution.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
L’Accueil mobile conserve désormais la revue des non classés et les ajouts récents en haut, que l’apprentissage soit présent ou absent. Le centrage antérieurement validé reste réservé à un compteur des non classés chargé et nul ; le chargement garde l’alignement du futur deck. Les commentaires de rythme et le registre TestFlight expliquent cette distinction.

Validation : typecheck et lint mobile, exports Hermes iOS/Android et git diff --check réussis. Warning lint préexistant uniquement. Changement partagé iOS/Android, sans impact sur la disposition desktop. Rendu appareil restant à vérifier après OTA ; aucun push ni distribution réalisé.
<!-- SECTION:FINAL_SUMMARY:END -->
