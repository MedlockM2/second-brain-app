---
id: TASK-399
title: >-
  Lire les articles web protégés contre les robots et ne plus figer une URL en
  échec pour tous les comptes
status: To Do
assignee: []
created_date: '2026-09-16 12:34'
labels:
  - backend
  - ingestion
  - bug
dependencies: []
priority: high
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Origine : feedback beta TestFlight (build 9, 2026-09-10), diagnostiqué dans les logs dev le 2026-09-16, go de l'owner le même jour.

## Faits établis
- Un article web partagé a échoué en `PROVIDER_UNAVAILABLE` / `article_http_error` : le site a répondu **HTTP 405** (`error_metadata.http_status` du job).
- Rejoué le 2026-09-16 sur la même URL : 405 avec le User-Agent par défaut de `trafilatura_article_resolver.py` (`media-summarizer/article-extractor (+https://media-summarizer.local)`) et avec `python-httpx` ; **200** avec un User-Agent de navigateur mobile. C'est un filtrage anti-robot, pas une panne.
- task-392 n'a rien changé à ça : `TrafilaturaArticleResolver` envoie le même User-Agent et classe tout 4xx en `HTTP_ERROR` non réessayable.
- Cinq minutes plus tard, un second partage de la même URL a été servi par `episode_idempotence.already_processed` → `_build_duplicate_outcome` sur le job déjà `failed` : nouvelle ligne de bibliothèque, échec instantané, **aucune nouvelle lecture de la page**. Comme la ligne `media_idempotence` reste `status=failed` pour un échec non réessayable, **chaque futur partage de cette URL, par n'importe quel compte, hérite de l'échec**. `release_reservation` ne couvre que le cas réessayable.

## Périmètre
1. **User-Agent** : la récupération d'article s'annonce comme un navigateur courant (valeur par défaut du code ; la variable d'environnement `ARTICLE_EXTRACT_USER_AGENT` reste le point de réglage). Même revue pour `cover_capture` si elle vise les mêmes pages.
2. **Idempotence** : un nouveau partage d'une URL dont la ligne d'idempotence est `failed` relance une lecture au lieu de réutiliser le job en échec. La réutilisation reste pour les états `reserved`/`completed`.
3. **Code d'échec** : un 4xx de la page (403, 404, 405, 410, 451…) ne se rend plus en `PROVIDER_UNAVAILABLE` (« service indisponible ») mais sur le code existant le plus juste (`MEDIA_UNAVAILABLE` a priori) ; 429 → `PROVIDER_RATE_LIMITED` ; les 5xx inchangés. Pas de nouveau code ni de nouvelle chaîne i18n sauf nécessité démontrée.

Pas de nettoyage ciblé de la ligne dev concernée : le point 2 la rend inoffensive.

## Note owner (hors AC)
Après déploiement : repartager le lien du 10/09 ; attendu un article lisible, pas une tuile « ÉCHEC ».
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le User-Agent par défaut de trafilatura_article_resolver.py est celui d'un navigateur courant, et une requête curl avec cette valeur sur la page d’accueil de boataround.com (qui répond 405 au User-Agent actuel) répond 200
- [ ] #2 Un partage dont la ligne media_idempotence est failed ne passe plus par _build_duplicate_outcome : il réserve et relit la page ; reserved et completed restent réutilisés
- [ ] #3 Les 4xx de page ne produisent plus PROVIDER_UNAVAILABLE ; 429 produit PROVIDER_RATE_LIMITED ; 5xx inchangés
- [ ] #4 ruff et mypy passent sur les fichiers modifiés
<!-- AC:END -->
