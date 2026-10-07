# Complement request — 2026-10-07

Owner decision `more` on task-430. Consignes extraites du champ `Decision` du README principal :

Le benchmark de base est bon et je ne le rejette pas : la base de preuves, les mesures sur `-dev`,
le verdict sur le streaming de la porte d'entrée déployée et le §6.4 sur le cache sont acquis et
restent la référence. Il me manque de l'information pour trancher, pour deux raisons.

**Première raison : mes priorités ne sont pas celles du §8.2.** Je veux du **streaming**, de la
**robustesse**, et de la **qualité de génération et d'utilisation du contexte**, quitte à ce que ça
coûte cher. Le classement du §8.5 pondère « objets persistants nouveaux » à 30 %, donc il optimise
la sobriété — ce qui est défendable, mais ce n'est pas mon arbitrage. Et le §6.2 établit lui-même
que le coût ne peut pas être l'arbitre : **0,1377 € de LLM dépensés depuis la création du dépôt**.

**Deuxième raison : il manque une candidate, et elle est le standard du métier.** Le §5.1 chiffre
deux voies de streaming — remplacer la façade par une API REST en mode `STREAM` (≥ 10 objets) et
ajouter une API WebSocket (≥ 11) — et mentionne la Function URL au point 3 (« M9 :
`ResourceNotFoundException` … qui est l'autre chemin de streaming documenté ») **sans jamais la
chiffrer comme candidate**. Or, vérification faite le 2026-10-06 sur la documentation du pattern de
référence des UI de chat (Vercel AI SDK, *Chatbot Resume Streams* et *Chatbot Message
Persistence*), le transport canonique du streaming de chat texte est **SSE sur HTTP, pas
WebSocket** : « *WebSockets aren't part of this pattern at all* ». L'architecture C paie donc
≥ 11 objets Terraform pour un transport qui n'est pas celui que recommandent les bonnes pratiques.

Quatre consignes pour le complément.

**C1 — Chiffrer une cinquième candidate, « B + SSE reprenable ».** La durabilité de B (le tour en
file, persisté, rejouable, avec le bail, le DLQ et la taxonomie d'échec déjà déployés) plus le
transport canonique par-dessus. À chiffrer avec la même granularité que le §10 et à noter sur les
mêmes axes que le §8.5, pour qu'elle soit comparable aux quatre autres :

- une Lambda **dédiée au chat** avec `aws_lambda_function_url` en `invoke_mode = "RESPONSE_STREAM"`,
  le Lambda Web Adapter à la place de Mangum **sur cette fonction seulement** (la façade HTTP et
  toutes les alarmes indexées sur `local.api_gateway_id` restant intouchées), uvicorn, et une route
  FastAPI en `StreamingResponse` ;
- l'authentification de cette seconde porte d'entrée : vérification du JWT dans l'application
  contre `authorization_type = "AWS_IAM"` plus signature SigV4 côté mobile — dire laquelle, et ce
  qu'elle coûte en code mobile ; le domaine custom et CORS ; et si cette Lambda entre gratuitement
  dans les `for_each` de `lambda_error_rate` et `lambda_throttles` ou s'il faut un filtre de
  métrique et un log group de plus ;
- la couche de reprise telle que le pattern publié la décrit, parce que c'est elle qui porte la
  robustesse que je demande : la génération tourne **jusqu'au bout côté serveur et est persistée
  quoi que fasse le client** (« *client-side aborts are treated as disconnects* »), un
  `activeStreamId` par conversation, un endpoint GET de reprise qui rend 204 quand rien n'est actif,
  et un endpoint d'arrêt **explicite et distinct** qui sauve le tour partiel (« *Route cleanup is a
  disconnect, not an explicit stop* ») ;
- la question d'infrastructure que ça pose : le pattern de référence s'appuie sur Redis pour
  tamponner le flux. Dire si l'item DynamoDB de conversation peut porter l'`activeStreamId` et le
  texte partiel sans équivalent Redis, et sinon chiffrer le substitut AWS le moins cher
  (ElastiCache Serverless contre un tampon de fragments en DynamoDB), en objets nouveaux.

**C2 — Repondérer et reclasser les cinq candidates sous mes priorités.** Garder le tableau du §8.2
comme pondération alternative, pour que les deux classements soient lisibles côte à côte, et
produire explicitement la nouvelle pondération. Deux exigences :

- **ajouter un axe que le §8.2 n'a pas du tout : la robustesse de la reprise.** Que se passe-t-il
  quand l'app passe en arrière-plan au milieu d'un tour, quand le flux meurt, quand la Lambda est
  recyclée, quand le réseau tombe dans le métro ? C'est le cas réel sur mobile, et c'est le critère
  sur lequel je veux voir les cinq candidates notées ;
- **ne pas valider ma préférence par politesse.** Si, après repondération, l'architecture B reste
  devant, le dire franchement et montrer sur quels axes elle gagne malgré le poids donné au stream
  et à la robustesse. Un complément qui conclut « B gagne quand même » est un résultat utile.

**C3 — Rechiffrer sur les modèles à grande fenêtre et traiter la falaise des 272 000 tokens.** Les
chiffres ci-dessous sont relevés le 2026-10-06 et sont donnés pour orienter la recherche :
**ils doivent être revérifiés à la source**, pas repris sur parole.

- `gpt-6-luna` : contexte 1 050 000, **entrée max 922 000**, sortie max 128 000, **0,10 / 0,01 /
  0,50 $ par 1M**, écriture de cache 0,125 $/1M, `reasoning_effort` de `none` à `max`, défaut
  `medium` ;
- `gpt-6.1-sol` : mêmes fenêtres, 2 / 0,10 / 10 $ par 1M, `none` **non supporté** ;
- la falaise : au-delà de **272 000 tokens d'entrée**, la requête **entière** est repricée
  « *2x input and cache rates and 1.5x output for the full request* ».

Ce que je veux en tirer :

1. le modèle de coût du §6.3 rejoué sur Luna et Sol à côté de nano, la surcharge modélisée comme une
   **fonction en escalier** et non comme un tarif linéaire ;
2. une réponse à la question que la falaise pose : le vrai plafond économique est-il le seuil de
   272 000 plutôt que la fenêtre du modèle ? Et si oui, qu'est-ce que ça implique pour
   `MAX_FOLDER_CORPUS_TOKENS = 120_000` (`artifact_service.py:126`) — faut-il le déplacer, et à
   quelle valeur, sachant que l'estimateur est `byte_length / 3.4` (`artifact_service.py:129` et
   `:436-437`) et **pas** un comptage de tokenizer, donc que la marge réelle n'est pas celle
   affichée ;
3. la correction du §14.1 sur le TPM. Sa ligne dit « *Les tokens d'entrée servis par le cache
   comptent-ils plein dans le TPM ? La documentation ne le dit pas.* » Le guide *prompt caching*
   le dit maintenant explicitement : « *Cached input tokens still count toward tokens-per-minute
   limits* » et « *Prompt caching does not change how [rate limits] are calculated* ». Revérifier
   et transformer l'angle mort en fait établi ;
4. l'évaluation de la **compaction côté fournisseur** (`context_management`, `compact_threshold`,
   l'endpoint `/responses/compact`), que le §6.4 n'a pas considérée — il ne modélise qu'une fenêtre
   glissante faite à la main. La documentation assume son compromis : « *fewer input tokens can
   still save money even when the cache-hit rate falls* ». Dire si ça change la conclusion « pas de
   troncature, pas de résumé, pas d'étage de condensation », **sachant que la compaction appartient
   à la Responses API alors que le dépôt appelle `/v1/chat/completions`**
   (`worker.py:73-75`) — donc dire aussi ce que ce changement d'API coûterait, en reprenant les
   quatre objections que le §7.4 oppose déjà à la Responses API et en disant lesquelles tiennent
   encore quand on ne déporte **pas** l'état de la conversation chez le fournisseur.

**C4 — Rouvrir la prémisse du §13.1 sur la portée bibliothèque.** Le §13.1 déclare un benchmark
distinct obligatoire parce que « le corpus entier de `-dev` vaut 672 515 tokens, soit **2,5× la
fenêtre d'entrée** de 272 000 ». Sur les 922 000 tokens d'entrée de Luna, ce corpus **tient**, avec
environ 27 % de marge. La question n'est donc plus « avec quelle récupération » mais « récupération
ou pas de récupération du tout ». À trancher dans le complément :

- le coût d'un tour sur toute la bibliothèque sur Luna, à froid et en cache, surcharge comprise ;
- une **position argumentée** — pas un chiffre — sur la qualité : la littérature réunie au §14.2
  (*Lost in the Middle*, context rot, NoLiMa, BooookScore) disqualifie-t-elle le fait de remplir
  73 % d'une fenêtre de 922 000 ? Le §14.2 conclut que « le plafond est la réponse » dans un régime
  à 7,2 % et 48,2 % de remplissage ; dire si cette conclusion survit à 73 %, et sinon quel plafond
  elle impose ;
- et au bout : le benchmark distinct du §13.1 est-il **encore nécessaire** ? S'il l'est, donner sa
  question reformulée — « récupération contre corpus complet sur un modèle à grande fenêtre » n'est
  pas la même question que « quelle récupération ». S'il ne l'est plus, le dire, parce que ça change
  l'ordre des tranches du §12.

**Garde-fous du complément, inchangés.** Le `README.md` principal reste la référence et n'est pas
modifié : produire uniquement un `complement-response-<date>.md` dans ce répertoire. L'interdiction
de lire `docs/research/task-427-*` **tient toujours**, pour la même raison qu'au premier passage.
Aucun appel LLM payant, aucun fichier source du dépôt modifié. Chaque prix, chaque fenêtre, chaque
seuil et chaque citation de documentation porte son URL et sa date de consultation — y compris ceux
que je donne ci-dessus, qui sont à revérifier et non à recopier.
