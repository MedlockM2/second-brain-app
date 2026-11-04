---
id: TASK-586
title: 'Contrôler le typecheck, le lint et le build web dans les CI PR et main'
status: Done
assignee:
  - '@codex'
created_date: '2026-11-04 19:11'
updated_date: '2026-11-04 22:41'
labels:
  - web
  - v1-launch
  - agent
dependencies: []
references:
  - .github/workflows/main.yml
  - .github/workflows/pr.yml
  - web/package.json
  - web/.env.example
priority: high
type: chore
ordinal: 189000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Responsabilité : agent — code/configuration/documentation et contrôles statiques dans son worktree. Aucun merge, push, déploiement, publication ou validation propriétaire demandé par les critères.

Audit web du 2026-11-04 : les contrôles locaux passent mais main.yml et pr.yml ne contrôlent directement que le backend, Terraform, mobile et packages/core. Le job web-parity vérifie les messages des commits, pas la compilation de web/. Le web doit bénéficier de ses propres contrôles sans attendre le domaine ni une API déployée. Utiliser le workspace racine et la configuration publique de validation appropriée ; ne créer aucune suite de tests ni publication dans ces jobs.

Contraintes : aucun nouveau test automatisé. Ne pas modifier le sync Spotify, la livraison email, la génération des quiz, Whisper ni la facturation à crédits. Aucun secret, identité de compte ou compte reviewer dans les fichiers suivis. Les contrats restent sous /api/media et /api/artifacts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Les workflows PR et main invoquent le typecheck, le lint et le build de web/ depuis le workspace existant ; une erreur de ces commandes fait échouer le job.
- [x] #2 La configuration de build de CI est explicite, sans secret, domaine inventé présenté comme réel ni appel à une API ; elle ne remplace pas la configuration de distribution.
- [x] #3 Les commandes web passent localement ; les contrôles mobile et packages/core existants sont conservés et le rôle du check de parité reste explicite.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Ajouter le même job web aux workflows PR et main : installation npm ci à la racine, typecheck, lint et build du workspace web.
2. Ajouter un mode Vite ci explicite utilisant uniquement une adresse locale de compilation, sans configuration de distribution ni appel réseau.
3. Documenter le rôle des contrôles et exécuter les trois commandes web ; conserver les jobs mobile, core et parité existants.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Vérifié dans le worktree : npm run typecheck --workspace web, npm run lint --workspace web et npm run build --workspace web -- --mode ci passent. Lecture YAML : jobs web identiques, jobs mobile/core et parité conservés. Aucun appel API ni publication. Avertissement de taille du bundle déjà présent, hors périmètre.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Ajoute des contrôles web indépendants dans les workflows PR et main, depuis le workspace racine. Le mode ci utilise une adresse loopback publique réservée à la compilation ; la configuration de distribution reste distincte. Typecheck, lint, build et validation YAML réussis.
<!-- SECTION:FINAL_SUMMARY:END -->
