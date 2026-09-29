---
id: TASK-422
title: >-
  Corriger les libellés sur-traduits des catalogues i18n : « Short », Digest,
  post X, store, « non classé »
status: Done
assignee: []
created_date: '2026-09-29 16:53'
updated_date: '2026-09-29 19:49'
labels:
  - mobile
  - ux
  - i18n
dependencies: []
references:
  - mobile/src/i18n/fr.ts
  - mobile/src/i18n/en.ts
  - mobile/src/i18n/es.ts
  - mobile/src/i18n/pt.ts
  - mobile/src/i18n/de.ts
  - mobile/src/i18n/it.ts
  - mobile/src/i18n/nl.ts
  - mobile/src/i18n/ja.ts
  - mobile/src/i18n/zh.ts
  - mobile/src/i18n/hi.ts
  - mobile/src/i18n/ar.ts
  - mobile/src/lib/folderTree.ts
  - mobile/src/lib/folderSearch.ts
  - mobile/src/hooks/useFolderActions.ts
  - mobile/src/lib/mediaTypeDisplay.ts
priority: medium
type: bug
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Passe de terminologie sur les 11 catalogues de `mobile/src/i18n/`. Le déclencheur : le badge de type d'un média `short_video` s'affiche « COURT » en français (`fr.ts:56`, rendu par `getMediaTypeLabel()`, `mobile/src/lib/mediaTypeDisplay.ts:52-53`). Personne ne dit « un court » — un francophone dit « un Short ». C'est le nom d'un format de plateforme, pas un adjectif de durée : il ne se traduit pas. Le ja et le hi l'ont d'ailleurs translittéré (`ショート`, `शॉर्ट`) et le zh utilise le vrai terme chinois (`短视频`) ; ce sont les trois seules locales correctes aujourd'hui.

L'audit a trouvé cinq autres cas de la même famille. Les six décisions de vocabulaire ci-dessous sont **tranchées par l'owner, à ne pas re-débattre** ; seule la formulation exacte dans les langues non latines reste à l'appréciation de l'implémenteur.

**1. `mediaType.short` — garder « SHORT »**, dans la casse du badge. `fr` COURT, `es` CORTO, `pt` CURTO, `de` KURZ, `it` BREVE, `nl` KORT deviennent `SHORT`. `ar` `قصير` devient la translittération `شورت`, pour suivre ce que font déjà ja et hi. `ja`, `hi`, `zh` sont corrects et ne bougent pas.

**2. `tabs.digest` — garder « Digest »**, qui est le nom de la fonctionnalité. Cinq locales l'ont traduit par leur mot pour « résumé », et ce mot est **déjà** la valeur de `artifacts.type.summaryShort` : deux choses différentes de l'app portent exactement le même nom (`es` Resumen/Resumen, `pt` Resumo/Resumo, `nl` Samenvatting/Samenvatting, `zh` 摘要/摘要, `ar` الملخّص/ملخّص). `es`, `pt`, `nl` prennent `Digest` comme le font déjà fr, de et it. Pour `ar` et `zh`, prendre un terme distinct de leur mot pour « résumé », sur le modèle de la translittération déjà retenue par ja (`ダイジェスト`) et hi (`डाइजेस्ट`) — proposition : `ar` `دايجست`, `zh` `精选`. L'owner ajustera ces deux valeurs s'il veut, l'exigence tenue par l'AC est la distinction.

**3. `mediaTitle.label.xPost` — garder « post »**, le mot que l'UI de X emploie elle-même. En prime, chaque catalogue se contredit déjà tout seul : `fr` dit « Publication X » ici et « posts X » dans `plan.cost.free.label:294`, même écart en `es` (Publicación de X / posts de X), `pt` (Publicação no X / posts no X), `de` (X-Beitrag / X-Posts), `nl` (X-bericht / X-posts). Aligner sur le mot « post » : `fr` « Post X », `es` « Post de X », `pt` « Post no X », `de` « X-Post », `nl` « X-post ». `it` est déjà bon (« Post su X »). `ja`, `zh`, `hi`, `ar` gardent leur mot natif pour post (投稿, 帖子, पोस्ट, منشور), qui est l'usage local — en revanche aligner la marque X elle-même : `ar:714` écrit `إكس` alors que `ar:239` écrit `X`, `hi:667` écrit `एक्स` alors que `hi:241` écrit `X`.

**4. `store` — garder « store »** en français. `fr` mélange les deux : « La boutique n'a pas pu finaliser l'achat » (`fr.ts:641-642`), « le moyen de paiement de votre compte boutique » (`645-646`), « le compte boutique qui l'a acheté » (`647-648`), mais « les réglages de votre store » dans `deleteAccount.subscriptionBodyApple/Google`. « compte boutique » ne se dit pas ; le placeholder `{store}` vaut littéralement « App Store » / « Play Store » (`mobile/src/constants/legal.ts:33`). Le mot « boutique » disparaît de `fr.ts`. Les autres locales emploient leur mot natif partout sans se contredire (`es` tienda, `pt` loja, `zh` 商店, `ar` المتجر) ou déjà « store » (de, it, nl, ja, hi) : **elles ne sont pas touchées par ce point**.

**5. « unsorted » — toujours traduit, jamais laissé en anglais**, et un seul mot par langue. En français, le terme retenu est **« non classé »** : `folderPicker.unsorted` (`fr.ts:522`) dit aujourd'hui « Non trié » alors que les quatre clés de l'écran de triage disent « non classés » (`482`, `483`, `488`, `491`) — et les deux se croisent à l'écran. Même incohérence interne à corriger en `pt` (« Sem categoria » vs « não organizados »), `ja` (`未分類` vs `未整理`) et `hi` (`अवर्गीकृत` vs `बिना श्रेणी वाले`). `es`, `de`, `it`, `nl`, `zh`, `ar` sont déjà cohérentes.

**6. Corollaire de 5, dans le code : `DEFAULT_FOLDER_LABEL = "Unsorted"`** (`mobile/src/lib/folderTree.ts:8`) est une chaîne anglaise en dur, et c'est elle — pas la clé traduite — qui remplit `{unsorted}` dans les trois messages de suppression de dossier (`useFolderActions.ts:235` et `241`, rendus dans `folderActions.deleteBody` / `deleteSubfolders.*`) et qui sert de nom de recherche du dossier par défaut (`folderSearch.ts:46-47`). Résultat : un user français lit « Toutes les sources qu'il contient passent dans Unsorted », et taper « non classé » dans le sélecteur de dossier ne trouve rien. Le libellé du dossier par défaut doit avoir **une seule source de vérité, traduite** : la clé `folderPicker.unsorted`, déjà utilisée par `FolderPickerView.tsx:293,302`. Attention au sens de la dépendance : `folderTree.ts` et `folderSearch.ts` sont des modules purs, ils ne doivent pas se mettre à importer le contexte React — `t()` de `mobile/src/i18n` est appelable hors composant, vérifier comment les autres modules `lib/` l'utilisent (par ex. `mediaTypeDisplay.ts`) et suivre le même pattern. Le nom stocké côté backend (`Uncategorized`) ne change pas, c'est un libellé d'affichage seulement.

**Hors périmètre, tranché par l'owner :** l'onglet « Lecture » de la page Média (`media.tab.reader`) **reste traduit** dans les 11 langues — c'est le mode de lecture d'un média, pas le palier d'abonnement « Reader ». En revanche le commentaire d'en-tête de `fr.ts:8` est trompeur : il liste « Reader, Mix, Audio-Heavy » comme noms de produit non traduits, alors que ce sont les noms des paliers d'abonnement (`mobile/src/lib/subscriptionDisplay.ts:30-32`) et qu'une clé `media.tab.reader` traduite existe à côté. Reformuler ce commentaire pour lever l'ambiguïté. `artifacts.type.flashcards` (« Cartes mémo ») reste tel quel : l'owner ne l'a pas retenu.

**Note à l'owner (hors AC) :** après merge et build, vérifier à l'œil sur simulateur que le badge `SHORT` ne déborde pas de sa pastille dans les locales où il était plus court (`it` BREVE → SHORT, `de` KURZ → SHORT) et que « Digest » tient dans l'onglet en es/pt/nl.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `mediaType.short` vaut `SHORT` dans en, fr, es, pt, de, it, nl, et la translittération arabe dans ar ; ja (ショート), hi (शॉर्ट) et zh (短视频) sont inchangés
- [x] #2 Aucune des 11 locales n'a la même valeur pour `tabs.digest` et pour `artifacts.type.summaryShort` ; es, pt et nl valent `Digest` comme fr, de et it
- [x] #3 `mediaTitle.label.xPost` emploie le mot « post » dans en, fr, es, pt, de, it, nl, et le même mot que `plan.cost.free.label` dans chaque locale ; la marque X est écrite de la même façon dans ces deux clés des 11 locales
- [x] #4 Le mot « boutique » n'apparaît plus dans mobile/src/i18n/fr.ts ; les messages de purchaseError et de deleteAccount y emploient « store » ou le nom du store
- [x] #5 Dans chaque locale, les clés folderPicker.unsorted, home.unsortedReview, home.unsortedReviewA11y, unsortedReview.title et unsortedReview.closeA11y emploient un seul et même terme pour « unsorted », dans la langue de la locale et jamais le mot anglais ; ce terme est « non classé » en français
- [x] #6 Le libellé d'affichage du dossier par défaut a une seule source de vérité traduite : DEFAULT_FOLDER_LABEL n'injecte plus de chaîne anglaise en dur dans folderActions.deleteBody / deleteSubfolders.* ni dans la recherche de dossiers, qui lisent la valeur traduite de folderPicker.unsorted
- [x] #7 Le nom du dossier par défaut stocké côté backend (`Uncategorized`) et le contrat de l'API sont inchangés : seul l'affichage bouge
- [x] #8 folderTree.ts et folderSearch.ts restent des modules purs : aucun import de contexte React ni de hook n'y est ajouté
- [x] #9 Le commentaire d'en-tête de fr.ts ne présente plus « Reader » comme un libellé non traduit sans distinguer le palier d'abonnement de l'onglet media.tab.reader, qui reste traduit dans les 11 locales
- [x] #10 Les 11 catalogues portent exactement le même jeu de clés qu'avant la tâche : aucune clé ajoutée, renommée ou supprimée
- [x] #11 `npm run typecheck` et `npm run lint` passent dans mobile/
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### AC #1 — `SHORT`

`fr` COURT, `es` CORTO, `pt` CURTO, `de` KURZ, `it` BREVE, `nl` KORT → `SHORT`.
`ar` `قصير` → `شورت` (translittération, comme ja et hi). `ja`, `hi`, `zh` intacts.
Un commentaire dans `en.ts` au-dessus de la clé dit maintenant pourquoi c'est un
nom de format de plateforme et pas un adjectif de durée, pour que la prochaine
passe de traduction ne la retraduise pas.

### AC #2 — Digest, et le nom de la fonctionnalité dans tout l'écran

`tabs.digest` : `es` Resumen, `pt` Resumo, `nl` Samenvatting → `Digest` ;
`zh` 摘要 → `精选` ; `ar` الملخّص → `دايجست` (valeurs proposées par la description,
l'owner peut les ajuster — l'exigence tenue est la distinction avec
`artifacts.type.summaryShort`, vérifiée clé par clé sur les 11 locales).

Deux clés voisines nommaient la même fonctionnalité avec le mot « résumé » dans ces
cinq locales, ce qui aurait laissé un onglet « Digest » ouvrant un écran qui dit
« Resumen » : `digest.loadFailed` et `digest.emptyDailyHint` emploient maintenant le
nom retenu, exactement comme le font déjà fr, de et it. `deleteAccount.erased.schedule`
n'est pas touché : `en` y écrit « digests » en minuscule au sens commun, pas le nom
de l'onglet.

### AC #3 — « post » et une seule graphie de la marque X

`fr` « Post X », `es` « Post de X », `pt` « Post no X », `de` « X-Post »,
`nl` « X-post » ; `it` était déjà « Post su X ». `ja`, `zh`, `hi`, `ar` gardent leur
mot natif (投稿, 帖子, पोस्ट, منشور). Marque alignée sur `plan.cost.free.label` :
`ar` `إكس` → `X`, `hi` `एक्स` → `X`, et `ja` `Xの投稿` → `X の投稿` (même espacement
que la clé de plan). `mediaTitle.label.instagramPost` n'est pas touché : l'UI
française d'Instagram dit bien « publication », c'est le même raisonnement que pour X
appliqué à une autre plateforme.

### AC #4 — « store » en français

`purchaseError.storeProblem` (« La boutique » → « Le store »),
`purchaseError.paymentInvalid` et `purchaseError.alreadyOwned` (« compte boutique »
→ « compte store »). `deleteAccount.subscriptionBodyApple/Google` disaient déjà
« les réglages de votre store » et ne bougent pas. Plus aucune occurrence de
« boutique » dans `fr.ts`. Les autres locales ne sont pas touchées par ce point.

### AC #5 — un seul terme par langue pour « unsorted »

Les quatre clés de l'écran de triage portaient déjà le bon terme dans les locales
incohérentes ; c'est donc `folderPicker.unsorted` qui s'aligne sur elles, ce qui est
aussi la résolution que la description a tranchée pour le français :

- `fr` « Non trié » → « Non classé » (les quatre autres clés disent « non classés »)
- `pt` « Sem categoria » → « Não organizados »
- `ja` `未分類` → `未整理`
- `hi` `अवर्गीकृत` → `बिना श्रेणी` (les clés de triage disent « बिना श्रेणी वाले »,
  même terme fléchi)

`es`, `de`, `it`, `nl`, `zh`, `ar` étaient déjà cohérentes et ne bougent pas ;
aucune locale n'emploie le mot anglais. `unsortedReview.loadFailed`, qui n'est pas
dans la liste de l'AC mais emploie le même terme, reste cohérente dans chaque locale
par construction (c'est le terme des clés de triage qui a été gardé partout).

### AC #6 / #8 — une source de vérité, et les modules restent purs

`DEFAULT_FOLDER_LABEL = "Unsorted"` est supprimé au profit de
`getDefaultFolderLabel()` (`mobile/src/lib/folderTree.ts`), qui retourne
`t("folderPicker.unsorted")`. Une fonction et pas une constante : le catalogue est
installé à l'exécution, une constante lue au chargement du module figerait la locale
de repli.

`t` est importé depuis `../i18n` — le même import que `mediaTypeDisplay.ts`,
`quotaError.ts`, `planCopy.ts` et les six autres modules de copie de `lib/`. C'est la
moitié non-React du runtime (`i18n/runtime.ts`), donc aucun contexte ni hook n'entre
dans `folderTree.ts` ou `folderSearch.ts` : ils restent appelables hors composant.

Les cinq appelants :

- `useFolderActions.ts` — `{unsorted}` de `folderActions.deleteBody` et de
  `folderActions.deleteSubfolders.*` (la valeur est lue une fois par ouverture de
  l'alerte).
- `folderSearch.ts` — nom de recherche du dossier par défaut, lu une fois par appel
  et non par dossier. Taper « non classé » le trouve.
- `app/(tabs)/search.tsx` et `app/media/folders/index.tsx` — la ligne épinglée en
  tête de liste. Le libellé est une *dépendance* du `useMemo` et non une constante
  lue dedans, sinon un changement de langue d'interface laisserait l'ancien libellé.
- `app/media/folders/[id].tsx` — hors liste initiale de la tâche, même famille de
  bug : le titre de l'écran était réécrit avec `current.name`, donc le dossier par
  défaut s'ouvrait sur un en-tête « Uncategorized » après avoir été listé sous son
  libellé traduit.

### AC #7 — le backend ne bouge pas

Aucun changement de service, de type ou de payload. `Uncategorized` n'est écrit
nulle part dans `mobile/src` en dehors de commentaires, et le dossier par défaut
reste identifié par son drapeau `is_default`, jamais par son libellé.

### AC #9 — l'en-tête de `fr.ts`

Réécrit : il distingue désormais ce qui ne se traduit jamais (nom de l'app, noms de
plateformes et de stores, paliers d'abonnement rendus par
`lib/subscriptionDisplay.ts`, noms de formats et de fonctionnalités — Short, Digest)
de ce qui se traduit comme n'importe quel mot courant, avec `media.tab.reader` nommé
en exemple : c'est le mode de lecture d'une source, pas le palier Reader. La clé
reste traduite dans les 11 locales.

### AC #10 — jeu de clés identique

Le diff des 11 catalogues ne contient que des changements de valeur, plus deux
commentaires ajoutés dans `en.ts`. Aucune ligne `"clé":` n'apparaît ni ne disparaît.

### AC #11 — vérifications

`npm run typecheck` : 0 erreur. `npm run lint` : 0 erreur, 1 warning préexistant hors
périmètre (`src/services/purchaseService.ts:136`, `no-explicit-any`).

Aucun test automatisé ajouté, conformément aux règles du dépôt.

### Reste à l'œil de l'owner (déjà noté dans la description)

Le débordement du badge `SHORT` dans les locales où il s'allonge (`it` BREVE,
`de` KURZ) et la tenue de « Digest » dans l'onglet en es/pt/nl demandent un build :
non vérifiable depuis la worktree.
<!-- SECTION:NOTES:END -->
