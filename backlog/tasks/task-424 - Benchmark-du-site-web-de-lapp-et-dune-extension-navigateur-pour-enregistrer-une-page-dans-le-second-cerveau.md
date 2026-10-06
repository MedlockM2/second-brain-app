---
id: TASK-424
title: >-
  Benchmark du site web de l'app (avec paiement Stripe) et d'une extension
  navigateur pour enregistrer une page dans le second cerveau
status: To Do
assignee: []
created_date: '2026-10-04 16:22'
updated_date: '2026-10-06 17:19'
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
priority: medium
type: spike
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Le besoin

L'app n'existe aujourd'hui que sur mobile, et on y enregistre un contenu par la feuille de partage (`expo-share-intent`). Sur ordinateur, il n'y a aucun moyen d'envoyer une page vers son second cerveau. Il faut deux choses :

1. **un site web de l'app** ;
2. **une extension navigateur** qui enregistre la page courante en un clic, sans quitter l'onglet.

La forme exacte n'est pas évidente (périmètre du site, navigateurs, authentification de l'extension, ce qu'on capture). Ce benchmark la définit avant toute implémentation.

## La référence : l'extension de Recall

Recall (getrecall.ai, devenu recall.it, à ne pas confondre avec recall.ai qui est une API de bots de réunion) fait exactement cela. D'après sa documentation publique, relue le 2026-10-04 :

- **Navigateurs** : Chrome, Firefox, Edge, et Safari sur Mac. Un même compte synchronise l'extension, l'app web et le mobile.
- **Enregistrement** : l'icône épinglée dans la barre d'outils ouvre un panneau qui propose « save the full content », « summarize and chat » ou « save to the Recall Notebook ». Raccourcis `Alt+S` (enregistrer la page) et `Alt+R` (ouvrir ou fermer le panneau), modifiables dans `chrome://extensions/shortcuts`.
- **Contenus** : YouTube, posts X et Reddit, PDF, Google Docs et Slides, articles, podcasts, TikTok, Instagram, recettes, Wikipédia.
- **Dans la page** : un résumé immédiat, un chat sur la page ou sur toute la bibliothèque, et un mode « Augmented Browsing », en bêta, qui surligne sur la page les mots-clés reliés aux contenus déjà enregistrés. Ce mode tourne en local, avec un modèle embarqué dans le navigateur et non un LLM, et peut être désactivé par site ou partout.
- **Confidentialité affichée** : rien n'est envoyé au serveur tant que l'utilisateur n'enregistre pas explicitement.

Cette liste sert d'inspiration, pas de cahier des charges : le benchmark dit ce qu'on garde pour une première version et ce qu'on écarte.

## Ce que le dépôt impose déjà

- **Aucun client web n'existe.** Le flux OAuth web (`GET /api/auth/google/callback`, `/apple/callback`) **n'émet aucun token de session**. Les sessions s'ouvrent par `POST /api/auth/google/native`, `/apple/native` ou `/login`, et le refresh token voyage dans le corps JSON, sans cookie (`docs/AUTHENTICATION_SETUP.md`, task-293). L'extension a donc besoin d'un chemin d'authentification qui n'existe pas encore.
- **L'ingestion par URL existe** : `POST /api/media/ingest-url` accepte `url`, `source_app`, `locale`, `idempotency_key` et `folder_id`. Un texte sélectionné peut passer par `POST /api/media/ingest-shared-content` (`share_type: text`, qui devient une note). Une page derrière une connexion ou un paywall n'est pas récupérable par le serveur avec la seule URL.
- **CORS** : `CORS_ORIGINS` vaut `*` par défaut (`media_summarizer/api/main.py:87`). Il faut vérifier ce que demande une origine `chrome-extension://…` ou `moz-extension://…`.
- **La facturation passe uniquement par RevenueCat.** L'ancien code Stripe a été supprimé (task-98). Le webhook ne reconnaît que les stores `APP_STORE`, `MAC_APP_STORE` et `PLAY_STORE` (`_get_platform`, `media_summarizer/api/endpoints/revenucat_webhook.py:183`), et `SubscriptionPlatform` ne connaît que `ios` et `android` (`media_summarizer/core/models/billing.py:26`). Un abonnement payé sur le web n'est aujourd'hui reconnu nulle part. Il ne faut pas ressusciter l'ancien code Stripe : on part de l'architecture actuelle.
- **Domaine et pages légales** : le projet ne possède aucun domaine. **task-357** a déjà étudié leur hébergement et recommande un `.com` acheté, servi par Cloudflare Pages, en attente de décision de l'owner. Le site doit se construire **sur ce choix, sans refaire ce benchmark**. Le domaine dépend du nom marketing, qui n'est pas encore choisi (**task-186**).

## Dimensions à couvrir

1. **Périmètre du site** : un site vitrine (présentation, liens vers les stores, page d'installation de l'extension, support, `/privacy` et `/terms` de task-357) ou une app web (bibliothèque consultable dans le navigateur). Dans les deux cas, le site porte le **paiement Stripe** (dimension 10), donc une connexion au compte et une page d'abonnement. Chiffrer l'écart d'effort, recommander, et laisser l'owner trancher.
2. **Stack et hébergement du site**, dans la continuité de la recommandation de task-357.
3. **Framework d'extension** : WXT, Plasmo, CRXJS ou Manifest V3 sans framework. Critères : un seul code pour Chrome, Edge et Firefox, maintenance par un développeur seul, partage de code TypeScript avec `mobile/`.
4. **Navigateurs cibles et publication** : Chrome Web Store (qui couvre aussi Edge et Brave, ou faut-il Edge Add-ons ?), Firefox Add-ons, Safari (Safari Web Extension, qui demande un projet Xcode et un compte Apple Developer : peut-on la livrer avec l'app iOS ou macOS existante ?). Pour chacun : coût, délai d'examen, et règles d'examen qui nous concernent (justification des permissions `activeTab` contre `<all_urls>`, politique de confidentialité exigée, règles « Limited Use » sur les données).
5. **Authentification de l'extension et du site** (le site en a besoin pour le paiement ; dire si une même solution sert aux deux), au moins trois options comparées : `chrome.identity.launchWebAuthFlow` avec Google et Apple, email et mot de passe, appairage depuis l'app mobile (QR code ou code à saisir), session ouverte sur le site web. Pour chacune : changements backend, compatibilité Firefox et Safari, stockage du refresh token (`chrome.storage.local` et ses risques), révocation par appareil (`lineage_id`).
6. **Ce qu'on capture** : l'URL seule (endpoint existant), le texte ou le HTML de la page (nouveau contrat backend, seule façon de couvrir les pages derrière connexion ou paywall), la sélection (vers une note), le PDF ouvert dans le navigateur. Dire ce que la première version retient.
7. **UX** : bouton de barre d'outils, raccourci clavier, menu contextuel, popup de confirmation avec choix du dossier et des tags (comme la modale de partage mobile, task-206), suivi de l'état du traitement. Pour chaque fonction de Recall citée plus haut, la garder ou l'écarter, en le justifiant.
8. **Impact backend et produit** : valeur de `source_app`, CORS, quotas. Un enregistrement depuis l'extension compte dans le même quota que sur mobile, et l'abonnement ne s'achète pas dans l'extension : comment l'extension renvoie vers la page de paiement du site ou vers l'app.
9. **Coût sur douze mois et charge de maintenance** pour un développeur seul, frais Stripe compris.
10. **Paiement Stripe sur le site** :
    - **Intégration** : Stripe en direct (Checkout, Customer Portal, webhooks vers notre backend) ou Stripe branché sur RevenueCat (intégration Stripe de RevenueCat, ou RevenueCat Web Billing qui s'appuie sur Stripe). Critère principal : une seule source de vérité pour les droits, pour qu'un abonné web soit reconnu dans l'app mobile et inversement. Dire ce que chaque option change dans le webhook, dans `SubscriptionPlatform` et dans `docs/REVENUECAT_ENTITLEMENTS.md`.
    - **Catalogue** : correspondance avec les tiers `S`, `M` et `L` et les durées existantes, cohérence des prix avec les stores.
    - **Règles des stores** : ce que l'app mobile a le droit de dire ou de lier vers un paiement web (App Store guidelines 3.1.1 et 3.1.3, liens externes autorisés aux États-Unis et dans l'UE, règles Google Play), avec des sources datées. Et le cas d'un utilisateur abonné sur deux canaux à la fois.
    - **TVA et facturation** : Stripe Tax ou équivalent pour un vendeur solo dans l'UE, factures, remboursements, résiliation. Comparer, au moins pour le coût et la charge administrative, avec un marchand officiel (Paddle, Lemon Squeezy).
11. **4 propositions de design du site**, réellement différentes (structure de page, ton, place donnée à l'extension par rapport aux apps mobiles, présentation des offres), et non quatre variantes de couleur d'une même page.
    - **Design system** : *Amber Clarity*, le même que l'app. Les tokens font autorité dans `mobile/src/constants/theme.ts`, la référence visuelle est `mobile-design-mockups/my_design_system/DESIGN.md`. Il s'adapte au web, il ne se réinvente pas.
    - **Convention des maquettes** : un répertoire par proposition, `mobile-design-mockups/website_direction_a_<slug>/` à `website_direction_d_<slug>/`, contenant un `code.html` autonome et un `screen.png` (voir `digest_direction_a_sommaire` à `digest_direction_d_fiche_unique`, task-408).
    - **Pages couvertes par chaque proposition**, au minimum : l'accueil (promesse, captures de l'app, liens vers les stores), l'installation de l'extension, et la page d'abonnement qui mène au paiement Stripe, avec les tiers `S`, `M` et `L`.
    - **Tailles** : chaque proposition est rendue à 1440 px (ordinateur, là où l'extension s'installe) et à 390 px (mobile).
    - Le README compare les 4 et en recommande une.

## Livrable

- `docs/research/task-XXX-<description-courte>/README.md`, avec le front-matter `owner_decision: pending`, les tableaux comparatifs, une recommandation argumentée et un périmètre de première version découpé en lots.
- Les 4 maquettes du site sous `mobile-design-mockups/website_direction_*/`.

**Aucune implémentation** : pas de code applicatif, aucun achat, aucune publication.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le README part du fait que l'app web est décidée et dit **comment** la faire : périmètre fonctionnel connecté, stack, hébergement, session de navigateur, CORS, partage de code avec mobile/ ; il tranche entre parité complète dès le premier lot et un sous-ensemble en lecture d'abord, en chiffrant les deux ; et il reprend la recommandation d'hébergement de task-357 au lieu de la refaire
- [x] #2 Au moins trois frameworks d'extension sont comparés sur une grille commune (Chrome/Edge/Firefox avec un seul code, maintenance, partage de code avec mobile/)
- [x] #3 Chaque navigateur cible a son coût de publication, son délai d'examen et les règles d'examen applicables, avec des sources datées ; le cas Safari est traité explicitement
- [x] #4 Au moins trois options d'authentification sont comparées, chacune avec les changements backend qu'elle demande, en partant du constat que le flux OAuth web actuel n'émet aucun token
- [x] #5 Le périmètre de capture de la première version (URL, contenu de page, sélection, PDF) est défini, avec les changements de contrat d'API qu'il demande
- [x] #6 Chaque fonction de l'extension Recall listée dans la description est gardée ou écartée pour la première version, avec sa justification
- [x] #7 Le paiement Stripe sur le site est traité : Stripe en direct comparé à Stripe via RevenueCat, avec les changements du webhook et du modèle de facturation que chaque option demande, et ce que l'app mobile a le droit de dire d'un paiement web, sources datées à l'appui
- [x] #8 4 propositions de design de l'app web, distinctes, chacune dans son propre répertoire mobile-design-mockups/web_app/direction_<lettre>_<slug>/ (code.html autonome + screen.png), couvrant au minimum les écrans connectés bibliothèque, fiche média et digest, conformes au design system Amber Clarity, avec le desktop comme rendu de référence et un rendu responsive secondaire
- [x] #9 Le README compare les 4 propositions de design et en recommande une
- [x] #10 Le README porte owner_decision: pending et propose un découpage de l'implémentation en lots
- [x] #11 Aucun fichier hors de docs/research/task-424-*/, de mobile-design-mockups/web_app/ et de ce fichier de tâche n'est modifié
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
<!-- SECTION:NOTES:END -->

