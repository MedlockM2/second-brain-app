---
id: TASK-476
title: Afficher l'Accueil et la Bibliothèque dans l'app web
status: To Do
assignee: []
created_date: '2026-10-11 15:56'
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
  - mobile-design-mockups/web_app_owner_direction/screens/01-accueil.png
  - mobile-design-mockups/web_app_owner_direction/screens/02-bibliotheque.png
  - mobile/app/(tabs)/inbox.tsx
  - mobile/app/(tabs)/search.tsx
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
priority: medium
type: feature
ordinal: 83000
dispatchable: true
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Source de vérité : `docs/research/task-424-website-and-browser-extension/README.md`, section **Owner Validation**, champ `Decision` du 2026-10-11, tel que précisé par `complement-response-2026-10-11.md` (même répertoire), qui prime sur la Recommendation et sur les §8 à §12 du README. Cette tâche est l'élément **W-06** du §3 du complément.

L'interface est la direction de l'owner : `mobile-design-mockups/web_app_owner_direction/README.md` **fait foi**. Cette tâche reprend ses lignes « Accueil = l'Accueil mobile » et « Bibliothèque = la Bibliothèque mobile » du tableau « Ce que la maquette applique », et les captures `screens/01-accueil.png` et `screens/02-bibliotheque.png`. La maquette interactive est `code.html` (le bouton « Pages de la maquette » liste tous les états, dont l'Accueil vide). Le socle (task-475) fournit le projet `web/`, la barre, la session, l'i18n et le thème.

## Périmètre

- **Accueil** : « Ajouts récents » et « Reprendre l'apprentissage » en rangées de vignettes 16:9 de 200 px avec flèches ‹ ›, dossiers en mosaïque. **Ni** carte « Revue des non classés » (l'onglet Non classés · N de la barre la remplace), **ni** alerte de minutes, **ni** boutons flottants (le + est le bouton « Ajouter » de la barre). L'état vide.
- **Bibliothèque** : section « Dossiers » repliable avec le + de création d'un dossier (au premier niveau), grille d'icônes de dossier avec Non classés en premier et teinté à part, puis « Tous les médias » en vignettes sur deux colonnes. **Pas de champ de recherche** : celui de la barre suffit.
- Un clic sur un média ou un dossier mène aux routes que task-477 et task-478 remplissent.

## Règles

- Câblé sur les endpoints existants : **pas de nouvelle route** d'API.
- Les dossiers n'ont qu'un niveau : aucun écran ne crée un dossier dans un dossier, et « Déplacer le dossier » n'existe pas.
- Ne modifier aucun fichier de `mobile/` (lecture par l'alias seulement).
- Rien n'est déployé : aucune compatibilité. Pas de tests automatisés.

## Note à l'owner

Vérification visuelle contre les captures 01 et 02 sur un navigateur de bureau, contre l'API `-dev`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 L'Accueil rend Ajouts récents, Reprendre l'apprentissage et la mosaïque de dossiers comme la ligne Accueil du README de la maquette, sans carte de revue, sans alerte de minutes ni bouton flottant, avec son état vide
- [ ] #2 La Bibliothèque rend la section Dossiers repliable avec création d'un dossier de premier niveau et Non classés en premier, puis Tous les médias sur deux colonnes, sans champ de recherche
- [ ] #3 Les écrans sont câblés sur les endpoints existants, sans nouvelle route, et aucun écran ne crée un dossier dans un dossier ni ne déplace un dossier
- [ ] #4 Les libellés sont présents dans les 11 langues
- [ ] #5 Le build passe, typecheck et lint sont propres, et aucun fichier de mobile/ n'est modifié
<!-- AC:END -->
