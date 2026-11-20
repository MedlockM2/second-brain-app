---
id: TASK-636
title: >-
  Importer tous les contenus Facebook publics par Apify : vidéos et reels
  transcrits, posts avec texte, images et commentaires
status: Done
assignee: []
created_date: '2026-11-20 10:11'
updated_date: '2026-11-20 10:34'
labels:
  - backend
  - ingestion
dependencies: []
references:
  - media_summarizer/core/media_ingestion/adapters/classifiers.py
  - media_summarizer/core/services/media_identity.py
  - media_summarizer/infrastructure/apify_adapter.py
  - media_summarizer/workers/instagram_ingestion_worker.py
  - media_summarizer/workers/reddit_ingestion_worker.py
  - media_summarizer/infrastructure/resolvers/reddit_thread.py
  - media_summarizer/core/services/pricing_config_service.py
  - media_summarizer/core/services/budget_guard.py
  - media_summarizer/core/media_ingestion/adapters/share_targets.py
  - 'https://apify.com/neuro-scraper/facebook-video-details-scraper'
  - 'https://apify.com/lance_api/facebook-video-downloader-api'
  - 'https://apify.com/apify/facebook-posts-scraper'
  - 'https://apify.com/thedoor/facebook-comment-scraper'
priority: medium
type: feature
ordinal: 235000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Contexte (tests du 2026-11-20, depuis le poste, compte Apify des tests de l'owner)

Aujourd'hui, Facebook n'est pas reconnu. Aucun hôte Facebook ne figure dans `media_identity.py` ni dans le classifieur : un lien Facebook est traité comme une page web, lue depuis AWS, où Facebook n'affiche qu'un mur de connexion. Les liens de partage ne peuvent même pas être résolus : depuis le poste, `share/*` renvoie un HTTP 400 et `fb.watch` redirige vers `/login`. La lecture doit donc passer par des acteurs Apify, comme pour Instagram et Reddit.

**Décision de l'owner : Deepn doit accepter le maximum de formes de contenu Facebook public (reels, vidéos, posts photo, lien et texte, posts de groupes publics, liens de partage mobiles).** Ces contenus passent tous par Apify, avec ou sans `page_html` de l'extension, sur le modèle de TASK-633.

### Vidéos : 9 liens réels

| Lien | neuro-scraper | lance_api | fertech | apple_yang |
|---|---|---|---|---|
| `/reel/1056346190744779/` | ✅ | ✅ | ✅ | ✅ |
| `m.facebook.com/watch/?v=1591316522498163` | ✅ | ✅ | ✅ | ✅ |
| `share/r/1aDyu6fNFs` | ✅ | ✅ | ✅ | ✅ |
| `share/v/18urS3i6eB` | ✅ | ✅ | ✅ | ✅ |
| `share/v/19ifTVMb6V` (4 min) | ✅ | ✅ | ✅ | ✅ |
| `share/v/1BUQzP2gNr` (10 min) | ❌ | ✅ | ❌ | ❌ |
| `/tudor.alina.54/videos/…/1650622916591382/` | ❌ | ✅ | ❌ | ✅ |
| `fb.watch/wmNYZ-F2nD` | ✅ | ❌ | ✅ | ❌ |
| `/watch/?v=1650622916591382` | ❌ | ✅ | ❌ | ❌ |

Le cinquième acteur testé, `apivault_labs`, n'a renvoyé aucun média.
- `neuro-scraper` donne la légende réelle (`text`), un `audioUrl` séparé, et parfois `transcript`, la transcription de Facebook elle-même.
- `lance_api` invente son `title` : on a obtenu « Two Friends Meet and Share a Funny AI Moment in Dhaka » pour une légende « Wait for the end😆🥶 ». Sa `description` vaut `Public`.
- L'audio du lien de 4 min se télécharge depuis le poste en MP4 fragmenté (audio seul, 2,7 Mo), le même format que les reels Instagram. Deepgram nova-3 l'a transcrit : 251 s.

### Posts : 9 liens, `apify/facebook-posts-scraper`

Résultat : 8 sur 9 renvoient le texte, le nombre de commentaires et le lien attaché. Liens réussis :
- `/NASA/posts/pfbid…` et `/lemonde.fr/posts/pfbid…` ;
- `share/p/1Fzv3oGCZM` et `permalink.php?story_fbid=…&id=…` ;
- `/groups/HomeAssistant/permalink/4633151540289513/` et `/groups/HomeAssistant/posts/4633097860294881/` ;
- `m.facebook.com/story.php?story_fbid=1685704526258250&id=100044561550831` ;
- `/100044561550831/posts/1685704526258250/`.

Le 9ᵉ lien, la photo isolée `/photo/?fbid=1685704506258252&set=a.416661013162614`, renvoie un objet `Photo` sans texte, mais avec `container_story.post_id`. Pour un post vidéo, l'acteur renvoie `isVideo: true` et l'URL du reel dans `media[].url`. topapi et scrapingmonkey, moins chers, ratent `share/p`, `story.php` ou `permalink.php`.

### Commentaires : 5 posts, dont un reel à 727 commentaires annoncés

| Acteur | Récupérés | Coût |
|---|---|---|
| **`thedoor/facebook-comment-scraper`** | 697, réponses incluses (`depth`, `is_reply`) | **0,16 $** |
| `apify/facebook-comments-scraper` | 696, les mêmes comptes | 1,74 $ |
| `scraper_one/facebook-comments-scraper` | 121, sans les réponses | 0,06 $ |

### Tarifs relevés le 2026-11-20 (palier gratuit)

- neuro-scraper : 0,00149 $ par résultat.
- lance_api : 0,005 $ par résultat ; les échecs n'ont pas été facturés.
- posts-scraper : 0,005 $ par post, plus le démarrage.
- thedoor : 0,00005 $ au démarrage, puis 0,00025 $ par commentaire.

Plusieurs runs ont affiché `usageTotalUsd = 0` alors que des événements étaient facturés. Il faut donc appliquer la règle de TASK-633 : le maximum entre `usageTotalUsd` et les `chargedEventCounts` valorisés.

## Décision de l'owner

- **Vidéos** (reel, vidéo, watch, `fb.watch`, `share/r`, `share/v`) :
  - `neuro-scraper` d'abord, puis `lance_api` seulement si neuro échoue ou ne renvoie aucune URL audio ou vidéo.
  - L'audio part en transcription Deepgram en mode `push`, comme les reels Instagram.
  - Le `transcript` de Facebook ne remplace pas Deepgram : on garde une seule qualité de transcription. Il peut rester dans les métadonnées.
  - **Pas de commentaires** pour une vidéo, comme sur Instagram depuis TASK-173.
- **Posts** (page, profil, groupe public, `share/p`, `permalink.php`, `story.php`, photo) :
  - `apify/facebook-posts-scraper` lit le post.
  - Les commentaires viennent de `thedoor`, réponses comprises, avec un plafond réglable de **200 par défaut**.
  - Les images passent par l'OCR partagé, comme les posts photo Instagram (TASK-384).
- **Post vidéo** (`isVideo`) : il suit le chemin vidéo, avec le texte du post comme légende.

## Périmètre

### Reconnaissance des liens

Facebook est ajouté à `media_identity.py` (un `MediaSourceType` et un `SourcePlatform` nouveaux) et au classifieur.
- **Hôtes :** `facebook.com`, `www.`, `m.`, `web.`, `mbasic.` et `fb.watch`.
- **Vidéo :** `/reel/<id>`, `/watch/?v=`, `/<x>/videos/…`, `fb.watch/<code>`, `/share/r/` et `/share/v/`.
- **Post :** `/<x>/posts/…`, `/permalink.php`, `/story.php`, `/groups/<x>/posts|permalink/<id>`, `/share/p/`, `/photo/?fbid=`, `/photo.php?fbid=` et `/<x>/photos/…`.
- **Refusé** avec « Unsupported Facebook URL format. » : page ou profil seul, groupe seul, `/stories/`, `/events/`, `/marketplace/` et tout autre chemin.
- Les liens de partage et `fb.watch` sont transmis tels quels à l'acteur.

### Intégration

On suit le modèle des workers Reddit et Instagram : un worker Facebook, sa file, un callback Apify, et des runs de secours.
- Les identifiants d'acteur et le plafond de commentaires sont des variables déclarées dans Terraform.
- `APIFY_FACEBOOK_API_TOKEN` est une clé du secret runtime, ajoutée au secret de dev avec la même valeur que `APIFY_REDDIT_API_TOKEN`.

### Entrées des acteurs (vérifiées le 2026-11-20)

- `neuro-scraper~facebook-video-details-scraper` : `{"postUrls": [<url>], "includeTranscript": true}`. Il renvoie `audioUrl`, `sdUrl`, `hdUrl`, `text`, `durationSec`, `ownerName`, `publishedAt` et `transcript`.
- `lance_api~facebook-video-downloader-api` : `{"videoUrls": [<url>], "quality": "best", "includeAudio": true, "includeAllFormats": false, "includeMetadata": true}`, 7 URL au maximum par run. Il renvoie `status`, `audioUrl`, `videoUrl`, `duration`, `author.name`, `createTimeIso` et `errorMessage`. Son `title` et sa `description` ne servent pas.
- `apify~facebook-posts-scraper` : `{"startUrls": [{"url": <url>}], "resultsLimit": 1}`. Il renvoie `text`, `url`, `time`, `user.name`, `pageName`, `link`, `previewTitle`, `media[]`, `isVideo` et `comments`. Pour une photo isolée, on relance l'acteur sur le post de `container_story.post_id`.
- `thedoor~facebook-comment-scraper` : `{"postUrls": [<url du post résolu>], "targetComments": <plafond>, "includeReplies": true, "maxReplies": 100, "orderingMode": "ALL", "includeReactions": false}`.

### Texte complet d'un post

Le Markdown doit être lisible par `packages/core/src/chat/markdown.ts`, qui n'affiche pas les images. On généralise le rendu `render_thread` de `reddit_thread.py` au lieu de le dupliquer. Ordre du texte :
1. auteur ou page, groupe éventuel, date ;
2. texte du post ;
3. lien attaché (titre et URL) ;
4. une section par image ayant donné du texte à l'OCR ;
5. `## Comments (<récupérés> of <annoncés>)`, chaque commentaire avec son auteur et son niveau de réponse.

Un commentaire fait seulement d'une image devient `(image)`. Un titre `#` devient du gras.

### Titre et auteur du média

- `creator_name` reçoit le nom de la page, du profil ou du groupe.
- `title` reçoit le titre dérivé de la légende pour une vidéo (TASK-266), la première ligne raccourcie pour un post.
- Les métadonnées d'extraction nomment les acteurs utilisés, les commentaires récupérés sur annoncés et le coût.

### Budget

Les prix des quatre acteurs vont sous `"apify"` dans `pricing_config_service.py`. Admission sur le budget avant le premier run, puis règlement de chaque run lancé, secours et second appel de la photo compris.

### Échec

Contenu non public, connexion exigée, contenu supprimé, ou échec de tous les acteurs : le job échoue avec un code d'échec existant, sans raison détaillée pour l'utilisateur.

### Commentaire dans le code

Il rappelle pourquoi on passe par Apify : Facebook bloque nos serveurs et ses liens de partage. Il rappelle aussi pourquoi ces acteurs ont été choisis, et que `lance_api` invente les titres.

## Notes à l'owner (hors AC)

- **Changement visible :** Facebook apparaîtra dans la vitrine des sources (`share_targets.py`, dérivée de la table). Vérifier son libellé dans les traductions.
- **Après le déploiement sur dev,** partager depuis l'app Facebook un reel, une vidéo longue, un post photo, un post de groupe public et un post avec lien, puis enregistrer un post depuis l'extension. Vérifier le « Texte complet », la transcription et le coût enregistré.
- **Hors périmètre :** la vidéo roumaine de test a été détectée comme de l'italien par Deepgram. C'est la détection de langue commune à toutes les sources.
- **Surveiller** `neuro-scraper` (12 utilisateurs sur 30 jours) et `lance_api` ; en cas de casse, inverser ou remplacer via les variables d'environnement.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le classifieur reconnaît comme Facebook les hôtes `facebook.com`, `www.`, `m.`, `web.`, `mbasic.` et `fb.watch`. Il classe en vidéo ou en post chaque forme de lien listée dans la description et refuse les autres (page seule, groupe seul, stories, événements, marketplace) avec « Unsupported Facebook URL format. »
- [x] #2 Tout lien Facebook accepté, avec ou sans `page_html`, part vers Apify, sans téléchargement direct ni rendu Chromium ; les liens de partage et `fb.watch` sont transmis tels quels à l'acteur
- [x] #3 Une vidéo est lue par `neuro-scraper`, puis par `lance_api` seulement si neuro échoue ou ne renvoie aucune URL audio ou vidéo. L'audio part en transcription Deepgram en mode `push` ; la légende vient de neuro ou du post, jamais du `title` de lance_api ; aucun commentaire n'est récupéré
- [x] #4 Un post est lu par `apify/facebook-posts-scraper`. Une photo isolée est relue via `container_story.post_id`. Un post vidéo suit le chemin vidéo avec le texte du post comme légende
- [x] #5 Les commentaires d'un post sont lus par `thedoor/facebook-comment-scraper`, réponses comprises, dans la limite d'un plafond réglable par variable d'environnement (200 par défaut)
- [x] #6 Le texte complet d'un post contient l'en-tête, le texte, le lien attaché, le texte OCR des images par la chaîne partagée et `## Comments (N of total)` avec auteur et niveau. Il est produit par un rendu partagé avec Reddit, généralisé et non dupliqué, sans ligne lue comme du code ni image cassée
- [x] #7 `title`, `creator_name` et les métadonnées d'extraction (acteurs utilisés, commentaires récupérés sur annoncés, coût) suivent les règles de la description
- [x] #8 Les prix des quatre acteurs figurent sous `"apify"` dans `pricing_config_service.py`. L'import est admis sur le budget avant le premier run, puis chaque run lancé est réglé au maximum entre `usageTotalUsd` et les événements valorisés
- [x] #9 Un contenu non public, supprimé ou illisible par tous les acteurs fait échouer le job avec un code d'échec existant, sans raison détaillée pour l'utilisateur
- [x] #10 De vrais runs, lancés depuis le poste de l'agent sur les liens de la description (au moins un reel, un `share/r`, un `share/v` long, un `fb.watch`, un post de page, un `share/p`, un post de groupe et une photo isolée), sont consignés dans les notes : acteur, statut, résultat et coût
- [x] #11 Les identifiants d'acteur et le plafond de commentaires sont déclarés dans Terraform ; `APIFY_FACEBOOK_API_TOKEN` est ajouté au secret runtime de dev. `ruff`, `mypy` et `terraform validate` sont propres
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-11-20 — Run séquentiel du backlog (`/process-backlog`).

## Fait
- **Reconnaissance** : `MediaSourceType.FACEBOOK`, `SourcePlatform.FACEBOOK` (Python et `packages/core`), hôtes `facebook.com`, `www.`, `m.`, `web.`, `mbasic.` et `fb.watch`. L'URL est conservée telle quelle, sans les paramètres de suivi (`mibextid`, `rdid`, `__tn__` et `__cft__*` ajoutés à la liste). `classifiers.facebook_link_kind` distingue vidéo et post, et refuse les autres liens avec « Unsupported Facebook URL format. ». Contrôle fait sur 24 formes de liens : celles de la description, plus page seule, groupe seul, stories, événements, marketplace et `/watch/` sans `v`.
- **Routage** : `FacebookResolver` est différé, ne lit pas `page_html`, et envoie tout lien vers la file `facebook-ingestion`. Le webhook Apify accepte `facebook`.
- **Worker** `workers/facebook_ingestion_worker.py`, un run Apify à la fois :
  - vidéo : neuro-scraper, puis lance_api si neuro échoue ou ne renvoie aucune URL. L'audio part vers Deepgram en `push`, sans commentaires ;
  - post : posts-scraper. Une photo isolée est relue via `container_story`. Un post vidéo suit le chemin vidéo avec le texte du post comme légende. Sinon, les commentaires sont lus par thedoor (plafond `APIFY_FACEBOOK_MAX_COMMENTS`, 200 par défaut), puis les images passent par l'OCR partagé.
- **Mutualisation, sans duplication** :
  - `resolvers/discussion_text.py` (`render_discussion`, `clean_body`) est le rendu partagé, et `reddit_thread.render_thread` y délègue ;
  - l'OCR des images de post sort du worker Instagram vers `workers/post_images.py`, qu'Instagram utilise désormais. Ses variables d'environnement deviennent `POST_IMAGE_*` ; les anciennes `INSTAGRAM_IMAGE_*` n'étaient définies nulle part ;
  - le coût réel d'un run (`max(usageTotalUsd, événements valorisés)`) passe du worker Reddit à `apify_orchestration.measured_run_cost`.
- **Titre et auteur** : `title` vient de `select_title([first_sentence(légende ou texte)])`. `creator_name` reçoit le groupe, sinon la page ou le profil. Les métadonnées d'extraction contiennent `apify_actors`, `apify_cost_usd`, `comments_fetched`/`comments_total` et `images_parsed`. Le transcript de Facebook est conservé, tronqué à 2 000 caractères, dans `resolver_metadata.facebook_transcript`.
- **Budget** : les 4 prix sont sous `"apify"`. Le premier run est admis avec l'import, aperçu et traduction différés. Chaque run est clos sur son callback à son coût réel. Les images sont admises avec la taille du texte déjà lu.
- **Échec** : un contenu illisible donne `MEDIA_UNAVAILABLE` si le run a réussi sans contenu, `PROVIDER_UNAVAILABLE` si le run a échoué. Un post vide donne `POST_TEXT_EMPTY`.
- **Terraform** : file et DLQ (visibilité 360 s), worker de 300 s, droits IAM, variables `apify_facebook_actors` et `apify_facebook_max_comments`, tableau de bord. L'alarme passe dans le groupe `import_finish`, parce que `import_capture` et `import_read` sont déjà à la limite de 10 métriques.
- **Secret** : `APIFY_FACEBOOK_API_TOKEN` est ajouté au secret runtime de dev, avec la même valeur que `APIFY_REDDIT_API_TOKEN`. Vérifié par relecture, 42 clés.
- **Vitrine** : chip « Facebook » dans `share_targets.py`.
- **Docs** : section Facebook dans `docs/INGESTION_WORKERS_PROVIDERS.md`, `.env.example`, `scripts/replay_dlq.sh`.

## Vérifié
`ruff check .` et `mypy media_summarizer` sont propres (226 fichiers). `terraform fmt` et `validate` sont propres. `tsc` passe sur `packages/core`. Le parseur a été rejoué sur les sorties réelles ci-dessous ; le rendu d'un post avec ses commentaires est conforme.

## Vrais runs (2026-11-20, depuis le poste, compte Apify des tests)
| Lien | Acteur | Statut | Résultat | usageTotalUsd / événements |
|---|---|---|---|---|
| `/reel/1056346190744779/` | neuro | SUCCEEDED | audio, 23 s, légende NASA | 0.0014 / result 1 |
| `share/r/1aDyu6fNFs` | neuro | SUCCEEDED | audio, 35 s, « Wait for the end😆🥶 » | 0.0020 / result 1 |
| `share/v/1BUQzP2gNr` (10 min) | neuro | SUCCEEDED, 0 item | aucun média : bascule | 0.0024 / result 0 |
| `share/v/1BUQzP2gNr` (10 min) | lance_api | SUCCEEDED | audio, 606 s | 0 / facebook-video-result 1 (0.005 au barème) |
| `fb.watch/wmNYZ-F2nD` | neuro | SUCCEEDED | audio, 35 s, transcript Facebook id_ID | 0.0018 / result 1 |
| `m.facebook.com/watch?v=1591316522498163` (forme canonique) | neuro | SUCCEEDED | audio | 0.0014 / result 1 |
| `/100044561550831/posts/1685704526258250/` (page) | posts | SUCCEEDED | texte, 1 photo, 171 commentaires annoncés | 0.001 / post 1 + start |
| `share/p/1Fzv3oGCZM` | posts | SUCCEEDED | texte, 10 commentaires annoncés | 0.006 / post 1 + start |
| `/groups/HomeAssistant/permalink/4633151540289513/` | posts | SUCCEEDED | post vidéo (`isVideo`), groupe « Home Assistant » | 0.001 / post 1 + start |
| vidéo du post de groupe | neuro | SUCCEEDED | URL sd, 54 s | 0.0014 / result 1 |
| `/photo/?fbid=1685704506258252&…` et forme canonique `/photo?fbid=` | posts | SUCCEEDED | `Photo` sans texte, `container_story.url` = post NASA | 0 et 0.001 / post 1 + start |
| post NASA (relecture de la photo) | posts | SUCCEEDED | texte, 1 photo, 171 annoncés | 0.001 / post 1 + start |
| post NASA | thedoor | SUCCEEDED | 127 items (116 commentaires + 11 réponses), 3 commentaires image → `(image)` | 0.0268 / dataset-item 107 + start |
| post `share/p` | thedoor | SUCCEEDED | 10 items | 0.0015 / dataset-item 6 + start |
Total des runs : 0,049 USD (usageTotalUsd). Les écarts entre usageTotalUsd et les événements (0 pour lance_api, 0.001 pour un post au lieu de 0.006) confirment l'intérêt de la règle du maximum.

## Notes pour l'owner (hors AC)
- Après le push : Terraform Dev crée la file et le worker, puis Deploy Lambda déploie l'image. Partager ensuite un reel, une vidéo longue, un post photo, un post de groupe public et un post avec lien, puis enregistrer un post depuis l'extension.
- **Changement visible** : le chip « Facebook » apparaît dans la vitrine (`/api/pricing`). Le libellé est la marque, sans traduction. Aucun logo dédié n'a été ajouté au carrousel d'accueil web ou mobile.
- **Choix déduits, à valider** : un post vidéo ne récupère pas de commentaires, car il suit le chemin vidéo. Un post est stocké en `.txt` Markdown, comme Reddit. Le `media_type` d'un post reste `article`, même avec des photos.
<!-- SECTION:NOTES:END -->
