---
id: TASK-489
title: >-
  Benchmark du moteur de paiement web de Deepn (Paddle, RevenueCat Billing,
  Stripe Billing)
status: To Do
assignee: []
created_date: '2026-10-11 15:59'
labels:
  - benchmark
  - pricing
  - web
dependencies: []
references:
  - docs/research/task-424-website-and-browser-extension/README.md
  - >-
    docs/research/task-424-website-and-browser-extension/complement-response-2026-10-11.md
  - >-
    docs/research/task-424-website-and-browser-extension/README.owner-rejected-2026-10-05.md
  - docs/REVENUECAT_ENTITLEMENTS.md
  - >-
    backlog/tasks/task-442 -
    Clore-la-bêta-et-retirer-son-mécanisme-avant-la-monétisation-publique.md
priority: low
type: task
ordinal: 96000
dispatchable: false
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi cette tâche est verrouillée

Elle porte `dispatchable: false` dans son front-matter : le `Decision` du 2026-10-11 de task-424 (point 3) dit « **Aucun paiement web avant le benchmark B-01, à ouvrir à la fin de la bêta** ». L'owner l'ouvre en retirant ce verrou (ou en écrivant `dispatchable: true`) à la fin de la bêta.

## Pourquoi

Source de vérité : `docs/research/task-424-website-and-browser-extension/README.md`, section **Owner Validation**, champ `Decision` du 2026-10-11, tel que précisé par `complement-response-2026-10-11.md` (même répertoire), qui prime sur la Recommendation et sur les §8 à §12 du README. Cette tâche est l'élément **B-01** du §3 du complément ; le cadre est au **§2** du complément. « Stripe Billing via RevenueCat » est retiré des conclusions : le moteur n'est pas choisi.

## Ce que le benchmark compare

Trois options, sur deux axes séparés (complément §2) : le **moteur** (qui est vendeur officiel, qui déclare la TVA) et l'**intégration** (Web Purchase Links hébergés par RevenueCat, ou Web SDK dans `app.<domaine>`).

- **Paddle Billing** intégré à RevenueCat (Paddle vendeur officiel).
- **RevenueCat Billing** (« Web Billing »), Stripe comme passerelle, Deepn vendeur officiel.
- **Stripe Billing** intégré à RevenueCat, Deepn vendeur officiel, ou Stripe avec Managed Payments.

Pour chacune :
- le vendeur officiel, la TVA dans l'UE et hors UE, les factures et les litiges ;
- le coût par transaction au ticket des formules S, M et L ;
- l'intégration (lien hébergé ou Web SDK) et ce qu'elle change dans `docs/REVENUECAT_ENTITLEMENTS.md` et le webhook RevenueCat ;
- ce que le complément §12 n'a pas vérifié : seuils de volume, pays couverts, délais de versement.

Acquis à ne pas refaire : le webhook RevenueCat accepte déjà un achat web et écrit une ligne correcte (`README.owner-rejected-2026-10-05.md` §0.3).

## Livrable

`docs/research/task-489-web-payment-engine/README.md`, avec `owner_decision: pending` dans le front-matter et une section **Owner Validation** (`Decision`, `Validated at`) vide. Aucune implémentation : celle-ci est la tâche jumelle qui dépend de ce benchmark.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 docs/research/task-489-web-payment-engine/README.md existe avec owner_decision: pending et une section Owner Validation vide
- [ ] #2 Le README compare Paddle Billing, RevenueCat Billing et Stripe Billing sur le vendeur officiel, la TVA dans et hors UE, les factures et les litiges, avec ses sources datées
- [ ] #3 Le README chiffre le coût par transaction au ticket des formules S, M et L pour chaque option
- [ ] #4 Le README décrit pour chaque intégration (lien hébergé ou Web SDK) ce qui change dans docs/REVENUECAT_ENTITLEMENTS.md et le webhook, et se conclut par une recommandation
- [ ] #5 Aucun fichier hors de docs/research/ n'est modifié
<!-- AC:END -->
