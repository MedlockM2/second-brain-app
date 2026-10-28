"""
Consumption enforcement for the validated V1 model.

One unit is metered: the **minute**. A minute is a minute of media we pay a
transcription provider to process, plus the three flat conversions of the model
(a bought caption set counts 1, five document pages count 1, five sources of a
folder generation count 1). Everything that is not transcription — articles,
web pages, TikToks, single-item AI generations — is unlimited and debits nothing.
A chat turn is the exception to that last one: it debits at the folder rate even
on a single media, and it is the only debit that can be refunded (task-462).
An Instagram photo post left that free list in task-384: its slides are read by
the paid document parser, so they debit at the document rate through
:func:`record_document_parse`, exactly like the pages of an upload.

The rule that keeps the accounting honest: **the meter follows the provider call,
not the URL**. An API endpoint only ever *checks*; the debit happens at the place
that spends provider money (the Deepgram gate, the paid caption fetch, the
document parse, the folder generation). That is what makes "the same import
charged twice" and "a transcription nobody charged" unrepresentable rather than
merely fixed.

Two layers protect the margin of a commercial plan (see
docs/research/task-287-consumption-model):
1. the visible allowance itself — minutes x 0.00664 EUR is always a fraction of
   the tier's net revenue, so no per-user euro ceiling is needed;
2. the shared provider pools, in `provider_pool_guard` — Apify credit and
   LlamaParse credits are platform-wide and no per-user allowance can protect them.
The invisible daily burst guards that used to sit between the two were deleted
with task-548: the beta budget bounds what one account can spend.

**The beta is not a plan of this catalogue.** While `beta_access` is open every
account is on the beta formula (task-429, budget of task-548): 5 EUR of provider
usage per calendar month UTC, held before each paid call and settled on its real
cost by `beta_budget`. Its attribution reads the `beta_access` block only — never
`tiers`, never a subscription row, never the free trial — and it carries no minute
allowance: the only minute figure a beta snapshot holds is the per-item audio limit
of the formula. Routing every provider call through the budget is TASK-549; until
then the minute debits below keep writing their counters, and nothing refuses a
beta account on minutes. Both the block and every line reading it are deleted when
the beta ends.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from math import ceil
from typing import Any, Dict, Mapping, Optional, Tuple, TypeGuard

from media_summarizer.core.services import beta_budget, pricing_config_service
from media_summarizer.utils import quota_usage_db

logger = logging.getLogger(__name__)

# Mapping from subscription tier enum (S/M/L) to pricing config tier key
SUBSCRIPTION_TIER_TO_CONFIG: Mapping[str, str] = {
    "S": "text_only",
    "M": "mix",
    "L": "audio_heavy",
}

# The only two refusals the product has. Anything else the enforcer could once
# say (a per-category cap, a daily counter, a per-user euro ceiling) either no
# longer exists or is not a user-visible concept.
ERROR_OUT_OF_MINUTES = "out_of_minutes"
ERROR_ITEM_TOO_LONG = "item_too_long"

# Statuses that keep a subscription entitled.
_ENTITLED_STATUSES = frozenset({"active", "grace_period"})

# What `subscription_status` reports for an account whose only entitlement is the
# beta regime (task-429). Not a store status and never written by the webhook:
# nothing was bought, so no store could ever report it.
BETA_STATUS = "beta"


@dataclass
class QuotaCheckResult:
    """Result of a consumption check.

    Carries the *figures* behind a refusal, never the sentence built from them.
    The client speaks eleven languages and the server speaks none of them: a
    refusal assembled here ("This import needs 12 minutes and you have 3 left
    until Sep 4") would arrive in English on a French phone, and it is the one
    user-facing string the app cannot translate on its own. So the numbers
    travel typed, and the app words them from its own catalogue.
    """

    allowed: bool
    error_code: Optional[str] = None  # stable machine-readable code
    # Figures the client needs to word the refusal. Keys are per error code:
    # `out_of_minutes` -> has_plan, and when a plan exists minutes_needed,
    # minutes_remaining and period_end (ISO 8601, or absent). A beta account is
    # never refused on minutes: its budget refusals belong to `beta_budget`;
    # `item_too_long` -> minutes_needed, max_minutes_per_item.
    params: Dict[str, Any] = field(default_factory=dict)
    http_status: int = 200

    @staticmethod
    def ok() -> "QuotaCheckResult":
        return QuotaCheckResult(allowed=True)

    @staticmethod
    def denied(
        error_code: str,
        params: Optional[Dict[str, Any]] = None,
        http_status: int = 403,
    ) -> "QuotaCheckResult":
        return QuotaCheckResult(
            allowed=False,
            error_code=error_code,
            params=dict(params or {}),
            http_status=http_status,
        )

    def error_body(self) -> Dict[str, Any]:
        """The refusal as an API error body: the code, then its figures, flat.

        Flat rather than nested under `params` so it reads like every other
        typed refusal the artifact endpoints already send (`source_count`,
        `max_sources`, `pending_count`), which the app pulls straight off
        `HttpError.details`.
        """
        return {"error_code": self.error_code or "", **self.params}


@dataclass
class EntitlementSnapshot:
    """Everything the product needs to know about one user's consumption.

    Single source of the figures the account tile, the paywall banner and every
    refusal message are built from, so the gauge the user reads and the gate that
    refuses them can never disagree.
    """

    user_id: str
    # Pricing config tier key, None when the user has neither a subscription nor
    # an active trial.
    tier: Optional[str] = None
    subscription_tier: Optional[str] = None  # store-facing enum (S/M/L)
    subscription_status: Optional[str] = None
    auto_renew: Optional[bool] = None
    is_entitled: bool = False
    is_free_trial: bool = False
    # Whether the account is on the beta formula rather than a plan or a trial
    # (task-429, task-548). The app reads it to hide every route to the paywall and
    # to stop announcing a trial that is not what grants the access. A beta
    # snapshot carries no minute allowance (`minutes_included` is 0): the formula is
    # a budget in euros held by `beta_budget`.
    is_beta_access: bool = False
    minutes_included: int = 0
    minutes_used: int = 0
    max_minutes_per_item: int = 0
    # Set only when a running free trial is what raises a *paid* plan's allowance
    # above what the plan itself grants: the instant the raise expires, i.e. when
    # the figures above drop back to the plan's own. None whenever the allowance is
    # already the plan's (or the trial's, which `is_free_trial` says). The app needs
    # it to announce the drop instead of letting the user discover it.
    trial_raises_allowance_until: Optional[datetime] = None
    period_key: str = ""
    period_end: Optional[datetime] = None
    warning_threshold_pct: int = 80

    @property
    def minutes_remaining(self) -> int:
        """Minutes left, clamped at 0.

        The counter itself is allowed to overshoot the allowance — a settlement
        stores the duration the provider actually billed, which is the truth —
        but the figure the user reads never goes negative.
        """
        return max(0, self.minutes_included - self.minutes_used)

    @property
    def warning_threshold_reached(self) -> bool:
        """Whether the app should warn that the period is running out."""
        if self.minutes_included <= 0:
            return False
        used_pct = (self.minutes_used / self.minutes_included) * 100
        return used_pct >= self.warning_threshold_pct


# ---------------------------------------------------------------------------
# Conversions (benchmark §3.1)
# ---------------------------------------------------------------------------


def minutes_for_seconds(duration_seconds: float) -> int:
    """Minutes charged for a transcription of `duration_seconds`.

    Rounded up, and never zero for media that exists: a 20-second voice note
    still costs a provider call.
    """
    if not duration_seconds or duration_seconds <= 0:
        return 0
    return max(1, ceil(duration_seconds / 60))


async def _conversion(key: str, fallback: int) -> int:
    config = await pricing_config_service.get_pricing_config()
    value = (config.get("unit_conversion", {}) or {}).get(key, fallback)
    try:
        return max(1, int(value))
    except (TypeError, ValueError):
        return fallback


async def minutes_for_captions() -> int:
    """Minutes charged for a caption set we pay a provider to fetch.

    One flat provider fee, so one minute whatever the length of the video.
    """
    return await _conversion("captions_minutes", 1)


async def minutes_for_document_pages(page_count: int) -> int:
    """Minutes charged for a parsed document: one per five pages, minimum one."""
    pages_per_minute = await _conversion("document_pages_per_minute", 5)
    return max(1, ceil(max(1, page_count) / pages_per_minute))


async def minutes_for_folder_sources(source_count: int) -> int:
    """Minutes charged for a generation over a folder: one per five sources.

    A generation over a *single item* is free — its LLM cost is already inside
    what the item cost to ingest.
    """
    sources_per_minute = await _conversion("folder_sources_per_minute", 5)
    return max(1, ceil(max(1, source_count) / sources_per_minute))


async def cost_eur_per_minute() -> float:
    """What one minute costs us, from the single place that knows it."""
    config = await pricing_config_service.get_pricing_config()
    providers = config.get("providers", {}) or {}
    transcription = providers.get("transcription", {}) or {}
    try:
        return float(transcription.get("cost_per_minute_eur", 0.00664))
    except (TypeError, ValueError):
        return 0.00664


# ---------------------------------------------------------------------------
# Entitlement and billing period
# ---------------------------------------------------------------------------


# Opening and closing instants of a free trial. The trial is the only period a
# user gets without paying, and it has exactly one of these for its whole life.
TrialWindow = Tuple[datetime, datetime]


def _trial_period_key(window: TrialWindow) -> str:
    """Counter row key of a free trial: `trial:<YYYY-MM-DD of the account creation>`.

    Keyed on the *opening* of the window, not its close, because a trial holds one
    allowance for its whole life: extending `free_trial.duration_days` must move
    the end date without handing out a second helping of minutes, which is exactly
    what re-keying on the close would do. A subscription keys on its close instead
    — there, a new window is precisely what a new allowance means.
    """
    return f"trial:{window[0].strftime('%Y-%m-%d')}"


def _entitles(sub: Any, now: datetime) -> bool:
    """Whether one subscription row still entitles its holder at `now`."""
    if sub.status.value in _ENTITLED_STATUSES:
        return True
    # A cancelled subscription still entitles until the period it was paid for
    # actually ends.
    return (
        sub.status.value == "canceled"
        and sub.current_period_end is not None
        and sub.current_period_end > now
    )


@dataclass(frozen=True)
class Allowance:
    """The two figures an entitlement grants, and nothing else about it.

    They answer different questions — how much the period holds, and how long a
    single import may be — so they are always carried and compared together but
    never mixed. Whose figures they are (a plan's, a trial's) is not in here on
    purpose: every rule below is arithmetic on pairs, so none of it can grow a
    dependency on the tier catalogue.
    """

    # 0 means no minutes at all: an allowance of 0 refuses every metered import.
    minutes_included: int = 0
    # 0 does *not* mean "no import may be longer than nothing", it means **no cap**
    # — the reading `evaluate_submission` gives it. So on this axis alone 0 is the
    # widest value there is, and the comparisons below have to say so; treating it
    # as the smallest would let a capped allowance take an uncapped one away.
    max_minutes_per_item: int = 0

    def covers(self, other: "Allowance") -> bool:
        """Whether this allowance matches or beats `other` on *both* axes.

        False as soon as `other` is ahead on one of them, which is exactly the
        condition under which comparing the two can still change something.
        """
        return self.minutes_included >= other.minutes_included and (
            self.max_minutes_per_item == 0
            or (
                other.max_minutes_per_item != 0
                and self.max_minutes_per_item >= other.max_minutes_per_item
            )
        )

    def raised_by(self, other: "Allowance") -> "Allowance":
        """The better of the two, axis by axis and each axis on its own.

        Independently rather than "the better one wholesale" because the two
        figures answer different questions: an entitlement ahead on one axis only
        must raise that axis and leave the other alone.
        """
        uncapped = self.max_minutes_per_item == 0 or other.max_minutes_per_item == 0
        return Allowance(
            minutes_included=max(self.minutes_included, other.minutes_included),
            max_minutes_per_item=(
                0
                if uncapped
                else max(self.max_minutes_per_item, other.max_minutes_per_item)
            ),
        )


# Pricing config keys the two figures of an allowance are stored under.
_MINUTES_KEY = "minutes_per_month"
_PER_ITEM_KEY = "max_minutes_per_item"


def _read_allowance(*sources: Mapping[str, Any]) -> Allowance:
    """The allowance the first source that states each figure grants.

    Each figure is resolved on its own, so a source stating one and not the other
    falls through to the next for the missing one only. That is the layering the
    free trial has always had — its own keys first, the config of the tier it names
    behind them — expressed once so nothing has to repeat it.

    A figure no source states, or states as something unusable, is 0: an allowance
    is never invented for a tier the config does not describe. A stored 0 is a
    figure like any other and stops the fallthrough, because a deliberate zero is
    an owner's decision, not a gap.
    """

    def figure(key: str) -> int:
        for source in sources:
            if key in source:
                try:
                    return max(0, int(source[key] or 0))
                except (TypeError, ValueError):
                    return 0
        return 0

    return Allowance(figure(_MINUTES_KEY), figure(_PER_ITEM_KEY))


def _allowance_rank(allowance: Allowance) -> Tuple[int, int]:
    """How wide an allowance is, as a sortable pair: minutes first, then the cap.

    The ordering `_active_subscription` uses when the rows one user holds compete,
    so "the larger allowance" never ranks anything by name.
    """
    return (allowance.minutes_included, allowance.max_minutes_per_item)


def _config_tier(tiers: Mapping[str, Any], subscription_tier: str) -> Optional[str]:
    """The pricing config tier a stored subscription resolves to, or None.

    None both when the store-facing enum maps onto nothing and when it maps onto a
    tier the config no longer describes. **There is no default**: a subscriber whose
    tier was retired must not be silently handed the figures of whichever tier
    happened to be written here as a fallback — that is a stranger's allowance, and
    it would be granted without a trace.
    """
    key = SUBSCRIPTION_TIER_TO_CONFIG.get(subscription_tier)
    return key if key and tiers.get(key) else None


def _tier_allowance(tiers: Mapping[str, Any], tier: Optional[str]) -> Allowance:
    """What one pricing config tier grants; empty when the config has no such tier."""
    return _read_allowance(tiers.get(tier or "", {}) or {})


def _trial_allowance(config: Mapping[str, Any], tiers: Mapping[str, Any]) -> Allowance:
    """What the free trial grants, resolved in the one place that knows how.

    `free_trial`'s own keys first, the config of the tier it names behind them — and
    nothing behind them at all when that tier is absent from `tiers`, so a trial
    pointing at a retired tier contributes exactly what it states itself and no
    allowance is invented for it.

    Says nothing about whether a trial is *running*: that is the window's job.
    """
    free_trial = config.get("free_trial", {}) or {}
    trial_tier = str(free_trial.get("tier", "") or "")
    return _read_allowance(free_trial, tiers.get(trial_tier, {}) or {})


def _row_allowance(tiers: Mapping[str, Any], sub: Any) -> Allowance:
    """The allowance the pricing config gives the tier a row carries.

    A tier the config no longer describes scores an empty allowance — it loses the
    comparison instead of borrowing a neighbour's figures.
    """
    return _tier_allowance(tiers, _config_tier(tiers, sub.tier.value))


async def _active_subscription(user_id: str, tiers: Mapping[str, Any]) -> Optional[Any]:
    """The subscription that entitles the user, or None.

    A user can legitimately hold several rows — the webhook writes one per store
    and per product — so which one decides their allowance must not depend on the
    order the DynamoDB query happens to return. Among the rows that still entitle
    (`active`, `grace_period`, or `canceled` and inside the period it was paid
    for), the winner is the one **whose tier carries the larger allowance in the
    pricing config**: more `minutes_per_month` first, then a higher
    `max_minutes_per_item`, then the period ending last, then the row id so the
    order is total.

    Nothing here ranks the tiers by name. The ordering is whatever
    `pricing_config` says at read time, so the owner moving an allowance — or
    adding, renaming or retiring a tier — moves this choice with it and no code
    has to follow.
    """
    from media_summarizer.utils import minute_db

    subs = await minute_db.get_subscriptions_by_user_id(user_id)
    now = datetime.now(timezone.utc)
    entitled = [sub for sub in subs if _entitles(sub, now)]
    if not entitled:
        return None
    if len(entitled) == 1:
        return entitled[0]

    def rank(sub: Any) -> Tuple[int, int, float, str]:
        period_end = sub.current_period_end
        return (
            *_allowance_rank(_row_allowance(tiers, sub)),
            period_end.timestamp() if period_end else 0.0,
            str(sub.id),
        )

    return max(entitled, key=rank)


async def _free_trial_window(
    user_id: str, config: Mapping[str, Any]
) -> Optional[TrialWindow]:
    """The one billing window the user's free trial has, or None when there is none.

    A trial is a billing period like a subscription's, except it happens once and
    never renews: it opens at the account's creation instant and closes
    `free_trial.duration_days` later. Both the entitlement test and the date the
    app shows are read from this pair, so what refuses an import and what the
    gauge announces can never disagree.
    """
    free_trial = config.get("free_trial", {}) or {}
    if not free_trial.get("enabled"):
        return None

    from media_summarizer.utils import database_async as db

    user = await db.get_user_by_id(user_id)
    if not user:
        return None

    duration_days = int(free_trial.get("duration_days", 30) or 30)
    return user.created_at, user.created_at + timedelta(days=duration_days)


def _is_free_trial_active(
    window: Optional[TrialWindow], now: datetime
) -> TypeGuard[TrialWindow]:
    """Whether `now` is inside the trial window.

    The comparison is strict on the close instant, which is the same instant
    `period_end` announces: the last day of the trial is entitled, the moment it
    closes is not, and no extra day is granted by counting whole days.
    """
    return window is not None and now < window[1]


async def _subscriber_allowance(
    user_id: str,
    config: Mapping[str, Any],
    *,
    paid: Allowance,
    trial: Allowance,
    now: datetime,
) -> Tuple[Allowance, Optional[datetime]]:
    """A subscriber's allowance: `max(trial, paid)` while the trial window is open.

    Buying a plan must never take anything away, so as long as the free trial is
    still running each figure is the larger of the paid tier's and the trial's,
    compared independently. What the user bought is unaffected — `tier`,
    `subscription_tier` and `subscription_status` keep describing the plan, because
    they did buy it; only the figures move.

    **The allowance drops when the window closes.** From the trial's end date the
    paid tier stands alone, so a plan below the trial loses everything the trial was
    adding. That is the decision's intended consequence, not a defect, which is why
    the instant comes back with the figures: the app needs it to announce the drop
    in advance instead of looking broken on the day.

    One consequence of keeping the counter on the subscription's period — which this
    function deliberately does not touch, so that no second helping of minutes is
    handed out mid-window — is that inside the window the subscriber gets the trial's
    allowance **per subscription period rather than once**. Bounded by the length of
    the trial, and in the user's favour.

    The trial window costs a user-row read, and it is only paid for when it can
    change something: both pairs of figures come from the pricing config, already in
    memory, so a plan that already covers the trial on both axes is settled without
    any `GetItem`. Which plans those are is whatever the config says at read time.

    Returns `(allowance, trial_end)`, `trial_end` being None whenever the trial is
    not what raises the figures.
    """
    if paid.covers(trial):
        return paid, None

    window = await _free_trial_window(user_id, config)
    if _is_free_trial_active(window, now):
        return paid.raised_by(trial), window[1]
    return paid, None


async def _plan_snapshot(
    user_id: str,
    config: Mapping[str, Any],
    *,
    now: datetime,
    warning_pct: int,
) -> Optional[EntitlementSnapshot]:
    """The snapshot of a subscription or a running trial, or None when there is neither.

    Only reached when the beta formula is closed: this is the commercial catalogue's
    path, and the beta's never goes through it.
    """
    tiers = config.get("tiers", {}) or {}
    trial = _trial_allowance(config, tiers)
    subscription = await _active_subscription(user_id, tiers)

    if subscription is not None:
        subscription_tier = subscription.tier.value
        tier = _config_tier(tiers, subscription_tier)
        if tier is None:
            # A subscription the pricing config cannot explain. Nothing here may
            # guess an allowance for it — the alternative is handing out some other
            # tier's figures silently — so the user is un-entitled and the owner
            # gets told, loudly, that a stored tier has drifted from the catalogue.
            logger.error(
                "quota.subscription_tier_not_in_pricing_config",
                extra={
                    "user_id": user_id,
                    "subscription_id": str(subscription.id),
                    "subscription_tier": subscription_tier,
                    "config_tiers": sorted(tiers),
                },
            )
            return None

        allowance, trial_raises_until = await _subscriber_allowance(
            user_id,
            config,
            paid=_tier_allowance(tiers, tier),
            trial=trial,
            now=now,
        )
        period_end = subscription.current_period_end
        return EntitlementSnapshot(
            user_id=user_id,
            tier=tier,
            subscription_tier=subscription_tier,
            subscription_status=subscription.status.value,
            auto_renew=subscription.auto_renew_status,
            is_entitled=True,
            minutes_included=allowance.minutes_included,
            max_minutes_per_item=allowance.max_minutes_per_item,
            trial_raises_allowance_until=trial_raises_until,
            period_key=(
                f"sub:{period_end.strftime('%Y-%m-%d')}" if period_end else now.strftime("%Y-%m")
            ),
            period_end=period_end or beta_budget.next_period_start(now),
            warning_threshold_pct=warning_pct,
        )

    trial_window = await _free_trial_window(user_id, config)
    if not _is_free_trial_active(trial_window, now):
        return None
    free_trial = config.get("free_trial", {}) or {}
    return EntitlementSnapshot(
        user_id=user_id,
        tier=str(free_trial.get("tier", "") or "") or None,
        subscription_tier=None,
        subscription_status="free_trial",
        is_entitled=True,
        is_free_trial=True,
        minutes_included=trial.minutes_included,
        max_minutes_per_item=trial.max_minutes_per_item,
        period_key=_trial_period_key(trial_window),
        period_end=trial_window[1],
        warning_threshold_pct=warning_pct,
    )


async def get_entitlement_snapshot(
    user_id: str,
    *,
    with_usage: bool = True,
) -> EntitlementSnapshot:
    """Resolve tier, allowance and consumption for one user.

    The billing period is never the calendar month: it is the window the user's
    entitlement actually runs on, so the counter row is keyed on the same
    `period_end` the app shows and nothing rolls over. For a subscription that is
    its renewal window, emptying on the anniversary; for a free trial it is the
    single window that opens at the account's creation and closes
    `free_trial.duration_days` later, so one trial grants one allowance and
    crossing a month boundary refills nothing.

    A running trial is not cancelled by buying a plan: for a subscriber the
    allowance is `max(trial, paid)` until the window closes — see
    `_subscriber_allowance`, which holds that rule — while the period, the tier and
    the status stay the subscription's.

    While the beta formula is open (`beta_access`, task-429 and task-548), **every**
    account is on it, whatever its creation date and whatever it has bought, and
    nothing else is consulted: no tier of the catalogue, no subscription row, no
    trial window. The snapshot then says `is_beta_access`, has no tier, no minute
    allowance, the formula's per-item audio limit, and the formula's period — the
    calendar month UTC, whose next first instant is `period_end`. The budget itself
    is held by `beta_budget`, not here.

    `with_usage=False` skips reading the counter row, for callers that only need
    to know which row to write to.
    """
    config = await pricing_config_service.get_pricing_config()
    warning_pct = int(
        (config.get("usage_gauge", {}) or {}).get("warning_threshold_pct", 80) or 80
    )
    now = datetime.now(timezone.utc)

    formula = beta_budget.beta_formula(config)
    if formula.is_open(now):
        # The beta formula's own attribution path: built from `beta_access` alone,
        # so moving, renaming or removing a commercial tier cannot change what a
        # tester gets, and a test-store subscription cannot either.
        snapshot = EntitlementSnapshot(
            user_id=user_id,
            subscription_status=BETA_STATUS,
            is_entitled=True,
            is_beta_access=True,
            max_minutes_per_item=formula.item_limits.audio_minutes,
            period_key=beta_budget.period_key(now),
            period_end=beta_budget.next_period_start(now),
            warning_threshold_pct=warning_pct,
        )
    else:
        snapshot_or_none = await _plan_snapshot(user_id, config, now=now, warning_pct=warning_pct)
        if snapshot_or_none is None:
            return EntitlementSnapshot(
                user_id=user_id,
                period_key=now.strftime("%Y-%m"),
                warning_threshold_pct=warning_pct,
            )
        snapshot = snapshot_or_none

    if with_usage:
        usage = await quota_usage_db.get_monthly_usage(user_id, snapshot.period_key)
        snapshot.minutes_used = int(usage.get("minutes_used", 0) or 0)
    return snapshot


async def resolve_period_key(user_id: str) -> str:
    """The counter row key of the user's current billing period."""
    snapshot = await get_entitlement_snapshot(user_id, with_usage=False)
    return snapshot.period_key


# ---------------------------------------------------------------------------
# Copy
# ---------------------------------------------------------------------------


def format_minutes(minutes: int) -> str:
    """Human duration for a minute figure ("45 min", "3 h", "4 h 12 min")."""
    minutes = max(0, int(minutes))
    if minutes < 60:
        return f"{minutes} min"
    hours, rest = divmod(minutes, 60)
    return f"{hours} h" if rest == 0 else f"{hours} h {rest} min"


def _period_end_param(period_end: Optional[datetime]) -> Dict[str, Any]:
    """The period boundary as ISO 8601, or nothing when it is unknown.

    Absent rather than null-and-formatted: the app has a shorter sentence for
    the case with no date, and rendering the date at all is its decision — it
    is the side that knows the reader's locale and calendar.
    """
    return {} if period_end is None else {"period_end": period_end.isoformat()}


# ---------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------


async def check_submission_allowed(
    user_id: str,
    *,
    minutes_needed: int = 0,
) -> QuotaCheckResult:
    """Check whether a submission may proceed.

    `minutes_needed` is what the submission will cost *if it is transcribed*:
    0 for a path that spends no provider minutes (an article, a TikTok), or when
    the duration is not known yet. A path with an unknown duration is accepted
    here and checked again by the transcription gate, which is the only place
    that knows the real length.

    Fails open on purpose: if the entitlement or the counters cannot be read, the
    entitlement is *unknown*, not absent. Locking a paying subscriber out because
    a DynamoDB call failed is worse than letting one submission through. A
    successful read that shows no plan still refuses.
    """
    try:
        snapshot = await get_entitlement_snapshot(user_id)
        return evaluate_submission(snapshot, minutes_needed=minutes_needed)
    except Exception as exc:
        logger.error(
            "quota.check_failed_open",
            extra={
                "user_id": user_id,
                "minutes_needed": minutes_needed,
                "error": str(exc),
                "error_type": type(exc).__name__,
            },
            exc_info=exc,
        )
        return QuotaCheckResult.ok()


def evaluate_submission(
    snapshot: EntitlementSnapshot,
    *,
    minutes_needed: int = 0,
) -> QuotaCheckResult:
    """Pure decision over a snapshot. No I/O, so every caller reads the same rules."""
    if not snapshot.is_entitled:
        # No plan at all, not an allowance run down: the app says "your plan has
        # ended", never a figure. Same code, because upgrading is the answer to
        # both, and `has_plan` is what separates the two sentences.
        return QuotaCheckResult.denied(
            error_code=ERROR_OUT_OF_MINUTES,
            params={"has_plan": False},
            http_status=403,
        )

    if minutes_needed <= 0:
        # Nothing to charge: reading is unlimited on every tier.
        return QuotaCheckResult.ok()

    if (
        snapshot.max_minutes_per_item > 0
        and minutes_needed > snapshot.max_minutes_per_item
    ):
        return QuotaCheckResult.denied(
            error_code=ERROR_ITEM_TOO_LONG,
            params={
                "minutes_needed": minutes_needed,
                "max_minutes_per_item": snapshot.max_minutes_per_item,
            },
            http_status=413,
        )

    if snapshot.is_beta_access:
        # The beta formula has no minute allowance to run down: what bounds a
        # tester's spend is the budget `beta_budget` holds before each paid call
        # (TASK-549 routes every call through it). The per-item limit above is the
        # formula's own, and still applies.
        return QuotaCheckResult.ok()

    if minutes_needed > snapshot.minutes_remaining:
        return QuotaCheckResult.denied(
            error_code=ERROR_OUT_OF_MINUTES,
            params={
                "has_plan": True,
                "minutes_needed": minutes_needed,
                "minutes_remaining": snapshot.minutes_remaining,
                **_period_end_param(snapshot.period_end),
            },
            http_status=403,
        )

    return QuotaCheckResult.ok()


async def check_generation_allowed(
    user_id: str,
    *,
    scope: str,
    source_count: int,
) -> QuotaCheckResult:
    """Gate an AI generation.

    A generation over a single item is free: its LLM cost is already inside what
    the item cost to ingest. A generation over a folder is the only AI action
    whose cost scales with the content behind it, so it converts to minutes at one
    per five sources.

    Fails open like `check_submission_allowed`.
    """
    try:
        snapshot = await get_entitlement_snapshot(user_id)
        minutes_needed = (
            await minutes_for_folder_sources(source_count)
            if scope == "folder"
            else 0
        )
        return evaluate_submission(snapshot, minutes_needed=minutes_needed)
    except Exception as exc:
        logger.error(
            "quota.generation_check_failed_open",
            extra={
                "user_id": user_id,
                "scope": scope,
                "source_count": source_count,
                "error": str(exc),
                "error_type": type(exc).__name__,
            },
            exc_info=exc,
        )
        return QuotaCheckResult.ok()


# ---------------------------------------------------------------------------
# Debits — one per kind of provider spend
# ---------------------------------------------------------------------------


def gate_token(job_id: str) -> str:
    """Idempotency token of the submission-time debit for a job."""
    return f"{job_id}:gate"


def settlement_token(job_id: str) -> str:
    """Idempotency token of the post-transcription settlement for a job."""
    return f"{job_id}:settle"


async def _debit(
    user_id: str,
    *,
    minutes: int,
    idempotency_token: str,
    kind: str,
    period_key: Optional[str] = None,
    unit_cost: Optional[float] = None,
) -> int:
    """Charge `minutes` once for `idempotency_token`.

    `period_key` and `unit_cost`, when given, are the period row and the price of
    a minute the caller already resolved -- a caller that must remember where and
    at what cost a debit landed (a chat turn, which may be refunded) resolves them
    once and passes them, so what it records is what was written.

    Best-effort by design: the provider has already been (or is about to be)
    billed, so a counter write failing must never fail the work the user is
    waiting for. Losing a debit under-counts one item; refusing the item the user
    already paid for is worse.

    Returns the minutes actually debited (0 when the token had already been
    applied, or when the write failed).
    """
    minutes = max(0, int(minutes))
    if minutes <= 0:
        return 0
    try:
        if unit_cost is None:
            unit_cost = await cost_eur_per_minute()
        applied = await quota_usage_db.increment_monthly_usage(
            user_id,
            period_key or await resolve_period_key(user_id),
            minutes=minutes,
            cost_eur=round(minutes * unit_cost, 4),
            idempotency_token=idempotency_token,
        )
    except Exception as exc:
        logger.error(
            "quota.debit_failed",
            extra={
                "user_id": user_id,
                "kind": kind,
                "minutes": minutes,
                "idempotency_token": idempotency_token,
                "error": str(exc),
                "error_type": type(exc).__name__,
            },
            exc_info=exc,
        )
        return 0

    if not applied:
        logger.info(
            "quota.debit_already_applied",
            extra={
                "user_id": user_id,
                "kind": kind,
                "idempotency_token": idempotency_token,
            },
        )
        return 0

    logger.info(
        "quota.debited",
        extra={
            "user_id": user_id,
            "kind": kind,
            "minutes": minutes,
            "idempotency_token": idempotency_token,
        },
    )
    return minutes


async def record_transcription_minutes(
    user_id: str,
    *,
    minutes: int,
    idempotency_token: str,
) -> int:
    """Charge minutes of transcription we are about to pay a provider for."""
    return await _debit(
        user_id,
        minutes=minutes,
        idempotency_token=idempotency_token,
        kind="transcription",
    )


async def record_captions_purchase(user_id: str, *, idempotency_token: str) -> int:
    """Charge the flat unit of a caption set bought from a provider.

    Called where the transcript actually came back, so a video whose captions we
    got for free (or that failed) costs nothing.
    """
    return await _debit(
        user_id,
        minutes=await minutes_for_captions(),
        idempotency_token=idempotency_token,
        kind="captions",
    )


async def record_document_parse(
    user_id: str,
    *,
    page_count: int,
    idempotency_token: str,
) -> int:
    """Charge a parsed document at one minute per five pages, minimum one."""
    pages = max(1, int(page_count or 1))
    return await _debit(
        user_id,
        minutes=await minutes_for_document_pages(pages),
        idempotency_token=idempotency_token,
        kind="document",
    )


async def record_generation(
    user_id: str,
    *,
    scope: str,
    source_count: int,
    idempotency_token: str,
) -> int:
    """Charge one AI generation: nothing over a single item, minutes over a folder."""
    minutes = (
        await minutes_for_folder_sources(source_count) if scope == "folder" else 0
    )
    return await _debit(
        user_id,
        minutes=minutes,
        idempotency_token=idempotency_token,
        kind=f"generation:{scope}",
    )


def chat_turn_token(turn_id: str) -> str:
    """Idempotency token of a chat turn's debit: the logical turn, never an attempt.

    A redelivery, a network resume or a replacement attempt of the same turn finds
    the token already applied, so a turn is charged once whatever happens to its
    generation (Decision point 8 of task-430).
    """
    return f"chat_turn:{turn_id}"


def chat_turn_refund_token(turn_id: str) -> str:
    """Idempotency token of the refund of a chat turn: credited at most once."""
    return f"chat_turn:{turn_id}:refund"


async def minutes_for_chat_turn(source_count: int) -> int:
    """What one chat turn costs: the folder-generation rate, with no media exemption.

    The exemption of a single-item generation rests on "its LLM cost is already
    inside what the item cost to ingest". An ingestion paid one reading of the
    transcript; a conversation of twenty turns pays twenty, so the premise does not
    hold for the chat (task-430 README §9.1).
    """
    return await minutes_for_folder_sources(source_count)


@dataclass(frozen=True)
class ChatTurnDebit:
    """What a chat turn's debit wrote, for the turn to keep and a refund to undo.

    ``minutes`` is 0 when nothing was written -- the token was already applied (a
    replayed request) or the write failed -- and then nothing may be refunded.
    """

    minutes: int
    period_key: str
    cost_eur: float


async def record_chat_turn(
    user_id: str,
    *,
    source_count: int,
    turn_id: str,
) -> ChatTurnDebit:
    """Charge one accepted chat turn, once per logical turn.

    Called after the turn is written, never before: a refusal or a failed write
    must leave no debit. Best-effort like every debit -- a failed counter write is
    logged and the turn goes on.
    """
    minutes = await minutes_for_chat_turn(source_count)
    period_key = await resolve_period_key(user_id)
    unit_cost = await cost_eur_per_minute()
    applied = await _debit(
        user_id,
        minutes=minutes,
        idempotency_token=chat_turn_token(turn_id),
        kind="chat_turn",
        period_key=period_key,
        unit_cost=unit_cost,
    )
    return ChatTurnDebit(
        minutes=applied,
        period_key=period_key,
        cost_eur=round(applied * unit_cost, 4),
    )


async def refund_chat_turn(
    user_id: str,
    *,
    turn_id: str,
    period_key: str,
    minutes: int,
    cost_eur: float,
) -> int:
    """Credit back the debit of a chat turn that produced no answer at all.

    Owner decision of 2026-10-10 ("On rembourse"): a turn sealed ``failed`` with no
    visible text gives its minutes back; a turn that produced text -- completed,
    interrupted, partially failed -- does not. That rule is applied by the caller
    (``chat_service.refund_unanswered_turn``); this is the write.

    The credit lands on ``period_key``, the row the debit was written to, with the
    minutes and cost the turn recorded -- not the current period, not today's price.
    Applied once under :func:`chat_turn_refund_token`. Best-effort like `_debit`: a
    failed write is logged, it does not fail the seal.

    Returns the minutes credited (0 when there was nothing to credit, the refund was
    already applied, or the write failed).
    """
    minutes = max(0, int(minutes))
    if minutes <= 0:
        return 0
    token = chat_turn_refund_token(turn_id)
    try:
        applied = await quota_usage_db.increment_monthly_usage(
            user_id,
            period_key,
            minutes=-minutes,
            cost_eur=-abs(cost_eur),
            idempotency_token=token,
        )
    except Exception as exc:
        logger.error(
            "quota.refund_failed",
            extra={
                "user_id": user_id,
                "kind": "chat_turn",
                "minutes": minutes,
                "period_key": period_key,
                "idempotency_token": token,
                "error": str(exc),
                "error_type": type(exc).__name__,
            },
            exc_info=exc,
        )
        return 0
    if not applied:
        logger.info(
            "quota.refund_already_applied",
            extra={"user_id": user_id, "kind": "chat_turn", "idempotency_token": token},
        )
        return 0
    logger.info(
        "quota.refunded",
        extra={
            "user_id": user_id,
            "kind": "chat_turn",
            "minutes": minutes,
            "period_key": period_key,
            "idempotency_token": token,
        },
    )
    return minutes


async def record_observed_cost(
    user_id: str,
    *,
    cost_eur: float,
    idempotency_token: str,
) -> None:
    """Store a measured provider cost against the period, for observability.

    Nothing reads `cost_eur_estimated` to allow or refuse anything — the minute
    allowance is what bounds spend. This is here so the owner can compare the
    model's assumptions with the real invoice.
    """
    if cost_eur <= 0:
        return
    try:
        await quota_usage_db.increment_monthly_usage(
            user_id,
            await resolve_period_key(user_id),
            cost_eur=cost_eur,
            idempotency_token=idempotency_token,
        )
    except Exception as exc:
        logger.warning(
            "quota.cost_record_failed",
            extra={
                "user_id": user_id,
                "idempotency_token": idempotency_token,
                "error": str(exc),
                "error_type": type(exc).__name__,
            },
        )


# ---------------------------------------------------------------------------
# Transcription gate and settlement
# ---------------------------------------------------------------------------


@dataclass
class TranscriptionGateResult:
    """Outcome of the single gate that guards a transcription enqueue."""

    allowed: bool
    debited_minutes: int = 0
    provisional: bool = False
    error_code: Optional[str] = None
    params: Dict[str, Any] = field(default_factory=dict)
    http_status: int = 200


async def gate_transcription(
    *,
    user_id: str,
    job_id: str,
    duration_seconds: float = 0,
    debit: bool = True,
) -> TranscriptionGateResult:
    """Check and debit, immediately before a transcription is enqueued.

    Every producer that puts a message on the transcription queue calls this and
    forwards `debited_minutes` in the payload, so the settlement in the worker
    only applies the delta with the duration the provider actually billed.

    `duration_seconds <= 0` means the duration could not be established in time.
    The submission is still accepted — refusing a legitimate share because a
    metadata probe timed out is not acceptable — and a provisional single minute
    is debited, which the settlement corrects.

    `debit=False` charges nothing while still running the check, for a save the
    caller established is free (the user already holds this content). The two
    halves are separable on purpose: the debit measures what the user consumed,
    the check protects the provider bill.
    """
    minutes_needed = minutes_for_seconds(duration_seconds) or 1
    check = await check_submission_allowed(user_id, minutes_needed=minutes_needed)
    if not check.allowed:
        return TranscriptionGateResult(
            allowed=False,
            error_code=check.error_code,
            params=check.params,
            http_status=check.http_status,
        )

    if not debit:
        return TranscriptionGateResult(allowed=True, debited_minutes=0)

    debited = await record_transcription_minutes(
        user_id,
        minutes=minutes_needed,
        idempotency_token=gate_token(job_id),
    )
    provisional = duration_seconds <= 0
    logger.info(
        "quota.transcription_gate_debited",
        extra={
            "user_id": user_id,
            "job_id": job_id,
            "duration_seconds": duration_seconds,
            "debited_minutes": debited,
            "provisional": provisional,
        },
    )
    return TranscriptionGateResult(
        allowed=True,
        debited_minutes=debited,
        provisional=provisional,
    )


async def settle_transcription_minutes(
    *,
    user_id: str,
    job_id: str,
    actual_duration_seconds: float,
    already_debited_minutes: int = 0,
) -> int:
    """Reconcile the counter with the duration the provider actually billed.

    Called from the transcription worker with the provider's own duration. Only
    the difference with what the gate debited is applied, under a per-job token,
    so a redelivered message cannot debit twice.

    Overrun policy: the true value is stored even when it takes the user past
    their allowance — the counter is the truth, the display clamps it, and the
    *next* import is refused naturally. Minutes of an import are never refunded,
    so a delta of zero or less is a no-op. The one refund the product has is a
    chat turn that produced no answer (:func:`refund_chat_turn`).
    """
    real_minutes = minutes_for_seconds(actual_duration_seconds)
    if real_minutes <= 0:
        logger.warning(
            "quota.settlement_skipped_no_duration",
            extra={"user_id": user_id, "job_id": job_id},
        )
        return 0

    delta = real_minutes - max(0, already_debited_minutes)
    if delta <= 0:
        logger.info(
            "quota.settlement_no_delta",
            extra={
                "user_id": user_id,
                "job_id": job_id,
                "real_minutes": real_minutes,
                "already_debited_minutes": already_debited_minutes,
            },
        )
        return 0

    applied = await _debit(
        user_id,
        minutes=delta,
        idempotency_token=settlement_token(job_id),
        kind="settlement",
    )
    if applied:
        logger.info(
            "quota.settlement_applied",
            extra={
                "user_id": user_id,
                "job_id": job_id,
                "real_minutes": real_minutes,
                "already_debited_minutes": already_debited_minutes,
                "delta_minutes": delta,
            },
        )
    return applied
