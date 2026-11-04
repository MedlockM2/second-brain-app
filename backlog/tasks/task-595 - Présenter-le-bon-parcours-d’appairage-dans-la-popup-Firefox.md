---
id: TASK-595
title: Présenter le bon parcours d’appairage dans la popup Firefox
status: Done
assignee:
  - '@codex'
created_date: '2026-11-04 19:16'
updated_date: '2026-11-04 22:53'
labels:
  - web
  - v1-launch
  - agent
  - extension
dependencies: []
references:
  - extension/entrypoints/popup/index.html
  - extension/entrypoints/popup/main.ts
  - extension/lib/i18n.ts
  - extension/scripts/messages.py
  - extension/README.md
priority: high
type: bug
ordinal: 202000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Responsabilité : agent — code/configuration/documentation et contrôles statiques dans son worktree. Aucun merge, push, déploiement, publication ou validation propriétaire demandé par les critères.

Audit du 2026-11-04 : le manifeste et le background Firefox désactivent bien externally_connectable, mais popup/index.html affiche pairOneClick et pairRescue pour tous les navigateurs. Le catalogue français demande encore d’appuyer sur « Relier cette extension » dans le web, puis présente le code comme une alternative. Ce parcours est inopérant sur Firefox : le code y est le parcours normal, comme le documente déjà extension/README.md. Corriger les consignes à la cible réellement construite, sans ajouter de mécanisme d’appairage ni modifier l’authentification. L’interface Chrome/Edge conserve son appairage en un clic et son recours au code. La recette Firefox réelle reste à TASK-593.

Contraintes : aucun nouveau test automatisé. Ne pas modifier le sync Spotify, la livraison email, la génération des quiz, Whisper ni la facturation à crédits. Aucun secret, identité de compte ou compte reviewer dans les fichiers suivis. Les contrats restent sous /api/media et /api/artifacts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 La popup Firefox présente l’ouverture de Mon compte puis le code et l’adresse comme parcours principal, sans promettre le bouton d’appairage externe Chrome/Edge.
- [x] #2 La cible Chromium conserve des consignes adaptées à son appairage en un clic et à son code de secours ; les libellés restent cohérents avec le volet Extension de la web app.
- [x] #3 Les 11 catalogues et leurs sources de génération portent les libellés requis ; typecheck, lint et builds Chromium/Firefox passent sans permission supplémentaire.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Choisir les consignes de la popup selon import.meta.env.FIREFOX : ouverture de Mon compte et code comme parcours principal sur Firefox, consignes actuelles sur Chromium.
2. Ajouter les deux consignes Firefox dans la source de génération des 11 catalogues ; conserver les mécanismes d’authentification et permissions.
3. Régénérer les messages puis exécuter typecheck, lint et les deux builds ; inspecter les paquets construits et les permissions.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Génération des 11 catalogues, typecheck, lint et builds Chromium/Firefox réussis. La cible compilée Firefox utilise pairFirefox/pairFirefoxCode ; les textes renvoient au bouton Afficher un code existant dans Mon compte. Le branchement Chromium conserve pairOneClick/pairRescue. Formulaire, authentification, manifestes et permissions inchangés. Aucun test automatisé ni recette réelle revendiquée.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Adapte les consignes d’appairage à la cible compilée : code et adresse comme parcours principal dans Firefox, un clic puis code de secours dans Chromium. Les deux nouvelles consignes existent dans les 11 catalogues et la documentation suit ce parcours. Contrôles et builds réussis.
<!-- SECTION:FINAL_SUMMARY:END -->
