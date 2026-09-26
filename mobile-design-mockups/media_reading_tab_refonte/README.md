# Onglet « Lecture » de la page Média — cinq directions (task-410)

Maquettes du benchmark **task-410**. L’analyse, la comparaison et la recommandation sont dans
`docs/research/task-410-media-reading-tab-refonte/README.md` ; c’est ce document, et la décision de l’owner qui y
sera inscrite, qui font foi pour task-411.

Chaque sous-répertoire contient un `code.html` autonome (aucun `<script>`, `<link>` ni `<img>`, aucune requête
réseau) et `screen.png`, rendu de la page entière à 1200 px de large. Chaque page montre, dans cet ordre : le parti
pris, l’écran actuel en référence (414 x 896 pt, 320 x 568 pt et en lecture), la direction au repos aux deux
tailles, en lecture, sans couverture, dans ses états (aperçu en préparation, erreur de chargement du texte), le
cadrage de la couverture selon la proportion de la source, puis les mesures, les écarts au design system,
l’accessibilité et la faisabilité React Native.

| Direction | Répertoire | La couverture | L’aperçu | Le texte complet |
|---|---|---|---|---|
| **A — « Une »** | `direction_a_une/` | pleine largeur 16:9 sous l’en-tête ; carrés et verticaux montrés entiers sur leur propre flou | chapeau (« Callout Aside » d’Amber Clarity) | en ligne |
| **B — « Pochette »** | `direction_b_pochette/` | pochette entière au ratio de la source, sur une scène tonale | section sous le bouton « Lire » | dans une liseuse (nouvel écran) |
| **C — « Bandeau rétractable »** | `direction_c_bandeau_retractable/` | bandeau bord à bord sous la barre d’état, titre posé dessus ; se rétracte en vignette de 32 pt | carte actuelle | en ligne, barre unique en lecture |
| **D — « Texte d’abord »** | `direction_d_texte_dabord/` | la vignette 112 x 63 des listes, dans une rangée d’identité | repliée, à déplier | en ligne, au-dessus du pli |
| **E — « Aperçu d’abord »** | `direction_e_apercu_dabord/` | carte de source 16:9 en retrait, qui ouvre l’original | contenu principal, en tête | deux paragraphes puis « Lire la suite » |

Repli commun sans image : le glyphe du type de média sur `surfaceContainerLow`, comme dans toutes les listes ;
un cadre pleine largeur se réduit à 96 pt, une vignette garde sa taille. Aucun second champ image, aucun
nouvel endpoint.

Conventions de rendu, identiques à `digest_direction_*` (task-408) : police système (l’app n’en charge aucune),
glyphes Ionicons extraits de `Ionicons.ttf`, tokens de `mobile/src/constants/theme.ts`, cadres aux dimensions
logiques exactes en `overflow: hidden`. Les couvertures sont des illustrations SVG embarquées qui tiennent lieu
de photos ; leurs couleurs sont celles d’une image, pas de l’interface.
