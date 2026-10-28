"""Shared job/SQS orchestration around the non-blocking Apify adapter.

Every Apify run of the repository starts here, so this is where it is held on the
beta budget (task-549, rules 1, 4 and 6 of the task-547 decision): the run is
admitted with its import before it starts — its single result at the actor's
price, plus the import's automatic preview and translation (rule 10) — and the
request is sent under the attempt that admission held. A run that cannot start
releases it. A run that starts stays ``sending`` until the import ends: the
completion pipeline settles it at the price of its result when the import is
delivered (``budget_guard.settle_collections``), and releases it when it fails
(``budget_guard.release_open``).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from media_summarizer.core.models.beta_budget import BudgetRefusal, Component, ReleaseReason
from media_summarizer.core.models.failure_codes import MediaFailureCode
from media_summarizer.core.models.processing_job import ProcessingJob
from media_summarizer.core.services import beta_budget, budget_guard
from media_summarizer.core.services.budget_guard import BudgetBusyError, BudgetCall, BudgetRefusedError
from media_summarizer.infrastructure import apify_adapter
from media_summarizer.infrastructure.apify_adapter import ApifyActorKind, ApifyRun
from media_summarizer.utils import database_async, sqs

ACTIVE_APIFY_STATES = frozenset({"waiting", "processing"})

#: How long a delivery may hold the right to start a run: the start request
#: itself, well inside one invocation. A run already started is recognised by the
#: job's own ``apify_run_id`` before the budget is asked anything.
_START_LEASE = timedelta(minutes=5)

#: Start errors raised after Apify may have accepted the run: its result may be
#: billed, so the release records the bound. Any other error is an answer Apify
#: gave without starting anything, or a refusal before the request left.
_MAYBE_STARTED = frozenset({"apify_network_error", "apify_invalid_json", "apify_invalid_run"})


async def _schedule_backstop(
    *,
    job: ProcessingJob,
    queue_name: str,
) -> None:
    context = dict(job.apify_context or {})
    await sqs.send_message(
        queue_name=queue_name,
        message_body={
            **context,
            "message_type": "apify_backstop",
            "job_id": job.id,
            "apify_run_id": job.apify_run_id,
        },
        delay_seconds=apify_adapter.APIFY_BACKSTOP_DELAY_SECONDS,
    )
    updated = await database_async.mark_apify_backstop_scheduled(job.id, job.apify_run_id or "")
    if updated:
        job.apify_backstop_scheduled = True


async def start_run_for_job(
    *,
    job: ProcessingJob,
    kind: ApifyActorKind,
    source_platform: str,
    input_data: dict[str, Any],
    queue_name: str,
    context: dict[str, Any],
    replace_active_run: bool = False,
    defer_automatic: bool = False,
) -> ApifyRun:
    """Admit, start, persist, and arm one run before the worker invocation returns.

    ``defer_automatic`` is for an import whose preview and translation can only be
    bounded after the run (an Instagram reel or post: rule 10, « réservation en
    deux temps »). ``replace_active_run`` starts a second run for the same import
    (the YouTube default-track fallback): the first one produced a result nobody
    will read, so its attempt is released at that price, and the new run is a try
    of its own (rule 6).

    A run the budget does not admit raises ``ApifyAdapterError`` with the
    refusal's code (``budget_exhausted``, ``item_too_large``,
    ``budget_unavailable``), non-retryable: every worker already turns that error
    into a failed import, and ``ingestion_failures`` maps the codes.
    """
    if not replace_active_run and job.apify_run_id and job.apify_dataset_id and job.apify_state in ACTIVE_APIFY_STATES:
        if not job.apify_backstop_scheduled:
            await _schedule_backstop(job=job, queue_name=queue_name)
        return ApifyRun(
            run_id=job.apify_run_id,
            dataset_id=job.apify_dataset_id,
            actor_id=job.apify_actor_id or "",
        )

    call = await _admit_run(
        job=job,
        kind=kind,
        replace_active_run=replace_active_run,
        defer_automatic=defer_automatic,
    )
    try:
        run = await apify_adapter.start_actor_run(
            kind=kind,
            input_data=input_data,
            job_id=job.id,
            source_platform=source_platform,
        )
    except apify_adapter.ApifyAdapterError as exc:
        await call.release(operator_cost=None if exc.code in _MAYBE_STARTED else budget_guard.no_cost())
        raise
    except BaseException:
        await call.release()
        raise
    now = datetime.now(timezone.utc)
    job.apify_run_id = run.run_id
    job.apify_dataset_id = run.dataset_id
    job.apify_actor_id = run.actor_id
    job.apify_actor_kind = kind.value
    job.apify_source_platform = source_platform
    job.apify_state = "waiting"
    job.apify_context = dict(context)
    job.apify_backstop_scheduled = False
    job.apify_started_at = now
    job.apify_claimed_at = None
    job.apify_completed_at = None
    job.touch()
    await database_async.persist_apify_run(job)
    await _schedule_backstop(job=job, queue_name=queue_name)
    return run


async def _admit_run(
    *,
    job: ProcessingJob,
    kind: ApifyActorKind,
    replace_active_run: bool,
    defer_automatic: bool,
) -> BudgetCall:
    actor_id = apify_adapter.configured_actor_id(kind)
    user_id = job.user_id or ""
    operation_id = budget_guard.import_operation_id(job)

    def line(ctx: beta_budget.PricingContext) -> Any:
        return beta_budget.apify_line(ctx, actor_id=actor_id)

    try:
        if replace_active_run:
            await _release_replaced_run(user_id=user_id, operation_id=operation_id, actor_id=job.apify_actor_id or actor_id)
        else:
            await budget_guard.admit_import(
                user_id,
                operation_id=operation_id,
                acquisition=lambda ctx: [line(ctx)],
                media_item_id=job.media_item_id,
                defer_automatic=defer_automatic,
            )
        return await budget_guard.start(
            user_id,
            operation_id=operation_id,
            component=Component.COLLECTION,
            line=line,
            lease=_START_LEASE,
            content_media_key=job.media_key,
        )
    except BudgetRefusedError as refusal:
        raise apify_adapter.ApifyAdapterError(refusal.error_code, retryable=False) from refusal
    except BudgetBusyError as busy:
        # A concurrent delivery is starting this very run; the redelivery finds it
        # on the job and returns it.
        raise apify_adapter.ApifyAdapterError("apify_run_in_flight", retryable=True) from busy


async def _release_replaced_run(*, user_id: str, operation_id: str, actor_id: str) -> None:
    """Close the collection of a run a second run replaces: one result, unread."""
    try:
        ctx = await beta_budget.load_pricing_context()
        attempts = await beta_budget.list_operation_attempts(user_id, operation_id)
    except Exception as exc:  # noqa: BLE001 - the admission below refuses if the ledger is down
        raise BudgetRefusedError(BudgetRefusal.BUDGET_UNAVAILABLE) from exc
    for attempt in attempts:
        if attempt.component == Component.COLLECTION.value and attempt.is_open:
            await BudgetCall(
                user_id=user_id,
                operation_id=operation_id,
                attempt_id=attempt.attempt_id,
                component=Component.COLLECTION,
            ).release(
                reason=ReleaseReason.FAILED,
                operator_cost=beta_budget.apify_cost(ctx, actor_id=actor_id, results=1),
            )


async def claim_callback(job_id: str, run_id: str) -> ProcessingJob | None:
    return await database_async.claim_apify_callback(job_id, run_id)


async def complete_callback(job: ProcessingJob) -> bool:
    return await database_async.complete_apify_callback(job)


async def expire_backstop(
    *,
    job_id: str,
    run_id: str,
    source_platform: str,
) -> ProcessingJob | None:
    return await database_async.expire_apify_run(
        job_id,
        run_id,
        error_code=MediaFailureCode.PROVIDER_TIMED_OUT,
        error_step=f"{source_platform}_ingestion",
        error_metadata={
            "reason": "apify_callback_deadline_exceeded",
            "provider": "apify",
            "source_platform": source_platform,
            "apify_run_id": run_id,
        },
    )
