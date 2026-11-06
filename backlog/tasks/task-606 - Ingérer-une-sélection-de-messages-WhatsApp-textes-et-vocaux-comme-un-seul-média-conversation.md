---
id: TASK-606
title: >-
  Ingérer une sélection de messages WhatsApp (textes et vocaux) comme un seul
  média conversation
status: Done
assignee: []
created_date: '2026-11-06 16:03'
updated_date: '2026-11-06 16:39'
labels:
  - ingestion
  - backend
dependencies: []
references:
  - media_summarizer/api/endpoints/media.py
  - media_summarizer/core/media_ingestion/use_cases.py
  - media_summarizer/core/media_ingestion/adapters/orchestrators.py
  - media_summarizer/core/media_ingestion/domain.py
  - mobile/src/components/TranscriptReader.tsx
  - web/src/components/media/ReadingBody.tsx
priority: high
type: feature
ordinal: 213000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Responsabilité : agent — code et contrôles dans son worktree, vérification contre `-dev`. Aucun merge, push ni déploiement demandé par les critères.

## Constat (2026-11-06)

Sur iOS, quand un utilisateur sélectionne plusieurs messages WhatsApp et les partage vers l'app :
- les textes arrivent collés par une virgule (`expo-share-intent`, `ExpoShareIntentModule.swift:127`, `joined(separator: ",")`). Le « Texte complet » ne montre aucune limite entre les messages ;
- un message vocal inclus dans la sélection est perdu. L'extension ne transmet que la liste du type du dernier élément traité. La tâche mobile liée (task-607) corrige ce point.

**Ce que WhatsApp transmet, vérifié sur dev le 2026-11-06** (fichiers `ae36d573-….txt` et `f7b7e7fe-….txt` du bucket des transcriptions) : seulement le **corps** de chaque message. Pas d'auteur, pas d'heure. Chaque élément se termine par un retour à la ligne. Exemple stocké :

```
Oui pour ça que je voulais me barrer samedi soir
,You need rent money ?
,Mdrrr c’est quoi ça
```

`POST /api/media/ingest-shared-content` ne connaît aujourd'hui que deux cas : `share_type` `text` (une note) et `audio` (un vocal). Rien ne permet d'envoyer une suite ordonnée de messages mêlant textes et vocaux.

## Attendu (décision de l'owner, 2026-11-06)

Une sélection de plusieurs messages produit **un seul média**. Son texte complet contient le texte des messages et la transcription des vocaux, dans l'ordre de la sélection. On doit pouvoir le lire comme une conversation.

Cela vaut pour toute sélection d'au moins deux éléments, y compris une sélection faite uniquement de textes. Un texte seul reste une note et un vocal seul reste un vocal, comme aujourd'hui.

### Contrat d'entrée

Un nouveau `share_type` (nom au choix de l'implémenteur, par exemple `conversation`) porte une liste ordonnée de messages. Chaque message est :
- soit un texte, débarrassé de ses blancs de début et de fin ;
- soit un vocal, désigné par une `upload_key` obtenue comme pour `shared_audio`.

Les limites existantes s'appliquent par message : formats, taille d'un vocal, plafond de texte. Il faut aussi un plafond du nombre de messages, à fixer et documenter. Le quota de minutes audio compte la somme des durées des vocaux, avec la même règle de refus qu'un vocal seul.

On n'essaie pas d'extraire un auteur ou une heure : WhatsApp ne les transmet pas.

### Ce qui est stocké

- **Le texte complet** : un paragraphe par message, séparés par une ligne vide, comme le reste des transcriptions, pour que la recherche, le résumé et le chat le lisent sans changement. Le paragraphe d'un vocal porte un marqueur stable qui l'identifie comme vocal. Le libellé du marqueur se choisit ici et se documente.
- **Une structure par message**, exposée par la lecture du média que consomment `TranscriptReader` (mobile) et `ReadingBody` (web). Pour chaque message : son type (texte ou vocal), son texte ou sa transcription, et la durée d'un vocal. L'affichage « conversation » se construira sur cette structure (tâche liée, après maquette).

L'identité du média (locator ou hash) couvre tous les messages et le compte de l'utilisateur, comme pour un vocal partagé (task-393). Si un vocal ne se transcrit pas, le média reste lisible : ce message est marqué « non transcrit » à sa place. Toute la sélection n'échoue pas pour autant.

Pas de couche de compatibilité : les chemins `text` et `audio` actuels ne changent pas, et rien d'ancien n'est à conserver.

## Note à l'owner (hors critères)

Après déploiement et build de task-607, partager depuis WhatsApp iOS une sélection de 3 textes et 1 vocal, puis vérifier le texte complet.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `POST /api/media/ingest-shared-content` accepte `share_type=conversation` portant une liste ordonnée de messages texte et vocaux, et crée un seul média ; les share_type `text` et `audio` existants sont inchangés.
- [x] #2 Chaque vocal est transcrit par sa propre requête Deepgram, sous sa propre part de budget, et sa transcription prend sa place dans l'ordre de la sélection.
- [x] #3 Le texte complet est une ligne par message commençant par un tiret, sans virgule ni ligne vide ; une ligne de vocal porte `🎤 (m:ss)` puis sa transcription (décision de l'owner, 2026-11-06).
- [x] #4 L'admission budgétaire compte une ligne de transcription par vocal, bornée par sa durée sondée ; le plafond de 50 messages et le plafond de texte sont appliqués.
- [x] #5 Un vocal que Deepgram ne transcrit pas garde son marqueur et sa durée à sa place, sans faire échouer la sélection.
- [x] #6 Le contrat est documenté dans `docs/CANONICAL_MEDIA_API_CONTRACT.md` (« Shared conversation »).
- [x] #7 `ruff` et `mypy` passent sans erreur.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-11-06 — décision de l'owner : pas de maquette ni d'affichage dédié. Les messages sont séparés par un simple saut de ligne et un tiret en tête de chaque message. La structure par message exposée au lecteur est abandonnée : la liste Markdown suffit, `TranscriptReader` et `ReadingBody` la dessinent déjà. Le brouillon DRAFT-1 (affichage conversation) est supprimé.

Implémentation :
- `core/media_ingestion/conversation.py` : mise en forme, parts de budget `voiceN`, hash de la sélection ;
- `api/endpoints/media.py` : `_stage_shared_conversation` ;
- `use_cases.py` : `_submit_conversation` (texte seul : stocké comme une note ; avec vocaux : passe par le worker) ;
- `orchestrators.py` : admission de tous les vocaux, plan dans `<job>.conversation.json`, envoi au worker ;
- `deepgram_worker.py` : `_process_conversation`, qui transcrit, assemble, règle le budget puis supprime les vocaux.

Note à l'owner : la vérification contre `-dev` attend le déploiement du push sur `main`. Partager depuis WhatsApp iOS 3 textes + 1 vocal avec le build de task-607.
<!-- SECTION:NOTES:END -->
