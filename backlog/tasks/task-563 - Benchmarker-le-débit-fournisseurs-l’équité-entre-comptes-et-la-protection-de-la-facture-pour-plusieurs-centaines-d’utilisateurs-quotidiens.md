---
id: TASK-563
title: >-
  Benchmarker le débit fournisseurs, l’équité entre comptes et la protection de
  la facture pour plusieurs centaines d’utilisateurs quotidiens
status: To Do
assignee: []
created_date: '2026-10-28 16:59'
updated_date: '2026-10-28 17:00'
labels:
  - benchmark
  - backend
  - architecture
  - scalability
dependencies: []
references:
  - >-
    backlog/tasks/task-459 -
    Benchmark-du-contrôle-du-débit-de-tokens-par-minute-partagé-entre-le-chat-et-les-artefacts-sur-le-fournisseur-LLM.md
  - >-
    backlog/tasks/task-466 -
    Implémenter-le-contrôle-du-débit-de-tokens-partagé-entre-le-chat-et-les-artefacts-selon-le-benchmark-validé-task-459.md
  - >-
    backlog/tasks/task-548 -
    Mettre-en-place-le-contrôle-budgétaire-bêta-selon-le-benchmark-validé-TASK-547.md
  - >-
    backlog/tasks/task-549 -
    Faire-passer-les-traitements-fournisseurs-par-le-contrôle-budgétaire-commun.md
  - >-
    backlog/tasks/task-552 -
    Produire-un-suivi-exploitable-de-l’usage-des-coûts-et-des-refus-bêta.md
  - >-
    backlog/tasks/task-557 -
    Benchmarker-lusage-des-volumes-gratuits-puis-la-bascule-automatique-sur-un-crédit-provisionné-pour-chaque-fournisseur.md
  - >-
    backlog/tasks/task-558 -
    Mettre-en-place-la-bascule-des-volumes-gratuits-vers-le-crédit-provisionné-selon-le-benchmark-validé-TASK-557.md
  - >-
    backlog/tasks/task-562 -
    Générer-un-nouvel-artefact-à-chaque-demande-sans-réutilisation-aperçu-excepté.md
  - docs/BETA_BUDGET_CONTROL.md
  - docs/INGESTION_WORKERS_PROVIDERS.md
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
  - docs/research/task-563-provider-capacity-fairness-operator-safety/README.md
  - >-
    backlog/tasks/task-564 -
    Réguler-les-appels-fournisseurs-partagés-selon-le-benchmark-validé-pour-plusieurs-centaines-d’utilisateurs-quotidiens.md
  - >-
    backlog/tasks/task-565 -
    Partager-équitablement-la-capacité-de-traitement-entre-comptes-sans-pénaliser-les-imports-par-lots.md
  - >-
    backlog/tasks/task-566 -
    Protéger-la-dépense-opérateur-et-suspendre-les-appels-lors-d’incidents-fournisseurs-selon-le-benchmark-validé.md
priority: high
type: spike
ordinal: 169000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Avec plusieurs centaines d'utilisateurs quotidiens, des enveloppes individuelles respectées ne suffisent pas à éviter la saturation d'un compte fournisseur, l'accaparement des traitements par un compte et les dépenses opérateur dues aux échecs. Deepn a une consommation irrégulière : lecture et organisation sans nouveau traitement, imports par lots, aperçus et traductions automatiques, puis générations et conversations sur des dossiers parfois volumineux. Le besoin porte sur le débit collectif, l'équité et la facture réelle, pas sur un nouveau quota commercial ou un découpage quotidien des 5 EUR.

## Recherche à mener

Produire une comparaison exhaustive dans ce périmètre, fondée sur des sources primaires Internet datées et un audit du code au moment du benchmark. Livrable : docs/research/task-563-provider-capacity-fairness-operator-safety/README.md, avec Recommendation, Owner Validation et owner_decision: pending. Une seule décision d'ensemble doit fixer les interfaces et responsabilités des trois implémentations associées, pour éviter trois mécanismes concurrents.

Couvrir OpenAI, Deepgram, LlamaParse, Unstructured, Apify et l'API X, ainsi que PodcastIndex et l'extraction TikTok directe là où elles restent actives. Inventorier aussi les appels Algolia et les autres services effectivement utilisés : préciser lesquels relèvent d'une limite de débit, d'un coût variable hors enveloppe ou d'un simple suivi, et justifier les exclusions. Ne pas étendre implicitement le contrôle de contenu aux stores, à l'authentification, à la distribution ou à l'infrastructure fixe.

Distinguer pour chaque fournisseur : requêtes par seconde/minute/jour, volume de tokens, concurrence, jobs et polling, limites par endpoint/modèle/projet/organisation/compte, crédits disponibles et plafond de dépense. Séparer limite publique, valeur réellement connue du compte et hypothèse. Une valeur de console inaccessible reste une vérification owner, pas un chiffre inventé ni un AC bloqué.

Comparer les options pertinentes de régulation et d'ordonnancement distribués, la priorité du chat et les garanties d'équité entre comptes ; comparer aussi les protections financières et de suspension/reprise après incidents. Inclure coût fixe/variable, latence, complexité d'exploitation et limites de garantie. Aucun algorithme, stockage ou nouveau service n'est imposé à ce stade. Expliquer pourquoi une concurrence plafonnée ou un compteur local à une Lambda suffit ou non à chaque contrainte.

Dimensionner des scénarios explicites pour 300, 500 et 1 000 utilisateurs quotidiens : consultation majoritaire, premier import de bibliothèque, rafale du soir, longs podcasts, documents/carrousels, discussions sur gros dossiers, déclenchements automatiques et fournisseur défaillant. Chiffrer moyenne et pics, poids des appels, temps d'attente, risque de famine, coûts et sensibilité aux hypothèses. Ces scénarios ne sont pas des mesures de production ; aucun test de charge payant ou automatisé n'est demandé.

Décrire les interactions entre admission de capacité, réservation budgétaire, droit d'envoi, attente et libération : une attente locale n'est ni un appel facturé ni une panne fournisseur ; elle ne doit pas épuiser les reprises SQS ou immobiliser indéfiniment l'enveloppe du testeur. Examiner doublons, crashs, expiration, retours tardifs, reprise simultanée, équité et plafonnement des files. Conserver un comportement explicite pour le chat interactif et pour un import déjà enregistré.

Pour la facture opérateur, comparer plafonds et engagements globaux/par fournisseur, périodes, coût livré et coût d'échec remboursé, inconnues valorisées prudemment, gratuit/promotions versus trésorerie, recharges et options de coupure chez les fournisseurs. Inclure les coûts variables de recherche hors enveloppe et les reprises répétées de nouvelles opérations. Fixer ce qui est réellement bornable, les traitements déjà partis et le comportement de reprise ; ne pas promettre un plafond bancaire exact sans preuve.

## Décisions et frontières

La présente demande autorise une nouvelle étude pour l'échelle de plusieurs centaines d'utilisateurs. Elle ne valide pas encore le remplacement du choix de TASK-459 : le README doit expliquer ce qu'il propose de maintenir ou de remplacer, explicitement, avant implémentation. Lire aussi TASK-466.

TASK-548/549 sont maintenant marquées Done : partir du budget_guard et du registre livrés, conserver le budget de 5 EUR, les remboursements sans résultat et la séparation des dépenses opérateur. Ne pas créer un second registre financier divergent. Intégrer la décision TASK-562 : chaque demande d'artefact utilisateur doit générer à nouveau ; seul l'aperçu conserve sa réutilisation. Ne pas dimensionner en supposant que tous les artefacts resteront partagés.

TASK-557/558 possèdent les plans, crédits, moyens de paiement, recharges et le sort des anciens provider_pools ; réutiliser leur recherche et leur décision finale, signaler ce qui reste en attente. TASK-552 possède le rapport général d'usage/coûts ; lui fournir les événements et motifs nouveaux sans recréer un autre reporting. TASK-550/551 possèdent l'affichage du budget ; les états d'attente, surcharge ou suspension introduits ici doivent avoir un contrat cohérent sur mobile et web, sans les confondre avec le budget épuisé.

## Limites

Recherche uniquement : aucun changement de compte, paiement, quota fournisseur, modèle ou code applicatif. Pas de nouveau plafond quotidien utilisateur présupposé. Aucun test automatisé, appel local à FastAPI ou déploiement exigé. Aucun secret, identité de compte, identifiant de support ou rapport de testeurs dans les fichiers suivis. Les actions de console et vérifications après déploiement sont une checklist owner, jamais une condition de livraison. La validation finale reste celle de l'owner via le README ; les trois implémentations attendent cette validation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le README de recherche inventorie les fournisseurs et chemins actifs, leurs unités et portées de limite, les protections réellement câblées et les lacunes ; sources primaires datées, faits de compte, hypothèses et vérifications owner sont séparés.
- [ ] #2 La comparaison traite régulation distribuée, priorité interactive, équité et saturation des files, protections de facture et suspension/reprise ; coût, latence, complexité et garanties de chaque option pertinente sont explicités.
- [ ] #3 Les scénarios 300, 500 et 1 000 utilisateurs quotidiens couvrent usages calmes, pics, imports par lots, longs contenus, chat de dossier et incidents ; les calculs, hypothèses et sensibilités sont documentés sans les présenter comme des mesures.
- [ ] #4 La recommandation définit les responsabilités des trois implémentations, les contrats d’attente/refus et le cycle capacité-budget-envoi, y compris doublons, crashs, reprises et remboursements ; elle explicite le maintien ou le remplacement proposé de TASK-459.
- [ ] #5 Le README articule le contrôle livré TASK-548/549 avec TASK-562, TASK-552 et TASK-557/558 ; plafonds ou garanties financiers résiduels, coûts hors enveloppe et actions de console sont documentés sans redéfinir le budget utilisateur.
- [ ] #6 Le livrable comporte Recommendation et Owner Validation avec owner_decision: pending ; aucune action de compte, dépense de recherche, modification applicative, mise en production ou suite de tests n’est requise pour le livrer.
<!-- AC:END -->
