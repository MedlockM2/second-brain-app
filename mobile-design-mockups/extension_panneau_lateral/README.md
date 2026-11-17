# Extension : le panneau latéral, sur le modèle de la page média

`code.html` est la maquette autonome, générée par `_build/build.mjs` ; `screen.png` en est le rendu. Elle remplace la
popup de l'extension par un panneau latéral qui reprend la page média de l'app (en-tête, onglets Lecture et Cahier), dans
les tokens et les icônes de l'app web (`web/src/styles.css`, `web/src/components/icons.generated.ts`).

Régénérer : `node mobile-design-mockups/extension_panneau_lateral/_build/build.mjs`. Rendu PNG :
`node --experimental-websocket mobile-design-mockups/extension_panneau_lateral/_build/shoot.mjs [dossier-cadres]`.

## Le geste

- Un clic sur l'icône, ou ⌥S, ouvre le panneau à droite de la page et l'enregistre dans le dernier dossier utilisé. La popup disparaît.
- Une page déjà dans la bibliothèque n'est pas enregistrée deux fois : l'en-tête dit « Déjà dans votre bibliothèque ».
- Le panneau garde sa page quand on change d'onglet : sans la permission `tabs`, il ne voit pas l'onglet où l'on passe. Un nouveau clic sur l'icône enregistre la page courante et l'affiche.
- La largeur appartient à l'utilisateur : Chrome n'offre pas d'API pour la fixer. Les cadres font 400 px ; le panneau est dessiné pour 360 à 600 px.

## L'en-tête

- La vignette du type de média, le site, le titre ; à droite, « Ouvrir dans Deepn » et le menu « … » (raccourci, déconnexion).
- Une puce d'état (« Enregistré », « Déjà dans votre bibliothèque », « Traitement en cours ») et la puce du dossier, qui se change sur place : recherche, et « Créer « … » » quand rien ne correspond.

## Lecture

- **L'essentiel** : la fiche de tri de l'app (accroche et points), comme en tête de l'onglet Lecture de l'app.
- **Texte complet**, replié par défaut : la page est déjà sous les yeux. Un clic déroule le texte, paragraphes numérotés comme dans l'app ; un autre clic le replie.
- **Discussion** avec le média, le champ en bas du panneau. Une page web citée par une réponse s'affiche en pastille et s'ouvre d'un clic. « Nouvelle conversation » en reprend une vide.
- Pas de résumé dans cet onglet : il est dans le Cahier.

## Cahier

- La grille des quatre formats de l'app (résumé, notes de cours, cartes mémo, quiz). Un clic génère avec les réglages par défaut : pas d'écran « Personnaliser » dans le panneau.
- Une seule liste dessous : la génération en cours (reflet ambré, comme dans l'app), puis les fiches de la plus récente à la plus ancienne. Un échec se relance d'un clic.
- La fiche s'ouvre à la place de la liste, « Cahier » y ramène : résumé et notes se lisent, les cartes mémo suivent la révision de l'app (direction B de `flashcards_ux`), le quiz se joue question par question.
- Personnaliser, renommer et supprimer une fiche restent dans l'app (lien « dans Deepn »). Le jeton de l'extension continue de ne rien pouvoir supprimer.
