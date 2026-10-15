---
id: TASK-516
title: Créer les dossiers dans la grille et imposer des noms uniques entre frères
status: Done
assignee:
  - codex
created_date: '2026-10-15 12:46'
updated_date: '2026-10-15 13:38'
labels:
  - mobile
  - backend
  - testflight
dependencies: []
priority: high
ordinal: 123000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Feedback ABAqCwXYSnd3YNXAzrLmC2k et précisions owner : le + de Bibliothèque crée immédiatement un dossier avec nom standard incrémenté, défile vers sa tuile et sélectionne son nom en édition inline avec clavier. Valider ou toucher ailleurs conserve le texte saisi. Interdire les noms identiques dans un même parent sur création/renommage, avec encart fermé uniquement par OK et saisie conservée. Aucun commit/push demandé dans ce tour. Validation appareil après distribution par owner.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 La bibliothèque crée un dossier avec nom standard libre incrémenté, puis propose la saisie sur sa tuile et le défilement vers celle-ci au-dessus du clavier.
- [ ] #2 Les parcours de validation et de sortie du champ enregistrent le nom courant ; un refus conserve le brouillon, sans supprimer le dossier créé.
- [ ] #3 La création, le renommage et le déplacement refusent les doublons dans un même parent côté API ; les parcours mobiles présentent le refus avec OK obligatoire.
- [x] #4 Les contrôles types/lint mobile/core et backend passent ; aucune suite de tests automatisés ajoutée, limites natives documentées.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Ajouter normalisation et réservation atomique de nom dans la table dossiers existante, avec libération au renommage/déplacement/suppression et refus API stable. Ajouter les messages dans les onze catalogues et la présentation mobile commune des doublons. Remplacer le prompt de création Bibliothèque par une session inline stable dans la tuile, avec verrou de création/enregistrement, sauvegarde au blur ou submit, reprise erreur et défilement mesuré après ouverture clavier. Vérifier types/lint et exports natifs ; documenter validation appareil restante.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implémentation livrée localement : création numérotée avec édition dans la tuile Bibliothèque, texte final natif sauvegardé à la validation/fin de saisie, référence synchrone et verrou anti-double soumission, reprise du brouillon après refus, défilement mesuré au-dessus du clavier. Unicité normalisée entre frères dans le service, plus réservation transactionnelle dans user_folders et libération au renommage/déplacement/suppression. Listes paginées excluant les réservations ; purge de compte les inclut via user-index. Refus FOLDER_NAME_CONFLICT/409, encart mobile non annulable et acquittement web obligatoire ; onze catalogues. Aucun nouveau fournisseur, index, dépendance, test automatisé ou instrumentation. Documentation et checklist owner dans docs/FOLDER_NAMING.md. Aucun commit/push dans cette session.

Contrôles : types/lint mobile/core/web, Ruff et mypy (205 fichiers) passent ; seul warning any purchaseService préexistant. Exports Hermes iOS/Android réussis. Expressions DynamoDB dev racine/sous-dossier acceptées et transactions volontairement refusées sur ligne inexistante : aucune écriture. AC 1 à 3 laissés non cochés : leur vérification complète exige les gestes natifs et le backend déployé, non disponibles dans ce run ; les parcours et écritures sont implémentés, mais ni rendu/scroll/clavier ni concurrence par endpoints déployés ne sont annoncés vérifiés.

Owner autorise le commit et le push le 15 octobre 2026. Publication via les workflows main existants ; validations natives et endpoints déployés restent la checklist owner après distribution.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Création inline et numérotation câblées dans Bibliothèque ; fin de saisie sauvegarde le nom courant avec reprise après erreur. API protège les noms frères avec réservation atomique et refus 409, acquitté par OK sur mobile et web. Types/lint, Ruff/mypy et exports natifs passent ; syntaxe transactionnelle vérifiée sans écriture sur dev. Validation native/déployée owner restante, AC 1–3 documentés non cochés. Commit et push autorisés par owner.
<!-- SECTION:FINAL_SUMMARY:END -->
