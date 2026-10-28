---
id: TASK-562
title: >-
  Générer un nouvel artefact à chaque demande, sans réutilisation, aperçu
  excepté
status: To Do
assignee: []
created_date: '2026-10-28 15:52'
updated_date: '2026-10-28 16:22'
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
- [ ] #1 Une demande d'artefact (hors review_blurb) crée toujours une nouvelle entrée et met en file une nouvelle génération ; aucun chemin ne renvoie une entrée existante du compte ni une génération d'un autre compte
- [ ] #2 review_blurb conserve sa réutilisation actuelle, sans changement de comportement
- [ ] #3 La reprise d'une demande en attente de ses sources fonctionne sans recalcul d'identifiant ; le code de mutualisation et de reprise en place devenu mort est supprimé
- [ ] #4 Contrat, OpenAPI, types packages/core et clients mobile et web ne présentent plus reused, retried ni collapsed pour ces types ; parité web dans le même commit
- [ ] #5 ruff et mypy passent sur le backend modifié, et les vérifications TypeScript et lint sur packages/core, mobile et web ; aucun test automatisé ajouté
- [ ] #6 Un artefact en échec s'affiche sur sa ligne avec icône, texte et raison ; Relancer (même entrée, mêmes options) n'est proposé que pour un échec passager, Supprimer toujours ; supprimer retire l'entrée côté serveur ; parité mobile et web
<!-- AC:END -->
