---
id: TASK-487
title: >-
  Livrer l'extension Chrome et Edge : enregistrer la page, enregistrer une
  sélection, appairage en un clic
status: To Do
assignee: []
created_date: '2026-10-11 15:59'
labels:
  - extension
  - feature
dependencies:
  - TASK-485
  - TASK-486
  - TASK-484
references:
  - docs/research/task-424-website-and-browser-extension/README.md
  - >-
    docs/research/task-424-website-and-browser-extension/complement-response-2026-10-11.md
  - >-
    docs/research/task-424-website-and-browser-extension/README.owner-rejected-2026-10-05.md
  - mobile-design-mockups/web_app_owner_direction/README.md
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
  - docs/AUTHENTICATION_SETUP.md
  - >-
    https://developer.chrome.com/docs/extensions/reference/manifest/externally-connectable
  - >-
    https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension
priority: medium
type: feature
ordinal: 94000
dispatchable: true
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Source de vérité : `docs/research/task-424-website-and-browser-extension/README.md`, section **Owner Validation**, champ `Decision` du 2026-10-11, tel que précisé par `complement-response-2026-10-11.md` (même répertoire), qui prime sur la Recommendation et sur les §8 à §12 du README. Cette tâche est l'élément **X-03** du §3 du complément ; l'appairage est au §7 et le comportement V1 au §11.

Le `Decision`, point 4 : **l'extension V1 fait comme les apps**. L'adresse de la page part par `ingest-url` ; une sélection devient une note par `ingest-shared-content` avec son adresse d'origine. **Un seul paquet pour Chrome et Edge.** Les pages payantes sont reportées au benchmark B-02. Point 5 : jeton à 90 jours d'inactivité et plafond d'un an, puis ré-appairage en un clic.

Dépendances : le jeton d'extension et le code de secours (task-485), le champ `source_url` (task-486), et la ligne Extension de Mon compte dans l'app web (task-484), qui porte le bouton d'appairage.

## Périmètre

**Extension (`extension/`, en WXT, README rejeté du 2026-10-05, §3)**
- L'**action de barre d'outils** envoie l'adresse de l'onglet par `POST /api/media/ingest-url` avec `source_app: "browser-extension"`.
- Le **menu contextuel sur une sélection** crée une note par `POST /api/media/ingest-shared-content` (`share_type: "text"`) avec `source_url`.
- Le **choix du dossier de destination** (liste des dossiers).
- **Aucune lecture du contenu de la page** : permission `activeTab` seule, ni `<all_urls>` ni permission d'hôte large.
- Stockage : le refresh dans `storage.local` avec `setAccessLevel` qui exclut les scripts de contenu ; l'access token dans `storage.session`.
- **Appairage en un clic** : `externally_connectable` limité à `https://app.<domaine>/*` ; dans `runtime.onMessageExternal`, vérifier que `sender.origin` vaut **exactement** cette origine (liste d'autorisation) avant de stocker quoi que ce soit.
- Le **code de secours** saisi dans la popup ; « Se déconnecter » révoque la lignée par `/logout` ; au-delà de l'expiration, la popup demande de ré-appairer.

**App web (`web/`), volet Compte › Extension de task-484**
- Le bouton « Relier cette extension » demande un jeton (`POST /api/auth/extension-tokens`) et l'envoie par `chrome.runtime.sendMessage(EXTENSION_ID, { type: "pair", token })` **aux deux identifiants** (Chrome Web Store et Edge Add-ons), déclarés dans la configuration de l'app web ; le premier qui répond l'emporte.
- La liste des extensions reliées (navigateur, date) avec révocation, et l'affichage d'un code de secours.

**Publication** : un document décrit le chargement non empaqueté contre `-dev` et la publication du **même zip** sur le Chrome Web Store et sur Microsoft Edge Add-ons (formulaire de confidentialité d'Edge : objet unique, justification de chaque permission, pas de code distant, URL `www.<domaine>/privacy`).

## Règles

Rien n'est déployé : aucune compatibilité. Pas de tests automatisés. Ne modifier aucun fichier de `mobile/`. Aucun secret ni identifiant de compte développeur dans les fichiers suivis. Libellés de l'extension et du volet web dans les 11 langues.

## Note à l'owner

Inscription au Chrome Web Store (5 $ une fois) et à Partner Center (sans frais), puis publication ; renseigner les deux identifiants d'extension dans la configuration de l'app web. Vérifier l'appairage en un clic sur Chrome et sur Edge, puis le code de secours depuis un autre profil.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le projet extension/ en WXT envoie l'adresse de l'onglet par ingest-url avec source_app browser-extension, crée une note depuis une sélection par ingest-shared-content avec source_url, et propose le dossier de destination
- [ ] #2 Le manifeste ne déclare ni <all_urls> ni permission d'hôte large, s'appuie sur activeTab, et son externally_connectable ne vise que https://app.<domaine>/*
- [ ] #3 L'extension n'accepte un jeton que d'un message dont sender.origin vaut exactement l'origine de l'app web, accepte aussi le code de secours, et demande un ré-appairage après expiration
- [ ] #4 Le volet Compte › Extension de l'app web relie l'extension en un clic aux deux identifiants configurés, liste et révoque les extensions reliées et affiche un code de secours
- [ ] #5 Le build produit un seul zip pour Chrome et Edge, typecheck et lint sont propres, les libellés sont dans les 11 langues, et aucun fichier de mobile/ n'est modifié
- [ ] #6 Un document décrit le chargement non empaqueté contre -dev et la publication sur les deux stores
<!-- AC:END -->
