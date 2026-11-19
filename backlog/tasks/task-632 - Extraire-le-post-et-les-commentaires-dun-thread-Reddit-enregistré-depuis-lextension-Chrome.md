---
id: TASK-632
title: >-
  Extraire le post et les commentaires d'un thread Reddit enregistré depuis
  l'extension Chrome
status: Done
assignee: []
created_date: '2026-11-19 10:42'
updated_date: '2026-11-19 11:07'
labels:
  - backend
  - ingestion
  - bug
dependencies: []
references:
  - media_summarizer/infrastructure/resolvers/trafilatura_article_resolver.py
  - media_summarizer/api/endpoints/media.py
modified_files:
  - media_summarizer/infrastructure/resolvers/reddit_thread.py
  - media_summarizer/infrastructure/resolvers/trafilatura_article_resolver.py
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

## Ce qui survit au nettoyage de l'extension (constaté le 2026-11-19)

`extension/lib/page.ts`, `cleanedDocument` : l'extension clone `document.documentElement`, retire `script, style, noscript, svg, iframe, template, link` et les attributs `style`, puis envoie `outerHTML`. Les shadow roots ne sont jamais sérialisés.

- **`shreddit-post` et `shreddit-comment` survivent.** Ce sont des éléments du DOM léger. Leurs métadonnées sont des attributs (`post-title`, `subreddit-prefixed-name`, `author`, `created-timestamp`, `comment-count` ; `author`, `depth`, `thingid`, `is-mod-distinguished`). Leur texte est un contenu slotté du DOM léger (`#<id>-post-rtjson-content`, `#<id>-comment-rtjson-content`). Le shadow root ne porte que la mise en page. L'épinglage se lit sur `shreddit-comment-badges[stickied]`. Le log du job ci-dessus le confirme : trafilatura avait retenu le commentaire épinglé, qui était donc dans le HTML reçu.
- **Une partie des commentaires n'arrive pas.** Dans le HTML servi pour ce thread, les 5 premiers commentaires arrivent par un `<template for="…">` que la page insère à la place de son `suspense-placeholder` : ils sont dans le DOM au moment du clic. Les 20 suivants attendent dans `<template id="deferred-comments">` jusqu'à ce que la page les affiche. Comme l'extension supprime les `template`, ceux que la page n'a pas encore affichés ne sont pas envoyés. Les 269 commentaires du thread ne sont de toute façon jamais tous dans la page.

## Note à l'owner (hors AC)

Après le déploiement sur dev, réenregistrer le thread ci-dessus depuis l'extension et vérifier dans le « Texte complet » : titre, post, contexte, commentaires, et le résumé épinglé marqué comme commentaire de bot.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Une page Reddit reçue via `page_html` passe par une extraction dédiée, appelée depuis `read_html` avant trafilatura ; les autres sites gardent l'extraction actuelle
- [x] #2 Le texte produit commence par le titre du post (sans le suffixe « : r/<subreddit> »), puis une ligne de contexte (subreddit, auteur, date), puis le corps du post
- [x] #3 Les commentaires présents dans le HTML suivent le post, dans l'ordre affiché, chacun avec son auteur et son niveau de réponse ; un commentaire épinglé de modération ou de bot y est marqué comme tel
- [x] #4 `ArticleContent.title` vaut le titre du post et `creator_name` le subreddit ou l'auteur, sans suffixe de subreddit
- [x] #5 La description de la tâche indique, avec ce qui a été lu dans le code de l'extension, si le contenu de `shreddit-post` et `shreddit-comment` survit au nettoyage du HTML envoyé
- [x] #6 `ruff` et `mypy` sont propres sur les fichiers modifiés
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-11-19 — Fait dans la session principale (`/process-backlog`).

**Ce qui a été fait.** Nouveau module `media_summarizer/infrastructure/resolvers/reddit_thread.py`. `TrafilaturaArticleResolver.read_html` l'appelle avant trafilatura. Il ne s'applique qu'aux URL de thread (`reddit.com`, `www.reddit.com`, `old.reddit.com`, chemin contenant `/comments/`) ; toute autre page, y compris un listing de subreddit, garde l'extraction actuelle. Le texte produit est du Markdown, dans cet ordre :
- `## <titre>` ;
- `r/<sub> · u/<auteur> · <date>` ;
- le corps du post (paragraphes, listes, citations, code, liens `[texte](url)`) ;
- `## Comments (<chargés> of <total>)`, puis chaque commentaire dans l'ordre du document, sous un en-tête `**u/<auteur>** · reply, level N · pinned · moderator · bot`.

`ArticleContent.title` vaut le titre du post, sans le suffixe « : r/<sub> ». `creator_name` vaut le subreddit (`r/codex`). `extractor` vaut `reddit_thread`. La structure du nouveau Reddit (`shreddit-*`) et celle de old.reddit (`div.thing.link` / `div.thing.comment`, `data-author`, classes `stickied` et `moderator`) sont lues toutes les deux.

**Vérifications.**
- `ruff` et `mypy` propres sur les deux fichiers.
- Contrôle sur le HTML réel du thread de la tâche, récupéré le 2026-11-19, avec le remplacement Suspense de la page puis le nettoyage de l'extension reproduits dans un script jetable hors dépôt. Résultat : titre « Almost 2 months since Opus 5.5 released and still OpenAI has no answer? », créateur `r/codex`, contexte `r/codex · u/<auteur> · 2026-11-12`, corps du post, puis `## Comments (5 of 269)`. Le résumé de dextersummary y porte la mention `pinned · moderator` et la réponse de niveau 1 est marquée `reply, level 1`.

**Limites.**
- Le code old.reddit est écrit d'après le balisage connu d'old.reddit : depuis ce poste, `old.reddit.com` sert un mur de connexion, je n'ai donc pas pu capturer une vraie page.
- Les commentaires encore dans `<template id="deferred-comments">` au moment du clic ne sont pas envoyés par l'extension (voir la description). Les récupérer demanderait de changer `extension/lib/page.ts`, ce qui sort du périmètre.
- Le texte d'un thread change d'empreinte, donc d'identité média, à chaque nouveau commentaire chargé : c'est le comportement normal du chemin article.

**À vérifier par l'owner après push** (note de la description) : réenregistrer le thread depuis l'extension sur dev et contrôler le « Texte complet ».
<!-- SECTION:NOTES:END -->
