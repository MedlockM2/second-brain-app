---
id: TASK-407
title: >-
  Reformuler la notification de fin de traitement pour qu'elle nomme le type de
  média
status: To Do
assignee: []
created_date: '2026-09-18 14:59'
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
- [ ] #1 Le titre de la notification de fin de traitement est « Ready to deepen » chez le producteur backend.
- [ ] #2 Le nom du canal Android équivalent est mis à jour de façon cohérente avec ce nouveau titre dans les 12 fichiers de locale, chacun dans sa langue.
- [ ] #3 Le corps de la notification nomme la catégorie du média traité et ne contient ni son titre, ni son créateur, ni sa plateforme source.
- [ ] #4 Chaque valeur que les chemins d'ingestion écrivent réellement dans `media_type` a un libellé associé, et la liste de ces valeurs est relevée depuis le code puis consignée dans les Implementation Notes de la tâche.
- [ ] #5 Une valeur de `media_type` absente, inconnue ou hors enum produit un libellé générique, et jamais l'exposition de la valeur brute.
- [ ] #6 Le type de média est acheminé jusqu'au point d'envoi de la notification pour les deux appels existants : l'utilisateur soumetteur et le fan-out des watchers.
- [ ] #7 `ruff check media_summarizer/` passe et `mypy` ne signale aucune nouvelle erreur sur les fichiers modifiés.
- [ ] #8 `npm run typecheck` et `npm run lint` passent dans `mobile/`.
<!-- AC:END -->
