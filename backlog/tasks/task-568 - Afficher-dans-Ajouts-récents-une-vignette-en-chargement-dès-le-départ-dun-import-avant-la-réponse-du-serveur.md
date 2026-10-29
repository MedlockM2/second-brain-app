---
id: TASK-568
title: >-
  Afficher dans Ajouts récents une vignette en chargement dès le départ d'un
  import, avant la réponse du serveur
status: Done
assignee: []
created_date: '2026-10-29 15:20'
updated_date: '2026-10-29 15:26'
labels:
  - mobile
dependencies: []
references:
  - mobile/src/contexts/ShareIntentContext.tsx
  - mobile/src/services/uploadService.ts
  - mobile/src/services/presignedUpload.ts
  - mobile/src/components/HomeTile.tsx
  - mobile/app/(tabs)/inbox.tsx
  - media_summarizer/api/endpoints/media.py
  - media_summarizer/core/services/durable_media_service.py
priority: medium
type: enhancement
ordinal: 174000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Un import qui met du temps à partir ne laisse aucune trace à l'écran. Le 2026-10-29, l'owner a importé depuis la galerie une capture d'écran PNG de 2,8 Mo (compte dev `4cd1abcb…`). Pendant ~21 s, rien n'est apparu dans Ajouts récents. Il a donc relancé l'import, et les deux vignettes sont apparues à 8 s d'écart (doublon).

Logs `media-summarizer-api-dev` :
- 15:10:43.607 `POST /api/media/upload-url` n°1 (`IMG_4622.png`, 2 796 034 octets) ;
- 15:11:01.560 `upload-url` n°2, même fichier (la relance) ;
- 15:11:05.007 `POST /api/media/upload` n°1 → `mi_ce768922…` ;
- 15:11:13.325 `POST /api/media/upload` n°2 → `mi_cf0d934c…`.

Pourquoi rien ne s'affiche : la ligne `user_media` n'existe qu'une fois `POST /api/media/upload` traité. Ce POST ne part qu'après le PUT direct vers S3 (task-345). Côté app, l'écran d'accueil n'est prévenu qu'au moment de la création de l'enregistrement (`registerSave` → `announceMediaSave`), après la réponse du POST. Comme le modal se ferme dès qu'on répond à la question du dossier (task-389), un envoi lent sur un réseau mobile ne montre rien du tout, et l'utilisateur conclut que l'import a échoué.

Le serveur n'a pas à changer : chaque `POST /upload` crée volontairement un nouvel enregistrement (`save_media_for_user`). Le doublon vient de ce que l'utilisateur, sans aucun retour visuel, a refait le geste.

## Contrainte visuelle

La vignette provisoire reprend l'apparence existante d'une vignette en traitement (`HomeTile`), sans nouvel élément visuel. Si un libellé ou un état nouveau devient nécessaire, il faut d'abord modifier la maquette dans `mobile-design-mockups/` et attendre le go de l'owner avant de coder (règle owner : maquette avant le code).

## Note à l'owner (hors AC)

Vérification manuelle sur TestFlight ou en simulateur, avec un débit limité (Network Link Conditioner en 3G) : importer une capture PNG lourde. La vignette doit apparaître tout de suite et ne pas se dédoubler quand l'enregistrement arrive.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Dès qu'un import part de l'app ou du partage système (photo, fichier, audio, texte, URL), une vignette en chargement apparaît en tête d'Ajouts récents sur l'écran d'accueil, sans attendre la réponse de `POST /api/media/upload` ni des autres endpoints d'ingestion
- [x] #2 La vignette provisoire reste visible si le modal de confirmation est fermé (réponse à la question du dossier) avant la fin de l'envoi
- [x] #3 Quand le serveur renvoie le `media_item_id`, la vignette provisoire est remplacée par l'élément réel au même emplacement, sans que les deux apparaissent ensemble, même si `GET /api/media` renvoie l'élément avant que la réponse d'ingestion ne soit traitée
- [x] #4 Si l'envoi échoue (lecture du fichier, PUT S3, refus de l'API ou du quota), la vignette provisoire disparaît et le message d'erreur existant s'affiche comme aujourd'hui
- [x] #5 Deux imports lancés coup sur coup produisent deux vignettes provisoires distinctes, chacune remplacée par son propre élément
- [x] #6 La vignette provisoire reprend l'apparence existante d'une vignette en traitement, sans nouveau composant visuel
- [x] #7 `npm run lint` et `npx tsc --noEmit` passent sans erreur dans `mobile/`
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implémenté dans mobile/src/lib/pendingSaves.ts (registre module des envois en cours, même forme que mediaSaveNotice), câblé dans ShareIntentContext : submitUrl, submitSharedContent et submitUpload ouvrent une entrée avant l'appel, reportSaveCreated la résout avec le media_item_id avant announceMediaSave, reportSaveFailed la retire avant le message d'erreur existant (inchangé).

Ajouts récents (inbox.tsx, buildRecentlyAdded) dessine d'abord les envois en cours, plus récent en tête, comme une vignette HomeTile en statut pending (balayage et sous-titre de traitement existants, aucun nouveau visuel). Une entrée résolue prend l'id réel, donc la même clé React que l'élément de la liste : dès que GET /api/media le renvoie, l'entrée est retirée (settlePendingSaves) et l'élément réel prend sa place. Course GET avant réponse d'ingestion : chaque envoi sans réponse retient au plus un média apparu dans la liste depuis son départ (absent de la liste en cache au départ, créé après départ - 5 min). Une entrée résolue que la liste ne montre jamais (doublon dédupliqué hors première page, relecture refusée) expire après 2 min.

La vignette provisoire n'est pas pressable tant qu'elle n'a pas d'id (disabled), et n'arme pas useProcessingRefresh tant qu'elle n'a pas de réponse.

npx tsc --noEmit : 0 erreur ; npm run lint : 0 erreur (1 avertissement préexistant dans purchaseService.ts).

Web : n/a, la boîte d'ajout web reste ouverte et occupée jusqu'à la réponse.

Note owner : vérification manuelle en 3G (Network Link Conditioner) avec une capture PNG lourde, comme décrit dans la description.
<!-- SECTION:NOTES:END -->
