---
id: TASK-408
title: >-
  Benchmarker 4 directions de refonte UX de l'onglet Digest (deux axes de
  navigation, densité de contrôles)
status: To Do
assignee: []
created_date: '2026-09-21 10:01'
labels:
  - benchmark
  - mobile
  - ux
dependencies: []
priority: high
type: spike
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Le problème à résoudre

Retour d'un beta testeur TestFlight (build 9, iOS, iPhone 11 414x896 pt, fr-FR) qui demande explicitement un benchmark. Dans ses mots : l'UX de l'onglet Digest est « actuellement très mauvaise (notamment les deux mouvements horizontal (carrousel) et vertical (scroll), le trop plein de bouton (ux fouilli)) », et il veut « 4 différents design possibles pour cet onglet dans le dossier mobile design mockup tout en respectant le design système de l'app ».

## L'écran actuel, tel qu'il se lit sur la capture du retour

De haut en bas : un premier segment `Quotidien` / `Hebdomadaire`, le titre « Votre journée en revue », un compteur `1 / 7` avec 7 points de pagination, **puis un second segment** `Lecture` / `IA`, puis « Aperçu » et « Texte complet » en scroll vertical.

Les deux défauts décrits sont donc structurels, pas cosmétiques :
- **Deux axes de navigation concurrents** : pagination horizontale entre 7 médias, scroll vertical à l'intérieur de chaque page.
- **Deux jeux de segments empilés** avant même d'atteindre le contenu — la source concrète du « trop plein de bouton ».

Ce benchmark part de zéro : la cible n'est pas connue et aucune direction n'est privilégiée. Il ne s'agit pas de retoucher l'habillage de l'écran existant.

## Faits sur le projet, à prendre pour données

- **App mobile** : Expo / React Native, iOS et Android sur la même base de code (`mobile/`). L'écran actuel a été livré par task-366 (Digest V1, `Done`) ; les notifications Digest sont couvertes par task-369.
- **Design system** : *Amber Clarity*. Les tokens font autorité dans `mobile/src/constants/theme.ts`. Référence visuelle dans `mobile-design-mockups/my_design_system`, et `mobile-design-mockups/notebooklm-reference` comme source d'inspiration déjà retenue par le projet.
- **Convention des maquettes** : un répertoire par direction sous `mobile-design-mockups/`, contenant `code.html` + `screen.png` (cf. `daily_digest_your_day_in_review`, `weekly_digest_harmonized_v2`).
- **Tailles d'écran qui ont déjà produit des défauts de mise en page dans ce dépôt** : 414x896 pt (l'appareil du retour) et 320 pt (Display Zoom). Les deux doivent être traitées.
- **Coût d'une livraison mobile** : un changement purement JS/TS part en OTA gratuite ; tout ce qui déplace le fingerprint Expo exige un build, et le palier gratuit EAS n'en donne que 15 iOS par mois (`.github/workflows/mobile-ota-or-build.yml`).
- **Rien n'est publié en store** (voir `CLAUDE.md`, « Nothing is deployed yet ») : aucune contrainte de rétrocompatibilité, aucune transition à ménager. Une direction peut supprimer purement et simplement l'écran actuel.

## Hors périmètre

- Le titre de repli (« Photo — 18 sept. 2026 ») et le badge `UNKNOWN` visibles sur la même capture : déjà tranchés et suivis par **task-400**. Ce benchmark porte sur la navigation de l'onglet, pas sur le libellé d'un média.
- L'implémentation, qui fait l'objet de la tâche dépendante.

## Note pour l'owner, hors AC

La validation visuelle de la direction retenue se fait sur appareil, sur le prochain build : un agent en worktree ne peut pas la satisfaire.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Inventaire de l'écran Digest actuel : chaque contrôle de navigation présent, ce qu'il pilote, et où il est implémenté dans mobile/ (fichiers et composants).
- [ ] #2 Revue des façons documentées par les plateformes (Apple HIG, Material) et observées dans des apps établies de présenter une série d'éléments de lecture quotidienne : au moins 5 approches distinctes, chaque affirmation sourcée par une URL et une date de consultation.
- [ ] #3 4 directions de design distinctes, chacune dans son propre répertoire de mobile-design-mockups/ selon la convention en place (code.html + screen.png).
- [ ] #4 Chaque direction prend explicitement parti sur la cohabitation carrousel horizontal / scroll vertical ; au moins une direction supprime l'un des deux axes.
- [ ] #5 Chaque direction traite explicitement la densité de contrôles : le double segment (Quotidien/Hebdomadaire puis Lecture/IA) et les 7 points de pagination.
- [ ] #6 Chaque direction respecte le design system Amber Clarity et les tokens de mobile/src/constants/theme.ts : aucune nouvelle palette, aucune nouvelle échelle typographique. L'écart éventuel est nommé et justifié.
- [ ] #7 Chaque direction est rendue et mesurée à 414x896 pt et à 320 pt (Display Zoom), les deux tailles ayant déjà produit des défauts de mise en page dans ce dépôt.
- [ ] #8 Pour chaque direction : nombre de gestes pour atteindre le texte complet du n-ième média, comportement quand le digest est vide ou compte un seul élément, et coût de livraison mobile (OTA ou build).
- [ ] #9 Comparaison argumentée des 4 directions et recommandation, avec ce que chacune abandonne par rapport à l'écran actuel.
- [ ] #10 Aucun chiffre inventé : tout nombre non sourcé ni mesuré est marqué comme estimation avec sa méthode de calcul.
- [ ] #11 Le livrable est docs/research/task-408-digest-ux-refonte/README.md, front-matter owner_decision: pending et section Owner Validation vide (champs Decision et Validated at prêts à être remplis).
<!-- AC:END -->
