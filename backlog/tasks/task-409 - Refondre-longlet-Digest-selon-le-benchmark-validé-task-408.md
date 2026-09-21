---
id: TASK-409
title: Refondre l'onglet Digest selon le benchmark validé (task-408)
status: To Do
assignee: []
created_date: '2026-09-21 10:01'
labels:
  - mobile
  - ux
dependencies:
  - TASK-408
priority: high
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Contexte

L'UX de l'onglet Digest est à refondre : deux axes de navigation concurrents (carrousel horizontal entre les médias, scroll vertical à l'intérieur de chaque page) et une densité de contrôles excessive (deux jeux de segments empilés, `Quotidien`/`Hebdomadaire` puis `Lecture`/`IA`, plus 7 points de pagination) avant d'atteindre le contenu. Origine : retour d'un beta testeur TestFlight sur le build 9.

## Ce qu'il faut lire avant de commencer

**Lire `docs/research/task-408-digest-ux-refonte/README.md`** : la décision finale de l'owner s'y trouve dans la section *Owner Validation*, champ `Decision`, et c'est elle qui fait autorité sur l'architecture et la direction de design à suivre.

Si le champ `Decision` renvoie à un fichier de complément (`complement-response-*.md`) ou en précise les termes, suivre ces références aussi. La recommandation du benchmark **n'est volontairement pas recopiée ici** : la décision de l'owner peut différer de la recommandation initiale, et c'est le README qui fait foi.

La maquette de la direction retenue est dans son répertoire sous `mobile-design-mockups/` (`code.html` + `screen.png`).

## Contraintes du projet

- Design system *Amber Clarity*, tokens dans `mobile/src/constants/theme.ts` : pas de nouvelle palette, pas de nouvelle échelle typographique.
- Rendu à vérifier à 414x896 pt et à 320 pt (Display Zoom) — les deux tailles qui ont déjà produit des défauts de mise en page dans ce dépôt.
- iOS et Android partagent la base de code : pas de garde `Platform.OS` sauf nécessité nommée et justifiée.
- Toute chaîne visible passe par les catalogues i18n (11 catalogues dans le dépôt).
- **Rien n'est publié en store** (`CLAUDE.md`, « Nothing is deployed yet ») : l'ancien écran est **supprimé dans le même run**, pas conservé en repli. Aucune couche de compatibilité, aucun double affichage pendant une transition.
- Idéalement le changement reste purement JS/TS pour partir en OTA gratuite ; si la direction retenue impose de déplacer le fingerprint Expo, le dire explicitement dans les notes (un build TestFlight est alors consommé sur les 15 iOS/mois du palier gratuit).

## Hors périmètre

- Le titre de repli et le badge `UNKNOWN` des vignettes : suivis par **task-400**.
- Les notifications Digest : couvertes par **task-369**.

## Note pour l'owner, hors AC

La validation visuelle de la refonte se fait sur appareil, sur le prochain build : un agent en worktree ne peut pas la satisfaire.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 La direction de design retenue par l'owner dans docs/research/task-408-digest-ux-refonte/README.md est identifiée et citée dans les notes d'implémentation, avec le chemin de sa maquette.
- [ ] #2 L'onglet Digest est reconstruit conformément à cette direction : le parti pris sur les deux axes de navigation et la réduction de la densité de contrôles sont tous deux effectifs dans le code.
- [ ] #3 L'écran Digest précédent et tout composant devenu inutilisé par la refonte sont supprimés dans le même run, sans repli ni chemin de compatibilité ; aucune référence morte ne subsiste (vérifiable par recherche dans mobile/).
- [ ] #4 Les valeurs de style proviennent des tokens de mobile/src/constants/theme.ts ; aucune couleur ni taille typographique codée en dur n'est introduite.
- [ ] #5 Toute chaîne visible est présente dans les 11 catalogues i18n, sans clé orpheline ni clé manquante.
- [ ] #6 Les états vides et limites sont traités et atteignables dans le code : digest vide, digest à un seul élément, chargement, échec.
- [ ] #7 npm run lint et npx tsc --noEmit passent sans erreur dans mobile/.
- [ ] #8 Les notes d'implémentation indiquent si le changement part en OTA ou exige un build, en nommant les fichiers qui déplacent le fingerprint Expo le cas échéant.
<!-- AC:END -->
