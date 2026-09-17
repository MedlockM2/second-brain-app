---
id: TASK-405
title: >-
  Refléter dans l'app la fin du traitement d'un média sans action de
  l'utilisateur, selon le benchmark validé (task-404)
status: To Do
assignee: []
created_date: '2026-09-17 15:35'
labels:
  - mobile
  - ux
  - bug
dependencies:
  - TASK-404
priority: high
type: bug
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Ce qu'il faut faire

Faire en sorte qu'une vignette de média en cours de traitement reflète la fin de ce traitement **sans action de l'utilisateur**, comme l'a signalé un beta testeur TestFlight (build 9) : aujourd'hui, la vignette de l'Accueil garde son état de chargement jusqu'à ce qu'on ouvre le média puis qu'on revienne.

**L'implémenteur commence par lire `docs/research/task-404-media-processing-completion-ui/README.md`, section `Owner Validation` → `Decision`** (et les fichiers `complement-response-*.md` que la décision cite éventuellement). C'est cette décision qui fixe l'approche, le comportement attendu côté utilisateur et les écrans concernés. Ce que recommandait initialement le benchmark ne fait pas foi si la décision de l'owner diverge.

## Contraintes

- iOS et Android partagent la même base de code : le comportement doit être identique sur les deux, sauf si la décision en dispose autrement.
- Pas de couche de compatibilité : ce que l'approche retenue remplace est supprimé dans le même run (`CLAUDE.md`, « Nothing is deployed yet »), y compris les commentaires qui documentent le défaut actuel.
- Tout nouveau texte visible entre dans les 11 catalogues de `mobile/src/i18n/`.

## Note pour l'owner (hors AC)

La vérification visuelle sur appareil, et le déploiement backend si la décision en demande un, se font après le merge sur `main`. Si la décision impose un changement natif (plugin, dépendance native, `app.config.ts`), le merge consommera un build EAS iOS au lieu d'une OTA.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 L'approche décrite dans le champ Decision du README de task-404 est implémentée et branchée sur chaque écran que cette décision désigne.
- [ ] #2 Le comportement utilisateur spécifié par la décision (y compris traitement long et échec) est couvert par un chemin de code identifiable, sans code conditionnel par plateforme non requis par la décision.
- [ ] #3 Le mécanisme actuel remplacé et les commentaires qui décrivaient le défaut sont supprimés, sans chemin de repli.
- [ ] #4 npm run typecheck et npm run lint propres dans mobile/ ; si le backend ou Terraform sont touchés, ruff, mypy et terraform validate propres.
<!-- AC:END -->
