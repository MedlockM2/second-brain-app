# Authentification : quatre directions

Ce que voit une personne avant d’avoir une bibliothèque : connexion, inscription, code reçu par e-mail, mot de passe
oublié, liaison avec Google ou Apple (task-529, task-530). `comparatif/` présente le diagnostic de l’existant, les
bonnes pratiques retenues (avec leurs sources), une matrice et le premier écran de chaque direction, sur mobile et sur
web. Chaque `direction_*/` montre ses écrans mobiles, ses écrans web pour ordinateur, un tableau des textes
(actuel → proposé) et ses conséquences (ce qui disparaît, backend, risque, effort).

## Direction retenue : C (2026-10-21), implémentée le 2026-10-23

L’owner a retenu C. `direction_c_finale/` en donne la version finale, implémentée dans l’app et sur le web :
- un carrousel de quatre pages, retenues le 2026-10-23 : « Gardez ce qui compte. Approfondissez. Apprenez. »,
  « Depuis vos apps ou votre téléphone », « Interrogez tout un dossier », « Sur votre téléphone et votre
  ordinateur ». Les cinq autres propositions restent dans la maquette pour mémoire ;
- « Commencer » et « J’ai déjà un compte » ouvrent chacun un écran plein, sans feuille ;
- connexion et inscription : Apple, Google, « ou », puis directement les champs e-mail et mot de passe ;
- inscription : confirmation du mot de passe et badges de critères ;
- pas d’écran « Votre compte est prêt » : après le code, la fenêtre de la langue de lecture s’ouvre directement ;
- les mêmes écrans sur le web, le carrousel à gauche.

## Ce qui coince aujourd’hui

- L’app s’ouvre sur « Bon retour », y compris pour qui n’a jamais eu de compte (`app/index.tsx` → `/(auth)/login`).
- Sur mobile, Apple et Google sont sous le formulaire, donc hors de l’écran sur un petit téléphone, alors que le HIG
  demande qu’on les voie sans défiler. Le web les met au-dessus du formulaire : l’ordre diffère d’une plateforme à l’autre.
- Les verbes diffèrent : « Continuer avec Google », mais « Se connecter avec Apple », y compris à l’inscription.
- Les erreurs s’affichent dans un bandeau en haut du formulaire, et le champ fautif n’est pas marqué.
- La règle du mot de passe (12 caractères, majuscule, minuscule, chiffre) tient en une ligne grise : on découvre ce
  qui manque après l’échec.
- Le code est saisi dans un champ texte ordinaire. Rien ne dit à quelle adresse il est parti, le renvoi n’a pas de
  délai, et le bouton principal a le style d’un libellé.
- Aucune mention des conditions d’utilisation à l’inscription. Pas de logo sur les écrans d’auth mobiles.

## Les quatre directions

| Direction | Parie sur | Ce qui disparaît | Serveur | Effort |
|---|---|---|---|---|
| **A — « Épurée »** `direction_a_epuree/` | la clarté du parcours actuel | bandeaux d’erreur, règles en gris, champ de code nu | rien | S |
| **B — « Une seule porte »** `direction_b_une_seule_porte/` | l’adresse d’abord, Deepn choisit la suite | le choix connexion / inscription, les erreurs « compte existant » et « sans mot de passe » | un appel « moyens de connexion d’une adresse » | M |
| **C — « Vitrine »** `direction_c_vitrine/` | montrer la valeur avant de demander un compte | l’entrée sur un formulaire | rien | M |
| **D — « Sans mot de passe »** `direction_d_sans_mot_de_passe/` | un code par e-mail, puis une clé d’accès | mot de passe, règle, « mot de passe oublié », pré-détournement | Cognito `USER_AUTH` (palier Essentials), SES | L + benchmark |

Les directions se combinent. C est un écran d’accueil qui se place devant A, B ou D. A fournit aux trois autres leur
vocabulaire visuel : cases du code, erreurs sous le champ, boutons sociaux en tête.

## Ce que je retiendrais

- **Tout de suite : A.** Aucun changement serveur, et chaque constat ci-dessus est corrigé.
- **Ensuite : B avec l’accueil de C.** task-530 a déjà accepté de dire qu’une adresse a un compte. B en tire le
  parcours le plus simple, et les cas d’erreur de task-529 et task-530 y deviennent des chemins.
- **Cible : D, après un benchmark** (règle du `CLAUDE.md` : choix de palier et de fournisseur d’e-mail). C’est la
  seule direction qui supprime le mot de passe.

## Deux décisions que les maquettes posent

- **La règle du mot de passe.** A garde la règle actuelle, affichée en liste cochée. B propose celle du NIST
  SP 800-63B-4 : 15 caractères au moins, sans règle de composition. Il faudrait alors modifier `password_policy` dans
  `infrastructure/terraform/modules/platform/cognito.tf`.
- **L’envoi d’e-mails.** Le pool utilise `COGNITO_DEFAULT`. D l’oblige à passer à SES ; A et B en profiteraient aussi
  (codes de vérification et renvois).

## Conventions

Pages générées. Pour régénérer, depuis la racine :

```
python3 mobile-design-mockups/auth_directions/_build/extract_icons.py   # icônes, depuis l'Ionicons.ttf de l'app
node mobile-design-mockups/auth_directions/_build/build.mjs             # code.html
node mobile-design-mockups/auth_directions/_build/build_c_final.mjs     # direction_c_finale/code.html
node --experimental-websocket mobile-design-mockups/auth_directions/_build/shoot.mjs   # screen.png
```

Police système, tokens de `mobile/src/constants/theme.ts` et `web/src/styles.css`, cadres de 414 x 896 (téléphone) et
1200 x 780 (navigateur). Les données sont fictives. « ‹domaine› » remplace le domaine, qui n’est pas encore acquis
(`docs/BRAND_IDENTITY.md`). Les logos d’apps de `direction_c_finale/` sont les tracés Simple Icons (CC0, simple-icons@11), copiés dans `_build/logos.json` ; la liste des apps et des formats suit `SHARE_TARGETS` (`media_summarizer/core/media_ingestion/adapters/share_targets.py`). Les boutons Apple et Google sont dessinés pour la maquette ; l’app garde le bouton Apple
natif et le rendu imposé par la charte Google. Sur téléphone, la web app reprend les écrans mobiles (décision de
l’owner du 2026-10-11).
