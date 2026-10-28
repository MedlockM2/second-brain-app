"""
Items, states and outcomes of the beta budget control (task-548).

Owner decision: ``docs/research/task-547-beta-budget-control/README.md``, section
« Décision de l'owner : règles d'implémentation », which overrides sections 1 to 7
of that README. The item schema, the transitions and the condition of every write
are in ``docs/BETA_BUDGET_CONTROL.md``; this module is its code side.

One table, ``beta_budget``, partitioned by account (``user_id``) with a string sort
key ``sk``. Two kinds of item:

- the **period counter** (``period#<YYYY-MM>``), one per account and calendar month
  UTC: the budget of that month and the four amounts every write moves together —
  what is still available, what is held by open reservations, what the tester has
  consumed, what was handed back to the tester — plus the operator's own spend on
  calls that delivered nothing;
- the **attempt** (``attempt#<operation_id>:<step>:<try>``), one per paid
  provider call: what was reserved for it, at which tariff and exchange rate, and
  how it ended.

Every amount is an **integer number of nano-euros** (1 EUR = 10**9). Binary floats
never carry money here: a reservation is rounded up to the next nano-euro once, from
an exact decimal computation, and nothing else is rounded.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, Mapping, Optional, Tuple

#: 1 EUR in the unit every amount of the ledger is stored in.
NANO_EUR_PER_EUR = 10**9

#: Sort-key prefixes of the two item kinds.
PERIOD_SK_PREFIX = "period#"
ATTEMPT_SK_PREFIX = "attempt#"


class AttemptStatus(str, Enum):
    """Where one paid provider call stands.

    ``held`` and ``sending`` are the two *open* states: the reservation is still
    subtracted from the month's available amount. ``settled`` and ``released`` are
    terminal and never change again.
    """

    #: Admitted: the bound is held, no request has left yet.
    HELD = "held"
    #: One worker owns the right to send, and the request may have been billed.
    SENDING = "sending"
    #: A result reached the user: the tester is charged the real cost.
    SETTLED = "settled"
    #: No result reached the user: the whole hold goes back to the tester.
    RELEASED = "released"


OPEN_STATUSES = frozenset({AttemptStatus.HELD, AttemptStatus.SENDING})


class ReleaseReason(str, Enum):
    """Why an attempt ended without a delivered result (rule 5 of the decision)."""

    #: The call failed, timed out, was cut, or its result was unreadable or not persisted.
    FAILED = "failed"
    #: The component turned out to be unnecessary — a translation into the
    #: language the content is already in (rule 10).
    NOT_NEEDED = "not_needed"
    #: A redelivery found the attempt ``sending`` past the worker's own lease: the
    #: delivery that claimed it is gone and its outcome will never be known.
    LOST_IN_FLIGHT = "lost_in_flight"
    #: Backstop: still open ``hold_expiry_minutes`` after its admission, with no
    #: worker left to close it (a message lost to a dead-letter queue).
    EXPIRED = "expired"


class CostBasis(str, Enum):
    """What an amount recorded on a closed attempt rests on."""

    #: Provider metrics, or the fixed price of a result that was delivered.
    MEASURED = "measured"
    #: The request may have been billed and no metric came back: the reserved
    #: bound stands in for it, so a missing metric never reads as a zero cost.
    BOUND = "bound"
    #: The request never left: there is no provider cost.
    NOT_SENT = "not_sent"


class BudgetRefusal(str, Enum):
    """The typed refusals of an admission. Exposed to clients by TASK-550."""

    #: The month's available amount does not cover the bound of the operation.
    BUDGET_EXHAUSTED = "budget_exhausted"
    #: One item is above its per-item limit (rule 2). Not a budget refusal: a new
    #: month does not change it.
    ITEM_TOO_LARGE = "item_too_large"
    #: The counter could not be read or written: the call is refused (rule 7).
    BUDGET_UNAVAILABLE = "budget_unavailable"
    #: The beta formula is closed: this control has no budget to grant.
    NOT_ENTITLED = "not_entitled"


class ProviderKind(str, Enum):
    """The families of paid calls the barème prices."""

    TRANSCRIPTION = "transcription"
    DOCUMENT_PARSING = "document_parsing"
    LLM = "llm"
    APIFY = "apify"
    X_API = "x_api"


class Component(str, Enum):
    """The step of an operation a line pays for.

    An import is one operation whose admission covers several provider calls made
    by different workers (rule 10): its acquisition — collection, transcription or
    parsing — then the automatic blurb and the full-text translation. Each step is
    its own attempt, so each settles or is released on its own, and an Instagram
    import that reserves its collection first and its transcription after the run
    (two admissions of one operation) gets two distinct attempts.
    """

    #: Fetching the content from a paid collector: an Apify run, an X API read.
    COLLECTION = "collection"
    #: Deepgram.
    TRANSCRIPTION = "transcription"
    #: LlamaParse, or the Unstructured fallback as a later try of the same step.
    DOCUMENT_PARSING = "document_parsing"
    REVIEW_BLURB = "review_blurb"
    TRANSLATION = "translation"
    GENERATION = "generation"
    CHAT_TURN = "chat_turn"
    #: A content another account already paid for (rule 12): charged its stored
    #: value, with no provider call.
    REUSE = "reuse"


@dataclass(frozen=True)
class ReservationLine:
    """One provider call of an operation, bounded before it is made."""

    component: Component
    kind: ProviderKind
    #: ``deepgram``, ``llamaparse``, ``unstructured``, ``openai``, ``apify``, ``x_api``.
    provider: str
    #: The priced variant: model, actor or parsing mode.
    model: str
    #: The bounded quantities the bound was computed from (seconds, pages, sheets,
    #: input_tokens, output_tokens, results, posts).
    quantities: Mapping[str, int]
    #: Maximal cost at the versioned barème, in USD, exact.
    bound_usd: Decimal
    #: False when the quantities are not a measurement: the per-item ceiling
    #: reserved because the measurement failed (rule 3), or an upstream estimate
    #: (the blurb and translation reserved with an import, rule 10).
    measured: bool = True
    #: Tells apart several calls of one step in one operation (the images of a
    #: carousel parsed one by one). Empty for the usual single call.
    part: str = ""


@dataclass(frozen=True)
class ItemLimitExceeded:
    """The figures behind an ``item_too_large`` refusal."""

    #: What was measured: ``audio_minutes``, ``document_pages``, ``spreadsheet_sheets``.
    quantity: str
    measured: int
    limit: int


@dataclass(frozen=True)
class MeasuredCost:
    """A cost computed from what the provider really billed, at the current barème."""

    usd: Decimal
    #: The billed quantities the cost was computed from.
    usage: Mapping[str, int]
    tariff_version: str


@dataclass(frozen=True)
class PeriodCounter:
    """One account's month, as the ledger holds it.

    ``consumed`` is the only figure the tester's percentage is built from (rule 13):
    open reservations are not consumption. ``operator_spend`` is the provider cost
    of calls that delivered nothing (rule 5), kept apart from the tester's counter
    and never subtracted from it.
    """

    user_id: str
    period_key: str
    budget_nano_eur: int
    available_nano_eur: int
    held_nano_eur: int = 0
    consumed_nano_eur: int = 0
    released_nano_eur: int = 0
    operator_spend_nano_eur: int = 0

    @property
    def consumed_pct(self) -> Decimal:
        """Settled consumption as a share of the month's budget, unrounded.

        Above 100 when a settlement went past the budget (rule 8): the overrun is
        neither hidden nor clamped here. Rounding is the display's business.
        """
        if self.budget_nano_eur <= 0:
            return Decimal(0)
        return Decimal(self.consumed_nano_eur) * 100 / Decimal(self.budget_nano_eur)

    @property
    def financial_spend_nano_eur(self) -> int:
        """Provider spend of the month, whoever bears it: tester or operator."""
        return self.consumed_nano_eur + self.operator_spend_nano_eur


@dataclass(frozen=True)
class BudgetAttempt:
    """One attempt item, as read back from the ledger."""

    user_id: str
    attempt_id: str
    operation_id: str
    component: str
    try_number: int
    status: AttemptStatus
    kind: str
    provider: str
    model: str
    period_key: str
    reserved_nano_eur: int
    tariff_version: str
    usd_per_eur: Decimal
    fx_published_on: str
    created_at: str
    measured: bool = True
    claimed_at: Optional[str] = None
    closed_at: Optional[str] = None
    consumed_nano_eur: Optional[int] = None
    operator_cost_nano_eur: Optional[int] = None
    cost_basis: Optional[str] = None
    release_reason: Optional[str] = None

    @property
    def is_open(self) -> bool:
        return self.status in OPEN_STATUSES


@dataclass
class Admission:
    """What :func:`beta_budget.reserve` decided.

    ``replayed`` is True when every attempt of the call already existed: the same
    admission arriving twice (a retried request, a redelivered message) holds the
    budget once and gets the original attempts back.
    """

    admitted: bool
    refusal: Optional[BudgetRefusal] = None
    #: Figures behind a refusal, for the client to word it (TASK-550).
    params: Dict[str, Any] = field(default_factory=dict)
    attempts: Tuple[BudgetAttempt, ...] = ()
    replayed: bool = False

    @staticmethod
    def refused(refusal: BudgetRefusal, **params: Any) -> "Admission":
        return Admission(admitted=False, refusal=refusal, params=dict(params))


class CloseOutcome(str, Enum):
    """What a settlement or a release did to its attempt."""

    #: This call closed the attempt and moved the counter.
    APPLIED = "applied"
    #: The attempt was already closed the same way: nothing moved (idempotent replay).
    ALREADY_CLOSED = "already_closed"
    #: The attempt was closed the other way (a result after a release, a release
    #: after a settlement): nothing moved, the mismatch is logged.
    CONFLICT = "conflict"
    #: No such attempt — the account was erased, or the id is wrong.
    MISSING = "missing"
    #: A release asked to wait for the lease, and the attempt is still inside it.
    STILL_IN_LEASE = "still_in_lease"
