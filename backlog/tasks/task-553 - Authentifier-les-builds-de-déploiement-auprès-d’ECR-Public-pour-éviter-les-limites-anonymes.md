---
id: TASK-553
title: >-
  Authentifier les builds de déploiement auprès d’ECR Public pour éviter les
  limites anonymes
status: Done
assignee:
  - '@codex'
created_date: '2026-10-27 08:42'
updated_date: '2026-10-27 08:49'
labels:
  - tooling
  - ci
  - infrastructure
dependencies: []
priority: high
type: bug
ordinal: 159000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Le build chat streaming échoue à deux reprises sur un 429 Data limit exceeded pendant le téléchargement de Lambda Web Adapter depuis ECR Public. Le déploiement possède une connexion ECR privée mais aucune authentification publique. Conserver les images et versions actuelles ; ajouter la connexion AWS documentée et les permissions minimales gérées par Terraform. Vérification après push : suivre les workflows dev, sans changement de production.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le rôle de déploiement dev autorise les deux opérations de jeton requises par ECR Public, sans droit de publication publique.
- [x] #2 Les jobs de construction authentifient Docker auprès d’ECR Public avant de construire et conservent les versions épinglées et le registre privé de destination.
- [x] #3 Le formatage Terraform et les validations locales applicables passent ; les sources AWS et les étapes de livraison sont documentées.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Ajouter les permissions de jeton ECR Public au rôle dev de build. 2. Authentifier Docker en us-east-1 avant les builds, en conservant la région des déploiements. 3. Valider Terraform et le YAML, pousser les permissions puis le workflow pour respecter leur dépendance et suivre le déploiement.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Sources officielles consultées le 27 octobre 2026 : https://docs.aws.amazon.com/AmazonECR/latest/public/public-registry-auth.html et https://github.com/aws-actions/amazon-ecr-login (ECR Public). ECR Public requiert ecr-public:GetAuthorizationToken et sts:GetServiceBearerToken ; la connexion est régionale us-east-1. Permissions ajoutées au rôle dev uniquement, sans droit de publication publique, puis appliquées avec succès par Terraform Dev. Connexion publique ajoutée dans les trois jobs de build, séparée du registre privé et sans changer les versions des images. YAML analysé avec le parseur du workspace, ordre des étapes vérifié, terraform fmt -check et validate dev passent. Aucun test automatisé ajouté. Blocage additionnel du plan résolu : bucket summary_detailed obsolète, sans lecteur runtime, compte et tag dev vérifiés ; quatre versions de fixtures supprimées, bucket vidé puis suppression par Terraform. Aucun identifiant de requête ni contenu objet enregistré.

Livraison vérifiée le 27 octobre 2026 : Terraform Dev a terminé avec succès après suppression du bucket obsolète et application des permissions. Le workflow Deploy Lambda Functions du commit 99053146 a réussi pour deploy-api, deploy-workers, deploy-chat-stream et release-validation. Les trois étapes de connexion publique et les téléchargements des images ont réussi ; les fonctions sont mises à jour et le contrôle de santé API est vert. Main Branch Checks est vert sur le même commit. Aucun changement de production.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Authentification ECR Public ajoutée aux trois builds dev avec les seules permissions de jeton nécessaires ; région de connexion isolée en us-east-1. Formatage Terraform corrigé et ancien bucket summary_detailed vidé pour permettre sa suppression prévue. Terraform Dev, CI et déploiement API/workers/chat-stream avec contrôle de santé ont tous réussi.
<!-- SECTION:FINAL_SUMMARY:END -->
