---
id: TASK-424
title: >-
  Benchmark du site web de l'app (avec paiement Stripe) et d'une extension
  navigateur pour enregistrer une page dans le second cerveau
status: To Do
assignee: []
created_date: '2026-10-04 16:22'
updated_date: '2026-10-04 17:50'
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
- [ ] #1 Le README recommande explicitement un site vitrine ou une app web, avec l'effort estimé pour chacun, et reprend la recommandation d'hébergement de task-357 au lieu de la refaire
- [ ] #2 Au moins trois frameworks d'extension sont comparés sur une grille commune (Chrome/Edge/Firefox avec un seul code, maintenance, partage de code avec mobile/)
- [ ] #3 Chaque navigateur cible a son coût de publication, son délai d'examen et les règles d'examen applicables, avec des sources datées ; le cas Safari est traité explicitement
- [ ] #4 Au moins trois options d'authentification sont comparées, chacune avec les changements backend qu'elle demande, en partant du constat que le flux OAuth web actuel n'émet aucun token
- [ ] #5 Le périmètre de capture de la première version (URL, contenu de page, sélection, PDF) est défini, avec les changements de contrat d'API qu'il demande
- [ ] #6 Chaque fonction de l'extension Recall listée dans la description est gardée ou écartée pour la première version, avec sa justification
- [ ] #7 Le paiement Stripe sur le site est traité : Stripe en direct comparé à Stripe via RevenueCat, avec les changements du webhook et du modèle de facturation que chaque option demande, et ce que l'app mobile a le droit de dire d'un paiement web, sources datées à l'appui
- [ ] #8 4 propositions de design du site, distinctes, chacune dans son propre répertoire mobile-design-mockups/website_direction_<lettre>_<slug>/ (code.html + screen.png), couvrant au minimum l'accueil, l'installation de l'extension et la page d'abonnement Stripe, conformes au design system Amber Clarity, rendues à 1440 px et à 390 px
- [ ] #9 Le README compare les 4 propositions de design et en recommande une
- [ ] #10 Le README porte owner_decision: pending et propose un découpage de l'implémentation en lots
- [ ] #11 Aucun fichier hors de docs/research/ et des 4 répertoires mobile-design-mockups/website_direction_* n'est modifié
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Mode initial — benchmark produit, en attente de validation de l'owner

Aucun dossier `docs/research/task-424-*` n'existait, aucun `README.owner-rejected-*.md`, aucune demande de complément : ce passage est un **mode initial**, écrit from scratch.

**Livrables**

- `docs/research/task-424-website-and-browser-extension/README.md` — front-matter `owner_decision: pending`, section `Owner Validation` vide, 15 sections, ~96 ko. Les onze AC sont couverts et chaque section porte le numéro d'AC qu'elle sert.
- Quatre maquettes, chacune avec `code.html` autonome (aucune requête réseau) et `screen.png` :
  - `mobile-design-mockups/website_direction_a_vitrine_app_dabord/`
  - `mobile-design-mockups/website_direction_b_bureau_extension_dabord/`
  - `mobile-design-mockups/website_direction_c_revue_editoriale/`
  - `mobile-design-mockups/website_direction_d_poste_de_travail/`
  Chaque maquette couvre l'accueil, l'installation de l'extension et la page d'abonnement, et rend **le même balisage** à 1440 px et à 390 px dans deux cadres `container-type: inline-size` — la bascule responsive se fait en `@container`, ce n'est pas deux maquettes. Tokens repris verbatim de `mobile/src/constants/theme.ts`, icônes extraites des contours Ionicons des maquettes task-408/task-410.

**Recommandation soumise à l'owner** (détail et sources dans le README)

Site **vitrine** statique (6 pages, Astro, hébergement de task-357 avec Cloudflare **Workers** et non Pages — l'éditeur écrit désormais « Start new projects with Workers ») ; extension **WXT** publiée au lot 1 sur le **seul Chrome Web Store** ; authentification par **appairage depuis l'app mobile** ; capture de l'**URL + du texte de la page + de la sélection** (deux champs optionnels sur `IngestUrlRequest`) ; paiement **Stripe Billing branché sur RevenueCat**, jamais en direct, livré en **dernier** lot ; proposition de design **B**. Découpage en 5 lots, le lot 1 étant le périmètre de task-425.

**Cinq constats du dépôt qui corrigent la description de la tâche**, et qui changent le chiffrage :

1. L'extension de Recall **n'est pas** disponible sur Safari : sa propre documentation écrit « *Safari coming soon* », là où sa page marketing annonce Safari.
2. Le **CORS n'est pas un problème pour l'extension** : un `fetch` depuis le service worker avec `host_permissions` n'y est pas soumis (c'est le script de contenu qui l'est). Aucune entrée `CORS_ORIGINS` à ajouter pour l'extension ; en revanche `CORS_ORIGINS=*` doit être resserré quand le site existe.
3. Le **webhook RevenueCat accepte déjà un achat web** et écrit une ligne de palier correcte : `_resolve_tier` lit l'entitlement, et `_carries_product` / `_record_store_identity` tolèrent explicitement un store que `_get_platform` ne mappe pas. Le travail du lot paiement est additif (`SubscriptionPlatform.web`), pas structurel.
4. **L'abonné sur deux canaux est déjà géré** : `_active_subscription` choisit la ligne dont le palier porte la plus grande allocation. Le problème restant est du texte, pas du code.
5. **Cloudflare recommande Workers plutôt que Pages** pour un projet neuf — une mise à jour de task-357, pas un nouveau benchmark d'hébergement.

**Ce qui n'a pas pu être vérifié** est listé en §13 du README (9 points), dont : le montant du frais d'inscription au Chrome Web Store (non publié par Google, et tous les moteurs de recherche joignables ont servi un défi anti-robots), la commission d'Apple sur un lien sortant depuis la boutique américaine, et les termes de l'entitlement européen.

**La recommandation attend la validation de l'owner.** La tâche reste en `To Do` ; `owner_decision` vaut `pending`. C'est l'owner qui bascule le champ à `ok`, `abandoned`, `redo` ou `more`.

**Périmètre touché** : ce fichier de tâche, le README de recherche, et les quatre répertoires de maquettes. Aucun fichier de code applicatif, de configuration ou d'infrastructure n'est modifié — les numéros de ligne cités dans le README sont des lectures.
<!-- SECTION:NOTES:END -->
