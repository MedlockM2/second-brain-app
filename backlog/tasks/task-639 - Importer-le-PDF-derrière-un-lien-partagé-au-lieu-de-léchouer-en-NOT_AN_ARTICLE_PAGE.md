---
id: TASK-639
title: >-
  Importer le PDF derrière un lien partagé au lieu de l'échouer en
  NOT_AN_ARTICLE_PAGE
status: Done
assignee: []
created_date: '2026-11-25 13:27'
updated_date: '2026-11-25 16:06'
labels:
  - ingestion
  - backend
  - bug
dependencies: []
ordinal: 238000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Un lien partagé qui redirige vers un PDF est enregistré en échec `NOT_AN_ARTICLE_PAGE`, sous le titre de repli « Article — <date> ». Remonté par un beta testeur (build 27, iOS) sur un billet électronique ouvert dans le lecteur PDF de Safari.

## Le défaut

Le partage arrive comme un lien : dans l'extension de partage iOS (`writeShare`), la règle « a link wins » écarte le fichier joint au profit de l'URL. Le backend lit donc l'URL comme un article. `TrafilaturaArticleResolver._fetch_html` suit la redirection, reçoit un `Content-Type` non HTML et lève `ArticleFetchErrorCode.NOT_HTML`, qui devient `NOT_AN_ARTICLE_PAGE` (`media_summarizer/core/ports/article_content.py`). Le pipeline documents (LlamaParse puis Unstructured) n'est aujourd'hui branché que sur `POST /api/media/upload`, jamais sur un lien.

Ce n'est pas une régression : le comportement est volontaire et documenté (matrice E2E, IN-29 et MD-25, qui prennent « un lien direct vers un fichier » comme exemple d'échec attendu). La tâche change l'intention.

## Constat vérifié sur -dev (2026-11-25)

Les deux jobs en échec portent `error_code: NOT_AN_ARTICLE_PAGE` avec `error_metadata` : `fetch_error_code: not_html`, `content_type: application/pdf`, `reason: article_unsupported_content_type`, `retryable: false`, `step: article_extraction`.

Point décisif pour la portée : l'URL finale est un lien de téléchargement direct portant un **jeton signé dans la query string**, et le serveur a bien reçu `application/pdf` en réponse. Le serveur sait donc récupérer les octets sans session ni cookie. La correction côté serveur suffit ; reprendre le fichier dans l'extension de partage iOS (option B du triage) a été écarté par l'owner le 2026-11-25, faute de cas qui le justifie et parce qu'il coûterait un build TestFlight pour le seul partage natif.

## Portée

Router le PDF côté serveur, pour tous les clients (iOS, Android, web, lien reçu par e-mail) :

- repérer `application/pdf` dans le lecteur d'articles et le router vers le pipeline documents au lieu d'échouer ;
- borner le téléchargement par la limite d'envoi des documents (`_max_upload_bytes_for`) ;
- identifier le média par le contenu, selon la règle posée par task-393 ;
- tirer le titre du `Content-Disposition` ou du chemin de l'URL (`title_derivation.py` traite déjà `.pdf`) ;
- faire passer le parsing par le contrôle budgétaire commun (`budget_guard`, task-549) et le compter dans l'allocation **documents**, pas articles ;
- mettre à jour IN-29 et MD-25 de `docs/testing/manual-e2e-validation-matrix.md` : prendre un autre exemple d'échec `NOT_AN_ARTICLE_PAGE` (une image, par exemple), puisqu'un lien vers un PDF doit désormais réussir.

Hors portée : les `Content-Type` autres que PDF, et l'extension de partage iOS.

## Web

Commune : l'app web enregistre ses liens par la même API, donc elle en bénéficie sans changement dans `web/`. Web: n/a (aucun code web à modifier).

## Notes pour l'owner, pas des critères

- Après déploiement sur `-dev`, repartager un lien qui redirige vers un PDF et vérifier que le média sort en document lisible.
- Un lien PDF exigeant une vraie session (cookie, et non un jeton dans l'URL) restera en échec : le serveur recevrait une page de connexion. Rouvrir une tâche si le cas se présente.
- Pas d'OTA ni de build : correctif backend, déployé au push sur `main`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Une URL qui répond `application/pdf` est routée vers le pipeline documents au lieu de lever `NOT_AN_ARTICLE_PAGE` ; le chemin de code existe et est câblé de bout en bout
- [x] #2 Le téléchargement du PDF est borné par la limite d'envoi des documents (`_max_upload_bytes_for`) et un dépassement produit une erreur explicite, pas un échec générique
- [x] #3 Le média issu d'un lien PDF est identifié par son contenu selon la règle de task-393
- [x] #4 Le titre est tiré du `Content-Disposition` ou du chemin de l'URL ; le repli « Article — <date> » n'est plus utilisé pour ce cas
- [x] #5 Le parsing passe par `budget_guard` et est compté dans l'allocation documents, pas articles
- [x] #6 Les cas IN-29 et MD-25 de `docs/testing/manual-e2e-validation-matrix.md` sont mis à jour : l'exemple d'échec `NOT_AN_ARTICLE_PAGE` n'est plus un lien vers un PDF
- [x] #7 `ruff` et `mypy` sont propres sur `media_summarizer/`
- [x] #8 Aucun test n'est écrit (règle d'AGENTS.md)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-11-25 — Run séquentiel (/process-backlog).

Fait :
- `ArticleResolver.resolve` : une réponse `NOT_HTML` dont le `Content-Type` est un PDF lève `LinkedDocumentFound` (nouvelle erreur de `core/media_ingestion/errors.py`) au lieu de produire un échec `NOT_AN_ARTICLE_PAGE` (AC #1).
- `POST /api/media/ingest-url` attrape `LinkedDocumentFound` et appelle `_ingest_linked_document` : téléchargement via `infrastructure/resolvers/linked_document_download.py`, borné par `_max_upload_bytes_for(DOCUMENT)` ; l'en-tête `Content-Length` puis le total courant refusent en `413 DOCUMENT_LINK_TOO_LARGE` ; un lien qui ne livre pas de PDF donne `422 DOCUMENT_LINK_UNREADABLE` (AC #2).
- Le corps de `upload_document` après la validation est extrait dans `_submit_staged_document`, partagé avec le lien : même identité, même ligne durable, même job, même file SQS (AC #1, #3, #5). Le worker de parsing existant admet les pages via `budget_guard` et compte dans l'allocation documents, comme pour un envoi.
- Identité par le contenu (task-393) : empreinte `md5-<hex>` calculée pendant le téléchargement, identique à l'ETag S3 d'un envoi mono-part ; le même PDF envoyé ou partagé est donc le même média (AC #3).
- Titre : `Content-Disposition`, sinon dernier segment du chemin de l'URL finale, sinon `document.pdf`, toujours suffixé `.pdf` ; `derive_stored_title` en tire le titre, plus de repli « Article — <date> » (AC #4).
- IN-29 et MD-25 prennent déjà un lien vers une image (`…/foo.jpg`), aucune ligne de la matrice ne cite un PDF : rien à changer (AC #6). Contrat d'API documenté dans `docs/CANONICAL_MEDIA_API_CONTRACT.md`.
- `ruff check media_summarizer` et `mypy media_summarizer` propres (AC #7). Aucun test écrit (AC #8).

Hors de portée, à vérifier par l'owner après push sur main (déploiement automatique) : repartager sur -dev un lien qui redirige vers un PDF à jeton signé et vérifier que le média sort en document lisible. Un PDF qui exige un cookie reste en échec.
<!-- SECTION:NOTES:END -->
