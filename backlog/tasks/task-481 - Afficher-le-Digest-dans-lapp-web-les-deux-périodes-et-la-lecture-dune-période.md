---
id: TASK-481
title: >-
  Afficher le Digest dans l'app web : les deux périodes et la lecture d'une
  période
status: To Do
assignee: []
created_date: '2026-10-11 15:57'
labels:
  - web
  - feature
dependencies:
  - TASK-477
references:
  - docs/research/task-424-website-and-browser-extension/README.md
  - >-
    docs/research/task-424-website-and-browser-extension/complement-response-2026-10-11.md
  - mobile-design-mockups/web_app_owner_direction/README.md
  - mobile-design-mockups/web_app_owner_direction/screens/04-digest.png
  - mobile-design-mockups/web_app_owner_direction/screens/05-digest-periode.png
  - 'mobile/app/(tabs)/digest/[period].tsx'
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
priority: medium
type: feature
ordinal: 88000
dispatchable: true
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Source de vérité : `docs/research/task-424-website-and-browser-extension/README.md`, section **Owner Validation**, champ `Decision` du 2026-10-11, tel que précisé par `complement-response-2026-10-11.md` (même répertoire), qui prime sur la Recommendation et sur les §8 à §12 du README. Cette tâche est l'élément **W-11** du §3 du complément.

L'interface est la direction de l'owner : `mobile-design-mockups/web_app_owner_direction/README.md` **fait foi**. Cette tâche reprend sa ligne « Digest, adapté au bureau » du tableau « Ce que la maquette applique », et les captures `screens/04-digest.png` et `screens/05-digest-periode.png`. Le même README, section « Deux choix faits sans consigne explicite » : **la page de digest porte la discussion**, en reprenant les trois volets du média (task-477) sous le bandeau de la période.

## Périmètre

- **Les deux périodes sur un écran** : Quotidien et Hebdomadaire en deux colonnes, chacune avec sa pile des trois premières couvertures, son nombre de médias, un bouton « Lire » et son sommaire complet (n°, couverture, type, créateur, titre, début de « L'essentiel »). Chaque ligne ouvre la lecture à ce média.
- **La lecture d'une période** : la page média en trois volets de task-477, surmontée d'un bandeau qui remplace les points du mobile par le sommaire de la période, cliquable, avec ‹ ›, les flèches ← → du clavier et la position « 4 / 11 ».

## Règles

- Câblé sur les endpoints existants : **pas de nouvelle route** d'API.
- Les dossiers n'ont qu'un niveau : aucun écran ne crée un dossier dans un dossier, et « Déplacer le dossier » n'existe pas.
- Ne modifier aucun fichier de `mobile/` (lecture par l'alias seulement).
- Rien n'est déployé : aucune compatibilité. Pas de tests automatisés.

## Note à l'owner

Vérification visuelle contre les captures 04 et 05 sur un compte `-dev` qui a un digest quotidien et hebdomadaire.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le Digest rend Quotidien et Hebdomadaire en deux colonnes, chacune avec sa pile de couvertures, son nombre de médias, un bouton Lire et son sommaire complet dont chaque ligne ouvre la lecture à ce média
- [ ] #2 La lecture d'une période réutilise la page média en trois volets de task-477 sous un bandeau du sommaire cliquable, avec ‹ ›, les flèches ← → du clavier et la position
- [ ] #3 Les écrans sont câblés sur les endpoints existants, sans nouvelle route, et aucun écran ne crée un dossier dans un dossier ni ne déplace un dossier
- [ ] #4 Les libellés sont présents dans les 11 langues
- [ ] #5 Le build passe, typecheck et lint sont propres, et aucun fichier de mobile/ n'est modifié
<!-- AC:END -->
