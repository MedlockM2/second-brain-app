---
id: TASK-461
title: >-
  Ouvrir, lister, lire et supprimer les conversations de chat d'un média ou d'un
  dossier sous /api/chat
status: To Do
assignee: []
created_date: '2026-10-10 17:58'
labels:
  - backend
  - api
  - chat
  - feature
dependencies:
  - TASK-457
references:
  - docs/research/task-430-chatbot-architecture/README.md
  - media_summarizer/core/services/artifact_service.py
  - media_summarizer/api/endpoints/artifacts.py
  - media_summarizer/api/main.py
  - media_summarizer/api/dependencies/auth.py
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
priority: medium
type: feature
ordinal: 68000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

L'architecture du chat est décidée par l'owner dans `docs/research/task-430-chatbot-architecture/README.md`, section **Owner Validation**, champ `Decision` du 2026-10-10 — **source de vérité**, qui prime sur la Recommendation et sur le complément. Son point 1 fixe le périmètre produit : « Chat multi-tours à portée **média et dossier**, avec **historique retrouvable** » ; la portée bibliothèque est hors périmètre. Son point 5 place les opérations de « création, lecture, arrêt et suppression » sur **la façade HTTP actuelle, sous `/api/chat`** (API Gateway HTTP + Lambda API + Mangum) ; seul le flux SSE passe par une autre porte.

Cette tâche livre la partie « conversations » de ce routeur. L'envoi d'un tour et l'arrêt sont une tâche séparée qui en dépend ; le flux SSE en est une autre.

## Ce que les routes font

- **Ouvrir une conversation** sur un média ou un dossier du compte. La vérification de propriété, la résolution des sources et les plafonds réutilisent ce que les artefacts font déjà : `resolve_scope_sources` et `enforce_scope_ceilings` (`media_summarizer/core/services/artifact_service.py`). Un dossier couvre le dossier et ses descendants, comme l'onglet Sources (README §11.1). Les refus `scope_empty` et `scope_too_large` existants s'appliquent tels quels, et l'app sait déjà les peindre. **Les plafonds de corpus restent inchangés** (Decision point 8 : « la sélection de Luna ne valide pas son augmentation à 230 000 tokens »).
- **Instantané de sources figé à l'ouverture**, versionné, ordre stable, avec une référence citable par source (Decision point 7, README §11.1 et §13.3) — stocké selon le modèle de la tâche de socle de données (task-457). Si les sources du dossier changent ensuite, la conversation garde son instantané ; c'est une nouvelle conversation qui lit le nouvel état.
- **Lister** les conversations du compte, au minimum pour une portée donnée (un média, un dossier), plus récentes d'abord, avec ce qu'il faut pour afficher une ligne d'historique (titre ou première question, date, nombre de tours, état du dernier tour).
- **Lire** une conversation avec ses messages dans l'ordre, l'état de chaque tour (dont « interrompu »), l'identité de la génération en cours s'il y en a une et le dernier numéro de séquence persisté — ce que le mobile lit au retour au premier plan avant de reprendre le flux (Decision point 6).
- **Supprimer** une conversation et tous ses items (messages, tentatives, fragments, intentions). Pas de TTL sur les conversations (Decision point 3, README §9.5).

Toutes les routes passent par `get_current_user` (JWT de l'app) et vérifient que la conversation appartient au compte. Les refus sont typés (code et chiffres, jamais de phrase : `quota_enforcer.py:72-81` pose la règle).

## Où

`media_summarizer/api/endpoints/chat.py` (neuf), un `media_summarizer/core/services/chat_service.py` (neuf), `media_summarizer/api/main.py` (inclusion du routeur sous `/api/chat`). **Pas de route sous `/api/v1/`** (AGENTS.md, « Do NOT touch »). Contrat documenté dans `docs/CANONICAL_MEDIA_API_CONTRACT.md` : routes, corps, codes d'erreur.

## Règles

Rien n'est déployé : pas de compatibilité. Pas de tests automatisés, pas d'appel in-process de l'app FastAPI comme vérification. Aucun secret dans les fichiers suivis.

## Note à l'owner

Après merge et déploiement : ouvrir une conversation sur un média et sur un dossier de `-dev` par l'API dev, la lister, la lire, la supprimer, et vérifier dans la table chat que tous ses items ont disparu.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Un routeur /api/chat est monté dans media_summarizer/api/main.py, hors de /api/v1/, et toutes ses routes exigent le JWT de l'app et l'appartenance de la conversation au compte
- [ ] #2 L'ouverture d'une conversation sur un média ou un dossier réutilise resolve_scope_sources et enforce_scope_ceilings, conserve les refus scope_empty et scope_too_large et les plafonds de corpus en vigueur, et enregistre un instantané de sources versionné, ordonné et citable
- [ ] #3 La liste des conversations d'un compte pour un média ou un dossier rend les plus récentes d'abord avec de quoi afficher une ligne d'historique
- [ ] #4 La lecture d'une conversation rend ses messages ordonnés, l'état de chaque tour dont l'état interrompu, l'identité de la génération en cours et le dernier numéro de séquence persisté
- [ ] #5 La suppression d'une conversation retire tous ses items de la table chat
- [ ] #6 docs/CANONICAL_MEDIA_API_CONTRACT.md décrit les routes, leurs corps et leurs refus typés
- [ ] #7 ruff check et mypy passent sur les fichiers Python modifiés ou créés
<!-- AC:END -->
