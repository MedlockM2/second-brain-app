---
owner_decision: ok   # pending | ok | abandoned | redo | more
---

# Benchmark : contrôle du débit de tokens par minute partagé entre le chat et les artefacts

## Owner Validation

**Decision**: Recommandation M2 (fenêtres partagées en DynamoDB) **non retenue** pour la bêta. Retenu à la place : **M1, la concurrence existante plus le 429 réactif**, au palier actuel du compte (Build).

1. **Palier actuel, pas d'achat anticipé.** Le compte reste au palier Build (2 000 000 TPM). Il passera à Launch (10 000 000 TPM, 100 $ d'achats cumulés, §2.1) au fil des recharges, à mesure que l'app gagnera des utilisateurs. À l'échelle de la bêta, le §3 juge un dépassement improbable. Le pire scénario du §3 (152 % au palier Build) suppose 20 appels simultanés sur des dossiers au plafond, ce qu'une douzaine de testeurs ne produit pas. Si un pic arrive quand même, M1 le transforme en attente ou en échec remboursé, pas en perte de données. La croissance qui ferait monter la charge fait aussi monter le palier : au palier Launch, le même pire scénario pèse environ 30 % du TPM.
2. **Plafond de sortie inchangé** : `LLM_MAX_COMPLETION_TOKENS = 32 000`, commun à tous les appels (décision task-439). Le guide de raisonnement d'OpenAI demande au moins 25 000 tokens pour le raisonnement et la sortie, donc aucun plafond par type d'appel.
3. **Aucun compteur partagé** : pas de table, pas de réservation avant l'appel, pas de `LLM_TPM_LIMIT`, pas de classes de priorité. Ce choix écarte, pour la bêta, le point 8 du Decision de task-430 (« des files séparées et un plafond de concurrence ne suffisent pas »). Le volume de la bêta le rend acceptable, et le palier monte avec l'usage.
4. **Ce qui reste à faire (task-466)** : appliquer M1 selon la pratique standard. Le worker de chat attend au moins `Retry-After`, avec une petite gigue, sur ses réessais courts avant émission de texte. Au-delà d'une attente compatible avec un tour interactif, le tour est scellé en échec `rate_limit` et remboursé, au lieu de réessayer trop tôt (un appel refusé compte aussi dans la limite, §2.2). Le worker d'artefacts garde la redélivrance SQS, dont le délai dépasse déjà tout `Retry-After` de cadence. Une alarme sur les 429 `rate_limit` signale le moment où ce choix ne suffit plus.
5. **À rouvrir si** l'alarme des 429 se déclenche hors incident, si le plafond de corpus monte, ou à l'ouverture au public si le compte est encore au palier Build. M2 (avec un seau à jetons plutôt que des fenêtres fixes) et M5 restent alors les options documentées ici.

**Validated at**: 2026-10-11

---

## Recommendation

**Une réservation de tokens dans des fenêtres partagées de 10 secondes, en DynamoDB, faite
juste avant chaque appel à `gpt-6-luna`, avec deux classes de priorité.** Le chat peut remplir
une fenêtre entière ; les appels de fond (artefacts, aperçus `review_blurb`, retraduction
d'artefact) s'arrêtent à 60 % de la fenêtre. Le 429 avec `Retry-After` reste le filet de
sécurité, et l'en-tête `x-ratelimit-limit-tokens` de chaque réponse sert à détecter un écart
entre la limite configurée et la limite réelle.

Le mécanisme :

1. **Ce qu'on réserve** : l'estimation que le fournisseur retient à l'arrivée de la requête,
   prise dans sa version prudente : `octets UTF-8 du prompt / 3,4 + max_completion_tokens`
   (32 000). La part du cache n'est pas déduite (§2.3).
2. **Où** : un compteur par fenêtre de 10 s (`used`, avec TTL), incrémenté par un seul
   `UpdateItem` conditionnel atomique : `ADD used :n` si `used + :n <= :plafond_de_la_classe`.
   Pas de lecture préalable, pas de transaction.
3. **Combien** : le plafond d'une fenêtre est `TPM × 0,9 / 7`. Une fenêtre glissante de
   60 s chevauche au plus 7 fenêtres de 10 s ; le facteur 7 garantit donc qu'aucune minute
   glissante ne dépasse 90 % du TPM, quelle que soit la façon dont OpenAI la mesure. Au palier
   Build (2 000 000 TPM) : 257 142 tokens par fenêtre, soit ~1,54 million par minute
   utilisables au maximum. Le premier tour de chat le plus lourd (§3) en réserve 152 460.
4. **Au refus** :
   - chat : le worker attend la fenêtre suivante (≤ 10 s) et réessaie, deux fois au plus ;
     au-delà, le tour est scellé `failed` avec un code explicite (`provider_busy`). Rien n'a
     encore été émis, c'est une tentative « courte et bornée » au sens du Decision point 2 ;
   - artefacts, aperçus, retraduction : le message est renvoyé dans sa file avec un délai
     (fin de la fenêtre + gigue, 10 à 30 s) et l'original est acquitté. Cette redélivrance
     ne consomme pas le `maxReceiveCount` du message, contrairement à une exception.
5. **La limite** : un paramètre explicite `LLM_TPM_LIMIT` (2 000 000, le palier Build relevé
   par l'owner le 2026-10-10). Chaque réponse d'OpenAI porte `x-ratelimit-limit-tokens` ;
   le worker émet une métrique quand la valeur lue est inférieure au paramètre (réduction
   temporaire ou changement de palier), avec une alarme.

Pourquoi cette option : c'est la seule des options étudiées qui **borne vraiment** le débit
(les autres réagissent après coup ou ne bornent que la concurrence), qui **donne la priorité au
chat** sans réserver de capacité morte, et qui reste à **coût fixe nul** (table à la demande,
items à TTL). Elle ajoute **un aller-retour DynamoDB** (quelques millisecondes) avant l'appel
LLM, négligeable devant le temps au premier token d'un modèle de raisonnement.

**Complément optionnel, sans code** : les limites par projet de la console OpenAI (§4.5).
Mettre les appels de fond dans un projet plafonné, par exemple à 60 % du TPM de
l'organisation, donne au fournisseur lui-même une barrière qui tient même si le compteur était
contourné. C'est un réglage de l'owner hors dépôt ; à ne faire que si l'owner veut cette
deuxième barrière.

**Réserves.** (1) Aucun appel LLM n'a été fait (garde-fou de la tâche) : la question de savoir
si OpenAI retient la totalité de `max_completion_tokens` à l'arrivée reste ouverte, et la
recommandation prend l'hypothèse prudente. Deux appels de quelques tokens, si l'owner les
autorise, la trancheraient en lisant `x-ratelimit-remaining-tokens` (§2.2). (2) L'algorithme
exact de réapprovisionnement du TPM chez OpenAI n'est pas documenté ; le facteur 7 a été choisi
pour ne pas en dépendre.

Ce que la recommandation touche : §7.

---

## 1. Point de départ

- **Decision de task-430**, point 8 (2026-10-10) : « Contrôler aussi la consommation de tokens
  par fenêtre de temps à l'échelle des appels au fournisseur partagés avec les artefacts : des
  files séparées et un plafond de concurrence ne suffisent pas, à eux seuls, à respecter les
  limites de débit en tokens. » Point 2 : une file et un worker de chat **séparés** de ceux des
  artefacts, avec leur propre concurrence ; des tentatives courtes et bornées avant émission de
  texte sont permises.
- **Un seul modèle depuis task-439** : `LLM_MODEL = gpt-6-luna`, `reasoning_effort = medium`,
  `max_completion_tokens = 32 000`, communs au chat, aux cinq types d'artefacts, au
  `review_blurb` et à la retraduction d'un artefact
  (`media_summarizer/core/services/llm_config.py`).
- **Hors du budget Luna** : la traduction du transcript brut (task-189) appelle
  `TRANSLATION_LLM_MODEL = gpt-5-nano-2025-08-07`
  (`media_summarizer/core/services/transcript_translation.py:85`). Les limites varient par
  modèle, sauf familles à « shared limit » listées sur la page des limites de l'organisation
  ([guide des limites](https://developers.openai.com/api/docs/guides/rate-limits)). Cet appel
  n'entre donc pas dans le compteur, sauf si la console de l'owner montre une limite partagée
  entre les deux modèles.
- **Plafonds de corpus en vigueur** : `MAX_FOLDER_SOURCES = 25`, `MAX_FOLDER_CORPUS_TOKENS =
  120 000`, mesure en octets UTF-8 avec `BYTES_PER_TOKEN = 3,4` (±10 %)
  (`media_summarizer/core/services/artifact_service.py:119-122`). Le Decision maintient ce
  plafond (la sélection de Luna ne vaut pas son relèvement).
- **Concurrence déployée** : mapping SQS du worker d'artefacts à `batch_size = 1`,
  `maximum_concurrency = 10` (`infrastructure/terraform/modules/platform/lambda_workers.tf:185`).
  Celle du worker de chat sera fixée par task-463.
- **Traitement actuel du 429** : `classify_llm_failure` lit le 429 avec `Retry-After` ou un
  marqueur de cadence comme `TRANSIENT + rate_limit` (le message est redélivré), un 429 nu comme
  `PERMANENT + quota` (`media_summarizer/utils/llm_failure.py:247-251`). L'appel passe par
  `aiohttp` directement, sans le SDK OpenAI ni ses réessais intégrés
  (`media_summarizer/workers/artifact_generator/worker.py:127-200`).

## 2. Les limites du fournisseur

Toutes les sources ci-dessous ont été consultées le 2026-10-11.

### 2.1 `gpt-6-luna` par palier

Source : [page du modèle](https://developers.openai.com/api/docs/models/gpt-6-luna).

| Palier | RPM | TPM | File Batch |
|---|---:|---:|---:|
| Build | 5 000 | 2 000 000 | 20 000 000 |
| Launch | 10 000 | 10 000 000 | 1 000 000 000 |
| Grow | 30 000 | 180 000 000 | 15 000 000 000 |

Fenêtre de contexte 1 050 000 tokens, entrée maximale 922 000, sortie maximale 128 000. Tarifs
Standard par million : entrée 0,10 $, entrée en cache 0,01 $, écriture de cache 0,125 $, sortie
0,50 $. La page ne liste pas de ligne « Free ».

Paliers et passage automatique ([guide des limites](https://developers.openai.com/api/docs/guides/rate-limits)) :
Build à 5 $ d'achats cumulés (500 $/mois d'usage), Launch à 100 $ (5 000 $/mois), Grow à 500 $
(200 000 $/mois). **Le compte est au palier Build** (relevé par l'owner dans sa console le
2026-10-10, repris de la description de la tâche).

### 2.2 Ce qui est compté, et quand

- « *Your rate limit is calculated as the maximum of `max_tokens` and the estimated number of
  tokens* » d'après le nombre de caractères de la requête
  ([guide des limites](https://developers.openai.com/api/docs/guides/rate-limits)). Le guide ne
  parle que de `max_tokens` ; il ne nomme pas `max_completion_tokens`.
- L'article d'aide sur le 429 nomme `max_completion_tokens` pour Chat Completions et met en
  garde contre « *setting a much larger allowance than the request needs* », ces plafonds
  comptant aussi les tokens de raisonnement
  ([aide OpenAI](https://help.openai.com/en/articles/5955604-how-can-i-solve-429-too-many-requests-errors)).
- « *Unsuccessful requests contribute to per-minute limits* » (même article) : un appel refusé
  par 429 consomme aussi de la limite. Renvoyer en boucle aggrave la saturation.
- Chez Azure OpenAI, le comportement est **documenté** : à l'arrivée, l'estimation inclut le
  texte du prompt **et** `max_tokens` ; elle s'ajoute à un compteur remis à zéro chaque minute,
  et le débit des requêtes est évalué sur des tranches de 1 à 10 secondes
  ([Microsoft Learn, quota Azure OpenAI](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/quota)).
  Rien ne dit qu'OpenAI fait de même.
- **Lecture retenue** : la phrase d'OpenAI se lit littéralement « max(max_tokens, estimation) »,
  mais elle ne dit pas si l'estimation inclut déjà la sortie. L'hypothèse prudente, alignée sur
  le comportement documenté d'Azure, est **entrée estimée + `max_completion_tokens`**. Si la
  lecture littérale est la bonne, la réservation est trop haute de 32 000 tokens par appel :
  les marges sont meilleures, jamais pires.
- **Comment trancher** (avec l'accord de l'owner, hors de ce benchmark) : deux appels de
  quelques tokens, l'un à `max_completion_tokens = 16`, l'autre à `32 000`, en lisant
  `x-ratelimit-remaining-tokens` sur chaque réponse. Coût : quelques centièmes de centime.

### 2.3 Le cache ne réduit pas le TPM

« *Cached input tokens still count toward tokens-per-minute limits* » et « *Prompt caching does
not change how [rate limits] are calculated* »
([guide du cache de prompt](https://developers.openai.com/api/docs/guides/prompt-caching),
relevé par le complément C3.3 de task-430). Le deuxième tour d'une conversation, servi en
grande partie par le cache, pèse donc autant sur le TPM qu'un premier tour.

### 2.4 En-têtes et réessais

En-têtes de chaque réponse ([guide des limites](https://developers.openai.com/api/docs/guides/rate-limits)) :
`x-ratelimit-limit-requests/-tokens`, `x-ratelimit-remaining-requests/-tokens`,
`x-ratelimit-reset-requests/-tokens` (seul exemple : `6m0s`), et leurs variantes
`-project-tokens` quand une limite de projet s'applique. `Retry-After` donne « *the minimum
number of seconds to wait before retrying a temporary rate-limit error, when present* ».
Consigne : suivre `Retry-After` comme un minimum avec une petite gigue ; sinon backoff
exponentiel avec gigue, borné en tentatives et en durée. Pour `slow_down` et
`server_is_overloaded`, monter le trafic progressivement.

Le mode de réapprovisionnement (fenêtre fixe, glissante ou seau à jetons) **n'est pas
documenté** ; un fil du forum OpenAI note qu'aucune documentation n'explique comment écrire du
code à partir de ces valeurs
([forum OpenAI](https://community.openai.com/t/how-do-i-get-token-limit-per-minutes-and-when-it-will-reset/571736)).
C'est pourquoi la recommandation ne s'appuie pas sur `remaining`/`reset` pour décider.

## 3. La charge, confrontée au palier Build

Hypothèse prudente : réservation = entrée estimée + 32 000.

| Appel | Entrée estimée | Réservé | Part de 2 000 000 TPM |
|---|---:|---:|---:|
| Premier tour de chat, média (19 947 tokens d'entrée, chiffre de task-430 §9.4) | 19 947 | 51 947 | 2,6 % |
| **Premier tour de chat, dossier au plafond** (120 000 de corpus + ~460 d'instructions et de question) | 120 460 | **152 460** | **7,6 %** |
| Même appel, lecture littérale « max » | 120 460 | 120 460 | 6,0 % |
| Artefact sur un dossier au plafond | ~120 000 | ~152 000 | ~7,6 % |

Avec les concurrences prévues (10 pour les artefacts, et par exemple 10 pour le chat) :

| Scénario | Tokens réservés dans la même minute | Part du TPM |
|---|---:|---:|
| 10 premiers tours de chat sur des dossiers au plafond | 1 524 600 | 76 % |
| 10 artefacts de dossier au plafond **et** 10 premiers tours de chat de dossier | 3 049 200 | **152 % — dépasse** |
| 20 appels à portée média | 1 038 940 | 52 % |

Et la concurrence ne borne pas le débit, parce qu'un emplacement se libère vite. task-430 §5.2 a
mesuré un appel à 52 130 tokens d'entrée et 78 de sortie en **2,9 s** : un seul emplacement peut
enchaîner ~20 appels de ce type par minute. Pour **garantir** le TPM par la seule concurrence,
il faudrait `C × 152 460 × (60 / durée minimale d'un appel) ≤ 2 000 000` ; avec une durée
minimale de 3 s, cela donne C ≤ 0,66 : moins d'un appel simultané. C'est la démonstration
chiffrée du Decision point 8.

Au niveau de la bêta (une douzaine de testeurs), un dépassement réel est improbable ; le
dispositif sert à ce qu'un pic (un testeur qui lance les cinq artefacts d'un gros dossier pendant
que d'autres discutent) retarde les artefacts au lieu de faire échouer un tour de chat.

## 4. Mécanismes comparés

### 4.1 M1 — concurrence seule + 429 réactif (l'existant)

- **Exactitude** : aucune borne sur les tokens (§3). Le fournisseur fait le contrôle et le
  dépôt réagit.
- **Latence ajoutée au chat** : nulle tant qu'il n'y a pas de 429 ; ensuite au moins
  `Retry-After`, et la requête refusée a déjà consommé de la limite.
- **Priorité** : aucune. Un artefact et un tour de chat se disputent la même limite au hasard.
- **Coût fixe** : 0.
- **Verdict** : nécessaire comme filet, insuffisant seul ; le Decision l'écarte explicitement.

### 4.2 M2 — réservation dans des fenêtres partagées en DynamoDB (recommandée)

- **Exactitude** : borne le débit **selon l'estimation que le fournisseur retient à
  l'arrivée**, pas selon l'usage facturé. L'estimation du dépôt (octets / 3,4) est à ±10 % ; le
  facteur 0,9 du plafond l'absorbe. Les fenêtres de 10 s avec un plafond de TPM/7 garantissent
  le respect sur toute minute glissante, sans supposer l'algorithme d'OpenAI.
- **Ajustement après l'appel** : inutile pour le TPM. Ce que le fournisseur compte est fixé à
  l'arrivée (§2.2) ; rendre la part non consommée de `max_completion_tokens` sous-estimerait la
  charge vue par OpenAI. L'usage réel reste mesuré par `llm_usage` pour le coût.
- **Latence ajoutée au chat** : un `UpdateItem` conditionnel, quelques millisecondes dans la
  région. Sous contention, jusqu'à 10 s par fenêtre attendue (deux au plus).
- **Comportement au dépassement** : chat, attente puis échec explicite ; fond, renvoi différé
  dans la file (§Recommendation).
- **Priorité** : par plafond de classe sur le même compteur (fond ≤ 60 %, chat ≤ 100 %). Aucune
  capacité n'est réservée à vide : quand le chat est calme, le fond utilise 60 % de chaque
  fenêtre.
- **Objets AWS et coût fixe** : une petite table à la demande (ou un préfixe de clé dans une
  table existante non partitionnée par compte), TTL de quelques minutes sur les compteurs.
  Coût fixe 0 $ ; ~1 unité d'écriture par appel LLM, soit moins d'un centime par mois à ce
  volume.
- **Points d'attention** : un compteur unique par fenêtre est une clé chaude, mais DynamoDB
  tient 1 000 écritures par seconde par partition, très au-dessus de quelques appels LLM par
  seconde ; un appel plus gros qu'une fenêtre ne passerait jamais (152 460 < 257 142 au palier
  Build ; à surveiller si le plafond de corpus monte).

### 4.3 M3 — régulation par les en-têtes `x-ratelimit-remaining-tokens`

- **Principe** : chaque réponse publie le reste et le délai de réinitialisation ; on les stocke
  dans un état partagé et on retient les appels quand le reste est bas.
- **Exactitude** : faible sous concurrence. La valeur est un instantané pris à la réponse
  précédente, qui peut avoir plusieurs secondes ; vingt workers qui lisent le même reste
  partent ensemble. La sémantique de `reset` n'est pas documentée (§2.4).
- **Latence** : une lecture partagée avant chaque appel, comme M2, pour moins de garantie.
- **Priorité** : à construire par-dessus, comme M2.
- **Coût fixe** : 0.
- **Verdict** : utile pour **calibrer** (détecter que la limite réelle diffère du paramètre),
  pas pour **décider**. Retenu dans ce rôle par la recommandation.

### 4.4 M4 — concurrence et délais de redélivrance réglés au plus juste

- **Principe** : calculer `maximum_concurrency` des deux mappings pour que le pire cas tienne,
  et allonger les délais de redélivrance.
- **Exactitude** : impossible à garantir (§3 : C ≤ 0,66). Un réglage « raisonnable » (par
  exemple 5 + 5) borne les pics simultanés à ~760 000 tokens mais pas le débit par minute.
- **Priorité** : par la répartition des emplacements, figée ; capacité perdue quand une classe
  est calme.
- **Coût fixe** : 0.
- **Verdict** : complément utile (il borne les pics), pas un contrôle.

### 4.5 M5 — limites par projet dans la console OpenAI

- **Principe** : deux projets OpenAI, un pour le chat et un pour les appels de fond, chacun avec
  sa clé ; le propriétaire de l'organisation fixe une limite par modèle sur le projet de fond
  (« *Only the Owner of an organization can set and manage project level rate limits* » ;
  Organization settings → projet → Limits → Model Usage,
  [aide OpenAI](https://help.openai.com/articles/9186755)). Les limites de projet sont aussi
  lisibles et modifiables par l'Admin API
  (`GET/POST /organization/projects/{project_id}/rate_limits`,
  [référence API](https://developers.openai.com/api/reference/cli/resources/admin/subresources/organization/subresources/projects)) ;
  un article d'Elastic du 2026-07-02 décrit des plafonds par projet « *capped at or below your
  organization's overall ceiling* »
  ([Elastic](https://www.elastic.co/observability-labs/blog/openai-rate-limit-monitoring)).
- **Exactitude** : appliquée par le fournisseur lui-même. Mais elle ne fait que **plafonner le
  fond** : le chat garde la limite de l'organisation, partagée, et prend un 429 si les deux
  classes la dépassent ensemble.
- **Latence** : nulle. Au dépassement, un 429 (qui consomme de la limite).
- **Priorité** : réelle mais grossière (capacité réservée au chat même quand il est calme).
- **Objets** : un second projet et une seconde clé dans le secret d'exécution ; réglage hors
  dépôt, donc invisible au code et sujet à dérive.
- **Coût fixe** : 0.
- **Verdict** : bon filet côté fournisseur, en complément de M2 si l'owner le souhaite ; pas un
  contrôle à lui seul.

### 4.6 Écartées

- **Seau à jetons en mémoire partagée (ElastiCache/Redis)** : exact et rapide, mais coût fixe
  horaire et passage des Lambdas en VPC ; le complément C1.8 de task-430 établit qu'à cette
  échelle seul le coût fixe compte.
- **Une passerelle LLM unique** (une Lambda qui sérialise tous les appels) : supprime la
  concurrence du chat, contraire au Decision point 2.
- **API Batch** pour les artefacts : limites séparées des limites synchrones (« *without
  impacting your synchronous request rate limits* »,
  [guide des limites](https://developers.openai.com/api/docs/guides/rate-limits)), mais
  latence de l'ordre des heures, incompatible avec un artefact demandé depuis l'app.

## 5. Synthèse

| Critère | M1 concurrence + 429 | **M2 fenêtres DynamoDB** | M3 en-têtes | M4 concurrence réglée | M5 projets OpenAI |
|---|---|---|---|---|---|
| Borne le TPM | Non | **Oui, sur l'estimation à l'arrivée** | Approximatif | Non | Fond seulement |
| Latence ajoutée au chat | 0, puis `Retry-After` | **ms ; ≤ 2 × 10 s sous contention** | ms | 0 | 0, puis 429 |
| Chat au dépassement | 429 → réessai | **Attente bornée puis échec explicite** | Attente | 429 | 429 |
| Fond au dépassement | Redélivrance (brûle `maxReceiveCount`) | **Renvoi différé, sans brûler** | Attente | Redélivrance | 429 → redélivrance |
| Priorité chat | Non | **Oui, sans capacité morte** | À construire | Figée | Figée |
| Objets AWS | — | Table ou préfixe à TTL | État partagé | — | — (console) |
| Coût fixe | 0 | **0** | 0 | 0 | 0 |

## 6. Ce que chaque option change dans le code

| Fichier | M2 (recommandée) | M1 / M4 | M3 | M5 |
|---|---|---|---|---|
| `core/services/llm_config.py` | `LLM_TPM_LIMIT`, part de fond (0,6), facteur de sûreté (0,9), fonction d'estimation `prompt_bytes / 3,4 + max_completion_tokens` | — | — | deux clés selon la classe |
| nouveau `utils/llm_rate_window.py` | `reserve(tokens, priority) -> bool`, `next_window_in()` | — | lecture / écriture de l'état | — |
| `workers/artifact_generator/worker.py` | réserver avant `_call_llm` ; au refus, renvoi différé du message et acquittement de l'original (libérer le bail de génération ou le laisser expirer) ; lire `x-ratelimit-limit-tokens` | 429 inchangé ; `maximum_concurrency` | lecture des en-têtes | choix de la clé |
| futur worker de chat (task-463) | réserver avant l'appel en flux ; deux attentes au plus ; `provider_busy` | — | idem | idem |
| `utils/llm_failure.py` | inchangé (le 429 `Retry-After` reste `TRANSIENT + rate_limit`) ; le refus de réservation **n'est pas** une erreur fournisseur, il ne passe pas par cette taxonomie | inchangé | inchangé | inchangé |
| Terraform | table (ou rien si préfixe), IAM `UpdateItem`, variable d'environnement, alarmes | `lambda_workers.tf` | état | secret |

## 7. Ce que la recommandation touche

- **Code** : `media_summarizer/core/services/llm_config.py` (limite, part de fond, estimation),
  un nouveau `media_summarizer/utils/llm_rate_window.py`,
  `media_summarizer/workers/artifact_generator/worker.py` (réservation, renvoi différé,
  lecture de l'en-tête), le worker de chat de task-463 (réservation, attente bornée, code
  `provider_busy`), `media_summarizer/core/services/review_blurb_service.py` et le chemin de
  retraduction s'ils appellent le LLM hors de `_call_llm`.
- **Terraform** :
  - une table `llm_rate_windows<suffixe>` à la demande, clé `window` (`<modèle>#<epoch // 10>`),
    TTL `expires_at` (fenêtre + 5 min), sans PITR (état jetable) ; ou un préfixe dans une table
    existante non partitionnée par compte si l'implémenteur en trouve une adaptée ;
  - `dynamodb:UpdateItem` pour les rôles des workers d'artefacts et de chat ;
  - `LLM_TPM_LIMIT` dans `runtime_env.tf` ;
  - alarmes dans `pipeline_alerts.tf` : `LlmRateReservationRefused` par classe (le fond
    retardé est normal en pic, le chat refusé ne l'est pas : seuil > 0 sur 5 min pour le chat),
    `LlmObservedTpmBelowConfigured` (> 0), et l'existante sur les 429.
- **Console OpenAI (optionnel, owner)** : un projet pour les appels de fond plafonné à ~60 % du
  TPM de l'organisation (§4.5).
- **Paramètres à confirmer** : part de fond (0,6), facteur de sûreté (0,9), nombre d'attentes du
  chat (2), délai de renvoi du fond (10 à 30 s), et l'hypothèse sur `max_completion_tokens`
  (§2.2).

## 8. Sources

Consultées le 2026-10-11 sauf mention.

- OpenAI, modèle `gpt-6-luna` — https://developers.openai.com/api/docs/models/gpt-6-luna
- OpenAI, *Rate limits* — https://developers.openai.com/api/docs/guides/rate-limits
- OpenAI, *Prompt caching* — https://developers.openai.com/api/docs/guides/prompt-caching (via task-430 C3.3, 2026-10-07)
- OpenAI Help, *How can I solve 429: Too Many Requests errors?* — https://help.openai.com/en/articles/5955604-how-can-i-solve-429-too-many-requests-errors
- OpenAI Help, limites par projet — https://help.openai.com/articles/9186755
- OpenAI API reference, projets et limites — https://developers.openai.com/api/reference/cli/resources/admin/subresources/organization/subresources/projects
- OpenAI Community, *How do I get token limit per minutes and when it will reset?* — https://community.openai.com/t/how-do-i-get-token-limit-per-minutes-and-when-it-will-reset/571736
- Microsoft Learn, *Manage Azure OpenAI quota* — https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/quota
- Elastic Observability Labs, *OpenAI rate limit monitoring* (2026-07-02) — https://www.elastic.co/observability-labs/blog/openai-rate-limit-monitoring
- Dépôt : `media_summarizer/core/services/llm_config.py`, `media_summarizer/core/services/artifact_service.py:119-122`,
  `media_summarizer/core/services/transcript_translation.py:85`, `media_summarizer/utils/llm_failure.py`,
  `media_summarizer/workers/artifact_generator/worker.py:127-200`,
  `infrastructure/terraform/modules/platform/lambda_workers.tf:185`,
  `docs/research/task-430-chatbot-architecture/{README,complement-response-2026-10-07}.md`.
