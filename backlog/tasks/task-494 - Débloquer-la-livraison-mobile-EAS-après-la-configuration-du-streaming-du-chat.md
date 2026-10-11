---
id: TASK-494
title: Débloquer la livraison mobile EAS après la configuration du streaming du chat
status: Done
assignee:
  - '@codex'
created_date: '2026-10-11 18:22'
updated_date: '2026-10-11 18:27'
labels:
  - mobile
  - ci
  - release
dependencies: []
priority: high
type: bug
ordinal: 101000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Le workflow Mobile OTA or Build refuse le fichier eas.json avant le calcul du fingerprint : une variable env vide dans le profil production invalide aussi le profil internal. Le pipe EAS vers jq masque le diagnostic. Retirer la valeur provisoire, détecter les valeurs env vides dans tous les profils, garder une garde explicite sur le streaming du profil choisi et conserver les erreurs EAS avant tout parsing JSON. La véritable URL prod reste à renseigner lors de la mise en service de prod (task-445/446). Pas de tests automatisés.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le fichier mobile/eas.json est accepté par le schéma du CLI EAS épinglé, et les adresses de streaming dev restent configurées.
- [x] #2 Le contrôle préalable refuse les valeurs env vides dans tous les profils et exige une adresse de streaming HTTP(S) pour le profil de livraison choisi.
- [x] #3 Le workflow conserve le diagnostic et le code de sortie EAS avant parsing du fingerprint ; les sources shell et YAML sont valides.
- [x] #4 Le runbook distingue la configuration internal utilisable et la configuration du streaming production encore à renseigner.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Corriger eas.json et les gardes de configuration.
2. Séparer génération EAS, gestion de son erreur et validation JSON du hash.
3. Documenter et vérifier schéma EAS, prérequis internal/production et contrôles statiques.
4. Commit, merge et push ; suivre la nouvelle exécution mobile.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cause confirmée : EAS CLI 22.0.0 valide tous les profils et refuse la chaîne env vide de production, y compris avec -e internal. Le pipe initial transformait son message texte en erreur jq.

Correction : seule la variable de streaming production non renseignée est omise ; les endpoints dev restent configurés. Le préflight détecte les chaînes env vides dans tous les profils (y compris les blocs par plateforme), puis exige une URL HTTP(S) de streaming pour le profil choisi en suivant extends. Le contrôle du manifeste et le runbook suivent cette règle. Le workflow sépare la commande EAS du parsing et conserve son diagnostic et son code de sortie en cas d’échec.

Vérification : schéma complet accepté par le validateur installé d’EAS CLI 22.0.0 ; YAML et tous les blocs Bash du workflow valides ; bash -n des deux scripts ; typecheck mobile réussi ; lint mobile réussi avec un avertissement préexistant dans purchaseService.ts. Préflight internal : exit 0. Préflight production : exit 1 avec la garde streaming explicite et le DNS prod encore absent. Sur macOS, le contrôle DNS local a utilisé le résolveur système dscacheutil à la place du getent Linux attendu par le script. Aucun test automatisé ajouté.

Mise en service production : renseigner le véritable endpoint après task-445/446 avant toute livraison du profil production. Le push autorisé relancera le workflow internal ; son résultat distant ne fait pas partie des critères locaux.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Livraison internal débloquée sans désactiver le streaming ; configuration production manquante désormais signalée explicitement et erreurs EAS préservées.
<!-- SECTION:FINAL_SUMMARY:END -->
