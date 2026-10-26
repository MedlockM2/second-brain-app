# Onglet IA d’un média et d’un dossier : trois variantes et le moment de la génération

L’onglet IA (`ArtifactsPanel`, partagé par `app/media/[id].tsx` et `app/media/folders/[id].tsx`) empile deux listes :
cinq tuiles sous le titre « Générer », puis l’historique sous le titre « Généré ». Une tuile déjà couverte remplace
son bouton « Générer » par une note grise « Généré ». On lit donc deux fois la même liste, avec le même verbe à deux
sens, et une tuile « Généré » ne s’ouvre pas : il faut retrouver la fiche plus bas, sous le titre écrit par le modèle.
Pendant la génération, rien ne signale la fin, et ouvrir trop tôt mène à « Pas encore prêt » avec un bouton
Actualiser. `diagnostic_actuel/` détaille ces cinq problèmes.

Chaque sous-répertoire contient un `code.html` autonome et `screen.png`, rendu de la page entière. Toutes les pages
montrent les mêmes données : la vidéo « Comment le sommeil consolide la mémoire » (2 fiches prêtes, 1 en
préparation, 2 à créer) et le dossier « Productivité » (15 sources ; résumé détaillé fait sur 12, quiz à jour,
cartes mémo en échec, une version plus ancienne).

## Vocabulaire commun aux trois variantes

- « Générer » et « Généré » disparaissent de l’onglet. L’action s’appelle **Créer**, et le résultat **une fiche**.
- « En attente » et « Génération… » fusionnent en **En préparation** : la différence n’aide pas l’utilisateur.
- Une fiche prête affiche son titre et sa date, et elle s’ouvre d’un appui.
- Dossier qui a changé : « 3 sources ajoutées depuis » et **Mettre à jour**, au lieu d’un bouton « Générer »
  qui réapparaît sans explication.
- Chaque format dit ce qu’il contient (« Contexte, thèmes, citations, conclusion »), d’après les champs que le
  modèle produit pour ce type.

## Variantes de l’onglet

| Variante | Répertoire | Principe | Données | Effort |
|---|---|---|---|---|
| **A — « Une carte par format »** | `variante_a_une_carte_par_format/` | une seule liste ; chaque carte porte tout le cycle du format (à créer → en préparation → prête, qui s’ouvre) ; versions de dossier repliées sous la carte | `ArtifactSummary` actuel | S–M |
| **B — « Vos fiches d’abord »** | `variante_b_vos_fiches_dabord/` | les fiches créées en cartes de lecture avec un extrait, puis « Créer une autre fiche » en pastilles ; un choix guidé quand il n’y a encore rien | + `excerpt` et `item_count` dans la liste (backend) | M |
| **C — « Atelier »** | `variante_c_atelier/` | grille 2 x 3 des formats, état en pied de tuile ; créer passe par une feuille qui décrit le format avant de lancer | `ArtifactSummary` actuel | M |

`comparatif/` montre l’écran actuel et les trois variantes côte à côte, pour un média et pour un dossier.

## Le moment de la génération (`generation_moment/`)

Les trois options se combinent avec A, B ou C :

- **G1 — « Carte vivante »** : on reste sur l’onglet ; la carte passe en préparation, puis un toast dit « prêt »
  et propose « Ouvrir ». C’est l’option la plus simple, car l’onglet interroge déjà le statut.
- **G2 — « Ouverture directe »** : un appui ouvre aussitôt l’écran de la fiche, en squelette de sa forme finale,
  qui se remplit seul. Cela remplace l’écran « Pas encore prêt ». Il faut un sondage du statut sur
  `app/artifacts/[artifactId].tsx` et un squelette par type.
- **G3 — « Suivi flottant »** : une pastille suit l’utilisateur pendant qu’il lit, puis devient « prêt · Ouvrir ».
  C’est le meilleur suivi hors de l’onglet, mais il demande un état global : effort L.

Aucune étape intermédiaire ni durée estimée n’est montrée, car le backend n’expose que `queued`, `generating`,
`completed` et `failed`.

## Recommandation

**A + G2.** A règle la confusion à la racine : une liste, un verbe, et chaque fiche à un seul endroit. Elle ne
demande aucun champ nouveau, puisque `ArtifactTile` et `ArtifactHistoryRow` fusionnent en un composant. G2
remplace l’impasse « Pas encore prêt » par l’aperçu de ce qui arrive. L’extrait de B pourra venir plus tard dans
les cartes prêtes de A, si le backend l’expose.

## Points à trancher ou à vérifier

- **« 3 sources ajoutées »** se calcule par différence entre le nombre de sources du dossier et le `source_count` de
  la dernière version. Si une source a été retirée, ce calcul est faux. Il faut soit dire « Le dossier a changé »,
  soit exposer le détail.
- **« On vous prévient quand c’est prêt »** (l’état vide de B, la feuille de C) suppose une notification de fiche
  prête. Le canal « Prêt à approfondir » existe pour les médias, pas pour les fiches à ma connaissance. Sans cette
  notification, la phrase est à retirer.
- **Nom de l’onglet** : « IA » nomme la technique, pas ce qu’on y trouve. Le renommer en « Fiches » serait
  cohérent avec ce vocabulaire. Les maquettes gardent « IA » pour ne comparer que le contenu de l’onglet.
- Les messages de refus (`artifacts.refusal.*`) parlent encore de « génération » ; ils sont à reformuler en même
  temps.

## Conventions de rendu

Ce sont les mêmes que dans `folder_sources_tab_refonte/` : police système, glyphes extraits de `Ionicons.ttf`, tokens
de `mobile/src/constants/theme.ts`, cadres aux dimensions logiques exactes en `overflow: hidden`. L’en-tête de la page
Média est simplifié en une vignette et un titre, car seul l’onglet change. Seul écart au design system : les icônes
ambrées sur fond blanc utilisent un ambre assombri (`#b88a00`), parce que `primary` y mesure 1,5:1.
