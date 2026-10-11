---
id: TASK-487
title: >-
  Livrer l'extension Chrome et Edge : enregistrer la page, enregistrer une
  sélection, appairage en un clic
status: Done
assignee:
  - '@codex'
created_date: '2026-10-11 15:59'
updated_date: '2026-10-11 17:57'
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
documentation:
  - extension/README.md
priority: medium
type: feature
ordinal: 94000
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
- [x] #1 Le projet extension/ en WXT envoie l'adresse de l'onglet par ingest-url avec source_app browser-extension, crée une note depuis une sélection par ingest-shared-content avec source_url, et propose le dossier de destination
- [x] #2 Le manifeste ne déclare ni <all_urls> ni permission d'hôte large, s'appuie sur activeTab, et son externally_connectable ne vise que https://app.<domaine>/*
- [x] #3 L'extension n'accepte un jeton que d'un message dont sender.origin vaut exactement l'origine de l'app web, accepte aussi le code de secours, et demande un ré-appairage après expiration
- [x] #4 Le volet Compte › Extension de l'app web relie l'extension en un clic aux deux identifiants configurés, liste et révoque les extensions reliées et affiche un code de secours
- [x] #5 Le build produit un seul zip pour Chrome et Edge, typecheck et lint sont propres, les libellés sont dans les 11 langues, et aucun fichier de mobile/ n'est modifié
- [x] #6 Un document décrit le chargement non empaqueté contre -dev et la publication sur les deux stores
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reprendre les fichiers existants et vérifier les contrats de task-485/486.
2. Finaliser session, appairage web, choix des dossiers et gestion des erreurs.
3. Documenter le chargement dev et la publication du même zip Chrome/Edge.
4. Vérifier typecheck/lint extension, web, core et mobile, produire et inspecter le zip, puis mettre à jour le backlog.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reprise du travail interrompu, sans modification de mobile/ ni du lockfile racine. Projet extension/ autonome (lockfile séparé pour préserver les résolutions mobile) ; imports de types packages/core par alias.
Livré : popup page/dossiers et sous-dossiers, menu de sélection avec source_url, appairage exact sender.origin, code de secours, storage.local fermé aux scripts de contenu et access dans storage.session, refresh/expiration serveur et logout vérifié. Mon compte essaie les IDs Chrome/Edge dans l’ordre et s’arrête au premier succès, liste/révoque et masque le code expiré ; erreurs réseau visibles.
Vérifications : npm ci extension réussit ; typecheck et lint extension/web/core/mobile passent (un warning mobile préexistant dans purchaseService.ts). Build web et zip WXT réussissent ; manifeste inspecté (activeTab/contextMenus/storage, seul hôte API, seule origine web), archive contenant les 11 langues avec 25 clés chacune. git diff --check propre. Node 20 utilisé localement : npm avertit que listr2 exige Node >=22.13 ; cette exigence est documentée dans extension/README.md.
Le zip de validation est construit avec api.example.com/app.example.com : il doit être reconstruit avec les origines définitives avant publication. Aucun test automatisé ajouté ou lancé. Les AC décrivent ici les chemins et configurations livrés, conformément à AGENTS.md. Aucun parcours navigateur contre AWS ni soumission aux stores effectué ; les étapes après déploiement de task-485/486 sont documentées dans extension/README.md et restent à l’owner.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Extension Chrome/Edge WXT et volet Mon compte livrés en 11 langues. Typecheck/lint extension, web, core et mobile passent ; build web et zip unique vérifiés. Installation dev et publication documentées dans extension/README.md. Parcours réels après déploiement backend et publication stores à effectuer par l’owner ; zip local de validation configuré avec des origines exemple.
<!-- SECTION:FINAL_SUMMARY:END -->
