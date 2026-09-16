---
id: TASK-399
title: >-
  Lire les articles web protégés contre les robots et ne plus figer une URL en
  échec pour tous les comptes
status: Done
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
- [x] #1 Le User-Agent par défaut de trafilatura_article_resolver.py est celui d'un navigateur courant, et une requête curl avec cette valeur sur la page d’accueil de boataround.com (qui répond 405 au User-Agent actuel) répond 200
- [x] #2 Un partage dont la ligne media_idempotence est failed ne passe plus par _build_duplicate_outcome : il réserve et relit la page ; reserved et completed restent réutilisés
- [x] #3 Les 4xx de page ne produisent plus PROVIDER_UNAVAILABLE ; 429 produit PROVIDER_RATE_LIMITED ; 5xx inchangés
- [x] #4 ruff et mypy passent sur les fichiers modifiés
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### 1. User-Agent (AC #1)

Un seul User-Agent « navigateur » pour tous les fetchs qui visent une page ou un
asset publics, dans `media_summarizer/utils/http_user_agent.py`
(`BROWSER_USER_AGENT`, un Chrome desktop courant). Les trois appelants gardent
leur variable d'environnement comme point de réglage et n'en changent que le
défaut :

- `infrastructure/resolvers/trafilatura_article_resolver.py` (`ARTICLE_EXTRACT_USER_AGENT`) ;
- `core/services/cover_capture.py` (`COVER_FETCH_USER_AGENT`) — la couverture d'un
  article est hotlinkée depuis l'hôte même qui filtre les robots sur la page, et
  l'ancienne valeur portait encore un token `Bot` ;
- `workers/instagram_ingestion_worker.py`, qui lit la même variable.

Vérification (2026-09-16, `curl -L`, `Accept: text/html,application/xhtml+xml`,
valeur lue depuis le module) sur `https://www.boataround.com/` :
`Mozilla/5.0 (Macintosh; …) Chrome/139.0.0.0 Safari/537.36` → **200** ;
`media-summarizer/article-extractor (+https://media-summarizer.local)` → **405**.

### 2. Une ligne `failed` ne verrouille plus une URL (AC #2)

`failed` devient une trace, pas un verrou :

- `utils/media_idempotence.py` : `reserve_or_skip` écrit par-dessus une ligne
  `failed` (`attribute_not_exists(media_key) OR #st = :failed`) ; seuls
  `reserved` et `processed` refusent l'écriture. Nouveau prédicat `is_failed_row`
  + constante `STATUS_FAILED`.
- `adapters/orchestrators.py::submit` : la lecture initiale du registre
  court-circuite vers `_build_duplicate_outcome` seulement si la ligne n'est pas
  `failed` ; sinon on log `media.ingest.failed_ledger_retried` et on continue par
  le chemin normal (réservation + job propre, donc relecture de la source). Le
  second point d'entrée (réservation refusée puis relecture) retente une fois la
  réservation quand la ligne est passée `failed` entre les deux accès, au lieu de
  servir l'échec qu'un autre job vient d'enregistrer.
- `_fail_unreadable_article` perd sa branche `retryable` : elle existait
  uniquement pour supprimer la réservation afin que l'URL ne reste pas figée, ce
  que le point ci-dessus rend inutile. L'événement `episode_completion_status`
  `failure` est désormais publié dans tous les cas — c'est lui qui ferme le
  registre, termine les attentes d'artefacts et marque les watchers, que
  la branche « réessayable » laissait en suspens. `retryable` reste dans le log.

Effet de bord voulu sur le chemin RSS/podcast (`core/services/media_submission.py`) :
une ligne `failed` y donne maintenant un vrai job au lieu d'un watcher sur un job
mort.

### 3. Codes d'échec HTTP (AC #3)

`ArticleFetchErrorCode.HTTP_ERROR` est remplacé par trois raisons stables
(`core/ports/article_content.py`), chacune mappée statiquement sur un
`MediaFailureCode` **existant** — aucun nouveau code, aucune nouvelle chaîne i18n
(`MEDIA_UNAVAILABLE` et `PROVIDER_RATE_LIMITED` sont déjà dans
`mobile/src/lib/getFriendlyErrorMessage.ts`) :

| statut | code fetch | MediaFailureCode | réessayable |
| --- | --- | --- | --- |
| 4xx hors 429 | `http_client_error` | `MEDIA_UNAVAILABLE` | non |
| 429 | `http_rate_limited` | `PROVIDER_RATE_LIMITED` | oui |
| 5xx | `http_server_error` | `PROVIDER_UNAVAILABLE` | oui (inchangé) |

La classification vit dans `_http_failure()` du resolver ; `details` reste
`article_http_error` et `error_metadata.http_status` continue de porter le statut
exact.

### 4. Contrôles

`ruff check` et `mypy` propres sur les 7 fichiers touchés (AC #4).

Hors de portée depuis le worktree, et donc non tenté : vérifier la sémantique de
la condition DynamoDB contre la table `media_idempotence-dev` (aucune credential
AWS dans ce sandbox) et le repartage du lien du 10/09, qui suppose l'image Lambda
redéployée — c'est la note owner de la description.

Aucun test automatisé ajouté (règle du dépôt) : les AC n'en demandaient pas.
<!-- SECTION:NOTES:END -->
