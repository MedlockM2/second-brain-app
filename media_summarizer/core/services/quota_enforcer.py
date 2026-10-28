"""
Who an account is entitled as, for the app's account screen.

What this module still owns is the **entitlement snapshot**: whether the account is
on the beta formula, on a commercial plan or on the free trial, and the figures the
entitlements endpoint shows for it. It no longer meters anything. The minute
allowance of task-287 — its debits, its settlement after transcription, its refund
of an unanswered chat turn and the fail-open submission check — was removed by
task-549: every paid provider call is now held and settled in euros by the beta
budget (``core/services/beta_budget.py``, routed by ``core/services/budget_guard.py``;
``docs/BETA_BUDGET_CONTROL.md``), and nothing writes or reads a minute counter any
more. The minute fields the snapshot still carries are 0 for a beta account and are
removed from the contract by TASK-550.

**The beta is not a plan of this catalogue.** While `beta_access` is open every
account is on the beta formula (task-429, budget of task-548): 5 EUR of provider
usage per calendar month UTC. Its attribution reads the `beta_access` block only —
never `tiers`, never a subscription row, never the free trial. When the formula is
closed, the budget grants nothing (`not_entitled`): the commercial catalogue below
still describes a subscriber's plan, but no allowance of it is enforced until the
offers of R.3 (``docs/research/pricing-challenge/README.md``) are rebuilt on the
budget. Both the block and every line reading it are deleted when the beta ends.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping, Optional, Tuple, TypeGuard

from media_summarizer.core.services import beta_budget, pricing_config_service

logger = logging.getLogger(__name__)

# Mapping from subscription tier enum (S/M/L) to pricing config tier key
SUBSCRIPTION_TIER_TO_CONFIG: Mapping[str, str] = {
    "S": "text_only",
    "M": "mix",
    "L": "audio_heavy",
}

# Statuses that keep a subscription entitled.
_ENTITLED_STATUSES = frozenset({"active", "grace_period"})

# What `subscription_status` reports for an account whose only entitlement is the
# beta regime (task-429). Not a store status and never written by the webhook:
# nothing was bought, so no store could ever report it.
BETA_STATUS = "beta"


@dataclass
class EntitlementSnapshot:
    """Everything the account screen needs to know about one user's entitlement.

    Single source of the figures the entitlements endpoint returns. The minute
    figures describe the commercial catalogue's allowance; since task-549 no
    counter backs ``minutes_used`` (always 0) and TASK-550 replaces the whole
    gauge with the beta budget's percentage.
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
        """Minutes left, clamped at 0."""
        return max(0, self.minutes_included - self.minutes_used)

    @property
    def warning_threshold_reached(self) -> bool:
        """Whether the app should warn that the period is running out."""
        if self.minutes_included <= 0:
            return False
        used_pct = (self.minutes_used / self.minutes_included) * 100
        return used_pct >= self.warning_threshold_pct


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
) -> EntitlementSnapshot:
    """Resolve tier, allowance and period for one user.

    The billing period of a plan is never the calendar month: it is the window the
    user's entitlement actually runs on, keyed on the same `period_end` the app
    shows. For a subscription that is
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

    No consumption is read: no minute counter exists since task-549, so
    `minutes_used` stays 0 until TASK-550 removes it.
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
    return snapshot

