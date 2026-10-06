---
id: TASK-433
title: >-
  Ajouter un thème sombre Amber Clarity et son entrée « Changer le thème » sur
  l'écran Compte
status: To Do
assignee: []
created_date: '2026-10-06 15:47'
labels:
  - feature
  - mobile
dependencies: []
references:
  - mobile/app/(tabs)/account.tsx
  - mobile/src/constants/theme.ts
  - mobile/app/settings/reading-language.tsx
  - mobile/app/settings/interface-language.tsx
  - .testflight-feedback/report-2026-10-05.md
priority: medium
type: feature
ordinal: 40000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Contexte

Demande d'un testeur beta (feedback TestFlight `APwcwHB-cutTdM2Qlt-e_OU`, iPhone 11 / iOS 26.6.2, build 10, triage du 2026-10-05) :

> « Ajouter un menu « Changer le thème » qui propose de choisir entre Clair ou Sombre. D'ailleurs le theme clair existe deja mais il faut creer le theme sombre. »

Sa capture d'écran montre l'écran **Compte**, et désigne le bloc de réglages (`styles.menuCard` dans `mobile/app/(tabs)/account.tsx`) qui porte aujourd'hui *Langue de lecture*, *Langue de l'app*, *Suggestions* et *Signaler un bug*. Le **où** est donc déjà tranché par le testeur. Les deux entrées de langue ouvrent chacune un écran dédié (`/settings/reading-language`, `/settings/interface-language`) : c'est la convention du dépôt pour un réglage à choix multiple.

Le menu lui-même est trivial. Ce qu'il commande ne l'est pas, et deux choses n'existent pas aujourd'hui :

1. **Aucune palette sombre.** `mobile/src/constants/theme.ts` (164 lignes) n'a aucune variante sombre. Sa seule occurrence de « dark » est un commentaire justifiant une teinte bleu-gris assombrie pour rester lisible — le fichier porte un raisonnement de contraste explicite propre au design system *Amber Clarity*. Décliner cet accent ambre sur fond sombre est un choix de design, pas une transposition mécanique.
2. **Aucun mécanisme de thème réactif.** `useColorScheme` n'est utilisé nulle part dans `mobile/`, et **57 fichiers importent les tokens en statique** (32 sous `src/`, 25 sous `app/`). Servir un thème au choix de l'utilisateur suppose de choisir comment le distribuer et de convertir ces 57 consommateurs.

L'owner a décidé (2026-10-06) de ne pas passer par un benchmark : la tâche porte donc aussi ces deux choix, à trancher par l'implémenteur et à justifier dans le code, plutôt que dans un README de recherche préalable.

## Contraintes établies

- **Trois états à offrir**, pas deux : suivre le système, forcer clair, forcer sombre. Le testeur demande « Clair ou Sombre », mais un réglage de thème sans « suivre le système » est le défaut que tout le monde attend et que personne ne demande explicitement.
- **La persistance suit celle des réglages voisins.** La langue d'interface « ne quitte jamais l'appareil » (commentaire de `account.tsx:241-244`) ; le thème est du même ordre et n'a rien à faire au backend.
- **Android autant qu'iOS.** Ce retour vient d'iOS parce que *tout* retour TestFlight vient d'iOS. Un thème est du React Native partagé : c'est précisément le genre de sujet où une garde `Platform.OS` serait introduite à tort.
- **Ne pas sur-traduire.** Le commit `488dc6b` a retiré la traduction des noms de formats, de fonctionnalités et du store. Les libellés du menu et de ses options se traduisent ; aucun nom de fonctionnalité ne s'invente par catalogue.
- **Pas de couche de compatibilité.** Rien n'est déployé en magasin : les 57 importateurs statiques sont convertis dans la même passe, l'ancien chemin d'import n'est pas conservé « au cas où ».

## Notes pour l'owner (hors critères d'acceptation)

- La validation visuelle du thème sombre sur l'ensemble des écrans est une vérification manuelle sur appareil, iOS **et** Android. Un agent en worktree ne peut pas la remplir : à ta main après fusion.
- Changement JavaScript uniquement, aucun module natif : le coût de livraison est un `eas update` (OTA), pas un build TestFlight, donc rien sur le quota EAS.
- Les ratios de contraste de la palette sombre méritent ton œil avant la validation visuelle : c'est là que se joue la lisibilité de l'accent ambre sur fond sombre.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Une entrée « Changer le thème » existe dans le bloc de réglages de l'écran Compte, parmi les entrées de langue, de suggestions et de signalement de bug désignées par la capture du testeur
- [ ] #2 Le réglage offre trois états — suivre le système, clair, sombre — et l'état choisi est relu au démarrage suivant de l'app depuis un stockage local, sans aller-retour backend
- [ ] #3 `mobile/src/constants/theme.ts` expose une variante sombre pour chacun des tokens que la variante claire définit : aucun token n'existe d'un seul cóté
- [ ] #4 Aucun fichier de `mobile/src/` ni de `mobile/app/` n'importe plus les tokens clairs en statique pour une valeur qui doit changer avec le thème ; les 57 importateurs actuels passent par la distribution réactive, et un `grep` sur l'ancien chemin d'import le confirme
- [ ] #5 Le choix du mécanisme de distribution du thème est justifié en commentaire à l'endroit qui le porte, en nommant ce que `useColorScheme` apporte et ce à quoi il ne suffit pas
- [ ] #6 Les ratios de contraste de chaque paire texte/fond de la palette sombre sont calculés et écrits dans un fichier du dépôt, avec le seuil WCAG visé et le résultat atteint par paire
- [ ] #7 Le libellé de l'entrée et ceux de ses trois options sont présents dans les 11 catalogues i18n, sans traduction d'un nom de fonctionnalité ni d'un nom propre
- [ ] #8 Aucune garde `Platform.OS` n'est introduite sur le chemin du thème : le même code sert iOS et Android
- [ ] #9 `npx tsc --noEmit` et `npx eslint` passent sans erreur sur `mobile/`
<!-- AC:END -->
