---
owner_decision: pending   # pending | ok | abandoned | redo | more
---

# Benchmark : l'app web du second cerveau, le site public qui l'entoure, et l'extension navigateur

## Owner Validation

**Decision**:

**Validated at**:

---

## Recommendation

**Une app web React, pure SPA, servie sur une origine à elle (`app.<domaine>`), qui partage avec `mobile/` ses 14 455 lignes de logique sans partager une seule ligne de composant. Une session de navigateur portée par un cookie `HttpOnly` de rafraîchissement, avec plafond absolu, parce que le modèle actuel du dépôt — un refresh glissant d'un an sans plafond — est exactement ce que la RFC 10017 interdit à un client navigateur. Le site public reste Astro, statique, sur `www.<domaine>`. Et la parité avec le mobile est la destination, pas le premier lot : on livre la lecture d'abord, en quatre lots, parce qu'une des six surfaces que l'owner a listées — l'abonnement — est de toute façon interdite d'affichage par task-429. Proposition de design retenue : la direction A, « Le classeur ».**

En une ligne par dimension, avec le fait qui tranche :

| Dimension | Décision recommandée | Le fait qui tranche |
|---|---|---|
| **Nature du livrable** | **Deux applications sur deux origines** : `www.<domaine>` statique (vitrine, pages légales, page d'installation de l'extension), `app.<domaine>` application connectée. L'API reste `api.<domaine>`. | La RFC 10017 §9.4 : « deploy one application per origin to leverage [browser] protections ». Et Astro écrit lui-même que les frameworks d'application excellent sur « logged-in admin dashboards, inboxes », là où lui vise « content-driven websites ». Deux outils, deux jobs, un seul domaine. §3 |
| **Stack de l'app web** | **Vite 8 + React 19 + React Router 8 en mode framework avec `ssr: false`** (SPA pré-rendue au build). Aucun serveur de rendu. | C'est la seule stack qui (a) ne demande aucun runtime serveur à opérer, (b) parle le même React que `mobile/`, donc rien de neuf à apprendre, et (c) est documentée pour l'hébergement statique : « deploy the `build/client` directory to whatever static host you prefer ». §3.2 |
| **Stack du site public** | **Astro, inchangé.** La recommandation de la passe 1 tient : le texte légal reste la version `.md` du dépôt. | Le site public n'est pas devenu une app : il reste 6 pages de contenu. §3.4 |
| **React Native Web** | **Rejeté**, et ce n'est pas un rejet de principe : `react-native-web` 0.21.3 est vivant (2026-09-25) et Expo SDK 55 a bien une cible web. | Les 22 901 lignes de `mobile/app` + `mobile/src/components` sont des **mises en page de téléphone** : barre d'onglets basse, colonne unique, feuilles modales. Une app web de bureau ne les réutilise pas, elle les remplace. RNW ferait donc payer le coût d'un second bundler, de 7 dépendances natives à remplacer et d'une couche d'abstraction, pour réutiliser du code qu'on jette. §3.3 |
| **Partage de code avec `mobile/`** | **Oui, et c'est le changement majeur par rapport à la passe 1.** 14 455 lignes sont déjà platform-free et directement importables ; 2 339 de plus le deviennent avec un adaptateur mince. Pas de `packages/` au lot 1 : l'app web **importe** `mobile/src/{types,lib,services,i18n,constants}` par un alias Vite. | Mesure, pas opinion : sur 44 202 lignes de TS/TSX dans `mobile/`, seuls 13 fichiers sur 85 dans ces cinq dossiers importent `react-native` ou un module `expo-*`. §4 |
| **Authentification** | **Cookie `HttpOnly` de rafraîchissement posé par l'API + access token en mémoire seulement** (jamais `localStorage`). Plus deux obligations backend nouvelles : un **plafond absolu** et une **expiration par inactivité** sur les lignées de type navigateur. | RFC 10017 §6.3.2.3 : un serveur « MUST NOT, upon issuing a rotated refresh token, extend the lifetime of the new refresh token beyond the lifetime of the initial refresh token ». Le dépôt fait littéralement l'inverse : « chaque /refresh repose expires_at à now + 1 an » (`docs/AUTHENTICATION_SETUP.md`). §6 |
| **CORS** | **Deux endroits à changer, et le premier n'est pas celui que la passe 1 avait identifié** : `cors_configuration` de l'API Gateway (`infrastructure/terraform/modules/platform/lambda_api.tf:138-144`, `allow_credentials = false` aujourd'hui) **puis** `CORS_ORIGINS`. | AWS, verbatim : « **If you configure CORS for an API, API Gateway ignores CORS headers returned from your backend integration.** » Le `CORSMiddleware` de FastAPI est donc inerte sur l'API déployée. §1.1 |
| **Hébergement** | **Cloudflare Workers static assets**, deux projets (un par origine), sur le domaine de task-357. | « Requests to static assets are free and unlimited », `not_found_handling = "single-page-application"` est documenté pour exactement ce cas, et 20 000 fichiers / 25 MiB par fichier sur l'offre gratuite. §5 |
| **Parité ou lecture d'abord** | **Lecture d'abord, en 4 lots, parité comme destination déclarée.** Chiffrage : 20 à 35 jours pour l'app en lecture, 32 à 50 jours pour la parité d'un coup, et **8 à 15 % de surcoût** pour rattraper l'écriture ensuite. | La parité au premier lot n'est **pas disponible** : l'abonnement, l'une des six surfaces listées, doit être masqué pendant la beta (task-429, `Done`, trois mois, date de début non fixée). On ne peut pas livrer en lot 1 un écran qu'aucun utilisateur n'a le droit de voir. §7 |
| **L'extension** | **Reprise telle quelle de la passe 1** (WXT, Chrome Web Store d'abord, capture URL + texte + sélection, `activeTab`), avec **un seul point que la décision de l'app web déplace** : c'est désormais l'app web, et non l'app mobile, qui peut délivrer l'appairage. L'écran mobile « Relier un navigateur » sort du chemin critique. §10 |
| **Paiement** | **Repris tel quel** : Stripe Billing branché sur RevenueCat, jamais en direct, `SubscriptionPlatform.web`, Stripe Tax, Managed Payments en repli. Dernier lot. | Revérifié le 2026-10-06 : RevenueCat écrit toujours « there are no additional RevenueCat fees to support subscriptions and purchases on the web », et l'intégration Stripe Billing laisse produits, portail et TVA chez Stripe. §11 |
| **Design** | **Direction A, « Le classeur »** (trois volets), avec un emprunt à B (la marge d'artefacts) et un à D (la palette de commandes). | C'est la seule des quatre dont la coquille sert **les trois surfaces** — bibliothèque, fiche media, digest — sans nouvelle mise en page, donc la seule où le lot 2 ne redessine pas ce que le lot 1 a dessiné. §12 |

### Les lots, et pourquoi dans cet ordre

| Lot | Contenu | Dépend de | Ordre de grandeur |
|---|---|---|---|
| **W0 — les fondations** | Session web (cookie de rafraîchissement, plafond absolu, inactivité, `/logout`), CORS en Terraform, projet Vite + React Router, coquille de la direction retenue, i18n branché sur les 11 catalogues existants, écran de connexion, rafraîchissement et multi-onglets, hébergement | task-357 pour **publier**, pas pour développer | **4 à 6 j** |
| **W1 — lire la bibliothèque** | Ajouts récents, « Reprendre », arbre de dossiers, liste, fiche media, lecteur de transcript, artefacts en lecture, visionneuse d'artefact, états de traitement et d'échec | W0 | **8 à 12 j** |
| **W2 — digest, recherche, compte** | Digest quotidien et hebdomadaire, recherche plein texte avec surlignage, réglages du compte en lecture (profil, langues, état d'abonnement **sans** entrée vers l'abonnement, conformément à task-429) | W0 | **5 à 8 j** |
| **W3 — écrire** | Ingestion par URL, import de fichiers par URL présignée (API `File` du navigateur), génération d'artefacts, création / renommage / déplacement de dossiers, revue des non classés, suppression de compte | W1, W2 | **7 à 10 j** |
| **X1 — l'extension Chrome** | WXT, action de barre d'outils, `Alt+S`, menu contextuel, extraction par `@mozilla/readability`, appairage **délivré par l'app web**, deux champs optionnels sur `IngestUrlRequest` | W0 (pour l'origine d'appairage) | **5 à 8 j** |
| **X2 — Firefox et Edge, capture complète** | Cible Firefox (paquet de sources, déclaration de données), fiche Edge Add-ons, PDF ouvert, tags, suivi du traitement | X1 | **5 à 8 j** |
| **W4 — l'abonnement** | Page d'abonnement, Stripe Billing via RevenueCat, `SubscriptionPlatform.web`, Stripe Tax, section « Web » de `docs/REVENUECAT_ENTITLEMENTS.md` | W2 **et la fin de la beta task-429** | **4 à 6 j** |
| **X3 — Safari** | `xcrun safari-web-extension-packager`, cible ajoutée au projet iOS Expo | X1, Xcode | **4 à 6 j**, optionnel |

**Pourquoi W0 avant tout le reste, et pourquoi il est si petit** : parce qu'une app web en **lecture** ne demande **aucun endpoint nouveau**. Les dix-huit routes que l'app mobile appelle couvrent déjà la totalité des six surfaces listées, avec pagination par curseur (§1.3). Tout le travail backend du chemin de lecture tient dans la session et le CORS.

**Pourquoi W4 en dernier, et ce n'est pas un arbitrage** : task-429 est `Done`. Pendant la beta — trois mois, date de début non encore annoncée — tout compte reçoit le palier le plus élevé et **toutes les entrées vers l'abonnement sont masquées** dans l'app. L'app web doit lire le même drapeau `is_beta_access` (`/api/v1/entitlements`) et masquer la même chose. Livrer une page d'abonnement au lot 1 serait livrer un écran interdit.

**Pourquoi X1 après W0 et non avant** : l'extension a besoin d'une surface où l'utilisateur est déjà authentifié pour récupérer ses jetons. La passe 1 avait choisi l'app mobile faute d'alternative, ce qui ajoutait un écran mobile au chemin critique. Avec `app.<domaine>`, cette surface existe dans le navigateur où l'extension s'installe. §10.2

### Ce que ce benchmark recommande de **ne pas** faire

1. **Ne pas garder `allow_credentials = false` sur l'API Gateway** en croyant que `CORS_ORIGINS` suffit. Le middleware Python n'atteint jamais le navigateur sur l'API déployée. §1.1
2. **Ne pas mettre le refresh token dans `localStorage`.** Ce serait un porteur d'un an, glissant et sans plafond, lisible par n'importe quel script injecté. C'est la configuration que la RFC 10017 §8.2 décrit comme n'offrant « no protection against unauthorized access from malicious JavaScript », aggravée par une durée que la même RFC interdit. §6.3
3. **Ne pas construire un BFF au lot W0.** C'est le patron que la RFC recommande le plus fort, et il reste la trajectoire si le risque monte — mais il ajoute un composant à opérer, un secret de chiffrement de cookie hors de Secrets Manager, et un saut réseau sur chaque lecture de bibliothèque. §6.3
4. **Ne pas adopter React Native Web pour « réutiliser l'app ».** Ce qu'on réutiliserait, ce sont des écrans de téléphone. §3.3
5. **Ne pas créer `packages/` au lot W0.** L'alias Vite vers `mobile/src` donne le même partage sans toucher ni `mobile/package.json`, ni Metro, ni le build EAS — le chemin dont task-186 a montré qu'une erreur de nommage y coûte une place de build entière. §4.3
6. **Ne pas livrer de page d'abonnement avant la fin de la beta.** §7.3
7. **Ne pas dupliquer les catalogues i18n.** Les 8 471 lignes de `mobile/src/i18n/*.ts` sont des objets TS purs ; seul le provider (264 lignes) est couple. §4.2

---

## 0. Ce que cette passe reprend sans le réinstruire

L'owner a juge solide, dans `README.owner-rejected-2026-10-05.md`, tout ce qui ne dépendait pas de la dimension 1, et a demande de ne pas refaire ces recherches. Repris **tel quel**, avec renvoi à la section du fichier rejeté :

| Conclusion reprise | Ou elle est argumentée |
|---|---|
| L'extension de Recall n'est **pas** disponible sur Safari (« Safari coming soon » dans sa propre doc, contre « Chrome, Firefox, Edge, and Safari » sur sa page marketing) | rejeté §0.1 |
| Le CORS n'est pas un problème **pour l'extension** : un `fetch` depuis le service worker avec `host_permissions` n'y est pas soumis ; c'est le script de contenu qui l'est | rejeté §0.2 |
| Le webhook RevenueCat **accepte déjà** un achat web et écrit une ligne de palier correcte : `_resolve_tier` lit l'entitlement, `_carries_product` et `_record_store_identity` tolèrent un store non mappé | rejeté §0.3 |
| L'abonné sur deux canaux est **déjà gere** : `_active_subscription` retient la ligne dont le palier porte la plus grande allocation | rejeté §0.4 |
| Cloudflare recommande **Workers plutôt que Pages** pour un projet neuf (« Start new projects with Workers ») | rejeté §0.5 |
| **WXT** contre Plasmo, CRXJS et MV3 nu : Plasmo est sans release depuis le 2025-05-17 ; WXT produit l'archive de sources que Mozilla exige | rejeté §3 |
| Coûts, délais et règles d'examen des quatre boutiques ; Safari traité et reporté ; `identity` absent de Safari | rejeté §4 |
| Ce qu'on capture : URL + texte de page + sélection au premier lot, PDF ensuite ; deux champs optionnels sur `IngestUrlRequest` plutôt qu'un endpoint de plus | rejeté §6 |
| Chaque fonction de Recall gardée ou écartée, y compris « Augmented Browsing » écartée pour trois raisons cumulées | rejeté §7 |
| Quotas, `source_app`, ce que l'extension n'a pas le droit de faire, `Limited Use` | rejeté §8 |
| **Stripe Billing branché sur RevenueCat**, jamais en direct ; les frais identiques entre les deux ; Managed Payments en repli ; Paddle écarté ; Lemon Squeezy absorbé par Stripe | rejeté §10.1 à §10.3, §10.6 |
| Ce que l'app mobile a le droit de dire d'un paiement web (Apple 3.1.1(a), 3.1.3, 3.1.3(b) ; Google Play Payments) : rien dans l'app sur la boutique française, tout sur le site | rejeté §10.4 |
| Catalogue S / M / L, entitlements, prix TTC, Stripe Sandboxes | rejeté §10.5 |

Deux conclusions de la passe 1 sont **révisées** par cette passe, et les deux parce que l'app web change la question :

1. **« Rien d'utile n'est partageable avec `mobile/` »** (rejeté §3.4) était vrai pour une extension qui envoie trois champs. C'est faux pour une app web qui réaffiche les mêmes artefacts : §4 mesure 14 455 lignes directement importables.
2. **« Une session minimale, sur la seule page d'abonnement, et seulement au lot 3 »** (rejeté §5.5) tombe avec le périmètre. §6 traite la session complète.

Un fait de contexte à noter, qui n'est **pas** une révision : **task-357 est elle-même encore `owner_decision: pending`**. Le domaine, le registrar et le fournisseur d'hébergement sont donc des recommandations, pas des décisions. Ce benchmark s'y appuie comme la tâche le demande (« se construire sur ce choix, sans refaire ce benchmark »), mais le lot W0 ne peut **publier** que quand task-357 est tranchée.

---

## 1. Trois constats du dépôt que la passe 1 a manqués, et qui changent le chiffrage

Aucun fichier de code n'est modifié par ce benchmark : les numéros de ligne ci-dessous sont des lectures.

### 1.1 Le CORS de l'API déployée n'est pas celui du code Python

La passe 1 a conclu (rejeté §0.2) que « le site fonctionnerait tel quel » et qu'il suffirait de « fixer `CORS_ORIGINS` à l'origine du site, en Terraform ». Le raisonnement portait sur `media_summarizer/api/main.py:86-94`. Il est juste sur ce fichier, et sans effet sur l'API déployée, parce qu'un second étage de CORS existe au-dessus.

`infrastructure/terraform/modules/platform/lambda_api.tf:131-146` déclare une HTTP API avec son propre bloc :

```hcl
cors_configuration {
  allow_origins     = ["*"]
  allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
  allow_headers     = ["*"]
  expose_headers    = ["X-Request-ID"]
  max_age           = 3600
  allow_credentials = false
}
```

Et AWS documente, verbatim :

> « If you configure CORS for an API, API Gateway automatically sends a response to preflight OPTIONS requests, even if there isn't an OPTIONS route configured for your API. For a CORS request, API Gateway adds the configured CORS headers to the response from an integration. »
> **« If you configure CORS for an API, API Gateway ignores CORS headers returned from your backend integration. »**
> — <https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-cors.html> (lu le 2026-10-06)

Trois conséquences, dans l'ordre d'importance :

1. **Le `CORSMiddleware` de FastAPI est inerte sur l'API déployée.** Ce qu'un navigateur voit, c'est la configuration Terraform. La ligne de `docs/AUTHENTICATION_SETUP.md` — « CORS_ORIGINS doit contenir le(s) domaine(s) front autorisés » — est donc incomplète et doit être corrigée par le lot W0 : il y a **deux** endroits, et celui qui compte en production est le Terraform.
2. **`allow_credentials = false` rend une session par cookie impossible**, pas seulement risquée. Un `fetch(…, { credentials: 'include' })` cross-origin dont la réponse ne porte pas `Access-Control-Allow-Credentials: true` est rejeté par le navigateur. Le changement est une ligne, mais c'est une ligne **bloquante** : sans elle, aucun des lots W1 à W4 ne fonctionne.
3. **`allow_origins = ["*"]` devient illégal dès qu'on passe `allow_credentials = true`.** La spécification CORS interdit `Access-Control-Allow-Origin: *` avec un mode de credentials `include`. Il faut donc passer les deux ensemble, à l'origine exacte de l'app.

Et un piège à connaître, mesurable dans la source verrouillée du dépôt. Dans `starlette` 0.47.2 (`uv.lock`), `CORSMiddleware` traite le cas `allow_origins=["*"] + allow_credentials=True` de façon **conditionnelle à la présence d'un en-tête `Cookie`** dans la requête :

```python
# If request includes any cookie headers, then we must respond
# with the specific origin instead of '*'.
if self.allow_all_origins and has_cookie:
    self.allow_explicit_origin(headers, origin)
```
— `starlette/middleware/cors.py`, lignes 157-160

Autrement dit, sur une réponse simple, l'origine n'est réfléchie que si la requête portait déjà un cookie ; sinon le middleware renvoie `*` **avec** `Access-Control-Allow-Credentials: true`, combinaison que le navigateur refuse. Le tout premier `POST /api/auth/refresh` d'un navigateur neuf — celui qui n'a pas encore de cookie — tomberait donc dans le cas cassé, et les suivants passeraient : un bug intermittent, à l'allure de problème réseau. La conclusion opérationnelle est la même que ci-dessus (fixer l'origine explicitement dès le départ), mais elle explique pourquoi « ça marche chez moi » serait trompeur ici.

> **Non vérifie** : ce comportement est lu dans la source de la version verrouillée, sans exécution (§13, point 3). Et il ne se manifeste que si l'on laissait `CORS_ORIGINS=*` — ce que la recommandation interdit.

### 1.2 Le refresh token glissant d'un an est interdit à un client navigateur

C'est le constat le plus structurant de cette passe, et il est arrivé dans l'intervalle entre les deux passes.

**« OAuth 2.0 for Browser-Based Applications » est sorti du statut de draft** : c'est la **RFC 10017**, *Best Current Practice*, **BCP 212** (le même BCP que la RFC 8252 « OAuth 2.0 for Native Apps »), publiée en **août 2026**, par A. Parecki, P. De Ryck et D. Waite. Elle était `draft-ietf-oauth-browser-based-apps-27` jusque-là. La passe 1 ne la cite pas.

Ce qu'elle exige d'un serveur qui émet un refresh token à un client navigateur (§6.3.2.3), verbatim :

> « MUST either rotate refresh tokens on each use OR use sender-constrained refresh tokens »
> « MUST either set a maximum lifetime on refresh tokens »
> « expire if the refresh token has not been used within some amount of time »
> **« MUST NOT, upon issuing a rotated refresh token, extend the lifetime of the new refresh token »** … « beyond the lifetime of the initial refresh token »

Maintenant ce que le dépôt fait, verbatim (`docs/AUTHENTICATION_SETUP.md`) :

> « Valeur opaque stockée en base (table auth_tokens), durée **glissante** de REFRESH_TOKEN_EXPIRE_DAYS (365 par défaut) **sans plafond absolu** : chaque /refresh repose expires_at à now + 1 an. »

Confrontation, exigence par exigence :

| Exigence RFC 10017 §6.3.2.3 | État du dépôt | Verdict |
|---|---|---|
| Rotation à chaque usage **ou** token sender-constrained | Rotation à chaque `/refresh`, ancien marque `used_at` + `is_active=false`, fenêtre de rejeu de 60 s | **Conforme** |
| Durée de vie maximale **ou** expiration par inactivité | Ni l'une ni l'autre : la fenêtre est glissante et sans plafond | **Non conforme** |
| La rotation ne doit pas prolonger la durée au-delà du premier token | La rotation repose `expires_at` à `now + 1 an` | **Non conforme, et c'est littéralement le contraire** |

Ce n'est pas une subtilité théorique : la RFC en donne la raison dans la même section — plafonner à la durée du premier token est ce qui empêche un token volé de rester utilisable indéfiniment.

**Ce qui est demande, et ce qui ne l'est pas.** La RFC 10017 est **scopée aux applications navigateur**. Le client mobile, lui, relève de la RFC 8252 et garde ses jetons dans `expo-secure-store` (Keychain / Keystore) : son refresh glissant d'un an n'est pas remis en cause par ce document. La correction est donc **par type de lignée**, pas globale : le modèle porte déjà un `lineage_id` « génère côté serveur au login et recopie à chaque rotation », ce qui est exactement le crochet où accrocher une politique de durée différenciée. C'est quelques lignes dans le service d'auth et un champ sur la ligne `auth_tokens`, pas une refonte.

**Valeurs proposées pour la lignée navigateur**, à confirmer par l'owner : durée absolue **30 jours** depuis l'ouverture de session (non reposée par la rotation), expiration par inactivité **14 jours**. Le TTL DynamoDB existant (`expire_at` = `expires_at` + 7 jours) continue de nettoyer derrière.

### 1.3 Une app web en lecture ne demande aucun endpoint nouveau

Vérifie en listant les routes que le client mobile appelle (`mobile/src/services/*.ts`) et en les confrontant aux routeurs du dépôt. Les dix-huit routes de lecture qui servent les six surfaces de l'owner existent toutes, et toutes avec ce qu'une app de bureau demande :

| Surface demandée par l'owner | Routes de lecture | Déjà paginé / filtrable ? |
|---|---|---|
| Ajouts récents | `GET /api/media`, `GET /api/engagements/recent`, `GET /api/folders/unsorted-count` | Oui : `cursor`, `limit` (1-100), `sort` |
| Bibliothèque : liste et dossiers | `GET /api/media` (avec `folder_id`, `q`, `source`, `type`, `status_filter`), `GET /api/folders` | Oui, et `folder_id` « includes subfolders » |
| Fiche media, lecteur de transcript | `GET /api/media/{id}`, `GET /api/media/{id}/raw-content` | Oui |
| Artefacts IA | `GET /api/artifacts`, `GET /api/artifacts/{id}`, `GET /api/artifacts/{id}/content` | Oui |
| Onglet digest (quotidien, hebdo) | `GET /api/digest/daily`, `GET /api/digest/weekly`, `GET /api/digest/settings` | Oui |
| Recherche | `GET /api/search/transcripts` | Oui |
| Réglages du compte, abonnement compris | `GET /api/auth/me`, `GET /api/v1/entitlements`, `GET /api/pricing` | Oui, et `/entitlements` porte déjà `is_beta_access` |

Deux conséquences :

1. **Le lot W0 n'a presque rien à faire côté backend** : la session (§6) et le CORS (§1.1). Tout le reste du chemin de lecture est du câblage front.
2. **Le drapeau de beta est déjà la.** `media_summarizer/api/endpoints/entitlements.py:65-66` rend `is_free_trial` et `is_beta_access`, et `mobile/src/lib/subscriptionDisplay.ts:73-78` montre comment l'app s'en sert — un fichier `lib/` pur, donc importable par l'app web sans adaptation (§4). L'app web masque donc l'abonnement exactement comme le mobile, en lisant le même champ et en réutilisant la même fonction.

---

## 2. Le périmètre fonctionnel de l'app web, surface par surface

Les six surfaces sont celles que l'owner a écrites. Le tableau les met en face de ce qui existe côté mobile — pour mesurer, pas pour recopier. « Lignes RN » est le compte de lignes des écrans et composants mobiles qui portent cette surface ; c'est l'assiette du chiffrage de §7, pas une promesse de conversion ligne pour ligne.

| # | Surface | Écrans et composants mobiles | Lignes RN | Lecture seule possible ? | Lot |
|---|---|---|---|---|---|
| 1 | **Ajouts récents** | `(tabs)/inbox.tsx`, `HomeTile`, `useHomeSections`, `home_unsorted_review_card` | 1 539 | Oui (la revue des non classés est une écriture) | W1 |
| 2 | **Bibliothèque : liste et dossiers** | `media/folders/index.tsx`, `media/folders/[id].tsx`, `MediaListCard`, `SubfolderCard` | 2 082 | Oui (création, renommage, déplacement sont des écritures) | W1 |
| 3 | **Fiche media, transcript, artefacts** | `media/[id].tsx`, `CompletedDetailView`, `MediaDetailHero`, `TranscriptReader`, `ArtifactsPanel`, `ArtifactTile`, `artifacts/[artifactId].tsx`, `ArtifactHistoryRow` | 5 171 | Oui (la **génération** d'artefact est une écriture) | W1 |
| 4 | **Onglet digest** | `(tabs)/digest/index.tsx`, `digest/[period].tsx`, `DigestCoverStack` | 1 212 | Oui, entièrement | W2 |
| 5 | **Recherche** | `(tabs)/search.tsx`, `lib/highlightSnippet.ts` | 1 671 | Oui, entièrement | W2 |
| 6 | **Réglages du compte, abonnement compris** | `(tabs)/account.tsx`, `SubscriptionStatusCard`, `settings/interface-language.tsx`, `settings/reading-language.tsx`, `settings/delete-account.tsx`, `paywall.tsx` | 2 889 | **En partie seulement** : l'état d'abonnement se lit, mais l'entrée vers l'abonnement doit être **masquée** (task-429) et le paywall n'a pas de contrepartie web avant W4 | W2 (lecture) + W4 (achat) |
| | **Total des six surfaces** | 26 fichiers | **14 564** | | |
| — | *Hors des six surfaces, pour mémoire* | `share-confirmation.tsx`, `unsorted-review.tsx`, `AddSourceSheet`, `UrlEntryDialog`, `FolderSaveSheet`, `RenameDialog`, `FolderPickerView`, `bug-report.tsx`, `onboarding/language.tsx` | 4 114 | Non : ce sont les écritures | W3 |

### 2.1 Ce que l'app web ne portera pas, et pourquoi

Quatre choses de l'app mobile n'ont pas de sens dans un navigateur, et il faut le dire avant que quelqu'un les mette dans un AC :

| Fonction mobile | Statut web | Raison |
|---|---|---|
| **Feuille de partage** (`expo-share-intent`) | Sans objet | Il n'y a pas de feuille de partage système dans un navigateur. Son équivalent web **est l'extension** : c'est la raison d'être de celle-ci, et c'est pourquoi les deux livrables de cette tâche sont complémentaires et non concurrents. |
| **Notifications push** (`expo-notifications`) | Hors périmètre | `expo-notifications` ne supporte ni le web ni autre chose qu'Android et iOS (`platforms: ['android', 'ios']`). Un push web passerait par la Push API du navigateur et un second enregistrement de jeton côté API : une tâche à part, pas un effet de bord. |
| **Import depuis la pellicule / le sélecteur de documents** | **Remplace**, pas porte | `expo-image-picker` et `expo-document-picker` deviennent un `<input type="file">` et l'API `File`. Le chemin d'upload lui-même (`POST /api/media/upload-url` puis `PUT` sur l'URL présignée) est identique : c'est `presignedUpload.ts` qui change d'implémentation de lecture d'octets, pas le contrat. W3. |
| **Achat integre** (`react-native-purchases`) | **Remplace** | Il n'existe pas de version web de `react-native-purchases` ; le chemin web est le Web SDK de RevenueCat, adossé à Stripe Billing. W4, et après task-429. |

### 2.2 Ce que l'app web portera et que le mobile ne porte pas

Trois choses qu'un grand écran rend évidentes et qu'il serait dommage de ne pas scoper, parce qu'elles coûtent presque rien une fois la coquille posée :

1. **Des raccourcis clavier.** `j`/`k` pour parcourir la liste, `Entree` pour ouvrir, `/` pour la recherche, `Cmd K` pour la palette. C'est du gratuit sur une liste déjà virtuelle, et c'est ce qui fait qu'une app de bureau se sent comme une app.
2. **Une vraie URL par objet.** `app.<domaine>/dossier/<id>`, `/media/<id>`, `/digest/quotidien`. Partageable, mettable en favori, rechargeable — ce que l'app mobile ne peut pas offrir. Cela impose seulement que le routeur lise l'id depuis l'URL plutôt que depuis un état de navigation.
3. **Lire à côté d'autre chose.** C'est le seul avantage que les quatre maquettes exploitent différemment, et c'est pourquoi la comparaison de §12 se joue la.

---

## 3. La stack : Astro reste-t-il le bon choix ?

### 3.1 La question posée correctement : un livrable ou deux ?

La passe 1 raisonnait sur « le site ». Avec l'app web, il y a deux objets qui n'ont rien en commun :

| | **Le site public** | **L'app web** |
|---|---|---|
| Qui le voit | un visiteur anonyme, souvent une fois | l'utilisateur connecté, souvent |
| Contenu | 6 pages fixes, dont deux écrites en Markdown dans le dépôt | 100 % de données de l'API, zéro contenu statique |
| Ce qui compte | arriver vite, être indexable, porter des URL que les stores exigent | garder l'état, ne pas recharger, répondre au clavier |
| Rendu | HTML au build | rendu client après authentification |
| Indexable | **oui, c'est le but** | **non, c'est interdit** : derrière une session |

Astro le dit de lui-même : il est « the web framework for building content-driven websites like blogs, marketing, and e-commerce », là où « most modern web frameworks were designed for building web applications » qui excellent sur « logged-in admin dashboards, inboxes, social networks ». Il ajoute, honnêtement, qu'il « scale up to performant, powerful, dynamic web applications » — mais le choix d'outil n'a pas à être un pari sur cette montée en charge quand on peut prendre les deux outils pour leurs deux métiers.

**Et la RFC 10017 fournit l'argument qui transforme ce confort en recommandation.** §9.4 :

> « Browsers key many of their protections to the origin `<scheme, hostname, port>`. Deploying one application per origin allows the application to leverage these protections, and also simplifies the configuration of CORS and CSP. »

Deux origines, donc : `www.<domaine>` (statique, aucune session, aucune donnée) et `app.<domaine>` (session, données personnelles, CSP serrée). Un XSS dans une page marketing ne touche alors pas le cookie de session de l'app. C'est gratuit : les deux vivent sur le même domaine et le même hébergeur.

### 3.2 Les candidats pour l'app connectée, sur une grille commune

Versions relevées sur `registry.npmjs.org` le **2026-10-06**.

| Critère | **Vite + React + React Router** (recommandé) | **Next.js** | **TanStack Start** | **SvelteKit** | **Astro + îlots React** | **Expo Router web (RNW)** |
|---|---|---|---|---|---|---|
| Version, date | Vite **8.3.3** (2026-10-06) · react-router **8.4.0** (2026-09-15) | **16.3.8** (2026-09-30) | **1.168.60** (2026-09-30) | **3.0.1** (2026-10-06) | astro **7.3.6** (2026-10-06) | expo **55** dans le dépôt (latest 57.0.27) · react-native-web **0.21.3** (2026-09-25) |
| Téléchargements npm / 30 j | 229,8 M (react-router) | 253,4 M | 65,9 M | 11,7 M | 25,4 M | 28,1 M (rnw) |
| Licence | MIT | MIT | MIT | MIT | MIT | MIT |
| **Serveur à opérer ?** | **Non** : `ssr: false` produit un `index.html` pré-rendu + des assets | Oui en pratique (ou un adaptateur edge à maintenir) | Oui : c'est un framework full-stack | Oui, ou un adaptateur statique avec les mêmes limites qu'un SPA | Non | Non (`expo export --platform web`) |
| Même langage de composants que `mobile/` | **Oui**, React 19 est déjà la version du dépôt | Oui | Oui | **Non**, Svelte | Oui pour les îlots | Oui, et les mêmes primitives |
| Routes par fichier | Oui | Oui | Oui | Oui | Oui, mais pensées pour des pages | Oui (`expo-router`) |
| Chargement de données par route | `clientLoader` / `clientAction` | server + client | server-first | `load` | à la main dans l'îlot | `useEffect` / data loaders |
| Ce que ça coûte d'apprendre | le moins : un routeur | un modèle serveur/client, le cache, les limites de l'edge | un modèle full-stack neuf | un second langage de composants | une frontière îlots / pages à tenir | le modèle RN **plus** ses écarts web |
| Adapte à une app derrière session | Oui | Oui, mais on paye un serveur pour du contenu qui n'est jamais public | Oui, idem | Oui, idem | **Mal** : il faudrait un îlot géant avec son propre routeur client | Oui |
| Verdict | **Recommandé** | Rejeté : le SSR n'acheté rien derrière une session, et ajoute un runtime à opérer | Rejeté, même raison | Rejeté : un second langage de composants pour un développeur seul | Rejeté pour l'app, **retenu pour le site public** | Rejeté, §3.3 |

Le point qui tranche n'est pas la popularité : c'est qu'une app **entièrement derrière une session** ne tire **rien** du rendu serveur. Il n'y a pas de SEO à gagner (il est interdit), pas de premier rendu à accélérer pour un visiteur anonyme (il n'y en a pas), et pas de donnée à pre-charger sans le jeton de l'utilisateur. Tout ce que le SSR apporterait ici, c'est un runtime à déployer, à surveiller et à facturer. React Router documente exactement le mode dont on a besoin :

> « When using React Router as a framework, you can enable 'SPA Mode' by setting `ssr:false` in your `react-router.config.ts` file. This will disable runtime server rendering and generate an `index.html` at build time that you can serve and hydrate as a SPA. »
> « After running `react-router build`, deploy the `build/client` directory to whatever static host you prefer. »
> — <https://reactrouter.com/how-to/spa> (lu le 2026-10-06)

Deux contraintes de ce mode, à connaître et à écrire dans la tâche d'implémentation, parce qu'elles surprennent :

- **La route racine est rendue au build, en Node.** « you can't call `window` or other browser-only APIs during the initial render, even when server rendering is disabled », et le projet garde une dépendance à `@react-router/node`. Le `HydrateFallback` de la racine est donc le seul endroit où l'écran d'attente se dessine.
- **Aucun `loader` serveur ailleurs qu'a la racine** : « You cannot include à `loader` in any other routes in your app when using SPA Mode unless you are pre-rendering those pages. » Tout passe par `clientLoader`. C'est ce qu'on veut de toute façon : chaque chargement porte le jeton de l'utilisateur.
- **L'hôte doit réécrire toutes les URL vers `index.html`.** Cloudflare le fait avec une ligne (§5).

### 3.3 React Native Web : l'option à prendre au sérieux, puis à refuser

C'est le candidat qu'il fallait instruire, parce que si l'app web pouvait sortir de `mobile/` par une commande, tout le reste de ce benchmark serait sans objet. Les faits d'abord, le refus ensuite.

**Ce qui marche vraiment.** Expo documente une cible web de première classe : on installe `react-dom`, `react-native-web` et `@expo/metro-runtime`, on lance `npx expo start --web`, on produit avec `npx expo export --platform web`. Le dépôt a même déjà le script (`"web": "expo start --web"` dans `mobile/package.json`), et le registre npm publie bien un `@expo/metro-runtime` sous le tag `sdk-55`, c'est-a-dire la version du dépôt (55.0.12). `react-native-web` lui-même est sain : 0.21.3 publié le **2026-09-25**, 28,1 M de téléchargements sur trente jours, et Expo rappelle que RNW fait tourner le site de X. Ce n'est pas une impasse technique.

**Ce qu'il faudrait remplacer.** Sur les 31 dépendances de `mobile/package.json`, celles qui ne tournent pas dans un navigateur :

| Dépendance | Statut web | Ce qu'il faudrait |
|---|---|---|
| `expo-secure-store` | **Non supporté** : « Android, iOS, tvOS, Included in Expo Go » | Un adaptateur. Et de toute façon la session web ne doit pas stocker de jeton (§6). |
| `expo-notifications` | **Non supporté** : `platforms: ['android', 'ios']` | Rien, hors périmètre (§2.1) |
| `react-native-purchases` | Pas de cible web | Le Web SDK de RevenueCat (§11) |
| `expo-share-intent` | Natif seulement | Rien : c'est l'extension (§2.1) |
| `expo-glass-effect` | **iOS et tvOS seulement**, et « only available on iOS 26 and above » | Degrade en `View` — donc le matériau du `GlassSurface` disparaît |
| `expo-image-picker`, `expo-document-picker`, `expo-file-system` | Partiel / natif | `<input type="file">` + API `File` |
| `@sentry/react-native` | SDK distinct côté navigateur (`@sentry/react` 11.4.0, 2026-10-02) | Un adaptateur dans `lib/crashReporting.ts` |

Sept dépendances à traiter, dont deux qui disparaissent et cinq qui demandent un adaptateur. Pris isolement, c'est faisable.

**Pourquoi c'est quand même non.** Un seul argument, et il suffit : **ce qu'on réutiliserait n'est pas réutilisable.**

Les 22 901 lignes de `mobile/app` (12 912) et `mobile/src/components` (9 989) ne sont pas des composants génériques : ce sont des **mises en page de téléphone**. Une barre d'onglets basse de 64 px (`a-tabbar` dans les maquettes existantes), une colonne unique, des feuilles modales qui montent du bas (`AddSourceSheet`, `FolderSaveSheet`, `RenameDialog`), un `SafeAreaView`, des cibles tactiles de 48 px minimum, une liste virtualisée à une colonne. Les quatre maquettes de cette passe (§12) montrent ce qu'une app de bureau demande à la place : des volets, une arborescence permanente, un tableau triable, une marge d'artefacts, une palette de commandes. **Aucune de ces structures n'existe dans `mobile/app`.**

Donc, avec RNW, on paierait :

- un second bundler (Metro) à faire cohabiter avec la CI mobile, pour produire un artefact web ;
- sept adaptateurs de dépendances ;
- l'écriture en `View`/`Text` plutôt qu'en HTML, donc un surcoût permanent sur tout ce qui est du ressort du navigateur : CSS Grid, `position: sticky`, `backdrop-filter`, le focus clavier, `::selection`, les media queries de conteneur — exactement ce que les quatre maquettes utilisent ;
- et la contrainte que chaque correction d'un composant partage soit testée sur trois plateformes au lieu d'une ;

…pour réutiliser **zéro** mise en page et une poignée de composants atomiques (une puce, une jauge) qui se réécrivent en dix lignes de CSS.

Le partage utile n'est pas la. Il est dans la couche en dessous, qui ne dépend d'aucune primitive de rendu — et c'est précisément ce que §4 mesure.

> **A noter pour l'avenir, sans l'acter** : si un jour une app de bureau *native* (Electron, Tauri) devenait un sujet, RNW redeviendrait une option, parce que la question serait alors « une app, trois plateformes » et non « deux formes d'interface ». Ce n'est pas la question ici.

### 3.4 Le site public : Astro, inchangé

Rien de ce que la passe 1 a conclu n'est périmé pour les six pages publiques (`/`, `/extension`, `/abonnement`, `/privacy`, `/terms`, `/support`) :

- Astro **7.3.6** (2026-10-06, MIT) rend du HTML statique par défaut, sans hydratation à écrire.
- Le point décisif reste le même : `/privacy` et `/terms` doivent rester **la version du dépôt** (`docs/compliance/*.md`), ce qu'une collection de contenu Astro lit directement. task-357 insiste sur « où vit le texte », et un générateur qui lit les `.md` existants est ce qui évite une seconde version du texte légal.
- `/.well-known/apple-developer-domain-association.txt` reste un fichier statique à la racine publique.
- Pas de mesure d'audience au premier lot : elle ajouterait un bandeau de consentement et une mention dans la politique de confidentialité pour une donnée que personne n'exploitera.

**Un seul ajout** : la page `/abonnement` publique, au lot W0, est une **page de prix non connectée et sans bouton** — et pendant la beta elle ne doit pas non plus promettre un achat imminent. Le bouton arrive avec W4.

---

## 4. Partage de code avec `mobile/` : la réponse a changé, et voici la mesure

La passe 1 concluait « rien d'utile n'est partageable » (rejeté §3.4). L'owner demande de reposer la question pour une app web « qui réaffiche les mêmes artefacts ». La réponse est oui, et elle se mesure.

### 4.1 L'inventaire, couche par couche

Comptes obtenus sur le dépôt le **2026-10-06** (`wc -l` sur `mobile/app` et `mobile/src`, total 44 202 lignes de `.ts`/`.tsx`). « Couple » signifie : le fichier importe `react-native` ou un module `expo-*`.

| Couche | Lignes | Fichiers | Dont couplés | Lignes couplées | **Importable tel quel** |
|---|---|---|---|---|---|
| `src/i18n` (11 catalogues + runtime) | 8 735 | 15 | 1 (`index.tsx`, le provider) | 264 | **8 471** |
| `src/lib` (fonctions pures de domaine) | 3 677 | 28 | 6 | 946 | **2 731** |
| `src/services` (clients d'API) | 3 062 | 21 | 7 | 1 141 | **1 921** |
| `src/types` (contrats) | 1 236 | 8 | 1 (`sharedContent.ts`) | 252 | **984** |
| `src/constants` (dont `theme.ts`) | 348 | 2 | 0 | 0 | **348** |
| **Sous-total logique** | **17 058** | **74** | **15** | **2 603** | **14 455** |
| `src/contexts` | 2 025 | 4 | — | — | partiellement (voir 4.2) |
| `src/hooks` | 2 218 | 12 | — | — | partiellement |
| `src/components` | 9 989 | 33 | tous | — | **0** |
| `app/` (écrans) | 12 912 | 26 | tous | — | **0** |

**14 455 lignes directement importables par une app web React**, sans RNW, sans adaptateur, sans refactoring : **33 % du code mobile total, et 85 % de sa couche logique.** C'est le chiffre qui renverse la conclusion de la passe 1.

Les quinze fichiers couplés, et par quoi :

| Fichier | Lignes | Couple par | Coût de l'adaptateur |
|---|---|---|---|
| `services/tokenStorage.ts` | 64 | `expo-secure-store` | **Nul** : la session web n'a pas de jeton à stocker (§6) |
| `services/authService.ts` | 152 | `expo-*` | Faible : les deux ou trois appels de stockage derrière une interface |
| `services/purchaseService.ts` | 190 | `react-native-purchases`, `Platform` | Remplace par le Web SDK (W4) |
| `services/pushNotificationService.ts` | 233 | `expo-notifications`, `Platform` | Hors périmètre |
| `services/sharedContentService.ts` | 185 | `Platform` | **Trivial** : `Platform.OS` sert à calculer `source_app` |
| `services/localFileTransfer.ts` | 269 | `expo-file-system` | Réécrit avec l'API `File` (W3) |
| `services/feedbackService.ts` | 48 | `expo-*` | Faible |
| `lib/crashReporting.ts` | 328 | `@sentry/react-native` | Un adaptateur vers `@sentry/react` |
| `lib/localImport.ts` | 246 | `expo-image-picker`, `expo-document-picker` | Réécrit (W3) |
| `lib/googleOAuth.ts` | 60 | `expo-auth-session` | Remplace par le flux web (§6) |
| `lib/deviceTimezone.ts` | 49 | `expo-localization` | **Trivial** : `Intl.DateTimeFormat().resolvedOptions().timeZone` |
| `lib/usageWarningDismissal.ts` | 41 | stockage | Trivial |
| `lib/startupErrorGuard.ts` | 222 | `react-native` | Spécifique au démarrage natif, non nécessaire |
| `types/sharedContent.ts` | 252 | `expo-share-intent` | Non nécessaire (pas de feuille de partage web) |
| `i18n/index.tsx` | 264 | `Alert`, `I18nManager`, `expo-localization`, `expo-secure-store` | **Un provider web de ~80 lignes**, qui lit les mêmes `CATALOGS` |

### 4.2 Ce que le partage acheté, concrètement

Ce n'est pas « quelques interfaces ». C'est :

- **Les 11 catalogues i18n** (8 471 lignes, ~900 clés chacun), y compris les familles de pluriel et l'arabe en RTL. Les dupliquer serait garantir qu'ils divergent dès la première tâche produit.
- **Le modèle de domaine complet** : `types/media.ts` (328 lignes) porte les statuts, les types de media, les plateformes source ; `types/artifacts.ts` les cinq types d'artefact ; `types/upload.ts` le contrat d'upload.
- **Les règles métier qu'une app web doit reproduire à l'identique sous peine de mentir** : `lib/planCopy.ts` (661 lignes, la formulation des paliers et des quotas), `lib/quotaError.ts` (170, l'interprétation d'un 429), `lib/getFriendlyErrorMessage.ts` (312, la table de correspondance code d'erreur → clé i18n), `lib/subscriptionDisplay.ts` (147, dont la lecture de `is_beta_access`), `lib/folderTree.ts` (171, la construction de l'arborescence), `lib/highlightSnippet.ts` (244, le surlignage des résultats de recherche), `lib/mediaTitle.ts`, `lib/mediaTypeDisplay.ts`, `lib/relativeTime.ts`, `lib/formatDuration.ts`, `lib/artifact*.ts`.
- **Les clients d'API** : `apiClient.ts` (93) et les treize services qui l'utilisent — y compris la pagination par curseur et la gestion des erreurs HTTP (`lib/httpError.ts`).

Pris ensemble, c'est **la différence entre une app web qui dit la même chose que l'app mobile et une app web qui dit à peu près la même chose**. Sur les refus de quota et la formulation des paliers, « à peu près » est un bug.

### 4.3 Comment partager : trois formes, et pourquoi la plus pauvre gagne au lot W0

| | **A. Alias de build vers `mobile/src`** (recommandé) | **B. `packages/core` en espace de travail npm** | **C. Pas de partage, duplication** |
|---|---|---|---|
| Ce qu'on fait | le projet web déclare `resolve.alias` (Vite) + `paths` (tsconfig) vers `../mobile/src/{types,lib,services,i18n,constants}` | on déplace ces cinq dossiers dans `packages/core`, et `mobile/` comme `web/` l'importent | on recopie |
| Touche à `mobile/package.json` | **Non** | Oui | Non |
| Touche à Metro / au build EAS | **Non** : Metro ne voit pas le dossier web, qui n'est pas dans son `projectRoot` | **Oui** : `watchFolders`, résolution monorepo, et le build EAS doit embarquer le paquet | Non |
| Risque sur la CI mobile | **Nul** | Réel. `task-186` documente qu'un simple nom de cible mal choisi a tue un build EAS en `XCODE_BUILD_ERROR` : c'est le chemin fragile du dépôt | Nul |
| Qui casse en cas de refactoring mobile | le build web, visiblement, au `tsc` | personne (le contrat est explicite) | personne (et c'est le problème : la copie dérive en silence) |
| Comment on empêche un import couple | une règle de lint qui interdit `react-native` et `expo-*` sous l'alias, ou simplement l'échec du bundler | la frontière du paquet | rien |
| Coût initial | ~0 j | 1 à 2 j, dont la moitié à revalider la CI mobile | 0 j, puis une dette permanente |

**Recommandation : A au lot W0, B quand un troisième consommateur apparaît** — c'est-a-dire quand l'extension voudra `quotaError.ts` et deux clés i18n (lot X1 ou X2). Le déclencheur est explicite, ce qui évite la discussion.

Et une nuance par rapport à la règle « order cleanups first » du `CLAUDE.md` : B **n'est pas** une restructuration que W1 à W4 viendraient peupler. Les cinq dossiers ne changent pas de contenu ; seule leur adresse change. Passer de A à B est une tâche mécanique (un `git mv`, deux lignes de configuration), pas une migration — et la faire plus tard ne fait rien faire deux fois. Ce qui serait à faire deux fois, c'est l'inverse : revalider le build EAS maintenant, pour un partage dont on n'a pas encore vérifié la forme.

---

## 5. Hébergement

Le fournisseur est celui de task-357 (Cloudflare) et ce benchmark ne le rediscute pas. Ce qui change avec l'app web, c'est **ce qu'on y pose** : deux projets au lieu d'un, et un mode SPA à activer.

### 5.1 Ce que Cloudflare Workers static assets offre, et ce que ça coûte

| Fait | Source |
|---|---|
| **« Requests to static assets are free and unlimited. »** Les requêtes qui atteignent le code du Worker, elles, sont facturées au tarif Workers | <https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/> |
| **« There is no additional cost for storing Assets. »** | idem |
| **`not_found_handling = "single-page-application"`** : « Sets your application to return à `200 OK` response with `index.html` for requests which don't match a static asset » — exactement la réécriture que React Router demande | <https://developers.cloudflare.com/workers/static-assets/> |
| **`not_found_handling = "404-page"`** pour le site public, qui veut de vrais 404 | idem |
| Limites de l'offre gratuite : **20 000 fichiers** par version (100 000 en payant), **25 MiB** par fichier, aucun plafond de taille totale documenté | <https://developers.cloudflare.com/workers/platform/limits/> |
| Offre gratuite Workers : **100 000 requêtes/jour**, 10 ms de CPU par requête | idem |

Conséquence chiffrée : **l'app web ne consomme pas le quota de 100 000 requêtes/jour**, parce qu'une SPA ne sert que des assets statiques et appelle l'API AWS directement. Le quota Workers ne devient un sujet que si l'on choisit le BFF de §6.3, qui fait passer chaque appel d'API par le Worker. C'est un coût cache de cette option, et il est quantifié : une session de lecture de 50 medias fait de l'ordre de 100 à 200 requêtes d'API, donc ~500 sessions/jour avant de toucher le plafond gratuit.

### 5.2 Les deux projets, et ce qu'ils servent

| Origine | Projet | Contenu | `not_found_handling` | Session |
|---|---|---|---|---|
| `www.<domaine>` (et l'apex en redirection) | site public | build Astro : 6 pages, `/.well-known/…` | `404-page` | aucune |
| `app.<domaine>` | app web | `build/client` de React Router | `single-page-application` | cookie de l'API |
| `api.<domaine>` | — | inchangé : API Gateway → Lambda | — | émet le cookie |

### 5.3 Les alternatives, pour mémoire

| Option | Pour | Contre | Verdict |
|---|---|---|---|
| **Cloudflare Workers static assets** | 0 $, requêtes d'assets illimitées, mode SPA documenté, même fournisseur que task-357, même zone DNS | il faut deux projets | **Recommandé** |
| S3 + CloudFront (tout chez AWS, en Terraform) | tout dans l'IaC existante ; ferait fonctionner l'alias `api` tel qu'il est déjà écrit | un module Terraform neuf, une fonction CloudFront ou une règle d'erreur 403→`index.html` pour le mode SPA, un coût non nul, et **la perte d'Email Routing** que task-357 juge décisive | Rejeté, pour les raisons de task-357 §3 |
| EAS Hosting | recommandé par Expo, zéro configuration | n'a de sens que si l'app web sort de `mobile/` par `expo export`, c'est-a-dire avec RNW — rejeté en §3.3 ; et ça ajoute un fournisseur | Rejeté |
| Cloudflare Pages | fonctionne | Cloudflare écrit « Start new projects with Workers » (rejeté §0.5) | Rejeté pour un projet neuf |

---

## 6. Authentification : une session complète dans le navigateur

C'est le point que l'owner a explicitement demande de réinstruire — « rafraîchissement, déconnexion, multi-onglets, là où le README ne prévoyait une session que sur la page d'abonnement ».

### 6.1 Ce qui existe, lu dans le dépôt

- Les sessions s'ouvrent par `POST /api/auth/google/native`, `/apple/native`, `/register` ou `/login`. Toutes rendent `access_token` **et** `refresh_token` **dans le corps JSON**.
- `GET /api/auth/google/callback` et `/apple/callback` existent mais « **N'émet aucun token de session** : il n'y a plus de client web pour en recevoir » (task-293). Le seul cookie encore posé est `oauth_state_<provider>`, garde CSRF de 10 minutes — et c'est la preuve que **l'API sait déjà poser un cookie à travers API Gateway** (`auth_social.py:91`, `response.set_cookie`), donc le transport n'est pas à construire.
- L'access token est un JWT de 60 min (`JWT_ACCESS_TOKEN_EXPIRE_MINUTES`), et `get_current_user` relit l'utilisateur en DynamoDB à chaque requête — donc raccourcir sa durée ne coûte que des rafraîchissements, jamais de la cohérence.
- Le refresh est opaque, en base, **glissant sur un an sans plafond**, rotate à chaque `/refresh` avec une fenêtre de rejeu de 60 s, et porte un `lineage_id` qui est « l'identité de la session d'un appareil […] et c'est ce que /logout révoque ».

Deux détails de ce modèle sont des **cadeaux** pour une app web, et il faut les nommer :

1. **La fenêtre de rejeu de 60 s** (task-294) : « Un token consomme depuis moins de 60 s rejoue le couple déjà émis au lieu de répondre 401 ». C'est exactement le remède au problème classique du multi-onglets, où deux onglets rafraîchissent en même temps et l'un invalide l'autre. Le mécanisme est déjà la.
2. **Le `lineage_id`** : une lignée par session de navigateur, révocable seule. « Se déconnecter de ce navigateur » existe déjà côté modèle.

### 6.2 Ce que la RFC 10017 impose, et ce qu'elle recommande

La RFC 10017 (BCP 212, août 2026) classe trois patrons « in decreasing order of security » (§6) :

| Patron | Qui détient les jetons | Ce que la RFC en dit |
|---|---|---|
| **Backend For Frontend (BFF)** | un composant serveur, session par cookie, qui **proxifie** chaque appel | « This architecture is strongly recommended for business applications, sensitive applications, and applications that handle personal data. » |
| **Token-mediating backend** | le backend obtient les jetons et remet **l'access token** au front | à n'adopter que si l'on a vérifié qu'un BFF complet n'est pas viable |
| **Browser-based OAuth client** | tout dans le navigateur, client public, Authorization Code + PKCE | « vulnerable to all attack scénarios » quand du code malveillant s'exécute |

Et un quatrième cas, souvent oublié, qui est **exactement le notre** (§7.1, « Single-domain apps not using OAuth ») : un front navigateur et un backend de la même organisation, où « server-side cookie sessions are often enough », OAuth ayant été conçu « for third-party or federated access to APIs ». Notre app web n'est pas un client OAuth de notre API : c'est une interface de première partie sur une session maison. Le Sign-in Google ou Apple est un flux OAuth **en amont**, qui produit *notre* session, pas un jeton Google que l'app web porterait.

Sur le stockage, §8.2 est sans ambiguïté :

> `localStorage` : « does not protect against unauthorized access from malicious JavaScript »
> Cookies écrits par JS : « this practice is NOT RECOMMENDED »
> Service Worker : « MUST NOT store tokens in any persistent storage API that is shared with the main window »
> et, globalement : « none of these options can fully mitigate token exfiltration »

### 6.3 Les quatre options, sur la même grille

| | **A. Jetons en JS (`localStorage`)** | **B. Cookie `HttpOnly` de rafraîchissement + access en mémoire** (recommandé) | **C. BFF sur Cloudflare Worker** | **D. Pas de session : liens à usage unique depuis le mobile** |
|---|---|---|---|---|
| Ce que le navigateur détient | refresh **et** access, lisibles par tout script | **rien de persistant** : un cookie que JS ne lit pas, et un access token dans une variable de module | rien du tout | un jeton court, le temps d'une page |
| Survit à un rechargement | oui | **oui** (le cookie rejoue `/refresh`) | oui | **non** |
| Multi-onglets | oui, et les onglets se volent la rotation | **oui**, le cookie est partage ; la course est arbitrée par la fenêtre de 60 s + un verrou `navigator.locks` | oui | sans objet |
| Déconnexion | effacer le stockage + `/logout` | **`/logout` + suppression du cookie**, côté serveur, donc fiable | idem | sans objet |
| **Changements backend** | **aucun** | **bornes** : un drapeau de client sur les 4 endpoints d'ouverture de session, pose et suppression du cookie, lecture du cookie dans `/refresh`, et la politique de durée par lignée (§1.2) | les mêmes, plus un Worker | aucun au-delà de l'appairage |
| **Changements infra** | CORS : `allow_origins` explicite suffit | CORS : `allow_origins` explicite **et** `allow_credentials = true` (§1.1) | **aucun CORS** (même origine), mais un Worker à déployer et un secret de chiffrement de cookie à gérer hors Secrets Manager | CORS explicite |
| Conformité RFC 10017 | **non** : §8.2 sur le stockage, et la durée d'un an viole §6.3.2.3 | **oui**, une fois la politique de durée posée ; c'est le cas §7.1 « server-side cookie sessions are often enough » | **oui**, c'est le patron recommandé | oui, mais inutilisable |
| Surface d'attaque restante | un XSS exfiltre une session d'un an | un XSS peut **agir** pendant que l'onglet est ouvert, mais ne peut pas emporter de jeton réutilisable ailleurs | idem, et « request-proxying / client hijacking » | nulle |
| Latence par lecture | directe vers AWS | directe vers AWS | **un saut de plus** (navigateur → Cloudflare → AWS) | — |
| Coût d'exploitation | 0 | 0 | un Worker, son quota de 100 000 req/j (§5.1), sa supervision | 0 |
| Verdict | **Rejeté** | **Recommandé** | **Trajectoire**, pas lot W0 | **Rejeté** : l'owner veut consulter sa bibliothèque, pas cliquer un lien depuis son téléphone à chaque fois |

**Sur le BFF, pour être juste avec l'option que la RFC recommande le plus fort.** Son avantage est réel et il n'est pas théorique : aucun jeton n'atteint le navigateur, et il n'y a plus de CORS du tout. Ce qui le fait attendre, ce sont trois coûts concrets, aucun insurmontable, tous nouveaux :

1. **Un secret de chiffrement de cookie** qui vit chez Cloudflare et non dans Secrets Manager — donc une seconde autorité de secrets dans un projet qui n'en a qu'une (`AGENTS.md`, task-252).
2. **Un saut réseau sur chaque lecture.** Une fiche media, c'est trois à cinq appels ; une bibliothèque qu'on parcourt, des dizaines.
3. **Le quota gratuit de 100 000 requêtes/jour** devient la limite de l'app, alors qu'en option B les requêtes d'assets sont « free and unlimited » et les appels d'API vont directement à AWS.

Le déclencheur pour y passer, à écrire noir sur blanc : **le jour où l'app web accepte du contenu tiers dans sa page** (une intégration, un script analytics, un lecteur embarqué), parce que c'est ce qui rend l'hypothèse XSS réaliste. Tant que `app.<domaine>` ne charge que son propre bundle sous une CSP qui l'interdit, l'écart entre B et C se réduit à « un XSS qui n'existe pas ».

### 6.4 Pourquoi B, et ce qu'elle coûte exactement

Les trois arguments, par ordre de force :

1. **C'est le seul compromis qui enlève le jeton du JavaScript sans ajouter un composant à opérer.** L'app web ne voit jamais le refresh token ; elle appelle `/api/auth/refresh` avec `credentials: 'include'` et reçoit un access token qu'elle garde en mémoire. Un script injecté peut faire des requêtes pendant que l'onglet est ouvert — ce qu'aucune architecture navigateur n'empêche, la RFC le dit — mais il ne peut pas emporter un porteur d'un an.
2. **Le transport existe déjà.** L'API pose un cookie aujourd'hui (`oauth_state_<provider>`), à travers API Gateway HTTP API en payload 2.0. Il n'y a rien à découvrir sur ce chemin.
3. **La politique de durée est de toute façon obligatoire** (§1.2). Une fois qu'on écrit un plafond par lignée, le cookie ne coûte presque plus rien : c'est le même endpoint, une réponse qui pose un `Set-Cookie` au lieu d'un champ JSON.

Ce que ça coûte, précisément, au lot W0 :

| Travail | Ou | Taille |
|---|---|---|
| Un drapeau de client sur `/login`, `/register`, `/google/native`, `/apple/native` : « session de navigateur » → le refresh part en cookie et **pas** dans le corps JSON | `media_summarizer/api/endpoints/auth.py`, `auth_social.py` | petit |
| `/refresh` lit le cookie quand il est la, et repose un cookie neuf à la rotation | idem | petit |
| `/logout` supprime le cookie en plus de révoquer la lignée | idem | très petit |
| **Politique de durée par type de lignée** : plafond absolu + inactivité (§1.2) | service d'auth + un champ sur `auth_tokens` | **moyen — c'est le vrai morceau** |
| Attributs du cookie : `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/api/auth`, pas d'attribut `Domain` (host-only sur `api.<domaine>`) | idem | très petit |
| `cors_configuration` : origine explicite + `allow_credentials = true`, et `CORS_ORIGINS` aligné | `lambda_api.tf`, variables d'environnement | **une ligne chacun, mais bloquantes** |
| `docs/AUTHENTICATION_SETUP.md` : la section CORS corrigée (deux étages), la session navigateur décrite, la politique de durée écrite | doc | petit |

**Pourquoi `SameSite=Lax` suffit, et pourquoi ce n'est pas un pari.** `app.<domaine>` et `api.<domaine>` partagent le même domaine enregistrable : une requête de l'un vers l'autre est *same-site* au sens de l'attribut `SameSite`, qui raisonne en « site » et non en « origine ». Le cookie est donc envoyé sur les appels de l'app et **pas** sur une requête venue d'un site tiers — c'est la protection CSRF qu'on cherche. `Strict` fonctionnerait aussi pour l'app, mais casserait le cookie d'état OAuth au retour de Google ; `Lax` est déjà la valeur retenue pour `oauth_state_<provider>`.

> **A vérifier à l'implémentation, pas ici** : que le `Set-Cookie` traverse bien API Gateway HTTP API en payload 2.0 **sur une réponse cross-origin lue par un `fetch` avec `credentials: 'include'`**. Le cookie d'état OAuth existant est posé sur une **navigation**, pas sur un `fetch` : le chemin est le même côté serveur, mais il n'a jamais été exercé depuis un XHR. §13, point 2.

### 6.5 Rafraîchissement, déconnexion, multi-onglets : le détail demande

| Situation | Comportement retenu |
|---|---|
| **Au chargement de l'app** | Aucun access token en mémoire → un `POST /api/auth/refresh` immédiat, dans le `clientLoader` de la route racine. S'il répond 401, on va à l'écran de connexion. C'est la seule façon de savoir si la session vit, le cookie étant illisible par JS. |
| **Expiration de l'access token** | Un intercepteur dans `apiClient.ts` : sur un 401, un seul rafraîchissement, puis la requête est rejouée. `apiClient.ts` fait 93 lignes et porte déjà la notion d'erreur HTTP (`lib/httpError.ts`) : c'est le bon endroit, et il est partage avec le mobile (§4). |
| **Deux onglets rafraîchissent en même temps** | Un verrou `navigator.locks.request('session-refresh', …)` sérialise les rafraîchissements d'une même origine. Et si le verrou manque, la **fenêtre de rejeu de 60 s** du backend (task-294) rend la course inoffensive : le second appel reçoit le couple déjà émis au lieu d'un 401. Deux filets, dont un déjà en place. |
| **Un onglet se déconnecte** | `POST /api/auth/logout` révoque la lignée et supprime le cookie. Les autres onglets le découvrent à leur prochain appel (401 → `/refresh` → 401 → connexion). Un `BroadcastChannel` peut les prévenir tout de suite : c'est du confort, pas de la sécurité. |
| **Inactivité longue** | Au-delà de la fenêtre d'inactivité (14 j propose), le refresh est mort côté serveur : reconnexion. C'est l'exigence de la RFC, et c'est aussi ce qu'on attend d'un navigateur partage. |
| **Plafond absolu atteint** | Reconnexion, 30 j propose. Le mobile, lui, ne change pas : sa lignée garde son régime. |
| **Fermeture du navigateur** | Le cookie est persistant, pas de session : il survit, dans les limites du plafond et de l'inactivité. |

### 6.6 Comment on se connecte : trois chemins, et ce qu'ils demandent

| Chemin | État du dépôt | Ce que W0 ajoute |
|---|---|---|
| **Email + mot de passe** | `POST /api/auth/login` existe et rend le couple en JSON | Le drapeau de session navigateur. **C'est tout.** |
| **Google** | `GET /api/auth/google/login` → `callback` existe mais n'émet aucun jeton (task-293) ; `GOOGLE_REDIRECT_URI` est déjà enregistré chez Google | Le callback pose le cookie et redirige vers `app.<domaine>`. C'est exactement ce que task-293 avait retiré **faute de client web** — il y en a un maintenant. Rien à déclarer chez Google. |
| **Apple** | `GET /api/auth/apple/login` → `callback`, même état, `client_secret` ES256 généré à la volée | Idem. Apple n'accepte que des `return URL` en `https`, ce qui est le cas de `api.<domaine>`. |

C'est le point où la décision de l'owner **simplifie** le travail au lieu de l'alourdir : les deux flux OAuth web sont déjà écrits, déjà enregistrés chez les fournisseurs, et il ne leur manque que l'émission de session que task-293 avait supprimée pour une raison aujourd'hui périmée.

> Un compte créé par Google ou Apple **n'a pas de mot de passe**, et aucun endpoint ne permet d'en poser un (constat de la passe 1, rejeté §5.2). Ce n'est plus gênant : le web offre les trois chemins, dont les deux sociaux.

---

## 7. Parité complète ou lecture d'abord : les deux chiffrées

C'est la question que l'owner demande de trancher « chiffres à l'appui ».

### 7.1 La méthode, et son incertitude

Il n'y a pas de donnée historique de vélocité dans ce dépôt, donc deux estimations indépendantes, puis leur recoupement.

**Méthode 1 — par les lots** (bottom-up) : chaque lot est découpé en écrans, chaque écran est estimé à vue, en supposant la direction de design arrêtée, la couche de données partagée (§4), et aucun test automatise (`AGENTS.md`).

**Méthode 2 — par les lignes** (top-down) : §2 compte 14 564 lignes de RN pour les six surfaces. Une re-expression web n'est pas une traduction ligne pour ligne : on perd les objets `StyleSheet`, les branches `Platform`, le `SafeAreaView`, les gestes, les props d'accessibilité natives et les animations `Reanimated` ; on gagne du CSS. Hypothèse retenue : **45 à 60 % du compte RN**, soit **6 550 à 8 740 lignes** de TSX + CSS. A **350 à 500 lignes/jour** livrées, câblage et relecture compris : **13 à 25 jours** pour la présentation des six surfaces en lecture.

Les deux méthodes se recoupent à +/- 20 %, ce qui est le mieux qu'on puisse honnêtement affirmer. **Les fourchettes ci-dessous doivent être lues comme des ordres de grandeur, pas comme un engagement** (§13, point 1).

### 7.2 Les deux scénarios

**Scénario « lecture d'abord »** — les six surfaces en lecture, puis l'écriture.

| Lot | Contenu | Jours |
|---|---|---|
| W0 | Fondations : session, CORS, coquille, i18n, connexion, hébergement | 4 – 6 |
| W1 | Ajouts récents, dossiers, liste, fiche media, transcript, artefacts en lecture | 8 – 12 |
| W2 | Digest, recherche, compte en lecture | 5 – 8 |
| | **Sous-total : une app web consultable** | **17 – 26** |
| W3 | Écriture : URL, imports, génération d'artefacts, dossiers, revue des non classés, suppression de compte | 7 – 10 |
| W4 | Abonnement (après task-429) | 4 – 6 |
| | **Total jusqu'a la parité** | **28 – 42** |

**Scénario « parité d'un coup »** — tout, au premier lot.

| Poste | Jours |
|---|---|
| Fondations (identiques) | 4 – 6 |
| Les six surfaces, lecture **et** écriture ensemble | 20 – 32 |
| Abonnement | **non livrable** (§7.3) |
| Integration et mise au point d'un lot de cette taille (un seul passage de revue sur ~30 écrans) | 4 – 8 |
| **Total** | **28 – 46**, abonnement exclu |

### 7.3 Le fait qui tranche : la parité au premier lot n'est pas disponible

**task-429 est `Done`.** Pendant la beta — trois mois, date de début **non encore annoncée** par l'owner — tout compte reçoit l'allocation du palier le plus élevé et, côté client, « aucun autre chemin ne mène au paywall ». L'app web doit se comporter comme l'app mobile : lire `is_beta_access` (`/api/v1/entitlements`), masquer l'entrée vers l'abonnement, et afficher « accès beta au palier le plus élevé » avec la jauge.

Donc **l'une des six surfaces que l'owner a listées — « les réglages du compte, abonnement compris » — ne peut pas être complète au premier lot, quel que soit le scénario.** Ce n'est pas un arbitrage de priorité, c'est une règle produit déjà implémentée. La question « parité complète dès le premier lot ? » a une réponse factuelle : non, et la partie manquante est la même dans les deux scénarios.

### 7.4 Ce que coûte le rattrapage, et pourquoi il est bon marché

Ajouter l'écriture à des écrans déjà livrés n'est pas gratuit. Ce qu'il faut rouvrir :

| Ce qu'on rouvre | Pourquoi |
|---|---|
| La fiche media | ajouter le bouton « Générer », ses états, ses refus (`lib/artifactRefusal.ts`, déjà partage) |
| La liste et l'arbre de dossiers | menus contextuels, création, renommage, déplacement, suppression, et les états optimistes qui vont avec |
| La coquille | une entrée « Ajouter » globale, une boite de dialogue d'URL, une zone de dépôt de fichiers |
| Le compte | suppression de compte, et plus tard l'abonnement |
| L'i18n | les clés d'écriture, déjà présentes dans les catalogues partagés — donc **zéro** traduction nouvelle |

Le surcoût est de l'ordre de **8 à 15 %** du coût de l'écriture elle-même : on repasse sur la structure et les états, pas sur la mise en page ni sur les textes. C'est la fourchette que donne la comparaison des deux totaux ci-dessus (28–42 contre 28–46), et elle est cohérente avec le fait que les deux scénarios partagent les mêmes fondations et les mêmes catalogues.

### 7.5 Recommandation : lecture d'abord, et la raison n'est pas le coût

Les trois totaux sont **du même ordre**. Ce n'est donc pas le prix qui décide, ce sont trois choses que le découpage acheté et que le lot unique ne peut pas offrir :

1. **Une app utilisable après 17 à 26 jours au lieu de 28 à 46.** Et ce qui est livre est exactement ce que l'owner a décrit vouloir : consulter son second cerveau dans un navigateur.
2. **Des lots qu'un agent peut implémenter.** Un lot de 30 jours n'est pas un lot : c'est un projet, qu'un seul passage ne finit pas et dont les critères d'acceptation deviennent invisibles. Quatre lots de 5 à 12 jours sont revus, corrigés et fusionnés un par un.
3. **La décision de design se vérifie tôt.** La direction retenue (§12) est un pari sur une coquille. Si elle se révèle fausse à l'usage, la corriger après W1 coûte une semaine ; la corriger après un lot unique de parité en coûte cinq.

**Et la parité reste la destination, écrite comme telle** : W3 n'est pas conditionnel, il n'attend aucune donnée de beta, il est juste après. C'est la différence avec la passe 1, où l'app web entière était suspendue à un signal qui n'arriverait jamais.

---

## 8. Le découpage en lots, en détail

Les ordres de grandeur sont ceux de §7. Rien dans ces lots ne prévoit de couche de compatibilité : rien n'est déployé (`AGENTS.md`, « Nothing is deployed yet »), il n'y a pas d'app web existante à ménager.

### Lot W0 — les fondations *(c'est le périmètre à donner à task-425)*

**Backend**
1. Session de navigateur sur `/login`, `/register`, `/google/native`, `/apple/native`, `/refresh`, `/logout` : refresh en cookie `HttpOnly` au lieu du corps JSON (§6.4).
2. Les deux callbacks OAuth web émettent enfin une session et redirigent vers `app.<domaine>`.
3. Politique de durée par type de lignée : plafond absolu et expiration par inactivité pour les lignées de navigateur (§1.2).
4. `docs/AUTHENTICATION_SETUP.md` : les deux étages de CORS, la session navigateur, la politique de durée.

**Infrastructure**
5. `cors_configuration` de l'API Gateway : `allow_origins` = l'origine de l'app, `allow_credentials = true` (§1.1).
6. `CORS_ORIGINS` aligné sur la même valeur.
7. Deux projets Cloudflare Workers static assets, `not_found_handling` par projet (§5.2).

**Front**
8. Projet `web/` : Vite 8, React 19, React Router 8 en mode framework, `ssr: false`.
9. Alias de build et `paths` tsconfig vers `mobile/src/{types,lib,services,i18n,constants}` (§4.3), avec un garde-fou contre les imports couplés.
10. Les tokens de `theme.ts` convertis en variables CSS — un seul fichier généré, pas une seconde palette écrite à la main.
11. Provider i18n web (~80 lignes) sur les `CATALOGS` existants, y compris `dir="rtl"` pour l'arabe.
12. Coquille de la direction retenue, routes vides mais nommées, écran d'attente (`HydrateFallback`).
13. Connexion : email, Google, Apple. Rafraîchissement, verrou multi-onglets, déconnexion (§6.5).
14. Garde d'erreur de démarrage, équivalent web de `StartupErrorGate`.
15. `app.<domaine>` : `noindex`, et une CSP qui interdit tout script tiers (c'est ce qui rend le choix de §6.3 défendable).

**Site public (Astro)**
16. Les six pages, dont `/privacy` et `/terms` rendues depuis `docs/compliance/*.md`, et `/.well-known/apple-developer-domain-association.txt`.
17. `/abonnement` : page de prix non connectée, sans bouton, et sans promesse d'achat pendant la beta.

**Note à l'owner, hors AC** : les changements backend ne sont actifs qu'après un push sur `main` et le déploiement de l'image Lambda. La mise en ligne des deux projets Cloudflare et l'achat du domaine sont des actions de l'owner, et dépendent de task-357 et de task-186.

### Lot W1 — lire la bibliothèque
1. Ajouts récents et « Reprendre » (`GET /api/media`, `/api/engagements/recent`, `/api/folders/unsorted-count`).
2. Arbre de dossiers (`lib/folderTree.ts`, partage) et liste paginée par curseur.
3. Fiche media : en-tête, lecteur de transcript, états de préparation du texte, échecs.
4. Artefacts en lecture, visionneuse d'artefact, historique.
5. États vides, de chargement et d'échec pour chacun des écrans ci-dessus, avec les clés i18n existantes.
6. Routes profondes : `/dossier/<id>`, `/media/<id>` rechargeables (§2.2).

### Lot W2 — digest, recherche, compte
1. Digest quotidien et hebdomadaire, positions, états vides.
2. Recherche plein texte (`/api/search/transcripts`) avec `lib/highlightSnippet.ts` partage.
3. Compte : profil, langue d'interface, langue de lecture (et son refus `reading_language_change_too_soon`), état d'abonnement **sans entrée vers l'abonnement** tant que `is_beta_access` est vrai.
4. Raccourcis clavier et palette de commandes (§2.2).

### Lot W3 — écrire
1. Ingestion par URL (`POST /api/media/ingest-url`), avec choix du dossier.
2. Import de fichiers : `<input type="file">` + API `File` → `POST /api/media/upload-url` puis `PUT` présigné puis `POST /api/media/upload`.
3. Génération d'artefacts, avec les refus de `lib/artifactRefusal.ts`.
4. Dossiers : création, renommage, déplacement, suppression.
5. Revue des non classés.
6. Suppression de compte.

### Lot X1 — l'extension Chrome
Identique au lot 1 de la passe 1 (rejeté §12), **moins** l'écran mobile d'appairage, **plus** la page d'appairage de l'app web (§10.2). Les deux endpoints d'appairage et les deux champs optionnels sur `IngestUrlRequest` sont inchangés.

### Lot X2 — Firefox et Edge, capture complète
Inchangé (rejeté §12, lot 2).

### Lot W4 — l'abonnement *(après la beta task-429)*
Inchangé (rejeté §12, lot 3), avec une seule différence : la page d'abonnement est un **écran de l'app web**, derrière la session de §6, et non une page publique à qui il faut inventer une session. C'est l'économie que l'app web fait sur ce lot.

### Lot X3 — Safari *(optionnel)*
Inchangé (rejeté §12, lot 4).

### Ce qui bloque la publication, mais pas le développement

| Prérequis | Bloque | Ne bloque pas |
|---|---|---|
| **task-357** (domaine, encore `pending`) | la mise en ligne des deux origines, l'URL de la fiche de store, le cookie sur `api.<domaine>` | l'écriture de l'app web, qui se développé contre l'API `-dev` et une origine locale |
| **task-186** (nom marketing) | le wordmark, la fiche Chrome Web Store | tout le reste |
| **task-429** (beta, `Done`) | **W4** | W0 à W3, X1 à X3 |

---

## 9. Coût sur douze mois

### 9.1 Dépenses fixes

| Poste | Montant sur 12 mois | Source |
|---|---|---|
| Nom de domaine `.com` | **~11 $** | task-357 ; le domaine est de toute façon un prérequis de l'API, de l'adresse DSA et de Sign in with Apple |
| Hébergement du site public (Cloudflare, offre gratuite) | **0 $** | « Requests to static assets are free and unlimited », « There is no additional cost for storing Assets » |
| Hébergement de l'app web (même chose, second projet) | **0 $** | idem ; une SPA ne réveille jamais le code du Worker |
| TLS, DNS, adresse de contact (Email Routing) | **0 $** | task-357 |
| Inscription développeur Chrome Web Store | **frais unique, montant non publié** par Google | <https://developer.chrome.com/docs/webstore/register> — revérifié le 2026-10-06 : la page dit « pay a one-time registration fee » et ne donne aucun chiffre (§13, point 6) |
| Microsoft Edge Add-ons (lot X2) | **0 $** | « There is no registration fee » |
| Firefox Add-ons (lot X2) | **0 $** | aucun frais documenté |
| Apple Developer Program (lot X3) | **99 $/an, déjà payé** | l'app est en TestFlight depuis le 2026-09-02 |
| **Total fixe attribuable à cette tâche** | **0 $** au-delà des ~11 $ que task-357 engage déjà, plus un frais unique Chrome | |

**L'app web ne coûte pas d'abonnement.** C'est le résultat le plus utile de cette section : le choix d'une SPA statique sur un hébergement gratuit, qui parle directement à l'API existante, met le coût d'infrastructure à zéro. Le coût de l'app web est **du temps** (§7), pas de l'argent.

### 9.2 Le coût variable : les appels d'API en plus

Une app web ajoute du trafic à l'API existante. Ordre de grandeur :

- Une session de lecture sérieuse (ouvrir la bibliothèque, parcourir trois dossiers, lire deux fiches avec leur transcript et leurs artefacts) : **100 à 200 requêtes**.
- API Gateway HTTP API : **1,00 $ par million d'appels** jusqu'a 300 millions (puis 0,90 $). Chaque requête couvre jusqu'a 512 ko de charge utile.
- Soit, pour 1 000 sessions de lecture par mois : **~0,2 $/mois** d'API Gateway, plus le Lambda correspondant, qui reste dans les mêmes ordres.

Autrement dit : **a l'échelle des testeurs de la beta, et même à celle des premiers milliers d'utilisateurs, le coût variable de l'app web est inférieur au prix du domaine.** Le poste qui pourrait devenir visible n'est pas l'API, c'est le transfert S3 des couvertures et des fichiers media si l'app web les affichait en pleine résolution — un sujet de cache, pas de benchmark.

> Tarif relevé sur la page de tarification AWS le 2026-10-06. La page ne porte pas de table par région : les chiffres cités viennent de ses exemples chiffres, sans région nommée (§13, point 7).

### 9.3 Charge de maintenance

C'est le vrai coût récurrent, et il faut le dire franchement : **l'app web ajoute un second client à faire évoluer.** C'était l'argument central de la passe 1 contre elle, et il reste vrai — ce qui change, c'est sa taille mesurée :

| Ce qui double | Ce qui ne double pas |
|---|---|
| La **présentation** : chaque tâche produit qui touche un écran touche désormais deux mises en page | Les **contrats** : un champ ajoute à l'API est lu par la couche partagée, donc une fois |
| Les **états** d'une nouvelle fonctionnalité (vide, chargement, échec) | Les **textes** : un catalogue, 11 langues, deux clients (§4.2) |
| La **revue visuelle** manuelle | Les **règles métier** : quotas, paliers, refus, surlignage, arborescence (§4.2) |
| — | Le **déploiement** : un push sur `main` déploie le backend ; Cloudflare se déploie depuis le dépôt ; il n'y a pas de review de store pour l'app web, contrairement à l'app mobile |

Et un point en faveur de l'app web sur la charge : **elle se corrige en quelques minutes**, sans review de store, sans OTA, sans qu'un testeur ait à mettre à jour quoi que ce soit. C'est le seul client du projet dont un correctif atteint tout le monde immédiatement.

---

## 10. L'extension : ce qui est repris, et le seul point que l'app web déplace

### 10.1 Repris tel quel

L'owner a juge ces conclusions solides et demande de ne pas les réinstruire. Elles sont reprises **sans modification** et le détail reste dans `README.owner-rejected-2026-10-05.md` :

- **WXT** (0.21.4, 2026-08-11 ; commits le 2026-10-04), contre Plasmo (sans release depuis le 2025-05-17), CRXJS (greffon Vite centré Chrome) et MV3 nu — rejeté §3.
- **Chrome Web Store seulement au premier lot**, Edge et Brave installant la même fiche ; Firefox au lot suivant avec son paquet de sources et sa déclaration de données ; Safari en dernier et optionnel — rejeté §4.
- **Capture URL + texte de page + sélection**, par deux champs optionnels sur `IngestUrlRequest` ; PDF au lot suivant ; extraction par `@mozilla/readability` (0.6.0, Apache-2.0) dans le script de contenu — rejeté §6.
- **Permissions limitées à `activeTab`, `storage`, `contextMenus`**, tous les appels réseau depuis le service worker, aucun `<all_urls>`, aucune collecte d'historique — rejeté §7, §8.3.
- **Chaque fonction de Recall gardée ou écartée**, y compris « Augmented Browsing » écartée — rejeté §7.
- **Le CORS n'est pas un problème pour l'extension** — rejeté §0.2. Cela reste vrai : le resserrement de `cors_configuration` de §1.1 ne la concerne pas, puisqu'un `fetch` depuis le service worker avec `host_permissions` n'est pas soumis au CORS.

### 10.2 Le seul point que la décision de l'owner déplace : qui délivre l'appairage

La passe 1 recommandait l'**appairage depuis l'app mobile** (un code à six chiffres affiché dans l'app, saisi dans la popup de l'extension), et son premier argument était : c'est la seule option qui marche sur les quatre navigateurs, parce que l'API `identity` n'existe pas dans Safari. Cet argument tient, et il n'est pas remis en cause.

Ce qui change, c'est qu'il existe maintenant **une surface authentifiée dans le navigateur où l'extension s'installe**. Le mécanisme reste exactement le même — deux endpoints, un code à usage unique, un TTL court, un compteur d'échecs porté par le code — mais l'écran qui affiche le code peut être une page de `app.<domaine>` au lieu d'un écran de l'app mobile.

| | **Appairage depuis l'app mobile** (passe 1) | **Appairage depuis l'app web** (ce que l'app web rend possible) |
|---|---|---|
| Ce que l'utilisateur fait | ouvre son téléphone, va dans Compte → Relier un navigateur, lit un code, le saisit dans la popup | clique « Connecter » dans la popup, un onglet `app.<domaine>/extension/connecter` s'ouvre, il y est déjà connecté, il valide |
| Endpoints backend | deux, identiques | **les mêmes deux** |
| Fonctionne sur Chrome / Firefox / Safari | oui, à l'identique | **oui, à l'identique** : aucune API d'extension spécifique, juste un onglet et un sondage |
| Demande un écran mobile | **oui** — donc une tâche mobile dans le chemin critique de l'extension | **non** |
| Demande que l'app web existe | non | **oui** — d'où l'ordre X1 après W0 |
| Utilisable si l'utilisateur n'a pas le téléphone sous la main | non | oui |

**Recommandation : l'app web délivre l'appairage, et l'écran mobile devient optionnel.** La forme technique est celle d'un octroi par sondage, la même que le *Device Authorization Grant* (RFC 8628) : l'extension génère un nonce, ouvre l'onglet avec ce nonce, et sonde l'API jusqu'a ce que la page l'ait autorise. Aucune API d'extension au-delà de `tabs.create`, donc aucune divergence Chrome / Firefox / Safari.

C'est le seul endroit où ce benchmark touche à une conclusion que l'owner a déclarée acquise, et il le fait parce que la décision sur l'app web **supprime la contrainte qui avait dicté cette conclusion**. Si l'owner préfère garder l'appairage depuis le mobile, rien d'autre ne bouge : les deux endpoints sont les mêmes et l'écran mobile redevient simplement un prérequis de X1.

### 10.3 Ce que l'app web change aussi pour la popup de l'extension

Un point mineur mais concret : la passe 1 écrivait qu'en cas de refus de quota, « la popup affiche le refus et renvoie **vers l'app mobile**, pas vers le site, tant que le lot 3 n'existe pas » (rejeté §8.2). Avec l'app web, la popup renvoie vers `app.<domaine>` — où l'utilisateur voit sa jauge, son palier et, après la beta, son abonnement. Un lien, pas une fonctionnalité.

---

## 11. Paiement : repris tel quel, et ce que l'app web y change

Les conclusions de la passe 1 sont reprises intégralement (rejeté §10). Revérifiées le **2026-10-06** sur la documentation RevenueCat :

- **Stripe Billing branché sur RevenueCat**, jamais Stripe en direct. RevenueCat décrit les trois moteurs de facturation web (RevenueCat Billing, Stripe Billing, Paddle Billing) et confirme, pour Stripe Billing, que produits, abonnements, gestion d'abonnement, localisation, multi-devise et TVA « all live in Stripe », RevenueCat gardant les entitlements.
- **Aucun frais RevenueCat supplémentaire** : « there are no additional RevenueCat fees to support subscriptions and purchases on the web ».
- Le travail côté webhook reste **additif** : `SubscriptionPlatform.web`, le mappage de `STRIPE` et `RC_BILLING` dans `_get_platform`, et rien du tout sur `_resolve_tier` qui lit le palier depuis l'entitlement (rejeté §0.3, §10.2).
- **Stripe Tax** pour commencer, **Managed Payments** documenté en repli, **Paddle** écarté, **Lemon Squeezy** = Stripe Managed Payments (rejeté §10.6).
- **Les règles des stores** sont inchangées : rien dans l'app mobile sur la boutique française, tout ce qu'on veut sur le web, et 3.1.3(b) autorise à honorer dans l'app un abonnement acheté sur le web (rejeté §10.4).

Ce que l'app web change, et c'est une simplification :

| | Avec le site vitrine (passe 1) | Avec l'app web (ici) |
|---|---|---|
| Ou vit la page d'abonnement | une page publique, à qui il faut inventer une session (rejeté §5.5 proposait un lien à usage unique depuis le mobile) | **un écran de l'app web**, derrière la session de §6 |
| Un visiteur sans l'app peut-il payer ? | **non**, c'était la limite franche de la passe 1 | **oui** : il créé un compte sur `app.<domaine>` et paie |
| Ce que le lot paiement doit construire côté auth | une primitive de session courte, spécifique | **rien** : la session existe depuis W0 |
| Le portail client | Stripe | Stripe, atteint depuis l'app web |

Autrement dit, la décision de l'owner **retiré du lot paiement** le morceau le plus incertain de la passe 1. Le lot W4 redevient ce qu'il devrait être : trois produits Stripe, un import dans RevenueCat, une page, deux lignes de backend.

> **Un seul point à surveiller à l'implémentation** : RevenueCat precise que ce sont Apple et Google qui décident, par boutique, si un paiement alternatif peut être présente, et qu'il faut donc « only surface web checkout links where you're éligible ». Cela ne concerne que l'app mobile (qui, par recommandation, n'en parle pas du tout), pas l'app web.

---

## 12. Les quatre propositions de design

### 12.1 Ce qui a été produit

Quatre répertoires sous `mobile-design-mockups/web_app/`, chacun avec un `code.html` autonome (aucune balise `<link>`, `<script>` ni `<img>`, donc **aucune requête réseau**) et un `screen.png` :

| Répertoire | Titre | Ce que la coquille est |
|---|---|---|
| `web_app/direction_a_classeur_trois_volets/` | **A — « Le classeur »** | trois volets permanents : arborescence, liste, lecture |
| `web_app/direction_b_table_de_lecture/` | **B — « La table de lecture »** | barre haute + grille de couvertures ; la lecture prend tout le cadre, artefacts en marge |
| `web_app/direction_c_tableau_de_bord/` | **C — « Le tableau de bord »** | barre latérale de 4 destinations ; bibliothèque en tableau triable ; panneau de propriétés |
| `web_app/direction_d_plein_ecran/` | **D — « Le plein écran »** | aucune chrome permanente ; une colonne ; palette de commandes |

Chaque fichier rend **quatre cadres** : les trois écrans connectés que l'owner a demandés — **bibliothèque, fiche media, digest** — à **1440 x 900 px** (le rendu de référence : la zone utile d'un portable 1440 pt une fois la chrome du navigateur retirée), puis un quatrième cadre à **390 x 844** comme rendu responsive secondaire. Les cadres sont en `overflow: hidden` : ce qui ne tient pas est coupe à l'image, exactement comme à l'écran. C'est la mesure elle-même, et c'est pourquoi certaines directions montrent du vide là où d'autres montrent du contenu coupe.

Conventions respectées :

- **Tous les tokens viennent de `mobile/src/constants/theme.ts`**, recopiés en variables CSS en tête de chaque fichier : les couleurs (dont `primaryTint` à 5 %, `coverTitleVeil` à 72 %, `highlight`), les six espacements, les cinq rayons, l'ombre `soft` (`0 8px 24px rgba(43, 45, 66, 0.04)`), les trois cibles tactiles. Aucune couleur hors palette, aucune taille de texte hors échelle (32 / 20 / 16 / 14 / 13).
- **Les composants de `DESIGN.md` servent à ce à quoi ils servent** : le *Segmented Control* (pilule, actif en amber sur texte sombre), le *Callout Aside* (filet 4 px + fond à 5 % du primaire), les *Metadata Chips* (pilule, fond `surface`, contour à 5 % de noir), la barre haute en `backdrop-filter` (directions B et D).
- **Les icônes sont les contours exacts d'Ionicons** (512 unités/em) repris des maquettes de task-408 et task-410 — pas des dessins approches.

Trois écarts assumés, les mêmes dans les quatre fichiers :

1. **Les polices.** `DESIGN.md` prescrit Plus Jakarta Sans pour les titres et Inter pour le corps. Une maquette sans réseau ne peut pas les charger : les quatre déclarent une pile système. C'est le seul écart visuel au design system, et il disparaît à l'implémentation — un site web, contrairement à l'app, **peut** charger les deux fontes.
2. **Les couvertures.** L'app affiche de vraies vignettes ; une maquette sans réseau ne peut pas. Un bloc teinté de la palette portant l'icône de type tient la place. C'est un substitut déclaré, pas une proposition graphique.
3. **Un glyphe composé.** Le stock d'icônes extrait des maquettes précédentes n'avait pas de loupe. Le symbol `ion-search-stroke` est composé à partir de la définition SVG d'Ionicons (`search-outline`, forme à trait), et non extrait de la fonte. Les 24 autres glyphes sont les contours de la fonte.

Et le nom : les quatre portent le placeholder **« Media Summarizer »**. Le nom marketing n'est pas tranche (task-186) et **ce benchmark n'en propose pas**.

### 12.2 Comparaison

| | **A — Le classeur** | **B — La table de lecture** | **C — Le tableau de bord** | **D — Le plein écran** |
|---|---|---|---|---|
| **Structure** | grille 272 / 404 / reste ; la sélection remplace la navigation | barre haute + grille 4 colonnes ; la lecture prend tout le cadre | barre latérale 216 px + page complète ; bibliothèque en `<table>` | une colonne centrée à chaque route ; rien de permanent |
| **Combien de mises en page pour les 3 surfaces** | **une** : la même coquille sert la bibliothèque, la fiche et le digest | **trois** : grille, lecture, revue | **deux** : tableau et page à deux colonnes | **deux** : liste et page de lecture |
| **Repère permanent (« où suis-je ? »)** | **le meilleur** : l'arborescence et la liste ne bougent jamais | aucun : les dossiers sont des filtres, pas un lieu | bon : 4 destinations + les dossiers | **aucun**, par construction |
| **Mesure du texte** | 680 px dans un volet de 724 — juste | **720 px, centré** : le plus confortable | 720 px, mais face à un panneau de propriétés | 720 px, centré |
| **Ou vivent les artefacts IA** | derrière un segment « Texte complet / IA » — ce que fait l'app (`folder.tab.sources` / `folder.tab.ai`) | **dans la marge, visibles pendant la lecture** | dans un panneau de propriétés, avec l'état de chacun | en pied de page, après le texte |
| **Traitement du digest** | liste + volet de lecture, même coquille | une page éditoriale qu'on lit sans cliquer — **le meilleur usage du grand écran pour le digest** | un parcours mesure (2 / 4 lus, sélecteur de jours) | **un media par écran**, transposition directe de `digest/[period].tsx` |
| **Densité d'information** | haute | moyenne | **la plus haute** | la plus basse |
| **Usage de la largeur de 1440** | entièrement | partiellement (1040 centré) | entièrement | **très peu** : deux marges vides |
| **Coût responsive** | moyen : les volets se replient vers l'IA mobile | **faible** : la grille passe à une colonne, rien à replier | **élevé** : le tableau ne passe pas, il faut une seconde présentation de la bibliothèque | **nul** : la même mise en page sert les deux |
| **Fidélité au design system** | bonne | **la meilleure** : la plus proche du « warm éditorial » de la north star | **la moins bonne** : un tableau de données a besoin de filets, ce que la « no-line rule » proscrit pour les divisions larges (écart déclaré dans son `code.html`) | bonne : le sectionnement se fait par blocs de couleur, exactement ce que `DESIGN.md` prescrit |
| **Ce qu'elle emprunte au mobile** | le segment Sources / IA | rien | **les 4 destinations, à l'identique** | **toute l'architecture d'information** |
| **Risque principal** | le volet de lecture est le plus étroit des quatre | on ne sait jamais où l'on est dans l'arborescence | elle ressemble à une console d'administration, pas à un lieu de lecture | elle ne justifie pas le grand écran — c'est-a-dire la raison d'être de l'app web |
| **Coût de construction** | moyen (une coquille, trois contenus) | moyen-élevé (trois mises en page) | élevé (tableau + panneau + seconde présentation mobile) | **le plus faible** |

### 12.3 Recommandation : la direction A, avec deux emprunts

**Le fait qui tranche est le découpage en lots.** A est la seule direction dont **la coquille sert les trois surfaces sans nouvelle mise en page**. Concrètement : le lot W1 dessine les trois volets et y met la bibliothèque et la fiche media ; le lot W2 y met le digest, la recherche et le compte **sans redessiner la coquille**. Dans les directions B, C et D, le lot W2 ouvre une mise en page de plus. Sur un découpage dont le but explicite est de livrer tôt et de corriger tôt (§7.5), c'est la propriété qui compte le plus.

Trois arguments de plus, dans l'ordre :

1. **C'est la seule qui ne perd jamais la place de l'utilisateur.** Un dossier de 23 sources se parcourt en ouvrant et refermant des fiches ; dans A, la liste et son défilement ne bougent pas. C'est aussi ce qui rend les raccourcis clavier évidents : haut et bas parcourent la liste, le volet de droite suit.
2. **Elle transpose un arbitrage que l'app a déjà tranché.** Le segment « Sources / IA » de la fiche de dossier (`folder.tab.sources`, `folder.tab.ai`) existe dans les onze catalogues i18n. A le réutilise tel quel ; les trois autres inventent un autre endroit pour les artefacts, donc d'autres clés.
3. **Elle degrade proprement.** Sous 900 px, les trois volets deviennent un et la sélection redevient une navigation : c'est l'architecture de l'app mobile, qu'on n'a pas à redessiner.

**Deux emprunts à faire**, tous deux bon marché :

- **De B : la marge d'artefacts, mais seulement quand il y a la place.** A 1440 px, le volet de lecture fait 724 px et la marge ne rentre pas — les artefacts restent derrière le segment. Au-delà de ~1680 px (un écran externe, ou la fenêtre maximisée d'un grand moniteur), le volet gagne assez de largeur pour révéler la marge de B. C'est une `@container` sur le volet, pas une seconde maquette, et c'est la façon de ne pas renoncer au meilleur trait de B.
- **De D : la palette de commandes (`Cmd K`).** A a une arborescence, donc elle n'a pas *besoin* d'une palette pour naviguer. Mais la palette de D fait une chose qu'aucun volet ne fait : chercher **dans le texte intégral** et sauter directement au passage (`/api/search/transcripts`, déjà la, §1.3). C'est un composant, pas une architecture, et il s'ajoute à n'importe quelle coquille.

**Ce qui écarte les trois autres, et à quelle condition y revenir :**

- **B** est la plus juste par rapport à ce que le produit *est* — un outil de lecture longue — et c'est la direction que je recommanderais si l'app web n'avait qu'une surface. Elle en a six, et B ne donne de réponse élégante qu'a une seule. **Y revenir si** l'usage montre qu'on ouvre l'app web pour lire une pièce à la fois plutôt que pour parcourir sa bibliothèque.
- **C** a le meilleur outil pour la bibliothèque : avec 184 contenus, trier par durée pour trouver quoi écouter en vingt minutes est une vraie fonction, qu'aucune autre direction n'offre. Elle paie cela par un tableau qui heurte le design system et par **deux présentations de la bibliothèque à maintenir**. **Y revenir si** la bibliothèque dépasse quelques centaines d'éléments et que le tri devient quotidien — le tableau deviendrait alors le mode « Liste » du volet central de A, ce que la maquette de B esquisse déjà avec son segment Grille / Liste.
- **D** est la moins chère et la plus cohérente avec le mobile, et c'est exactement ce qui la disqualifie : elle ne justifie pas le grand écran. L'owner a écrit « une app web se juge d'abord sur grand écran : c'est sa raison d'être ». D rend sur 1440 px ce que le téléphone rend sur 390, avec deux marges vides. **A garder** pour une chose precise : sa palette de commandes, empruntée ci-dessus.

> **Aucun chiffre de conversion ni aucune donnée d'usage n'étaie cette recommandation** : elle est argumentée sur des faits du projet — le découpage en lots, les clés i18n existantes, la largeur de mesure du texte, la « no-line rule » du design system — et non sur des mesures, qui n'existent pas (§13, point 9).

---

## 13. Ce qui n'a pas pu être vérifié dans cette passe

Liste explicite, pour que l'owner sache ce qui est source et ce qui ne l'est pas.

1. **Les chiffrages de §7 ne reposent sur aucune mesure historique.** Il n'existe pas de donnée de vélocité dans ce dépôt. Les deux méthodes (par les lots et par les lignes) se recoupent à +/- 20 %, ce qui est tout ce qu'on peut honnêtement affirmer. Le ratio de conversion « 45 à 60 % du compte de lignes RN » est une **hypothèse**, pas une observation.
2. **Que `Set-Cookie` traverse API Gateway HTTP API en payload 2.0 sur une réponse lue par un `fetch` cross-origin avec `credentials: 'include'`** n'a pas été exercé. Le cookie d'état OAuth existant le prouve pour une **navigation**, pas pour un XHR. C'est la première chose à vérifier au lot W0, et elle n'est vérifiable qu'après déploiement.
3. **Le comportement de `starlette` 0.47.2 décrit en §1.1** est lu dans la source de la version verrouillée (`uv.lock`), **sans exécution**. La conclusion opérationnelle n'en dépend pas : il faut fixer l'origine explicitement de toute façon.
4. **Les valeurs de durée proposées en §1.2** (30 jours de plafond absolu, 14 jours d'inactivité) sont un point de départ raisonnable, pas une exigence de la RFC : celle-ci impose l'existence d'un plafond, pas sa valeur.
5. **Les sections 7 à 11 de la RFC 10017 n'ont été lues que par extraits.** Le document fait ~153 000 caractères et l'outil de lecture le tronque ; §6.1.4.3, §6.3.2.3, §7, §8.2 et §9.4 ont été lus et sont cités verbatim, le reste non.
6. **Le montant du frais d'inscription au Chrome Web Store** n'est toujours pas publié par Google. Revérifié le 2026-10-06 : la page d'inscription dit « pay a one-time registration fee » sans aucun chiffre. Même limite que la passe 1 et que task-357 §9.
7. **Les tarifs API Gateway de §9.2** viennent des exemples chiffres de la page de tarification AWS, qui ne nomme aucune région. Un tarif par région (Irlande, Paris) n'a pas pu être extrait.
8. **Le Web SDK de RevenueCat n'a pas été audité.** Sa page de vue d'ensemble a été relue et confirme le modèle à trois moteurs de facturation ; la page dédiée au SDK navigateur à répondu 404 à l'URL essayée. Le paquet `@revenuecat/purchases-js` est bien publié (1.68.0, 2026-10-05, MIT), mais son API n'a pas été examinée — c'est du ressort du lot W4.
9. **Aucune donnée d'usage n'étaie la recommandation de design de §12.3** ni le choix du sous-ensemble de lecture de §8. Les deux sont argumentés sur des faits du dépôt, pas sur des mesures.
10. **Le rendu des quatre maquettes n'a été vérifié que dans un seul moteur** (Chrome, par la production des `screen.png`). `@container` et `position: sticky` n'ont pas été essayés dans Firefox ni dans Safari.
11. **La compatibilité de `navigator.locks`** (§6.5) n'a pas été vérifiée navigateur par navigateur. La recommandation ne dépend pas de sa présence : la fenêtre de rejeu de 60 s du backend suffit à rendre la course inoffensive.
12. **Le coût du passage de l'alias de build (option A de §4.3) à `packages/core` (option B)** est estimé à 1-2 jours sans l'avoir essayé. Ce qui est sûr, c'est que l'option A ne touche ni Metro ni EAS ; ce qui n'est pas mesure, c'est le coût de l'option B sur le build EAS.

---

## 14. Sources

Toutes consultées le **2026-10-06**, sauf mention contraire.

**Normes et sécurité**

- **RFC 10017, « OAuth 2.0 for Browser-Based Applications », BCP 212, août 2026** (A. Parecki, P. De Ryck, D. Waite ; ex-`draft-ietf-oauth-browser-based-apps-27`) — <https://www.rfc-editor.org/rfc/rfc10017.html> et <https://datatracker.ietf.org/doc/draft-ietf-oauth-browser-based-apps/>. Sections citées : §6 (les trois patrons), §6.1.4.3 (BFF « strongly recommended […] applications that handle personal data »), §6.3.2.3 (les trois exigences sur les refresh tokens), §7.1 (applications de domaine unique sans OAuth), §8.2 (stockage dans le navigateur), §9.4 (une application par origine)
- RFC 8628, « OAuth 2.0 Device Authorization Grant » — cité en §10.2 pour la **forme** de l'octroi par sondage, pas comme protocole à implémenter

**Plateformes et hébergement**

- AWS, CORS des HTTP APIs (« API Gateway ignores CORS headers returned from your backend integration ») — <https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-cors.html>
- AWS, tarification API Gateway — <https://aws.amazon.com/api-gateway/pricing/>
- Cloudflare, Workers static assets (`not_found_handling`, `single-page-application`, `run_worker_first`) — <https://developers.cloudflare.com/workers/static-assets/>
- Cloudflare, facturation et limites des static assets (« Requests to static assets are free and unlimited ») — <https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/>
- Cloudflare, limites de la plateforme (20 000 fichiers par version, 25 MiB par fichier, 100 000 requêtes/jour en offre gratuite) — <https://developers.cloudflare.com/workers/platform/limits/>
- Cloudflare Pages, encart « Start new projects with Workers » — <https://developers.cloudflare.com/pages/> (via la passe 1, 2026-10-05)

**Frameworks**

- React Router, mode SPA (`ssr: false`, pré-rendu de la racine, `clientLoader`, réécriture de l'hôte) — <https://reactrouter.com/how-to/spa>
- Astro, « Why Astro? » (sites orientés contenu contre frameworks d'application) — <https://docs.astro.build/en/concepts/why-astro/>
- Expo, support du web (`react-dom`, `react-native-web`, `@expo/metro-runtime`, `expo export --platform web`) — <https://docs.expo.dev/workflow/web/>
- Expo Router, rendu statique (modes `static` / `server`, limites) — <https://docs.expo.dev/router/reference/static-rendering/>
- Expo, `expo-secure-store` (« Android, iOS, tvOS ») — <https://docs.expo.dev/versions/latest/sdk/securestore/>
- Expo, `expo-notifications` (`platforms: ['android', 'ios']`) — <https://docs.expo.dev/versions/latest/sdk/notifications/>
- Expo, `expo-glass-effect` (« iOS, tvOS », iOS 26+) — <https://docs.expo.dev/versions/latest/sdk/glass-effect/>
- Registre npm, versions relevées le 2026-10-06 : `astro` 7.3.6 · `next` 16.3.8 · `@sveltejs/kit` 3.0.1 · `react-router` 8.4.0 · `@tanstack/react-start` 1.168.60 · `vite` 8.3.3 · `react-native-web` 0.21.3 · `expo` 57.0.27 (`@expo/metro-runtime` sous le tag `sdk-55` : 55.0.12) · `@revenuecat/purchases-js` 1.68.0 · `@sentry/react` 11.4.0 · `wxt` 0.21.4 · `@mozilla/readability` 0.6.0
- Téléchargements npm sur 30 jours (`api.npmjs.org`), 2026-10-06 : `next` 253,4 M · `react-router` 229,8 M · `@tanstack/react-start` 65,9 M · `react-native-web` 28,1 M · `astro` 25,4 M · `@sveltejs/kit` 11,7 M

**Paiement**

- RevenueCat, vue d'ensemble du web (trois moteurs de facturation, « there are no additional RevenueCat fees […] on the web », ce que l'intégration Stripe Billing couvre et ne couvre pas) — <https://www.revenuecat.com/docs/web/overview>
- Les autres sources de paiement (tarifs Stripe, Managed Payments, Paddle, Lemon Squeezy, lignes directrices Apple 3.1.1 / 3.1.3, politique Payments de Google Play) sont celles de la passe 1 — `README.owner-rejected-2026-10-05.md` §14

**Extension**

- Chrome Web Store, inscription développeur (frais unique, montant non publié) — <https://developer.chrome.com/docs/webstore/register>
- Les autres sources d'extension (WXT, Plasmo, CRXJS, requêtes réseau et CORS dans Chrome, `chrome.storage`, politiques Mozilla, Safari web extensions, `identity` non supporté) sont celles de la passe 1 — `README.owner-rejected-2026-10-05.md` §14

**Dépôt (lecture seule)**

- `README.owner-rejected-2026-10-05.md` — la passe 1 et le retour de l'owner, qui fait autorité sur le périmètre
- `docs/research/task-357-legal-pages-hosting/README.md` — domaine, hébergement, pages légales, adresse de contact ; **encore `owner_decision: pending`**
- `docs/AUTHENTICATION_SETUP.md` — flux natifs, callback web sans jeton (task-293), `lineage_id`, refresh glissant d'un an sans plafond, fenêtre de rejeu de 60 s (task-294), CORS
- `infrastructure/terraform/modules/platform/lambda_api.tf:131-146` — `cors_configuration` de la HTTP API (`allow_origins = ["*"]`, `allow_credentials = false`), stage `$default`, intégration `AWS_PROXY` payload 2.0
- `media_summarizer/api/main.py:86-94` — `CORSMiddleware`, `CORS_ORIGINS`, `allow_credentials=True`
- `media_summarizer/api/endpoints/auth_social.py:91` — `response.set_cookie` : la preuve que le transport par cookie fonctionne à travers API Gateway
- `media_summarizer/api/endpoints/entitlements.py:49-66` — `is_free_trial`, `is_beta_access`
- `media_summarizer/api/endpoints/media.py:1254-1275` — `GET /api/media` et ses filtres (`folder_id`, `q`, `source`, `type`, `status_filter`, `cursor`, `limit`, `sort`)
- `media_summarizer/api/endpoints/{folders,digest,artifacts,search,engagements,pricing}.py` — les routes de lecture de §1.3
- `mobile/package.json` — les 31 dépendances, dont le script `web` déjà présent et l'absence de `react-dom` / `react-native-web`
- `mobile/src/{types,lib,services,i18n,constants}` — l'inventaire mesure de §4.1
- `mobile/src/lib/subscriptionDisplay.ts:73-78` — la lecture de `is_beta_access`
- `mobile/src/constants/theme.ts` et `mobile-design-mockups/my_design_system/DESIGN.md` — tokens et règles du design system
- `uv.lock` — `starlette` 0.47.2, dont `starlette/middleware/cors.py` a été lu dans le cache de `uv`
- `backlog/tasks/task-186…`, `task-357…`, `task-425…`, `task-429…` (celle-ci **`Done`**)

---

## 15. Note de périmètre

Ce benchmark n'a modifié que :

- `docs/research/task-424-website-and-browser-extension/README.md` (ce fichier) ;
- les quatre répertoires `mobile-design-mockups/web_app/direction_{a,b,c,d}_*/` ;
- le fichier de tâche `backlog/tasks/task-424…` : les critères d'acceptation #1, #8 et #11, que le retour de l'owner a rendus inexacts, et la section `Implementation Notes`.

`README.owner-rejected-2026-10-05.md` est **conservé tel quel** : il porte le retour de l'owner et il reste la source des conclusions reprises en §0, §10 et §11.

**Aucun fichier de code applicatif, de configuration ou d'infrastructure n'est touché.** Tous les numéros de ligne cités sont des lectures. Les quatre maquettes ne contiennent aucune requête réseau, ce qui a été vérifié sur les fichiers produits (ni `<link>`, ni `<script>`, ni `<img>`, ni aucune URL absolue).
