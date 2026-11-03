---
id: TASK-583
title: Renommer et supprimer les artefacts depuis leur menu contextuel mobile et web
status: Done
assignee:
  - '@codex'
created_date: '2026-11-03 19:15'
updated_date: '2026-11-03 19:24'
labels: []
dependencies: []
priority: medium
type: feature
ordinal: 186000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Les artefacts ne proposent pas les actions de gestion disponibles sur les médias et les dossiers de la bibliothèque. Un appui long doit reprendre le même menu pour renommer ou supprimer une fiche terminée, dans un média, un dossier et les vignettes de reprise. Le web propose les mêmes actions dans ses menus. LAUNCH PREREQUISITE : après fusion et déploiement du backend, vérifier les actions contre API dev et dans les applications.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Les entrées et vignettes des artefacts terminés réutilisent AnchoredContextMenu et RenameDialog sur mobile avec Renommer et Supprimer, confirmation et erreurs visibles.
- [ ] #2 Les routes canoniques authentifiées permettent de renommer et supprimer une fiche terminée appartenant au compte, sans modifier ses sources ni générer de contenu.
- [ ] #3 Le web propose les mêmes actions et les caches de consultation et de reprise sont actualisés après succès.
- [x] #4 Typecheck et lint mobile, core et web, build web et vérifications statiques backend passent pour les fichiers concernés.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Étendre les mutations canoniques des artefacts terminés et documenter le contrat.
2. Réutiliser les composants de menu et renommage de la bibliothèque sur les listes et vignettes mobiles.
3. Brancher les actions équivalentes sur le web et actualiser les caches.
4. Exécuter les vérifications statiques et le build web, sans ajouter ni lancer de tests automatisés.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implémentation complète dans le worktree codex/artifact-context-actions : même AnchoredContextMenu et RenameDialog pour les listes média/dossier et les vignettes de reprise mobiles ; menu … et clic droit web avec portails pour éviter le rognage par les listes défilantes. PATCH du titre et DELETE des entrées ready/failed sous /api/artifacts, contrôle du compte et de la révision, suppression des références de reprise et du payload S3. Titre projeté à la lecture sans réécrire le contenu généré ; caches mobiles mis à jour sur toutes les pages déjà lues. Traductions dans les 11 langues et contrat Markdown/OpenAPI mis à jour. La portée est contrôlée par le propriétaire de la fiche, y compris si le média est atteint via une autre sauvegarde du même contenu.

Vérifications : typecheck mobile/core/web, lint des trois workspaces (0 erreur ; avertissement préexistant purchaseService.ts:136), build web, ruff et mypy ciblés (2 fichiers), parsing du YAML OpenAPI et git diff --check passent. Aucun test automatisé ajouté ou exécuté. Les AC 1 à 3 sont laissés décochés pour leur partie comportementale : le backend de cette branche ne peut pas être déployé depuis le worktree ; ni action réelle contre AWS ni interaction sur appareil/navigateur authentifié avec cette version ne sont revendiquées. Les chemins, composants, conditions et mises à jour des caches ont été revus dans le code ; la vérification de bout en bout reste à faire par le propriétaire après fusion et déploiement, conformément à AGENTS.md.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Menu Renommer/Supprimer ajouté aux artefacts terminés sur mobile (composants de la bibliothèque) et web, y compris les vignettes de reprise ; mutations canoniques, actualisation des caches et contrat livrés. Vérifications statiques et build web réussis. Validation comportementale des AC 1–3 non exécutée : elle demande le backend déployé après fusion, hors du worktree.
<!-- SECTION:FINAL_SUMMARY:END -->
