---
id: TASK-415
title: >-
  Aligner le sondage de traduction du transcript sur le pattern
  budget/ré-armement de useProcessingRefresh (task-404/405)
status: To Do
assignee: []
created_date: '2026-09-27 21:46'
labels:
  - mobile
dependencies: []
references:
  - mobile/src/hooks/useProcessingRefresh.ts
  - mobile/src/components/CompletedDetailView.tsx
  - >-
    backlog/tasks/task-405 -
    Refléter-dans-lapp-la-fin-du-traitement-dun-média-sans-action-de-lutilisateur-selon-le-benchmark-validé-task-404.md
priority: medium
type: bug
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Contexte

Feedback testeur `AKsI1Vm2Fgu7CqMkppRaWG8` (rapports de triage `report-2026-09-23.md` et `report-2026-09-27.md`) a révélé, indépendamment du choix de déclenchement de la traduction traité par task-414, un vrai bug d'affichage : dans `mobile/src/components/CompletedDetailView.tsx`, le sondage de la traduction du transcript complet (`TRANSLATION_POLL_MAX_ATTEMPTS = 20` × `TRANSLATION_POLL_DELAY_MS = 3000` = **60 s plafond fixe**) est plus court que la durée réelle mesurée par task-203 (**60-90 s**). Une fois le plafond dépassé, le composant repasse silencieusement en `ready` et affiche le texte original (non traduit) comme s'il s'agissait du résultat final, sans badge ni distinction. Un remontage du composant (balayage entre médias dans le Digest, task-409) remet en plus le compteur de tentatives à zéro au lieu de préserver le budget déjà consommé.

task-411 (refonte de l'onglet Lecture) est désormais mergée (`c407d58`) et vérifiée n'avoir pas touché ce sondage — ses notes d'implémentation listent les statuts `ready` / `translation_pending` / `translation_failed` comme inchangés. Le risque de collision qui justifiait d'attendre est donc levé.

## Solution à reprendre : le pattern déjà validé de task-404/405

`mobile/src/hooks/useProcessingRefresh.ts` résout exactement le même problème (attendre un traitement asynchrone serveur de durée variable) pour les vignettes de l'Accueil/Bibliothèque, avec les deux mêmes symptômes corrigés à l'époque :

- sondage borné en **durée réelle mesurée**, pas en nombre de tentatives fixe : phase rapide (3 s) pendant la première minute, puis phase lente (10 s) jusqu'à un budget total — calibré sur des durées mesurées côté serveur, pas devinées ;
- ré-armement sur focus de l'écran, retour de l'app au premier plan, et pull-to-refresh (ou équivalent pour un écran de détail) — le budget ne se réinitialise jamais « par accident » au simple remontage du composant ;
- désarmement dès que le statut devient terminal ou que l'écran n'est plus visible ;
- **budget épuisé → état `isStalled` explicite**, rendu comme un marqueur figé — jamais comme si le traitement était terminé.

Cette tâche applique le même pattern (pas nécessairement le hook lui-même, qui est câblé sur une liste de vignettes) au sondage de traduction d'un média ouvert, avec un budget couvrant les 60-90 s mesurées par task-203 au lieu du plafond de 60 s actuel.

## Hors scope

- Le choix du déclencheur de la traduction (ingestion vs première lecture) : couvert par task-414, indépendant de ce bug d'affichage.
- Le badge `UNKNOWN` de langue/durée signalé dans le même feedback : non traité ici (arbitrage séparé, cf. `report-2026-09-27.md`).
- Le poll borné de `SourcePreview` (aperçu traduit), qui existe déjà et n'est pas concerné par ce défaut.

## Note pour l'owner (hors AC)

Vérification visuelle sur appareil après merge : partager un média dont la traduction prend plus de 60 s, observer un état « encore en traduction » explicite au lieu du texte anglais présenté comme définitif, puis observer la bascule vers le texte traduit une fois prêt.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le sondage de traduction du transcript complet (CompletedDetailView / TranscriptReader) suit une phase rapide puis une phase lente jusqu'à un budget total couvrant la durée réelle mesurée par task-203 (60-90 s), et non un plafond fixe de 60 s.
- [x] #2 Le budget de sondage n'est pas remis à zéro par un simple remontage du composant (ex. balayage dans le Digest) ; il ne se ré-arme que via un focus d'écran, un retour au premier plan, ou une action explicite équivalente à celles de useProcessingRefresh.
- [x] #3 Lorsque le budget est épuisé et que la traduction n'est toujours pas prête, l'écran affiche un état « encore en traduction » explicite et distinct, jamais le texte original présenté comme traduction finale.
- [x] #4 Le sondage se désarme dès que la traduction passe à un statut terminal (done/failed) ou que l'écran n'est plus visible, sans timer résiduel.
- [x] #5 npm run typecheck et npm run lint propres dans mobile/.
- [x] #6 Aucun test automatisé ajouté (règle du projet).
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Calibrage du budget sur une mesure dev (AC #1)

La fourchette de 60-90 s citée par task-203 a été vérifiée sur la table `translation_idempotence-dev` (eu-west-3), le 2026-09-28. La mesure porte sur les 52 réservations au statut `done`, de `created_at` (réservation) à `updated_at` (passage à `done`) :

| médiane | p90 | p95 | max | terminées en 60 s ou moins |
|---|---|---|---|---|
| 36,3 s | 107,4 s | 143,3 s | 252,5 s | 73,1 % |

L'ancien plafond de 60 s présentait donc environ une traduction sur quatre comme terminée avant qu'elle le soit.

Une relecture le même jour, sur 54 réservations `done`, donne :

| médiane | max | en 60 s ou moins | en 90 s ou moins | en 180 s ou moins | en 300 s ou moins |
|---|---|---|---|---|---|
| 36,1 s | 252,5 s | 74,1 % | 88,9 % | 98,1 % | 100 % |

Un budget calé sur 90 s laisserait donc encore environ une traduction sur neuf en état figé.

Le calendrier retenu couvre la fourchette de task-203 et la traîne mesurée :
- **phase rapide** : une lecture toutes les 3 s pendant la première minute, soit 20 lectures ;
- **phase lente** : une lecture toutes les 10 s jusqu'à **5 minutes**, soit 24 lectures ;
- au total, au plus 44 lectures par armement, en plus du premier chargement.

Les constantes (`FAST_INTERVAL_MS`, `SLOW_INTERVAL_MS`, `FAST_PHASE_MS`, `BUDGET_MS`) sont en tête de `mobile/src/hooks/useTranslationRefresh.ts`, avec la mesure en commentaire. Le budget compte le temps écoulé, pas les lectures réussies : un appareil hors ligne finit donc en état figé au lieu de sonder sans fin.

### Le pattern de task-404/405, appliqué à un seul média

Ce n'est pas `useProcessingRefresh` lui-même, qui est câblé sur une liste de vignettes, mais son pattern. Il vit dans un hook dédié, `useTranslationRefresh` (nouveau fichier : `mobile/src/hooks/useTranslationRefresh.ts`), avec les mêmes choix que l'original :
- des refs et une fonction d'armement simple ;
- `setTimeout(…, 0)` pour respecter `react-hooks/set-state-in-effect` ;
- un écouteur `AppState` `change` qui teste `nextState === "active"`.

**Le budget appartient au média, pas au montage (AC #2).** Le point de départ de chaque budget est gardé dans un `TranslationBudgets` (une `Map` de l'id du média vers l'heure de départ), détenu par l'hôte de l'écran :
- **Carrousel Digest** (`mobile/app/(tabs)/digest/[period].tsx`) : `DigestCarousel` en garde un pour la durée de vie de l'écran de période (`useState(() => new TranslationBudgets())`) et le passe à chaque `DigestPage`, puis à `CompletedDetailView` (nouvelle prop optionnelle `translationBudgets`). Une page démontée par le montage paresseux (`MOUNT_RADIUS = 1`) puis remontée par un balayage **reprend son budget là où il en était**. Si ce budget est déjà épuisé, elle revient directement à l'état figé.
- **Route `/media/[id]`** : elle ne passe rien, et le hook crée son propre store pour ce montage. Ici, un montage *est* l'ouverture de l'écran.

**Ré-armements.** Ce sont les trois de `useProcessingRefresh`, et chacun fait aussi une lecture immédiate :
1. **Retour de l'écran dans la vue après un blur** (changement d'onglet, écran poussé puis refermé) : `grantAll`, un budget neuf pour tous les médias que l'écran a attendus. Cela inclut les pages démontées du carrousel, qui ne sont pas là pour entendre le déclencheur. Le premier focus d'un montage n'est pas un retour : il reprend le budget sans le remettre à zéro.
2. **Retour de l'app au premier plan** : `grantAll` également. Le passage en arrière-plan désarme.
3. **Action explicite** : le bouton « Check again » de l'état figé (`rearm`), qui accorde un budget à ce média seulement. Un écran de détail n'a pas de pull-to-refresh, et ce bouton en est l'équivalent.

Le focus est suivi par `useIsFocused` et une ref `hasBlurredRef`, pas par `useFocusEffect`. Dans expo-router, l'effet de `useFocusEffect` se relance aussi quand l'objet de navigation change d'identité. Une relance qui n'est pas un retour aurait alors ré-accordé un budget par accident, c'est-à-dire exactement le défaut que l'AC #2 interdit.

**Désarmement sans timer résiduel (AC #4).** Il n'existe qu'un seul timer, `timerRef`, et chaque chemin d'arrêt passe par `stop()`, qui l'annule :
- **Statut terminal** : `done` donne `ready` et `failed` donne `translation_failed`. Dans les deux cas `isPending` devient faux, et l'effet appelle `stop()` au rendu suivant. Il en va de même pour `loading`, `not_available` et `error`.
- **Écran hors de la vue** : le nettoyage de l'effet de focus appelle `stop()`, que l'écran soit flouté ou démonté.
- **App en arrière-plan** : `stop()` depuis l'écouteur `AppState`.

Les `setTimeout(…, 0)` d'armement sont annulés dans le nettoyage de leur propre effet. L'écouteur `AppState` est retiré au démontage, et il ignore les écrans hors de la vue (un navigateur à onglets garde les autres écrans montés).

**Robustesse des lectures.**
- Les ticks n'attendent pas leur lecture, parce que le client API n'a pas de timeout : une requête pendue ne doit pas empêcher le budget de s'écouler.
- Du coup, deux lectures peuvent être en vol en même temps. `CompletedDetailView` numérote donc chaque lecture (`rawReadCountRef` et `rawReadAppliedRef`) et ignore toute réponse plus ancienne que la dernière appliquée. Ainsi, un `pending` qui arrive après un `ready` ne remet pas la traduction « en cours ».
- La relecture du sondage (`refreshRawContent`) est silencieuse : elle ne repasse pas par `loading`, et un échec ne change rien à l'écran.

**Suppressions dans `CompletedDetailView`.** Ont disparu :
- `TRANSLATION_POLL_DELAY_MS`, `TRANSLATION_POLL_MAX_ATTEMPTS`, `translationPollRef` et `translationPollCountRef` ;
- l'effet de nettoyage au démontage ;
- `pollForTranslation`, `pollForTranslationRef` et l'effet qui les synchronisait ;
- la branche « max polls reached → `ready` », c'est-à-dire le bug lui-même.

La lecture de la réponse `/raw-content` est désormais faite par une seule fonction, `resolveTranscriptContent`, partagée par le premier chargement et par les relectures. Les deux ne peuvent plus diverger.

### État figé explicite (AC #3)

`TranscriptContentState` gagne `{ status: "translation_stalled"; content }` (`mobile/src/components/TranscriptReader.tsx`). `CompletedDetailView` le dérive de `translation_pending` quand `isStalled` est vrai. `TranscriptReader` le rend ainsi :
- un bandeau `surfaceContainer`, un ton au-dessus du bandeau `surfaceContainerLow` de l'état en cours, pour que les deux états se lisent comme différents, sans filet (règle No-Line) ;
- un glyphe **fixe** `time-outline` au lieu de l'indicateur animé, puisque plus rien ne tourne ;
- le message « Still translating. It is taking longer than usual, so the original text is shown until the translation is ready. » ;
- un bouton « Check again » : `minHeight: TouchTarget.minimum`, `accessibilityRole="button"`, `accessibilityLabel`, `testID="transcript-check-translation"`.

Le texte original reste lisible sous le bandeau, **jamais seul**. Seul `ready` affiche le texte sans bandeau. Seuls des tokens de `theme.ts` sont utilisés ; les tailles de glyphes Ionicons (16) sont celles de l'existant.

### i18n

Trois clés sont ajoutées aux 11 catalogues : `transcript.translationStalled`, `transcript.checkTranslation` et `transcript.checkTranslationA11y`. Elles sont insérées juste après `transcript.translationFailed`, soit 4 lignes par fichier, en un seul bloc localisé, pour limiter les conflits avec task-412 qui travaille en parallèle sur les catalogues. `tsc` garantit qu'aucune clé ne manque (`Catalog = Record<TranslationKey, string>`).

### Vérifications (AC #5, AC #6)

- Dans `mobile/`, `npm run typecheck` sort en 0.
- `npm run lint` donne 0 erreur et un seul avertissement, antérieur et hors périmètre (`src/services/purchaseService.ts:136`, `no-explicit-any`). Les fichiers touchés passent sans avertissement.
- **Aucun test automatisé ajouté.**
- Aucun flow Maestro ne référence la traduction. `TranscriptReader` n'a qu'un seul hôte, `CompletedDetailView`.

### Livraison : OTA

- **OTA, aucun build requis.** Le changement est purement JS/TS, sans dépendance ajoutée : `expo-router` (`useIsFocused`) et `react-native` (`AppState`) sont déjà embarqués. `package.json`, `app.config.ts`, `plugins/` et `patches/` ne sont pas touchés.
- Preuve : `@expo/fingerprint` (`fingerprint:generate`), lancé dans ce worktree, donne `18785ce0a4d13b9ab48d03aff33c6319ddfd4360` sur la base `d367da8` comme sur cette branche. Aucune des 190 sources du fingerprint n'est sous `app/` ou `src/`. **Aucun fichier ne déplace le fingerprint.**

### Écarts et limites à signaler à l'owner

1. **Budget de 5 min au lieu de 90 s.** La tâche demande de couvrir 60-90 s. La mesure dev ci-dessus montre une traîne plus longue : 11 % des traductions au-delà de 90 s, et un maximum à 252 s. Le budget la couvre, et la phase lente à 10 s en limite le coût : 24 lectures sur les 4 dernières minutes.
2. **`grantAll` concerne aussi les médias déjà traduits.** C'est sans effet, parce qu'une traduction terminée ne redevient jamais en attente et que son entrée n'est plus lue. Le store n'est jamais purgé : un écran attend tout au plus une poignée de médias.
3. **Quitter le carrousel du Digest et y revenir** (retour à l'écran de choix, puis réouverture) crée un nouveau montage de l'écran, donc un nouveau store et un budget neuf. C'est l'ouverture d'un écran, pas un remontage de page.
4. Hors périmètre, non touchés : le déclencheur de la traduction (task-414), le badge `UNKNOWN` et le poll de `SourcePreview`.

### Pour l'owner, hors AC : validation sur appareil après la prochaine OTA

1. Partager un média long dont la traduction dépasse 60 s.
2. Observer le bandeau animé « Translating the text... ».
3. Si la traduction n'est pas prête au bout de 5 min, observer le bandeau figé avec « Check again ».
4. Observer la bascule vers le texte traduit une fois prêt.
5. Dans le Digest, balayer deux pages plus loin puis revenir : la page ne doit pas repartir sur un budget neuf.
6. Passer l'app en arrière-plan puis la ramener : lecture immédiate et budget neuf.
<!-- SECTION:NOTES:END -->
