---
id: TASK-616
title: >-
  Automatiser la distribution des builds aux bêta-testeurs TestFlight externes
  et Google Play Alpha
status: Done
assignee:
  - '@codex'
created_date: '2026-11-06 21:18'
updated_date: '2026-11-06 21:24'
labels: []
dependencies: []
priority: high
ordinal: 222000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Les builds CI arrivent dans les stores mais restent internes : le groupe TestFlight externe et la piste Play Alpha nécessitent une intervention manuelle. Le propriétaire demande la distribution et la soumission en revue automatiques avec le message de bienvenue FR/EN existant, sans changer les liens ni attendre les files EAS dans un job GitHub.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Un workflow différé et déclenchable manuellement distribue les builds internes disponibles au groupe TestFlight externe et à Play Alpha, avec les notes FR/EN versionnées.
- [x] #2 Les relances consultent les états réels et ne resoumettent pas un build déjà en revue ou distribué, ni ne remplacent une version plus récente.
- [x] #3 Les credentials restent hors des fichiers suivis et des journaux ; les vérifications statiques et le contrôle en lecture seule contre les stores sont documentés.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Lire les workflows EAS et vérifier les API de distribution. 2. Ajouter un réconciliateur différé avec notes FR/EN communes, états idempotents et contrôle en lecture seule. 3. Brancher la CI sans attendre les builds et documenter les credentials et la distribution. 4. Vérifier syntaxe, lint et états réels sans créer de build.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implémentation : workflow Mobile Beta Distribution (workflow_run sur main, cron toutes les 30 minutes et dispatch avec dry_run), script Node sans dépendance ajoutée et notes de bienvenue FR/EN communes. Les uploads EAS restent internes ; la continuation utilise les API officielles Apple et Google vers les groupes existants. Verrou par plateforme, refus de remplacer un build plus récent et commit Play ERROR_IF_IN_REVIEW. Les deux secrets GitHub BETA_ASC_API_KEY_JSON et BETA_GOOGLE_PLAY_API_KEY_JSON ont été configurés depuis les credentials EAS existants, uniquement en mémoire ; aucune valeur ni identité de compte enregistrée. Vérifications : node --check, YAML et bash -n sur les 38 étapes shell des trois workflows concernés, actionlint sans erreur, git diff --check. Contrôle réel sans publication : iOS 1.0.0 (26) IN_BETA_TESTING, notes FR/EN identiques aux fichiers, groupe externe associé et autoNotifyEnabled=true ; Android 1.0.0 (32) déjà dans Alpha, aucune resoumission. Le dry-run Google ouvre puis supprime une Edit temporaire, sans modification de piste ni commit. Aucun test automatisé ajouté ou exécuté. Activation : après intégration et push sur main, le propriétaire pourra vérifier le premier run Actions ; aucun nouveau build ou examen créé pendant cette implémentation.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
La CI dispose désormais de la continuation asynchrone vers TestFlight externe et Play Alpha avec le message de bienvenue FR/EN. Secrets configurés, contrôles statiques et inspection des stores réussis ; activation au prochain push de ces fichiers sur main.
<!-- SECTION:FINAL_SUMMARY:END -->
