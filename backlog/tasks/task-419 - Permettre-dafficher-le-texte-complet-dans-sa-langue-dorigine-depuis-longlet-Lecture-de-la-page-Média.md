---
id: TASK-419
title: >-
  Permettre d'afficher le texte complet dans sa langue d'origine depuis l'onglet
  Lecture de la page Média
status: To Do
assignee: []
created_date: '2026-09-29 10:25'
labels:
  - mobile
  - backend
  - ux
dependencies: []
references:
  - mobile/src/components/TranscriptReader.tsx
  - mobile/src/components/CompletedDetailView.tsx
  - mobile/src/services/mediaService.ts
  - media_summarizer/api/endpoints/media.py
  - media_summarizer/core/services/raw_content_service.py
  - media_summarizer/core/services/transcript_translation.py
priority: medium
type: feature
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Quand un média est dans une langue différente de la langue de lecture de l'user, la section « Texte complet » de l'onglet Lecture n'affiche que la traduction : `GET /api/media/{id}/raw-content` écrase le texte original par l'objet traduit (`raw_content_service.py`, ~l.155-170) et ne renvoie qu'un seul corps. L'user n'a donc aucun moyen de revenir au texte source, alors que c'est justement ce qu'on veut vérifier quand une tournure paraît fausse, quand un nom propre ou un terme technique a été traduit à tort, ou simplement quand on comprend la langue d'origine et qu'on préfère la lire.

C'est le geste standard partout où un contenu est traduit automatiquement (X/Twitter, Facebook, LinkedIn, Chrome) : un petit contrôle discret, collé au contenu traduit, qui bascule entre traduction et original et revient en arrière. On ne quitte pas l'écran et on ne perd pas la traduction.

Forme et emplacement retenus (décision produit, à ne pas re-débattre) :

- Un **petit bouton pilule texte**, aligné à droite sur la **même ligne que le titre « Texte complet »** (le titre est aujourd'hui un `Text` nu, l. 138-140 de `TranscriptReader.tsx` : il faut l'envelopper dans une ligne flex). Emplacement choisi parce que la bascule porte sur toute la section, pas sur un paragraphe, et parce que la section peut être très longue — un contrôle en bas serait invisible.
- Libellé explicite mentionnant la langue visée, pas une icône seule : « Voir l'original (EN) » puis, une fois l'original affiché, « Voir la traduction (FR) ». Les endonymes/codes de langue sont déjà disponibles côté mobile (`describeLanguage`, `LOCALE_ENDONYMS`).
- Le bouton n'existe **que** si le texte affiché est bien une traduction. Sur un média déjà dans la langue de lecture, rien ne s'affiche — pas de bouton désactivé.
- Style : réutiliser la pilule existante `checkTranslationButton` du même fichier (`TouchTarget.minimum`, `surfaceContainerHigh`, `BorderRadius.full`) pour ne pas introduire un troisième style de bouton dans la section.

Côté serveur, il faut un moyen de demander la variante originale. La clé S3 de la traduction est dérivée déterministement de celle de l'original (`build_translated_transcript_key`), donc l'original reste toujours atteignable depuis `job.transcription_s3_key` : c'est un choix de variante dans la réponse, pas un nouveau stockage. L'implémenteur choisit entre renvoyer les deux corps dans une seule réponse ou ajouter un sélecteur de variante à l'endpoint, et justifie son choix (poids de la réponse vs aller-retour réseau au moment du tap).

Point d'attention : la ligne de métadonnées (date, durée, nombre de paragraphes) affiche déjà la langue **source** via `describeLanguage(media_item.transcript?.language)` même quand le corps affiché est la traduction — c'est incohérent aujourd'hui et ça le sera davantage avec une bascule. À corriger dans le même passage : la langue annoncée doit être celle du texte réellement affiché.

Note à l'owner (hors AC) : vérifier visuellement sur simulateur, sur un média étranger (langue de lecture FR + contenu EN), que la ligne de titre ne casse pas sur deux lignes avec les libellés les plus longs (allemand, portugais) et que la bascule est instantanée après le premier affichage.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Sur un média dont le texte complet est une traduction, la ligne du titre « Texte complet » porte à sa droite un bouton pilule texte qui nomme la langue cible du basculement (ex. « Voir l'original (EN) »)
- [x] #2 Un tap sur ce bouton remplace le corps de la section par le texte dans sa langue d'origine, sans quitter l'écran ni recharger l'onglet Lecture ; le libellé du bouton devient « Voir la traduction (XX) » et un second tap ramène la traduction
- [x] #3 Sur un média dont le texte complet n'est pas une traduction (langue source == langue de lecture), aucun bouton de bascule n'est rendu — ni actif, ni désactivé
- [x] #4 Le bouton n'apparaît pas dans les états où il n'y a pas encore de traduction à opposer à l'original : chargement, traduction en cours, traduction bloquée, traduction échouée, texte indisponible, erreur
- [x] #5 La ligne de métadonnées de la section annonce la langue du texte effectivement affiché, et change avec la bascule (elle affiche aujourd'hui toujours la langue source)
- [x] #6 L'endpoint /api/media/{id}/raw-content permet d'obtenir le texte original en plus de la traduction ; le choix (deux corps dans une réponse vs sélecteur de variante) est justifié en commentaire ou dans la description de PR
- [x] #7 Le comportement par défaut de /raw-content est inchangé pour un appel sans paramètre nouveau : la traduction reste le corps servi quand elle existe
- [x] #8 Le type mobile RawContentResponse/TranslationMetadata déclare les champs consommés par la bascule, y compris is_translated que le backend envoie déjà sans qu'il soit typé
- [x] #9 Les nouvelles clés i18n du bouton et de son accessibilityLabel existent dans les 11 fichiers de locale de mobile/src/i18n/ (en, fr, es, de, it, pt, nl, ar, hi, ja, zh)
- [x] #10 Le bouton est atteignable au lecteur d'écran : accessibilityRole bouton, accessibilityLabel qui nomme l'action et la langue, cible tactile >= TouchTarget.minimum
- [x] #11 Le bouton porte un testID stable, dans la même convention que transcript-check-translation du même fichier
- [x] #12 ruff, mypy et les vérifications de lint/typecheck mobile du projet passent sans nouvelle erreur
- [x] #13 Vérification directe contre le -dev réel : pour un média traduit, l'objet transcript original et l'objet traduit sont tous deux lisibles dans le bucket de transcripts, et le chemin serveur de la variante originale renvoie bien le premier (commande et sortie consignées dans les notes d'implémentation)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### AC #6 — pourquoi un sélecteur de variante et non deux corps dans la réponse

`GET /api/media/{id}/raw-content` accepte `?variant=translated|original`
(`translated` par défaut, donc la lecture par défaut est inchangée au bit près —
AC #7). Le type est un `Literal` déclaré dans `raw_content_service.py`
(`RawContentVariant`), à l'identique du `SortDirection` déjà utilisé par
`search_media` : FastAPI valide et répond 422 sur toute autre valeur. Chaque
réponse renvoie en écho la variante servie dans un champ `variant` de premier
niveau.

Le choix, écrit aussi en commentaire dans `raw_content_service.get_raw_content` :

- **La lecture par défaut est le chemin chaud.** Elle tourne à chaque ouverture
  de l'onglet Lecture *et* à chaque tick du sondage de traduction (jusqu'à 20
  lectures par attente, task-415). Embarquer le texte source à côté de la
  traduction doublerait le poids de toutes ces réponses pour servir un contrôle
  que la plupart des lecteurs ne toucheront jamais, sur des transcripts qui
  atteignent plusieurs centaines de kilo-octets pour un podcast long.
- **Le tap paie une requête, et une seule.** L'écran garde le texte source dans
  son état (`OriginalTextState.content` survit à `shown`), donc le retour à la
  traduction et tous les basculements suivants ne coûtent aucun réseau — ce qui
  est exactement la promesse d'« instantané après le premier affichage » de la
  note owner.
- **La lecture de la variante originale est la moins chère des deux.** Elle ne
  résout aucune traduction : pas de détection de langue, pas de lecture du
  verrou de traduction, pas de réservation atomique, pas de second téléchargement
  S3. Une lecture du texte source ne doit jamais armer ni ré-armer une
  traduction. Rien n'est perdu : le contrôle qui envoie cette requête n'existe
  que si une lecture par défaut a déjà répondu `is_translated: true`, donc le
  client détient déjà les deux langues.

`docs/INGESTION_WORKERS_PROVIDERS.md` § « `/raw-content` contract » porte la même
justification et une ligne de tableau pour `?variant=original`.

### AC #5 — la langue annoncée suit le texte affiché

La ligne de métadonnées était construite avant l'état du texte dans
`CompletedDetailView` ; le tableau `details` a été déplacé après, pour que la
langue nommée soit celle du corps réellement à l'écran : la langue de lecture
tant que la traduction est affichée, la langue source sinon (et donc dès que la
bascule montre l'original). La langue source vient de
`translation.translated_from ?? translation.detected_language ??
media_item.transcript.language` — la détection faite au moment de la lecture
passe avant ce que le provider de transcription avait déclaré.

### Libellé : code court à l'écran, nom complet au lecteur d'écran

La pilule affiche « Voir l'original (EN) » / « Voir la traduction (FR) » — un
code court, parce que la ligne du titre est partagée avec « Texte complet » et
n'a pas de largeur à donner à « Français ». L'`accessibilityLabel` dit le nom de
la langue en entier (« Afficher le texte original (English) ») via
`describeLanguage`, là où la largeur ne coûte rien. Deux champs sur
`TranscriptTranslationToggle` (`languageCode`, `languageName`), un seul token
`{language}` dans les catalogues.

### AC #13 — vérification contre le `-dev` réel

Bucket `media-summarizer-transcripts-125313707865-dev`, table
`processing_jobs-dev`, région `eu-west-3`, profil AWS `second-brain-app`.

1. **Les deux objets existent et sont lisibles.** Sur les 95 jobs de
   `processing_jobs-dev` qui portent un `transcription_s3_key`, 42 ont *à la fois*
   l'objet original et l'objet dérivé par
   `build_translated_transcript_key(..., "fr")` présents dans le bucket
   (recoupement de `dynamodb scan --projection-expression transcription_s3_key`
   et de `s3api list-objects-v2 --query "Contents[].Key"`).
2. **La variante originale renvoie bien le premier.** Sur le couple
   `3e202c40-48c6-4ac7-9cda-76a27bab9cc9` :

   ```
   aws s3api get-object --bucket media-summarizer-transcripts-125313707865-dev \
     --key 3e202c40-48c6-4ac7-9cda-76a27bab9cc9.txt --range bytes=0-119 -
   → "This is how I maintain my app with thousands of users as a solopreneur. …"

   aws s3api get-object --bucket media-summarizer-transcripts-125313707865-dev \
     --key 3e202c40-48c6-4ac7-9cda-76a27bab9cc9.translated.fr.txt --range bytes=0-119 -
   → "C'est ainsi que je maintiens mon appli avec des milliers d'utilisateurs …"
   ```

   `3e202c40-48c6-4ac7-9cda-76a27bab9cc9.txt` est exactement la valeur de
   `transcription_s3_key` du job, c'est-à-dire la seule clé que le chemin
   `variant="original"` télécharge.
3. **Le chemin serveur ne peut pas se tromper de corps.** Aucune des 95 valeurs
   de `transcription_s3_key` de `processing_jobs-dev` ne contient
   `.translated.` : `transcription_s3_key` est inconditionnellement l'objet
   source, et la clé traduite n'est qu'un dérivé calculé à la lecture. La
   variante originale ne peut donc jamais servir une traduction.

### Hors périmètre / non fait

- **Aucun test automatisé** n'a été ajouté : le projet les interdit sauf demande
  explicite. Le test E2E existant `tests/e2e/test_transcript_translation.py`
  appelle `/raw-content` sans paramètre, donc sur le comportement par défaut
  inchangé.
- **La vérification visuelle sur simulateur** (la ligne du titre qui ne casse pas
  sur deux lignes avec les libellés allemand et portugais, l'instantanéité du
  second tap) reste la note owner de la description : elle n'est pas atteignable
  depuis un worktree, et n'était volontairement pas un AC.
<!-- SECTION:NOTES:END -->
