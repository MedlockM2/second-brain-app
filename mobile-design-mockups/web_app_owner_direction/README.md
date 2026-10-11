# App web — direction de l'owner (2026-10-11)

Une maquette interactive (`code.html`, autonome, sans réseau) et une capture par page (`screens/`). Le bouton « Pages de la maquette », en bas à gauche, liste tous les états. Chaque état a sa propre URL (hash).

Sources : `docs/research/task-424-website-and-browser-extension/mockup-build/dir_owner.{js,css}` sur le noyau commun des cinq directions (`core.*`, `data.js`, `icons.js`). La bibliothèque est à un seul niveau : un dossier ne se crée jamais dans un autre, donc `dir_owner.js` remplace le corpus à trois niveaux des cinq directions par un corpus plat de 69 dossiers (leurs dossiers de premier et de deuxième niveau, sans les noms génériques comme « Notes de lecture » ou « 2025 »). Les cinq directions gardent le leur. Pour régénérer, depuis la racine :

```
node docs/research/task-424-website-and-browser-extension/mockup-build/build_owner.mjs
bash docs/research/task-424-website-and-browser-extension/mockup-build/shoot_owner.sh
```

## Ce que la maquette applique

| Consigne | Ce qui est dessiné | Repris de |
|---|---|---|
| La barre horizontale de la direction B, avec tous ses boutons | Logo, Accueil, Bibliothèque, Digest, Non classés · N, recherche plein texte, Ajouter, thème, Mon compte | `web_app/direction_b_colonnes` |
| Accueil = l'Accueil mobile | « Ajouts récents » et « Reprendre l'apprentissage » en rangées de vignettes 16:9 de 200 px, dossiers en mosaïque. Sur bureau, les rangées ont des flèches ‹ ›. Ni carte « Revue des non classés » (l'onglet Non classés · N de la barre la remplace) ni alerte de minutes (décision de l'owner, 2026-10-11). | `app/(tabs)/inbox.tsx`, `HomeTile.tsx` |
| Bibliothèque = la Bibliothèque mobile | Section « Dossiers » repliable avec le + de création, grille d'icônes de dossier (Non classés en premier, teinté à part), puis « Tous les médias » en vignettes `MediaListCard`, sur deux colonnes. Pas de champ de recherche : il ferait doublon avec celui de la barre (décision de l'owner, 2026-10-11). | `app/(tabs)/search.tsx`, `MediaListCard.tsx` |
| Digest, adapté au bureau | Les deux périodes tiennent sur un écran, donc le choix montre leur contenu. Quotidien et Hebdomadaire sont deux colonnes, chacune avec sa pile des trois premières couvertures, son nombre de médias, un bouton « Lire » et son sommaire complet (n°, couverture, type, créateur, titre, début de « L'essentiel »). Chaque ligne ouvre la lecture à ce média. En lecture, la page média en trois volets est surmontée d'un bandeau qui remplace les points du mobile par le sommaire de la période, cliquable, avec ‹ ›, ← → et la position « 4 / 11 ». | `digest/index.tsx`, `DigestCoverStack.tsx`, `digest/[period].tsx` |
| Non classés, adapté au bureau | La revue garde les actions du mobile (Jeter, Approfondir, Ranger) mais n'est plus un carrousel : la file est visible à gauche, la source à décider au centre (couverture, accroche, puces), les destinations toujours ouvertes à droite. On range en un clic, ou au clavier : 1 à 5 pour les dossiers récents, D pour jeter, O pour approfondir, ← → pour naviguer. Un écran « Plus rien à trier » termine la revue. | `media/unsorted-review.tsx`, `FolderPickerView.tsx` |
| Mon compte, adapté au bureau | La carte de menu du mobile devient une barre latérale de réglages : mêmes lignes, même ordre, les deux lignes rouges en bas. Chaque ligne s'ouvre dans le volet de droite au lieu de pousser un écran : formule, langue de lecture, langue de l'app, thème, extension, suggestions, signaler un bug (formulaire en ligne), supprimer le compte. | `app/(tabs)/account.tsx`, `SubscriptionStatusCard.tsx` |
| Média en trois volets, façon NotebookLM | **Gauche, Lecture** : emplacement, menu `…`, couverture, métadonnées, « L'essentiel », texte intégral (les paragraphes cités par la réponse sont surlignés). **Milieu, Discussion** : fil, historique, nouvelle conversation, composeur « Ce média ». **Droite, IA** : grandes pastilles « Générer » (les 5 types) et Historique. Un artefact s'ouvre dans le volet IA, qui s'élargit. | Référence NotebookLM, `CompletedDetailView.tsx`, `ArtifactsPanel.tsx`, `chat/*` |
| Dossier en trois volets | **Gauche, Sources** : chemin, menu `…`, bouton « + Ajouter des sources » (le + de l'Accueil mobile, qui range directement dans ce dossier), puis la liste des sources. Ni section Dossiers ni création de sous-dossier : on ne crée pas de dossier dans un dossier (décision de l'owner, 2026-10-11) ; le menu `…` d'un dossier se limite à Renommer et Supprimer. **Milieu, Discussion** : portée « Ce dossier · N sources ». **Droite, IA** : génération sur tout le dossier, historique avec le nombre de sources. | `media/folders/[id].tsx` |

Les volets latéraux se réduisent en rail, comme dans NotebookLM ; la discussion reste toujours visible. Tout ce qui précède vaut pour l'ordinateur.

## Sur téléphone (moins de 900 px)

Sur un téléphone, la web app reprend l'app mobile écran par écran, aussi fidèlement qu'un navigateur le permet, **sans** les décisions prises pour l'ordinateur (décision de l'owner, 2026-10-11) : la personne retrouve l'app qu'elle connaît. Sources : `mockup-build/dir_owner_phone.{js,css}`.

| Écran | Repris de |
|---|---|
| Barre d'onglets flottante : Accueil, Recherche, Digest, Compte, avec leurs icônes | `app/(tabs)/_layout.tsx` |
| Accueil : alerte de minutes, carte « Revue des non classés », « Ajouts récents », « Reprendre l'apprentissage », boutons flottants appareil photo et + | `inbox.tsx` |
| Ajouter : feuille « Ajouter à votre boîte de réception » (coller un lien, importer un fichier, importer une photo) | `AddSourceSheet.tsx` |
| Recherche : champ flottant, « Dossiers » repliable avec +, grille de trois, « Tous les médias » | `search.tsx` |
| Dossier : en-tête ← titre `…`, segment Sources / IA, sources, composeur « Poser une question sur ce dossier… » | `media/folders/[id].tsx`, `ChatDock.tsx` |
| Média : couverture bord à bord avec ← et `…` sur verre, bandeau du titre, métadonnées, segment Lecture / IA, « L'essentiel », « Texte complet », composeur « Poser une question sur cette source… » | `CompletedDetailView.tsx`, `MediaDetailHero.tsx` |
| IA : « Générer » (une ligne par type, libellés de l'app : Notes de cours, Cartes mémo) puis « Généré » | `ArtifactsPanel.tsx` |
| Discussion : feuille sur 92 % de l'écran, conversations passées, nouvelle conversation | `ChatSheet.tsx` |
| Digest : deux piles l'une sous l'autre ; une période s'ouvre sur un bandeau ← points « 2 / 4 » → et la page du média, barre d'onglets visible | `digest/index.tsx`, `[period].tsx` |
| Revue des non classés : ✕, titre, « 3 / 12 », couverture et titre, carte d'accroche, barre Jeter / Approfondir / Ranger ; Ranger ouvre une feuille de dossiers | `unsorted-review.tsx`, `FolderSaveSheet.tsx` |
| Compte : e-mail, carte de formule, carte de menu (icônes de l'app), Se déconnecter et Supprimer le compte en rouge ; chaque réglage s'ouvre en écran avec ← | `account.tsx` |

Ce qu'un navigateur ne fait pas est laissé de côté ou remplacé : pas de partage depuis une autre app, ni de notifications push ; le verre Liquid Glass devient un fond flou ; le balayage entre médias du Digest et des non classés est remplacé par des flèches dans la maquette (un vrai balayage tactile reste possible dans le navigateur). Pas de barre d'état dessinée : celle du téléphone est au-dessus du navigateur.

Le jeu de données reste plat : l'app n'affiche des sous-dossiers que s'il en existe, et aucun ne peut être créé.

## Les pages et leurs captures

| # | Page | Capture |
|---|---|---|
| 1 | Accueil | `screens/01-accueil.png` |
| 2 | Bibliothèque | `screens/02-bibliotheque.png` |
| 3 | Recherche plein texte | `screens/03-recherche.png` |
| 4 | Digest, les deux périodes et leur sommaire | `screens/04-digest.png` |
| 5 | Digest, lecture d'une période (média 4 / 11) | `screens/05-digest-periode.png` |
| 6 | Non classés, revue | `screens/06-non-classes.png` |
| 7 | Non classés, revue terminée | `screens/07-non-classes-termine.png` |
| 8 | Média (Lecture · Discussion · IA) | `screens/08-media.png` |
| 9 | Média, artefact ouvert | `screens/09-media-artefact.png` |
| 10 | Média, volets latéraux réduits | `screens/10-media-volets-reduits.png` |
| 11 | Média en cours de traitement | `screens/11-media-en-traitement.png` |
| 12 | Dossier (Sources · Discussion · IA) | `screens/12-dossier.png` |
| 13 | Dossier, quiz ouvert, réponse en échec | `screens/13-dossier-quiz.png` |
| 14 | Dossier, ajouter des sources | `screens/14-dossier-ajouter.png` |
| 15 | Mon compte, formule | `screens/15-compte.png` |
| 16 | Mon compte, langue de lecture | `screens/16-compte-langue.png` |
| 17 | Mon compte, changer de formule (après la bêta) | `screens/17-compte-formules.png` |
| 18 | Ranger une source | `screens/18-ranger.png` |
| 19 | Connexion | `screens/19-connexion.png` |
| 20 | Média, thème sombre | `screens/20-media-sombre.png` |
| 21–37 | Téléphone (390 px) : accueil, ajouter, recherche, résultats, dossier, dossier IA, média, média IA, discussion, artefact, digest, période du digest, non classés, ranger, compte, langue de lecture, thème sombre | `screens/21-tel-accueil.png` … `screens/37-tel-sombre.png` |

La maquette contient aussi, sans capture dédiée : Inscription, Langue à l'inscription, Langue de l'app, Thème, Extension, Suggestions, Signaler un bug, Supprimer le compte, Se déconnecter, Renommer / supprimer un dossier, les états du chat (envoi, arrêt, reprise, refus de contexte, minutes épuisées, historique), Accueil vide.

## Deux choix faits sans consigne explicite

- **Pas de boutons flottants sur l'Accueil.** Sur mobile, le + et l'appareil photo flottent en bas à droite. Sur le web, le + est déjà le bouton « Ajouter » de la barre, que la consigne garde. L'appareil photo n'a pas d'usage sur un ordinateur : l'import d'une photo passe par le dépôt de fichier.
- **La page de digest porte la discussion.** Sur mobile, chaque page du carrousel est `CompletedDetailView`, qui affiche le composeur dans l'onglet Lecture. La version web reprend donc les trois volets du média, avec le bandeau de la période au-dessus.
