---
id: TASK-417
title: >-
  Supprimer le décalage d'affichage des sections de l'accueil (Reprendre et
  Revue des non classés arrivent longtemps après Ajouts récents)
status: To Do
assignee: []
created_date: '2026-09-29 10:09'
labels:
  - mobile
  - backend
  - performance
  - observability
dependencies: []
references:
  - mobile/app/(tabs)/inbox.tsx
  - mobile/src/hooks/useHomeSections.ts
  - mobile/src/lib/crashReporting.ts
  - mobile/MOBILE_CI_CD.md
  - media_summarizer/core/services/folder_service.py
  - media_summarizer/utils/user_media.py
  - media_summarizer/core/services/engagement_service.py
priority: high
type: enhancement
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Le symptôme

À l'ouverture de l'app, « Ajouts récents » s'affiche presque immédiatement, tandis que « Reprendre » et « Revue des non classés » n'apparaissent que nettement plus tard, et **toutes les deux en même temps**. Résultat : l'écran se construit par paliers, met un temps notable à être complet, et les blocs déjà visibles se déplacent quand les suivants arrivent.

## Ce que dit déjà le code (lu avant d'écrire cette tâche — à confirmer par Sentry, pas à re-découvrir)

Les trois sections de `mobile/app/(tabs)/inbox.tsx` ne sont pas alimentées symétriquement :

- **« Ajouts récents »** vient de `useMediaList` (`GET /api/media`), et c'est le seul flux qui contrôle le spinner plein écran (`inbox.tsx:286-295`). Il s'affiche donc par construction dès la première réponse.
- **« Reprendre » et « Revue des non classés »** viennent du **même** hook `useHomeSections`, qui fait un `Promise.allSettled([EngagementService.listRecent(12), OrganizationService.getUserFolders()])` et ne commite ses deux `setState` qu'**après que les deux appels sont réglés** (`mobile/src/hooks/useHomeSections.ts:59-73`). D'où l'apparition simultanée et tardive : les deux sections sont cadencées par la plus lente des deux requêtes, alors qu'elles sont indépendantes. Le compteur des non classés est lu sur ces mêmes `folders` (`inbox.tsx:279-282`).
- **Aucun état de chargement n'est exposé, volontairement** (`useHomeSections.ts:19-22` : « no section here may render a spinner … a row with nothing to show is simply absent »). Une section absente puis présente décale tout ce qui est en dessous : c'est la cause directe de l'effet « tout n'apparaît pas au même moment ».

Côté serveur, `GET /api/folders` est le candidat pour « la plus lente » :

- `folder_service.list_folders` (`:148-177`) appelle `ensure_default_folder` `:159`, qui fait un `get_folders_by_user_id` (`folder_service.py:54`), **puis refait le même `get_folders_by_user_id`** `:160`. Deux fois la même Query par requête. (`ensure_default_folder` n'écrit qu'à la toute première fois, quand le dossier par défaut manque — ce n'est pas une écriture par requête.)
- puis `count_media_per_folder` (`media_summarizer/utils/user_media.py:355-367`), qui délègue à `list_library_for_user` `:189-223` : **lecture intégrale et paginée de la partition `user_media`, `ConsistentRead: True`**, juste pour compter. C'est exactement la même lecture intégrale que `GET /api/media` est en train de faire **en parallèle** sur la même partition, plus une troisième si « Reprendre » contient un dossier (`engagement_service._hydrate_folders:238-266`).

Deux pistes secondaires relevées, **hors périmètre** sauf si les points ci-dessus ne suffisent pas — dans ce cas, le dire dans les notes d'implémentation plutôt que d'élargir la tâche :
- chaque fonction de `utils/user_media.py` ouvre sa propre session aiobotocore (`async with session.resource(...)`), donc une poignée de main TLS par Query sur Lambda ;
- il n'y a aucun cache : pas de React Query dans le projet, chaque montage refait tous les appels, rien n'est persisté entre deux lancements.

## Ce qu'il faut faire

1. **Découpler les deux sections** dans `useHomeSections` : chaque source se commite dès que *sa* réponse arrive, sans attendre l'autre. Garder la propriété que le hook documente et qui est bonne (un échec ne vide pas la section et ne traverse pas vers l'autre, la valeur précédente est conservée) — seul le point de synchronisation disparaît.
2. **Réserver la place** pendant le premier chargement, pour que l'arrivée échelonnée ne déplace plus ce qui est déjà lu. Cela demande d'exposer, par source, « première réponse reçue ou non », et de mettre à jour le commentaire d'en-tête du hook (`:19-27`), qui affirme aujourd'hui l'inverse. Un placeholder ne doit apparaître qu'au premier chargement : après résolution, une section vide reste absente comme aujourd'hui (un compte neuf n'a rien à reprendre).
3. **Réduire le coût serveur du chemin de l'accueil** : supprimer le `get_folders_by_user_id` en double dans `list_folders`, et faire en sorte que le compteur des non classés de l'accueil ne coûte plus une lecture intégrale de la partition en doublon de `GET /api/media`. `count_media_in_folder` (`folder_service.py:180`) montre qu'une seule Query `folder-index` suffit pour un dossier. Attention : `media_count` de `list_folders` est aussi consommé par les écrans de dossiers, qui ont réellement besoin de tous les comptes — leur comportement ne change pas.
4. **Instrumenter l'ouverture de l'accueil dans Sentry**, pour que la mesure soit lisible en trace et pas seulement déduite du code. Le terrain est déjà prêt : `tracesSampleRate: 1.0`, `reactNativeTracingIntegration({traceFetch, traceXHR})` et les transactions de navigation Expo Router sont en place depuis task-413 (`mobile/src/lib/crashReporting.ts:183-196`), mais il n'existe **aucun span custom** et les spans HTTP automatiques ne mesurent que la requête, pas le délai jusqu'à l'affichage. Ajouter un span par section, du départ de la requête au commit dans le state, rattaché à la transaction de navigation existante, en suivant les conventions du fichier : helper exporté depuis `crashReporting.ts`, no-op sans DSN, ne throw jamais (même forme que `addPipelineBreadcrumb:239-250`).

## Notes pour l'owner (non vérifiables par l'agent, à faire après merge et déploiement)

- **Lire la trace** : ouvrir l'app sur un build TestFlight, puis dans Sentry → Performance, ouvrir la transaction de navigation de l'accueil et comparer le waterfall des trois spans de section et des spans HTTP `GET /api/media`, `GET /api/engagements/recent`, `GET /api/folders`. C'est là que se confirme (ou s'infirme) le diagnostic ci-dessus, et que se mesure le gain.
- **Vérification visuelle mobile** : à froid, vérifier que rien ne se déplace verticalement une fois le premier contenu affiché.
- Il n'y a **aucun SDK Sentry côté backend** (ni X-Ray, ni Powertools Tracer) : la latence serveur n'est visible que via le log `api.request_slow`, émis seulement au-delà de `API_SLOW_REQUEST_THRESHOLD_MS` (défaut 3000 ms, `media_summarizer/api/main.py:96-127`). La trace ne montrera donc que le temps vu du client. Si l'on veut le découpage client/serveur, c'est une tâche à part.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 useHomeSections commite chaque source indépendamment : continueLearning dès la résolution de GET /api/engagements/recent et folders dès celle de GET /api/folders, sans qu'aucun des deux n'attende l'autre (plus de point de synchronisation unique en amont des deux setState)
- [ ] #2 L'échec d'une des deux requêtes laisse l'autre section commitée et conserve la valeur précédente de celle qui a échoué, sans qu'aucune exception ne traverse vers l'autre source ni vers useMediaList
- [ ] #3 Le hook expose par source l'information « première réponse reçue ou non », et l'accueil s'en sert pour réserver la hauteur des blocs concernés pendant le premier chargement uniquement ; après résolution, une section vide reste absente comme aujourd'hui
- [ ] #4 Le commentaire d'en-tête de useHomeSections.ts (lignes 19-27) est mis à jour : il n'affirme plus qu'aucune section ne peut rendre d'état de chargement, et explique le comportement retenu
- [ ] #5 folder_service.list_folders ne fait plus qu'un seul get_folders_by_user_id par requête (aujourd'hui un dans ensure_default_folder:159 et un second :160), la liste étant lue une fois puis réutilisée
- [ ] #6 Le chemin serveur qui alimente le compteur des non classés de l'accueil n'atteint plus list_library_for_user / count_media_per_folder : tracé depuis l'appel mobile jusqu'au store dans les notes d'implémentation, avec la Query retenue
- [ ] #7 Les écrans de dossiers qui consomment media_count pour tous les dossiers gardent un media_count correct : les appelants sont listés dans les notes d'implémentation avec la vérification faite pour chacun
- [ ] #8 Un span Sentry nommé par section couvre l'ouverture de l'accueil, du départ de la requête au commit dans le state, rattaché à la transaction de navigation existante, no-op sans DSN et ne throw jamais, dans la forme des helpers de crashReporting.ts
- [ ] #9 Les noms et op des nouveaux spans sont documentés dans mobile/MOBILE_CI_CD.md à la suite de la section « Performance tracing »
- [ ] #10 Lint + tsc --noEmit propres sur mobile/, ruff et mypy propres sur media_summarizer/
<!-- AC:END -->
