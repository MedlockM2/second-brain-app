---
id: TASK-551
title: Rendre les limites bêta compréhensibles sur mobile et web
status: Done
assignee:
  - '@codex'
created_date: '2026-10-26 22:21'
updated_date: '2026-10-28 17:45'
labels:
  - mobile
  - web
  - feature
dependencies:
  - TASK-550
documentation:
  - docs/research/pricing-challenge/README.md
  - docs/research/task-547-beta-budget-control/README.md
  - web/README.md
  - mobile-design-mockups/web_app_owner_direction/README.md
priority: high
type: feature
ordinal: 157000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Un pourcentage isolé n’explique ni les actions qui consomment, ni une prévision, ni ce qui reste possible après un refus. La bêta doit laisser les testeurs utiliser l’app dans le temps tout en annonçant clairement sa capacité renouvelable, avec le même comportement sur mobile et web.

## Décisions acquises

Formule bêta autonome, indépendante des abonnements commerciaux, avec toutes les fonctionnalités actuellement disponibles. Budget de 5 EUR par compte et par mois, sans report, pour les coûts fournisseurs d’usage hors infrastructure fixe. Les 5 EUR sont considérés comme suffisamment permissifs : ne pas rouvrir ce calibrage. Valoriser l’usage réellement mesuré au tarif normal hors crédits promotionnels ; prendre en compte les tarifs de cache réellement appliqués. L’utilisateur voit un pourcentage, sans euros, crédits ni proposition d’achat. Lecture, organisation et consultation des contenus et résultats déjà disponibles restent accessibles lorsque la capacité est épuisée ; un nouveau traitement payant reste soumis au contrôle commun.

Source de vérité : docs/research/pricing-challenge/README.md, Owner Validation et R.1–R.2, décisions du 2026-10-26 et accord de l’owner sur la préparation de la formule bêta autonome.
## Périmètre confirmé

Consommer l’interface de TASK-550. Adapter les surfaces existantes du Compte, les parcours d’import, les créations IA et le chat : jauge, recharge, explication courte des usages, prévision avant traitement important, avertissements et refus utiles. Les prévisions sont informatives et ne créent pas une confirmation supplémentaire systématique. Respecter les seuils configurés côté backend, les catalogues des onze langues et le design existant. Masquer les chemins d’achat et les mentions d’un essai qui expirerait pendant la bêta. Maintenir les brouillons et l’accès aux opérations gratuites et contenus disponibles en cas de refus. Le même livrable porte la parité web ; chaque commit touchant mobile/app ou mobile/src fournit la ligne Web: done requise. La logique et les catalogues sans dépendance de plateforme restent partagés dans packages/core.

## Limites de livraison

Aucune offre commerciale, recharge payante ou facturation à crédits à créer. Aucun changement de fournisseur ou de modèle sans décision validée ; ne pas rouvrir le contrôle du débit de tokens déjà arbitré par task-459. Aucun test automatisé demandé, aucun appel local à FastAPI en guise de preuve, aucune migration de fixtures ni compatibilité avec les anciens débits remplacés. Les vérifications après déploiement et sur appareils relèvent de la checklist propriétaire de task-440, pas d’un critère d’acceptation de cette tâche. Aucun secret, identité de compte ou payload fournisseur brut dans les fichiers suivis.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Mobile et web présentent une consommation bêta en pourcentage, sa date de recharge et une explication des usages ; les écrans ne montrent ni euros, crédits, achat ni compte à rebours d’essai gratuit pendant la bêta.
- [x] #2 Les parcours concernés rendent la prévision avant un traitement important et son caractère estimé ou indisponible, sans ajouter de confirmation systématique ni bloquer préventivement les opérations gratuites.
- [x] #3 Les avertissements utilisent les seuils du backend et les refus distinguent leurs causes ; la recharge et les actions encore accessibles sont expliquées, les brouillons sont conservés et les chemins d’achat restent masqués.
- [x] #4 Lecture, organisation et consultation des contenus et résultats déjà disponibles restent accessibles sans nouvelle dépense ; un traitement payant déclenché depuis une lecture est identifié comme tel et suit les mêmes limites.
- [x] #5 La parité mobile/web et les onze catalogues sont livrés ; les vérifications TypeScript/lint de mobile, packages/core et web passent, et les commits mobiles portent Web: done. Les vérifications sur appareil après déploiement sont réservées à task-440.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Auditer les surfaces Compte/import/IA/chat et leurs équivalents web sur le contrat TASK-550.
2. Partager la présentation de capacité, prévisions et refus dans core ; afficher les informations dans les parcours sans confirmation supplémentaire ni verrou sur les lectures.
3. Maintenir les brouillons et les achats masqués, compléter les onze langues, vérifier typecheck/lint et la parité puis committer.

Le raccordement UI complète la prévision backend avec la portée/options de génération et la conversation/question ; réutilisation des résolveurs, prompts et estimateurs existants sans appel fournisseur ni réservation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Compte mobile/web : consommation régularisée, disponible, réservations distinctes, recharge et usages expliqués. Avertissements fondés sur le seuil backend, avec la même présentation partagée ; le Home web conserve le choix owner sans bannière de minutes.
Prévisions informatives dans les surfaces import, personnalisation IA et chat ; onze langues. Le serveur mesure le prompt et schéma des sources choisies pour une création, et reprend le calcul d’admission sur l’historique du chat existant. Aucun plan de génération avec effets de bord, aucun appel fournisseur, réservation ou nouvelle conversation créé par une prévision. Métadonnées manquantes et chat non encore ouvert : estimation explicitement indisponible. Les réponses d’anciens brouillons sont ignorées ; aucune confirmation ou désactivation par budget côté client.
Les formulaires IA gardent leurs options après refus, le chat conserve/restaure son brouillon et les imports conservent leur contexte existant. Les refus restent typés sans achat, la lecture d’origine reste visible pendant la traduction identifiée comme traitement automatique. Une prévision qui dépasse le disponible reste une estimation, pas un refus anticipé.
Validation : Ruff et mypy backend propres (215 fichiers), typecheck/lint core/mobile/web propres hors avertissement any préexistant de purchaseService.ts ; OpenAPI parsé et 106 références internes résolues. Aucun test automatisé, appel local FastAPI ou lancement local de l’app. Vérifications visuelles sur appareils et AWS après déploiement réservées à TASK-440.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Surfaces bêta mobile/web avec consommation, réservations, recharge, usages, avertissements backend et prévisions informatives dans les onze langues. Brouillons et lectures préservés. Ruff/mypy/TypeScript/lint/OpenAPI vérifiés ; implémentation 4029b2c1 fusionnée dans main. Vérifications visuelles après déploiement : TASK-440.
<!-- SECTION:FINAL_SUMMARY:END -->
