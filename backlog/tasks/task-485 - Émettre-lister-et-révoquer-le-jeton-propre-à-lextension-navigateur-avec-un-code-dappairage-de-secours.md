---
id: TASK-485
title: >-
  Émettre, lister et révoquer le jeton propre à l'extension navigateur, avec un
  code d'appairage de secours
status: Done
assignee: []
created_date: '2026-10-11 15:58'
updated_date: '2026-10-11 17:41'
labels:
  - backend
  - auth
  - feature
dependencies:
  - TASK-473
references:
  - docs/research/task-424-website-and-browser-extension/README.md
  - >-
    docs/research/task-424-website-and-browser-extension/complement-response-2026-10-11.md
  - >-
    docs/research/task-424-website-and-browser-extension/README.owner-rejected-2026-10-05.md
  - media_summarizer/api/endpoints/auth.py
  - media_summarizer/api/dependencies/auth.py
  - docs/AUTHENTICATION_SETUP.md
priority: medium
type: feature
ordinal: 92000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Source de vérité : `docs/research/task-424-website-and-browser-extension/README.md`, section **Owner Validation**, champ `Decision` du 2026-10-11, tel que précisé par `complement-response-2026-10-11.md` (même répertoire), qui prime sur la Recommendation et sur les §8 à §12 du README. Cette tâche est l'élément **X-01** du §3 du complément ; le détail est au **§7** du complément.

Le `Decision`, point 5 : **jeton de l'extension** = lignée `browser_extension` à **portée réduite**, **renouvelée à chaque usage**. Il **expire après 90 jours sans utilisation**, avec un **plafond absolu d'un an depuis l'appairage**. Au-delà, l'extension demande de ré-appairer en un clic. Ces deux durées sont fixées par l'owner : le §7 du complément, qui laissait la durée « à l'implémentation », est remplacé sur ce point.

Elle dépend de la session web (task-473) : l'émission est authentifiée par la session web, et la lignée navigateur y définit le modèle de plafond absolu.

## Périmètre

- **Lignée `browser_extension`**, du même modèle que les lignées existantes (`lineage_id`, rotation, fenêtre de rejeu de 60 s) : expiration après **90 jours sans utilisation**, **plafond absolu d'un an** depuis l'appairage, la rotation ne prolongeant jamais le plafond.
- **Émission** : `POST /api/auth/extension-tokens`, authentifiée par l'access token de la session web ; renvoie le refresh de la nouvelle lignée et sa date d'expiration.
- **Portée** : une revendication du JWT, contrôlée dans la dépendance d'authentification. Un access token de cette lignée n'est accepté que sur `POST /api/media/ingest-url`, `POST /api/media/ingest-shared-content`, la liste des dossiers (choix de la destination) et `/api/auth/refresh` de sa propre lignée. **Tout le reste répond 403.**
- **Liste et révocation** : la liste des extensions reliées (navigateur, date d'appairage, dernier usage) et `DELETE /api/auth/extension-tokens/{lineage_id}`. `/logout` depuis l'extension révoque sa propre lignée. La déconnexion de l'app web **ne révoque pas** l'extension. La suppression du compte efface toutes les lignées.
- **Code de secours** : appairage par code court, affiché par la page Compte et saisi dans la popup : **6 chiffres, 5 minutes, usage unique, détruit après 3 essais**. Il sert quand le message `externally_connectable` ne passe pas.

## Règles

Rien n'est déployé : aucune compatibilité. Pas de tests automatisés ni d'appel in-process de l'app FastAPI comme vérification. Pas de route sous `/api/v1/`. Aucun secret dans les fichiers suivis.

## Note à l'owner

Après déploiement : émettre un jeton d'extension depuis une session web `-dev`, vérifier qu'il ingère une URL et reçoit 403 sur une autre route, le révoquer, puis échanger un code de secours et dépasser 3 essais.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Les routes d'émission, de liste et de révocation des jetons d'extension existent, ainsi que l'émission et l'échange du code de secours (6 chiffres, usage unique, 5 minutes, 3 essais par code)
- [x] #2 La lignée browser_extension expire après 90 jours sans utilisation et ne dépasse jamais un an depuis l'appairage, rotation comprise
- [x] #3 Un access token de cette lignée est refusé en 403 hors de ingest-url, ingest-shared-content, la liste des dossiers et le refresh de sa propre lignée, par une revendication contrôlée dans la dépendance d'authentification
- [x] #4 La déconnexion de l'app web ne révoque pas l'extension, et la suppression du compte efface les lignées d'extension
- [x] #5 docs/AUTHENTICATION_SETUP.md décrit la lignée browser_extension, sa portée, ses durées et le code de secours
- [x] #6 ruff check et mypy passent
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Commit b1ce7cf1.

- **Lignée `browser_extension`** (`LineageKind`, `auth_utils`) : renouvelée à chaque `/refresh`, expire après 90 jours sans usage, plafond absolu d'un an depuis l'appairage, la rotation ne dépasse jamais le plafond (`EXTENSION_REFRESH_IDLE_DAYS` / `EXTENSION_REFRESH_MAX_DAYS`, même mécanique que la lignée `browser` de task-473). Refresh dans le corps JSON. `AuthToken` gagne `client_label` (nom affiché dans la liste) et `failed_attempts` (codes).
- **Portée** : les access tokens de cette lignée portent `scope: extension` (`access_token_payload`, aussi à la rotation). `get_current_user` ne les accepte que sur `POST /api/media/ingest-url`, `POST /api/media/ingest-shared-content`, `GET /api/folders` et `POST /api/auth/logout` ; 403 partout ailleurs. Comparaison sur le chemin de la requête (les quatre routes sont statiques) : le gabarit de route perd son préfixe à partir de FastAPI 0.13x (vérifié sur 0.141.1 avec une mini-app jetable ; l'image installe 0.116.1 depuis `uv.lock`), un écart ne peut que refuser.
- **Routes** `media_summarizer/api/endpoints/extension_tokens.py`, préfixe `/api/auth/extension-tokens` : `POST` (émission, session web), `GET` (liste : lignée, navigateur, appairage, dernier usage, expiration), `DELETE /{lineage_id}` (révocation, 404 hors du compte), `POST /pairing-code` (6 chiffres, 5 min, haché, remplace le précédent), `POST /pairing-code/claim` (non authentifié ; usage unique ; détruit à la 3e erreur ; même 400 `invalid_pairing_code` pour toute erreur).
- Déconnexion web : ne révoque pas l'extension (autre lignée). Suppression du compte : supprime toutes les lignes `auth_tokens` (vérifié dans `account_deletion_service.py`).
- `docs/AUTHENTICATION_SETUP.md` : lignée, portée, durées, routes, code de secours. ruff et mypy passent.

**Déduit, à valider par l'owner** : la réclamation du code demande l'**e-mail du compte** en plus des 6 chiffres. Aucune source ne le formule ; sans identifiant, une erreur ne peut être comptée sur aucun code, et le compteur « 3 essais par code » exigé par le §5.3 du README rejeté du 2026-10-05 serait impossible. task-487 doit donc faire saisir e-mail + code dans la popup.

Note owner : vérification de bout en bout après déploiement, comme décrit dans la description.
<!-- SECTION:FINAL_SUMMARY:END -->
