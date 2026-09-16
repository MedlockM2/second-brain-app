# Vignette média « en cours de traitement » — trois variantes (task-401)

Maquette de l'indicateur qui manque à la vignette d'un média qui vient d'être
sauvegardé, dans la liste « Ajouts récents » de l'accueil. Le livrable est
`code.html` ; ce fichier est l'argumentaire.

Chaque variante est justifiée par **une règle citée** de
`../my_design_system/DESIGN.md` et par **au moins une implémentation de
référence nommée**, et chacune dit ce qu'elle abandonne. Rien ici ne repose sur
un goût : quand une question ne se tranche pas par une règle ou par une
référence, elle est laissée ouverte et signalée comme telle, à l'owner.

## Comment lire la maquette

- Ouvre `code.html` dans un navigateur. Contrairement aux maquettes précédentes
  du dossier, **les animations sont réelles** — c'est le sujet de la tâche —
  donc une capture d'écran ne rendrait rien d'utile. Le fichier ne contient ni
  `<link>`, ni `<script>`, ni `<img>`, donc aucune requête réseau.
- Police et icônes : même convention que
  `../home_unsorted_review_card/` — pile système équivalente à ce que l'app
  rend (aucune police custom chargée dans `mobile/`), glyphes Ionicons extraits
  de la fonte que l'app embarque (`@expo/vector-icons/…/Fonts/Ionicons.ttf`,
  512 unités/em) via `fontTools` (`SVGPathPen` + retournement en Y), reportés
  dans des `<symbol viewBox="0 0 512 512">`.
- Valeurs : toutes les couleurs, rayons, espacements et tailles de texte sont
  les variables CSS déclarées en tête de `code.html`, recopiées de
  `mobile/src/constants/theme.ts`. La géométrie de la tuile (200×113 le cover,
  203 la tuile entière) vient de `mobile/src/components/HomeTile.tsx`.
- Les covers « photo » sont des dégradés CSS, pas de vraies images : ils tiennent
  la place d'un cover téléchargé pour juger le contraste d'un badge dessus, rien
  de plus.

## Le problème, en faits

`HomeTile`, `mobile/src/components/HomeTile.tsx` :

| Ce qui est posé | Valeur dans le code |
|---|---|
| Géométrie | `TILE_WIDTH` 200, `TILE_COVER_HEIGHT` 113, `TILE_HEIGHT` 203 (réservé, pas mesuré au contenu — commentaire L56-77) |
| Titre | `tileTitle()` (L294-299) : `item.title?.trim() \|\| t("common.untitled")` — « Sans titre » tant que le titre n'est pas résolu |
| Statuts possibles | `MediaListItem.status` (`mobile/src/types/media.ts`) : `"ingested" \| "resolving" \| "processing" \| "ready_for_artifacts" \| "failed" \| "cancelled"` |
| Traitement visuel existant | **Un seul** : `isFailedLibraryStatus(status) === "failed"` affiche `MediaFailureBadge` |

Le commentaire de `isFailedLibraryStatus` (`mobile/src/components/MediaFailureBadge.tsx`,
L46-51) dit explicitement : *« `pending` and `processing` mean the item is on
its way and will change on its own; `ready` is the norm »* — c'est un choix
déjà pris de ne rien afficher pour ces états, jamais traduit visuellement.
C'est exactement le trou que l'owner rapporte (2026-09-16) : « la vignette
affiche juste un titre générique et c'est tout ». Trois faits mesurables
encadrent la maquette :

1. **`MediaFailureBadge` est la seule grammaire de badge de statut déjà
   posée sur une vignette.** Position `absolute`, `top`/`start: Spacing.sm`,
   `gap: Spacing.xs`, `paddingHorizontal: Spacing.sm`,
   `paddingVertical: Spacing.xs / 2`, `borderRadius: BorderRadius.md`, fond
   `Colors.error`, glyphe Ionicons **plein** `alert-circle` (13 px =
   `Typography.small.fontSize`), texte `t("mediaStatus.failedBadge")`
   (« ÉCHEC », majuscules, terse). Le commentaire du composant dit pourquoi
   c'est un composant unique : « two copies of a badge is how the same item
   ends up looking failed on one screen and fine on the next ».
2. **Aucun idiome de mouvement en boucle n'existe dans `mobile/`.** Ni
   `react-native-reanimated`, ni `expo-linear-gradient`, ni aucun
   Skeleton/shimmer (`grep -rn "Skeleton\|shimmer"` : zéro résultat).
   L'`Animated` du cœur React Native est présent mais seulement pour des
   transitions ponctuelles de fondu/échelle (`CompletedDetailView.tsx`,
   `AnchoredContextMenu.tsx`, `bug-report.tsx`), jamais en boucle continue.
   `expo-blur` est installé et déjà utilisé, statique, pour le glassmorphism
   de la Top Bar (DESIGN.md, section 4, « Glassmorphism »).
3. **La liste ne se met pas à jour seule.** `useMediaPolling.ts` : un seul
   fetch au montage puis `refetch()` silencieux sur focus d'écran seulement
   (commentaire explicite : *« V1 design: no recurring network requests while
   the inbox is open »*). Une vignette ne peut donc pas passer d'elle-même de
   « en cours » à « prête » sans que l'écran regagne le focus — les trois
   variantes en tiennent compte : leur mouvement continue de tourner jusqu'au
   prochain `refetch()`, même si le traitement s'est terminé entre-temps côté
   serveur. Ce n'est pas un défaut d'une variante en particulier, c'est une
   limite du dépôt à ce jour, hors périmètre de cette tâche.

## Le rythme du mouvement — un plafond commun aux trois variantes

DESIGN.md, section 1 (« Creative North Star ») : *« Amber Clarity … rejects the
frantic energy of modern social interfaces »*. Les trois variantes bornent donc
leur vitesse d'animation nettement au-dessus d'un spinner générique
(souvent ≈ 800 ms–1 s) : 1,4 s pour la rotation de A, 1,8 s pour la
respiration de C, 1,9 s pour le balayage de B. Un mouvement qui se voit sans
être nerveux — c'est la même contrainte qui a fait retenir « Deck tactile »
plutôt qu'une variante plus voyante dans `../home_unsorted_review_card/`.

## Les trois variantes, comparées

| | A — Badge sync ambre | B — Balayage flou | C — Pastille pouls |
|---|---|---|---|
| Ancrage | Coin haut-début du cover, comme `MediaFailureBadge` | Toute la largeur du cover (bande mobile) | Bas-centre du cover |
| Icône | `sync` (plein) | aucune | `pulse` (plein) |
| Ce qui bouge | Le glyphe tourne (360°, 1,4 s) | La bande floutée balaie (1,9 s) | Toute la pastille respire — échelle + opacité (1,8 s) |
| Le titre | Inchangé (« Sans titre ») | Inchangé (« Sans titre ») | **Remplacé** (« Traitement en cours… ») |
| Le sous-titre | Inchangé (vide) | **Repris** (« Traitement en cours ») | Inchangé (vide) |
| Nouvelle dépendance ? | Non — `Animated` du cœur RN seul | Non — `expo-blur` + `Animated`, déjà présents | Non — `Animated` du cœur RN seul |
| Nouvel idiome pour l'app ? | Non — sibling direct de `MediaFailureBadge` | **Oui** — premier shimmer/balayage du dépôt | Non — même grammaire de badge, ancrage différent |

Aucune des trois ne suppose Reanimated ni `expo-linear-gradient` : les trois
sont réalisables avec ce qui est déjà installé.

---

## A — « Badge sync ambre »

**Coque** : identique à `MediaFailureBadge` — position `absolute`,
`top`/`start: Spacing.sm`, `gap: Spacing.xs`, `paddingHorizontal: Spacing.sm`,
`paddingVertical: Spacing.xs / 2`, `borderRadius: BorderRadius.md` — fond
`Colors.primary` (au lieu d'`error`), texte/icône `Colors.onPrimary` (au lieu
d'`onError`).
**Contenu** : icône `sync` 13 px (glyphe plein, comme `alert-circle`), qui
tourne en continu — seul élément animé. Texte « EN COURS », même registre que
« ÉCHEC ». Le titre n'est pas touché.

### Règles citées et implémentations de référence

- Citation : « The Amber primary is used **sparingly for high-value
  interactions**… and meaningful accents » (DESIGN.md, section 2). A met
  directement cette règle sous tension plutôt que de l'ignorer — voir « ce
  qu'elle abandonne ».
- Citation : « Ambient Shadows … nearly imperceptible but provides **just
  enough lift** to separate interactive layers from content » (section 4). Le
  principe — un supplément discret, borné à la taille d'un badge existant, pas
  un traitement plein cadre — est transposé du relief au mouvement : seul un
  glyphe de 13 px tourne, rien d'autre sur la tuile ne bouge.
- Référence interne : `MediaFailureBadge` lui-même. A n'est pas une nouvelle
  grammaire, c'est le même composant avec un jeu de couleurs et un glyphe
  différents — cohérent avec sa propre raison d'être documentée (« one
  component… two copies of a badge is how the same item ends up looking
  failed on one screen and fine on the next »).
- Référence externe : le badge « Syncing… »/« Uploading… » avec glyphe de
  flèches circulaires en rotation sur une vignette, posé par Google Drive et
  Dropbox sur les fichiers en cours de synchronisation — l'idiome le plus
  générique du « ça travaille, ce n'est pas cassé ».

### L'icône : `sync`

Identifiant exact : **`sync`** (glyphe plein, pas `sync-outline`). Choisi plein
et non outline pour la même raison que `alert-circle` l'est dans
`MediaFailureBadge` : les deux badges doivent appartenir à la même famille
visuelle. Vérifié sans collision : `grep -rn '"sync"' mobile/src mobile/app` ne
retourne rien. `sync-outline` non plus. `refresh`/`refresh-outline` et
`time-outline` ont été écartés : `refresh` (sans `-outline`) est déjà
l'icône de dix boutons « Réessayer » (`SubscriptionStatusCard.tsx`,
`TranscriptReader.tsx`, `share-confirmation.tsx`, `artifacts/[artifactId].tsx`,
`(tabs)/search.tsx`, `(tabs)/inbox.tsx`, `media/[id].tsx`,
`media/folders/index.tsx`, `media/folders/[id].tsx`) — un glyphe visuellement
proche pour « en cours » créerait une confusion avec « relancer
manuellement ». `time-outline` porte déjà un sens temporel différent (durée,
état `"timeout"` dans `(tabs)/digest.tsx:469`).

### Ce qu'elle abandonne

- **La rareté de l'ambre.** Si plusieurs imports sont en cours dans la même
  rangée horizontale, celle-ci devient un mur de pastilles ambre — rendu dans
  la cellule « trois tuiles en cours » du fichier. C'est la règle « sparingly »
  elle-même qui est mise sous tension, pas une supposition : l'ambre est déjà
  la couleur des deux boutons flottants de l'accueil et de l'onglet actif ; une
  rangée qui en affiche trois de plus la dilue d'autant.
- **La visibilité au premier balayage.** Un badge de 13 px dans un coin peut
  être manqué pendant un swipe rapide de la liste horizontale — le texte du
  titre, lui, ne dit toujours rien tant qu'il n'est pas résolu.

---

## B — « Balayage flou »

**Coque** : aucun badge, aucune icône. Une bande translucide floutée
(`rgba(255, 255, 255, 0.4)` + flou 6 px, 90 px de large sur les 200 du cover)
balaie le cover de gauche à droite en boucle (1,9 s), laissant l'image réelle
visible en dessous plutôt que de la masquer.
**Contenu** : le titre n'est pas touché (« Sans titre »). Le sous-titre —
vide tant que le créateur n'est pas connu — porte le texte d'état
(« Traitement en cours »), dans le style normal du sous-titre
(`Colors.textSubtle`, 13 px).

### Règles citées et implémentations de référence

- Citation : « **Glassmorphism** : The Top Bar uses a `backdrop-blur-md` with
  90% opacity … to maintain context of the content while scrolling »
  (DESIGN.md, section 4). B reprend le seul idiome de flou déjà présent dans
  l'app et l'anime, au lieu d'en inventer un nouveau — et « maintain context of
  the content » est précisément ce que B fait par rapport à un skeleton opaque
  qui masquerait le cover.
- Citation : « The layout breaks the rigid "template" look by using…
  **"floating" interactive zones that sit above the content** » (section 1,
  Creative North Star). Une bande qui flotte au-dessus du cover en y laissant
  voir le contenu est cette idée appliquée à l'échelle d'une tuile.
- Fait du dépôt qui justifie de ne **pas** masquer le cover : `HomeTile`
  affiche le cover dès que `imageUrl` existe, indépendamment du `status`
  (le repli en icône de type de média n'intervient que « si pas d'URL ou
  erreur de chargement », `TileCover`, L161-206). Pendant le traitement d'une
  photo personnelle, l'image **est** déjà le contenu final, disponible tout de
  suite ; la masquer derrière un skeleton opaque cacherait une donnée déjà
  correcte. C'est pour cette raison précise que B écarte le skeleton plein
  (façon Facebook/LinkedIn/Notion) au profit d'un voile translucide.
- Référence externe : le « blur-up » progressif d'Instagram/Twitter — une
  prévisualisation floutée affichée pendant qu'un asset final charge, où le
  flou dit « pas définitif encore » sans effacer ce qui est déjà là. C'est la
  référence la plus proche de l'intention de B ; le skeleton Facebook/Notion,
  plus connu, est délibérément écarté pour la raison ci-dessus.

### L'icône

Aucune. C'est le parti pris distinctif de B : le signal est entièrement porté
par le mouvement et par le texte du sous-titre, sans glyphe à vérifier ni à
faire cohabiter avec `alert-circle`/`sync`/`pulse`.

### Ce qu'elle abandonne

- **Un idiome entièrement nouveau pour l'app.** Aucun shimmer/balayage
  n'existe ailleurs dans `mobile/` ; B introduit une première brique de ce
  genre, avec le risque qu'elle reste un cas isolé si elle n'est pas reprise
  ailleurs.
- **La visibilité si le sous-titre est ignoré.** Sans icône ni titre changé,
  tout le texte du signal tient dans une ligne de 13 px sous le titre — la
  moins immédiate des trois si l'œil ne descend pas jusque là.
- **Un coût de performance non mesuré.** `expo-blur` a un rendu plus coûteux
  sur Android que sur iOS (moteur de flou non natif là où iOS utilise
  `UIVisualEffectView`) ; l'animer en continu sur plusieurs tuiles visibles à
  la fois dans une `FlatList` horizontale n'a jamais été mesuré dans ce dépôt.
  C'est un risque à vérifier à l'implémentation, pas une certitude qui
  disqualifie B.

---

## C — « Pastille pouls »

**Coque** : même famille de badge que `MediaFailureBadge`/A, mais ancrée
bas-centre du cover (`bottom: Spacing.sm`, centrée) plutôt qu'au coin —
fond `Colors.primary`, texte/icône `Colors.onPrimary`.
**Contenu** : icône `pulse` (glyphe plein), **immobile** — c'est **toute la
pastille** qui respire (échelle 1 → 1,06, opacité 0,88 → 1, 1,8 s), pas
seulement le glyphe. Le titre est **remplacé** par la phrase d'état
(« Traitement en cours… »), dans le style normal du titre (15 px/500,
`Colors.textMain`, 3 lignes max).

### Règles citées et implémentations de référence

- Citation : « Amber Clarity … rejects the frantic energy of modern social
  interfaces in favor of a "warm editorial" aesthetic … **high-contrast
  typography** » (DESIGN.md, section 1). C est la seule des trois à porter
  l'information principale par une phrase lisible plutôt que par un seul
  glyphe animé — cohérent avec un système qui se revendique éditorial et
  textuel avant d'être « app sociale qui charge ».
- Citation, pour ce que C **n'a pas retenu** : « Signature Textures : Use a
  **5% opacity tint** of the Primary color … for callouts » (section 2). Une
  pastille à 5 % (`Colors.primaryTint`, déjà un token) a été envisagée puis
  écartée pour la même raison que dans `../home_unsorted_review_card/README.md` :
  une teinte à 5 % suppose un fond de l'app (`surface`/`background`), pas un
  cover photographique arbitraire — sur un cover sombre elle disparaît, sur un
  cover clair elle ne se détache pas assez pour rester lisible en mouvement.
  C reprend donc le même fond plein que A, pour la même raison déjà actée par
  `Colors.primaryTint` dans ce dépôt.
- Référence interne : le même sibling de `MediaFailureBadge` qu'en A, avec un
  ancrage différent — voir « ce qu'elle abandonne » pour le coût de cette
  différence.
- Référence externe : la légende « Uploading… »/pourcentage sous une icône de
  fichier dans l'app Fichiers d'iOS (le texte porte l'information, l'icône
  l'illustre) pour le traitement du titre ; le badge iCloud qui respire sur une
  photo en cours de synchronisation dans Photos iOS, pour la pastille qui
  pulse.

### L'icône : `pulse`

Identifiant exact : **`pulse`** (glyphe plein, cohérent avec `alert-circle`
et `sync`). Dessine un tracé d'électrocardiogramme — une pulsation, pas un
objet. Vérifié sans collision : `grep -rn '"pulse"' mobile/src mobile/app` ne
retourne rien.

### Ce qu'elle abandonne

- **La cohérence de placement avec `MediaFailureBadge`.** L'app aurait deux
  ancrages différents pour deux pastilles de statut sur la même tuile
  (haut-début pour l'échec, bas-centre pour le traitement) plutôt qu'un seul
  système de badges de statut. Pas un défaut disqualifiant — les deux statuts
  ne se recouvrent jamais — mais une incohérence à assumer si C est retenue,
  ou à corriger en alignant plutôt l'ancrage sur celui de `MediaFailureBadge`.
- **La sobriété.** La pastille qui respire et la phrase de titre disent la
  même chose deux fois. C'est la plus habillée des trois pour un état qui
  survient à chaque sauvegarde — potentiellement plusieurs fois par jour.

---

## Notes pour l'implémentation (pas des critères de cette tâche)

1. **Un helper à écrire, sibling d'`isFailedLibraryStatus`.** Quelle que soit
   la variante : `isProcessingLibraryStatus(status)` retournant `true` pour
   `"ingested"`, `"resolving"`, `"processing"` — pas pour `"ready_for_artifacts"`,
   `"failed"` ni `"cancelled"`. Le cas `"cancelled"` n'est traité par aucune
   variante ici : un import annulé n'est plus « en chemin », mais lui appliquer
   le badge « en cours » serait trompeur. À trancher à l'implémentation, pas
   ici.
2. **Des clés i18n neuves, dans les onze catalogues.** Au moins
   `mediaStatus.processingBadge` (A/C : « EN COURS », registre de
   `mediaStatus.failedBadge`), et selon la variante
   `mediaStatus.processingSubtitle` (B : « Traitement en cours ») ou
   `mediaStatus.processingTitle` (C : « Traitement en cours… »).
3. **Le contrat d'accessibilité n'a pas d'équivalent encore.**
   `describeWithFailure(label, failed)` n'a pas de sibling pour l'état « en
   cours » — à écrire sur le même modèle (`mediaStatus.a11yFailed` existe déjà,
   son pendant `mediaStatus.a11yProcessing` reste à créer) quelle que soit la
   variante retenue.
4. **`MediaListCard.tsx` porte le même statut, en rangée.** Le composant
   partage `isFailedLibraryStatus`/`MediaFailureBadge` avec `HomeTile`, mais en
   position inline dans une rangée de métadonnées, pas en overlay sur le
   cover. Cette maquette ne couvre que la vignette Home (« la vignette qui
   s'affiche », telle que l'owner la décrit) ; étendre à la ligne de la
   bibliothèque est une question ouverte, pas résolue ici.
5. **Risque de performance pour B**, déjà noté plus haut : vérifier `expo-blur`
   animé en continu sur Android avant de l'engager.

## Choix de l'owner

- **Variante retenue** : **B — « Balayage flou »**.
- **Date** : 2026-09-16.
- **Écarts demandés par rapport à la variante** : aucun.

### Ce que task-402 doit lire ici

C'est B, telle que décrite plus haut, qui fait foi pour l'implémentation :
aucun badge ni icône, une bande translucide floutée (`expo-blur` + `Animated`
du cœur RN, aucune dépendance neuve) qui balaie le cover en boucle sans masquer
l'image réelle, et le sous-titre — vide tant que le créateur n'est pas connu —
repris pour porter le texte d'état (clé i18n `mediaStatus.processingSubtitle`,
« Traitement en cours »). Le titre reste « Sans titre » ; il n'est pas
remplacé, contrairement à C. Les points de vigilance déjà notés pour B
restent à traiter à l'implémentation, pas à rouvrir :

- le risque de performance Android d'un `expo-blur` animé en continu sur
  plusieurs tuiles visibles (section « Ce qu'elle abandonne » de B) ;
- le helper `isProcessingLibraryStatus` et la clé i18n
  `mediaStatus.processingSubtitle` (section « Notes pour l'implémentation »),
  à créer dans les onze catalogues ;
- le pendant de `describeWithFailure`/`mediaStatus.a11yFailed` pour l'état
  « en cours », l'a11y de B n'étant portée aujourd'hui que par le texte visible
  du sous-titre.
