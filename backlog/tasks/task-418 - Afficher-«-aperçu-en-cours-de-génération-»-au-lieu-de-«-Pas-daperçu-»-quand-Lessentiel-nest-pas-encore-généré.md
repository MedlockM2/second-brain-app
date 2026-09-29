---
id: TASK-418
title: >-
  Afficher « aperçu en cours de génération » au lieu de « Pas d'aperçu » quand
  L'essentiel n'est pas encore généré
status: Done
assignee: []
created_date: '2026-09-29 10:21'
updated_date: '2026-09-29 10:41'
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
- [x] #1 _resolve_review_blurb_status reçoit le job (pas seulement job_status) et, dans la branche « aucune entrée interne » sur un job terminé, répond pending tant que la fin du traitement date de moins que le délai de grâce, et failed au-delà
- [x] #2 L'horodatage de référence du délai est job.completed_at avec repli documenté sur record.updated_at quand il est absent, sans jamais lever si les deux manquent
- [x] #3 Le délai est une constante réglable par variable d'environnement, dans la forme de INTERNAL_GENERATION_STALL_SECONDS, avec un commentaire qui justifie sa valeur par le chemin publication → SQS → worker → écriture de l'entrée queued, et la variable est déclarée dans .env.example (guard CI)
- [x] #4 La valeur retenue est strictement inférieure à la borne du poll client (PREVIEW_POLL_MAX_ATTEMPTS × PREVIEW_POLL_DELAY_MS dans CompletedDetailView.tsx), et la comparaison est écrite dans les notes d'implémentation
- [x] #5 Les autres verdicts sont inchangés : entrée queued ou generating → pending, ready → ready, failed → failed, et la fin d'attente par stall de task-391 continue de rendre failed
- [x] #6 La docstring de _resolve_review_blurb_status et celle de ReviewBlurbStatus (api/models/media_contracts.py) ne disent plus qu'une entrée absente sur un job terminé est une génération perdue, et décrivent le délai de grâce
- [x] #7 Le comportement du chemin dédupliqué (durable_media_service._provision_review_blurb) est tracé dans les notes d'implémentation : ce que le délai de grâce y change, ou pourquoi rien
- [x] #8 Aucune nouvelle chaîne i18n n'est ajoutée pour l'attente : preview.pending reste la ligne affichée, et resolveSourcePreviewState (mobile/src/components/SourcePreview.tsx) n'est pas modifié
- [x] #9 ruff et mypy propres sur media_summarizer/ ; si un fichier mobile a été touché, lint et tsc --noEmit propres sur mobile/
- [ ] #10 Une vérification directe contre le -dev est consignée dans les notes d'implémentation : GET /api/media/{id} sur un media dont le scope n'a aucune entrée interne renvoie review_blurb_status pending dans la fenêtre de grâce et failed en dehors (media_item_id et horodatages cités)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### What changed

`_resolve_review_blurb_status` (`media_summarizer/api/endpoints/media.py`) now takes the
`job` as well as the `job_status`, and its "no internal entry at all" branch splits in
three instead of two:

- job still running → `pending` (unchanged)
- job terminal, end of processing younger than the grace → `pending` (**new**)
- job terminal, older → `failed` (unchanged verdict, now only past the window)

The window lives in the new `_REVIEW_BLURB_TRIGGER_GRACE_SECONDS`
(`REVIEW_BLURB_TRIGGER_GRACE_SECONDS`, default **20 s**), and the recency test in the new
`_within_review_blurb_trigger_grace(record, job)`. Nothing else in the resolution moved:
the entry-present path still goes through `_ARTIFACT_STATUS_TO_REVIEW_BLURB_STATUS`
(`queued`/`generating` → `pending`, `ready` → `ready`, `failed` → `failed`), and
`latest_internal_artifact_status` still ends an in-flight entry past
`INTERNAL_GENERATION_STALL_SECONDS` on read, so task-391's stall termination is untouched
(it reaches the contract as an entry with status `failed`, not as an absent entry).

No mobile file was touched: `resolveSourcePreviewState` already maps `pending` onto the
waiting line, `preview.pending` is already translated, and the bounded poll in
`CompletedDetailView.tsx` is already armed by that state. The bug was the server's verdict.

### Why 20 s — measured on `-dev`, not rounded (AC #3, AC #4)

The quantity the grace has to cover is `entry.created_at − job.completed_at`: publication
of the completion event → SQS → the `media_completed_events` worker → the `queued` entry
written by `commit_artifact_generation`. Both instants are stored on `-dev`, so the window
is observable rather than estimated. Joining `user_media-dev` (`last_job_id`) to
`processing_jobs-dev` (`completed_at`) and to the per-user `review_blurb` entries in
`media_artifacts-dev` via the `scope-index` gives **72 saves that hold both instants**:

| min | median | p90 | max |
| --- | --- | --- | --- |
| 2.03 s | 9.39 s | 11.22 s | 11.91 s |

Fastest and slowest samples, for the record:

- 2.03 s — `mi_42647e514efb4ccfa4378755be360ef8`, `completed_at 2026-09-04T10:29:13.902545+00:00` → `entry 2026-09-04T10:29:15.930931+00:00`
- 11.91 s — `mi_a73e449943cf44ce944f78cf89f2cf9f`, `completed_at 2026-09-21T12:45:58.363084+00:00` → `entry 2026-09-21T12:46:10.269226+00:00`

The spread is a cold start of the 256 MB container-image worker (`lambda_workers.tf`); the
queue has no delivery delay and its event-source mapping long-polls, and the worker's own
work before the write is round trips, not computation. **20 s is 1.7× the slowest observed
sample**, which is the margin a cold start deserves.

The comparison AC #4 asks for: the client's ceiling is
`PREVIEW_POLL_MAX_ATTEMPTS × PREVIEW_POLL_DELAY_MS` = 20 × 3000 ms = **60 s**
(`mobile/src/components/CompletedDetailView.tsx`). **20 s < 60 s**, and deliberately at a
third of it: when the generation really was lost, the server flips to `failed` at t≈20 s,
i.e. around the 7th poll, so the section reaches its terminal line *while the reader is
still polling* — in the same screen visit, instead of the client abandoning the wait on its
own ceiling with no answer from the server. Anything at or above 60 s would produce exactly
the spinner-with-no-answer this window is meant to avoid, which is why `.env.example` says
so next to the variable.

### The reference timestamp and its fallback (AC #2)

`job.completed_at` first: it is the instant the pipeline stopped, i.e. the instant the
completion event was published, so it measures the delivery window itself rather than
something adjacent to it.

`record.updated_at` stands in when the job is gone (its operational row expires,
`PROCESSING_JOBS_TTL_DAYS`) or was never there. It is a ceiling, not an equivalent: a
background write bumps it, so it can only make a row look *younger* than it is, and the
worst case is one extra grace window of `pending` on a generation that was already lost.

Both absent → `False`, i.e. `failed`: the grace covers a window known to have just opened,
and a row that cannot date itself is not evidence of one. Naive values are UTC-normalised by
`_as_aware_utc` before the subtraction, so a legacy writer's timestamp cannot raise.

### The deduplicated path changes nothing (AC #7)

`durable_media_service._provision_review_blurb` runs *inside* the save request, not off an
event, so the window it opens is the tail of that request — and no client is reading the
item during its own save. More decisively, `resolve_job_for_record` on a deduplicated row
returns the **content's** job (via the `media_idempotence` ledger), whose `completed_at` is
the *original* ingestion's end, typically days old. So on a dedup row the grace is already
closed at the first read: if the provisioning produced nothing (no transcript, scope empty,
service error), the verdict is terminal immediately, with no false wait. The grace therefore
does not loosen that path.

One residual difference, small and correct: a dedup save whose provisioning produced nothing
*and* whose original job row has expired falls back to `record.updated_at` — the save
instant — and so shows the waiting line for 20 s before turning terminal. That is the same
honest answer the fresh path gives, on the same evidence.

### The `-dev` check, and the half of AC #10 that is out of reach

**Out-of-grace half, verified directly against `-dev`** — `mi_744d5012a34041c78db4e09347702f0b`
(live row in `user_media-dev`, no `deleted_at`, `media_key mkey_v1_71cca45a…`):

- `dynamodb query media_artifacts-dev --index-name scope-index` on
  `<user>#media#mkey_v1_71cca45a…` → `"Count": 0`. No internal entry at all: this is exactly
  the branch this task changes.
- its job (`last_job_id 81c85b95-cd59-49d7-ad79-aff79e16d724`, `processing_jobs-dev`):
  `job_status failed`, `completed_at 2026-08-18T01:49:19.307105+00:00`.
- age at the time of the check (2026-09-29) ≈ 42 days ≫ 20 s → `_within_review_blurb_trigger_grace`
  is `False` → `review_blurb_status = failed` → the terminal line, no spinner. The
  counter-proof in the owner notes holds: an old, genuinely lost preview is not turned into a
  wait.

**In-grace half: not reachable from the worktree, so AC #10 stays unticked.** It requires a
`GET /api/media/{id}` answered *by the new code* within 20 s of a job completing. Two
independent blockers, both structural: the dev API serves the pre-change Lambda image until
`main` is pushed and `deploy-lambda.yml` runs, so the deployed endpoint would answer the old
`failed` no matter when it is called; and there is no media completing during this run to
read inside the window. Per `AGENTS.md` ("An acceptance criterion must be satisfiable by the
agent that implements the task"), this is the forbidden "the deployed endpoint answers X"
form and is left for the owner's E2E in the description.

What the `-dev` data does establish about that half, without a deploy: the window is real and
was measured 72 times above (2.0 s to 11.9 s). Every one of those saves spent that interval
with a terminal job and no internal entry — which is precisely the interval in which the old
code answered `failed`, and the new code answers `pending`. The most recent sample,
`mi_645ff1baeef5432f967d8e7f7f3af31e`, had `completed_at 2026-09-29T10:18:26.906893+00:00`
and its entry written at `2026-09-29T10:18:30.124765+00:00`: a read at 10:18:28 would have
been told the preview was unavailable, 2 s before it was queued.

### Other notes

- No automated test was added — the project forbids them unless explicitly requested.
- `ruff check media_summarizer/` and `mypy media_summarizer/` both clean (193 files).
  `scripts/check_env_example_complete.py` green (248 variables). `ruff format --check`
  disagrees with `media.py` and `media_contracts.py` on pre-existing lines unrelated to this
  diff (a line-length setting the committed formatting predates); it is not part of the
  `make lint` target and was left alone.
- No mobile file touched, so no `tsc`/eslint run was needed.
<!-- SECTION:NOTES:END -->
