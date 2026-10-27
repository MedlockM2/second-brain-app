---
id: TASK-540
title: Rétablir Google natif Android avec Credential Manager et les sessions Cognito
status: Done
assignee:
  - '@codex'
created_date: '2026-10-26 17:17'
updated_date: '2026-10-26 17:24'
labels:
  - mobile
  - android
  - auth
dependencies: []
priority: high
ordinal: 147000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Le parcours Google Android ouvre actuellement la Hosted UI Cognito dans un navigateur. Le propriétaire demande le sélecteur de compte Android natif. Reprendre la décision et le module de task-325, en les raccordant aux sessions Cognito actuelles et à la liaison explicite des identités de task-529. Après intégration, un nouveau binaire Android et le déploiement API/configuration seront nécessaires pour la validation sur téléphone.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Les chemins de connexion et de liaison Google Android sont câblés vers Credential Manager sans appel au navigateur; les chemins des autres plateformes sont conservés.
- [x] #2 Le code serveur vérifie signature, émetteur, audience, expiration et nonce Google à usage unique avant émission de la session par Cognito.
- [x] #3 La résolution des comptes est fondée sur le sujet Google exact; la liaison exige la session du compte cible et les conflits de seule adresse sont refusés.
- [x] #4 Le module Android est autolinké, ses sources sont suivables, et les contrôles statiques applicables passent.
- [x] #5 La documentation indique la configuration Google, les étapes de livraison et la parité web native non applicable.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reprendre le module Credential Manager validé de task-325 et y ajouter un nonce serveur. 2. Brancher connexion et liaison Google Android sur des preuves vérifiées et le mécanisme de session Cognito existant. 3. Mettre à jour la configuration Terraform et les règles de méthodes de connexion. 4. Vérifier autolinking, TypeScript, lint, Python et Terraform sans ajouter de tests automatisés; documenter les étapes de livraison.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reprise du module et de la décision validés de task-325, sans nouvelle dépendance npm. Nonce serveur de dix minutes consommé atomiquement et lié au compte cible pour la liaison. Session Cognito partagée avec Apple via native_cognito.py. Les profils fédérés Google gardent leur sub et leur bibliothèque; le statut EXTERNAL_PROVIDER est confirmé avec un mot de passe technique inconnu après marquage social seul, car Cognito refuse InitiateAuth sur ce statut. Les méthodes et la récupération excluent ce mot de passe. Les correspondances de sujets sont supprimées avec le compte. Les erreurs natives conservent les méthodes proposées pour la liaison. Web: n/a (sélecteur système Android); les traductions des erreurs sont partagées.

Vérifications: typecheck et lint mobile et packages/core réussis; un avertissement préexistant any dans purchaseService.ts. Typecheck web réussi. Ruff sur media_summarizer et le trigger propre; mypy: 208 fichiers propres. Autolinking resolve: module présent pour Android, absent pour apple; git check-ignore ne masque pas la source Kotlin. terraform fmt, validate dev et plan dev passent. Plan: pool Cognito modifié sur place; le plan global comprend aussi des changements préexistants et la suppression du bucket summary_detailed (task-537), aucun apply effectué. Comparaison en mémoire: le client Web Google actuel est identique à celui de la configuration Credential Manager déjà validée sur téléphone dans task-325/165, sans recopier sa valeur. Relecture du diff et recherche de secrets propres.

Les AC décrivent les chemins livrés et la configuration vérifiable depuis le checkout, conformément à AGENTS.md. Aucune suite automatisée ajoutée ou lancée. Compilation Kotlin non exécutée sur ce poste sans SDK Android/JDK installé; API native reprise de la version précédemment livrée, ajout setNonce vérifié dans la documentation Google. Aucun déploiement, build EAS, push ni essai sur téléphone pendant cette intervention. LAUNCH PREREQUISITE: après intégration, déployer Terraform/API puis produire un nouveau binaire Android interne et vérifier les parcours sur téléphone; une OTA ne peut pas ajouter ce module.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Parcours Google Android câblé au sélecteur système Credential Manager pour connexion et liaison, preuves à usage unique validées côté serveur et sessions Cognito conservées. Vérifié par autolinking Android/Apple, TypeScript et lint mobile/core, typecheck web, Ruff, mypy et Terraform validate/plan. Livraison binaire/API et validation sur téléphone restent les étapes de lancement documentées; aucun déploiement effectué.
<!-- SECTION:FINAL_SUMMARY:END -->
