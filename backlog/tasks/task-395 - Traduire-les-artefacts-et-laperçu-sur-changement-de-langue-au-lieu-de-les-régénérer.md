---
id: task-395
title: >-
  Traduire les artefacts et l'aperçu sur changement de langue au lieu de les
  régénérer
status: Done
assignee: []
created_date: '2026-09-10 12:37'
updated_date: '2026-09-18 08:35'
labels:
  - backend
  - artifacts
  - cost
  - i18n
dependencies:
  - task-394
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Contexte

Un changement de langue de lecture ne traduit rien : il régénère. La langue est portée par `parameters` et entre donc dans `build_artifact_id` (*"parameters carries the reading language, so two reading languages are two different ids"*), si bien qu'une seconde langue produit une nouvelle entrée générée **depuis le transcript entier**. Pour un `review_blurb` de quelques lignes, le coût est dominé par les jetons d'entrée : on relit tout le texte pour réécrire un paragraphe.

Le mécanisme voulu existe déjà pour le texte complet et sert de modèle : `transcript_translation` détecte la langue localement (gratuit), n'appelle le modèle que si la langue diffère, et **persiste la traduction sous une clé déterministe** *"keyed on `(transcript_s3_key, target_language)` so a couple is never re-translated"*.

## Décision du propriétaire

Sur changement de langue de lecture, **on traduit l'existant au lieu de le régénérer** : le texte complet (déjà en place) et les artefacts, aperçu compris.

Deux exigences de coût :

- **Déclenchement à l'ouverture du média concerné**, pas en masse sur toute la bibliothèque au moment où la langue change.
- **Persistance**, de sorte qu'une réouverture du même média ne relance aucune traduction.

## Périmètre

Artefacts de scope média, `review_blurb` inclus. Le comportement attendu à l'ouverture d'un média dont les artefacts existent dans une autre langue : ils sont traduits une fois, conservés, et servis tels quels ensuite. Un artefact qui n'existe dans aucune langue n'est pas concerné — il relève de la génération normale.

## Point d'attention pour l'implémenteur

Les entrées d'artefact sont append-only : *"once it reaches ready it is never modified again — there is no staleness flag, no expiry, no automatic regeneration"*. Une traduction est donc une nouvelle entrée, pas une mutation de l'entrée d'origine, et l'original reste servi aux comptes qui lisent dans sa langue.

À vérifier avant d'écrire du code : `trigger_review_blurb_generation` passe délibérément `reading_language=None` pour éviter d'être envoyé dans le pipeline de traduction, parce qu'il n'a aucun retry derrière lui et qu'une `ArtifactTranscriptNotReadyError` y serait définitive. Ce raisonnement porte sur la génération à l'ingestion et ne doit pas être cassé par la traduction à l'ouverture, qui, elle, a un déclencheur qui peut se répéter.

## Notes au propriétaire (hors critères d'acceptation)

Vérification manuelle après déploiement : changer la langue de lecture, constater qu'aucune traduction ne part immédiatement, ouvrir un média disposant d'un résumé et d'un aperçu, les voir traduits, puis rouvrir le même média et vérifier côté coûts fournisseur qu'aucun nouvel appel n'a lieu.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 À l'ouverture d'un média dont les artefacts existent dans une autre langue que la langue de lecture courante, ces artefacts — review_blurb compris — sont traduits à partir de l'existant et non régénérés depuis le transcript.
- [x] #2 Aucune traduction d'artefact n'est déclenchée par le changement de langue lui-même : le déclencheur est l'ouverture du média concerné.
- [x] #3 Une traduction produite est persistée : rouvrir le même média dans la même langue ne déclenche aucun nouvel appel au fournisseur.
- [x] #4 Une traduction est une nouvelle entrée d'artefact ; l'entrée d'origine n'est pas modifiée et reste servie dans sa langue.
- [x] #5 ruff et mypy passent sans erreur sur les modules touchés.
- [x] #6 Une vérification directe contre le DynamoDB -dev réel, documentée dans les notes d'implémentation, montre l'entrée traduite persistée à côté de l'originale.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Le déclencheur est la lecture qui tient déjà les lignes

`GET /api/artifacts?scope=media&scope_id=…` — la requête que l'écran de détail émet au
montage — est le point de décision (`artifact_service.list_scope_artifacts` →
`_arm_reading_language_translations` → `artifact_translation_service`). Elle interroge
déjà tout le scope **avant** de filtrer les types internes, donc le planificateur voit
aussi le `review_blurb` et la décision **ne coûte aucune requête DynamoDB
supplémentaire**. Gardes : scope média uniquement, première page uniquement
(`cursor is None`), lecteur ayant une langue de lecture, et jamais fatal — une lecture
qui n'arrive pas à armer une traduction rend quand même l'historique.

L'AC #2 tient par construction, pas par un drapeau : `PATCH /api/auth/me` n'écrit que
`reading_language` / `reading_language_changed_at`. Rien dans ce chemin ne touche aux
artefacts, donc changer de langue coûte zéro appel fournisseur, quelle que soit la
taille de la bibliothèque.

Les entrées armées sont renvoyées **en tête de la page**. Le mobile prend « la première
entrée vue par type » (`CompletedDetailView`), donc la tuile passe en `queued` dès
cette réponse et le sondage qu'elle démarre ramène la traduction sans second aller-retour
vers l'écran.

## Décider est gratuit, agir coûte une lecture

`_translate_one_type` calcule d'abord l'id du pointeur qu'une entrée dans la langue
cible porterait — même recette que n'importe quelle demande — et le cherche **dans la
page que l'appelant tient déjà**. Le pointeur cible vit dans la même clé de scope que
sa source, donc sa présence prouve que la langue de lecture est servie, quel que soit
l'état de cette entrée : une réouverture, et chaque sondage d'une tuile en vol, coûtent
zéro lecture. C'est ce qui rend l'AC #3 vrai sans table de verrous.

Ce n'est qu'ensuite qu'une ligne est lue, et une seule : l'entrée `ready` la **plus
ancienne** du type. La plus ancienne parce que c'est celle générée depuis le transcript
— traduire la plus récente enchaînerait traduction sur traduction et dériverait un peu
plus à chaque changement de langue. Le GSI ne projette ni `parameters` ni `storage`,
d'où ce `GetItem` : la langue d'un artefact n'est pas lisible dans l'index. **Aucun
changement Terraform** (la projection de `scope-index` est inchangée).

Garde-fou explicite : l'id de l'entrée source est **recalculé** depuis le matériel que
ce module suppose (un content id, la langue comme seul paramètre) et comparé à son id
réel. Un écart ferait écrire une traduction sous un id qu'aucune demande ne calcule —
payée et jamais réutilisée — donc on s'abstient et le type reste régénérable comme
avant (`artifact.translation_recipe_mismatch`).

## Une traduction est une entrée, écrite par les recettes existantes

`_plan_translation` construit un `ArtifactGenerationPlan` ordinaire : pointeur du compte
+ génération partagée quand le contenu est mutualisable (task-394), pointeur seul
sinon. Trois propriétés en découlent d'un coup :

- l'entrée atterrit sur **exactement** l'id qu'une demande native de ce type dans cette
  langue calcule, donc un tap ultérieur sur la tuile répond `reused` au lieu de générer ;
- un autre compte lisant dans la même langue est servi par la même ligne partagée, sans
  second appel modèle ;
- l'original n'est jamais écrit (AC #4) : l'instantané des sources est recopié tel quel,
  la traduction couvre exactement ce que son original couvrait.

`build_shared_generation_record` prend désormais `sources` + `source_count` au lieu
d'une `ScopeResolution` : une traduction est armée depuis l'instantané d'une autre
entrée et ne résout aucun scope — exiger une résolution aurait signifié lire des
transcripts que cette ligne ne regardera pas. `_entry_served_by` devient public
(`entry_served_by`) pour la même raison : deux endroits construisent maintenant un
pointeur au-dessus d'une génération armée par quelqu'un d'autre.

Le `generator_version` dit ce que la ligne est :
`summary_short:translated:gpt-5-nano-2025-08-07:prompt-v1`. Enregistré, jamais haché.

Pas de débit de quota, précédent `review_blurb_service` : l'allocation est dépensée par
ce que l'utilisateur demande, et personne n'a demandé cette traduction. Le coût réel
reste mesuré (`llm_usage`, `record_observed_cost`).

## Le worker : la structure est préservée, pas re-dérivée

Même file, même bail, même taxonomie d'échec ; ce qui change est l'entrée. Un message
portant un bloc `translation` (`{source_artifact_id, bucket, key, source_language,
target_language}`, et **pas** de `sources`) fait lire un payload stocké au lieu de N
transcripts (`workers/artifact_generator/worker.py::_translate_stored_artifact`).

`workers/artifact_generator/translation.py` ne montre au modèle que les **feuilles
chaînes**, collectées par chemin, et greffe la réponse sur l'objet d'origine. Donc un
quiz garde l'ordre de ses options et son `correct_answer`, un `question_count` reste
cohérent, et les clés non traduisibles sont exclues : `label`, `correct_answer`
(les deux moitiés d'une même identité), `importance` (vocabulaire fermé que le mobile
teste), `source_ref` (cite le transcript, qui n'est pas traduit). Les validateurs des
générateurs ne sont **pas** rejoués : leur forme d'entrée n'est pas la forme stockée
(`quiz` mélange ses options après validation), donc revalider rejetterait un artefact
correct. Le schéma Structured Outputs est construit par appel avec une propriété
requise par segment : un segment manquant devient structurellement impossible plutôt
que d'être rattrapé après coup.

## L'aperçu suit la langue du lecteur

`_mirror_review_blurb_onto_content_rows` ne diffuse plus la carte sur *toutes* les
lignes du contenu mais sur celles dont le propriétaire lit dans la langue de l'artefact
(`_reads_artifact_language`, une lecture de profil par ligne, `None == None` compte
comme une correspondance). Sans ce filtre, la carte espagnole écraserait la carte
française d'un autre lecteur et la génération la plus récente gagnerait toujours. La
ligne demandeuse est exemptée de la lecture : la langue de l'entrée *est* la sienne,
son id en a été calculé.

Le mobile n'a besoin d'aucun changement : `resolveSourcePreviewState` fait gagner le
contenu sur le statut, donc l'ancienne carte reste affichée pendant que sa traduction
tourne (pas de régression en spinner), et l'historique montre les deux entrées, ce qui
est le comportement append-only attendu.

## AC #6 — vérification contre `media_artifacts-dev` réel

Script jetable (hors dépôt, `/tmp`), table `media_artifacts-dev` en `eu-west-3`, via le
vrai code de repository et le vrai planificateur. SQS est bouchonné : ce qui est vérifié
est ce qui atterrit dans DynamoDB, et publier ferait traduire au worker dev un payload
qui n'existe pas. Sortie observée :

```
table                      : media_artifacts-dev
region                     : eu-west-3

--- web content (shared generation + per-account pointer)
mutualizes_generation      : True
original (fr) written      : art_e51a0a63d1887e098e3b511bb1476336 status=ready
reader already in fr       : armed=[]
reader switches to es      : armed=['art_9c74387479aa368e59a209ddef0add3d']
scope listing after         :
  art_9c74387479aa368e59a209ddef0add3d status=queued  language=es title=None
      generator_version=summary_short:translated:gpt-5-nano-2025-08-07:prompt-v1
      shared=shared_c14b4d81de2c946ee4fb5ce19f93d2fd
  art_e51a0a63d1887e098e3b511bb1476336 status=ready   language=fr title='Probe summary'
      generator_version=summary_short:gpt-5-nano-2025-08-07:prompt-v4 shared=None
original after the arming  : status=ready title='Probe summary' language=fr
      updated_at_unchanged=True completed_at_unchanged=True
id a native es request computes: art_9c74387479aa368e59a209ddef0add3d -> is the translated entry: True
media reopened in es       : armed=[] new_queue_messages=0
queue message              : queue=artifact-generator-queue-dev
      artifact_id=shared_c14b4d81de2c946ee4fb5ce19f93d2fd
      translation={source_artifact_id: art_e51a0a63d1887e098e3b511bb1476336,
                   source_language: fr, target_language: es, key: probe/395/source.json}
      sources_in_message=False

--- uploaded file (account-scoped: the entry is the generation)
mutualizes_generation      : False
original (fr) written      : art_0ca995196f1ab95a93593c9d1e60c8c4 status=ready
reader switches to es      : armed=['art_0deb1b9718dd5128f211476c25e0bb8c']
  art_0deb1b9718dd5128f211476c25e0bb8c status=queued language=es shared=None
  art_0ca995196f1ab95a93593c9d1e60c8c4 status=ready  language=fr title='Probe summary'
original after the arming  : updated_at_unchanged=True completed_at_unchanged=True
id a native es request computes: art_0deb1b9718dd5128f211476c25e0bb8c -> is the translated entry: True
media reopened in es       : armed=[] new_queue_messages=0

cleanup                    : deleted 5 rows, still present: []
```

Ce qui est établi : l'entrée traduite est persistée **à côté** de l'originale, dans la
même clé de scope, avec `language=es` et un `generator_version` de traduction (#6, #4) ;
l'originale est intacte (`updated_at` et `completed_at` inchangés, toujours `ready`,
toujours `fr`) et reste servie aux lecteurs francophones (#4) ; un lecteur déjà dans la
langue de l'artefact n'arme rien ; la réouverture dans la même langue n'arme rien et
n'envoie aucun message (#3) ; le message de file porte le bloc `translation` et **pas**
de `sources`, donc le worker lit un artefact et non le corpus (#1) ; l'id de l'entrée
traduite est exactement celui qu'une demande native en `es` calcule, donc la tuile
répondra `reused` ; les deux chemins (contenu web mutualisé, fichier envoyé) sont
exercés. Table laissée propre.

Contrôle structurel complémentaire du marcheur de segments (hors AWS, jetable) : sur un
payload `quiz` réaliste, les segments collectés sont `title`, `questions.0.question`,
`questions.0.options.{0,1}.text`, `questions.0.explanation` — `label`, `correct_answer`,
`source_ref` et `question_count` restent tels quels après greffe ; sur un `review_blurb`,
`hook` et chaque `points.N`.

## Limites et notes

- `ruff check media_summarizer/` : *All checks passed!* — `mypy media_summarizer/` :
  *Success: no issues found in 191 source files* (#5).
- **Aucun test automatisé ajouté** (règle du projet). Les scripts de la vérification #6
  sont jetables et non versionnés.
- La vérification manuelle demandée par le propriétaire (changer la langue, ouvrir un
  média, constater résumé et aperçu traduits, rouvrir sans nouvel appel fournisseur)
  reste **hors de portée d'un worktree** : le déploiement se déclenche au push sur
  `main`, bien après la fin de cette exécution. Le chemin de code est en place et câblé
  de bout en bout (endpoint → planificateur → SQS → worker → scellement → miroir).
- **Le point d'attention de la description est périmé** : `trigger_review_blurb_generation`
  ne passe plus `reading_language=None`, il passe la langue du propriétaire depuis
  task-398 (*"the resolver reads the original transcript and the language only travels
  to the model"*). Ce qui reste vrai de ce raisonnement — « ce hook n'a aucun retry
  derrière lui » — n'est pas cassé : la traduction est déclenchée par une lecture qui,
  elle, se répète, et elle n'échoue jamais de façon fatale pour l'appelant.
- Le pas de mutualisation implique qu'un artefact traduit pour un compte sert
  immédiatement tout autre compte lisant dans cette langue : le fournisseur est appelé
  une fois par (contenu, type, langue), jamais une fois par compte.
- Aucune vérification d'entitlement sur une traduction : le compte détient déjà cette
  entrée dans une autre langue, la traduire ne lui accorde rien de neuf.
<!-- SECTION:NOTES:END -->
