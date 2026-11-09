---
id: TASK-591
title: >-
  Mettre en service la web app bêta sur le domaine et renseigner sa
  configuration publique
status: Done
assignee:
  - owner
created_date: '2026-11-04 19:11'
updated_date: '2026-11-09 16:20'
labels:
  - web
  - v1-launch
  - release
  - owner-only
dependencies:
  - TASK-443
  - TASK-445
  - TASK-471
  - TASK-528
  - TASK-590
  - TASK-589
references:
  - web/README.md
  - docs/AUTHENTICATION_SETUP.md
  - docs/research/task-424-website-and-browser-extension/README.md
priority: high
type: task
ordinal: 194000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Responsabilité : propriétaire — configuration distante et publication web. Les recettes fonctionnelles sont exécutées par les agents dans TASK-440.1 à TASK-440.4 ; les contrôles immédiats de mise en service ci-dessous ne les remplacent pas. Tâche verrouillée pour le dispatcher (dispatchable: false).

La préparation des fichiers et celle des ressources AWS ne publient pas la web app. Après achat du domaine, appliquer la configuration retenue pour l’environnement bêta (dev tant que l’owner n’en décide pas autrement), relier le domaine nu, api. et auth. et renseigner les valeurs publiques réelles. Pour la bêta sur dev, ces noms sont `dev.deepn.app` (web app, sur le domaine nu depuis la décision owner du 2026-11-09, TASK-443), `api.dev.deepn.app` et `auth.dev.deepn.app`, dans la zone `dev.deepn.app` du compte dev déléguée depuis le compte prod (TASK-443, 2026-11-09) ; la délégation doit résoudre avant l’application de Terraform dev. Utiliser les livrables de TASK-445, TASK-471, TASK-528 et de la préparation de livraison web. Cette tâche exécute les opérations ; elle n’implémente pas leur code et ne remplace ni le branding/vérification Google de TASK-451 ni la publication des pages de TASK-444/472.

Checklist propriétaire : DNS/certificats ; origine web sur API, streaming et uploads S3 ; callbacks et déconnexion Cognito, retours Google/Apple ; liens de confidentialité et liens d’accès bêta iOS/Android réellement utilisables (pas une fiche publique inexistante) ; configuration du site, feedback et IDs d’extension disponibles. Les IDs manquants avant publication des extensions sont repris par leurs tâches de publication, avec code de secours explicite. Déposer le paquet, vérifier routes profondes après rechargement et comportement de cache, consigner le paquet de retour arrière. Aucun réveil de prod implicite.

Contraintes : aucun nouveau test automatisé. Ne pas modifier le sync Spotify, la livraison email, la génération des quiz, Whisper ni la facturation à crédits. Aucun secret, identité de compte ou compte reviewer dans les fichiers suivis. Les contrats restent sous /api/media et /api/artifacts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le compte rendu identifie environnement bêta, domaines effectivement utilisés, révision/paquet publié et configuration publique vérifiée, sans dump d’environnement ni donnée de compte.
- [x] #2 Les opérations DNS/TLS, origines API/S3/chat et callbacks OAuth sont consignées avec leurs observations ou limites ; les liens bêta et légaux ne sont pas remplacés par des URLs publiques fictives.
- [x] #3 Le compte rendu décrit ouverture initiale, rechargement d’une route profonde, paquet servi après mise à jour et procédure de retour arrière disponible ; tout élément manquant est identifié comme blocage ou limite explicite.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Le propriétaire a autorisé une publication préalable sans domaine le 2026-11-06, réalisée dans TASK-605 : web app dev sur https://d3n3qjz3si2rme.cloudfront.net avec proxy /api de même origine. Voir docs/validation/task-605-web-cloudfront/README.md. La présente tâche reste la bascule ultérieure sur le domaine et ses autres prérequis ; elle n’est pas déclarée terminée par cette publication.

**2026-11-09 — compte rendu de mise en service (session principale, avec l'owner).**

**#1 Environnement et configuration.**
- Environnement bêta : **dev** (compte dev). Prod n'est ni réveillée ni ouverte.
- Domaines : web app `https://dev.deepn.app`, sur le domaine nu par décision owner du 2026-11-09 (TASK-443) ; API `https://api.dev.deepn.app` ; Cognito `https://auth.dev.deepn.app` ; pages statiques `https://www.dev.deepn.app`.
- Révision publiée : `0dc34874` (Deploy Web App réussi), lue dans `release.json`, mode `beta`.
- Configuration publique vérifiée dans `release.json` :
  - `VITE_API_BASE_URL=https://dev.deepn.app` (proxy `/api` de même origine) ;
  - streaming du chat sur sa porte `execute-api` ;
  - liens testeurs : TestFlight `testflight.apple.com/join/…` et page d'acceptation du test Play ;
  - un identifiant d'extension Chrome.
- `VITE_SITE_URL` et `VITE_FEEDBACK_URL` sont laissés vides : la page `/extension` du site n'existe pas encore, et Canny reste joint par l'API.

**#2 DNS, TLS, origines, OAuth.**
- DNS et TLS :
  - `dev.deepn.app` délégué depuis la zone prod ;
  - certificats ACM validés par DNS : us-east-1 pour l'apex, `www.` et `auth.`, eu-west-3 pour `api.` ;
  - les quatre noms résolvent ; `app.dev.deepn.app` ne résout plus.
- Origines : le pré-vol CORS de l'API renvoie `access-control-allow-origin: https://dev.deepn.app`. Les règles CORS S3 d'upload et le CORS du streaming suivent `web_app_origin` (apply Terraform Dev réussi).
- OAuth :
  - retour web Cognito : `https://dev.deepn.app/auth/callback` (lu sur le client Cognito) ;
  - retours Google et Apple : `https://auth.dev.deepn.app/oauth2/idpresponse`, enregistrés par l'owner, contrôlés par redirection sans erreur ;
  - connexion validée sur appareil par l'owner (TASK-528).
- Lien de confidentialité : `https://www.dev.deepn.app/privacy` répond 200. Les consoles stores gardent l'adresse CloudFront jusqu'à la gate de TASK-454. Aucune URL fictive.
- Limite, lien Play : le bouton Google Play pointe vers l'acceptation du test, qui exige d'avoir rejoint le groupe testeurs. Le message d'invitation de l'owner reste le point d'entrée Android.

**#3 Ouverture, routes, mise à jour, retour arrière.**
- `/` répond 200. Les routes profondes `/library` et `/folders/x` répondent 200 (réécriture SPA). L'index est servi `cache-control: no-store`.
- Après la dernière mise à jour, le paquet servi est bien la révision `0dc34874`.
- Retour arrière : archives `_releases/<releaseId>.tar.gz` présentes dans le bucket app. Procédure dans `docs/WEB_RELEASE.md`, « Retour à un paquet précédent ».
- Le paquet précédent n'a pas été restauré pour cette clôture.

Les recettes fonctionnelles restent celles de TASK-440.1 à 440.4.
<!-- SECTION:NOTES:END -->
