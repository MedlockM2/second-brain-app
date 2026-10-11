---
owner_decision: pending   # pending | ok | abandoned | redo | more
---

# Benchmark : enregistrer une page payante ou derrière une connexion, depuis l'extension et depuis le partage Safari sur iPhone

## Owner Validation

**Decision**: _(à remplir par l'owner après relecture)_
**Validated at**: _(date ISO à remplir par l'owner)_

---

## Recommendation

**Le navigateur envoie le HTML de la page, nettoyé et plafonné à 2 Mo, dans un champ optionnel `page_html` de `POST /api/media/ingest-url`. Le serveur en tire le texte avec le même trafilatura que pour une page qu'il lit lui-même, et le range sous l'identité d'article qui existe déjà : l'adresse et le hash du texte, jamais l'adresse seule.**

Trois raisons, par ordre d'importance.

1. **Un seul extracteur, et presque rien à écrire côté serveur.** `TrafilaturaArticleResolver` télécharge aujourd'hui une page, puis appelle `_extract_clean_text(html)` et `_extract_metadata(...)`. Avec `page_html`, on saute le téléchargement, et le reste est inchangé : texte, titre, éditeur, couverture, empreinte, identité. Extraire dans le navigateur (Readability) donnerait **deux** extracteurs, avec des titres et des textes différents pour une même page, et un serveur obligé de croire un texte qu'il ne peut pas recalculer.
2. **La taille n'est pas un problème, mesures à l'appui.** Sur 11 pages réelles (§2), le HTML nettoyé pèse **73 à 298 Ko pour un article** (652 Ko au pire pour une page d'accueil), et le nettoyage **ne change pas le texte extrait** (identique au caractère près sur 10 pages, 4 caractères d'écart sur la 11ᵉ). Un plafond de 2 Mo, le même que celui du téléchargement serveur (`ARTICLE_EXTRACT_MAX_HTML_BYTES`), laisse une marge de 3× au-dessus de la plus lourde, et reste trois fois sous les 6 Mo d'une invocation synchrone de Lambda. Pas besoin de passer par S3.
3. **L'identité d'article tient déjà la règle du complément §10.** `generate_article_media_key(canonical_url, content_fingerprint)` hache l'adresse **et** le texte. Une autre personne qui enregistre le même lien obtient le texte que le serveur lit (l'accroche d'un article payant) : son empreinte diffère, donc sa clé aussi, et elle ne reçoit jamais le texte complet. Seul un compte qui envoie **exactement** le même texte retombe sur le même média, c'est-à-dire un compte qui l'avait déjà. Le seul piège est le chemin `_unreadable_page`, qui range une page illisible sous l'**adresse seule**. Un HTML client dont rien n'est extractible doit donc être traité comme absent, et ne jamais emprunter ce chemin (§3).

**Sur iPhone**, la même voie est disponible sans code natif à écrire : `expo-share-intent` 6.1.1, déjà dans l'app, exécute dans Safari un script de prétraitement dès qu'on active la règle `NSExtensionActivationSupportsWebPageWithMaxCount`. Ce script peut renvoyer le HTML nettoyé par son option `preprocessorInjectJS` (§5). Le prix : une version native (l'Info.plist change), et Safari seulement. Chrome et Firefox sur iOS continuent d'envoyer l'adresse seule.

**Ce que ça change à la V1 décidée** : l'extension **lit** désormais la page, ce que le complément du 2026-10-11 excluait (« aucune lecture du contenu de la page », §11). Il faut ajouter la permission `scripting`, et revoir la déclaration de collecte des stores et la politique de confidentialité (§4). C'est le vrai sujet de la décision.

---

## 0. Ce que le dépôt fait aujourd'hui (lu le 2026-10-11)

| Fait | Où |
|---|---|
| Une page web passe par `ArticleUrlResolver.resolve` : téléchargement inline (`build_api_article_content_fetcher`, plafond de 30 s), puis trafilatura | `core/media_ingestion/adapters/resolvers.py:242`, `infrastructure/resolvers/trafilatura_article_resolver.py` |
| L'identité d'une page lue est `generate_article_media_key(url, sha256(texte))`, non propre au compte : deux comptes qui lisent le même texte partagent le média (task-392) | `core/services/media_identity.py:459` |
| Une page **illisible** est quand même enregistrée, sous la clé de l'**adresse seule** : « the first save that *does* read the page settles the real identity ». Un texte extrait vide en fait partie : `_extract_clean_text` lève `EMPTY_TEXT`, que `resolve` attrape | `resolvers.py`, `_unreadable_page` ; `trafilatura_article_resolver.py:232` |
| Le HTML téléchargé par le serveur est plafonné à 2 000 000 octets | `trafilatura_article_resolver.py:54` |
| Une sélection partagée est une note, dont la clé est le hash du texte **sans compte**. Sa page d'origine vit sur la ligne `user_media` du compte (`origin_url`, task-486) | `core/media_ingestion/use_cases.py`, `_share_locator` |
| L'extension de partage iOS est générée par `expo-share-intent` 6.1.1, avec les règles `WebURL`, `Text`, `Image` et `File`, **sans** `WebPage` | `mobile/app.config.ts:456` |
| Le plugin traite une pièce jointe *property list* (le résultat du script de Safari) **avant** une URL. Activer `WebPage` fait donc passer chaque partage Safari par le script | `mobile/node_modules/expo-share-intent/plugin/build/ios/ShareExtensionViewController.swift:68` |
| Le script de prétraitement généré renvoie `baseURI` et un `meta` JSON (titre et balises `<meta>`). `preprocessorInjectJS` y insère du code avant l'envoi | `…/writeIosShareExtensionFiles.js:147` |

Un fait mesuré pendant ce benchmark le confirme : le 2026-10-11, deux articles du Monde répondaient **HTTP 402** à un `curl` avec un agent Safari. Le serveur ne peut pas les lire, alors qu'un navigateur abonné, si.

## 1. Les trois voies comparées

| | **A. HTML nettoyé au serveur** (recommandée) | **B. Extraction dans le navigateur** | **C. HTML déposé sur S3** |
|---|---|---|---|
| Ce que le client envoie | le HTML du DOM, sans `script`, `style`, `noscript`, `svg`, `iframe`, `template`, `link`, ni attributs `style` | le texte et le titre produits par `@mozilla/readability` (comme le prévoyait le README rejeté du 2026-10-05, §6.4) | le HTML, par `upload-url` puis une clé |
| Extracteur | **trafilatura, le même** que pour un lien | Readability côté client, trafilatura côté serveur pour les liens : deux extracteurs | trafilatura |
| Titre, éditeur, couverture | ceux de `_extract_metadata`, comme pour un lien | à reconstruire côté client, ou perdus | ceux de `_extract_metadata` |
| Le serveur peut-il recalculer ? | oui, à partir du HTML reçu | non : il reçoit un texte, à croire tel quel | oui |
| Taille envoyée (articles mesurés) | 73 à 298 Ko | 5 à 67 Ko de texte | 73 à 298 Ko |
| Allers-retours | 1 | 1 | 3 (signer, déposer, soumettre) |
| Sur iPhone | le script de prétraitement renvoie le HTML | il faudrait embarquer Readability (~90 Ko) dans `preprocessorInjectJS` | le HTML transite par l'app, qui dépose sur S3 |
| Nouveau côté serveur | un champ, une branche dans le résolveur d'article | un champ, et un chemin d'article sans extraction | un `target`, un champ, une branche, le cycle de vie du dépôt |

**C est écartée** : elle ne sert que si la taille dépasse ce qu'une requête porte, et les mesures du §2 montrent qu'elle ne le dépasse pas. **B est écartée** à cause des deux extracteurs, et parce que le serveur ne pourrait plus appliquer ses propres règles (titre, distrust rules de `derive_stored_title`, éditeur). Son seul avantage, des envois 5 à 10 fois plus légers, ne compte pas à ces volumes.

## 2. Mesures : poids du HTML et texte extrait

Méthode : `curl` avec un agent Safari macOS, le 2026-10-11, puis nettoyage par lxml (suppression des balises citées en A et des attributs `style`), puis `trafilatura.extract` avec les options du résolveur (`include_comments`, `include_tables` et `include_links` à `False`), sur le HTML brut puis sur le HTML nettoyé. Script : `measure.py`, dans le scratchpad de la session, non commité.

| Page | Brut | Nettoyé | Nettoyé, gzip | Texte (brut) | Texte (nettoyé) |
|---|---|---|---|---|---|
| Guardian, article (Gaza, surf) | 352 Ko | 126 Ko | 20 Ko | 5 211 | 5 214 |
| Guardian, page newsletter | 259 Ko | 87 Ko | 13 Ko | 300 | 300 |
| BBC, article 1 | 309 Ko | 91 Ko | 14 Ko | 10 476 | 10 476 |
| BBC, article 2 | 328 Ko | 103 Ko | 15 Ko | 10 302 | 10 302 |
| Wikipédia, *Zettelkasten* | 376 Ko | 298 Ko | 55 Ko | 34 060 | 34 060 |
| Wikipédia, *Personal knowledge management* | 200 Ko | 168 Ko | 29 Ko | 15 639 | 15 639 |
| Paul Graham, *How to Do Great Work* | 77 Ko | 73 Ko | 26 Ko | 66 840 | 66 840 |
| Le Monde, accueil | 908 Ko | 652 Ko | 72 Ko | 4 392 | 4 392 |
| Guardian, accueil | 1 409 Ko | 591 Ko | 71 Ko | 1 013 | 1 013 |
| BBC News, accueil | 369 Ko | 142 Ko | 16 Ko | 6 729 | 6 725 |
| Substack, accueil | 323 Ko | 111 Ko | 9 Ko | 742 | 742 |

Le texte est compté en caractères. Medium (53 Ko, 134 caractères) est une coquille JavaScript. Le Monde (402) et le *New York Times* (403) ont refusé le téléchargement.

Ce que ces chiffres permettent de dire :

- **Le nettoyage est sans perte pour l'extraction** : le texte est identique sur 10 pages sur 11, et l'écart est de 4 caractères sur la 11ᵉ. On peut donc nettoyer dans le navigateur sans dégrader ce que le serveur produira.
- **Plafond : 2 000 000 octets de HTML nettoyé en UTF-8**, contrôlés par le client avant l'envoi et par le serveur à la réception. C'est la valeur de `ARTICLE_EXTRACT_MAX_HTML_BYTES` : une page lue par le navigateur n'a pas droit à plus qu'une page lue par le serveur. La plus lourde mesurée en fait le tiers.
- **Au-delà du plafond**, le client n'envoie pas de HTML tronqué (un document coupé se lit mal), il envoie l'**adresse seule** : la requête retombe sur le comportement d'aujourd'hui.
- **Limite haute du transport** : une invocation synchrone de Lambda accepte 6 Mo par requête (quotas Lambda, lus le 2026-10-11). Le dépôt documente un plafond effectif de **4 718 592 octets** pour un corps qui passe par API Gateway, parce que le corps est encodé en base64 (`docs/CANONICAL_MEDIA_API_CONTRACT.md`, « File upload entrypoints »). 2 Mo de HTML échappé en JSON restent largement en dessous.

**Non mesuré** : ces poids viennent du HTML servi, pas du DOM après exécution du JavaScript, que verra un navigateur. Une application monopage hydratée peut être plus lourde que son HTML initial. Le plafond le couvre ; seule l'implémentation pourra le mesurer.

## 3. L'identité, voie par voie

La règle du complément §10 : un texte envoyé par le client « ne prend jamais l'identité de l'adresse seule ». Elle autorise une identité propre au compte, ou au minimum l'adresse et le texte ensemble.

| Voie | Identité recommandée | Pourquoi |
|---|---|---|
| Extension et Safari iPhone, HTML extractible | **`generate_article_media_key(url, sha256(texte))`**, comme une page lue par le serveur | Satisfait la règle : l'empreinte vient du texte complet, que seul un lecteur qui l'a déjà peut reproduire. Garde la mise en commun entre abonnés d'un même titre (artefacts générés une fois), et un seul modèle d'article dans tout le dépôt |
| HTML dont rien n'est extractible (coquille JS, page vide) | **aucune** : traité comme absent, la requête suit le chemin d'aujourd'hui (le serveur télécharge) | Sinon, l'échec d'extraction mènerait à `_unreadable_page`, donc à la clé de l'adresse seule, sous laquelle le contenu fourni par le client n'a jamais le droit d'atterrir |
| HTML au-delà du plafond | aucune, même traitement | idem |
| Sélection (déjà en V1) | inchangée : note, clé du texte seul, adresse sur la ligne du compte (task-486) | — |

**L'alternative écartée : l'identité propre au compte** (`generate_account_scoped_media_key`). Elle est plus stricte, et utile pour les pages vraiment privées (un document interne, un webmail). Mais elle duplique chaque article payant par abonné, sans gain de confidentialité par rapport à l'empreinte du texte complet. Elle introduirait aussi un troisième modèle d'identité pour un même type de média. À reconsidérer seulement si l'owner veut que les pages enregistrées depuis le navigateur ne soient **jamais** mises en commun, par principe. C'est une décision de produit, pas une contrainte technique.

**Quel texte gagne** quand le client envoie un HTML extractible : celui du client, **sans téléchargement serveur**. Faire les deux et garder le plus long doublerait la latence de chaque enregistrement pour un gain que rien ne mesure. Conséquence assumée : une page publique enregistrée par l'extension peut avoir une empreinte légèrement différente de la même page lue par le serveur (bandeaux, personnalisation), donc ne pas être mise en commun avec elle. À l'échelle de la bêta, le coût est quelques générations d'artefacts en plus.

## 4. Permissions et stores

| | Aujourd'hui (V1 décidée) | Avec la voie A |
|---|---|---|
| Chrome et Edge | `activeTab` seule | `activeTab` **+ `scripting`**. `activeTab` permet `scripting.executeScript()` sur l'onglet cliqué « if the "scripting" permission is also declared », et n'affiche « no warning message during installation » (developer.chrome.com, page *activeTab*). Toujours **aucune permission d'hôte** ni `<all_urls>` |
| Firefox | idem | même chose. La **déclaration de collecte de données** du manifeste (X-04, task-488) doit déclarer le contenu des sites. Libellé exact de la catégorie **non vérifié** |
| Formulaire de confidentialité d'Edge | objet unique, permissions | justifier `scripting` et la collecte du contenu de la page envoyée |
| Chrome Web Store | — | les règles de données utilisateur citées au README rejeté du 2026-10-05 (§8.3) s'appliquent au contenu de page, qui est une donnée utilisateur. Il faut le décrire dans la fiche et dans l'interface |
| Politique de confidentialité (`www.<domaine>/privacy`, task-472) | — | une section : la page n'est lue qu'au clic, et son contenu est envoyé pour en tirer le texte |

**Avertissement à l'installation de `scripting`** : la documentation lue confirme l'absence d'avertissement pour `activeTab` seulement. Le comportement de `scripting` seul, sans permission d'hôte, n'a pas été vérifié ici ; c'est à vérifier dans la tâche d'implémentation.

**Le geste ne change pas** : un clic sur l'action enregistre la page. Il n'y a pas de deuxième bouton « enregistrer tel que je le vois ». Le HTML part avec l'adresse. Le serveur l'utilise s'il en tire du texte, et sinon il télécharge la page comme aujourd'hui.

## 5. Le partage depuis Safari sur iPhone

Mécanisme Apple (Extensibility Programming Guide, « Accessing a Webpage », lu le 2026-10-11) : « you can give users access to web content by asking Safari to run a JavaScript file and return the results to the extension ». Il faut une valeur non nulle pour `NSExtensionActivationSupportsWebPageWithMaxCount` et un fichier déclaré par `NSExtensionJavaScriptPreprocessingFile`. Le résultat arrive dans `NSExtensionJavaScriptPreprocessingResultsKey`. Le guide ne décrit le mécanisme que pour Safari.

Ce que ça demande dans `mobile/`, sans code natif écrit à la main :

1. Ajouter `NSExtensionActivationSupportsWebPageWithMaxCount: 1` aux `iosActivationRules` d'`expo-share-intent` dans `mobile/app.config.ts`. Le plugin déclare alors lui-même `NSExtensionJavaScriptPreprocessingFile`.
2. Donner à `preprocessorInjectJS` le même nettoyage que l'extension (cloner le document, retirer les balises du §1, sérialiser, ne rien mettre au-delà du plafond), dans une clé de `metas`, par exemple `metas['deepn:page_html']`. Le plugin sérialise `metas` en JSON dans `meta`.
3. Dans `ShareIntentContext`, lire cette clé du `meta` d'un partage de type `weburl`, et l'envoyer en `page_html` avec l'URL.

Ce que ça coûte :

- **Une version native** : l'Info.plist de l'extension change, donc aucune mise à jour OTA ne suffit. Le build doit être revalidé sur les flux de partage existants (task-438 a déjà réglé un gel au retour dans l'app source).
- **Safari seulement.** Chrome et Firefox sur iOS partagent une URL, et passent par le chemin d'aujourd'hui.
- **Le transit** : le HTML passe de l'extension à l'app par les `UserDefaults` du groupe d'apps, comme tout partage géré par le plugin. Le comportement de `UserDefaults` avec une valeur de 2 Mo, et le plafond mémoire d'une extension de partage, **n'ont pas été vérifiés** ici. Les articles mesurés font moins de 300 Ko ; si un problème apparaît, un plafond plus bas côté iOS seulement est un réglage, pas un changement de voie.
- **Le routage** : la tâche qui modifie `mobile/` doit porter le label `mobile`. task-492, qui ne porte que `extension`, ne peut pas la faire (sa description le prévoit) : il faudra une tâche `mobile` jumelle.

## 6. Google Docs privés

Le complément §11 le rappelle : depuis 2021, Docs dessine sur un canevas, pas en HTML. Le HTML de la page ne contient donc pas le texte du document. **La voie A n'enregistre pas un Google Docs privé** : le HTML ne donne rien d'extractible, la requête retombe sur le téléchargement serveur, qui ne lit que ce qu'un lien public lit. C'est le comportement d'aujourd'hui, et il ne régresse pas.

Une piste, **non vérifiée et hors de cette recommandation** : demander à l'export texte de Docs, depuis le navigateur et avec la session de l'utilisateur, le contenu du document. Il faudrait une permission d'hôte limitée à `docs.google.com`, demandée à l'usage (permission optionnelle), ce qui change l'avertissement et la fiche. À instruire séparément si l'owner en veut.

## 7. Contrat proposé, à préciser par l'implémentation

`POST /api/media/ingest-url`, champ optionnel :

| Champ | Type | Règle |
|---|---|---|
| `page_html` | string \| null | HTML nettoyé du document lu par le navigateur, en UTF-8, au plus 2 000 000 octets. Au-delà : `413`, ou `400` si l'implémentation préfère, et le client ne doit jamais l'envoyer. Ignoré quand l'URL n'est pas classée comme page web (`MediaFamily.ARTICLE` par le résolveur générique). Une vidéo YouTube partagée depuis Safari garde donc son chemin |

Comportement :

- **HTML extractible** : pas de téléchargement. Texte, titre, éditeur et couverture viennent de trafilatura sur ce HTML. L'identité est `generate_article_media_key`. Les métadonnées d'extraction disent `extraction_mode: "client_html"`, pour qu'on sache d'où vient un texte.
- **HTML non extractible** : comme si le champ était absent.
- Le HTML lui-même **n'est pas conservé**, seul le texte extrait l'est, comme pour une page téléchargée.
- `docs/CANONICAL_MEDIA_API_CONTRACT.md` décrit le champ, le plafond, le cas ignoré, et la règle d'identité.

## 8. Ce que l'implémentation (task-492) aura à faire, et ce qu'elle ne peut pas faire

- **Serveur** : le champ, la branche « HTML fourni » du résolveur d'article, le contrat. Ce sont des fichiers que task-492 peut modifier.
- **Extension** : la permission `scripting`, la fonction de nettoyage exécutée au clic par `scripting.executeScript`, le plafond, l'envoi, et la mise à jour des documents de publication (Chrome, Edge, AMO).
- **Politique de confidentialité** : la section du §4 dans les sources de task-472.
- **iPhone** : hors de task-492 (label `mobile` obligatoire). Une tâche `mobile` jumelle, qui dépend de la branche serveur.

## 9. Points déduits, à valider par l'owner

1. **L'extension lit la page au clic.** C'est le cœur de la recommandation, et cela revient sur « aucune lecture du contenu de la page » du complément §11 pour la V1. La sélection et l'adresse seule restent possibles si l'owner refuse.
2. **Le texte du client gagne, sans téléchargement serveur** (§3), au prix d'une mise en commun moindre pour les pages publiques.
3. **Identité « adresse + texte » plutôt que « propre au compte »** (§3).
4. **Au-delà du plafond, l'adresse seule**, sans HTML tronqué (§2).
5. **Le partage Safari dans une tâche `mobile` séparée** (§5, §8).

## 10. Non vérifié

- L'avertissement d'installation de la permission `scripting` sans permission d'hôte (§4).
- La catégorie exacte de la déclaration de collecte de Firefox pour le contenu de page (§4).
- Le comportement des `UserDefaults` du groupe d'apps et de la mémoire de l'extension de partage avec 2 Mo (§5).
- Le poids du DOM après hydratation, par rapport au HTML servi (§2).
- L'export texte de Google Docs avec la session de l'utilisateur (§6).

## 11. Sources (consultées le 2026-10-11)

- Chrome for Developers, *The activeTab permission* — https://developer.chrome.com/docs/extensions/develop/concepts/activeTab
- Apple, *App Extension Programming Guide*, « Accessing a Webpage » — https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/ExtensionScenarios.html
- AWS, *Lambda quotas*, « Invocation payload » — https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html
- `expo-share-intent` 6.1.1 : `README.md` (options `iosActivationRules`, `preprocessorInjectJS`, `shareIntent.meta`), `plugin/build/ios/writeIosShareExtensionFiles.js`, `plugin/build/ios/ShareExtensionViewController.swift`, dans `mobile/node_modules/expo-share-intent/`
- Dépôt : `media_summarizer/core/media_ingestion/adapters/resolvers.py`, `media_summarizer/infrastructure/resolvers/trafilatura_article_resolver.py`, `media_summarizer/core/services/media_identity.py`, `media_summarizer/core/media_ingestion/use_cases.py`, `mobile/app.config.ts`, `docs/CANONICAL_MEDIA_API_CONTRACT.md`
- `docs/research/task-424-website-and-browser-extension/complement-response-2026-10-11.md` (§10, §11) et `README.owner-rejected-2026-10-05.md` (§6, §8.3)
- Mesures du §2 : pages téléchargées le 2026-10-11 depuis theguardian.com, bbc.com, en.wikipedia.org, paulgraham.com, lemonde.fr, substack.com, medium.com, nytimes.com
