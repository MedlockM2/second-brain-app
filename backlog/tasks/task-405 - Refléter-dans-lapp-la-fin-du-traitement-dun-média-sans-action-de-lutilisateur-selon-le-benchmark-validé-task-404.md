---
id: TASK-405
title: >-
  Refléter dans l'app la fin du traitement d'un média sans action de
  l'utilisateur, selon le benchmark validé (task-404)
status: Done
assignee: []
created_date: '2026-09-17 15:35'
updated_date: '2026-09-18 12:58'
labels:
  - mobile
  - ux
  - bug
dependencies:
  - TASK-404
priority: high
type: bug
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Ce qu'il faut faire

Faire en sorte qu'une vignette de média en cours de traitement reflète la fin de ce traitement **sans action de l'utilisateur**, comme l'a signalé un beta testeur TestFlight (build 9) : aujourd'hui, la vignette de l'Accueil garde son état de chargement jusqu'à ce qu'on ouvre le média puis qu'on revienne.

**L'implémenteur commence par lire `docs/research/task-404-media-processing-completion-ui/README.md`, section `Owner Validation` → `Decision`** (et les fichiers `complement-response-*.md` que la décision cite éventuellement). C'est cette décision qui fixe l'approche, le comportement attendu côté utilisateur et les écrans concernés. Ce que recommandait initialement le benchmark ne fait pas foi si la décision de l'owner diverge.

## Contraintes

- iOS et Android partagent la même base de code : le comportement doit être identique sur les deux, sauf si la décision en dispose autrement.
- Pas de couche de compatibilité : ce que l'approche retenue remplace est supprimé dans le même run (`CLAUDE.md`, « Nothing is deployed yet »), y compris les commentaires qui documentent le défaut actuel.
- Tout nouveau texte visible entre dans les 11 catalogues de `mobile/src/i18n/`.

## Note pour l'owner (hors AC)

La vérification visuelle sur appareil, et le déploiement backend si la décision en demande un, se font après le merge sur `main`. Si la décision impose un changement natif (plugin, dépendance native, `app.config.ts`), le merge consommera un build EAS iOS au lieu d'une OTA.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 L'approche décrite dans le champ Decision du README de task-404 est implémentée et branchée sur chaque écran que cette décision désigne.
- [x] #2 Le comportement utilisateur spécifié par la décision (y compris traitement long et échec) est couvert par un chemin de code identifiable, sans code conditionnel par plateforme non requis par la décision.
- [x] #3 Le mécanisme actuel remplacé et les commentaires qui décrivaient le défaut sont supprimés, sans chemin de repli.
- [x] #4 npm run typecheck et npm run lint propres dans mobile/ ; si le backend ou Terraform sont touchés, ruff, mypy et terraform validate propres.
<!-- AC:END -->

## Implementation Notes
<!-- SECTION:NOTES:BEGIN -->
Six livrables A–F de la décision owner, avec les deux écarts qu'elle nomme (D obligatoire quelle que soit la
durée, F retenu sur Recherche/Bibliothèque).

**A — le prédicat (`MediaProcessingSweep.isProcessingLibraryStatus`).** Il testait `ingested` / `resolving`,
deux valeurs que `GET /api/media` n'émet jamais, et laissait `pending` — l'état de tout média qui vient d'être
sauvegardé — hors du balayage. Remplacé par la liste blanche `pending | processing`, jamais par une négation de
la paire terminale : `UserMediaStatus` est nullable par contrat et `null` balayerait indéfiniment (§7.1).
`mobile/src/lib/mediaStatusMarker.ts` compose ce prédicat et `isFailedLibraryStatus` en une réponse unique, lue
par la tuile d'Accueil et par la ligne de liste.

**B, C — le sondage borné (`mobile/src/hooks/useProcessingRefresh.ts`).** 3 s pendant 60 s puis 10 s jusqu'à un
budget de 5 min, armé par quatre déclencheurs (le contenu de la liste, l'écran qui devient visible, le retour de
l'app à l'avant-plan, le pull-to-refresh) et désarmé dès que la liste n'a plus de non-terminal, au blur, et à la
sortie d'avant-plan. Budget épuisé → `isStalled`, que la vignette rend en marqueur statique (`animated={false}`
sur `MediaProcessingSweep`) : le mouvement s'arrête, le marqueur reste. L'ordonnancement vit dans des refs et
non dans un state dont les effets dépendraient, pour que chacun des quatre déclencheurs accorde un budget
*entier*. `useMediaPolling` est renommé `useMediaList` : plus rien de récurrent n'y vit, et sa docstring
« V1 design: no recurring network requests while the inbox is open » est supprimée.

**D — le push visible, sans seuil.** Producteur :
`media_summarizer/core/services/push_notification_dispatch.py`, appelé par
`workers/events/media_completed_worker.py` pour le soumetteur et pour chaque watcher, dédupliqué par le
`indexed_user_ids` déjà en place. Corps = un compteur (« 1 source is ready. »), jamais un titre ;
`data.media_item_id` pour le routage au tap. Le consommateur `push_notification_worker.py` ne connaît plus le
Digest : il lit `channel_id` dans le message et `ANDROID_CHANNEL_ID` disparaît. Second canal Android créé côté
app (`notifications.mediaReadyChannel`, 11 catalogues), et bannière supprimée au premier plan — l'arrivée
déclenche à la place un `refetch` silencieux dans `useProcessingRefresh`. `usePushNotifications` route sur
`data.type` et n'a plus de destination par défaut. Aucun changement Terraform : `PUSH_NOTIFICATION_QUEUE` est
déjà injecté dans tous les Lambdas et `sqs:SendMessage` déjà accordé.

**E — échec.** Rien de plus, comme la décision le demande : `failed` est terminal, donc le sondage se désarme de
lui-même, `MediaFailureBadge` apparaît au tick suivant, et aucun push n'est envoyé (le worker retourne avant).

**F — Recherche / Bibliothèque.** Marqueur et sondage portés sur `MediaListCard`, donc sur les 3 rendus de
`search.tsx` en un seul point ; les hits de recherche ne portent pas de statut par contrat et n'en héritent
donc aucun. Le sondage n'est armé que si la requête est vide, c'est-à-dire quand le corps Bibliothèque est à
l'écran, et ne relit que `loadMedia`.

**Hors de portée de ce run**, laissé à l'owner comme l'annonce la note de la description : la vérification
visuelle sur appareil et le déploiement backend (les quatre modules Python touchés partent à l'image Lambda au
push sur `main`). Aucun test automatisé n'a été ajouté — règle du projet.
<!-- SECTION:NOTES:END -->
