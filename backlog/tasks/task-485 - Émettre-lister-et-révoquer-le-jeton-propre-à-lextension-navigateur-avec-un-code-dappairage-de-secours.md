---
id: TASK-485
title: >-
  Émettre, lister et révoquer le jeton propre à l'extension navigateur, avec un
  code d'appairage de secours
status: To Do
assignee: []
created_date: '2026-10-11 15:58'
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
dispatchable: true
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
- [ ] #1 Les routes d'émission, de liste et de révocation des jetons d'extension existent, ainsi que l'émission et l'échange du code de secours (6 chiffres, usage unique, 5 minutes, 3 essais par code)
- [ ] #2 La lignée browser_extension expire après 90 jours sans utilisation et ne dépasse jamais un an depuis l'appairage, rotation comprise
- [ ] #3 Un access token de cette lignée est refusé en 403 hors de ingest-url, ingest-shared-content, la liste des dossiers et le refresh de sa propre lignée, par une revendication contrôlée dans la dépendance d'authentification
- [ ] #4 La déconnexion de l'app web ne révoque pas l'extension, et la suppression du compte efface les lignées d'extension
- [ ] #5 docs/AUTHENTICATION_SETUP.md décrit la lignée browser_extension, sa portée, ses durées et le code de secours
- [ ] #6 ruff check et mypy passent
<!-- AC:END -->
