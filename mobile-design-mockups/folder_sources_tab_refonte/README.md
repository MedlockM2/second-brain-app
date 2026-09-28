# Onglet « Sources » d’un dossier : quatre variantes

L’onglet Sources de `app/media/folders/[id].tsx` affiche aujourd’hui une glyphe de type dans une case de 36 pt et un
titre sur une ligne. La couverture (`media_image`) n’y est jamais montrée, alors que la Bibliothèque l’affiche déjà.
Dans un dossier de reels comme « App », toutes les lignes portent donc la même icône ▶ : la liste ne permet pas de
distinguer les sources.

Les maquettes s’appliquent à **tout dossier**. Chacune montre le même dossier mixte, « Productivité » (2 sous-dossiers,
10 sources de 8 types, dont 4 sans image), puis deux cas limites : « App », qui reprend les titres de la capture
de l’owner (que des reels), et « Réunions », dont aucune source n’a d’image.

Chaque sous-répertoire contient un `code.html` autonome (aucun `<script>`, `<link>` ni `<img>`, aucune requête
réseau) et `screen.png`, rendu de la page entière. `comparatif/` montre l’écran actuel et les quatre variantes
côte à côte.

| Variante | Répertoire | Principe | Sans image | Sources visibles (« App », 414 x 896) | Effort |
|---|---|---|---|---|---|
| Actuel | — | glyphe 36 pt + titre sur 1 ligne | glyphe | 9 | — |
| **A — « Vignette Bibliothèque »** | `variante_a_vignette_bibliotheque/` | `MediaListCard` réutilisé tel quel ; sous-dossiers avec un collage de couvertures | glyphe 28 pt dans le cadre 112 x 63 | 5 | S |
| **B — « Mosaïque »** | `variante_b_mosaique/` | grille en maçonnerie sur 2 colonnes, chaque couverture proche de sa proportion | fiche typographique teintée ambre | 4 (≈ 6 images) | M |
| **C — « Album »** | `variante_c_album/` | planche de 3 couvertures, résumé et filtres par type, puis liste à vignettes carrées | glyphe 26 pt dans une vignette 64 pt | 5 (2 dans le dossier mixte) | L |
| **D — « Sommaire »** | `variante_d_sommaire/` | le texte d’abord : type et créateur, titre sur 2 lignes, petite couverture à droite, groupes par date | rien : la ligne est du texte seul | 6 | S–M |

Les densités ont été mesurées dans Chrome headless : ce sont les lignes entièrement visibles sans défilement. Aucun
cadre ne déborde horizontalement, en 414 comme en 320 pt.

Toutes les variantes s’en tiennent aux champs déjà présents dans `MediaListItem` (`media_image`, `media_type`,
`creator_name`, `created_at`, `title`). Les covers des sous-dossiers se calculent depuis la réponse de
`getFolderMedia`, qui inclut déjà les descendants. Il n’y a ni nouvel endpoint ni migration, et l’onglet IA ne
change pas.

Conventions de rendu, les mêmes que `digest_direction_*` et `media_reading_tab_refonte/` : police système, glyphes
Ionicons extraits de `Ionicons.ttf`, tokens de `mobile/src/constants/theme.ts`, cadres aux dimensions logiques
exactes en `overflow: hidden`. Les couvertures sont des illustrations SVG qui tiennent lieu de photos, et les
données sont fictives.
