---
id: TASK-555
title: Afficher les libellés des artefacts dans leur langue de génération
status: Done
assignee:
  - Codex
created_date: '2026-10-27 10:55'
updated_date: '2026-10-27 11:01'
labels:
  - mobile
  - web
  - i18n
  - testflight
dependencies: []
modified_files:
  - media_summarizer/api/endpoints/artifacts.py
  - packages/core/src/types/artifacts.ts
  - packages/core/src/i18n/runtime.ts
  - packages/core/src/artifacts/i18n.ts
  - packages/core/src/i18n/en.ts
  - packages/core/src/i18n/fr.ts
  - packages/core/src/i18n/es.ts
  - packages/core/src/i18n/de.ts
  - packages/core/src/i18n/it.ts
  - packages/core/src/i18n/pt.ts
  - packages/core/src/i18n/nl.ts
  - packages/core/src/i18n/ja.ts
  - packages/core/src/i18n/zh.ts
  - packages/core/src/i18n/ar.ts
  - packages/core/src/i18n/hi.ts
  - 'mobile/app/artifacts/[artifactId].tsx'
  - web/src/components/ai/ArtifactBody.tsx
  - web/src/components/ai/useAiPane.tsx
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
  - docs/testflight-feedback-log.md
priority: high
type: bug
ordinal: 161000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Retour TestFlight ABrzq2cns42GfLdTdNrNwiY du 27 octobre 2026, build 17, iPhone 11 sous iOS 26.6.2 : un résumé généré en anglais affiche encore « Points clés » et « À retenir » en français. Les titres des templates doivent suivre la langue choisie à la génération, y compris à la réouverture, sur mobile et web. Le choix de langue de l’interface doit rester indépendant. La capture est conservée localement hors git. Aucun changement de génération de quiz ni test automatisé.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Les lecteurs mobile et web utilisent la langue enregistrée de l’artefact pour les libellés de ses sections, indépendamment de la langue actuelle de l’interface et du profil.
- [x] #2 Les templates résumé, notes et cartes mémo, ainsi que les libellés de lecture du quiz, sont raccordés à la même résolution de langue sans modifier la génération.
- [x] #3 Les typechecks et lints mobile, core et web passent ; le diagnostic et les limites de validation sont documentés sans données de testeur.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Exposer dans GET /api/artifacts/{id}/content la langue immuable de record.parameters, sans écrire de données ni toucher aux workers. Mettre à jour le contrat partagé.
2. Ajouter une traduction liée à un catalogue/locale dans core, sans modifier le catalogue global. Résoudre la langue de l’artefact parmi les onze langues supportées, repli de référence anglais en absence de langue.
3. Injecter cette traduction dans les titres de sections et libellés des templates des lecteurs mobile et web ; conserver les commandes de navigation et erreurs dans la langue UI.
4. Vérifier types/lint des trois workspaces, Ruff/mypy du backend, exports iOS/Android et build web. Documenter diagnostic et contrôle appareil restant, mettre à jour le registre, committer uniquement les fichiers de la correction.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Collecte App Store Connect : 84 retours parcourus sur 90 jours, un seul nouveau après déduplication par identifiants ; build courant 17. Capture examinée : titre et prose anglais, sections Points clés et À retenir françaises. Paramètres de génération déjà persistés ; aucun besoin de migration ni de régénération.

Correctif final : GET /api/artifacts/{id}/content expose language depuis les paramètres persistés du record résolu ; aucun changement au worker, à la génération, à S3 ou aux données. Le type ArtifactContentResponse et le contrat API décrivent ce champ nullable. Le traducteur local core utilise un catalogue explicite sans muter activeLocale/activeCatalog ; normalisation des tags et repli anglais de référence si aucun target supporté n’est disponible. Les sections des résumés/notes, importance core/supporting (deux nouvelles clés dans les onze catalogues), question/réponse des cartes, compteurs et explication du lecteur quiz utilisent ce traducteur. Les commandes et erreurs gardent la langue UI.

Vérification objective : typecheck et lint mobile, core et web sortent 0, warning préexistant purchaseService.ts:136 uniquement. Ruff du fichier API et mypy media_summarizer sortent 0 (207 fichiers). Build web réussi, avertissement taille du bundle JS ~1,18 Mo. Exports Expo iOS et Android réussis avec avertissements locaux de configuration API/Sentry. Première tentative --platform all abandonnée car elle incluait Expo web, dont les dépendances ne sont volontairement pas installées ; export des deux plateformes natives réussi sans changement de dépendance. Aucun test automatisé ajouté ou lancé.

Vérification manuelle dans Safari sur un aperçu temporaire hors git des vrais composants web (sans API simulée ni appel backend local) : UI française et artefact anglais montrent Key points/Takeaway, les sept sections des notes et 2 cards. Carte retournée : ANSWER ; choix quiz effectué : EXPLANATION. Artefact passé en français : Points clés/À retenir, 2 cartes, RÉPONSE, EXPLICATION. UI passée en allemand : Weiter/Fertig/Antwort ausblenden tandis que les sections restent françaises. Les onze catalogues et la pluralisation arabe à deux cartes ont été lus dans le même rendu. Badge CORE présent après raccordement des niveaux d’importance. Ces manipulations valident le rendu web ; le raccordement natif est vérifié par types/lint et exports, pas par un appareil iOS.

Distribution restante (hors demande de commit) : déployer l’API puis diffuser OTA mobile et build web ; aucun nouveau binaire natif requis. Le nouvel API lit la langue déjà stockée, donc les artefacts existants deviennent lisibles correctement sans régénération. Validation iPhone/iOS et Android à faire après distribution. Registre de déduplication complété. Modification propriétaire docs/V1_LAUNCH_PLAN.md conservée hors commit.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Les templates des artefacts suivent désormais leur langue de génération sur mobile et web, y compris leurs sections, badges de notes, compteurs et libellés pédagogiques. L’API expose la langue persistée ; core fournit une traduction locale indépendante de la langue UI, avec les onze catalogues. Aucun changement de génération, migration ou régénération. Types/lints, Ruff/mypy, build web et exports iOS/Android réussis ; rendu web manipulé dans Safari en croisant les langues UI/artefact. Déploiement API puis distribution OTA/web et validation sur appareil restent à faire.
<!-- SECTION:FINAL_SUMMARY:END -->
