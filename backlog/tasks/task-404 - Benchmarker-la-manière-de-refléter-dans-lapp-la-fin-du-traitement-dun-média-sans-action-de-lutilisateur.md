---
id: TASK-404
title: >-
  Benchmarker la manière de refléter dans l'app la fin du traitement d'un média
  sans action de l'utilisateur
status: Done
assignee: []
created_date: '2026-09-17 15:35'
updated_date: '2026-09-18 11:13'
labels:
  - benchmark
  - mobile
  - ux
dependencies: []
priority: high
type: spike
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Le problème à résoudre

Retour d'un beta testeur TestFlight (build 9, iOS) : quand on ajoute un média, sa vignette apparaît sur l'Accueil (section « Ajouts récents ») dans un état « traitement en cours » — effet visuel de chargement, titre provisoire, pas d'image. **Une fois le traitement terminé côté serveur, la vignette ne se met pas à jour** : elle garde l'état de chargement tant que l'utilisateur reste sur l'écran. Pour voir le vrai titre et l'image, il doit ouvrir le média puis revenir.

Ce qu'attend le testeur, dans ses mots : la mise à jour « devrait se faire sans que l'user ait à cliquer sur la vignette ».

Ce benchmark part de zéro. Il doit établir **comment une app mobile doit refléter la fin d'un traitement asynchrone côté serveur dans son interface**, en s'appuyant sur ce que font les apps établies et sur la documentation des plateformes, puis recommander une approche adaptée à ce projet. Aucune piste n'est privilégiée.

## Faits sur le projet, à prendre pour données

- **App mobile** : Expo / React Native, iOS et Android sur la même base de code (`mobile/`). L'écran concerné est `mobile/app/(tabs)/inbox.tsx`. L'état « en traitement » d'une vignette est dérivé du statut du média (`isProcessingLibraryStatus`, `mobile/src/components/MediaProcessingSweep.tsx` : `ingested`, `resolving`, `processing`) ; les statuts terminaux incluent le succès et l'échec.
- **Coût d'une livraison mobile** : un changement purement JS/TS part en mise à jour OTA gratuite ; tout changement qui déplace le fingerprint Expo (config native, plugin, dépendance native) exige un build, et le palier gratuit EAS n'en donne que 15 iOS par mois (`.github/workflows/mobile-ota-or-build.yml`).
- **Backend** : AWS, API FastAPI sur Lambda, traitement des médias par des workers Lambda enchaînés via SQS (`infrastructure/terraform/modules/platform/`). Timeouts des workers de 60 à 600 s selon l'étape (`lambda_workers.tf`) : la durée totale d'un traitement n'est pas bornée à quelques secondes et varie selon le type de média.
- **Environnement** : seul `-dev` sert aujourd'hui ; `prod` est une coquille dormante. Rien n'est publié en store (voir `CLAUDE.md`, « Nothing is deployed yet ») : aucune contrainte de rétrocompatibilité.

## Hors périmètre

- Le titre de repli non traduit visible sur les vignettes : suivi par task-400.
- La durée du traitement lui-même : on traite ici ce que voit l'utilisateur pendant et après, pas la vitesse du pipeline.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Inventaire des écrans de l'app qui affichent un média dans un état de traitement non terminal, avec ce que chacun affiche aujourd'hui et quand il relit l'état.
- [ ] #2 Durées réelles de traitement mesurées sur -dev (DynamoDB ou CloudWatch), de l'ajout au statut terminal, par type de média : médiane, p90, maximum observé, taille de l'échantillon et méthode de requête.
- [ ] #3 Revue des approches documentées par les plateformes (Apple, Google, Expo) et observées dans des apps établies pour refléter la fin d'un travail asynchrone côté serveur : au moins 5 approches distinctes, chaque affirmation sourcée par une URL et une date de consultation.
- [ ] #4 Pour chaque approche : comportement vu par l'utilisateur (délai de mise à jour, traitement très long, échec, app en arrière-plan puis au premier plan, réseau faible ou absent), coût batterie et données, modifications backend et infrastructure requises sur notre stack, et coût de livraison mobile (OTA ou build).
- [ ] #5 Estimation du coût AWS mensuel en EUR de chaque approche pour 100, 1 000 et 10 000 utilisateurs actifs, hypothèses explicites.
- [ ] #6 Parité iOS / Android explicitement traitée pour chaque approche : ce qui diffère, ce qui ne fonctionne que sur une plateforme.
- [ ] #7 Recommandation argumentée, accompagnée d'une spécification du comportement attendu du point de vue de l'utilisateur à chaque étape, y compris traitement anormalement long et échec.
- [ ] #8 Aucun chiffre inventé : tout nombre non sourcé ni mesuré est marqué comme estimation avec sa méthode de calcul.
- [ ] #9 Le livrable est docs/research/task-404-media-processing-completion-ui/README.md, front-matter owner_decision: pending et section Owner Validation vide (champs Decision et Validated at prêts à être remplis).
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Mode : initial** (le dossier `docs/research/task-404-media-processing-completion-ui/` n'existait pas ; aucun `README.owner-rejected-*.md`, aucune demande de complément).

Livrable produit : `docs/research/task-404-media-processing-completion-ui/README.md` (front-matter `owner_decision: pending`, section Owner Validation vide). Il couvre les neuf critères d'acceptation :

- **§1 — inventaire** des 8 surfaces qui affichent un média non terminal, ce que chacune montre et quand elle relit l'état. Trois défauts distincts y sont établis, code à l'appui : (a) `inbox.tsx` ne relit la liste qu'au montage, au `useFocusEffect` et au pull-to-refresh, donc le balayage continue après la fin du traitement ; (b) aucun écouteur `AppState`, donc un retour d'arrière-plan sur un onglet déjà focalisé ne rafraîchit rien ; (c) `isProcessingLibraryStatus` teste `ingested`/`resolving`/`processing` alors que `GET /api/media` dérive son `status` de `UserMediaRecord.processing_status`, dont le domaine est `pending|processing|ready|failed` — les deux premières branches sont mortes et `pending`, l'état de tout média fraîchement enregistré, n'affiche **aucun** marqueur.
- **§2 — durées réelles mesurées** sur `processing_jobs-dev` (87 jobs, fenêtre du 2026-08-14 au 2026-09-17, méthode de requête et calcul des percentiles documentés) : médiane 22,9 s, p90 40,2 s, p95 68,2 s, max 3 100 s ; 94,3 % des traitements sous 60 s ; les trois jobs au-delà de 1 000 s tombent dans le même incident fournisseur de huit minutes, donc le maximum hors incident sur 34 jours est de 100,6 s. Déclinaison par type de média, par plateforme, et latence de file.
- **§3 — dix approches distinctes**, chaque affirmation sourcée par une URL et une date de consultation (2026-09-18), avec citations verbatim d'Apple, Google et Expo, plus quatre apps établies observées.
- **§4 — grille par approche** : comportement utilisateur (délai, traitement long, échec, arrière-plan → premier plan, réseau faible ou absent), coût batterie et données, modifications backend/Terraform, coût de livraison mobile OTA vs build.
- **§5 — coût AWS mensuel en EUR** à 100 / 1 000 / 10 000 utilisateurs actifs, à partir de deux coûts unitaires reconstruits pas à pas depuis les tarifs publics, avec hypothèses de dimensionnement A1–A7 explicitement étiquetées et une analyse de sensibilité.
- **§6 — parité iOS / Android** traitée approche par approche, y compris la matrice de disponibilité des événements `AppState` de React Native.
- **§7 — spécification du comportement attendu** seconde par seconde, du `pending` initial au statut terminal, avec les cas traitement anormalement long, échec, retour d'arrière-plan, absence de réseau et permission de notification refusée.
- **§8** distingue explicitement ce qui est mesuré, ce qui est calculé de façon déterministe, ce qui est sourcé et ce qui est estimé avec sa méthode.
- **§9** liste toutes les sources.

**Recommandation soumise à l'owner** : combiner l'option 2 (rafraîchissement client borné et auto-terminant : 3 s pendant 60 s, puis 10 s jusqu'à 5 min, armé et désarmé par le contenu de la liste, plus un écouteur `AppState`) comme mécanisme *garanti*, et l'option 3 (notification push *visible* « média prêt » émise par le worker de complétion vers la file de notifications existante) comme mécanisme *opportuniste*. L'argument décisif est documenté en §4.0 : l'option 3 ne demande **aucun** changement Terraform (le nom de la file est déjà dans la map d'environnement partagée et la policy IAM des workers autorise déjà `sqs:SendMessage` dessus) et aucun changement natif côté app (`expo-notifications` est déjà installé et configuré), donc tout part en OTA ; le push *silencieux* (option 4) exigerait `enableBackgroundRemoteNotifications` et `expo-task-manager`, soit deux builds EAS sur un quota gratuit de 15 par mois et par plateforme.

**Cette recommandation attend la validation de l'owner.** La tâche reste en `To Do` ; c'est le champ `owner_decision` du README qui pilote la suite (`ok` / `abandoned` / `redo` / `more`), conformément à `docs/BENCHMARK_OWNER_WORKFLOW.md`. Aucun code source n'a été modifié.

Note de sécurité : `processing_jobs` porte un attribut `user_email`. Il n'a pas été projeté dans les requêtes de mesure et aucune valeur d'identité, aucun identifiant de compte et aucun secret n'apparaît dans le livrable.
<!-- SECTION:NOTES:END -->
