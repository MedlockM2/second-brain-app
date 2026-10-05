---
owner_decision: pending   # pending | ok | abandoned | redo | more
---

# Benchmark : coût d'un modèle de transcription open source hébergé sur AWS à la place de Deepgram

## Owner Validation

**Decision**: _(à remplir par l'owner après relecture)_
**Validated at**: _(date ISO à remplir par l'owner)_

---

## Recommendation

**Ne pas auto-héberger. Le chiffre demandé est négatif à tous les volumes que ce produit peut
atteindre, et l'économie que l'owner cherche existe — mais elle s'obtient en *achetant* le modèle
open source comme API, pas en le faisant tourner sur une instance GPU AWS.**

Trois réponses, par ordre d'importance.

1. **L'auto-hébergement ne fait économiser que dans un seul des trois scénarios de volume, et c'est
   le scénario le plus lointain.** La meilleure configuration trouvée — une `g4dn.xlarge` Spot
   allumée en permanence dans `eu-west-3` — coûte **145,21 $/mois (129,36 €)**, quel que soit le
   volume, parce que c'est un coût de machine et pas un coût d'usage. Face à Deepgram facturé au
   tarif mesuré de 0,26 $/h :
   - volume actuel (1,83 h/mois) : **−144,74 $/mois**, soit un surcoût de 302× ;
   - 100 abonnés Standard à 40 % (240 h/mois) : **−82,81 $/mois (−73,77 €)**, un surcoût de 2,3× ;
   - 100 abonnés au palier haut à 40 % (1 600 h/mois) : **+270,79 $/mois (+241,24 €)**, enfin un gain.

2. **Même dans ce seul scénario gagnant, l'API hébergée du *même* modèle open source fait mieux, et
   sans infrastructure.** À 1 600 h/mois, `whisper-large-v3-turbo` chez DeepInfra coûte
   **19,20 $/mois** (0,012 $/h) ; avec une passe de diarisation séparée, **76,80 $/mois**
   (0,048 $/h). L'économie est de **+396,80 $ ou +339,20 $/mois** contre +270,79 $ pour
   l'auto-hébergement — soit **68 à 126 $/mois de plus**, avec zéro Terraform, zéro GPU, zéro Spot
   interrompu, zéro pilote CUDA à maintenir. Et le même modèle est **plus précis** que celui qu'on
   paie aujourd'hui : 4,6 % de WER (Whisper large-v3-turbo chez Groq) contre 5,2 % pour Deepgram
   Nova-3, sur le benchmark indépendant Artificial Analysis AA-WER v2.

3. **Il n'y a rien à faire maintenant, et le déclencheur n'est pas un volume : c'est l'épuisement du
   crédit.** Les 197,06 $ de crédit d'inscription intacts achètent **757,9 h** à 0,26 $/h. Au volume
   actuel, cela couvre **34 ans**. À 240 h/mois, **3,2 mois**. Tant que le crédit court, le poste
   transcription est à zéro et *toute* alternative, y compris la meilleure, est un surcoût. Le jour
   où il s'épuise, le bon geste est un changement de fournisseur **à l'intérieur du worker Lambda
   existant** (un adaptateur de sortie, une durée audio à calculer, un nom de provider à changer :
   ~2 jours), pas un projet d'infrastructure.

**Seuil de déclenchement demandé** : l'auto-hébergement devient rentable à partir de
**≈ 560 h d'audio/mois si on ne compte pas le temps du développeur**, de **≈ 1 200 h/mois** si on
porte 150 €/mois d'exploitation récurrente, et de **≈ 2 070 h/mois** si on amortit aussi la
construction. Mais face à l'API hébergée du même modèle, le seuil monte à **3 000 h/mois avec
diarisation** et **12 100 h/mois sans** — soit 756 abonnés au palier haut à 40 % d'usage. Détail et
sensibilité en § 8.

**Un corollaire qui ne coûte rien et que ce benchmark établit au passage** : le viewer de transcript
**ne dépend pas** de la sortie Deepgram. task-231 a fait du texte brut l'objet canonique, et
`transcript_formatting.py` expose un seul point d'adaptation par fournisseur. La prémisse du brief
(« paragraphes, horodatage par mot et locuteurs viennent aujourd'hui de Deepgram ») est vraie de
l'*acquisition*, fausse du *rendu* — ce qui rend un changement de fournisseur bien moins cher que
l'auto-hébergement. Détail en § 9.

---

## Table des matières

- [1. Hypothèses, unités et taux de change](#1-hypothèses-unités-et-taux-de-change)
- [2. La référence Deepgram, mesurée](#2-la-référence-deepgram-mesurée)
- [3. Les modèles open source candidats](#3-les-modèles-open-source-candidats)
- [4. Les modes d'hébergement sur AWS, chiffrés dans eu-west-3](#4-les-modes-dhébergement-sur-aws-chiffrés-dans-eu-west-3)
- [5. Les deux repères hors auto-hébergement](#5-les-deux-repères-hors-auto-hébergement)
- [6. Tableau comparatif](#6-tableau-comparatif)
- [7. Économie mensuelle par scénario, crédit Deepgram inclus](#7-économie-mensuelle-par-scénario-crédit-deepgram-inclus)
- [8. Le seuil de déclenchement](#8-le-seuil-de-déclenchement)
- [9. Ce que la migration casserait](#9-ce-que-la-migration-casserait)
- [10. Risques, et ce que je n'ai pas pu vérifier](#10-risques-et-ce-que-je-nai-pas-pu-vérifier)
- [Sources](#sources)

---

## 1. Hypothèses, unités et taux de change

**Rien n'est déployé.** Zéro donnée de production, zéro client payant, zéro abonnement actif. Les
trois volumes ci-dessous sont des **hypothèses posées par le brief de l'owner**, pas des mesures
d'usage. Le seul usage réel mesurable est celui de l'environnement `-dev` avec ~12 testeurs beta.

| Scénario | Définition | Volume retenu |
|---|---|---|
| **S0 — volume actuel** | 5,5 h transcrites en trois mois (`pricing-challenge` § 3.1) | **1,83 h d'audio/mois** |
| **S1 — 100 abonnés Standard à 40 %** | 100 × 6 h/mois × 0,40 | **240 h d'audio/mois** |
| **S2 — 100 abonnés palier haut à 40 %** | 100 × 40 h/mois × 0,40 | **1 600 h d'audio/mois** |

Le palier Standard à ≈ 6 h/mois vient de `pricing-challenge` § R.3 (360 crédits, « ≈ 6 h »). Le
palier haut à ≈ 40 h/mois pour 14,99 € est une **hypothèse de l'owner énoncée dans le brief de
task-426** : elle n'existe dans aucun document du dépôt, la grille de `pricing-challenge` § R.3
s'arrêtant à 720 crédits (≈ 11 h 30) pour 9,00 €. Je la prends telle quelle ; c'est 3,5× plus
généreux que la grille actuellement proposée, donc S2 est un **majorant** de ce que la V1 vendra.

**Mois = 730 h** pour tous les calculs d'instance (convention AWS).

**Taux de change** : référence BCE du **2026-10-02**, 1 EUR = 1,1225 USD, soit
**1 USD = 0,890869 EUR**. Attention : `pricing-challenge` a été écrit au taux du 2026-09-08
(1 USD = 0,8611 EUR) et `llm_pricing.py:20` porte 0,86. Le dollar s'est renchéri de **+3,5 %** depuis.
Conséquence directe : le tarif Deepgram mesuré de 0,26 $/h vaut aujourd'hui **0,003860 €/min** et non
les 0,003727 €/min de `pricing-challenge` § 3.1. Toute la comparaison ci-dessous est menée **en
dollars**, l'unité dans laquelle les quatre fournisseurs facturent ; les euros sont donnés en second.

**Mix de durées mesuré, et pourquoi il décide tout.** Scan en lecture seule de
`processing_jobs-dev` le 2026-10-05 : **35 transcriptions Deepgram**, 118,0 min d'audio au total.

| Statistique | Valeur mesurée |
|---|---|
| Durée médiane d'un média | **1,01 min** |
| Durée moyenne | 3,37 min |
| Médias sous 3 min | **34 sur 35 (97 %)** |
| Part de l'audio total portée par le seul podcast de 77,85 min | **66 %** |

Deux conséquences qu'il faut garder en tête jusqu'à la fin :

1. **Deepgram facture à la minute, donc sa facture est portée par le podcast.** Un fournisseur à la
   minute est indifférent au nombre d'éléments.
2. **Une machine à soi facture au temps d'allumage, donc sa facture est portée par le nombre de
   *sessions*.** 97 % des médias sont des clips d'une minute, pour lesquels n'importe quel démarrage
   à froid coûte vingt fois le prix du média chez Deepgram (§ 4.3). C'est la structure de coût, pas
   le prix du GPU, qui décide.

---

## 2. La référence Deepgram, mesurée

Rien de ce paragraphe n'est re-mesuré : il cite `pricing-challenge` § 3.1, établi sur les deux
exports de la console Deepgram fournis par l'owner le 2026-09-09.

| Fait | Valeur | Source |
|---|---|---|
| Tarif réellement facturé, `Nova-3 (Pre-recorded)` | **0,26 $/h** = 0,0043333 $/min | facture, `pricing-challenge` § 3.1 |
| Tarif de la page publique, nova-3 pre-recorded monolingue | 0,0043 $/min = 0,258 $/h | deepgram.com/pricing, consulté 2026-10-05 |
| Diarisation en pre-recorded | **incluse, 0 $** | page tarifaire (« Included ») + absence de ligne sur 251,58 min diarisées |
| `detect_language=true` | facturé au tarif **monolingue** | facture, 31 jours sur 34 sans surcharge |
| Crédit d'inscription restant | **197,06 $ sur 200 $** = 757,9 h à 0,26 $/h | console Deepgram |
| Volume consommé | ~5,5 h en trois mois | console Deepgram |
| Poids dans le coût d'une heure de podcast | **93 %** (0,2222 € sur 0,2386 €) | `pricing-challenge` § R.2 |

Deux précisions que ce benchmark ajoute :

- **757,9 h, pas 764.** `pricing-challenge` § 3.1 point 5 écrit « 764 heures » ; 197,06 / 0,26 =
  757,9. L'écart de 0,8 % ne change aucune conclusion, mais c'est 757,9 qui est utilisé ici.
- **Le délai de bout en bout de Deepgram est mesuré, et il est très bas.** Même scan
  `processing_jobs-dev` du 2026-10-05, champ `transcription_metadata.duration_seconds` (la latence de
  l'appel, pas la durée de l'audio — cf. `orchestrators.py:243-244`) :

  | Média | Audio | Latence API Deepgram | Facteur temps réel |
  |---|---|---|---|
  | Podcast le plus long du jeu | 4 670,85 s (77,85 min) | **10,53 s** | **443×** |
  | Agrégat des 35 appels | 7 079 s | 128,9 s | 54,9× |
  | Médiane par appel | 60,6 s | 2,65 s | 19,0× |

  **Un podcast d'une heure revient donc en ~8 à 11 secondes aujourd'hui.** C'est le chiffre que toute
  alternative doit battre, ou dont il faut accepter la dégradation en connaissance de cause. Le coût
  Lambda de cette attente est négligeable : 10,5 s à 512 Mo = **0,000088 $** par podcast
  (0,0000166667 $/Go-s, price list `AWSLambda` eu-west-3 du 2026-10-01).

**Un contre-exemple utile dès maintenant** : Deepgram revend lui-même Whisper Large à **0,0048 $/min
= 0,288 $/h**, soit **+10,8 %** par rapport à son Nova-3. Autrement dit, le prix de marché d'« un
modèle open source » n'est pas zéro, et chez le fournisseur qu'on a déjà, il est *plus cher*. Ce
serait un changement d'une variable d'environnement (`DEEPGRAM_MODEL`), donc la migration la moins
chère imaginable — et elle va dans le mauvais sens pour le coût.

---

## 3. Les modèles open source candidats

Critère éliminatoire : **les 11 langues V1** (`task-189` § V1 Languages Supported) — fr, en, es, de,
it, pt, nl, ja, zh, ar, hi — avec détection automatique.

| Modèle | Licence | Taille | 11 langues V1 | Horodatage par mot | Diarisation | Verdict |
|---|---|---|---|---|---|---|
| **Whisper large-v3** | MIT | 1 550 M | **oui** (99 langues) | oui (segments ; mot via alignement externe) | non — pyannote requis | **candidat de référence** |
| **Whisper large-v3-turbo** | MIT | 809 M (décodeur 32 → 4 couches) | **oui** (99 langues), « minor quality degradation » | idem | non | **candidat, le meilleur rapport prix/qualité** |
| **Qwen3-ASR-1.7B** | Apache-2.0 | 2 000 M | **oui** (30 langues, les 11 présentes) | oui, via `Qwen3-ForcedAligner-0.6B` — mais l'aligneur ne couvre que 11 langues dont **ni nl, ni ar, ni hi** | non | candidat, meilleure WER annoncée que Whisper, mais horodatage incomplet sur 3 des 11 langues |
| **Voxtral-Mini-3B-2507** | Apache-2.0 | ~5 000 M | **non — 8 langues** (en, es, fr, pt, hi, de, nl, it) : manquent ja, zh, ar | non documenté | non | **éliminé** sur la couverture, malgré la meilleure WER open-weights mesurée par Artificial Analysis (2,8 % pour Small) |
| **Voxtral-Small-24B-2507** | Apache-2.0 | 24 B | **non**, même limite | non documenté | non | **éliminé** (couverture + 24 B ne tient pas sur un L4 24 Go avec pyannote à côté) |
| **NVIDIA Parakeet TDT 0.6B v2** | — | 600 M | **non** (anglais) | oui | non | **éliminé** |
| **distil-whisper-large-v3** | MIT | — | **non** (anglais) | oui | non | **éliminé** |
| **pyannote/speaker-diarization-community-1** | CC-BY-4.0 (3.1 : MIT) | — | n/a (indépendant de la langue) | n/a | **c'est le composant de diarisation** | nécessaire, **accès conditionné** |

**Le choix de modèle n'est pas le sujet, et c'est une conclusion.** Whisper large-v3-turbo couvre les
11 langues, est sous MIT, pèse 809 M paramètres (donc tient largement dans les 16 Go d'un T4), et
c'est le modèle que tous les fournisseurs d'API revendent. Qwen3-ASR-1.7B annonce une meilleure WER
que Whisper large-v3 sur presque tous les benchmarks publiés par son éditeur (ex. CV-en 7,39 vs 9,90 ;
LID 97,9 % vs 94,1 %) **sauf** sur FLEURS 30 langues (12,60 vs 8,16) — et son horodatage par mot
passe par un aligneur qui ne couvre pas le néerlandais, l'arabe ni le hindi. Pour un produit à 11
langues, Whisper reste le choix sûr.

**Ce que le modèle ne donne pas, et qu'il faut acheter séparément.** Whisper ne fait **pas** de
diarisation. Le pipeline de référence est WhisperX (BSD-2-Clause) : VAD pyannote + Whisper batché via
faster-whisper + alignement forcé wav2vec2 pour les timings mot + diarisation
`pyannote/speaker-diarization-community-1`. Trois frictions concrètes, toutes documentées par les
dépôts eux-mêmes :

1. **L'alignement par mot est spécifique à la langue.** WhisperX ne livre des modèles d'alignement par
   défaut que pour `{en, fr, de, es, it}` ; les autres passent par Hugging Face et « unsupported
   languages require sourcing your own phoneme model ». Sur les 11 langues V1, **6 sont donc hors du
   chemin par défaut** (pt, nl, ja, zh, ar, hi). Deepgram, lui, renvoie `words[]` avec
   `start`/`end`/`confidence` sur toutes ses langues, sans rien de plus à installer.
2. **La diarisation est sous accès conditionné.** `pyannote/speaker-diarization-3.1` affiche « You
   need to agree to share your contact information to access this model », impose d'accepter aussi
   les conditions de `pyannote/segmentation-3.0`, et exige un token Hugging Face au runtime. WhisperX
   demande explicitement d'accepter l'accord utilisateur de `speaker-diarization-community-1`. Ce
   n'est pas un coût monétaire, c'est **une étape humaine** et **un secret à provisionner** — là où
   Deepgram donne la diarisation sans rien.
3. **« Diarization is far from perfect »**, écrit le README de WhisperX ; « Overlapping speech is not
   handled particularly well ». Le DER de pyannote 3.1 va de 7,8 % (REPERE) à 50,0 % (AVA-AVD) selon
   le corpus. Un podcast à deux voix propres tombe dans la bonne moitié, un enregistrement
   d'ambiance non.

**Le débit, qui décide du coût.** Le seul chiffre mesuré et publié que j'ai trouvé est le benchmark du
README de faster-whisper v1.1.0 (CUDA 12.4, **RTX 3070 Ti 8 Go**, 13 min d'audio, `beam_size=5`) :

| Configuration | Temps pour 13 min d'audio | Facteur temps réel |
|---|---|---|
| faster-whisper large-v2, fp16 | 1 min 03 s | 12,4× |
| faster-whisper large-v2, fp16, `batch_size=8` | **17 s** | **45,9×** |
| faster-whisper large-v2, int8, `batch_size=8` | 16 s | 48,8× |
| openai/whisper large-v2, fp16 (référence) | 2 min 23 s | 5,5× |

WhisperX annonce « 70x realtime with large-v2 » mais **ne nomme aucun GPU** et son propre README
marque le code de benchmark comme TODO : chiffre fournisseur, non vérifiable, et qui ne couvre que la
transcription (ni alignement, ni diarisation).

**Hypothèses de débit retenues pour le reste du document**, posées explicitement parce qu'elles sont
le seul paramètre non mesuré qui compte :

| Régime | Facteur temps réel | Ce qu'il suppose |
|---|---|---|
| **T-haut** | **40×** | large-v3 batché fp16 sur L4 (`g6.xlarge`), transcription seule, ni alignement ni diarisation. Sous les 45,9× mesurés sur un 3070 Ti, donc prudent. |
| **T-moyen** | **15×** | pipeline WhisperX complet (VAD + transcription + alignement mot + diarisation) sur L4. |
| **T-bas** | **8×** | même pipeline sur T4 (`g4dn.xlarge`, 70 W) en int8. |

Je montre en § 8 que **la conclusion ne dépend pas de ce choix** : même à 40× et avec un démarrage à
froid nul, le seuil de rentabilité reste au-dessus du scénario S2. La bonne façon de trancher ces
trois chiffres serait une demi-journée de POC sur une seule `g6.xlarge` ; ce benchmark ne l'a pas
faite, parce qu'elle ne changerait pas la recommandation.

**CPU et Lambda : structurellement impossible, pas seulement cher.** Le même benchmark donne le
modèle `small` int8 `batch_size=8` à 51 s pour 13 min sur 8 threads d'un i7-12700K — mais `small`
n'est pas un candidat qualité. Extrapolé, large-v3 int8 sur CPU tourne autour de 1 à 2× temps réel,
soit **40 minutes pour un podcast d'une heure**, au-delà du **plafond dur de 15 minutes** d'une
invocation Lambda. Et à 10 Go de mémoire pendant 2 400 s, l'invocation coûterait **0,40 $** pour une
heure d'audio, contre 0,26 $ chez Deepgram. Le chemin « on garde Lambda, on met juste le modèle
dedans » est donc fermé deux fois : par le temps et par le prix. C'est cohérent avec task-105, qui a
retiré `openai-whisper` de `pyproject.toml` précisément parce qu'il tirait PyTorch (~2 Go) dans
l'image.

---

## 4. Les modes d'hébergement sur AWS, chiffrés dans eu-west-3

### 4.1 Ce que la région de Paris offre réellement

Relevé exhaustif des familles d'instances à la demande disponibles dans `EU (Paris)`, lu le
**2026-10-05** dans la carte de prix publique d'AWS (`b0.p.awsstatic.com`, cf. § Sources) :

**Familles GPU présentes** : `g4dn` (T4 16 Go), `g5` (A10G 24 Go), `g6` (L4 24 Go), `gr6` (L4,
mémoire doublée), `inf1`, `inf2`, `p6-b200`. **Absentes** : `g6e`, `p4d`, `p5`, `g4ad`. Il n'y a donc
**pas besoin de sortir d'eu-west-3** pour faire tourner un modèle de la taille de Whisper
large-v3 — la question du transfert inter-région posée par le brief ne se pose pas.

| Instance | GPU | vCPU / RAM | **À la demande** | **Spot (moyenne mesurée)** | Spot / OD | Interruption (Spot Advisor) |
|---|---|---|---|---|---|---|
| `g4dn.xlarge` | 1× T4 16 Go | 4 / 16 Gio | **0,6150 $/h** | **0,1861 $/h** (min 0,1777) | 30,3 % | **< 5 %**, économie annoncée 73 % |
| `g4dn.2xlarge` | 1× T4 16 Go | 8 / 32 Gio | 0,8790 $/h | 0,2268 $/h | 25,8 % | **> 20 %** |
| `g5.xlarge` | 1× A10G 24 Go | 4 / 16 Gio | 1,2770 $/h | 0,3211 $/h | 25,1 % | non listée en eu-west-3 |
| `g6.xlarge` | 1× L4 24 Go | 4 / 16 Gio | **1,0216 $/h** | **0,3523 $/h** | 34,5 % | **15–20 %**, économie annoncée 62 % |
| `g6.2xlarge` | 1× L4 24 Go | 8 / 32 Gio | 1,24095 $/h | 0,3412 $/h | 27,5 % | 10–15 % |
| `c7i.2xlarge` (CPU, repère) | — | 8 / 16 Gio | 0,4242 $/h | — | — | — |

Les prix Spot sont la **moyenne mesurée sur 1 000 relevés horaires du 2026-09-19 au 2026-10-05** via
`ec2 describe-spot-price-history` sur `eu-west-3`, pas une estimation. La dispersion est faible
(`g4dn.xlarge` : 0,1777 à 0,2069 $/h selon la zone).

**Le fait Spot qui compte** : `g6.xlarge` affiche une fréquence d'interruption de **15 à 20 % par
mois** en eu-west-3, et `g4dn.2xlarge` de **plus de 20 %**. Seule `g4dn.xlarge` est sous 5 %. Sur un
chemin de transcription, une interruption Spot signifie une invocation perdue, un message SQS
redélivré et une transcription relancée depuis le début — supportable pour un lot asynchrone, pas
pour une UX où l'utilisateur attend son transcript.

### 4.2 Les charges fixes qu'une instance GPU traîne, même éteinte

| Poste | Tarif eu-west-3 | Hypothèse | Coût mensuel |
|---|---|---|---|
| Volume racine EBS gp3 (image CUDA + poids des modèles) | **0,0928 $/Go-mois** | 40 Go, **persiste machine éteinte** | **3,71 $** |
| Stockage ECR de l'image GPU | **0,10 $/Go-mois** | 10 Go (CUDA + PyTorch + ctranslate2 + pyannote) | **1,00 $** |
| Adresse IPv4 publique | **0,005 $/h** (idle comme in-use) | 1 adresse, allumée en permanence | **3,65 $** |
| CloudWatch (logs + 2 alarmes de plus) | — | ordre de grandeur | ~1,00 $ |
| **Total, configuration allumée en permanence** | | | **≈ 9,36 $/mois (8,34 €)** |
| **Total, configuration scale-to-zero** (IP au prorata) | | | **≈ 6,41 $/mois (5,71 €)** |
| *Alternative* : passerelle NAT au lieu d'une IP publique | **0,05 $/h** + 0,05 $/Go | | **36,50 $/mois (32,52 €)** |

Deux remarques :

- **Le dépôt n'a aucun réseau.** Recherche exhaustive dans `infrastructure/terraform/` : zéro
  `aws_vpc`, zéro `aws_nat_gateway`, zéro `vpc_config`, zéro `aws_instance` — ce dernier point déjà
  constaté par `pricing-challenge` § 3.7. Une instance GPU impose donc de créer un VPC, des
  sous-réseaux sur au moins deux zones, un groupe de sécurité, un profil d'instance IAM, un modèle de
  lancement, puis un ASG ou un environnement de calcul AWS Batch. C'est la première ressource réseau
  du projet.
- **Mise à l'échelle du constat** : la facture AWS `-dev` mesurée par l'owner sur trois mois dans
  Cost Explorer est de **5,93 / 8,11 / 4,90 $** (task-287 § 1.6, cité par `pricing-challenge` § 3.7).
  Les 9,36 $/mois de charges fixes ci-dessus **plus que doublent la facture AWS** avant d'avoir
  transcrit une seule minute. Et la passerelle NAT, à elle seule, coûterait **cinq fois** la facture
  AWS actuelle.

### 4.3 Mode A — GPU allumé en permanence

Coût mensuel = tarif horaire × 730 + charges fixes. Il est **indépendant du volume** jusqu'à
saturation, et la saturation n'arrive jamais à nos échelles : une `g4dn.xlarge` à 8× temps réel
traite **5 840 h d'audio/mois**, une `g6.xlarge` à 15× en traite **10 950** — contre 1 600 h pour S2.

| Configuration | Coût mensuel | Volume Deepgram équivalent | Utilisation GPU à S2 (1 600 h) |
|---|---|---|---|
| `g4dn.xlarge` **Spot** | 135,85 + 9,36 = **145,21 $** | 558 h/mois | 27 % (à 8×) |
| `g4dn.xlarge` à la demande | 448,95 + 9,36 = **458,31 $** | 1 763 h/mois | 27 % |
| `g6.xlarge` **Spot** | 257,18 + 9,36 = **266,54 $** | 1 025 h/mois | 15 % (à 15×) |
| `g6.xlarge` à la demande | 745,77 + 9,36 = **755,13 $** | 2 904 h/mois | 15 % |
| `g5.xlarge` Spot | 234,40 + 9,36 = **243,76 $** | 938 h/mois | — |
| Endpoint SageMaker `ml.g6.xlarge` | 1 044,05 + 6,41 = **1 050,46 $** | 4 040 h/mois | — |

**Lecture** : la colonne « volume Deepgram équivalent » est le volume mensuel au-delà duquel la
machine coûte moins cher que la facture Deepgram. La meilleure ligne — `g4dn.xlarge` Spot — bascule à
**558 h/mois**, soit 2,3× le scénario S1 et 0,35× le scénario S2. Toutes les autres lignes basculent
au-delà de S2.

**Le délai, dans ce mode, est bon** : la machine est chaude, le modèle est en VRAM, un podcast d'une
heure sort en **240 s à 15×** ou 450 s à 8×. C'est 23 à 43× plus lent que les 10,5 s mesurés chez
Deepgram, mais acceptable pour un traitement asynchrone.

### 4.4 Mode B — GPU démarré à la demande, éteint après (Spot inclus)

C'est le mode que le brief demande d'évaluer, et c'est celui où l'arithmétique est la plus brutale.

**Composition du temps facturé par session** (hypothèses explicites, aucune mesurée — cf. § 10) :

| Étape | Durée supposée | Base |
|---|---|---|
| Déclenchement de l'autoscaling sur profondeur de file | 60–120 s | une alarme CloudWatch exige au minimum 2 points de 60 s ; c'est exactement la recette documentée par AWS pour le « scale up from zero » de SageMaker (`EvaluationPeriods: 2`, `Period: 60`), dont le `Cooldown` est de **300 s** |
| Démarrage de l'instance EC2 GPU | 60–90 s | estimation |
| Récupération de l'image de 10 Go depuis ECR, ou amorçage d'une AMI pré-cuite | 60–120 s (0 s avec AMI pré-cuite, mais snapshot à payer) | estimation |
| Chargement de large-v3 ct2 + pyannote en VRAM | 15–30 s | estimation |
| **Total avant la première seconde d'audio traitée** | **≈ 300 s retenus** (fourchette 3,5–6 min) | |

À cela s'ajoute un **temps de drain** : éteindre immédiatement après chaque média fait payer le
démarrage à froid à *chaque* média. Je retiens **600 s de drain** (10 min), la valeur qui amortit une
rafale.

**Coût par média, sur le mix de durées réellement mesuré** (`g6.xlarge` Spot à 0,3523 $/h, 15× temps
réel) :

| Média | Temps facturé | Coût auto-hébergé | Coût Deepgram | Rapport |
|---|---|---|---|---|
| **Média médian (1,01 min)**, avec drain | 904 s | **0,0885 $** | 0,0044 $ | **20,2× plus cher** |
| Média médian, sans drain | 304 s | 0,0298 $ | 0,0044 $ | **6,8× plus cher** |
| Média moyen (3,37 min), avec drain | 914 s | 0,0894 $ | 0,0146 $ | **6,1× plus cher** |
| Podcast de 60 min, avec drain | 1 140 s | 0,1116 $ | 0,2600 $ | 0,43× — **2,3× moins cher** |
| Podcast de 60 min, sans drain | 540 s | 0,0528 $ | 0,2600 $ | 0,20× — 4,9× moins cher |

**C'est le résultat central de ce benchmark.** Le démarrage à la demande est économique **sur un
podcast long** et catastrophique **sur un clip court** — et 97 % des médias mesurés sont des clips
courts. Un modèle facturé au temps d'allumage est structurellement mal adapté à une file dominée par
des reels Instagram et des vidéos TikTok d'une minute.

**Et le scale-to-zero cesse de fonctionner dès qu'il y a des utilisateurs.** Avec un drain de 10 min,
la machine ne s'éteint que si l'intervalle entre deux arrivées dépasse 10 min. Au mix mesuré de
3,37 min/média :

| Scénario | Médias/mois | Arrivées/h | Intervalle moyen | La machine s'éteint-elle ? |
|---|---|---|---|---|
| S0 (1,83 h) | 33 | 0,04 | 22 h | **oui, presque toujours éteinte** |
| S1 (240 h) | 4 273 | 5,9 | **10,3 min** | **non — à la limite exacte du drain** |
| S2 (1 600 h) | 28 487 | 39,0 | 1,5 min | **non, allumée en permanence** |

Donc : le scale-to-zero ne réduit la facture que dans le seul scénario (S0) où Deepgram est déjà
gratuit grâce au crédit. Chiffré : à S0, 16 sessions de 900 s plus 440 s de traitement = 4,20 h
d'instance → 1,48 $ + 6,41 $ de charges fixes = **7,89 $/mois**, contre **0,48 $** chez Deepgram (et
0 $ en réalité, crédit inclus). À S1 et S2, le mode B converge vers le mode A, donc vers les chiffres
du § 4.3.

**Le délai, dans ce mode, est mauvais** : un podcast d'une heure arrivant sur une file vide sort en
**540 à 810 s** (démarrage + traitement), soit 9 à 13,5 min, contre 10,5 s aujourd'hui. Et il y a un
effet de bord d'architecture : 810 s dépasse le **timeout de 600 s** de la Lambda du worker
(`lambda_workers.tf:58-63`) — voir § 9, point 5.

### 4.5 Mode C — SageMaker asynchrone, scale-to-zero managé

C'est la variante « on laisse AWS gérer la machine ». Elle est documentée comme pouvant descendre à
zéro instance : « with Asynchronous Inference you can also scale down your asynchronous endpoints
instances to zero. Requests that are received when there are zero instances are queued for
processing once the endpoint scales up. »

Tarifs eu-west-3, price list `AmazonSageMaker` du 2026-10-04 :

| Usage | Tarif | Remarque |
|---|---|---|
| `AsyncInf:ml.g6.xlarge` | **1,4302 $/h** | +40 % sur l'EC2 `g6.xlarge` à la demande |
| `AsyncInf:ml.g4dn.2xlarge` | 1,0990 $/h | **`ml.g4dn.xlarge` n'est pas offert en AsyncInf** : le plancher g4dn est la 2xlarge |
| `Host:ml.g4dn.xlarge` (endpoint temps réel) | 0,8610 $/h | +40 % sur l'EC2 |
| `Tsform:ml.g4dn.xlarge` (batch transform) | 0,8610 $/h | |
| `Host:ml.g6.xlarge` | 1,4302 $/h | |

Trois raisons de l'écarter malgré la simplicité :

1. **Pas de Spot.** SageMaker Inference ne propose pas de tarif Spot. On perd le levier qui divise le
   prix par trois, et le tarif est 40 % au-dessus de l'EC2 équivalent.
2. **Le démarrage depuis zéro est documenté comme lent.** La recette AWS repose sur une alarme à
   2 points de 60 s et un `Cooldown: 300`, et prévient que sans la politique optionnelle « scale up
   from zero », « this can result in long waiting times for requests in the queue ». Un podcast isolé
   attend donc **au moins 2 min avant que la montée en charge ne commence**, puis le téléchargement
   du conteneur, puis le chargement du modèle, puis 240 s de traitement : **≥ 9 min**.
3. **Le coût au volume est le pire de tous.** Allumé en permanence : 1 050,46 $/mois. Avec un
   remplissage parfait à S2 (107 h d'instance) : 153 $ + 1 $ = 154 $/mois, donc légèrement mieux que
   `g6.xlarge` Spot — mais « remplissage parfait » suppose que l'autoscaling ne sur-provisionne
   jamais, ce que la file réelle (39 arrivées/h en rafales) ne permet pas.

### 4.6 Mode D — AWS Batch sur EC2 GPU

Non chiffré séparément : AWS Batch ne facture rien en propre, le coût est celui des instances EC2 du
§ 4.1 (Spot inclus). Il remplace l'ASG par un ordonnanceur de jobs, ce qui est plus propre pour une
file, mais **ne change aucun des chiffres** : même démarrage à froid, même temps d'allumage facturé,
même tarif. Le seul apport est opérationnel.

**Fargate est hors sujet** : il n'offre pas de GPU.

---

## 5. Les deux repères hors auto-hébergement

### 5.1 AWS Transcribe — le plus cher des quatre

| Fait | Valeur | Source |
|---|---|---|
| Tarif batch, eu-west-3 | **0,0001 $/s = 0,006 $/min = 0,36 $/h** (0,3207 €/h), **sans palier** | price list `transcribe` eu-west-3, 2026-09-11 |
| Même tarif annoncé publiquement | « Batch transcription is priced at $0.006 per minute » (us-east-1) | aws.amazon.com/transcribe/pricing, 2026-10-05 |
| Granularité de facturation | « billed in one-second increments, with no minimum applied » | idem |
| Diarisation, identification de langue | **incluses** : « includes features such as custom vocabularies, vocabulary filtering, speaker diarization, and language identification » | idem |
| Les 11 langues V1 | **toutes en batch** : ar-SA, hi-IN, ja-JP, zh-CN, nl-NL, pt-PT/pt-BR, it-IT, de-DE, es-ES, fr-FR, en-US | doc « Supported languages » |
| Modèle de langue personnalisé | facturé en sus, 0,0001 $/s au palier 1 | price list |

**AWS Transcribe est 38 % plus cher que Deepgram** (0,36 $/h contre 0,26 $/h mesuré), pour une
qualité comparable (4,1 % de WER contre 5,2 % chez Deepgram sur AA-WER v2 — donc meilleur, mais pas
au prix). Il faut noter le point positif : c'est un service managé dans la **bonne région**, sans
sortie de données hors de l'UE, avec diarisation et horodatage inclus. C'est le repère à retenir si
le critère devient la résidence des données plutôt que le prix.

**Note sur Amazon Bedrock Nova 2.0** : les SKU audio existent dans la price list eu-west-3 — Nova 2.0
Pro à 0,00184 $/1 000 tokens audio en entrée, Nova 2.0 Omni à 0,0015 $ — mais **toutes les lignes
portent le suffixe `cross-region-global`**, c'est-à-dire qu'il n'existe pas d'inférence confinée à
l'UE pour ce modèle dans cette région. Et la facturation au token audio n'est pas convertible en
minutes sans un taux tokens/seconde documenté, que je n'ai pas trouvé. Non comparable en l'état ;
Artificial Analysis le situe à 3,10 $/1 000 min (= 0,186 $/h) pour 4,9 % de WER, ce qui en ferait le
service AWS le moins cher — à vérifier avant de s'en servir.

### 5.2 Les API hébergées du modèle open source — le repère qui gagne

C'est la catégorie que le brief demandait « pour situer le chiffre ». Elle fait mieux que situer :
elle tranche.

| Fournisseur / modèle | Poids | Tarif | $/h d'audio | WER (AA-WER v2) | Horodatage mot | Diarisation |
|---|---|---|---|---|---|---|
| **DeepInfra `openai/whisper-large-v3-turbo`** | MIT | **0,00020 $/min** | **0,012 $** | — | via l'API Whisper | non |
| DeepInfra `openai/whisper-large-v3` | MIT | 0,00045 $/min | 0,027 $ | — | oui | non |
| DeepInfra `Qwen/Qwen3-ASR-1.7B` | Apache-2.0 | 0,00045 $/min | 0,027 $ | — | aligneur séparé | non |
| DeepInfra `Qwen/Qwen3-ASR-0.6B` | Apache-2.0 | 0,00020 $/min | 0,012 $ | — | aligneur séparé | non |
| DeepInfra `mistralai/Voxtral-Mini-3B-2507` | Apache-2.0 | 0,00100 $/min | 0,060 $ | 3,8 % | non | non |
| DeepInfra `mistralai/Voxtral-Small-24B-2507` | Apache-2.0 | 0,00300 $/min | 0,180 $ | 2,8 % | non | non |
| **DeepInfra `nvidia/Nemotron-3-Diarization`** | — | **0,00060 $/min** | **0,036 $** | n/a | n/a | **c'est la brique diarisation, jusqu'à 8 locuteurs** |
| **Groq `whisper-large-v3-turbo`** | MIT | — | **0,04 $** | **4,6 %** | **oui** (`verbose_json`, granularité `word`) | non |
| Groq `whisper-large-v3` | MIT | — | 0,111 $ | — | oui | non |
| fal.ai « Wizper » large-v3 | MIT | — | 0,030 $ (source tierce) | 4,7 % | — | — |
| Deepgram `whisper-large` (même fournisseur qu'aujourd'hui) | MIT | 0,0048 $/min | 0,288 $ | — | oui | incluse |
| *Référence* : **Deepgram Nova-3 pre-recorded** | propriétaire | 0,26 $/h mesuré | **0,260 $** | **5,2 %** | oui | **incluse** |
| *Référence* : **AWS Transcribe batch** | propriétaire | 0,006 $/min | **0,360 $** | 4,1 % | oui | incluse |

**Trois faits à retenir.**

1. **Le même modèle open source coûte 4× à 22× moins cher en API qu'en facture Deepgram.**
   `whisper-large-v3-turbo` : 0,012 $/h chez DeepInfra, 0,04 $/h chez Groq, contre 0,26 $/h chez
   Deepgram.
2. **Et il est plus précis que ce qu'on paie.** 4,6 % de WER pour Whisper turbo chez Groq contre 5,2 %
   pour Deepgram Nova-3, sur le benchmark indépendant Artificial Analysis AA-WER v2 (moyenne pondérée
   par la durée sur AA-AgentTalk 50 %, VoxPopuli-Cleaned 25 %, Earnings22-Cleaned 25 %). Ce n'est pas
   un arbitrage prix/qualité : c'est moins cher **et** meilleur.
3. **La diarisation est la seule chose qu'on perd, et elle s'achète séparément pour 0,036 $/h.**
   `nvidia/Nemotron-3-Diarization` chez DeepInfra. Total transcription + diarisation : **0,048 $/h**,
   soit encore **5,4× moins cher que Deepgram** et sans aucune infrastructure. À noter que la
   diarisation est **désactivée par défaut aujourd'hui** (`deepgram_worker.py:94`), donc le chemin
   actuel n'en consomme pas.

**Le délai** : Groq documente des facteurs temps réel de **216× pour turbo** et 189× pour large-v3,
soit ~17 s pour un podcast d'une heure — du même ordre que les 10,5 s mesurés chez Deepgram. Limites
de fichier : 25 Mo en upload direct, 100 Mo en « dev tier », au-delà il faut passer une `url`
(exactement le mode `pull` que le worker sait déjà faire). DeepInfra ne publie pas de latence ; le
modèle étant le même, l'ordre de grandeur est le même, mais **ce point n'est pas vérifié**.

**La réserve honnête sur cette catégorie** : ce sont de petits fournisseurs. Groq et DeepInfra n'ont
ni l'ancienneté, ni les engagements contractuels, ni la résidence de données européenne d'AWS. Pour
un produit qui envoie déjà l'audio de ses utilisateurs à `api.deepgram.com` (aux États-Unis), le
changement de régime juridique est faible mais non nul, et il demande de relire le DPA du fournisseur
retenu avant de signer. C'est un critère non chiffré, et il peut suffire à préférer AWS Transcribe
malgré son prix.

---

## 6. Tableau comparatif

Toutes les colonnes demandées par le brief, pour chaque option. Les prix portent leur date dans
§ Sources. « Délai » = temps entre la mise en file et la disponibilité du transcript, pour un podcast
d'une heure.

| Option | **$/h d'audio** | **Coût fixe $/mois** | **Délai, podcast 1 h** | **Diarisation** | **Horodatage par mot** | **11 langues V1 + détection** | Adaptation | Exploitation |
|---|---|---|---|---|---|---|---|---|
| **Deepgram Nova-3 pre-recorded** *(actuel)* | **0,260** | **0** | **10,5 s mesuré** | **incluse, 0 $** (désactivée par défaut) | oui, `words[]` toutes langues | oui, détection facturée au tarif monolingue | — | aucune |
| AWS Transcribe batch | 0,360 | 0 | non publié ; job asynchrone à interroger | incluse | oui | oui, les 11 en batch | ~2 j (adaptateur + durée) | aucune |
| **API DeepInfra Whisper turbo** | **0,012** | **0** | non publié ; même modèle que Groq | **non** (+0,036 $/h via Nemotron) | oui | oui (99 langues) | ~2 j | aucune |
| API Groq Whisper turbo | 0,040 | 0 | ~17 s (216× annoncé) | **non** | oui, `verbose_json` | oui (99 langues) | ~2 j | aucune |
| Deepgram `whisper-large` | 0,288 | 0 | non mesuré | incluse | oui | oui | **1 variable d'env.** | aucune |
| **Auto-hébergé `g4dn.xlarge` Spot, 24/7** | **0,000 marginal** | **145,21** | 450 s (8×) | pyannote, accès conditionné + token HF | wav2vec2 ; défauts pour `{en,fr,de,es,it}` seulement | oui (Whisper 99 langues) | **8–15 j** | **0,5–1 j/mois** |
| Auto-hébergé `g6.xlarge` Spot, 24/7 | 0,000 marginal | 266,54 | 240 s (15×) | idem | idem | oui | 8–15 j | 0,5–1 j/mois |
| Auto-hébergé `g6.xlarge` OD, 24/7 | 0,000 marginal | 755,13 | 240 s | idem | idem | oui | 8–15 j | 0,5–1 j/mois |
| Auto-hébergé `g6.xlarge` Spot, scale-to-zero | **0,0528–0,1116** *(podcast)* / **0,0298–0,0885** *(clip d'1 min)* | 6,41 | **540–810 s** | idem | idem | oui | **10–18 j** (asynchrone + interruptions Spot) | 1–2 j/mois |
| SageMaker AsyncInf `ml.g6.xlarge`, scale-to-zero | 0,0953 au mieux | 6,41 | **≥ 9 min** depuis zéro (alarme 2×60 s + `Cooldown` 300 s) | idem | idem | oui | 8–14 j | 0,5 j/mois |
| *Rejeté* : Whisper CPU dans Lambda | 0,400 | 0 | **impossible** : 40 min > plafond 15 min | — | — | — | — | — |

**Trois lectures de ce tableau.**

- **La colonne « coût fixe » est la seule qui distingue vraiment les familles.** À gauche, des
  services à 0 $ fixe ; à droite, une machine à 145 à 755 $/mois. Entre les deux il n'y a pas un
  continuum de prix, il y a un changement de nature.
- **La colonne « délai » se dégrade de deux ordres de grandeur dès qu'on auto-héberge** : de 10,5 s
  mesuré à 240–810 s. Ce n'est pas un détail de confort : c'est la différence entre « le transcript
  est là quand l'utilisateur revient sur l'écran » et « il faut une notification push ».
- **La colonne « adaptation » est là où le vrai coût se cache.** Un changement d'API, c'est un
  adaptateur de sortie et une durée à calculer : ~2 jours (§ 9). L'auto-hébergement, c'est le même
  travail **plus** la première infrastructure réseau du projet, une image GPU, la gestion des
  interruptions Spot, une bascule du worker en asynchrone, et deux filtres de métriques à réécrire.

---

## 7. Économie mensuelle par scénario, crédit Deepgram inclus

### 7.1 Le crédit d'abord, parce qu'il annule tout le reste

197,06 $ restants ÷ 0,26 $/h = **757,9 h d'audio achetées et déjà payées**.

| Scénario | Autonomie du crédit | Facture Deepgram brute sur 12 mois | **Décaissement réel sur 12 mois** |
|---|---|---|---|
| **S0** (1,83 h/mois) | **413 mois = 34 ans** | 5,72 $ | **0,00 $** |
| **S1** (240 h/mois) | **3,2 mois** | 748,80 $ | **551,74 $** (491,53 €), soit 45,98 $/mois lissés |
| **S2** (1 600 h/mois) | **0,47 mois = 14 jours** | 4 992,00 $ | **4 794,94 $** (4 271,66 €), soit 399,58 $/mois lissés |

**Conséquence qu'il faut énoncer clairement : au volume actuel, le poste transcription coûte zéro et
continuera de coûter zéro pendant trois décennies.** Toute dépense engagée aujourd'hui pour
« économiser sur la transcription » est une dépense nette. Le crédit n'est pas un détail comptable :
c'est la raison pour laquelle ce benchmark n'a pas de tâche d'implémentation.

### 7.2 Économie mensuelle par option et par scénario

Signe positif = économie par rapport à Deepgram **au tarif de 0,26 $/h** (donc crédit considéré
comme épuisé). Les montants en euros au taux BCE du 2026-10-02.

| Option | **S0** — 1,83 h/mois | **S1** — 240 h/mois | **S2** — 1 600 h/mois |
|---|---|---|---|
| Deepgram Nova-3 *(référence)* | 0,48 $ | 62,40 $ (55,59 €) | 416,00 $ (370,60 €) |
| AWS Transcribe batch | −0,18 $ | **−24,00 $** | **−160,00 $** |
| Deepgram `whisper-large` | −0,05 $ | −6,72 $ | −44,80 $ |
| `g4dn.xlarge` Spot 24/7 | **−144,74 $** | **−82,81 $** (−73,77 €) | **+270,79 $** (+241,24 €) |
| `g4dn.xlarge` OD 24/7 | −457,83 $ | −395,91 $ | −42,31 $ |
| `g6.xlarge` Spot 24/7 | −266,06 $ | −204,14 $ | **+149,46 $** |
| `g6.xlarge` OD 24/7 | −754,65 $ | −692,73 $ | −339,13 $ |
| `g6.xlarge` Spot scale-to-zero | **−7,41 $** | ≈ −204,14 $ *(ne s'éteint plus)* | ≈ +149,46 $ *(ne s'éteint plus)* |
| SageMaker AsyncInf `ml.g6.xlarge` | −6,41 $ | −991,65 $ *(24/7)* | +262,00 $ *(remplissage parfait, irréaliste)* |
| **API DeepInfra Whisper turbo** | **+0,45 $** | **+59,52 $** | **+396,80 $** (+353,50 €) |
| **API turbo + Nemotron diarisation** | **+0,39 $** | **+50,88 $** (+45,33 €) | **+339,20 $** (+302,18 €) |
| API Groq Whisper turbo | +0,40 $ | +52,80 $ | +352,00 $ |

### 7.3 Ce que ce tableau dit, et ce qu'il ne dit pas

- **Aucune configuration auto-hébergée n'économise quoi que ce soit à S0 ou S1.** La meilleure perd
  144,74 $/mois à S0 et 82,81 $/mois à S1.
- **À S2, l'auto-hébergement économise enfin — 270,79 $/mois — mais l'API du même modèle open source
  économise 339,20 $ avec diarisation et 396,80 $ sans.** L'écart en faveur de l'API est de **68 à
  126 $/mois**, et il est obtenu sans un seul fichier Terraform.
- **AWS Transcribe est le seul repère qui coûte plus cher que la situation actuelle**, à tous les
  volumes. Il n'est donc pas un levier de coût : c'est un levier de résidence des données.
- **Ce tableau ne compte pas le temps du développeur.** Les lignes auto-hébergées supposent 0 € de
  construction et 0 € de maintenance. C'est l'objet du § 8.

---

## 8. Le seuil de déclenchement

### 8.1 La forme du problème

L'auto-hébergement est, à nos échelles, un **coût purement fixe** : une seule `g4dn.xlarge` traite
5 840 h d'audio par mois, soit 3,7× le scénario S2. Le coût marginal par heure d'audio est donc nul
jusque-là, et le modèle se réduit à :

```
coût_auto_hébergé(H) = 145,21 $ + exploitation_mensuelle
coût_Deepgram(H)     = 0,26 $ × H
```

Le seuil est donc **H\* = (145,21 + exploitation) / 0,26**, et il ne dépend que d'un paramètre : ce
que vaut le temps du développeur.

### 8.2 Les coûts d'exploitation, posés en hypothèse

**Construction, une fois** : VPC + sous-réseaux + groupe de sécurité + profil IAM + modèle de
lancement + ASG ou AWS Batch (la première infrastructure réseau du projet), image conteneur GPU ou
AMI pré-cuite, pipeline WhisperX, adaptateur de transcript, extraction de durée audio, recâblage du
règlement de quota, bascule du worker en asynchrone, gestion des interruptions Spot et de
l'idempotence en cas de reprise, réécriture des deux filtres de métriques et de l'alarme, plus
l'acceptation manuelle des conditions pyannote et le provisionnement d'un token Hugging Face.
**Estimation : 8 à 15 jours-développeur**, dont 3 à 5 pour la seule parité de forme du transcript
(paragraphes, locuteurs, timings, langue détectée).

**Récurrent** : mises à jour pilote NVIDIA / CUDA, mises à jour de modèle, incidents de capacité
Spot (15–20 % par mois sur `g6.xlarge`), croissance de l'image ECR, astreinte sur un composant sans
SLA fournisseur. **Estimation : 0,5 à 1 jour-développeur par mois.**

Je valorise le jour-développeur à **300 €** — c'est un coût d'opportunité pour un développeur seul,
pas un salaire. L'owner peut le remplacer par ce qu'il veut ; la table ci-dessous est paramétrée.

### 8.3 Le seuil, contre Deepgram

| Valorisation de l'exploitation | **H\*** (h d'audio/mois) | Abonnés Standard à 40 % | Abonnés palier haut à 40 % |
|---|---|---|---|
| **0 $** — le temps de l'owner est gratuit, la construction est un coût irrécupérable | **558 h** | 233 | 35 |
| 100 $/mois | 943 h | 393 | 59 |
| **168 $/mois** (150 €, récurrent seul) | **1 206 h** | 503 | 75 |
| **393 $/mois** (150 € récurrent + 200 € de construction amortie sur 24 mois) | **2 070 h** | 862 | **129** |
| 673 $/mois (300 € récurrent + 300 € amortis) | 3 149 h | 1 312 | 197 |

**Réponse à la question posée** : l'auto-hébergement devient rentable à partir de **≈ 560 h d'audio
par mois** si on ne compte pas le temps du développeur, et de **≈ 2 070 h/mois** en comptant une
exploitation réaliste et la construction amortie. Le scénario S2 (1 600 h/mois, 100 abonnés au palier
haut à 40 % d'usage) **est en dessous de ce seuil**.

### 8.4 Le seuil qui compte vraiment : contre l'API du même modèle

La bonne question n'est pas « auto-héberger ou Deepgram », c'est « auto-héberger ou acheter le même
modèle open source en API ». L'API a un coût fixe nul, donc le seuil explose :

| Comparaison | Exploitation à 0 $ | Exploitation à 168 $/mois |
|---|---|---|
| contre DeepInfra Whisper turbo (0,012 $/h) | **12 101 h/mois** (756 abonnés palier haut) | 26 134 h/mois |
| contre turbo + Nemotron diarisation (0,048 $/h) | **3 025 h/mois** (189 abonnés palier haut) | 6 534 h/mois |
| contre Groq Whisper turbo (0,040 $/h) | 3 630 h/mois (227 abonnés) | 7 840 h/mois |

**Même en offrant le temps du développeur, il faut 3 025 h d'audio par mois — 1,9× le scénario S2 —
pour que la machine batte l'API, et 12 101 h si on renonce à la diarisation (ce que le produit fait
déjà aujourd'hui).** 12 101 h/mois, c'est 5 042 abonnés Standard à 40 % d'usage. Ce n'est pas un
horizon de V1 ; ce n'est pas un horizon du tout.

### 8.5 La robustesse de la conclusion aux hypothèses de débit

Le facteur temps réel (8× / 15× / 40×) est le paramètre que je n'ai pas mesuré. Il **n'influence pas
le seuil**, et c'est important : à nos volumes l'instance est très loin de la saturation (15 à 27 %
d'utilisation à S2), donc le débit décide seulement de la *latence*, pas du coût. Même un débit
infini laisse le coût à 145,21 $/mois, donc le seuil à 558 h/mois contre Deepgram et à 12 101 h/mois
contre l'API.

Le paramètre qui *pourrait* changer la conclusion est l'inverse : **si le débit était beaucoup plus
mauvais que supposé**, il faudrait plusieurs instances à S2, et l'auto-hébergement perdrait encore
plus. La conclusion est donc **monotone dans le bon sens** : elle ne peut que se renforcer.

---

## 9. Ce que la migration casserait

Le brief pose comme acquis que « le viewer de transcript dépend de la sortie Deepgram ». **C'est
faux, et c'est une bonne nouvelle** — il faut le corriger avant de lister le reste, parce que ça
change l'ordre de grandeur du coût d'adaptation.

### 9.1 Ce qui ne casse pas : le viewer et trois des quatre consommateurs

task-231 a tranché « option B » : **l'objet canonique en S3 est du texte UTF-8 brut**, avec les
paragraphes exprimés *en bande* par des lignes vides (`task-231` § 3.3). Les quatre consommateurs du
transcript décodent des octets et traitent de la prose :

| Consommateur | Fichier:ligne | Dépend-il de Deepgram ? |
|---|---|---|
| Worker de traduction | `transcript_translation_worker.py:173` | **non** — `raw_bytes.decode("utf-8")` |
| Génération d'artefacts | `artifact_service.py:310`, `:179-196` | **non** — sha256 des octets + prompt |
| Indexation Algolia | `search_indexing.py:40-77` | **non** — découpage sur les blancs |
| API raw-content | `raw_content_service.py:132` | **non** — et la branche `deepgram_json` a été supprimée (`:502`) |
| Viewer mobile | `mobile/app/media/[id].tsx` | **non** — découpage sur les lignes vides |

Le seul point d'adaptation par fournisseur est **une fonction** :
`media_summarizer/core/services/transcript_formatting.py:110-149`, `deepgram_transcript_text()`. Elle
lit `alt["paragraphs"]["transcript"]`, `alt["paragraphs"]["paragraphs"][].speaker` et
`results.utterances[].speaker`, puis passe le résultat au normaliseur **partagé et agnostique**
`normalize_transcript_text()` (`:64`). Un pipeline WhisperX renvoie
`segments[{start, end, text, speaker?, words[]}]` : il faut écrire une fonction sœur
`whisperx_transcript_text()` d'une trentaine de lignes qui produise **le même texte à lignes vides**,
sans quoi `count_paragraphs()` (`:103-107`) change d'unité et le badge
`mobile/app/media/[id].tsx:1082-1088` devient à nouveau incomparable entre sources (le défaut que
task-231 § 4 avait réparé).

**Une réserve réelle sur cette bonne nouvelle** : `artifact_service.py:179-196`, `:310` utilise le
sha256 des octets du transcript comme empreinte d'idempotence des artefacts. Un autre moteur ASR
produit des octets différents pour le même audio, donc **toute re-transcription invalide les
artefacts déjà générés** et les fait régénérer au coût LLM. Un basculement « en avant seulement »
(nouveaux médias uniquement) est indolore ; un backfill ne l'est pas. Comme rien n'est en
circulation (`CLAUDE.md`, « Nothing is deployed yet »), le basculement en avant est le bon choix et
il n'y a pas de couche de compatibilité à écrire.

### 9.2 Ce qui casse vraiment, par fichier

1. **`deepgram_worker.py:487-505` — la durée audio facturable disparaît.** Le code dit lui-même que
   `metadata.duration` est « the length of audio Deepgram actually processed and billed […] the
   authoritative figure for the audio-minutes quota: every other duration in this pipeline is either
   a producer hint or wall-clock latency (task-250 Layer 2) ». En auto-hébergement il n'y a plus de
   réponse du fournisseur : il faut calculer la durée soi-même (ffprobe ou le décodeur), donc
   **réintroduire la dépendance système ffmpeg que task-105 avait retirée de l'image** précisément
   parce qu'elle n'existait que pour le worker Whisper
   (`task-105-lambda-migration/complement-response-2026-05-30.md:13`, `:79`, `:114`). Tout
   `_settle_audio_quota()` (`deepgram_worker.py:508-595`) et
   `quota_enforcer.settle_transcription_minutes()` pendent à ce nombre.

2. **`orchestrators.py:230-259` — la grille de comptage est câblée sur la chaîne `"deepgram"`.**
   `_AUDIO_BILLED_TRANSCRIPTION_PROVIDERS = frozenset({"deepgram"})` (`:233`) et
   `_audio_seconds_billed_by()` (`:236-259`) renvoient `None` — « ce contenu n'a pas été compté en
   minutes audio » — pour tout provider absent de cet ensemble. **Changer le nom du provider sans
   toucher cette ligne rend silencieusement gratuites toutes les sauvegardes audio.** C'est
   exactement la classe de bug que `pricing-challenge` reproche au chemin Instagram.

3. **`deepgram_worker.py:105-115` et `:628-754` — le mode `pull` disparaît.** Les trois valeurs
   `("pull", "push", "pull_with_push_fallback")` reposent sur le fait que *le fournisseur* va
   chercher l'URL. Avec un GPU à soi, tout est `push` : c'est **nous** qui téléchargeons chaque
   fichier. Mesure rassurante : sur les 35 jobs de dev, **32 sont déjà en `push`** — donc la perte
   est faible. Mais le plafond de 250 Mo en mémoire (`:262`), `_download_audio_for_push_fallback()`
   (`:268-363`) et la machinerie `RemoteContentError` (`:54-61`, `:691-750`) deviennent le **seul**
   chemin et déménagent sur l'hôte GPU.

4. **`deepgram_worker.py:460-505` — l'adaptateur de réponse.** `extract_transcript()` lit
   `results.channels[0].alternatives[0]`, `results.utterances`, `metadata.request_id`,
   `metadata.duration` et `alt.detected_language`. Rien de cette forme ne survit. À noter au passage
   une observation du scan de dev : **les 35 jobs portent `language: "unknown"`** — le
   `detected_language` de Deepgram n'arrive jamais, et c'est `artifact_service.py:757-761` qui
   rattrape avec un `langdetect` local puis `persist_detected_language()`
   (`transcript_translation.py:838-851`). Whisper renvoie la langue détectée explicitement : sur ce
   point précis, une migration **améliorerait** l'existant.

5. **`lambda_workers.tf:58-63` — le worker ne peut plus être synchrone.** La Lambda
   `deepgram_transcription` est à 512 Mo / **600 s**. Un podcast d'une heure auto-hébergé prend 240 à
   450 s de GPU, plus 300 s de démarrage à froid : **540 à 810 s**, ce qui franchit le plafond. Il
   faut passer en soumission + rappel (le `visibility_timeout_seconds = 3600` de `sqs.tf:187` le
   permet, mais la boucle de heartbeat de `deepgram_worker.py:842-867` et le `mark_transcribing()`
   de `:651-654` doivent être repensés). **C'est un changement d'architecture, pas un changement de
   fournisseur** — et c'est la ligne de coût qui sépare les « ~2 jours » d'un changement d'API des
   « 8 à 15 jours » de l'auto-hébergement.

6. **Observabilité : deux filtres de métriques et une alarme deviennent aveugles.**
   `pipeline_dashboard.tf:170-186` filtre sur le littéral `$.transcript_source = "deepgram"` pour
   `deepgram-calls-total` et `deepgram-errors` ; `pipeline_alerts.tf:254-293` en dérive l'alarme
   `deepgram-error-rate-breach` (seuil 5 % sur 15 min) avec son runbook
   `infrastructure/observability/runbooks/pipeline-alerts.md#deepgram-error-rate`. Dès le premier
   message traité par le nouveau worker, les trois cessent de voir quoi que ce soit — sans alarme,
   donc en silence.

7. **Terraform, le reste de l'inventaire** : `runtime_env.tf:65`
   (`DEEPGRAM_TRANSCRIPTION_QUEUE`), `iam_lambda.tf:60` et `:226` (ARN de file dans deux
   politiques), `sqs.tf:176-197` (file + DLQ + redrive), `sqs.tf:428` et `:448` (sorties),
   `lambda_workers.tf:58-63`, `pipeline_dashboard.tf:73`. Plus, côté secrets,
   `logging_config.py:51` qui rédige `deepgram_api_key` : la clé Deepgram disparaît, mais **un token
   Hugging Face apparaît** (gating pyannote) — le secret déménage, il ne s'évapore pas.

8. **Contrats et configuration** : `media_contracts.py:204` énumère
   `native_transcript | deepgram | article_extractor | x_api_lookup | shared_text` dans la
   description d'un champ d'API ; `pricing_config_service.py:145-158` déclare `providers.transcription`
   avec `provider`, `model` et `cost_per_minute_eur: 0.00664` (déjà 1,78× trop haut selon
   `pricing-challenge` § 3.1, et qui redeviendrait faux autrement).

9. **Les sept autres producteurs de transcript ne bougent pas.** `task-231` § 4 recense huit sites
   d'écriture ; Deepgram n'en est qu'un. YouTube, TikTok, X, articles, RSS, orchestrateurs et le
   parsing documentaire écrivent déjà du texte brut par le normaliseur partagé. Une migration de
   transcription **n'est pas une migration de bibliothèque** — c'est le seul endroit où ce dossier
   est plus simple qu'il n'y paraît.

### 9.3 Le coût d'adaptation, résumé

| Chemin | Points 1, 2, 4, 8 (adaptateur, durée, provider, contrat) | Points 3, 5, 6, 7 (architecture, réseau, observabilité) | Total |
|---|---|---|---|
| Changer d'**API** (Groq, DeepInfra, Transcribe) | **oui, ~2 j** | **non** — même worker, même timeout, même file, filtres à renommer seulement | **≈ 2 jours** |
| **Auto-héberger** | oui, ~2 j | **oui, 6 à 13 j** | **8 à 15 jours** |

---

## 10. Risques, et ce que je n'ai pas pu vérifier

### 10.1 Hypothèses non mesurées, et leur effet sur la conclusion

| Hypothèse | Valeur retenue | Comment la vérifier | Effet si elle est fausse |
|---|---|---|---|
| Facteur temps réel de large-v3 batché sur L4 | 40× / 15× / 8× | une demi-journée de POC sur une `g6.xlarge` avec le podcast de 77,85 min déjà en base | **aucun sur le seuil** (§ 8.5) : l'instance est à 15–27 % d'utilisation à S2, le débit décide de la latence seulement |
| Démarrage à froid d'une instance GPU | 300 s (fourchette 210–360 s) | chronométrer un `run-instances` + `docker pull` + chargement modèle | change le coût par média en mode B d'un facteur ~2 ; ne change pas le classement, puisque le mode B converge vers le mode A dès S1 |
| Taille de l'image conteneur GPU | 10 Go | construire l'image | ±1 $/mois sur ECR |
| Latence de DeepInfra | non publiée | un appel de test sur un fichier d'une heure | si elle était mauvaise, Groq (216× documenté) la remplace à 0,04 $/h |
| Mix de durées à S1 / S2 | identique au mix dev mesuré (3,37 min/média) | aucune donnée ne l'appuie, c'est une extrapolation de 35 médias | si les utilisateurs payants écoutent surtout des podcasts longs, le mode B s'améliore ; le mode A, qui gagne déjà, ne change pas |
| 1 jour-développeur = 300 € | hypothèse | l'owner tranche | c'est **le** paramètre du seuil (§ 8.3) |

### 10.2 Ce que je n'ai pas pu vérifier

- **La latence réelle d'AWS Transcribe batch.** Ni la page tarifaire ni la documentation n'annoncent
  de SLA ou d'ordre de grandeur pour un `StartTranscriptionJob`. La colonne « délai » du § 6 reste
  vide pour cette ligne, et c'est une lacune : si Transcribe mettait 15 min sur un podcast, cela
  changerait son intérêt même à résidence des données égale.
- **Le taux tokens audio / seconde d'Amazon Nova 2.0**, sans lequel ses SKU Bedrock ne sont pas
  convertibles en $/h (§ 5.1).
- **Le DPA et la localisation réelle de Groq et DeepInfra.** Non lus. C'est le seul critère qui
  pourrait disqualifier la recommandation et il est hors du périmètre d'un benchmark de coût.
- **La qualité multilingue réelle sur les 11 langues V1.** AA-WER v2 est un indice **anglophone**
  (AA-AgentTalk, VoxPopuli-Cleaned, Earnings22-Cleaned). Les chiffres de WER du § 5.2 ne disent rien
  du japonais, de l'arabe ou du hindi. Le seul repère multilingue trouvé est le tableau de l'éditeur
  Qwen (FLEURS 30 langues : Whisper large-v3 8,16 contre Qwen3-ASR-1.7B 12,60), ce qui place Whisper
  en tête sur l'étendue — mais c'est un chiffre d'éditeur.
- **Le comportement de `whisper-large-v3-turbo` sur les langues faibles.** Sa carte de modèle
  annonce 99 langues et « a minor quality degradation » liée au passage de 32 à 4 couches de
  décodeur, sans tableau par langue. Si le turbo s'effondrait sur l'arabe ou le hindi, le repli est
  `whisper-large-v3` à 0,027 $/h chez DeepInfra ou 0,111 $/h chez Groq — toujours 2,3× à 9,6× moins
  cher que Deepgram.
- **L'unité d'arrondi de Deepgram**, déjà signalée comme non vérifiable par `pricing-challenge`
  § 3.1.

### 10.3 Risques propres à l'auto-hébergement, non monétisés ci-dessus

- **Interruption Spot de 15 à 20 % par mois sur `g6.xlarge`** en eu-west-3 (< 5 % sur
  `g4dn.xlarge`). Chaque interruption = une transcription perdue, un message redélivré, un
  utilisateur qui attend plus longtemps. Rien dans le worker actuel ne gère une reprise partielle.
- **Aucun SLA.** On devient l'exploitant. Pour un développeur seul, un incident GPU un dimanche soir
  est une panne produit, pas un ticket chez un fournisseur.
- **Deux dépendances à accès conditionné** : `pyannote/speaker-diarization-3.1` et
  `speaker-diarization-community-1` exigent d'accepter des conditions d'utilisation et un token HF.
  Une étape humaine dans un pipeline de déploiement automatisé, et un secret de plus à faire tourner.
- **Dérive de l'image.** CUDA, PyTorch, ctranslate2 et pyannote ont des matrices de compatibilité
  étroites. C'est le genre de dépendance qui casse sur une mise à jour mineure, et le dépôt vient
  justement de se débarrasser de PyTorch (task-105).
- **La facture AWS double avant la première minute** (§ 4.2), et la variante NAT la quintuple.

---

## Sources

Aucun prix de ce document ne vient de mémoire. Chaque ligne porte son point de relevé et sa date.

### Tarifs AWS — price lists publiques et appels API en lecture seule

| Donnée | Valeur | Point de relevé | Date |
|---|---|---|---|
| EC2 à la demande, `EU (Paris)` | `g4dn.xlarge` 0,6150 ; `g4dn.2xlarge` 0,8790 ; `g5.xlarge` 1,2770 ; `g6.xlarge` 1,0216 ; `g6.2xlarge` 1,24095 ; `gr6.4xlarge` 1,9538 ; `c7i.2xlarge` 0,4242 $/h | `https://b0.p.awsstatic.com/pricing/2.0/meteredUnitMaps/ec2/USD/current/ec2-ondemand-without-sec-sel/EU%20(Paris)/Linux/index.json` (689 types d'instances) | **2026-10-05** |
| EC2 Spot, `eu-west-3` | moyennes et minima du § 4.1, 1 000 relevés horaires | `aws ec2 describe-spot-price-history --region eu-west-3 --instance-types g4dn.xlarge g4dn.2xlarge g5.xlarge g5.2xlarge g6.xlarge g6.2xlarge --product-descriptions "Linux/UNIX"` | relevés du **2026-09-19 au 2026-10-05** |
| Interruption Spot, `eu-west-3` Linux | `g4dn.xlarge` < 5 % / 73 % d'économie ; `g6.2xlarge` 10–15 % / 70 % ; `g6.xlarge` 15–20 % / 62 % ; `g4dn.2xlarge` > 20 % / 72 % | `https://spot-bid-advisor.s3.amazonaws.com/spot-advisor-data.json` | **2026-10-05** |
| AWS Transcribe, `eu-west-3` | `EUW3-TranscribeAudio` **0,0001 $/s**, sans palier ; CLM 0,0001 → 0,000038 $/s ; rédaction 0,00004 → 0,000015 $/s ; médical 0,00125 $/s | `https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/transcribe/current/eu-west-3/index.json` | price list du **2026-09-11**, lue le 2026-10-05 |
| AWS Transcribe, page publique | « Batch transcription is priced at $0.006 per minute » ; « Streaming … $0.01 per minute » ; diarisation et identification de langue incluses ; facturation à la seconde sans minimum | `https://aws.amazon.com/transcribe/pricing/` | **2026-10-05** |
| AWS Transcribe, langues en batch | les 11 langues V1 présentes (ar-SA, hi-IN, ja-JP, zh-CN, nl-NL, pt-PT/pt-BR, it-IT, de-DE, es-ES, fr-FR, en-US) | `https://docs.aws.amazon.com/transcribe/latest/dg/supported-languages.html` | **2026-10-05** |
| SageMaker, `eu-west-3` | `AsyncInf:ml.g6.xlarge` 1,4302 ; `AsyncInf:ml.g6.2xlarge` 1,5512 ; `AsyncInf:ml.g4dn.2xlarge` 1,0990 ; `AsyncInf:ml.g4dn.4xlarge` 1,7600 ; `Host:ml.g4dn.xlarge` 0,8610 ; `Host:ml.g6.xlarge` 1,4302 ; `Tsform:ml.g4dn.xlarge` 0,8610 $/h — **ni `ml.g5`, ni `AsyncInf:ml.g4dn.xlarge` dans cette région** | `https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonSageMaker/current/eu-west-3/index.json` | price list du **2026-10-04**, lue le 2026-10-05 |
| SageMaker asynchrone, scale-to-zero | « you can also scale down your asynchronous endpoints instances to zero » ; politique de reprise avec alarme `EvaluationPeriods: 2`, `Period: 60`, `Cooldown: 300` ; « this can result in long waiting times for requests in the queue » | `https://docs.aws.amazon.com/sagemaker/latest/dg/async-inference-autoscale.html` | **2026-10-05** |
| Lambda, `eu-west-3` | 0,0000166667 $/Go-s (palier 1) ; 0,0000002 $/requête | `https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSLambda/current/eu-west-3/index.json` | price list du **2026-10-01**, lue le 2026-10-05 |
| EBS gp3, `eu-west-3` | **0,0928 $/Go-mois** | `aws pricing get-products --service-code AmazonEC2`, filtres `location=EU (Paris)`, `productFamily=Storage`, `volumeApiName=gp3` | **2026-10-05** |
| IPv4 publique, `eu-west-3` | **0,005 $/h**, idle comme in-use | `aws pricing get-products --service-code AmazonVPC`, filtre `group=VPCPublicIPv4Address` | **2026-10-05** |
| Passerelle NAT, `eu-west-3` | **0,05 $/h** + 0,05 $/Go traité | `aws pricing get-products --service-code AmazonEC2`, filtre `productFamily=NAT Gateway` | **2026-10-05** |
| ECR, `eu-west-3` | **0,10 $/Go-mois** | `aws pricing get-products --service-code AmazonECR`, filtre `location=EU (Paris)` | **2026-10-05** |
| Bedrock audio, `eu-west-3` | Nova 2.0 Pro 0,00184 $/1 000 tokens audio en entrée ; Nova 2.0 Omni 0,0015 $ — **toutes les lignes en `cross-region-global`** | `https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonBedrock/current/eu-west-3/index.json` | price list du **2026-10-03**, lue le 2026-10-05 |

### Tarifs des fournisseurs de transcription

| Donnée | Valeur | Source | Date |
|---|---|---|---|
| Deepgram, pre-recorded | Nova-3 monolingue **0,0043 $/min** (PAYG) / 0,0036 (Growth) ; multilingue 0,0052 / 0,0043 ; **Whisper Large 0,0048 $/min** ; diarisation et smart formatting « Included » ; crédit d'inscription « Free $200 Credit » | `https://deepgram.com/pricing` | **2026-10-05** |
| Deepgram, tarif réellement facturé | **0,26 $/h** sur la ligne `Nova-3 (Pre-recorded)` ; crédit restant **197,06 $ sur 200 $** | `docs/research/pricing-challenge/README.md` § 3.1, établi sur les exports console fournis par l'owner | 2026-09-09 |
| Groq, speech-to-text | `whisper-large-v3` **0,111 $/h**, 189× temps réel, WER 10,3 % ; `whisper-large-v3-turbo` **0,04 $/h**, 216× temps réel, WER 12 % ; horodatage `word` en `verbose_json` ; **pas de diarisation** ; 25 Mo (free) / 100 Mo (dev) par fichier, `url` au-delà ; minimum facturé 10 s | `https://console.groq.com/docs/speech-to-text` | **2026-10-05** |
| DeepInfra, ASR | `whisper-large-v3-turbo` **0,00020 $/min** ; `whisper-large-v3` 0,00045 ; `Qwen3-ASR-1.7B` 0,00045 ; `Qwen3-ASR-0.6B` 0,00020 ; `Voxtral-Mini-3B-2507` 0,00100 ; `Voxtral-Small-24B-2507` 0,00300 ; `nvidia/Nemotron-3-Diarization` **0,00060 $/min** ; `Nemotron-3.5-ASR-Streaming-Multilingual-0.6b` 0,00020 | `https://deepinfra.com/models/automatic-speech-recognition` et `https://deepinfra.com/openai/whisper-large-v3-turbo` | **2026-10-05** |
| DeepInfra, GPU dédiés | A100 80 Go 0,89 $/GPU-h ; H100 2,20 ; H200 2,69 ; B200 3,69 ; B300 4,89 | `https://deepinfra.com/pricing` | **2026-10-05** |
| Replicate, matériel | T4 0,81 $/h ; L40S 3,51 ; A100 80 Go 5,04 ; H100 5,49 ; CPU 0,36 | `https://replicate.com/pricing` | **2026-10-05** |
| fal.ai, matériel | H100 4,50 $/h (2,49 « as low as ») ; H200 6,00 ; B200 7,99 — **aucun tarif STT sur la page** | `https://fal.ai/pricing` | **2026-10-05** |
| WER comparées, 57 modèles | AA-WER v2 : Deepgram Nova-3 **5,2 %** à 4,30 $/1 000 min ; Amazon Transcribe **4,1 %** à 6,00 ; Groq Whisper turbo **4,6 %** à 0,67 ; fal.ai Wizper large-v3 4,7 % à 0,50 ; DeepInfra Voxtral Mini 3,8 % à 1,00 ; Voxtral Small 2,8 % ; Bedrock Nova 2 Pro 4,9 % à 3,10 ; Parakeet TDT 0.6B v2 6,4 %. Métrique : moyenne pondérée par la durée sur AA-AgentTalk (50 %), VoxPopuli-Cleaned-AA (25 %), Earnings22-Cleaned-AA (25 %) | `https://artificialanalysis.ai/speech-to-text` | **2026-10-05** |
| Taux de change | référence BCE, 1 EUR = **1,1225 USD** → 1 USD = 0,890869 EUR | `https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml` | taux du **2026-10-02**, lu le 2026-10-05 |

### Modèles et pipelines open source

| Donnée | Source | Date |
|---|---|---|
| Benchmark faster-whisper (large-v2 fp16 `batch_size=8` : 17 s pour 13 min sur RTX 3070 Ti, CUDA 12.4 ; int8 16 s ; non batché 1 min 03 s ; `small` CPU int8 `batch_size=8` 51 s sur 8 threads i7-12700K) | `https://github.com/SYSTRAN/faster-whisper` | **2026-10-05** |
| WhisperX : « 70x realtime with large-v2 » (sans GPU nommé, code de benchmark en TODO) ; « < 8GB gpu memory for large-v2 with beam_size=5 » ; alignement wav2vec2 par défaut pour `{en, fr, de, es, it}` seulement ; diarisation via `pyannote/speaker-diarization-community-1` avec `--hf_token` et acceptation des conditions ; « Diarization is far from perfect » ; licence BSD-2-Clause | `https://github.com/m-bain/whisperX` | **2026-10-05** |
| pyannote 3.1 : licence MIT, **accès conditionné** (« You need to agree to share your contact information »), conditions à accepter aussi sur `pyannote/segmentation-3.0`, token HF requis, DER de 7,8 % (REPERE) à 50,0 % (AVA-AVD), renvoi commercial vers pyannote.ai | `https://huggingface.co/pyannote/speaker-diarization-3.1` | **2026-10-05** |
| Whisper large-v3-turbo : 99 langues, 809 M paramètres, décodeur ramené de 32 à 4 couches, « minor quality degradation », WER moyenne 7,83 / RTFx 200,19 sur l'Open ASR Leaderboard | `https://huggingface.co/openai/whisper-large-v3-turbo` | **2026-10-05** |
| Voxtral-Mini-3B-2507 : Apache-2.0, **8 langues** (en, es, fr, pt, hi, de, nl, it), ~9,5 Go de VRAM en bf16, pas d'horodatage mot ni de diarisation documentés | `https://huggingface.co/mistralai/Voxtral-Mini-3B-2507` | **2026-10-05** |
| Qwen3-ASR-1.7B : Apache-2.0, 30 langues + 22 dialectes chinois, WER meilleure que Whisper large-v3 sur la plupart des corpus mais **12,60 contre 8,16 sur FLEURS 30 langues**, LID 97,9 % contre 94,1 %, horodatage par mot via `Qwen3-ForcedAligner-0.6B` **limité à 11 langues** (ni nl, ni ar, ni hi), pas de diarisation | `https://huggingface.co/Qwen/Qwen3-ASR-1.7B` | **2026-10-05** |

### Relevés effectués dans le compte AWS — tous en lecture seule

| Relevé | Résultat | Commande | Date |
|---|---|---|---|
| Latence et durée des transcriptions Deepgram en dev | 35 jobs, 118,0 min d'audio, 128,9 s d'appel cumulés ; podcast de 4 670,85 s rendu en **10,53 s** (443×) ; médiane 1,01 min d'audio ; 34/35 sous 3 min ; `language: "unknown"` sur les 35 | `aws dynamodb scan --table-name processing_jobs-dev --projection-expression transcription_metadata` (105 éléments) | **2026-10-05** |
| Inventaire des tables dev | 23 tables, dont `processing_jobs-dev` | `aws dynamodb list-tables --region eu-west-3` | **2026-10-05** |

### Références de code et de documents du dépôt

- `media_summarizer/workers/transcription/deepgram_worker.py` : `:54-61` et `:691-750`
  (`RemoteContentError`), `:94` (diarisation désactivée par défaut), `:118-129` (paramètres de
  requête), `:105-115` (modes), `:262` (plafond 250 Mo), `:268-363` (téléchargement push),
  `:460-505` (`extract_transcript`, dont `:487-504` la durée facturable), `:508-595`
  (`_settle_audio_quota`), `:628-754` (routage des modes), `:842-867` (heartbeat).
- `media_summarizer/core/services/transcript_formatting.py` : `:64` (`normalize_transcript_text`),
  `:103-107` (`count_paragraphs`), `:110-149` (`deepgram_transcript_text`).
- `media_summarizer/core/media_ingestion/adapters/orchestrators.py:230-259` (grille de comptage).
- `media_summarizer/core/services/transcript_translation.py:822-851` (langue source et persistance).
- `media_summarizer/core/services/artifact_service.py:179-196`, `:310`, `:757-761`.
- `media_summarizer/core/services/pricing_config_service.py:145-158`.
- `media_summarizer/api/models/media_contracts.py:204`.
- `media_summarizer/utils/logging_config.py:51`.
- `infrastructure/terraform/modules/platform/lambda_workers.tf:58-63`, `sqs.tf:176-197`, `:428`,
  `:448`, `runtime_env.tf:65`, `iam_lambda.tf:60`, `:226`, `pipeline_dashboard.tf:73`, `:170-186`,
  `pipeline_alerts.tf:254-293`.
- `docs/research/pricing-challenge/README.md` § 3.1 (facture Deepgram, crédit), § 3.7 (baseline AWS
  mesuré, absence d'EC2), § R.2 et § R.3 (barème et paliers).
- `docs/research/task-231-transcript-formatting/README.md` § 2.1, § 3.1, § 3.3, § 4, § 6.7.
- `docs/research/task-105-lambda-migration/README.md:41`, `:125`, `:484`, `:498` et
  `complement-response-2026-05-30.md:13`, `:79`, `:114` (retrait d'`openai-whisper` et de ffmpeg).
- `docs/research/task-189-transcript-translation-benchmark/README.md` § V1 Languages Supported
  (les 11 langues).
- `docs/V1_LAUNCH_PLAN.md` § 2 (Small Business Program accordé, commission de 15 %).
- `CLAUDE.md` et `AGENTS.md`, section « Nothing is deployed yet » (pas de base installée, donc pas de
  couche de compatibilité à écrire).
