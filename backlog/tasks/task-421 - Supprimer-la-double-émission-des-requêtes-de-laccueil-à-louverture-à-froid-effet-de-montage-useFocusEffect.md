---
id: TASK-421
title: >-
  Supprimer la double émission des requêtes de l'accueil à l'ouverture à froid
  (effet de montage + useFocusEffect)
status: To Do
assignee: []
created_date: '2026-09-29 13:57'
labels:
  - mobile
  - performance
  - bug
dependencies: []
references:
  - mobile/app/(tabs)/inbox.tsx
  - mobile/src/hooks/useMediaList.ts
  - mobile/src/hooks/useHomeSections.ts
  - mobile/MOBILE_CI_CD.md
priority: high
type: bug
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Le symptôme

Une **ouverture à froid de l'accueil déclenche deux fois chacune de ses trois requêtes** : `GET /api/media`, la liste « Reprendre » et le compteur des non classés. Le coût serveur de l'écran d'accueil est donc doublé — y compris la lecture intégrale de la partition `user_media` que task-417 vient précisément de réduire.

## Ce que dit le code (lu avant d'écrire cette tâche, à ne pas re-découvrir)

Deux chemins indépendants tirent les mêmes fetchers au même moment, sans aucun garde d'inflight :

- **Effet de montage.** `useMediaList` (`mobile/src/hooks/useMediaList.ts:133-155`) et `useHomeSections` (`mobile/src/hooks/useHomeSections.ts:147-164`) appellent chacun leur fetcher dans un `setTimeout(…, 0)` au montage, dès que `isAuthenticated`.
- **Effet de focus.** `useFocusEffect` de `mobile/app/(tabs)/inbox.tsx:160-166` appelle `refetch()` + `refreshSections()`. Ce callback s'exécute **aussi au premier focus, c'est-à-dire au montage** — il n'est pas réservé aux retours sur l'onglet.

Résultat : trois requêtes × deux chemins. Aucun des trois fetchers (`fetchMedia:67`, `refreshContinueLearning:69`, `refreshUnsortedCount:106`) ne teste si un appel est déjà en vol ; ils ne partagent qu'un `settledRef` **dont le seul rôle est de décider si le round mérite un span Sentry**, pas de dédupliquer.

Le fait est déjà admis dans le code et dans la doc : le commentaire de `useMediaList.ts:55-62` parle de « the two fetches an open fires (the mount effect and the screen's focus effect) », et `mobile/MOBILE_CI_CD.md:1949-1950` le note noir sur blanc (« a cold open issues every one of the three requests twice. The spans make that visible; removing the duplication is not part of task-417 »). C'est donc un préexistant volontairement laissé hors de task-417, pas une régression de ce run.

## Ce qu'il faut faire

1. **Une seule émission par requête à l'ouverture à froid**, en gardant le comportement de re-lecture au retour sur l'onglet (sync multi-appareils) qui est la raison d'être de l'effet de focus. Deux formes possibles, au choix de l'implémenteur, à justifier dans les notes : soit le fetch initial n'appartient qu'à un seul des deux chemins (l'effet de focus suffit à couvrir le montage, ce qui rendrait les effets de montage des deux hooks redondants), soit chaque fetcher se protège par un garde d'inflight qui fait de la seconde entrée un no-op tant que la première n'a pas répondu. Ne pas régler ça avec un délai ou un debounce temporel.
2. **Ne pas casser les autres déclencheurs**, qui doivent tous rester fonctionnels : le pull-to-refresh (`handleRefresh:168`, qui doit continuer à toujours refaire un vrai appel — c'est le geste par lequel l'utilisateur redemande explicitement), `useProcessingRefresh` (task-405), `subscribeToMediaSaves` (`mediaSaveNotice`) et `retry` après erreur.
3. **Vérifier que les spans de task-417 restent justes.** Les `settledRef` servent à n'instrumenter que le premier paint : une fois la duplication supprimée, il doit toujours y avoir exactement un span par section à l'ouverture, et zéro sur les re-lectures ultérieures.
4. **Mettre à jour les deux endroits qui affirment aujourd'hui le contraire** : le commentaire d'en-tête de `useMediaList.ts:55-62` et la note de `mobile/MOBILE_CI_CD.md:1949-1950`.

## Hors périmètre

`refreshEntitlements()` est appelé par le même `useFocusEffect` et pourrait suivre la même logique, mais il ne fait pas partie des trois requêtes des sections de l'accueil. Si l'implémenteur constate qu'il est lui aussi doublé, le **noter** dans les notes d'implémentation sans élargir la tâche.

## Notes pour l'owner (non vérifiables par l'agent)

Après merge et déploiement : ouvrir l'app à froid et lire le waterfall Sentry de la transaction de navigation de l'accueil — il doit montrer un seul span `recently_added`, un seul `continue_learning`, un seul `unsorted_count`, et plus aucune paire de requêtes HTTP identiques. Puis quitter l'onglet et y revenir, pour vérifier que la re-lecture de focus se produit toujours.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Une lecture du code montre qu'à l'ouverture à froid de l'accueil, chacun des trois fetchers (`fetchMedia`, `refreshContinueLearning`, `refreshUnsortedCount`) ne peut plus être exécuté qu'une fois : soit un seul des deux chemins (effet de montage / `useFocusEffect`) le déclenche, soit un garde d'inflight rend la seconde entrée no-op. La solution retenue est expliquée dans les notes d'implémentation.
- [x] #2 Aucun `setTimeout`, debounce ni délai n'est utilisé comme moyen de déduplication.
- [x] #3 Le pull-to-refresh (`handleRefresh`) déclenche toujours un appel réseau réel, même immédiatement après un appel précédent : le garde éventuel ne s'y applique pas, et c'est vérifiable dans le code.
- [x] #4 Les autres déclencheurs restent câblés et fonctionnels dans le code : `useProcessingRefresh`, `subscribeToMediaSaves` sur les deux hooks, et `retry` après erreur.
- [x] #5 La re-lecture au retour sur l'onglet (sync multi-appareils) existe toujours : revenir sur l'accueil après l'avoir quitté refait les trois appels.
- [x] #6 Les `settledRef` de `useMediaList` et `useHomeSections` restent cohérents avec la nouvelle émission : exactement un span par section au premier paint, aucun sur les re-lectures suivantes.
- [x] #7 Le commentaire d'en-tête de `mobile/src/hooks/useMediaList.ts` ne décrit plus « the two fetches an open fires » comme un fait, mais décrit le comportement réel.
- [x] #8 La note de `mobile/MOBILE_CI_CD.md` qui dit « a cold open issues every one of the three requests twice » est mise à jour pour refléter la correction.
- [x] #9 `npx tsc --noEmit` et `npx eslint` passent sans erreur dans `mobile/`.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### AC #1 — la forme retenue : un seul chemin, et c'est le focus

Des deux formes proposées, c'est **« le fetch initial n'appartient qu'à un seul des
deux chemins »** qui est implémentée, et le chemin gardé est le focus. Mais pas
celui de l'écran : chaque hook porte désormais **son propre** `useFocusEffect`, et
`inbox.tsx` ne déclenche plus que `refreshEntitlements()`.

- `mobile/src/hooks/useMediaList.ts` — l'effet de montage (`setTimeout(…, 0)` +
  `fetchMedia`) est supprimé. À sa place un `useFocusEffect` qui appelle
  `fetchMedia()` et termine `isLoading` sur la première réponse, c'est-à-dire
  exactement le corps de l'ancien effet de montage, déplacé.
- `mobile/src/hooks/useHomeSections.ts` — même opération sur `refresh()`.
- Dans les deux hooks, `isMountedRef` récupère un effet à lui, `[]` en dépendances.
  Il partageait celui du fetch initial, dont les dépendances étaient
  `[isAuthenticated, fetch…]` : un changement de session le basculait à `false`
  puis à `true` alors que l'écran n'avait bougé de nulle part.

Pourquoi ce chemin plutôt qu'un garde d'inflight :

1. **Le garde aurait eu besoin d'une échappatoire.** L'AC #3 exige que le
   pull-to-refresh refasse toujours un vrai appel ; un garde dans `fetchMedia`
   aurait donc réclamé un paramètre `force` que seul `refresh` passe — soit une
   seconde politique à l'intérieur du fetcher, juste pour arbitrer entre deux
   appelants qu'on peut simplement réduire à un.
2. **Le garde laisse la course en place** et se contente de la rattraper. Ici il
   n'y a plus de course : un appelant automatique, une requête.
3. **Les deux `setTimeout(…, 0)` disparaissent.** Ils n'étaient pas là pour
   dédupliquer mais pour contourner `react-hooks/set-state-in-effect` (un
   `setState` atteint synchronement depuis un corps d'effet). Le corps du
   `useFocusEffect` n'atteint aucun `setState` de façon synchrone — le premier
   arrive après l'`await` de la requête, dans le `.finally` — donc le report d'un
   tick n'a plus de raison d'être.

Pourquoi le focus **dans le hook** et pas dans l'écran : le hook garde la
responsabilité de savoir quand il se lit, comme il la garde déjà pour
`subscribeToMediaSaves`. La variante « l'écran appelle `refetch()` sur son focus et
le hook ne se lit jamais tout seul » donne le même nombre de requêtes mais laisse
un `useMediaList` qui ne charge rien à moins que son appelant y pense. Le précédent
est déjà dans le dossier : `useProcessingRefresh` porte son propre
`useFocusEffect`.

Le montage est bien couvert : un onglet prend le focus **en** se montant, et
`useFocusEffect` exécute son callback dans l'effet quand `navigation.isFocused()`.
Un montage sans focus (écran préchargé, `/share-confirmation` poussé par-dessus) ne
lit plus rien jusqu'au focus, ce qui est le comportement souhaitable et pas une
régression au partage à froid : `ShareIntentContext.navigateToConfirmation` pousse
l'écran dans un `setTimeout(…, 0)` postérieur au premier focus de l'accueil.

Une transition `isAuthenticated: false → true` écran monté ne redouble pas non
plus : elle change l'identité de `fetchMedia` / `refresh`, donc celle du callback
du `useFocusEffect`, qui se rejoue une fois. Avant, elle rejouait l'effet de
montage **et** celui de focus.

### AC #3 — le pull-to-refresh n'a rien à contourner

`handleRefresh` (`inbox.tsx`) appelle `refresh()` et `refreshSections()`. Aucun des
deux ne consulte quoi que ce soit avant d'émettre : `refresh` de `useMediaList`
positionne `isRefreshing` puis entre directement dans `fetchMedia`, et celui de
`useHomeSections` est un `Promise.all` sur les deux fetchers. Il n'existe nulle part
de drapeau d'inflight, donc il n'y a pas de garde dont il faille exempter le geste.
`rearmProcessingRefresh()` est intact.

### AC #4 — les autres déclencheurs

- `useProcessingRefresh` reçoit toujours `refetch` (`inbox.tsx:165`), et son propre
  `useFocusEffect` n'émet aucune requête à l'armement — il programme des ticks. Pas
  de nouvelle duplication de ce côté.
- `subscribeToMediaSaves` : les deux effets sont inchangés dans les deux hooks.
- `retry` : inchangé, y compris son `.finally` qui remet `isLoading` à `false` même
  si le fetch sort tôt.

### AC #6 — les spans

Le mécanisme des `settledRef` n'est pas touché : un span est ouvert par tour de
fetch tant que le drapeau est `false`, et le drapeau se verrouille au commit
(succès **ou** échec). Avec une seule émission à l'ouverture, cela fait exactement
un `home.recently_added`, un `home.continue_learning`, un `home.unsorted_count`, et
rien sur les tours suivants. Le span part même un peu plus tôt qu'avant — le fetch
démarre dans l'effet de focus au lieu d'un tick plus tard — donc toujours à
l'intérieur de la transaction de navigation qu'exige `onlyIfParent: true`.

Les deux commentaires qui justifiaient le `ref` par « les deux fetchs d'une
ouverture sont des closures du même render » ont perdu leur argument : ils invoquent
maintenant le bon, qui tient toujours — les fetchers sont des `useCallback` clés sur
la session seule, donc un state lu dans leur corps resterait le `false` du render
qui les a construits, et chaque rafraîchissement gagnerait un span.

### Hors périmètre, constaté : `refreshEntitlements` est doublé aussi

Confirmé, et non traité comme demandé. `PurchasesContext`
(`src/contexts/PurchasesContext.tsx:146-151`) appelle déjà `refreshEntitlements()`
dans un `setTimeout(…, 0)` dès que `isAuthenticated` passe à `true`, et le
`useFocusEffect` de l'accueil l'appelle au même moment : `GET
/api/entitlements/status` part donc deux fois à l'ouverture à froid. Le remède est
de la même forme (un seul chemin), mais il porte sur un contexte monté au-dessus de
tous les écrans, pas sur les trois sections de l'accueil.

### AC #9 — vérifications

`npx tsc --noEmit` : 0 erreur. `npx eslint . --ext .ts,.tsx` : 0 erreur, 1 warning
préexistant hors périmètre (`src/services/purchaseService.ts:136`,
`no-explicit-any`).

Aucun test automatisé ajouté, conformément aux règles du dépôt.
<!-- SECTION:NOTES:END -->
