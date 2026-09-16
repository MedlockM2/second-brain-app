---
id: TASK-401
title: Maquetter l'indicateur de traitement en cours de la vignette média (Home)
status: Done
assignee: []
created_date: '2026-09-16 13:11'
updated_date: '2026-09-16 13:22'
labels:
  - mobile
  - ui
  - design
dependencies: []
priority: medium
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Ce que l'owner reproche à la vignette actuelle (2026-09-16)

La vignette d'un média qui vient d'être sauvegardé (liste « Ajouts récents » de l'accueil) n'indique nulle part qu'il est en cours de traitement. Elle affiche juste un titre générique et rien d'autre — l'utilisateur ne sait qu'il est en train d'attendre que s'il ouvre la vignette. Il faut un signal visible sans clic, et l'owner suggère explicitement qu'un composant moderne « par le mouvement » (plutôt qu'un badge statique) serait la bonne direction à explorer.

## État actuel, mesuré

- `HomeTile`, `mobile/src/components/HomeTile.tsx` : tuile 200×113 (`TILE_WIDTH`/`TILE_COVER_HEIGHT`), titre `numberOfLines={3}`. `tileTitle()` (L294-299) retombe sur `t("common.untitled")` (« Sans titre ») quand `item.title` est vide — c'est exactement ce placeholder générique que l'owner décrit, et le commentaire du code dit lui-même que c'est « la fenêtre avant que les métadonnées de l'item ne soient résolues ».
- `MediaListItem.status` (`mobile/src/types/media.ts`) peut valoir `"ingested" | "resolving" | "processing" | "ready_for_artifacts" | "failed" | "cancelled"`. Seule la valeur `"failed"` a aujourd'hui une traduction visuelle : `isFailedLibraryStatus()` + `MediaFailureBadge` (`mobile/src/components/MediaFailureBadge.tsx`), un badge `Colors.error` avec l'icône Ionicons pleine `alert-circle` et le texte `t("mediaStatus.failedBadge")` (« ÉCHEC »), posé en `position: absolute` sur le cover (`top`/`start: Spacing.sm`). Le commentaire de `isFailedLibraryStatus` dit explicitement : *"pending and processing mean the item is on its way and will change on its own; ready is the norm"* — c'est un choix déjà pris de ne rien afficher pour ces états, jamais implémenté visuellement. C'est ce trou que la maquette doit combler.
- Le même badge est réutilisé par `MediaListCard.tsx` (la ligne de la bibliothèque), mais en position inline dans la rangée de métadonnées, pas en overlay sur le cover — deux placements différents pour le même badge, à connaître mais pas à unifier ici.
- **Aucun shimmer/skeleton, aucun `react-native-reanimated`, aucun `expo-linear-gradient`** dans le dépôt (`mobile/package.json`, `mobile/src`, `mobile/app`). Le seul idiome de chargement déjà établi est l'`ActivityIndicator` natif RN (27 fichiers) et l'API `Animated` du cœur de React Native (utilisée pour des transitions ponctuelles de fondu/échelle, jamais en boucle continue). `expo-blur` est installé et déjà utilisé pour le glassmorphism de la Top Bar (DESIGN.md, « Glassmorphism »).
- Aucun mécanisme de mise à jour « en vivant » de la liste : `useMediaPolling.ts` ne fait qu'un fetch au montage + `refetch()` silencieux sur focus d'écran (commentaire explicite : *"V1 design: no recurring network requests while the inbox is open"*). Une vignette ne peut donc pas passer d'elle-même de « en cours » à « prête » sans que l'écran regagne le focus — contrainte à connaître, pas à résoudre ici.
- `Colors.primaryTint` (`rgba(255, 203, 5, 0.05)`, déjà un token dans `mobile/src/constants/theme.ts`) porte la teinte ambre à 5 % que « Signature Textures » prescrit.

## Contraintes de la maquette

- Valeurs prises dans `mobile/src/constants/theme.ts` uniquement.
- Géométrie de la tuile inchangée : `TILE_WIDTH` (200) et `TILE_COVER_HEIGHT` (113) ne bougent pas, aucune variante ne redimensionne la tuile.
- Ionicons est la langue d'icônes de l'app ; toute icône proposée doit être vérifiée sans collision de sens avec un usage déjà présent dans `mobile/src` et `mobile/app` (comme documenté pour `file-tray-outline` dans `mobile-design-mockups/home_unsorted_review_card/README.md`).
- Le mouvement proposé doit être réalisable avec les briques d'animation réellement disponibles dans le dépôt (API `Animated` du cœur RN, éventuellement `expo-blur`) ; si une variante suppose une dépendance absente (`expo-linear-gradient`, Reanimated), le dire explicitement comme note d'implémentation, pas comme un acquis.
- Le contrat d'accessibilité de la tuile (une seule cible tactile, un seul label) n'est pas rouvert.

## Justifier par des références, pas par une intuition

Même exigence que task-361 : une variante n'est recevable que si elle s'appuie sur une règle citée de `mobile-design-mockups/my_design_system/DESIGN.md` **et** sur au moins une implémentation de référence nommée (interne au dépôt — `MediaFailureBadge`, `ActivityIndicator` — ou externe : patterns d'upload/sync documentés d'apps connues).

## Périmètre

Le livrable est la maquette, pas le code de l'app. Aucun fichier de `mobile/app/` ni de `mobile/src/` n'est modifié ici — l'implémentation suit dans la tâche qui dépend de celle-ci.

## Notes pour l'owner (pas des ACs)

- Tu ouvres `code.html` dans un navigateur (les animations jouent réellement, ce n'est pas une capture figée), tu choisis une variante ou tu demandes un tour de plus, et tu notes ton choix dans le README du dossier.
- Aucune capture d'écran n'est demandée à l'agent : il n'a pas de navigateur pour la produire. Le HTML autonome tient ce rôle, et ici le mouvement réel dans le navigateur est plus fidèle qu'une capture ne pourrait l'être.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `mobile-design-mockups/home_tile_processing_state/code.html` existe et s'ouvre seul dans un navigateur, sans ressource distante nécessaire à la fidélité du rendu, présentant au moins trois variantes de l'indicateur côte à côte, avec de vraies animations CSS (pas des captures figées)
- [x] #2 Chaque variante est rendue sur la géométrie réelle de `HomeTile` (200×113, titre 3 lignes max) avec les valeurs de `mobile/src/constants/theme.ts`, dans une rangée de tuiles voisine d'au moins une tuile déjà résolue (contexte, pas isolée)
- [x] #3 Chaque variante est montrée dans les cas limites que l'app produit : le placeholder « Sans titre »/« Untitled » pendant que le titre n'est pas résolu, plusieurs tuiles en cours de traitement simultanément dans la même rangée, et l'état final une fois la tuile résolue (transition/disparition de l'indicateur)
- [x] #4 `mobile-design-mockups/home_tile_processing_state/README.md` justifie chaque variante par une règle citée de `my_design_system/DESIGN.md` et par au moins une implémentation de référence nommée (interne ou externe), dit ce que chaque variante abandonne, et ne s'appuie à aucun endroit sur une préférence personnelle
- [x] #5 Le README nomme l'icône proposée par variante avec son identifiant exact dans la bibliothèque Ionicons de l'app, vérifie l'absence de collision avec un usage déjà présent dans `mobile/src` et `mobile/app`, et dit explicitement quand une icône est réutilisée en cohérence avec `MediaFailureBadge` (glyphe plein, pas outline)
- [x] #6 Le README dit pour chaque variante si son mouvement est réalisable avec l'API `Animated` du cœur React Native et/ou `expo-blur` déjà présents dans le dépôt, ou si elle suppose l'ajout d'une dépendance absente (`expo-linear-gradient`, Reanimated) — dans ce dernier cas c'est signalé comme note d'implémentation, pas comme un acquis
- [x] #7 Aucune variante ne modifie `TILE_WIDTH`, `TILE_COVER_HEIGHT`, ni le contrat d'accessibilité actuel de la tuile (cible tactile unique, label unique)
- [x] #8 Le diff de la tâche se limite à `mobile-design-mockups/` et au backlog : aucun fichier de `mobile/app/` ou `mobile/src/` n'est modifié
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Livrable : `mobile-design-mockups/home_tile_processing_state/code.html` + `README.md`. Aucun fichier de `mobile/` touché (AC#8 vérifié : seul le dossier de maquette et le backlog changent).

**Autonomie et fidélité (AC#1, AC#2).** CSS écrit à la main, custom properties nommées d'après `mobile/src/constants/theme.ts`, pile système équivalente à ce que l'app rend, cinq glyphes Ionicons inlinés en `<symbol>` SVG extraits de la fonte de l'app (`@expo/vector-icons/.../Fonts/Ionicons.ttf`) avec fontTools `SVGPathPen` + retournement en Y (`sync`, `pulse`, `alert-circle` pleins ; `document-text-outline`, `play-circle-outline`, `headset-outline` pour les covers de repli). Géométrie de tuile recopiée de `HomeTile.tsx` (`TILE_WIDTH` 200, `TILE_COVER_HEIGHT` 113, `TILE_HEIGHT` 203, styles `title`/`subtitle`/`failureMarker` L336-396). Contrairement aux maquettes précédentes du dossier, les animations sont de vraies animations CSS (`@keyframes`), pas des captures : c'est le sujet même de la tâche. Rendu vérifié en Chrome headless (captures relues à plusieurs largeurs ; un bug de largeur du badge — le texte du badge repassait à la ligne faute de `width: max-content`/`white-space: nowrap` sur `.badge-status` — a été trouvé et corrigé après la première capture).

**Les trois variantes (AC#3, AC#4, AC#5, AC#6).** A « Badge sync ambre » (sibling direct de `MediaFailureBadge` : même position/forme/taille, fond `primary` au lieu d'`error`, icône `sync` pleine qui tourne, texte « EN COURS ») ; B « Balayage flou » (bande translucide floutée sur le cover via `expo-blur`+`Animated`, aucune icône, sous-titre vide repris pour porter le texte d'état) ; C « Pastille pouls » (badge bas-centre dont toute la surface respire, icône `pulse` pleine immobile, titre remplacé par la phrase d'état). Chaque variante est montrée en contexte (rangée avec une tuile déjà résolue), dans la densité qu'elle produit (trois tuiles en cours dans la même rangée — le « mur d'ambre » pour A et C), et dans l'état final une fois résolue. Aucune ne modifie `TILE_WIDTH`/`TILE_COVER_HEIGHT` ni le contrat d'accessibilité (AC#7). Les trois sont réalisables avec l'`Animated` du cœur RN et/ou `expo-blur`, déjà présents — aucune ne suppose Reanimated ni `expo-linear-gradient` (AC#6).

**Icônes (AC#5).** `sync` et `pulse` choisis pleins (pas `-outline`) pour rester dans la même famille que `alert-circle` de `MediaFailureBadge`. Collision vérifiée à zéro par grep dans `mobile/src` et `mobile/app`. `refresh`/`refresh-outline` et `time-outline` explicitement écartés et justifiés (collision avec les boutons "Réessayer" et avec l'état `"timeout"` de `digest.tsx`).

**Notes pour l'implémentation, versées au README, pas résolues ici.** Helper `isProcessingLibraryStatus` à écrire (sibling d'`isFailedLibraryStatus`, sans couvrir `"cancelled"` — question ouverte) ; clés i18n neuves à ajouter dans les onze catalogues ; pendant de `describeWithFailure`/`mediaStatus.a11yFailed` à créer pour l'état « en cours » ; `MediaListCard.tsx` partage le même statut mais en placement inline, hors périmètre ici ; risque de performance Android pour `expo-blur` animé en continu (variante B) à vérifier avant implémentation.

Aucun test automatisé ajouté, conformément à la règle projet. Le choix de variante appartient à l'owner : le README se termine sur une section « Choix de l'owner » vide, que task-402 lira.
<!-- SECTION:NOTES:END -->
