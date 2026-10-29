---
owner_decision: ok
research_date: 2026-10-28
audit_base: 4900df42
---

# Débit collectif, équité et protection de la facture

Recherche documentaire et dimensionnement, **sans modification applicative, appel fournisseur payant, test de charge, déploiement ni action de compte**. Audit après TASK-548/549/550/551/552/556/562. Les nombres des scénarios sont des hypothèses, pas des mesures de bêta. Les montants sont hors taxes, abonnements et infrastructure, sauf indication contraire.

## Owner Validation

**Decision**: *(validée par l’owner le 2026-10-29)*

Contexte de l’owner : prêt à financer toute hausse de dépense causée par davantage d’utilisateurs, pas une hausse du coût par utilisateur ; l’enveloppe de 5 EUR par testeur borne déjà ce que chaque compte consomme ; une centaine de DAU est un horizon d’environ un an. OpenAI Launch est tenu pour acquis (dépôt à faire par l’owner, TASK-558).

1. **Décision 459 maintenue pour l’échelle actuelle** : concurrence des workers + Retry-After/gigue restent le contrôle de capacité LLM. La proposition d’admission distribuée (§4, §6) est acceptée comme conception cible mais **reportée** : TASK-564 puis TASK-565 reprennent quand l’un des déclencheurs se produit : environ 300 DAU, ou 429 fournisseur persistants hors incident (alarme du §8.2). Elles reprendront alors avec Launch (§8.1) et les valeurs d’équité du §8.1.
2. **TASK-566 acceptée seule, sans dépendre de TASK-564** : ses garde-fous se raccordent à `reserve` et à la transition `held → sending` déjà présentes dans `beta_budget_db`, sans permis ni epoch de capacité. Quand 564 reprendra, elle réutilisera ce même point d’accroche (§6.1, étapes 3 et 4).
3. **Plafond opérateur `C_m` = 500 EUR par mois, plafond de sécurité relevable à la main** (non un budget cible) : alertes à 50 % et 80 %, à relever quand les comptes augmentent. Réserve de pertes issue de la formule du §8.1, soit **5 EUR par jour et 50 EUR par mois**, engagements en vol inclus. Le plus gros engagement unitaire doit rester possible (à vérifier par 566).
4. **Alerte ajoutée au périmètre de 566** : dépense opérateur divisée par le nombre de comptes actifs sur le mois, avec seuil de dérive à fixer par 566. C’est le signal « chaque utilisateur coûte de plus en plus cher », que le plafond mensuel seul ne distingue pas d’une croissance saine.
5. **Pas de seuil d’arrêt à pourcentage du crédit gratuit** (`stop_pct`, `provider_pools`). Un fournisseur dont le crédit est épuisé répond par une erreur ; le système doit la reconnaître comme « crédit épuisé », distincte d’une panne ou d’un rate limit, et ne plus lui envoyer de nouvelle dépense jusqu’au renouvellement (TASK-566). Un import qui échoue à ce moment-là est accepté. Constat de code du 2026-10-29 : OpenAI (`utils/llm_failure.py`, quota = permanent, sans réessai) et Apify (`apify_payment_required`) sont déjà traités ; LlamaParse retombe sur Unstructured quelle que soit l’erreur ; Deepgram ne distingue pas encore un 402 (`DeepgramRefusedError` générique).
6. Les textes d’attente, la durée de dix minutes des holds non envoyés et les paramètres d’équité du §8.1 sont validés comme valeurs de départ pour la reprise de 564/565, pas pour un déploiement immédiat.

**Validated at**: 2026-10-29

Points à accepter ou modifier ensemble : mécanisme de capacité (§4), politique d’équité et d’attente (§5), protection opérateur (§7), paramètres de démarrage (§8). Les trois implémentations doivent lire ce champ et les sections qu’il valide. Aucun changement de compte ou achat n’a été exécuté.

## Recommendation

**Remplacer, pour cette nouvelle échelle, la suffisance supposée de « concurrence Lambda + 429 réactif » de TASK-459 par une admission distribuée avant l’envoi**, tout en conservant les plafonds des workers et les réponses fournisseurs comme garde-fous. Cette proposition rouvre explicitement la décision du 11 octobre : elle ne prétend pas que M2 avait été accepté. Le plafond de sortie commun de 32 000 et l’absence de plafond artificiel pour la traduction restent inchangés.

Proposition d’ensemble :

1. **Un service logique de capacité, DynamoDB à la demande et files SQS existantes**, sans Redis ou serveur permanent supplémentaire. Limites distinctes par véritable compte/projet/organisation, endpoint, modèle et région ; requêtes, tokens et jobs sont des dimensions différentes. Une fenêtre conservatrice partagée gère les débits ; des permis persistants suivent la concurrence, y compris les jobs distants.
2. **Un ordonnancement persistant par compte**, à déficit pondéré par le travail estimé, et non un FIFO global de toutes les intentions. Deux classes : interaction et fond, avec service minimum du fond, capacité inutilisée empruntable, et vieillissement. Le chat ne reste pas en file indéfiniment : attente avant premier texte de dix secondes au plus, puis refus temporaire explicite, sans débit. Une requête déjà acceptée n’est jamais recréée pour patienter.
3. **Le registre financier de `beta_budget` reste l’unique source des tentatives, engagements et coûts.** Ajouter dans ses transactions les agrégats de contrôle opérateur, pas un registre calculant d’autres dépenses. Ils comprennent livraisons, échecs remboursés, appels inconnus valorisés à la borne et, séparément, recherches payantes hors enveloppe. Les valeurs de réutilisation sans appel ne deviennent pas de la dépense fournisseur.
4. **Capacité prête → réservation financière → droit d’envoi conditionnel → appel → règlement**. Une attente n’est ni un échec fournisseur ni une tentative facturée. Pour les imports déjà admis, libérer explicitement les parts non envoyées lors d’une attente prolongée puis les réadmettre à la reprise ; ne jamais toucher aux coûts déjà engagés. Les droits courts expirés ne peuvent plus autoriser un envoi.
5. **Coupe-circuit partagé et plafond d’engagement avant chaque nouvelle dépense**, avec essai de reprise unique et borné. Aucun mécanisme ne prétend annuler rétroactivement un appel déjà parti ou garantir la facture bancaire au centime.
6. **TASK-564** possède le socle de capacité et les intégrations ; **TASK-565** la discipline d’équité et les parcours d’attente ; **TASK-566** les engagements opérateur, suspensions et reprise. Leurs interfaces sont décrites §6. TASK-552 reste propriétaire du rapport général. TASK-557/558 restent propriétaires des plans, crédits, recharges et anciens `provider_pools`.

La raison du choix n’est pas une moyenne journalière élevée. Dans notre scénario à 1 000 DAU, une rafale de dix minutes représente **3,366 millions d’unités de capacité LLM par minute**, sous l’estimation prudente, pour une cible de régulation de 8 millions au palier Launch retenu (1,6 million en Build, gardé en comparaison). Un premier import de bibliothèque peut prendre plus d’une heure même avec un débit LLM adéquat (§3). Les traitements sans résultat peuvent aussi épuiser la trésorerie alors que les enveloppes des comptes sont remboursées.

## 1. Ce qui est réellement câblé

Références de décision : [TASK-459, Owner Validation](../task-459-llm-token-rate-control/README.md#owner-validation), [règles de budget TASK-547](../task-547-beta-budget-control/README.md), [TASK-557 encore pending](../task-557-provider-free-tier-then-paid/README.md), [contrôle livré](../../BETA_BUDGET_CONTROL.md), [rapport TASK-552](../../BETA_BUDGET_REPORTING.md) et [contrat canonique](../../CANONICAL_MEDIA_API_CONTRACT.md).

Références locales, relatives au dépôt :

| Surface | Preuve dans le code audité | Protection et lacune |
|---|---|---|
| OpenAI, chat | `core/services/llm_client.py`, `workers/chat_worker.py`, `llm_config.py` | File séparée, maximum 10 workers ; 3 appels au plus avant texte, minimum Retry-After + gigue, attente individuelle plafonnée à 10 s. Aucun compteur collectif TPM/RPM. |
| OpenAI, artefacts et aperçu | `workers/artifact_generator/worker.py`, `artifact_service.py` | 10 workers ; un appel par génération ; lease de l’entrée et révision. TASK-562 donne un nouvel id à chaque demande utilisateur et une opération `artifact:<id>:<revision>` à chaque relance explicite. Seul `review_blurb` conserve sa mutualisation. Un échec terminal de l’entrée fait décliner la livraison SQS suivante : « trois livraisons » ne signifie pas trois générations utiles. |
| OpenAI, traduction complète | `core/services/transcript_translation.py`, `workers/transcript_translation_worker.py` | 10 workers ; trois essais internes par défaut ; modèle commun Luna depuis TASK-556. Sortie réservée à 1,5 × entrée dans l’admission d’import, mais aucun `max_completion_tokens` envoyé : le maximum modèle de 128 000 demeure. S’ajoute au trafic chat/artefacts. |
| Deepgram | `workers/transcription/deepgram_worker.py`, `audio_quota_gate.py` | 10 workers, timeout HTTP 300 s, Lambda 600 s ; trois essais par livraison et possibles replis pull/push, avec tentatives budgétaires propres. Durée limite par élément 240 min. Aucun sémaphore de compte partagé hors cette file. |
| LlamaParse / Unstructured | `infrastructure/resolvers/{llamaparse,unstructured}_resolver.py`, `document_parsing_service.py`, workers document/Instagram | Deux familles de workers de concurrence 10 peuvent atteindre le même service. LlamaParse upload puis jusqu’à 60 polls espacés de 2 s ; repli Unstructured distinct et réservé. Un carrousel émet plusieurs jobs, même s’il reste un import utilisateur. Pas de limite collective sur les jobs distants. |
| Apify | `infrastructure/apify_adapter.py`, `core/media_ingestion/apify_orchestration.py` | Départ asynchrone, webhook terminal et reprise ; un run peut continuer après la fin de la Lambda. Le timeout est envoyé, `maxTotalChargeUsd` ne l’est pas dans ce départ. Le pool gratuit ancien refuse encore à 90 %. Une concurrence de Lambdas n’est donc pas une concurrence de runs. |
| API X | `workers/x_ingestion_worker.py` | Lecture d’un post via `/2/tweets/{id}` et expansions. Réservation/valorisation du post ; plafond de 10 workers n’impose pas une fenêtre par app. |
| PodcastIndex, résolution | `utils/podcast_index.py`, `podcastindex_limiter.py`, `workers/podcast_platform_resolvers.py` | Cadence configurée à 1 RPS, Redis facultatif. Le composant partagé tombe **en local** si Redis est absent ou échoue. Ce n’est plus une limite globale entre Lambdas. La résolution d’un lien reste utile même après le nettoyage TASK-561. |
| TikTok direct | `utils/tiktok_limiter.py`, `distributed_rate_limiter.py`, `workers/tiktok_ingestion_worker.py` | Pacing de 3 s et compteur 100/h configurés, Redis facultatif et même repli local. Ce sont des politiques de l’application, pas des limites officielles TikTok vérifiées. L’extraction peut émettre plusieurs requêtes HTTP/CDN par vidéo. |
| Algolia | `api/endpoints/search.py`, `core/services/search_indexing.py`, `utils/algolia_client.py`, worker indexing | Recherche via le backend, index partagé isolé par filtre utilisateur ; indexation asynchrone. Ni les recherches ni le stockage de records ne consomment les 5 EUR. Leur coût collectif et leurs limites restent réels. |
| Autres HTTP de contenu | résolveurs Apple oEmbed, Deezer, RSS, articles, redirections, téléchargements audio/images et CDN | Timeout et bornes de taille selon le chemin ; pas de prix à l’appel connu dans ce dépôt. Contrôler concurrence par hôte, timeout et anomalies ; ne pas inventer une API TikTok ou une garantie de disponibilité des sites. |

`lambda_workers.tf` fixe une concurrence ESM de 10 par défaut, `batch_size=1`, pas une concurrence cumulée par fournisseur. Le trafic LLM peut donc venir de **trois** files de dix workers. Les queues utilisent généralement `maxReceiveCount=3`, avec des visibilités différentes. Les décorateurs de `api/rate_limit.py` sont explicitement **sans effet** ; la limite API Gateway par route/stage n’est pas une limite par compte ni par fournisseur. Les variables Redis sont présentes dans `.env.example`, pas raccordées dans `runtime_env.tf` : on ne peut pas déduire de l’exemple qu’un Redis existe en AWS.

Le budget commun réserve les appels, règle les résultats livrés et rend au testeur les échecs, avec coût opérateur mesuré ou borné. Le backstop de six heures n’est pas un mécanisme d’ordonnancement. Les rapports TASK-552 distinguent coût fournisseur et valeur de contenu réutilisé. Les relances manuelles d’artefacts changent désormais de suffixe d’opération ; leur événement doit aussi porter l’identité racine et `retry_reason=explicit` pour que TASK-552 les distingue des nouvelles intentions et des retries internes (`try_number`).

**Décision de l’owner du 2026-10-29 : le palier OpenAI Launch est tenu pour acquis pour ce benchmark et ses implémentations.** L’owner l’atteint par un dépôt de crédits à faire lui-même sur la plateforme OpenAI (cumul de 100 $ de crédits achetés, hors TVA ; tâche TASK-558, checklist des actions de compte). Les plafonds de départ sont ceux de Launch (§8) ; Build reste une simulation de comparaison et le repli si le relèvement n’a pas eu lieu. La console affichait encore Build le 2026-10-29 (Luna : 5 000 RPM / 2 M TPM) ; les valeurs Launch ont été lues le même jour dans le sélecteur de palier de cette page (Luna, gpt-5-nano, gpt-5.4-nano : 10 M TPM, 10 000 RPM, 50 000 IPM ; file batch 1 G TPD), sans que le compte y soit passé. À relire sur la page Limits après le dépôt, badge du compte à « Launch ».

**Faits du compte, datés, non observations présentes :** TASK-459 rapporte Build OpenAI au 11 octobre ; TASK-557 décrit au 28 octobre LlamaParse Free et trois comptes Apify Free distincts. TASK-557 est encore `pending`. Ces notes ne prouvent ni un plan inchangé ni les quotas effectifs aujourd’hui. Aucune clé, console, identité de connexion ou solde courant n’a été lu pour cette recherche. Les alias de portée proposés sont des noms techniques non secrets, jamais un email ou un token.

**Frontière explicite :** stores, RevenueCat, Cognito/Google/Apple auth, Canny, Expo push, Sentry, SES/email, synchronisation Spotify et distribution EAS ne sont pas réintégrés au contrôle de contenu. Ils restent dans leurs dispositifs de disponibilité et facturation. AWS Lambda/SQS/DynamoDB/S3/CloudWatch, stockage et egress sont suivis par le budget infrastructure AWS, pas soustraits de l’enveloppe testeur. La lecture ECB est une requête de configuration quotidienne. Aucun appel de génération de quiz n’est modifié par cette étude.

## 2. Limites publiques, portée et vérification du compte

Sources primaires consultées le **28 octobre 2026**. Une limite publique de plan n’est pas une valeur observée sur le compte. Les liens ci-dessous sont les sources de ces valeurs, pas une promesse d’allocation.

| Fournisseur | Unités et portée publiques utiles | Ce que l’application doit mesurer / ce qui reste inconnu |
|---|---|---|
| OpenAI | RPM/RPD et TPM/TPD, modèle/famille, organisation et projet ; en-têtes de limites/restes/reset et Retry-After. Tableau Standard Luna : Build 5 000 RPM / 2 M TPM, Launch 10 000 RPM / 10 M TPM. Des erreurs de montée trop rapide et de surcharge existent même sous le TPM. [Limites](https://developers.openai.com/api/docs/guides/rate-limits) | Confirmer les limites réelles de la clé, les projets et familles partagés ; ne pas additionner leurs budgets indépendamment. La page décrit `max(max_tokens, estimation de l’entrée)` ; notre somme prudente n’est pas présentée comme l’algorithme exact du fournisseur. [Erreurs, dont dépense et surcharge](https://developers.openai.com/api/docs/guides/error-codes) |
| Deepgram | Nova-3 préenregistré : jusqu’à 50 requêtes concurrentes sur PAYG selon la page dédiée ; portée projet/région, clés du projet partagées. [Limites détaillées](https://developers.deepgram.com/reference/api-rate-limits) | Le guide général préenregistré mentionne encore 100 : retenir 50 comme hypothèse prudente, puis confirmer le projet, la région et les options. Ne pas multiplier des projets pour contourner l’allocation. [Guide général contradictoire](https://developers.deepgram.com/docs/pre-recorded-audio) |
| LlamaParse | Création v2 Parse et v1 upload : 500 requêtes/10 s chacune, organisation ; fichiers 50/s projet ; lecture d’un job 80/s organisation. **Jobs Parse simultanés** Free/Starter 5, Pro 20, Enterprise 100, indépendamment des RPS. [Débit](https://developers.llamaindex.ai/llamaparse/general/rate_limits/), [plans](https://developers.llamaindex.ai/llamaparse/general/billing/) | Confirmer l’alias v1 réellement utilisé (`/api/parsing`) et le plan. Pages/crédits, jobs, requêtes de polling et rétention des fichiers sont quatre choses différentes. La documentation de débit ne fournit pas Retry-After sur son 429. |
| Unstructured | Le code utilise `/general/v0/general` du Partition Endpoint, maintenant décrit comme **legacy**. La documentation recommande une autre surface, non appelée ici. [Paramètres de la surface utilisée](https://docs.unstructured.io/api-reference/legacy-api/partition/api-parameters) | Aucune allocation chiffrée suffisamment vérifiable pour ce contrat n’a été trouvée dans les pages consultées ; ne pas lui appliquer le quota d’un nouveau workflow Transform. Paramètre opérateur explicite, concurrence initiale prudente 1, 429 traité, confirmation du compte avant élargissement. |
| Apify | API globale 250 000 requêtes/min par utilisateur authentifié ; défaut 60/s/ressource, départ d’Actor 400/s/ressource. Ce n’est pas la capacité d’exécution. Runs simultanés Free/Starter/Scale/Business 5/32/128/256 et mémoire combinée 16 384/65 536/262 144/524 288 MB. [API](https://docs.apify.com/api/v2), [plateforme](https://docs.apify.com/account/limits) | Associer chaque token à son compte réel sans stocker le token dans la clé de contrôle ; confirmer mémoire/run, durée, acteur, unité de facturation et partage des trois plateformes. Unifier les comptes relève de TASK-558, pas d’une hypothèse de cette étude. |
| API X | `/2/tweets/:id` : 450/15 min par app, 900/15 min par utilisateur ; le code utilise le contexte app. Limites propres à chaque endpoint. [Table officielle](https://docs.x.com/x-api/fundamentals/rate-limits) | Lire les resets/en-têtes et confirmer le contrat de l’app. Le prépayé, la consommation par ressource, le plafond de cycle et les recharges sont financiers, pas un débit de 10 appels simultanés. [Tarification et crédits](https://docs.x.com/x-api/getting-started/pricing) |
| PodcastIndex | Documentation des endpoints de résolution ; aucun RPS contractuel global confirmé dans cette recherche. [Documentation officielle](https://podcastindex-org.github.io/docs-api/) | Garder comme politique initiale **1 RPS agrégé**, confirmer le besoin et les conditions du compte. Ce chiffre provient du code, pas d’un engagement du service. Cache des résolutions publiques compatible avec leur fraîcheur, pas cache d’artefacts utilisateur. |
| TikTok direct et autres hôtes | Pas d’API officielle TikTok employée par ce chemin ; limites d’IP/CDN et blocages possibles | Maintenir un pacing global **3 s et 100 extractions/h** comme politique initiale du code, compter aussi les tentatives/replis ; borne HTTP par hôte distincte. Aucun chiffre de ce tableau n’est annoncé comme un quota TikTok acheté. |
| Algolia | QPS dépendant du plan, indexation retardée/refusée sur surcharge, recherche/records facturables selon plan. [QPS](https://support.algolia.com/hc/en-us/articles/4406975224721-How-does-Algolia-calculate-the-Maximum-QPS-Queries-Per-Second), [indexation](https://support.algolia.com/hc/en-us/articles/4406975251089-Is-there-a-rate-limit-for-indexing-on-Algolia) | Le backend masque les clients à une limite par IP : la protection par compte doit être faite côté application. [Limitation côté backend](https://support.algolia.com/hc/en-us/articles/38893199214481-How-do-I-add-rate-limiting-for-a-backend-search-implementation). Relever plan, records/chunks, requêtes effectives et opérations de suppression. |

Chaque dimension comporte : `scope_alias`, région, endpoint ou famille, unité, fenêtre, limite configurée, origine (`owner`, `public_plan`, `response_header`, `application_policy`), date et marge. Une absence reste `unknown`, jamais « illimité » ou zéro dépense. Une réponse plus restrictive réduit immédiatement l’admission et déclenche une alerte ; elle ne change pas silencieusement de modèle ou de fournisseur.

## 3. Dimensionnement reproductible : 300, 500 et 1 000 DAU

### 3.1 Hypothèses communes

On compte des **utilisateurs quotidiens**, pas un nombre constant d’utilisateurs connectés. 80 % consultent/organisent sans lancer de traitement ; les autres importent deux éléments, soit **0,4 import/DAU/jour**. En moyenne : **0,3 génération et 0,6 tour de chat/DAU/jour**. Chaque import déclenche un aperçu ; 25 % nécessitent aussi une traduction. Aucun artefact demandé n’est supposé partagé ; on ne prend aucun bénéfice du cache ou de la déduplication dans ces calculs.

| Mix d’imports, somme 100 % | Part | Acquisition hypothétique |
|---|---:|---|
| Article/texte | 20 % | Pas de service facturé pour extraire le texte |
| YouTube | 20 % | Un résultat Apify |
| Podcast | 15 % | 60 min Deepgram, sans supposer une transcription RSS disponible |
| TikTok | 15 % | 70 % captions directes ; 20 % audio 1,5 min Deepgram ; 10 % un résultat Apify |
| Instagram reel | 10 % | Un résultat Apify et 2 min Deepgram |
| Document | 10 % | 12 pages, un job de parsing |
| Carrousel Instagram | 5 % | Un résultat Apify et 8 images, chacune un job/page |
| X | 5 % | Un post lu |

Cela donne par import : **9,245 minutes audio**, **1,6 page**, **0,5 job de parsing**, **0,365 run Apify** et **0,05 post X**. Le run Apify moyen vaut ici 0,00141 USD selon le barème du dépôt, pondéré par les acteurs ; ce n’est pas un prix universel d’un run.

| Appel LLM | Appels/DAU/jour | Entrée moyenne supposée, tokens | Sortie facturée supposée, raisonnement inclus | Sortie maximale utilisée pour la capacité |
|---|---:|---:|---:|---:|
| Aperçu | 0,4 | 5 000 | 500 | 32 000 |
| Traduction | 0,1 | 6 000 | 7 200 | 128 000, maximum modèle faute de plafond envoyé |
| Génération | 0,3 | 12 000 | 3 000 | 32 000 |
| Chat | 0,6 | 18 000, contexte/historique compris | 1 500 | 32 000 |

La sortie facturée n’est donc **pas** systématiquement 32 000. Pour le coût nominal on utilise 0,10 USD/M entrée et 0,50 USD/M sortie, sans cache, du barème `provider_tariffs` audité ; Deepgram 0,0043 USD/min, parsing LlamaParse 0,00375 USD/page, X 0,005 USD/post. Taux illustratif du dépôt : 1 EUR = 1,1188 USD. Ces hypothèses ne remplacent pas les métriques et tarifs réellement versionnés à l’envoi. Unstructured, replis et inconnues sont ajoutés dans les sensibilités.

Pour la capacité, deux calculs sont volontairement séparés :

- somme entrée estimée + sortie maximale : **71 400 unités/DAU/jour** ;
- hypothèse prudente initiale `Q = octets UTF-8 de la requête + sortie maximale`, avec ratio moyen hypothétique **3,4 octets/token** : **112 200 unités/DAU/jour**. L’implémentation lit les octets réellement sérialisés et ajoute l’enveloppe/schema, pas ce ratio moyen. Les chiffres ci-dessous utilisent cette deuxième hypothèse ; le comptage réel du fournisseur peut être moins restrictif.

Équations : `LLM_calls=1,4N`, `input=17 000N`, `output=2 720N`, `Q=(3,4×17 000 + 1,3×32 000 + 0,1×128 000)N`. Coût contenu quotidien :

`N × [17 000×0,10/10^6 + 2 720×0,50/10^6 + 0,4×(9,245×0,0043 + 1,6×0,00375 + 0,00141 + 0,05×0,005)] = 0,0220254N USD`.

Les résultats non arrondis sont dans [scenarios.csv](scenarios.csv). Ce fichier est un calcul hors ligne, aucune requête d’essai ni mesure de production.

### 3.2 Consultation majoritaire : moyenne et coûts

| DAU | Imports/j | LLM/j | Audio min/j | Pages / jobs parsing par jour | Apify/j | Q LLM moyen/min, 24 h | Coût contenu USD/j | Contenu EUR/30 j |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 300 | 120 | 420 | 1 109,4 | 192 / 60 | 43,8 | 23 375 | 6,61 | 177,18 |
| 500 | 200 | 700 | 1 849 | 320 / 100 | 73 | 38 958 | 11,01 | 295,30 |
| 1 000 | 400 | 1 400 | 3 698 | 640 / 200 | 146 | 77 917 | 22,03 | 590,60 |

Ces moyennes restent faibles face au TPM. Elles ne prouvent rien sur une rafale ou une organisation dont une autre application utilise déjà la capacité. Les 5 EUR sont un plafond individuel mensuel, **pas une dépense moyenne**, ni une garantie de financement de 5N EUR.

**Recherche hors enveloppe.** À titre d’hypothèse, trois sessions de recherche × quatre requêtes effectives = 12 recherches/DAU/jour. Avec le tarif public **Grow** (10 000/mois inclus, puis 0,50 USD/1 000 ; 100 000 records inclus puis 0,40 USD/1 000), cela ajoute respectivement **49 / 85 / 175 USD par mois**, hors records. Le plan réel n’est pas confirmé ; ce calcul ne lui est pas attribué. [Prix Algolia](https://www.algolia.com/pricing). Un long transcript produit plusieurs chunks/records et plusieurs saves peuvent en multiplier le stockage : mesurer les records durables, pas uniquement les imports. Une saisie sans debounce ou quatre recherches parallèles multiplie le coût sans nouveau contenu. Avec dix chunks par import (hypothèse), 1 000 DAU produisent déjà 4 000 nouveaux records/jour, soit 120 000 en trente jours avant suppression et stock antérieur ; ce poste ne reste pas automatiquement sous les 100 000 inclus.

### 3.3 Rafale du soir

Hypothèse : **30 % du travail du jour arrive en dix minutes**. Cible de régulation retenue : 80 % du quota Launch de 10 M TPM = **8 M unités/min** ; pour comparaison, 80 % d’un quota Build de 2 M TPM = 1,6 M. Ce n’est pas une annonce de quota du compte.

| DAU | LLM/min pendant la rafale | Q/min prudent | Drain minimal de toute la rafale, Build | Arriéré après les dix minutes si aucun nouveau travail n’arrive | Drain minimal Launch |
|---:|---:|---:|---:|---:|---:|
| 300 | 12,6 | 1,0098 M | 6,31 min | 0 | 1,26 min |
| 500 | 21 | 1,683 M | 10,52 min | ≥0,52 min | 2,10 min |
| 1 000 | 42 | 3,366 M | 21,04 min | ≥11,04 min | 4,21 min |

Ce sont **des bornes de débit**, pas les latences de chaque opération. Une fenêtre prudente, l’ordre des étapes, la concurrence et la durée fournisseur augmentent le délai. Si le trafic continue, l’arriéré se résorbe à `capacité − arrivées`, pas à la capacité entière. À 1 000 DAU, le chat représente à lui seul 18 appels/min et 1,6776 M Q/min dans ce modèle prudent : il dépasse la cible Build même sans travail de fond, mais reste sous la cible Launch retenue (8 M). Une priorité ne crée pas la capacité manquante ; certains tours doivent être refusés temporairement avant émission.

À durées hypothétiques de 20 s/appel pour chat/artefact et 45 s/traduction, dix workers servent respectivement 30/30/13,3 appels par minute. Ce ne sont pas des mesures. Le TPM devient ici contraignant avant la concurrence moyenne ; avec une latence ×3, les dix slots ne servent plus que 10/10/4,4 appels/min et deviennent aussi un goulot. Le contrôle doit donc cumuler les deux dimensions.

**Autres fournisseurs pendant cette même rafale**, sans retry/repli additionnel :

| Travail | Total journalier pour 300 / 500 / 1 000 DAU | Pic du soir pour 300 / 500 / 1 000 DAU | Lecture des limites |
|---|---|---|---|
| Deepgram, appels | 33,6 / 56 / 112 | 1,008 / 1,68 / 3,36 par minute | À 90 s/appel hypothétiques, ~1,51 / 2,52 / 5,04 slots simultanés : sous dix, mais pas si la durée ou les retries montent. |
| Parsing, jobs | 60 / 100 / 200 | 1,8 / 3 / 6 par minute | À 30 s/job, ~0,9 / 1,5 / 3 slots ; le besoin moyen reste sous cinq, le lot suivant peut ne pas passer. |
| Apify, départs | 43,8 / 73 / 146 | 1,314 / 2,19 / 4,38 par minute | À 120 s/run, ~2,63 / 4,38 / 8,76 runs. Addition pertinente seulement s’ils partagent un compte ; trois comptes distincts se contrôlent séparément. |
| X, posts | 6 / 10 / 20 | 0,18 / 0,3 / 0,6 par minute | Sous 450/15 min pour ce scénario, sans présumer le même résultat pour un lot entièrement composé de posts X. |
| PodcastIndex | 36 / 60 / 120 requêtes si deux par podcast | 1,08 / 1,8 / 3,6 par minute | Sous la politique de 1 RPS ; les séquences de résolution réelles doivent compter chaque appel. |
| TikTok direct | 18 / 30 / 60 extractions | 0,54 / 0,9 / 1,8 par minute | Cette rafale ne contient que 5,4 / 9 / 18 extractions : extrapoler sa cadence à une heure ne prouve pas un dépassement du compteur horaire. |
| Algolia | 3 600 / 6 000 / 12 000 requêtes | 1,8 / 3 / 6 QPS | Comparer au plan effectif, pas à un nombre universel. |


### 3.4 Premier import de bibliothèque et équité

Hypothèse : **4 % des DAU importent chacun 30 éléments au même moment**, dans le même mix. Les appels automatiques sont inclus, pas les générations manuelles supplémentaires. Q par import = `49 000 + 0,25×148 400 = 86 100`.

| DAU | Comptes importateurs | Éléments | Q automatique | Borne drain LLM Build / Launch | Jobs parsing | Borne parsing à 5 slots, 30 s/job |
|---:|---:|---:|---:|---:|---:|---:|
| 300 | 12 | 360 | 30,996 M | 19,37 / 3,87 min | 180 | 18 min |
| 500 | 20 | 600 | 51,660 M | 32,29 / 6,46 min | 300 | 30 min |
| 1 000 | 40 | 1 200 | 103,320 M | 64,58 / 12,92 min | 600 | 60 min |

Même Starter LlamaParse garde cinq jobs : payer davantage n’augmente pas automatiquement cette concurrence. Un FIFO place un petit compte derrière jusqu’à 1 200 intentions et leurs continuations. Un round-robin par **message** avantage encore un compte dont chaque message lit 25 sources ; un déficit fondé sur le travail évite cette confusion. Le premier résultat dépend aussi du chemin : ce tableau ne promet pas qu’un compte attendra une heure avant toute lecture.

Pour le lot bibliothèque, TikTok représente 54 / 90 / 180 extractions : à 1 000 DAU,
180 dépasse la politique de 100 sur une fenêtre horaire fraîche. Il faut attendre
son reset, sans promettre une durée indépendante de l’heure d’arrivée. Les requêtes
PodcastIndex supposées valent 108 / 180 / 360 appels, soit au moins 1,8 / 3 / 6 min à
1 RPS. Deepgram représente 100,8 / 168 / 336 appels ; à dix slots et 90 s/appel,
15,12 / 25,2 / 50,4 min de service minimal. Ces bornes s’ajoutent aux dépendances
entre étapes ; on ne les additionne pas toutes naïvement puisque des étapes
indépendantes tournent en parallèle.

La politique proposée accepte 30 intentions par compte dans un lot paginé, puis reprend l’envoi quand des places se libèrent ; elle ne refuse pas définitivement l’import d’une bibliothèque de 500 éléments. Le navigateur/mobile conserve les intentions non soumises et le serveur retourne celles déjà acceptées. L’interface ne doit pas laisser croire que les éléments non soumis existent déjà côté serveur.

### 3.5 Cas lourds et incidents

| Scénario supplémentaire | 300 / 500 / 1 000 DAU | Conséquence chiffrée, hypothèses explicites |
|---|---|---|
| 1 % importe un podcast de 240 min | 3 / 5 / 10 épisodes ; 720 / 1 200 / 2 400 minutes | Acquisition Deepgram seule 3,096 / 5,16 / 10,32 USD. À 200 tokens/min, 48 000 tokens source ; un aperçu et une traduction peuvent peser davantage que l’acquisition en capacité LLM. Dix longs podcasts occupent tous les slots Deepgram du déploiement audité. Aucune durée réelle de transcription n’est présumée. |
| 10 % importe un document de 100 pages, 5 % un carrousel de 8 images | 3 120 / 5 200 / 10 400 pages ; 150 / 250 / 500 jobs | LlamaParse nominal 11,70 / 19,50 / 39 USD ; à 5 slots × 30 s/job, 15 / 25 / 50 min de service minimal. Si 10 % des pages sont aussi envoyées à Unstructured, ajouter 4,68 / 7,80 / 15,60 USD, sans soustraire un éventuel premier appel déjà facturé. |
| 10 % lance un chat de dossier à 120 000 tokens d’entrée en même temps | 30 / 50 / 100 tours | Q hypothétique 440 000/tour ; 13,2 / 22 / 44 M unités. Borne LLM Build 8,25 / 13,75 / 27,5 min ; Launch 1,65 / 2,75 / 5,5 min, sans latence modèle. Ces demandes interactives ne doivent pas attendre ces durées : admission bornée, puis capacité temporairement indisponible. |
| Fournisseur sans résultat, 50 nouvelles opérations par DAU/jour, borne réelle de chaque tentative ≤0,02 USD | 15 000 / 25 000 / 50 000 appels potentiels | Jusqu’à 300 / 500 / 1 000 USD d’engagements d’échec par jour, malgré le remboursement intégral du testeur. Ce 0,02 est une classe d’appel hypothétique, **pas une borne de tous les modèles/corpus**. Un nouvel id contourne la limite de retries d’une seule opération ; le plafond opérateur et le circuit doivent traverser les ids. |

Le cas 1 000 carrousels ou un pourcentage de langue différent se recalcule avec les équations, pas avec une moyenne « un document = une page ». Un import peut créer un aperçu, une traduction et plusieurs parsings ; une continuation garde son payeur et son intention racine.

### 3.6 Sensibilités et limites des nombres

- **Tokenisation / réservations.** Pour le même mélange : ratio UTF-8/token 2 → 88 400 Q/DAU/jour ; 3,4 →112 200 ; 5 →139 400. Le calcul moins prudent entrée estimée + sortie vaut 71 400. À 1 000 DAU, rafale à 30 %/10 min : 2,652 / 3,366 / 4,182 M Q/min, ou 2,142 M avec le calcul moins prudent. Aucune de ces approximations ne remplace les headers.
- **Langues.** Traduction de 0 à 100 % des imports : Q quotidien 97 360 à 156 720 par DAU, contre 112 200 à 25 %. Sortie de traduction de 1 à 2 fois l’entrée : son coût nominal double presque ; son maximum non plafonné reste important pour l’admission.
- **Raisonnement et longueur.** Sorties facturées ×4 : coût LLM 0,00306 →0,00714 USD/DAU/jour, contenu total +0,00408 USD/DAU/jour ; la réserve 32 000 reste la même tant que ce plafond est inchangé. Prix longs, cache writes et entrées au-delà du seuil du modèle suivent le barème versionné, non les prix courts du cas moyen.
- **Succès/failures.** Pour un coût moyen par tentative comparable, livrer une même quantité avec probabilité de succès p nécessite en moyenne `1/p` tentatives si les retries sont permis ; p=0,9 →1,11 ; 0,5 →2. À p=0, le mécanisme doit suspendre, pas calculer une moyenne infinie ni continuer grâce aux remboursements.
- **Arrivées.** Même demande concentrée en une minute plutôt que dix : débit ×10. Doubler le nombre d’utilisateurs double la demande, pas le quota fournisseur. Un compte avec plusieurs utilisateurs, plusieurs appareils ou plusieurs files garde une seule part d’équité.
- **Latence / polling.** 5 jobs × un poll/2 s =2,5 lectures/s ; 20 jobs =10/s, sous le plafond public de lecture pris ici, mais une boucle sans délai l’atteint vite. Un job de 120 s produit jusqu’à 60 polls. Augmenter le timeout d’une Lambda n’augmente ni les jobs autorisés ni le TPM.
- **Stocks et facture.** Algolia 12 requêtes/DAU/jour suppose un debounce efficace. ×4 donne 211 / 355 / 715 USD/mois de recherche Grow hors records. Gratuité, promotions et cache réduisent la trésorerie, pas la quantité de travail ni l’enveloppe valorisée au tarif normal.

## 4. Comparaison des options de régulation et d’exécution

L’exhaustivité porte sur les mécanismes adaptés au système audité, pas sur un catalogue de tous les SaaS de files. Les variantes commerciales d’un même compteur/ordonnanceur ne donnent pas une garantie différente.

| Option | Ce qu’elle contrôle / ne contrôle pas | Coût fixe et variable, latence ajoutée | Exploitation et conclusion |
|---|---|---|---|
| M1. Concurrence Lambda + retry réactif, choix actuel | Borne les invocations d’une file, pas les tokens/minute, les requêtes rapides ou les runs distants après retour. Un timeout peut laisser le fournisseur actif. | Pas de nouveau service ; appels refusés, reprises, slots occupés et dépenses d’échec restent payables. Aucune admission réseau supplémentaire. | Simple, adapté à la petite bêta du choix TASK-459 ; insuffisant comme contrôle collectif à l’échelle et aux rafales étudiées. Garder comme filet, pas comme seule preuve. |
| M2. Compteur/semaphore local dans chaque processus | Borne un worker chaud ; démarrages à froid et N processus multiplient la capacité. | Mémoire locale presque gratuite ; attente bloque la Lambda ; coût fournisseur non borné globalement. | Ne satisfait pas le partage. Supprimer le repli local silencieux des chemins couverts par le nouveau contrôle, plutôt que prétendre qu’il protège le compte. |
| M3. Redis/Valkey partagé, Lua + GCRA/token bucket/semaphore | Admission atomique rapide et adaptée aux unités pondérées ; token bucket avec rafale autorisée ne signifie pas « aucune minute glissante dépassée ». Persistance/récupération des permis indispensable. | Service réseau supplémentaire, stockage minimal facturé et ECPU/nœuds ; un aller-retour par décision, non mesuré ici. Valkey Serverless a un minimum de 100 MB, Redis OSS 1 GB. [Prix](https://aws.amazon.com/elasticache/pricing/) | Bonne option si le débit justifie ce service et son exploitation. Aucun Redis AWS confirmé aujourd’hui ; deux magasins compliquent l’atomicité avec le budget. Non retenu initialement. |
| M4. DynamoDB, fenêtres/semaphores conditionnels | Compteurs partagés, transitions persistantes, transactions avec le registre existant. Une fenêtre fixe unique peut doubler une rafale en bordure ; plusieurs secondes conservatrices évitent ce défaut pour la fenêtre configurée. | À la demande ; lectures/transactions et stockage, sans serveur permanent. Deux lectures et une transaction possibles sur une admission, plus retries de contention bornés. | Retenu pour l’échelle étudiée. Versionner les états, horloge UTC, ne pas utiliser TTL comme libération immédiate et surveiller la partition chaude. |
| M5. FIFO SQS / groupes par compte | FIFO sérialise un groupe, mais ni tokens, ni coût, ni capacité partagée entre files. Une grosse tête de groupe peut bloquer les petits travaux du même compte. | Requêtes SQS et exécutions ; attente durable économique, pas de plafond financier. | Utile pour un ordre strict quand nécessaire, pas pour choisir équitablement des coûts très différents. Pas de conversion générale en FIFO proposée. |
| M6. SQS **fair queues**, standard avec MessageGroupId | Dépriorise les voisins bruyants sur le temps/concurrence des consommateurs ; n’impose pas un débit par tenant. Une file Lambda de dix appels ne rend pas détectables toutes les rafales de tokens. | Tarification SQS applicable à confirmer pour les requêtes fair ; aucun serveur à ajouter, pas d’ordre strict. | Comparateur pertinent, bénéfice possible comme protection secondaire ; **ne remplace pas** admission globale ou équité pondérée entre les trois files LLM. [Fonctionnement](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-fair-queues-detailed.html), [garanties](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-fair-queues.html) |
| M7. Ordonnanceur équitable, DRR/WFQ et âge | Round-robin simple compte des messages, WFQ pondère le travail avec choix trié, DRR accumule un déficit par compte et gère des travaux indivisibles de tailles différentes. Aucun ne crée de capacité si le fournisseur reste arrêté. | Métadonnées par compte actif, transactions/notifications. WFQ a davantage de structure triée ; DRR convient ici sans serveur toujours actif. Attente dépend de la charge, pas seulement du RTT DB. | Retenir un DRR persistant au-dessus de M4. La transposition de paquets réseau à des jobs multi-étapes est **notre proposition**, pas une garantie de latence donnée par l’article. [Travail original](https://repository.library.washu.edu/cse_research/339/) |
| M8. Acheter un palier, séparer des projets, Batch/offline | Augmente parfois des quotas ; ne remplace ni la part par compte ni la protection des dépenses. Un projet peut rester sous une limite d’organisation commune. Batch est utile si le produit accepte son cycle différé. | Abonnement/engagement ou crédits, latence Batch différente, nouvelle intégration et reprise. | Ne pas imposer un achat, Batch ou changement de modèle dans ce benchmark. Choix de plan/recharge TASK-557/558 ; capacité propriétaire à confirmer. |
| M9. Worker central permanent, ECS/serveur et file en mémoire | Ordonnancement flexible et faible RTT local ; nécessite haute disponibilité et persistance, sinon le crash perd le droit et les travaux. | Compute facturé au temps, réseau/HA et maintenance, plus le stockage durable qui reste nécessaire. | Non justifié par 420–1 400 appels LLM/jour hypothétiques ; réexaminer si la contention des états dépasse l’enveloppe retenue. |

**Coût du socle retenu, calcul d’ordre de grandeur.** Le prix AWS public donne un exemple Standard à 0,625 USD/M écritures et 0,125 USD/M lectures ; ce n’est pas un devis Paris. [Tarification](https://aws.amazon.com/dynamodb/pricing/). Hypothèse de comptage déjà en unités facturées, transactions et taille incluses : **20 WRU + 10 RRU par appel/stage**, soit 1,375 USD/100 000 décisions. À 1 400 appels LLM/jour, environ **0,58 USD/30 jours** pour ces décisions seules, avant autres stages, GSI, stockage, logs, SQS, ordonnanceur et échecs conditionnels. Ne pas lire cela comme la facture du système complet. Avec deux décisions par poll de 60 polls/job, le polling domine vite ; utiliser des réveils à échéance et batcher, pas un scan de tous les travaux chaque seconde. Le devis d’infrastructure `eu-west-3` et le coût réel des nouvelles métriques restent à relever avant ouverture.

### 4.1 Détail proposé de l’admission de capacité

- Chaque requête traverse les **portées réellement partagées** : organisation/famille et projet OpenAI le cas échéant ; projet/région Deepgram ; organisation et projet LlamaParse selon endpoint ; compte Apify et acteur/ressource ; app/endpoint X ; hôte/politique pour les HTTP directs. Plusieurs alias ne doivent pas être créés à partir de clés différentes du même compte pour multiplier la limite.
- Dans l’état DynamoDB d’une portée, conserver une version et une série bornée de sous-fenêtres. Pour une limite glissante de 60 s, compter de façon conservatrice les **61 secondes qui peuvent la chevaucher**, requête nouvelle comprise. Le même principe s’applique à 10 s, 15 min, jour. Une portée à très long horizon utilise des compartiments adaptés ; pas 86 401 attributs dans un item. Une limite journalier/fenêtre civile suit sa définition et son reset, pas arbitrairement cette technique.
- Une transaction conditionnelle vérifie les versions, incrémente toutes les dimensions utiles, crée le permis et les claims associés. En cas de conflit, relire et réessayer un petit nombre de fois, puis différer ; jamais envoyer en se fondant seulement sur une lecture ancienne. Une transaction DynamoDB peut couvrir plusieurs tables du même compte/région ; ce choix permet de partager les conditions du registre existant. [Atomicité et limites](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html).
- À faible charge, cette granularité coûte davantage de métadonnées mais évite le facteur de bordure d’une seule fenêtre fixe. À forte contention, les écritures sur une portée unique restent un goulot : mesurer conflits et temps d’admission, baisser les notifications ou envisager M3. Ne pas sharder un plafond global en N plafonds complets indépendants.
- Une rafale/cadence doit aussi respecter une vitesse de montée prudente et les resets reçus ; le compteur n’empêche pas une surcharge fournisseur. Estimation Q, marge et headers restent distincts. Une observation ne doit pas augmenter automatiquement un plafond au-delà de la configuration autorisée par l’owner.
- La concurrence utilise un **permis avec propriétaire, révision et échéance**, pas le seul nombre de messages invisibles. Pour Deepgram synchrone il couvre la requête ; pour Apify/LlamaParse il couvre le job distant jusqu’à un état terminal ou une résolution explicite de son issue. Le timeout Lambda ne vaut pas preuve de fin du job.
- Les jetons de débit ne sont rendus avant expiration que si l’absence d’envoi est certaine. Une issue inconnue les conserve jusqu’à la fin de la fenêtre. Un permis de job incertain est quarantainé, puis réconcilié par lecture d’état ; le TTL supprime des déchets **après** clôture et ne libère pas magiquement une place.
- Si une requête seule dépasse la capacité configurée de toute sa fenêtre, la classer `capacity_request_too_large` : pas de file éternelle, pas de confusion avec `budget_exhausted`. Aucun découpage de contenu, changement de modèle ou baisse des sorties de TASK-439/556 n’est fait implicitement pour la faire rentrer.

La garantie obtenue est celle de **nos compteurs et hypothèses configurés**, sous admission atomique et passages exhaustifs par le garde. Elle n’est pas une preuve de l’algorithme interne du fournisseur, de l’absence de 429 ou d’un temps de réponse garanti.

## 5. Équité, lots, attente et contrats clients

### 5.1 Politique proposée

Le compte payeur est l’unité d’équité, quel que soit le nombre d’appareils, d’éléments ou de files. Le rattachement d’une continuation, d’un repli ou d’un appel automatique conserve l’intention racine et le payeur ; pas de nouveau compte synthétique « system » qui échappe aux règles. Un aperçu partagé appartient à celui qui a effectivement lancé son appel ; ses lecteurs ne prennent pas chacun un slot pour le même job.

Deux classes avec objectif **80 % interaction / 20 % fond sous contention**, work-conserving : capacité libre empruntée dans les deux sens. Cette répartition est un **objectif de service pondéré dans le temps**, pas une interdiction absolue « fond ≤20 % dans chaque seconde ». Un gros job peut dépasser ce quantum et doit accumuler son crédit ; la capacité de rafale du mécanisme de classe doit pouvoir contenir le plus gros job admis. Sinon on introduirait une famine structurelle, même quand le fournisseur peut le recevoir.

DRR conserve un déficit par compte et par portée ; les travaux à coût supérieur au quantum accumulent du crédit entre passages. Pondérer par la dimension dominante du travail estimé (`max(demande_i/capacité_i)`), pas seulement par le nombre de requêtes. Les permis de concurrence sont également plafonnés par compte. Le vieillissement rend une tête ancienne éligible au prochain créneau compatible ; il ne préempte pas un appel déjà parti et ne fait pas franchir un plafond global. Coûts estimés inexacts : suivre le temps réel occupé et corriger les tours suivants, sans débiter rétroactivement un autre compte.

Paramètres initiaux proposés, **à valider**, non garanties empiriques : un chat actif par compte, deux stages de fond actifs au total, au plus un job coûteux par compte et par fournisseur ; **32 intentions de fond acceptées par compte, 2 000 globalement**, continuations internes incluses dans leur racine. Au-delà, `queue_full` temporaire avant acceptation, avec reprise de l’envoi d’un lot à la libération d’une place. Le lot de 30 du §3 reste donc utilisable. Les métadonnées d’une intention représentent sa prochaine étape, pas huit intentions indépendantes pour un carrousel.

Pour N comptes actifs, la part n’est pas `1/N` appliquée à tous les comptes enregistrés. Les comptes absents ne réservent pas de capacité morte. Sous hypothèses de fournisseur fonctionnel, arrivées finies, jobs de durée bornée et requêtes qui rentrent dans le plafond, cette discipline évite qu’un gros lot saute indéfiniment devant un petit compte. Elle ne promet aucun délai fini pendant une panne prolongée ou lorsque les arrivées dépassent durablement le service. La borne de file et une expiration explicite donnent alors une issue visible, pas un stockage sans fin.

### 5.2 Attente et réponses

| Situation | Contrat proposé, cohérent mobile/web |
|---|---|
| Demande de fond acceptée, attend sa capacité | Réponse normale de création ; id stable. Statut métier existant queued/processing, avec métadonnées `wait_reason=provider_capacity|account_fairness`, `queued_at`, `retry_at` si fiable, possibilité d’annuler tant que non envoyé. Montrer « En attente de traitement », sans spinner de panne ni nouveau bouton Générer pour la même intention. |
| Place de file indisponible avant acceptation | `429 queue_full`, Retry-After et motif typé ; aucune entrée ni réserve financière fantôme. Un lot sait quelles intentions ont été acceptées et reprend à partir des autres. |
| Chat avant texte | Admission/attente locale bornée à 10 s au total ; s’il faut attendre davantage, `429 provider_capacity_busy`, délai et texte conservé. Si un tour a déjà été écrit, le sceller par le chemin existant et libérer son budget. Pas de relecture automatique après premier texte ; les protections d’interruption et de coût livré restent en place. |
| Fournisseur suspendu | `503 provider_suspended`, portée et `retry_at` quand connu ; compteurs de budget inchangés. Le motif distingue incident, limite financière opérateur et action nécessaire sur le compte fournisseur. |
| Contrôle indisponible | `503 capacity_control_unavailable` ou `operator_control_unavailable`, aucun appel payant envoyé. Pour un travail accepté, attente durable bornée puis état d’échec explicite si la panne dépasse la politique. |
| Requête incompatible avec capacité configurée | `422 capacity_request_too_large`, raison et action adaptée. Aucun rapprochement avec les 5 EUR restant au compte. |
| Enveloppe individuelle épuisée | Contrat TASK-550/551 inchangé : budget_exhausted, date de reset. Les nouveaux motifs ne doivent pas être convertis en ce code. |
| Annulation / attente trop longue | Marquer cancelled/failed avec raison explicite, retirer l’intention prête, rendre uniquement les droits non envoyés et places détenues ; conserver l’entrée de l’historique jusqu’à l’action utilisateur. Pas d’effacement silencieux. |

La proposition porte les nouveaux types, textes et comportements via TASK-565 et `packages/core`, avec parité mobile/web. Les champs de jauge et la règle de consommation de TASK-550/551 ne sont pas redéfinis. Réutiliser les routes canoniques `/api/media/*`, `/api/artifacts/*` et les routes de chat existantes ; aucune nouvelle route média/artefact sous `/api/v1/`. Les états internes ne doivent pas se transformer en détails techniques dans les écrans.

Le fond peut attendre **24 h au maximum depuis acceptation** (proposition configurable, pas attente illimitée). Ce délai est distinct de la préparation des sources d’un artefact et de son expiration existante d’une heure. Une attente de capacité ne doit pas déclencher par erreur le détecteur « génération abandonnée » basé sur `updated_at` : les métadonnées d’attente/heartbeat doivent distinguer un travail délibérément différé d’un worker perdu. Le chat conserve sa borne beaucoup plus courte.

## 6. Cycle capacité–budget–envoi et frontières d’implémentation

### 6.1 Contrat interne commun proposé

Les noms suivants décrivent une interface à livrer, **pas du code existant** :

```text
WorkIntent(root_id, stage_id, revision, payer, provider_scope_aliases,
           interaction_class, quantities, created_at, deadline)
CapacityDecision = ready(permit_id, fencing_token, expires_at)
                 | wait(reason, not_before)
                 | refused(code, retryable)
SendClaim(attempt_id, permit_id, fencing_token, operator_epoch, deadline)
```

`quantities` transporte des unités et leur qualité (`measured|estimated|unknown`), pas un prompt, URL personnelle ou token. Les métadonnées complètes vivent dans les tables privées usuelles ; les exemples suivis dans Git ne contiennent aucune identité réelle. Le token de fencing est une génération monotone du droit, pas une clé de compte.

| Étape | Transitions et propriété |
|---|---|
| 1. Enregistrer l’intention | Auth/propriété, limites de taille existantes, limite de file. Créer ou retrouver la **continuation de la même intention** ; un nouveau POST utilisateur d’artefact demeure une nouvelle intention selon TASK-562. Aucune promesse d’envoi avant les autres contrôles. |
| 2. Choisir le prochain travail | TASK-565 choisit le compte/la classe et comptabilise son déficit ; TASK-564 vérifie toutes les portées et produit ready/wait/refused. L’attente ne crée pas une tentative `sending` ni une panne fournisseur. |
| 3. Réserver | La réservation monétaire reste dans `beta_budget_db`. TASK-566 y ajoute les conditions opérateur, TASK-564 y vérifie le permis/epoch, dans la même transaction lorsque possible. Sur refus du budget, rendre le permis non envoyé et garder un motif distinct. |
| 4. Claimer l’envoi | Condition atomique : tentative held, permis valide non consommé, bonne révision et epoch de circuit, deadline valide. Le gagnant seul peut appeler le fournisseur. Entre réservation et claim, une pause peut encore interdire l’envoi ; rendre alors les holds non envoyés. |
| 5. Appeler | Un droit d’envoi consommé n’est pas réutilisé par un redelivery. Les appels automatiques, retries, replis et polls ont leur portée ; un repli payant a une **nouvelle** tentative réservée, pas une permission générale reçue au premier fournisseur. |
| 6. Régler | Résultat livré : consommation utilisateur selon les règles actuelles. Rien livré : libération utilisateur, coût fournisseur au compte opérateur, réel ou borne. Clore la capacité quand l’issue qui l’occupe est connue ; un job distant peut rester actif après le retour HTTP. |
| 7. Reprendre / expirer | Une continuation reprend son stage et sa révision ; elle ne crée ni un nouveau POST utilisateur ni une nouvelle facture pour le même envoi. Un nouveau **véritable** appel reçoit sa propre tentative. Expiration et annulation libèrent les ressources conditionnellement, une seule fois. |

### 6.2 Tenir un budget pendant l’attente

Avant le premier appel payant d’un import, **l’admission groupée acquisition + aperçu + traduction de R.10 reste obligatoire**. L’étude propose un droit de capacité court de 30 s et de ne conserver aucune réservation non envoyée pendant une longue attente initiale : remettre l’intention en file et refaire une admission groupée au réveil. Une transaction annulée ne laisse pas une demi-admission.

Après une acquisition déjà envoyée, garder ses engagements ; les parts futures non envoyées peuvent attendre **dix minutes au plus** avant libération et report explicite. Cette proposition raccourcit le portage opérationnel des seuls holds non envoyés ; le backstop actuel de six heures reste un filet, pas un délai normal. La reprise réadmet **ensemble toutes les parts restantes** sous la même intention. Elle peut alors rencontrer une enveloppe devenue insuffisante : le média déjà lisible reste accessible, son aperçu/traduction en attente indique la cause. Ne pas refaire l’acquisition, ne pas promettre une fin automatique sans budget.

**C’est une adaptation de la durée des réservations à valider dans Owner Validation**, pas une modification silencieuse de R.4/R.10 par un implementer. Si l’owner préfère conserver tous les holds jusqu’à la fin, retenir une borne d’attente et expliciter le montant réservé ; ne pas annoncer à la fois une capacité libre et une réservation persistante invisible. Dans les deux variantes, les 5 EUR et le remboursement sans résultat sont conservés.

Le helper à ajouter pour libérer une attente vise uniquement les tentatives encore **held et non claimées** du stage concerné. Ne pas appeler aveuglément une libération de toute l’opération qui pourrait fermer un `sending` encore vivant. Les reprises comparent le fence/epoch ; un événement de fin ancien ne peut pas libérer le permis d’une nouvelle révision.

### 6.3 Crashs, doublons et temps long

| Cas à traiter explicitement | Comportement recommandé |
|---|---|
| Crash avant réservation | Le permis court expire ; une reprise retrouve l’intention. Aucun coût enregistré comme envoyé. |
| Crash après réservation, avant claim | Réconciliation ferme seulement les holds prouvés non envoyés, puis rend le permis. Reprise idempotente. |
| Crash après claim/envoi, résultat inconnu | **Ne pas relancer automatiquement à la seule expiration de la Lambda.** Conserver une borne financière et la place distante incertaine ; interroger le job lorsqu’un identifiant existe. Sans identifiant/idempotence fournisseur, pas de garantie d’exactly-once : risque explicite, circuit/limites réduisent l’exposition. |
| SQS réémet / callback dupliqué | Claim conditionnel par stage/révision ; consommations et libérations idempotentes. Le message n’est pas l’identité de l’opération. |
| Capacité refusée localement | Persister not_before et acquitter la notification après son écriture durable. Nouvelle notification à échéance ; **ne pas épuiser maxReceiveCount** à force de lever une exception de saturation normale. |
| Crash entre état durable et notification | Outbox dans la même transaction, puis expéditeur idempotent. Un sweeper remet les notifications dues ; un doublon ne redonne pas un droit d’envoi. |
| Délai long | SQS delay est limité à 15 min ; état due_at persistant et réveil/sweeper borné pour plus long, pas de sommeil Lambda d’une heure. [Délai SQS](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-delay-queues.html) |
| Résultat ou coût tardif | Vérifier révision avant livraison ; régler le coût réellement connu même après la décision utilisateur. Ajustement opérateur idempotent par delta par rapport à la borne déjà imputée, jamais deux dépenses complètes. Une entrée supprimée n’est pas recréée. |
| Plusieurs instances reprennent le circuit | Seul un claim `half_open` partagé et versionné autorise l’essai. Les autres restent en attente. Une relance de processus ne remet pas le circuit à zéro. |
| Passage de mois | Le budget utilisateur reste attaché à son mois de réservation, comme aujourd’hui. Le contrôle opérateur revalide son engagement dans la période de **l’envoi** ; transfert conditionnel d’un hold opérateur traversant le reset, sans transférer le budget du testeur. Les cycles de facture fournisseurs ne sont pas supposés égaux au mois UTC. |

### 6.4 Responsabilités des trois tâches

| Tâche | Possède | Ne possède pas |
|---|---|---|
| TASK-564 | Interface WorkIntent/CapacityDecision/SendClaim ; portées et unités ; compteurs et permis ; outbox/report durable ; intégration de chaque départ/retry/repli/poll ; retrait des limiteurs locaux remplacés ; événements de capacité | Les poids d’équité décidés par TASK-565, les prix/engagements opérateur de TASK-566, l’achat de plans |
| TASK-565 | DRR, classes, emprunt/vieillissement ; attribution au payeur ; caps actif/en attente ; lots, annulation et expiration ; états/API/UX mobile + web ; usage des permis de 564 | Un second garde fournisseur, le débit monétaire ou un quota commercial quotidien |
| TASK-566 | Extension atomique du registre financier ; plafonds/engagements globaux et fournisseurs ; circuit et epochs ; reprise ; dépenses d’échec et recherche hors enveloppe ; alarmes/runbook et limites de garantie | Un registre de coûts indépendant, le rapport général 552, le sort des plans et pools 557/558 |

TASK-564 doit livrer une interface de politique d’ordonnancement que 565 remplit, sans déployer provisoirement deux ordonnanceurs qui décident chacun d’envoyer. Les garde-fous monétaires de 566 se raccordent **au même claim**, pas à un appel déjà parti. La mise en service cohérente attend les trois composants requis par la décision ; les AC restent satisfaisables dans le worktree, sans gate de déploiement.

## 7. Protéger la dépense et suspendre les incidents

### 7.1 Comparer les protections financières

| Protection | Garantie utile | Limite / choix |
|---|---|---|
| 5 EUR par compte | Borne valorisée individuelle, tentatives réservées avant appel, aucun report de crédit | Les échecs sont rendus au testeur. Elle ne borne ni leur répétition sous de nouveaux ids, ni les recherches, ni le total de comptes. À conserver. |
| Plafond global seulement sur coûts déjà clos | Alerte/examen des dépenses passées | N’empêche pas une grande quantité d’engagements simultanés de dépasser le plafond. Insuffisant comme admission. |
| **Coûts clos + engagements ouverts**, atomiques | Refuse un nouvel engagement dépassant un plafond configuré avant envoi | Garantie sur le modèle de valorisation et les passages contrôlés, pas une facture bancaire exacte. Retenu. |
| Sous-plafonds globaux/par fournisseur, mois et pertes jour/mois | Réduit l’exposition à un incident et la concentration sur un service | Ne doivent pas devenir un petit quota quotidien par testeur. Les plafonds se chevauchent, ils ne s’additionnent pas pour offrir plus de crédit. Retenus configurables. |
| Circuit partagé | Réduit vite les nouveaux appels vers un service qui échoue ; évite la rafale de reprise | N’arrête pas ceux déjà envoyés et ne remplace pas un plafond financier. Retenu avec une reprise bornée. |
| Solde prépayé / recharge | Finance les appels ; peut protéger l’accès quand le gratuit finit | Le solde, un crédit gratuit et une valeur d’usage ne sont pas le même compteur. Une recharge automatique accroît l’argent exposé. Configuration 557/558. |
| Alerte fournisseur | Signale un seuil de dépense | Ne bloque pas par définition. À combiner, pas à compter comme un plafond dur. |
| Plafond natif fournisseur / kill switch | Barrière extérieure, utile même si un client échappe au garde | Portée, délais, in-flight, abonnements et taxes peuvent différer. Vérifications de compte, pas garantie inventée. |

### 7.2 Source unique et équation d’admission

Proposition d’étendre `beta_budget` et ses transactions, avec des items d’agrégation opérateur globaux/par fournisseur et des états de circuit. Les tentatives restent la vérité financière ; les agrégats sont mis à jour **dans la transaction de réserve/claim/clôture**, avec les mêmes identités et versions. Pas d’agrégat financier piloté seulement par des événements CloudWatch éventuellement perdus, ni de scan du rapport TASK-552 utilisé pour autoriser une dépense.

Pour une période et une portée :

`exposition = coût_fournisseur_livré + coût_fournisseur_sans_résultat + borne_des_engagements_ouverts`.

Nouveau départ permis seulement si `exposition + nouvelle_borne ≤ plafond`, dans **toutes** les portées applicables, et circuit autorisé. La valeur de réutilisation sans appel est exclue. Un remboursement testeur ne diminue pas les deux premiers termes. Une dépense hors enveloppe, par exemple une recherche, passe par une tentative opérateur du même registre, sans débiter le compte utilisateur.

- Un échec prouvé avant envoi libère son engagement à zéro. Une réponse refusée non facturée aussi, selon le contrat fournisseur connu.
- Timeout, crash ou métrique absente : imputer prudemment la borne, signaler `unknown/bound`, jamais zéro. Les coûts mesurés tardifs remplacent cette imputation par un delta idempotent. Un dépassement réel est enregistré comme tel, puis suspend les nouvelles dépenses si nécessaire.
- Le plafond d’échec doit intégrer aussi **l’exposition des tentatives en vol susceptibles d’échouer**. Sinon vingt appels déjà ouverts peuvent tous devenir des pertes après un seuil atteint. Le prix de cette borne est qu’elle peut limiter la concurrence tant que les résultats ne sont pas connus ; le paramètre doit être compatible avec les gros éléments autorisés.
- Un compteur global est un agrégat non nominatif ; ne pas y copier des identités de connexion ou du contenu. L’effacement du compte ne doit pas rendre à l’opérateur une dépense réellement payée. La réconciliation s’appuie sur des faits financiers minimaux, avec politique de rétention explicitement documentée par 566.
- Configuration monétaire versionnée : devise, taux, unité réellement facturée, source du prix, borne et qualité. La période de contrôle UTC et la période de facture du fournisseur sont reliées par le reporting ; on ne les confond pas.

**Lacune importante : unité de parsing du repli.** Le garde audité valorise Unstructured avec le même nombre de pages/feuilles que la mesure amont. La documentation PAYG actuelle compte PDF/PPTX/TIFF par page/slide/image, DOCX selon métadonnées si présentes, et les autres fichiers par **taille /100 KB**. [Facturation Unstructured](https://docs.unstructured.io/pipelines/account/billing). Un JPEG ou XLSX ne constitue donc pas nécessairement une seule page/feuille facturable. La surface utilisée étant legacy, confirmer le contrat exact ; employer la plus grande borne applicable ou refuser le repli si aucune borne justifiable n’est disponible. Les suppléments Unstructured du §3 sont une comparaison à unité égale, **pas une garantie de facture**. Ce point appartient à la qualité des engagements de TASK-566, sans changer de fournisseur dans cette étude.

Le barème de l’application est déjà prudent pour certaines dimensions, mais le coût réel peut dépasser une estimation : langues, modes de parsing, unités, coûts accessoires d’Actor, métriques différées ou tarif modifié. Refuser une nouvelle dépense si sa borne/tarif obligatoire est inconnu ; continuer de servir ce qui existe. Ne pas transformer un prix manquant en zéro ni forcer un autre service sans nouvelle admission.

### 7.3 États du circuit et reprise

`closed → open(until, reason, epoch) → half_open(single_probe) → closed|open` est le schéma classique ; l’application doit en rendre l’état partagé. [Description du circuit breaker](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker). **Notre politique proposée**, à ajuster sur les premiers événements :

- incident technique : ouverture après 5 échecs transitoires consécutifs, ou ≥50 % d’échecs sur une fenêtre de 5 min avec au moins 20 tentatives ; délais 30 s, 60 s, puis doublement jusqu’à 15 min, au moins le Retry-After reçu ;
- saturation de débit : réduire/admettre plus tard selon le reset et Retry-After, pas consommer le budget de pertes comme si une réponse utilisable avait été facturée ;
- clé invalide, crédits/plafond fournisseur ou désactivation manuelle : suspension ciblée nécessitant une action, pas de sondes payantes répétées qui ne peuvent rien résoudre ;
- reprise : une **vraie demande** déjà en attente sert de sonde, entièrement admise et financièrement réservée. Aucun trafic synthétique payant. Un seul droit partagé ; trois succès consécutifs puis montée progressive, retour open au nouvel échec. Le financement et les opérations restent contrôlés pendant half_open ;
- le compteur inclut nouvelles intentions, relances manuelles et reprises internes, et conserve son état au redémarrage d’une Lambda. Une faute de contenu d’un seul import n’ouvre pas arbitrairement tout le fournisseur ; elle reste attribuée à l’opération.

Un circuit n’empêche pas cinq échecs simultanés de devenir dix avant son observation. Le plafond d’engagement traite ce reliquat. Un `sending` déjà autorisé reste exposé même si l’epoch est suspendu juste après le dernier check ; aucun verrou ne rend l’envoi réseau et la base atomiques. Réduire cette fenêtre, mesurer les appels en vol et ne pas promettre une annulation rétroactive.

### 7.4 Limites et financement par fournisseur

| Fournisseur | Barrière extérieure à vérifier, et reste à charge |
|---|---|
| OpenAI | La documentation actuelle distingue alerte et **hard spend limit** organisation/projet, avec 429 de dépense ; confirmer leur disponibilité et la bonne portée. Un seuil de recharge ne vaut pas un plafond de facture. Ne pas répéter un refus de financement comme un 429 de cadence. [Limites et contrôles](https://developers.openai.com/api/docs/guides/rate-limits) |
| Deepgram | Crédit/plan et réglages courants restent à confirmer ; aucun plafond dur de dépense vérifié ici. Concurrence contrôlée et engagement application sont indispensables même si un crédit gratuit finance les appels. Ne pas recopier comme fait courant une ancienne valeur d’auto-reload. [Tarification](https://deepgram.com/pricing) |
| LlamaParse | La limite optionnelle des plans payants plafonne **l’excédent**, pas l’abonnement ni les crédits inclus ; les jobs déjà partis finissent et peuvent faire dépasser ce montant. Free refuse les nouveaux jobs facturables à épuisement. [Facturation](https://developers.llamaindex.ai/llamaparse/general/billing/) |
| Unstructured | La page renvoie le prix courant à Billing ; aucun plafond de dépense suffisamment établi pour le contrat legacy dans cette recherche. Contrôle applicatif requis, tarif/unité à confirmer ; ne pas annoncer un solde de crédits provisionné s’il s’agit d’une carte PAYG. |
| Apify | Les limites de plateforme ne sont pas exactes : le fournisseur annonce jusqu’à **10 %** d’écart. Timeout, mémoire, nombre de résultats et coûts de plateforme doivent entrer dans la borne du run ; un cap de charge propre au run est à employer s’il est applicable au modèle de prix de l’Actor retenu, sans le confondre avec le nombre de résultats. [Limites financières](https://help.apify.com/en/articles/11079614-reaching-platform-limits) |
| API X | Prépayé et limite de dépense par cycle, qui bloque les nouvelles requêtes. Confirmer période et portée ; les ressources lues, pas seulement les requêtes, déterminent le coût. Auto-recharge et plafond sont deux paramètres distincts. [Prix/crédits](https://docs.x.com/x-api/getting-started/pricing) |
| Algolia | Tarification recherche et records selon plan ; un prix « par requête » doit compter les vraies requêtes, pagination et suggestions. Les opérations d’indexation ont leurs propres limites contractuelles ; les records/chunks durables exigent un contrôle d’inventaire, pas un remboursement fictif d’anciens mois quand on supprime un objet. [Comptage d’indexation](https://support.algolia.com/hc/en-us/articles/18138875086865-How-does-Algolia-count-indexing-operations) |

TASK-557 reste **pending** : ses conclusions sur plans/recharges ne valent pas décision. Ce benchmark ne supprime donc pas `provider_pools`, n’unifie pas les comptes Apify et n’achète ni Starter ni un palier LLM. Les alias de capacité peuvent représenter les comptes actuels ou un compte unifié ultérieurement ; la configuration 558 indique le partage réel. Le garde opérateur ne recrée pas une règle « stopper à 90 % du gratuit » : sa limite est une exposition monétaire autorisée, indépendante du financement promotionnel. Tant que l’ancien pool existe, sa coupure est une limite résiduelle visible, pas un comportement imputé au nouvel ordonnanceur.

**Garantie résiduelle honnête.** L’application peut borner les nouvelles **autorisations valorisées** si tous les chemins sont couverts et les bornes fiables. Elle ne garantit pas un débit bancaire exact : prix externes, taxes, FX bancaire, abonnements, dépenses de console/autres apps, jobs déjà envoyés et mesures différées restent hors de cette preuve. Les appels en cours sont réglés ; les réutilisations sans appel et les gratuités sont distinguées de l’argent prélevé. Un plafond d’alerte AWS séparé suit l’infrastructure ; on ne l’annonce pas comme une coupure immédiate de la facture de contenu.

## 8. Paramètres de départ, événements et conduite d’exploitation

### 8.1 Paramètres proposés à valider ensemble

| Paramètre | Proposition / condition |
|---|---|
| OpenAI RPM/TPM | Valeur du compte et de chaque portée à confirmer ; **Launch retenu** (Luna 10 000 RPM / 10 M TPM, lus dans la console le 2026-10-29 en vue du palier ; à relire une fois le compte passé à Launch) ; marge initiale 20 %, soit une cible de 8 M TPM. Le plafond configuré ne suit pas seul le palier du compte (§4.1) : le relever à la main si l’en-tête annonce davantage. Build reste une simulation de comparaison. Aucun `LLM_TPM_LIMIT` n’est ajouté par ce benchmark ; 564 le ferait uniquement après validation remplaçant la décision 459. |
| Q LLM | Octets réellement sérialisés + sortie maximale applicable comme hypothèse prudente initiale ; corréler headers et tokens réellement facturés, sans déduire le cache de façon supposée. Ne pas baisser 32 000 ou plafonner la traduction pour réduire l’attente. |
| Jobs Deepgram | Plafond global compatible avec le projet confirmé ; les 10 workers actuels peuvent rester la borne plus petite. Aucune augmentation automatique à la valeur publique 50. |
| Jobs LlamaParse | 5 tant que Free/Starter est le plan confirmé ; remplacer après constat de compte. Partager entre document et carrousel, pas 5 chacun. |
| Jobs Unstructured | 1 provisoire, quota et unité du contrat legacy à confirmer ; aucun quota Transform transplanté. |
| Runs Apify | Compte Free : 5 runs et mémoire totale dans sa limite ; si unification Starter validée par 558, 32 est une valeur publique à vérifier, pas une multiplication implicite par plateforme. |
| PodcastIndex / TikTok direct | Respectivement 1 RPS ; 3 s entre extractions et 100/h, **politiques d’application**, rendues réellement partagées. |
| Équité | 80/20 interaction/fond, emprunt, déficit de travail et vieillissement ; 1 chat actif/compte ; 2 stages de fond actifs/compte ; 1 job coûteux par fournisseur/compte. Quantum et burst au moins compatibles avec un plus gros job admis. |
| Files | 32 intentions acceptées par compte, 2 000 globalement ; lots paginés ; fond 24 h au maximum, chat 10 s avant texte ; bornes distinctes des délais de préparation existants. |
| Permis / holds | Permis court 30 s avant claim ; attente initiale sans hold durable ; parties non envoyées post-acquisition ≤10 min avant report/réadmission explicite (§6.2 à valider). |
| Plafonds opérateur | Montant global mensuel `C_m` et limites par fournisseur choisis **par l’owner**, d’après financement, service promis et exposition acceptable. L’étude ne configure pas un prélèvement ni un plafond fictif de compte. Sans montant obligatoire valide lors de l’activation, garde en pause pour nouvelles dépenses. |
| Pertes | Proposition initiale : réserve de pertes journalière `min(5 EUR, 1 % de C_m)` et mensuelle `min(50 EUR, 10 % de C_m)`, **à l’intérieur de C_m**, engagements en vol inclus. Montants à valider, pas une limite utilisateur. Vérifier que le plus gros engagement reste possible, ou réduire la concurrence explicitement. |
| Circuit | Seuils et reprise §7.3 ; les pauses financières nécessitent financement/levée explicite et ne s’auto-effacent pas à chaque redémarrage. |

Exemple **illustratif, non activé** : `C_m=1 000 EUR`, pertes 5 EUR/j et 50 EUR/mois. Le scénario nominal 1 000 DAU consomme environ 590,60 EUR/mois de contenu et 156,42 EUR/mois de recherches Grow, soit ~747 EUR avant records, replis, pertes, abonnements et AWS. Une enveloppe de 1 000 EUR laisse alors ~253 EUR pour ces postes, et non « 5 EUR garantis pour chacun des 1 000 comptes ». Si tous consomment leur enveloppe maximale, le besoin est beaucoup plus élevé ; l’owner doit augmenter le financement ou accepter une suspension de service distincte du budget individuel. Les trois tâches n’ont pas à choisir cette promesse commerciale à sa place.

### 8.2 Événements à fournir au suivi TASK-552

Réutiliser structured logging et le rapport existant. Émettre `capacity.admitted|deferred|refused`, `fairness.queued|dispatched|expired|cancelled`, `operator.suspended|probe_claimed|resumed`, `operator.bound_missing|cost_adjusted`, avec : alias de portée, unité, estimation/mesure, raison typée, classe, âge de file, ids privés d’intention/stage/tentative et révision, instant/not_before, qualité du coût et durée occupée. Les métriques agrégées utilisent des dimensions bornées ; aucun user_id en dimension CloudWatch ni prompt/token/URL dans un événement exportable.

Le rapport 552 doit pouvoir ajouter : demande différée versus refusée, temps d’attente p50/p95/max, comptes actifs servis, durée/part occupée, requêtes hors enveloppe, perte/engagement mesuré ou borné, motifs de pause, tentatives internes versus relances explicites. Les états d’agrégation monétaire ne sont pas un deuxième rapport. Les observations non financières peuvent être best-effort avec alarme ; les conditions financières et droits d’envoi ne le sont pas.

Alarmes opératoires proposées : contrôle illisible, hold/slot sans progrès, outbox en retard, plus vieux travail proche de sa deadline, débit 429 persistant hors incident, queue_full durable, circuit ouvert, plafond proche/atteint, coût réel supérieur à la borne, dépenses sans métrique. La durée d’alarme ne sert pas de délai de libération. Un signal d’échec est attendu pour les sources invalides individuelles ; seule la taxonomie pertinente contribue au circuit fournisseur partagé.

### 8.3 Checklist owner, sans gate de livraison du benchmark

1. Relever dans les consoles le plan, la région, les portées partagées et limites effectives ; écrire seulement des valeurs techniques non sensibles dans la configuration. Ne pas publier identité de compte, tokens, soldes détaillés ou handles de support.
2. Valider la recommandation, la durée des holds, `C_m`, ses sous-limites, l’exposition de pertes et les textes d’attente ; consigner le choix dans **Owner Validation** et `owner_decision: ok` si accepté.
3. Traiter séparément la décision pending TASK-557 : plans, recharges, moyens de paiement et retrait des pools appartiennent à 558. Cette étude ne vaut pas accord pour financer ou migrer un compte.
4. Après fusion/push des implémentations, appliquer leur infrastructure et leur configuration. Observer headers, files, callbacks, permis et coûts lors de l’usage dev normal ; aucun appel payant synthétique ou suite automatisée n’est imposé ici.
5. En incident : lire motif/portée et engagements en vol ; suspendre seulement les nouveaux départs concernés ; laisser finir/régler les appels partis, préserver bibliothèque/texte déjà disponibles. Pour la recherche suspendue, afficher son indisponibilité sans bloquer navigation/lecture.
6. Avant reprise : vérifier financement et cause, réconcilier les jobs incertains, lever la pause financière si voulu ; une sonde réelle unique puis rampe. Ne pas purger un permis incertain pour « débloquer la file » sans examiner le run distant.
7. Relever le devis Paris du socle et la facture réelle par unité, notamment Unstructured legacy et Apify. Un plafond natif non disponible reste documenté comme tel ; ne pas substituer une alerte et annoncer la même garantie.

## 9. Livraison, couverture et incertitudes conservées

| Critère TASK-563 | Élément vérifiable du livrable |
|---|---|
| Inventaire, contrôles et lacunes, sources/compte/hypothèses séparés | §1–2 ; audit de code daté, aucune lecture de secrets ou console |
| Comparaison régulation/équité/finance, coûts/latences/garanties | §4–5 et §7 ; neuf familles de solutions comparées |
| 300/500/1 000 DAU, pics/lots/longs contenus/chat/incidents/sensibilités | §3 et `scenarios.csv`, équations et hypothèses explicites |
| Recommandation unique, frontières et cycle avec reprises/crashs | Recommendation, §6 ; remplacement proposé de la suffisance M1 clairement soumis à validation |
| Articulation 548/549/562/552/557/558, garanties et hors enveloppe | §1, §6–8 ; registre unique, mêmes 5 EUR/remboursements, exception preview, aucune suppression de pool anticipée |
| README, validation owner pending, recherche seule | Front-matter et Owner Validation ; seuls le livrable et les notes de tâche sont modifiés |

Incertitudes qui restent délibérément ouvertes : limites et moyens de financement actuels des comptes ; prix/unité du contrat Unstructured réellement facturé ; alias LlamaParse v1 et coût accessoire des Actors ; taux de cache, durées et distribution des vrais usages ; frais d’infrastructure/records et cycles de facture. Elles n’empêchent pas de livrer cette comparaison et ne deviennent pas des AC exigeant un accès de console. Les valeurs d’amorçage sont des propositions, pas des limites déployées ni des résultats de tests.

Toutes les sources Internet citées dans les tableaux ont été consultées le **2026-10-28** ; leur date de consultation n’est pas présentée comme date de publication. Les documentations sont parfois contradictoires ou ont changé de surface : ces écarts sont signalés, notamment Deepgram 50/100, Unstructured Partition legacy et la facturation par taille. Les README historiques 459 et 557 sont des décisions/recherches locales datées, pas des preuves intemporelles de quotas de compte.
