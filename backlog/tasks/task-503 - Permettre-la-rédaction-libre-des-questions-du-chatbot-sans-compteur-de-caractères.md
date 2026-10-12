---
id: TASK-503
title: >-
  Permettre la rédaction libre des questions du chatbot sans compteur de
  caractères
status: Done
assignee:
  - '@codex'
created_date: '2026-10-12 12:13'
updated_date: '2026-10-12 12:17'
labels: []
dependencies: []
documentation:
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
  - docs/research/task-501-chat-inline/README.md
modified_files:
  - mobile/src/components/chat/ChatComposer.tsx
  - media_summarizer/core/services/chat_prompt.py
  - packages/core/src/i18n/ar.ts
  - packages/core/src/i18n/de.ts
  - packages/core/src/i18n/en.ts
  - packages/core/src/i18n/es.ts
  - packages/core/src/i18n/fr.ts
  - packages/core/src/i18n/hi.ts
  - packages/core/src/i18n/it.ts
  - packages/core/src/i18n/ja.ts
  - packages/core/src/i18n/nl.ts
  - packages/core/src/i18n/pt.ts
  - packages/core/src/i18n/zh.ts
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
  - docs/research/task-501-chat-inline/README.md
  - docs/research/task-501-chat-inline/mockups.html
type: enhancement
ordinal: 110000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Le composeur impose 1 000 caractères et affiche un compteur permanent, ce qui empêche les questions détaillées et les collages d'extraits alors que le serveur contrôle déjà le contexte total. L'owner demande une rédaction libre dans l'usage courant, un garde-fou serveur élevé pour les entrées démesurées et un refus explicite à l'envoi qui conserve le brouillon. Le contexte complet reste sans résumé ni troncature. Cette décision remplace le seuil de question du benchmark task-430 ; elle ne rouvre pas l'architecture de chat ni le plafond des tours.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le composeur mobile ne contient plus de maxLength ni de compteur de caractères, et ses catalogues ne contiennent plus la clé du compteur.
- [x] #2 Le serveur conserve le refus typé question_too_long pour un garde-fou élevé documenté, indépendant du budget de contexte total qui reste appliqué à chaque tour.
- [x] #3 Le chemin de refus conserve le brouillon intégral et affiche un message qui permet de raccourcir la demande ; aucun collage n'est tronqué par le composeur.
- [x] #4 Le contrat canonique et les maquettes du chat intégré décrivent et présentent la rédaction libre sans compteur.
- [x] #5 Le typecheck et le lint de mobile et packages/core, ainsi que les vérifications statiques backend ciblées, passent sans ajout de tests automatisés.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Retirer maxLength, le compteur, son style et sa clé des onze catalogues ; conserver quatre lignes visibles puis le défilement interne.
2. Porter MAX_QUESTION_CHARS à 64 000 côté serveur : au plus 256 000 octets UTF-8 de texte, sous la limite DynamoDB de 400 Kio par item avec marge pour les métadonnées. Le contrôle du contexte total reste indépendant et inchangé.
3. Conserver le chemin existant de brouillon sur refus et préciser dans les onze traductions comment raccourcir la question ou le contexte sans perdre le brouillon.
4. Actualiser le contrat canonique et le README/HTML task-501 sans modifier la décision de validation du benchmark.
5. Exécuter typecheck/lint mobile et core, ruff/mypy ciblés backend, et vérifier la cohérence du diff. Aucun test automatisé ajouté ni lancé ; validation appareil/deploy réservée à l'owner.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implémentation dans le worktree second-brain-chat-composer, branche codex/chat-composer-free-input. Aucun commit, merge, push, déploiement ni build de distribution effectué.

Composeur : suppression de maxLength, du compteur et de son style ; hauteur tactile minimale conservée. Clé chat.composer.counter retirée des onze catalogues. Les refus de taille et de contexte expliquent comment raccourcir la demande et signalent la conservation du brouillon.

Garde-fou serveur porté à 64 000 caractères après trim (au plus 256 000 octets UTF-8 de texte, avec marge sous les 400 Kio DynamoDB). Le contrôle de contexte et la limite de tours restent inchangés. Relecture du chemin sendQuestion/ChatDock : false sur refus, brouillon effacé uniquement sur acceptation ; l'action Nouvelle conversation ne réinitialise pas le brouillon local. Les messages DynamoDB sont déjà lus avec pagination complète.

Validation statique : typecheck mobile et packages/core, lint packages/core, ruff et mypy ciblés chat_prompt.py, syntaxe JavaScript des maquettes via node --check, git diff --check : exit 0. Lint mobile : exit 0 avec un seul avertissement préexistant no-explicit-any dans purchaseService.ts:136, fichier non modifié. Les dépendances existantes ont été liées dans le worktree, y compris le résolveur TypeScript installé sous mobile/node_modules ; aucun manifeste ni lockfile modifié.

Validation des AC par état du code et vérifications statiques, conformément aux règles AGENTS.md. Aucun test automatisé ajouté ni lancé. La prévisualisation des URL locales a été rejetée par la politique du navigateur ; aucune tentative de contournement. Validation visuelle et essai contre l'API déployée non effectués. Après intégration et déploiement backend, l'owner pourra vérifier sur appareil un collage de plus de 1 000 caractères et un refus avec conservation du brouillon.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
La limite de 1 000 caractères et le compteur du composeur empêchaient de rédiger des questions détaillées et de coller des extraits. La saisie mobile conserve désormais le texte intégral sans compteur ; le serveur applique un garde-fou de 64 000 caractères et son budget total de contexte existant. Les refus conservent le brouillon et proposent de raccourcir la demande, avec les libellés actualisés dans les onze langues. Le contrat et les maquettes du chat intégré reflètent ce comportement.

Validation : typecheck/lint mobile et core, ruff/mypy ciblés, syntaxe JavaScript des maquettes et git diff --check passent. Un avertissement lint préexistant dans purchaseService.ts reste inchangé. Aucun test automatisé ajouté ou lancé. Prévisualisation locale bloquée par la politique du navigateur ; validation visuelle et API déployée à faire après intégration. Travail isolé sur codex/chat-composer-free-input, sans merge, push ou déploiement.
<!-- SECTION:FINAL_SUMMARY:END -->
