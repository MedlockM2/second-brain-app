---
id: TASK-498
title: >-
  Servir un média prêt seulement lorsque son texte et son aperçu sont réellement
  disponibles
status: Done
assignee:
  - Codex
created_date: '2026-10-12 09:41'
updated_date: '2026-10-12 09:48'
labels:
  - backend
  - testflight
dependencies: []
documentation:
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
  - AGENTS.md
modified_files:
  - media_summarizer/api/endpoints/media.py
  - media_summarizer/core/services/artifact_service.py
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
priority: high
type: bug
ordinal: 105000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Feedback TestFlight AGfoTr4gj76jBNKgSnYhECc, build 14 : rester sur un média en extraction affiche une page sans texte ni aperçu et une langue UNKNOWN ; sortir puis revenir fait apparaître le contenu. Le job termine avant la publication du transcript dans le registre de contenu, et l'aperçu devient ready avant sa copie bibliothèque. Corriger la disponibilité côté backend, sans introduire le polling mobile temporaire préparé sur feedback/page-media-vide-apres-chargement. LAUNCH PREREQUISITE : après le push et le déploiement dev, vérifier sur appareil un média ouvert pendant son extraction jusqu'au texte et à l'aperçu, sans sortie de page.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 La route détail ne publie pas un transcript prêt avant sa présence dans le registre de contenu ; aucun fallback de localisation vers le job n'est ajouté.
- [x] #2 Le statut de l'aperçu dans la réponse détail est cohérent avec le contenu servi, y compris si la copie bibliothèque n'est pas encore écrite ou a échoué.
- [x] #3 La langue du transcript privilégie les valeurs détectées réelles et ne publie pas les placeholders comme unknown.
- [x] #4 Le contrat est documenté et les contrôles ruff et mypy passent, sans ajout de tests automatisés.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Garder la route détail en extracting lorsque le job est terminé mais que le registre de contenu ne résout pas encore le transcript ; le registre reste l'unique source. 2. Résoudre l'aperçu avec son contenu : utiliser la copie bibliothèque lorsqu'elle existe, sinon lire l'artefact prêt et réparer la copie best-effort ; retourner contenu et statut ensemble, sans polling temporel mobile. 3. Dériver la langue depuis le registre puis les métadonnées détectées/déclarées normalisées. 4. Documenter le contrat et lancer ruff/mypy ; validation appareil après déploiement consignée séparément.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Disponibilité corrigée dans la projection API : un job terminé sans transcript publié reste extracting ; si le job a disparu et que le texte manque, réponse failed plutôt qu'attente infinie. completed_at reste nul pendant la publication. Langue : première valeur normalisée du registre puis detected_language et métadonnées déclarées, placeholders exclus.

Aperçu : contenu et statut résolus ensemble. Une copie bibliothèque existante sert ready sans requête d'artefact. Si elle manque, lecture de l'artefact prêt (avec résolution du pointeur partagé), retour de sa prose et réparation best-effort ; une écriture de projection échouée ne masque plus le contenu. Le helper de lecture du corps est partagé avec la réparation existante. Aucun fallback vers la localisation du job ni polling mobile temporaire.

Vérification directe en lecture seule contre DynamoDB/S3 dev du média signalé : registre processed, emplacement du transcript présent, source_language en, copie aperçu présente, artefact ready avec hook et quatre points. Cela confirme les données réelles et le format utilisé ; ce n'est pas une validation du nouveau code déployé. Ruff complet et mypy (205 fichiers) passent. Aucun test automatisé ajouté. Validation sur appareil du passage extraction vers lecture à faire après déploiement.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
La page détail n'annonce plus le texte prêt avant sa publication dans le registre de contenu. L'aperçu est résolu avec sa prose depuis la copie bibliothèque ou l'artefact prêt, puis sa projection est réparée sans bloquer la lecture. Langue détectée normalisée, placeholders exclus. Contrat documenté ; ruff/mypy propres et lecture réelle DynamoDB/S3 dev effectuée sans écriture. Validation du parcours sur appareil après déploiement encore nécessaire.
<!-- SECTION:FINAL_SUMMARY:END -->
