---
id: task-358
title: >-
  Pointer les liens légaux du paywall vers les pages retenues par le benchmark
  (task-357)
status: To Do
assignee:
  - agent
created_date: '2026-09-04 15:26'
updated_date: '2026-11-19 10:58'
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
- [x] #1 `TERMS_URL`, `PRIVACY_POLICY_URL` et l'adresse de contact de `mobile/src/constants/legal.ts` valent exactement les adresses décidées dans le `Decision` du README de task-357
- [x] #2 `grep -rn 'mediasummarizer' mobile/` ne renvoie plus aucune adresse légale, ni en valeur, ni en repli, ni en exemple de commentaire
- [x] #3 L'écran d'achat et l'écran de suppression de compte lisent tous deux ces constantes ; aucune URL légale n'est écrite en dur ailleurs dans `mobile/`
- [x] #4 `npm run typecheck` et `npm run lint` sont propres dans `mobile/`
- [ ] #5 Les liens de confidentialité et de conditions sont accessibles depuis les écrans login/register et Account, et lisent les mêmes constantes légales que le paywall et la suppression de compte.
- [x] #6 Les libellés ajoutés passent par les catalogues de traduction existants et sont présents dans les 11 langues V1.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-11 — Dispatch tenté après le passage de task-357 à Done, puis arrêté avant toute modification.

Le `Decision` de task-357 fixe les pages sur `https://www.<domaine>/privacy` et `/terms`, avec une adresse de contact dédiée sur ce même domaine. Or aucun domaine n'est acquis : task-443 est à l'owner, verrouillée (`dispatchable: false`), et `docs/BRAND_IDENTITY.md` interdit de déduire un domaine de « Deepn ». L'AC #1, qui demande les adresses exactes, ne peut donc pas être satisfaite, et un domaine inventé finirait dans le binaire.

Dépendance TASK-443 ajoutée. La tâche redeviendra dispatchable quand le domaine et l'adresse de contact seront consignés.

2026-10-30 — Dépendance TASK-443 remplacée par TASK-444. Décision owner : pour la bêta, les pages sont servies sur le domaine par défaut de CloudFront (amendement du README de task-357). L'AC #1 se lit donc contre les adresses CloudFront et l'adresse de contact provisoire consignées par task-444. Le passage au domaine définitif est un gate de task-454.

2026-11-19 — Run séquentiel du backlog (`/process-backlog`) : la tâche reste en To Do à cause de l'AC #5. Aucun code modifié.

Déjà livré par b3a79901 (2026-10-30), contrôlé aujourd'hui :
- AC #1 : `PRIVACY_POLICY_URL` = `https://d118p1z5xvufnz.cloudfront.net/privacy` et `TERMS_URL` = EULA standard d'Apple (`packages/core/src/constants/legal.ts`, réexportés par `mobile/src/constants/legal.ts`), `PRIVACY_CONTACT_EMAIL` = la boîte du projet consignée par TASK-444. Cela correspond à l'amendement du 2026-10-30 du README de task-357.
- AC #2 : `grep -rn mediasummarizer mobile/` ne renvoie aucune adresse légale. Restent des commentaires sur l'ancien hôte d'API et le `bundle_id` de `google-services.json`.
- AC #3 : le paywall lit `TERMS_URL`/`PRIVACY_POLICY_URL`, la suppression de compte lit `PRIVACY_CONTACT_EMAIL`, et aucune URL légale n'est écrite en dur ailleurs dans `mobile/`.
- AC #4 : `npm run typecheck` est propre. `npm run lint` donne 0 erreur et 1 avertissement antérieur (`no-explicit-any`, `src/services/purchaseService.ts:136`).
- AC #6 : `register.legal` et `paywall.privacy` existent dans les 11 catalogues de `packages/core/src/i18n/`.

**Blocage, AC #5** : la politique de confidentialité est accessible depuis register et Account, mais pas depuis login, et le lien Terms n'apparaît sur aucun des trois écrans. Deux décisions de l'owner sont nécessaires :
1. Le commit b3a79901 a retiré volontairement les conditions de l'inscription, parce que Deepn n'en publie pas pendant la bêta (amendement task-357). Faut-il quand même un lien Terms vers l'EULA d'Apple sur login/register/Account, ou faut-il réduire l'AC #5 à la seule politique de confidentialité ?
2. Ajouter un lien légal sur l'écran login (direction C) est un changement visuel : il faut d'abord la maquette et le go de l'owner.
<!-- SECTION:NOTES:END -->
