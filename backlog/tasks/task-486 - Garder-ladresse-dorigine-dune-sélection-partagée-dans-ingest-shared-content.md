---
id: TASK-486
title: Garder l'adresse d'origine d'une sélection partagée dans ingest-shared-content
status: To Do
assignee: []
created_date: '2026-10-11 15:58'
labels:
  - backend
  - api
  - feature
dependencies: []
references:
  - docs/research/task-424-website-and-browser-extension/README.md
  - >-
    docs/research/task-424-website-and-browser-extension/complement-response-2026-10-11.md
  - media_summarizer/api/endpoints/media.py
  - media_summarizer/core/media_ingestion/domain.py
  - media_summarizer/core/services/media_identity.py
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
priority: medium
type: feature
ordinal: 93000
dispatchable: true
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Source de vérité : `docs/research/task-424-website-and-browser-extension/README.md`, section **Owner Validation**, champ `Decision` du 2026-10-11, tel que précisé par `complement-response-2026-10-11.md` (même répertoire), qui prime sur la Recommendation et sur les §8 à §12 du README. Cette tâche est l'élément **X-02** du §3 du complément.

Le `Decision`, point 4 : **l'extension V1 fait comme les apps**. Une sélection, au clic droit, devient une note par `POST /api/media/ingest-shared-content` (`share_type: "text"`) **avec son adresse d'origine** (complément §11). Le champ n'existe pas aujourd'hui sur `IngestSharedContentRequest`.

## Périmètre

- Un champ optionnel `source_url` sur `IngestSharedContentRequest` (`media_summarizer/api/endpoints/media.py`, et le modèle de domaine de `media_summarizer/core/media_ingestion/domain.py` s'il porte la requête), **pour `share_type: "text"` seulement**.
- Validé comme une URL `http(s)` ; refusé quand il est mal formé ou fourni avec un autre `share_type`.
- **Gardé sur l'élément créé** et **rendu par la lecture du média**.
- **Sans effet sur l'identité** : la note reste propre au compte, comme aujourd'hui. `source_url` n'entre jamais dans la clé du média (complément §10 : un texte envoyé par le client ne prend jamais l'identité de l'adresse seule, sinon un autre compte qui enregistre le même lien recevrait ce texte).

Rien d'autre : pas de champ pour le contenu de la page (`extracted_text`, `extracted_title` et Readability sont retirés de la V1).

## Règles

Rien n'est déployé : aucune compatibilité. Pas de tests automatisés ni d'appel in-process de l'app FastAPI comme vérification. Pas de route sous `/api/v1/`. Aucun secret dans les fichiers suivis. L'affichage de l'adresse d'origine dans l'app mobile n'est pas dans cette tâche.

## Note à l'owner

Après déploiement : envoyer une note avec `source_url` sur `-dev`, vérifier qu'elle est gardée et rendue par la lecture du média, et qu'une URL mal formée est refusée.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 IngestSharedContentRequest accepte un champ optionnel source_url pour share_type text seulement, validé comme une URL http(s), et refusé quand il est mal formé ou fourni avec un autre share_type
- [ ] #2 source_url est gardé sur l'élément créé et rendu par la lecture du média
- [ ] #3 source_url n'entre pas dans l'identité du média : la note reste propre au compte
- [ ] #4 docs/CANONICAL_MEDIA_API_CONTRACT.md décrit le champ
- [ ] #5 ruff check et mypy passent
<!-- AC:END -->
