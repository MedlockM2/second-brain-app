# Complément — task-424 (réponse à `complement-request-2026-10-11.md`)

Produit le 2026-10-11 en mode complément. Le `README.md` principal reste la base et n'est pas modifié. Ce fichier traite les onze consignes du `Decision` du 2026-10-11, dans leur ordre, sans rouvrir ce qui est acté : l'interface de l'app web sur ordinateur est la direction de l'owner (`mobile-design-mockups/web_app_owner_direction/`, son `README.md` fait foi écran par écran), les dossiers n'ont qu'un niveau, et « Déplacer le dossier » n'existe pas.

Ce que ce complément **remplace** dans le README principal : le chiffrage en jours et les lots du §10.2 (remplacés par le découpage du §3 ci-dessous), la ligne « Stripe Billing via RevenueCat » du §11 et le lot W4, l'hébergement Cloudflare/Astro du §9.5 et du §11, les points 3, 5 et 9 du §12. Le reste du README tient.

---

## 1. Pas de version téléphone en V1

**Acté.** Sous 900 px de large, `app.<domaine>` n'affiche pas l'app. Elle affiche une page d'invitation : le nom Deepn, une phrase, les deux boutons de store (App Store, Google Play), et un lien « Continuer quand même sur ordinateur » qui n'a pas lieu d'être et n'est donc **pas** prévu. La page passe par les catalogues de traduction comme le reste. Elle est servie par la même SPA (une seule règle de mise en page sur la largeur), pas par une redirection serveur : CloudFront ne connaît pas la largeur de l'écran.

Les écrans téléphone de la maquette (`screens/21-tel-*` à `37-tel-*`, sources `mockup-build/dir_owner_phone.{js,css}`) restent dans le dépôt comme **référence pour plus tard, hors périmètre V1**.

**React Native Web.** Le rejet du README §9.1 (repris de `README.owner-rejected-2026-10-10.md` §3.2 et §3.3) **tient pour la V1** : sans version téléphone, l'argument « un seul code pour l'app et le navigateur » ne s'applique pas, et la mise en page d'ordinateur de l'owner n'a pas d'équivalent dans l'app mobile. **À réévaluer** si une version téléphone fidèle à l'app est un jour demandée : c'est exactement le cas où React Native Web réutiliserait les écrans de `mobile/` au lieu de les redessiner. La question n'est pas rouverte ici.

---

## 2. Le paiement web n'est pas figé

**Retiré** des conclusions reprises (§11 du README) et du lot W4 : « Stripe Billing via RevenueCat ». Aucune tâche du découpage (§3) n'implémente de paiement web. La carte de formule de Mon compte reste **sans entrée vers l'abonnement** pendant la bêta (task-429).

Le choix du moteur fera l'objet d'une **étude dédiée à la fin de la bêta** : la tâche `B-01` du §3 en pose le cadre. Les options à comparer, avec ce que leurs pages disent au 2026-10-11 :

| Option | Moteur de facturation | Vendeur officiel (merchant of record) | TVA, factures, litiges | Source |
|---|---|---|---|---|
| **Paddle Billing** (intégré à RevenueCat) | Paddle | **Paddle** : « Paddle remains the billing engine and merchant of record » ; « Start selling globally with Paddle as your Merchant of Record » | Paddle collecte la TVA au bon taux, tient les échéances et dépose les déclarations ; litiges et support acheteur inclus dans l'offre au paiement. Tarif affiché : **5 % + 0,50 $** par transaction, sans abonnement | revenuecat.com/docs/web/integrations/paddle ; paddle.com/pricing |
| **RevenueCat Billing** (« Web Billing »), avec ses **Web Purchase Links** hébergés | RevenueCat, avec Stripe comme passerelle : « RevenueCat hosts the checkout UI, using Stripe as the payment gateway » | **Deepn** (Stripe n'est que la passerelle) | Collecte de taxe optionnelle, par Stripe Tax ou Avalara AvaTax : « Tax collection is configured in your RevenueCat Billing config and your tax provider's dashboard ». Déclarations à la charge de Deepn | revenuecat.com/docs/web/web-billing/web-purchase-links ; revenuecat.com/docs/web/overview |
| **Stripe Billing** (intégré à RevenueCat) | Stripe | **Deepn** par défaut ; Stripe peut l'être avec **Managed Payments** (« Stripe can be merchant of record when using Managed Payments ») | Dans Stripe (Stripe Tax), ou repris par Stripe avec Managed Payments | revenuecat.com/docs/web/integrations/stripe ; …/stripe-managed-payments |

Les **Web Purchase Links** ne sont pas un moteur : c'est le parcours d'achat hébergé par RevenueCat (« A hosted, customizable purchase flow provided by RevenueCat, to enable web purchases with no code »). Ils marchent avec les trois moteurs ci-dessus. Le **Web SDK** de RevenueCat est l'autre voie d'intégration, dans la page même. Le choix porte donc sur deux axes séparés : le moteur (qui est vendeur officiel, qui déclare la TVA) et l'intégration (lien hébergé ou SDK dans `app.<domaine>`).

Ce qui reste vrai quel que soit le choix, et que l'étude n'aura pas à refaire : le webhook RevenueCat accepte déjà un achat web et écrit une ligne correcte (`README.owner-rejected-2026-10-05.md` §0.3).

---

## 3. Le découpage en tâches de backlog

Il remplace le §10.2 (chiffrage en jours). Il est établi sur la **direction de l'owner**, au format du découpage de task-431. **Ce complément liste ces tâches ; il ne les crée pas.**

Les règles de rédaction appliquées sont celles de `CLAUDE.md` et `AGENTS.md`. Chaque AC est satisfiable par un agent dans son worktree : pas d'« endpoint déployé », pas d'AC en forme de test, pas de suite Maestro. Rien n'est déployé, donc aucune compatibilité n'est prévue. Une tâche donne une PR relisible, avec sa documentation et son i18n. Les vérifications sur l'environnement déployé vont dans la description, en note à l'owner.

### 3.1 Prérequis hors découpage (déjà au backlog)

| Tâche | Ce qu'elle apporte | Pourquoi elle bloque |
|---|---|---|
| **task-443** (owner, `dispatchable: false`) | le domaine, la zone Route 53, l'adresse de contact | toutes les origines (`app.`, `www.`, `api.`) et le *Services ID* Apple vérifié en dépendent |
| **task-445** | `api.<domaine>` : le domaine personnalisé d'API Gateway (`api_custom_domain`, `api_zone_id` dans `lambda_api.tf`) | **prérequis du développement**, pas seulement de la publication (consigne 5, §5) |
| **task-444** (owner) | l'approbation des textes légaux et leur publication | la publication de `www.` |

### 3.2 Les tâches

`W-*` = app web, `X-*` = extension, `B-*` = benchmarks. Les identifiants sont provisoires ; le créateur des tâches les remplace par des `task-NNN`. **Labels → agent** suit la table de `.claude/agents/backlog-dispatcher.md`. Aucune tâche d'implémentation ne porte `pricing`, `product` ou `scoping`.

| ID | Titre | Labels → agent | Dépend de |
|---|---|---|---|
| W-01 | Héberger `app.<domaine>` et `www.<domaine>` sur S3 + CloudFront, dans Terraform | infrastructure, web, feature → task-feature | task-445 |
| W-02 | Générer les pages statiques de `www.<domaine>` : pages légales, installation de l'extension, fichiers `.well-known` | web, compliance, feature → task-feature | task-443, W-01 |
| W-03 | Ouvrir une session web par cookie de rafraîchissement sur `api.<domaine>`, avec une lignée navigateur plafonnée, et restreindre le CORS de l'API HTTP | backend, auth, web, feature → task-feature | task-445 |
| W-04 | Ajouter le CORS de la façade de streaming du chat pour l'origine de l'app web | backend, infrastructure, chat, feature → task-feature | task-443 |
| W-05 | Poser le socle de l'app web : projet, barre horizontale, connexion, i18n, thème, page d'installation sous 900 px | web, feature → task-feature | W-03 |
| W-06 | Accueil et Bibliothèque de l'app web | web, feature → task-feature | W-05 |
| W-07 | Page média en trois volets : Lecture et IA (générer, historique, artefact ouvert, média en traitement) | web, feature → task-feature | W-05 |
| W-08 | Page dossier en trois volets : Sources, ajout de sources, renommer et supprimer, IA du dossier | web, feature → task-feature | W-07 |
| W-09 | Ajouter (lien, fichier, dépôt, collage) et Ranger une source | web, feature → task-feature | W-06 |
| W-10 | Volet Discussion du média et du dossier : le chat web en flux | web, chat, feature → task-feature | W-04, W-07, W-08 |
| W-11 | Digest sur ordinateur : deux périodes et lecture d'une période | web, feature → task-feature | W-07 |
| W-12 | Revue des non classés sur ordinateur, au clavier | web, feature → task-feature | W-06, W-09 |
| W-13 | Recherche plein texte dans la barre | web, feature → task-feature | W-05 |
| W-14 | Mon compte en barre latérale de réglages | web, feature → task-feature | W-05 |
| X-01 | Émettre et révoquer le jeton propre à l'extension, avec un code de secours | backend, auth, feature → task-feature | W-03 |
| X-02 | Garder l'adresse d'origine d'une sélection partagée (`ingest-shared-content`) | backend, api, feature → task-feature | — |
| X-03 | Extension Chrome et Edge : enregistrer la page, enregistrer une sélection, appairage en un clic | extension, feature → task-feature | X-01, X-02, W-14 |
| X-04 | Extension Firefox, avec l'archive de sources exigée par AMO | extension, feature → task-feature | X-03 |
| B-01 | Benchmark du moteur de paiement web (Paddle, RevenueCat Billing, Stripe Billing) | benchmark, pricing, web → task-research | — (à n'ouvrir qu'en fin de bêta) |
| B-01i | Implémenter le paiement web selon le benchmark validé (B-01) | web, feature → task-feature | B-01, W-14 |
| B-02 | Benchmark de l'enregistrement des pages payantes ou derrière une connexion, pour l'extension et le partage Safari | benchmark, scoping, extension → task-research | — |
| B-02i | Implémenter l'enregistrement des pages payantes selon le benchmark validé (B-02) | extension, feature → task-feature | B-02, X-03 |

**Note sur `mobile`.** Le socle (W-05) importe des modules de `mobile/src/{types,lib,services,i18n,constants}` par un alias de build (README §9.2), en lecture. Une tâche qui doit **modifier** un fichier de `mobile/` (par exemple pour rendre un service indépendant d'Expo) doit porter le label `mobile` : le dispatcher l'enverra alors à task-mobile, seul autorisé à écrire dans `mobile/`. Le découpage est fait pour l'éviter : le client de chat web (W-10) réutilise la fonction pure `parseSseBlock` de `mobile/src/services/chatService.ts` sans la modifier.

### 3.3 Périmètre et AC de chaque tâche

**W-01 — Hébergement S3 + CloudFront.**
Périmètre : deux buckets privés (`app`, `www`), deux distributions CloudFront avec Origin Access Control, un certificat ACM en `us-east-1` (exigence de CloudFront) couvrant `app.` et `www.`, validé par DNS dans la zone Route 53. Les enregistrements alias `app` et `www`, et pour `app` le repli SPA (une 403 ou 404 de l'origine sert `index.html` avec un code 200). En-têtes de sécurité par une *response headers policy* : HSTS, `X-Content-Type-Options`, `frame-ancestors 'none'`. Variables de domaine vides par défaut, comme `api_custom_domain`, donc rien n'est créé tant que le domaine n'est pas renseigné.
AC :
- les ressources existent dans le module `platform`, conditionnées au domaine ;
- aucun fournisseur hors AWS ;
- `terraform validate` passe sur dev et prod ;
- un runbook décrit le dépôt d'un build (`aws s3 sync` puis invalidation).
Note à l'owner : `terraform apply` une fois le domaine renseigné.

**W-02 — Pages de `www.`.**
Périmètre : un générateur (script Node sans dépendance de site) produit du HTML statique depuis `docs/compliance/privacy-policy.md` et `terms-of-service.md`, servi en `/privacy` et `/terms`. Il produit aussi la page d'installation de l'extension (`/extension`, liens vers les deux stores) et le fichier `/.well-known/apple-developer-domain-association.txt` (son contenu vient de l'owner, il n'est pas commité s'il est propre au compte). La mise à jour des textes est faite **avant publication**, comme l'exige le `Decision` de task-357 : nom Deepn, adresse de contact de task-443, sous-traitants réels et actuels, dont le modèle du chat et RevenueCat.
AC :
- les deux pages sont générées en HTML, sans PDF ;
- le contenu ne cite plus `mediasummarizer` ;
- la liste des sous-traitants correspond aux fournisseurs appelés par le code ;
- la commande de génération est documentée.
Note à l'owner : relecture juridique, puis publication par task-444.

**W-03 — Session web.**
Périmètre : un mode web des routes `login`, `register`, `google/native` et `apple/native`, qui pose le refresh en cookie `HttpOnly; Secure; SameSite=Strict; Path=/api/auth`, sur `api.<domaine>`, et ne renvoie que l'access token dans le corps. `/refresh` et `/logout` lisent ce cookie. La lignée de type navigateur a un **plafond absolu** et une **expiration par inactivité** : la rotation ne prolonge jamais la durée initiale (RFC 10017 §6.3.2.3, analysée au §1.2 de `README.owner-rejected-2026-10-10.md`). La lignée mobile ne change pas. Le CORS de l'API HTTP (`cors_configuration` de `lambda_api.tf`) passe de `*` à l'origine `https://app.<domaine>` avec `allow_credentials = true`, car un cookie n'est pas envoyé vers une origine `*`. Le 2026-10-11, le pré-vol sur dev répond encore `access-control-allow-origin: *` (§6).
AC :
- les routes posent et lisent le cookie en mode web ;
- la politique de durée par type de lignée est écrite et documentée dans `docs/AUTHENTICATION_SETUP.md` ;
- le CORS de l'API nomme l'origine de l'app web ;
- ruff, mypy et `terraform validate` passent.

**W-04 — CORS de la façade de flux.** Le contrôle du §6 a montré qu'il manque.
Périmètre : une méthode `OPTIONS` sur la ressource `/chat/conversations/{conversation_id}/stream` de l'API REST (intégration mock), qui répond `Access-Control-Allow-Origin` (l'origine de l'app web, jamais `*`), `Access-Control-Allow-Headers: authorization` et `Access-Control-Allow-Methods: GET, OPTIONS`. Le même `Access-Control-Allow-Origin` sur les réponses de la Lambda de diffusion (200, 204, 401, 404, 409) et sur les *gateway responses* 4xx et 5xx d'API Gateway, sinon le navigateur masque l'erreur au code. L'origine est une variable Terraform, vide par défaut.
AC :
- `terraform validate` passe ;
- `chat_stream_app.py` émet l'en-tête pour l'origine configurée et pour elle seule ;
- `docs/CANONICAL_MEDIA_API_CONTRACT.md` décrit le CORS de la façade.
Note à l'owner : après `apply`, relancer le pré-vol du §6 avec l'origine réelle.

**W-05 — Socle de l'app web.**
Périmètre :
- le projet `web/`, en Vite, React 19 et React Router en mode SPA (README §9.1) ;
- l'alias de build vers `mobile/src` (README §9.2) ;
- la barre horizontale de la direction de l'owner : logo, Accueil, Bibliothèque, Digest, Non classés · N, recherche, Ajouter, thème, Mon compte ;
- connexion et inscription : e-mail et mot de passe, Google par Google Identity Services, Apple par Sign in with Apple JS, choix de la langue de lecture à l'inscription ;
- la session de W-03, avec l'access token en mémoire seulement ;
- i18n sur les 11 catalogues, thèmes clair et sombre ;
- la page d'installation sous 900 px (§1) ;
- la commande de build et un document qui dit comment lancer l'app contre l'API `-dev`.

AC :
- le build passe ;
- typecheck et lint propres ;
- les libellés sont présents dans les 11 langues ;
- sous 900 px, seule la page d'installation est rendue.

**W-06 à W-09, W-11 à W-14 — Les écrans.** Chacun reprend la ligne correspondante du tableau « Ce que la maquette applique » de `mobile-design-mockups/web_app_owner_direction/README.md`, qui fait foi, et la capture associée. Les AC sont communs : l'écran est câblé sur les endpoints existants (pas de nouvelle route) ; build, typecheck et lint propres ; libellés dans les 11 langues ; aucun écran de création de dossier dans un dossier, et aucun « Déplacer le dossier ». Ce qui est propre à certaines tâches :

- **W-08** : le menu `…` d'un dossier se limite à Renommer et Supprimer.
- **W-12** : les raccourcis 1 à 5, D, O, ← et → de la maquette.
- **W-14** : la carte de formule sans entrée vers l'abonnement tant que task-429 est en vigueur ; la ligne Extension porte l'appairage (X-03).

**W-10 — Le chat web.**
Périmètre :
- le composeur « Ce média » et « Ce dossier · N sources », le fil, l'historique, la nouvelle conversation, l'arrêt et la relance ;
- les refus (contexte, minutes) et l'échec partiel, avec les états de la maquette ;
- le flux, lu par `fetch` et `ReadableStream` avec `Authorization: Bearer`. `EventSource` ne permet pas d'en-tête : c'est la contrainte du README §6.3, point 6. La reprise se fait par `after_seq`, et la relecture de la conversation prend le relais en cas d'échec, comme le contrôleur mobile (task-467) ;
- le contrat est celui de task-470 : pas d'événement `replaced`. Un tour perdu revient en échec (`generation_lost`, `dispatch_failed`) et se relance comme une nouvelle question.

AC : comme W-06, plus un client qui ne dépend d'aucune API Expo.

**X-01 — Jeton de l'extension.** Le détail est au §7.
AC :
- les routes d'émission, de liste et de révocation existent, ainsi que l'échange du code de secours (usage unique, 5 minutes, 3 essais par code) ;
- le jeton est refusé hors de sa portée ;
- `docs/AUTHENTICATION_SETUP.md` décrit la lignée `browser_extension` ;
- ruff et mypy passent.

**X-02 — Adresse d'origine d'une sélection.**
Périmètre : un champ optionnel `source_url` sur `IngestSharedContentRequest`, pour `share_type: "text"` seulement. Il est validé comme une URL `http(s)`, gardé sur l'élément créé et rendu par la lecture du média. La note créée reste propre au compte, comme aujourd'hui : le champ ne change pas l'identité du média (§10).
AC :
- le champ est accepté, refusé quand il est mal formé, et gardé ;
- `docs/CANONICAL_MEDIA_API_CONTRACT.md` le décrit ;
- ruff et mypy passent.

**X-03 — Extension Chrome et Edge.**
Périmètre :
- le projet `extension/` en WXT (README rejeté du 2026-10-05, §3) ;
- l'action de barre d'outils, qui envoie l'adresse de la page par `POST /api/media/ingest-url` avec `source_app: "browser-extension"` ;
- le menu contextuel sur une sélection, qui crée une note par `POST /api/media/ingest-shared-content` avec `source_url` (X-02) ;
- le choix du dossier de destination ;
- l'appairage en un clic par `externally_connectable` (§7), et le code de secours ;
- aucune lecture du contenu de la page, et la permission `activeTab` seule ;
- **un seul paquet** publié sur le Chrome Web Store et sur Microsoft Edge Add-ons (§11).

AC :
- le build produit le zip ;
- typecheck et lint propres ;
- le manifeste ne déclare ni `<all_urls>` ni permission d'hôte large ;
- un document décrit le chargement non empaqueté contre `-dev` et la publication sur les deux stores.

**X-04 — Firefox.**
Périmètre : `browser_specific_settings.gecko.id`, la déclaration de collecte de données du manifeste (Firefox 140 et plus), et le script qui produit **l'archive de sources** exigée par AMO pour tout code empaqueté. L'archive contient les sources, le fichier de verrouillage du gestionnaire de paquets, et un README avec l'environnement et les commandes de build. Les relecteurs de Mozilla reconstruisent l'extension et comparent : « There must be no differences ».
AC :
- le script produit l'archive ;
- les instructions de build y sont ;
- le build Firefox passe.

**B-01 et B-01i — Paiement web.** Le benchmark compare les trois options du §2 :
- le vendeur officiel, la TVA dans l'UE et hors UE, les factures et les litiges ;
- le coût par transaction au ticket des formules S, M et L ;
- l'intégration (lien hébergé ou Web SDK) et ce qu'elle change dans `docs/REVENUECAT_ENTITLEMENTS.md` et le webhook.

Il produit `docs/research/B-01-…/README.md` avec `owner_decision: pending`. **À ne dispatcher qu'à la fin de la bêta** : proposer `dispatchable: false` jusqu'à ce que l'owner l'ouvre. B-01i reste générique et renvoie au README.

**B-02 et B-02i — Pages payantes ou derrière une connexion.** La consigne 11 décrit le cadre :
- l'étude couvre l'extension et le partage depuis Safari sur iPhone ;
- elle compare l'envoi du HTML de la page au serveur, extrait par trafilatura comme pour les liens (c'est ce que font Readwise, Karakeep et Omnivore), et une extraction dans le navigateur ;
- elle traite la taille de l'envoi (HTML nettoyé, plafond explicite) ;
- elle applique la règle d'identité du §10.

B-02i reste générique.

### 3.4 Graphe de dépendances

    task-443 (owner) ─> task-445 ─┬─> W-01 ─> W-02 (+ task-443)
                                  └─> W-03 ─┬─> W-05 ─┬─> W-06 ─┬─> W-09 ─> W-12
                                            │         │         └──────────> W-12
                                            │         ├─> W-07 ─┬─> W-08 ─┐
                                            │         │         ├─> W-11  ├─> W-10 <─ W-04 <─ task-443
                                            │         │         └─────────┘
                                            │         ├─> W-13
                                            │         └─> W-14 ─┐
                                            └─> X-01 ───────────┴─> X-03 <─ X-02 ;  X-03 ─> X-04
    B-01 (fin de bêta) ─> B-01i (+ W-14)      B-02 ─> B-02i (+ X-03)

### 3.5 Ordre de dispatch recommandé

1. **X-02** et **B-02** dès maintenant : ils ne dépendent de rien.
2. Une fois task-443 faite par l'owner : **task-445** et **W-04**.
3. **W-01** et **W-03** en parallèle (fichiers disjoints), puis **W-02**.
4. **W-05**, puis **X-01**.
5. **W-06**, **W-07**, **W-13** et **W-14** en parallèle.
6. **W-08**, **W-09** et **W-11**, puis **W-10** et **W-12**.
7. **X-03**, puis **X-04**.
8. **B-01** à la fin de la bêta, puis **B-01i**.

**Le chemin critique est task-443**, une tâche de l'owner : sans domaine, ni session web (le cookie doit être posé par `api.<domaine>`) ni CORS nommé ne peuvent être écrits.

### 3.6 Points déduits, à valider par l'owner (aucune consigne ne les tranche)

1. **Pas de lien « continuer sur ordinateur »** sous 900 px (§1) : lecture littérale de « invite à installer l'app mobile ».
2. **La façade de flux garde son URL `execute-api`.** Elle n'a pas de domaine personnalisé : le flux s'authentifie par l'en-tête `Authorization`, pas par un cookie, et n'a donc pas besoin d'être sous `<domaine>`. Le CORS de W-04 suffit.
3. **W-02 met à jour les textes légaux** au lieu de laisser ce travail à task-444, qui reste l'approbation et la publication par l'owner.

---

## 4. Connexion Google et Apple sur le web

**Retiré de « à vérifier »** (§9.4 et §12, point 5, du README). Le serveur accepte déjà les audiences web :

- Google : `_google_native_accepted_audiences` contient `GOOGLE_CLIENT_ID`, le client OAuth web (`media_summarizer/api/endpoints/auth_social.py`, ligne 169). Un jeton d'identité obtenu par Google Identity Services avec ce client a cet `aud`.
- Apple : la vérification met `APPLE_CLIENT_ID` (le *Services ID*) dans `accepted_audiences`, à côté de `APPLE_NATIVE_AUDIENCE` (même fichier, lignes 376 à 380).

**Ce qui reste** : créer les identifiants web, c'est-à-dire les origines JavaScript autorisées du client Google et le *Services ID* Apple avec ses domaines et ses URL de retour. Pour Apple, il faut aussi le **domaine vérifié** : le fichier `.well-known` servi par `www.` (W-02), après task-443. Ce sont des opérations de l'owner dans les consoles, à décrire dans le runbook de task-445.

---

## 5. Le domaine de l'API est un prérequis du développement

**Reporté dans le découpage.** La session web repose sur un cookie posé par `api.<domaine>` (W-03) : sans ce domaine, l'app web ne peut pas ouvrir de session, ni en développement contre une API déployée, ni en production. Le cookie doit être `SameSite=Strict` et lu depuis `app.<domaine>`, donc sur le même site enregistrable. Avec l'URL `execute-api` actuelle, le cookie serait un cookie tiers, bloqué par les navigateurs. **task-445 précède donc W-03**, et à travers W-03 tout le socle (§3.4). C'est un changement par rapport au README, qui ne demandait task-357 et task-443 que pour **publier**.

---

## 6. CORS de la façade de streaming du chat, vérifié sur dev

Fait le **2026-10-11, vers 15 h UTC**, avec `curl`, sur l'API REST `media-summarizer-chat-stream-dev` (stage `v1`, région `eu-west-3`). Origine de test `https://app.example.com`, sans jeton.

| Requête | Réponse |
|---|---|
| `OPTIONS /v1/chat/conversations/cv_cors_probe/stream`, avec `Origin`, `Access-Control-Request-Method: GET` et `Access-Control-Request-Headers: authorization` | **`403`**, `x-amzn-errortype: MissingAuthenticationTokenException`, corps `{"message":"Missing Authentication Token"}`. C'est la réponse d'API Gateway REST à une méthode **non définie** : la ressource n'a pas de méthode `OPTIONS`. Aucun en-tête `Access-Control-*` |
| `GET` de la même URL, avec `Origin` et sans `Authorization` | **`401`** de la Lambda (`{"detail":"Authentication token required"}`), **sans** `Access-Control-Allow-Origin` |
| Pour comparaison, `OPTIONS /api/chat/conversations` sur l'API HTTP `media-summarizer-api-dev` | **`200`**, `access-control-allow-origin: *`, `access-control-allow-methods: DELETE,GET,OPTIONS,POST,PUT`, `access-control-allow-headers: *` |

**Conclusion : le CORS manque sur la façade de flux.** Un navigateur sur `app.<domaine>` ne passerait pas le pré-vol qu'impose l'en-tête `Authorization`. C'est devenu **W-04** dans le découpage. Le pré-vol de l'API HTTP passe aujourd'hui, mais avec `*` et sans credentials, ce qui ne convient pas à une session par cookie : c'est traité dans W-03.

---

## 7. Appairage de l'extension en un clic

**Le parcours.** La page Compte › Extension de l'app web est déjà connectée. Le bouton « Relier cette extension » demande au serveur un jeton propre à l'extension, puis le lui transmet par `chrome.runtime.sendMessage(EXTENSION_ID, { type: "pair", token })`. L'extension déclare :

```json
"externally_connectable": { "matches": ["https://app.<domaine>/*"] }
```

pour **la seule origine `app.<domaine>`**. Chrome n'expose la messagerie qu'aux pages qui correspondent à ce motif : « If left empty or unspecified, no web pages can connect ». Le message ne peut aller que de la page vers l'extension (« not possible to send a message from an extension to a web page »). Dans `runtime.onMessageExternal`, l'extension vérifie à nouveau que `sender.origin` vaut exactement `https://app.<domaine>` avant de stocker quoi que ce soit, en liste d'autorisation et non en liste noire. La documentation Chrome ne montre qu'un test par liste noire sur `sender.url`.

L'identifiant d'extension diffère entre le Chrome Web Store et Edge Add-ons. La page envoie donc le message aux deux identifiants connus, déclarés dans la configuration de l'app web, et le premier qui répond l'emporte.

**Le jeton.** C'est un refresh token d'une **lignée à lui**, de type `browser_extension`, du même modèle que les lignées existantes (`lineage_id`, rotation, fenêtre de rejeu de 60 s).

- **Émission** : `POST /api/auth/extension-tokens`, authentifiée par la session web (access token). Elle renvoie le refresh de la nouvelle lignée et sa date d'expiration.
- **Portée** : avec un access token issu de cette lignée, l'API n'accepte que `POST /api/media/ingest-url`, `POST /api/media/ingest-shared-content`, la liste des dossiers (pour le choix de la destination) et `/api/auth/refresh` de sa propre lignée. Tout le reste répond `403`. La portée est portée par une revendication du JWT et contrôlée dans la dépendance d'authentification. Le jeton ne sert donc jamais de clé à tout le compte.
- **Durée** : plafond absolu, comme pour la lignée navigateur de W-03. La durée exacte se choisit à l'implémentation.
- **Stockage dans l'extension** : le refresh dans `storage.local`, avec `setAccessLevel` qui exclut les scripts de contenu ; l'access token dans `storage.session` (`README.owner-rejected-2026-10-05.md` §5.4).
- **Révocation** :
  - la page Compte › Extension liste les extensions reliées (navigateur et date) et révoque une lignée par `DELETE /api/auth/extension-tokens/{lineage_id}` ;
  - « Se déconnecter » de l'extension révoque sa propre lignée par `/logout` ;
  - la déconnexion de l'app web ne révoque pas l'extension ;
  - la suppression du compte révoque tout, puisque les lignées sont effacées avec le compte.

**Le code en secours.** C'est l'appairage par code court de la passe 1 (`README.owner-rejected-2026-10-05.md` §5.3), affiché par la page Compte et saisi dans la popup : 6 chiffres, 5 minutes, usage unique, détruit après 3 essais. Il sert quand le message ne passe pas : un autre profil de navigateur, ou un navigateur sans `externally_connectable`. **Non vérifié ici** : la prise en charge d'`externally_connectable` par Firefox et par Safari. Le lot Firefox (X-04) doit le vérifier, et le code de secours couvre le cas contraire.

---

## 8. Frais du Chrome Web Store

**Corrigé** (§10.1 et §12, point 9, du README) : **5 $, payés une fois**, par compte développeur. Source Google : le blog des développeurs Chromium, mars 2020 (« New developer dashboard and… », `blog.chromium.org/2020/03/new-developer-dashboard-and.html`), indique un droit de 5,00 $ pour s'inscrire comme développeur du Chrome Web Store, exigé désormais de tous les développeurs. La page d'inscription actuelle (`developer.chrome.com/docs/webstore/register`, mise à jour le 2024-02-13) parle d'un « one-time registration fee » sans en donner le montant. Microsoft Edge Add-ons ne demande aucun frais (README rejeté du 2026-10-05, §4.1).

Le coût fixe sur douze mois devient : **5 $ une fois**, plus le domaine (task-443) et la zone Route 53 (0,50 $ par mois, chiffré par task-357 §4). Les buckets S3 et CloudFront, à l'échelle de la bêta, ne sont **pas rechiffrés ici**.

---

## 9. Hébergement tout AWS, dans Terraform

**Remplace le §9.5 et la ligne Cloudflare du §11.**

| Nom | Ce qui y est servi | Comment |
|---|---|---|
| `<domaine>` et son DNS | — | **Route 53**, zone de task-443 |
| `app.<domaine>` | l'app web (SPA) | **S3 + CloudFront**, repli SPA sur `index.html` (W-01) |
| `www.<domaine>` | pages légales, page d'installation de l'extension, `.well-known`, en HTML statique | **S3 + CloudFront** (W-01, W-02) |
| `api.<domaine>` | l'API HTTP | **domaine personnalisé d'API Gateway**, déjà prévu par `api_custom_domain` et `api_zone_id` dans `lambda_api.tf` (task-445) |
| façade de flux | le flux du chat | URL `execute-api` de l'API REST, inchangée (§3.6, point 2) |

**Pas de Cloudflare, pas d'Astro.** Les pages de `www.` sont générées par un script, sans générateur de site (W-02). Ce choix vaut aussi pour task-357, validé le même jour : les pages légales de task-444 sont celles de W-02, sur `www.<domaine>`, aux chemins `/privacy` et `/terms`.

---

## 10. Identité du texte extrait par l'extension (règle pour plus tard)

**La règle à écrire dans le contrat** d'un futur envoi de contenu de page par le navigateur : un texte envoyé par le client (`extracted_text`, §6 de `README.owner-rejected-2026-10-05.md`) peut venir d'une page payante ou privée. **Il ne prend jamais l'identité de l'adresse seule.** Sinon, un autre compte qui enregistre le même lien recevrait ce texte par la mise en commun des transcripts : `generate_media_key(canonical_url)` dans `media_summarizer/core/services/media_identity.py` est l'identité partagée. L'identité est donc soit **propre au compte** (`generate_account_scoped_media_key`), soit au minimum **l'adresse et ce texte ensemble**, comme pour les articles depuis task-392 (`generate_article_media_key`).

**Elle ne s'applique pas à la V1** : l'extension n'y envoie pas le contenu des pages (consigne 11). La sélection crée une note par `ingest-shared-content`, qui est déjà propre au compte, et X-02 n'y ajoute qu'une adresse d'origine, sans effet sur l'identité. La règle **s'impose au benchmark B-02**. L'app mobile n'est pas concernée aujourd'hui : ses chemins sont publics par construction, ou propres au compte.

---

## 11. En V1, l'extension fait comme les apps

Sur ordinateur, elle remplace le menu « Partager » du téléphone.

- **La page** : son adresse part par `POST /api/media/ingest-url` avec `source_app: "browser-extension"`. Le champ `source_app` existe déjà sur `IngestUrlRequest`.
- **Une sélection**, au clic droit, devient une note par `POST /api/media/ingest-shared-content` (`share_type: "text"`). Elle **garde son adresse d'origine** dans le champ optionnel `source_url` (X-02), à préciser dans le contrat.
- **Aucun nouveau champ pour le contenu de la page** : `extracted_text`, `extracted_title` et Readability sont **retirés de la V1**. L'extension ne lit pas le DOM, et la permission `activeTab` donne l'adresse de l'onglet au clic.
- **Pas de promesse sur les Google Docs privés.** Google a annoncé le 11 mai 2021 (mise à jour le 26 mai) que Docs quittait le rendu HTML pour un rendu sur canevas : « migrating the underlying technical implementation of Docs from the current HTML-based rendering approach », avec cet avertissement : « this may impact some Chrome extensions, where they may no longer work as intended » (`workspaceupdates.googleblog.com/2021/05/Google-Docs-Canvas-Based-Rendering-Update.html`). Une sélection dans un document Docs n'est donc pas garantie. Pour l'adresse d'un Docs privé, le serveur ne lira que ce qu'un lien public lit.
- **Edge dès la première version, avec le même paquet.** Microsoft Edge Add-ons prend un `.zip` qui contient le manifeste et les fichiers de l'extension, par Partner Center, sans frais. La certification « can take up to seven business days » (`learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension`, mise à jour le 2026-09-02). Le formulaire de confidentialité d'Edge demande l'objet unique de l'extension, la justification de chaque permission, la déclaration de code distant (interdit en Manifest V3) et l'URL de la politique de confidentialité, c'est-à-dire `www.<domaine>/privacy`. X-03 publie donc sur les deux stores, ce qui remplace le « lot 2 » d'Edge du README rejeté du 2026-10-05, §4.2.
- **Firefox (X-04)** : l'archive de sources est obligatoire pour tout code passé par un outil qui combine ou minifie les fichiers, ce que fait WXT. Elle doit permettre une reconstruction identique, avec le fichier de verrouillage, un README de build et des outils open source, et être jointe à **chaque** version, jusqu'à 200 Mo (`extensionworkshop.com/documentation/publish/source-code-submission/`).
- **Les pages payantes ou derrière une connexion sont reportées** au benchmark B-02, commun à l'extension et au partage depuis Safari sur iPhone (§3.3). Ce complément le décrit sans le traiter.

---

## 12. Ce que ce complément n'a pas vérifié

1. La prise en charge d'`externally_connectable` par Firefox et Safari (§7), à vérifier dans X-04.
2. Le coût de S3 et CloudFront à l'échelle de la bêta (§8).
3. Le montant du frais du Chrome Web Store sur une page Google **actuelle** : la page d'inscription ne le donne pas, et la source Google qui dit 5 $ date de mars 2020 (§8).
4. Les conditions de Paddle et de RevenueCat au-delà de leurs pages publiques du 2026-10-11 : seuils de volume, pays couverts, délais de versement. C'est l'objet de B-01.

## 13. Sources (consultées le 2026-10-11)

- RevenueCat, Web Purchase Links — https://www.revenuecat.com/docs/web/web-billing/web-purchase-links
- RevenueCat, Web overview — https://www.revenuecat.com/docs/web/overview
- Paddle, pricing — https://www.paddle.com/pricing
- Chrome, `externally_connectable` — https://developer.chrome.com/docs/extensions/reference/manifest/externally-connectable
- Chrome, messages depuis une page web — https://developer.chrome.com/docs/extensions/develop/concepts/messaging#external-webpage
- Chrome Web Store, inscription — https://developer.chrome.com/docs/webstore/register
- Chromium Blog, mars 2020 — https://blog.chromium.org/2020/03/new-developer-dashboard-and.html
- Microsoft Edge, publier une extension — https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension
- Mozilla Extension Workshop, source code submission — https://extensionworkshop.com/documentation/publish/source-code-submission/
- Google Workspace Updates, 11 mai 2021 — https://workspaceupdates.googleblog.com/2021/05/Google-Docs-Canvas-Based-Rendering-Update.html
- Dépôt : `media_summarizer/api/endpoints/auth_social.py`, `media_summarizer/core/services/media_identity.py`, `media_summarizer/api/endpoints/media.py`, `infrastructure/terraform/modules/platform/lambda_api.tf`, `infrastructure/terraform/modules/platform/chat_stream.tf`, `mobile-design-mockups/web_app_owner_direction/README.md`
