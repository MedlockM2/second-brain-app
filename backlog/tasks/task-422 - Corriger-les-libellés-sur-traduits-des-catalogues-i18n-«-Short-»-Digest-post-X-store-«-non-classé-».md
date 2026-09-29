---
id: TASK-422
title: >-
  Corriger les libellés sur-traduits des catalogues i18n : « Short », Digest,
  post X, store, « non classé »
status: To Do
assignee: []
created_date: '2026-09-29 16:53'
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
- [ ] #1 `mediaType.short` vaut `SHORT` dans en, fr, es, pt, de, it, nl, et la translittération arabe dans ar ; ja (ショート), hi (शॉर्ट) et zh (短视频) sont inchangés
- [ ] #2 Aucune des 11 locales n'a la même valeur pour `tabs.digest` et pour `artifacts.type.summaryShort` ; es, pt et nl valent `Digest` comme fr, de et it
- [ ] #3 `mediaTitle.label.xPost` emploie le mot « post » dans en, fr, es, pt, de, it, nl, et le même mot que `plan.cost.free.label` dans chaque locale ; la marque X est écrite de la même façon dans ces deux clés des 11 locales
- [ ] #4 Le mot « boutique » n'apparaît plus dans mobile/src/i18n/fr.ts ; les messages de purchaseError et de deleteAccount y emploient « store » ou le nom du store
- [ ] #5 Dans chaque locale, les clés folderPicker.unsorted, home.unsortedReview, home.unsortedReviewA11y, unsortedReview.title et unsortedReview.closeA11y emploient un seul et même terme pour « unsorted », dans la langue de la locale et jamais le mot anglais ; ce terme est « non classé » en français
- [ ] #6 Le libellé d'affichage du dossier par défaut a une seule source de vérité traduite : DEFAULT_FOLDER_LABEL n'injecte plus de chaîne anglaise en dur dans folderActions.deleteBody / deleteSubfolders.* ni dans la recherche de dossiers, qui lisent la valeur traduite de folderPicker.unsorted
- [ ] #7 Le nom du dossier par défaut stocké côté backend (`Uncategorized`) et le contrat de l'API sont inchangés : seul l'affichage bouge
- [ ] #8 folderTree.ts et folderSearch.ts restent des modules purs : aucun import de contexte React ni de hook n'y est ajouté
- [ ] #9 Le commentaire d'en-tête de fr.ts ne présente plus « Reader » comme un libellé non traduit sans distinguer le palier d'abonnement de l'onglet media.tab.reader, qui reste traduit dans les 11 locales
- [ ] #10 Les 11 catalogues portent exactement le même jeu de clés qu'avant la tâche : aucune clé ajoutée, renommée ou supprimée
- [ ] #11 `npm run typecheck` et `npm run lint` passent dans mobile/
<!-- AC:END -->
