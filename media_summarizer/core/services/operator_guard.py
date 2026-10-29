"""Protect the operator's spend and suspend a failing provider (TASK-566).

Owner decision: ``docs/research/task-563-provider-capacity-fairness-operator-safety/
README.md``, Owner Validation (2026-10-29), points 2 to 5, and the sections it
validates (§6.1 steps 3-4, §7). Runbook and item schema:
``docs/OPERATOR_SPEND_CONTROL.md``.

The 5 EUR of each tester bound what *one* account consumes. They bound neither the
sum of the accounts, nor the failures handed back to testers — which the operator
still pays — nor a provider that answers every new call with the same refusal.
This module adds the two controls that do, hooked on the two points of the ledger
every paid call already crosses (``core/services/beta_budget.py``):

1. **At the reservation** (:func:`admission_hold`) — the operator ceilings. The
   bound of a new operation is admitted only if, in the same transaction that holds
   it on the tester's month, the operator's exposure stays under every ceiling:

   - month: ``delivered + failed + open commitments + new ≤ monthly_cap`` (500 EUR);
   - loss reserves: ``failed + open commitments + new ≤ 5 EUR`` for the day and
     ``≤ 50 EUR`` for the month. Open commitments count in the losses because any
     call still in flight may yet fail (§7.2): that is the price of a reserve that
     still holds after twenty calls fail at once.

   Delivered and failed spend are what the ledger closes, at the barème — never a
   second count. Reuse with no provider call never enters them, and a release that
   hands the hold back to the tester never lowers them.

2. **At the claim** ``held → sending`` (:func:`claim_gates`) — the circuits. One per
   provider, plus ``all`` for a manual pause. ``closed`` lets every send through;
   ``open`` refuses new sends; ``half_open`` lets exactly one real, already reserved
   request through as a probe. A credit exhausted or a refused account opens the
   circuit on the **first** refusal and waits for a human (no paid probe can fix a
   balance); five transient failures in a row open it for an incident, with a wait
   of 30 s doubling to 15 min, after which one probe is let through and three
   successes close it again. A rate limit is capacity, not an incident: it never
   opens a circuit.

Neither control reaches a call that already left: the condition is checked in the
claim's transaction, and a send claimed a millisecond before a circuit opens still
completes and is settled. A refused send never left, so its hold goes back to the
tester at zero cost, and reading, organising and every result already delivered are
untouched — they never come through here.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Mapping, Optional

from media_summarizer.core.models.beta_budget import NANO_EUR_PER_EUR, ProviderFailure
from media_summarizer.utils import beta_budget_db
from media_summarizer.utils.beta_budget_db import (
    OP_DELIVERED,
    OP_FAILED,
    OP_HELD,
    OP_VERSION,
    OperatorHold,
)
from media_summarizer.utils.logging_config import log_event

logger = logging.getLogger(__name__)

#: The scope of a manual pause of every new spend, beside one scope per provider.
ALL_PROVIDERS = "all"

#: Transient failures in a row that open a provider's circuit for an incident.
INCIDENT_THRESHOLD = 5
#: First wait of an incident, doubled at each failed probe up to the maximum.
FIRST_BACKOFF_SECONDS = 30
MAX_BACKOFF_SECONDS = 900
#: Successful probes in a row that close a half-open circuit.
PROBE_SUCCESSES_TO_CLOSE = 3
#: A probe claimed this long ago and never closed belongs to a dead worker: the
#: next send may take it. Above the longest single provider call (Deepgram's 300 s
#: timeout, LlamaParse's two minutes of polling).
PROBE_STALE_AFTER = timedelta(minutes=15)

#: The circuit states and kinds, as stored.
CLOSED, OPEN, HALF_OPEN = "closed", "open", "half_open"
#: ``incident`` reopens on its own after its wait; ``action_required`` (a credit, a
#: key) and ``manual`` (the owner's pause) wait for :func:`resume`.
INCIDENT, ACTION_REQUIRED, MANUAL = "incident", "action_required", "manual"

#: Tries of an admission whose commitments moved between their read and its write.
ADMISSION_TRIES = 4


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------


def _nano(value: Any) -> Optional[int]:
    if value is None or isinstance(value, bool):
        return None
    try:
        amount = Decimal(str(value).strip())
    except (InvalidOperation, ValueError):
        return None
    if not amount.is_finite() or amount <= 0:
        return None
    return int(amount * NANO_EUR_PER_EUR)


@dataclass(frozen=True)
class OperatorLimits:
    """The operator ceilings of ``pricing_config.operator_control``, in nano-euros."""

    monthly_cap_nano_eur: int
    loss_daily_nano_eur: int
    loss_monthly_nano_eur: int
    per_active_account_alert_nano_eur: int


def operator_limits(config: Mapping[str, Any]) -> Optional[OperatorLimits]:
    """The operator ceilings, or ``None`` when one of them cannot be read.

    No fallback to a default: a ceiling the owner mistyped is not silently replaced
    by another amount. ``None`` pauses every new spend (§8.1, « sans montant
    obligatoire valide, garde en pause ») and is logged for the owner.
    """
    block = config.get("operator_control", {}) or {}
    figures = {
        name: _nano(block.get(name))
        for name in (
            "monthly_cap_eur",
            "loss_reserve_daily_eur",
            "loss_reserve_monthly_eur",
            "per_active_account_alert_eur",
        )
    }
    missing = sorted(name for name, value in figures.items() if value is None)
    if missing:
        log_event(
            logger,
            logging.ERROR,
            "operator.bound_missing",
            "An operator ceiling is unreadable; new spend is paused",
            fields=missing,
        )
        return None
    return OperatorLimits(
        monthly_cap_nano_eur=figures["monthly_cap_eur"] or 0,
        loss_daily_nano_eur=figures["loss_reserve_daily_eur"] or 0,
        loss_monthly_nano_eur=figures["loss_reserve_monthly_eur"] or 0,
        per_active_account_alert_nano_eur=figures["per_active_account_alert_eur"] or 0,
    )


# ---------------------------------------------------------------------------
# Refusals and periods
# ---------------------------------------------------------------------------


class OperatorSuspendedError(Exception):
    """New spend is refused by the operator control. Nothing was sent.

    ``scope`` is a provider or :data:`ALL_PROVIDERS`; ``reason`` tells apart an
    incident, a provider account to act on, an operator ceiling and a manual pause;
    ``retry_at`` is set when the control knows when it may let a send through.
    """

    def __init__(self, scope: str, reason: str, retry_at: Optional[datetime] = None) -> None:
        super().__init__(f"{scope}:{reason}")
        self.scope = scope
        self.reason = reason
        self.retry_at = retry_at

    def params(self) -> Dict[str, Any]:
        params: Dict[str, Any] = {"scope": self.scope, "reason": self.reason}
        if self.retry_at is not None:
            params["retry_at"] = self.retry_at.isoformat()
        return params


def month_key(now: datetime) -> str:
    return now.astimezone(timezone.utc).strftime("%Y-%m")


def day_key(now: datetime) -> str:
    return now.astimezone(timezone.utc).strftime("%Y-%m-%d")


def _iso(instant: datetime) -> str:
    return instant.astimezone(timezone.utc).isoformat(timespec="microseconds")


def _parse(raw: Any) -> Optional[datetime]:
    if not isinstance(raw, str) or not raw:
        return None
    try:
        parsed = datetime.fromisoformat(raw)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _int(value: Any) -> int:
    return int(value or 0)


def _log(level: int, event: str, message: str, **fields: Any) -> None:
    log_event(logger, level, event, message, **fields)


# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class OperatorState:
    """The operator figures one admission is checked against."""

    held_nano_eur: int
    version: int
    delivered_month_nano_eur: int
    failed_month_nano_eur: int
    failed_day_nano_eur: int

    @property
    def exposure_month_nano_eur(self) -> int:
        return self.delivered_month_nano_eur + self.failed_month_nano_eur + self.held_nano_eur


async def _operator_item(sk: str) -> Dict[str, Any]:
    return await beta_budget_db.get_item(beta_budget_db.OPERATOR_PARTITION, sk) or {}


async def read_state(now: datetime) -> OperatorState:
    """The open commitments, and the spend of ``now``'s month and day (strong reads)."""
    control, month, day = await asyncio.gather(
        _operator_item(beta_budget_db.OPERATOR_CONTROL_SK),
        _operator_item(beta_budget_db.operator_month_sk(month_key(now))),
        _operator_item(beta_budget_db.operator_day_sk(day_key(now))),
    )
    return OperatorState(
        held_nano_eur=_int(control.get(OP_HELD)),
        version=_int(control.get(OP_VERSION)),
        delivered_month_nano_eur=_int(month.get(OP_DELIVERED)),
        failed_month_nano_eur=_int(month.get(OP_FAILED)),
        failed_day_nano_eur=_int(day.get(OP_FAILED)),
    )


async def read_circuit(scope: str) -> Dict[str, Any]:
    return await _operator_item(beta_budget_db.circuit_sk(scope))


def _next_month(now: datetime) -> datetime:
    now = now.astimezone(timezone.utc)
    return now.replace(
        year=now.year + 1 if now.month == 12 else now.year,
        month=1 if now.month == 12 else now.month + 1,
        day=1, hour=0, minute=0, second=0, microsecond=0,
    )


def _next_day(now: datetime) -> datetime:
    return (now.astimezone(timezone.utc) + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)


# ---------------------------------------------------------------------------
# 1. The ceilings, at the reservation
# ---------------------------------------------------------------------------


def _manual_pause(circuit: Mapping[str, Any]) -> bool:
    return circuit.get("state") == OPEN


async def admission_hold(
    total_nano_eur: int,
    *,
    limits: Optional[OperatorLimits],
    now: datetime,
) -> OperatorHold:
    """Check a new operation's bound against every operator ceiling.

    Returns the hold to write in the admission's transaction, conditioned on the
    commitments' version read here. Raises :class:`OperatorSuspendedError` when a
    ceiling would be crossed or new spend is paused, and ``LedgerUnavailableError``
    when the operator items cannot be read (the admission then refuses, rule 7).
    """
    if limits is None:
        raise OperatorSuspendedError(ALL_PROVIDERS, "operator_config")
    pause, state = await asyncio.gather(read_circuit(ALL_PROVIDERS), read_state(now))
    if _manual_pause(pause):
        raise OperatorSuspendedError(ALL_PROVIDERS, MANUAL)
    checks = (
        ("monthly_cap", state.exposure_month_nano_eur, limits.monthly_cap_nano_eur, _next_month(now)),
        ("loss_reserve_daily", state.failed_day_nano_eur + state.held_nano_eur, limits.loss_daily_nano_eur, None),
        ("loss_reserve_monthly", state.failed_month_nano_eur + state.held_nano_eur, limits.loss_monthly_nano_eur, None),
    )
    for ceiling, exposure, limit, renews_at in checks:
        if exposure + total_nano_eur > limit:
            _log(
                logging.WARNING,
                "operator.limit_refused",
                "New spend refused by an operator ceiling",
                ceiling=ceiling,
                exposure_nano_eur=exposure,
                required_nano_eur=total_nano_eur,
                limit_nano_eur=limit,
                held_nano_eur=state.held_nano_eur,
            )
            raise OperatorSuspendedError(ALL_PROVIDERS, ceiling, renews_at)
    return OperatorHold(held_nano_eur=total_nano_eur, expected_version=state.version)


async def precheck(limits: Optional[OperatorLimits], *, now: datetime) -> None:
    """The submission-time answer when no new spend could be admitted at all.

    Not an admission: the ceilings are checked again, atomically, at the
    reservation. Raises :class:`OperatorSuspendedError`.
    """
    await admission_hold(0, limits=limits, now=now)


# ---------------------------------------------------------------------------
# 2. The circuits, at the claim
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ClaimGates:
    """The conditions a claim writes with the attempt, and whether it is a probe."""

    gates: List[Dict[str, Any]]
    probe: bool = False


async def claim_gates(provider: str, attempt_id: str, *, now: datetime) -> ClaimGates:
    """The conditions under which ``attempt_id`` may be sent to ``provider``.

    Raises :class:`OperatorSuspendedError` when the circuit refuses the send as it
    is read; otherwise the returned conditions re-check it in the claim's
    transaction, so a circuit opened in between still refuses.
    """
    pause, circuit = await asyncio.gather(read_circuit(ALL_PROVIDERS), read_circuit(provider))
    if _manual_pause(pause):
        raise OperatorSuspendedError(ALL_PROVIDERS, MANUAL)
    gates = [beta_budget_db.circuit_allows(ALL_PROVIDERS)]
    state = circuit.get("state", CLOSED)
    if state == CLOSED:
        gates.append(beta_budget_db.circuit_allows(provider))
        return ClaimGates(gates)

    kind = circuit.get("suspension_kind")
    epoch = _int(circuit.get("epoch"))
    until = _parse(circuit.get("open_until"))
    if state == OPEN:
        if kind == INCIDENT and until is not None and until <= now:
            gates.append(_probe(provider, attempt_id, epoch, OPEN, now))
            return ClaimGates(gates, probe=True)
        reason = str(circuit.get("suspension_reason") or kind or OPEN)
        raise OperatorSuspendedError(provider, reason, until if kind == INCIDENT else None)

    claimed_at = _parse(circuit.get("probe_claimed_at"))
    if not circuit.get("probe_attempt") or (claimed_at is not None and claimed_at < now - PROBE_STALE_AFTER):
        gates.append(_probe(provider, attempt_id, epoch, HALF_OPEN, now))
        return ClaimGates(gates, probe=True)
    # Another send is the probe: wait for its answer.
    raise OperatorSuspendedError(provider, "probing", now + timedelta(seconds=FIRST_BACKOFF_SECONDS))


def _probe(provider: str, attempt_id: str, epoch: int, from_state: str, now: datetime) -> Dict[str, Any]:
    return beta_budget_db.circuit_take_probe(
        provider,
        attempt_id=attempt_id,
        epoch=epoch,
        from_state=from_state,
        now_iso=_iso(now),
        stale_before_iso=_iso(now - PROBE_STALE_AFTER),
    )


def log_probe_claimed(provider: str, attempt_id: str) -> None:
    _log(logging.INFO, "operator.probe_claimed", "A real request probes a suspended provider",
         scope=provider, attempt_id=attempt_id)


# ---------------------------------------------------------------------------
# Outcomes: what each closed call tells the circuit
# ---------------------------------------------------------------------------


async def _quietly(event: str, provider: str, attempt_id: str, work: Any) -> None:
    """Run a circuit update without ever failing the caller: the provider answered."""
    try:
        await work
    except Exception as exc:  # noqa: BLE001 - a lost update costs one more failure to observe
        _log(logging.ERROR, event, "Circuit update failed", scope=provider, attempt_id=attempt_id,
             error_type=type(exc).__name__)


async def record_success(provider: str, attempt_id: str) -> None:
    """A delivered result: resets the incident count, or counts a probe. Never raises."""
    if provider:
        await _quietly("operator.circuit_update_failed", provider, attempt_id, _success(provider, attempt_id))


async def _success(provider: str, attempt_id: str) -> None:
    circuit = await read_circuit(provider)
    state = circuit.get("state", CLOSED)
    epoch = _int(circuit.get("epoch"))
    sk = beta_budget_db.circuit_sk(provider)
    if state == CLOSED:
        if _int(circuit.get("consecutive_failures")):
            await beta_budget_db.update_operator_item(
                sk,
                update="SET consecutive_failures = :zero",
                condition="epoch = :epoch AND #state = :closed",
                names={"#state": "state"},
                values={":zero": 0, ":epoch": epoch, ":closed": CLOSED},
            )
        return
    if state != HALF_OPEN or circuit.get("probe_attempt") != attempt_id:
        return
    successes = _int(circuit.get("probe_successes")) + 1
    if successes < PROBE_SUCCESSES_TO_CLOSE:
        await beta_budget_db.update_operator_item(
            sk,
            update="SET probe_successes = :successes REMOVE probe_attempt, probe_claimed_at",
            condition="epoch = :epoch AND probe_attempt = :attempt",
            values={":successes": successes, ":epoch": epoch, ":attempt": attempt_id},
        )
        return
    closed = await beta_budget_db.update_operator_item(
        sk,
        update=(
            "SET #state = :closed, epoch = :next, consecutive_failures = :zero, backoff_seconds = :first,"
            " updated_at = :now REMOVE probe_attempt, probe_claimed_at, probe_successes, open_until,"
            " suspension_kind, suspension_reason"
        ),
        condition="epoch = :epoch AND probe_attempt = :attempt",
        names={"#state": "state"},
        values={
            ":closed": CLOSED, ":next": epoch + 1, ":zero": 0, ":first": FIRST_BACKOFF_SECONDS,
            ":now": _iso(datetime.now(timezone.utc)), ":epoch": epoch, ":attempt": attempt_id,
        },
    )
    if closed is not None:
        _log(logging.WARNING, "operator.resumed", "Provider circuit closed after its probes", scope=provider,
             epoch=epoch + 1)


async def record_failure(
    provider: str,
    attempt_id: str,
    failure: Optional[ProviderFailure],
    *,
    retry_after_seconds: Optional[float] = None,
) -> None:
    """A call that delivered nothing, as its caller classified it. Never raises.

    ``None`` — a failure of the item's own content, or one nobody could classify —
    moves no count; it only frees the probe when this call was it.
    """
    if provider:
        await _quietly(
            "operator.circuit_update_failed", provider, attempt_id,
            _failure(provider, attempt_id, failure, retry_after_seconds),
        )


async def _failure(
    provider: str, attempt_id: str, failure: Optional[ProviderFailure], retry_after: Optional[float]
) -> None:
    now = datetime.now(timezone.utc)
    sk = beta_budget_db.circuit_sk(provider)
    if failure in (ProviderFailure.CREDIT_EXHAUSTED, ProviderFailure.ACCOUNT_REFUSED):
        await _open_for_action(provider, failure, now)
        return

    circuit = await read_circuit(provider)
    state = circuit.get("state", CLOSED)
    epoch = _int(circuit.get("epoch"))
    is_probe = state == HALF_OPEN and circuit.get("probe_attempt") == attempt_id

    if failure != ProviderFailure.TRANSIENT:
        if is_probe:
            await beta_budget_db.update_operator_item(
                sk,
                update="REMOVE probe_attempt, probe_claimed_at",
                condition="epoch = :epoch AND probe_attempt = :attempt",
                values={":epoch": epoch, ":attempt": attempt_id},
            )
        return

    if is_probe:
        backoff = min(MAX_BACKOFF_SECONDS, max(FIRST_BACKOFF_SECONDS, _int(circuit.get("backoff_seconds"))) * 2)
        await _open_incident(provider, epoch=epoch, backoff=backoff, retry_after=retry_after, now=now,
                             probe_attempt=attempt_id)
        return
    if state != CLOSED:
        return
    counted = await beta_budget_db.update_operator_item(
        sk,
        update=(
            "SET consecutive_failures = if_not_exists(consecutive_failures, :zero) + :one,"
            " epoch = if_not_exists(epoch, :zero), #state = if_not_exists(#state, :closed),"
            " item_type = :type, circuit_scope = :scope, updated_at = :now"
        ),
        condition="attribute_not_exists(#state) OR (#state = :closed AND epoch = :epoch)",
        names={"#state": "state"},
        values={":zero": 0, ":one": 1, ":closed": CLOSED, ":type": "circuit", ":scope": provider,
                ":now": _iso(now), ":epoch": epoch},
    )
    if counted is not None and _int(counted.get("consecutive_failures")) >= INCIDENT_THRESHOLD:
        await _open_incident(provider, epoch=epoch, backoff=FIRST_BACKOFF_SECONDS, retry_after=retry_after, now=now)


async def _open_incident(
    provider: str,
    *,
    epoch: int,
    backoff: int,
    retry_after: Optional[float],
    now: datetime,
    probe_attempt: Optional[str] = None,
) -> None:
    """Open the circuit for an incident: from a failed probe, or from ``closed``
    when the count of transient failures in a row reaches the threshold."""
    wait = max(float(backoff), retry_after or 0.0)
    until = now + timedelta(seconds=wait)
    values: Dict[str, Any] = {
        ":open": OPEN, ":incident": INCIDENT, ":reason": ProviderFailure.TRANSIENT.value, ":next": epoch + 1,
        ":until": _iso(until), ":backoff": backoff, ":now": _iso(now), ":zero": 0, ":epoch": epoch,
    }
    if probe_attempt is not None:
        condition = "epoch = :epoch AND probe_attempt = :attempt"
        values[":attempt"] = probe_attempt
    else:
        condition = "#state = :closed AND epoch = :epoch"
        values[":closed"] = CLOSED
    opened = await beta_budget_db.update_operator_item(
        beta_budget_db.circuit_sk(provider),
        update=(
            "SET #state = :open, suspension_kind = :incident, suspension_reason = :reason, epoch = :next, open_until = :until,"
            " backoff_seconds = :backoff, opened_at = :now, updated_at = :now, consecutive_failures = :zero"
            " REMOVE probe_attempt, probe_claimed_at, probe_successes"
        ),
        condition=condition,
        names={"#state": "state"},
        values=values,
    )
    if opened is not None:
        _log(logging.ERROR, "operator.suspended", "Provider circuit opened for an incident", scope=provider,
             kind=INCIDENT, reason=ProviderFailure.TRANSIENT.value, open_until=_iso(until), epoch=epoch + 1)


async def _open_for_action(provider: str, failure: ProviderFailure, now: datetime) -> None:
    """One credit or account refusal suspends the provider until someone acts."""
    opened = await beta_budget_db.update_operator_item(
        beta_budget_db.circuit_sk(provider),
        update=(
            "SET #state = :open, suspension_kind = :action, suspension_reason = :reason, epoch = if_not_exists(epoch, :zero) + :one,"
            " opened_at = :now, updated_at = :now, item_type = :type, circuit_scope = :scope, consecutive_failures = :zero"
            " REMOVE open_until, probe_attempt, probe_claimed_at, probe_successes"
        ),
        # Already suspended for an action: one refusal is enough, the next ones
        # neither churn the epoch nor repeat the alert.
        condition="NOT (#state = :open AND suspension_kind = :action)",
        names={"#state": "state"},
        values={
            ":open": OPEN, ":action": ACTION_REQUIRED, ":reason": failure.value, ":zero": 0, ":one": 1,
            ":now": _iso(now), ":type": "circuit", ":scope": provider,
        },
    )
    if opened is not None:
        _log(logging.ERROR, "operator.suspended", "Provider suspended until its account is acted on",
             scope=provider, kind=ACTION_REQUIRED, reason=failure.value, epoch=_int(opened.get("epoch")))


# ---------------------------------------------------------------------------
# Owner actions (scripts/operator_control.py)
# ---------------------------------------------------------------------------


async def suspend(scope: str, *, note: str = "") -> None:
    """Pause new spend at ``scope`` by hand, until :func:`resume`."""
    now = datetime.now(timezone.utc)
    await beta_budget_db.update_operator_item(
        beta_budget_db.circuit_sk(scope),
        update=(
            "SET #state = :open, suspension_kind = :manual, suspension_reason = :manual, owner_note = :note,"
            " epoch = if_not_exists(epoch, :zero) + :one,"
            " opened_at = :now, updated_at = :now, item_type = :type, circuit_scope = :scope"
            " REMOVE open_until, probe_attempt, probe_claimed_at, probe_successes"
        ),
        names={"#state": "state"},
        values={":open": OPEN, ":manual": MANUAL, ":note": note[:200], ":zero": 0, ":one": 1, ":now": _iso(now),
                ":type": "circuit", ":scope": scope},
    )
    _log(logging.ERROR, "operator.suspended", "New spend paused by hand", scope=scope, kind=MANUAL, reason=MANUAL)


async def resume(scope: str) -> None:
    """Lift a suspension. A provider goes ``half_open``: one real request probes it,
    three successes close it. The manual pause of ``all`` closes at once."""
    now = datetime.now(timezone.utc)
    state = CLOSED if scope == ALL_PROVIDERS else HALF_OPEN
    await beta_budget_db.update_operator_item(
        beta_budget_db.circuit_sk(scope),
        update=(
            "SET #state = :state, epoch = if_not_exists(epoch, :zero) + :one, probe_successes = :zero,"
            " consecutive_failures = :zero, backoff_seconds = :first, updated_at = :now, item_type = :type, circuit_scope = :scope"
            " REMOVE probe_attempt, probe_claimed_at, open_until, suspension_kind, suspension_reason, owner_note"
        ),
        names={"#state": "state"},
        values={":state": state, ":zero": 0, ":one": 1, ":first": FIRST_BACKOFF_SECONDS, ":now": _iso(now),
                ":type": "circuit", ":scope": scope},
    )
    _log(logging.WARNING, "operator.resumed", "Suspension lifted by hand", scope=scope, state=state)


# ---------------------------------------------------------------------------
# Classifying a failed call
# ---------------------------------------------------------------------------


def failure_of(exc: Optional[BaseException]) -> Optional[ProviderFailure]:
    """What an exception raised around a provider call says about the provider.

    An exception that knows declares it (``provider_failure``: the LLM refusal, the
    Deepgram, Apify and X errors). Otherwise a timeout or a lost connection is
    transient, a 5xx answer is transient and a 429 is a rate limit. Anything else —
    our own code, a content the provider could not read — is ``None`` and never
    touches a circuit.
    """
    if exc is None:
        return None
    declared = getattr(exc, "provider_failure", None)
    if isinstance(declared, ProviderFailure):
        return declared
    # A worker's own error wrapping an LLM refusal carries its two axes
    # (``utils/llm_failure.py``), or the refusal as its cause.
    from media_summarizer.utils.llm_failure import REFUSAL_AUTHENTICATION, REFUSAL_QUOTA, REFUSAL_RATE_LIMIT

    reason = getattr(exc, "refusal_reason", None)
    if reason == REFUSAL_QUOTA:
        return ProviderFailure.CREDIT_EXHAUSTED
    if reason == REFUSAL_AUTHENTICATION:
        return ProviderFailure.ACCOUNT_REFUSED
    if reason == REFUSAL_RATE_LIMIT:
        return ProviderFailure.RATE_LIMITED
    provider_status = getattr(exc, "provider_status", None)
    if isinstance(provider_status, int) and provider_status >= 500:
        return ProviderFailure.TRANSIENT
    cause = exc.__cause__
    if cause is not None and cause is not exc:
        return failure_of(cause)
    import aiohttp
    import httpx

    if isinstance(exc, (asyncio.TimeoutError, TimeoutError, httpx.TimeoutException, httpx.TransportError)):
        return ProviderFailure.TRANSIENT
    status = getattr(exc, "status", None) if isinstance(exc, aiohttp.ClientResponseError) else None
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
    if status is not None:
        if status == 429:
            return ProviderFailure.RATE_LIMITED
        return ProviderFailure.TRANSIENT if status >= 500 else None
    if isinstance(exc, aiohttp.ClientError):
        return ProviderFailure.TRANSIENT
    return None
