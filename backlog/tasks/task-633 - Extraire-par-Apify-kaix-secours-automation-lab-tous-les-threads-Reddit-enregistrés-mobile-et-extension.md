---
id: TASK-633
title: >-
  Extraire par Apify (kaix, secours automation-lab) tous les threads Reddit
  enregistrés, mobile et extension
status: Done
assignee: []
created_date: '2026-11-19 11:07'
updated_date: '2026-11-19 13:45'
labels:
  - backend
  - ingestion
dependencies:
  - TASK-632
references:
  - media_summarizer/core/media_ingestion/adapters/classifiers.py
  - media_summarizer/infrastructure/apify_adapter.py
  - media_summarizer/workers/tiktok_ingestion_worker.py
  - media_summarizer/core/services/pricing_config_service.py
  - media_summarizer/core/services/budget_guard.py
  - 'https://apify.com/kaix/reddit-scraper'
  - 'https://apify.com/automation-lab/reddit-scraper'
priority: medium
type: feature
ordinal: 232000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Contexte (tests du 2026-11-19, dev)

Un lien Reddit enregistré sans la page du navigateur (partage depuis le mobile, flux sans extension) ne peut pas être lu par nos serveurs. Avec l'extension, la page arrive bien (TASK-632), mais elle ne contient que les commentaires déjà affichés : **5 sur 269** sur le thread de test, les autres attendant dans un `<template id="deferred-comments">` que l'extension n'envoie pas. Sans la page :
- le téléchargement direct reçoit une page de blocage ;
- le Chromium du worker `web-render` reçoit une erreur HTTP 4xx de Reddit (job de test `72887f4a-6a87-4078-b071-743418d4ea2f`, `SOURCE_ACCESS_BLOCKED` / `render_http_error`). Reddit refuse les adresses AWS, quel que soit le client.

Pistes testées sur le thread https://www.reddit.com/r/codex/comments/1xuka2x/almost_2_months_since_opus_55_released_and_still (269 commentaires) :

| Méthode | Coût réel | Récupéré |
|---|---|---|
| OpenAI Responses + `web_search` | 0,023 à 0,056 $ | une phrase du post, 0 commentaire (refuse de recopier) |
| **Apify `kaix/reddit-scraper`** | **0,0069 $**, 5 s | post et 269/269 commentaires, texte exact |
| Apify `automation-lab/reddit-scraper` | 0,103 $, 42 s | post et 262/269 commentaires, texte exact |
| Apify `themineworks/reddit-scraper` | 0,02 $ | post et 65 commentaires |
| Apify `andok`, `xmolodtsov`, `wildorigins` | 0 à 0,011 $ | post seul, ou rien |

Tarifs à la date du test (palier gratuit d'Apify) :
- `kaix/reddit-scraper` : 0,00005 $ au démarrage, puis 0,00002 $ par élément (le post compte pour un, chaque commentaire aussi) ;
- `automation-lab/reddit-scraper` : 0,003 $ au démarrage, puis 0,00115 $ pour le post et 0,00075 $ par commentaire.

## Décision de l'owner

Pour **tout lien Reddit, qu'il arrive avec ou sans `page_html`**, Apify est la **méthode systématique**. On ne tente ni le téléchargement direct ni le rendu Chromium avant : ils échouent à coup sûr. Pour un thread enregistré depuis l'extension, on paie environ 0,007 $ pour avoir tout le fil au lieu des quelques commentaires affichés.
- **Actor principal : `kaix/reddit-scraper`.** Il est le moins cher et le plus complet, mais n'a que 34 utilisateurs et peut donc disparaître ou casser.
- **Actor de secours : `automation-lab/reddit-scraper`,** 12 500 utilisateurs. Il n'est appelé que si l'appel à kaix échoue ou ne renvoie pas le post.

**Ordre complet pour un lien Reddit :** kaix, puis automation-lab, puis, seulement si les deux actors échouent et que `page_html` est présent, l'analyse locale de la page de TASK-632 (`read_reddit_thread`), qui donne au moins le post et les commentaires affichés. Sans `page_html` et si les deux actors échouent, le job échoue. Dans le chemin de l'extension, l'appel à `read_reddit_thread` depuis `TrafilaturaArticleResolver.read_html` passe donc après Apify pour une URL Reddit. OpenAI n'est pas utilisé.

## Périmètre

- **Reconnaissance des liens Reddit.** Le classifieur d'URL (`media_summarizer/core/media_ingestion/adapters/classifiers.py`) identifie un thread Reddit : `reddit.com`, `www.reddit.com`, `old.reddit.com`, `/r/<sub>/comments/<id>/…`. Il traite aussi les liens de partage de l'app Reddit (`/r/<sub>/s/<code>`) et `redd.it`. Ces liens de partage redirigent vers le thread, et nos serveurs ne peuvent pas suivre la redirection parce que Reddit les bloque : on les confie tels quels à l'actor. Il faut vérifier lequel des deux actors les accepte. `kaix` documente `redd.it` ; `automation-lab` documente les liens de partage `/s/`. Si l'un d'eux ne les accepte pas, on passe directement à l'autre.
- **Intégration Apify,** sur le modèle des plateformes déjà passées par Apify (TikTok, YouTube, Instagram : `media_summarizer/infrastructure/apify_adapter.py`, `tiktok_ingestion_worker.py`). Un nouveau worker et sa file d'attente si c'est la forme du projet. Le token et les identifiants des deux actors passent par des variables d'environnement déclarées dans Terraform, comme `APIFY_TIKTOK_*`.
- **Entrées des actors** (vérifiées le 2026-11-19) :
  - `kaix~reddit-scraper` : `{"mode": "post", "postUrls": [<url>], "includeComments": true, "maxCommentsPerPost": 0, "maxItems": 0}`. La valeur `0` veut dire le fil complet. Le résultat contient un élément `type: post`, puis un élément `type: comment` par commentaire, avec `body`, `author`, `score`, `depth`, `parentId`, `stickied` et `distinguished`.
  - `automation-lab~reddit-scraper` : `{"urls": [<url>], "includeComments": true, "maxCommentsPerPost": 1000, "commentDepth": 10, "maxPostsPerSource": 1}`. Le résultat contient un élément `type: post` avec `selfText`, puis des éléments `type: comment` avec `body`, `author`, `score`, `depth` et `parentId`.
- **Plafond de commentaires.** Aucun pour kaix : 1 000 commentaires coûtent environ 0,02 $. Pour automation-lab, un plafond réglable par variable d'environnement, 1 000 par défaut, soit environ 0,75 $ au pire.
- **Mise en forme du texte complet : exactement celle de TASK-632** (livrée, `media_summarizer/infrastructure/resolvers/reddit_thread.py`). Le Markdown suit cet ordre : `## <titre>`, la ligne `r/<sub> · u/<auteur> · <date>`, le corps du post, puis `## Comments (<récupérés> of <total>)` et chaque commentaire dans l'ordre du fil, sous un en-tête `**u/<auteur>** · reply, level N · pinned · moderator · bot`. La partie rendu de ce module est extraite pour être alimentée aussi bien par l'analyse du HTML (extension) que par les éléments Apify (`depth`, `stickied`, `distinguished`). On évite ainsi deux formats. Les commentaires supprimés ou vides sont omis.
- **Nettoyage du texte avant le rendu.** Les données des actors ont été passées dans `_thread_markdown` le 2026-11-19 sur le thread de test. Constats :
  - **kaix** renvoie le Markdown brut de Reddit, que le lecteur (`packages/core/src/chat/markdown.ts`) affiche correctement. Exception : les images Reddit, écrites `![img](<identifiant de média>)` (5 sur ce thread). L'identifiant n'est pas une adresse et le lecteur ne gère pas les images, ce qui afficherait « !img » comme un lien cassé. On les remplace par une mention du type `(image)`.
  - **automation-lab** reconstruit le texte depuis le HTML et garde une indentation de début de ligne : 114 lignes commencent par 6 espaces et seraient lues comme des blocs de code. On retire cette indentation ligne par ligne. Il ne fournit ni `stickied` ni `distinguished` : en secours, un commentaire épinglé ou de modération n'est pas marqué, sauf par la détection existante sur le nom (`bot`, AutoModerator). C'est accepté.
  - **La date** arrive en horodatage Unix (`createdUtc`) chez kaix et en ISO (`createdAt`) chez automation-lab ; on la convertit au format attendu par le rendu.
  - Un titre Markdown (`#`) dans le corps d'un commentaire entrerait en conflit avec la structure du texte : on le convertit en gras. Il n'y en avait aucun sur ce thread.
- **Titre et auteur du média :** `title` vaut le titre du post, sans suffixe de subreddit ; `creator_name` vaut le subreddit (`r/<sub>`), comme dans TASK-632. Les métadonnées d'extraction nomment l'actor réellement utilisé, le nombre de commentaires récupérés sur le nombre affiché et le coût.
- **Budget.** L'import est admis sur le budget du compte avant l'appel, selon le modèle des autres plateformes Apify. Le prix de chaque actor est ajouté sous `"apify"` dans `pricing_config_service.py`, sous la forme démarrage plus prix par élément. Le réglage se fait au coût réel du run (`usageTotalUsd`). Si kaix échoue puis qu'automation-lab réussit, les deux runs sont comptés.
- **Échec.** Si les deux actors échouent, le job échoue avec un code d'échec existant. Aucune raison détaillée n'est montrée à l'utilisateur.
- **Un commentaire dans le code** rappelle pourquoi Apify est utilisé : Reddit bloque les adresses AWS, OpenAI refuse de recopier, et kaix est retenu pour son coût. Il donne aussi l'actor de secours.

## Notes à l'owner (hors AC)

- Après le déploiement sur dev, partager le thread ci-dessus depuis l'app mobile, l'enregistrer depuis l'extension Chrome, puis partager un lien `/s/` copié depuis l'app Reddit. Dans les trois cas, le « Texte complet » doit contenir tout le fil (environ 263 commentaires). Vérifier le « Texte complet » (post et commentaires indentés, résumé du bot marqué), l'actor utilisé et le coût enregistré sur le budget.
- Surveiller la santé de `kaix/reddit-scraper` (prix, disponibilité) : si l'actor passe en secours trop souvent, inverser les deux variables d'environnement.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le classifieur reconnaît comme Reddit les threads `reddit.com`, `www.reddit.com` et `old.reddit.com`, les liens de partage `/r/<sub>/s/<code>` et `redd.it`, et les envoie vers ce nouveau traitement
- [x] #2 Tout lien Reddit, avec ou sans `page_html`, part d'abord vers Apify, sans téléchargement direct ni rendu Chromium. L'analyse locale de la page de TASK-632 ne sert que si les deux actors échouent et que `page_html` est présent ; sinon le job échoue
- [x] #3 L'actor `kaix~reddit-scraper` est appelé en premier, avec le fil complet ; `automation-lab~reddit-scraper` n'est appelé que si kaix échoue ou ne renvoie pas le post. Le token et les deux identifiants d'actor sont des variables d'environnement déclarées dans Terraform
- [x] #4 Le texte complet est produit par le rendu de `reddit_thread.py` (TASK-632), extrait pour être partagé avec l'analyse du HTML et non dupliqué : même Markdown (titre, contexte, post, `## Comments (N of total)`, en-têtes de commentaire avec niveau et marques pinned, moderator ou bot), commentaires supprimés ou vides omis
- [x] #5 Avant le rendu, le texte de chaque commentaire est nettoyé : les images Reddit `![…](<id>)` deviennent une mention `(image)`, l'indentation de début de ligne est retirée (automation-lab), les titres `#` deviennent du gras et les dates sont converties. Le texte produit pour le thread de test, avec chacun des deux actors, ne contient ni ligne lue comme du code ni image cassée
- [x] #6 Les métadonnées d'extraction nomment l'actor utilisé, le nombre de commentaires récupérés sur le nombre affiché et le coût du run ; `title` et `creator_name` suivent les règles de TASK-632
- [x] #7 Les prix des deux actors figurent sous `"apify"` dans `pricing_config_service.py` ; l'import est admis sur le budget avant l'appel, puis réglé au coût réel de chaque run lancé, secours compris
- [x] #8 Un vrai run de chaque actor, lancé depuis le poste de l'agent sur le thread de la description et sur un lien de partage `/s/` ou `redd.it`, est consigné dans les notes de la tâche : statut, nombre de commentaires et coût. On sait ainsi quel actor accepte quel format de lien
- [x] #9 `ruff`, `mypy` et `terraform validate` sont propres
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-11-19 — Fait dans la session principale (`/process-backlog`).

**Chemin.** Le classifieur reconnaît `reddit.com`, `www.reddit.com`, `old.reddit.com` et `redd.it` (`MediaSourceType.REDDIT`, `SourcePlatform.REDDIT`). Formats acceptés : `/r/<sub>/comments/<id>/…`, `/comments/<id>`, `/r/<sub>/s/<code>`, `redd.it/<id>`. Un subreddit ou une page d'utilisateur est refusé (« Unsupported Reddit URL format. »). L'URL canonique garde la casse et le chemin tels quels : un lien `/s/` ne peut pas être résolu depuis AWS.
- `RedditResolver` (`reddit.default`) n'appelle aucun fournisseur. Si l'extension a envoyé la page, il la lit avec `read_reddit_thread` : la ligne de bibliothèque reçoit son titre tout de suite, et l'orchestrateur dépose ce texte sur S3 (`<job>.reddit-page.md`) comme dernier recours.
- Le worker `reddit_ingestion_worker.py`, avec sa file `reddit-ingestion-queue`, démarre kaix. Au callback, il lit tout le dataset, page par page. Si kaix échoue ou ne renvoie pas le post, il démarre automation-lab (`replace_active_run`). Si automation-lab échoue aussi, il enregistre la page de l'extension quand elle existe ; sinon le job échoue en `PROVIDER_UNAVAILABLE`.
- Le texte de la page n'est plus lu par `TrafilaturaArticleResolver.read_html` : une URL Reddit n'y arrive plus.

**Texte.** Le rendu `render_thread` est partagé entre la page et Apify. `reddit_apify.clean_body` nettoie chaque corps : images `![…](<id>)` → `(image)`, titres `#` → gras, séparateurs `---` retirés, indentation retirée pour automation-lab. Les commentaires sont remis dans l'ordre du fil d'après `parentId` ; ceux dont le parent manque restent à leur place. Les commentaires supprimés (`[deleted]`, `[removed]`) sont omis.

**Budget.** Les tarifs « démarrage + par élément » sont ajoutés sous `provider_tariffs.apify`, avec `per_post` pour automation-lab ; le calcul est fait par `Tariffs.apify_run_usd`. L'import est admis avant le run kaix, réservé pour 1 001 éléments ; automation-lab est réservé pour `APIFY_REDDIT_FALLBACK_MAX_COMMENTS` + 1. Chaque run est clos par `budget_guard.close_apify_collection` au plus grand de deux montants : `usageTotalUsd`, et les `chargedEventCounts` valorisés au barème. Le run est réglé s'il a livré le fil, libéré en dépense opérateur sinon. Les deux runs sont comptés quand le secours tourne. Sur le pool Apify partagé, une lecture de fil compte pour une unité.

**Runs réels (AC #8)**, lancés le 2026-11-19 depuis le poste de l'agent avec le compte Apify des tests de l'owner :

| Actor | Lien | Statut | Éléments | Coût réel |
|---|---|---|---|---|
| kaix | thread www | SUCCEEDED | 1 post + 269 commentaires | 0,0069 $ |
| kaix | `https://redd.it/1xuka2x` | SUCCEEDED | 1 post + 269 commentaires | 0,0069 $ |
| automation-lab | thread www | SUCCEEDED | 1 post + 262 commentaires | 0,2007 $ |
| automation-lab | `https://redd.it/1xuka2x` | SUCCEEDED, mais un seul élément `target-status: no-valid-reddit-targets` | 0 | 0 $ |

Aucun lien `/s/` public n'a pu être trouvé : ce format n'a été testé avec aucun des deux actors. `usageTotalUsd` monte encore quelques secondes après la fin du run (0,0011 $ puis 0,0069 $ pour kaix) ; d'où le maximum avec les événements, qui sont définitifs.

Texte produit sur le thread de test : kaix 263/269 commentaires, automation-lab 262/269. Dans les deux cas, 0 ligne lue comme du code et 0 image cassée.

**Configuration.** Les identifiants d'actor et le plafond du secours sont déclarés dans Terraform, sur le worker `reddit_ingestion`. Le token `APIFY_REDDIT_API_TOKEN` est une clé du secret runtime : le dépôt n'écrit jamais de secret dans Terraform (`secrets.tf`). Il a été ajouté le 2026-11-19 au secret de dev, avec la valeur du token du compte Apify utilisé pour les tests Reddit de l'owner (le même que `APIFY_YOUTUBE_API_TOKEN`). Il faudra le copier dans le secret de prod avant la production.

**Hors périmètre, à décider par l'owner.** Reddit n'est pas proposé dans la vitrine des sources de l'app (`_WITHHELD_PLATFORMS`, `share_targets.py`) : ajouter une puce est un changement visible.

`ruff` et `mypy` sont propres sur les 20 fichiers Python touchés. `terraform validate` passe sur dev et prod. `tsc` passe sur core, web et mobile.

**À vérifier par l'owner après push** (voir les notes de la description) :
- Terraform Dev doit avoir appliqué `REDDIT_INGESTION_QUEUE` avant que l'image de l'API serve : la variable est lue au démarrage.
- Rejouer les trois parcours : partage mobile, extension, lien `/s/`.
<!-- SECTION:NOTES:END -->
