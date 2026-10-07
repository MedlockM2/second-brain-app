# Intégration du chatbot dans l'UI — six directions (task-434)

Maquettes du benchmark **task-434**. L'analyse, la comparaison et la recommandation sont dans
`docs/research/task-434-chatbot-integration-ui/README.md` ; c'est ce document, et la décision que
l'owner y inscrira, qui font foi.

Chaque sous-répertoire contient un `code.html` **autonome** (aucun `<script>`, `<link>` ni `<img>`,
aucune URL distante) et `screen.png`, rendu de la page entière à **1200 px de large**. Chaque page
montre, dans cet ordre : le parti pris, les règles Apple et Material qui s'y appliquent, l'écran
actuel en référence, la direction au repos **aux deux tailles et dans les deux thèmes**, le
composeur (repos, clavier ouvert, question longue, compteur), l'attente **dans les deux régimes**
(flux et bloc après 5 à 15 s), l'erreur et le refus de quota, les trois portées, puis les mesures,
les écarts au design system, l'accessibilité et la faisabilité React Native fichier par fichier.

## Les six directions

| Direction | Répertoire | Où vit le chat | Barre d'onglets | `ScreenTabs` | `ArtifactsPanel` | Portée bibliothèque |
|---|---|---|---|---|---|---|
| **A — Dans l'onglet IA** | `direction_a_dans_longlet_ia/` | en tête de l'onglet IA, au-dessus des pastilles | intacte | intact | **modifiée, pour les deux portées à la fois** | non servie |
| **B — Un troisième onglet** | `direction_b_troisieme_onglet/` | onglet « Discussion » à côté de Lecture/IA et de Sources/IA | intacte | **+1 onglet, et un libellé court à écrire** | intacte | non servie |
| **C — Un cinquième onglet principal** | `direction_c_cinquieme_onglet/` | une destination « Chat », qui liste les conversations | **5 items** (variante : Chat remplace Digest, chemin de remplacement dessiné) | intact | intacte | servie, et désactivable sans vider l'onglet |
| **D — Une feuille invocable de partout** | `direction_d_feuille_invocable/` | feuille non modale, portée par l'écran, réductible en pilule | intacte | intact | intacte | servie par un bouton d'en-tête, qui disparaît si infaisable |
| **E — Depuis le texte** | `direction_e_depuis_le_texte/` | une sélection ou un paragraphe du lecteur, passage joint | intacte | intact | intacte | non servie, par construction |
| **F — Composeur persistant** | `direction_f_composeur_persistant/` | `NativeTabs.BottomAccessory` au-dessus de la barre (iOS 26+) | **un accessoire, pas une destination** | intact | intacte | servie ; sinon l'accessoire change de promesse |

**A et B répondent à la première question de l'owner** (au niveau des artefacts, ou dans un onglet
de plus). **C et F répondent à la deuxième** (un chat global, et à quel prix dans la barre) de deux
façons opposées : une destination de plus, ou un accessoire qui n'en est pas une. **D et E sortent
du cadre des deux premières** : une feuille invocable de partout, et une entrée qui part du contenu
lui-même.

## Ce qu'aucune direction ne suppose

- **Ni le flux, ni son absence.** L'architecture du chatbot n'est pas tranchée (task-430 est en
  cours de complément). Chaque direction dessine l'attente **dans les deux régimes** : texte qui
  s'écrit token par token, et réponse qui arrive d'un bloc après 5 à 15 s. Aucune recommandation ne
  dépend du transport.
- **Ni la portée bibliothèque.** Sa faisabilité n'est pas établie (task-430 §13.1 la nomme comme
  benchmark distinct). Les trois directions qui la proposent disent, et dessinent, ce qu'elles
  deviennent sans elle.
- **Ni un plafond de saisie.** Le compteur dessiné s'arrête à 1 000 caractères : c'est une **valeur
  candidate** de task-430, pas une décision. Ce que les maquettes établissent, c'est qu'il faut un
  compteur, pas lequel.

## Conventions de rendu

Identiques à `digest_direction_*` (task-408) et à `media_reading_tab_refonte/` (task-410) :

- **Police système** — l'app ne charge aucune police (aucun `useFonts`, aucun `fontFamily` dans
  `mobile/app` ni `mobile/src`) : elle rend en SF Pro sur iOS et en Roboto sur Android. La pile
  déclarée dans le CSS est le repli système équivalent.
- **Glyphes Ionicons exacts** — chaque glyphe est le contour extrait de la fonte que l'app utilise
  (`@expo/vector-icons`, `Ionicons.ttf`, 512 unités par em), reporté dans un `<symbol>` en
  `viewBox 0 0 512 512`.
- **Tokens** — couleurs, espacements, rayons, cibles tactiles et tailles de texte viennent de
  `mobile/src/constants/theme.ts`, repris en variables CSS **une fois par palette** : la claire, et
  la sombre que task-433 a ajoutée. Tout écart est nommé dans la section « Écarts au design
  system » de chaque page et proposé comme évolution explicite du design system.
- **Cadres** — 414 x 896 pt (iPhone 11) et 320 x 568 pt (iPhone SE en Display Zoom), en
  `overflow: hidden` : ce qui ne tient pas est coupé à l'image, comme sur l'appareil.
- **Couches système** — la barre d'état, l'indicateur d'accueil, la barre d'onglets native et le
  clavier sont dessinés comme des couches système et non comme des surfaces de l'app. Les hauteurs
  de clavier retenues (301 pt à 414 x 896, 253 pt à 320 x 568) sont les valeurs qu'iOS rapporte en
  portrait avec la barre QuickType : **imposées par le système, pas des tokens**.
- **Couvertures** — illustrations SVG embarquées qui tiennent lieu de photos ; leurs couleurs sont
  celles d'une image, pas de l'interface, et ne sont donc pas soumises à la palette.
