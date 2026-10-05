---
owner_decision: pending   # pending | ok | abandoned | redo | more
---

# Benchmark : question ponctuelle sous forme d'artefact, ou vrai chatbot conversationnel sur les transcripts

## Owner Validation

**Decision**: _(à remplir par l'owner après relecture — texte libre décrivant la décision finale : accept recommandation X, reject parce que Y, accept with modifications Z, OU, si redo, les consignes précises de correction à intégrer au prochain passage)_
**Validated at**: _(date ISO à remplir par l'owner)_

---

## Recommendation

**Voie A', le « fil de questions » : la voie A de l'owner comme machinerie, la voie B comme
sémantique.** Un nouveau type d'artefact `answer` dont le prompt est la question de
l'utilisateur, un champ `thread_id` dans `parameters`, et le worker qui réinjecte les tours
précédents du même fil devant la question nouvelle. Pas de table de conversations, pas de nouvel
endpoint, pas de streaming, pas de RAG, pas de fenêtre glissante.

**Pourquoi pas la voie A pure (une question, une réponse, pas de relance).** Les deux craintes
qui la motivent sont mesurées fausses :

- **Le coût de la réinjection d'historique est négligeable.** Au plafond task-269 (120 000
  tokens), 20 tours avec tout l'historique réinjecté coûtent **0,0728 €** avec le cache de prompt,
  contre **0,0212 €** pour une seule question froide (§ 2.3). L'historique après 20 tours pèse
  **8 740 tokens, soit 7,3 % du corpus** : ce n'est pas lui qui coûte, c'est le corpus (§ 3).
- **Interdire la relance ne fait presque rien économiser.** Un fil de questions *sans*
  réinjection d'historique (voie C) coûte **0,0702 €** sur 20 tours contre 0,0728 € pour la voie B
  complète : **3,6 % d'écart**. On paierait 3,6 % pour perdre « et sur ce point-là ? » (§ 2.3).

**Pourquoi pas la voie B pleine (un vrai chat façon ChatGPT).** Une seule raison, et elle n'est
pas le coût : **le streaming est impossible sur la porte d'entrée actuelle.** L'API est une HTTP
API API Gateway v2 ; `CreateIntegration` n'a **aucun** champ de transfert de réponse en flux et
son `timeoutInMillis` plafonne à **30 000 ms non augmentables**. Seules les REST API ont
`responseTransferMode = STREAM`, et le streaming côté Lambda n'est natif que sur les runtimes
Node.js managés — en Python il faut le Lambda Web Adapter ou un runtime custom (§ 7). Un chat non
streamé, c'est un spinner de 5 à 25 s par tour : exactement l'UX qui fait passer un chat pour
cassé. Alors qu'un artefact, l'app sait déjà l'afficher en `queued` puis `generating` puis `ready`.

**Ce que voie A' donne, et que ni A ni B ne donnent au même prix** : la conversation (relances
avec contexte) sur la machinerie d'artefact déjà écrite et déjà déployée — même queue, même bail,
même taxonomie d'échec, même historique append-only, même quota, même mutualisation, même
`POST /api/artifacts`, qui accepte déjà un dictionnaire `parameters` libre
(`api/endpoints/artifacts.py:73-74`) normalisé récursivement
(`artifact_service.py:317-337`). **Le champ `question` n'a besoin d'aucune plomberie nouvelle
pour entrer dans la clé de réutilisation.**

**Les chiffres retenus**

| Décision | Valeur |
|---|---|
| Coût unitaire d'une question sur un média d'1 h | **0,0034 €** froid, **0,0008 €** en cache (`gpt-5.4-nano`, `reasoning_effort: none`) |
| Coût unitaire d'une question au plafond dossier | **0,0212 €** froid, **0,0026 €** en cache |
| Coût d'un fil de 10 tours sur un média d'1 h | **0,0115 €** (cache), 0,0376 € (sans cache) |
| Longueur maximale d'une question | **1 000 caractères** (garde-fou anti-collage, pas anti-coût) |
| Tours par fil | **10**, puis le fil se clôt et un nouveau fil re-paie le corpus |
| Fils ouverts simultanément par scope | **3** |
| `reasoning_effort` du type `answer` | **`none`** — explicite, c'est ce qui tient la latence et le coût |
| Unité de quota, premier tour | **1 minute par 20 000 tokens de contexte** (`question_context_tokens_per_minute`) |
| Unité de quota, tour de relance | **1 minute forfaitaire**, sauf si plus de **5 min** se sont écoulées depuis le tour précédent — auquel cas le contexte est re-facturé, parce que le cache du fournisseur a expiré |
| Garde-fou invisible | `burst_guards.answer_turns_per_day = 120` |
| Refus visibles | aucun nouveau : `out_of_minutes` et `item_too_long` restent les deux seuls (`quota_enforcer.py:52-53`) |

**Ce que ça pèse sur un abonné Standard** : si **tout** son forfait partait en questions, un
abonné `mix` (5 €, 300 minutes, net 3,542 €) ferait **60 sessions de 5 tours** par mois pour un
coût fournisseur réel de **1,139 €, soit 32,2 % de son net** — et c'est le pire cas au régime de
raisonnement non borné, cache compris. Avec la grille proposée en pricing-challenge (Standard,
360 crédits), c'est **1,029 €, soit 29,1 % du net** (§ 5.3). Le forfait en minutes borne déjà la
dépense : **aucun compteur nouveau n'est nécessaire.**

**Le signal pour passer à la voie B pleine** (chat streamé, front door REST + Lambda Web Adapter) :
trois conditions, à lire dans les données que voie A' produit elle-même, pas dans une impression —
(1) la **médiane des tours par fil atteint 6** ou plus (le plafond de 10 devient le mode) ;
(2) le **p90 de latence d'un tour `answer` dépasse 12 s** (le spinner devient le sujet) ;
(3) des demandes explicites de **parler à travers plusieurs dossiers** apparaissent dans les
retours — ce qui est un autre benchmark, parce que « tout mon compte » vaut 368 503 tokens sur
`-dev`, soit **1,35× la fenêtre d'entrée** du modèle (task-269 § 1.2), donc du RAG.

---

## 0. Base de preuves

Tout ce qui est chiffré ici vient de l'une de ces quatre sources, et chaque section dit laquelle.

1. **Code lu** sur `main` à `bc7f600`, dans le worktree de cette tâche. Aucun fichier source n'a
   été modifié.
2. **Mesures en lecture seule sur `-dev`** (compte AWS `125313707865`, région `eu-west-3`), le
   **2026-10-05**. La table `media_artifacts-dev` porte **157 lignes**, dont **128 avec un bloc
   `llm_usage`** réellement renseigné. Commande utilisée :

       aws dynamodb scan --table-name media_artifacts-dev --region eu-west-3 --output json

   Aucun appel LLM n'a été émis pour ce benchmark.
3. **Arithmétique de coût** : `compute.py`, dans ce répertoire. Pur calcul, aucun réseau.
   `python3 compute.py` régénère **tous** les chiffres cités ici. Les hypothèses y sont en tête de
   fichier, nommées et sourcées.
4. **Recherche web datée du 2026-10-05**, listée en § Sources avec les URL.

### 0.1 Ce que les 128 générations de `-dev` disent déjà

| Mesure | Valeur |
|---|---|
| Générations avec `llm_usage` | **128** (dont 91 `review_blurb` internes, **37** types demandables) |
| Médiane des tokens d'entrée | **1 222** |
| Maximum d'entrée observé | **62 601** (un `flashcards` sur 2 sources) |
| Médiane des tokens de sortie | **90** (tous types), **1 338 à 2 678** sur les types demandables |
| Appels avec `cached_tokens > 0` | **8 / 128, soit 6,3 %** |
| Part des tokens de prompt effectivement cachés | **58 368 / 489 739 = 11,9 %** |
| Latence bout en bout médiane, types demandables | **13 à 21 s** selon le type |
| Latence bout en bout maximale observée | **123,6 s** (un `notes`, 7 499 tokens d'entrée) |
| Débit médian de sortie, types demandables | **≈ 111 tokens/s** (file SQS et S3 inclus) |

Latence par type, mesurée (de `created_at` à `completed_at`, donc **attente SQS, téléchargement
S3, appel LLM et écriture DynamoDB inclus** — c'est un majorant de la latence du modèle) :

| Type | n | entrée médiane | sortie médiane | médiane | p90 | max |
|---|---|---|---|---|---|---|
| `review_blurb` | 91 | 1 056 | 81 | 5,8 s | 7,4 s | 80,1 s |
| `flashcards` | 5 | 1 642 | 826 | 10,3 s | 27,3 s | 27,3 s |
| `quiz` | 12 | 2 798 | 1 338 | 13,0 s | 15,0 s | 32,1 s |
| `notes` | 8 | 2 728 | 2 045 | 14,8 s | 123,6 s | 123,6 s |
| `summary_short` | 10 | 2 016 | 2 678 | 19,4 s | 46,3 s | 46,3 s |
| `summary_detailed` | 2 | 4 156 | 2 408 | 20,9 s | 28,8 s | 28,8 s |

**Deux faits de ce tableau pilotent tout le reste du document.**

- **La latence suit la sortie, pas l'entrée.** Le plus gros prompt mesuré (**62 601 tokens**) a
  rendu sa réponse en **27,3 s**, tandis qu'un `notes` de 7 499 tokens d'entrée et 2 888 de sortie
  a mis **123,6 s**. Envoyer 120 000 tokens de corpus ne coûte donc pas une attente ; écrire
  beaucoup, oui. C'est ce qui rend `reasoning_effort: none` le premier levier de cette feature, et
  pas un détail d'optimisation.
- **`summary_short` dépense 2 678 tokens de sortie pour un résumé de ~300 tokens visibles.** C'est
  l'écart que task-316 § 2.13 avait relevé sans pouvoir l'expliquer, et `reasoning_effort`
  n'apparaît toujours **nulle part** dans le dépôt (`grep` sur `media_summarizer/` et
  `mobile/src` : zéro occurrence, confirmé sur `bc7f600`). C'est pourquoi tous les tableaux de
  coût ci-dessous sont donnés **dans deux régimes** : `none` (450 tokens de sortie, le défaut
  documenté de `gpt-5.4-nano`) et « défaut » (2 700 tokens, calé sur cette mesure).

---

## 1. Les voies comparées

L'owner en propose deux. La recherche en ajoute deux, parce qu'elles séparent des choix que A et
B mélangent : « est-ce qu'on réinjecte l'historique ? » et « est-ce qu'on construit une
conversation comme objet de première classe ? » sont deux questions indépendantes.

| Id | Voie | Réinjection de l'historique | Objet de stockage | Transport | Streaming |
|---|---|---|---|---|---|
| **A** | « artefact question » | non | une entrée `media_artifacts` par question | SQS + polling existant | non |
| **A'** | **« fil de questions »** (retenue) | **oui, les tours du même fil** | une entrée `media_artifacts` par tour, groupées par `thread_id` | SQS + polling existant | non |
| **C** | « fil sans mémoire » | non, mais les tours sont groupés visuellement | idem A' | idem | non |
| **B** | « chatbot » | oui | table `conversations` + `messages` | endpoint synchrone ou WebSocket | oui, souhaité |

A et C ne diffèrent que par l'affichage ; A' et C ne diffèrent que par trois lignes dans le
worker. B diffère de A' par **tout ce qui n'est pas le prompt** : un modèle de données, des
endpoints, un écran, et une porte d'entrée.

**Ce que la voie A pure fait perdre**, concrètement et sans emphase : la deuxième question doit
re-déclarer son contexte. « Qu'est-ce que l'invité dit du scaling ? » puis « et sur les données
synthétiques ? » — la seconde est inintelligible seule. L'utilisateur apprend à écrire des
questions auto-portantes, ou abandonne. C'est le comportement que les quatre concurrents examinés
en § 9 ont tous, sans exception, choisi d'éviter.

---

## 2. Coût LLM réel, chiffré

### 2.1 Les prix, datés

Relevés le **2026-10-05** sur https://developers.openai.com/api/docs/pricing et sur les pages
par modèle. Conversion à `USD_EUR = 0.86`, la même que task-65 et que
`media_summarizer/core/services/llm_pricing.py:20`, pour que les chiffres restent comparables à
ceux déjà au dépôt.

| Modèle | Entrée $/1M | Entrée cachée $/1M | Sortie $/1M | Fenêtre d'entrée | `reasoning_effort` par défaut | Source, consultée le 2026-10-05 |
|---|---|---|---|---|---|---|
| `gpt-5-nano` | **0,05** | **0,005** | **0,40** | 272 000 | non documenté sur la page | https://developers.openai.com/api/docs/models/gpt-5-nano |
| `gpt-5.4-nano` | **0,20** | **0,02** | **1,25** | 272 000 | **`none`** (valeurs : `none`, `low`, `medium`, `high`, `xhigh`) | https://developers.openai.com/api/docs/models/gpt-5.4-nano |
| `gpt-6-luna` | **0,10** | **0,01** | **0,50** | 922 000 | **`medium`** (valeurs : `none`, `low`, `medium`, `high`, `xhigh`, `max`) | https://developers.openai.com/api/docs/models/gpt-6-luna |

Les deux premiers sont les modèles validés par task-72 (décision owner du 2026-04-29 :
`summary_short` sur `gpt-5-nano`, le reste sur `gpt-5.4-nano`). Le troisième est là parce qu'il
change l'arithmétique de **cette** feature et pas de celles de task-72 : voir § 2.6.

Prompt caching, relevé le même jour sur
https://developers.openai.com/api/docs/guides/prompt-caching, pour les modèles antérieurs à
GPT-5.6 — donc pour les deux nano :

- **seuil minimal** : 1 024 tokens d'entrée visibles, arrondi en dessous au multiple de **128** ;
- **tarif** : 0,1× le prix d'entrée (0,02 contre 0,20 ; 0,005 contre 0,05), **aucun surcoût
  d'écriture** ;
- **rétention** : `in_memory`, « typiquement 5 à 10 minutes d'inactivité, jusqu'à une heure ».
  **Ni `gpt-5-nano` ni `gpt-5.4-nano` ne figurent dans la liste des modèles à rétention
  étendue 24 h** — `gpt-5.4` y est, `gpt-5.4-nano` non, ce sont deux modèles distincts ;
- **ce qui casse la réutilisation** : réécrire un tour antérieur au lieu d'**ajouter** à la fin,
  et tout changement de `model`, `tools`, `text.format`, **`reasoning.effort`** ou `verbosity` ;
- `prompt_cache_key` est un **indice de routage**, pas une condition d'éligibilité, et il visait
  environ 15 requêtes/minute par clé.

Le quatrième point est ce qui fait de la conversation le **bon** client du cache : un fil ne fait
jamais que concaténer à la fin.

### 2.2 Une question, une réponse (voie A), en euros

Hypothèses, toutes dans `compute.py` en tête de fichier : surcharge de prompt 400 tokens
(préambule `corpus.py:28` + en-têtes de source + bloc d'instructions du type), question typique
60 tokens, réponse visible 400 tokens. Corpus : **16 500 tokens par heure de parole**, mesuré de
bout en bout sur un podcast de 77,85 min (pricing-challenge § 3.9) ; **4 622 tokens** pour la
source médiane de `-dev` (task-269 § 1.2) ; **120 000 tokens** pour le plafond, qui est la
constante `MAX_FOLDER_CORPUS_TOKENS` (`artifact_service.py:125`).

`gpt-5.4-nano`, EUR :

| Corpus | `none` / froid | `none` / cache | défaut / froid | défaut / cache |
|---|---|---|---|---|
| source médiane `-dev` (4 622 tk) | 0,001358 | 0,000585 | 0,003777 | 0,003004 |
| **média d'1 h (16 500 tk)** | **0,003401** | **0,000785** | 0,005820 | 0,003204 |
| podcast de 3 h (49 500 tk) | 0,009077 | 0,001369 | 0,011496 | 0,003788 |
| **plafond dossier (120 000 tk)** | **0,021203** | **0,002577** | 0,023622 | 0,004996 |

Pour situer : task-65 chiffre à **0,0104 €** le coût LLM des cinq artefacts d'un podcast de
45 min, et pricing-challenge § R.6 mesure **0,022143 €** pour « tout ce qui peut partir » sur une
vidéo d'1 h. **Une question sur un média d'1 h coûte donc 15 % de ce que coûte le média quand
l'utilisateur demande tous ses artefacts.** Une question au plafond dossier coûte **2,0×** un
média complet à froid, **0,25×** en cache.

### 2.3 Une conversation de 5, 10 et 20 tours (voie B), en euros

Modèle de coût, tour par tour : l'entrée du tour *k* est `corpus + surcharge + historique + question`,
et l'historique croît de `question + réponse visible` à chaque tour. Avec le cache, le préfixe du
tour *k* est **exactement l'entrée du tour k-1** — puisqu'un fil ne fait qu'ajouter — donc la part
fraîche du tour *k* est la réponse précédente plus la question nouvelle.

`gpt-5.4-nano`, `reasoning_effort: none` :

**Média d'1 h (corpus 16 500 tk)**

| Tours | sans cache | avec cache | gain du cache | voie C (sans historique), cache |
|---|---|---|---|---|
| 1 | 0,003401 | 0,003401 | — | 0,003401 |
| 5 | 0,017796 | **0,006898** | **−61,2 %** | 0,006542 |
| 10 | 0,037569 | **0,011454** | **−69,5 %** | 0,010469 |
| 20 | 0,083050 | **0,021150** | **−74,5 %** | 0,018323 |

**Plafond dossier (corpus 120 000 tk)**

| Tours | sans cache | avec cache | gain du cache | voie C (sans historique), cache |
|---|---|---|---|---|
| 1 | 0,021203 | 0,021203 | — | 0,021203 |
| 5 | 0,106806 | **0,031828** | **−70,2 %** | 0,031512 |
| 10 | 0,215589 | **0,045284** | **−79,0 %** | 0,044399 |
| 20 | 0,439090 | **0,072781** | **−83,4 %** | 0,070172 |

Au régime de raisonnement **non borné** (2 700 tokens de sortie par tour, la mesure
`summary_short` de § 0.1), pour 1 / 5 / 10 / 20 tours :

| Scope | avec cache | sans cache |
|---|---|---|
| média d'1 h | 0,005820 / 0,018991 / 0,035641 / 0,069525 | 0,005820 / 0,029889 / 0,061757 / 0,131425 |
| plafond dossier | 0,023622 / 0,043922 / 0,069472 / **0,121156** | 0,023622 / 0,118899 / 0,239777 / **0,487465** |

Le pire cas absolu de tout ce document est donc là : **0,487 €** pour 20 tours au plafond
dossier, sans aucun cache et avec un raisonnement non borné. C'est **13,8 % du net d'un abonné
Standard** (3,542 €) dépensé par **une** conversation. C'est ce chiffre, et pas les autres, que
les garde-fous de § 4 doivent rendre inatteignable — et deux lignes de code y suffisent.
`reasoning_effort: none` plus un plafond de 10 tours ramènent ce pire cas à **0,2156 €** si le
cache ne mordait **jamais** sur aucun des dix tours, et à **0,0453 €** dans le régime attendu
d'une conversation dont les tours sont à quelques secondes d'intervalle. Le facteur de réduction
est donc de 2,3x dans l'hypothèse la plus pessimiste et de 10,8x dans l'hypothèse nominale.

### 2.4 Comment le coût croît avec les tours, et où il part

Décomposition, plafond dossier, cache actif, `effort: none` :

| Tour | entrée (tk) | dont cachés (tk) | coût du tour | cumul |
|---|---|---|---|---|
| 1 | 120 460 | 0 | **0,021203** | 0,021203 |
| 2 | 120 920 | 120 448 | **0,002637** | 0,023840 |
| 3 | 121 380 | 120 832 | 0,002656 | 0,026496 |
| 4 | 121 840 | 121 344 | 0,002656 | 0,029152 |
| 5 | 122 300 | 121 728 | 0,002676 | 0,031828 |
| 10 | 124 600 | 124 032 | 0,002715 | 0,045284 |
| 20 | 129 200 | 128 640 | 0,002793 | 0,072781 |

**Le premier tour coûte 8,0× un tour de relance.** La courbe est donc plate : la croissance du
coût avec le nombre de tours est **linéaire de pente très faible** (0,0027 €/tour, soit +6 %
entre le tour 2 et le tour 20), et non quadratique comme la réinjection naïve d'historique le
suggère. La raison est arithmétique : l'historique après 20 tours vaut **8 740 tokens**, soit
**7,3 % du corpus au plafond**. Le terme quadratique existe, mais son coefficient est 16 fois plus
petit que le terme constant.

Sur un média d'1 h, en revanche, l'historique après 20 tours vaut **53 % du corpus** : c'est là
que la réinjection commence à se voir, et c'est précisément le cas où le corpus est petit et où
tout est de toute façon bon marché (0,0212 € pour 20 tours).

### 2.5 Pourquoi le cache marche ici alors qu'il ne marche pas sur les artefacts

C'est le point le plus important de ce benchmark, parce qu'il renverse une conclusion mesurée du
dépôt.

pricing-challenge § R.6 point 3 a mesuré, sur 90 générations, que **le prompt caching ne rapporte
que −7,6 %** et réalise **16 % de son potentiel**. Mes propres mesures du 2026-10-05 sur les
**128** générations que la table porte aujourd'hui vont dans le même sens : **8 appels sur 128
touchent le cache (6,3 %)** et **11,9 % des tokens de prompt** sont cachés. Trois causes y étaient
établies : 43 % des prompts sont sous le seuil de 1 024 tokens, le cache est un tout-ou-rien dont
le tirage est le routage, et **la médiane des intervalles entre deux générations sur dev est de
4,9 min, juste au bord du TTL** `in_memory`.

**Une conversation inverse les trois.**

| Cause de l'échec du cache sur les artefacts | Ce qu'une conversation en fait |
|---|---|
| 43 % des prompts sont sous 1 024 tokens (articles courts) | Un fil porte **le corpus entier** : 4 622 tokens au minimum sur `-dev`, 16 500 pour une heure de parole. **Toujours au-dessus du seuil**, sauf sur un article très court — et c'est précisément le cas où la question coûte 0,0006 € |
| L'intervalle médian entre deux générations est de 4,9 min, au bord du TTL de 5 à 10 min | L'intervalle entre deux tours d'une conversation **est de quelques secondes à une minute**. C'est le régime pour lequel `in_memory` est conçu |
| Le préfixe partagé entre deux types d'artefact est le corpus, mais les 5 messages partent en rafale et se disputent le routage | Un fil est **un seul préfixe qui ne fait que croître par la fin**, envoyé séquentiellement, sous une seule `prompt_cache_key`. C'est le cas d'usage canonique documenté par OpenAI |

Le gain mesuré **modélisé** ici est de **−61 % à 5 tours et −83 % à 20 tours** (§ 2.3). Ce n'est
pas une mesure, c'est un calcul : je n'ai pas émis d'appel LLM. Mais c'est un calcul dont les trois
hypothèses sont cette fois **favorables par construction** au lieu d'être contrariées par le
workload, et le champ `llm_usage.cached_tokens` (`media_artifact.py:165-171`, persisté par
`worker.py:216-232`) permettra de vérifier le taux réel **dès la première conversation de dev**,
sans instrumentation nouvelle.

**Conséquence pour le barème.** pricing-challenge dimensionne son barème **sans cache**, et
démontre que c'était le bon choix pour l'ingestion (« compter sur le cache aurait été une erreur
de 7,6 % »). Pour les questions, je recommande **le même choix** — le barème de § 5 est calé sur
le coût **froid** — mais pour une raison différente : ici le cache rapporte vraiment, donc le
calibrer sans cache laisse une marge de 1,3× à 8× au lieu d'une marge de 7,6 %.

### 2.6 Le modèle : une question n'est pas un artefact, et la question du modèle se rouvre

La décision de task-72 (2026-04-29) couvre cinq types dont la **sortie** est longue et structurée.
Une question a le profil inverse : **entrée énorme, sortie courte**. Les deux structures de coût
n'ont rien à voir.

Même question, `effort: none`, EUR :

| Modèle | média d'1 h, froid | plafond, froid | plafond, en cache |
|---|---|---|---|
| `gpt-5-nano` | **0,000884** | **0,005335** | **0,000678** |
| `gpt-5.4-nano` | 0,003401 | 0,021203 | 0,002577 |
| `gpt-6-luna` | 0,001652 | 0,010553 | 0,001240 |

`gpt-5-nano` est **4,0× moins cher** que `gpt-5.4-nano` sur ce profil, et `gpt-6-luna` **2,0×**
moins cher tout en étant positionné au-dessus des deux. Je **ne recommande pas** de trancher le
modèle dans ce benchmark : c'est le périmètre de task-72, la qualité d'une réponse libre sur un
long corpus n'est pas mesurable sans un jeu d'évaluation que le projet n'a pas, et task-316 § P2-4
avait déjà laissé ouverte la réévaluation de `summary_short`.

Ce que je recommande, c'est **de ne pas câbler le type `answer` sur `OPENAI_MODEL`** mais sur sa
propre variable `ANSWER_LLM_MODEL` (le mécanisme existe déjà :
`artifact_service.py:114-117` lit `SUMMARY_SHORT_LLM_MODEL`, `NOTES_LLM_MODEL`, etc.), avec
`gpt-5.4-nano` comme valeur initiale. Le coût de basculer ensuite est alors **une variable
d'environnement**, et les chiffres de ce tableau disent d'avance ce que la bascule rapporte.
Deux notes pour que l'owner puisse décider plus tard sans relire ce document :

- `gpt-6-luna` a `reasoning_effort: medium` **par défaut** — l'utiliser sans passer `none`
  reviendrait à payer le régime à 2 700 tokens de sortie ;
- il annonce aussi une **surtaxe de 2× l'entrée et 1,5× la sortie au-delà de 272 000 tokens
  d'entrée**, ce qui est hors d'atteinte sous le plafond task-269 et n'a donc aucun effet ici.

---

## 3. Gestion du contexte : il n'y a rien à gérer sous le plafond task-269

La tâche demande d'évaluer quatre stratégies. Les voici, avec leur verdict, puis la démonstration.

| Stratégie | Coût | Effet sur la qualité | Verdict |
|---|---|---|---|
| **Corpus complet en préfixe caché, historique complet ajouté à la fin** | 0,0027 €/tour de relance au plafond | aucune perte : le modèle voit le texte intégral et tout ce qui s'est dit | **retenue** |
| Fenêtre glissante sur l'historique (garder les N derniers tours) | économise **au mieux 3,6 %** (§ 2.3, colonne voie C) | casse « comme tu le disais plus haut », et **casse le cache** si elle retire un tour du milieu du préfixe | écartée |
| Résumé de l'historique (compaction) | économise moins que la fenêtre glissante, et **ajoute un appel LLM par compaction** | perte de fidélité sur ce qui a été dit | écartée |
| RAG par morceaux de transcript | supprimerait le corpus du préfixe, donc −90 % du coût d'entrée | demande un store de vecteurs **absent de la stack** (Algolia est lexical), et le *retrieval* est le mauvais primitif pour « qu'est-ce que l'invité dit de X » quand il en parle à cinq endroits | écartée **sous le plafond** |

**Le RAG n'est pas nécessaire, et la fenêtre des modèles retenus suffit largement.** Trois
chiffres le disent :

1. Le plafond `MAX_FOLDER_CORPUS_TOKENS = 120_000` (`artifact_service.py:125`) vaut **44,1 % de la
   fenêtre d'entrée** de 272 000 tokens des deux nano.
2. L'historique d'un fil de 10 tours vaut **4 140 tokens**, celui de 20 tours **8 740**. Au
   plafond, un fil de 20 tours arrive donc à **129 200 tokens, soit 47,5 % de la fenêtre**.
3. Avec le plafond de **10 tours** recommandé en § 4, le pire cas est **124 600 tokens, 45,8 % de
   la fenêtre**. La marge est de **2,2×**.

Autrement dit : **le garde-fou de contexte existe déjà, il a été validé par l'owner en task-269,
et il borne la conversation aussi bien qu'il borne un artefact.** Aucune mécanique de contexte
nouvelle n'est à écrire. C'est le résultat le plus directement actionnable de ce benchmark, parce
que c'est la crainte n° 1 de l'énoncé.

**Ce que la littérature citée par task-269 § 2.7 impose quand même.** « Lost in the Middle », le
*context rot* mesuré par Chroma et NoLiMa disent tous que la performance décroît avec la longueur
d'entrée, et NoLiMa montre 10 modèles sur 12 sous 50 % de leur score court **dès 32 k tokens
quand la tâche demande du raisonnement associatif**. Une question libre est **plus proche** de ce
régime qu'un résumé : « qu'est-ce que les trois invités disent de X » est exactement une tâche
associative multi-sauts. Deux atténuations, toutes deux gratuites :

- **le balisage `[S1] … [Sn]` existe déjà** (`corpus.py:48-109`) et c'est l'atténuation recommandée
  contre le « lost in the middle » ;
- **la question est à la fin du prompt**, derrière le corpus — c'est imposé par le cache
  (`corpus.py:1-21`) et c'est aussi la position la mieux exploitée par les modèles selon Liu et al.

Ce que je **ne** peux pas affirmer : que la qualité d'une réponse libre sur 120 000 tokens de
corpus hétérogène soit bonne. Elle n'est pas mesurée, et la mesurer demanderait du trafic LLM, hors
périmètre. § 11 en fait un angle mort nommé, avec son levier : un plafond de contexte **plus bas
pour le type `answer`** que pour les artefacts, si les réponses sur gros dossier paraissent diluées.

---

## 4. Garde-fous chiffrés

### 4.1 Longueur de la question : 1 000 caractères

**Le coût ne justifie aucune limite de longueur.** Une question de 1 000 caractères vaut environ
**290 tokens** au ratio de 3,4 octets/token utilisé par `estimate_tokens`
(`artifact_service.py:128,435`), soit **0,24 % du corpus au plafond** et 1,8 % d'un média d'1 h.
Même une question de 10 000 caractères ne déplacerait pas le coût d'un centième de centime.

Le garde-fou existe donc **contre un autre risque, à nommer explicitement** : un utilisateur qui
colle un livre dans le champ question pour se servir de l'app comme d'un LLM généraliste gratuit.
Le plafond protège de ça, et le bon ordre de grandeur est celui d'une vraie question, pas d'un
document.

| Garde-fou | Valeur | Pourquoi cette valeur |
|---|---|---|
| Longueur de la question | **1 000 caractères** | environ 160 mots : au-delà, ce n'est plus une question. Refus **côté mobile** (compteur de caractères, bouton inactif) **et** côté API (`422`, validation Pydantic sur `parameters`) |
| Tokens de contexte par fil | **le plafond task-269 existant**, inchangé | `enforce_scope_ceilings` (`artifact_service.py:2102-2131`) est réutilisé tel quel, voir § 6.1 |

### 4.2 Tours par fil : 10, puis le fil se clôt

| Garde-fou | Valeur | Justification chiffrée |
|---|---|---|
| Tours par fil | **10** | Au plafond, 10 tours en cache = **0,0453 €** (`effort: none`) ou **0,0695 €** (défaut) — soit 1,3 % à 2,0 % du net d'un abonné Standard pour **une** conversation. Au 11ᵉ tour, l'utilisateur ouvre un nouveau fil, qui **re-paie le corpus** : la facture redevient visible au lieu de dériver |
| Fils ouverts simultanément par scope | **3** | Borne la liste d'historique : 3 fils × 10 tours = 30 entrées par scope au maximum, à comparer aux **5** entrées d'artefact d'aujourd'hui. Au-delà, la liste de l'onglet IA devient illisible — c'est une limite d'UI, pas de coût |
| Durée de vie d'un fil | **24 h** depuis le dernier tour | Au-delà, le fil est **clos en lecture seule**. Raison : le corpus figé peut ne plus décrire le dossier, et c'est aussi ce qui garantit qu'un fil ne devient pas un abonnement perpétuel au corpus d'hier |

**Pourquoi 10 et pas 20.** Deux raisons mesurées, aucune n'est le coût du 11ᵉ tour (0,0027 €) :
(1) à 20 tours, **l'historique vaut 53 % du corpus d'un média d'1 h**, donc le modèle commence à
raisonner autant sur la conversation que sur la source ; (2) à 20 tours au plafond, on est à
**47,5 % de la fenêtre d'entrée**, et le régime que NoLiMa décrit comme dégradé commence plus bas
que ça pour les tâches associatives (§ 3).

### 4.3 Volume par période et par palier

**Aucune limite visible nouvelle.** C'est une décision, et elle est conforme à l'architecture
existante : `quota_enforcer.py:50-53` dit que le produit n'a que **deux** refus,
`out_of_minutes` et `item_too_long`, et que « tout ce que l'enforcer pouvait dire d'autre (un
plafond par catégorie, un compteur journalier, un plafond en euros par utilisateur) n'existe plus ».
Ajouter `questions_per_month` rouvrirait exactement ce que l'owner a fait fermer.

Le volume est donc borné par **le forfait en minutes lui-même**, via l'unité de § 5. Ce que ça
donne, par palier, si **tout** le forfait partait en questions (donc zéro import) :

| Palier | Forfait | Budget fournisseur | Sessions de 5 tours sur un média d'1 h | Coût réel, pire régime | Part du net |
|---|---|---|---|---|---|
| `text_only` (3 €, net 2,125 €) | 60 min | 0,398 € | **12** | 0,228 € | 10,7 % |
| `mix` (5 €, net 3,542 €) | 300 min | 1,992 € | **60** | 1,139 € | **32,2 %** |
| `audio_heavy` (9 €, net 6,375 €) | 720 min | 4,781 € | **144** | 2,735 € | 42,9 % |
| Standard proposé (5 €, 360 crédits) | équiv. 271 min | 1,799 € | **54** | 1,029 € | 29,1 % |

Ces parts du net sont **le pire cas structurel du modèle de consommation actuel**, pas un effet de
cette feature : un abonné qui dépense tout son forfait en transcription est déjà à 56 % de son net
sur `mix` (1,992 € / 3,542 €). Les questions consomment **moins** par minute facturée que la
transcription, parce que le barème de § 5 est calé sur le coût froid alors que les tours de relance
tapent dans le cache.

### 4.4 Garde-fou invisible et comportement à la saturation

| Garde | Valeur | Emplacement |
|---|---|---|
| `burst_guards.answer_turns_per_day` | **120** | `pricing_config_service.py:122-128`, lu par `_note_burst_guards` (`quota_enforcer.py:804-845`) |

120 tours/jour, c'est 12 fils complets : un ordre de grandeur au-dessus de l'usage le plus intense
imaginable, et très en dessous d'une boucle scriptée. Comme les cinq gardes existantes, **il ne
refuse rien** : il émet `quota.burst_guard_tripped` pour que l'owner regarde.

Comportement à la saturation, par limite atteinte :

| Limite atteinte | Réponse | Ce que le mobile dit |
|---|---|---|
| Question de plus de 1 000 caractères | `422` (validation) | compteur de caractères rouge, bouton inactif — le refus n'atteint jamais l'API |
| 11ᵉ tour d'un fil | `409`, `error_code = thread_turn_limit` | « Ce fil est complet. Posez votre question dans un nouveau fil. » Le bouton « nouveau fil » est l'action du message |
| 4ᵉ fil ouvert sur le scope | `409`, `error_code = thread_limit` | « Fermez un fil pour en ouvrir un autre. » |
| Forfait en minutes épuisé | `403`, `out_of_minutes` — **le refus existant, inchangé** | la copy existante de la jauge et du paywall, rien de nouveau |
| Plafond du dossier dépassé | `422`, `scope_too_large` — **le refus existant** (`api/endpoints/artifacts.py:415`) | la copy existante de task-269 § 3.4 |
| `answer_turns_per_day` franchi | **rien**, un log | rien |

---

## 5. L'unité de quota, rattachée à `quota_enforcer.py`

### 5.1 Ce que le code fait aujourd'hui, et pourquoi ça ne suffit pas

`quota_enforcer.py` ne mesure **qu'une** unité, la minute, et son en-tête (lignes 1-27) énonce la
règle qui tient la comptabilité : « le compteur suit l'appel fournisseur, pas l'URL ». Pour l'IA :

- `check_generation_allowed(user_id, scope, source_count)` (`quota_enforcer.py:759-795`) : **zéro
  minute** pour un scope média, `minutes_for_folder_sources(source_count)` pour un dossier ;
- `minutes_for_folder_sources` (`:215-223`) : **1 minute par 5 sources**, au moins 1, via
  `unit_conversion.folder_sources_per_minute` (`pricing_config_service.py:111`) ;
- `record_generation` (`:1035-1052`) débite au moment où le compte **gagne une entrée**, avec
  `idempotency_token = artifact_id` ; appelé par `api/endpoints/artifacts.py:334-345`, après la
  planification et avant l'écriture.

Le commentaire de `minutes_for_folder_sources` dit pourquoi le scope média est gratuit : « son
coût LLM est déjà dans ce que l'élément a coûté à l'ingestion ». **C'est vrai pour les cinq types
d'artefact et faux pour une question.** La raison est exactement la règle de task-316 : les cinq
types se génèrent **une fois chacun**, donc le coût LLM d'un média est **borné par construction**
(0,0221 € mesuré pour tout, pricing-challenge § R.6). Une question libre est **non bornée** : rien
dans la nature de la chose ne limite le nombre de questions distinctes sur le même média.

**Donc une question doit débiter, y compris sur un scope média.** C'est le seul endroit où cette
feature doit toucher au modèle de consommation.

### 5.2 L'unité proposée

**Un seul principe : on facture le contexte qu'on envoie réellement au fournisseur.**

| Événement | Minutes débitées | Clé de configuration |
|---|---|---|
| **Premier tour d'un fil** (ou question unique) | `max(1, ceil(tokens_de_contexte / 20 000))` | `unit_conversion.question_context_tokens_per_minute = 20000` |
| **Tour de relance**, moins de 5 min après le tour précédent | **1 minute forfaitaire** | `unit_conversion.question_follow_up_minutes = 1` |
| **Tour de relance**, plus de 5 min après le tour précédent | **comme un premier tour** | `unit_conversion.question_context_ttl_seconds = 300` |

La troisième ligne est ce qui rend le barème honnête, et elle n'est pas une astuce : **au-delà du
TTL `in_memory` relevé en § 2.1, le cache du fournisseur a expiré et nous re-payons le corpus
entier.** Facturer le contexte à ce moment-là, c'est facturer ce qui est réellement dépensé — la
règle d'en-tête de `quota_enforcer.py`, appliquée littéralement.

**Couverture, calculée sur le pire régime de sortie (2 700 tokens) :**

| Premier tour sur | Minutes | Facturé | Coût pire cas | Couverture |
|---|---|---|---|---|
| média d'1 h (16 500 tk) | 1 | 0,006640 € | 0,005820 € | **114 %** |
| podcast de 3 h (49 500 tk) | 3 | 0,019920 € | 0,011496 € | **173 %** |
| dossier de 10 sources médianes (46 220 tk) | 3 | 0,019920 € | 0,010931 € | **182 %** |
| plafond dossier (120 000 tk) | 6 | 0,039840 € | 0,023622 € | **169 %** |
| relance, média d'1 h | 1 | 0,006640 € | 0,003283 € | **202 %** |
| relance, plafond dossier | 1 | 0,006640 € | 0,005055 € | **131 %** |

**La couverture la plus serrée est 114 %**, sur le média d'1 h au régime de raisonnement non
borné. Avec `reasoning_effort: none` elle passe à **195 %**. Et si l'on oubliait la règle du TTL,
une relance hors cache au plafond serait couverte à **28 %** seulement — c'est la seule fuite du
barème, et la troisième ligne la ferme.

Deux remarques pour la cohérence du dépôt :

- **Le pourquoi de 20 000.** C'est la valeur qui fait tomber « une heure de parole » sur
  « une minute », parce qu'une heure de parole vaut 16 500 tokens (pricing-challenge § 3.9). Un
  utilisateur qui pose une question sur un podcast d'une heure dépense une minute de son forfait :
  c'est la seule formulation de ce barème qui se raconte en une phrase.
- **Rien n'est débité deux fois.** `record_generation` porte déjà
  `idempotency_token = artifact_id`, et l'`artifact_id` d'un tour inclut sa question et son index
  de tour (§ 6.2) : un rejeu SQS, un double tap et une requête concurrente ne bougent qu'une fois
  le compteur. Et une question **déjà posée à l'identique dans le même fil** retombe sur la même
  entrée, donc `plan.already_owned` est vrai et **rien n'est débité**
  (`api/endpoints/artifacts.py:299-301`).

### 5.3 En crédits, si la grille de pricing-challenge est adoptée

Le barème de pricing-challenge § R.2 pose **1 crédit = 0,005 €** et porte déjà une ligne
« génération sur un dossier entier : 1 crédit par 3 sources ». La traduction de § 5.2 dans cette
unité, à couverture identique :

| Événement | Crédits |
|---|---|
| Premier tour | **1 crédit par 15 000 tokens de contexte**, au moins 1 |
| Tour de relance dans les 5 min | **1 crédit** |
| Tour de relance au-delà | comme un premier tour |

Soit **2 crédits** pour une question sur un média d'1 h (contre 2 crédits pour « tout envoi » dans
le barème — la symétrie est fortuite mais commode à raconter), **8 crédits** au plafond dossier.
Un abonné Standard à 360 crédits peut donc poser **180 questions sur des médias d'une heure** par
mois, ou tenir **45 dossiers au plafond**, s'il n'importe rien d'autre.

**Ce que l'owner voit** : rien de nouveau. La décision du 2026-10-04 (point 1) dit que le crédit
reste un compteur backend et que l'app parle en objets. « Jusqu'à ≈ 180 questions » entre dans la
même phrase que « ≈ 6 h de podcast ou 70 vidéos », calculée par l'API depuis le barème.

---

## 6. Articulation avec ce que le dépôt impose déjà

### 6.1 La décision task-269 : plafond et refus, réutilisés sans une ligne de changement

| Mécanisme existant | Emplacement | Ce que chaque voie en fait |
|---|---|---|
| `MAX_FOLDER_SOURCES = 25`, `MAX_FOLDER_CORPUS_TOKENS = 120_000` | `artifact_service.py:124-125` | **A, A', C** : réutilisés **tels quels**, le corpus d'une question est le même corpus. **B** : identique, plus la question de savoir si le plafond s'applique par conversation ou par tour |
| `enforce_scope_ceilings(resolution)` — refuse, ne tronque pas | `artifact_service.py:2102-2131` | **A, A', C** : appelé par le même chemin, `api/endpoints/artifacts.py:284` |
| `resolve_scope_sources` — descendants, transcript effectif, exclusions | `artifact_service.py:800-905` | réutilisé tel quel |
| `422 scope_too_large` avec ses quatre compteurs | `api/endpoints/artifacts.py:411-420` | réutilisé tel quel |
| `422 scope_empty`, `409` sources en préparation, attente `awaiting_expires_at` | `artifact_service.py:274-296`, `media_artifact.py:212-218` | réutilisés tels quels |
| Stratégie S1, une passe sur le corpus concaténé, balisé `[S1] … [Sn]` | `generators/corpus.py:48-109` | **la question est le « bloc d'instructions »** du prompt : préambule, corpus balisé, puis la question. Même mise en page, même préfixe cacheable |

**Un point de conception qui en découle, et qui est la seule nouveauté structurelle de A'.** Le
plafond doit être vérifié **une fois, à l'ouverture du fil**, et le corpus **figé** à ce
moment-là. Deux raisons, dans cet ordre :

1. **Le cache l'exige.** Le préfixe doit être **identique octet pour octet** d'un tour au suivant.
   Re-résoudre les sources à chaque tour, c'est risquer qu'une traduction fraîche, un titre corrigé
   ou une source ajoutée au dossier changent un octet du préfixe et fassent payer 120 000 tokens
   plein tarif. Le corpus assemblé est donc écrit **une fois** dans S3, sous le fil, et relu tel
   quel à chaque tour. Au plafond, cela fait **environ 400 ko** — l'ordre de grandeur que le worker
   télécharge déjà aujourd'hui (task-269 § 6.5).
2. **Ça supprime le `409` au milieu d'une conversation.** Si les sources étaient re-résolues à
   chaque tour, un dossier dont une source part en re-traduction renverrait
   `sources_not_ready` au 4ᵉ tour. Avec le corpus figé, la vérification de disponibilité des
   sources se fait **à l'ouverture** et jamais plus.

Le corollaire est assumé et cohérent avec les contraintes d'entrée de task-269 (points 3 et 4) :
**un fil décrit le dossier tel qu'il était à son ouverture.** C'est la même nature que
l'instantané `sources` d'un artefact — ce n'est pas un défaut à réparer, c'est ce qui rend le fil
interprétable. Et c'est aussi ce qui justifie la durée de vie de 24 h de § 4.2.

### 6.2 La règle task-316 « une génération par média » : elle tient, littéralement

La décision owner de task-316 est : « pour un média donné l'user ne peut générer l'artefact qu'une
seule fois […] concernant les artefacts de collection l'user doit avoir la possibilité de
regénérer uniquement si les sources ont changé ». Le code l'implémente dans
`build_artifact_id` (`artifact_service.py:439-487`), dont le docstring est explicite : **pas de
composante temporelle, pas de `generator_version`**, et `parameters` **dans** la clé.

Une question libre **ne rompt pas cette règle, elle l'instancie** :

- `parameters` porte déjà la langue de lecture, et son docstring dit que « deux langues de lecture
  sont deux ids différents et donc deux entrées légitimes ». **Une question est un paramètre de
  plus, de même nature.**
- La clé d'un tour devient donc `(user, scope, scope_id, "answer", parameters, sources)` où
  `parameters` contient `question`, `thread_id` et `turn_index`. Conséquence directe :
  **la même question, dans le même fil, au même tour, sur les mêmes sources, retombe sur la même
  entrée** — elle est réutilisée, pas régénérée, et ne débite rien. C'est exactement « une
  génération par chose demandée », appliqué à une chose plus fine.
- `normalize_artifact_parameters` (`artifact_service.py:317-337`) est déjà **total** sur les
  dictionnaires imbriqués et idempotent, et `_stable_json` (`:339-346`) trie les clés : une chaîne
  de question entre dans le hash sans aucune plomberie nouvelle.
- Rien ne change pour les cinq types existants. Aucune couche de compatibilité : le type `answer`
  est un **sixième** membre de `MediaArtifactType` (`media_artifact.py:44-55`), comme
  `review_blurb` en est le cinquième.

**Le seul point où il faut arbitrer explicitement** : `turn_index` dans la clé rend deux
questions identiques posées à deux positions différentes du fil **distinctes**, ce qui est
correct (le contexte n'est pas le même) mais signifie qu'un utilisateur qui répète la même
question au 2ᵉ puis au 5ᵉ tour paie deux fois. C'est le comportement voulu : la réponse
**peut** différer, puisque l'historique a changé.

### 6.3 La mutualisation par contenu : à désactiver pour ce type, et ça ne coûte rien

Depuis task-394, un artefact de scope **média** est généré **une fois par contenu** et non une
fois par compte (`artifact_service.py:26-50` pour la justification,
`build_shared_artifact_id` `:490-518` pour la clé, `mutualizes_generation` `:522-545` pour le
test). Deux comptes qui demandent le même type, dans la même langue, sur le même contenu sont
servis par **une** génération, et le second paie son quota sans déclencher d'appel fournisseur.

**Pour une question libre, je recommande de ne pas mutualiser** — c'est-à-dire que
`mutualizes_generation` renvoie `False` pour `MediaArtifactType.ANSWER`, exactement comme elle le
fait déjà pour un fichier téléversé. Deux raisons, et la seconde est la vraie :

1. **Le gain est nul.** La mutualisation ne mord que si la clé est **identique**. Deux comptes qui
   tapent la même question au caractère près sur le même contenu, c'est un événement de
   probabilité négligeable sur de la prose libre — là où « génère-moi le quiz » est le **même**
   geste pour tout le monde. Chiffré : si 100 comptes posaient 20 questions/mois chacun sur des
   médias d'1 h, la dépense est de 2 000 × 0,0058 € = **11,6 €/mois** au pire régime, et la
   mutualisation en récupérerait une fraction indiscernable de zéro.
2. **La prose d'un compte n'a rien à faire sur une ligne attribuée à un autre.** Une génération
   partagée porte le `user_id` « du compte dont la requête l'a déclenchée, conservé pour
   l'attribution de coût » (`media_artifact.py:181-186`). Mutualiser ferait donc stocker **la
   question écrite par A** sur une ligne attribuée à A, que B lit par pointeur. Même si aucune
   route n'expose la ligne partagée, c'est un mélange que rien n'oblige à introduire, et le hook
   pour l'éviter existe déjà.

**Ce que ça change au coût, chiffré.** Aujourd'hui, le gain de la mutualisation est réel sur les
artefacts parce qu'un même podcast populaire est traité par plusieurs comptes. Pour les questions,
on renonce à un gain **structurellement proche de zéro** et on garde la facture per-compte :
**0,0034 € par question sur un média d'1 h**, soit 0,1 % du net d'un abonné Standard. La
mutualisation des cinq types d'artefact reste **intacte** : rien dans cette feature n'y touche.

### 6.4 Tableau de synthèse : quelle voie s'articule avec quoi

| Contrainte du dépôt | A | A' | C | B |
|---|---|---|---|---|
| Plafond et refus task-269 réutilisés tels quels | oui | **oui** | oui | oui, mais à redécider par conversation |
| Règle task-316 respectée sans modification | oui | **oui** | oui | non : une conversation n'est pas une génération, la règle ne s'y applique plus |
| Table, queue, bail, taxonomie d'échec réutilisés | oui | **oui** | oui | non : table et transport nouveaux |
| `POST /api/artifacts` suffit | oui | **oui** | oui | non |
| Quota via `record_generation` | oui | **oui** | oui | non : nouveau site de débit |
| Mutualisation : décision explicite requise | oui | **oui** | oui | sans objet |
| Historique append-only et immuable conservé | oui | **oui** | oui | non : une conversation est par nature mutable |

---

## 7. Le streaming sur le runtime Lambda actuel

### 7.1 Ce qui est déployé

| Élément | Valeur | Emplacement |
|---|---|---|
| Porte d'entrée | **HTTP API** API Gateway v2, `protocol_type = "HTTP"` | `lambda_api.tf:131-148` |
| Intégration | `AWS_PROXY`, `payload_format_version = "2.0"`, route `$default` | `lambda_api.tf:185-197` |
| Lambda API | image conteneur, `arm64`, `timeout = 30`, `memory_size = 1024`, handler `media_summarizer.api.lambda_handler.handler` (adaptateur ASGI Mangum) | `lambda_api.tf:85-105` |
| Worker d'artefacts | `timeout = 300`, `memory_size = 512`, `batch_size = 1` | `lambda_workers.tf:64-68`, `:175` |
| Queue | `visibility_timeout_seconds = 1800`, `maxReceiveCount = 3`, DLQ | `sqs.tf:205-227` |
| Timeout de l'appel LLM | `LLM_TIMEOUT_SECONDS`, défaut **180 s** | `worker.py:148-150` |

### 7.2 La réponse : non, pas sans changer la porte d'entrée **et** l'adaptateur

Trois faits documentés, relevés le 2026-10-05 :

1. **Les HTTP API ne savent pas streamer.** La référence `CreateIntegration` d'apigatewayv2
   énumère tous les champs d'une intégration : il n'y a **aucun** champ de mode de transfert de
   réponse, et `timeoutInMillis` est « entre 50 et 30 000 ms pour les HTTP API », **non
   augmentable**. Source : https://docs.aws.amazon.com/apigatewayv2/latest/api-reference/apis-apiid-integrations.html
2. **Les REST API, oui.** L'objet `Integration` de l'API v1 porte
   `responseTransferMode` avec les valeurs `BUFFERED | STREAM`, et l'URI d'intégration devient
   `.../2021-11-15/functions/<arn>/response-streaming-invocations`. Le `timeoutInMillis` d'une
   REST API est « entre 50 et 29 000 ms, augmentable au-delà de 29 s pour les API régionales ou
   privées ». Sources : https://docs.aws.amazon.com/apigateway/latest/api/API_Integration.html
   et https://docs.aws.amazon.com/apigateway/latest/developerguide/response-transfer-mode-lambda.html
3. **Lambda ne streame nativement qu'en Node.js managé.** « Lambda supporte le streaming de
   réponse sur les runtimes managés Node.js. Pour les autres langages, **y compris Python**, vous
   pouvez utiliser un runtime custom avec une intégration Runtime API custom, ou le **Lambda Web
   Adapter** ». Source : https://docs.aws.amazon.com/lambda/latest/dg/configuration-response-streaming.html

Il y a donc **quatre** chemins possibles, et aucun n'est gratuit.

| Option | Modifications Terraform | Modifications code | Verdict |
|---|---|---|---|
| **1. Function URL + Lambda Web Adapter** | nouvelle `aws_lambda_function_url` avec `invoke_mode = "RESPONSE_STREAM"` sur une Lambda **dédiée au chat** ; `authorization_type = "NONE"` plus vérification du JWT dans l'app, ou `AWS_IAM` plus signature SigV4 côté mobile ; CloudFront si l'on veut le domaine custom (la Function URL a sa propre URL `*.lambda-url.*`) ; CORS à redéclarer | `Dockerfile` : copier `/lambda-adapter` dans `/opt/extensions/`, `AWS_LWA_INVOKE_MODE=response_stream`, lancer uvicorn au lieu de Mangum ; une route FastAPI `StreamingResponse` | **le moins cher des quatre**, mais c'est une **seconde** porte d'entrée à sécuriser et à observer |
| **2. Migrer la porte d'entrée en REST API** | remplacer `aws_apigatewayv2_api` / `_stage` / `_integration` / `_route` par `aws_api_gateway_rest_api` et toute sa famille, refaire le `domain_name` et l'`api_mapping`, refaire les logs d'accès, refaire `aws_lambda_permission` | idem option 1 pour l'adaptateur, **plus** le format de sortie imposé par API Gateway (métadonnées JSON, délimiteur de 8 octets nuls dans les 16 premiers Ko) | **disproportionné** : refait toute la façade pour une feature, et la REST API est plus chère par requête |
| **3. WebSocket API** | nouvelle `aws_apigatewayv2_api` en `protocol_type = "WEBSOCKET"`, routes `$connect`/`$disconnect`/`$default`, Lambda d'autorisation, table DynamoDB de registre de connexions, permissions `execute-api:ManageConnections` | un worker qui pousse les fragments par `PostToConnection` ; gestion de la reconnexion côté mobile | **le plus cher** : le `timeoutInMillis` d'une intégration WebSocket plafonne à **29 000 ms** (même source qu'au point 1), donc le streaming doit de toute façon passer par un worker et le canal de retour |
| **4. Pas de streaming : SQS plus polling, l'existant** | **aucune** | aucune : `POST /api/artifacts` et `GET /api/artifacts` font déjà le travail, le polling du mobile est déjà écrit | **retenu** |

### 7.3 La voie B tolère-t-elle une réponse non streamée ?

**Partiellement, et c'est ce qui départage A' de B.**

Un tour synchrone dans la Lambda API devrait tenir sous **30 s** (plafond de la HTTP API, non
augmentable, et `timeout = 30` de la Lambda). Les mesures de § 0.1 disent que c'est **possible mais
sans marge** : la médiane bout en bout des types demandables est de 13 à 21 s, le p90 monte à
46 s et le maximum observé est de **123,6 s**. Et ces latences sont dominées par la **sortie** :
au débit médian mesuré de **111 tokens/s**, une réponse de 450 tokens sort en **4 s**, une de
2 700 tokens en **24 s**. Donc :

- **avec `reasoning_effort: none` et une réponse bornée, un tour synchrone passe** (≈ 4 à 8 s avec
  le prefill du corpus) ;
- **au régime de raisonnement par défaut, il ne passe pas** de façon fiable (24 s de sortie plus
  le prefill, contre un plafond dur de 30 s) ;
- un tour **non streamé** de 5 à 8 s derrière un spinner est acceptable. Un tour de 25 s ne l'est
  pas, et c'est exactement ce que le streaming masque chez les concurrents.

**La conclusion opérationnelle** : A' ne prend pas ce risque du tout, parce qu'elle passe par la
queue et affiche l'état `generating` que l'app sait déjà peindre. Et si l'owner veut un jour la
sensation « ça écrit », l'option 1 est le chemin, sur une Lambda dédiée, sans toucher à la façade.

### 7.4 Une limite de débit qu'aucune des deux voies ne peut ignorer

Les deux modèles nano sont à **200 000 TPM au Tier 1** (tables de
https://developers.openai.com/api/docs/models/gpt-5.4-nano et
https://developers.openai.com/api/docs/models/gpt-5-nano, consultées le 2026-10-05). Les paliers
montent automatiquement avec la dépense cumulée : 5 $ pour le Tier 1, 50 $ pour le Tier 2 (qui
fait passer à 2 000 000 TPM).

| Un tour sur | Tokens d'entrée | Part d'une minute Tier 1 | Tours/minute au maximum |
|---|---|---|---|
| média d'1 h | 16 960 | 8,5 % | **11** |
| podcast de 3 h | 49 960 | 25,0 % | **4** |
| plafond dossier | 120 460 | **60,2 %** | **1** |

C'est une contrainte **réelle et déjà présente** : les cinq types d'artefact sur un dossier au
plafond font 602 000 tokens en rafale, soit **3,0× une minute de Tier 1**. Trois conséquences :

1. Un tour au plafond dossier est **à lui seul** 60 % du budget-minute. Deux utilisateurs qui
   questionnent un gros dossier dans la même minute déclenchent un `429` fournisseur.
2. **Le classificateur d'échec existe déjà** et nomme ce cas : `classify_llm_failure` lit le
   `Retry-After` et marque la panne comme transitoire (`worker.py:183-199`,
   `utils/llm_failure.py`). Passer par la queue donne donc **trois redélivrances gratuites**
   (`maxReceiveCount = 3`, `sqs.tf:218-222`) là où un tour synchrone rendrait une erreur à
   l'utilisateur.
3. C'est un argument de plus, indépendant du streaming, pour que le transport reste la queue.

---

## 8. Coût de construction, fichier par fichier

Chaque ligne dit **ce qu'on étend** ou **ce qui est entièrement neuf**. Les chemins sont ceux de
`main` à `bc7f600`.

### 8.1 Voie A' (recommandée) — backend

| Fichier | Nature | Ce qu'il faut y faire |
|---|---|---|
| `core/models/media_artifact.py` | **étendu** | un membre `ANSWER = "answer"` dans `MediaArtifactType` (`:44-55`). Rien d'autre : le `MediaArtifactRecord` porte déjà `parameters`, `title`, `llm_usage`, `sources`, le bail et l'attente |
| `core/services/artifact_service.py` | **étendu** | `ANSWER` dans `REQUESTABLE_ARTIFACT_TYPES` (`:158-171`) ; `ANSWER_BUCKET` et sa route dans `get_artifact_bucket` (`:393-404`) ; `ANSWER_LLM_MODEL` à côté des quatre existants (`:114-117`) ; `get_generator_version` (`:356-392`) ; `mutualizes_generation` renvoie `False` pour `ANSWER` (`:522-545`) ; validation de `parameters` (question de 1 à 1 000 caractères, `thread_id` UUID, `turn_index` entier) ; gel du corpus du fil dans S3 à l'ouverture |
| `workers/artifact_generator/generators/answer.py` | **neuf** | le générateur : `build_prompt(sources, history, question)`, pas de `response_format` (la réponse est de la prose, pas du JSON), `validate()` minimal, `reasoning_effort: "none"` |
| `workers/artifact_generator/generators/corpus.py` | **étendu** | un fragment d'instruction partagé pour la réponse libre : répondre d'après les sources, renvoyer `[Sk]`, **dire qu'on ne sait pas** quand les sources ne portent pas la réponse (le défaut que task-316 § 2.3 documente pour les cinq autres types) ; un bloc d'historique placé **après** le corpus et **avant** la question, pour ne pas casser le préfixe |
| `workers/artifact_generator/worker.py` | **étendu** | `reasoning_effort` dans le payload (`:151-160`) — ce qui **vaut pour les six types** et répond à pricing-challenge § R.6 point 4 ; lecture du corpus figé au lieu des N transcripts quand le message porte un `thread_id` (le chemin existe déjà pour les traductions d'artefact, `:19-24`) |
| `core/services/quota_enforcer.py` | **étendu** | `minutes_for_question_context(tokens)` à côté de `minutes_for_folder_sources` (`:215-223`) ; `check_generation_allowed` prend `context_tokens` et `is_follow_up` (`:759-795`) ; `record_generation` idem (`:1035-1052`) ; `answer_turns_per_day` dans `_note_burst_guards` (`:804-845`) |
| `core/services/pricing_config_service.py` | **étendu** | trois clés dans `unit_conversion` (`:93-112`) et une dans `burst_guards` (`:122-128`) |
| `api/endpoints/artifacts.py` | **étendu** | `ArtifactCreateRequest.parameters` accepte déjà tout (`:66-75`) ; ajouter les deux refus `409 thread_turn_limit` et `409 thread_limit`, et passer `context_tokens` au quota (`:299-314`) |
| `api/endpoints/pricing.py` | **étendu** | exposer les nouvelles clés d'`unit_conversion` comme les existantes (`:137-139`) |
| `infrastructure/terraform/modules/platform/s3.tf` | **étendu** | un bucket `answers` de plus, sur le modèle des six existants |
| `.../runtime_env.tf`, `iam_lambda.tf` | **étendus** | nom du bucket dans l'environnement, `s3:GetObject`/`PutObject` dessus |

**Aucune ressource DynamoDB, SQS, API Gateway ou Lambda nouvelle.** Aucun endpoint nouveau. C'est
le point qui fait l'écart avec la voie B.

### 8.2 Voie A' — mobile

| Fichier | Nature | Ce qu'il faut y faire |
|---|---|---|
| `mobile/src/components/ArtifactsPanel.tsx` | **étendu** | une tuile « Poser une question » qui ouvre un champ de saisie plutôt que de lancer une génération ; le regroupement des entrées `answer` par `thread_id` dans l'historique |
| `mobile/src/components/ArtifactHistoryRow.tsx` | **étendu** | le rendu d'une ligne `answer` : la question en titre, un indicateur de fil, l'état en vol inchangé |
| `mobile/app/artifacts/[artifactId].tsx` (1 597 lignes) | **étendu** | une branche de rendu pour le contenu `answer` : de la prose plus les renvois `[Sk]`. C'est le plus simple des six rendus, pas le plus compliqué |
| `mobile/src/services/artifactService.ts` | **étendu** | `parameters` dans `generateArtifact` (aujourd'hui la signature ne prend que `scope`, `scopeId`, `artifactType`) |
| `mobile/src/types/artifacts.ts`, `types/media.ts` | **étendus** | le type `answer`, la forme du contenu, `thread_id` |
| `mobile/app/media/[id].tsx`, `mobile/app/media/folder.tsx` | **étendus** | ils possèdent les données et le handler de génération : passer le texte de la question |
| Composant de saisie de question | **neuf** | un champ multi-lignes, un compteur de 1 000 caractères, un bouton d'envoi, les états de refus |
| 11 catalogues i18n | **étendus** | les libellés de la tuile, du champ, des deux nouveaux refus |

### 8.3 Voie B — ce qui s'ajoute à tout ce qui précède

| Élément | Nature | Détail |
|---|---|---|
| Table `conversations` plus `messages` (ou une table avec clé composite) | **neuf** | plus un GSI par utilisateur et par scope, plus la purge. Terraform et code d'accès |
| 4 à 6 endpoints | **neufs** | créer un fil, poster un tour, lister les fils, lire un fil, supprimer un fil, éventuellement arrêter une génération |
| Transport synchrone **ou** streamé | **neuf** | voir § 7.2 : soit un endpoint synchrone qui vit sous 30 s, soit une Function URL dédiée plus le Lambda Web Adapter, plus l'authentification de cette seconde porte |
| Écran de conversation | **neuf** | une liste inversée, un composer, les états d'erreur par message, le défilement automatique, la reprise après coupure réseau |
| Historique des conversations | **neuf** | un écran de liste, la recherche dedans, la suppression |
| Nouveau site de débit de quota | **neuf** | `record_generation` ne s'applique plus : il faut un débit par tour, avec son jeton d'idempotence propre |
| Observabilité | **neuf** | les alarmes `llm_alerts.tf` et le tableau de bord `pipeline_dashboard.tf` sont câblés sur la queue et le worker d'artefacts. Un chemin synchrone n'y apparaît pas |

**L'écart n'est pas dans le prompt — il est identique dans A' et B. Il est dans le fait que A'
n'écrit aucun objet nouveau, et que B en écrit sept.**

### 8.4 Ce que la voie A laisserait de réutilisable pour passer ensuite à B

Si l'owner choisissait malgré tout la voie A **pure** (pas de relance), voici ce qui survivrait à
la bascule vers B, et ce qui serait jeté.

| Élément produit par la voie A | Réutilisable en voie B ? |
|---|---|
| Le type `answer` et son générateur (prompt, fragment d'instruction, renvois `[Sk]`) | **oui, intégralement** — c'est le même prompt, à l'historique près |
| `reasoning_effort` dans le payload du worker | **oui** |
| Le gel du corpus dans S3 | **oui** — c'est précisément ce dont une conversation a besoin pour que le cache morde |
| `minutes_for_question_context` et les clés de barème | **oui** — le barème du premier tour est le même |
| Le champ de saisie, son compteur, ses refus, les libellés i18n | **oui** |
| Le rendu du contenu `answer` (prose plus renvois) | **oui**, déplacé dans une bulle de message |
| Les entrées `media_artifacts` déjà créées | **non** — mais il n'y a rien à migrer : rien n'est déployé, et les questions de la beta ne sont pas des données à préserver |
| Le groupement par `thread_id` dans l'historique d'artefacts | **jeté** si B a son propre écran |
| `record_generation` comme site de débit | **jeté** |

Autrement dit : **la voie A ne construit presque rien de jetable**, ce qui est l'argument de
l'owner et il est juste. Mais la voie A' ne construit rien de jetable **non plus** — elle ajoute
`thread_id` et `turn_index` dans `parameters`, trois lignes dans le worker et un groupement dans
la liste. **Le coût incrémental de A vers A' est d'environ une journée de travail, et il achète
toute la valeur produit de § 9.** C'est ce rapport-là qui décide, pas le coût absolu de B.

---

## 9. Valeur produit : ce que font les concurrents directs

Quatre produits examinés le **2026-10-05**, choisis parce qu'ils vendent exactement la même chose
que nous — de l'IA sur du contenu que l'utilisateur a collecté — et parce qu'ils publient assez de
chiffres pour être comparés.

| Produit | Question libre ? | Multi-tours ? | Portée | Prix | Ce qui est compté |
|---|---|---|---|---|---|
| **Gemini Notebook** (ex-NotebookLM) | oui | oui | le carnet, 50 à 600 sources selon le palier | gratuit à Ultra | **rien en nombre de messages** : un budget relatif (« 2× », « 4× » le standard), rafraîchi **toutes les 5 h** avec un plafond hebdomadaire, qui « tient compte de la complexité du prompt, des modèles, de la longueur du chat » |
| **Snipd** | oui, « Chat with Podcasts », « comme ChatGPT pour vos podcasts » | oui | l'épisode | **6,99 $/mois** Premium | **900 minutes/mois de traitement** d'épisodes non encore traités. Les fonctions IA, **chat inclus, sont illimitées**. Le palier gratuit n'a pas de chat et plafonne à **2 épisodes/semaine** |
| **Readwise Reader** (Ghostreader) | oui, **et** des prompts prédéfinis **et** des prompts personnalisés | oui — « se souvient de la conversation, vous pouvez enchaîner naturellement », avec un bouton « effacer » | le document, la sélection, ou **toute la bibliothèque** avec citations et historique (Global Ghostreader) | inclus dans l'abonnement | **rien de publié** : deux modèles au choix, « Fast » et « Thinking », « inclus dans votre abonnement » |
| **Recall** | oui, « chat personnel avec vos connaissances, l'internet, ou les deux » | oui | toute la base de connaissances | **10 $/mois** Plus | **10 résumés IA/mois** au palier gratuit, **et pas de chat du tout** ; illimité ensuite « pour un usage typique », avec une politique d'usage raisonnable |
| **Podwise** | oui, « Ask Anything », avec horodatage dans la réponse | présenté comme « une conversation avec le podcast » | l'épisode, et la recherche sur la bibliothèque | **5,90 $/mois** Standard | **20 épisodes IA/mois**, Q&A incluse. Pro à 11,90 $ : **50 crédits de traitement** et **Q&A illimitée** |

**Cinq produits sur cinq ont choisi la même chose, et c'est la réponse à la question de l'owner :**

1. **Aucun ne vend une « question ponctuelle sans relance ».** La relance est partout, y compris
   chez les deux produits les moins chers que nous (Podwise à 5,90 $, Snipd à 6,99 $). Une voie A
   pure nous mettrait **seuls** sur ce positionnement.
2. **Aucun ne compte les messages.** Le compteur est **le traitement du contenu** — minutes
   d'épisode chez Snipd, épisodes ou crédits chez Podwise, résumés chez Recall — et la question
   est offerte par-dessus. Deux d'entre eux ne publient **aucune** limite de chat.
3. **Le seul qui mesure vraiment le chat, Google, le fait en budget de calcul relatif et opaque**,
   avec une fenêtre de 5 h et un plafond hebdomadaire, et une file « générer plus tard » quand on
   sature. C'est l'aveu qu'un compteur de messages n'est pas racontable.
4. **Le gratuit, c'est le traitement, pas le chat.** Recall n'a pas de chat en gratuit ; Snipd
   plafonne le gratuit à 2 épisodes/semaine. Notre palier gratuit, s'il existe, peut donc
   légitimement n'avoir **aucune** question.
5. **Le point de comparaison le plus utile** : Snipd facture **6,99 $** avec chat illimité et
   900 minutes de traitement. Nos 300 minutes à 5 € avec questions comptées dans le même forfait
   sont dans la même zone, à condition que le barème de § 5 ne rende pas la question coûteuse au
   point qu'elle mange le forfait d'import. **C'est le vrai risque commercial de cette feature, et
   il est de dosage, pas de principe** : à 1 minute par question sur un média d'1 h, 20 questions
   par mois coûtent 20 des 300 minutes, soit 6,7 %.

**Ce que l'utilisateur perd avec la voie A pure** : la capacité de creuser. Toutes les interfaces
ci-dessus sont construites sur l'idée qu'une question en amène une autre, et c'est particulièrement
vrai pour un second cerveau, où le geste n'est pas « donne-moi un résumé » mais « attends, qu'est-ce
qu'il disait exactement sur … ». La voie A le permet aussi, mais en obligeant l'utilisateur à
re-rédiger le contexte à chaque fois — un coût cognitif qu'on lui facture pour **économiser
0,0027 € par relance**.

---

## 10. Chemin d'évolution

### 10.1 Si l'owner valide A' (recommandé)

| Étape | Déclencheur | Ce qu'il faut construire | Ce qui est réutilisé |
|---|---|---|---|
| **V1 — fil de questions** | maintenant | § 8.1 et § 8.2 | tout le pipeline d'artefacts |
| **V2 — le fil se sent comme un chat** | p90 de latence d'un tour au-dessus de 12 s, **ou** retours sur l'attente | une Lambda dédiée plus une Function URL `RESPONSE_STREAM` plus le Lambda Web Adapter (§ 7.2, option 1). Le worker reste pour le mode dégradé | le prompt, le corpus figé, le barème, la saisie, le rendu, les refus |
| **V3 — parler à travers la bibliothèque** | demandes explicites, **et** plafond de 25 sources ressenti comme gênant | **un nouveau benchmark**, avec le store de vecteurs comme sujet principal : « tout mon compte » vaut 368 503 tokens sur `-dev`, soit 1,35× la fenêtre d'entrée (task-269 § 1.2). C'est exactement le seuil de bascule que task-269 § 12.3 laisse ouvert | le prompt, le barème, l'UI |

### 10.2 Si l'owner tient à la voie A pure

Le passage ultérieur de A à B coûte ce que § 8.4 décrit : **presque rien n'est jeté**, parce que
le prompt, le corpus figé, le barème et l'UI de saisie survivent. Ce n'est donc pas un mauvais
choix du point de vue de l'architecture. Le signal pour basculer serait alors :
**la proportion de questions qui sont manifestement des relances** — mesurable en comparant les
questions successives d'un même compte sur un même scope dans une fenêtre de 10 minutes. Si plus
de **30 %** des questions suivent une autre question sur le même scope à moins de 10 minutes,
l'utilisateur fait déjà une conversation à la main et paie le corpus à chaque tour.

### 10.3 Ce que ce benchmark ne tranche pas

- **Le modèle du type `answer`** : § 2.6 donne les chiffres et recommande une variable
  d'environnement dédiée, pas un choix. Le choix appartient à task-72.
- **`reasoning_effort` pour les cinq types existants** : ce benchmark établit qu'il faut l'envoyer
  pour `answer`, et que le mécanisme vaut pour les six. Le réglage par type reste le périmètre de
  task-316 § P2-2 et de pricing-challenge § R.6 point 4.
- **La suppression d'un fil par l'utilisateur** : même statut que la suppression d'un artefact
  d'historique, laissée ouverte par task-269 § 12.3.
- **Les renvois `[Sk]` cliquables vers l'horodatage du transcript** : c'est ce que fait Podwise, et
  c'est une tâche d'UI distincte.

---

## 11. Risques et angles morts assumés

| Risque | Portée | Ce qui est fait, ou pas |
|---|---|---|
| **Le gain du cache est calculé, pas mesuré** | le coût d'un fil est multiplié par 3 à 6 si le cache ne mord pas | Assumé. Le pire cas sans cache est chiffré partout dans § 2.3, il reste sous 0,13 € pour 10 tours au plafond au régime de raisonnement non borné, et le barème de § 5 est calé **sur le coût froid**. `llm_usage.cached_tokens` donne le taux réel dès la première conversation de dev, sans instrumentation nouvelle |
| **La qualité d'une réponse libre sur 120 000 tokens n'est pas mesurée** | qualité perçue | Assumé et non mesurable sans trafic LLM, comme task-269 § 12.2 l'avait déjà posé pour les artefacts. Le levier si les réponses sur gros dossier paraissent diluées est **un plafond de contexte plus bas pour `answer`** que pour les artefacts, pas un changement de stratégie |
| **Le modèle peut répondre à côté plutôt que dire qu'il ne sait pas** | confiance | C'est le défaut que task-316 § 2.3 a mesuré sur les cinq types : « aucune porte de sortie quand la source ne porte pas de matière ». Une question libre y est **plus** exposée. L'atténuation est dans le prompt (§ 8.1, fragment de `corpus.py`) et elle doit être écrite **avant** la première démo, pas après |
| **Un tour au plafond dossier vaut 60 % d'une minute de Tier 1** | erreur 429 du fournisseur | Nommé en § 7.4. La queue donne trois redélivrances, le classificateur d'échec existe déjà. Le palier monte automatiquement à 50 $ de dépense cumulée |
| **Le corpus figé peut ne plus décrire le dossier** | cohérence perçue | Voulu, et c'est la même nature que l'instantané `sources` d'un artefact. Borné par la durée de vie de 24 h d'un fil (§ 4.2) |
| **L'historique d'artefacts va se remplir de questions** | lisibilité de l'onglet IA | Borné par 3 fils fois 10 tours = 30 entrées par scope. Au-delà, c'est un sujet d'UI, et le groupement par `thread_id` est ce qui l'évite |
| **Une question peut contenir des données personnelles** | confidentialité | C'est l'argument n° 2 de § 6.3 pour ne pas mutualiser. La question est stockée dans `parameters` de l'entrée du compte, comme la langue de lecture aujourd'hui, et part chez le fournisseur comme le transcript. Rien de nouveau dans la posture, mais la **politique de confidentialité doit le dire** : aujourd'hui elle décrit un traitement de contenu importé, pas de texte saisi par l'utilisateur |
| **Pas de streaming, donc un spinner** | UX | Assumé et c'est le cœur de l'arbitrage. Mesuré : la médiane bout en bout d'un artefact est de 13 à 21 s **avec un raisonnement non borné et une sortie longue** ; une réponse de 450 tokens à 111 tokens/s sort en 4 s. Le chemin vers le streaming est en § 7.2, option 1 |
| **`reasoning_effort` n'a jamais été envoyé par ce dépôt** | risque de régression sur les cinq types | Le changement est localisé au payload (`worker.py:151-160`) et **le passer par type** évite d'y toucher pour les autres. Mais attention : changer `reasoning.effort` **invalide le préfixe de cache** (§ 2.1), donc le premier déploiement qui l'introduit perd le cache une fois |
| **task-212 avait chiffré un workload chatbot et a été abandonné** | ne pas refaire ses conclusions | Lu. Ses hypothèses étaient **200 à 300 utilisateurs de chat simultanés** et 99 % du débit sur le chat, ce qui l'amenait à recommander Azure OpenAI multi-région et des PTU. À l'échelle réelle du projet — une douzaine de testeurs beta, un seuil de rentabilité entre 14 et 22 abonnés (pricing-challenge § R.3) — **un tour de chat au plafond vaut 60 % d'une minute de Tier 1 et 6 % d'une minute de Tier 2**. Aucune de ses conclusions d'infrastructure n'est reprise ici, et aucun changement de fournisseur n'est proposé |

---

## 12. Notes à l'owner (gestes owner, pas des critères d'acceptation)

1. **Ce benchmark ne demande aucun apply Terraform risqué.** Un bucket S3 de plus, trois clés de
   `pricing_config`, et c'est tout. Les clés de `pricing_config` sont **ajustables sans
   déploiement** (table DynamoDB, task-110), donc les trois valeurs de § 5.2 peuvent être réglées
   après une semaine d'usage réel sans toucher au code.
2. **La vérification E2E qui compte**, après déploiement : poser une question sur le média le plus
   long de `-dev`, puis **trois relances à moins d'une minute d'intervalle**, et lire
   `llm_usage.cached_tokens` des quatre entrées dans `media_artifacts-dev`. Le tour 1 doit avoir
   `cached_tokens = 0` et les tours 2 à 4 un `cached_tokens` proche du total du prompt. Si ce
   n'est pas le cas, le préfixe n'est pas stable et il faut regarder ce qui change entre deux
   tours — c'est le seul test qui valide l'hypothèse économique de ce document.
3. **Un geste gratuit à faire en même temps** : `reasoning_effort` est introduit par cette feature,
   et pricing-challenge § R.6 point 4 a mesuré que c'est **le premier levier de coût du projet**
   (98,9 % du coût de la traduction est de la sortie, avec un plancher d'environ 3 400 tokens de
   raisonnement par appel). Le code qui le pose pour `answer` le pose pour les six types. Décider
   s'il faut en profiter est un arbitrage que ce benchmark n'a pas à faire, mais **le signaler est
   son devoir**.
4. **Le barème de § 5 suppose que le forfait reste en minutes.** Si la grille en crédits de
   pricing-challenge est adoptée, § 5.3 donne la conversion à couverture identique. Les deux
   formulations vivent dans `pricing_config`, donc l'ordre entre les deux tâches n'est pas
   contraint.
5. **Une décision produit reste à prendre et elle n'est pas technique** : est-ce que le palier
   gratuit a droit à des questions ? Les concurrents disent non — Recall n'a pas de chat en
   gratuit, Snipd non plus. § 9 point 4 donne les faits, pas la réponse.

---

## Sources

### Tarifs, modèles et capacités, consultés le 2026-10-05

- OpenAI, tarifs API : https://developers.openai.com/api/docs/pricing
  — `gpt-5-nano` 0,05 / 0,005 / 0,40 $ par 1M ; `gpt-5.4-nano` 0,20 / 0,02 / 1,25 $ ;
  `gpt-5.4` 2,50 / 0,25 / 15,00 $ en contexte court. Seuil de contexte long : 272 000 tokens
  d'entrée.
- OpenAI, `gpt-5.4-nano` : https://developers.openai.com/api/docs/models/gpt-5.4-nano
  — 400 000 de contexte total, 272 000 d'entrée, 128 000 de sortie ; streaming, structured
  outputs et prompt caching supportés ; `reasoning_effort` parmi `none` (défaut), `low`,
  `medium`, `high`, `xhigh` ; Tier 1 à 500 RPM et **200 000 TPM**.
- OpenAI, `gpt-5-nano` : https://developers.openai.com/api/docs/models/gpt-5-nano
  — mêmes fenêtres, mêmes limites de Tier 1 ; la page oriente les nouveaux projets sensibles au
  coût ou à la latence vers la génération suivante.
- OpenAI, `gpt-6-luna` : https://developers.openai.com/api/docs/models/gpt-6-luna
  — 0,10 / 0,01 / 0,50 $ par 1M, écriture de cache 0,125 $ ; 1 050 000 de contexte, 922 000
  d'entrée ; `reasoning_effort` par défaut **`medium`** ; surtaxe de 2x l'entrée et 1,5x la
  sortie au-delà de 272 000 tokens d'entrée ; Tier 1 à 500 RPM et 500 000 TPM.
- OpenAI, comparaison des modèles : https://developers.openai.com/api/docs/models/compare
- OpenAI, prompt caching : https://developers.openai.com/api/docs/guides/prompt-caching
  — seuil de 1 024 tokens et arrondi au multiple de 128 pour les modèles antérieurs à GPT-5.6 ;
  lectures à 0,1x l'entrée, sans surcoût d'écriture ; `in_memory` « typiquement 5 à 10 minutes
  d'inactivité, jusqu'à une heure » ; rétention 24 h **non disponible** sur les nano ; la
  réutilisation exige un préfixe rendu identique et est cassée par un changement de `model`,
  `tools`, `text.format`, `reasoning.effort` ou `verbosity`, ou par la réécriture d'un tour
  antérieur au lieu d'un ajout en fin ; `prompt_cache_key` est un indice de routage visant
  environ 15 requêtes par minute et par clé.
- OpenAI, paliers de débit : https://developers.openai.com/api/docs/guides/rate-limits
  — Tier 1 à 5 $ de dépense cumulée, Tier 2 à 50 $, Tier 3 à 100 $, Tier 4 à 250 $, Tier 5 à
  1 000 $ ; progression automatique avec la dépense.

### AWS, consulté le 2026-10-05

- Streaming de réponse Lambda : https://docs.aws.amazon.com/lambda/latest/dg/configuration-response-streaming.html
  — natif sur les runtimes managés **Node.js** uniquement ; pour les autres langages, **y compris
  Python**, runtime custom ou **Lambda Web Adapter** ; 200 Mo de charge utile contre 6 Mo en
  bufferisé ; débit non plafonné sur les 6 premiers Mo puis 2 Mo/s ; la facturation court sur
  toute la durée de la fonction même si le client se déconnecte.
- Intégration proxy Lambda en flux dans API Gateway : https://docs.aws.amazon.com/apigateway/latest/developerguide/response-transfer-mode-lambda.html
  — URI d'intégration en `2021-11-15/.../response-streaming-invocations`, métadonnées JSON puis un
  délimiteur de 8 octets nuls, à placer dans les 16 premiers Ko du flux.
- Objet `Integration` des REST API : https://docs.aws.amazon.com/apigateway/latest/api/API_Integration.html
  — `responseTransferMode` parmi `BUFFERED` et `STREAM` ; `timeoutInMillis` entre 50 et
  29 000 ms, augmentable au-delà de 29 s pour les API régionales ou privées.
- `CreateIntegration` des HTTP API : https://docs.aws.amazon.com/apigatewayv2/latest/api-reference/apis-apiid-integrations.html
  — **aucun champ de mode de transfert de réponse** ; `timeoutInMillis` entre 50 et 30 000 ms pour
  les HTTP API, défaut 30 s, et entre 50 et 29 000 ms pour les WebSocket, défaut 29 s.
- Choisir entre Function URL et API Gateway : https://docs.aws.amazon.com/lambda/latest/dg/furls-http-invoke-decision.html
- Lambda Web Adapter : https://github.com/awslabs/aws-lambda-web-adapter
  — `AWS_LWA_INVOKE_MODE` valant `buffered` par défaut ou `response_stream` ; fonctionne avec
  FastAPI (exemples « FastAPI with Response Streaming »), les images OCI, `arm64` et `x86_64` ;
  la compression de réponse ne s'applique qu'en mode bufferisé.
- Quotas API Gateway : https://docs.aws.amazon.com/apigateway/latest/developerguide/limits.html
  — **non vérifié dans cette passe** : la durée maximale d'une connexion WebSocket et son délai
  d'inactivité. La page rendue par l'outil de récupération était tronquée à la section des quotas
  par compte. Le seul chiffre WebSocket cité ici vient de la référence `CreateIntegration`
  ci-dessus, et l'option 3 de § 7.2 est de toute façon écartée pour une autre raison.

### Concurrents, consultés le 2026-10-05

- Gemini Notebook (ex-NotebookLM), plans et limites : https://support.google.com/notebooklm/answer/16213268
  — 50 / 100 / 300 / 500 / 600 sources par carnet selon le palier ; les artefacts auto-générés à
  l'ajout d'une source « ne comptent pas dans les limites » ; quotas journaliers renouvelés après
  24 h, mensuels après 30 jours.
- Gemini Notebook, gestion des limites d'usage : https://support.google.com/notebooklm/answer/17670842
  — **aucun chiffre de messages** : « limites standard », « 2x », « 4x », « 5x ou 20x » ; le quota
  « se rafraîchit toutes les 5 heures jusqu'au plafond hebdomadaire » ; les limites « tiennent
  compte de la complexité du prompt, des modèles et fonctions utilisés, de la longueur du chat » ;
  file « générer plus tard » à la saturation.
- Snipd : https://www.snipd.com/ et https://www.snipd.com/pricing
  — « Chat with Podcasts », « comme ChatGPT pour vos podcasts » ; gratuit limité à **2 épisodes
  par semaine** et sans chat ; Premium à **6,99 $/mois**, fonctions IA illimitées sur plus d'un
  million d'épisodes déjà traités, chat inclus, seul plafond chiffré **900 min/mois** de
  traitement d'épisodes non encore traités.
- Readwise Reader, Ghostreader : https://docs.readwise.io/reader/guides/ghostreader et
  https://docs.readwise.io/reader/guides/ghostreader/chat
  — prompts par défaut, prompts personnalisés **et** chat multi-tours qui « se souvient de la
  conversation » ; contexte égal au document, à ses métadonnées et à la position de lecture, ou à
  une sélection ; Global Ghostreader étend à toute la bibliothèque, avec citations et historique ;
  modèles « Fast » et « Thinking » inclus dans l'abonnement ; **aucune limite publiée**.
- Recall : https://www.recall.it/pricing
  — gratuit à **10 résumés IA par mois et sans chat** ; Plus à **10 $/mois** avec chat illimité
  « pour un usage typique », sous politique d'usage raisonnable ; Max à 38 $/mois.
- Podwise : https://podwise.ai/
  — « Ask Anything » avec horodatage dans la réponse ; Standard à **5,90 $/mois** pour **20
  épisodes IA par mois**, Q&A incluse ; Pro à **11,90 $/mois** pour **50 crédits de traitement** et
  **Q&A illimitée**.

### Références internes

- `docs/research/task-269-collection-artifact-aggregation/README.md` — stratégie S1 validée,
  plafond de 25 sources et 120 000 tokens, refus et non-troncature, mise en page du prompt pour le
  cache, quota, et la littérature sur le long contexte (§ 2.7).
- `docs/research/task-316-artifact-prompts/README.md` — décision owner « une génération par
  média », le remplissage mesuré, l'écart entre tokens facturés et sortie visible (§ 2.13),
  l'absence de porte de sortie quand la source ne porte rien (§ 2.3).
- `docs/research/task-72-llm-artifact-benchmark/README.md` — décision owner du 2026-04-29 sur les
  deux modèles.
- `docs/research/task-212-llm-serving-architecture-benchmark/README.md` — **abandonné par
  l'owner**. Lu pour ne pas refaire ses chiffres ; ses conclusions d'infrastructure ne sont pas
  reprises.
- `docs/research/pricing-challenge/README.md` — barème en crédits (§ R.2), grille de paliers
  (§ R.3), les deux seuls sites d'appel LLM et le gain réel du cache (§ R.6), la relation entre
  durée d'audio et nombre de tokens (§ 3.9).
- Code lu : `media_summarizer/core/services/artifact_service.py`,
  `media_summarizer/core/models/media_artifact.py`,
  `media_summarizer/core/services/quota_enforcer.py`,
  `media_summarizer/core/services/pricing_config_service.py`,
  `media_summarizer/core/services/llm_pricing.py`,
  `media_summarizer/workers/artifact_generator/worker.py`,
  `media_summarizer/workers/artifact_generator/generators/corpus.py`,
  `media_summarizer/api/endpoints/artifacts.py`,
  `mobile/src/components/ArtifactsPanel.tsx`, `mobile/src/services/artifactService.ts`,
  `infrastructure/terraform/modules/platform/lambda_api.tf`,
  `infrastructure/terraform/modules/platform/lambda_workers.tf`,
  `infrastructure/terraform/modules/platform/sqs.tf`.
- Arithmétique reproductible : `docs/research/task-427-ask-question-vs-chatbot/compute.py`.
