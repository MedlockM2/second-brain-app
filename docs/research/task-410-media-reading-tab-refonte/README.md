---
owner_decision: ok   # pending | ok | abandoned | redo | more
---

# Benchmark : refonte UI de l’onglet « Lecture » de la page Média (cinq directions)

## Owner Validation

**Decision**: Direction C bandeau retractable mais à la place de la section aperçu prévue par la direction C on utilise la partie 'l'essentiel' de la direction A
**Validated at**: _(date ISO à remplir par l’owner)_

---

## Recommendation

**Direction A — « Une » : la couverture ouvre la page, l’aperçu devient le chapeau.**
Maquette : `mobile-design-mockups/media_reading_tab_refonte/direction_a_une/`.

La page se compose comme un article : la couverture pleine largeur en 16:9 sous l’en-tête, une ligne de source (créateur · domaine, qui ouvre l’original), le titre, une ligne date · durée · langue · longueur, le segment Lecture / IA inchangé et toujours collant, puis « L’essentiel » dans le *Callout Aside* d’Amber Clarity (barre ambre de 4 pt, fond `primaryTint`), puis le texte complet dans le même défilement.

Cinq arguments, par ordre de force.

1. **C’est la direction qui donne à la couverture la plus grande place sans risque sur la lisibilité ni sur le build.** Couverture de **233 pt, 26 % de l’écran** à 414 x 896 pt (180 pt, 32 % à 320 pt), contre 20 % pour E et 40 % pour C — mais, à la différence de C, sans texte posé sur l’image, sans dégradé, sans bascule de la barre d’état et sans dépendance nouvelle. Pour protéger sa barre d’état, C doit soit ajouter un module natif (`expo-linear-gradient`, donc un build), soit employer `experimental_backgroundImage`, que React Native 0.83 marque « Don’t use them in production » ; et son titre sur verre relève de l’échec F83 des WCAG sur le chemin flou d’iOS (§7).

2. **Elle règle le problème de proportion que pose l’unique carrier à toute image pleine largeur.** L’app reçoit des couvertures en 1,91:1 (articles), 16:9 (YouTube, pages de documents rendues en 640 x 360), 1:1 (podcasts), 9:16 (reels, TikTok) et libres (photos) (§2.2). A recadre les sources paysage et montre **entières** les sources carrées ou verticales, au centre de leur propre copie floutée — le « background extension effect » qu’Apple décrit dans le HIG *Layout*. Apple Podcasts rappelle qu’une couverture d’émission « appears in a square format » et que « Abrupt image cropping, awkward text overlap, and image treatments can cause visual imbalance ». Par construction, C (cadre 4:3) et D et E (cadres 16:9) rognent une pochette carrée de 25 à 44 % de sa hauteur ; et la maquette de C montre sa bande de titre masquant le nom de l’émission imprimé sur la pochette (cadre `c-pod-414`).

3. **L’aperçu reste lisible sans geste, dans le composant que le design system prévoit pour ça.** Le bloc « L’essentiel » commence à **y = 593 pt** à 414 pt et son premier mot est à 633 pt : au-dessus du pli. C’est ce que l’owner a demandé en task-363 (la section est toujours là, et lisible). D le replie derrière un geste ; E en fait le cœur de la page mais met alors le texte derrière un geste. Le *Callout Aside* est décrit par `mobile-design-mockups/my_design_system/DESIGN.md` §5 (« creates an editorial ‘pull quote’ effect ») et ne demande que des tokens existants.

4. **La navigation ne bouge pas.** En-tête (retour, dossier, …) et segment inchangés, à la même place que sur l’écran d’un dossier ; en lecture, le chrome reste celui d’aujourd’hui (180 pt de chrome fixe, 25 lignes de texte à l’écran à 414 pt). task-411 recompose l’onglet et le hero partagé, sans toucher à l’entrée de l’onglet IA.

5. **C’est la moins coûteuse des directions à grande couverture.** `expo-image` est déjà installé et utilisé avec les mêmes props par `MediaListCard` ; le flou est la prop `blurRadius` ; le choix `cover` / `contain` se fait sur les dimensions que renvoie `onLoad` ; le reste est un index de `stickyHeaderIndices` et une clé i18n. **Mise à jour OTA**, aucun module natif.

**Compromis explicitement acceptés :**

- **Le texte complet descend.** Premier mot à **y = 1010 pt** à 414 pt, contre 810 aujourd’hui : on passe de 3 lignes visibles au repos à 0. À 320 pt, 1065 contre 942 (0 ligne dans les deux cas). C’est le prix de la couverture ; le chapeau répond, au-dessus du pli, à la question qu’on se pose en rouvrant une source.
- **À 320 x 568 pt, même le chapeau passe sous le pli** (bloc à 550, premier mot à 590) : le premier écran montre couverture, titre, métadonnées et segment.
- **Rien ne reste de la couverture en lecture**, et il n’y a pas d’indicateur de progression (C a les deux).

**Comment elle est choisie, et pourquoi ce n’est pas la meilleure somme de rangs.** Sur les six critères de la tâche, classés sans pondération, **D obtient 11 et A 13** (§10.2). Mais deux décisions antérieures de l’owner s’appliquent avant tout classement : l’aperçu doit être lisible sur cette page (task-363), et la couverture est l’objet même de la refonte (le seul invariant de la tâche, après l’investissement de task-302, task-304, task-343 et task-344 pour qu’elle soit reconnaissable sur toutes les sources). Telle que dessinée, D replie l’aperçu et donne 2 % de l’écran à la couverture. Parmi les directions qui passent ces deux filtres sans retouche (A, B, C, E), A a la meilleure somme et n’est dernière sur aucun critère (§10.3).

**Repli : direction D — « Texte d’abord »** (`direction_d_texte_dabord/`), si l’owner juge que l’onglet Lecture doit d’abord servir la lecture. Le texte commence à **y = 433 pt** (16 lignes au repos à 414 pt, 6 à 320), le chrome de lecture tombe à 108 pt (27 lignes), la couverture est la vignette même de la liste (112 x 63, même clé de cache) et c’est la direction la plus simple à coder. Un seul réglage à trancher en la retenant : l’état initial de « L’essentiel » — replié (texte à 433 pt, mais l’aperçu demande un geste) ou déplié (cadre `d-open-414` : aperçu visible comme l’a voulu task-363, texte à 723 pt).

**Pourquoi pas B, C ni E :**

- **B « Pochette »** traite le mieux l’image (jamais recadrée) et offre la meilleure liseuse (112 pt de chrome, une seule commande), mais sort la lecture de l’onglet qui s’appelle « Lecture » : un geste et un écran de plus, et le polling de traduction à déplacer. À retenir si l’owner veut faire de la lecture un mode à part.
- **C « Bandeau rétractable »** est la plus spectaculaire et la seule qui garde la couverture pendant la lecture (112 pt de chrome, 27 lignes), mais elle cumule les risques : build pour le dégradé, barre d’état à piloter, titre posé sur l’image, pochettes rognées et masquées, segment réduit à deux icônes en lecture, animation liée au défilement.
- **E « Aperçu d’abord »** colle le mieux à l’usage « de quoi ça parlait déjà ? », et sa carte donne une fonction à l’image (elle ouvre l’original), mais elle met le texte derrière « Lire la suite », déplace le segment en bas (seul écran de l’app où il ne serait pas en haut) et sa barre flottante couvre 114 pt de texte en lecture (23 lignes au lieu de 25).

**À arbitrer avant task-411 : l’ordre avec task-409.** `CompletedDetailView` est aussi monté par le carrousel du Digest (`mobile/app/(tabs)/digest.tsx:434-441`, `showChrome={false}`). Si task-409 applique la direction A de task-408, le Digest cesse de le monter et la question disparaît. Sinon, la couverture de 233 pt de A arrive dans chaque page du Digest, dont task-408 a mesuré qu’elle consomme déjà 448 pt de chrome avant le premier mot. Faire passer task-409 avant task-411 évite de trancher deux fois.

**Où lire quoi :** AC#1 → §1 · AC#2 → §2 · AC#3 → §3 · AC#4 → §4 et `mobile-design-mockups/media_reading_tab_refonte/` · AC#5 → §2.3 et les lignes « Couverture » et « Repli » de §5 à §9 · AC#6 → §5 à §9 · AC#7 → §11 · AC#8 → §12 · AC#9 → §10 · AC#10 → ce fichier (`owner_decision: pending`, section *Owner Validation* vide). Aucun fichier de `mobile/` ni de `media_summarizer/` n’a été modifié : ils ont été lus pour l’inventaire, les tokens et le chemin de l’image.

---

## 1. L’écran « Lecture » actuel (AC#1)

Lecture de l’arbre au 2026-09-26 (après task-363, task-400 et task-404). Les numéros de ligne sont ceux de cet arbre.

### 1.1 Composition et composants, de haut en bas

| # | Bloc | Ce qu’il rend | Fichier et symbole |
|---|---|---|---|
| 0 | Route | Charge l’item, rend ses états de cycle de vie, puis passe la main | `mobile/app/media/[id].tsx`, `MediaDetailScreen` (l. 48-202) ; `useMediaDetailPolling` (`mobile/src/hooks/useMediaDetailPolling.ts`) |
| 1 | Conteneur | `SafeAreaView` sur le bord haut | `mobile/src/components/CompletedDetailView.tsx`, `DetailContainer` (l. 933-948) |
| 2 | En-tête | Retour ; dossier (icône pleine et ambre si l’item est classé) ; `…` qui ouvre Renommer / Supprimer | `MediaDetailHeader.tsx` ; `useMediaActions` avec `canMove: false` (l. 353-359), `AnchoredContextMenu`, `RenameDialog` (l. 914-918) |
| 3 | Toast | « Déplacé vers … », « Retiré du dossier », « Impossible d’ouvrir … » | l. 198-228 et 815-825 |
| 4 | Hero, enfant 0 du `ScrollView` | Titre en display 32 / 700, interligne 38 ; ligne de métadonnées : `SourceChip` (glyphe du type, domaine en capitales, flèche si l’URL s’ouvre), date, durée | l. 841-864 ; `SourceChip` l. 959-1001 ; `resolveMediaTitle`, `getMediaTypeIcon` |
| 5 | Segment Lecture / IA, enfant 1, collant | `ScreenTabs` avec `MEDIA_DETAIL_TABS` | l. 86-89 et 866-875 ; `stickyHeaderIndices` l. 833 |
| 6 | Aperçu | Titre « Aperçu », carte `surfaceContainerLow` : hook et puces, ou attente, ou ligne terminale | `SourcePreview.tsx` ; état, relecture au focus et poll borné l. 230-323 et 746-802 |
| 7 | Texte complet | Titre « Texte complet », ligne langue / durée / nombre de paragraphes, puis les paragraphes, sélectionnables, avec préfixe « Speaker N » éventuel | `TranscriptReader.tsx` ; chargement et poll de traduction l. 590-744 |

Le hero (4) est **au-dessus** du segment : il est commun aux onglets Lecture et IA. Toute couverture placée dans le hero apparaît donc aussi sur l’onglet IA, sans que le contenu de celui-ci change. C’est le cas de A, B, C et D ; dans E, la carte de source et le titre restent communs de la même façon, seul le segment change de place.

### 1.2 Données rendues, et données ignorées

| Donnée du contrat détail | Rendue ? | Où |
|---|---|---|
| `title`, `title_label_key` | oui | titre du hero, via `resolveMediaTitle` (task-400) |
| `original_url` | oui | domaine de la puce, et lien si `http(s)` (`resolveSourceLink`, l. 150-165) |
| `media_type` | oui | glyphe de la puce |
| `created_at` | oui | date du hero (`formatDate`, mois court) |
| `transcript.duration_seconds` | **deux fois** | hero (l. 590-592) et ligne de métadonnées du texte |
| `transcript.language`, `transcript.segments_count`, `transcript.status` | oui | `TranscriptReader` |
| `review_blurb`, `review_blurb_status` | oui | `SourcePreview` |
| contenu brut et traduction | oui | `GET /api/media/{id}/raw-content` (`MediaService.getRawContent`) |
| **`media_image`** | **non** | présent dans `MediaItemContract` depuis task-304, lu par aucun code de cet écran |
| **`creator_name`** | **non** | idem ; son rendu sur cette page était explicitement hors du périmètre de task-304 |

### 1.3 Interactions

Retour ; dossier (pousse `/media/folder?mode=move…` ; au retour, l’écran relit l’item et annonce le déplacement par un toast) ; `…` (Renommer, qui met à jour le titre en place ; Supprimer, qui quitte l’écran) ; puce de source (ouvre l’original par `Linking.openURL`, toast si l’OS refuse) ; segment Lecture / IA ; Réessayer sur un échec de chargement du texte ; sélection du texte. En tâche de fond : relecture de l’item à chaque retour sur l’écran (dossier et aperçu), poll de l’aperçu (3 s, 20 essais), poll de traduction (3 s, 20 essais), poll des artefacts (3 s tant qu’un artefact est en cours).

### 1.4 États déjà pris en charge

| Niveau | États | Où |
|---|---|---|
| Route | chargement (spinner) ; erreur réseau (Réessayer) ; traitement (spinner et message par plateforme) ; délai dépassé (Actualiser) ; échec (Actualiser et `SourceSupportRequestCard`) ; garde « pas de données » | `mobile/app/media/[id].tsx` l. 63-194 |
| Aperçu | prêt (hook et puces) ; en préparation (spinner, poll borné) ; indisponible (ligne calme, sans bouton) | `SourcePreview.tsx`, `resolveSourcePreviewState` |
| Texte | pas de transcript (vide et indice) ; en attente, extraction ou transcription (spinner) ; échec ; chargement ; prêt ; traduction en cours (bandeau et texte) ; traduction échouée (bandeau et texte) ; indisponible ; erreur de chargement (Réessayer) | `TranscriptReader.tsx`, `TranscriptContentState` |

Aucune direction ne supprime l’un de ces états : elles changent leur contenant. La route n’affiche la page qu’une fois le job `completed` ; les états de traitement restent ceux de la route.

### 1.5 Ce que l’écran actuel donne à voir, mesuré

Mêmes cadres et même sonde que pour les directions (§4). L’écran actuel est redessiné en tête de chaque page de maquette.

| Cadre | Bloc de l’aperçu | Premier mot de l’aperçu | Premier mot du texte complet | Lignes du texte à l’écran | Commandes visibles |
|---|---|---|---|---|---|
| 414 x 896 pt, au repos | y = 346 | y = 401 | y = 810 | 3 | 6 |
| 320 x 568 pt, au repos | y = 380 | y = 435 | y = 942 (hors écran) | 0 | 6 |
| 414 x 896 pt, en lecture | — | — | 180 pt de chrome fixe (en-tête 108 + segment collant 72) | 25 | 5 |

### 1.6 Sept faits qui pèsent sur les directions

1. **La couverture et le créateur sont déjà dans le contrat détail, et ne sont pas rendus.** Aucune direction n’a besoin de toucher au backend.
2. **Le hero est partagé par les deux onglets** (1.1) : une couverture dans le hero se voit aussi sur l’onglet IA.
3. **`CompletedDetailView` est partagé avec le Digest** (`digest.tsx:434-441`, sans chrome) : voir la réserve d’ordonnancement dans la recommandation.
4. **La durée est affichée deux fois** (hero et ligne de métadonnées du texte).
5. **Le libellé d’accessibilité de la puce est codé en dur, en anglais** (« Open on » suivi de l’hôte, l. 992), alors que toute chaîne visible ou lue doit passer par les 11 catalogues. À corriger dans task-411, quelle que soit la direction.
6. **La barre d’état est sombre pour toute l’app** (`StatusBar style="dark"`, `mobile/app/_layout.tsx:167`) : une image sous la barre d’état (C) impose de la piloter écran par écran.
7. **Les boutons de l’en-tête font 44 x 44 pt** avec un `hitSlop` de 4, soit 52 pt de zone tactile ; la puce fait environ 25 pt de haut avec un `hitSlop` de 14 (l. 993-996). Les maquettes déclarent ces zones réelles ; toutes les commandes des cinq directions atteignent au moins 48 pt.

---

## 2. L’image média, de la persistance au type mobile, et le repli (AC#2)

### 2.1 Le chemin, vérifié dans le code

| Étape | Ce qui se passe | Où |
|---|---|---|
| Écriture | Les workers posent `job.media_image` ; `display_attributes_from_job` le recopie sur la ligne durable par la paire `("media_image", "thumbnail_url")`, appliquée par `mirror_job` | `media_summarizer/core/services/durable_media_service.py:261-282` et `:528` |
| Persistance | `UserMediaRecord.thumbnail_url`, **unique carrier**, sous deux formes : une URL `https://` (hotlink) ou un localisateur `s3://bucket/key` (couverture ré-hébergée : Instagram, TikTok, photos, documents) | `media_summarizer/core/models/user_media.py:126` ; décision « Approach C » de task-302 |
| Lecture | `GET /api/media/{media_item_id}` appelle `cover_capture.resolve_cover_url(record.thumbnail_url)` : une URL `https` passe telle quelle, un `s3://` est signé pour 24 h (`expiration=86400`) ; un échec de signature rend `None` sans faire échouer la réponse | `media_summarizer/api/endpoints/media.py:2155` et `:2191` ; `media_summarizer/core/services/cover_capture.py:367` |
| Contrat | `_build_media_item_contract(…, cover_url=…)` → `MediaItemContract.media_image` | `media.py:1073` et `:1101` ; `media_summarizer/api/models/media_contracts.py:228` |
| Type mobile | `MediaItemContract.media_image?: string \| null`, commenté « already resolved into a fetchable URL by the API » | `mobile/src/types/media.ts:215-219` |
| Rendu ailleurs | `MediaListCard` (Bibliothèque, Recherche), la carte de tri, la tuile de l’Accueil : `expo-image`, `cacheKey` construite à partir de `media_item_id` et `updated_at`, repli sur le glyphe du type | `MediaListCard.tsx:233-330` ; `mobile/app/media/unsorted-review.tsx:767-812` |

Conséquence utile : la liste et le détail sérialisent `updated_at` à partir du même champ (`record.updated_at.isoformat()`, `media.py:304` et `:1112`). En reprenant la même `cacheKey`, la page trouvera la couverture **déjà dans le cache disque** quand on l’ouvre depuis une liste.

Écart documentaire relevé en passant, hors périmètre : `docs/CANONICAL_MEDIA_API_CONTRACT.md` ne mentionne ni `media_image` ni `creator_name` dans le contrat détail.

### 2.2 Ce que l’image peut être, selon la source

D’après les notes d’implémentation de task-304 et le §4 de task-302.

| Source | Couverture | Proportion reçue | Absente quand |
|---|---|---|---|
| Article | `og:image` / `twitter:image`, hotlink | environ 1,91:1 | le site n’en publie pas ; l’éditeur refuse un hotlink sans `Referer` |
| YouTube | miniature yt-dlp ou Apify, hotlink | 16:9 ; le repli `hqdefault` est en 4:3 | pratiquement jamais |
| Podcast | pochette de l’épisode ou de l’émission, hotlink | 1:1 | flux sans illustration |
| TikTok, Instagram | image ré-hébergée (640 px de grand côté) | 9:16 (reel), 1:1 ou 4:5 (post) | branche Apify de TikTok ; capture en échec |
| Post X | média joint, hotlink | libre | post texte seul (le cas majoritaire) |
| Document | rendu de la page 1, ré-hébergé et recadré en haut (task-344) | 16:9 (640 x 360) | document sans rendu de page |
| Photo | la photo, ré-hébergée | libre | décodage en échec |
| Texte partagé, fichier audio | **aucune, par construction** | — | toujours |

Aucune proportion ne domine : une direction pleine largeur doit dire ce qu’elle fait d’un carré et d’un vertical.

### 2.3 Le repli pour cette page

La règle vaut pour les cinq directions ; chacune l’applique à son cadre (§5 à §9, ligne « Repli »).

1. **Une seule source d’image** : `media_item.media_image`. Pas de favicon du domaine, pas d’avatar du créateur, pas d’image générée ni extraite du texte. task-302 §4 écarte l’avatar pour X (« an avatar is not a cover ») et task-304 impose « One carrier per fact ».
2. **Absente** (`null` ou chaîne vide) : le glyphe du type (`getMediaTypeIcon`) en `textMuted` sur `surfaceContainerLow`, le rendu que les listes ont adopté en task-302 §6.3. L’utilisateur retrouve le glyphe de la vignette qu’il vient de toucher.
3. **En échec** (`onError` : signature expirée après 24 h, hotlink refusé, réseau) : le même rendu, mémorisé par `media_item_id` comme `failedCoverId` dans `MediaListCard`.
4. **Pendant le chargement** : le cadre tonal nu, sans spinner ni blurhash (aucun n’est calculé côté serveur).
5. **Taille** : un cadre de vignette garde sa taille (D) ; un cadre pleine largeur se réduit à **96 pt** (2 x `Spacing.xxl`). Un glyphe ne justifie pas 233 pt d’écran, et un rectangle vide est l’anti-motif nommé par task-302 §6.3.
6. **L’information ne dépend pas du glyphe** : le type est toujours écrit en toutes lettres à côté (ligne de source, pastille, bande). Le glyphe, à 2,6:1 sur son fond, est décoratif et n’est pas exposé au lecteur d’écran.
7. **Même clé de cache que les listes** (2.1).

### 2.4 Ce qui n’est pas proposé

Aucun nouvel endpoint, aucun second champ image, aucun changement de contrat ni de pipeline d’extraction. Le ratio de la source, dont A et B ont besoin, se lit côté client dans l’événement `onLoad` d’`expo-image` (`source.width`, `source.height`) : il n’a pas à voyager dans le contrat.

---

## 3. Revue web : plateformes, recherche et apps de lecture (AC#3)

Toutes les pages ont été **consultées le 2026-09-26**. Les guidelines d’Apple ont été lues par leur endpoint JSON public (sous `developer.apple.com/tutorials/data/design/human-interface-guidelines/`) ; Material 3 et les pages d’assistance Apple, qui sont des applications JavaScript, ont été rendues avec Chrome headless. Les pages d’assistance Apple ont été servies en français ; les autres citations sont en anglais, telles quelles.

### 3.1 Apple Human Interface Guidelines

| Constat | Citation | Source | Effet sur les directions |
|---|---|---|---|
| Hiérarchie | « Order content by relative importance. […] place the most important items near the top and leading side of the window » | [HIG — Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | Chaque direction ordonne autrement couverture, aperçu et texte : c’est le cœur du choix |
| Divulgation progressive | « Use progressive disclosure to make layouts cleaner and easier to interact with. […] particularly useful for media-focused apps like those for video, music, or books » | [HIG — Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | Légitime l’aperçu replié de D, le texte « à la suite » de E, la liseuse de B |
| Image sous les commandes | « you can use a background extension effect to flip and blur the image, mirroring it beneath adjacent components » | [HIG — Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | Le flou de fond de A pour les sources carrées et verticales |
| Commandes et contenu | « Differentiate controls from content. […] use a scroll edge effect to visually elevate controls above content » | [HIG — Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | Boutons en verre de C, barre flottante de E |
| Grands caractères | « horizontally adjacent views may need to stack vertically to provide more space for text » | [HIG — Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | La rangée d’identité de D doit passer en colonne en Dynamic Type |
| Troncature | « Avoid truncating text in scrollable regions unless people can open a separate view to read the rest of the content » | [HIG — Typography](https://developer.apple.com/design/human-interface-guidelines/typography) | Aucun titre n’est tronqué au repos ; B et C ne le tronquent que dans une barre, le titre entier restant dans la page |
| État de repos lisible | « Although colorful content might intermittently scroll underneath controls, make sure its default or resting state — like the top of a screen of scrollable content — maintains clear legibility » | [HIG — Color](https://developer.apple.com/design/human-interface-guidelines/color) | Le haut de C (barre d’état et boutons sur l’image) est précisément cet état de repos |
| Verre = commandes | « Liquid Glass forms a distinct functional layer for controls and navigation elements » | [HIG — Materials](https://developer.apple.com/design/human-interface-guidelines/materials) | Poser le titre, qui est du contenu, sur du verre (C) sort de l’usage prévu |
| Barres d’outils | « Choose items deliberately to avoid overcrowding » ; « Consider temporarily hiding toolbars for a distraction-free experience » | [HIG — Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars) | Densité des en-têtes ; liseuse sans commandes de B |
| Divulgation | « Use a disclosure control to hide details until they’re relevant » ; « Use no more than one disclosure button in a single view » | [HIG — Disclosure controls](https://developer.apple.com/design/human-interface-guidelines/disclosure-controls) | Un seul dépliant dans D, un seul dans E |
| Cible tactile | « a button needs a hit region of at least 44x44 pt » | [HIG — Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons) | Toutes les commandes des maquettes font 48 pt ou plus |
| Contraste | « Strive to meet color contrast minimum standards » (niveau AA des WCAG) | [HIG — Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) | Contrastes calculés au §11 |

### 3.2 Material Design

| Constat | Citation | Source | Effet sur les directions |
|---|---|---|---|
| Barre d’app | « Use an app bar to provide content and actions related to the current page, such as page navigation actions, headlines, images, and 1–2 essential actions » ; « App bars should only have one action, two if necessary » ; « Avoid placing an overflow menu in the app bar when possible » | [M3 — App bars](https://m3.material.io/components/top-app-bar/guidelines) | L’en-tête actuel a deux actions et un menu : A, B et D le gardent, C et E l’allègent |
| Barre qui se rétracte | « Medium flexible […] can collapse into a small app bar on scroll » ; « When scrolled, medium flexible and large flexible app bars can transform into small app bars » | [M3 — App bars](https://m3.material.io/components/top-app-bar/guidelines) | Le bandeau rétractable de C |
| Boutons flottants | « To focus more on body content, consider setting the app bar container to be transparent on scroll. This allows the buttons to float above the content. Make sure icon buttons have a container fill » | [M3 — App bars](https://m3.material.io/components/top-app-bar/guidelines) | Les boutons en verre de C |
| Barre d’outils flottante | « Floats above the body content. It’s best used for contextual actions relevant to the body content » ; « Floating toolbars can be used as tabs between related subsequent pages » ; « Floating toolbars can remain on the screen, animate offscreen, or collapse into a single, high-emphasis action on scroll » | [M3 — Toolbars](https://m3.material.io/components/toolbars/guidelines) | Le segment en bas d’écran de E |
| Texte sur image | « It isn’t recommended to place text or icons on images. If it’s necessary, ensure the background image provides sufficient contrast » ; « Add a translucent scrim or bounding shape beneath the text or icon » | [M3 — Cards](https://m3.material.io/components/cards/guidelines) | La bande de titre de C est cette « bounding shape » ; le risque reste nommé |
| Cartes | « Don’t force content into cards when spacing, headlines, or dividers would create a simpler visual hierarchy » | [M3 — Cards](https://m3.material.io/components/cards/guidelines) | A, B et E retirent la carte grise de l’aperçu |
| Complexité | « Every added button, image, and line of text increases the complexity of a UI » ; « Place important actions at the top or bottom of the screen » | [M3 — Structure](https://m3.material.io/foundations/designing/structure) | Critère de densité des commandes |
| Image d’en-tête | « Hero images are anchored in the most prominent position, such as the top of the screen » ; « Use a single hero image to introduce text content » | [Material 2 — Imagery](https://m2.material.io/design/communication/imagery.html) | A et C placent l’image en tête ; E aussi, en retrait |
| Vignette | « Thumbnails are small images that represent information in tight spaces. They typically act as tap targets that lead to primary content » | [Material 2 — Imagery](https://m2.material.io/design/communication/imagery.html) | La vignette de D confirme sans mener nulle part ; la carte de E, elle, mène à l’original |

### 3.3 Recherche en utilisabilité et WCAG

| Constat | Citation | Source | Effet sur les directions |
|---|---|---|---|
| Faux plancher | « Avoid full-screen hero content. When using large banners, carousels, or videos in the hero space, ensure that additional content peeks above the fold » | [NN/g — The Illusion of Completeness](https://www.nngroup.com/articles/illusion-of-completeness/) (Kim Flaherty, 2016-01-17) | Aucune direction ne remplit l’écran d’image : le titre (A, C, E) ou l’aperçu (B, D) dépasse toujours |
| Petits écrans | « When using large-screen images on smaller screens, remove images that don’t add information. Then, pay close attention to cropping, scaling and placement » | [NN/g — Big Pictures on Small Screens](https://www.nngroup.com/articles/big-pictures-small-screens/) (Amy Schade, 2017-05-21) | Le cadrage selon la proportion est une rubrique de chaque maquette |
| Images décoratives | « Users pay close attention to photos and other images that contain relevant information but ignore fluffy pictures used to ‘jazz up’ web pages » | [NN/g — Photos as Web Content](https://www.nngroup.com/articles/photos-as-web-content/) (Jakob Nielsen, 2010-10-31, revu le 2026-08-13) | La couverture sert à reconnaître la source ; elle ne doit pas coûter plus que ce qu’elle apporte |
| Grandes images | « Large images are visually appealing, but they can harm the overall user experience if they aren’t appropriately prioritized » | [NN/g — Image-Focused Design](https://www.nngroup.com/articles/image-focused-design/) (Kathryn Whitenton, 2014-09-28) | Le coût de A et C en hauteur est mesuré, pas supposé |
| Texte sur image | « text that is not purely decorative or part of a logo should have a contrast ratio of at least 4.5:1 » ; « The lower portion of photos tends to lend itself well to added effects such as a blur, a darkening-gradient overlay […] or a semitransparent colored background for that area of text » | [NN/g — Ensure High Contrast for Text Over Images](https://www.nngroup.com/articles/text-over-images/) (Aurora Harley, 2015-10-18, revu le 2026-01-13) | La bande de titre de C, en bas de l’image |
| Résumé d’abord | « Start content with the most important piece of information so readers can get the main point, regardless of how much they read » ; « Consider adding a summary or list of highlights » | [NN/g — Inverted Pyramid](https://www.nngroup.com/articles/inverted-pyramid/) (Amy Schade, 2018-02-11) | L’aperçu passe avant le texte dans les cinq directions |
| Largeur de 320 | « Vertical scrolling content at a width equivalent to 320 CSS pixels » | [WCAG 2.2 — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) | Le cadre de 320 pt est la largeur de référence de la reflow ; aucun débordement horizontal mesuré |
| Image de fond | « F83: Failure of Success Criterion 1.4.3 and 1.4.6 due to using background images that do not provide sufficient contrast with foreground text » | [WCAG 2.2 — Understanding Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) | Le risque propre de C |
| Décoration | « If non-text content is pure decoration, is used only for visual formatting, or is not presented to users, then it is implemented in a way that it can be ignored by assistive technology » | [WCAG 2.2 — Understanding Non-text Content](https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html) | La couverture est décorative dans les cinq directions : le titre dit ce qu’elle montre |

### 3.4 Huit apps et services de lecture ou de contenus sauvegardés

| # | App ou service | Ce que la source documente | Source | Ce qu’on en retient |
|---|---|---|---|---|
| 1 | **Safari, lecteur** (Apple) | « Les pages longues contiennent une synthèse ainsi qu’une table des matières. » ; « Le lecteur met en page une page web de façon à n’afficher que le texte et les images d’intérêt. » | [Assistance Apple — Masquer les distractions lors de la lecture d’articles dans Safari sur l’iPhone](https://support.apple.com/guide/iphone/hide-distractions-when-reading-iphdc30e3b86/ios) | Le mode lecture de référence d’iOS met une **synthèse en tête** du texte et ne garde que les images utiles : l’ordre aperçu, puis texte, que suivent les cinq directions |
| 2 | **Apple Podcasts**, page d’épisode | « Lorsque les informations de l’épisode sont affichées : Faites défiler vers le bas jusqu’à la section Transcriptions. Vous pouvez également toucher […], puis toucher “Afficher la transcription”. » | [Assistance Apple — Afficher la transcription d’un podcast sur l’iPhone](https://support.apple.com/guide/iphone/view-podcast-transcripts-iph9426049e9/ios) | La fiche d’abord (pochette, titre, description), le texte intégral plus bas ou derrière une action : le modèle de B |
| 3 | **Apple Podcasts for Creators**, couverture | « A Show Cover is the primary visual representation of your show. It appears in a square format in a variety of sizes across different apps and devices. » ; « Abrupt image cropping, awkward text overlap, and image treatments can cause visual imbalance or unintended distractions. » ; une illustration **distincte** en format large (« Showcase Hero ») est exigée pour les emplacements larges | [Show Cover template](https://podcasters.apple.com/support/5514-show-cover-template), [Artwork guide](https://podcasters.apple.com/support/896-artwork-requirements), [Showcase Hero template](https://podcasters.apple.com/support/5522-show-hero-template) | Apple ne recadre pas une pochette carrée pour un emplacement large : il en demande une autre. Nous n’avons qu’une image : A la montre entière, B la montre entière, C, D et E la rognent |
| 4 | **Readwise Reader** | « “Long-form reading view” is a dedicated reading layout that hides Reader’s action-heavy bottom bar and elevates UI elements like reading progress and appearance settings. » ; « On mobile, there are two options for the layout of the toolbar that appears at the bottom of the reading view. » ; « Auto-summarization of documents saved to your library is included as part of your Readwise subscription. » ; « the Summarize button on mobile » | [Readwise Docs — Appearance](https://docs.readwise.io/reader/docs/faqs/appearance), [Readwise Docs — Ghostreader](https://docs.readwise.io/reader/docs/faqs/ghostreader) | Le lecteur de référence des contenus sauvegardés résume chaque document enregistré, met ses commandes **en bas**, et offre une lecture longue **sans commandes** avec progression : la barre basse de E, la liseuse de B, la barre rétractée de C |
| 5 | **Readwise Reader**, pagination | « we developed a vertical pagination system that allows seamless text selection and preserves swipe gestures for navigation » | [Readwise Docs — Appearance](https://docs.readwise.io/reader/docs/faqs/appearance) | Écarte une sixième piste, la pagination horizontale du texte : Readwise y a renoncé pour préserver la sélection de texte, que `TranscriptReader` offre aujourd’hui |
| 6 | **NotebookLM** (renommé Gemini Notebook) | « Find an auto-generated summary of the entire source in the Source Guide. » | [NotebookLM Help — Add or discover new sources](https://support.google.com/notebooklm/answer/16215270?hl=en) | Ouvrir une source montre d’abord son résumé : c’est la thèse de E |
| 7 | **YouTube** | « In the video description, click Show transcript. As you watch the video, the transcript will scroll to show you the current caption text. » | [YouTube Help — View video transcripts](https://support.google.com/youtube/answer/15930243?hl=en) | Le texte intégral derrière une action, sous la description : B et E |
| 8 | **Instapaper** | « Instaparser is more proactive about finding cover images and inserting them into the top of the body text » | [Instapaper Blog — A New Parser](https://blog.instapaper.com/post/137288701461) (2016-01-14) | La couverture en tête du corps de l’article, dans la colonne de lecture : A, et E en retrait |
| 9 | **Matter** | « You can even save YouTubes and podcast episodes and Matter will transcribe them to time-synced text. » ; d’après MacStories, « The queue also includes a Resume button that displays just those stories that you’ve begun and abandoned » | [getmatter.com](https://www.getmatter.com/), [MacStories — Matter: A Fresh Take on Read-Later Apps](https://www.macstories.net/reviews/matter-a-fresh-take-on-read-later-apps/) | Le service le plus proche du nôtre (médias transcrits en texte) ; la reprise de lecture y vit au niveau de la file, pas de la page. Aucune direction ne l’ajoute : il faudrait persister une position de lecture, hors périmètre |
| 10 | **Snipd** | « Preview episode content with AI-generated summaries before you start listening. » ; « Read along and search full episode transcripts with speaker identification. » | [Snipd — All features](https://www.snipd.com/all-features) | Résumé avant contenu, transcription intégrale ensuite : même ordre que nos cinq directions |

Pocket n’est pas cité : Mozilla a fermé le service en 2025 (Matter accueille d’ailleurs ses anciens utilisateurs sur sa page d’accueil). Les apps ont été lues dans leur documentation, pas observées.

### 3.5 Six principes retenus

1. **L’aperçu passe avant le texte**, dans la même page ou juste avant (Safari, NotebookLM, Snipd, Readwise, NN/g). Les directions diffèrent sur sa visibilité : chapeau (A), section de fiche (B), carte (C), replié (D), contenu principal (E).
2. **Une couverture en tête est un motif établi** (Instapaper, Material « hero images », Apple Podcasts), **à deux conditions** : ne pas créer de faux plancher (NN/g) et ne pas recadrer n’importe comment (Apple Podcasts, NN/g).
3. **Le texte sur image se paie** en contraste (Material, NN/g, WCAG F83) : seule C s’y risque, et le dit.
4. **Peu d’actions en haut** (Material : une, deux au plus ; Apple : éviter l’encombrement) ; au-delà, une barre d’outils (Material, barre flottante) : E.
5. **Lire longtemps, c’est lire sans commandes, avec une progression** (Readwise, Apple) : la liseuse de B, la barre rétractée de C.
6. **320 pt est la largeur de reflow des WCAG** : tout doit s’y recomposer sans défilement horizontal (vérifié : 0 pt de débordement dans les 51 cadres).

---

## 4. Méthode : ce qui a été dessiné et comment c’est mesuré (AC#4, AC#8)

### 4.1 Les cinq maquettes

Un répertoire racine, `mobile-design-mockups/media_reading_tab_refonte/`, avec un `README.md` d’index et cinq sous-répertoires contenant chacun `code.html` et `screen.png` :

| Direction | Répertoire | `screen.png` | Cadres mesurés |
|---|---|---|---|
| A — « Une » | `direction_a_une/` | 1200 x 8244 px | 10 |
| B — « Pochette » | `direction_b_pochette/` | 1200 x 8284 px | 11 |
| C — « Bandeau rétractable » | `direction_c_bandeau_retractable/` | 1200 x 8869 px | 10 |
| D — « Texte d’abord » | `direction_d_texte_dabord/` | 1200 x 8106 px | 11 |
| E — « Aperçu d’abord » | `direction_e_apercu_dabord/` | 1200 x 7530 px | 9 |

Chaque page contient, dans cet ordre : le parti pris en huit lignes (couverture, repli, hiérarchie, aperçu, texte complet, actions, métadonnées, ce qui est supprimé ou dégradé) ; **l’écran actuel** redessiné à 414 x 896 pt, à 320 x 568 pt et en lecture, comme référence ; la direction au repos aux deux tailles ; en lecture ; sans couverture ; dans ses états (aperçu en préparation, échec de chargement du texte) ; le cadrage de sa couverture pour un article (1,91:1), un podcast (1:1), un reel (9:16) et une source sans image ; puis les tableaux de mesures, d’écarts au design system, d’accessibilité et de faisabilité.

Conventions reprises de task-408 (`digest_direction_*`) :

- **Autonomie** : aucun `<script>`, `<link>` ni `<img>`, aucune URL distante (vérifié par recherche dans les cinq fichiers).
- **Police système** : l’app n’en charge aucune (ni `useFonts`, ni `fontFamily` dans `mobile/app` et `mobile/src`).
- **Icônes exactes** : chaque glyphe est le contour extrait d’`Ionicons.ttf` (`@expo/vector-icons`, 512 unités par em) avec fontTools.
- **Couvertures** : des illustrations SVG embarquées tiennent lieu de photos. Elles sont montrées en `slice` (recadrage) ou `meet` (image entière), ce qui reproduit `contentFit="cover"` et `"contain"`.
- **Tokens** : les variables CSS recopient `mobile/src/constants/theme.ts`.
- **`screen.png`** : rendu de la page entière à 1200 px de large par Chrome headless.

Contenu d’exemple : l’article « Comment lire 50 livres par an sans forcer » (le même sujet que les maquettes du Digest), un podcast et un reel pour le cadrage, et une **note audio** pour le repli, parce que c’est une source qui n’a jamais d’image (§2.2).

### 4.2 Les deux tailles

- **414 x 896 pt** : iPhone 11. Barre d’état de 48 pt, indicateur d’accueil de 34 pt.
- **320 x 568 pt** : iPhone SE 2/3 en Display Zoom, le gabarit de 320 pt le plus bas, donc le pire cas ; barre d’état de 20 pt. Même choix que task-408, qui l’a justifié en détail.

Les cadres sont aux dimensions logiques exactes, en `overflow: hidden` : ce qui ne tient pas est coupé à l’image, comme sur l’appareil.

### 4.3 La mesure

Le `code.html` livré ne contient pas de script. Les nombres sont obtenus sur une copie jetable où une sonde est injectée avant `</body>`, rendue par Chrome headless (`--dump-dom`) ; la sonde écrit un JSON que le générateur réinjecte dans les légendes et les tableaux. Les copies sondées ne sont pas versionnées.

| Mesure | Définition exacte |
|---|---|
| Couverture visible | hauteur de l’élément de couverture intersectée avec le cadre, et part de l’aire du cadre (la barre d’état est comptée dans C, dont l’image passe dessous) |
| Bloc de l’aperçu | ordonnée du haut du conteneur de l’aperçu (chapeau, section, carte, rangée repliée ou bloc « L’essentiel ») |
| Premier mot de l’aperçu | ordonnée du haut du hook ; « — » quand il n’est pas rendu (aperçu replié ou en préparation) |
| Premier mot du texte complet | ordonnée du haut du premier paragraphe ; « hors écran » au-delà de la hauteur du cadre |
| Lignes du texte à l’écran | lignes entières de paragraphes visibles entre le chrome fixe du haut et l’obstruction du bas, à l’interligne de 25,6 pt |
| Chrome fixe, obstruction | bas du dernier élément fixe en haut (barre d’état comprise) ; hauteur couverte en bas par un élément flottant (barre de E) |
| Commandes visibles | éléments interactifs dont la zone est dans le cadre |
| Cible tactile min. | plus petite zone tactile déclarée (taille ou `hitSlop`) des commandes visibles |
| Débordement horizontal | dépassement maximal d’un élément hors des bords du cadre (le contenu interne des SVG recadrés et le flou de fond volontairement débordant sont exclus) |

---

## 5. Direction A — « Une » : la couverture ouvre la page, l’aperçu devient le chapeau (AC#5, AC#6)

`mobile-design-mockups/media_reading_tab_refonte/direction_a_une/`

| Dimension | Décision |
|---|---|
| Couverture | Pleine largeur, 16:9, sous l’en-tête, défile avec la page. Source paysage (ratio ≥ 4:3) : recadrée `cover`, centrée. Source carrée ou verticale : **entière** (`contain`) au centre de sa propre copie floutée (`blurRadius`), qui remplit le cadre. Place : en tête du hero partagé, avant la ligne de source et le titre |
| Repli | Bande tonale de 96 pt, glyphe du type à 32 pt (§2.3) |
| Hiérarchie | Couverture → créateur · domaine → titre (display) → date · durée · langue · longueur → segment (collant) → chapeau → texte |
| Aperçu | Chapeau : *Callout Aside* d’Amber Clarity, libellé « L’essentiel », hook et puces ; plus de titre « Aperçu », plus de carte grise |
| Texte complet | En ligne, même défilement, sous « Texte complet » |
| Actions | En-tête inchangé ; segment inchangé et collant ; la ligne de source ouvre l’original (remplace la puce) |
| Métadonnées | Créateur et domaine au-dessus du titre ; une seule ligne de métadonnées sous le titre ; la ligne de métadonnées du texte disparaît |
| Supprime ou dégrade | Supprime `SourceChip`, le titre « Aperçu », la carte grise, la ligne de métadonnées du texte et le doublon de durée. Dégrade la position du texte complet (y = 1010 pt au lieu de 810 à 414 pt) |

Mesures : couverture 233 pt (26 %) à 414, 180 pt (32 %) à 320 ; bloc de l’aperçu à y = 593 / 550 ; texte à y = 1010 / 1065 ; en lecture 180 pt de chrome et 25 lignes à 414, 152 pt et 15 lignes à 320 ; 6 commandes au repos, 5 en lecture. Faisabilité : `expo-image` (installé), `blurRadius`, ratio lu dans `onLoad`, index de `stickyHeaderIndices` ; **OTA**.

## 6. Direction B — « Pochette » : la page devient une fiche, le texte s’ouvre en liseuse (AC#5, AC#6)

`mobile-design-mockups/media_reading_tab_refonte/direction_b_pochette/`

| Dimension | Décision |
|---|---|
| Couverture | Pochette **jamais recadrée** : boîte de 168 pt de haut (128 à 320 pt) dont la largeur suit le ratio de la source, centrée sur une scène tonale pleine largeur de 216 pt (176 à 320), coins `lg`, sans ombre. Place : en tête du hero partagé. Seule réserve : une miniature YouTube de repli en 4:3 à bandes noires doit être recadrée en 16:9, sans quoi les bandes seraient montrées |
| Repli | Scène réduite à 144 pt, tuile de 96 pt (`surfaceContainer`) avec le glyphe à 40 pt |
| Hiérarchie | Pochette → titre (headline) → créateur · domaine → type · date → segment → bouton « Lire le texte complet » et bouton d’ouverture → Aperçu → Détails |
| Aperçu | Section « Aperçu » sans carte, sous le bouton de lecture : ce qu’on lit avant de décider de lire |
| Texte complet | **Hors de l’onglet** : une liseuse poussée (barre de 56 pt avec retour et titre, progression de 4 pt, texte seul) |
| Actions | En-tête inchangé ; segment non collant ; + « Lire le texte complet » (primaire, 56 pt) ; + « Ouvrir la source » (tonal, 56 x 56) |
| Métadonnées | Créateur sous le titre ; section « Détails » en fin d’onglet (source, date d’ajout, durée, langue, longueur) |
| Supprime ou dégrade | Supprime le texte de l’onglet Lecture, `SourceChip`, la carte grise, le titre en display. Dégrade : un geste de plus pour lire, un écran de plus à maintenir |

Mesures : pochette 168 pt de haut (14 % de l’écran pour un article, 8 % pour un podcast carré) ; bloc de l’aperçu à y = 643 / 575 ; liseuse : 112 pt de chrome, 25 lignes à 414, 84 pt et 16 lignes à 320, une seule commande ; 7 commandes sur la fiche. Faisabilité : nouvelle route (par exemple `app/media/[id]/read.tsx`) qui reprend `TranscriptReader` et le poll de traduction de `CompletedDetailView` (à déplacer, pas à dupliquer) ; **OTA**.

## 7. Direction C — « Bandeau rétractable » : la couverture reste en haut, en miniature, pendant la lecture (AC#5, AC#6)

`mobile-design-mockups/media_reading_tab_refonte/direction_c_bandeau_retractable/`

| Dimension | Décision |
|---|---|
| Couverture | Bandeau **bord à bord sous la barre d’état**, 4:3 à 414 pt (48 + 310 pt), 16:9 à 320 pt ; `cover` centré ; créateur et titre posés en bas de l’image sur une bande du matériau de `GlassSurface`. Au défilement, **se rétracte** en barre de 64 pt qui garde une vignette de 32 x 32 pt, le titre sur une ligne et la progression |
| Repli | Bandeau réduit à 96 pt sous la barre d’état, glyphe à 32 pt, titre sous le bandeau sur le fond ; la vignette de la barre porte le glyphe |
| Hiérarchie | Bandeau (image, créateur, titre) → domaine · date · langue · longueur → segment → Aperçu → texte ; en lecture, une seule barre |
| Aperçu | La carte `SourcePreview` actuelle, inchangée |
| Texte complet | En ligne ; 112 pt de chrome en lecture au lieu de 180 |
| Actions | Retour et `…` en boutons de verre sur l’image ; **dossier déplacé dans le menu** (`useMediaActions` avec `canMove: true`, déjà supporté) ; en lecture, le segment devient une pastille de deux icônes de 48 pt |
| Métadonnées | Créateur dans le bandeau ; une ligne sous le bandeau ; la ligne du texte disparaît |
| Supprime ou dégrade | Supprime le bouton dossier de l’en-tête, `SourceChip`, les libellés du segment en lecture. Dégrade : lisibilité du titre dépendante du matériau sur iOS ; pochettes et reels rognés, et masqués en bas par le titre ; à 320 pt, titre hors de l’image et réduit à quelques caractères dans la barre |

Mesures : bandeau 358 pt (40 %) à 414, 200 pt (35 %) à 320 ; bloc de l’aperçu à y = 486 / 500 ; texte à y = 918 / 1030 ; en lecture 112 pt de chrome et 27 lignes à 414, 84 pt et 16 lignes à 320 ; 5 commandes au repos, 3 en lecture. Faisabilité : `Animated.event` sur `onScroll` avec le pilote natif (opacité et translations seulement, donc une barre fixe qui apparaît en fondu), `expo-status-bar` pour basculer la barre d’état, et un dégradé de protection qui exige `expo-linear-gradient` (**build**, fingerprint Expo modifié) ou `experimental_backgroundImage` (déconseillé en production). Sans dégradé, **OTA**, au prix d’une barre d’état parfois illisible.

## 8. Direction D — « Texte d’abord » : une carte d’identité compacte, le texte au-dessus du pli (AC#5, AC#6)

`mobile-design-mockups/media_reading_tab_refonte/direction_d_texte_dabord/`

| Dimension | Décision |
|---|---|
| Couverture | La vignette **des listes** : 112 x 63 pt, 16:9, `cover`, coins `lg` (`COVER_WIDTH` / `COVER_HEIGHT` de `MediaListCard`), à gauche d’une rangée d’identité (pastille de type, créateur, date). Même clé de cache que la liste : déjà chargée à l’ouverture |
| Repli | Identique aux listes : glyphe à 28 pt sur `surfaceContainerLow`, dans le même cadre |
| Hiérarchie | Rangée d’identité → titre (headline) → segment → « L’essentiel » replié → texte → « À propos de cette source » |
| Aperçu | Rangée de divulgation de 48 pt, **repliée par défaut**, dépliée en place |
| Texte complet | Immédiat, au-dessus du pli, avec un simple libellé « Texte complet » |
| Actions | En-tête inchangé ; segment conservé mais non collant ; lien vers l’original en fin de page |
| Métadonnées | Type, créateur et date en tête ; source, créateur, langue, longueur et date d’ajout en fin de page |
| Supprime ou dégrade | Supprime le titre en display, `SourceChip`, les titres « Aperçu » et « Texte complet », la carte d’aperçu ouverte, l’en-tête collant. Dégrade : aperçu invisible sans un geste ; plus petite couverture des cinq |

Mesures : vignette 63 pt (2 % à 414, 4 % à 320) ; « L’essentiel » replié à y = 337 / 309 ; texte à **y = 433 / 405**, **16 / 6 lignes** au repos ; en lecture 108 pt de chrome et 27 lignes à 414, 80 pt et 17 lignes à 320 ; 6 commandes au repos, 3 en lecture. Faisabilité : constantes et props de `MediaListCard`, `LayoutAnimation` du cœur de React Native, `stickyHeaderIndices` supprimé ; **OTA**.

## 9. Direction E — « Aperçu d’abord » : l’essentiel en tête, le texte à la demande, les commandes au pouce (AC#5, AC#6)

`mobile-design-mockups/media_reading_tab_refonte/direction_e_apercu_dabord/`

| Dimension | Décision |
|---|---|
| Couverture | **Carte de source** en retrait des marges, 16:9, `cover`, coins `xl`, sur une bande qui nomme la provenance (glyphe, domaine, flèche) ; toute la carte ouvre l’original. Place : en tête, commune aux deux onglets |
| Repli | Zone d’image réduite à 96 pt avec le glyphe à 32 pt ; sans source ouvrable, la carte n’est pas interactive et la bande le dit |
| Hiérarchie | Carte de source → titre (display) → créateur · date → « L’essentiel » → deux paragraphes → « Lire la suite » |
| Aperçu | Le **contenu principal** : hook en headline (20 pt), puces, sans carte |
| Texte complet | Deux paragraphes, puis « Lire la suite · 12 paragraphes » qui déplie le reste en place |
| Actions | En haut, seulement le retour ; segment et `…` dans une **barre flottante en bas** (verre de `GlassSurface`) ; dossier dans le menu |
| Métadonnées | Domaine dans la carte ; créateur et date sous le titre ; nombre de paragraphes sur le libellé du texte ; la langue n’est plus affichée |
| Supprime ou dégrade | Supprime le segment en haut, le bouton dossier, `SourceChip`, la carte d’aperçu. Dégrade : un geste pour le texte complet ; le bas du texte masqué par la barre ; segment placé autrement que sur l’écran d’un dossier |

Mesures : carte 206 pt (20 %) à 414, 153 pt (23 %) à 320 ; bloc de l’aperçu à y = 494 / 451, hook à 550 / 507 ; texte à y = 878 / 905 ; en lecture 108 pt de chrome en haut et **114 pt couverts en bas**, 23 lignes à 414 (80 + 80 pt et 15 lignes à 320) ; 5 commandes au repos, 4 en lecture. Faisabilité : `GlassSurface` (existant), état local de dépliement, `contentInset` bas égal à la barre ; **OTA**.

---

## 10. Comparaison des cinq directions (AC#9)

### 10.1 Ce qui a été mesuré

À 414 x 896 pt, puis à 320 x 568 pt quand la valeur diffère. « En lecture » : l’écran une fois entré dans le texte.

| | Actuel | A « Une » | B « Pochette » | C « Bandeau » | D « Texte d’abord » | E « Aperçu d’abord » |
|---|---|---|---|---|---|---|
| Couverture au repos | aucune | **233 pt, 26 %** · 180 pt, 32 % | 168 pt, 14 % (8 % pour un carré) · 128 pt, 17 % | **358 pt, 40 %** · 200 pt, 35 % | 63 pt, 2 % · 63 pt, 4 % | 206 pt, 20 % · 153 pt, 23 % |
| Couverture en lecture | — | aucune | aucune (liseuse) | vignette 32 x 32 | aucune | aucune |
| Carré ou vertical | — | **entier**, sur son flou | **entier** | rogné en 4:3, bas masqué par le titre | rogné en 16:9 | rogné en 16:9 |
| Bloc de l’aperçu | y = 346 · 380 | y = 593 · 550 | y = 643 · 575 | y = 486 · 500 | replié, y = 337 · 309 | y = 494 · 451 |
| Aperçu lisible sans geste | oui | oui | oui | oui | **non** (un geste) | oui |
| Premier mot du texte | y = 810 · 942 | y = 1010 · 1065 | liseuse (un geste) | y = 918 · 1030 | **y = 433 · 405** | y = 878 · 905 (deux paragraphes, puis un geste) |
| Lignes de texte au repos | 3 · 0 | 0 · 0 | 0 · 0 | 0 · 0 | **16 · 6** | 0 · 0 |
| Chrome en lecture | 180 pt | 180 pt · 152 pt | 112 pt · 84 pt | 112 pt · 84 pt | **108 pt · 80 pt** | 108 + 114 pt en bas · 80 + 80 pt |
| Lignes à l’écran en lecture | 25 | 25 · 15 | 25 · 16 | **27** · 16 | **27** · **17** | 23 · 15 |
| Commandes au repos / en lecture | 6 / 5 | 6 / 5 | 7 / **1** | **5** / 3 | 6 / 3 | 5 / 4 |
| Débordement horizontal, cible min. | 0 pt, 48 pt | 0 pt, 48 pt | 0 pt, 48 pt | 0 pt, 48 pt | 0 pt, 48 pt | 0 pt, 48 pt |
| Dépendance nouvelle | — | aucune | aucune | `expo-linear-gradient` pour le dégradé | aucune | aucune |
| Livraison | — | OTA | OTA | **build** (ou OTA sans dégradé) | OTA | OTA |

### 10.2 Les six critères de la tâche

Rang de 1 (meilleur) à 5 ; ex aequo quand rien ne départage.

| Critère | A | B | C | D | E | Ce qui départage |
|---|---|---|---|---|---|---|
| **Lisibilité** | 1 | 1 | 5 | 1 | 4 | A, B et D posent tout le texte sur un fond uni avec une hiérarchie nette. E met le hook en 20 pt mais tronque le texte ; C pose le titre sur du verre au-dessus d’une image quelconque |
| **Mise en valeur de la couverture** | 2 | 3 | 1 | 5 | 4 | C : 40 % et la seule présente en lecture. A : 26 % et entière pour les carrés et verticaux. B : entière mais petite. E : 20 % mais rognée. D : 2 % |
| **Densité de contrôles** | 4 | 5 | 1 | 2 | 3 | C : 5 au repos, 3 en lecture. D : 6 et 3. E : 5 et 4 mais une barre qui couvre le texte. A : inchangé (6 et 5). B : 7 sur la fiche, la plus chargée au repos, même si la liseuse n’en a qu’une |
| **Continuité de lecture** | 3 | 4 | 2 | 1 | 5 | D : texte au-dessus du pli, 27 lignes en lecture. C : 27 lignes et la progression, mais texte plus bas. A : en ligne, chrome d’aujourd’hui. B : un geste et un changement d’écran. E : un geste et 114 pt masqués |
| **Accessibilité** | 1 | 3 | 5 | 1 | 4 | A et D : rien sur image, couverture décorative, un seul dépliant pour D. B : bouton désactivé et progression à annoncer. E : ordre de lecture de la barre et `contentInset` à gérer. C : F83 possible sur le chemin flou, segment en icônes |
| **Faisabilité React Native** | 2 | 4 | 5 | 1 | 3 | D : constantes de `MediaListCard`, `LayoutAnimation`. A : `blurRadius`, ratio dans `onLoad`. E : `GlassSurface` et un inset. B : une route et le poll de traduction à déplacer. C : animation liée au défilement, barre d’état, dépendance native |
| **Somme des rangs** | **13** | 20 | 19 | **11** | 23 | |

### 10.3 Pourquoi A, alors que D a la meilleure somme

**La somme des rangs pondère également six critères qui ne pèsent pas autant pour cette tâche.** Deux décisions de l’owner, antérieures à ce benchmark, s’appliquent avant tout classement :

1. **L’aperçu doit être lisible sur cette page.** task-363 l’a placé au-dessus du texte parce qu’il « répond exactement à la question qu’on se pose en rouvrant une source », et l’owner a demandé que la section soit toujours là. D, telle que dessinée, le replie : elle ne passe ce filtre qu’en changeant son état initial.
2. **La couverture est l’objet de la refonte.** C’est le seul invariant de la tâche, et l’owner a investi pour qu’elle soit reconnaissable sur toutes les sources (ré-hébergement en task-302 / task-304, rendu de la première page des documents en task-343 / task-344). « Mise en valeur de la couverture » est d’ailleurs un critère de comparaison demandé ; D y est dernière, avec 2 % de l’écran.

Parmi les directions qui passent ces deux filtres sans modification (A, B, C, E), **A a la meilleure somme (13, contre 19 à 23)** et n’est dernière sur aucun critère. D reste le repli naturel : c’est la direction à choisir si l’owner considère que l’onglet Lecture sert d’abord à lire, avec un seul réglage à trancher, l’état initial de « L’essentiel » (replié : texte à 433 pt ; déplié : cadre `d-open-414`, texte à 723 pt et aperçu visible).

**Objection 1 — « A repousse le texte plus bas qu’aujourd’hui. »** Oui : 1010 pt contre 810 à 414 pt, et plus aucune ligne de texte au repos. C’est le coût de 233 pt d’image, et c’est pour ça que l’aperçu passe en chapeau, lisible au-dessus du pli : quand on rouvre une source, la question « de quoi ça parle » est résolue sans défiler ; la lecture commence au premier geste.

**Objection 2 — « C est plus belle. »** C’est la plus immersive, et la seule qui garde la couverture en lecture. Mais sa beauté tient à des images qui s’y prêtent : sur une pochette carrée, le nom de l’émission disparaît sous le titre et le texte de la pochette se heurte à la barre d’état (cadre `c-pod-414`) ; sur iOS, la lisibilité du titre dépend du flou et de l’image ; et elle impose un build ou une barre d’état parfois illisible. Si l’owner la veut, il faut l’accepter avec ces trois coûts.

**Objection 3 — « B traite mieux l’image que A. »** Pour les sources carrées et verticales, A et B font la même chose (image entière) ; pour les sources paysage, A la montre plus grande (414 pt de large au lieu de 320). La vraie différence de B est ailleurs : sortir la lecture de l’onglet. C’est un choix de nature, à faire comme tel.

**Objection 4 — « E répond le mieux à l’usage. »** E suit la pyramide inversée jusqu’au bout, mais A garde l’aperçu au-dessus du texte sans cacher le texte, et sans déplacer le segment : dans l’app, les onglets d’un écran sont en haut (écran d’un dossier). E introduirait la seule exception.

---

## 11. Conformité à Amber Clarity et écarts nommés (AC#7)

Les variables CSS des cinq maquettes recopient `mobile/src/constants/theme.ts`. Vérification mécanique sur les cinq `code.html`, illustrations de couverture exclues :

- **Couleurs** : aucune valeur hexadécimale hors des 14 de la palette. Les seules valeurs translucides sont `primaryTint` (`rgba(255, 203, 5, 0.05)`), l’ombre `soft` (`rgba(43, 45, 66, 0.04)`) et, dans C et E seulement, les matériaux et le dégradé listés ci-dessous.
- **Tailles de texte** : 32 / 20 / 16 / 14 / 13, soit `display` / `headline` / `body` / `label` / `small`. Les 15 et 12 px sont ceux de la barre d’état d’iOS.
- **Espacements, rayons, ombres, cibles tactiles** : `Spacing`, `BorderRadius`, `Shadows.soft`, `TouchTarget`. Pas de filet d’un pixel pour séparer des blocs (« No-Line rule ») ; la seule bordure est le trait de 4 pt du *Callout Aside* de A, qui est un composant du design system.

| Écart | Direction | Justification, ou évolution proposée |
|---|---|---|
| Couleurs des illustrations de couverture | toutes | Ce sont des images, pas des surfaces d’interface |
| Flou d’une copie de la couverture | A | Traitement d’image (`blurRadius` d’`expo-image`), aucune couleur d’interface |
| **Dégradé de protection** textMain 50 % → 0 sous la barre d’état | **C** | **Écart réel.** Aucun token de voile n’existe. Évolution proposée si C est retenue : un token `Colors.scrim` dérivé de `textMain`, décidé en même temps que la dépendance qui permet de le dessiner (`expo-linear-gradient`) |
| Barre d’état claire sur l’image | C | Contredit le `StatusBar style="dark"` global de `app/_layout.tsx` ; doit basculer selon le défilement |
| Verre (`rgba(252, 249, 246, 0.72)` et flou) | C, E | Représentation dans la maquette du matériau de `GlassSurface` sur iOS ; sur Android et sous « Réduire la transparence », `GlassSurface` rend déjà `background` à 92 %. Pas de token nouveau |
| Hook en 20 pt sans interligne de token | E | `Typography.headline` n’a pas d’interligne : la maquette garde l’interligne par défaut, comme tous les titres de 20 pt de l’app |

Contrastes calculés sur les tokens (formule WCAG) :

| Paire | Rapport |
|---|---|
| `textMain` sur le fond du chapeau (`primaryTint` sur `background`) — A | 12,6:1 |
| `textSubtle` sur ce même fond (libellé « L’essentiel ») — A | 5,2:1 |
| `textSubtle` sur `background` (lignes de source et de métadonnées) | 5,3:1 |
| `textSubtle` sur `surfaceContainerLow` | 5,1:1 |
| `onPrimary` sur `primary` (onglet actif, bouton « Lire ») | 11,3:1 |
| `textMain` sur `background` à 92 % au-dessus d’une image noire (verre opaque, pire cas) — C | 10,8:1 |
| `textMain` sur `background` à 72 % au-dessus d’une image noire (verre de la maquette, pire cas) — C | 6,5:1 |
| blanc de la barre d’état sur le dégradé de C au-dessus d’un ciel clair | 3,7:1 |
| `textMuted` sur `surfaceContainerLow` (glyphe de repli, décoratif) | 2,6:1 |

## 12. Les deux tailles : défauts et adaptations (AC#8)

Chaque direction est rendue à 414 x 896 pt et à 320 x 568 pt, au repos et en lecture. **Aucun débordement horizontal** dans les 51 cadres mesurés (39 cadres distincts, l’écran actuel étant redessiné dans chaque page), aucune cible tactile sous 48 pt. Les seules troncatures sont voulues : le titre sur une ligne dans la barre de C et dans la liseuse de B.

| Direction | Ce qui change à 320 pt | Défaut assumé |
|---|---|---|
| A | La couverture suit la largeur (180 pt) ; le titre passe sur trois lignes | Le chapeau passe sous le pli (bloc à 550 pt) |
| B | Scène de 176 pt, pochette de 128 pt ; le bouton « Lire » reste à l’écran | L’aperçu passe sous le pli (bloc à 575 pt) |
| C | Bandeau en 16:9 au lieu de 4:3 ; le titre ne tient plus sur l’image et passe dessous | Dans la barre rétractée, le titre se réduit à quelques caractères (« Comment … ») |
| D | Rien : la rangée d’identité tient sans passer en colonne | Seulement 6 lignes de texte au repos |
| E | La barre flottante tient dans la largeur (249 pt mesurés, pour 272 pt entre les marges) | 80 pt couverts en bas en lecture, 15 lignes |

Hors de ces deux tailles, un point reste à traiter dans l’implémentation, quelle que soit la direction : **Dynamic Type**. Aux grands crans, la rangée d’identité de D et la ligne de source de A doivent passer en colonne, et le titre posé sur l’image de C doit en sortir au-delà de deux lignes.

## 13. Ce qui n’a pas pu être vérifié depuis cet environnement

1. **Rien n’a été rendu par React Native.** Les cadres sont du HTML rendu par Chrome, avec les valeurs de style de l’app. Les métriques de SF Pro et les encarts réels peuvent décaler de quelques points ; la méthode garantit la comparabilité (même moteur, mêmes tokens, mêmes tailles), pas l’exactitude au point près.
2. **Les couvertures sont des illustrations.** Le cas qui départage C (image claire ou sombre sous un titre en verre) doit être revu sur appareil avec de vraies couvertures.
3. **Android n’est pas dessiné.** Sur Android, `GlassSurface` rend une teinte opaque : C et E y sont plus lisibles et moins translucides que dans les maquettes.
4. **Dynamic Type, VoiceOver et TalkBack n’ont pas été essayés** ; ce qui est dit d’accessibilité vient du code lu, des guidelines citées et des contrastes calculés.
5. **Les apps ont été lues dans leur documentation, pas observées** ; aucun compte n’a été utilisé.
6. **Le coût de `blurRadius` sur un Android d’entrée de gamme** n’est pas mesuré ; il ne concerne que les sources carrées et verticales de A.
7. **La validation visuelle sur appareil reste à faire par l’owner** après l’implémentation, comme la description de task-411 le note.

---

## 14. Sources

Toutes consultées le **2026-09-26**.

| Source | URL | Ce qui en a été tiré |
|---|---|---|
| Apple HIG — Layout | https://developer.apple.com/design/human-interface-guidelines/layout | Ordre d’importance, divulgation progressive pour les apps de médias, « background extension effect », commandes distinctes du contenu, empilement aux grands caractères |
| Apple HIG — Typography | https://developer.apple.com/design/human-interface-guidelines/typography | Pas de troncature dans une zone qui défile sans vue complète ailleurs |
| Apple HIG — Color | https://developer.apple.com/design/human-interface-guidelines/color | L’état de repos en haut d’un écran doit rester lisible sous les commandes |
| Apple HIG — Materials | https://developer.apple.com/design/human-interface-guidelines/materials | Liquid Glass est une couche pour les commandes et la navigation |
| Apple HIG — Toolbars | https://developer.apple.com/design/human-interface-guidelines/toolbars | Éviter l’encombrement ; masquer les barres pour lire sans distraction |
| Apple HIG — Disclosure controls | https://developer.apple.com/design/human-interface-guidelines/disclosure-controls | Cacher les détails jusqu’à ce qu’ils servent ; un seul dépliant par vue |
| Apple HIG — Buttons | https://developer.apple.com/design/human-interface-guidelines/buttons | Zone tactile d’au moins 44 x 44 pt |
| Apple HIG — Accessibility | https://developer.apple.com/design/human-interface-guidelines/accessibility | Contrastes minimaux (WCAG AA) |
| Material 3 — App bars | https://m3.material.io/components/top-app-bar/guidelines | Une ou deux actions ; éviter le menu de débordement ; barre qui se rétracte ; boutons flottants avec fond |
| Material 3 — Toolbars | https://m3.material.io/components/toolbars/guidelines | Barre d’outils flottante, utilisable comme onglets, qui peut rester, disparaître ou se réduire au défilement |
| Material 3 — Cards | https://m3.material.io/components/cards/guidelines | Pas de texte sur image sans contraste ; voile ou forme de fond ; pas de carte quand l’espacement suffit |
| Material 3 — Structure | https://m3.material.io/foundations/designing/structure | Chaque bouton, image et ligne ajoute de la complexité ; actions importantes en haut ou en bas |
| Material 2 — Imagery | https://m2.material.io/design/communication/imagery.html | Image d’en-tête en position la plus visible ; une vignette mène au contenu |
| NN/g — The Illusion of Completeness (Kim Flaherty, 2016-01-17) | https://www.nngroup.com/articles/illusion-of-completeness/ | Pas d’image plein écran ; du contenu doit dépasser le pli |
| NN/g — Big Pictures on Small Screens (Amy Schade, 2017-05-21) | https://www.nngroup.com/articles/big-pictures-small-screens/ | Retirer les images inutiles, soigner recadrage et placement |
| NN/g — Photos as Web Content (Jakob Nielsen, 2010-10-31, revu le 2026-08-13) | https://www.nngroup.com/articles/photos-as-web-content/ | Les images porteuses d’information sont regardées, les autres ignorées |
| NN/g — Image-Focused Design (Kathryn Whitenton, 2014-09-28) | https://www.nngroup.com/articles/image-focused-design/ | Une grande image mal priorisée dégrade l’expérience |
| NN/g — Ensure High Contrast for Text Over Images (Aurora Harley, 2015-10-18, revu le 2026-01-13) | https://www.nngroup.com/articles/text-over-images/ | 4,5:1 ; flou, voile ou fond coloré en bas de l’image |
| NN/g — Inverted Pyramid (Amy Schade, 2018-02-11) | https://www.nngroup.com/articles/inverted-pyramid/ | L’essentiel d’abord ; ajouter un résumé ou des points clés |
| WCAG 2.2 — Understanding Reflow | https://www.w3.org/WAI/WCAG22/Understanding/reflow.html | 320 CSS px comme largeur de référence |
| WCAG 2.2 — Understanding Contrast (Minimum) | https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html | Échec F83 : image de fond sans contraste suffisant |
| WCAG 2.2 — Understanding Non-text Content | https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html | Une image décorative doit pouvoir être ignorée |
| Assistance Apple — lecteur de Safari (FR) | https://support.apple.com/guide/iphone/hide-distractions-when-reading-iphdc30e3b86/ios | Synthèse et table des matières en tête des pages longues |
| Assistance Apple — transcriptions de Podcasts (FR) | https://support.apple.com/guide/iphone/view-podcast-transcripts-iph9426049e9/ios | Transcription plus bas dans les informations de l’épisode, ou par une action |
| Apple Podcasts for Creators — Show Cover template | https://podcasters.apple.com/support/5514-show-cover-template | Couverture carrée ; méfiance envers le recadrage et le texte superposé |
| Apple Podcasts for Creators — Artwork guide | https://podcasters.apple.com/support/896-artwork-requirements | Couverture principale et illustrations optionnelles par emplacement |
| Apple Podcasts for Creators — Showcase Hero template | https://podcasters.apple.com/support/5522-show-hero-template | Une illustration distincte, large, pour les emplacements larges |
| Readwise Docs — Appearance | https://docs.readwise.io/reader/docs/faqs/appearance | Barre d’outils en bas, vue de lecture longue sans barre d’actions avec progression, pagination verticale |
| Readwise Docs — Ghostreader | https://docs.readwise.io/reader/docs/faqs/ghostreader | Résumé automatique des documents enregistrés ; bouton Summarize sur mobile |
| NotebookLM Help (Gemini Notebook) | https://support.google.com/notebooklm/answer/16215270?hl=en | Résumé automatique de la source dans le Source Guide |
| YouTube Help — View video transcripts | https://support.google.com/youtube/answer/15930243?hl=en | Transcription derrière « Show transcript », dans la description |
| Instapaper Blog — A New Parser (2016-01-14) | https://blog.instapaper.com/post/137288701461 | Couverture insérée en tête du corps de l’article |
| Matter | https://www.getmatter.com/ | Vidéos et podcasts transcrits en texte synchronisé |
| MacStories — Matter: A Fresh Take on Read-Later Apps | https://www.macstories.net/reviews/matter-a-fresh-take-on-read-later-apps/ | Reprise de lecture au niveau de la file |
| Snipd — All features | https://www.snipd.com/all-features | Résumé avant l’écoute, transcription intégrale ensuite |
| React Native 0.83 — View Style Props | https://reactnative.dev/docs/0.83/view-style-props | `experimental_backgroundImage` (linear-gradient depuis 0.76) marqué expérimental, « Don’t use them in production » |
| React Native 0.83 — Animations | https://reactnative.dev/docs/0.83/animations | Le pilote natif n’anime que les propriétés hors mise en page ; `Animated.event` fonctionne avec `ScrollView#onScroll` |
| Expo — Image | https://docs.expo.dev/versions/latest/sdk/image/ | `blurRadius`, `contentFit`, `contentPosition`, et les dimensions de la source dans `onLoad` |

Sources internes au dépôt : `mobile/app/media/[id].tsx`, `mobile/src/components/CompletedDetailView.tsx`, `SourcePreview.tsx`, `TranscriptReader.tsx`, `MediaDetailHeader.tsx`, `ScreenTabs.tsx`, `Bullets.tsx`, `MediaListCard.tsx`, `GlassSurface.tsx`, `mobile/app/media/unsorted-review.tsx`, `mobile/app/_layout.tsx`, `mobile/app/(tabs)/digest.tsx`, `mobile/src/hooks/useMediaDetailPolling.ts`, `mobile/src/hooks/useMediaActions.ts`, `mobile/src/lib/mediaTypeDisplay.ts`, `mobile/src/types/media.ts`, `mobile/src/constants/theme.ts`, `mobile/src/i18n/fr.ts`, `mobile/package.json`, `media_summarizer/core/models/user_media.py`, `media_summarizer/core/services/durable_media_service.py`, `media_summarizer/core/services/cover_capture.py`, `media_summarizer/api/endpoints/media.py`, `media_summarizer/api/models/media_contracts.py`, `mobile-design-mockups/my_design_system/DESIGN.md`, et les benchmarks `docs/research/task-302-media-cover-and-creator/`, `task-343-document-page-render/`, `task-408-digest-ux-refonte/`.

---

## 15. Ce que task-411 aurait à faire si l’owner retient A

Indicatif : l’implémenteur suit la décision de l’owner ci-dessus, pas cette liste.

- Dans `CompletedDetailView.tsx`, ajouter la couverture en tête du hero : `expo-image` avec la `cacheKey` des listes, `recyclingKey`, `cachePolicy="memory-disk"` ; `contentFit` choisi dans `onLoad` (ratio ≥ 4:3 : `cover` ; sinon `contain` au-dessus d’une seconde image en `cover` avec `blurRadius`) ; repli de 96 pt avec `getMediaTypeIcon` ; échec mémorisé par `media_item_id`.
- Remplacer `SourceChip` par la ligne de source (glyphe, créateur · domaine, flèche si l’URL s’ouvre), avec un libellé d’accessibilité **traduit** — l’actuel « Open on » est codé en dur.
- Une seule ligne de métadonnées sous le titre ; retirer la ligne de métadonnées de `TranscriptReader` et le doublon de durée.
- Rendre l’aperçu dans un *Callout Aside* (bordure gauche de 4 pt en `primary`, fond `primaryTint`, `BorderRadius.md`) avec le libellé « L’essentiel » ; supprimer la carte grise et le titre « Aperçu » de `SourcePreview`, sans toucher à ses trois états ni au poll.
- Mettre à jour `stickyHeaderIndices` pour le nouvel index du segment.
- Clés i18n à ajouter dans les 11 catalogues : le libellé « L’essentiel » et le libellé d’accessibilité de la ligne de source ; supprimer `preview.heading` si plus rien ne le lit.
- Trancher l’ordre avec task-409 (Digest) avant de commencer.
- Rien de tout cela ne change le fingerprint Expo : **mise à jour OTA**.
