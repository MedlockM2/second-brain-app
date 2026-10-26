---
id: TASK-535
title: >-
  Ajouter l'écran « Personnaliser » avant chaque création de fiche (longueur,
  nombre, difficulté, prompt)
status: To Do
assignee: []
created_date: '2026-10-26 16:47'
updated_date: '2026-10-26 17:01'
labels:
  - mobile
  - artifacts
  - ui
dependencies:
  - TASK-531
  - TASK-534
references:
  - mobile-design-mockups/ai_tab_notebooklm/README.md
  - mobile-design-mockups/ai_tab_notebooklm/screen.png
  - mobile/src/components/ArtifactsPanel.tsx
  - mobile/src/services/artifactService.ts
  - mobile/src/components/CompletedDetailView.tsx
  - 'mobile/app/media/folders/[id].tsx'
  - 'mobile/app/artifacts/[artifactId].tsx'
  - packages/core/src/i18n/fr.ts
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
priority: high
type: feature
ordinal: 142000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Comme dans NotebookLM, toucher une tuile de la grille « Générer » (TASK-534) ouvre une étape intermédiaire, « Personnaliser », où l'on règle les options avant de lancer la génération. La maquette est dans `mobile-design-mockups/ai_tab_notebooklm/`, section « Personnaliser ». Le contrat des options est celui de TASK-531. Il y a quatre formats : Résumé, Notes de cours, Cartes mémo, Quiz. Les sélecteurs de sources et de langue sont ajoutés par TASK-536.

## Périmètre

- **Écran plein**, en modal, avec une croix pour fermer en haut à droite. En tête, l'icône teintée du format et un titre par format (« Personnaliser le résumé », « … les notes de cours », « … les cartes mémo », « … le quiz »). En bas, un seul bouton « Générer ». Pas d'« Utilisation de l'IA », pas de « Générer plus tard ».
- **Options par format** :

| Option | Résumé | Notes de cours | Cartes mémo, quiz |
|---|---|---|---|
| « Longueur » : Courte (par défaut), Moyenne, Longue → `length` | oui | non | non |
| « Nombre de cartes » ou « Nombre de questions » : Moins, Standard (par défaut), Plus → `count` | non | non | oui |
| « Niveau de difficulté » : Facile, Moyen (par défaut), Difficile → `difficulty` | non | non | oui |
| « Prompt » → `focus`, 300 caractères au plus | oui | oui | oui |

  - Le texte d'aide du prompt est propre à chaque format, par exemple « Sur quoi le quiz doit-il se concentrer ? ». Pour le résumé, il ajoute « Laissez vide pour un résumé général. ».
- **Valeurs par défaut** : elles sont sélectionnées, avec la mention « (par défaut) », et un appui direct sur « Générer » lance la génération.
- **Envoi** : `ArtifactService.generateArtifact` reçoit les options et les transmet dans `parameters`, en omettant celles laissées à leur valeur par défaut. Les relances d'une fiche échouée (écran de fiche, ligne échouée de la liste) relancent avec les paramètres de l'entrée échouée, sans passer par l'écran.
- **Après « Générer »** : l'écran se ferme et la ligne animée apparaît en tête de liste (TASK-534). Une réponse `reused` ouvre la fiche existante. Un refus typé (quota, source pas prête, 422) s'affiche dans l'écran « Personnaliser », sans le fermer.
- Les textes existent dans les onze langues de `packages/core/src/i18n`.

Note pour le propriétaire : contrôle visuel sur simulateur, pour chaque format, sur un média et sur un dossier, en clair et en sombre. Vérification manuelle, pas un critère d'acceptation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Toucher une tuile ouvre l'écran Personnaliser du format, en plein écran, avec une croix et un seul bouton Générer
- [ ] #2 Le résumé propose Longueur (Courte par défaut, Moyenne, Longue) et le prompt ; quiz et cartes mémo proposent nombre, difficulté et prompt ; les notes de cours proposent le prompt ; les valeurs par défaut sont sélectionnées et marquées (par défaut)
- [ ] #3 generateArtifact transmet les options non par défaut dans parameters, selon le contrat de TASK-531
- [ ] #4 Après Générer, l'écran se ferme sur la ligne animée ; une réponse reused ouvre la fiche existante ; un refus typé s'affiche dans l'écran sans le fermer
- [ ] #5 Les nouveaux textes existent dans les onze langues
- [ ] #6 npm run typecheck et npm run lint passent dans mobile/
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Mise à jour 2026-10-26 : le résumé détaillé est supprimé (TASK-537, TASK-538). Il reste quatre formats. Le Résumé gagne une option « Longueur » (Courte par défaut, Moyenne, Longue ; clé length, valeurs short, medium, long, contrat TASK-531). Les Notes de cours n'ont que le prompt (plus les sources et la langue de TASK-536). Voir la maquette mise à jour.
<!-- SECTION:NOTES:END -->
