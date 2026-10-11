---
id: TASK-484
title: Afficher Mon compte dans l'app web en barre latérale de réglages
status: Done
assignee: []
created_date: '2026-10-11 15:58'
updated_date: '2026-10-11 17:37'
labels:
  - web
  - feature
dependencies:
  - TASK-475
references:
  - docs/research/task-424-website-and-browser-extension/README.md
  - >-
    docs/research/task-424-website-and-browser-extension/complement-response-2026-10-11.md
  - mobile-design-mockups/web_app_owner_direction/README.md
  - mobile-design-mockups/web_app_owner_direction/screens/15-compte.png
  - mobile-design-mockups/web_app_owner_direction/screens/16-compte-langue.png
  - mobile/app/(tabs)/account.tsx
  - >-
    backlog/tasks/task-429 -
    Pendant-la-beta-accorder-à-tous-les-comptes-le-palier-le-plus-élevé-et-masquer-toutes-les-entrées-vers-labonnement.md
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
priority: medium
type: feature
ordinal: 91000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Source de vérité : `docs/research/task-424-website-and-browser-extension/README.md`, section **Owner Validation**, champ `Decision` du 2026-10-11, tel que précisé par `complement-response-2026-10-11.md` (même répertoire), qui prime sur la Recommendation et sur les §8 à §12 du README. Cette tâche est l'élément **W-14** du §3 du complément.

L'interface est la direction de l'owner : `mobile-design-mockups/web_app_owner_direction/README.md` **fait foi**. Cette tâche reprend sa ligne « Mon compte, adapté au bureau » du tableau « Ce que la maquette applique », et les captures `screens/15-compte.png` et `screens/16-compte-langue.png`.

**Aucun paiement web** (`Decision` point 3) : la carte de formule reste **sans entrée vers l'abonnement** tant que task-429 (bêta : palier le plus élevé pour tous, entrées vers l'abonnement masquées) est en vigueur. La capture `17-compte-formules.png` (« après la bêta ») est **hors périmètre** : le paiement web relève du benchmark B-01 et de son implémentation.

## Périmètre

- La carte de menu du mobile devient une **barre latérale de réglages** : mêmes lignes, même ordre, les deux lignes rouges (Se déconnecter, Supprimer le compte) en bas. Chaque ligne s'ouvre dans le volet de droite.
- Les volets : **formule** (sans entrée vers l'abonnement), **langue de lecture**, **langue de l'app**, **thème**, **extension**, **suggestions**, **signaler un bug** (formulaire en ligne), **supprimer le compte**, et Se déconnecter.
- La ligne **Extension** existe avec son volet ; **l'appairage, la liste et la révocation des extensions sont livrés par l'extension Chrome et Edge** (task-487), qui dépend de cette tâche. Ici, le volet décrit l'extension et renvoie à la page d'installation `www.<domaine>/extension`.

## Règles

- Câblé sur les endpoints existants : **pas de nouvelle route** d'API.
- Les dossiers n'ont qu'un niveau : aucun écran ne crée un dossier dans un dossier, et « Déplacer le dossier » n'existe pas.
- Ne modifier aucun fichier de `mobile/` (lecture par l'alias seulement).
- Rien n'est déployé : aucune compatibilité. Pas de tests automatisés.

## Note à l'owner

Vérification contre les captures 15 et 16 sur un compte `-dev` : changer la langue de lecture, la langue de l'app et le thème, envoyer un signalement de bug.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Mon compte rend une barre latérale de réglages aux mêmes lignes et dans le même ordre que le menu mobile, les deux lignes rouges en bas, chaque ligne ouvrant son volet à droite
- [x] #2 La carte de formule n'a aucune entrée vers l'abonnement ni vers un paiement
- [x] #3 Les volets langue de lecture, langue de l'app, thème, suggestions, signaler un bug, supprimer le compte et Se déconnecter sont câblés, et la ligne Extension a son volet
- [x] #4 Les écrans sont câblés sur les endpoints existants, sans nouvelle route, et aucun écran ne crée un dossier dans un dossier ni ne déplace un dossier
- [x] #5 Les libellés sont présents dans les 11 langues
- [x] #6 Le build passe, typecheck et lint sont propres, et aucun fichier de mobile/ n'est modifié
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Commit e53fd576.

- **Mon compte** (`web/src/pages/AccountPage.tsx`, routes `/account` et `/account/:section`) : barre latérale de réglages reprenant le menu mobile dans le même ordre — Votre formule ; Réglages : langue de lecture, langue de l'app, thème, + Extension navigateur (propre au web) ; Aide : Suggestions, Signaler un bug ; puis Se déconnecter et Supprimer le compte en rouge en bas. Chaque ligne ouvre son volet à droite.
- **Formule** (`GET /api/entitlements/status`) : Accès bêta / essai / palier, minutes restantes sur incluses avec jauge, date de recharge, règle des minutes. **Aucune entrée vers l'abonnement ni vers un paiement** (bêta, task-429).
- **Langue de lecture** : `PATCH /api/auth/me`, limite mensuelle affichée (date de réouverture) et refus 429 formulé. **Langue de l'app** : « Suivre le navigateur » ou l'une des 11, appliquée en direct, gardée dans le navigateur (`I18nProvider` gagne `preference`/`setPreference`). **Thème** : appareil / clair / sombre.
- **Extension** : description et lien vers `www.<domaine>/extension` (`VITE_SITE_URL`) ; l'appairage, la liste et la révocation sont task-487. **Suggestions** : tableau Canny signé ouvert dans un nouvel onglet (`GET /api/feedback/token`, repli `VITE_FEEDBACK_URL`). **Signaler un bug** : formulaire en ligne (`POST /api/bug-reports`, sujet + description). **Supprimer le compte** : avertissement, liste de ce qui est effacé, case d'acquittement, confirmation, `DELETE /api/account`. **Se déconnecter** : confirmation puis fermeture de la session web.
- 13 libellés web en 11 langues ; build, typecheck, lint propres ; rendu vérifié en Chrome headless (formule, langue de lecture bloquée jusqu'au 3 nov., bascule de l'interface en allemand).

Hors périmètre noté : pièce jointe du signalement de bug (le mobile la propose) non reprise sur le web.
<!-- SECTION:FINAL_SUMMARY:END -->
