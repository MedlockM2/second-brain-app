---
owner_decision: pending
---

# Benchmark : refléter dans l'app la fin du traitement d'un média sans action de l'utilisateur

## Owner Validation

**Decision**: _(à remplir par l'owner après relecture)_
**Validated at**: _(date ISO à remplir par l'owner)_

---

## Recommendation

**Option 2 + Option 3, dans cet ordre et avec cette hiérarchie : un rafraîchissement client borné et auto-terminant comme mécanisme *garanti*, une notification push visible comme mécanisme *opportuniste* pour l'utilisateur qui a quitté l'app.**

Aucune des deux ne demande un nouveau build EAS. Aucune des deux ne demande une nouvelle brique d'infrastructure. Les deux se livrent en OTA côté mobile, et côté backend l'option 3 est **un seul `sqs.send_message`** dans un worker qui existe déjà, vers une file qui existe déjà, consommée par un worker qui accepte déjà le message.

Six arguments, dans l'ordre de force.

1. **La plainte du testeur porte sur l'app ouverte, et 94,3 % des traitements se terminent en moins de 60 secondes.** Mesuré sur `processing_jobs-dev`, 87 jobs, fenêtre 2026-08-14 → 2026-09-17 : médiane **22,9 s**, p90 **40,2 s**, p95 **68,2 s** (§2). La fenêtre pendant laquelle une vignette reste « en cours » sous les yeux de l'utilisateur est donc typiquement inférieure à la minute. Un mécanisme temps réel permanent (WebSocket, AppSync, MQTT) coûte une nouvelle brique d'infrastructure, une nouvelle authentification, une nouvelle logique de reconnexion et un nouveau transport client — pour gagner, sur cette fenêtre, quelques secondes face à un simple sondage. Le rapport bénéfice/complexité n'est pas là.
2. **Le push silencieux ne peut pas être le mécanisme garanti, et les deux plateformes l'écrivent.** Apple : « Don't try to send more than two or three per hour » et « the system doesn't guarantee their delivery ». Google : une app qui envoie des messages haute priorité **sans afficher de notification** voit ses messages *déprioritisés* — « your messages may be deprioritized to normal priority or delegated for handling by Google Play services », sur une fenêtre d'évaluation de « 7 days of message behavior », « independently for every instance of your application ». Un push data-only dont le seul rôle est de rafraîchir une vignette est exactement le motif que FCM déprioritise. En normal priority, « delivery may be delayed to conserve battery until the device exits doze ». Le push silencieux est donc structurellement **best-effort** : il peut compléter, il ne peut pas garantir (§3.1, §4.4).
3. **Le coût de livraison mobile est asymétrique et tranche.** `expo-notifications` est **déjà** installé (`mobile/package.json`, `~55.0.23`) et son config plugin est **déjà** dans `mobile/app.config.ts` : une notification *visible* est du JS pur côté client (un `addNotificationReceivedListener`, un second canal Android via `setNotificationChannelAsync`) → **OTA gratuite et illimitée**. Un push *silencieux* exige `enableBackgroundRemoteNotifications` (donc `UIBackgroundModes: remote-notification`) et `expo-task-manager`, **absent de `mobile/package.json`** : deux changements de fingerprint → **un build EAS par plateforme**, sur un quota Free de « 15 Android + 15 iOS builds per month, 1 concurrency slot » (`.github/workflows/mobile-ota-or-build.yml`, l. 17-20). Les Live Activities exigent en plus une extension widget. Le sondage et le push visible sont les deux seules approches **entièrement OTA** (§4, colonne « livraison mobile »).
4. **Le sondage borné est déjà l'idiome du dépôt, à trois endroits, et il est déjà réglé.** `useMediaDetailPolling` (3 000 ms, arrêt sur statut terminal, plafond dur de 5 min), le sondage d'artefacts de `mobile/app/media/folders/[id].tsx` (3 000 ms, armé et désarmé par le contenu de la liste) et celui de `CompletedDetailView` (même intervalle, plus un sondage d'aperçu à budget d'essais borné qui dégrade en `{status: "unavailable"}`). L'écran d'accueil est le seul à ne pas l'avoir. Ce n'est pas une nouvelle mécanique à inventer, c'est une mécanique existante à appliquer à une surface qui l'a manquée.
5. **Le coût AWS est négligeable et connu.** Sondage borné (schéma 3 s pendant 60 s puis 10 s jusqu'à 5 min, **8,8 appels par média en moyenne** sur la distribution mesurée) : **€0,54 / €5,39 / €53,90** par mois à 100 / 1 000 / 10 000 utilisateurs actifs. Push visible : **€0,09 / €0,86 / €8,62**. Total de la recommandation : **€0,63 / €6,25 / €62,52**. Un WebSocket API Gateway coûterait €0,19 / €1,89 / €18,89 rattrapage inclus — moins cher que le sondage à 10 000 utilisateurs, mais pour une brique d'infrastructure entière et un transport client à écrire, et sans dispenser de la relecture au retour d'avant-plan (§5.3, §4.5).
6. **La panne est déjà spécifiée par le dépôt, et elle est locale.** Un sondage qui expire n'efface rien : la liste reste affichée, le dernier statut connu reste celui de la dernière réponse, et `pull-to-refresh` existe. Un push perdu ne perd rien non plus : `user_media` est la source de vérité durable, la liste la relira au prochain focus. Aucun des deux mécanismes n'est sur le chemin critique d'une donnée.

**Ce que la recommandation contient exactement.**

- **A. Corriger le prédicat de statut avant tout le reste (bug bloquant, §1.3).** `isProcessingLibraryStatus` teste `ingested`, `resolving`, `processing`. Or `GET /api/media` dérive `status` de `UserMediaRecord.processing_status`, dont le domaine est exactement `pending | processing | ready | failed` (`core/models/user_media.py:55-67`, `core/services/media_search_service.py:364`). **`ingested` et `resolving` sont deux branches mortes, et `pending` — l'état de tout média qui vient d'être enregistré — n'obtient aucun marqueur.** Sans cette correction, aucun mécanisme de rafraîchissement ne peut rendre la bonne vignette : la vignette d'un média fraîchement ajouté n'affiche ni le balayage, ni le badge d'échec. Corriger le prédicat, supprimer les deux valeurs mortes (rien n'est en circulation : `CLAUDE.md`, « Nothing is deployed yet »).
- **B. Armer un sondage borné sur l'écran d'accueil, piloté par le contenu de la liste** (exactement comme `mobile/app/media/folders/[id].tsx` l'est par `hasInFlight`) : armé tant qu'au moins une vignette visible porte un statut non terminal, désarmé dès qu'il n'y en a plus. Schéma **3 s pendant les 60 premières secondes, puis 10 s jusqu'à 5 minutes**, puis arrêt (§7.4 pour le comportement au-delà). Foreground uniquement : `useFocusEffect` désarme au blur.
- **C. Ajouter un rafraîchissement sur `AppState` → `active`.** Trou actuel démontré : `useFocusEffect` ne se redéclenche **pas** quand l'app revient du fond alors que l'onglet est déjà focalisé. L'idiome existe déjà quatre fois dans le dépôt (`AuthContext.tsx:291`, `useDeviceTimezoneSync.ts:79`, `usePushNotifications.ts:62`, `share-confirmation.tsx:112`). JS pur.
- **D. Produire une notification visible « média prêt » depuis `media_completed_worker.py`** vers `push-notification-queue`, consommée par le `push_notification_worker.py` existant. Corps = **un compteur, jamais un titre de média** : contrainte héritée de `docs/research/task-368-push-delivery/README.md` (le personnel Expo peut voir le contenu). Côté client, `setNotificationHandler` supprime la bannière quand l'app est au premier plan et déclenche un `refetch` silencieux à la place ; en arrière-plan la notification s'affiche, et le tap route vers le média. Un second canal Android est nécessaire (`ANDROID_CHANNEL_ID` est figé à `"digest"` dans `mobile/src/services/pushNotificationService.ts:50`) — c'est un appel JS, donc OTA.
- **E. Ne rien faire pour l'échec au-delà de ce qui existe.** `isFailedLibraryStatus` et `MediaFailureBadge` couvrent déjà le statut terminal `failed` ; le sondage s'arrête dessus comme sur `ready`.
- **F (séparable, priorité secondaire). Porter le même marqueur et le même sondage sur Recherche / Bibliothèque.** `MediaListCard` n'affiche **aucun** marqueur « en cours » aujourd'hui (§1.1) : un média fraîchement sauvegardé y ressemble à un média prêt. L'owner peut couper F sans rien retirer à la fermeture de la plainte du testeur, qui porte sur l'Accueil (§7.9).

**Compromis explicitement acceptés.**

- **Le sondage consomme des requêtes quand l'app est ouverte.** Borné à 8,8 appels par média en moyenne, 44 au maximum sur la distribution mesurée (§5.2), soit ≈ 46 Ko gzip (≈ 129 Ko brut) de données par média, la page de 20 lignes étant mesurée à 14,7 Ko brut / 5,2 Ko gzip (§5.1). Le guide Apple d'efficacité énergétique condamne le sondage par timer — mais il le condamne précisément sous la forme du timer qu'on oublie d'invalider : « *Forgetting to stop timers wastes lots of energy, and is one of the simplest problems to fix.* » Et il donne la sortie dans la même page : « *Use timers economically by specifying suitable timeouts.* », « *Invalidate repeating timers when they're no longer needed.* » Un sondage borné, désarmé par le contenu de la liste et vivant seulement sur un écran visible satisfait les trois règles ; c'est `MediaProcessingSweep` aujourd'hui qui les viole (§3.1, §4.2).
- **Le push visible peut être du bruit.** Un utilisateur qui reste dans l'app pendant les 23 secondes de traitement recevrait une notification inutile. C'est pour cela que D suppose la suppression de bannière au premier plan, et c'est pour cela que **D est séparable de A-B-C** : si l'owner veut réduire le lot, A+B+C ferment intégralement la plainte du testeur et n'exigent **aucun** changement backend.
- **Rien n'est temps réel au sens strict.** L'utilisateur peut voir la vignette se figer jusqu'à 3 secondes après la fin réelle du traitement. Sur une médiane de 22,9 s de traitement, c'est 13 % de latence ajoutée sur la perception — et c'est la seule option qui n'ajoute ni build, ni brique.
- **Le cas « traitement anormalement long » n'est pas résolu par le sondage** : au-delà de 5 minutes, c'est D (le push) ou le prochain focus qui rend la main. §7.4 le spécifie.

---

## 1. Inventaire des surfaces qui affichent un média en cours de traitement (AC #1)

### 1.1 Ce que chaque écran affiche, et quand il relit l'état

| Surface | Fichier | Marqueur « en cours » | Marqueur « échec » | Quand l'état est relu |
| --- | --- | --- | --- | --- |
| **Accueil — « Ajouts récents »** (12 vignettes max, `RECENTLY_ADDED_LIMIT = 12`, `inbox.tsx:85`) | `mobile/app/(tabs)/inbox.tsx:535` → `HomeTile` | **Oui** : `MediaProcessingSweep` (`HomeTile.tsx:228`), balayage flou animé de 1 900 ms en boucle | Oui : `MediaFailureBadge` | **Au montage, au focus de l'onglet, au pull-to-refresh. Rien d'autre.** `useMediaPolling` : « V1 design: no recurring network requests while the inbox is open » (`useMediaPolling.ts:28`). `useFocusEffect` en `inbox.tsx:149-155`, `RefreshControl` en `inbox.tsx:329`. |
| **Accueil — « Continue learning » / dossiers** | `inbox.tsx:141` → `useHomeSections` | Non | Non | Au focus (`inbox.tsx:151`, `void refreshSections()`) |
| **Recherche / Bibliothèque** (3 rendus de lignes) | `mobile/app/(tabs)/search.tsx:367`, `:691`, `:896` → `MediaListCard` | **Non.** `MediaListCard.tsx:27` n'importe que `isFailedLibraryStatus` ; aucun balayage, aucun libellé « en cours » | Oui (`MediaListCard.tsx:226`) | Au focus (`search.tsx:264`), silencieusement sous le contenu existant |
| **Détail d'un dossier** | `mobile/app/media/folders/[id].tsx` | Non pour les médias. **Oui pour les artefacts** : statuts `queued` / `generating`, sondage à `ARTIFACT_POLL_INTERVAL_MS = 3000` armé/désarmé par le contenu de la liste | Non pour les médias | `useFocusEffect` (`:190`) + sondage 3 s tant qu'un artefact est en vol |
| **Triage « non classés »** | `mobile/app/media/unsorted-review.tsx` | Non | Non | **Au montage uniquement, jamais au focus** — et c'est délibéré : « a refetch would reshuffle the queue and renumber every index under it, and the next swipe would land somewhere else » |
| **Détail d'un média** | `mobile/app/media/[id].tsx:61` → `useMediaDetailPolling` | **Oui** : états `loading` / `processing` / `completed` / `failed` / `timeout` / `error` | Oui | **Sondage 3 s** (`POLL_INTERVAL_MS = 3000`), arrêt sur statut terminal de `processing_job`, plafond dur `TIMEOUT_MS = 5 * 60 * 1000` |
| **Onglet Digest** | `mobile/app/(tabs)/digest.tsx:429` → `useMediaDetailPolling` | Oui (même hook) | Oui | Même sondage 3 s |
| **Détail complété (artefacts + aperçu source)** | `mobile/src/components/CompletedDetailView.tsx` | Oui : sondage d'artefacts 3 s (`:489`) + sondage d'aperçu borné (`:772`, `PREVIEW_POLL_MAX_ATTEMPTS` / `PREVIEW_POLL_DELAY_MS`) qui dégrade en `{status: "unavailable"}` | Oui | `useFocusEffect` (`:282`) + les deux sondages |

`HomeTile` n'est rendu **que** par l'écran d'accueil (`inbox.tsx:535` est le seul appel dans tout `mobile/`). `MediaProcessingSweep` n'a donc **qu'un seul consommateur**, et c'est le seul écran de la liste qui n'a pas de sondage.

### 1.2 La cause racine, écrite dans le dépôt

`mobile/src/components/MediaProcessingSweep.tsx:39` documente déjà le défaut :

> One thing it cannot do is stop on its own. `useMediaPolling` fetches once on mount and then only refetches when the screen regains focus ("V1 design: no recurring network requests while the inbox is open"), so the sweep keeps running until the next refetch even if the server finished in the meantime. That is a property of the repo today, not of this component.

Le nom du hook est trompeur : `useMediaPolling` **ne sonde pas**. Il expose `refresh()` (avec spinner, pour le geste) et `refetch()` (silencieux, pour le focus).

**Second trou, non documenté :** `useFocusEffect` ne se redéclenche pas quand l'app revient du fond alors que l'onglet Accueil est **déjà** focalisé. Il n'existe aucun écouteur `AppState` sur cet écran (les quatre du dépôt sont dans `AuthContext.tsx:291`, `useDeviceTimezoneSync.ts:79`, `usePushNotifications.ts:62`, `share-confirmation.tsx:112`). Scénario reproductible : ajouter un média, mettre l'app en fond, revenir 5 minutes plus tard → la vignette balaie toujours.

### 1.3 Troisième trou, trouvé pendant l'inventaire : le prédicat teste des valeurs que l'endpoint n'émet jamais

```ts
// mobile/src/components/MediaProcessingSweep.tsx
export function isProcessingLibraryStatus(status?: string | null): boolean {
  return (
    status === "ingested" || status === "resolving" || status === "processing"
  );
}
```

Chaîne de preuve, côté backend :

1. `GET /api/media` sérialise `"status": record.processing_status.value if record.processing_status else None` (`core/services/media_search_service.py:364`).
2. `UserMediaStatus` vaut exactement `pending | processing | ready | failed` (`core/models/user_media.py:55-67`).
3. La projection job → bibliothèque n'a que ces quatre images (`core/services/durable_media_service.py:62-72`, `_JOB_STATUS_TO_LIBRARY_STATUS`), appliquée par `mirror_job` (`:528-551`).
4. La création écrit `processing_status=UserMediaStatus.PENDING` par défaut (`durable_media_service.py:121`).
5. `ingested` / `resolving` appartiennent à `MediaItemStatus` (`api/models/media_contracts.py:65-72`), le vocabulaire du contrat **de détail** — pas celui de la liste.
6. Vérifié à froid : un scan de `user_media-dev` (93 lignes, 2026-09-18) ne contient que `ready` (86) et `failed` (7). Aucun `ingested`, aucun `resolving`.

**Conséquences :** `ingested` et `resolving` sont deux branches mortes sur cette surface, et **`pending` — l'état de tout média venant d'être enregistré — n'obtient aucun marqueur** : ni balayage, ni badge. La vignette d'un média tout juste ajouté est donc rendue comme un média prêt, avec un titre provisoire et sans image, jusqu'à ce que le premier `mirror_job` la fasse passer à `processing`. Aucun mécanisme de rafraîchissement, quel qu'il soit, ne peut corriger cela : c'est un bug de prédicat, à corriger d'abord.

---

## 2. Durées de traitement réelles mesurées sur `-dev` (AC #2)

### 2.1 Méthode

- **Source** : table DynamoDB `processing_jobs-dev`, région `eu-west-3`, lue le **2026-09-18**.
- **Commande** : `aws dynamodb scan --table-name processing_jobs-dev --projection-expression "created_at,started_at,completed_at,job_status,media_type,source_platform,total_duration"`. Résultat : `Count = 87`, `ScannedCount = 87`, **pas de `LastEvaluatedKey`** → la table entière a été lue, il n'y a pas de page manquante.
- **Grandeur mesurée** : `completed_at − created_at`, c'est-à-dire **de l'enregistrement du média à son statut terminal**, latence de file incluse. C'est la grandeur que voit l'utilisateur, et elle est plus large que `total_duration` (qui compte `completed_at − started_at` ; les deux concordent à moins d'une seconde sur les 87 lignes).
- **Percentiles** : rang le plus proche, `v[ceil(p/100 × n) − 1]` sur la série triée. Pas d'interpolation.
- **Fenêtre couverte** : `created_at` de **2026-08-14T01:08:51Z** à **2026-09-17T08:34:15Z**, soit 34 jours.
- **Pas de troncature par TTL** : `expire_at` vaut `now + PROCESSING_JOBS_TTL_DAYS` jours, défaut **90** (`core/models/processing_job.py:17-34`), et il est repoussé à chaque changement de statut. Aucune ligne de la fenêtre n'a pu expirer.
- **Limite de validité** : les 87 jobs proviennent des testeurs TestFlight et de l'owner, pas d'une population représentative. Les cellules `n ≤ 2` sont indicatives et signalées comme telles.
- **Aucun attribut de la table n'est reproduit ici.** `processing_jobs` porte un attribut `user_email` ; il n'a pas été projeté et aucune valeur d'identité n'apparaît dans ce document.

### 2.2 Résultat global (secondes, `completed_at − created_at`)

| Population | n | min | médiane | p90 | p95 | max |
| --- | --- | --- | --- | --- | --- | --- |
| **Tous les jobs terminés** | 87 | 0,3 | **22,9** | **40,2** | **68,2** | **3 100,0** |
| Terminés en succès (`completed`) | 81 | 0,3 | 23,3 | 40,2 | 68,2 | 3 100,0 |
| Terminés en échec (`failed`) | 6 | 5,8 | 7,9 | 31,7 | 31,7 | 31,7 |
| Tous les jobs, 14 derniers jours de la fenêtre | 57 | 0,3 | 17,5 | 38,1 | 40,2 | **68,2** |

Fonction de répartition, sur les 87 :

| Seuil | Part des jobs terminés en dessous |
| --- | --- |
| ≤ 10 s | 33,3 % |
| ≤ 30 s | 67,8 % |
| ≤ 60 s | **94,3 %** |
| ≤ 120 s | 96,6 % |

### 2.3 Par type de média

| `media_type` | n | min | médiane | p90 | p95 | max |
| --- | --- | --- | --- | --- | --- | --- |
| `short_video` (Instagram / TikTok) | 24 | 8,6 | 32,2 | 40,6 | 100,6 | 1 881,3 |
| `document` | 24 | 3,2 | 21,2 | 34,1 | 38,1 | 45,1 |
| `article` | 22 | 0,3 | **6,4** | 8,7 | 11,0 | 17,0 |
| `youtube_video` | 12 | 8,2 | 35,9 | 2 823,4 | 3 100,0 | 3 100,0 |
| `podcast_episode` | 2 | 24,6 | 24,6 | 25,8 | 25,8 | 25,8 |
| `audio_file` | 2 | 6,7 | 6,7 | 7,7 | 7,7 | 7,7 |
| `image_post` | 1 | 32,5 | 32,5 | 32,5 | 32,5 | 32,5 |

### 2.4 Par plateforme source

| `source_platform` | n | médiane | p90 | max |
| --- | --- | --- | --- | --- |
| `document` | 24 | 21,2 | 34,1 | 45,1 |
| `instagram` | 23 | 32,5 | 40,6 | 1 881,3 |
| `web` | 21 | 6,4 | 8,7 | 17,0 |
| `youtube` | 12 | 35,9 | 2 823,4 | 3 100,0 |
| `spotify` | 2 | 24,6 | 25,8 | 25,8 |
| `tiktok` | 2 | 11,1 | 11,7 | 11,7 |
| `whatsapp` | 2 | 6,7 | 7,7 | 7,7 |
| `x` | 1 | 6,7 | 6,7 | 6,7 |

### 2.5 Latence de mise en file (`started_at − created_at`)

| n | min | médiane | p90 | p95 | max |
| --- | --- | --- | --- | --- | --- |
| 87 | 0,1 | **0,4** | 5,0 | 6,2 | 8,6 |

La file n'est jamais le poste de latence : le temps est passé dans le traitement, pas dans l'attente.

### 2.6 La queue de distribution : cinq jobs au-dessus de 60 s

| durée | type | plateforme | `created_at` |
| --- | --- | --- | --- |
| 68,2 s | `youtube_video` | youtube | 2026-09-05T09:37:12 |
| 100,6 s | `short_video` | instagram | 2026-08-18T02:47:45 |
| 1 881,3 s | `short_video` | instagram | 2026-08-20T16:26:05 |
| 2 823,4 s | `youtube_video` | youtube | 2026-08-20T16:34:10 |
| 3 100,0 s | `youtube_video` | youtube | 2026-08-20T16:29:27 |

**Les trois valeurs au-delà de 1 000 s sont concentrées sur huit minutes du 2026-08-20** : c'est un incident fournisseur unique (les trois plateformes concernées passent par Apify), pas la queue naturelle de la distribution. Hors ce créneau, le maximum observé sur 34 jours est **100,6 s**, et sur les 14 derniers jours **68,2 s**.

**Conséquence de dimensionnement** : un plafond client à 5 minutes couvre 100 % des jobs hors incident fournisseur, et le dépôt utilise déjà exactement ce plafond (`useMediaDetailPolling.ts`, `TIMEOUT_MS = 5 * 60 * 1000`). Un plafond plus court (60 s) laisserait 5,7 % des médias sans mise à jour automatique ; un plafond plus long ne changerait rien pour 100 % des jobs hors incident, et pour un incident il faut un autre mécanisme (§7.4).


---

## 3. Les approches documentées par les plateformes et observées dans des apps établies (AC #3)

Dix approches distinctes ressortent de la documentation Apple / Google / Expo et de l'observation d'apps
établies. Toutes les affirmations de cette section sont sourcées ; la liste complète des URLs avec date de
consultation est en §9. Sauf mention contraire, **toutes les pages ont été consultées le 2026-09-18**.

Les dix sont numérotées ici une fois pour toutes ; §4, §5 et §6 les reprennent dans le même ordre.

| # | Approche | Nature | Statut chez nous |
|---|----------|--------|------------------|
| 1 | Relecture sur événement utilisateur (focus d'écran, pull-to-refresh) | client | **déjà en place** — c'est le statu quo qui produit le bug |
| 2 | Polling client borné et auto-terminé (+ relecture sur retour d'avant-plan) | client | idiome déjà présent 3× dans le dépôt |
| 3 | Push **visible** (notification système) déclenchant une relecture | serveur → client | tuyau déjà en place (`push-notification-queue`, worker Expo) |
| 4 | Push **silencieux** / background (`content-available`, data-only FCM) | serveur → client | non configuré, exige un build natif |
| 5 | Connexion persistante WebSocket (API Gateway WebSocket API) | serveur → client | inexistante |
| 6 | Abonnement temps réel managé (AWS AppSync Events / GraphQL subscriptions) | serveur → client | inexistante |
| 7 | Broker MQTT-over-WebSocket (AWS IoT Core) | serveur → client | inexistante |
| 8 | Tâche périodique en arrière-plan (`expo-background-task` / BGTaskScheduler / WorkManager) | client | non configuré, exige un build natif |
| 9 | Surface système dédiée au suivi d'activité (Live Activities iOS / Live Updates Android 16) | client + serveur | non configuré, exige une extension native |
| 10 | Flux HTTP tenu ouvert (SSE, long-polling) | serveur → client | **non viable** sur notre stack (§4.10) |

### 3.1 Ce que les plateformes recommandent explicitement

**Apple — ne pas interroger, réagir à des événements.** L'*Energy Efficiency Guide for iOS Apps* est direct :
« *Apps often use timers unnecessarily. If you use timers in your app, consider whether you truly need them.
For example, some apps use timers to poll for state changes when they should respond to events instead.* » et
« *Some apps use timers to monitor for changes to file contents, network availability, and other state changes.
Timers prevent the CPU from going to or staying in the idle state, which increases energy usage and consumes
battery power.* » Trois règles y sont posées : « *Use timers economically by specifying suitable timeouts.* »,
« *Invalidate repeating timers when they're no longer needed.* », « *Set tolerances for when timers should
fire.* » — avec le seuil chiffré : « *A general guideline is to set the tolerance to at least ten percent of the
interval for a repeating timer* ». Et sur l'oubli d'arrêt, qui est exactement notre bug à l'envers :
« *If you use a repeating timer, invalidate or cancel it when you no longer need it. Forgetting to stop timers
wastes lots of energy, and is one of the simplest problems to fix.* »
([Energy Efficiency Guide for iOS Apps — Minimize Timer Use](https://developer.apple.com/library/archive/documentation/Performance/Conceptual/EnergyGuide-iOS/MinimizeTimerUse.html),
document archivé, dernière mise à jour affichée 2016-09-13, consulté 2026-09-18)

À lire correctement : Apple condamne le **timer non borné qu'on oublie d'invalider**, pas le rafraîchissement
d'une liste que l'utilisateur regarde. La même page pose la sortie : *specify suitable timeouts*, *invalidate
when no longer needed*, *set tolerances*. C'est la définition de l'option 2 telle que §7 la spécifie, et la
condamnation littérale de ce que le dépôt fait aujourd'hui dans `MediaProcessingSweep` — une animation qui
tourne sans fin parce que personne ne la désarme.

**Apple — le push background n'est pas un canal fiable.** « *The system treats background notifications as low
priority: you can use them to refresh your app's content, but the system doesn't guarantee their delivery. In
addition, the system may throttle the delivery of background notifications if the total number becomes
excessive. The number of background notifications allowed by the system depends on current conditions, but
don't try to send more than two or three per hour.* » Le système ne garde que le dernier : « *When the system
receives a new background notification, it discards the older notification and only holds the newest one.* » Et
un kill manuel l'annule : « *If something force quits or kills the app, the system discards the held
notification.* » Le handler dispose de « *30 seconds to perform any tasks and call the provided completion
handler* ». Côté envoi, il faut `apns-push-type: background`, `apns-priority: 5`, une charge `aps` ne contenant
que `content-available`, et l'entitlement Background Modes → Remote notification.
([Pushing background updates to your app](https://developer.apple.com/documentation/usernotifications/pushing-background-updates-to-your-app), consulté 2026-09-18)

**Google — Doze coupe le réseau, et FCM est la sortie officielle.** En Doze, Android « *Suspends network
access.* », « *Ignores wake locks.* », « *Doesn't let `JobScheduler` run.* » et « *`WorkManager` uses
`JobScheduler` internally, so `WorkManager` tasks don't run.* » Le travail différé n'est rattrapé que pendant
les fenêtres de maintenance, dont l'espacement croît. Deux phrases décident de l'architecture :
« *FCM high priority messages let you wake your app to engage the user, if the message is time-sensitive… FCM
gives the app temporary access to network services and partial wakelocks* » et surtout
« *we strongly recommend you use FCM if possible, rather than maintaining your own persistent network
connection* ». Sur les messages qui ne produisent pas de notification : « *For messages that don't result in
notifications, such as those that keep app content up to date, use normal priority FCM messages. If the device
is in Doze mode, they are delivered during the periodic Doze maintenance windows.* » Enfin, demander une
exemption est un risque de policy : « *Google Play policies prohibit apps from requesting direct exemption from
Power Management features in Android 6.0+ (Doze and App Standby) unless the core function of the app is
adversely affected.* » Accessoirement, l'alarme exacte n'est pas une échappatoire : « *Neither
`setAndAllowWhileIdle()` nor `setExactAndAllowWhileIdle()` can fire alarms more than once per nine minutes, per
app.* »
([Optimize for Doze and App Standby](https://developer.android.com/training/monitoring-device-state/doze-standby), consulté 2026-09-18)

**Google — un data-only qui n'affiche rien se fait déprioriser.** FCM distingue notification messages et data
messages : le SDK affiche automatiquement les premiers, seuls les seconds passent par le code de l'app
([Message types](https://firebase.google.com/docs/cloud-messaging/customize-messages/set-message-type), consulté
2026-09-18 ; charge utile plafonnée à 4096 octets). Mais la page *Understand message delivery* prévient : les
messages haute priorité qui n'aboutissent pas à une notification visible « *may be deprioritized to normal
priority or delegated for handling by Google Play services* », la décision reposant sur l'historique — « *FCM
uses 7 days of message behavior* » — et prise « *independently for every instance of your application* ». La même
page documente la limite de 100 messages en attente par appareil déconnecté, au-delà de laquelle FCM envoie
`onDeletedMessages`.
Et se rabattre sur la priorité normale ne sauve rien : « *Normal priority messages are delivered immediately when
the device is not sleeping. When the device is in Doze mode, delivery may be delayed to conserve battery until the
device exits doze.* »
([Understand message delivery](https://firebase.google.com/docs/cloud-messaging/understand-delivery), consulté
2026-09-18 ; [Message priority](https://firebase.google.com/docs/cloud-messaging/android/message-priority),
consulté 2026-09-18)

Conséquence à retenir : l'approche 4 sur Android n'est pas seulement best-effort par contrat, elle est
best-effort *de façon adaptative contre nous*, précisément parce qu'un push de rafraîchissement n'affiche rien.

**Google — la surface « Live Update » d'Android 16 exclut notre cas.** `Notification.ProgressStyle` est réservé
aux activités « *ongoing, user-initiated, and time-sensitive* », et la doc pose l'exclusion en clair :
« *Don't allow activities triggered by other parties to generate Live Updates* », en citant nommément le suivi
de colis comme contre-exemple. Techniquement il faut `POST_PROMOTED_NOTIFICATIONS`,
`EXTRA_REQUEST_PROMOTED_ONGOING` et le flag ongoing.
([Live Updates](https://developer.android.com/develop/ui/views/notifications/live-updates), consulté 2026-09-18)

**Apple — même verdict côté Live Activities, par la durée.** Une Live Activity exige une widget extension, et
sa fenêtre est bornée : huit heures d'activité, puis le système y met fin, l'écran verrouillé la conservant
jusqu'à quatre heures de plus — 12 h au total. Le contenu est tronqué au-delà de 160 pt de hauteur.
([ActivityKit — Displaying live data with Live Activities](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities), consulté 2026-09-18)

**Expo — le push visible est du JS, le push silencieux est un build.** `expo-notifications` expose
`addNotificationReceivedListener`, qui « *will be called whenever a notification is received while the app is
running* », et `setNotificationHandler`, qui « *should respond with a behavior object within 3 seconds,
otherwise, the notification will be discarded* » (comportement par défaut : « *is not to show the
notification* »). Les notifications **background**, elles, exigent `expo-task-manager`, une charge qui
« *Contains only the `data` key (no `title`, `body`)* » et « *Has `_contentAvailable: true` set for iOS* », plus
la propriété de plugin iOS `enableBackgroundRemoteNotifications` (défaut `false`) qui « *updates the
`UIBackgroundModes` key in the `Info.plist` to include `remote-notification`* ». Et le plugin couvre par
définition des « *properties that cannot be set at runtime and require building a new app binary to take
effect* ».
([expo-notifications](https://docs.expo.dev/versions/latest/sdk/notifications/), consulté 2026-09-18)

**Expo — le service de push n'a pas de SLA.** « *The Expo push notification service does not have an SLA and
the FCM and APNs services also may have occasional outages.* » Débit : « *600 notifications per second per
project* », par lots de « *an array of up to 100 message objects* » ; les reçus doivent être relus
(« *We recommend checking push receipts 15 minutes after sending your push notifications.* ») et
« *are cleared after 24 hours* ».
([Sending notifications with Expo's Push Service](https://docs.expo.dev/push-notifications/sending-notifications/), consulté 2026-09-18)

**Expo — la tâche de fond ne descend pas sous 15 minutes.** `expo-background-task` : « *minimum 15 minutes* »,
et « *The system controls the background task execution interval and treats the specified value as a minimum
delay* » — « *Tasks won't run exactly on schedule* ». iOS exige `UIBackgroundModes: ["processing"]` et
`BGTaskSchedulerPermittedIdentifiers`, le module est « *unavailable on iOS simulators. It is only available when
running on a physical device.* », et « *you need to run prebuild to apply the changes to your app's
configuration* ».
([expo-background-task](https://docs.expo.dev/versions/latest/sdk/background-task/), consulté 2026-09-18)

Rapproché de §2 : notre médiane est de **22,9 s** et 94,3 % des jobs terminent sous 60 s. Une granularité
plancher de 15 minutes est deux ordres de grandeur au-dessus de l'événement à refléter. L'approche 8 est
disqualifiée par arithmétique, pas par préférence.

### 3.2 Ce que font les apps établies

Quatre comportements observables, documentés par les éditeurs eux-mêmes. Ils convergent : **une surface visible
pendant qu'on la regarde + une notification quand on est parti**.

| App | Ce que la doc de l'éditeur décrit | Approche correspondante | Source (consultée 2026-09-18) |
|-----|-----------------------------------|-------------------------|--------|
| Google Photos | Un état de sauvegarde consultable dans l'app pendant l'opération, par élément, et un réglage explicite de notifications pour être averti de la fin ou de l'échec | 1 + 2 en avant-plan, 3 hors app | [Sauvegarder photos et vidéos](https://support.google.com/photos/answer/6193313) |
| Dropbox | Une icône de statut de synchro par fichier dans le client, et des notifications système signalant fin ou échec ; la synchro continue hors app via le service natif | 2 (surface locale) + 3 | [Sync icons](https://help.dropbox.com/sync/sync-icons) |
| YouTube (upload) | Un écran de traitement qui progresse tant qu'on le regarde, puis une notification quand la vidéo est prête | 1 + 2, puis 3 | [Upload videos](https://support.google.com/youtube/answer/57407) |
| Descript | Un panneau de statut de synchro consultable *depuis l'app* — « Monitor file syncing from the app » — plutôt qu'un canal temps réel | 2 | [Monitor file syncing](https://help.descript.com/hc/en-us/articles/10164999594381) |

Aucune de ces quatre n'expose de connexion temps réel pour ce cas. Le motif dominant est exactement la paire que
§7 spécifie : **la relecture bornée pendant que l'écran est visible** (le seul mécanisme garanti, parce qu'il ne
dépend d'aucun tiers) et **la notification visible** quand l'utilisateur n'est plus là (le seul mécanisme qui
atteint quelqu'un qui a quitté l'app). Le WebSocket, l'abonnement managé et le broker MQTT existent — ce sont les
approches 5, 6 et 7, et §4 les évalue honnêtement — mais ils sont l'outillage d'un curseur partagé ou d'un chat,
pas d'un événement unique par média espacé de 22,9 s en médiane.

---

## 4. Chaque approche, comportement par comportement (AC #4)

Grille commune : délai de mise à jour ; traitement très long ; échec ; app mise en arrière-plan puis reprise ;
réseau faible ou absent ; coût batterie ; coût données ; delta backend/infra sur *notre* stack ; coût de
livraison mobile (OTA ou build). Les chiffres de délai s'appuient sur les mesures de §2 (médiane 22,9 s,
p90 40,2 s, 94,3 % sous 60 s), ceux de données sur la charge réelle de `GET /api/media` mesurée en §5.1.

### 4.0 Le fait qui départage : ce qui passe en OTA et ce qui exige un build

Le pipeline `.github/workflows/mobile-ota-or-build.yml` compare l'empreinte Expo (`runtimeVersion.policy:
"fingerprint"`) : empreinte inchangée → mise à jour OTA, gratuite et illimitée sur le plan gratuit (EAS Update
Free : 1 000 MAU, updates illimités) ; empreinte modifiée → un build EAS par plateforme, contre un quota gratuit
de **15 builds iOS et 15 builds Android par mois, un seul créneau de concurrence**
([EAS pricing](https://expo.dev/pricing), consulté 2026-09-18 ; valeurs également recopiées en commentaire dans
le workflow, l. 17-20).

Conséquence : toute approche qui ajoute un module natif autolinké, une entitlement, une permission de manifeste
ou une clé `Info.plist` consomme un des 15 builds — et impose au testeur TestFlight de réinstaller. Toute
approche purement JS/TS descend en OTA le jour même. C'est le critère le plus discriminant du benchmark, et il
sépare les options 3 et 4 alors qu'elles se ressemblent sur le papier.

Vérification faite dans le dépôt, l'infrastructure du push visible est **déjà entièrement en place** :

- `expo-notifications` est déjà dans les plugins de `mobile/app.config.ts` (l. 381) et le build TestFlight
  courant l'embarque : `mobile/src/hooks/usePushNotifications.ts` enregistre le device et route les taps.
- `PUSH_NOTIFICATION_QUEUE` est injecté dans **tous** les Lambdas via `local.lambda_environment`
  (`infrastructure/terraform/modules/platform/runtime_env.tf`, l. 71).
- Le rôle partagé `aws_iam_role.lambda_worker` accorde déjà `sqs:SendMessage` sur
  `aws_sqs_queue.push_notification` (`iam_lambda.tf`, l. 46-75) — donc au worker
  `media_completed_events` aussi.

Autrement dit : produire un push de fin de traitement ne demande **aucune ressource Terraform nouvelle**, un
`send_message` Python dans `media_summarizer/workers/events/media_completed_worker.py`, et du JS côté app. Zéro
build.

### 4.1 Option 1 — relecture sur événement utilisateur (statu quo)

| Critère | Comportement |
|---|---|
| Délai de mise à jour | **Non borné.** Tant que l'écran reste au premier plan, aucune relecture. C'est le bug rapporté. |
| Traitement très long | Identique : rien ne change à l'écran, jamais. |
| Échec | La vignette continue d'animer un balayage « en cours » alors que le job a échoué. Le badge d'échec n'apparaît qu'après une relecture provoquée. |
| Arrière-plan → reprise | **Aucune mise à jour.** `useFocusEffect` ne se redéclenche pas quand l'onglet était déjà focalisé, et `inbox.tsx` n'a pas d'écouteur `AppState` (§1.2). |
| Réseau faible/absent | La relecture échoue, l'état gelé reste affiché. |
| Batterie | Minimale : une requête par focus d'écran. |
| Données | ~5,2 Ko gzip par focus (§5.1). |
| Delta backend | Aucun. |
| Livraison mobile | Sans objet. |

**Verdict** : c'est le point de départ, pas une option. À conserver dans tous les cas comme filet (le
pull-to-refresh reste la sortie de secours), mais il ne répond pas à « sans que l'user ait à cliquer ».

### 4.2 Option 2 — polling client borné et auto-terminé, plus relecture sur retour d'avant-plan

Le programme retenu en §7 : 3 s pendant les 60 premières secondes, puis 10 s jusqu'à 5 min, armé uniquement si
la liste contient au moins un média non terminal, désarmé dès qu'elle n'en contient plus.

| Critère | Comportement |
|---|---|
| Délai de mise à jour | ≤ 3 s pour **94,3 %** des médias (ceux qui terminent sous 60 s, §2.2), ≤ 10 s ensuite. |
| Traitement très long | Le budget expire à 5 min ; la vignette passe alors à un état « toujours en cours » **non animé** et le polling s'arrête. Le retour d'avant-plan le réarme. Les cinq jobs > 60 s de §2.6 sont couverts jusqu'à 5 min ; au-delà, c'est l'option 3 qui reprend la main. |
| Échec | Le badge d'échec apparaît au tick suivant, même latence que le succès. Aucun code spécifique : le statut terminal `failed` sort du prédicat et la vignette se réévalue. |
| Arrière-plan → reprise | L'écouteur `AppState` relit immédiatement à `active` et réarme le programme si la liste porte encore un non-terminal. C'est l'idiome déjà employé 4× dans le dépôt (`share-confirmation.tsx` l. 112, `AuthContext.tsx` l. 291, `useDeviceTimezoneSync.ts` l. 79, `usePushNotifications.ts` l. 62). |
| Réseau faible/absent | Chaque tick est une requête indépendante : un échec est ignoré, l'état affiché ne change pas (et il est vrai — le média *est* en cours), le tick suivant réessaie. Le budget compte les tentatives, donc un appareil hors ligne s'auto-termine quand même. |
| Batterie | Réveils bornés, **uniquement** quand l'écran est visible et qu'un média est non terminal. Modélisé sur les 87 durées réelles : moyenne **8,8** requêtes par sauvegarde, médiane 8, p90 14, max 44 (§5.2). Aucun réveil quand la bibliothèque est au repos — ce qui est l'état 99 % du temps. |
| Données | 8,8 × 5,2 Ko gzip ≈ **46 Ko** par sauvegarde (mesuré), ≈ 70 Ko si l'on compte les URLs présignées de vignettes (estimation, §5.1). |
| Delta backend | **Aucun.** Zéro ressource Terraform, zéro ligne Python. |
| Livraison mobile | **OTA.** Purement JS/TS : un hook, un écouteur `AppState`, le prédicat corrigé. |

**La réserve d'Apple, traitée.** L'*Energy Efficiency Guide* condamne le timer qu'on oublie d'invalider (§3.1).
Ici le timer a un timeout explicite, s'invalide dès que la liste n'a plus de non-terminal, et ne vit que sur un
écran visible. Les trois règles de la page sont satisfaites par construction. Une tolérance de 10 % sur
l'intervalle est un raffinement gratuit à appliquer si `setInterval` le permettait — il ne le permet pas en JS,
ce qui est une limite de React Native et non de l'approche.

### 4.3 Option 3 — push visible déclenchant une relecture

| Critère | Comportement |
|---|---|
| Délai de mise à jour | Quelques secondes après le statut terminal **si** le push est délivré. Aucune garantie : « *The Expo push notification service does not have an SLA* » (§3.1). |
| Traitement très long | **C'est son terrain.** À 1 881 s ou 3 100 s (§2.6) l'utilisateur a quitté l'app depuis longtemps ; seul un push le ramène. |
| Échec | Un push annonçant un échec est un choix de produit, pas une contrainte technique. §7 tranche : non — on ne réveille pas quelqu'un pour lui annoncer une mauvaise nouvelle qu'il n'a pas demandée. |
| Arrière-plan → reprise | Le tap ouvre l'app, le focus déclenche la relecture. Le chemin existe déjà (`usePushNotifications.ts` route les taps), il lui manque une branche sur `data.type`. |
| Réseau faible/absent | APNs et FCM font du store-and-forward : le push arrive au retour du réseau. Sur Android, plafond de 100 messages en attente par appareil déconnecté, puis `onDeletedMessages` (§3.1). |
| Batterie | Un réveil par média. Négligeable, et c'est le canal que Google recommande explicitement plutôt qu'une connexion persistante (§3.1). |
| Données | La charge du push (quelques centaines d'octets) plus une relecture de ~5,2 Ko gzip. |
| Delta backend | Un `sqs.send_message(queue_name=PUSH_NOTIFICATION_QUEUE, …)` dans `media_completed_worker.py`, sur le modèle exact de `workers/digest/scheduler.py` l. 217-228. **Aucun** changement Terraform (§4.0). |
| Livraison mobile | **OTA.** Un second canal Android via `setNotificationChannelAsync` (appel JS), un `addNotificationReceivedListener` — absent aujourd'hui — pour relire la liste quand le push arrive app ouverte, et une branche de routage sur `data.type` dans `usePushNotifications.ts`. |

**La faiblesse structurelle.** Le push dépend d'une permission que l'utilisateur peut refuser, et le dépôt
assume déjà ce refus sans le contourner : « *A refusal ends the attempt and nothing else. No state is exposed,
no screen reads this hook, and there is no interface anywhere that behaves differently for a user who said no.* »
(`usePushNotifications.ts`, docstring). Un utilisateur qui a dit non ne verra **jamais** sa vignette se mettre à
jour si le push est le seul mécanisme. C'est la raison pour laquelle §7 fait de l'option 2 le mécanisme garanti
et de l'option 3 le mécanisme opportuniste, et non l'inverse.

**La contrainte de contenu, héritée de task-368.** Le corps de la notification reste un compteur, jamais un
titre de média : `docs/research/task-368-push-delivery/README.md` (décision owner validée) pose que le contenu
transitant par le service Expo ne doit rien révéler de la bibliothèque de l'utilisateur. Un push « 1 média est
prêt » respecte cette règle ; un push « *Votre résumé de <titre> est prêt* » la viole.

### 4.4 Option 4 — push silencieux (background / data-only)

| Critère | Comportement |
|---|---|
| Délai de mise à jour | Best-effort, et **activement dégradé**. Apple : « *the system doesn't guarantee their delivery* », « *don't try to send more than two or three per hour* ». Google : un data-only qui n'affiche rien « *may be deprioritized to normal priority or delegated for handling by Google Play services* », sur la base de « *7 days of message behavior* », décidé « *independently for every instance of your application* » (§3.1). |
| Traitement très long | Aucun gain sur l'option 3 : l'utilisateur n'apprend rien, la liste est juste fraîche quand il rouvre — ce que l'option 2 + `AppState` fait gratuitement. |
| Échec | Même canal, même incertitude. |
| Arrière-plan → reprise | Le push a pu être jeté : « *If something force quits or kills the app, the system discards the held notification* », et seul le dernier est retenu. Une relecture au retour d'avant-plan reste obligatoire — donc l'option 2 est de toute façon nécessaire. |
| Réseau faible/absent | Un seul push retenu, les précédents perdus. |
| Batterie | Un réveil par média, mais throttlé par le système ; 30 s de budget par handler. |
| Données | Charge minuscule, plus la relecture. |
| Delta backend | Même producteur que l'option 3, avec `_contentAvailable: true` et une charge data-only. |
| Livraison mobile | **Build sur les deux plateformes.** `enableBackgroundRemoteNotifications` écrit `UIBackgroundModes: remote-notification` dans l'`Info.plist` et `expo-task-manager` est un module natif autolinké : l'empreinte bouge, donc 2 des 15 builds mensuels, et une réinstallation TestFlight. |

**Verdict** : coût de livraison maximal pour une garantie *inférieure* à celle de l'option 3 (qui, elle, est
visible donc jamais dépriorisée par FCM) et une fraîcheur *inférieure* à celle de l'option 2 (qui, elle, est
déterministe). Rejetée sur les trois axes à la fois.

### 4.5 Option 5 — connexion persistante WebSocket (API Gateway WebSocket API)

Quotas relevés en direct sur notre région via l'API Service Quotas (code de service `apigateway`, eu-west-3,
2026-09-18) : **timeout d'inactivité 600 s — non ajustable**, **durée maximale de connexion 7 200 s — non
ajustable**, trame 32 Ko, charge 128 Ko, 500 nouvelles connexions/s.

| Critère | Comportement |
|---|---|
| Délai de mise à jour | Sub-seconde **tant que la connexion vit**. Le meilleur délai théorique du benchmark. |
| Traitement très long | La connexion meurt avant le job : 600 s d'inactivité contre un maximum observé de 3 100 s (§2.6). Il faut un keepalive applicatif toutes les < 10 min — c'est-à-dire réintroduire un réveil périodique, exactement ce que l'option 2 fait mais sans la charge utile. |
| Échec | Même canal, même latence. |
| Arrière-plan → reprise | iOS suspend le socket en arrière-plan, Android le coupe en Doze (« *Suspends network access* »). Il faut donc démonter/reconnecter à chaque retour d'avant-plan **et** faire une relecture de rattrapage, parce qu'un WebSocket ne rejoue pas ce qui a été manqué. La relecture de l'option 1/2 reste la source de vérité. |
| Réseau faible/absent | Aucune livraison, aucun rejeu. Rattrapage obligatoire. |
| Batterie | Socket persistant + keepalive. Google déconseille explicitement : « *we strongly recommend you use FCM if possible, rather than maintaining your own persistent network connection* » (§3.1). |
| Données | Trames de keepalive + la notification. Faible en volume, mais des réveils radio réguliers, ce qui coûte plus en énergie qu'en octets. |
| Delta backend | Le plus gros du benchmark : une API `protocol_type = "WEBSOCKET"`, des routes `$connect`/`$disconnect`/`$default`, un authorizer Lambda qui valide notre JWT maison, une table DynamoDB de connexions avec TTL, l'IAM `execute-api:ManageConnections`, et un fan-out depuis `media_completed_worker`. Notre API actuelle est une HTTP API (`lambda_api.tf` l. 131-136, `protocol_type = "HTTP"`) : il s'agit d'une seconde API, pas d'une extension. |
| Livraison mobile | **OTA** (un client WS est du JS). Le coût est côté infrastructure, pas côté livraison. |

**Verdict** : le seul mécanisme qui bat l'option 2 sur le délai, et il ne le fait que sur la partie du spectre où
le délai ne se voit pas (3 s contre 0,3 s sur un écran où la médiane d'attente est de 22,9 s). Il n'élimine ni la
relecture de rattrapage, ni le réveil périodique. Le rapport coût/bénéfice est négatif.

### 4.6 Option 6 — abonnement temps réel managé (AWS AppSync Events / GraphQL subscriptions)

Profil utilisateur identique à l'option 5 (même suspension en arrière-plan, même besoin de rattrapage), avec deux
différences : la reconnexion est gérée par le client Amplify au lieu d'être écrite à la main, et le coût par
utilisateur est plus faible (§5.3). En regard : un service AWS entièrement nouveau, une dépendance Amplify dans
un code mobile qui n'en a aucune aujourd'hui, et un authorizer Lambda pour faire le pont avec notre JWT. On
échange une complexité écrite contre une complexité de fournisseur, sans changer ce que l'utilisateur voit.

### 4.7 Option 7 — broker MQTT-over-WebSocket (AWS IoT Core)

Même profil que 5 et 6. Le moins cher par minute de connexion (§5.3). Mais il exige des identifiants ou une
policy par utilisateur (SigV4 ou custom authorizer), un client MQTT dans React Native, et il fait entrer un
service de flotte d'objets connectés dans une app de lecture. Aucun bénéfice utilisateur sur l'option 5.

### 4.8 Option 8 — tâche périodique en arrière-plan (`expo-background-task`)

| Critère | Comportement |
|---|---|
| Délai de mise à jour | **≥ 15 min**, et « *The system controls the background task execution interval and treats the specified value as a minimum delay* » — donc en pratique davantage, sans garantie d'horaire (§3.1). |
| Traitement très long | Le seul cas où la granularité serait acceptable… et c'est déjà celui que l'option 3 couvre mieux. |
| Échec | Idem. |
| Arrière-plan → reprise | Sans objet : la tâche vise précisément l'arrière-plan, mais elle ne peut pas rafraîchir un écran visible. |
| Réseau faible/absent | La tâche ne s'exécute pas ; Android la reporte aux fenêtres de maintenance Doze. |
| Batterie | Faible, c'est son seul argument. |
| Données | Une relecture par exécution. |
| Delta backend | Aucun. |
| Livraison mobile | **Build.** `UIBackgroundModes: ["processing"]` + `BGTaskSchedulerPermittedIdentifiers` dans l'`Info.plist`, module natif autolinké, « *you need to run prebuild* ». Et « *unavailable on iOS simulators* » : le développement local et les flux Maestro sur simulateur ne peuvent pas l'exercer. |

**Verdict** : le plancher de 15 min est **39 fois** la médiane de traitement mesurée (22,9 s). Disqualifiée par
l'arithmétique.

### 4.9 Option 9 — surface système dédiée (Live Activities iOS / Live Updates Android 16)

| Critère | Comportement |
|---|---|
| Délai de mise à jour | Quasi immédiat via push ActivityKit / mise à jour de notification. |
| Traitement très long | Bien couvert (jusqu'à 8 h actives + 4 h sur écran verrouillé côté iOS). |
| Échec | Affichable comme état final. |
| Arrière-plan → reprise | C'est l'intérêt : la surface vit *hors* de l'app. Mais elle ne corrige pas la vignette dans l'app — il faut quand même l'option 1 ou 2 pour ça. |
| Réseau faible/absent | Pas de mise à jour, l'activité reste sur son dernier état. |
| Batterie | Modérée, une surface persistante à l'écran. |
| Données | Une charge par mise à jour. |
| Delta backend | Comparable à l'option 3 côté serveur (un producteur d'événement), plus la gestion des tokens d'activité. |
| Livraison mobile | **Build, et davantage** : une widget extension iOS est une nouvelle cible Xcode, ce qui n'est pas un simple ajout de plugin. Côté Android, `POST_PROMOTED_NOTIFICATIONS` est une permission de manifeste, et l'API n'existe qu'à partir d'Android 16. |

**Les deux plateformes documentent notre cas comme hors périmètre.** Google : « *Don't allow activities
triggered by other parties to generate Live Updates* », le suivi de colis étant cité comme contre-exemple — un
traitement serveur asynchrone est exactement cela. Apple réserve la surface aux événements que l'utilisateur
suit activement. Et notre médiane de 22,9 s est plus courte que le temps de lire la surface. Rejetée.

### 4.10 Option 10 — flux HTTP tenu ouvert (SSE, long-polling)

Notre API est une **HTTP API** API Gateway v2 (`lambda_api.tf` l. 131-136). Le timeout d'intégration maximal y
est de 30 s et la documentation le donne comme non augmentable
([API Gateway quotas](https://docs.aws.amazon.com/apigateway/latest/developerguide/limits.html), consulté
2026-09-18 ; la version archivée du même document dans le dépôt `awsdocs/amazon-api-gateway-developer-guide`,
fichier `doc_source/limits.md`, l'énonce comme « Maximum integration timeout / 30 seconds / cannot be
increased »). Le relevé Service Quotas en direct sur eu-west-3 donne 29 000 ms ajustables pour les REST APIs, ce
qui ne s'applique pas à notre type d'API.

Un « flux » ne peut donc pas dépasser 30 s, et il dégénère en long-polling de 30 s : un Lambda tenu ouvert
pendant 30 s par client connecté, contre ~285 ms par requête aujourd'hui (§5.1). À iso-fraîcheur, cela multiplie
le temps de calcul facturé par un facteur de l'ordre de **100** pour une latence de mise à jour *pire* que les 3 s
de l'option 2. **Non viable.**

### 4.11 Synthèse

| # | Délai typique | Couvre le très long | Couvre le retour d'avant-plan | Garanti sans permission | Delta infra | Livraison |
|---|---|---|---|---|---|---|
| 1 | non borné | non | **non** | oui | aucun | — |
| 2 | **≤ 3 s** | jusqu'à 5 min | **oui** | **oui** | **aucun** | **OTA** |
| 3 | quelques s | **oui** | oui (via tap) | non (permission) | **aucun** | **OTA** |
| 4 | best-effort | oui | partiel | non | aucun | build ×2 |
| 5 | < 1 s | non (600 s d'inactivité) | non (rattrapage requis) | oui | **le plus lourd** | OTA |
| 6 | < 1 s | non | non | oui | lourd + Amplify | OTA |
| 7 | < 1 s | non | non | oui | lourd + MQTT | OTA |
| 8 | ≥ 15 min | oui | sans objet | oui | aucun | build ×2 |
| 9 | quasi immédiat | oui | oui, hors app | non | moyen | build + extension |
| 10 | ≥ 30 s | non | non | oui | moyen | OTA |

Deux lignes seulement cochent « aucun delta infra » **et** « OTA » : les options 2 et 3. Elles sont exactement
complémentaires — la 2 est garantie mais ne vit que dans l'app, la 3 atteint l'utilisateur parti mais dépend
d'une permission. Aucune autre combinaison n'atteint la même couverture pour un coût comparable.

---

## 5. Coût AWS mensuel en EUR à 100, 1 000 et 10 000 utilisateurs actifs (AC #5)

### 5.0 Prix unitaires et taux de change

Tous les prix viennent de l'**AWS Price List Query API** interrogée le **2026-09-18** pour la région
**eu-west-3 (Paris)**, en USD hors taxes, hors palier gratuit (le free tier n'est pas modélisé : il masquerait
le coût marginal, qui est ce que l'owner doit voir).

| Ressource | Prix unitaire (USD) |
|---|---|
| API Gateway HTTP API — requêtes (300 premiers M) | $1,17 / M |
| API Gateway WebSocket API — messages | $1,19 / M |
| API Gateway WebSocket API — minutes de connexion | $0,297 / M |
| Lambda arm64 — durée (palier 1) | $0,0000133334 / GB-s |
| Lambda x86 — durée (palier 1) | $0,0000166667 / GB-s |
| Lambda — requêtes | $0,20 / M |
| DynamoDB on-demand — lectures (RRU) | $0,1487 / M |
| DynamoDB on-demand — écritures (WRU) | $0,7423 / M |
| SQS standard — requêtes | $0,40 / M |
| AppSync — invocations GraphQL | $4,00 / M |
| AppSync — notifications temps réel | $2,00 / M |
| AppSync — minutes de connexion | $0,08 / M |
| AppSync Event API — opérations | $1,00 / M |
| IoT Core — minutes de connexion | $0,096 / M |
| IoT Core — messages | $1,20 / M |
| IoT Core — règles | $0,18 / M |

Conversion : **1 EUR = 1,1481 USD** (taux de référence BCE du **2026-09-17**,
[ECB euro reference rates](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html),
consulté 2026-09-18). Tous les montants EUR de cette section sont des USD divisés par 1,1481.

**Le service de push Expo est gratuit et n'apparaît pas dans ce tableau** : c'est une dépense de 0 € qui n'est
ni AWS ni facturée, et c'est un argument de plus pour les options 3 et 4 côté transport.

### 5.1 Coût d'un appel `GET /api/media` (unité A)

Mesures réelles sur `-dev`, Lambda `media-summarizer-api-dev` (1 024 Mo, arm64, timeout 30 s), CloudWatch Logs
Insights sur 14 jours, **n = 4 627 invocations** : moyenne **284,45 ms**, p50 **240,15 ms**, p90 **480,06 ms**,
max **16 107,46 ms**, durée facturée moyenne **1 441,40 ms**.

La moyenne facturée de 1 441 ms est **écartée du modèle** : elle est dominée par les démarrages à froid d'un
environnement quasi inactif, où presque chaque requête paie un cold start. À 100 utilisateurs actifs et plus, le
conteneur reste chaud. Le modèle retient donc **300 ms facturées**, cohérent avec la moyenne d'exécution mesurée
(284 ms) — c'est une **hypothèse explicite**, et §5.6 en donne la sensibilité.

| Composant | Calcul | USD |
|---|---|---|
| API Gateway HTTP API | 1 requête × $1,17/M | $1,170e-6 |
| Lambda durée | 0,3 s × 1 GB × $1,33334e-5/GB-s | $4,000e-6 |
| Lambda requête | 1 × $0,20/M | $0,200e-6 |
| DynamoDB Query | 2 RRU (16 Ko en lecture non cohérente) × $0,1487/M | $0,297e-6 |
| **Total unité A** | | **$5,667e-6 = €4,936e-6** |

**Charge réseau mesurée** sur les lignes réelles de `user_media-dev` : moyenne **786 octets par ligne**, médiane
803, p90 997, max 1 692. Une page de 20 lignes (défaut de l'endpoint, `api/endpoints/media.py:1186`) pèse
**14 675 octets bruts / 5 205 octets gzip**. 42 des 93 lignes portent une vignette `s3://` remplacée par une URL
présignée au moment de servir : à ~800 octets par URL présignée, cela porte la page à **~22 Ko bruts / ~8 Ko
gzip** — ce dernier chiffre est une **estimation**, obtenue en ajoutant 800 octets par ligne concernée à la
mesure, et non une mesure de bout en bout.

Le DynamoDB Query lit 2 RRU : une lecture non cohérente couvre 8 Ko, et une page de 20 lignes à 786 octets fait
15,7 Ko, donc 2 unités. C'est un **calcul**, pas une mesure de consommation facturée.

### 5.2 Nombre de sondages par sauvegarde (volume de l'option 2)

Le programme de sondage a été **simulé sur les 87 durées réelles** de §2, pas estimé. Trois programmes
comparés :

| Programme | Moyenne | Médiane | p90 | Max |
|---|---|---|---|---|
| **A — 3 s jusqu'à 60 s, puis 10 s jusqu'à 300 s** | **8,8** | 8 | 14 | **44** |
| B — 3 s à plat jusqu'à 300 s (idiome actuel du dépôt) | 10,9 | 8 | 14 | 100 |
| C — 2 s/30 s, puis 5 s/120 s, puis 15 s/300 s | 11,6 | 11 | 17 | 45 |

A est retenu : il donne la meilleure latence perçue sur la fenêtre qui compte (3 s pendant les 60 premières
secondes, soit 94,3 % des jobs) tout en divisant par 2,3 le pire cas de B. C paie 32 % de requêtes en plus pour
gagner 1 s de latence sur la médiane.

### 5.3 Coût mensuel par option

**Hypothèses, toutes explicites et toutes discutables :**

- **A1** — 3 sauvegardes par utilisateur et par jour, soit **90 par mois** (30 jours). Extrapolation : sur `-dev`
  on compte 87 jobs sur 34 jours pour une poignée de testeurs, ce qui ne permet aucune inférence par
  utilisateur. **A1 est une hypothèse de dimensionnement, pas une mesure.**
- **A2** — l'utilisateur regarde l'écran d'accueil pendant **100 %** des traitements. C'est une **borne
  supérieure délibérée** : en réalité une sauvegarde arrive souvent par la share-sheet d'une autre app, donc
  notre écran n'est pas visible et le sondage ne s'arme jamais. Le coût réel du sondage est donc inférieur au
  chiffre affiché.
- **A3** — 8,8 sondages par sauvegarde (mesuré par simulation, §5.2).
- **A4** — 10 retours à l'avant-plan par utilisateur et par jour, soit **300 par mois**, chacun déclenchant une
  relecture. Hypothèse de dimensionnement.
- **A5** — 300 minutes de connexion par utilisateur et par mois (10 min/jour) réparties sur 10 sessions, avec un
  keepalive toutes les 8 minutes pour les options 5/6/7. Hypothèse de dimensionnement.
- **A6** — une relecture pour deux notifications reçues (50 %). L'autre moitié est absorbée : soit le sondage de
  l'option 2 avait déjà rafraîchi la liste, soit la notification n'a jamais été ouverte. Hypothèse de
  dimensionnement.
- **A7** — pour les options 5/6/7, la **relecture de rattrapage au retour d'avant-plan reste obligatoire** (§4.5)
  et est donc comptée dans leur total. Ne pas la compter serait comparer un mécanisme complet à un mécanisme
  partiel.

#### Unité B — une notification « média prêt » de bout en bout

| Composant | Calcul | USD |
|---|---|---|
| `sqs.send_message` depuis `media_completed_worker` | 1 × $0,40/M | $0,400e-6 |
| `push_notification_worker` — durée | 0,25 GB × 1,0 s × $1,33334e-5/GB-s | $3,333e-6 |
| `push_notification_worker` — requête | 1 × $0,20/M | $0,200e-6 |
| Lecture des tokens du device | 2 RRU × $0,1487/M | $0,297e-6 |
| Message SQS différé de vérification des reçus | 1 × $0,40/M | $0,400e-6 |
| Invocation de vérification des reçus | 0,25 GB-s + 1 requête | $3,533e-6 |
| **Total unité B** | | **$8,163e-6 = €7,110e-6** |

La vérification des reçus est comptée à une invocation par notification, ce qui est le pire cas : le worker
existant peut en grouper jusqu'à 100 par appel Expo (§3.1). C'est délibéré — le modèle doit majorer, pas flatter.

#### Tableau récapitulatif

Montants **EUR par mois**, coût AWS marginal uniquement (hors free tier), arrondis au centime.

| # | Approche | € / utilisateur / mois | **100** | **1 000** | **10 000** |
|---|---|---|---|---|---|
| 1 | Statu quo (focus + pull-to-refresh) | — | **€0** (référence) | **€0** | **€0** |
| 2 | Sondage borné + `AppState` | €5,390e-3 | **€0,54** | **€5,39** | **€53,90** |
| 3 | Push visible + relecture déclenchée | €8,620e-4 | **€0,09** | **€0,86** | **€8,62** |
| 4 | Push silencieux | €8,620e-4 | €0,09 | €0,86 | €8,62 **+ 2 builds EAS/mois** |
| 5 | WebSocket API Gateway (+ rattrapage A7) | €1,889e-3 | €0,19 | €1,89 | €18,89 |
| 6 | AppSync Events (+ rattrapage A7) | €1,657e-3 | €0,17 | €1,66 | €16,57 |
| 7 | IoT Core MQTT (+ rattrapage A7) | €1,692e-3 | €0,17 | €1,69 | €16,92 |
| 8 | `expo-background-task` (4 exécutions/jour) | €5,923e-4 | €0,06 | €0,59 | €5,92 **+ 2 builds EAS/mois** |
| 9 | Live Activities / Live Updates | ≈ option 3 | €0,09 | €0,86 | €8,62 **+ extension native** |
| 10 | Long-polling 30 s | €2,099e-1 | **€20,99** | **€209,91** | **€2 099,10** |
| | **Recommandation (2 + 3)** | **€6,252e-3** | **€0,63** | **€6,25** | **€62,52** |

Détail des lignes non triviales :

- **Option 2** = 90 × 8,8 = 792 appels de sondage (€3,909e-3) + 300 relectures `AppState` (€1,481e-3).
- **Option 3** = 90 × unité B (€6,399e-4) + 45 relectures déclenchées (A6, €2,221e-4).
- **Option 5** = 300 min de connexion ($8,910e-5) + 184 messages ($2,190e-4) + 10 invocations d'authorizer
  ($8,667e-6) + 37 invocations de keepalive ($3,207e-5) + table de connexions, 20 WRU et 184 RRU ($4,221e-5)
  + 90 invocations de fan-out ($7,800e-5) = $4,691e-4, **plus** le rattrapage obligatoire de 300 relectures
  (€1,481e-3).
- **Option 6** = 300 min ($2,400e-5) + 100 opérations Event API ($1,000e-4) + 90 fan-out ($7,800e-5) = $2,020e-4,
  plus le rattrapage.
- **Option 7** = 300 min ($2,880e-5) + 100 messages ($1,200e-4) + 90 règles ($1,620e-5) + 90 fan-out
  ($7,800e-5) = $2,430e-4, plus le rattrapage.
- **Option 10** = 600 long-polls de 30 s par utilisateur et par mois (10 min/jour d'écran ouvert). Le terme qui
  explose est la durée Lambda : 600 × 30 s × 1 GB = **18 000 GB-s**, soit $0,2400 à lui seul — **39 fois** le coût
  total de l'option 2.

### 5.4 Ce que ces montants représentent réellement

À 10 000 utilisateurs actifs, la recommandation coûte **€62,52 par mois**, soit **€0,0063 par utilisateur et par
mois**, soit — sous l'hypothèse A1 de 90 sauvegardes mensuelles — **moins de 0,01 centime d'euro par média
sauvegardé**. Le terme dominant est la durée du Lambda d'API : $4,000e-6 sur les $5,667e-6 de l'unité A, soit
**71 %**. Le seul levier d'optimisation réel serait donc un endpoint de statut allégé, qui rendrait les quatre
champs nécessaires à une vignette au lieu de la page complète — c'est un raffinement possible, pas un prérequis,
et il n'est pas dans le périmètre de §7.

Conclusion : le mécanisme d'affichage n'est pas, et ne sera pas, une ligne de coût significative. L'arbitrage réel
de ce benchmark porte sur la **complexité** et sur le **quota de builds**, pas sur la facture.

### 5.5 Ce que le tableau ne dit pas

Le prix du service de push Expo est de **0 €** et n'est pas dans le tableau — mais il n'a pas de SLA (§3.1). Le
prix d'un build EAS est de **0 €** sur le plan gratuit — mais il consomme 1 des 15 créneaux mensuels et impose
une réinstallation au testeur. Ce sont deux coûts réels que la colonne EUR ne capture pas, et ils vont tous les
deux dans le même sens : contre les options 4, 8 et 9.

### 5.6 Sensibilité

| Hypothèse modifiée | Effet sur la recommandation (2 + 3) |
|---|---|
| Durée Lambda facturée = 1 441 ms (la moyenne mesurée, cold starts inclus) au lieu de 300 ms | unité A ×3,69 → **€1,99 / €19,87 / €198,66** |
| A1 = 6 sauvegardes/jour au lieu de 3 | **€1,10 / €11,02 / €110,23** |
| A2 = 40 % des sauvegardes faites écran visible (plus réaliste : la share-sheet d'une autre app) | **€0,39 / €3,91 / €39,07** |

Dans les trois cas la conclusion ne bouge pas : les montants restent d'un ordre de grandeur inférieur à toute
autre ligne du budget AWS de ce projet.

---

## 6. Parité iOS / Android, approche par approche (AC #6)

### 6.1 Options 1 et 2 — parité complète, avec un piège nommé

Un seul codebase, un seul comportement. Le seul écart de plateforme est dans l'API `AppState` de React Native, et
il faut le connaître pour ne pas écrire un écouteur qui ne marche que d'un côté :

| Valeur / événement | iOS | Android |
|---|---|---|
| État `active` | oui | oui |
| État `background` | oui | oui — et **aussi** « *\[Android\] on another `Activity`, including temporary system activities such as autofill credential pickers (even if launched by your app or the system)* » |
| État `inactive` | **iOS uniquement** | absent |
| Événement `change` | oui | oui |
| Événement `memoryWarning` | **iOS uniquement** | absent |
| Événements `focus` / `blur` | absents | **Android uniquement** — « *`AppState` won't change but the `blur` event will get fired* » |

([React Native — AppState](https://reactnative.dev/docs/appstate), consulté 2026-09-18)

**Conséquence concrète** : la seule condition portable est `nextState === "active"` sur l'événement `change`. Se
fier à `inactive` pour détecter une sortie d'écran ne marcherait que sur iOS ; se fier à `focus`/`blur` ne
marcherait que sur Android. Les quatre écouteurs déjà présents dans le dépôt testent tous exactement
`nextState === "active"` (`share-confirmation.tsx:112`, `AuthContext.tsx:291`, `useDeviceTimezoneSync.ts:79`,
`usePushNotifications.ts:62`) : le nouveau doit faire pareil, et l'écart de plateforme disparaît.

Un second écart, mineur, joue **en faveur** de l'option 2 sur Android : le tiroir de notifications déroulé ne
change pas `AppState` (seul `blur` est émis), donc le sondage continue sous le tiroir et la liste est déjà à jour
quand l'utilisateur le referme. Sur iOS, ouvrir le Notification Center émet `inactive`, que l'écouteur ignore —
même résultat. Aucune divergence visible pour l'utilisateur.

### 6.2 Option 3 — parité fonctionnelle, mais trois différences de plateforme à traiter

| Point | iOS | Android |
|---|---|---|
| Permission | Prompt système obligatoire, une seule fois ; un refus est définitif hors Réglages | `POST_NOTIFICATIONS` est une permission d'exécution depuis **Android 13 (API 33)** ; en dessous, elle est implicite. « *If a user installs your app on a device that runs Android 13 or higher, your app's notifications are off by default.* » |
| Canaux | **Inexistants.** L'utilisateur ne peut couper que l'app entière | **Obligatoires** depuis Android 8. `ANDROID_CHANNEL_ID` est figé à `"digest"` (`pushNotificationService.ts:50`) |
| Présentation au premier plan | Contrôlée en JS par `setNotificationHandler`, qui « *should respond with a behavior object within 3 seconds* » | Contrôlée par l'**importance du canal**, fixée à la création du canal et **non modifiable ensuite** par l'app |

**L'écart qui compte, et qu'il faut décider.** Sur Android, réutiliser le canal `"digest"` pour une notification
« média prêt » signifie qu'un utilisateur qui coupe les notifications de Digest coupe **aussi** les notifications
de fin de traitement, sans le savoir. Sur iOS le problème ne se pose pas — il n'y a pas de canal — mais la
conséquence miroir est que l'utilisateur iOS ne peut **pas** garder l'un et couper l'autre. C'est un vrai écart
de parité : Android offre un réglage plus fin, iOS n'en offre aucun. Le second canal Android (§7, livrable D) est
donc requis non pas pour la parité technique mais pour ne pas dégrader l'expérience Android au niveau de celle
d'iOS.

([Notification runtime permission](https://developer.android.com/develop/ui/views/notifications/notification-permission),
consulté 2026-09-18 ; [expo-notifications](https://docs.expo.dev/versions/latest/sdk/notifications/), consulté
2026-09-18)

### 6.3 Option 4 — les deux plateformes échouent, différemment

| Point | iOS | Android |
|---|---|---|
| Configuration | `UIBackgroundModes: remote-notification` + charge `aps` réduite à `content-available` + `apns-push-type: background` + `apns-priority: 5` | Message data-only ; pas d'entitlement, mais `expo-task-manager` requis par le SDK |
| Mode d'échec | Throttling système : « *don't try to send more than two or three per hour* », un seul push retenu, jeté si l'app est force-quittée | Dépriorisation adaptative : un data-only qui n'affiche rien « *may be deprioritized to normal priority or delegated for handling by Google Play services* », sur « *7 days of message behavior* », « *independently for every instance of your application* » |
| Livraison en veille | Non garantie | En Doze, livrée seulement pendant les fenêtres de maintenance |

Les deux modes d'échec sont **non corrélés** : l'un est un plafond de débit, l'autre un apprentissage sur
l'historique de l'app. Il n'existe donc pas de réglage unique qui les satisfasse tous les deux, et le
comportement observé divergera entre les deux plateformes pour la même charge envoyée. C'est une raison de rejet
supplémentaire, distincte du coût de build.

### 6.4 Options 5, 6 et 7 — la connexion meurt des deux côtés, pour des raisons différentes

Sur iOS, l'app est suspendue en arrière-plan et le socket tombe. Sur Android, Doze « *Suspends network access* »
et coupe le socket même app vivante. Le résultat visible est le même — la connexion doit être rétablie au retour
d'avant-plan, et une relecture de rattrapage est obligatoire — mais les **délais** de coupure diffèrent : iOS
coupe à la suspension, Android peut maintenir puis couper à l'entrée en Doze. Deux courbes de reconnexion à
régler séparément, pour un mécanisme qui ne dispense de rien.

### 6.5 Option 8 — deux ordonnanceurs, deux comportements, un simulateur en moins

`expo-background-task` s'appuie sur `BGTaskScheduler` (iOS) et `WorkManager` (Android). Les deux respectent un
plancher de 15 min et ne garantissent pas l'horaire. Deux asymétries réelles :

- iOS : « *unavailable on iOS simulators. It is only available when running on a physical device.* » Le
  développement local et les flux Maestro sur simulateur ne peuvent pas l'exercer du tout.
- Android : `WorkManager` « *uses `JobScheduler` internally, so `WorkManager` tasks don't run* » en Doze, et les
  fenêtres de maintenance s'espacent avec la durée de veille.

### 6.6 Option 9 — deux produits différents, pas une fonctionnalité portable

C'est l'écart de parité maximal du benchmark. Côté iOS, une Live Activity est une **widget extension** (nouvelle
cible), disponible depuis iOS 16.1, avec une fenêtre de 8 h + 4 h. Côté Android, `Notification.ProgressStyle` /
Live Updates n'existe **qu'à partir d'Android 16 (API 36)** et exige `POST_PROMOTED_NOTIFICATIONS`. Il faudrait
écrire, tester et maintenir deux implémentations natives distinctes, pour une base installée Android quasi nulle
en 2026, et sur un cas d'usage que les deux documentations excluent nommément (§4.9).

### 6.7 Option 10 — parité parfaite, et sans intérêt

Du HTTP nu : aucun écart de plateforme. Mais §4.10 la disqualifie côté serveur.

### 6.8 Synthèse de parité

| # | Parité | Ce qui diffère |
|---|---|---|
| 1, 2 | **complète** | rien de visible ; seul le test `AppState` doit être `=== "active"` |
| 3 | **fonctionnelle** | permission `POST_NOTIFICATIONS` sur Android 13+, canaux Android absents sur iOS, présentation au premier plan pilotée différemment |
| 4 | **non** | throttling iOS vs dépriorisation adaptative FCM : deux modes d'échec non corrélés |
| 5, 6, 7 | **fonctionnelle** | délais de coupure différents (suspension iOS vs Doze Android) |
| 8 | **non** | indisponible sur simulateur iOS ; report en fenêtres de maintenance sur Android |
| 9 | **non** | deux implémentations natives distinctes ; Android 16 minimum |
| 10 | complète | — |

Seules les options 1, 2 et 3 sont livrables une fois et se comportent pareil des deux côtés.

---

## 7. Recommandation argumentée et spécification du comportement attendu (AC #7)

La recommandation est en tête de document. Cette section spécifie **ce que l'utilisateur doit voir**, étape par
étape, dans tous les cas — y compris le traitement anormalement long et l'échec.

### 7.1 Le vocabulaire d'état, après correction du prédicat

Le prédicat corrigé doit être une **liste blanche** de deux valeurs, pas une liste noire :

- **`pending`** — la ligne existe, aucun worker ne l'a encore prise. Durée mesurée : médiane **0,4 s**, p90
  **5,0 s**, max **8,6 s** (§2.5).
- **`processing`** — un worker travaille.
- **`ready`** — terminal, succès.
- **`failed`** — terminal, échec.
- **`null`** — statut absent ou inconnu. **Aucun marqueur**, et c'est délibéré : `processing_status` est nullable
  par contrat (invariant I3, `core/models/user_media.py`, « *the library must render fully without them* ») et
  `from_dynamodb_item` dégrade toute valeur inconnue en `None`. Traiter `null` comme « en cours » ferait
  balayer indéfiniment les lignes anciennes ou écrites par un futur producteur.

Donc : `isProcessingLibraryStatus(s) === (s === "pending" || s === "processing")`. Un test négatif du genre
`s !== "ready" && s !== "failed"` serait un bug, parce qu'il attraperait `null`.

### 7.2 Le scénario nominal, seconde par seconde

Chronologie de référence : les valeurs médianes mesurées en §2 (mise en file 0,4 s, traitement 22,9 s).

| Moment | Ce qui se passe côté serveur | Ce que l'utilisateur voit sur l'Accueil |
|---|---|---|
| **t = 0** | La ligne `user_media` est créée avec `processing_status = pending` | La vignette apparaît en tête d'« Ajouts récents » : libellé provisoire (`title_label_key`, task-400), pas d'image, **et le balayage animé**. C'est le premier changement de comportement : aujourd'hui `pending` n'affiche aucun marqueur (§1.3). |
| **t ≈ 0,4 s** | Un worker prend le job, `mirror_job` écrit `processing` | Rien ne change à l'écran, et c'est correct : il n'y a rien de nouveau à montrer. |
| **t = 3 s, 6 s, 9 s…** | — | Chaque tick de sondage relit la liste. Aucun clignotement : la relecture est silencieuse (`refetch`, pas `refresh`), la liste existante reste affichée pendant la requête. |
| **entre t et le terminal** | Le worker d'extraction apprend le vrai titre, l'auteur, la vignette et les écrit sur la ligne | **La vignette s'enrichit progressivement** : le vrai titre remplace le libellé provisoire, l'image apparaît, le balayage continue. C'est un gain gratuit du sondage que ni le push ni le WebSocket n'apportent : ils ne signalent que le terminal. |
| **t ≈ 22,9 s (médiane)** | `processing_status = ready` | **Au tick suivant, au plus tard 3 s après**, le balayage s'arrête et la vignette est définitive. Pour 94,3 % des médias ce délai est ≤ 3 s (§2.2). |
| **même instant** | `media_completed_worker` poste sur `push-notification-queue` | **App au premier plan** : aucune bannière. `setNotificationHandler` la supprime et déclenche une relecture silencieuse — l'utilisateur voit la vignette se figer, pas une notification. **App en arrière-plan** : bannière « 1 média est prêt ». |
| **quand la liste n'a plus de non-terminal** | — | Le sondage **se désarme**. Plus une seule requête jusqu'au prochain événement. |

### 7.3 Le texte de la notification

Contrainte non négociable héritée de `docs/research/task-368-push-delivery/README.md` (décision owner validée) :
le contenu qui transite par le service Expo ne doit rien révéler de la bibliothèque. Donc **un compteur, jamais un
titre** :

- 1 média : « 1 média est prêt »
- n médias : « n médias sont prêts »

Le `data` du push porte l'identifiant du média (opaque, `mi_…`) pour permettre le routage au tap. Le tap ouvre
l'Accueil si le push agrège plusieurs médias, le détail du média s'il n'y en a qu'un. `usePushNotifications.ts`
route aujourd'hui **tous** les taps vers `/(tabs)/digest` : il lui faut une branche sur `data.type`.

### 7.4 Traitement anormalement long (> 5 minutes)

Mesuré : 5 jobs sur 87 dépassent 60 s, et **3 dépassent 1 000 s** (1 881 s, 2 823 s, 3 100 s) — les trois dans
la même fenêtre de huit minutes du 2026-08-20, donc un incident fournisseur unique et non la queue naturelle
(§2.6). Hors incident, le pire cas observé est **100,6 s**. Le budget de 5 minutes couvre donc tout le
fonctionnement normal avec un facteur 3 de marge.

Comportement spécifié quand le budget expire :

1. **Le balayage s'arrête.** Une animation qui tourne sans fin est précisément le bug rapporté ; la reproduire à
   5 min au lieu de l'infini ne serait pas une correction.
2. **La vignette prend un marqueur statique, non animé, distinct d'une vignette prête.** L'utilisateur doit
   pouvoir distinguer « toujours en cours » de « prêt » sans toucher l'écran. Une vignette qui perdrait tout
   marqueur laisserait croire que le média est prêt alors qu'il ne l'est pas.
3. **Aucun message d'erreur.** Un traitement long n'est pas un échec, et le dire serait faux.
4. **Trois gestes réarment le sondage** : le pull-to-refresh, un retour sur l'onglet Accueil, et un retour de
   l'app à l'avant-plan.
5. **Le push reste armé côté serveur** et arrive quand le traitement finit, quelle que soit sa durée. C'est le
   seul mécanisme qui couvre 1 881 s ou 3 100 s, et c'est la raison d'être du livrable D.

### 7.5 Échec

1. Au tick qui suit l'écriture de `failed`, **le balayage s'arrête** et `MediaFailureBadge` apparaît
   (`isFailedLibraryStatus`, `MediaFailureBadge.tsx:52`). Le libellé reste provisoire : il n'y a pas de titre à
   afficher.
2. **Le sondage se désarme** : `failed` est terminal, exactement comme `ready`.
3. **Aucune notification push.** On ne réveille pas quelqu'un pour lui annoncer une mauvaise nouvelle qu'il n'a
   pas demandée. C'est une décision de produit, énoncée pour que l'implémenteur ne l'invente pas dans l'autre
   sens.
4. Le tap ouvre le détail, qui rend `error_code` dans la langue du lecteur (task-359). Déjà en place, rien à
   ajouter.

### 7.6 App mise en arrière-plan puis reprise

1. Au passage en arrière-plan, le sondage se désarme (`useFocusEffect` au blur).
2. Au retour, l'écouteur `AppState` sur `change` — condition `nextState === "active"`, la seule portable (§6.1) —
   déclenche **immédiatement** une relecture silencieuse.
3. Si la liste relue porte encore un non-terminal, le sondage se réarme avec un budget neuf.
4. Le scénario aujourd'hui cassé — ajouter un média, mettre l'app en fond, revenir 5 minutes plus tard, la
   vignette balaie toujours (§1.2) — est fermé par cette étape seule, indépendamment du sondage.

### 7.7 Réseau faible ou absent

1. Chaque tick est une requête indépendante. Un échec **ne change rien à l'écran** : la vignette continue
   d'afficher « en cours », ce qui est vrai.
2. Le tick suivant réessaie. Aucun backoff supplémentaire : l'intervalle est déjà de 3 s puis 10 s, et un budget
   d'essais borné rend le backoff inutile.
3. Le budget compte les **tentatives**, pas les succès : un appareil hors ligne atteint donc la fin du budget et
   passe au marqueur statique de §7.4 au lieu de balayer indéfiniment.
4. Aucun bandeau « hors ligne » n'est spécifié ici : ce serait une fonctionnalité distincte, et le dépôt n'en a
   pas.

### 7.8 L'utilisateur a refusé les notifications

Rien ne se dégrade dans l'app. L'option 2 couvre **100 % des traitements sous 5 minutes**, dont 94,3 % avec un
délai ≤ 3 s. Seul le cas > 5 min laisse l'utilisateur découvrir la fin au prochain retour sur l'écran. C'est
cohérent avec la posture déjà écrite dans le dépôt : « *A refusal ends the attempt and nothing else… there is no
interface anywhere that behaves differently for a user who said no* » (`usePushNotifications.ts`). **Aucune
relance de permission n'est spécifiée.**

### 7.9 Les autres surfaces

- **Recherche / Bibliothèque** (`MediaListCard`) n'affiche **aucun** marqueur « en cours » aujourd'hui (§1.1) :
  un média fraîchement sauvegardé y ressemble à un média prêt. Livrable **F**, séparable et de priorité
  secondaire : porter le même marqueur et le même sondage borné sur cette surface. L'owner peut le couper sans
  toucher à la plainte du testeur, qui porte sur l'Accueil.
- **Détail d'un média**, **Digest**, **détail de dossier**, **détail complété** ont déjà leur sondage borné
  (§1.1). Rien à changer.
- **Triage « non classés »** ne relit délibérément jamais, pour ne pas renuméroter la file sous le doigt de
  l'utilisateur. **Ne pas y toucher** : y ajouter un sondage casserait le geste de swipe.

### 7.10 Hors périmètre, explicitement

- Le libellé provisoire non traduit sur les vignettes : task-400.
- La durée du traitement elle-même.
- Une barre de progression en pourcentage. `ProcessingProgress` existe côté contrat de détail
  (`api/models/media_contracts.py:171-174`) mais `GET /api/media` ne le sert pas, et l'exposer sur la liste
  serait un changement de contrat sans rapport avec la plainte.
- Toute relance de la permission de notification.

---

## 8. Statut de chaque chiffre : mesuré, sourcé, ou estimé (AC #8)

### 8.1 Mesuré sur `-dev` le 2026-09-18

| Chiffre | Méthode |
|---|---|
| 87 jobs, fenêtre 2026-08-14T01:08:51Z → 2026-09-17T08:34:15Z ; min 0,3 / médiane 22,9 / p90 40,2 / p95 68,2 / max 3 100,0 s | `Scan` complet de `processing_jobs-dev` (`Count = 87`, `ScannedCount = 87`, aucun `LastEvaluatedKey`), `completed_at − created_at`, percentiles au rang le plus proche. `user_email` **volontairement non projeté** (§2.1) |
| Par statut : `completed` n=81, `failed` n=6 ; par type et par plateforme (§2.3, §2.4) | même scan, agrégation locale |
| CDF : ≤10 s 33,3 % / ≤30 s 67,8 % / ≤60 s 94,3 % / ≤120 s 96,6 % | même scan |
| 14 derniers jours, n=57 : médiane 17,5 / p90 38,1 / max 68,2 s | même scan, filtre sur `created_at` |
| Latence de mise en file : n=87, médiane 0,4 / p90 5,0 / max 8,6 s | `started_at − created_at`, même scan |
| Les 5 jobs > 60 s et la concentration de 3 d'entre eux dans 8 minutes le 2026-08-20 | même scan, tri décroissant |
| `user_media-dev` : 93 lignes, 86 `ready`, 7 `failed`, aucun `ingested`, aucun `resolving` | `Scan` complet de la table |
| Taille des lignes : moyenne 786 o, médiane 803, p90 997, max 1 692 ; page de 20 lignes = 14 675 o brut / 5 205 o gzip | sérialisation JSON des lignes réelles, `gzip` niveau par défaut |
| 42 des 93 lignes portent une vignette `s3://` | même scan |
| Lambda d'API `media-summarizer-api-dev` sur 14 jours, n=4 627 : moyenne 284,45 ms, p50 240,15 ms, p90 480,06 ms, max 16 107,46 ms, facturé moyen 1 441,40 ms | CloudWatch Logs Insights sur `/aws/lambda/media-summarizer-api-dev` |
| Quotas API Gateway WebSocket eu-west-3 : inactivité 600 s non ajustable, durée 7 200 s non ajustable, trame 32 Ko, charge 128 Ko, 500 connexions/s | API Service Quotas, relevé en direct |

### 8.2 Calculé de façon déterministe à partir de mesures (donc ni sourcé, ni estimé)

| Chiffre | Calcul |
|---|---|
| Sondages par sauvegarde : moyenne **8,8**, médiane 8, p90 14, max 44 (programme A) | simulation du programme 3 s/60 s puis 10 s/300 s appliquée aux **87 durées mesurées**. Idem pour les programmes B (10,9 ; max 100) et C (11,6 ; max 45) |
| 2 RRU par `Query` de liste | 20 lignes × 786 o = 15,7 Ko ; une lecture non cohérente couvre 8 Ko → 2 unités. **Ce n'est pas une lecture de `ConsumedCapacity`** |
| Unité A = $5,667e-6 = €4,936e-6 | somme des quatre composants de §5.1, aux prix de §5.0 |
| Unité B = $8,163e-6 = €7,110e-6 | somme des six composants de §5.3, aux prix de §5.0 |
| Tous les montants du tableau de §5.3 | unités A et B × les volumes des hypothèses A1-A7 |
| « 39 fois le coût total de l'option 2 » (§5.3) et « facteur de l'ordre de 100 » (§4.10) | deux ratios différents et tous deux exacts : 100 est le rapport des **durées** (30 000 ms tenus ouverts contre 285 ms mesurées par requête), 39 est le rapport des **coûts mensuels** (l'option 10 fait 600 requêtes contre 1 092 pour l'option 2, ce qui compense partiellement) |
| « 15 min = 39 fois la médiane mesurée » (§4.8) | 900 s / 22,9 s = 39,3 |
| Les trois lignes de sensibilité de §5.6 | recalcul du même modèle avec une seule hypothèse changée à chaque fois |

### 8.3 Sourcé (URL + date de consultation en §9)

Tous les prix unitaires de §5.0 (AWS Price List Query API, eu-west-3, 2026-09-18) ; le taux de change 1 EUR =
1,1481 USD (BCE, 2026-09-17) ; le timeout d'intégration de 30 s d'une HTTP API ; le quota EAS de 15 builds
iOS + 15 Android par mois et 1 créneau de concurrence, et le palier EAS Update de 1 000 MAU ; toutes les
citations Apple, Google et Expo de §3.1 ; les seuils des Live Activities (8 h + 4 h, 160 pt) ; l'introduction de
`POST_NOTIFICATIONS` en Android 13 (API 33) ; la matrice de plateformes de `AppState` en §6.1 ; les limites du
service de push Expo (600 notifications/s, lots de 100, reçus purgés à 24 h, absence de SLA).

### 8.4 Estimé — chaque estimation avec sa méthode

| Estimation | Valeur retenue | Méthode, et pourquoi ce n'est pas une mesure |
|---|---|---|
| Durée facturée du Lambda d'API dans le modèle de coût | **300 ms** | Arrondi au-dessus de la moyenne d'exécution **mesurée** (284,45 ms). La moyenne facturée mesurée (1 441,40 ms) est **écartée** : elle est dominée par les démarrages à froid d'un environnement quasi inactif, ce qui ne représente pas 100 utilisateurs actifs et plus. Sensibilité complète en §5.6 (×3,69) |
| Longueur d'une URL S3 présignée | **~800 octets** | Ordre de grandeur d'une URL `GET` présignée avec les paramètres de requête SigV4. **Non mesuré** — l'endpoint présigne au moment de servir, et la mesure de §5.1 porte sur les lignes au repos |
| Page de liste avec vignettes présignées | **~22 Ko brut / ~8 Ko gzip** | 14 675 o mesurés + 800 o × la proportion mesurée de lignes à vignette `s3://` (42/93). Estimation composite : une mesure plus une estimation |
| Durée facturée du `push_notification_worker` | **1 000 ms à 256 Mo** | Le worker attend deux appels HTTP vers Expo — le commentaire Terraform le dit explicitement (« *the work is waiting on a third party, not computing* », `lambda_workers.tf`). `-dev` n'émet pas assez de notifications pour échantillonner. Volontairement majorant : la vérification des reçus est comptée à **une invocation par notification**, alors que le worker peut en grouper 100 |
| Durée facturée d'un Lambda d'authorizer / de keepalive / de fan-out (options 5-7) | **200 ms à 256 Mo** | Fonctions hypothétiques qui n'existent pas dans le dépôt. Valeur choisie comme plancher réaliste pour un handler qui lit un JWT ou écrit une ligne DynamoDB |
| **A1** — sauvegardes par utilisateur et par jour | **3** (90/mois) | Hypothèse de dimensionnement. `-dev` donne 87 jobs sur 34 jours pour une poignée de testeurs : aucune inférence par utilisateur n'est possible. Sensibilité ×2 en §5.6 |
| **A2** — part des sauvegardes faites écran d'accueil visible | **100 %** | **Borne supérieure délibérée.** Une sauvegarde par share-sheet d'une autre app n'a pas notre écran visible, donc le sondage ne s'arme pas. Le coût réel est inférieur. Sensibilité à 40 % en §5.6 |
| **A4** — retours à l'avant-plan par utilisateur et par jour | **10** (300/mois) | Hypothèse de dimensionnement, non mesurable côté serveur |
| **A5** — minutes de connexion, sessions, période de keepalive | **300 min / 10 sessions / 8 min** | Hypothèse de dimensionnement pour les options 5-7. Le keepalive de 8 min est **contraint** par le quota mesuré de 600 s d'inactivité, pas choisi librement |
| **A6** — relectures par notification reçue | **50 %** | Hypothèse de dimensionnement : l'autre moitié est absorbée soit par le sondage qui avait déjà rafraîchi, soit par une notification jamais ouverte |
| Option 8 — exécutions par jour | **4** | Le plancher documenté est 15 min, mais « *the system controls the background task execution interval* ». 4/jour est un taux prudent pour un ordonnanceur opportuniste. **Non mesuré** — le module n'est pas installé |
| Option 9 — coût serveur | **≈ option 3** | Un producteur d'événement par média, comme l'option 3, plus une gestion de tokens d'activité non modélisée |
| Option 5 — nombre de messages (184/utilisateur/mois) | dérivé | 10 connect + 10 disconnect + 37×2 keepalive + 90 notifications, tous dérivés de A1 et A5 |

### 8.5 Ce qui n'a pas pu être mesuré, et qui est assumé comme tel

- **Aucune mesure par utilisateur n'existe.** `-dev` compte une poignée de testeurs ; toute fréquence par
  utilisateur (A1, A4, A5) est une hypothèse de dimensionnement, jamais une observation.
- **Aucun taux de délivrance de push n'a été mesuré.** Le worker existe mais l'environnement n'a pas produit un
  volume suffisant. Les affirmations de §4.3 et §4.4 sur la fiabilité reposent sur les **contrats publiés** par
  Apple, Google et Expo, cités en §3.1, pas sur une observation locale.
- **Aucune mesure de consommation de batterie n'a été faite.** Les jugements de §4 sur l'énergie s'appuient sur le
  guide Apple et sur la documentation Doze, cités mot pour mot. Aucun chiffre de mAh n'est avancé, précisément
  parce qu'aucun n'a été mesuré.
- **Le comportement d'un client Android 16 réel n'a pas été observé** (option 9) : l'analyse repose sur la
  documentation seule.

---

## 9. Sources

Toutes les pages ci-dessous ont été consultées le **2026-09-18** et renvoyaient un code HTTP 200 à cette date.

### 9.1 Apple

| Source | Ce qu'elle établit |
|---|---|
| [Energy Efficiency Guide for iOS Apps — Minimize Timer Use](https://developer.apple.com/library/archive/documentation/Performance/Conceptual/EnergyGuide-iOS/MinimizeTimerUse.html) (document archivé, dernière mise à jour affichée 2016-09-13) | La condamnation du sondage par timer, les trois règles (timeout, invalidation, tolérance) et le seuil de tolérance de 10 % |
| [Energy Efficiency Guide for iOS Apps — Work Less in the Background](https://developer.apple.com/library/archive/documentation/Performance/Conceptual/EnergyGuide-iOS/WorkLessInTheBackground.html) (archivé) | « *Your app shouldn't wait to be suspended by the system* » et la liste des causes de gaspillage en arrière-plan |
| [Pushing background updates to your app](https://developer.apple.com/documentation/usernotifications/pushing-background-updates-to-your-app) | Absence de garantie de livraison, throttling (« *two or three per hour* »), un seul push retenu, abandon au force-quit, budget de 30 s, `apns-push-type: background` / `apns-priority: 5` |
| [ActivityKit — Displaying live data with Live Activities](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities) | Widget extension requise, 8 h actives + 4 h sur écran verrouillé, troncature au-delà de 160 pt |

### 9.2 Google / Android / Firebase

| Source | Ce qu'elle établit |
|---|---|
| [Optimize for Doze and App Standby](https://developer.android.com/training/monitoring-device-state/doze-standby) | « *Suspends network access* », « *Ignores wake locks* », `JobScheduler`/`WorkManager` à l'arrêt, fenêtres de maintenance, recommandation explicite de FCM contre une connexion persistante, plafond de 9 min des alarmes `…AndAllowWhileIdle`, interdiction Play Store des demandes d'exemption |
| [Live Updates](https://developer.android.com/develop/ui/views/notifications/live-updates) | Périmètre « *ongoing, user-initiated, and time-sensitive* », exclusion « *Don't allow activities triggered by other parties…* », `POST_PROMOTED_NOTIFICATIONS`, Android 16 minimum |
| [Notification runtime permission](https://developer.android.com/develop/ui/views/notifications/notification-permission) | `POST_NOTIFICATIONS` introduite en Android 13 (API 33), notifications désactivées par défaut à l'installation sur 13+, pré-attribution à la mise à jour |
| [FCM — Message types](https://firebase.google.com/docs/cloud-messaging/customize-messages/set-message-type) | Distinction notification / data, plafond de charge de 4 096 octets |
| [FCM — Understand message delivery](https://firebase.google.com/docs/cloud-messaging/understand-delivery) | Dépriorisation des messages qui n'affichent rien, fenêtre d'évaluation de 7 jours, décision par instance d'app, plafond de 100 messages en attente et `onDeletedMessages` |
| [FCM — Message priority](https://firebase.google.com/docs/cloud-messaging/android/message-priority) | Comportement des priorités normale et haute vis-à-vis de Doze |
| [Google Photos — Sauvegarder photos et vidéos](https://support.google.com/photos/answer/6193313) | État de sauvegarde consultable dans l'app + réglage de notification de fin/échec |
| [YouTube — Upload videos](https://support.google.com/youtube/answer/57407) | Écran de traitement puis notification de disponibilité |

### 9.3 Expo / React Native

| Source | Ce qu'elle établit |
|---|---|
| [expo-notifications](https://docs.expo.dev/versions/latest/sdk/notifications/) | `addNotificationReceivedListener`, fenêtre de 3 s de `setNotificationHandler` et son défaut, exigences des notifications background (`expo-task-manager`, charge data-only, `_contentAvailable`), `enableBackgroundRemoteNotifications` → `UIBackgroundModes: remote-notification`, et le fait qu'une propriété de plugin « *require\[s\] building a new app binary* » |
| [Sending notifications with Expo's Push Service](https://docs.expo.dev/push-notifications/sending-notifications/) | Absence de SLA, 600 notifications/s par projet, lots de 100, reçus à relire après 15 min et purgés à 24 h |
| [expo-background-task](https://docs.expo.dev/versions/latest/sdk/background-task/) | Plancher de 15 min traité comme un « *minimum delay* », `UIBackgroundModes: ["processing"]` et `BGTaskSchedulerPermittedIdentifiers`, indisponibilité sur simulateur iOS, nécessité d'un prebuild |
| [EAS — Runtime versions](https://docs.expo.dev/eas-update/runtime-versions/) | La politique `fingerprint` et ce qui rend une mise à jour incompatible avec un binaire installé |
| [Expo pricing](https://expo.dev/pricing) | Palier gratuit : 15 builds iOS + 15 Android par mois, 1 créneau de concurrence ; EAS Update gratuit jusqu'à 1 000 MAU, updates illimités. Valeurs également recopiées en commentaire dans `.github/workflows/mobile-ota-or-build.yml` l. 17-20 |
| [React Native — AppState](https://reactnative.dev/docs/appstate) | Matrice de plateformes des états et des événements : `inactive` iOS uniquement, `focus`/`blur` Android uniquement, `change` partout |

### 9.4 AWS

| Source | Ce qu'elle établit |
|---|---|
| **AWS Price List Query API**, région eu-west-3, interrogée le 2026-09-18 | **Tous** les prix unitaires de §5.0. C'est la source primaire retenue ; les pages publiques ci-dessous donnent les mêmes tarifs sous forme lisible |
| [API Gateway pricing](https://aws.amazon.com/api-gateway/pricing/) | Requêtes HTTP API, messages et minutes de connexion WebSocket |
| [Lambda pricing](https://aws.amazon.com/lambda/pricing/) | GB-s arm64 et x86, requêtes |
| [DynamoDB on-demand pricing](https://aws.amazon.com/dynamodb/pricing/on-demand/) | RRU et WRU |
| [SQS pricing](https://aws.amazon.com/sqs/pricing/) | Requêtes de file standard |
| [AppSync pricing](https://aws.amazon.com/appsync/pricing/) | Invocations GraphQL, notifications, minutes de connexion, opérations Event API |
| [IoT Core pricing](https://aws.amazon.com/iot-core/pricing/) | Minutes de connexion, messages, règles |
| [API Gateway quotas and important notes](https://docs.aws.amazon.com/apigateway/latest/developerguide/limits.html) | Timeout d'intégration de 30 s d'une HTTP API, non augmentable (§4.10). La version archivée du même document, dépôt `awsdocs/amazon-api-gateway-developer-guide`, fichier `doc_source/limits.md`, l'énonce explicitement comme « cannot be increased » |
| [Working with WebSocket APIs](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api.html) | Modèle des routes `$connect` / `$disconnect` / `$default` et `execute-api:ManageConnections` |
| **API Service Quotas**, code de service `apigateway`, eu-west-3, relevé le 2026-09-18 | Valeurs en vigueur pour notre compte : inactivité WebSocket 600 s et durée de connexion 7 200 s, tous deux non ajustables |
| [ECB euro foreign exchange reference rates](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html) | 1 EUR = 1,1481 USD au 2026-09-17 |

### 9.5 Autres apps

| Source | Ce qu'elle établit |
|---|---|
| [Dropbox — Sync icons](https://help.dropbox.com/sync/sync-icons) | Icône de statut de synchro par fichier + notifications système de fin/échec |
| [Descript — Monitor file syncing](https://help.descript.com/hc/en-us/articles/10164999594381) | Panneau de statut consultable depuis l'app, sans canal temps réel |

### 9.6 Sources internes au dépôt

Elles n'ont pas d'URL et sont citées par chemin et numéro de ligne dans tout le document. Les principales :

- `mobile/src/hooks/useMediaPolling.ts` — « *V1 design: no recurring network requests while the inbox is open* »
- `mobile/src/components/MediaProcessingSweep.tsx` l. 39 — la cause racine, déjà documentée dans le dépôt
- `mobile/app/(tabs)/inbox.tsx`, `mobile/src/components/HomeTile.tsx`, `mobile/src/components/MediaListCard.tsx`
- `mobile/src/hooks/useMediaDetailPolling.ts`, `mobile/app/media/folders/[id].tsx`,
  `mobile/src/components/CompletedDetailView.tsx` — les trois sondages bornés déjà en place
- `mobile/src/hooks/usePushNotifications.ts`, `mobile/src/services/pushNotificationService.ts`
- `media_summarizer/core/models/user_media.py`, `media_summarizer/core/services/media_search_service.py`,
  `media_summarizer/core/services/durable_media_service.py`,
  `media_summarizer/api/models/media_contracts.py` — la chaîne de preuve de §1.3
- `media_summarizer/workers/events/media_completed_worker.py`,
  `media_summarizer/workers/digest/scheduler.py`, `media_summarizer/workers/push_notification_worker.py`
- `infrastructure/terraform/modules/platform/lambda_api.tf`, `lambda_workers.tf`, `runtime_env.tf`,
  `iam_lambda.tf`, `sqs.tf`
- `docs/research/task-368-push-delivery/README.md` — décision owner validée dont §7.3 hérite la contrainte de
  contenu des notifications
- `.github/workflows/mobile-ota-or-build.yml` — l'arbitrage OTA / build

**Aucune valeur d'authentification, aucun identifiant de compte et aucune adresse e-mail ne figure dans ce
document.** Les requêtes DynamoDB de §2 ont volontairement omis la projection de `user_email`, qui est porté par
`ProcessingJob` (`core/models/processing_job.py` l. 78).
