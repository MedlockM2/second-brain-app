---
id: TASK-635
title: >-
  Déclencher la distribution beta mobile par les webhooks EAS et App Store
  Connect au lieu d'un passage planifié toutes les 30 minutes
status: To Do
assignee: []
created_date: '2026-11-19 16:34'
labels:
  - tooling
  - mobile
dependencies: []
references:
  - .github/workflows/mobile-beta-distribute.yml
  - .github/workflows/deploy-extension.yml
  - scripts/mobile_beta_distribute.mjs
  - 'https://docs.expo.dev/eas/webhooks/'
  - >-
    https://developer.apple.com/documentation/appstoreconnectapi/webhook-events.md
priority: medium
type: enhancement
ordinal: 234000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Le dépôt passera en privé. Les minutes GitHub Actions deviendront alors payantes au-delà du quota gratuit (2 000 min/mois sur le plan gratuit), et chaque job est facturé à la minute entamée. Les passages planifiés actuels :

- `mobile-beta-distribute.yml` : toutes les 30 min, 2 jobs (ios, android). Même court-circuités par l'état SSM `/deepn/mobile/beta-state/<platform>` (commit ed1fd20e), ça fait environ 2 × 48 × 30 = 2 880 min facturées par mois.
- `deploy-extension.yml` : toutes les 30 min, environ 48 × 30 = 1 440 min par mois pour le job `pending`.

Le passage planifié mobile sert surtout à détecter la fin d'un build EAS lancé en `--no-wait`, la fin du traitement Apple et la fin de l'examen beta. Ces trois événements existent en webhooks :
- EAS : webhooks `BUILD` et `SUBMIT` (https://docs.expo.dev/eas/webhooks/) ;
- App Store Connect : `BUILD_UPLOAD_STATE_UPDATED` et `BUILD_BETA_DETAIL_EXTERNAL_BETA_STATE_UPDATED` (https://developer.apple.com/documentation/appstoreconnectapi/webhook-events.md, WWDC25 session 324).

Google Play ne propose pas de webhook équivalent pour la fin d'un examen de piste. Chrome Web Store et Edge Add-ons non plus. Pour eux, un passage planifié reste nécessaire, mais il peut être espacé.

## Ce qu'il faut construire

1. Un relais (Lambda dev, définie en Terraform à côté des autres) qui reçoit les webhooks EAS et App Store Connect, **vérifie leur signature** (en-tête `expo-signature` HMAC-SHA1 avec le secret du webhook ; signature App Store Connect), puis déclenche `mobile-beta-distribute.yml` par l'API GitHub `workflow_dispatch`. Le token GitHub est un token à portée fine limité à ce dépôt, permission « Actions: write », stocké dans Secrets Manager dev, jamais dans le dépôt.
2. `mobile-beta-distribute.yml` : remplacer `cron: "8,38 * * * *"` par un passage de sécurité quotidien, qui garde le court-circuit par l'état SSM. Le passage déclenché par webhook passe toujours.
3. `deploy-extension.yml` : espacer le passage planifié (par exemple toutes les 3 h). Faute de webhook côté Chrome et Edge, c'est le seul moyen de rattraper un store sauté pendant un examen.
4. Documenter le relais, les webhooks à enregistrer et la rotation du token dans `mobile/MOBILE_CI_CD.md` et `extension/README.md`.

## Notes pour l'owner (hors AC)

- Créer le token GitHub à portée fine et le mettre dans Secrets Manager. Enregistrer le webhook EAS (`eas webhook:create --event BUILD` puis `--event SUBMIT`, avec l'URL du relais) et le webhook App Store Connect (Users and Access › Integrations › Webhooks).
- Le déploiement du relais se fait au push sur `main` par `terraform-dev.yml` et `deploy-lambda.yml`. Vérifier ensuite qu'un build EAS terminé déclenche bien `Mobile Beta Distribution` (event `workflow_dispatch`), sans attendre de passage planifié.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le code du relais existe, il est branché sur une Lambda dev déclarée en Terraform, et `terraform validate` ainsi que `ruff`/`mypy` passent sur les fichiers touchés.
- [ ] #2 Le relais rejette une requête sans signature valide (EAS et App Store Connect) avant tout appel à GitHub ; le token GitHub est lu depuis Secrets Manager et n'apparaît dans aucun fichier suivi.
- [ ] #3 `mobile-beta-distribute.yml` n'a plus de passage toutes les 30 minutes mais un passage de sécurité quotidien qui garde le court-circuit par `/deepn/mobile/beta-state/<platform>` ; `deploy-extension.yml` a un passage planifié espacé, avec la raison écrite en commentaire.
- [ ] #4 `mobile/MOBILE_CI_CD.md` et `extension/README.md` décrivent le relais, les webhooks à enregistrer, la rotation du token et la nouvelle fréquence.
<!-- AC:END -->
