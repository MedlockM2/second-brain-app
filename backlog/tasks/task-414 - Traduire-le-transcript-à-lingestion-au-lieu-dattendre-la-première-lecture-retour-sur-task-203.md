---
id: TASK-414
title: >-
  Traduire le transcript à l'ingestion au lieu d'attendre la première lecture
  (retour sur task-203)
status: To Do
assignee: []
created_date: '2026-09-27 21:28'
labels:
  - ingestion
dependencies: []
references:
  - >-
    backlog/tasks/task-203 -
    Aligner-la-traduction-de-transcript-async-sur-le-pattern-détat-idempotence-des-artefacts-pour-supprimer-le-prewarm-bloquant-et-la-tempête-de-re-traductions-suite-task-200.md
  - >-
    backlog/tasks/task-395 -
    Traduire-les-artefacts-et-laperçu-sur-changement-de-langue-au-lieu-de-les-régénérer.md
priority: medium
type: feature
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Contexte

Feedback testeur `AKsI1Vm2Fgu7CqMkppRaWG8` (rapport de triage `report-2026-09-27.md`, section 2) : le pill « Traduction en cours… » s'affiche pour un média traité il y a longtemps (vu dans le Digest hebdomadaire). Diagnostic établi (`report-2026-09-23.md`, confirmé le 27) : ce n'est pas l'âge du média qui déclenche la traduction, c'est le fait qu'il n'a jamais été **lu** dans cette langue — `GET /api/media/{id}/raw-content` est le seul déclencheur, introduit par task-203 (`Done`) pour remplacer un prewarm synchrone bloquant qui timeoutait systématiquement (45 s, task-192/200) et provoquait une tempête de re-traductions.

**Décision owner : revenir sur ce choix.** La traduction doit démarrer au partage/à l'ingestion, pas à la première lecture, pour qu'elle soit déjà prête à l'ouverture du média (Digest ou ailleurs) — c'est ce que demandait explicitement le testeur.

## Contrainte héritée de task-203, à préserver absolument

L'enqueue à l'ingestion doit être **asynchrone et non bloquant**. Ne pas réintroduire le prewarm synchrone `await` de task-192 : les workers d'ingestion doivent continuer à compléter le job immédiatement après l'upload du transcript, sans l'attendre. Réutiliser la machine à états déjà construite par task-203 (`none → queued → in_progress → done | failed`, réservation atomique par `ConditionExpression` sur `(transcript_s3_key, target_language)`) : c'est elle qui garantit qu'un enqueue proactif à l'ingestion et un enqueue paresseux ultérieur (ex. `/raw-content` lu par un autre compte, ou après un changement de langue de lecture) ne se marchent pas dessus et ne redéclenchent pas la tempête de re-traductions que task-203 a éliminée.

Langue cible à déterminer par l'implémenteur : la langue de lecture du compte à l'origine du partage, sur le modèle déjà en place pour les artefacts (task-395).

## Hors scope

Les artefacts (résumés, quiz, aperçu…) traduits par task-395 restent traduits à l'ouverture, pas à l'ingestion — cette tâche ne couvre que le transcript complet (`transcript_translation_worker` / le chemin `/raw-content`). Étendre la même logique aux artefacts serait une tâche séparée si l'owner le demande.

Le bug mobile signalé dans le même feedback (le sondage de traduction plafonne à 60 s alors qu'une traduction prend 60-90 s, et affiche alors l'anglais non traduit comme définitif) n'est pas couvert ici — il chevauche les tâches en cours task-410/task-411 sur le même écran et fait l'objet d'un arbitrage séparé.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Après l'upload du transcript par un worker d'ingestion, une traduction vers la langue de lecture du compte à l'origine du partage est enqueuée automatiquement, sans que le job d'ingestion attende la fin de cette traduction pour se compléter.
- [ ] #2 L'enqueue proactif passe par la réservation atomique existante de task-203 : si une traduction pour ce couple (transcript_s3_key, target_language) est déjà queued/in_progress/done, aucun second job n'est enqueué.
- [ ] #3 Si la langue de lecture du compte au moment du partage correspond à la langue détectée du transcript, aucune traduction n'est enqueuée.
- [ ] #4 GET /api/media/{id}/raw-content reste fonctionnel comme filet de secours (changement de langue de lecture après coup, lecture par un autre compte) : le déclenchement paresseux existant n'est pas supprimé, seulement complété par le déclenchement proactif.
- [ ] #5 ruff et mypy passent sans erreur sur les modules touchés.
- [ ] #6 Une vérification directe contre DynamoDB/S3 -dev réels, documentée dans les notes d'implémentation, montre qu'un partage déclenche l'enqueue (statut queued/in_progress posé, message SQS visible) sans attendre une lecture.
- [ ] #7 Aucun test automatisé ajouté (règle du projet).
<!-- AC:END -->
