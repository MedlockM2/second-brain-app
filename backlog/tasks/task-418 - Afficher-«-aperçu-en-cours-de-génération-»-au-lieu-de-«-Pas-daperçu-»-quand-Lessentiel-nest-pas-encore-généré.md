---
id: TASK-418
title: >-
  Afficher « aperçu en cours de génération » au lieu de « Pas d'aperçu » quand
  L'essentiel n'est pas encore généré
status: To Do
assignee: []
created_date: '2026-09-29 10:21'
labels:
  - mobile
  - backend
  - bug
dependencies: []
references:
  - mobile/src/components/SourcePreview.tsx
  - mobile/src/components/CompletedDetailView.tsx
  - mobile/src/i18n/fr.ts
  - media_summarizer/api/endpoints/media.py
  - media_summarizer/api/models/media_contracts.py
  - media_summarizer/workers/events/media_completed_worker.py
  - media_summarizer/core/services/review_blurb_service.py
  - media_summarizer/core/services/artifact_service.py
priority: high
type: bug
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Le symptôme

On ouvre un media juste après la fin de son traitement, avant que la section **« L'essentiel »** soit générée : le bloc affiche la ligne terminale « Pas d'aperçu pour cette source. » (`preview.unavailable`, `mobile/src/i18n/fr.ts:336`), avec l'icône info et **sans spinner**. L'aperçu arrive pourtant quelques instants plus tard. Attendu : la même honnêteté que la traduction du texte complet (`transcript.translating` → « Traduction du texte… »), c'est-à-dire la ligne d'attente « l'aperçu est en cours de génération » tant que la génération est encore devant nous.

**Le libellé n'est pas le sujet.** La chaîne d'attente existe déjà et est traduite dans les 10 langues (`preview.pending` = « L'aperçu est en cours de rédaction… »), et elle dit exactement ce que l'owner demande. Ne pas en créer une nouvelle : ce qui est cassé, c'est **l'état choisi**, pas son texte.

## La cause (lue avant d'écrire cette tâche — à confirmer, pas à re-découvrir)

Côté mobile, la machinerie est déjà correcte et ne doit pas être refaite : `resolveSourcePreviewState` (`SourcePreview.tsx:69-83`) affiche la ligne d'attente si et seulement si le serveur dit `review_blurb_status === "pending"`, et cet état arme un poll borné dans `CompletedDetailView.tsx:807-849` (20 tentatives × 3 s), rechargé à chaque retour sur l'écran. Le client fait donc ce qu'on lui dit ; **c'est le serveur qui lui dit `failed` trop tôt.**

`_resolve_review_blurb_status` (`media_summarizer/api/endpoints/media.py:1037-1069`) lit l'entrée interne du scope artifact. Quand il n'y en a **aucune**, il tranche sur le cycle de vie du job (`:1061-1066`) : job encore en cours → `pending`, job terminé → `failed` (« le trigger a tiré et a été perdu »).

Or le trigger tire **après** que le job est terminé, pas avant : `_trigger_review_blurb` vit dans le worker d'événement `media_completed` (`workers/events/media_completed_worker.py:105-137`), consommé sur SQS après la complétion. Il existe donc une fenêtre — le temps de livraison et d'exécution du message — où le job est `COMPLETED` et où aucune entrée n'existe encore. Dans cette fenêtre, la prémisse « absence d'entrée = génération perdue » est fausse : la génération n'est pas perdue, elle n'est **pas encore demandée**. Et le verdict `failed` est doublement punitif côté client, puisqu'il n'arme aucun poll : rien ne va chercher l'aperçu qui arrive une seconde plus tard, seul un retour sur l'écran le rattrape.

## Ce qu'il faut faire

Donner à ce cas — **pas d'entrée interne du tout**, job terminé — un **délai de grâce** mesuré depuis la fin du traitement, pendant lequel la réponse reste `pending` ; passé ce délai seulement, `failed`. L'horodatage de référence est `job.completed_at` (`core/models/processing_job.py:142`) avec repli sur `record.updated_at` quand il manque ; `job` est disponible au point d'appel (`media.py:2197`), contrairement à la signature actuelle qui ne reçoit que `job_status`.

Le délai se dimensionne sur le chemin réel (publication de l'événement → SQS → worker → écriture de l'entrée `queued`), pas sur un chiffre rond : le justifier en commentaire comme le fait `INTERNAL_GENERATION_STALL_SECONDS` (`artifact_service.py:148-156`), et le rendre réglable par variable d'environnement dans la même forme. Il doit rester **largement en dessous** de la borne qui ferme déjà l'attente côté client (20 × 3 s = 60 s de poll, rechargé au focus) : la grâce ne doit pas transformer une génération réellement perdue en attente que le client abandonne sans réponse.

Les trois autres verdicts ne changent pas : une entrée `queued`/`generating` reste `pending`, `ready` reste `ready`, `failed` reste `failed`, et le blurb déjà présent sur la ligne gagne toujours (`SourcePreview.tsx:77-79`). La fin d'attente par stall (task-391) reste intacte : ici on ne touche qu'à la branche « aucune entrée ».

Mettre à jour les deux docstrings qui affirment aujourd'hui l'inverse et qui sont la raison pour laquelle le bug a l'air voulu : `_resolve_review_blurb_status` (« already over means it fired and was lost ») et `ReviewBlurbStatus` (`api/models/media_contracts.py:130-134`, « a missing entry is not "not started yet" »).

Vérifier au passage le **cas dédupliqué** : `_provision_review_blurb` (`core/services/durable_media_service.py:301-337`) tire le trigger dans la requête de sauvegarde, donc la fenêtre y est bien plus courte — dire dans les notes d'implémentation si le délai de grâce y change quelque chose, sans élargir la tâche.

## Notes pour l'owner (non vérifiables par l'agent, à faire après merge et déploiement)

- **E2E manuel** : enregistrer un nouveau media, attendre la fin du traitement, puis ouvrir la fiche immédiatement. Attendu : « L'essentiel » montre le spinner et la ligne d'attente, puis le hook et les puces arrivent sans quitter l'écran (le poll de 3 s les apporte). La ligne « Pas d'aperçu pour cette source. » ne doit plus apparaître dans ce scénario.
- **Contre-épreuve** : sur un media ancien dont l'aperçu a réellement été perdu (aucune entrée interne, complété il y a des jours), la ligne terminale doit toujours s'afficher, sans spinner — sinon la grâce est mal bornée.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 _resolve_review_blurb_status reçoit le job (pas seulement job_status) et, dans la branche « aucune entrée interne » sur un job terminé, répond pending tant que la fin du traitement date de moins que le délai de grâce, et failed au-delà
- [ ] #2 L'horodatage de référence du délai est job.completed_at avec repli documenté sur record.updated_at quand il est absent, sans jamais lever si les deux manquent
- [ ] #3 Le délai est une constante réglable par variable d'environnement, dans la forme de INTERNAL_GENERATION_STALL_SECONDS, avec un commentaire qui justifie sa valeur par le chemin publication → SQS → worker → écriture de l'entrée queued, et la variable est déclarée dans .env.example (guard CI)
- [ ] #4 La valeur retenue est strictement inférieure à la borne du poll client (PREVIEW_POLL_MAX_ATTEMPTS × PREVIEW_POLL_DELAY_MS dans CompletedDetailView.tsx), et la comparaison est écrite dans les notes d'implémentation
- [ ] #5 Les autres verdicts sont inchangés : entrée queued ou generating → pending, ready → ready, failed → failed, et la fin d'attente par stall de task-391 continue de rendre failed
- [ ] #6 La docstring de _resolve_review_blurb_status et celle de ReviewBlurbStatus (api/models/media_contracts.py) ne disent plus qu'une entrée absente sur un job terminé est une génération perdue, et décrivent le délai de grâce
- [ ] #7 Le comportement du chemin dédupliqué (durable_media_service._provision_review_blurb) est tracé dans les notes d'implémentation : ce que le délai de grâce y change, ou pourquoi rien
- [ ] #8 Aucune nouvelle chaîne i18n n'est ajoutée pour l'attente : preview.pending reste la ligne affichée, et resolveSourcePreviewState (mobile/src/components/SourcePreview.tsx) n'est pas modifié
- [ ] #9 ruff et mypy propres sur media_summarizer/ ; si un fichier mobile a été touché, lint et tsc --noEmit propres sur mobile/
- [ ] #10 Une vérification directe contre le -dev est consignée dans les notes d'implémentation : GET /api/media/{id} sur un media dont le scope n'a aucune entrée interne renvoie review_blurb_status pending dans la fenêtre de grâce et failed en dehors (media_item_id et horodatages cités)
<!-- AC:END -->
