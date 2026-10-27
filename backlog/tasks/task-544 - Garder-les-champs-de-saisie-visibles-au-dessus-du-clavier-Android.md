---
id: TASK-544
title: Garder les champs de saisie visibles au-dessus du clavier Android
status: Done
assignee:
  - '@codex'
created_date: '2026-10-26 20:58'
updated_date: '2026-10-26 21:09'
labels:
  - mobile
  - android
dependencies: []
references:
  - mobile/src/hooks/useKeyboardViewport.ts
  - mobile/src/components/RenameDialog.tsx
documentation:
  - docs/ANDROID_KEYBOARD_FIX_2026_10_26.md
priority: high
type: bug
ordinal: 150000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Retour Android du 26 octobre 2026 : composeur du chat média/dossier et dialogues Nouveau dossier/Renommer masqués par le clavier, depuis les menus et les appuis longs de Recherche. Les captures montrent une navigation système à trois boutons. Les calculs actuels du chat et du nommage exigent que le rectangle du clavier rejoigne le bas du conteneur, alors que React Native 0.83.6 retranche les barres système de sa hauteur Android. Plusieurs autres formulaires reposent sur un redimensionnement implicite. Le plan approuvé couvre une gestion commune du viewport clavier, sans changer les contrats métier. Les corrections TASK-508, TASK-509, TASK-514 et TASK-515 restent le contexte des protections de focus et de visibilité à conserver. Validation visuelle owner après distribution, distincte des contrôles locaux ; aucune publication dans cette tâche.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le chat et tous les dialogues de création/renommage utilisent une gestion commune du viewport, sans condition Android imposant au rectangle du clavier de rejoindre le bas de la fenêtre ni double soustraction après adjustResize.
- [ ] #2 Les surfaces URL, sélecteur de dossiers en feuille et en page et Personnaliser utilisent la même gestion ; les champs défilants restent atteignables et Recherche réutilise le calcul commun en conservant son défilement ciblé.
- [x] #3 Les champs restent montés, visibles et interactifs pendant les mesures, avec resynchronisation à la présentation et invalidation des mesures obsolètes ; les règles de focus du chat et les protections de saisie/enregistrement sont conservées.
- [x] #4 Typecheck et lint mobile ainsi que les exports Android et iOS passent, sans ajout ni exécution de tests automatisés ; une recette manuelle et les limites de vérification native sont documentées.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Centraliser le calcul de hauteur visible et le suivi du clavier dans le mobile, avec suppression de la condition erronée Android et invalidation des mesures obsolètes. 2. Raccorder chat, nommage, URL, sélecteurs de dossiers et Personnaliser ; conserver les règles de focus et de saisie, assurer le défilement vers les champs actifs, partager le calcul avec Recherche. 3. Vérifier le diff, typecheck/lint et exports natifs sans tests automatisés ; documenter la recette appareil et la parité web n/a. Patch local uniquement, sans commit, push ni distribution.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Correction livrée dans le workspace : getKeyboardViewportHeight partagé avec Recherche, useKeyboardViewport commun au chat et aux formulaires, suppression du hook réservé au chat et du calcul dupliqué du nommage. KeyboardViewport mesure le conteneur natif sans le réduire, puis borne son contenu ; les métriques sont relues à la présentation/reprise et les callbacks périmés invalidés. useFocusedInputScroll révèle le champ dans la vraie zone défilante, en tenant compte des en-têtes/pieds ; le focus du nouveau dossier intégré utilise autoFocus au montage au lieu du délai de 100 ms. Cartes URL défilantes, prompt multiligne borné, taps hors carte conservés. AuthScreen et bug-report conservent leur gestion explicite existante. Aucun changement de dépendance, module natif, contrat API ou packages/core. Web: n/a (gestion native du clavier Android).

Vérifications : npm run typecheck --workspace=mobile et npm run lint --workspace=mobile terminés avec code 0 ; seul avertissement any préexistant de purchaseService. Exports Hermes Expo séparés Android et iOS terminés avec code 0 dans /tmp/deepn-task544-android et /tmp/deepn-task544-ios. Revue du diff, contrôle des espaces limité à cette tâche et recherche de chaînes sensibles propres. Aucun test automatisé ajouté ou exécuté. AC 1 et 3 vérifiées comme propriétés du code et de son câblage, sans certification visuelle native.

AC 2 laissée décochée : le raccordement des surfaces et le défilement ciblé sont livrés, mais sa formulation inclut une accessibilité réelle des champs qui ne peut pas être attestée par les contrôles statiques et exports. Aucune recette sur téléphone exécutée ; elle reste à effectuer par owner après distribution et est détaillée dans docs/ANDROID_KEYBOARD_FIX_2026_10_26.md. Ne pas prendre les exports pour une preuve du comportement IME sur appareil. Patch local prêt à relire ; aucune modification préexistante écrasée, aucun commit, push ni distribution.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Gestion commune du clavier Android et défilement vers les champs actifs implémentés pour les surfaces prévues. Typecheck/lint mobile et exports Hermes Android/iOS réussis. Recette native documentée ; AC 2 reste décochée pour la validation visuelle non effectuée. Patch local sans publication.
<!-- SECTION:FINAL_SUMMARY:END -->
