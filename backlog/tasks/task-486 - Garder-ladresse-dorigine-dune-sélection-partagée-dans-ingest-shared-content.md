---
id: TASK-486
title: Garder l'adresse d'origine d'une sélection partagée dans ingest-shared-content
status: Done
assignee: []
created_date: '2026-10-11 15:58'
updated_date: '2026-10-11 16:03'
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
modified_files:
  - media_summarizer/api/endpoints/media.py
  - media_summarizer/api/models/media_contracts.py
  - media_summarizer/core/media_ingestion/domain.py
  - media_summarizer/core/media_ingestion/adapters/orchestrators.py
  - media_summarizer/core/services/durable_media_service.py
  - media_summarizer/core/models/user_media.py
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
- **Sans effet sur l'identité** : `source_url` n'entre jamais dans la clé du média (complément §10 : un texte envoyé par le client ne prend jamais l'identité de l'adresse seule, sinon un autre compte qui enregistre le même lien recevrait ce texte). *Correction du 2026-10-11 :* contrairement à ce que disait le complément, une note partagée n'est **pas** propre au compte — sa clé est un hash du texte seul (`_share_locator`, `use_cases.py`). L'adresse doit donc vivre sur la sauvegarde du compte (ligne `user_media`), jamais sur le contenu partagé.

Rien d'autre : pas de champ pour le contenu de la page (`extracted_text`, `extracted_title` et Readability sont retirés de la V1).

## Règles

Rien n'est déployé : aucune compatibilité. Pas de tests automatisés ni d'appel in-process de l'app FastAPI comme vérification. Pas de route sous `/api/v1/`. Aucun secret dans les fichiers suivis. L'affichage de l'adresse d'origine dans l'app mobile n'est pas dans cette tâche.

## Note à l'owner

Après déploiement : envoyer une note avec `source_url` sur `-dev`, vérifier qu'elle est gardée et rendue par la lecture du média, et qu'une URL mal formée est refusée.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 IngestSharedContentRequest accepte un champ optionnel source_url pour share_type text seulement, validé comme une URL http(s), et refusé quand il est mal formé ou fourni avec un autre share_type
- [x] #2 source_url est gardé sur l'élément créé et rendu par la lecture du média
- [x] #3 source_url n'entre pas dans l'identité du média et reste propre à la sauvegarde du compte qui l'a envoyé, sans jamais être recopié vers un autre compte qui partage le même texte
- [x] #4 docs/CANONICAL_MEDIA_API_CONTRACT.md décrit le champ
- [x] #5 ruff check et mypy passent
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
`POST /api/media/ingest-shared-content` accepte un champ optionnel `source_url`. Il est gardé sur la sauvegarde du compte et rendu par `GET /api/media/{id}` sous le nom `media_item.origin_url`.

- **Validation** (`_validate_shared_source_url`, `api/endpoints/media.py`) : `share_type=text` seulement. L'adresse doit être une URL `http(s)` absolue avec un hôte, de 2 048 caractères au plus. Sinon, la requête est refusée en 400 avant toute écriture. Une valeur vide ou absente vaut « pas d'adresse ».
- **Stockage** : un nouvel attribut `origin_url` sur la ligne `user_media`. Il passe de la requête de domaine à l'orchestrateur, puis à `save_media_for_user` et à `UserMediaRecord`, et n'est écrit qu'à la création.
- **Lecture** : `MediaItemContract.origin_url` vaut null pour tout autre élément. `original_url` reste le localisateur du contenu (`share://…`).
- **Contrat** : nouvelle section « Shared text and the page it came from » dans `docs/CANONICAL_MEDIA_API_CONTRACT.md`, plus une phrase sous `GET /api/media/{id}`.

**Écart avec la prémisse de la tâche.** Une note partagée n'est **pas** propre au compte : sa clé est un hash du texte seul, sans compte (`_share_locator`, `core/media_ingestion/use_cases.py`). Deux comptes qui partagent le même texte ont donc un seul média. De plus, `mirror_job` et `finalize_deduplicated_save` recopient le `source_url` du job sur toutes les lignes de ce média. Mettre l'adresse dans `source_url`, ou sur le job, l'aurait fait écraser ou fuir vers un autre compte. D'où l'attribut `origin_url` propre à la ligne, que ni le miroir ni la finalisation des doublons ne touchent. La description et l'AC #3 sont corrigées en conséquence. La même affirmation erronée figure au §10 du complément de task-424 ; c'est sans effet sur l'identité, puisque l'adresse n'y entre jamais.

Vérifications : `ruff check` et `mypy` passent sur les 6 fichiers Python modifiés.

Note à l'owner : après déploiement, envoyer sur `-dev` une note avec `source_url` et vérifier `media_item.origin_url` dans la lecture. Envoyer ensuite une URL `ftp://` ou relative, puis un `source_url` avec `share_type=audio` : les deux doivent répondre 400.
<!-- SECTION:FINAL_SUMMARY:END -->
