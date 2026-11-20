---
id: TASK-635
title: >-
  Déclencher la distribution beta mobile par les webhooks EAS et App Store
  Connect au lieu d'un passage planifié toutes les 30 minutes
status: Done
assignee: []
created_date: '2026-11-19 16:34'
updated_date: '2026-11-20 10:43'
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
- [x] #1 Le code du relais existe, il est branché sur une Lambda dev déclarée en Terraform, et `terraform validate` ainsi que `ruff`/`mypy` passent sur les fichiers touchés.
- [x] #2 Le relais rejette une requête sans signature valide (EAS et App Store Connect) avant tout appel à GitHub ; le token GitHub est lu depuis Secrets Manager et n'apparaît dans aucun fichier suivi.
- [x] #3 `mobile-beta-distribute.yml` n'a plus de passage toutes les 30 minutes mais un passage de sécurité quotidien qui garde le court-circuit par `/deepn/mobile/beta-state/<platform>` ; `deploy-extension.yml` a un passage planifié espacé, avec la raison écrite en commentaire.
- [x] #4 `mobile/MOBILE_CI_CD.md` et `extension/README.md` décrivent le relais, les webhooks à enregistrer, la rotation du token et la nouvelle fréquence.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-11-20 — Run séquentiel du backlog (`/process-backlog`).

Fait :
- Relais `infrastructure/lambda/mobile_store_webhook_relay.py` (Python 3.12, stdlib + boto3, Lambda zip comme `apple_auth.py`). Il vérifie la signature avant tout (`expo-signature: sha1=<hex>` pour EAS, `x-apple-signature: hmacsha256=<hex>` pour App Store Connect) et répond 401 sinon. Il ne réveille le workflow que pour un build/submit EAS `finished` (plateforme reprise du payload) et pour `buildUploadStateUpdated` / `buildBetaDetailExternalBuildStateUpdated` (iOS) ; le reste, pings compris, reçoit 200 sans dispatch. L'appel GitHub `workflow_dispatch` passe `platform` ; un échec GitHub renvoie 502 pour que l'émetteur réessaie.
- `infrastructure/terraform/envs/dev/mobile_store_webhook_relay.tf` : secret Secrets Manager créé vide (`ignore_changes`), rôle limité à ce secret et à ses logs, Lambda, HTTP API `POST /webhook` avec throttling (2 rps, burst 5), outputs `mobile_store_webhook_relay_url` et `mobile_store_webhook_relay_secret_name`. Une HTTP API plutôt qu'une function URL : une function URL publique exige désormais un `lambda:InvokeFunction` ouvert à tous, que le provider AWS épinglé (~> 5.0) ne sait pas restreindre à l'URL.
- `mobile-beta-distribute.yml` : cron quotidien `8 6 * * *` qui garde le court-circuit SSM ; nouvel input `platform` (both/ios/android), la porte saute la plateforme non concernée.
- `deploy-extension.yml` : cron `23 */3 * * *`, raison en commentaire.
- `terraform-dev.yml` suit `infrastructure/lambda/mobile_store_webhook_relay.py` ; `.gitignore` ignore `envs/dev/.build/`.
- Docs : `mobile/MOBILE_CI_CD.md` (section « Webhook relay » : fonctionnement, configuration initiale, rotation du token et des secrets) et `extension/README.md` (nouvelle fréquence et raison).

Vérifié : `terraform validate` et `terraform fmt -check` propres sur `envs/dev` ; `ruff` et `mypy` propres sur le relais. La vérification HMAC donne le résultat attendu sur le vecteur publié par Apple, et une requête non signée ou mal signée est rejetée en 401 sans appel GitHub (contrôle ponctuel, aucun fichier de test ajouté).

Écart avec la description : l'événement Apple s'appelle `BUILD_BETA_DETAIL_EXTERNAL_BUILD_STATE_UPDATED` dans la documentation, et non `..._EXTERNAL_BETA_STATE_UPDATED`.

Hors de portée de cette tâche, à faire par l'owner après le push (détail dans `mobile/MOBILE_CI_CD.md`) : créer le token GitHub à portée fine (Actions: write), remplir le secret `media-summarizer-mobile-store-webhook-relay-dev`, enregistrer les webhooks EAS (BUILD, SUBMIT) et App Store Connect, puis vérifier qu'un build EAS terminé lance `Mobile Beta Distribution` en `workflow_dispatch`.

Hors périmètre, signalé : `mobile-build-watch.yml` tourne lui aussi toutes les 30 minutes (:17/:47) et compte dans les minutes facturées une fois le dépôt privé.

2026-11-20, à la demande de l'owner. Le relais s'appelle désormais `mobile_store_webhook_relay` (secret et fonction `media-summarizer-mobile-store-webhook-relay-dev`, output `mobile_store_webhook_relay_url`). Il déclenche aussi `mobile-build-watch.yml` quand EAS signale un **build** `errored` (le payload contient `buildDetailsPageUrl`). Le watcher passe d'un passage toutes les 30 minutes à un passage quotidien de sécurité, à 07:17 UTC. Une soumission en échec ne réveille rien : le watcher ne lit que les builds, et ce manque reste noté dans `mobile/MOBILE_CI_CD.md`.
<!-- SECTION:NOTES:END -->
