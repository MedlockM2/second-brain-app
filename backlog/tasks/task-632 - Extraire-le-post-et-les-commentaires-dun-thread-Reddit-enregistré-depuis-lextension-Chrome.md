---
id: TASK-632
title: >-
  Extraire le post et les commentaires d'un thread Reddit enregistré depuis
  l'extension Chrome
status: To Do
assignee: []
created_date: '2026-11-19 10:42'
labels:
  - backend
  - ingestion
  - bug
dependencies: []
references:
  - media_summarizer/infrastructure/resolvers/trafilatura_article_resolver.py
  - media_summarizer/api/endpoints/media.py
priority: medium
type: bug
ordinal: 231000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Constat (2026-11-19, dev)

Thread enregistré depuis l'extension Chrome : https://www.reddit.com/r/codex/comments/1xuka2x/almost_2_months_since_opus_55_released_and_still (job `7b0e9112-f274-4794-9e0d-29c4e4e7a209`, compte de review Play).

L'API a lu la page envoyée par le navigateur (`page_html`, log « Article resolver read the page sent by the browser ») : Reddit n'a rien bloqué. Mais le « Texte complet » ne contient que 167 mots en 4 paragraphes : le commentaire épinglé d'un bot de modération (« Below is a GPT-generated summary of the conversation… »). Trafilatura a retenu le plus long bloc de texte de la page, pas le post.

Manquent :
- le titre du post (`extraction_metadata.title` est nul ; le titre affiché garde le suffixe « : r/codex ») ;
- le corps du post, qui est le contenu principal ;
- l'auteur, le subreddit et la date du post ;
- les commentaires chargés dans la page (269 au total sur ce thread) ;
- l'indication que le résumé épinglé est un commentaire de bot et non le post.

Le résumé (« Key points ») et le chat de la page s'appuient sur ce texte incomplet.

## Périmètre

Uniquement le chemin où l'extension envoie la page déjà affichée (`TrafilaturaArticleResolver.read_html`, `media_summarizer/infrastructure/resolvers/trafilatura_article_resolver.py`). Ce chemin n'appelle pas l'API Reddit.

Les pages Reddit (`reddit.com`, `www.reddit.com`, `old.reddit.com`) reçoivent une extraction dédiée, appliquée avant trafilatura :
1. le titre du post, sans suffixe de subreddit ;
2. une ligne de contexte avec le subreddit, l'auteur et la date ;
3. le corps du post (texte, liens) ;
4. puis les commentaires présents dans la page, dans l'ordre affiché. Chaque commentaire porte son auteur et son niveau de réponse. Un commentaire épinglé de modération ou de bot est marqué comme tel.

On ne récupère que les commentaires déjà chargés dans la page : pas de défilement ni d'appel réseau en plus. Avant d'écrire l'analyse, vérifier ce que l'extension retire du HTML qu'elle envoie (scripts, styles…). Le nouveau Reddit range le post et les commentaires dans des éléments personnalisés (`shreddit-post`, `shreddit-comment`) ; il faut confirmer que leur contenu survit à ce nettoyage.

Hors périmètre : le partage depuis le mobile, sans HTML du navigateur. Le serveur doit alors télécharger Reddit lui-même, et Reddit bloque ces requêtes. Ce cas dépend d'un choix de fournisseur (API Reddit, service tiers) et fera l'objet d'une étude comparative séparée.

## Note à l'owner (hors AC)

Après le déploiement sur dev, réenregistrer le thread ci-dessus depuis l'extension et vérifier dans le « Texte complet » : titre, post, contexte, commentaires, et le résumé épinglé marqué comme commentaire de bot.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Une page Reddit reçue via `page_html` passe par une extraction dédiée, appelée depuis `read_html` avant trafilatura ; les autres sites gardent l'extraction actuelle
- [ ] #2 Le texte produit commence par le titre du post (sans le suffixe « : r/<subreddit> »), puis une ligne de contexte (subreddit, auteur, date), puis le corps du post
- [ ] #3 Les commentaires présents dans le HTML suivent le post, dans l'ordre affiché, chacun avec son auteur et son niveau de réponse ; un commentaire épinglé de modération ou de bot y est marqué comme tel
- [ ] #4 `ArticleContent.title` vaut le titre du post et `creator_name` le subreddit ou l'auteur, sans suffixe de subreddit
- [ ] #5 La description de la tâche indique, avec ce qui a été lu dans le code de l'extension, si le contenu de `shreddit-post` et `shreddit-comment` survit au nettoyage du HTML envoyé
- [ ] #6 `ruff` et `mypy` sont propres sur les fichiers modifiés
<!-- AC:END -->
