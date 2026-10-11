---
id: TASK-424
title: >-
  Benchmark du site web de l'app (avec paiement Stripe) et d'une extension
  navigateur pour enregistrer une page dans le second cerveau
status: To Do
assignee: []
created_date: '2026-10-04 16:22'
updated_date: '2026-10-11 15:06'
labels:
  - benchmark
  - scoping
  - web
dependencies: []
references:
  - docs/research/task-357-legal-pages-hosting/README.md
  - docs/AUTHENTICATION_SETUP.md
  - docs/store-listing/app-store-connect.md
  - media_summarizer/api/endpoints/media.py
  - media_summarizer/api/models/media_contracts.py
  - media_summarizer/api/main.py
  - 'https://docs.recall.it/llms-full.txt'
  - 'https://www.recall.it/web-clipper'
  - 'https://chrome.google.com/webstore/detail/ldbooahljamnocpaahaidnmlgfklbben'
  - 'https://addons.mozilla.org/en-US/firefox/addon/getrecall/'
  - docs/research/task-434-chatbot-integration-ui/README.md
  - docs/research/task-430-chatbot-architecture/README.md
  - docs/BRAND_IDENTITY.md
  - mobile-design-mockups/my_design_system/DESIGN.md
  - mobile/src/constants/theme.ts
  - docs/BENCHMARK_OWNER_WORKFLOW.md
  - >-
    backlog/tasks/task-439 -
    Unifier-sur-GPT-6-Luna-le-modèle-des-artefacts-des-aperçus-et-du-futur-chat.md
priority: medium
type: spike
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Nouvelle passe demandée par l'owner le 2026-10-10

Relancer le benchmark de l'app web Deepn et générer **cinq nouvelles directions de design**, en intégrant le chatbot décidé depuis la passe précédente et en corrigeant la navigation parmi de nombreux dossiers. Les quatre directions précédentes ne répondent pas à ce dernier besoin ; aucune n'est validée. L'app web connectée est déjà décidée : ne pas rouvrir la question « vitrine ou app web ».

Le README principal porte `owner_decision: redo`. Au prochain dispatch, la Phase 0 l'archivera ; travailler ensuite en mode redo, en lisant **tous** les `README.owner-rejected-*.md`, notamment les décisions du 2026-10-05 et du 2026-10-10. Les présentes consignes remplacent les anciennes exigences de quatre propositions et les anciens minima de trois écrans. Les notes des passes antérieures sont un historique, pas la preuve que cette nouvelle passe est terminée.

## Sources et décisions à appliquer

- `docs/research/task-434-chatbot-integration-ui/README.md`, **Owner Validation → Decision** : **direction F**, composeur persistant à portée **média et dossier uniquement**, visible dans **Lecture** d'un média et dans **Sources** d'un dossier. **Aucun chat à portée bibliothèque.** La Recommendation D du benchmark n'est pas la décision et ne doit pas être reprise à sa place. Adapter cette interaction au desktop sans changer ces portées et ces conditions d'affichage.
- `docs/research/task-430-chatbot-architecture/README.md`, **Owner Validation → Decision** : chat multi-tours, historique durable, streaming SSE reprenable, arrêt volontaire et échecs partiels ; les deux portées font partie de la première livraison fonctionnelle. Évaluer les conséquences web sur la session, l'authentification du flux, le CORS des deux façades et la reprise après navigation/rechargement ; ne pas rouvrir l'architecture retenue.
- `task-439` : choix de `gpt-6-luna` Standard pour chat, artefacts et aperçus, sans nouveau benchmark de modèles. Réutiliser ce choix dans les coûts et le découpage.
- `docs/BRAND_IDENTITY.md` : nom définitif **Deepn**. Le nom n'est plus un choix ouvert ; ne pas présumer qu'un domaine est acheté.
- Design system **Amber Clarity**, tokens de `mobile/src/constants/theme.ts` et référence `mobile-design-mockups/my_design_system/DESIGN.md`. Tenir compte des thèmes clair et sombre existants.
- Les conclusions acquises des passes précédentes sur l'extension, Stripe via RevenueCat, la TVA, les stores et task-357 restent des points de départ. Ne réexaminer que ce que le code actuel, le chatbot ou une source officielle actualisée remet en cause, en expliquant pourquoi.

## Exhaustivité fonctionnelle impérative

**L'agent ne doit oublier aucune fonctionnalité existante dans l'app.** Commencer par un inventaire actuel de `mobile/app/`, des composants, hooks, services, menus et contrats API ; ne pas se limiter aux six surfaces et aux anciens comptes de lignes du README. Pour chaque fonction et action, produire une matrice avec sa source dans le dépôt, son équivalent web, son emplacement dans **chacune des cinq directions** et son lot d'implémentation.

L'inventaire couvre notamment : connexion/inscription/onboarding ; ajouts récents et reprise de lecture ; ajout par URL et import de fichiers/images/documents ; revue des non classés et aperçus ; bibliothèque, dossiers/sous-dossiers, création, renommage, déplacement/rangement, suppression et menus contextuels ; lecteur de média et de texte, langue originale et traductions ; consultation, génération et historique des artefacts ; digest quotidien/hebdomadaire ; recherche ; compte, langues, thèmes, abonnement/consommation selon l'état beta, déconnexion, suppression de compte et signalement de problème. Cette liste est un plancher, **pas un substitut à la lecture du code**. Ajouter le chatbot validé, même s'il n'est pas encore implémenté.

Ne pas réintroduire des fonctions supprimées, par exemple les tags. Les interactions natives doivent avoir leur équivalent web lorsqu'il existe ; toute contrainte propre à une plateforme doit être explicitement documentée. Aucun oubli, suppression implicite ou report non identifié sous prétexte de simplifier une maquette. Un découpage de livraison peut être proposé, mais les cinq designs doivent montrer la cible fonctionnelle complète, pas seulement un premier lot en lecture.

## Cinq directions avec cinq approches particulières

Produire exactement **cinq propositions réellement distinctes**, A à E, de l'**app web connectée**. Pour chacune, nommer et expliquer sa thèse UX : organisation de l'information, navigation, densité, manière de retrouver les dossiers, lecture et articulation avec le chat. Les différences portent sur la structure et les parcours, pas sur cinq palettes de couleurs ou cinq variantes d'une landing page. Ne pas décider à l'avance laquelle gagne.

Toutes couvrent le même périmètre fonctionnel. Les fonctions secondaires peuvent apparaître dans des vues, menus ou modales atteignables du prototype, mais leur accès doit être identifiable dans la matrice. La vitrine publique, les pages légales, l'installation de l'extension et l'abonnement restent étudiés ; ils ne remplacent pas les écrans connectés.

## Bibliothèque agréable avec beaucoup de dossiers

C'est un critère discriminant de cette passe, pas une remarque annexe. Chaque direction doit montrer et expliquer son fonctionnement avec un petit espace puis avec un corpus de référence commun d'**au moins 200 dossiers, trois niveaux de profondeur, des noms longs et des homonymes dans des parents différents**.

Illustrer les parcours concrets : retrouver rapidement un dossier peu utilisé ; identifier le dossier actif et son chemin ; naviguer entre dossiers sans perdre sa place ; parcourir une longue liste sans bloquer la lecture ; créer/renommer un dossier ; choisir une destination lors d'un ajout ou d'un déplacement. Montrer les états de recherche/filtrage des dossiers ou l'autre mécanisme retenu, les branches repliées/dépliées, le défilement, les libellés longs et les résultats ambigus. Expliquer aussi comment la proposition tient à 1 000 dossiers.

Une arborescence entièrement dépliée, une grille ou une rangée interminable de dossiers, ou une capture avec cinq dossiers ne démontre pas la réponse au besoin. Chaque direction choisit une approche cohérente et en expose les compromis. Documenter navigation clavier, focus et adaptation responsive. Ne pas simuler la grande bibliothèque seulement en écrivant « 200 dossiers » dans un compteur : les données et interactions du prototype doivent permettre d'examiner les parcours.

## Livrables attendus

1. Nouveau `docs/research/task-424-website-and-browser-extension/README.md`, `owner_decision: pending`, avec inventaire et matrice de couverture, comparaison des cinq approches, analyse spécifique des nombreux dossiers, intégration du chatbot, recommandation argumentée, coûts actualisés et découpage en lots/dépendances. Les fonctionnalités différées dans les lots restent explicitement recensées.
2. Cinq maquettes sous `mobile-design-mockups/web_app/direction_a_<slug>/` à `direction_e_<slug>/`. Chaque répertoire contient un `code.html` autonome sans requête réseau, un `screen.png` de référence desktop à 1440 px et un `screen-mobile.png` à 390 px. Les anciens répertoires de directions devenus obsolètes sont remplacés pour qu'il n'existe qu'un jeu actif de cinq directions ; les READMEs rejetés conservent l'historique.
3. Pour chaque direction, des captures identifiées `screen-library-many-folders.png`, `screen-media-chat.png` et `screen-folder-chat.png`, montrant respectivement la bibliothèque chargée, le chat dans Lecture d'un média et le chat dans Sources d'un dossier. Le prototype rend aussi visibles les autres fonctions recensées : IA/génération et historique, digest, recherche, ajout/rangement et compte. Les captures proviennent du HTML réellement rendu.
4. Comparaison fondée sur des parcours et des références UX sourcées, avec forces/faiblesses, effort et recommandation. Aucune nouvelle sélection de modèle LLM.

**Aucune implémentation applicative, aucun achat, aucune publication.** Le diff de l'agent reste limité au dossier de recherche task-424, aux maquettes `mobile-design-mockups/web_app/` et à sa tâche. Ne pas lancer de tests automatisés de l'app ; rendre et inspecter les maquettes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le nouveau README est produit en mode redo et explique comment il intègre les décisions des rejets successifs, dont celle du 2026-10-10 ; l'app web connectée Deepn est le périmètre acquis et aucun ancien minimum de quatre directions ne borne cette passe.
- [x] #2 Un inventaire actuel des fonctionnalités, actions et états de l'app, fondé sur les routes, composants, hooks, services et API du dépôt, existe avec ses références de code ; la liste indicative de la description n'est pas traitée comme exhaustive.
- [x] #3 Une matrice relie chaque fonctionnalité existante et le chatbot validé à son équivalent web, à un emplacement identifiable dans chacune des cinq maquettes et à un lot d'implémentation ; toute contrainte de plateforme ou fonction différée est explicitement documentée, sans omission implicite ni réintroduction de fonctions supprimées.
- [x] #4 Exactement cinq directions A à E de l'app web connectée sont livrées sous mobile-design-mockups/web_app/, chacune avec une approche UX particulière expliquée ; elles diffèrent par leurs structures et parcours tout en couvrant le même périmètre.
- [x] #5 Dans chacune des cinq directions, le composeur de chat persistant suit la Decision de task-434 : média dans Lecture et dossier dans Sources, aucune portée bibliothèque ni entrée de chat persistante dans les autres onglets ; le prototype montre la conversation et son historique.
- [x] #6 Les maquettes et le README rendent visibles les états d'envoi, de réponse en streaming, d'arrêt, d'échec partiel et de reprise du chat ; l'analyse web suit la Decision de task-430 pour les deux portées, sans réouvrir l'architecture ou le choix gpt-6-luna de task-439.
- [x] #7 Chaque direction possède un jeu de données et des états examinables pour au moins 200 dossiers sur trois niveaux avec noms longs et homonymes ; le README documente aussi le comportement attendu à 1 000 dossiers et compare les compromis des cinq approches.
- [x] #8 Chaque direction illustre la recherche ou le mécanisme de repérage retenu pour les dossiers, le chemin du dossier actif, le retour à la liste sans perte de place et le choix d'une destination lors d'un ajout ou déplacement ; le défilement, les branches et les libellés longs sont traités explicitement.
- [x] #9 Les cinq prototypes donnent un accès identifiable à la bibliothèque, aux pages dossier et média, aux aperçus, au lecteur et aux langues de lecture, à la consultation/génération/historique des artefacts, au digest, à la recherche, aux ajouts et actions de rangement, au compte et aux autres fonctionnalités de l'inventaire ; ils montrent la cible complète même si la livraison est découpée.
- [x] #10 Chaque direction contient code.html autonome sans requête réseau, screen.png rendu desktop à 1440 px, screen-mobile.png à 390 px, screen-library-many-folders.png, screen-media-chat.png et screen-folder-chat.png ; les captures sont issues du rendu inspecté du HTML, conformes à Amber Clarity et au nom Deepn.
- [x] #11 Le README compare les cinq directions sur une grille commune incluant exhaustivité, bibliothèque avec beaucoup de dossiers, lecture/chat, accessibilité clavier, responsive et effort, avec références UX sourcées ; il en recommande une en motivant les compromis.
- [x] #12 Le README actualise les impacts sur stack/hébergement/session/CORS/partage de code, coûts et lots à partir du dépôt courant et du chatbot retenu ; les conclusions déjà acquises sur extension, paiement et task-357 sont reprises ou leurs révisions explicitement justifiées et sourcées.
- [x] #13 Le nouveau README porte owner_decision: pending et distingue clairement la recommandation des décisions déjà actées ; l'implémentation task-425 demeure dépendante de task-424 et les éventuelles dépendances des lots avec le chatbot sont identifiées.
- [x] #14 Aucun fichier hors de docs/research/task-424-website-and-browser-extension/, de mobile-design-mockups/web_app/ et du fichier de task-424 n'est modifié ; les archives de recherche existantes sont préservées et un seul jeu actif de cinq directions est présenté.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Mode redo — deuxième passage, en attente de validation de l'owner

Le dossier `docs/research/task-424-website-and-browser-extension/` ne contenait plus de `README.md` actif mais un `README.owner-rejected-2026-10-05.md` : **mode redo**. Ce fichier a été lu intégralement et son champ `Decision` fait autorité sur le périmètre de cette passe. Il est **conservé tel quel**.

**Ce que l'owner avait rejeté, et comment cette passe l'intègre**

| Retour de l'owner | Ce que cette passe fait |
|---|---|
| « L'app web est le périmètre, pas une option à chiffrer puis à écarter » ; la recommandation « vitrine statique » est refusée, et avec elle le report de l'app web à un lot conditionné aux retours de beta | L'app web est traitée comme **décidée**. La question posée est *comment* : §2 (périmètre connecté, surface par surface), §3 (stack), §5 (hébergement), §6 (session), §7 (ordre de livraison). Aucun lot n'est conditionné à une donnée de beta. |
| Le périmètre connecté doit porter ce que porte le mobile : ajouts récents ; bibliothèque (liste, dossiers, fiche média, transcript, artefacts IA) ; onglet digest ; recherche ; réglages du compte, abonnement compris | §2 liste les six surfaces, les met en face des 26 écrans et composants mobiles qui les portent, et chiffre leurs 14 564 lignes. §8 les répartit sur quatre lots. |
| Ne pas reprendre « le besoin exprimé est l'extension, pas la lecture sur ordinateur » | Cet argument n'apparaît nulle part. §0 le cite comme l'un des deux arguments explicitement abandonnés. |
| Ne pas reprendre « les maquettes montraient une app web » ; les 4 `website_direction_*/` ont été supprimés | Ils ne sont pas recréés. Les quatre nouvelles maquettes vivent sous `mobile-design-mockups/web_app/` et montrent des **écrans connectés**, pas des pages d'accueil. |
| Maquettes dans un sous-dossier commun, desktop comme rendu de référence | `mobile-design-mockups/web_app/direction_{a,b,c,d}_*/`, trois cadres à **1440 × 900** (bibliothèque, fiche média, digest) + un cadre responsive secondaire à 390 × 844. Rien à la racine de `mobile-design-mockups/`. |
| Reprendre sans réinstruire : extension, les cinq constats du §0 rejeté, webhook RevenueCat, Stripe via RevenueCat, TVA, règles des stores | §0 dresse le tableau des 13 conclusions reprises avec renvoi à la section du fichier rejeté. §10.1 et §11 les rappellent. Ces recherches n'ont pas été refaites. |
| Réétudier : stack du site, hébergement, authentification complète dans le navigateur, CORS, découpage en lots, coût sur douze mois | §3, §5, §6, §1.1, §8, §9. |
| Trancher, chiffres à l'appui : parité complète dès le premier lot, ou lecture d'abord, et ce que coûte le rattrapage | §7, avec deux méthodes d'estimation indépendantes et le coût du rattrapage. |
| Reposer la question du partage de code avec `mobile/` | §4, qui **renverse** la conclusion de la passe 1 sur mesure. |

**Livrables**

- `docs/research/task-424-website-and-browser-extension/README.md` — front-matter `owner_decision: pending`, section `Owner Validation` vide, 15 sections, ~108 ko.
- Quatre maquettes de l'**app web**, chacune avec un `code.html` autonome (aucune requête réseau : ni `<link>`, ni `<script>`, ni `<img>`, ni URL absolue — vérifié sur les fichiers produits) et un `screen.png` rendu à 1520 px de large :
  - `mobile-design-mockups/web_app/direction_a_classeur_trois_volets/` — trois volets permanents
  - `mobile-design-mockups/web_app/direction_b_table_de_lecture/` — grille de couvertures, lecture plein cadre, artefacts en marge
  - `mobile-design-mockups/web_app/direction_c_tableau_de_bord/` — barre latérale de 4 destinations, bibliothèque en tableau triable
  - `mobile-design-mockups/web_app/direction_d_plein_ecran/` — aucune chrome permanente, palette de commandes
  Tokens repris verbatim de `mobile/src/constants/theme.ts`, icônes reprises des contours Ionicons des maquettes task-408 / task-410, un seul glyphe (la loupe) composé depuis la définition SVG d'Ionicons et signalé comme tel.

**Recommandation soumise à l'owner** (détail et sources dans le README)

App web **React, pure SPA** (Vite 8 + React 19 + React Router 8, `ssr: false`), sur **une origine à elle** (`app.<domaine>`), le site public restant **Astro** sur `www.<domaine>` ; **React Native Web rejeté** ; **partage de 14 455 lignes** de `mobile/src/{types,lib,services,i18n,constants}` par un alias de build, sans `packages/` au premier lot ; session de navigateur par **cookie `HttpOnly` de rafraîchissement + access token en mémoire**, avec plafond absolu et expiration par inactivité ; **Cloudflare Workers static assets**, deux projets ; **lecture d'abord en quatre lots**, parité comme destination déclarée ; extension reprise telle quelle, à un point près (l'appairage peut désormais être délivré par l'app web, ce qui sort un écran mobile du chemin critique) ; paiement inchangé ; proposition de design **A, « Le classeur »**.

**Trois constats du dépôt que la passe 1 avait manqués, et qui changent le chiffrage**

1. **Le CORS de l'API déployée n'est pas celui du code Python.** `lambda_api.tf:131-146` déclare un `cors_configuration` sur la HTTP API, et AWS documente que « API Gateway ignores CORS headers returned from your backend integration ». Le `CORSMiddleware` de FastAPI est donc inerte en production, et `allow_credentials = false` rend une session par cookie **impossible** tant qu'on ne l'a pas changé. La passe 1 ne visait que `CORS_ORIGINS`.
2. **Le refresh token glissant d'un an sans plafond est interdit à un client navigateur.** « OAuth 2.0 for Browser-Based Applications » est devenu la **RFC 10017 / BCP 212** en août 2026, et son §6.3.2.3 exige qu'un serveur « MUST NOT, upon issuing a rotated refresh token, extend the lifetime of the new refresh token beyond the lifetime of the initial refresh token ». Le dépôt fait l'inverse. La correction est **par type de lignée**, le modèle portant déjà un `lineage_id`.
3. **Une app web en lecture ne demande aucun endpoint nouveau.** Les dix-huit routes de lecture que l'app mobile appelle couvrent les six surfaces, curseur de pagination compris, et `/api/v1/entitlements` porte déjà `is_beta_access`. Le lot de fondations se réduit à la session et au CORS.

**Réalignement des critères d'acceptation**

Les AC #1, #8 et #11 étaient devenus inexacts : écrits avant la décision de l'owner, ils demandaient de recommander « un site vitrine ou une app web » et plaçaient les maquettes dans `mobile-design-mockups/website_direction_*`. Le retour de l'owner prime, donc ils ont été réécrits :

- **#1** demande maintenant que le README **parte** du fait que l'app web est décidée et dise comment la faire, et qu'il tranche entre parité et lecture d'abord en chiffrant les deux ;
- **#8** demande 4 propositions sous `mobile-design-mockups/web_app/direction_<lettre>_<slug>/`, couvrant les **écrans connectés** (bibliothèque, fiche média, digest), avec le desktop comme rendu de référence ;
- **#11** borne le périmètre modifiable à `docs/research/task-424-*/`, `mobile-design-mockups/web_app/` et ce fichier de tâche.

La **description** de la tâche n'a pas été réécrite : sa dimension 1 (« un site vitrine […] ou une app web ») et ses conventions de maquettes au point 11 sont périmées par le retour de l'owner, et le README le dit en §0. Elle est laissée telle quelle parce que la description est le texte de l'owner.

Les onze AC sont cochés. Quatre d'entre eux — **#2, #3, #5, #6** — et une partie de **#7** sont satisfaits par les conclusions **reprises** du `README.owner-rejected-2026-10-05.md`, que l'owner a demandé de ne pas réinstruire ; §0 du nouveau README donne le tableau de correspondance avec la section d'origine de chaque conclusion.

**Ce qui n'a pas pu être vérifié** est listé en §13 du README (12 points), dont : les chiffrages de §7 ne reposent sur aucune donnée de vélocité du dépôt ; le passage d'un `Set-Cookie` à travers API Gateway sur une réponse lue par un `fetch` cross-origin avec `credentials: 'include'` n'a pas été exercé et ne l'est qu'après déploiement ; le comportement de `starlette` 0.47.2 est lu dans la source verrouillée, sans exécution ; le montant du frais d'inscription au Chrome Web Store n'est toujours pas publié par Google ; le rendu des maquettes n'a été vérifié que dans Chrome.

**La recommandation attend la validation de l'owner.** La tâche reste en `To Do` ; `owner_decision` vaut `pending`. C'est l'owner qui bascule le champ à `ok`, `abandoned`, `redo` ou `more`.

**Périmètre touché** : ce fichier de tâche (AC et notes), le `README.md` de recherche, et les quatre répertoires `mobile-design-mockups/web_app/direction_*`. Aucun fichier de code applicatif, de configuration ou d'infrastructure n'est modifié — les numéros de ligne cités dans le README sont des lectures.

2026-10-10 — Nouvelle passe demandée par l'owner : cinq nouvelles directions, parité fonctionnelle inventoriée, chatbot selon les Decisions de task-434/task-430 et UX de bibliothèque démontrée sur de nombreux dossiers. Le README actif est remis en redo ; la Phase 0 du prochain dispatch doit l'archiver avant la nouvelle recherche. Les critères de cette passe sont remis à zéro. Les notes ci-dessus décrivent uniquement les livrables antérieurs, qui ne satisfont pas les nouvelles exigences.

2026-10-10 — **Troisième passe produite, mode redo.** Le README `redo` du jour a été archivé en `README.owner-rejected-2026-10-10.md` (Phase 0) ; les deux rejets (2026-10-05, 2026-10-10) ont été relus et leur prise en compte est tracée en §0 du nouveau README.

- **AC #1, #13** : nouveau `README.md` en `owner_decision: pending` ; tableau « acté / repris / recommandé » en tête ; task-425 reste dépendante de task-424 ; dépendances du lot WC avec task-431 et task-439 en §10.4.
- **AC #2, #3** : inventaire F1–F74 depuis les routes, composants, hooks, services et API (§1), matrice fonctionnalité → web → A..E → lot (§2). Trois écarts nommés : notifications push (différées), share sheet (remplacée par l'extension, le dépôt et le collage), barre repliée (sans objet sur bureau). Tags non réintroduits, et retirés du lot X2 de l'extension.
- **AC #4, #9, #10** : cinq directions sous `mobile-design-mockups/web_app/` : A arbre latéral, B colonnes, C barre de saut, D flux à facettes, E onglets de travail. Chacune a `code.html` autonome, `screen.png` 1440, `screen-mobile.png` 390, `screen-library-many-folders.png`, `screen-media-chat.png`, `screen-folder-chat.png`. Les quatre anciens répertoires sont supprimés. Sources, build et captures dans `docs/research/task-424-website-and-browser-extension/mockup-build/`. Les captures passent par le protocole DevTools : Chrome ne descend pas sous 500 px de large avec `--window-size`.
- **AC #5, #6** : composeur uniquement dans Lecture (média) et Sources (dossier), historique, états envoi / flux / arrêt / échec partiel / reprise / refus / minutes adressables par `#cs=` (§6). Conséquences web : CORS de la façade REST `STREAM`, flux par `fetch` (pas `EventSource`), reprise par `/refresh`, un seul onglet attaché.
- **AC #7, #8** : corpus déterministe de 295 dossiers (15/83/197, homonymes ×20, noms jusqu'à 91 caractères), variantes à 7 et 1 018 ; six parcours rejoués par direction (§5).
- **AC #11, #12** : grille pondérée sourcée (§7) ; recommandation **A + palette ⌘K de C**, repli C (§8). Stack, session, hébergement, extension et paiement repris ; ajouts : CORS du flux, auth sociale web à vérifier, lot WC ; total 42 à 63 j (§9–§11).
- **AC #14** : seuls `docs/research/task-424-*/`, `mobile-design-mockups/web_app/` et ce fichier sont modifiés.

**La recommandation attend la validation de l'owner.** La tâche reste `To Do`. Rien n'est commité : l'arbre de travail principal portait déjà des modifications non commitées d'autres tâches.

2026-10-11 — Mode **complement**. Livrable : `docs/research/task-424-website-and-browser-extension/complement-response-2026-10-11.md`, qui répond à `complement-request-2026-10-11.md`. Le README principal n'a pas été modifié.

Les onze consignes sont traitées dans l'ordre.

- Les 22 tâches du découpage (W-01 à W-14, X-01 à X-04, B-01/B-01i, B-02/B-02i) remplacent le chiffrage en jours du §10.2. Elles sont listées avec leur périmètre, leurs dépendances et des AC satisfaisables, mais pas créées.
- task-445 devient un prérequis du développement.
- Le CORS de la façade de flux a été vérifié sur dev : le pré-vol `OPTIONS` répond 403 `MissingAuthenticationToken` et le `GET` n'a pas d'en-tête `Access-Control-*`. Le CORS manque, c'est devenu la tâche W-04.
- L'appairage de l'extension se fait en un clic par `externally_connectable`, avec un jeton de lignée `browser_extension` à portée limitée et révocable, et un code en secours.
- Les frais du Chrome Web Store sont corrigés à 5 $ une fois.
- L'hébergement passe tout sur AWS : Route 53, S3 + CloudFront, et le domaine personnalisé d'API Gateway.
- La règle d'identité du texte extrait est écrite pour l'étude reportée.
- Le périmètre V1 de l'extension est celui des apps (`ingest-url`, `ingest-shared-content` avec `source_url`), publié sur Chrome et Edge avec le même paquet.
- Trois points déduits sont listés au §3.6 pour validation.

**La recommandation attend la validation de l'owner** (`owner_decision: pending`).
<!-- SECTION:NOTES:END -->
