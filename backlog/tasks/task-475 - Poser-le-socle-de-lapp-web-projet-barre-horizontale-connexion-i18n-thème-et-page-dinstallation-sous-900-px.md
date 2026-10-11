---
id: TASK-475
title: >-
  Poser le socle de l'app web : projet, barre horizontale, connexion, i18n,
  thème et page d'installation sous 900 px
status: To Do
assignee: []
created_date: '2026-10-11 15:55'
labels:
  - web
  - feature
dependencies:
  - TASK-473
references:
  - docs/research/task-424-website-and-browser-extension/README.md
  - >-
    docs/research/task-424-website-and-browser-extension/complement-response-2026-10-11.md
  - mobile-design-mockups/web_app_owner_direction/README.md
  - mobile-design-mockups/web_app_owner_direction/code.html
  - mobile-design-mockups/web_app_owner_direction/screens/19-connexion.png
  - mobile-design-mockups/web_app_owner_direction/screens/20-media-sombre.png
  - mobile/src/i18n/catalogs.ts
  - docs/AUTHENTICATION_SETUP.md
priority: medium
type: feature
ordinal: 82000
dispatchable: true
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Source de vérité : `docs/research/task-424-website-and-browser-extension/README.md`, section **Owner Validation**, champ `Decision` du 2026-10-11, tel que précisé par `complement-response-2026-10-11.md` (même répertoire), qui prime sur la Recommendation et sur les §8 à §12 du README. Cette tâche est l'élément **W-05** du §3 du complément. Le choix technique de la SPA est au README §9.1 et §9.2, qui tiennent.

L'interface est **la direction de l'owner** : `mobile-design-mockups/web_app_owner_direction/`, dont le `README.md` fait foi écran par écran (maquette `code.html`, captures `screens/`, sources `docs/research/task-424-website-and-browser-extension/mockup-build/dir_owner.{js,css}`).

**Pas de version téléphone en V1** (`Decision` points 1 et 6) : sous 900 px de large, l'app n'est pas rendue ; seule une page invite à installer l'app mobile (nom Deepn, une phrase, les boutons App Store et Google Play), **sans lien « continuer sur ordinateur »**. Elle est servie par la même SPA, par une règle de mise en page sur la largeur, pas par une redirection serveur. La section « Sur téléphone » du README de la maquette et les captures `21-tel-*` à `37-tel-*` sont hors périmètre V1 (référence pour plus tard).

## Périmètre

- Le projet `web/`, en **Vite, React 19 et React Router en mode SPA**, avec le gestionnaire de paquets déjà utilisé par `mobile/`.
- L'**alias de build vers `mobile/src`** (README §9.2), **en lecture** : `types`, `lib`, `services`, `i18n`, `constants`. N'importer que des modules sans dépendance Expo ni React Native. **Ne modifier aucun fichier de `mobile/`** : cette tâche n'est pas routée vers task-mobile. Si un module nécessaire en dépend, le dire dans la note de fin plutôt que de le dupliquer en silence.
- La **barre horizontale** de la direction de l'owner : logo, Accueil, Bibliothèque, Digest, Non classés · N, recherche, Ajouter, thème, Mon compte. Les destinations sont des routes vides que les tâches d'écran rempliront.
- **Connexion et inscription** : e-mail et mot de passe, Google par Google Identity Services, Apple par Sign in with Apple JS, choix de la langue de lecture à l'inscription (capture `19-connexion.png`).
- La **session de W-03** (task-473) : refresh en cookie, **access token en mémoire seulement**, jamais dans `localStorage`.
- **i18n sur les 11 langues** des catalogues de l'app (ar, de, en, es, fr, hi, it, ja, nl, pt, zh). Les libellés propres au web vivent dans les catalogues de `web/`.
- **Thèmes clair et sombre** (capture `20-media-sombre.png`).
- La **page d'installation sous 900 px**.
- La commande de build et un document qui dit comment lancer l'app contre l'API `-dev` (et ce qui manque tant que `api.<domaine>` n'existe pas).

## Règles

Rien n'est déployé : aucune compatibilité. Pas de tests automatisés. Aucun secret ni identifiant de client OAuth propre au compte dans les fichiers suivis : configuration par variables de build documentées.

## Note à l'owner

Les origines JavaScript autorisées du client Google et le *Services ID* Apple (domaines, URL de retour) sont à créer dans les consoles (complément §4, runbook de task-445). Vérification visuelle sur un navigateur de bureau après déploiement sur `app.<domaine>` (runbook de task-471).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le projet web/ (Vite, React 19, React Router en SPA) existe, avec l'alias de build vers mobile/src en lecture et aucun fichier de mobile/ modifié
- [ ] #2 La barre horizontale de la direction de l'owner est rendue avec ses neuf entrées, et la connexion par e-mail, Google Identity Services et Sign in with Apple JS ainsi que l'inscription avec choix de la langue de lecture sont câblées sur l'API existante
- [ ] #3 La session suit task-473 : refresh en cookie, access token en mémoire seulement
- [ ] #4 Sous 900 px de large, seule la page d'installation est rendue, avec les deux boutons de store et sans lien vers la version ordinateur
- [ ] #5 Les libellés sont présents dans les 11 langues, et les thèmes clair et sombre existent
- [ ] #6 Le build passe, typecheck et lint sont propres, et un document décrit le build et le lancement contre l'API -dev
<!-- AC:END -->
