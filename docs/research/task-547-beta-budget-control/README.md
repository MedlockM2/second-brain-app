---
owner_decision: ok
---

# Benchmark : contrôle du budget fournisseur de la bêta

## Owner Validation

**Decision**: *Recommandation acceptée sur le principe (réserver avant l'appel, régulariser après), avec les règles de la section « Décision de l'owner : règles d'implémentation » ci-dessous, qui priment sur les sections 1 à 7 en cas de divergence. Pour chaque appel payant, calculer son coût maximal à partir des métadonnées (durée, pages, tokens) ; au-delà d'une limite par élément, refuser (240 min, 100 pages, sortie plafonnée) ; quand la mesure échoue, réserver le plafond. Retirer ce montant avant l'appel, en une seule écriture conditionnelle. Résultat livré : régulariser sur le coût réel. Pas de résultat livré : tout rendre au testeur ; le coût de l'échec est à la charge de l'opérateur et suivi à part. Les reprises restent limitées. Une panne du compteur refuse le traitement. Tous les chemins payants passent par ce contrôle. L'aperçu et la traduction automatiques sont réservés avec l'import ; sortie de traduction plafonnée à 1,5 fois les tokens envoyés. Un contenu déjà traité pour un autre compte est débité au nouveau compte comme s'il avait été traité pour lui. Le pourcentage affiché est la consommation régularisée, sans les réservations en cours. Aucune remise de capacité manuelle pendant la bêta. Mois calendaire UTC, taux BCE du jour tenu à jour automatiquement (dernier taux conservé en cas d'échec), pas de marge supplémentaire. Recherche Algolia hors enveloppe.*
**Validated at**: 2026-10-27

## Décision de l'owner : règles d'implémentation

Cette section est la référence de TASK-548 et TASK-549. Elle remplace notamment la recommandation sur l'issue incertaine (§ 4, étape 6), le refus systématique des chemins non bornés (§ 5), l'objectif d'une garantie démontrée, le change (§ 6) et, pour la réutilisation entre comptes, la règle « réutilisation à zéro » de R.2 (§ 6, contenu partagé).

### Principe

1. **Mesurer avant d'appeler.** Pour chaque appel payant, lire les métadonnées qui donnent la quantité facturée (durée, pages, feuilles, tokens) et en déduire le coût maximal au barème versionné.
2. **Limite par élément.** Au-delà, l'import ou l'action est refusé avec un code typé, comme l'actuel `item_too_long`. Ce n'est pas un refus de budget.
3. **Mesure impossible : réserver le plafond par élément.** Ne jamais refuser un partage légitime parce que les métadonnées sont illisibles (décision task-250 maintenue) ; ne jamais débiter une valeur provisoire minimale à la place (supprimer la minute provisoire actuelle).
4. **Admission atomique.** Vérifier le disponible et réserver en une seule écriture DynamoDB conditionnelle. Aujourd'hui, `check_submission_allowed` puis `record_transcription_minutes` sont deux opérations séparées (`quota_enforcer.py`) : c'est la course à fermer.
5. **Pas de résultat livré, pas de débit.** Résultat livré à l'utilisateur : régulariser sur le coût réel (métriques fournisseur). Échec, timeout, flux coupé, résultat illisible ou non persisté : libérer toute la réservation. Il n'existe pas d'état où le testeur garde une capacité bloquée pour une issue inconnue. Le coût fournisseur de l'échec reste enregistré comme dépense opérateur, séparée du compteur du testeur, et suivi par TASK-552.
6. **Reprises.** Chaque nouvelle tentative réserve à nouveau ; leur nombre reste borné (configuration existante des workers). Un repli de fournisseur (Unstructured) est une tentative distincte avec sa propre réservation.
7. **Panne du compteur : refuser.** Le comportement actuel « fail open » de `check_submission_allowed` est supprimé pour la bêta. La lecture des contenus et résultats existants reste accessible.
8. **Dépassement résiduel accepté.** Un écart entre la mesure amont et la quantité finalement facturée (publicités insérées à la volée dans un podcast, pagination LlamaParse légèrement différente) est régularisé sur le réel, même au-delà de 5 EUR. Il n'est ni masqué ni bloquant ; la prochaine admission est refusée naturellement.
9. **Couverture.** Aucun chemin payant ne contourne le contrôle (périmètre TASK-549).
10. **Aperçu et traduction réservés avec l'import.** L'aperçu `review_blurb` et la traduction du texte complet partent seuls après l'import (`review_blurb_service.py`, `ingestion_translation_service.py`) ; ils sont débités comme toute dépense (R.2), ce qui supprime le « no quota is debited » actuel de l'aperçu. À la soumission, la réservation de l'import = coût fournisseur de l'import + aperçu + traduction. La traduction est réservée sauf si la langue du contenu est déjà connue et égale à la langue de lecture ; si elle s'avère inutile, sa part est libérée. Le texte produit est estimé depuis la mesure amont : environ 200 tokens par minute de parole, environ 700 tokens par page ; l'écart avec le texte réel est régularisé (règle 8). Une seule décision pour l'utilisateur : l'import complet est admis, ou refusé dès la soumission. Une traduction relancée plus tard (`/raw-content`, nouvelle langue sur un enregistrement dédupliqué) réserve à ce moment-là ; sans budget, le texte d'origine est affiché, comme pour une traduction en échec.
11. **Plafond de sortie de la traduction : 1,5 fois les tokens d'entrée envoyés**, passé en `max_completion_tokens` à chaque appel.
12. **Contenu déjà traité pour un autre compte : débité au nouveau compte.** Quand B enregistre un média déjà traité pour A, B est débité de la valeur régularisée de ce traitement (import, et traduction si elle existe déjà dans sa langue de lecture), comme s'il avait été fait pour lui, même sans nouvel appel fournisseur. Cette règle remplace, pour la réutilisation entre comptes, le « réutilisation sans nouvel appel à zéro » de R.2 ; c'est une marge pour l'opérateur. Le coût valorisé du traitement d'origine doit donc être conservé avec le contenu. Si B n'a plus le budget correspondant, l'enregistrement est refusé comme un nouveau traitement. Un même compte qui réenregistre un média qu'il détient déjà reste à zéro (task-281). Consultation, lecture et organisation restent gratuites.
13. **Pourcentage affiché : consommation régularisée seule**, sans les réservations en cours.
14. **Pas de remise de capacité manuelle** pendant la bêta : la règle 5 couvre le cas d'un échec.
15. **Change : taux BCE du jour, tenu à jour automatiquement.** Le taux EUR/USD est une clé de `pricing_config` (taux + date de publication), créée par TASK-548 avec la valeur de départ 1,1188 (BCE, 26 octobre 2026). Chaque réservation lit le taux courant et l'enregistre sur la tentative. Une tâche planifiée quotidienne (TASK-559) le met à jour depuis le fichier public de la BCE ; en cas d'échec, le dernier taux reste en place. Aucun refus de traitement à cause du taux : il ne sert qu'à convertir des tarifs en dollars vers le budget en euros.
16. **Réglages hérités du système en minutes.** Supprimer les alertes quotidiennes `burst_guards` de `pricing_config_service.py` (config et table) : le budget les remplace. Les plafonds des forfaits gratuits partagés (`provider_pools`, LlamaParse et Apify) protègent les comptes fournisseurs de l'opérateur, pas le budget du testeur : hors périmètre de ce contrôle ; leur sort est décidé par TASK-557 (forfaits gratuits puis bascule sur crédit provisionné).

### Mesure en amont, par type

Constat de l'owner et de l'analyse du 2026-10-27 sur le code actuel.

| Type | Mesurable avant l'appel ? | Comment | Si la mesure échoue | Limite par élément |
|---|---|---|---|---|
| **Audio et vidéo transcrits** (podcast, Spotify résolu via PodcastIndex, RSS, upload, YouTube sans sous-titres, audio TikTok/Instagram) | Oui, dans la quasi-totalité des cas | Déjà en place : `audio_quota_gate.gate_audio_transcription` → `audio_duration_probe` (métadonnées connues, sinon en-tête du fichier par requêtes Range, 5 s max ; MP3, M4A, Ogg, WAV, FLAC). Seul point d'entrée de tous les producteurs Deepgram. | Réserver le plafond (240 min ≈ 0,92 EUR) au lieu de la minute provisoire actuelle | 240 min (`max_minutes_per_item`, à reprendre dans la configuration bêta en euros) |
| **PDF** | Oui, exact | Compter les pages depuis l'objet S3 avant l'envoi à LlamaParse (arbre des pages ; bibliothèque légère type `pypdf`, à ajouter aux dépendances du worker) | Réserver le plafond | 100 pages |
| **Images** (JPG, PNG, BMP, HEIF) | Oui | 1 page | — | — |
| **TIFF** | Oui, exact | Nombre de frames via Pillow (déjà en dépendance) | Réserver le plafond | 100 pages |
| **PPTX** | Oui, exact | Nombre de diapositives = nombre d'entrées `ppt/slides/slideN.xml` de l'archive | Réserver le plafond | 100 pages |
| **XLSX** | Oui, exact | Nombre de feuilles dans `xl/workbook.xml` ; LlamaParse facture la feuille comme unité | Réserver le plafond | 30 feuilles |
| **DOCX** | Non, pas de façon fiable | Un DOCX n'a pas de pages avant rendu ; le champ `Pages` de `docProps/app.xml` est souvent absent ou périmé. Ne pas s'en servir comme borne. | Réserver toujours le plafond, régulariser sur les pages facturées | 100 pages |
| **TXT, MD, RTF** | Sans objet | Aucun fournisseur appelé | — | — |
| **Repli Unstructured** | Oui | Même nombre de pages que la mesure amont, au tarif Unstructured | Réserver le plafond | Même limite ; repli refusé si le disponible ne suffit pas (import en échec, message clair) |
| **Génération IA** (résumé, notes, cartes, quiz, dossier ; aperçu automatique réservé avec l'import, règle 10) | Oui | Entrée : tokens de la requête complète (instructions, schéma, corpus) mesurés avant envoi ; sortie : `max_completion_tokens` configuré (32 000 dans `llm_config.py`) | Réserver l'entrée maximale acceptée par le modèle | Entrée et sortie plafonnées |
| **Chat** | Oui | Corpus + instructions + question + historique transmis, sortie plafonnée | Idem | Idem |
| **Traduction du texte complet** | Oui, après correction | Réservée avec l'import (règle 10) ; entrée estimée depuis la durée ou les pages, puis mesurée avant l'appel ; **ajouter `max_completion_tokens` = 1,5 × tokens d'entrée**, absent du payload actuel. Réserver au prix du modèle configuré (bascule sur Luna : TASK-556) | Idem | Sortie ≤ 1,5 × entrée |
| **Post X** | Oui : prix fixe | `x_ingestion_worker.py` lit un post par l'API X v2, facturée à l'usage. Mesure du 2026-10-28 sur le compte dev, avec les paramètres exacts du worker (expansions `author_id` et `attachments.media_keys`) : 6 posts lus, 4 auteurs et 4 médias renvoyés, solde prépayé passé de 4,98 à 4,95 USD, soit 0,03 USD = 6 × 0,005. Seul le post est facturé, pas les objets auteur ou média renvoyés par expansion. Réserver 0,005 USD par post et régulariser à ce montant (l'API ne renvoie pas de coût par requête) ; un même post relu le même jour UTC n'est pas refacturé par X. | — | Un post |
| **YouTube (sous-titres), TikTok, Instagram (Apify)** | Oui : prix fixe connu | Un lien accepté par le classifieur (`classifiers.py`) désigne une seule vidéo ou un seul post, et l'input envoyé demande un seul élément ; chaque programme est facturé à l'événement, un résultat par import, sans frais de démarrage ni usage plateforme. Réserver le prix d'un résultat (tableau ci-dessous), régulariser sur les événements facturés du run. Pas de `maxTotalChargeUsd`. | — | Un résultat par run |

### Prix Apify à réserver

Relevés sur les pages publiques des programmes le 2026-10-27. Valeur réservée = prix d'un résultat au plan Free (le plus cher listé) ; utiliser le prix du plan effectivement souscrit quand il change, en le versionnant comme les autres tarifs.

| Média | Programme (défaut de `apify_adapter.py`) | Input envoyé | Prix par résultat | Réservation |
|---|---|---|---|---|
| YouTube avec sous-titres | `starvibe/youtube-video-transcript` | `youtube_url` (une URL) | 5,00 USD / 1 000 ; échecs non facturés | 0,005 USD |
| TikTok | `scrape-creators/best-tiktok-transcripts-scraper` | `videos: [url]` | 1,00 USD / 1 000 | 0,001 USD |
| Instagram reel | `apify/instagram-reel-scraper` | `resultsLimit: 1`, sans option payante | 2,60 USD / 1 000 (Free), 2,30 (Starter) | 0,0026 USD |
| Instagram post / carrousel | `apify/instagram-post-scraper` | `resultsLimit: 1`, sans option payante | 2,70 USD / 1 000 (Free), 2,30 (Starter) | 0,0027 USD |

**Instagram : réservation en deux temps.** Pour un reel ou un carrousel, Apify est la seule source de la vidéo ou des images (yt-dlp bloqué et supprimé, task-310) : la durée de l'audio et le nombre d'images ne sont connus qu'après le run. Réserver d'abord le prix Apify ; à la réponse, réserver Deepgram (durée exacte, `videoDuration`) ou l'OCR (nombre d'images), plus l'aperçu et la traduction, avant de les lancer. Si cette seconde réservation est refusée, l'import échoue avec un message de budget épuisé, rien n'est débité au testeur et le prix Apify reste une dépense opérateur (règle 5). Pour tous les autres types, toutes les quantités sont connues avant le premier appel payant : la réservation est la somme des étapes, prise en une fois.

Les options payantes des programmes Instagram (`includeTranscript`, `includeDownloadedVideo`, `includeMusicData`, `dataDetailLevel` détaillé) ne sont pas demandées : la transcription d'un reel passe par Deepgram et suit la ligne audio, l'OCR des images d'un carrousel suit sa propre ligne. Ne pas en activer une sans ajouter son prix ici. Si l'identifiant de programme configuré dans Secrets Manager diffère du défaut, relever son prix avant de le réserver.

Les forfaits gratuits partagés (LlamaParse, Apify) sont valorisés comme des dépenses réelles : ils deviendront payants après la mise en production.

## Recommendation

Conserver les fournisseurs et modèles retenus. Ajouter un registre durable de réservations par tentative fournisseur, avec admission atomique sur le compte et le mois, puis régularisation sur les métriques réelles. Refuser un appel si son coût maximal ne peut pas être borné. Une réservation dont l'appel a peut-être commencé reste engagée jusqu'à preuve de son coût ; son expiration technique ne rend jamais du budget disponible.

C'est une **proposition**, pas un contrôle déjà livré. Le plafond démontrable est celui de la consommation valorisée au barème et au change versionnés. Un plafond de facture bancaire en euros exige en plus un taux de conversion effectivement garanti, la couverture des frais et taxes applicables et des limites contractuelles de facturation fournisseur. Le taux BCE seul ne le garantit pas. Ne pas promettre que tous les chemins actuels satisfont déjà ces conditions.

Recherche du 2026-10-26, finalisée le 2026-10-27 (Europe/Paris). Aucun appel payant, aucun changement de code, aucune inspection de credentials. Les observations du dépôt sont des faits locaux ; les mesures historiques de septembre restent datées et ne sont pas des mesures refaites aujourd'hui.

## 1. Décisions acquises et périmètre

[Décision propriétaire R.1–R.2](../pricing-challenge/README.md) : 5 EUR par compte et par mois, sans report ; coûts fournisseurs d'usage hors infrastructure fixe ; toutes les fonctions actuelles ; prix normaux hors promotions et volumes gratuits ; cache au tarif réellement appliqué ; réutilisation sans nouvel appel à zéro. L'interface montre un pourcentage, sans euros, crédits ni vente. Lecture, organisation et résultats disponibles restent accessibles. Ce benchmark ne recalcule ni la générosité de l'enveloppe ni les abonnements futurs.

Trois grandeurs distinctes :

- **Valorisation mesurée** : unités effectivement facturables × tarifs normaux versionnés. Un appel payé par un crédit promotionnel entre dans cette somme.
- **Engagement prudent** : réservations non régularisées ; ce n'est pas une mesure réelle. Il réduit la capacité disponible sans se faire passer pour un coût confirmé.
- **Facture** : usage après remises/crédits, abonnements, taxes et conversion bancaire. Elle peut différer des deux premières grandeurs.

Le [contrôle TPM validé en task-459](../task-459-llm-token-rate-control/README.md) reste indépendant : acquérir la capacité de débit avant d'engager la tentative payante, ou libérer une réservation uniquement quand on prouve qu'aucune requête n'est partie. Ne pas modifier son algorithme. Les refus de budget ne doivent pas empêcher la lecture d'un résultat disponible.

## 2. Inventaire des chemins accessibles

Inspection des fichiers du checkout du propriétaire, avec modifications locales présentes le 26 octobre. Le tableau est exhaustif pour les familles de dépenses de R.2 ; il distingue les services annexes qui ne sont pas des traitements de contenu. Une limite de taille en octets ou un timeout HTTP n'est pas à elle seule une limite de coût.

| Chemin et points d'intégration | Unités réelles / borne avant appel | Conditions de maîtrise |
|---|---|---|
| Résumé, notes, cartes mémo, quiz, dossier ou média : `workers/artifact_generator/worker.py` → `core/services/llm_client.py` | Entrée complète, sortie incluant raisonnement, catégories cache ; sortie configurée à 32 000 tokens dans `llm_config.py` | Borner la requête complète, schéma et historique inclus ; `n=1`, modèle/mode/région fixés. Aucun outil payant implicite. Réserver le tarif d'entrée le plus cher applicable, pas une remise de cache supposée. |
| Aperçu automatique : `review_blurb_service.py` → même client | Même famille, appel distinct | Ne pas le considérer comme inclus dans le prix d'import. Cache disponible : zéro nouvel appel. |
| Chat : `workers/chat_worker.py` → `llm_client.stream` | Corpus + instructions + question + historique ; sortie plafonnée | Ne pas prendre la longueur affichée comme sortie totale. Un arrêt du lecteur peut perdre les métriques finales. |
| Traduction du transcript : `core/services/transcript_translation.py`, worker dédié | GPT-5-nano configuré ; chaque appel et chacune des tentatives | Le payload actuel n'a pas de `max_completion_tokens` : ajouter un plafond explicite dans l'implémentation, ou réserver toute la sortie maximale documentée du modèle. Les 3 tentatives configurées ne constituent pas un seul appel. |
| Audio de podcast, vidéo et audio partagé : `workers/transcription/deepgram_worker.py`, `utils/deepgram_dispatch.py` | Secondes réellement traitées, canaux et options facturées | Inspecter le fichier réellement envoyé ; durée distante annoncée insuffisante. Le repli pull → push est une tentative séparée si le premier appel a pu coûter. Réserver un arrondi prudent tant que l'arrondi contractuel applicable n'est pas établi. |
| YouTube : `infrastructure/apify_adapter.py`, orchestration et webhook | Starvibe : 0,005 USD/résultat au relevé public | Pour un acteur pay-per-result, imposer le plafond de résultats **facturés**, pas seulement une propriété de son input. Inclure tous les autres événements facturables applicables. |
| TikTok, Instagram posts/reels/carrousels : même adaptateur + resolvers | Événements selon acteur/build/plan ; collecte puis éventuellement audio ou OCR | Le prix « from » n'est pas une borne. Lire le schéma de prix applicable ; plafonner chaque run et chaque événement, ou refuser. Le nombre d'images et le coût aval sont également bornés. |
| PDF, images/photos, documents : `core/services/document_parsing_service.py` → `llamaparse_resolver.py` | Mode v1 retenu : 3 crédits/page ; feuille : 1 crédit ; crédit fournisseur à 0,00125 USD | Fixer explicitement mode et options. Compter les pages/feuilles locales ; n'accepter que les formats dont les unités facturées sont bornées. Une pagination inconnue doit être bornée par un réglage fournisseur fiable ou refusée. |
| Repli document : `unstructured_resolver.py` | 0,015 USD/page, distinct du premier parseur | Réserver le repli **en plus** d'un premier essai peut-être facturé ; ne pas rembourser automatiquement le premier sur erreur. Vérifier la convention de page par format. |
| Article/page, texte/note : resolvers locaux | Extraction locale : zéro fournisseur ; aperçu et traduction restent payants | Ne pas facturer un forfait d'import ; contrôler les appels automatiques issus de l'extraction. |
| Digest : `core/services/digest_service.py` | Assemblage sur les données de bibliothèque, sans nouvelle génération automatique dans ce service | Consultation à zéro nouvel appel ; une action IA ultérieure suit son propre chemin ci-dessus. |
| Recherche : `search_indexing_worker.py`, adaptateur Algolia et recherches podcast | Requêtes/stock de records, plans de services annexes | Ne pas attribuer arbitrairement un prix par chunk : tarif et plan doivent être vérifiés. Le stockage durable relève du périmètre infrastructure exclu ; un coût variable de recherche facturé exige un budget opérateur séparé, car bloquer la consultation contredirait la décision produit. |

Pas de nouveau podcast synthétique : task-386 attend une décision, donc ce fournisseur hypothétique n'est pas dans les fonctions actuelles. Pas de benchmark de remplacement de modèle, de transcription ou d'OCR dans cette tâche. Les services d'auth, notifications, stores et distribution ne sont pas un traitement payant de contenu au sens de R.2 ; leurs frais éventuels ne deviennent pas implicitement une dépense du testeur.

### Tarifs et preuves

Toutes les pages ci-dessous ont été consultées le 26 octobre 2026. Les tarifs R.2 restent la référence à versionner, pas des constantes immuables.

- [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna) : Standard, par million entrée/cache/écriture/sortie : 0,10/0,01/0,125/0,50 USD en contexte court ; 0,20/0,02/0,25/0,75 en contexte long. Le seuil concerne l'entrée totale. [GPT-5-nano](https://developers.openai.com/api/docs/models/gpt-5-nano) : 0,05/0,005/0,40 USD entrée/cache/sortie. Vérifier modèle réellement renvoyé et modalités de traitement.
- [Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create) : `max_completion_tokens` borne sortie visible et raisonnement ; le dernier bloc `usage` peut manquer sur interruption. [Cache](https://developers.openai.com/api/docs/guides/prompt-caching) : les catégories d'entrée se remplacent, elles ne s'additionnent pas sur les mêmes tokens. Ne pas additionner les tokens de raisonnement une seconde fois.
- [Deepgram pricing](https://deepgram.com/pricing) et [API prerecorded](https://developers.deepgram.com/docs/pre-recorded-audio) : tarif batch mono R.2 de 0,0043 USD/min ; métadonnées durée et canaux après traitement. L'export propriétaire de septembre documente un prix appliqué et des options, pas une garantie contractuelle future. La FAQ d'arrondi n'était pas lisible dans la page récupérée : ne pas inventer une précision contractuelle.
- [LlamaParse pricing](https://developers.llamaindex.ai/llamaparse/general/pricing/) : mode Cost-effective 3 crédits/page, feuilles à unité distincte ; options et stockage retenu peuvent ajouter des charges. Une réanalyse peut être gratuite sous 48 h ; ne déduire ce cache qu'après confirmation. La page annonce des fichiers éphémères non facturés en stockage ; vérifier la capacité de l'endpoint v1 utilisé à fixer effectivement cette rétention.
- [Unstructured](https://unstructured.io/pricing) : 0,015 USD/page après volume offert ; la convention de pagination effective reste à vérifier pour chaque format utilisé.
- [Starvibe](https://apify.com/starvibe/youtube-video-transcript) publie 5 USD/1 000 résultats. [API Run Actor](https://docs.apify.com/api/v2/actors-runs-post) distingue `maxItems` pour résultats facturés et `maxTotalChargeUsd`. [Actors in Store](https://docs.apify.com/actors/running/actors-in-store) distingue les modèles de facturation ; [ChargeResult](https://docs.apify.com/sdk/js/reference/interface/ChargeResult) décrit le nombre d'événements effectivement facturés dans la limite. Ne pas étendre cette propriété à toute consommation plateforme et à tout acteur sans vérifier son modèle de facturation.
- [BCE](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html) : 1 EUR = 1,1188 USD au 26 octobre ; taux informatif, dont l'utilisation pour des transactions est déconseillée. Il ne fixe pas le taux bancaire à la facturation.

## 3. Comparaison des contrôles

| Option | Concurrence et échecs | Garantie et coût | Conclusion |
|---|---|---|---|
| Débit après réponse | Les appels simultanés passent avant l'écriture ; panne avant écriture perd la dépense | Mesure utile, aucun plafond préalable | Insuffisant seul |
| Estimation moyenne puis régularisation | Meilleure UX mais toute sous-estimation peut dépasser | Une marge statistique n'est pas une preuve ; résiste mal aux entrées extrêmes | Estimation affichable, admission interdite sur moyenne |
| Un seul traitement simultané par compte | Simplifie les courses ; n'annule pas les appels lancés | Un seul appel non borné peut dépasser ; pénalise le chat | Ne résout pas le problème financier |
| Limite chez chaque fournisseur | Contient une partie des dépenses, selon contrat | Comptes partagés, modèles de prix distincts, alertes parfois différées ; pas de budget utilisateur transversal | Défense supplémentaire |
| Proxy/gateway central | Bonne couverture des LLM | Ne couvre pas à lui seul parseurs, audio, collectes ; service supplémentaire et reprise à résoudre | Inutile d'ajouter un fournisseur pour le contrôle commun |
| Registre atomique de réservations maximales | Admission sérialisée par compteur ; journal durable et idempotence des états | Borne conditionnelle démontrable, au prix d'une capacité temporairement bloquée | **Recommandé** dans DynamoDB existant |

Le choix de DynamoDB réutilise l'infrastructure. [Transactions AWS](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html) : écritures atomiques sur plusieurs items, même compte/région ; token d'idempotence limité à 10 minutes. Le journal applicatif assure donc l'idempotence au-delà de cette fenêtre. Ce n'est pas une transaction distribuée avec le fournisseur HTTP.

## 4. Protocole proposé et garantie

Pour un compte et une période, noter B = 5 EUR, S les coûts confirmés prudents, H les réservations encore engagées. Admission uniquement si `S + H + R <= B`, où R est la borne de la nouvelle tentative. Tous les montants d'admission sont non négatifs. Interdire le mode permissif lorsque le registre ou le tarif n'est pas disponible.

1. Identifier l'opération logique et son résultat/cache ; lire un résultat disponible avant toute réservation. Un nouveau clic et une redélivrance de la même opération ne sont pas deux intentions différentes.
2. Construire la requête finale et déterminer sa borne, le barème, la conversion et la période serveur UTC. Fixer un identifiant de tentative durable ; ne pas le reconstruire à partir du message SQS seulement.
3. Transaction : créer la tentative si absente ET augmenter H sous condition de budget. Pré-calculer la borne restante ou maintenir `available` ; DynamoDB n'accepte pas une addition arbitraire d'attributs dans une expression de condition. Utiliser une condition sur l'attribut de disponible avec mise à jour atomique, pas une lecture suivie d'une écriture non protégée.
4. Un seul worker revendique le droit d'envoi par transition conditionnelle. Persister l'état `sending` avant HTTP. Un worker sans droit d'envoi ne réémet pas. Pour les fournisseurs offrant une clé d'idempotence durable, la réutiliser selon leur contrat ; ne pas en supposer une.
5. Résultat certain : transaction de régularisation unique, diminuer H de R, ajouter à S le coût réel C, libérer R−C. Conserver quantités, catégories cache, modèle/mode/acteur, tarif, taux, référence fournisseur et provenance de la métrique. Une correction ultérieure s'applique comme ajustement identifié une seule fois.
6. Échec avant envoi prouvé : libérer R. Envoi possible, timeout, stream coupé, réponse illisible, callback perdu : état `uncertain`, conserver R. Chercher les métriques facturées ; ne pas prendre le texte partiel ou zéro comme preuve. À défaut, conserver la borne comme engagement prudent, distinct de la mesure.
7. Une nouvelle tentative payante a sa propre réservation. Un résultat déjà produit mais non persisté localement ne prouve pas qu'un second appel sera gratuit. Limiter les reprises et refuser si le disponible ne suffit plus.

**Preuve conditionnelle proposée.** Initialement S+H ≤ B. L'admission ajoute au plus le disponible. La régularisation remplace R par C ≤ R. Les autres transitions ne diminuent l'engagement que sur preuve. Par induction, la somme des appels confirmés et potentiellement facturés reste ≤ B. La preuve tombe si une route contourne le registre, si C > R, si une tentative est émise deux fois sous une seule réservation, ou si prix/change sortent de leur borne. Dans ces cas : couper les nouvelles admissions de la famille, conserver le dépassement observé sans le masquer à 5 EUR, alerter l'opérateur et corriger la borne.

### Fenêtres de panne, concurrence et doublons

[SQS livre au moins une fois](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues-at-least-once-delivery.html). Le verrou d'envoi et le journal doivent survivre à ces doublons. Un lease expiré ne permet pas de réémettre un appel dont l'issue est inconnue : sans idempotence fournisseur, choisir entre disponibilité et risque de dépense double ; la garantie retient la dépense possible et exige une autre réservation avant toute reprise.

La panne entre marquage `sending` et émission peut immobiliser R sans coût réel. C'est le compromis prudent explicite. La panne entre réponse et transaction nécessite une réconciliation, pas un remboursement. Rejouer une régularisation déjà commise ne change plus les compteurs. Un callback tardif n'autorise ni seconde facturation locale ni nouvel envoi.

[TTL DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html) supprime avec délai : utiliser un état et des dates pour les décisions, jamais la disparition d'un item. Aucun TTL sur une réservation non réconciliée. Les identifiants d'opérations terminées sont gardés au moins aussi longtemps que toutes les possibilités de rejeu ; au-delà, refuser les anciennes opérations au lieu de les traiter comme neuves.

## 5. Construction des bornes

### IA

Le ratio UTF-8/3,4 du corpus est une estimation produit et TPM, pas une preuve financière. Préférer une tokenisation exacte du modèle avec marge de protocole documentée, ou la borne maximale d'entrée acceptée par le modèle si le tokenizer exact n'est pas disponible. Inclure les rôles, schémas et tout contenu ajouté par l'API ; si l'overhead n'est pas bornable, réserver le contexte maximal documenté. En contexte limite, réserver le tarif long pour toute l'entrée. Interdire les extensions payantes non inventoriées.

Pour une borne d'entrée I et de sortie O :

`R_USD = (I × max(tarif_frais, tarif_écriture_applicable) + O × tarif_sortie) / 1e6`.

Ne pas supposer que le tarif frais est toujours maximal : l'écriture de cache Luna est plus chère. La rétention 12 h, si activée, doit avoir sa propre ligne. Le coût final partitionne entrée fraîche, lecture cache et écriture cache ; la sortie comprend déjà le raisonnement. Exemple arithmétique R.2, **si I=120 000 inclut réellement toute la requête**, O=32 000 et écriture courte à 0,125 : réserve 0,031 USD, soit environ 0,02771 EUR au taux de référence ; une consommation 120 000 entrée fraîche + 4 000 sortie vaut 0,014 USD, environ 0,01251 EUR. La différence est rendue après métriques, jamais avant. Le plafond de corpus seul ne satisfait pas l'hypothèse I.

### Audio, parseurs et collecte

Pour audio : durée validée × canaux facturables × tarif maximal des options envoyées, plus minimum/arrondi applicables. Un URL mutable n'est pas un fichier borné : télécharger/contrôler l'objet envoyé ou refuser le chemin pull non maîtrisé. La durée d'exécution Lambda ne borne pas la durée audio facturée.

Pour documents : pages/feuilles bornées × prix du mode explicite + options. Une limite de poids ne borne pas la pagination DOCX/HTML. Les images externes dans un document peuvent ajouter des unités : neutraliser ou borner avant admission. Les coûts de stockage retenu sont récurrents, donc aucun plafond par appel ne les éteint ; exiger une rétention effectivement bornée ou classer ce chemin non garanti jusqu'à suppression/rétention contrôlée. Le repli réserve ses propres unités et garde l'engagement du parseur initial.

Pour Apify : capturer le modèle de prix et le build/plan effectifs, plafonner résultats/événements facturés et durée/ressources quand celles-ci sont facturées séparément. Le code local actuel envoie timeout et webhooks, sans borne financière dans l'adaptateur. Une limite du compte partagé protège l'opérateur mais ne remplace pas celle du testeur. Aucun coût maximal certain pour TikTok/Instagram n'a été établi ici à partir des seules pages « from » : cette incertitude est un motif de refus du chemin non borné, pas une autorisation de reprendre un prix moyen historique.

## 6. Change, unités, remboursements et partage

- Calcul financier en décimal exact ou entiers suffisamment fins, sans float binaire. Conserver quantités et produits rationnels ; arrondir **la borne d'admission** vers le haut, et documenter la précision. Ne pas arrondir chaque seconde à la minute ni chaque opération au centime. Un arrondi technique prudent n'est pas une unité commerciale.
- Enregistrer le change et sa date sur chaque tentative. Proposition : valorisation au taux quotidien R.2, conservée définitivement pour cette tentative ; weekends/jours sans taux utilisent le dernier taux disponible sous une ancienneté maximale explicite. Flux absent ou périmé : refuser une nouvelle dépense, conserver lectures et résultats.
- Une garantie bancaire exige une borne de change et de frais contractuelle. Une marge arbitraire de 5 ou 10 % ne protège pas de tout mouvement. Une marge validée reste **à l'intérieur des 5 EUR** : elle diminue le disponible, sans ajouter de capacité. Recommandation : ne pas fixer ici un pourcentage sans borne justifiée ; exposer séparément la garantie de valorisation et la limite de trésorerie opérateur.
- Échec facturé : conserver la dépense fournisseur. Un geste au testeur est un ajustement de capacité séparé, traçable, qui ne supprime jamais le coût financier. Si le plafond financier par compte reste strict, le geste ne doit pas permettre de nouveaux appels au-delà de 5 EUR ; financement opérateur éventuel seulement sur décision explicite. Aucun remboursement automatique sur simple statut `failed`.
- Contenu partagé : un propriétaire de coût est attaché durablement à la tentative qui gagne le verrou de création. Le second compte réutilise un résultat disponible à zéro appel et zéro coût supplémentaire. Ne pas débiter deux fois le même appel. Ne pas transférer un engagement déjà lancé à un autre compte ou au mois suivant. Si le propriétaire n'a pas le budget, aucun appel n'est lancé sous son nom ; un autre demandeur peut prendre une nouvelle création seulement après abandon certain de la première et avec sa propre réservation.
- Cache partiel et coalescence : une génération ou traduction partagée encore en cours se rejoint sans appel supplémentaire. Les coûts automatiques (aperçu, traduction) ont chacun un propriétaire et une réservation ; la création d'un média n'autorise pas en bloc toutes les dépenses suivantes.
- Mois : période calendrier UTC proposée, à confirmer par l'owner. Résultat arrivé après minuit régularisé dans le mois de sa réservation ; le nouveau mois commence avec son propre B, sans report de disponible. Un nouvel appel de reprise réserve dans le mois où il part. Un envoi non commencé avant la fin de période doit renouveler son admission dans la nouvelle période ; conserver l'ancien engagement si l'absence d'envoi n'est pas prouvée. Un résultat déjà disponible reste lisible pendant et après le changement de mois.

## 7. Livraison recommandée et points encore à vérifier

[TASK-548](../../../backlog/tasks/) doit lire la décision finale ici : registre, transitions, admission atomique, conventions d'arrondi et période. TASK-549 couvre tous les appels, traductions comprises et toute dépense lancée par une lecture. TASK-550 expose séparément mesuré/engagé/disponible et les refus typés. TASK-551 conserve bibliothèque et consultation accessibles ; un pourcentage ne doit pas prétendre qu'un engagement est une mesure. TASK-552 réconcilie les métriques et les coûts fournisseur ; aucun identifiant sensible dans les rapports publics.

Conditions ouvertes avant de qualifier le plafond de garanti :

1. Établir les bornes effectives de chaque acteur Apify et la couverture réelle de ses limites ; exporter les tarifs sans compte ni credentials dans les fichiers publics.
2. Fixer le mode LlamaParse, ses options et la rétention effectivement supportée par l'API v1 ; confirmer les unités des formats autres que PDF/images/feuilles. Documenter les formats temporairement refusés faute de borne.
3. Fixer le plafond de sortie de traduction et les bornes exactes d'entrée IA. L'estimation de corpus existante ne suffit pas.
4. Confirmer arrondi/minimum, canaux et options Deepgram sur la tarification actuelle applicable ; borner les objets réellement envoyés et le repli.
5. Faire décider les conventions UTC, le taux de valorisation, la politique d'ancienneté et tout financement d'un geste commercial. Aucun de ces détails n'est déjà approuvé par R.1–R.2.
6. Séparer les dépenses annexes de recherche et d'infrastructure de l'enveloppe des traitements ; décider leur limite opérateur pour tenir la promesse de consultation accessible.

Aucun de ces points n'autorise une modification de fournisseur. Aucun déploiement ou E2E n'est un livrable de ce benchmark. Vérification documentaire : couverture des cinq AC relue, liens primaires consultés, formules et cas de concurrence examinés ; aucun test automatisé ajouté. La validation propriétaire reste en attente, et TASK-548 reste bloquée tant que cette décision n'est pas `ok`.
