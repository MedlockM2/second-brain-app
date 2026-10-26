---
id: TASK-535
title: >-
  Ajouter l'écran « Personnaliser » avant chaque création de fiche (longueur,
  nombre, difficulté, prompt)
status: To Do
assignee: []
created_date: '2026-10-26 16:47'
updated_date: '2026-10-26 21:20'
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
- [x] #1 Toucher une tuile ouvre l'écran Personnaliser du format, en plein écran, avec une croix et un seul bouton Générer
- [x] #2 Le résumé propose Longueur (Courte par défaut, Moyenne, Longue) et le prompt ; quiz et cartes mémo proposent nombre, difficulté et prompt ; les notes de cours proposent le prompt ; les valeurs par défaut sont sélectionnées et marquées (par défaut)
- [x] #3 generateArtifact transmet les options non par défaut dans parameters, selon le contrat de TASK-531
- [x] #4 Après Générer, l'écran se ferme sur la ligne animée ; une réponse reused ouvre la fiche existante ; un refus typé s'affiche dans l'écran sans le fermer
- [x] #5 Les nouveaux textes existent dans les onze langues
- [x] #6 npm run typecheck et npm run lint passent dans mobile/
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Mise à jour 2026-10-26 : le résumé détaillé est supprimé (TASK-537, TASK-538). Il reste quatre formats. Le Résumé gagne une option « Longueur » (Courte par défaut, Moyenne, Longue ; clé length, valeurs short, medium, long, contrat TASK-531). Les Notes de cours n'ont que le prompt (plus les sources et la langue de TASK-536). Voir la maquette mise à jour.

Implémentation 2026-10-26 (agent, branche worktree-agent-a4690ac59a07e29de).

- **Écran** : route `mobile/app/artifacts/customize.tsx`, déclarée en `fullScreenModal` dans `app/_layout.tsx` (sans geste de fermeture : la croix est la seule sortie, un glissement ferait perdre le prompt). Paramètres de route : `scope`, `scopeId`, `type`. En tête : la croix (`ScreenHeader` + `HeaderIconButton`), l'icône du format sur sa teinte, le titre du format ; en bas, un seul bouton « Générer ». Les options d'un format viennent de `formatOptionsOf` : Longueur (résumé), Nombre de cartes ou de questions et Niveau de difficulté (cartes mémo, quiz), rien d'autre que le prompt (notes de cours). Valeurs par défaut sélectionnées et libellées « {label} (par défaut) ». Prompt : `maxLength` 300, texte d'aide propre au format.
- **Grille** : `useScopeArtifacts.generate` est remplacé par deux fonctions. `customize(type)` ouvre l'écran ; un second appui avant que la modale ne couvre l'onglet est ignoré, et le verrou se lève au retour du focus. `retry(artifact)` relance une fiche échouée (voir plus bas).
- **Envoi** : `ArtifactService.generateArtifact(scope, scopeId, type, parameters)` retire les valeurs par défaut et nettoie le prompt avec `withoutDefaults`. Aucun `parameters` n'est envoyé quand il ne reste rien, si bien qu'un appui direct sur « Générer » envoie la même requête qu'avant. Le vocabulaire est dans `packages/core/src/artifacts/options.ts`, partagé avec le web ; les types (`ArtifactGenerationParameters`, `SummaryLength`, `ItemCount`, `Difficulty`) sont dans `packages/core/src/types/artifacts.ts`.
- **Après « Générer »** : l'écran attend la réponse, le bouton passe en chargement.
  - Requête acceptée : l'entrée est déjà fusionnée dans l'historique par `generateArtifact`, et l'écran se ferme sur la ligne animée de TASK-534.
  - `reused` : `router.back()` puis `router.push('/artifacts/<id>')`.
  - Refus typé : `describeArtifactRefusal` l'affiche dans un bandeau au-dessus du bouton ; l'écran reste ouvert et garde les options.
  - La croix reste active pendant la requête : partir n'annule pas une génération que le backend a peut-être déjà mise en file, et l'entrée apparaît alors dans la liste.
- **Relances sans l'écran, avec les paramètres de l'entrée** : l'API n'exposait les `parameters` d'une entrée nulle part, donc le client ne pouvait relancer qu'aux valeurs par défaut, c'est-à-dire sur une autre entrée. J'ai ajouté côté backend (commit à part) `request_parameters` à `GET /api/artifacts/{id}`, à la réponse du `POST` et au 409 `artifact_failed` du contenu (`artifact_service.request_parameters_of`). Il contient les options de l'entrée, sa langue seulement si elle a été épinglée, et `source_ids` si un dossier a choisi ses sources ; il vaut `{}` aux valeurs par défaut. Contrat §5 et §6 et OpenAPI mis à jour ; ruff et mypy passent sur les deux fichiers.
  - La ligne échouée de la liste lit d'abord l'entrée, puisque la liste, projection de la GSI, n'a pas de paramètres, puis relance.
  - L'écran de fiche reprend les paramètres du 409 (`readArtifactContentBlock`).
- **i18n** : 24 clés `artifacts.customize.*` dans les onze catalogues (titres et textes d'aide par format, sections, valeurs, mention « (par défaut) », bouton). Le libellé a11y du bouton réutilise `artifacts.a11yGenerate`, la croix `common.close`. En allemand et en néerlandais, « Standard » est rendu par « Normal » / « Normaal », pour éviter « Standard (Standard) ».
- **Vérifications** : `npm run typecheck` et `npm run lint` passent dans `mobile/` (seul reste l'avertissement préexistant de `purchaseService.ts`). `tsc` et `eslint` passent dans `packages/core`, et `npm run typecheck` dans `web/` (types partagés modifiés). `scripts/check_web_parity.py main..HEAD` passe.
- **Parité web** : TASK-542 créée (étape « Personnaliser » et relance avec `request_parameters` dans le volet IA du web), après TASK-541. Le web n'a pas été modifié.

Écarts avec la maquette, à signaler au propriétaire :
- Titre en 20 px gras (taille `headline`) au lieu de 26 px : la gamme n'a pas de 26, et 32 px (`display`) coupe « Personnaliser les cartes mémo » sur deux lignes.
- Le prompt suit la règle d'`AuthField` : contour discret au repos, anneau ambré au focus. La maquette, figée, le montre toujours ambré.
- Pastilles de 48 px de haut (`TouchTarget.minimum`) au lieu de 44.
- L'icône des cartes mémo reste `card-outline` (TASK-539).

Hors de portée de cet agent :
- Le backend de `request_parameters` doit être déployé (au push sur `main`) pour qu'une relance retrouve les options d'une fiche personnalisée. Avant le déploiement, une relance part aux valeurs par défaut.
- Contrôle visuel sur simulateur, pour chaque format, sur un média et sur un dossier, en clair et en sombre (note du propriétaire).
<!-- SECTION:NOTES:END -->
