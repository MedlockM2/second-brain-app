# Onboarding après connexion et retour bêta

Maquette de réponse au retour TestFlight `AHZj_EmKyk_-POh6f05H_SE` (build 21, 2026-11-01). Source : `_build/build.mjs`. Rendu : `code.html` → `screen.png`.

## Ce que dit le retour

1. L'écran qui explique comment partager une évaluation bêta est utile, mais il ne dit pas quoi faire après la capture. Il ne doit concerner qu'iOS (avec un équivalent Android s'il en existe un), et s'afficher quand on touche « Signaler un bug » dans le Compte, à la place du formulaire.
2. Au premier démarrage, un carrousel à la manière de Readwise Reader. Il montre le partage vers l'app avec les icônes des apps compatibles, puis l'écran « disponible sur mobile et sur le web ».

## Ce que TestFlight ne permet pas

« Du développeur » et « Partager l'évaluation » sont des écrans de **TestFlight**, pas de l'app. On ne peut ni les masquer, ni changer leur moment d'apparition, ni les intégrer à un carrousel. Seul le texte sous « Éléments à tester » est le nôtre (`docs/store-listing/pre-beta-review.md`). Ce texte présente déjà l'app, donc le carrousel n'a pas de page « concept », qui aurait fait doublon.

## Décisions de l'owner (2026-11-01)

- Le carrousel actuel (`app/(auth)/welcome.tsx`, 4 pages) est supprimé.
- Une personne déconnectée arrive directement sur « Se connecter », sans flèche de retour. Le logo de l'app est centré et agrandi (92 pt), en finition « arête de verre », retenue parmi six propositions : ambre plat et glyphe net, une seule arête de lumière sur le bord supérieur et un bord clair très fin, comme le verre des icônes d'iOS 26, sur une ombre douce et neutre ; ni reflet, ni bombé, ni halo (l'essai « premium » à reflets faisait daté). Sous lui, « Se connecter » et « Retrouvez votre bibliothèque. » cèdent la place à un seul titre centré, « Bienvenue sur Deepn » (« Welcome to Deepn » en anglais), « Deepn » dans l'ambre du design system pour le texte (`primaryInk` : #b88a00 en clair, #f0bf2a en sombre). Le dessin est celui du vrai logo (`web/public/favicon.svg`, dont sortent `icon.png` et `splash.png`), pas l'icône Ionicons `layers-outline`.
- Nouveau carrousel de **deux pages** : le partage vers l'app, puis « Sur votre téléphone et votre ordinateur ». Il s'affiche **après la connexion ou l'inscription**, une seule fois, et **seulement sur une première installation**, jamais après une mise à jour.
- « Signaler un bug » : sur iOS pendant la bêta (`isBetaAccess`), l'explication du retour TestFlight. **Android garde le formulaire** : le retour privé de Google Play se fait depuis la fiche Play Store, sans capture, ce qui est moins riche que le formulaire. Le web et l'après-lancement gardent aussi le formulaire.
- Pas d'onboarding propre à la bêta : le carrousel sert aussi en production.
- Le web ne reprend pas les pages mobiles.

## Ordre des écrans au premier lancement

iPhone (TestFlight) : « Du développeur » → « Partager l'évaluation » (TestFlight) → Se connecter / Créer un compte → code → langue de lecture (nouveau compte) → carrousel → Accueil.

Android et production : la même suite, sans les deux écrans TestFlight.

## Choix de la maquette

- **Jetons du design system** : fond `surfaceContainerLow`, halo ambre, titre en 800, bouton principal ambre pleine largeur, points de pagination de l'app.
- **Mise en page de Readwise (owner, 2026-11-01)** : le texte en haut, centré ; l'illustration dessous, dans le même fond, qui sort par le bas de l'écran et s'efface sous le bouton ; « Suivant » (« C'est parti » sur la dernière page), puis les points de pagination en dessous.
- **Navigation** : on n'avance qu'en touchant « Suivant ». Pas de glissement au doigt, pas de retour (ni geste de retour iOS, ni bouton retour Android), pas de « Passer ». « C'est parti » ouvre l'Accueil.
- **La feuille de partage est celle du système**, le reste grisé comme chez Readwise. Sur iOS, l'iPhone affiche « Deepn » sous l'icône (constaté par l'owner), et non le « Deepn Share » que le commentaire de `iosShareExtensionName` (`mobile/app.config.ts`) annonce. L'app n'a pas d'extension d'action, donc aucune ligne « Enregistrer dans Deepn » n'est dessinée. Les logos sont ceux de `SHARE_TARGETS`, déjà dans l'app (`WelcomeArt.tsx`, `TILES`).
- **Web** : W1 garde la page actuelle ; W2 montre l'extension Chrome et Edge, le lien collé et le fichier glissé ; W3 montre le partage depuis le téléphone.

## À vérifier sur l'iPhone avant le code

Les libellés iOS de l'écran « Signaler un bug » viennent de l'aide TestFlight d'Apple et de forums, pas d'un iOS 26 en français : « OK » après l'annotation, « Partager l'évaluation bêta », et « Envoyer une évaluation bêta » dans l'app TestFlight.
