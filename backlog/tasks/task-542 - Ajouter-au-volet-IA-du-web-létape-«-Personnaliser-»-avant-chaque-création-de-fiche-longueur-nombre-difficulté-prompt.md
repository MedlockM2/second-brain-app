---
id: TASK-542
title: >-
  Ajouter au volet IA du web l'étape « Personnaliser » avant chaque création de
  fiche (longueur, nombre, difficulté, prompt)
status: Done
assignee:
  - '@codex'
created_date: '2026-10-26 21:09'
updated_date: '2026-10-26 23:10'
labels:
  - web
  - artifacts
  - ui
dependencies:
  - TASK-535
  - TASK-541
references:
  - mobile/app/artifacts/customize.tsx
  - mobile/src/hooks/useScopeArtifacts.ts
  - mobile/src/lib/artifactContentBlock.ts
  - packages/core/src/artifacts/options.ts
  - web/src/components/ai/useAiPane.tsx
  - mobile-design-mockups/ai_tab_notebooklm/README.md
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
priority: medium
type: feature
ordinal: 148000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

TASK-535 a ajouté à l'app mobile l'étape « Personnaliser » : toucher une tuile de la grille « Générer » ouvre un écran où l'on règle les options de la fiche avant de la générer. Le volet IA du web, refait par TASK-541, lance encore la génération directement, aux valeurs par défaut. Règle « Web parity » d'`AGENTS.md` : le comportement doit être le même sur les deux apps.

Lire d'abord `mobile/app/artifacts/customize.tsx` et `mobile/src/hooks/useScopeArtifacts.ts`, qui portent le comportement à reproduire. Le vocabulaire des options est partagé dans `packages/core/src/artifacts/options.ts` : les options de chaque format, leurs valeurs par défaut, le plafond et le nettoyage du prompt, le retrait des valeurs par défaut. Les textes existent déjà dans les onze langues (`artifacts.customize.*`).

## Périmètre

- **Étape « Personnaliser »** : un clic sur une tuile ouvre l'étape du format, dans le volet ou en dialogue, selon la mise en page du web (`mobile-design-mockups/web_app_owner_direction/README.md`). En tête : l'icône teintée et le titre du format (`artifacts.customize.title.*`). Un seul bouton « Générer ».
- **Options par format** (`formatOptionsOf`) :
  - Longueur pour le résumé ;
  - Nombre et Niveau de difficulté pour les cartes mémo et le quiz ;
  - le prompt seul pour les notes de cours.
  Les quatre formats ont un prompt de 300 caractères au plus, avec le texte d'aide du format. Les valeurs par défaut sont sélectionnées et marquées « (par défaut) ».
- **Envoi** : `parameters` ne porte que les options qui ne sont pas à leur valeur par défaut (`withoutDefaults`).
- **Après « Générer »** : l'étape se ferme sur la ligne de génération animée. Une réponse `reused` ouvre la fiche existante. Un refus typé (quota, 422…) s'affiche dans l'étape, sans la fermer.
- **Relance d'une fiche échouée** (ligne échouée de la liste, fiche ouverte en échec) : sans passer par l'étape. Elle envoie les `request_parameters` de l'entrée, lus par `GET /api/artifacts/{id}` ou dans le 409 `artifact_failed` du contenu, pour relancer cette entrée et non celle aux valeurs par défaut (contrat §5 et §6).

Note pour le propriétaire : contrôle visuel de l'étape pour chaque format, sur un média et sur un dossier, en clair et en sombre. Vérification manuelle, pas un critère d'acceptation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Un clic sur une tuile du volet IA ouvre l'étape Personnaliser du format, avec un seul bouton Générer
- [x] #2 Le résumé propose Longueur ; quiz et cartes mémo proposent nombre et difficulté ; les quatre formats proposent le prompt ; les valeurs par défaut sont sélectionnées et marquées (par défaut)
- [x] #3 La requête ne transmet dans parameters que les options qui ne sont pas à leur valeur par défaut, via packages/core/src/artifacts/options.ts
- [x] #4 Après Générer, l'étape se ferme sur la ligne de génération ; une réponse reused ouvre la fiche existante ; un refus typé s'affiche dans l'étape sans la fermer
- [x] #5 La relance d'une fiche échouée envoie les request_parameters de l'entrée, sans passer par l'étape
- [x] #6 npm run typecheck et npm run lint passent dans web/
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Ajouter le formulaire Personnaliser dans le volet IA avec les options partagées et la parité Sources/Langue de TASK-536. 2. Garder les refus dans le formulaire et ouvrir les entrées réutilisées. 3. Relancer les échecs avec leurs request_parameters, lus dans le détail ou le 409. 4. Vérifier typecheck/lint/build web, lint/typecheck core, committer puis terminer la tâche.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Parité TASK-536 : porter également les sélecteurs Sources et Langue, en réutilisant artifacts/sources.ts et ses traductions. Les quatre formats et les deux scopes suivent les mêmes règles : toutes les sources par défaut, média non décochable, aucune sélection vide envoyée, source_ids seulement pour une sélection partielle de dossier, language seulement hors langue de lecture.

Personnaliser intégré au volet IA : options par format, prompt de 300 caractères, defaults retirés via withoutDefaults, sources et langue en parité TASK-536. Sources chargées par le helper core paginé, sélection temporaire et validation non vide ; langue en endonymes, valeurs par défaut omises. Refus typés conservés dans le formulaire, succès vers la liste et reused vers la fiche. Relance des échecs depuis la ligne ou la fiche avec request_parameters du détail/409 ; aucun fallback vers les defaults si le contrat manque. État 409 effacé uniquement après une relance acceptée. Validation : typecheck et lint web, build Vite de production et typecheck/lint core passent ; avertissement Vite de taille du bundle. Revue de câblage des six AC et des contrats, aucun test automatisé ajouté. Contrôle visuel appareil/navigateur restant au propriétaire comme prévu dans la description.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Étape Personnaliser ajoutée au web pour les quatre formats, avec parité Sources/Langue. Refus conservés et relances fidèles aux paramètres enregistrés. Typecheck, lint et build web validés ; contrôles core validés.
<!-- SECTION:FINAL_SUMMARY:END -->
