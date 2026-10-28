---
id: TASK-562
title: >-
  Générer un nouvel artefact à chaque demande, sans réutilisation, aperçu
  excepté
status: Done
assignee:
  - '@codex'
created_date: '2026-10-28 15:52'
updated_date: '2026-10-28 22:46'
labels:
  - backend
  - feature
  - mobile
dependencies:
  - TASK-549
priority: high
ordinal: 168000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Décision de l'owner du 2026-10-28 : les artefacts (résumé, notes, fiches, quiz, sur un média ou un dossier) sont personnalisables. Ils ne doivent donc plus être réutilisés. Chaque demande génère un nouvel artefact, et chaque génération est réservée puis débitée sur le budget bêta (TASK-549, qui réserve déjà chaque appel du worker). L'owner ne veut pas de code qui enregistre et compare les options d'une demande à l'autre.

Aujourd'hui, la réutilisation passe par l'identité déterministe des artefacts (`artifact_service.build_artifact_id` et `build_shared_artifact_id`, task-269, task-394) : un compte qui redemande la même chose reçoit son entrée existante (`generation_outcome: reused`), et un autre compte reçoit la génération déjà faite (mutualisation). Depuis TASK-549, cette réutilisation entre comptes ne coûte rien, puisqu'aucun appel fournisseur n'a lieu ; c'est ce que l'owner veut supprimer.

## Périmètre

- Pour tous les types demandés par l'utilisateur : une demande crée toujours une nouvelle entrée et une nouvelle génération. Plus de réutilisation de l'entrée du compte, plus de mutualisation entre comptes, et un artefact en échec n'est plus repris en place.
- **Exception : l'aperçu automatique `review_blurb`** garde sa réutilisation actuelle (copie entre sauvegardes et entre comptes dans la même langue), sur laquelle repose la règle 12 (TASK-549).
- Adapter ce qui dépend de l'identité déterministe : la reprise d'une demande en attente de ses sources (`artifact_wait_service`, qui recalcule l'identifiant pour détecter un changement de sources), l'armement d'une génération partagée, et les issues `reused`, `retried` et `collapsed` du contrat (`CANONICAL_MEDIA_API_CONTRACT.md`, OpenAPI, `packages/core`), ainsi que leur traitement mobile et web (parité web dans le même commit). Supprimer le code devenu mort, sans compatibilité : rien n'est déployé.
- **Artefact en échec (décision de l'owner du 2026-10-28, d'après NN/g et les design systems publics)** : l'échec s'affiche sur la ligne même de l'artefact, à sa place dans l'historique, avec une icône et un texte (jamais la couleur seule) et la raison quand elle est connue. Pas de toast. Les actions dépendent de la cause :
  - échec passager (fournisseur indisponible, délai dépassé, réponse inexploitable) : **Relancer**, qui régénère *la même entrée* avec les options qu'elle porte déjà (pas une nouvelle demande, aucune comparaison d'options), réservée et facturée normalement ; et **Supprimer** ;
  - échec qu'un nouvel essai ne règle pas (budget du mois épuisé, contenu trop grand, sources devenues illisibles) : pas de Relancer ; la ligne dit pourquoi et, pour le budget, quand l'action redevient possible ; **Supprimer**.
  Aucun effacement automatique silencieux. Supprimer retire l'entrée de l'historique côté serveur. Cela demande une route de suppression d'artefact dans l'API canonique existante, pas sous /api/v1/. Parité mobile et web dans le même commit.
- Conséquence à documenter : deux taps rapprochés donnent deux générations, toutes deux facturées.

## Note owner

Le comportement réel (une nouvelle génération et un débit à chaque demande) se constate sur dev après déploiement ; ce n'est pas un critère d'acceptation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Une demande d'artefact (hors review_blurb) crée toujours une nouvelle entrée et met en file une nouvelle génération ; aucun chemin ne renvoie une entrée existante du compte ni une génération d'un autre compte
- [x] #2 review_blurb conserve sa réutilisation actuelle, sans changement de comportement
- [x] #3 La reprise d'une demande en attente de ses sources fonctionne sans recalcul d'identifiant ; le code de mutualisation et de reprise en place devenu mort est supprimé
- [x] #4 Contrat, OpenAPI, types packages/core et clients mobile et web ne présentent plus reused, retried ni collapsed pour ces types ; parité web dans le même commit
- [x] #5 ruff et mypy passent sur le backend modifié, et les vérifications TypeScript et lint sur packages/core, mobile et web ; aucun test automatisé ajouté
- [x] #6 Un artefact en échec s'affiche sur sa ligne avec icône, texte et raison ; Relancer (même entrée, mêmes options) n'est proposé que pour un échec passager, Supprimer toujours ; supprimer retire l'entrée côté serveur ; parité mobile et web
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Séparer l’identité opaque de chaque création utilisateur de l’identité déterministe réservée à review_blurb ; retirer la mutualisation et la comparaison d’options pour les autres types.
2. Reprendre les générations en attente sous leur entrée existante ; ajouter les actions canoniques de relance conditionnelle et suppression, avec droits/causes d’échec typés.
3. Rendre les lignes d’échec et leurs actions en place sur mobile et web, mettre à jour les contrats/types/catalogues, vérifier Ruff/mypy/TypeScript/lint puis committer.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Chaque création utilisateur porte un UUID indépendant des options et possède sa génération. La mutualisation, les identités déterministes et la reprise automatique des clés en échec restent réservées à review_blurb ; leur recette est inchangée. La reprise des sources compare directement les identités de contenu enregistrées.

Les actions canoniques POST /api/artifacts/{id}/retry et DELETE /api/artifacts/{id} contrôlent le propriétaire, le statut et la révision. Relancer conserve identifiant, options, sources et created_at, avec une nouvelle révision et une opération budgétaire distincte. Les messages, claims, transitions finales et clés S3 portent la révision pour écarter un ancien worker. La suppression conditionnelle retire le seul historique en échec et ne peut pas supprimer une relance concurrente.

Mobile et web affichent les échecs sur leur ligne, avec icône, texte, raison traduite et erreur éventuelle de l’action en place, sans toast. Relancer est conditionné par retryable ; Supprimer est toujours proposé pour un échec. Budget épuisé et date de remise à zéro, corpus trop grand et sources illisibles interdisent la relance. Même règle dans les écrans de détail. Contrat, OpenAPI et types partagés limitent la création à created ; onze catalogues mis à jour, index scope-index étendu aux causes et actions.

Validation : Ruff et mypy sur media_summarizer (217 fichiers), TypeScript et ESLint sur mobile, packages/core et web ; seul avertissement préexistant purchaseService.ts:136. Terraform validate dev passe. OpenAPI YAML lu et 112 références locales résolues, six opérations canoniques documentées. Aucun test automatisé ajouté ni application exécutée localement.

PRÉREQUISITE OWNER : après fusion/push et déploiement du backend et de la projection GSI, constater sur dev les générations et débits distincts, la relance même entrée et la suppression. Cette vérification déployée ne constitue pas un AC réalisable depuis le worktree.

Audit final après TASK-561 : le worker revérifie le statut et la révision après la lecture suivant le claim, pour ne jamais adopter la révision d’une relance plus récente. Sur mobile, un refus de relance relit la cause et les actions ; sur web, la ligne actualisée prime sur une ancienne erreur de lecture du contenu. Budget épuisé ou sources devenues invalides retirent ainsi Relancer dès actualisation, tout en gardant Supprimer. Parité mobile/web conservée.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Créations utilisateur indépendantes, exception review_blurb préservée. Relance et suppression canoniques des échecs avec contrôles de révision, budget et propriété. Affichage et actions en place sur mobile/web, onze langues, contrat/OpenAPI/types et projection DynamoDB alignés. Ruff, mypy, TypeScript, ESLint, Terraform validate et contrôle de parité passent ; vérification du comportement déployé réservée à l’owner après push. Implémentation 9d22a1c7 fusionnée dans main.
<!-- SECTION:FINAL_SUMMARY:END -->
