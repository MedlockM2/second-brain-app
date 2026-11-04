---
id: TASK-589
title: Compléter et centraliser les liens légaux de la web app
status: Done
assignee:
  - '@codex'
created_date: '2026-11-04 19:11'
updated_date: '2026-11-04 22:46'
labels:
  - web
  - v1-launch
  - agent
dependencies: []
references:
  - web/src/pages/AuthPage.tsx
  - web/src/pages/AccountPage.tsx
  - mobile/src/constants/legal.ts
  - docs/research/task-357-legal-pages-hosting/README.md
priority: high
type: bug
ordinal: 192000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Responsabilité : agent — code/configuration/documentation et contrôles statiques dans son worktree. Aucun merge, push, déploiement, publication ou validation propriétaire demandé par les critères.

Audit du 2026-11-04 : AuthPage.tsx contient une URL de confidentialité écrite en dur, visible uniquement à l’inscription ; la connexion et Mon compte n’offrent pas ces liens et aucun lien Terms n’est branché. TASK-358 couvre déjà le mobile : cette tâche porte son pendant web, sans doubler la publication de TASK-444. Lire la Decision et l’amendement du 2026-10-30 du README de TASK-357 : confidentialité sur le CloudFront dev actuellement publié et Terms vers l’EULA standard Apple pour la bêta. Ne pas inventer une page /terms ni attendre le domaine pour câbler les points d’entrée. La bascule des valeurs finales appartient à la mise en service propriétaire.

Contraintes : aucun nouveau test automatisé. Ne pas modifier le sync Spotify, la livraison email, la génération des quiz, Whisper ni la facturation à crédits. Aucun secret, identité de compte ou compte reviewer dans les fichiers suivis. Les contrats restent sous /api/media et /api/artifacts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Confidentialité et conditions sont accessibles depuis connexion, inscription et Mon compte sur le web, avec les libellés des catalogues existants.
- [x] #2 Les URLs légales proviennent d’une source centralisée et respectent la décision bêta de TASK-357 ; aucune copie d’URL locale à un écran ni domaine tiers présenté comme possédé ne subsiste.
- [x] #3 La relation avec la source mobile de TASK-358 et la procédure de bascule au domaine sont documentées ; tout module partagé respecte les interdictions de plateforme de packages/core.
- [x] #4 Typecheck, lint et build web passent ; les contrôles mobile et core sont consignés si leurs fichiers sont modifiés.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Placer les deux URL légales neutres dans packages/core/constants/legal et les réexporter depuis la source mobile existante, sans déplacer les constantes de plateforme.
2. Ajouter un composant web commun de liens légaux utilisant les libellés existants, visible à la connexion, à l’inscription et dans Mon compte.
3. Documenter la décision bêta et la bascule unique au domaine après publication réelle de la page, coordonnée avec TASK-358/TASK-444.
4. Exécuter typecheck/lint web, mobile et core, ainsi que build web ; indiquer Web: done au commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Typecheck/lint/build web, typecheck/lint mobile et typecheck/lint core réussis. Seul avertissement mobile préexistant : no-explicit-any dans purchaseService.ts, non modifié. Revue des points d’entrée : LegalLinks est présent dans AuthPage pour les deux modes et dans la navigation de Mon compte ; les libellés paywall.privacy/paywall.terms existants sont réutilisés. Une seule définition des deux URL dans core ; la source mobile les réexporte, sans déplacer ses constantes Platform. Aucune recette navigateur ou publication revendiquée.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Expose confidentialité et conditions sur la connexion, l’inscription et Mon compte. Les URL décidées pour la bêta sont désormais partagées avec le mobile dans un module neutre de core. La documentation décrit la bascule au domaine et sa coordination avec les tâches propriétaire. Vérifications web/mobile/core réussies.
<!-- SECTION:FINAL_SUMMARY:END -->
