---
id: task-358
title: >-
  Pointer les liens légaux du paywall vers les pages retenues par le benchmark
  (task-357)
status: To Do
assignee:
  - agent
created_date: '2026-09-04 15:26'
updated_date: '2026-10-30 12:00'
labels:
  - mobile
  - compliance
dependencies:
  - TASK-357
  - TASK-444
priority: high
dispatchable: true
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Responsabilité — cadrage lancement du 2026-10-10

Agent mobile — appliquer la décision validée du benchmark task-357 aux liens légaux et aux points d’entrée V1. Owner — publier les pages via task-444 et vérifier les liens sur appareil. La publication externe ne fait pas partie des critères du travail en branche.

Mettre en place les liens légaux de l'app conformément à la décision de l'owner sur le benchmark **task-357**.

## Avant de commencer

Lire `docs/research/task-357-*/README.md` et en particulier le champ `Decision` sous **Owner Validation** : c'est lui qui fait foi, pas la recommandation initiale du benchmark, et il peut renvoyer à un fichier de complément qu'il faut alors lire aussi. Suivre l'option retenue et l'architecture qu'elle décrit.

## Portée

Les deux liens exigés par l'écran d'achat — conditions d'utilisation et politique de confidentialité — ainsi que l'adresse de contact de confidentialité, sont lus depuis un seul fichier, `mobile/src/constants/legal.ts`. Le travail côté code se concentre là, plus les éventuels points d'appel que la décision ferait apparaître.

Deux exigences portées par le fichier lui-même, à ne pas perdre en chemin :

- l'écran d'achat **et** l'écran de suppression de compte doivent pointer vers les mêmes adresses, sans divergence ;
- l'adresse de contact doit rester cohérente avec la section « accès / portabilité » de la politique de confidentialité, l'app n'ayant pas d'export en libre-service.

Le domaine actuellement référencé n'appartient pas au projet : aucune de ses adresses ne doit subsister, y compris en valeur de repli ou en commentaire donné comme exemple valide.

Cadrage (`AGENTS.md`, « Nothing is deployed yet ») : l'app n'a jamais été soumise à un store, aucun lien n'est en circulation. On remplace, on ne fait pas cohabiter l'ancien et le nouveau.

## Notes pour l'owner (pas des ACs)

- **Publier les pages vous revient** : elles doivent être joignables publiquement, sans authentification, avant la première soumission. Un agent ne peut ni acheter un domaine ni mettre une page en ligne.
- Une fois publiées, vérifier depuis l'app que les deux liens de l'écran d'achat ouvrent bien les bonnes pages — un lien qui répond 404 est rejeté comme un lien absent.

## Complément de périmètre V1

Les liens Privacy/Terms doivent aussi être accessibles depuis login/register et Account, en utilisant les mêmes constantes que le paywall et la suppression de compte. Ce complément couvre le point du V1 Launch Plan sans créer un ticket mobile concurrent.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `TERMS_URL`, `PRIVACY_POLICY_URL` et l'adresse de contact de `mobile/src/constants/legal.ts` valent exactement les adresses décidées dans le `Decision` du README de task-357
- [ ] #2 `grep -rn 'mediasummarizer' mobile/` ne renvoie plus aucune adresse légale, ni en valeur, ni en repli, ni en exemple de commentaire
- [ ] #3 L'écran d'achat et l'écran de suppression de compte lisent tous deux ces constantes ; aucune URL légale n'est écrite en dur ailleurs dans `mobile/`
- [ ] #4 `npm run typecheck` et `npm run lint` sont propres dans `mobile/`
- [ ] #5 Les liens de confidentialité et de conditions sont accessibles depuis les écrans login/register et Account, et lisent les mêmes constantes légales que le paywall et la suppression de compte.
- [ ] #6 Les libellés ajoutés passent par les catalogues de traduction existants et sont présents dans les 11 langues V1.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-11 — Dispatch tenté après le passage de task-357 à Done, puis arrêté avant toute modification.

Le `Decision` de task-357 fixe les pages sur `https://www.<domaine>/privacy` et `/terms`, avec une adresse de contact dédiée sur ce même domaine. Or aucun domaine n'est acquis : task-443 est à l'owner, verrouillée (`dispatchable: false`), et `docs/BRAND_IDENTITY.md` interdit de déduire un domaine de « Deepn ». L'AC #1, qui demande les adresses exactes, ne peut donc pas être satisfaite, et un domaine inventé finirait dans le binaire.

Dépendance TASK-443 ajoutée. La tâche redeviendra dispatchable quand le domaine et l'adresse de contact seront consignés.

2026-10-30 — Dépendance TASK-443 remplacée par TASK-444. Décision owner : pour la bêta, les pages sont servies sur le domaine par défaut de CloudFront (amendement du README de task-357). L'AC #1 se lit donc contre les adresses CloudFront et l'adresse de contact provisoire consignées par task-444. Le passage au domaine définitif est un gate de task-454.
<!-- SECTION:NOTES:END -->
