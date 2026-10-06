---
owner_decision: redo   # pending | ok | abandoned | redo | more
---

# Benchmark : site web de l'app (avec paiement Stripe) et extension navigateur « enregistrer cette page »

## Owner Validation

**Decision**:

**Rejeté sur la dimension 1. L'app web est le périmètre, pas une option à chiffrer puis à écarter.** La recommandation « Option V — vitrine statique » est refusée, et avec elle le report de l'app web à un « lot 5 » conditionné à des retours de beta. Je n'ai pas besoin d'une donnée de beta pour savoir que je veux consulter mon second cerveau dans un navigateur : **c'est décidé**. Ce que le prochain passage doit étudier, ce n'est plus *si* on fait une app web, mais *comment* on la fait.

Trois corrections à intégrer :

**1. Le périmètre fonctionnel de l'app web, une fois l'utilisateur connecté.** Elle doit porter ce que porte l'app mobile :

- les ajouts récents ;
- la bibliothèque : liste, dossiers, fiche média, lecteur de transcript, artefacts IA ;
- l'onglet digest (quotidien et hebdomadaire) ;
- la recherche ;
- les réglages du compte, abonnement compris.

La page vitrine, les pages légales et la page d'installation de l'extension restent nécessaires — ce sont des obligations de store (task-357) — mais elles ne sont plus le livrable principal : elles deviennent la partie publique d'un site dont la partie connectée est l'app web.

**2. Deux arguments du README à ne pas reprendre.**

- « Le besoin exprimé est l'extension, pas la lecture sur ordinateur » (§1.3) : le besoin de lecture sur ordinateur est maintenant exprimé, ici, par écrit.
- « La direction D des maquettes montre ce qu'on achèterait. L'owner peut voir à quoi ressemble l'app web avant de décider de la payer » (§1.3) : **c'est inexact, et c'est ce qui a rendu la recommandation indéfendable.** La direction D ne montre pas une app web. Comme les trois autres, c'est une vitrine de trois pages — accueil, extension, abonnement — dont le hero encastre une *vignette de démonstration* de la bibliothèque dans une page marketing. Aucune surface connectée n'est dessinée : pas de bibliothèque navigable, pas d'onglet digest, pas de fiche média, pas de réglages. La seule page connectée maquettée est `/abonnement`. **Les quatre répertoires `mobile-design-mockups/website_direction_*/` ont été supprimés** : ils ne servent pas le périmètre retenu, et les laisser ferait travailler l'implémentation sur une base fausse.

**3. Les maquettes du prochain passage.**

- Elles doivent couvrir les **écrans connectés**, pas quatre variantes de page d'accueil. Une direction de design se juge sur la bibliothèque, la fiche média et le digest — c'est là que l'utilisateur passera son temps.
- **Elles vont toutes dans un sous-dossier commun `mobile-design-mockups/web_app/`**, une direction par sous-dossier (`mobile-design-mockups/web_app/direction_a_<nom>/`, etc.). La passe précédente a posé ses quatre `website_direction_*/` **à la racine de `mobile-design-mockups/`**, donc au même niveau d'arborescence que toutes les maquettes mobiles du projet, qui sont déjà une vingtaine. C'est illisible et ça ne passe pas à l'échelle. Le reste des conventions de `mobile-design-mockups/my_design_system/DESIGN.md` ne change pas : design system *Amber Clarity*, tokens de `mobile/src/constants/theme.ts`, `code.html` autonome sans requête réseau + `screen.png`.
- Le rendu de référence est **desktop**. Un rendu responsive secondaire est bienvenu, mais une app web se juge d'abord sur grand écran : c'est sa raison d'être.

**Ce qui reste acquis du README rejeté.** Tout ce qui ne dépend pas de la dimension 1 a été jugé solide et n'est pas à refaire : l'extension (WXT, Chrome Web Store d'abord, appairage depuis le mobile, capture URL + texte + sélection), les cinq affirmations corrigées en §0, l'analyse du webhook RevenueCat, le paiement Stripe branché sur RevenueCat et jamais en direct, la TVA, les règles des stores. **Reprendre ces conclusions, ne pas réinstruire ces questions.** Ce qui doit être réétudié à la lumière de l'app web : la stack du site (une app web connectée n'est plus six pages statiques — Astro reste-t-il le bon choix ?), l'hébergement, l'authentification (une session complète dans le navigateur, avec rafraîchissement, déconnexion et multi-onglets, là où le README ne prévoyait une session que sur la page d'abonnement), le CORS, le découpage en lots, et le coût sur douze mois.

**La question ouverte que le prochain passage doit trancher, chiffres à l'appui :** parité complète avec le mobile dès le premier lot, ou un sous-ensemble en lecture d'abord — et dans ce cas lequel, et ce que coûte le rattrapage ensuite. Recommander, en chiffrant les deux. La question du partage de code avec `mobile/` se repose aussi : §3.4 concluait « rien d'utile n'est partageable » pour une extension, ce qui n'est pas la même question pour une app web qui réaffiche les mêmes artefacts.

**Validated at**: 2026-10-05

---

## Recommendation

**Un site vitrine statique, une extension WXT publiée d'abord sur le seul Chrome Web Store, une authentification par appairage depuis l'app mobile, une capture qui prend l'URL *et* le texte de la page, et un paiement Stripe branché sur RevenueCat — pas en direct — livré en dernier. Proposition de design retenue : la direction B, « Le bureau ».**

En une ligne par dimension :

| Dimension | Décision recommandée | Le fait qui tranche |
|---|---|---|
| **Périmètre du site** | **Vitrine** statique, 6 pages (`/`, `/extension`, `/abonnement`, `/privacy`, `/terms`, `/support`). Pas d'app web. | L'app web suppose de réécrire dans le navigateur la liste, la fiche média, les artefacts, la recherche et les dossiers — un second client à maintenir pour toujours. Chiffrage §1 : **3 à 5 jours** contre **4 à 6 semaines**. |
| **Hébergement** | Celui de **task-357** (domaine `.com` acheté, zone Cloudflare), avec **une mise à jour** : pour un projet neuf, Cloudflare écrit « Start new projects with Workers » — donc Workers Static Assets, pas Pages. Même fournisseur, même coût, même DNS. | §2. Ce n'est pas un nouveau benchmark d'hébergement : le choix de fournisseur de task-357 est repris tel quel. |
| **Framework d'extension** | **WXT** | Le `main` de Plasmo n'a pas reçu un commit depuis le **2025-05-17**, et sa dernière version npm date du même jour — 17 mois sans release pour une plateforme (MV3, Chrome 154, règles de store) qui bouge tous les trimestres. WXT : version 0.21.4 le 2026-08-11, commits le 2026-10-04. §3. |
| **Navigateurs, lot 1** | **Chrome Web Store seulement**. Edge et Brave installent la même fiche. | Microsoft documente « Extensions designed for Google Chrome can also be used in Microsoft Edge » derrière un réglage « Allow extensions from other stores ». Firefox demande en plus un paquet de sources et des instructions de build reproductible à chaque version ; Safari demande un projet Xcode. §4. |
| **Authentification** | **Appairage depuis l'app mobile** (code à six chiffres). | C'est la seule des quatre options qui fonctionne à l'identique sur Chrome, Firefox **et Safari** : l'API `identity` n'existe pas dans Safari (`version_added: false` dans les données de compatibilité MDN) ni sur Firefox Android. Et elle réutilise `lineage_id`, qui porte déjà la révocation par appareil. §5. |
| **Ce qu'on capture** | L'**URL** + le **texte de la page** + la **sélection**. Le **PDF** attend le lot 2. | Un serveur à qui on donne une URL voit ce qu'un visiteur anonyme voit. La doc de Recall le dit elle-même : « Paywall content requires the browser extension to access ». Sans le texte, l'extension n'apporte rien que `ingest-url` ne fasse déjà. §6. |
| **Paiement** | **Stripe Billing branché sur RevenueCat**, jamais en direct. | Le backend résout le palier depuis les **identifiants d'entitlement**, pas depuis le store ni le produit (`ENTITLEMENT_TIER_MAP`). Un achat Stripe rattaché à `tier_mix` ressort en palier `M` **sans toucher à la résolution de palier**. Et RevenueCat ne facture rien de plus pour le web : « there are no additional RevenueCat fees to support subscriptions and purchases on the web ». §10. |
| **Design** | **Direction B**, avec deux emprunts : les trois étapes de A sur l'accueil, et le *Callout Aside* de C pour les autorisations. | Les badges de store de la direction A pointeraient aujourd'hui vers le vide : rien n'est publié sur aucun store, et le nom marketing n'est pas tranché (task-186). B met en avant la seule chose immédiatement installable. §11. |

### Les quatre lots, et pourquoi dans cet ordre

| Lot | Contenu | Dépend de | Ordre de grandeur |
|---|---|---|---|
| **1** | Site vitrine (6 pages, direction B) + extension Chrome : clic, `Alt+S`, menu contextuel, URL + texte + sélection, appairage depuis l'app. Deux champs optionnels ajoutés à `IngestUrlRequest`, deux endpoints d'appairage. | task-357 (domaine) et task-186 (nom) pour **publier**, pas pour développer | 8 à 12 jours |
| **2** | Firefox Add-ons + Edge Add-ons, capture du PDF ouvert, choix du dossier et des tags dans la popup, suivi de l'état du traitement | lot 1 | 5 à 8 jours |
| **3** | Paiement : Stripe connecté à RevenueCat, page `/abonnement` connectée, `SubscriptionPlatform.web`, Stripe Tax | lot 1 **et la fin de la beta de task-429** | 5 à 8 jours |
| **4** | Extension Safari, embarquée dans l'app iOS/macOS existante | lot 1, Xcode | 4 à 6 jours, optionnel |

**Le lot 3 arrive en dernier parce que task-429 le rend sans objet pendant trois mois** : pendant la beta, tout compte reçoit le palier le plus élevé et **toutes les entrées vers l'abonnement sont masquées**. Construire une page de paiement que personne ne doit voir, et dont la TVA, le catalogue Stripe et les webhooks demandent une configuration par l'owner, est le candidat évident au report. Les deux premiers lots, eux, servent dès le premier testeur sur ordinateur.

### Ce que ce benchmark recommande de **ne pas** faire

1. **Ne pas ressusciter le flux OAuth web** pour authentifier l'extension. `GET /api/auth/google/callback` n'émet aucun token depuis task-293 ; le remettre en service pour l'extension, c'est rouvrir un chemin de session (cookie, `FRONTEND_URL`, CSRF) dont l'extension n'a pas besoin, alors que l'app mobile tient déjà une session vérifiée qui peut en déléguer une.
2. **Ne pas écrire de webhook Stripe à nous.** Ce serait une seconde autorité d'entitlements à côté de RevenueCat — exactement ce que task-98 a supprimé.
3. **Ne pas demander `<all_urls>`.** `activeTab` suffit au périmètre du lot 1, et c'est la permission que Chrome cite comme ralentissant la review (« dangerous permission requests », « broad host permissions »).
4. **Ne pas partager de code avec `mobile/` dans le lot 1.** Rien d'utile n'est partageable : `mobile/` est du React Native. Les 3 ou 4 types réellement communs (`IngestUrlRequest`, les codes d'erreur de quota) se recopient en vingt lignes ; un espace de travail `packages/` partagé est une tâche en soi, pas un effet de bord de celle-ci. §3.4.
5. **Ne pas mettre un lien vers le paiement web dans l'app.** Sur la boutique française, la règle d'Apple est explicite et Google l'est autant. §10.4.

---

## 0. Cinq affirmations à corriger avant de lire la suite

Ces cinq points changent la portée du problème. Aucun fichier de code n'est modifié par ce benchmark.

### 0.1 L'extension de Recall n'est **pas** disponible sur Safari

La description de la tâche l'affirme, en s'appuyant sur la page marketing. Les deux sources de Recall se contredisent, relues le **2026-10-05** :

| Source | Ce qu'elle dit |
|---|---|
| `https://www.recall.it/web-clipper` | « an AI extension for Chrome, Firefox, Edge, and Safari », avec un téléchargement Mac à glisser dans Applications |
| `https://docs.recall.it/llms-full.txt` | « **Browser Extension:** [Chrome](…), [Firefox](…), *Safari coming soon* » |

Conséquence pour nous : **personne dans cette catégorie n'a de preuve qu'une extension Safari soit un prérequis**. La seule référence citée par la tâche ne l'a pas encore livrée. Cela conforte le report du Safari au lot 4.

### 0.2 Le CORS n'est pas un problème pour l'extension, et c'en est un pour le site

La tâche demande « vérifier ce que demande une origine `chrome-extension://…` ». La réponse est : **rien**, à condition d'appeler l'API depuis le service worker et non depuis le script de contenu. Chrome le documente :

> « Extension origins aren't so limited — a script executing in an extension service worker or a foreground tab can talk to remote servers […] as long as the extension requests host permissions. »
> « Content scripts initiate requests on behalf of the web origin that the content script has been injected into […] **Cross-origin requests are always treated as such in content scripts, even if the extension has host permissions.** »
> — <https://developer.chrome.com/docs/extensions/develop/concepts/network-requests> (lu le 2026-10-05)

Donc : **tout appel à l'API part du background**, le script de contenu ne fait qu'extraire du texte et le passer en message. Aucune entrée `CORS_ORIGINS` n'est nécessaire pour l'extension, sur aucun des trois navigateurs (Firefox et Safari ont le même modèle de permissions d'hôte).

Le **site**, lui, est une origine de navigateur ordinaire et relève bien du CORS. État actuel : `CORS_ORIGINS` vaut `*` par défaut et `allow_credentials=True` (`media_summarizer/api/main.py:87-93`). Avec un `Authorization: Bearer`, qui n'est pas une requête « credentialed » au sens CORS, un `Access-Control-Allow-Origin: *` suffit et `allow_headers=["*"]` couvre le préflight — **le site fonctionnerait tel quel**. Ce n'est pas une raison de le laisser : une fois le site en ligne, `CORS_ORIGINS` doit valoir l'origine du site, parce que `*` signifie que n'importe quelle page du web peut appeler l'API avec un token volé. C'est une ligne de Terraform, à faire dans le lot 1.

### 0.3 Le webhook RevenueCat **accepte déjà** un achat web, et écrit une ligne correcte

La tâche dit qu'« un abonnement payé sur le web n'est aujourd'hui reconnu nulle part ». C'est faux dans le détail, et le détail est ce qui chiffre le lot 3. Lecture de `media_summarizer/api/endpoints/revenucat_webhook.py` :

- RevenueCat envoie `store: "STRIPE"` (ou `"RC_BILLING"`) — valeurs documentées, §10.2.
- `_get_platform` (ligne 183) renvoie `None` pour ces valeurs.
- `_carries_product` (ligne 283) compare `row.platform == subject.platform`, et le commentaire de la fonction dit exactement ce qui se passe : « a store `_get_platform` maps to nothing matches the rows written from that same store (both sides `None`) ».
- `_record_store_identity` (ligne 376) : « A store that maps to no platform leaves the row's platform alone rather than blanking it. »
- Et surtout, `_resolve_tier` (ligne 143) lit le palier depuis `ENTITLEMENT_TIER_MAP`, c'est-à-dire **depuis les identifiants d'entitlement**, pas depuis le store ni le produit.

Donc un `INITIAL_PURCHASE` venu de Stripe, rattaché à l'entitlement `tier_mix`, crée aujourd'hui une ligne `Subscription` de palier `M`, avec `platform=None`, et le quota en tient compte. **Le travail du lot 3 côté webhook est additif et cosmétique** : ajouter `web` à `SubscriptionPlatform` (`media_summarizer/core/models/billing.py:26`) et le mapper, pour que l'app puisse écrire « géré sur le web » au lieu de ne rien écrire.

### 0.4 L'abonné sur deux canaux est déjà géré, et ce n'est pas un bug de données

`_active_subscription` (`media_summarizer/core/services/quota_enforcer.py:408`) choisit, parmi les lignes qui entitlent encore, « the one **whose tier carries the larger allowance in the pricing config** », puis `max_minutes_per_item`, puis la période qui finit le plus tard, puis l'id. Un utilisateur abonné à la fois sur l'App Store et sur le web reçoit donc, de façon déterministe et sans une ligne de code nouvelle, l'allocation la plus généreuse des deux.

Ce qui reste à traiter n'est pas technique : c'est que **l'utilisateur paie deux fois**. La réponse est du texte, pas du code — les trois pages d'abonnement des maquettes la portent (« Si vous êtes déjà abonné depuis l'App Store ou Google Play, ne payez pas une seconde fois »), et §10.5 dit ce que le site doit afficher quand il détecte une ligne d'un autre store.

### 0.5 Cloudflare dit maintenant de ne plus démarrer un projet sur Pages

task-357 recommande « Cloudflare Pages ». La page produit de Cloudflare, lue le **2026-10-05**, porte un encart :

> « Are you sure you want to use Pages? […] Workers supports most Pages use cases and offers a broader feature set. […] It is Cloudflare's primary platform for building applications. **Start new projects with Workers.** »
> — <https://developers.cloudflare.com/pages/>

Pages n'est pas annoncé en fin de vie et reste « Available on all plans ». Mais pour un projet **neuf**, et c'est le cas ici, la recommandation de l'éditeur est Workers avec des *static assets*. Ça ne change **rien** à la décision de task-357 — même fournisseur, même zone DNS, même coût (0 $), mêmes pages `/privacy` et `/terms` servies depuis le dépôt. Ça change le nom du produit Cloudflare à cocher. Si l'owner valide ce README, la tâche d'implémentation doit lire « Cloudflare Workers static assets » là où task-357 écrit « Cloudflare Pages ».

---

## 1. Périmètre du site : vitrine ou app web — AC#1

### 1.1 Les trois travaux que le site doit faire, par ordre de nécessité

Avant de comparer, il faut dire à quoi le site sert. Trois choses, dont **aucune** n'exige une app web :

1. **Porter les URL que les stores exigent.** `/privacy` et `/terms` (task-357), l'URL de support (métadonnée Apple obligatoire), l'URL marketing, et `/.well-known/apple-developer-domain-association.txt` pour la vérification de domaine Sign in with Apple. task-357 a déjà tranché que ces pages vivent sur un site statique servi depuis le dépôt.
2. **Être la page d'installation de l'extension.** Un bouton, une explication des autorisations, et la procédure d'appairage.
3. **Porter le paiement Stripe.** Une page d'abonnement, une session de compte, un retour de paiement. C'est la seule partie connectée.

### 1.2 Les deux options, chiffrées

| | **Option V — vitrine statique** | **Option W — app web** |
|---|---|---|
| Pages | `/`, `/extension`, `/abonnement`, `/privacy`, `/terms`, `/support` | les six, plus la bibliothèque : liste, fiche média, artefacts, recherche, dossiers, compte |
| Authentification nécessaire | une session minimale, **sur la seule page d'abonnement**, et seulement au lot 3 | une session complète, avec rafraîchissement, déconnexion, multi-onglets, dès le lot 1 |
| Appels API | aucun au lot 1 ; au lot 3, la création de la session de paiement | tout `GET /api/media`, `GET /api/media/{id}`, artefacts, recherche, dossiers, quotas |
| Ce qu'il faut réécrire | rien | ce que `mobile/` fait déjà : rendu des artefacts, lecteur de transcript, recherche, arbre de dossiers, états de traitement, i18n sur 11 locales |
| Dette permanente | aucune | **deux clients à faire évoluer ensemble**. Chaque tâche produit touchant l'UI en coûte deux |
| Effort initial | **3 à 5 jours** (6 pages statiques, un design system déjà écrit, un hébergement déjà tranché) | **4 à 6 semaines**, et c'est l'estimation optimiste : elle suppose qu'on ne reprend aucune fonction d'IA ni d'édition |
| Hébergement | statique, 0 $ | statique + un chemin authentifié ; reste faisable en statique + appels API, mais la surface de bug change d'ordre |

### 1.3 Pourquoi la vitrine, et à quelle condition changer d'avis

**Recommandation : Option V.** Trois raisons, dans l'ordre de force :

1. **Le besoin exprimé est l'extension, pas la lecture sur ordinateur.** La description de la tâche dit : « Sur ordinateur, il n'y a aucun moyen d'envoyer une page vers son second cerveau. » L'extension règle ça entièrement. Lire sur grand écran est un besoin différent, réel, mais non formulé et non mesuré.
2. **Un second client est une dette qui ne se rembourse pas.** Il n'y a pas d'utilisateur à migrer ni de contrat à honorer : rien n'est publié. Donc rien n'oblige à ouvrir ce front maintenant, et tout invite à attendre d'avoir une demande.
3. **La direction D des maquettes montre ce qu'on achèterait.** Elle est fournie exprès (`website_direction_d_poste_de_travail/`) : l'owner peut voir à quoi ressemble l'app web avant de décider de la payer.

**La condition qui ferait changer d'avis** : si les retours de beta montrent que les testeurs *lisent* sur ordinateur plutôt qu'ils n'*enregistrent* — par exemple en demandant un export ou un affichage web des transcripts. Dans ce cas, l'app web devient un lot 5, et la direction D est la maquette de référence. Elle ne doit pas être décidée avant d'avoir cette donnée.

---

## 2. Stack et hébergement du site — AC#1

**On ne refait pas le benchmark de task-357.** Son choix recommandé — domaine `.com` acheté, zone chez Cloudflare, pages statiques servies depuis le dépôt, adresse de contact par Cloudflare Email Routing, ~11 $ sur douze mois — est repris intégralement. Trois précisions s'y ajoutent, et une seule correction (§0.5).

### 2.1 Le générateur de site

| Option | Pour | Contre | Verdict |
|---|---|---|---|
| **Astro** (7.3.5, publié le 2026-09-24, MIT) | Rend du HTML statique par défaut, aucune hydratation à écrire ; le contenu de `/privacy` et `/terms` est du Markdown **déjà présent au dépôt** (`docs/compliance/*.md`) et se rend par une collection de contenu ; les composants sont du HTML + CSS, donc les maquettes de ce benchmark se transposent presque telles quelles | Une dépendance de plus à suivre | **Recommandé** |
| HTML + CSS à la main | Zéro dépendance | Il faut recopier les textes légaux à la main, ou écrire soi-même le rendu du Markdown ; l'en-tête et le pied de page sont dupliqués six fois | Acceptable si l'owner préfère zéro build, mais le Markdown légal est le point qui fait pencher vers Astro |
| Next.js, SvelteKit, Nuxt | Rien de plus ici | Un serveur, un runtime, un cache à comprendre pour six pages statiques | Rejeté |

Le point décisif n'est pas la vitesse de rendu : c'est que **le texte légal reste la version du dépôt**. task-357 insiste là-dessus (« où vit le texte »), et un générateur capable de lire les `.md` existants est la façon de ne pas créer une seconde version.

### 2.2 Ce que le site sert en plus des pages

- `/.well-known/apple-developer-domain-association.txt` — fichier statique, à poser à la racine publique.
- Les deux pages légales, rendues depuis `docs/compliance/privacy-policy.md` et `terms-of-service.md`.
- **Rien d'autre.** Pas de blog, pas de sitemap de contenu, pas de mesure d'audience dans le lot 1 : une mesure d'audience ajoute un bandeau de consentement et une mention dans la politique de confidentialité, pour une donnée que personne n'exploitera avant la publication.

### 2.3 Où le build vit

Le site est un dossier du dépôt (`website/`, nom à fixer par l'implémentation), déployé par le connecteur de dépôt de Cloudflare. Aucun artefact ne passe par la CI mobile ni par le paquet Lambda. Le dépôt étant public, **aucune clé Stripe ni aucun secret ne peut vivre dans ce dossier** : la clé publiable Stripe est publiable par construction, la clé secrète reste côté API (Secrets Manager), et la page `/abonnement` appelle notre API, jamais Stripe directement avec un secret.

---

## 3. Framework d'extension — AC#2

### 3.1 Grille commune

Chiffres relevés le **2026-10-05** sur le registre npm (`registry.npmjs.org`) et sur l'API publique de <https://api.github.com>.

| Critère | **WXT** | **Plasmo** | **CRXJS** | **MV3 nu + Vite** |
|---|---|---|---|---|
| Dernière version npm | **0.21.4, 2026-08-11** | 0.90.5, **2025-05-17** | 3.0.0, 2026-09-24 | — |
| Dernier commit sur la branche par défaut | **2026-10-04** | **2025-05-17** | 2026-09-24 | — |
| Étoiles / tickets ouverts | 10 570 / 203 | 13 161 / 371 | 4 177 / 19 | — |
| Téléchargements npm, 30 jours | 2 659 868 | 2 625 405 | 1 663 635 | — |
| Licence | MIT | MIT | MIT | — |
| **Un seul code pour Chrome + Edge + Firefox** | **Oui**, documenté : « will build extensions for Chrome, Firefox, Edge, Safari, and any Chromium based browser » et « Build Manifest V2 or V3 extensions for any browser using the same codebase » | Oui sur le papier (cibles de build), mais figé depuis 17 mois | Partiel : greffon Vite centré Chrome ; le multi-navigateur est à la charge du projet | Non : un `manifest.json` à écrire et à maintenir par navigateur |
| Manifeste | Généré depuis les fichiers d'entrée | Généré | Écrit à la main, transformé | Écrit à la main |
| Boucle de dev | HMR sur l'UI, rechargement des scripts de contenu et du background | HMR | HMR | Rebuild + rechargement manuel |
| Publication | `wxt zip` et `wxt submit` (« Automatically zip, upload, submit, and publish extensions ») | CLI de publication | Aucune | Aucune |
| Paquet de sources pour Firefox | `wxt zip` produit aussi une archive de sources, ce que Mozilla exige (§4.3) | Non documenté | Non | À faire à la main |
| Maintenance par un développeur seul | **Le meilleur** : la couche qui absorbe les divergences de navigateur est maintenue par quelqu'un d'autre, et l'est encore | **Le pire** : à la première rupture de Chrome, c'est nous qui corrigeons le framework | Moyen : peu de surface, mais peu d'aide | Mauvais : tout est à nous, pour toujours |
| Partage de code TS avec `mobile/` | Identique dans les quatre cas (§3.4) | idem | idem | idem |

### 3.2 Le fait qui tranche : Plasmo est à l'arrêt

Plasmo est le plus étoilé des trois et le plus cité. Il est aussi **sans release depuis le 2025-05-17**, et son dernier commit sur `main` date du même jour. Entre cette date et aujourd'hui, Chrome est passé en version 154, et les points de rupture d'une extension sont précisément ceux qui bougent : le cycle de vie du service worker MV3, les règles de review sur les permissions, l'arrivée des déclarations de données côté Mozilla (Firefox 140+, §4.3).

Le compteur de téléchargements npm (2,6 millions sur trente jours, quasi à égalité avec WXT) ne mesure pas la santé du projet : il mesure l'inertie des projets existants et de leurs CI. Pour un **développeur seul**, le critère n'est pas la popularité, c'est « qui corrige la rupture du trimestre prochain ». Aujourd'hui, pour Plasmo, la réponse est « personne ».

### 3.3 Pourquoi pas CRXJS, et pourquoi pas rien

**CRXJS** est vivant (3.0.0 le 2026-09-24) et sain (19 tickets ouverts), mais c'est un greffon Vite pour Chrome : la génération d'un manifeste Firefox, la différence service worker / page d'événement, et la soumission aux boutiques restent à écrire. Il serait le bon choix pour une extension Chrome-seulement et définitivement Chrome-seulement, ce qui n'est pas notre trajectoire (lot 2 Firefox, lot 4 Safari).

**MV3 nu** se défend sur un argument : zéro dépendance, zéro surprise de build, et une extension qui envoie trois champs à une API n'a pas besoin de HMR. Il est rejeté sur un autre, plus fort : c'est le seul où l'écart Chrome/Firefox devient notre code. Mozilla documente la divergence : « MV3 removes support for persistent background pages » et « Chromium has adopted service workers instead », là où Firefox et Safari utilisent des pages d'événements ; Firefox garde `page_action` quand Chromium et Safari fusionnent tout dans `action`. Chacune de ces lignes est un `if` dans un script de build qu'on écrirait soi-même.

### 3.4 Partage de code avec `mobile/` : la réponse honnête est « presque rien »

La tâche en fait un critère de choix. Il ne discrimine aucun des quatre candidats, parce que ce qui limite le partage n'est pas le bundler, c'est la nature de `mobile/` :

| Ce qui existe dans `mobile/` | Partageable avec l'extension ? |
|---|---|
| Composants, écrans, navigation | **Non.** React Native + Expo Router : `View`, `StyleSheet`, `expo-*` ne tournent pas dans une page web |
| `src/services/*` (clients API) | **Non en l'état** : ils dépendent de `expo-secure-store`, de `Platform`, et du contexte d'auth |
| `src/constants/theme.ts` | **Oui**, mais c'est un objet TS de valeurs ; le copier en variables CSS est ce que font déjà les maquettes, et le lot 1 n'a pas besoin de plus |
| Les types de contrat (`IngestUrlRequest`, formes de réponse) | **Oui**, et c'est tout ce qui compte vraiment : trois interfaces |
| Les codes d'erreur de quota et la façon de les formuler | **Oui en théorie.** Mais les catalogues i18n de l'app sont 11 fichiers JSON pensés pour `i18next` côté natif ; l'extension du lot 1 a besoin de deux phrases |

**Recommandation : rien n'est extrait dans le lot 1.** On recopie les trois interfaces. Un espace de travail partagé (`packages/contracts`) est une bonne idée et une tâche à part : il touche `mobile/package.json`, le build EAS, `tsconfig`, et la CI mobile — c'est-à-dire le chemin le plus fragile du dépôt, pour économiser vingt lignes aujourd'hui. À rouvrir quand il y aura un troisième consommateur.

---

## 4. Navigateurs cibles et publication — AC#3

### 4.1 Tableau des quatre boutiques

Tout relevé le **2026-10-05**.

| | **Chrome Web Store** | **Microsoft Edge Add-ons** | **Firefox Add-ons (AMO)** | **Safari** |
|---|---|---|---|---|
| Coût | « you must register as a CWS developer and **pay a one-time registration fee** » — le montant n'est **pas publié** sur la page d'inscription (§13, point 1) | **0 $** : « There is no registration fee for submitting extensions to the Microsoft Edge program » (page mise à jour le 2025-12-12, révisée le 2026-09-02) | Aucun frais documenté ; il faut « a developer account on addons.mozilla.org » | **99 $/an** d'Apple Developer Program — **déjà payé** : l'app est en TestFlight depuis le 2026-09-02 |
| Délai d'examen | « For most extensions, review is completed within a few days, but it can take up to a few weeks » ; au-delà de « more than three weeks », contacter le support | Non documenté sur la page d'inscription | **Publication immédiate** : « Listed add-ons go live immediately », puis « your add-on may be subject to further review » | Review App Store classique de l'app conteneur |
| Ce qui ralentit | « new developers », « new extensions », « dangerous permission requests », « significant code changes » ; `<all_urls>`, `https://*/*`, `*://*/*` cités comme « broad host permissions » ; « Obfuscation is disallowed », minification tolérée mais pénalisante | — | Le paquet de sources (voir 4.3) ; un ticket de correction qui embarque des changements non liés « can lead to further delays or rejections » | L'app conteneur entière repasse en review |
| Politique de confidentialité | **Obligatoire dès qu'on manipule des données utilisateur**, « even when data is processed or stored locally » ; `Limited Use` s'applique | Politique propre, non auditée ici (§13) | Exigée dans la fiche « if data leaves the user's device » | Politique de l'app, déjà en place |
| Nous concerne-t-il au lot 1 ? | **Oui** | Non : la fiche Chrome suffit (4.2) | Non : lot 2 | Non : lot 4 |

### 4.2 Edge et Brave : la fiche Chrome suffit, et c'est mesurable

Microsoft le documente : « Extensions designed for Google Chrome can also be used in Microsoft Edge », derrière un réglage **« Allow extensions from other stores »** que l'utilisateur accepte une fois.

C'est une friction réelle — une boîte de dialogue de plus — mais elle est à comparer à son alternative : un second compte (Partner Center, avec un type de compte Individuel ou Société **non modifiable après l'inscription**), une seconde fiche à traduire, une seconde soumission à chaque version. Pour un développeur seul et une extension qui n'a pas encore un seul utilisateur, **publier sur Edge Add-ons au lot 2 et non au lot 1** est la bonne allocation. Brave et Vivaldi installent depuis le Chrome Web Store sans réglage.

### 4.3 Firefox : gratuit, immédiat, et plus coûteux qu'il n'y paraît

Trois faits, dont deux pèsent contre le lot 1 :

1. **La publication est immédiate**, ce qui est un avantage net sur Chrome : « Listed add-ons go live immediately », la review vient ensuite et peut arriver « at any time ».
2. **Un paquet de sources est obligatoire** pour tout code empaqueté, ce qu'un build WXT est par définition : « Mozilla needs to review a copy of the source code before any of these steps have been applied », avec « instructions on how to reproduce the build », les dépendances dans l'archive ou récupérées « only through the respective official package managers during the build process ». Un outil de build « abandoned by its maintainers » n'est pas accepté — autre point contre Plasmo (§3.2). C'est un livrable **par version**, pas une fois.
3. **La déclaration des données a changé de forme** et il faut choisir la bonne : à partir de **Firefox 140**, on déclare ses pratiques dans le manifeste, « including when it does not collect data », selon la taxonomie de Mozilla ; pour Firefox 139 et avant, il faut un écran de consentement dans l'extension, affiché à l'installation, qui doit « be unmissable », tenir « on a single page », et qui est **rejeté s'il prend la forme d'une popup**. Une « implicit consent » existe pour les actions à but unique déclenchées par l'utilisateur — ce qui décrit exactement « je clique pour enregistrer cette page » — mais « reviewers retain authority to demand explicit consent ».

Autrement dit : Firefox est gratuit mais demande un artefact de plus à chaque livraison et une décision de conformité à prendre. Il est au lot 2, pas parce qu'il est difficile, mais parce qu'il double le travail de soumission avant qu'un seul utilisateur ait installé quoi que ce soit.

### 4.4 Safari : traité explicitement, et reporté

La question posée par la tâche — « peut-on la livrer avec l'app iOS ou macOS existante ? » — a une réponse documentée : **oui**.

> « You implement a Safari web extension as a macOS, visionOS, or iOS app extension […] You can distribute a Safari web extension with a Mac app, a visionOS app, an iOS app, or a Mac app created using Mac Catalyst. »
> « To distribute your web extension, first join the Apple Developer Program. »
> — <https://developer.apple.com/documentation/safariservices/safari-web-extensions> et `…/distributing-your-safari-web-extension`

L'outillage existe aussi : `xcrun safari-web-extension-packager /path/to/extension` (anciennement `safari-web-extension-converter`) crée un projet Xcode avec une app macOS ou iOS qui installe l'extension, avec les options `--rebuild-project`, `--ios-only`, `--macos-only`, `--bundle-identifier`. Le compte Apple Developer est **déjà payé**.

Et pourtant : **lot 4**. Quatre obstacles, dont un seul suffirait :

1. **L'API `identity` n'existe pas dans Safari.** Apple le liste tel quel : « `identity` — Not supported. Initiate an OAuth flow in a new tab. » Confirmé par les données de compatibilité MDN : `webextensions.api.identity`, `safari: {"version_added": false}` (et `firefox_android: false`). C'est la raison la plus forte de choisir l'appairage plutôt que `launchWebAuthFlow` (§5), et c'est la raison pour laquelle le choix d'authentification doit être fait **maintenant**, pas au lot 4.
2. **Il faut ajouter une cible d'extension au projet iOS**, qui est géré par Expo (prebuild). L'app a déjà une share extension, et `task-186` documente comment un simple nom de cible mal choisi a tué un build EAS en `XCODE_BUILD_ERROR` le 2026-09-04. Ajouter une seconde cible native dans ce projet est un travail à part entière.
3. **Chaque mise à jour de l'extension devient une version de l'app** et repasse en review App Store. Pour une extension dont on veut itérer la capture de texte, c'est le pire cycle des quatre.
4. **Les permissions sont demandées site par site** : « the user clicks the toolbar button and selects an option to grant permission for a single use, for the day, or for all websites », et `storage.sync` n'est pas synchronisé, `storage.local` est plafonné à 5 Mo. L'UX d'appairage et d'enregistrement doit être retestée entièrement.

**Un point à noter pour le lot 4** : Apple propose aussi « Universal Purchase » pour vendre les versions macOS et iOS comme un seul produit, et la packaging web existe aussi « as a web-based tool available in App Store Connect » — donc sans Mac pour l'étape d'empaquetage. Ces deux pistes n'ont pas été creusées ici.

---

## 5. Authentification de l'extension et du site — AC#4

### 5.1 Le point de départ, lu dans le dépôt

- Les sessions s'ouvrent par `POST /api/auth/google/native`, `POST /api/auth/apple/native`, `POST /api/auth/register` ou `POST /api/auth/login`. Tous rendent `access_token` + `refresh_token` **dans le corps JSON**.
- `GET /api/auth/google/callback` et `/apple/callback` existent, mais « **N'émet aucun token de session** : il n'y a plus de client web pour en recevoir » (`docs/AUTHENTICATION_SETUP.md`, task-293). Le seul cookie encore posé est `oauth_state_<provider>`, une garde CSRF de 10 minutes.
- Le refresh token est opaque, stocké en base, **glissant sur un an sans plafond absolu**, rotaté à chaque `/refresh` avec une fenêtre de rejeu de 60 s, et porte un `lineage_id` généré au login : « c'est l'identité de la session d'un appareil […] et c'est ce que /logout révoque ».
- Il n'existe **aucun** endpoint d'appairage d'appareil, et **aucun** endpoint pour poser un mot de passe sur un compte créé par Google ou Apple.

### 5.2 Les quatre options, sur la même grille

| | **A. `identity.launchWebAuthFlow`** | **B. Email + mot de passe** | **C. Appairage depuis l'app mobile** | **D. Session ouverte sur le site, transmise à l'extension** |
|---|---|---|---|---|
| Ce que l'utilisateur fait | Clique « Se connecter avec Google », une fenêtre du navigateur s'ouvre | Saisit son email et son mot de passe dans la popup | Lit un code à six chiffres dans la popup, le saisit dans l'app (Compte → Relier un navigateur) | Se connecte sur le site, revient dans l'extension |
| **Changements backend** | **Importants.** Un endpoint qui termine l'échange de code pour une redirection `chrome-extension://…` et rend un couple de tokens ; un client OAuth Google de plus ; côté Apple, **impossible en direct** : Apple n'accepte que des `return URL` en `https`, donc il faut en plus une page de rebond sur notre domaine | **Aucun.** `POST /api/auth/login` existe tel quel | **Modérés et bornés.** Deux endpoints : `POST /api/auth/device-pairing` (authentifié, appelé par l'app, rend un code court + expiration) et `POST /api/auth/device-pairing/claim` (non authentifié, échange le code contre un couple de tokens avec son propre `lineage_id`). Une table ou un item DynamoDB à TTL court | **Les plus importants.** Il faut que le callback web émette enfin une session (ce que task-293 a retiré), plus un canal de transmission : cookie lisible, `externally_connectable`, ou `postMessage` |
| Chrome / Edge | Oui (`identity` depuis Chrome 29) | Oui | Oui | Oui |
| **Firefox** | Oui sur le bureau (depuis Firefox 53) ; **non sur Firefox Android** (`version_added: false`) | Oui | **Oui** | Oui |
| **Safari** | **Non.** « `identity` — Not supported. Initiate an OAuth flow in a new tab. » | Oui | **Oui** | Oui |
| Couverture des comptes existants | Les comptes Google oui, les comptes Apple non sans page de rebond, les comptes locaux non | **Seulement les comptes locaux.** Un compte créé par Google ou Apple **n'a pas de mot de passe**, et il n'existe aucun endpoint pour en poser un | **Tous**, sans distinction de fournisseur | Tous |
| Stockage du token | `chrome.storage.local` | idem | idem | idem |
| Révocation par appareil | Oui via `lineage_id` | Oui | **Oui, et c'est déjà le modèle** : chaque navigateur relié est une lignée, `/logout` n'en révoque qu'une | Oui |
| Risque de review | Moyen : un flux OAuth dans une extension est banal | **Élevé.** Un formulaire de mot de passe dans une popup d'extension est la forme même de l'hameçonnage ; c'est aussi ce qui invite l'utilisateur à taper son mot de passe Google dans une fenêtre d'extension | Faible : aucune saisie de secret dans l'extension | Faible |
| Verdict | Rejeté : exclut Safari **et** les comptes Apple | Rejeté : laisse dehors la majorité des comptes | **Recommandé** | Reporté au lot 3, où le site en a besoin de toute façon |

### 5.3 Pourquoi l'appairage gagne, et ce qu'il coûte exactement

Les trois arguments, par ordre de force :

1. **C'est la seule option qui marche sur les quatre navigateurs cibles**, Safari compris, sans variante par plateforme. Toutes les autres demandent au moins un chemin différent pour Safari, ou une page de rebond, ou les deux.
2. **Elle ne demande aucun fournisseur d'identité de plus.** Pas de client OAuth à créer, pas de `redirect_uri` à enregistrer chez Google (ce qui, dans ce projet, est déjà un sujet à soi : `docs/AUTHENTICATION_SETUP.md` documente deux clients Android, deux SHA-1 et un module natif pour y arriver). L'app mobile tient une session vérifiée ; elle la délègue.
3. **Elle épouse le modèle de session existant.** Une lignée par appareil, une révocation par lignée, un refresh glissant : l'extension devient un appareil de plus, ni plus ni moins, et l'écran « Appareils reliés » des maquettes B et D est la conséquence directe.

**Ce qu'elle coûte**, précisément :

- Deux endpoints et un item à TTL (code à six chiffres, cinq minutes, usage unique, lié à l'`user_id`). Côté modèle, c'est la même famille que `auth_tokens`, qui a déjà un TTL (`expire_at`).
- **Un écran de plus dans l'app mobile** (Compte → Relier un navigateur), donc une tâche mobile dans le lot 1 — à ne pas oublier dans le chiffrage.
- Une contrainte de sécurité à écrire : le code est court, donc il doit être à usage unique, à durée courte, et son endpoint de réclamation doit être limité en débit. L'API est derrière API Gateway, dont le throttling est déjà le mécanisme de limitation du projet (`media_summarizer/api/main.py`), mais un code à six chiffres valide cinq minutes se brute-force en quelques milliers d'essais : **le compteur d'essais doit être porté par le code lui-même** (3 échecs et il est détruit), pas seulement par le throttling global. C'est une ligne d'AC pour la tâche d'implémentation.

### 5.4 Le stockage du token, dit franchement

Il n'existe **pas** d'équivalent de `expo-secure-store` dans une extension. Ce que Chrome documente :

- `storage.local` est écrit sur disque, survit à l'effacement du cache (« Even if the user clears the cache and browsing history, the data persists »), et **aucune garantie de chiffrement n'est donnée** nulle part sur la page de l'API.
- `storage.session` est en mémoire : « Items in the `session` storage area are stored in-memory and will not be persisted to disk », et n'est pas exposé aux scripts de contenu par défaut.
- Les deux autres zones sont accessibles aux scripts de contenu par défaut, `setAccessLevel()` permet de le restreindre.
- Safari plafonne `storage.local` à 5 Mo et ne synchronise pas `storage.sync`.

Conséquence, et c'est un compromis accepté plutôt qu'un problème résolu :

| Donnée | Où | Pourquoi |
|---|---|---|
| Refresh token (porteur d'un an) | `storage.local`, avec `setAccessLevel` excluant les scripts de contenu | Il n'y a pas d'alternative chiffrée dans la plateforme. Quelqu'un qui a accès au profil du navigateur a de toute façon accès aux cookies de session de tous les sites de l'utilisateur |
| Access token (60 min) | `storage.session` | Mémoire seulement, invisible des scripts de contenu |
| Dernier dossier choisi, préférences | `storage.local` | Sans enjeu |

**Ce qui réduirait vraiment le risque, et qu'on ne scope pas** : une durée de refresh plus courte pour les lignées d'extension. Le backend n'a aujourd'hui qu'une durée globale (`REFRESH_TOKEN_EXPIRE_DAYS=365`, glissante, sans plafond). Porter une expiration par lignée est une tâche backend à part, à ouvrir si l'owner la juge nécessaire — pas un effet de bord de celle-ci.

### 5.5 Et le site ? Une seule primitive pour deux consommateurs

Le site a besoin d'une session **uniquement sur la page d'abonnement**, et **uniquement au lot 3**. Deux façons :

- **Rouvrir le flux OAuth web** (option D) : le callback émet enfin des tokens, le site les garde, et on retrouve toutes les questions que task-293 avait fermées — cookie ou `localStorage`, CSRF, `FRONTEND_URL`, rotation côté navigateur.
- **Réutiliser l'appairage** : l'app mobile ouvre la page de paiement avec un code à usage unique en paramètre, la page l'échange contre une session courte, et le paiement se fait. C'est **la même primitive que l'extension**, avec une durée de vie différente.

**Recommandation : la seconde**, et donc rien de nouveau à construire côté auth au lot 3. Elle a une limite franche : un utilisateur qui arrive sur le site **sans** passer par l'app ne peut pas payer. Pendant la beta (task-429) et le premier temps après la publication, c'est acceptable — le site n'est pas un canal d'acquisition, il est la page d'installation de l'extension et le porteur des pages légales. Le jour où il doit vendre à un visiteur qui n'a pas l'app, l'option D devient nécessaire : c'est un lot 5, à ouvrir avec cette raison-là.

---

## 6. Ce qu'on capture, et les changements de contrat — AC#5

### 6.1 Les quatre cas, et ce que chacun demande

| Cas | Chemin recommandé | Changement de contrat | Dans le lot 1 ? |
|---|---|---|---|
| **L'URL seule** | `POST /api/media/ingest-url` avec `source_app: "browser-extension"` | **Aucun.** Le contrat accepte déjà `url`, `source_app`, `locale`, `idempotency_key`, `folder_id`, `transcript_language` | **Oui** |
| **Le texte de la page** | Le **même** endpoint, avec deux champs optionnels nouveaux | **Deux champs optionnels** sur `IngestUrlRequest` : `extracted_text: Optional[str]` et `extracted_title: Optional[str]`. Quand `extracted_text` est présent, le worker d'article l'utilise comme corps au lieu d'aller chercher l'URL | **Oui** |
| **La sélection** | `POST /api/media/ingest-shared-content` avec `share_type: "text"`, `source_platform: "web"`, `text`, `source_app: "browser-extension"` | **Aucun.** C'est exactement le chemin des notes (task-380) | **Oui** |
| **Le PDF ouvert dans le navigateur** | `POST /api/media/upload-url` (`target: "document"`) puis `POST /api/media/upload` | Aucun contrat nouveau, mais un chemin nouveau dans l'extension : récupérer les octets dans le background, les mettre sur l'URL présignée, puis soumettre | **Non — lot 2** |

### 6.2 Pourquoi le texte de la page est la raison d'être de l'extension

Sans lui, l'extension est un raccourci vers `ingest-url`, que l'utilisateur obtient déjà en copiant l'URL dans l'app. Avec lui, elle fait quelque chose que le serveur **ne peut pas faire** : lire une page que seul le navigateur connecté voit.

C'est le fournisseur de référence lui-même qui l'écrit, dans son tableau des formats pris en charge (`docs.recall.it/llms-full.txt`, lu le 2026-10-05) :

> « Includes websites, news articles, and blog posts; Landing pages may not parse as well as article pages; **Paywall content requires the browser extension to access** »
> « Google Docs and Slides — **Private or permission-restricted docs can be added using our browser extension** »

### 6.3 Pourquoi un champ de plus, et pas un endpoint de plus

Deux formes étaient possibles. L'alternative a été écartée pour une raison de domaine, pas de goût :

- **Réutiliser `ingest-shared-content` avec `share_type: text`** pour la page entière : rejeté. Ce chemin produit une **note** — `MediaType.SHARED_TEXT`, `SourcePlatform.NOTES` — et perd l'URL, le type `ARTICLE` et la couverture. Une page web enregistrée doit rester un article avec son adresse, sinon la bibliothèque la classe mal et la déduplication par URL ne joue plus.
- **Un nouvel endpoint `POST /api/media/ingest-page`** : rejeté aussi. Il dupliquerait la validation d'URL, la résolution de dossier, l'idempotence et le contrôle de quota de `ingest-url`, pour une seule différence : d'où vient le corps du texte.

Donc : deux champs optionnels, un comportement par défaut inchangé, et un seul endroit à lire dans `docs/CANONICAL_MEDIA_API_CONTRACT.md`.

### 6.4 Ce que le contrat doit préciser, et que le lot 1 doit écrire

Quatre points qu'une tâche d'implémentation ne doit pas inventer :

1. **Qui gagne** quand `extracted_text` est fourni : le texte fourni, sans tentative de récupération serveur. Un `extracted_text` vide ou de moins de N caractères est traité comme absent (une page qui n'a pas d'article extractible — une page d'accueil, une application web — doit retomber sur l'URL seule).
2. **Un plafond de taille.** Le corps JSON passe par API Gateway ; un article long fait 40 à 60 ko de texte, mais une page mal extraite peut en faire mille fois plus. Le plafond doit être explicite côté contrat, et l'extension doit tronquer avant d'envoyer.
3. **L'extraction se fait dans le navigateur**, par la bibliothèque de lisibilité de Mozilla (`@mozilla/readability`, 0.6.0, Apache-2.0) exécutée dans le script de contenu, pas par une heuristique maison. C'est la même famille d'algorithme que le mode lecture de Firefox.
4. **`source_app`** : la valeur `"browser-extension"`, à côté des trois valeurs existantes que l'app émet (`"ios-share-extension"`, `"android-share-intent"`, `"app-url-entry"`, `mobile/src/contexts/ShareIntentContext.tsx:293`). Une seule valeur pour les trois navigateurs : le navigateur précis n'est pas une dimension produit, et s'il le devient un jour, c'est un champ de télémétrie, pas `source_app`.

---

## 7. UX : chaque fonction de Recall, gardée ou écartée — AC#6

Les fonctions sont celles listées dans la description de la tâche, vérifiées contre `docs.recall.it/llms-full.txt` le **2026-10-05**.

| Fonction de Recall | Décision | Justification |
|---|---|---|
| **Icône épinglée dans la barre d'outils** | **Gardée**, lot 1 | C'est le geste. Un clic ouvre une popup qui confirme et propose le dossier. |
| **Panneau à trois choix** (« save the full content » / « summarize and chat » / « save to the Notebook ») | **Écartée**, remplacée par **une action par défaut + une alternative** : « Enregistrer » et, au clic droit, « Enregistrer la sélection » | Trois choix au moment du clic sont trois décisions avant d'avoir rien lu. L'app mobile a déjà tranché l'inverse (task-378, task-389) : la soumission part **dès la réception** et la modale ne pose qu'une question, le classement. L'extension doit reproduire ce parti, pas l'infirmer. |
| **Raccourci `Alt+S` (enregistrer la page)** | **Gardé**, lot 1, même combinaison | C'est le geste sans souris, et `Alt+S` est une convention de fait côté outils de capture. Modifiable par l'utilisateur dans `chrome://extensions/shortcuts`, que Chrome gère pour nous. |
| **Raccourci `Alt+R` (ouvrir/fermer le panneau)** | **Écarté** | Il n'y a pas de panneau à ouvrir (voir la ligne précédente). Un raccourci pour une popup de confirmation qui se ferme toute seule n'a pas d'objet. |
| **Formats** : YouTube, X, Reddit, PDF, Google Docs, Slides, articles, podcasts, TikTok, Instagram, recettes, Wikipédia | **Gardés pour ce que le backend sait déjà faire**, c'est-à-dire : articles et pages web, YouTube, TikTok, Instagram, podcasts, X, LinkedIn, documents. **Reddit, Google Slides et les « recettes » ne sont pas des formats du backend** et ne doivent pas être annoncés | L'extension ne crée aucune capacité d'ingestion : elle alimente celles de `SourcePlatform`. Annoncer un format que le worker ne reconnaît pas produit un échec au lieu d'une fiche. |
| **PDF** | **Lot 2** | §6.1. Le PDF dans le visionneur n'est pas lisible depuis un script de contenu : il faut récupérer les octets et passer par l'upload présigné. |
| **Résumé immédiat affiché dans la page** | **Écartée** | Le résumé n'est pas instantané chez nous : l'ingestion est asynchrone (`202 Accepted`, `MediaItemStatus.INGESTED` puis `PROCESSING`). Promettre un résumé dans la page obligerait à faire de l'attente longue dans une popup. Le lot 2 affiche à la place **l'état du traitement**, ce qui est la vérité. |
| **Chat sur la page courante** | **Écartée** | C'est le périmètre de **task-427**, un benchmark distinct, non tranché. Le pré-empter ici serait décider à sa place. |
| **Chat sur toute la bibliothèque** | **Écartée**, même raison | Idem task-427. |
| **« Augmented Browsing »** (surlignage, en bêta, des mots-clés reliés aux contenus enregistrés, par un modèle local) | **Écartée, et pas seulement par priorité** | Trois raisons cumulées : (1) elle exige un index local de toute la bibliothèque dans le navigateur, donc une synchronisation complète côté client, c'est-à-dire plus de travail que l'app web entière ; (2) elle exige `<all_urls>`, la permission que Chrome signale comme ralentissant la review et qui change radicalement ce que la fiche doit déclarer (« Gathering web browsing activity is generally barred unless it supports a user-facing feature *described prominently* ») ; (3) Recall elle-même la qualifie de bêta. |
| **Confidentialité affichée : rien n'est envoyé avant un enregistrement explicite** | **Gardée, et c'est la fonction la plus importante de la liste** | C'est une propriété d'architecture, pas une promesse marketing : avec `activeTab`, l'extension **ne peut pas** lire avant le clic. Les trois pages d'extension des maquettes le disent, et c'est aussi ce qui simplifie la fiche de store et la politique de confidentialité. |
| **Un compte qui synchronise extension, app web et mobile** | **Gardée, dans la forme de l'appairage** (§5) | Un compte, plusieurs lignées. Sans app web au lot 1. |
| **Choix du dossier et des tags dans la popup** (demandé par la tâche, par analogie avec task-206) | **Dossier : lot 1. Tags : lot 2** | Le dossier est un champ que `ingest-url` accepte déjà (`folder_id`). Les tags demandent de lire la liste des tags existants et de gérer leur création, donc deux appels de plus et une UI de saisie dans une popup de 200 px. |
| **Suivi de l'état du traitement** | **Lot 2** | Demande un sondage ou une notification, donc un cycle de vie dans le service worker. Au lot 1, la popup dit « c'est parti » et l'app dit la suite — ce qui est déjà ce que fait le partage mobile. |

---

## 8. Impact backend et produit

### 8.1 Les cinq points d'impact, et leur taille

| Point | État | Ce que le lot 1 change |
|---|---|---|
| **`source_app`** | Trois valeurs émises par l'app | Une quatrième, `"browser-extension"`. Champ libre côté contrat : aucun enum à étendre |
| **CORS** | `*` par défaut, `allow_credentials=True` (`main.py:87-93`) | **Rien pour l'extension** (§0.2). Pour le site : fixer `CORS_ORIGINS` à l'origine du site, en Terraform |
| **Quotas** | `_active_subscription` + `quota_enforcer` ; un article coûte **0 minute** | **Rien.** Un enregistrement d'extension passe par le même `ingest-url` et le même contrôle. Une page web ne consomme aucune minute, donc le cas le plus fréquent de l'extension est gratuit en quota |
| **Refus de quota** | `429` avec un code d'erreur stable et les chiffres | L'extension doit **afficher le refus**, pas l'avaler. Le contrat des messages d'erreur existe (`docs/USER_FACING_ERROR_MESSAGES.md`) ; la popup reprend la même règle que le mobile : un code, jamais une phrase du serveur |
| **Achat d'abonnement depuis l'extension** | — | **Interdit, et ce n'est pas qu'une règle de store** : vendre depuis une extension demanderait un troisième canal de paiement. La popup, en cas de refus de quota, affiche le palier atteint et renvoie **vers l'app mobile**, pas vers le site, tant que le lot 3 n'existe pas |

### 8.2 Ce que la popup dit quand le quota est épuisé

C'est le seul endroit où l'extension touche à la monétisation, et il y a une contrainte de store (§10.4) : **l'app** ne doit pas pousser vers un paiement web, mais **une extension de navigateur n'est ni l'app iOS ni l'app Android**, et le Chrome Web Store n'a aucune règle de ce genre. L'extension peut donc, elle, mener à la page de paiement du site.

Reste que le bon enchaînement produit est le plus simple : au lot 1 (pendant la beta de task-429, où le palier le plus élevé est accordé à tous et où toute entrée vers l'abonnement est masquée), la popup affiche le refus et la date de remise à zéro, et rien d'autre. Au lot 3, elle ajoute un lien vers `/abonnement`.

### 8.3 Ce que l'extension n'a **pas** le droit de faire

- Pas de `<all_urls>` (§7).
- Pas de lecture en arrière-plan : le service worker ne s'éveille que sur un clic, un raccourci ou un message.
- Pas de collecte d'historique de navigation. La politique `Limited Use` de Google y est explicite : « Gathering web browsing activity is generally barred unless it supports a user-facing feature *described prominently* on the store listing and in the product's interface », et le FAQ des données utilisateur classe « web browsing activity » comme donnée utilisateur, « any information about the websites or other web resources a user requests or interacts with ».
- Pas de code distant. Chrome interdit l'obfuscation et pénalise la minification : le build WXT doit être livré lisible.
- La fiche de store doit porter une politique de confidentialité, **même si tout le traitement était local** : « the policy requires all Products that handle user information to post a privacy policy », « even when data is processed or stored locally ». La page `/privacy` de task-357 sert, à condition de la compléter d'une section sur l'extension.

---

## 9. Coût sur douze mois et charge de maintenance pour un développeur seul

### 9.1 Coûts fixes

| Poste | Lot 1 | Avec les lots 2 à 4 | Source |
|---|---|---|---|
| Nom de domaine `.com` | **~11 $/an** | idem | task-357 (le domaine est de toute façon un prérequis de l'API, de l'adresse DSA et de Sign in with Apple) |
| Hébergement du site (Cloudflare, offre gratuite) | **0 $** | 0 $ | <https://developers.cloudflare.com/pages/platform/limits/> (500 déploiements/mois) |
| TLS, DNS, adresse de contact | **0 $** | 0 $ | task-357 |
| Inscription développeur Chrome Web Store | **frais unique, montant non publié** sur la page d'inscription de Google (§13) | idem | <https://developer.chrome.com/docs/webstore/register> |
| Microsoft Edge Add-ons | — | **0 $** : « There is no registration fee » | <https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account> |
| Firefox Add-ons | — | **0 $** (aucun frais documenté) | <https://extensionworkshop.com/documentation/publish/> |
| Apple Developer Program (Safari) | — | **99 $/an**, **déjà payé** | <https://developer.apple.com/support/enrollment/> |
| **Total fixe, lot 1** | **~11 $ + un frais unique** | | |

Autrement dit : **le lot 1 ne coûte rien de plus que ce que task-357 engage déjà**, plus un frais d'inscription unique.

### 9.2 Coûts variables du paiement, au ticket de 5 € (palier Mix)

Tarifs relevés le **2026-10-05** sur les pages officielles. Hypothèse : carte standard de l'Espace économique européen, abonnement récurrent, vendeur établi en France.

| Option | Frais par transaction de 5 € | Part du ticket | Composition |
|---|---|---|---|
| **Stripe Billing via RevenueCat + Stripe Tax** | **0,385 €** | **7,7 %** | Paiement 1,5 % + 0,25 € · Billing 0,7 % · Tax 0,5 % · RevenueCat 0 € (« there are no additional RevenueCat fees […] on the web ») jusqu'à 2 500 $ de MTR, puis 1 % |
| Stripe **Managed Payments** (Stripe marchand officiel) | **0,535 €** | **10,7 %** | Les mêmes, plus **3,5 %** (« 3,5 % par transaction Managed Payments réussie, en plus des frais de paiement »), Stripe Tax devenant inutile |
| **Paddle** (marchand officiel) | **~0,71 €** | **~14,2 %** | « 5% + 50¢ » par transaction de paiement. Note : Paddle écrit lui-même que pour « selling product with under 10$ value you can contact us for bespoke pricing » — notre ticket de 5 € est sous son palier naturel |
| Stripe **en direct**, sans RevenueCat | 0,385 € | 7,7 % | Mêmes frais, **plus** un webhook, une table de correspondance prix → palier, et une seconde autorité d'entitlements à réconcilier (§10.3) |

Deux remarques sur ces chiffres :

1. **Les 0,25 € fixes pèsent plus que tous les pourcentages.** Sur un ticket de 5 €, ils valent 5 % à eux seuls. C'est une donnée d'entrée pour une éventuelle offre annuelle : un abonnement payé une fois par an au lieu de douze fois économise onze fois 0,25 €, soit 2,75 € — plus que la moitié d'un mois.
2. **La commission des boutiques n'est pas re-vérifiée ici** (§13) : la comparaison « web contre store » n'est donc pas chiffrée dans ce document, volontairement.

### 9.3 Charge de maintenance, par livraison

C'est le vrai coût de l'extension, et il est récurrent.

| Travail | Chrome | Firefox (lot 2) | Edge (lot 2) | Safari (lot 4) |
|---|---|---|---|---|
| Build | `wxt zip`, une commande | `wxt zip -b firefox`, une commande | archive Chrome réutilisée | projet Xcode, archive, envoi |
| Artefact supplémentaire | — | **paquet de sources + instructions de build reproductible, à chaque version** | — | — |
| Soumission | `wxt submit`, ou dépôt manuel | dépôt + sources | dépôt manuel | App Store Connect |
| Attente avant publication | « a few days » à « a few weeks » | **immédiate**, review ensuite | non documentée | review de l'app entière |
| Risque de blocage | review qui traîne sur une nouvelle permission | review a posteriori, blocage possible | — | une version d'app par correctif d'extension |

Lecture : **un navigateur de plus n'est pas « un build de plus », c'est un rituel de livraison de plus.** C'est l'argument central du séquencement en lots : le lot 1 n'a qu'un rituel.

---

## 10. Paiement Stripe sur le site — AC#7

### 10.1 Les options d'intégration, et le critère qui les classe

Le critère n'est pas le prix — §9.2 montre que Stripe en direct et Stripe via RevenueCat coûtent **exactement la même chose**. Le critère est celui que la tâche énonce : **une seule source de vérité pour les droits**, pour qu'un abonné web soit reconnu dans l'app et inversement.

| | **Stripe en direct** | **Stripe Billing via RevenueCat** (recommandé) | **RevenueCat Billing** | **Stripe Managed Payments** | **Paddle via RevenueCat** |
|---|---|---|---|---|---|
| Qui détient les droits | **Deux autorités** : RevenueCat pour iOS/Android, nous pour le web | **RevenueCat seul** | RevenueCat seul | nous, plus RevenueCat pour le mobile | RevenueCat seul |
| Marchand officiel | nous | **nous**, « You, with Stripe as the payment gateway » | nous | **Stripe** | **Paddle** |
| Catalogue | dans Stripe, plus une correspondance chez nous | **dans Stripe, importé dans RevenueCat**, rattaché aux entitlements existants | dans RevenueCat | dans Stripe | dans Paddle, importé |
| Portail client | à écrire, ou Stripe Customer Portal | **Stripe** (« Products, subscriptions, most transactional emails, and subscription management is all managed through Stripe ») | portail RevenueCat | Link (`link.com`) | Paddle |
| Webhook à écrire | **oui**, avec vérification de signature, idempotence, proration | **non** — l'existant suffit (§0.3) | non | oui, pour le web | non |
| Frais (ticket 5 €) | 7,7 % | **7,7 %** | 7,7 % | 10,7 % | ~14,2 % |
| TVA | Stripe Tax, nous restons redevables | Stripe Tax, nous restons redevables | Stripe Tax ou Avalara, nous restons redevables | **Stripe collecte et reverse** dans 80+ pays | **Paddle collecte et reverse** |
| Limites à connaître | — | « Only per-unit and recurring quantity plans are supported » ; « once a Stripe price is imported into RevenueCat, its price type cannot be changed » ; Test Clocks « not fully supported » ; les prorata ne comptent pas dans le MRR RevenueCat | « Selling to businesses (B2B) isn't supported » ; pas de clients en Inde ; pas de contenu traduit dans les liens d'achat hébergés | pas de domaine personnalisé sur la page de paiement ; pas de B2B ; libellé bancaire `LINK.COM* …` | « Paddle Billing currently supports one product per purchase » |
| Verdict | **Rejeté** | **Recommandé** | Acceptable, mais déplace le catalogue hors de Stripe sans rien gagner | **Plan de repli**, si la charge TVA devient un problème (§10.6) | Rejeté : le plus cher, et le moins de contrôle |

### 10.2 Ce que l'option recommandée change dans le code, ligne par ligne

RevenueCat documente les valeurs possibles du champ `store` d'un événement de webhook : « AMAZON, APP_STORE, MAC_APP_STORE, PADDLE, PLAY_STORE, PROMOTIONAL, RC_BILLING, ROKU, STRIPE, TEST_STORE ». Un achat Stripe arrive donc avec `store: "STRIPE"`.

| Fichier | Changement | Taille |
|---|---|---|
| `media_summarizer/core/models/billing.py:26` | `SubscriptionPlatform` reçoit `web = "web"` | 1 ligne |
| `media_summarizer/api/endpoints/revenucat_webhook.py:183` | `_get_platform` mappe `STRIPE` et `RC_BILLING` → `SubscriptionPlatform.web` | 2 lignes |
| `_resolve_tier` et `ENTITLEMENT_TIER_MAP` | **Rien.** Le palier vient de l'entitlement, qui est le même quel que soit le store | 0 |
| `_match_subscription`, `_carries_product`, `_record_store_identity` | **Rien.** Ils comparent `row.platform == subject.platform` ; passer de `None` à `web` ne change que la valeur comparée | 0 |
| `quota_enforcer._active_subscription` | **Rien** (§0.4) | 0 |
| `docs/REVENUECAT_ENTITLEMENTS.md` | Une section « Web » : les trois produits Stripe, leurs Product ID RevenueCat, et le rappel que les trois entitlements ne changent pas | ~15 lignes de doc |
| Côté mobile | `subscriptionDisplay.ts` : un abonnement de plateforme `web` se gère sur le site, pas dans les réglages du store. C'est une branche d'affichage, pas une fonction | petite |

**Une conséquence de migration à noter** : les lignes écrites **avant** ce changement par un achat web porteraient `platform=None`. Comme rien n'est déployé et qu'aucun achat web n'existe, il n'y a rien à reprendre — le changement se fait d'un coup, sans compatibilité à préserver.

### 10.3 Ce que Stripe en direct coûterait, en travail

Pour être juste avec l'option rejetée, voici ce qu'elle demande en plus — et c'est ce qui la rejette :

1. **Un endpoint de webhook Stripe** avec vérification de signature, gestion de l'idempotence (Stripe réémet), et traitement de `customer.subscription.created/updated/deleted`, `invoice.payment_failed`, `invoice.paid`.
2. **Une correspondance prix Stripe → palier** à maintenir à la main, c'est-à-dire exactement ce que `task-262` a supprimé en passant à une résolution par entitlement : « The backend reads the tier from the entitlement identifiers carried by the webhook event, never from the store product ID. […] shipping a new store product is a dashboard operation with no code change and no Lambda deploy. »
3. **Une règle d'arbitrage entre deux autorités.** Si RevenueCat dit « palier M actif sur iOS » et Stripe dit « palier L actif sur le web », qui gagne ? `_active_subscription` donne déjà la réponse (la plus grande allocation) **à condition que les deux lignes viennent du même producteur**. Deux producteurs, c'est deux chemins d'écriture sur la même table, donc des courses possibles.
4. **Une seconde surveillance.** `infrastructure/terraform/modules/platform/revenucat_alerts.tf` existe pour les événements RevenueCat non résolus ; il faudrait son équivalent Stripe.

Aucun de ces quatre points n'achète quoi que ce soit : les frais sont identiques (§9.2) et le catalogue vit dans Stripe dans les deux cas.

### 10.4 Ce que l'app mobile a le droit de dire — sources datées

Textes relevés le **2026-10-05**.

**Apple, App Review Guidelines, 3.1.1(a) « Link to Other Purchase Methods »** :

> « Developers may apply for entitlements to provide a link in their app to a website the developer owns or maintains responsibility for in order to purchase digital content or services. **These entitlements are not required for developers to include buttons, external links, or other calls to action in their United States storefront apps.** […] In all other storefronts, **except for the United States storefront, where this prohibition does not apply, apps and their metadata may not include buttons, external links, or other calls to action that direct customers to purchasing mechanisms other than in-app purchase.** »

**Apple, 3.1.3, introduction** :

> « Apps in this section cannot, within the app, encourage users to use a purchasing method other than in-app purchase, except for apps on the United States storefront and as set forth in 3.1.1(a) and 3.1.3(a). **Developers can send communications outside of the app to their user base about purchasing methods other than in-app purchase.** »

**Apple, 3.1.3(b) « Multiplatform Services »** — la ligne qui autorise notre modèle :

> « Apps that operate across multiple platforms may allow users to access content, subscriptions, or features they have acquired in your app on other platforms or your web site […] **provided those items are also available as in-app purchases within the app.** »

**Google Play, politique Payments** :

> in-app, « developers may not lead users to a payment method other than Google Play's billing system unless Section 3, 8, or 9 » s'applique, et « **This includes directly linking to a webpage that could lead to an alternate payment method** » ;
> hors de l'app, « **Outside of your app, you are free to communicate with your users about alternative purchase options.** » ;
> des programmes de facturation alternative existent pour l'EEE (au titre du DMA), l'Inde, la Corée du Sud (« service fee […] reduced by 4% ») et les États-Unis « while a District Court order remains in effect ».

**La règle opérationnelle qui en découle, pour la boutique française :**

| Surface | Ce qu'elle peut faire |
|---|---|
| **L'app iOS** | Vendre **uniquement** par achat intégré. Le paywall ne mentionne pas le web, ne lie pas vers le web, ne dit pas que c'est moins cher ailleurs. Elle peut en revanche **honorer** un abonnement acheté sur le web, parce que 3.1.3(b) l'autorise et que les trois paliers existent bien en achat intégré |
| **L'app Android** | Pareil, et la formulation de Google est encore plus large : même un lien vers une page qui *pourrait* mener à un autre paiement est interdit in-app |
| **Les deux apps, hors de l'app** | Un courriel, une page web, un réseau social : aucune restriction |
| **Le site web** | Tout ce qu'il veut. Il peut dire les prix, comparer, vendre |
| **L'extension de navigateur** | Tout ce qu'elle veut : ce n'est pas une app de store. Aucune règle du Chrome Web Store ne porte sur le sujet |

**Deux points qui restent non vérifiés** et qui ne changent pas la règle ci-dessus : la commission qu'Apple prélève sur un lien sortant depuis la boutique américaine, et les termes exacts de l'entitlement européen (§13, points 3 et 4). Comme la boutique visée est la française et que la recommandation est de **ne rien dire dans l'app**, aucune de ces deux inconnues n'est bloquante pour le lot 3.

### 10.5 Catalogue : la correspondance avec S, M, L

Les trois paliers et leurs allocations viennent de `DEFAULT_PRICING_CONFIG` (`media_summarizer/core/services/pricing_config_service.py`), validé par task-287 et task-65.

| Palier backend | Clé pricing config | Entitlement RevenueCat | Prix TTC | Minutes/mois | Max/import | Produit Stripe à créer |
|---|---|---|---|---|---|---|
| `S` | `text_only` | `tier_text_only` (`entlc5a41cba3a`) | **3,00 €** | 60 | 60 | `text_only_monthly` |
| `M` | `mix` | `tier_mix` (`entlde3fb9eb65`) | **5,00 €** | 300 | 180 | `mix_monthly` |
| `L` | `audio_heavy` | `tier_audio_heavy` (`entlfa93d44749`) | **9,00 €** | 720 | 240 | `audio_heavy_monthly` |

Cinq points à ne pas improviser à l'implémentation :

1. **Durées** : seul le mensuel existe aujourd'hui, côté App Store comme côté Play (`:monthly`). Le web ne doit pas en inventer d'autres : une offre annuelle est une décision de tarification (et elle changerait la comparaison de §9.2), pas un choix d'intégration.
2. **Les prix sont TTC** dans la config et dans les stores (Apple convertit depuis la boutique France). Côté Stripe, la documentation de la TVA de RevenueCat précise le comportement : « US and Canada transactions use tax-exclusive pricing, while the rest of the world uses tax-inclusive pricing ». Pour un prix affiché TTC en Europe, c'est le bon réglage par défaut ; pour les États-Unis, le prix affiché sera hors taxe — **une différence visible, à assumer ou à corriger par un prix dédié**.
3. **Un entitlement par palier, déjà en place** : les produits Stripe se rattachent aux trois entitlements existants, et rien d'autre ne bouge. C'est tout l'intérêt de la structure de task-262.
4. **Les trois produits Test Store restent** (`mobile/.maestro/07_paywall.yaml` en dépend) : rien de ce lot ne les touche.
5. **Stripe en mode test d'abord**, avec des Sandboxes : RevenueCat recommande « Stripe Sandboxes are recommended » et avertit que les Test Clocks « are not fully supported, since RevenueCat keeps using real time » — donc la vérification d'un renouvellement ne peut pas être accélérée artificiellement. À écrire dans la note à l'owner de task-425.

### 10.6 TVA et facturation pour un vendeur solo dans l'UE

**L'état du droit applicable n'est pas tranché par ce benchmark** — ce n'est pas un conseil fiscal, et RevenueCat le dit de lui-même : « you should seek tax advice from a qualified tax accountant ». Ce qui est tranché, c'est **qui porte la charge** selon l'option.

| | **Stripe Billing (+ Stripe Tax)** | **Stripe Managed Payments** | **Paddle** |
|---|---|---|---|
| Qui est le vendeur | **nous** | **Stripe** | **Paddle** |
| Qui calcule la taxe | Stripe Tax, « 0,5 % » par transaction dans les pays où l'on est enregistré | Stripe, inclus dans les 3,5 % | Paddle, inclus dans les 5 % |
| Qui s'enregistre auprès des administrations | **nous** (les enregistrements se font « in *your* Stripe or Avalara account ») | Stripe | Paddle |
| Qui dépose et reverse | **nous** | **Stripe** : « dépose les déclarations et verse les paiements aux autorités fiscales compétentes » dans 80+ pays | **Paddle** : « we collect the correct rate of tax, track the filing deadlines, prepare our records, submit sales tax returns » |
| Factures | Stripe émet les reçus et factures | Stripe/Link émet reçus et factures, PDF joints | Paddle |
| Remboursements | nous, depuis le Dashboard | nous **ou Stripe** (« Stripe peut émettre des remboursements dans les 60 jours suivant l'achat »), avec une subtilité à connaître : dans certaines juridictions Stripe doit conserver et reverser la taxe initiale, donc **le solde du compte est débité du montant de la TVA d'origine** | Paddle |
| Résiliation | portail Stripe | portail Link | Paddle |
| B2B, TVA autoliquidée, numéro de TVA client | **non couvert** : RevenueCat « doesn't collect customers' tax IDs, issue reverse charge VAT invoices », et son support est « B2C product support only » | **non couvert** : « Services B2B » exclus des catégories éligibles | couvert (Paddle facture en B2B) |
| Charge administrative annuelle | enregistrement au guichet unique européen, puis des déclarations à produire | **quasi nulle** | quasi nulle |

**Recommandation : Stripe Billing + Stripe Tax pour commencer, Managed Payments documenté comme plan de repli.** Trois raisons :

1. **À l'échelle du lot 3, le volume est nul.** Le lot 3 arrive après trois mois de beta où personne ne paie (task-429). Payer 3,5 % de plus pour externaliser une charge administrative qui ne s'est pas encore manifestée est prématuré.
2. **Le passage à Managed Payments est une option du même compte Stripe**, pas une migration de fournisseur : c'est « une intégration Checkout » à activer, et la France est dans la liste des pays éligibles, avec les produits numériques (« SaaS », « médias numériques ») dans les catégories supportées. Le coût du report est donc faible.
3. **Paddle est écarté**, et pas seulement sur le prix : il déplacerait le catalogue et le portail client chez un troisième acteur, pour 14 % d'un ticket de 5 € — un ticket que Paddle lui-même considère sous son palier normal.

**Un fait à connaître sur le paysage** : Lemon Squeezy, que la tâche cite comme marchand officiel alternatif, **a été absorbé par Stripe**. Le pied de page de son site lit aujourd'hui « ©2026 Sold through Link, LLC f/k/a Lemon Squeezy LLC », et son billet du **2026-01-28** annonce : « That's what we're doing with Stripe Managed Payments: Stripe's merchant of record solution. […] Our goal is to provide Lemon Squeezy users an easy way to migrate to Stripe Managed Payments. » Autrement dit, « Lemon Squeezy » et « Stripe Managed Payments » sont la même colonne du tableau ci-dessus, pas deux options.

---

## 11. Les quatre propositions de design — AC#8 et AC#9

### 11.1 Ce qui a été produit

Quatre répertoires, chacun avec un `code.html` autonome (aucune requête réseau : ni `<link>`, ni `<script>`, ni `<img>`) et un `screen.png` :

| Répertoire | Titre | Pages | Hauteur du rendu |
|---|---|---|---|
| `mobile-design-mockups/website_direction_a_vitrine_app_dabord/` | **A — « La vitrine »** : l'app d'abord, l'extension en renfort | accueil, extension, abonnement | 1980 × 10 502 px |
| `mobile-design-mockups/website_direction_b_bureau_extension_dabord/` | **B — « Le bureau »** : le site *est* la page d'installation | accueil, extension, abonnement | 1980 × 7 558 px |
| `mobile-design-mockups/website_direction_c_revue_editoriale/` | **C — « La revue »** : le site se lit, il ne se parcourt pas | accueil, extension, abonnement | 1980 × 10 581 px |
| `mobile-design-mockups/website_direction_d_poste_de_travail/` | **D — « Le poste de travail »** : le site est une app web | accueil, extension, abonnement | 1980 × 8 667 px |

Conventions respectées, et les trois écarts assumés :

- **Chaque page est rendue deux fois, à 1440 px et à 390 px**, côte à côte dans l'image. Ce n'est pas deux maquettes : c'est **le même balisage** dans deux cadres en `container-type: inline-size`, et la bascule se fait en `@container`. Ce que montre l'image est donc le comportement responsive réel, pas une reconstitution.
- **Tous les tokens viennent de `mobile/src/constants/theme.ts`**, recopiés en variables CSS en tête de chaque fichier : les 14 couleurs, les 6 espacements, les 5 rayons, l'ombre `soft` (`0 8px 24px rgba(43, 45, 66, 0.04)`), les trois cibles tactiles. Aucune couleur hors palette.
- **Les icônes sont les contours exacts d'Ionicons** (512 unités/em), repris des maquettes de task-408 et task-410 — pas des dessins approchés.
- **Écart n° 1, les polices.** `DESIGN.md` prescrit Plus Jakarta Sans pour les titres et Inter pour le corps. Un site web peut les charger (l'app, elle, rend en police système) ; une maquette sans réseau ne peut pas. Les quatre fichiers déclarent donc une pile système et rendent en police système. C'est le seul écart visuel au design system, et il disparaît à l'implémentation.
- **Écart n° 2, les logos tiers.** Les badges App Store / Google Play et les repères de navigateurs sont des pastilles textuelles : les vrais logos sont des marques déposées qu'on ne redistribue pas dans un fichier de maquette.
- **Écart n° 3, le nom.** Les quatre maquettes portent le placeholder « Media Summarizer ». Le nom marketing n'est pas tranché (task-186) et **ce benchmark n'en propose pas**.

### 11.2 Comparaison des quatre

| | **A — La vitrine** | **B — Le bureau** | **C — La revue** | **D — Le poste de travail** |
|---|---|---|---|---|
| **Structure de l'accueil** | Hero centré, promesse + 2 badges de store + 3 captures de téléphone, puis 4 sections empilées | Grille 420 px + démonstration : à gauche un bouton d'installation de 64 px, à droite la page et la fiche obtenue, volet contre volet | Colonne de 680 px, chapitres numérotés 01 à 05, bandes pleine largeur en respiration | Capture d'app web pleine largeur, rail de 4 « surfaces », puis deux encadrés et quatre mesures |
| **Ton** | Éditorial sobre, phrases courtes, un surlignage amber sur la promesse | Utilitaire : des chiffres (1,2 Mo, `Alt + S`, 30 secondes), des cas d'usage, une page entière sur les autorisations | Première personne, phrases longues, aucun superlatif | Dense et chiffré (184 contenus, 142 min sur 300, 12 jours d'essai) |
| **Place de l'extension vs les apps mobiles** | L'extension est la **4ᵉ** section ; les apps sont dans le hero | **L'extension est le hero** ; les apps sont une bande sombre secondaire | L'extension est le **chapitre 03** ; les badges de store arrivent après les prix | Les deux sont des **surfaces égales** d'un rail ; la surface mise en avant est le web |
| **Présentation des offres** | **Trois cartes**, Mix encadré en amber, étiquette « le plus choisi » | **Un tableau** de 8 lignes, colonne Mix teintée, filet amber de 3 px en haut | **Trois paragraphes**, prix en 40 px dans la marge, un seul bouton à la fin | **Aucune grille de prix** : un segment à trois positions dans l'écran de compte, avec la jauge de consommation |
| **Ce que le site suppose** | vitrine | vitrine | vitrine, la plus légère des quatre | **app web** : authentification complète, lecture de la bibliothèque dans le navigateur |
| **Composant du système mis au centre** | La barre haute en `backdrop-filter` (DESIGN.md §4) et la carte | Le tableau, et la règle « no-line » appliquée par blocs de couleur | Le **Callout Aside** (filet amber 4 px, fond à 5 % de la primaire, DESIGN.md §5) | La jauge et le segment (DESIGN.md §5, « Segmented Control ») |
| **Dépend d'un prérequis non tenu** | **Oui** : deux badges de store qui ne pointent nulle part | Non | Non | **Oui** : l'app web, qui n'est pas dans le périmètre recommandé |
| **Travail de rédaction** | moyen | faible | **élevé** (c'est un texte, pas une page) | moyen |
| **Risque assumé** | L'extension se perd dans une page de téléchargement d'app | Un visiteur venu du store ne comprend pas tout de suite qu'il y a une app mobile | Aucun bouton avant le premier défilement — une faute en conversion, un choix en lisibilité | Un visiteur non connecté voit une interface qu'il ne peut pas utiliser |

### 11.3 Recommandation : la direction B

**Le fait qui tranche n'est pas esthétique, il est factuel : aujourd'hui, les badges de store ne mènent nulle part.** Rien n'est publié sur l'App Store ni sur Google Play ; l'app est en TestFlight et sur la piste interne Play. Et le nom qui s'afficherait sur ces fiches n'est pas décidé (task-186). Une page d'accueil dont le hero est fait de deux badges de store — la direction A — aurait donc, au moment où le site est publiable, **un hero vide ou menteur**.

La direction B est la seule dont le premier élément cliquable est **la seule chose immédiatement installable** : l'extension. Les badges y sont relégués dans une bande secondaire, où une absence est tolérable (« bientôt sur l'App Store » y est une phrase acceptable ; dans un hero, non).

Trois arguments de plus, dans l'ordre :

1. **Elle correspond au périmètre recommandé.** C'est une vitrine, et c'est la vitrine dont la page la plus travaillée est `/extension` — précisément la page que le lot 1 doit livrer.
2. **Son tableau d'offres est le bon outil pour ce barème.** Le prix ne se vend pas ici par une promesse mais par trois chiffres (60 / 300 / 720 minutes). Un tableau le dit en une ligne par critère ; trois cartes obligent à répéter la même information trois fois. Et quand le barème passera en crédits (`docs/research/pricing-challenge/`), un tableau se met à jour en une colonne.
3. **Sa page d'autorisations est un actif de conformité.** Chrome exige une politique de confidentialité et applique `Limited Use` ; Mozilla exige une déclaration de données. La page `/extension` de B, qui énumère `activeTab`, `storage`, `contextMenus` et dit explicitement ce qu'on **ne** demande pas, est le texte dont les deux soumissions ont besoin. Les trois autres directions laissent ce travail à faire.

**Deux emprunts à faire aux autres directions** :

- **De A : les trois étapes « Comment ça marche ».** B explique bien l'extension et mal le produit. Un visiteur qui arrive de l'App Store doit pouvoir comprendre ce que fait le service avant de comprendre comment on y envoie une page. Les trois cartes numérotées de A, insérées entre la démonstration et le tableau des offres, suffisent.
- **De C : le `Callout Aside`** pour les affirmations dures (« rien ne part avant que vous cliquiez », « pas de `<all_urls>` »). B les met dans des blocs ordinaires ; le composant du design system existe pour ça.

**Ce qui écarte les deux autres** :

- **C** est la plus fidèle à ce que le produit *est* — un outil de lecture longue — et c'est la direction que je recommanderais si le site devait convaincre plutôt qu'installer. Elle demande le plus de rédaction, et son absence de bouton avant le premier défilement est un choix défendable mais coûteux pour une page dont le seul travail mesurable est « combien d'extensions installées ». À garder en réserve pour une page « À propos » ou un billet de lancement.
- **D** n'est pas une direction de vitrine : elle **présuppose** l'app web. Elle est fournie pour que la décision de périmètre de §1 se prenne en voyant ce qu'elle implique, pas pour être choisie en même temps que l'option « vitrine ». Si l'owner choisit l'app web, D devient la référence et §1 change de réponse.

---

## 12. Découpage de l'implémentation en lots — AC#10

### Lot 1 — site vitrine + extension Chrome *(c'est le périmètre de task-425)*

**Site** (Astro, Cloudflare Workers static assets, domaine de task-357) :
1. `/` selon la direction B retenue, avec les trois étapes empruntées à A.
2. `/extension` : bouton d'installation, trois étapes d'appairage, tableau des autorisations, FAQ.
3. `/abonnement` : **page de prix, non connectée, sans bouton de paiement** au lot 1 — elle affiche le tableau des trois paliers et renvoie vers les apps. Le bouton arrive au lot 3.
4. `/privacy`, `/terms` rendus depuis `docs/compliance/*.md`, `/support`.
5. `/.well-known/apple-developer-domain-association.txt`.

**Extension** (WXT, MV3, Chrome) :
6. Action de barre d'outils + popup de confirmation avec choix du dossier.
7. Raccourci `Alt+S`.
8. Entrée de menu contextuel « Enregistrer la sélection ».
9. Extraction du texte par `@mozilla/readability` dans le script de contenu, troncature avant envoi.
10. Tous les appels réseau dans le service worker, `host_permissions` sur l'API, permissions limitées à `activeTab`, `storage`, `contextMenus`.
11. Écran d'appairage : affichage du code, échange, stockage (`storage.local` pour le refresh avec `setAccessLevel` restreint, `storage.session` pour l'access token).
12. Affichage des refus de quota par code d'erreur.

**Backend** :
13. `extracted_text` et `extracted_title`, optionnels, sur `IngestUrlRequest` ; le worker d'article les utilise s'ils sont là.
14. `POST /api/auth/device-pairing` et `POST /api/auth/device-pairing/claim`, avec code à usage unique, TTL court et compteur d'échecs porté par le code.
15. `CORS_ORIGINS` fixé à l'origine du site (Terraform).
16. `docs/CANONICAL_MEDIA_API_CONTRACT.md` et `docs/AUTHENTICATION_SETUP.md` mis à jour.

**Mobile** :
17. Compte → « Relier un navigateur » : génère et affiche le code.

**Documentation** :
18. Comment builder l'extension, la charger non empaquetée contre l'API `-dev`, et la soumettre au Chrome Web Store.

### Lot 2 — les autres navigateurs et la capture complète

1. Cible Firefox : build WXT, **paquet de sources + instructions de build reproductible**, et choix de la forme de déclaration des données (manifeste pour Firefox 140+, ou écran de consentement sur une seule page — jamais une popup).
2. Fiche Edge Add-ons (compte Partner Center, type de compte **non modifiable après inscription** : à choisir avec soin).
3. Capture du PDF ouvert : récupération des octets dans le service worker, `POST /api/media/upload-url` puis `POST /api/media/upload`.
4. Tags dans la popup.
5. Suivi de l'état du traitement.

### Lot 3 — le paiement *(après la fin de la beta de task-429)*

1. Trois produits et prix Stripe, importés dans RevenueCat, rattachés aux trois entitlements existants.
2. `SubscriptionPlatform.web` + mappage de `STRIPE`/`RC_BILLING` dans `_get_platform`.
3. `/abonnement` connectée : session courte obtenue par la primitive d'appairage (§5.5), création de la session de paiement côté API, retour de paiement.
4. Stripe Tax activé, prix TTC pour l'Europe.
5. `docs/REVENUECAT_ENTITLEMENTS.md` : section « Web ».
6. Mobile : un abonnement de plateforme `web` se gère sur le site (affichage).

### Lot 4 — Safari *(optionnel)*

1. `xcrun safari-web-extension-packager`, cible ajoutée au projet iOS géré par Expo, en prenant garde au nom de cible (task-186, point 4).
2. Flux d'appairage retesté avec le modèle de permissions par site de Safari.
3. Plafond `storage.local` de 5 Mo vérifié.

### Lot 5 — seulement si une donnée l'appelle

- **App web** (direction D) : si les retours de beta montrent une demande de *lecture* sur ordinateur, pas seulement d'*enregistrement*.
- **Session web autonome** (option D de §5) : si le site doit vendre à un visiteur qui n'a pas l'app.

### Ce qui bloque la publication, mais pas le développement

| Prérequis | Bloque | Ne bloque pas |
|---|---|---|
| **task-357** (domaine) | la mise en ligne du site, l'URL de la fiche de store | l'écriture du site et de l'extension |
| **task-186** (nom marketing) | la fiche Chrome Web Store, le wordmark du site, le nom de l'app conteneur Safari | tout le reste |
| **task-429** (beta) | le lot 3 | les lots 1, 2, 4 |

---

## 13. Ce qui n'a pas pu être vérifié dans cette passe

Liste explicite, pour que l'owner sache ce qui est sourcé et ce qui ne l'est pas.

1. **Le montant du frais d'inscription au Chrome Web Store.** La page officielle dit « you must register as a CWS developer and pay a one-time registration fee » et **ne publie pas le montant** ; il n'apparaît pas non plus sur « Set up your developer account ». Un chiffre circule largement, il n'est pas cité ici parce qu'aucune page de Google consultée ne le porte. **Tous les moteurs de recherche joignables depuis cet environnement ont servi un défi anti-robots** (DuckDuckGo HTML, Mojeek), donc aucune source secondaire n'a pu être recoupée — même limite que task-357 §9.
2. **Les délais d'examen de Microsoft Edge Add-ons et de Firefox AMO.** Ni la page d'inscription Edge ni les pages de publication de Mozilla ne les chiffrent. Pour Firefox, le fait utile est documenté autrement : la publication est immédiate et la review vient après.
3. **La commission qu'Apple prélève sur un lien sortant depuis la boutique américaine.** La page `/support/storekit-external-entitlement/` est celle de l'ordonnance néerlandaise (applications de rencontres, boutique `nl` uniquement, « Apple will reduce its commission by 3% »), et `/support/storekit-external-purchase-link/` répond 404. Les termes américains vivent dans l'« Addendum » accessible depuis les accords du compte développeur, non consultable sans authentification.
4. **Les termes de l'entitlement européen** (External Purchase Link sous DMA) : même cause.
5. **La commission des boutiques sur un achat intégré** (programme petites entreprises inclus) n'a pas été re-vérifiée : la comparaison « web contre store » n'est donc pas chiffrée (§9.2).
6. **La politique de confidentialité et de données propre à Microsoft Edge Add-ons** n'a pas été auditée ; seule l'absence de frais d'inscription est sourcée.
7. **Le comportement exact du middleware CORS avec `allow_origins=["*"]` et `allow_credentials=True`** est raisonné depuis la configuration (`main.py:87-93`), la version verrouillée de Starlette (0.47.2, `uv.lock`) et la spécification CORS, **sans exécution**. La conclusion de §0.2 — que le site fonctionnerait tel quel avec un `Authorization: Bearer` — est une déduction, pas une mesure. Elle ne change pas la recommandation, qui est de fixer `CORS_ORIGINS` de toute façon.
8. **« Universal Purchase » et l'outil d'empaquetage Safari hébergé dans App Store Connect** sont mentionnés par la documentation d'Apple mais n'ont pas été creusés (§4.4).
9. **Aucun chiffre de conversion** n'étaie la recommandation de design de §11.3 : elle est argumentée sur des faits du projet (rien n'est publié, le nom n'est pas tranché, le barème est chiffré), pas sur des données d'audience, qui n'existent pas.

---

## 14. Sources

Toutes consultées le **2026-10-05**, sauf mention contraire.

**La référence : Recall**

- Documentation complète — <https://docs.recall.it/llms-full.txt> (plateformes, raccourcis `Alt+R` / `Alt+S`, formats et leurs limites, « Augmented Browsing » local-first)
- Page produit du web clipper — <https://www.recall.it/web-clipper>
- Fiche Chrome Web Store — <https://chrome.google.com/webstore/detail/ldbooahljamnocpaahaidnmlgfklbben>
- Fiche Firefox Add-ons — <https://addons.mozilla.org/en-US/firefox/addon/getrecall/>

**Frameworks d'extension**

- WXT — <https://wxt.dev/> ; registre npm `wxt` (0.21.4, 2026-08-11) ; dépôt <https://github.com/wxt-dev/wxt>
- Plasmo — registre npm `plasmo` (0.90.5, 2025-05-17) ; dépôt <https://github.com/PlasmoHQ/plasmo> (dernier commit sur `main` : 2025-05-17)
- CRXJS — registre npm `@crxjs/vite-plugin` (3.0.0, 2026-09-24) ; dépôt <https://github.com/crxjs/chrome-extension-tools>
- `@mozilla/readability` — registre npm (0.6.0, 2025-03-03, Apache-2.0)
- Astro — registre npm (7.3.5, 2026-09-24, MIT)

**Chrome Web Store et plateforme d'extensions**

- Inscription développeur — <https://developer.chrome.com/docs/webstore/register>
- Compte développeur — <https://developer.chrome.com/docs/webstore/set-up-account>
- Processus d'examen, permissions larges, obfuscation — <https://developer.chrome.com/docs/webstore/review-process>
- Politiques du programme — <https://developer.chrome.com/docs/webstore/program-policies/>
- `Limited Use` — <https://developer.chrome.com/docs/webstore/program-policies/limited-use>
- FAQ données utilisateur (politique de confidentialité obligatoire, traitement local inclus) — <https://developer.chrome.com/docs/webstore/program-policies/user-data-faq>
- Requêtes réseau, CORS, scripts de contenu — <https://developer.chrome.com/docs/extensions/develop/concepts/network-requests>
- API `chrome.storage` (`local` sur disque, `session` en mémoire, `setAccessLevel`) — <https://developer.chrome.com/docs/extensions/reference/api/storage>

**Microsoft Edge**

- Inscription développeur, absence de frais — <https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account>
- Installer une extension du Chrome Web Store dans Edge — <https://support.microsoft.com/en-us/microsoft-edge/add-turn-off-or-remove-extensions-in-microsoft-edge-9c0ec68c-2fbc-2f2c-9ff0-bdc76f46b026>

**Mozilla**

- Politiques des modules (code reviewable, paquet de sources, consentement aux données, Firefox 140+) — <https://extensionworkshop.com/documentation/publish/add-on-policies/>
- Soumettre un module (listé / auto-distribué, signature, 200 Mo) — <https://extensionworkshop.com/documentation/publish/submitting-an-add-on/>
- Publier (compte, signature, review continue) — <https://extensionworkshop.com/documentation/publish/>
- Guide de migration MV3 (service worker contre page d'événement, `host_permissions`, `action`) — <https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide/>
- `identity.launchWebAuthFlow` — <https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/identity/launchWebAuthFlow>
- Données de compatibilité (`webextensions.api.identity` : `safari: false`, `firefox_android: false`) — <https://github.com/mdn/browser-compat-data>, fichier `webextensions/api/identity.json`

**Apple**

- App Review Guidelines, 3.1.1, 3.1.1(a), 3.1.3, 3.1.3(a), 3.1.3(b) — <https://developer.apple.com/app-store/review/guidelines/>
- Safari web extensions (app extension macOS/visionOS/iOS, Safari 14+/iOS 15+) — <https://developer.apple.com/documentation/safariservices/safari-web-extensions>
- Distribuer une extension Safari (« first join the Apple Developer Program ») — <https://developer.apple.com/documentation/safariservices/distributing-your-safari-web-extension>
- Empaqueter une extension pour Safari (`xcrun safari-web-extension-packager`, options) — <https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari>
- Compatibilité d'une extension Safari (`identity` non supporté, `storage.sync` non synchronisé, `storage.local` 5 Mo) — <https://developer.apple.com/documentation/safariservices/assessing-your-safari-web-extension-s-browser-compatibility>
- Permissions d'une extension Safari (accord par site) — <https://developer.apple.com/documentation/safariservices/managing-safari-web-extension-permissions>
- Frais du programme développeur (99 USD / 299 USD) — <https://developer.apple.com/support/enrollment/>
- Entitlement néerlandais (hors de notre cas, cité pour dire ce qu'il couvre) — <https://developer.apple.com/support/storekit-external-entitlement/>

**Google Play**

- Politique Payments (interdiction de mener vers un autre paiement in-app, liberté hors de l'app, programmes alternatifs) — <https://support.google.com/googleplay/android-developer/answer/10281818>

**Paiement, abonnements, TVA**

- RevenueCat, tarifs (gratuit jusqu'à 2 500 $ de MTR, puis 1 %) — <https://www.revenuecat.com/pricing/>
- RevenueCat Web, vue d'ensemble (marchands officiels par moteur, « no additional RevenueCat fees […] on the web ») — <https://www.revenuecat.com/docs/web/overview.md>
- RevenueCat, intégration Stripe Billing (connexion, import de produits, limites) — <https://www.revenuecat.com/docs/web/integrations/stripe>
- RevenueCat Billing, TVA (Stripe Tax ou Avalara, TTC hors Amérique du Nord, pas de B2B) — <https://www.revenuecat.com/docs/web/web-billing/tax.md>
- RevenueCat, champs des webhooks et valeurs de `store` — <https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields>
- Stripe, tarifs France (1,5 % + 0,25 € EEE, Billing 0,7 %, Tax 0,5 %, Managed Payments 3,5 %) — <https://stripe.com/fr/pricing>
- Stripe Managed Payments, fonctionnement (marchand officiel, 80+ pays, Link visible du client) — <https://docs.stripe.com/payments/managed-payments/how-it-works>
- Stripe Managed Payments, éligibilité (France éligible, catégories de produits numériques) — <https://docs.stripe.com/payments/managed-payments/eligibility>
- Paddle, tarifs (5 % + 50 ¢, marchand officiel, TVA incluse) — <https://www.paddle.com/pricing>
- Lemon Squeezy, tarifs et mention « Sold through Link, LLC f/k/a Lemon Squeezy LLC » — <https://www.lemonsqueezy.com/pricing>
- Lemon Squeezy, billet du 2026-01-28 sur Stripe Managed Payments — <https://www.lemonsqueezy.com/blog/2026-update>

**Hébergement**

- Cloudflare Pages, encart « Start new projects with Workers » — <https://developers.cloudflare.com/pages/>
- Cloudflare Pages, limites de l'offre gratuite — <https://developers.cloudflare.com/pages/platform/limits/>

**Dépôt (lecture seule)**

- `docs/research/task-357-legal-pages-hosting/README.md` — domaine, hébergement, pages légales, adresse de contact
- `docs/AUTHENTICATION_SETUP.md` — flux natifs, callback web sans token (task-293), `lineage_id`, transport des tokens, CORS
- `docs/store-listing/app-store-connect.md` — identité de l'app, groupe d'abonnement, trois produits à 3 / 5 / 9 €
- `docs/REVENUECAT_ENTITLEMENTS.md` — trois entitlements, neuf produits, résolution par entitlement
- `media_summarizer/api/endpoints/media.py` — `IngestUrlRequest` (ligne 583), `ingest-url` (1316), `ingest-shared-content` (1987), `UploadUrlRequest`
- `media_summarizer/api/models/media_contracts.py` — `MediaType`, `SourcePlatform`, `SharedContentType`
- `media_summarizer/api/main.py:86-93` — `CORS_ORIGINS`, `allow_credentials`, `allow_headers`
- `media_summarizer/api/endpoints/revenucat_webhook.py` — `ENTITLEMENT_TIER_MAP` (54), `_resolve_tier` (143), `_get_platform` (183), `_event_subject` (251), `_carries_product` (283), `_record_store_identity` (376)
- `media_summarizer/core/models/billing.py:26` — `SubscriptionPlatform`
- `media_summarizer/core/services/quota_enforcer.py:408` — `_active_subscription`
- `media_summarizer/core/services/pricing_config_service.py` — `DEFAULT_PRICING_CONFIG`, paliers et conversions
- `mobile/src/contexts/ShareIntentContext.tsx:293` — valeurs de `source_app`
- `mobile/src/constants/theme.ts` et `mobile-design-mockups/my_design_system/DESIGN.md` — tokens et règles du design system
- `uv.lock` — `starlette` 0.47.2, `fastapi` 0.116.1
- `backlog/tasks/task-186…`, `task-357…`, `task-425…`, `task-429…`

---

## 15. Note de périmètre

Ce benchmark n'a modifié que :

- `docs/research/task-424-website-and-browser-extension/README.md` (ce fichier) ;
- les quatre répertoires `mobile-design-mockups/website_direction_*/` ;
- le fichier de tâche `backlog/tasks/task-424…`, section `Implementation Notes`, parce que le processus de l'agent de recherche l'exige.

**Aucun fichier de code applicatif, de configuration ou d'infrastructure n'est touché.** Les numéros de ligne cités ci-dessus sont des lectures, pas des modifications.
