---
id: TASK-533
title: >-
  Permettre de choisir la langue d'une fiche à sa création, sans qu'elle soit
  retraduite dans la langue de lecture
status: To Do
assignee: []
created_date: '2026-10-26 16:46'
updated_date: '2026-10-26 17:01'
labels:
  - backend
  - artifacts
  - i18n
dependencies:
  - TASK-531
references:
  - mobile-design-mockups/ai_tab_notebooklm/README.md
  - media_summarizer/core/services/artifact_service.py
  - media_summarizer/workers/artifact_generator/worker.py
  - media_summarizer/api/endpoints/artifacts.py
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
  - docs/CANONICAL_MEDIA_API_OPENAPI.yaml
priority: medium
type: feature
ordinal: 140000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

L'écran « Personnaliser » propose, comme NotebookLM, une option « Langue ». La langue de lecture y est sélectionnée par défaut (maquette : `mobile-design-mockups/ai_tab_notebooklm/`).

Aujourd'hui, la langue de sortie suit toujours `reading_language` : `plan_artifact_generation` écrase `parameters["language"]` (task-398). De plus, quand le lecteur change de langue, les fiches sont traduites dans sa nouvelle langue au lieu d'être regénérées (task-395, `_arm_reading_language_translations`). Si l'on se contente de remplacer la langue, une fiche demandée en anglais par un lecteur francophone serait aussitôt retraduite en français : le choix serait perdu.

## Périmètre

- **Accepter `parameters.language`** envoyé par le client. C'est une étiquette parmi les langues que le service sait déjà normaliser (`normalize_language_tag`) ; sinon, 422 typée sans entrée ni débit. Cela lève le refus posé par TASK-531.
- **Égale à la langue de lecture, elle équivaut à une requête sans l'option** : même `artifact_id`, même comportement de traduction qu'aujourd'hui.
- **Différente, elle devient la langue de sortie et entre dans le hachage**, comme aujourd'hui. L'entrée est marquée comme fixée par l'utilisateur. Le marqueur est au choix de l'implémenteur, et il doit survivre à la relecture DynamoDB (`normalize_artifact_parameters`).
- **Une fiche à langue fixée n'est jamais armée pour une traduction** vers la langue de lecture, ni à la liste, ni à la lecture du contenu. Elle se lit dans sa langue.
- **Mutualisation entre comptes (task-394)** : une fiche à langue fixée peut être servie à un autre compte qui demande la même langue fixée, puisque la clé partagée inclut déjà les paramètres. Elle ne sert jamais une demande sans langue fixée.
- Documenter l'option et la règle de traduction dans le contrat d'API (markdown et OpenAPI).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 parameters.language envoyé par le client est accepté s'il est normalisable, sinon 422 typée sans entrée ni débit
- [x] #2 Une langue égale à la langue de lecture donne le même artifact_id et le même comportement de traduction qu'une requête sans l'option
- [x] #3 Une langue différente devient la langue de sortie, et l'entrée porte un marqueur de langue fixée qui survit à normalize_artifact_parameters
- [x] #4 Une entrée à langue fixée n'est jamais armée pour une traduction vers la langue de lecture, ni par la liste ni par la lecture du contenu
- [x] #5 Le contrat d'API (markdown et OpenAPI) documente l'option et la règle de traduction
- [x] #6 ruff et mypy passent sans erreur sur les fichiers modifiés
- [x] #7 parameters.language est accepté pour les quatre types de fiche (summary_short, notes, flashcards, quiz), sur un média comme sur un dossier
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Réalisé (2026-10-26)

- **Requête** : `language` est accepté pour les quatre types, sur un média comme sur un dossier (`artifact_service._OPTIONS_OF_EVERY_TYPE`, avec `focus`). `_resolve_language` accepte une chaîne que `normalize_language_tag` réduit à l'une des 11 langues de lecture (`V1_LANGUAGES`, celles que `PATCH /api/auth/me` accepte et que `should_translate` sait servir) ; `EN-US` devient `en`. Sinon : 422 `invalid_artifact_parameters`, `parameter: language`, `reason: invalid_value`. Le refus vient de `resolve_request_options`, que `POST /api/artifacts` appelle en premier, avant la propriété, les sources, le quota et toute écriture : ni entrée, ni débit. `null` vaut clé absente. `_PARAMETERS_NOT_ACCEPTED` ne garde que `source_ids` (task-532), le reste du traitement des sources est intact.
- **Règle de langue** : `_generation_parameters`, appelée par `plan_artifact_generation`, le seul endroit où la langue de lecture est connue. Une langue égale à la langue de lecture est retirée comme un défaut : le matériau haché est exactement celui d'une requête sans l'option (même `artifact_id`, même id partagé, entrée non marquée, donc même traduction qu'aujourd'hui). Une langue différente devient `parameters["language"]` et l'entrée reçoit `language_pinned: true`. Un lecteur sans langue de lecture qui nomme une langue obtient une entrée fixée.
- **Marqueur** : `artifact_options.LANGUAGE_PINNED` (booléen dans `parameters`, absent et jamais `false` ailleurs), lu par `artifact_options.is_language_pinned`. Il est haché : une entrée fixée en `en` n'a ni l'id ni l'id partagé d'une entrée `en` non fixée, native ou traduite. La mutualisation (task-394) ne sert donc une entrée fixée qu'à une demande qui fixe la même langue, et inversement. Un booléen revient de DynamoDB tel quel, et `normalize_artifact_parameters` le laisse inchangé. Un client qui envoie `language_pinned` reçoit `unknown_parameter`. La reprise d'une attente (`artifact_wait_service._resume_one`) recalcule l'id depuis les `parameters` stockés, marqueur compris ; le commentaire est mis à jour.
- **Traduction (task-395)** : `artifact_translation_service._translate_one_type` choisit sa source avec `_oldest_unpinned`. Il lit les entrées `ready` de la plus ancienne à la plus récente, saute celles qui sont fixées et s'arrête à la première qui ne l'est pas. Une entrée fixée n'est donc ni traduite ni prise comme original d'une traduction ; l'entrée par défaut du même type, s'il y en a une, est traduite comme avant. Une traduction n'hérite jamais du marqueur. La lecture du contenu (`GET /api/artifacts/{id}/content`) n'arme rien et n'arme toujours rien : la seule garde couvre les deux lectures de l'AC #4.
- **Coût signalé** : reconnaître une entrée fixée coûte son `GetItem`, car `scope-index` ne projette pas `parameters` (confirmé : la liste rend `parameters: {}`). Cela arrive à chaque ouverture où le chemin rapide échoue, c'est-à-dire pour un type sans entrée par défaut dans la langue de lecture : une lecture par entrée fixée plus ancienne que la première non fixée. Un type qui ne contient que des entrées fixées paie ces lectures à chaque ouverture et n'arme rien. Aucun changement Terraform. La limite décrite par task-531 (le chemin rapide ne cherche que le pointeur aux options par défaut) n'est pas corrigée ici : elle est indépendante de la langue fixée.
- **Inchangé** : le worker lit déjà `parameters["language"]`, et `ArtifactOptions.from_parameters` ignore le marqueur. Les prompts ne changent pas, donc aucune version de prompt n'est relevée. Aucun fichier sous `mobile/` ni `web/` n'est touché.
- **Contrat** : `docs/CANONICAL_MEDIA_API_CONTRACT.md` : ligne `language` dans le tableau des options du §3 et règle complète (défaut = langue de lecture, égalité = requête sans option, langue différente = fixée et hachée, jamais traduite, mutualisation, `invalid_value`) ; `not_accepted` réduit à `source_ids` ; le §4 indique qu'une entrée fixée n'est jamais traduite par la liste ; le §6 indique que la lecture du contenu n'arme aucune traduction ; mise à jour de la définition de `parameters` (lignes du runtime et des invariants). `docs/CANONICAL_MEDIA_API_OPENAPI.yaml` : propriété `language` d'`ArtifactGenerationOptions` (sans `enum`, puisque `EN-US` est accepté), descriptions du schéma et de `POST /api/artifacts`. Le YAML se charge (pyyaml).
- **ruff / mypy** (AC #6) : `ruff check media_summarizer/` → *All checks passed!* ; `mypy media_summarizer/` → *Success: no issues found in 207 source files*.

### Vérification contre `media_artifacts-dev` (eu-west-3)

Un script jetable (hors dépôt) utilise le vrai code de dépôt et de service. Il écrit des lignes sous un utilisateur fictif, ne publie rien sur SQS et laisse la table propre. Lecteur en `fr` :

```
sent {'language': 'EN-US'}  -> parameters {'language': 'en', 'language_pinned': True}  id=art_bde6f62e…
sent {'language': 'fr'}     -> parameters {'language': 'fr'}  id=art_7e110bdf…
sent {}                     -> parameters {'language': 'fr'}  id=art_7e110bdf…
language='klingon' / 12 / 'und' -> refused parameter=language reason=invalid_value
accepted on summary_short / notes / quiz / flashcards -> {'language': 'de'}
pinned en id / shared       : art_bde6f62e… shared_aa930059…
unpinned en id / shared     : art_96ceb351… shared_01284da8…   (distinct: True)
read back parameters        : {'language': 'en', 'language_pinned': True} {'language': 'str', 'language_pinned': 'bool'}
normalized                  : {'language': 'en', 'language_pinned': True}
is_language_pinned          : True
id recomputes from the row  : True
listed (only pinned)        : [('art_bde6f62e…', 'ready', {})]
reader fr / es / en: armed  : [] / [] / []
ready, oldest first         : [pinned en, unpinned fr]
translation source chosen   : the unpinned fr entry: True
cleanup                     : deleted 2 rows, still present: []
```

Ce que cette sortie établit :

- AC #2 : la langue de lecture envoyée donne le même id qu'une requête sans option.
- AC #3 : la langue différente est fixée, et le marqueur survit à l'écriture DynamoDB, à la relecture et à `normalize_artifact_parameters` ; l'id se recalcule depuis la ligne relue.
- AC #4 : une entrée fixée seule n'arme rien, quelle que soit la langue du lecteur, même quand celle-ci est la langue de l'entrée. À côté d'une entrée fixée plus ancienne, c'est l'entrée non fixée qui sert de source.
- AC #1 et #7 : les refus et l'acceptation pour les quatre types sont vérifiés.

### Hors de portée et note au propriétaire

- **Aucun test automatisé ajouté** (règle du projet). Le script de vérification est jetable et n'est pas versionné.
- Après déploiement (le push sur `main` déclenche le déploiement, après la fin de cette exécution), le propriétaire peut vérifier à la main sur `-dev`. Lecteur en `fr` : créer un quiz en `en` ; il est généré en anglais, avec `generation_outcome: created`. Changer la langue de lecture, puis rouvrir le média : aucune entrée traduite n'apparaît pour ce quiz, alors que le résumé par défaut est traduit. Ce n'est pas un critère d'acceptation.
- Mobile et web : l'écran « Personnaliser » doit envoyer `parameters.language`, la langue de lecture étant présélectionnée. Ce travail n'est pas dans le périmètre (ni `mobile/` ni `web/`).
<!-- SECTION:NOTES:END -->
