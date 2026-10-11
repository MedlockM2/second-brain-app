---
id: TASK-490
title: >-
  Benchmark de l'enregistrement des pages payantes ou derrière une connexion,
  pour l'extension et le partage depuis Safari
status: To Do
assignee: []
created_date: '2026-10-11 15:59'
labels:
  - benchmark
  - scoping
  - extension
dependencies: []
references:
  - docs/research/task-424-website-and-browser-extension/README.md
  - >-
    docs/research/task-424-website-and-browser-extension/complement-response-2026-10-11.md
  - >-
    docs/research/task-424-website-and-browser-extension/README.owner-rejected-2026-10-05.md
  - media_summarizer/core/services/media_identity.py
  - media_summarizer/api/endpoints/media.py
priority: medium
type: task
ordinal: 97000
dispatchable: true
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Source de vérité : `docs/research/task-424-website-and-browser-extension/README.md`, section **Owner Validation**, champ `Decision` du 2026-10-11, tel que précisé par `complement-response-2026-10-11.md` (même répertoire), qui prime sur la Recommendation et sur les §8 à §12 du README. Cette tâche est l'élément **B-02** du §3 du complément.

Le `Decision`, point 4 : en V1, l'extension envoie l'adresse de la page, que le serveur lit comme un lien public ; **les pages payantes ou derrière une connexion sont reportées à ce benchmark**, commun à l'extension et au partage depuis Safari sur iPhone (complément §11).

## Ce que le benchmark étudie

- Le périmètre : **l'extension navigateur et le partage depuis Safari sur iPhone**.
- Il compare l'**envoi du HTML de la page au serveur**, extrait par trafilatura comme pour les liens (ce que font Readwise, Karakeep et Omnivore), et une **extraction dans le navigateur**.
- Il traite la **taille de l'envoi** : HTML nettoyé, plafond explicite.
- Il applique la **règle d'identité du complément §10** : un texte envoyé par le client peut venir d'une page payante ou privée et **ne prend jamais l'identité de l'adresse seule** (`generate_media_key(canonical_url)` est l'identité partagée, dans `media_summarizer/core/services/media_identity.py`). L'identité est soit propre au compte (`generate_account_scoped_media_key`), soit au minimum l'adresse et ce texte ensemble, comme pour les articles depuis task-392 (`generate_article_media_key`).
- Les permissions que chaque voie demande à l'extension (la V1 n'a qu'`activeTab` et ne lit pas le DOM), et ce qu'elles changent aux formulaires des stores.
- Le cas des Google Docs privés, rendus sur canevas depuis 2021 (complément §11).

## Livrable

`docs/research/task-490-paywalled-page-capture/README.md`, avec `owner_decision: pending` dans le front-matter et une section **Owner Validation** (`Decision`, `Validated at`) vide. Aucune implémentation : celle-ci est la tâche jumelle qui dépend de ce benchmark.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 docs/research/task-490-paywalled-page-capture/README.md existe avec owner_decision: pending et une section Owner Validation vide
- [ ] #2 Le README compare l'envoi du HTML au serveur extrait par trafilatura et l'extraction dans le navigateur, pour l'extension et pour le partage depuis Safari sur iPhone, avec ses sources datées
- [ ] #3 Le README fixe une taille d'envoi plafonnée et la règle d'identité du complément §10 pour chaque voie
- [ ] #4 Le README décrit les permissions demandées par chaque voie et se conclut par une recommandation
- [ ] #5 Aucun fichier hors de docs/research/ n'est modifié
<!-- AC:END -->
