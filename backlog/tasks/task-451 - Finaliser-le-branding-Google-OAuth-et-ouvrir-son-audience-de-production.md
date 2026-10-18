---
id: TASK-451
title: Finaliser le branding Google OAuth et ouvrir son audience de production
status: To Do
assignee:
  - owner
created_date: '2026-10-10 15:13'
labels:
  - v1-launch
  - release
  - owner-only
dependencies:
  - TASK-186
  - TASK-443
documentation:
  - docs/V1_LAUNCH_PLAN.md
priority: high
ordinal: 58000
dispatchable: false
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Responsabilité

Owner — approuver l’identité publique et publier l’audience dans Google Auth Platform.

## Contexte et périmètre

Phase 10 : le nom choisi est Deepn ; le branding OAuth et le mode Test ne sont pas automatiquement mis à jour par le rebrand mobile. Vérifier les scopes réellement demandés, les domaines/URLs et le statut des clients existants. Publier l’audience au moment approprié avant l’ouverture publique. Si les exigences courantes imposent une vérification, la suivre ; ne pas supposer que la publication est immédiate à partir du texte ancien du plan.

Source : docs/V1_LAUNCH_PLAN.md, checklist de lancement réconciliée le 2026-10-10. Le plan contient des états de septembre périmés : vérifier les faits avant toute action. Ne pas recréer les fonctionnalités déjà couvertes par les tâches produit. Aucun nouveau test automatisé demandé. Aucun secret, email de compte, identifiant de support, compte reviewer ou donnée personnelle dans les fichiers suivis.

Exécution owner-only : cette tâche inclut une décision, des appareils physiques, une publication ou une opération de release hors du worktree ; dispatchable: false. Les critères portent sur le compte rendu et les décisions documentées, pas sur un déploiement qu’un agent devrait réaliser depuis sa branche.

## Vérification de marque Google (ajout du 2026-10-18)

Feedback TestFlight `AA8bmF16TZrm0st12jdmNGM` : la page Google de connexion affiche « Accéder à l’application deepn-…amazoncognito.com ». Google montre l’hôte du retour OAuth tant que la marque n’est pas vérifiée ; une fois la marque vérifiée, la page affiche le nom Deepn et son logo. TASK-528 (Cognito sur `auth.<domaine>`) remplace déjà cet hôte par le domaine Deepn ; cette vérification remplace le domaine par le nom.

Démarches owner dans Google Cloud, projet du client OAuth Web utilisé par Cognito, « Google Auth Platform » > « Branding » :
- Prouver la propriété du domaine dans Google Search Console (enregistrement DNS TXT), avec un compte propriétaire du projet Google Cloud. Faisable dès l’achat (TASK-443).
- Déclarer le domaine dans « Authorized domains ».
- Renseigner le nom « Deepn », le logo, l’e-mail de support, la page d’accueil et la politique de confidentialité, hébergées sur ce domaine. La page d’accueil doit décrire l’app et renvoyer vers la politique de confidentialité.
- Publier l’audience (« In production ») puis soumettre la marque à vérification. Les scopes demandés par Cognito (`openid email profile`) ne sont pas sensibles : seule la vérification de marque s’applique, pas l’audit de sécurité.

La soumission ne peut aboutir qu’une fois la page d’accueil et la politique de confidentialité en ligne sur le domaine (TASK-444, TASK-472). Consigner la date de soumission et l’issue, sans identité de compte.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le branding, les contacts publics et les domaines/URLs autorisés retenus sont consignés sans identité de login privée.
- [ ] #2 Les scopes réellement utilisés et les éventuelles exigences de vérification affichées sont documentés.
- [ ] #3 Le compte rendu décrit le statut de publication et le résultat d’une connexion avec un compte hors liste de test, sans identifier ce compte.
- [ ] #4 La propriété du domaine est prouvée dans Google Search Console, le domaine figure dans les « Authorized domains », et la marque Deepn est soumise à vérification ; date de soumission et issue consignées sans identité de compte.
<!-- AC:END -->
