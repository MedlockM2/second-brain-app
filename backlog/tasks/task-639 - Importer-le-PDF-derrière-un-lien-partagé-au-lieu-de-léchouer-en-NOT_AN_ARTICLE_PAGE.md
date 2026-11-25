---
id: TASK-639
title: >-
  Importer le PDF derrière un lien partagé au lieu de l'échouer en
  NOT_AN_ARTICLE_PAGE
status: To Do
assignee: []
created_date: '2026-11-25 13:27'
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
- [ ] #1 Une URL qui répond `application/pdf` est routée vers le pipeline documents au lieu de lever `NOT_AN_ARTICLE_PAGE` ; le chemin de code existe et est câblé de bout en bout
- [ ] #2 Le téléchargement du PDF est borné par la limite d'envoi des documents (`_max_upload_bytes_for`) et un dépassement produit une erreur explicite, pas un échec générique
- [ ] #3 Le média issu d'un lien PDF est identifié par son contenu selon la règle de task-393
- [ ] #4 Le titre est tiré du `Content-Disposition` ou du chemin de l'URL ; le repli « Article — <date> » n'est plus utilisé pour ce cas
- [ ] #5 Le parsing passe par `budget_guard` et est compté dans l'allocation documents, pas articles
- [ ] #6 Les cas IN-29 et MD-25 de `docs/testing/manual-e2e-validation-matrix.md` sont mis à jour : l'exemple d'échec `NOT_AN_ARTICLE_PAGE` n'est plus un lien vers un PDF
- [ ] #7 `ruff` et `mypy` sont propres sur `media_summarizer/`
- [ ] #8 Aucun test n'est écrit (règle d'AGENTS.md)
<!-- AC:END -->
