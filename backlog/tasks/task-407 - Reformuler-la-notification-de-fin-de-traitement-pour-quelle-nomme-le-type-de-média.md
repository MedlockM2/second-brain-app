---
id: TASK-407
title: >-
  Reformuler la notification de fin de traitement pour qu'elle nomme le type de
  média
status: To Do
assignee: []
created_date: '2026-09-18 14:59'
updated_date: '2026-09-18 18:20'
labels:
  - mobile
  - ux
dependencies: []
references:
  - >-
    task-368 — règle de confidentialité des payloads push (aucun titre, créateur
    ou source)
  - >-
    docs/research/task-404-media-processing-completion-ui/README.md — §7.10
    locale par compte hors périmètre
modified_files:
  - media_summarizer/core/services/push_notification_dispatch.py
  - media_summarizer/workers/events/media_completed_worker.py
  - mobile/src/i18n/en.ts
  - mobile/src/services/pushNotificationService.ts
priority: medium
type: enhancement
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
La notification livrée par task-405 annonce « Ready to read » / « 1 source is ready. ». Deux défauts : le compteur ne dit pas à la personne *ce qui* est prêt, alors qu'elle vient d'en sauvegarder un seul et sait très bien compter jusqu'à un ; et « read » décrit mal ce que l'app propose d'en faire, qui est d'approfondir une source, pas seulement de la lire.

**Décision de l'owner prise le 2026-09-18 au dépôt de cette tâche, et qui prime sur la formulation d'origine de la demande.** Le corps nomme la *catégorie* du média — « Your video has been processed », « Your article has been processed » — et **jamais la plateforme source** : pas de « Your YouTube video ». Raison : Expo relaie le payload et son personnel peut le lire en debug, donc la règle héritée de task-368 et réaffirmée sur task-404 veut qu'aucun titre, aucun créateur et aucune source ne voyage. Nommer la catégorie est le compromis retenu : plus spécifique qu'un compteur, sans révéler de quel service la personne se nourrit. La demande initiale citait « Your youtube video has been processed » en exemple ; c'est cette partie-là qui a été écartée, pas l'intention de spécificité.

Deux points qu'un implémenteur ne peut pas deviner :

- « Ready to read » ne vit pas qu'au producteur : c'est aussi le nom du canal de notification Android côté app, traduit dans 12 fichiers de locale (`notifications.mediaReadyChannel`). Changer l'un sans l'autre laisserait les réglages Android étiqueter la catégorie autrement que les notifications qu'elle porte.
- `job.media_type` est faiblement typé (`Optional[str]`) et au moins un chemin d'ingestion y écrit une valeur absente de l'enum `MediaType` — `document_parsing/worker.py` écrit `"document"`. Un mappage calqué sur l'enum retomberait donc silencieusement sur le défaut pour les documents.

Hors périmètre, à ne pas résoudre ici : le corps est rendu par le backend en anglais pour les 12 langues de l'app, faute de locale par compte (limitation actée en §7.10 de task-404). Une phrase complète rendra cette limite plus visible qu'un compteur ne le faisait. C'est une dette antérieure à cette tâche.

Note pour l'owner : le texte n'est vérifiable qu'après déploiement backend, et la cohérence du libellé de canal se lit dans les réglages Android de l'appareil. Ces deux contrôles sont les tiens, ils ne sont pas des critères d'acceptation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le titre de la notification de fin de traitement est « Ready to deepen » chez le producteur backend.
- [x] #2 Le nom du canal Android équivalent est mis à jour de façon cohérente avec ce nouveau titre dans les 12 fichiers de locale, chacun dans sa langue.
- [x] #3 Le corps de la notification nomme la catégorie du média traité et ne contient ni son titre, ni son créateur, ni sa plateforme source.
- [x] #4 Chaque valeur que les chemins d'ingestion écrivent réellement dans `media_type` a un libellé associé, et la liste de ces valeurs est relevée depuis le code puis consignée dans les Implementation Notes de la tâche.
- [x] #5 Une valeur de `media_type` absente, inconnue ou hors enum produit un libellé générique, et jamais l'exposition de la valeur brute.
- [x] #6 Le type de média est acheminé jusqu'au point d'envoi de la notification pour les deux appels existants : l'utilisateur soumetteur et le fan-out des watchers.
- [x] #7 `ruff check media_summarizer/` passe et `mypy` ne signale aucune nouvelle erreur sur les fichiers modifiés.
- [x] #8 `npm run typecheck` et `npm run lint` passent dans `mobile/`.
<!-- AC:END -->

## Implementation Notes
<!-- SECTION:NOTES:BEGIN -->
**Le texte.** `core/services/push_notification_dispatch.py` titre « Ready to deepen » et construit le corps
`f"Your {_media_label(media_type)} has been processed."`. Le compteur (« 1 source is ready. ») disparaît sans
repli, et le paragraphe du docstring du module qui le justifiait est réécrit : il décrivait la règle de
confidentialité comme « le corps dit *combien* de sources sont prêtes et jamais lesquelles », ce qui n'est plus
la formulation retenue. La règle elle-même est inchangée et maintenant explicite sur la plateforme :
« Your video has been processed », jamais « Your YouTube video ».

**AC#4 — relevé des valeurs réellement écrites dans `media_type`.** Grep sur toutes les affectations
(`media_type=` et `job.media_type =`), pas sur l'enum. Neuf valeurs, croisées avec §2.3 du benchmark task-404
qui mesure la distribution réelle sur `processing_jobs-dev` (87 jobs) et n'en observe aucune autre :

| valeur | écrite par | libellé |
| --- | --- | --- |
| `podcast_episode` | `core/media_ingestion/adapters/resolvers.py:177/191` (enum) ; `core/services/media_submission.py:98` | podcast episode |
| `article` | `resolvers.py:257/282/309/318/346/364` (enum) | article |
| `youtube_video` | `resolvers.py:392/410` (enum) | video |
| `short_video` | `resolvers.py:437/455/471/489/505/521`, `infrastructure/resolvers/instagram_apify_resolver.py:301/318` (enum) | video |
| `image_post` | `instagram_apify_resolver.py:372/391`, `workers/instagram_ingestion_worker.py:588` (enum) | image |
| `audio_file` | `resolvers.py:537/562`, `core/media_ingestion/use_cases.py:230` (enum) | audio |
| `shared_text` | `use_cases.py:178` (enum) | note |
| **`document`** | `api/endpoints/media.py:1604/1614`, `workers/document_parsing/worker.py:397` | document |
| **`audio`** | `api/endpoints/media.py:1766/1783/1797` | audio |

Les deux en gras sont **hors de l'enum `MediaType`** : une table calquée sur l'enum aurait envoyé au libellé
générique les 24 documents et tous les fichiers audio téléversés. `MediaType.UNKNOWN` existe mais aucun
resolver ne l'émet — traité comme l'absence.

**AC#5.** `_media_label` normalise (`strip().lower()`), rend `GENERIC_MEDIA_LABEL = "source"` pour une valeur
absente, `unknown`, ou inconnue de la table, et n'interpole jamais la valeur brute dans le corps : un jeton
interne comme `short_video` dans une notification serait une fuite de vocabulaire. Une valeur non vide et non
mappée émet en plus un `WARNING` structuré (`push_notification.media_ready_unlabelled_type`, `media_type` est
un champ déclaré du schéma de log) : c'est le seul endroit d'où l'on voit un futur chemin d'ingestion perdre
silencieusement sa spécificité.

**AC#6 — acheminement.** Les deux appels de `workers/events/media_completed_worker.py` passent désormais
`media_type` : `canonical_job.media_type` pour le soumetteur, `getattr(job, "media_type", None)` pour chaque
watcher (le job du watcher, pas le canonique — même contenu, mais la catégorie est lue sur la ligne qui
appartient à la personne prévenue). Aucun symbole que task-406 supprime n'est touché ni réintroduit.

**Un trou d'acheminement corrigé en amont.** `core/services/media_submission.py` (soumission depuis la
recherche podcast in-app) écrivait `media_type="podcast_episode"` sur la ligne durable mais laissait le
`ProcessingJob` sans `media_type` — seul chemin d'ingestion dans ce cas. Comme la notification lit le job, le
même épisode était annoncé « Your podcast episode… » via un lien Spotify partagé (chemin orchestrateur) et
« Your source… » via la recherche in-app. Une ligne ajoutée au constructeur du job, avec la valeur que la
ligne durable portait déjà. Vérifié sans effet ailleurs : les seuls autres lecteurs de `job.media_type` sont
`raw_content_service._detect_source_format` (aucune branche ne teste `podcast_episode`, classification
inchangée) et `durable_media_service.display_attributes_from_job` (recopie sur la ligne la valeur qu'elle a
déjà).

**AC#2 — 11 catalogues, pas 12.** `notifications.mediaReadyChannel` existe dans les 11 fichiers de
`mobile/src/i18n/` qui correspondent aux 11 `SUPPORTED_LOCALES` (`en fr es de it pt nl ja zh ar hi`) ;
`pseudo.ts` est une transformation appliquée à l'exécution sur un catalogue réel, pas un fichier de locale
portant la clé. Le décompte « 12 » de la description est donc à un près, et les 11 sont traduits chacun dans sa
langue : « Prêt à approfondir », « Listo para profundizar », « Bereit zum Vertiefen », « Pronto da
approfondire », « Pronto para aprofundar », « Klaar om te verdiepen », « 深掘りの準備完了 », « 可以深入了解了 »,
« جاهز للتعمّق », « गहराई से समझने के लिए तैयार ». Le commentaire de `en.ts` dit maintenant *pourquoi* la valeur
est contrainte : elle doit dire la même chose que le titre produit par le backend, sinon les réglages Android
nomment la catégorie autrement que les notifications qu'elle contient.

**Hors périmètre, inchangé.** Le corps reste rendu en anglais pour les 11 langues de l'interface, faute de
locale par compte (§7.10 de task-404). Une phrase complète rend cette dette plus visible qu'un compteur, et
c'est le seul effet de cette tâche sur elle. `mobile/src/services/pushNotificationService.ts` n'a finalement
rien à changer : il ne contient aucun libellé de notification, seulement l'id de canal et la clé i18n.

**Vérifications.** `ruff check media_summarizer/` → *All checks passed!* ; `mypy media_summarizer/` →
*Success: no issues found in 192 source files* ; `npm run typecheck` dans `mobile/` → propre ; `npm run lint` →
0 erreur, 1 avertissement préexistant dans `src/services/purchaseService.ts:136` (fichier non touché).

**Ce qui reste à l'owner** (non cochable ici, et non transformé en AC) : le texte ne se lit qu'après
déploiement backend sur `main`, et la cohérence titre ↔ nom de canal se vérifie dans les réglages de
notification Android de l'appareil.
<!-- SECTION:NOTES:END -->
