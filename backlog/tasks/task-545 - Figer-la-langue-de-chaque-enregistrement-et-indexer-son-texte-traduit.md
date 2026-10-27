---
id: TASK-545
title: Figer la langue de chaque enregistrement et indexer son texte traduit
status: Done
assignee:
  - '@codex'
created_date: '2026-10-26 20:59'
updated_date: '2026-10-26 21:09'
labels:
  - backend
  - search
dependencies: []
priority: high
ordinal: 151000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Décision propriétaire du 26 octobre 2026 : la langue favorite au moment de chaque enregistrement devient la langue de lecture conservée pour ce média. Changer la préférence du compte ne retraite aucun texte ni résumé existant et ne réindexe pas la bibliothèque. La recherche lexicale indexe uniquement le texte dans la langue conservée, dès que sa traduction est prête, ou le texte source quand il est déjà dans cette langue. Réenregistrer le même contenu crée une entrée dans la nouvelle langue sans supprimer la précédente. Aucun nouveau contrôle de traduction par média. Les chemins de lecture et les artefacts existants doivent respecter cette règle, sur mobile et web. Aucun test automatisé ni migration des fixtures dev. LAUNCH PREREQUISITE : après merge et déploiement, vérifier ces parcours sur le backend dev.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 La langue de lecture est enregistrée et immuable sur chaque nouvelle entrée de bibliothèque, pour tous les modes ingestion et les sauvegardes dédupliquées.
- [x] #2 Le lecteur conserve la langue de chaque enregistrement après changement de préférence du compte ; les textes, aperçus et résumés existants ne sont plus traduits automatiquement à ouverture.
- [x] #3 L indexation recherche attend et utilise le texte dans la langue conservée ; les traductions partagées et déjà disponibles alimentent tous les enregistrements concernés sans indexer le texte source étranger.
- [x] #4 Deux sauvegardes du même contenu peuvent conserver des langues différentes ; une préférence modifiée ne déclenche aucune réindexation globale.
- [x] #5 Les contrats et documentation décrivent la règle validée ; les contrôles statiques adaptés aux fichiers modifiés passent et la parité web est documentée.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Stocker la langue de lecture sur la ligne user_media à sa création et interdire sa modification ; utiliser cette langue pour les lectures et aperçus.
2. Retirer la traduction automatique des artefacts existants à la consultation et sélectionner les aperçus par langue enregistrée.
3. Faire résoudre au worker de recherche le texte dans la langue conservée ; déclencher l indexation des sauvegardes concernées à la fin de chaque traduction partagée et traiter aussi les sauvegardes dédupliquées.
4. Adapter les permissions AWS requises par ces chemins et documenter les contrats ; aucune migration de fixtures ni suite de tests.
5. Exécuter Ruff, mypy et les validations de configuration applicables ; revoir les chemins asynchrones et documenter la parité web fournie par le backend commun.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implémentation : langue immuable capturée dans le point commun save_media_for_user ; lecteur, aperçus et langue par défaut des fiches média utilisent cette valeur. Retrait du déclenchement et du code de traduction automatique des artefacts. Indexation via le résolveur du lecteur, attente bornée avec messages SQS retardés et réveil de toutes les copies concernées quand une traduction partagée termine. Enregistrements multiples du même compte traités séparément. Les rôles AWS existants autorisent déjà S3, DynamoDB et les deux files ; aucun changement Terraform requis. Parité web fournie par les endpoints communs, sans modification UI. Aucune migration ou reconstruction des fixtures existantes.

Validation finale : Ruff sur media_summarizer passe ; mypy passe sur 207 fichiers ; git diff --check passe ; YAML OpenAPI analysé avec le parseur yaml déjà installé dans le workspace. Revue des flux de création communs, verrouillage des attributs immuables, lecteur, langue des générations média, sélection et copie des aperçus par langue sauvegardée, demandes Algolia, attente SQS, cache partagé et reprise de notification index après traduction terminée. Aucun test automatisé ajouté ou exécuté ; aucune API locale appelée et aucun résultat runtime AWS revendiqué. Les critères portent sur les chemins livrés et leur câblage ; le parcours sur appareil après déploiement reste la checklist propriétaire décrite dans la tâche. Changements UI et authentification déjà présents dans le workspace préservés.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Langue de lecture figée pour chaque enregistrement ; recherche sur le texte prêt dans cette langue ; aucune retraduction des anciens médias ou artefacts sur changement de préférence. Les réenregistrements et les traductions partagées sont pris en charge ; aperçus conservés dans la langue de chaque copie. Contrats mis à jour. Ruff, mypy, contrôle du diff et syntaxe OpenAPI validés ; parcours appareil après déploiement à vérifier par le propriétaire.
<!-- SECTION:FINAL_SUMMARY:END -->
