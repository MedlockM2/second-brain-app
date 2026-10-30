---
id: TASK-572
title: >-
  Chat d'un dossier : signaler qu'une conversation ne lit plus les sources
  actuelles du dossier et proposer d'en ouvrir une nouvelle
status: Done
assignee: []
created_date: '2026-10-30 10:16'
updated_date: '2026-10-30 14:24'
labels:
  - mobile
  - web
  - chat
dependencies: []
references:
  - docs/CHAT_DATA_MODEL.md
  - docs/research/task-430-chatbot-architecture/README.md
  - media_summarizer/core/models/chat.py
  - media_summarizer/core/services/artifact_service.py
  - mobile/src/components/chat/ChatConversationModal.tsx
  - web/src/components/chat/useChatPane.tsx
priority: medium
type: enhancement
ordinal: 178000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Contexte

Une conversation de dossier fige ses sources à l'ouverture (`ChatSourceSnapshot.freeze`, `docs/CHAT_DATA_MODEL.md` §2.2, recommandation de task-430 §11.1 et §13.3). Chaque tour relit les textes de cet instantané, jamais l'état courant du dossier. Conséquence : si l'on ajoute un média au dossier puis qu'on reprend une conversation ouverte avant cet ajout, les réponses suivantes ignorent ce média — et un média retiré du dossier continue d'être lu. Rien dans l'interface ne le dit aujourd'hui : l'utilisateur qui interroge un média qu'il vient d'ajouter reçoit une réponse qui l'ignore sans comprendre pourquoi.

Décision de l'owner (2026-10-30) : **on garde l'instantané figé** (cohérence des réponses d'une même conversation, préfixe de cache préservé — un corpus modifié rendrait le tour suivant ~10× plus cher), **et on le rend visible**. Pas de mise à jour des sources dans une conversation existante.

## Comportement attendu

Quand une conversation de dossier est affichée et que les sources lisibles qu'elle lirait si on l'ouvrait maintenant diffèrent de son instantané, la conversation affiche un bandeau discret, par exemple « 2 sources ajoutées au dossier depuis le début de cette conversation », avec une action « Nouvelle conversation » qui ouvre une conversation neuve sur l'état actuel du dossier (le même chemin que le bouton nouvelle conversation de l'en-tête).

- Le bandeau compte les sources **ajoutées** et les sources **retirées** (formulation adaptée à chaque cas et au pluriel) ; une source qui devient lisible après l'ouverture (traitement terminé) compte comme ajoutée.
- La comparaison est faite par le serveur, seul à connaître la résolution des sources d'un dossier (sous-dossiers transitifs, sources exclues, plafonds) : `resolve_scope_sources` comparé à l'instantané, par exemple via la `version` de l'instantané qui hache déjà les paires `(media_item_id, transcript_s3_key)`. Le mobile et le web ne recalculent pas la liste du dossier.
- Le bandeau ne bloque ni la lecture ni la saisie : on peut continuer la conversation existante en connaissance de cause.
- Si le dossier actuel dépasse les plafonds (`scope_too_large`), l'action « Nouvelle conversation » aboutit au refus existant, sans nouveau message.
- Chat d'un média : hors périmètre (une seule source, l'instantané ne diverge pas de la même façon).

Mobile (`ChatConversationModal`) et web (`web/src/components/chat`) ont le même comportement. Textes dans les 11 catalogues i18n de `packages/core/src/i18n`.

## Note à l'owner (hors AC)

Après déploiement de l'API et OTA : ouvrir une conversation dans un dossier, y ajouter un média, rouvrir la conversation depuis l'historique et vérifier le bandeau puis l'action « Nouvelle conversation », sur iOS et sur le web.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le détail d'une conversation de dossier renvoyé par l'API expose le nombre de sources ajoutées et retirées par rapport à l'état actuel du dossier, calculé côté serveur à partir de `resolve_scope_sources` ; une conversation de média n'expose pas cette divergence
- [x] #2 Le mobile affiche le bandeau dans la conversation quand ce nombre est non nul, avec une action qui ouvre une nouvelle conversation sur le même dossier par le chemin existant ; sans divergence, rien n'est affiché
- [x] #3 Le web affiche le même bandeau avec la même action
- [x] #4 Les libellés du bandeau (ajout, retrait, les deux, singulier et pluriel) existent dans les 11 catalogues i18n
- [x] #5 `docs/CHAT_DATA_MODEL.md` §2.2 décrit que l'instantané reste figé et que la divergence avec le dossier est signalée à l'utilisateur
- [x] #6 ruff et mypy propres sur le code serveur modifié ; typecheck et lint de mobile, web et packages/core propres
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-30, première partie (serveur, doc, maquette) :
- chat_service.source_drift : pour une conversation de dossier, résout le dossier par resolve_scope_sources (même appel que open_conversation, dans la langue de la conversation) et compare ses sources lisibles aux lignes lisibles de l'instantané, par media_item_id. GET /api/chat/conversations/{id} renvoie source_drift {added, removed} ; null pour un média, pour la réponse d'ouverture, pendant une génération (le détail est relu toutes les 2 s et la résolution lit chaque transcription), ou si le dossier ne se résout pas. ruff et mypy passent.
- docs/CHAT_DATA_MODEL.md §2.2 : l'instantané reste figé, sa divergence est signalée.
- Maquette mobile-design-mockups/chat_source_drift_banner/ (code.html, screen.png) : deux emplacements (A sous l'en-tête, recommandé ; B au-dessus du champ), clair/sombre, cinq libellés. En attente du go de l'owner avant le code mobile, web et i18n (règle : maquette d'abord).

2026-10-30, go de l'owner : emplacement A (fixe sous l'en-tête), sur un fond d'avertissement cohérent avec le design system.
- Nouveau token warningTint (ambre en lavis : 18 % en clair, 14 % en sombre), à côté de errorTint / successTint, dans mobile/src/constants/theme.ts et web/src/styles.css (--warning-tint). Texte textMain (12,0:1 clair, 11,5:1 sombre). Glyphe warning-outline en primaryInk, décoratif (2,8:1 en clair, le texte porte le sens).
- packages/core/src/chat/sourceDrift.ts : describeSourceDrift (texte du bandeau) et withKnownSourceDrift (garde la dernière valeur quand le serveur ne la mesure pas pendant une génération). Utilisés par ChatSessionContext / ChatDock / ChatConversationModal (mobile) et useChat / useChatPane (web ; nouvel emplacement PaneSpec.notice, hors du corps qui défile). Action « Nouvelle conversation » = startNew existant, désactivée pendant une génération.
- i18n : chat.drift.added/removed (.one/.other, plus two/few/many en arabe), chat.drift.both, chat.drift.addedCount/removedCount, dans les 11 catalogues.
- Icône warning-outline ajoutée au jeu du web (extract_icons.py).
- typecheck et lint propres sur packages/core, mobile et web.
- Note owner : après déploiement de l'API et OTA, vérifier sur iOS et le web (ouvrir une conversation de dossier, ajouter un média, rouvrir la conversation depuis l'historique).
<!-- SECTION:NOTES:END -->
