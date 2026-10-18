---
id: TASK-527
title: Rétablir Sign in with Apple natif sur iOS avec une session Cognito
status: Done
assignee:
  - codex
created_date: '2026-10-18 13:11'
updated_date: '2026-10-18 14:49'
labels: []
dependencies: []
references:
  - >-
    https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-challenge.html
  - 'https://docs.expo.dev/versions/v55.0.0/sdk/apple-authentication/'
documentation:
  - docs/AUTHENTICATION_SETUP.md
priority: high
type: bug
ordinal: 134000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Le feedback TestFlight du 18 octobre 2026 sur le build iOS 15 signale une régression après la migration Cognito : autorisation de navigation, navigateur intermédiaire et connexion Apple qui échoue. Le propriétaire demande de retrouver directement la feuille Apple iOS tout en conservant Cognito pour les sessions. Il a validé le raccordement par authentification personnalisée. Le web et Android conservent un parcours navigateur adapté à leur plateforme. Vérification finale sur appareil et publication du nouveau binaire à distinguer des critères locaux.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Sur iOS, le bouton Apple utilise la feuille native et gère l’annulation sans erreur ni ouverture de navigateur.
- [x] #2 Le serveur vérifie la preuve Apple et ouvre une session Cognito sans fusion automatique par adresse e-mail ni réutilisation possible de la preuve de connexion.
- [ ] #3 Les comptes Apple restent identifiés par leur sujet fournisseur et les parcours navigateur web/Android retrouvent le même compte.
- [x] #4 La configuration native, les permissions et les triggers Cognito nécessaires sont définis dans le dépôt, et la documentation explique la publication et les limites de validation.
- [x] #5 Les vérifications statiques Python, mobile et Terraform pertinentes passent, sans ajout de tests automatisés.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Restaurer expo-apple-authentication et la capacité Apple iOS ; utiliser le bouton système et nonce/state, avec annulation silencieuse. Google et Apple Android/web gardent le parcours navigateur.
2. Ajouter /api/auth/apple/native : vérifier JWT Apple (signature/issuer/audience native/expiration/nonce/email vérifié), échanger le code Apple à usage unique et comparer les identités. Réutiliser les secrets Apple du coffre.
3. Résoudre le compte par sujet Apple, jamais par seule adresse : réutiliser un profil fédéré existant ou créer un profil natif avec attribut Apple administrateur. Refuser une collision e-mail sans rattachement implicite. Une table dédiée conserve la correspondance sujet→username et des autorisations éphémères à usage unique.
4. Ouvrir CUSTOM_AUTH avec un grant aléatoire consommé atomiquement et lié au username, au client mobile et au challenge Cognito. Triggers zip Python stdlib/boto3 déployés par Terraform, sans secret supplémentaire. Le trigger PreSignUp rattache une future fédération web/Android uniquement au même sujet Apple exact. Exclure les profils Apple natifs de la récupération de mot de passe.
5. Déclarer IAM minimal, attribut et configuration native/Terraform ; documenter les parcours, l’absence de fusion par email, le nouveau binaire requis et la validation sur appareil. Vérifications statiques uniquement, revue du diff pour secrets et commit avec mention Web.

Précision AWS vérifiée : custom:apple_subject doit être mutable dans le schéma pour permettre AdminLinkProviderForUser ; son écriture reste exclusivement administrateur, jamais autorisée aux clients publics. La mutabilité ne donne aucun droit supplémentaire au client.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implémentation native et raccordement Cognito réalisés dans le worktree isolé. Vérifications TypeScript mobile/core/web vertes, lint mobile sans erreur (un avertissement préexistant dans purchaseService), lint core vert, ruff et mypy backend verts. Aucun test automatisé ajouté ou exécuté. Le code Swift Expo transmet nonce/state tels quels à la requête Apple.

Terraform validate et fmt passent. Plan dev contre le state réel : 7 créations, 4 modifications, aucune destruction ni recréation du pool. Seule l’API reçoit les deux nouvelles variables natives ; les workers restent inchangés. Introspection Expo iOS : usesAppleSignIn=true, plugin présent, entitlement com.apple.developer.applesignin=[Default]. Build web et typechecks mobile/core/web passent. Lint core passe ; lint mobile n’ajoute aucun avertissement. Revue de sécurité : nonce/state, signature/audience Apple, code consommé une seule fois, grants hachés et liés à la session Cognito, aucun rattachement par simple email. Les AC 1 et 3 restent à confirmer sur appareil avec le compte Apple du propriétaire ; aucun login Apple E2E n’est revendiqué.

Publication autorisée dans la conversation : commit ef3a4b82 intégré et poussé sur main. Terraform Dev, Main Branch Checks, Deploy Lambda Functions et Mobile OTA or Build ont tous terminé avec succès. Hooks Cognito déployés, CUSTOM_AUTH activé uniquement sur mobile ; custom:apple_subject non modifiable par les clients publics. API réelle : santé 200, nouvelle route présente dans OpenAPI, preuve Apple invalide refusée en 401 AUTH_APPLE_INVALID. Build iOS 16 terminé et soumission EAS iOS terminée ; traitement App Store Connect en attente au dernier relevé. Build Android 20 en compilation. Aucune connexion Apple réelle revendiquée. Ajustement final du contraste du spinner Apple natif vérifié par typecheck/lint ; publication OTA prévue après achèvement des builds pour éviter un second binaire inutile.

Publication terminée : iOS 16 (EAS e45a6758-cd34-47ce-904b-886c43b120ea) et Android 20 (EAS 2ce32a3e-b7a4-48c8-97b3-89e13ac3aa7d) compilés, soumissions EAS toutes deux FINISHED. App Store Connect expose le build 16, version 1.0.0, processing_state VALID. Ajustement du spinner livré par commit 0f2b1c61 ; Main Branch Checks et Mobile OTA or Build terminés avec succès (runs 39132179519 et 39132179521). Feedback ajouté au registre de déduplication. AC 1 et 3 laissés non cochés : connexion Apple et identité interplateforme nécessitent la validation du propriétaire sur appareil avec son compte, non reproductibles par vérification statique. Le callback Apple Services ID du parcours web/Android reste le point de configuration propriétaire déjà documenté dans task-526 ; le parcours natif iOS n’en dépend pas.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Restaure la feuille Apple et le bouton système sur iOS, avec annulation silencieuse. Le serveur valide et consomme la preuve Apple puis ouvre une session Cognito CUSTOM_AUTH avec autorisation liée au challenge et consommée atomiquement. Identité basée sur le sujet Apple et rattachement du parcours web/Android au même sujet ; collision email refusée sans fusion implicite. Infrastructure Terraform, capacité native, messages traduits et documentation sont livrés. Vérifications statiques et plan dev valides ; connexion Apple réelle et passage interplateforme restent à valider sur le nouveau binaire.

Déployé sur AWS dev, publié en build TestFlight 16 et build Android interne 20, puis OTA du dernier ajustement de contraste. CI backend/mobile/Terraform/parité et publication OTA vertes. Le serveur refuse une preuve invalide en 401. Aucun test automatisé ajouté ou exécuté ; la connexion Apple réelle et le passage web/mobile restent à confirmer par le propriétaire (AC 1 et 3 non cochés).
<!-- SECTION:FINAL_SUMMARY:END -->
