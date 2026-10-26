---
owner_decision: pending
---

# Benchmark : contrôle du budget fournisseur de la bêta

## Owner Validation

**Decision**: _(à remplir par le propriétaire)_
**Validated at**: _(date ISO à remplir par le propriétaire)_

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
