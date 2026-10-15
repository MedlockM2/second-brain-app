---
id: TASK-525
title: Reporter dans l'app web les évolutions mobile du 11 au 15 octobre (hors chat)
status: To Do
assignee: []
created_date: '2026-10-15 22:02'
labels:
  - web
  - parity
  - feature
dependencies: []
references:
  - mobile-design-mockups/web_app_owner_direction/README.md
  - docs/TESTFLIGHT_2026_10_15_FIXES.md
  - docs/TESTFLIGHT_FIXES_2026_10_15.md
  - docs/MOBILE_RESOURCE_CACHE.md
  - packages/core/src/chat/markdown.ts
  - packages/core/src/cache/resourceCache.ts
  - mobile/src/lib/mediaTypeDisplay.ts
  - mobile/src/components/MarkdownBody.tsx
  - web/src/components/media/ReadingBody.tsx
priority: medium
type: enhancement
ordinal: 132000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

L'app web a été codée le 11 octobre (task-475 à task-484) d'après la direction de l'owner du même jour. Entre le 11 et le 15 octobre, l'app mobile a reçu une trentaine de commits, surtout des retours TestFlight, sans que le web suive. Cette tâche rattrape l'écart. Le chat est traité à part dans **task-480**.

**Ce que « coller au mobile » veut dire ici** : mêmes fonctions et même comportement, pas même écran. `mobile-design-mockups/web_app_owner_direction/README.md` **fait foi** pour la disposition sur ordinateur (barre horizontale, trois volets, revue au clavier, réglages en barre latérale). Chaque point ci-dessous se transpose dans cette disposition.

## À reporter

Pour chaque point, lire la tâche mobile citée (dans `backlog/`) et son commit, puis reprendre le comportement dans `web/` :

1. **task-512** — le titre d'un média ouvre l'original (`original_url`) ; l'en-tête média est allégé.
2. **task-513** — les tableaux Markdown du texte extrait sont rendus en cellules. Le texte intégral passe par l'analyseur partagé `packages/core/src/chat/markdown.ts` (le mobile le dessine dans `mobile/src/components/MarkdownBody.tsx`).
3. **task-523** — la recherche regroupe ses résultats par média (pagination Algolia native) et toutes les pages restent accessibles ; une suppression revalide les pages chargées.
4. **task-511 / task-523** — un retour en haut de « Tous les médias » dans la Bibliothèque, si la page défile assez pour le justifier sur ordinateur.
5. **task-504** — bibliothèque paginée, couvertures dont le chargement échoué se rattrape, dialogue de dossier.
6. **task-517** — création de dossier fiable : un échec se relance sans doublon, le nouveau dossier est suivi jusqu'à sa confirmation.
7. **task-520** — imports contextuels depuis un dossier : ce qui est importé depuis un dossier y est rangé.
8. **task-521** — le lecteur ouvert depuis la revue des non classés se présente comme le mobile le présente désormais, transposé au bureau.
9. **task-522** — le Digest exclut les médias supprimés et résout ses couvertures.
10. **Commit `db64b68a`** — refonte de la carte de revue des non classés : reprendre le contenu de la carte (ligne de métadonnées avec pastille de type colorée et âge, titre, créateur, accroche, puces) dans la revue au clavier du web, sans son carrousel ni sa navigation tactile. Les teintes des pastilles de type (`getMediaTypeBadgeTones`, `mobile/src/lib/mediaTypeDisplay.ts`) passent dans `packages/core` si elles n'ont pas de dépendance de plateforme, et le web les utilise partout où il montre un type de média.
11. **Commit `a2a8cf97`** — « Ajouts récents » prend l'icône `download` et le Digest l'icône `newspaper` ; `sparkles` reste à l'IA d'un média et d'un dossier.
12. **Commit `8c3bdfee`** — terminer un quiz ramène à l'historique des artefacts.
13. **task-506, task-507, task-510, task-518** — cache de consultation : le cache partagé `packages/core/src/cache/resourceCache.ts` sert aux écrans de lecture du web (média, dossier, Digest, file des non classés, sections de l'Accueil), comme le décrit `docs/MOBILE_RESOURCE_CACHE.md`.

## Hors périmètre, déjà tranché

- Propres au clavier ou au tactile iOS : task-508, task-509, task-514, task-515, commits `3d7cf3ef`, `37857fae`, `70e1af65`, `a8032a0a`, `ecc113b2`, `327915b6`.
- Propres au rendu natif : commit `72d48434` (verre Liquid Glass), task-524 (commandes en superposition au bas d'un dossier mobile).
- Déjà sur le web : task-516 (commit `0cc0a66f`).
- Le chat (task-500 à task-503, task-505, task-519) : **task-480**.

Si, en lisant une tâche, un point se révèle sans objet sur ordinateur, ne pas le forcer : le noter dans les Implementation Notes avec la raison.

## Règles

- Ne modifier aucun fichier de `mobile/`, sauf pour déplacer dans `packages/core` du code devenu commun (règle « packages/core » d'`AGENTS.md`) ; ce déplacement est alors aussi un changement mobile : typecheck et lint de `mobile/` et `packages/core`.
- Libellés dans les 11 langues, en réutilisant les clés partagées existantes.
- Rien n'est déployé : aucune compatibilité. Pas de tests automatisés.

## Note à l'owner

Après le merge : `npm run dev` dans `web/` contre l'API dev, et parcourir Accueil, Bibliothèque, recherche, un média avec un tableau, un dossier, le Digest et la revue des non classés.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Les points 1 à 13 de la description sont chacun repris dans web/, ou notés sans objet sur ordinateur dans les Implementation Notes avec leur raison
- [ ] #2 Les tableaux Markdown du texte extrait sont rendus en cellules dans le volet Lecture via packages/core/src/chat/markdown.ts
- [ ] #3 Le titre d'un média ouvre son original_url
- [ ] #4 Les teintes des pastilles de type sont dans packages/core et utilisées par le web et le mobile
- [ ] #5 Ajouts récents utilise l'icône download et le Digest l'icône newspaper dans le web
- [ ] #6 Les libellés ajoutés sont présents dans les 11 langues
- [ ] #7 Le build web passe ; typecheck et lint propres pour web/, et pour mobile/ et packages/core si packages/core a changé
<!-- AC:END -->
