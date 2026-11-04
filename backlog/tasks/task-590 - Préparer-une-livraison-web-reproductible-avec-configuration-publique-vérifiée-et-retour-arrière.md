---
id: TASK-590
title: >-
  Préparer une livraison web reproductible avec configuration publique vérifiée
  et retour arrière
status: Done
assignee:
  - '@codex'
created_date: '2026-11-04 19:11'
updated_date: '2026-11-04 22:49'
labels:
  - web
  - v1-launch
  - agent
dependencies: []
references:
  - web/src/config.ts
  - web/.env.example
  - web/vite.config.ts
  - web/src/pages/InstallPage.tsx
  - web/README.md
  - extension/README.md
priority: high
type: chore
ordinal: 193000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Responsabilité : agent — code/configuration/documentation et contrôles statiques dans son worktree. Aucun merge, push, déploiement, publication ou validation propriétaire demandé par les critères.

Le build web est manuel et les VITE_* sont figées à la compilation. Au 2026-11-04, API et streaming sont renseignés localement ; liens des stores, site, feedback de secours et IDs d’extension sont vides. Config.ts ne refuse l’absence d’API qu’au démarrage dans le navigateur : un build réussi ne prouve donc pas qu’un paquet est distribuable. Préparer le mécanisme de livraison et le runbook sans acheter de domaine, choisir les URLs de bêta ni publier. TASK-471 porte les ressources AWS, TASK-472 le site public ; ne pas les recréer. Distinguer paramètres nécessaires à l’usage web, liens de distribution et options à comportement explicite : le code de secours d’extension et le repli chat existant ne sont pas des valeurs de domaine fictives.

Contraintes : aucun nouveau test automatisé. Ne pas modifier le sync Spotify, la livraison email, la génération des quiz, Whisper ni la facturation à crédits. Aucun secret, identité de compte ou compte reviewer dans les fichiers suivis. Les contrats restent sous /api/media et /api/artifacts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Les paramètres publics du paquet web sont vérifiés avant sa distribution ; une API absente ou une configuration obligatoire incohérente n’aboutit pas à un paquet annoncé prêt qui échoue au premier écran.
- [x] #2 La documentation recense API, streaming, site, liens bêta iOS/Android, feedback et IDs Chrome/Edge, leur provenance et le comportement prévu lorsqu’un paramètre optionnel est absent ; aucun secret ne voyage dans VITE_*.
- [x] #3 Une procédure reproductible décrit build par environnement, vérification du paquet, dépôt S3, invalidation CloudFront, politique de cache et retour à un paquet identifié ; l’exécution distante est réservée au propriétaire.
- [x] #4 Typecheck, lint et build web passent avec une configuration publique de validation explicite ; la procédure n’exige ni domaine acquis ni accès prod pour livrer le code.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Valider les VITE_* connus lors des builds Vite : API obligatoire, URL publiques cohérentes, HTTPS pour la distribution et IDs Chromium valides ; garder ci comme mode de compilation explicitement non distribuable.
2. Produire un manifeste public déterministe identifiant environnement, révision, configuration et empreinte de chaque fichier ; ajouter un vérificateur opérationnel du paquet qui refuse les builds ci.
3. Documenter provenance et absence des options, préparation par environnement, archive identifiée, dépôt S3 avec index non caché/assets immuables, invalidation et rollback sans effacer les anciens assets. Les commandes distantes restent à exécuter par le propriétaire.
4. Exécuter typecheck/lint/build ci et vérifier que le paquet de compilation est identifié comme non distribuable ; aucune publication ni test automatisé ajouté.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Typecheck/lint/build web en mode ci réussis ; lint couvre aussi la configuration et le code de build. Le vérificateur du paquet contrôle tous les fichiers générés et copiés depuis public/. Appels directs de validation : API vide => build refusé (code 1) ; paquet ci sans option compilation => distribution refusée (code 1) ; vérification explicitement compilation-only => succès. Vérification de syntaxe Node et diff --check propres. Aucun appel AWS, API ou publication et aucun test automatisé ajouté.

Le runbook décrit valeurs optionnelles et repli existant, archive liée au manifeste, dépôt des assets immuables avant l’index no-store, conservation des anciens assets, invalidation et restauration d’une archive identifiée. Les outputs app_bucket_name/app_distribution_id seront livrés par TASK-471 ; aucune ressource AWS dupliquée.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Valide la configuration publique avant chaque build et distingue les compilations ci des paquets distribuables. Chaque paquet reçoit une identité liée à sa configuration, sa révision et ses fichiers ; un vérificateur opérationnel contrôle son intégrité. Le runbook décrit provenance, déploiement propriétaire et retour arrière. Contrôles locaux réussis, aucune action distante.
<!-- SECTION:FINAL_SUMMARY:END -->
