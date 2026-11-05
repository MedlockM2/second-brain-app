---
id: TASK-597
title: Contrôler l’extension Chromium et Firefox dans les CI PR et main
status: Done
assignee:
  - '@codex'
created_date: '2026-11-04 19:16'
updated_date: '2026-11-05 08:58'
labels:
  - web
  - v1-launch
  - agent
  - extension
dependencies:
  - TASK-586
  - TASK-596
references:
  - .github/workflows/main.yml
  - .github/workflows/pr.yml
  - extension/package.json
  - extension/package-lock.json
  - extension/README.md
priority: high
type: chore
ordinal: 204000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Responsabilité : agent — code/configuration/documentation et contrôles statiques dans son worktree. Aucun merge, push, déploiement, publication ou validation propriétaire demandé par les critères.

Audit du 2026-11-04 : aucun workflow main/PR n’installe ni ne contrôle extension/. Le projet WXT est autonome, avec son propre package-lock.json, et consomme les sources de packages/core : une modification partagée peut donc casser l’extension sans signal CI. Les commandes locales typecheck, lint et ZIP des deux cibles passent. Ajouter les contrôles de production des paquets avec une configuration publique de validation explicite, sans tests automatisés ni appel à l’API ou aux consoles des stores.

Conserver l’installation npm racine des apps et utiliser le lockfile propre à l’extension pour WXT. Choisir la version Node compatible avec l’outillage verrouillé, documentée dans le README extension. TASK-586 modifie les mêmes workflows pour le web : cette dépendance organise la livraison sans confondre les deux projets. Le contrôle de configuration de packaging fournit le mode de validation approprié ; il ne doit pas faire passer des URL de CI pour les origines finales.

Contraintes : aucun nouveau test automatisé. Ne pas modifier le sync Spotify, la livraison email, la génération des quiz, Whisper ni la facturation à crédits. Aucun secret, identité de compte ou compte reviewer dans les fichiers suivis. Les contrats restent sous /api/media et /api/artifacts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Les workflows PR et main installent l’extension avec son lockfile et invoquent typecheck, lint et packaging des cibles Chromium et Firefox ; un échec de ces commandes fait échouer le job.
- [x] #2 Le job utilise une version Node compatible et des paramètres publics de validation explicites ; aucun compte, secret, API réelle, publication ni test automatisé n’est requis.
- [x] #3 Les modifications de packages/core sont couvertes par ces checks et le paquet de validation ne peut pas être confondu avec une soumission store ; les commandes et leur configuration passent localement.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Ajouter le même job extension indépendant aux workflows PR/main : Node 22, npm ci depuis extension et son lockfile, paramètres .invalid explicitement réservés à la validation.
2. Exécuter typecheck, lint et package:ci (Chromium, Firefox et sources Firefox inspectées) ; conserver les jobs web/mobile/core et la parité.
3. Documenter le rôle du job, valider les deux YAML et exécuter les mêmes commandes localement sous Node 22. Aucun test, API réelle, publication ni archive présentée comme soumission.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Validation YAML réussie : les deux jobs extension sont identiques, utilisent Node 22 et Python 3.10, le lockfile extension/package-lock.json et les origines .invalid de validation ; tous les jobs existants restent présents. Aucun filtre de chemins ne soustrait packages/core aux checks. Les étapes n’ont ni continue-on-error ni publication.

Les mêmes commandes typecheck/lint/package:ci ont passé sous Node 22.23.3 pendant TASK-596 ; une installation npm ci autonome dans les sources Firefox extraites et leur reconstruction ont aussi passé. Le packaging inspecte les deux ZIP et les sources et marque distributable=false sous delivery/validation. Pas de nouveau test automatisé, secret, API réelle ou publication.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Ajoute aux CI PR et main un job extension autonome : npm ci sur son lockfile, typecheck, lint et packaging inspecté Chromium/Firefox sous Node 22. La configuration est réservée à la validation et aucun paquet n’est soumis. Les jobs apps/parité sont conservés, YAML et commandes locales vérifiés.
<!-- SECTION:FINAL_SUMMARY:END -->
