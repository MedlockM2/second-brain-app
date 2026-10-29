# Operator spend control and provider suspension (TASK-566)

Owner decision: [TASK-563, Owner Validation](research/task-563-provider-capacity-fairness-operator-safety/README.md#owner-validation)
(2026-10-29), points 2 to 5, and the sections it validates (§6.1 steps 3-4, §7).
Code: `media_summarizer/core/services/operator_guard.py`, hooked into the ledger of
[BETA_BUDGET_CONTROL.md](BETA_BUDGET_CONTROL.md) (`core/services/beta_budget.py`,
`utils/beta_budget_db.py`). Configuration: `pricing_config.operator_control`.

The 5 EUR of each tester bound what **one** account consumes. They do not bound the
sum of the accounts, the failures handed back to testers (the operator still pays
them), or a provider that answers every new call with the same refusal. This
control adds two things, and nothing else:

1. **Ceilings at the reservation.** A new operation is admitted only if the
   operator's exposure stays under every ceiling, in the same transaction that holds
   it on the tester's month.
2. **A circuit per provider at the claim** `held → sending`. A suspended provider
   gets no new send; what already left completes and is settled.

TASK-564 (shared capacity admission) and TASK-565 (fairness between accounts) are
deferred (Owner Validation point 1). This control does not depend on them: it uses
the existing `reserve` and `held → sending` hooks, and TASK-564 will put its permit
check on the same claim transaction when it resumes.

## 1. Ceilings

| Setting (`pricing_config.operator_control`) | Value | Checked as |
|---|---:|---|
| `monthly_cap_eur` | 500 | `delivered + failed + open commitments + new ≤ cap`, calendar month UTC |
| `loss_reserve_daily_eur` | 5 | `failed today + open commitments + new ≤ 5` |
| `loss_reserve_monthly_eur` | 50 | `failed this month + open commitments + new ≤ 50` |
| `per_active_account_alert_eur` | 2 | alert only: month's spend ÷ accounts active this month |

- **The 500 EUR is a safety ceiling, not a budget target.** Raise it by hand in
  `pricing_config-<env>` (item `operator_control`, `config_value` JSON) as the number
  of accounts grows. The config cache is 5 minutes; no deploy needed.
- **Open commitments count in the loss reserves**, because any call still in flight
  may yet fail (§7.2 of the benchmark). The price: at most about 5 EUR of bounds can
  be open at once, minus today's failures.
- **The largest single commitment is still possible.** No operation can be
  reserved above the tester's own 5 EUR (refused as `budget_exhausted` first), so
  the largest admissible bound equals the daily reserve when nothing else is open.
  In practice the largest bounds of the barème `2026-10-28` (1 EUR = 1.1188 USD) are:
  a 240-minute podcast import with its preview and translation, about 1.10 USD
  (0.98 EUR); a 100-page document, about 0.45 USD, plus 1.50 USD if the Unstructured
  fallback runs as its own try; a chat turn at the model's full 922 000-token input,
  about 0.25 USD. Around five of the largest imports can be in flight together.
- **An unreadable ceiling pauses every new spend** (`operator.bound_missing`, reason
  `operator_config`). There is no fallback amount: a typo is not silently replaced.
- A daily reserve does not reset holds: holds open across midnight still count.

What is counted, from the ledger and nothing else:

| Counted | Not counted |
|---|---|
| Delivered results at their settled cost (`delivered`) | Charged reuse of a content another account paid (no provider call) |
| Released calls at their measured operator cost, or at their bound when the metric is missing (`failed`, of which `failed_bound`) | A release of a call that never left (`not_sent`: zero) |
| Bounds of every open attempt (`held`) | Free volumes and promotional credits (the barème values at normal price) |

A tester's refund (a released hold) never lowers `failed` or `delivered`. A cost the
provider reports after a release is logged (`beta_budget.settle_after_release`,
already alarmed) and not added: see §6.

## 2. Items (table `beta_budget-<env>`, partition `user_id = "operator"`)

| Sort key | Attributes | Written by |
|---|---|---|
| `control` | `held_nano_eur` (open commitments of every account), `version` | every `reserve` (+bound, conditioned on `version`) and every close (−bound) |
| `month#YYYY-MM` | `delivered_nano_eur`, `failed_nano_eur`, `failed_bound_nano_eur`, TTL 400 days after month end | every close, in the month the cost became known |
| `day#YYYY-MM-DD` | `failed_nano_eur`, TTL 400 days | every close with a failure cost |
| `circuit#<provider>` / `circuit#all` | `state`, `suspension_kind`, `suspension_reason`, `epoch`, `open_until`, `backoff_seconds`, `consecutive_failures`, `probe_attempt`, `probe_claimed_at`, `probe_successes`, `owner_note` | circuit transitions, `scripts/operator_control.py` |

No account identity is stored there. The partition is not an account: the TASK-552
report lists it in its own `operator` section, account erasure never reaches it.

**Concurrency.** A ceiling adds figures of several items, which a DynamoDB condition
cannot. An admission reads them, checks them, and commits only if `control.version`
is unchanged; otherwise it reads again (4 tries, then `budget_unavailable`). Every
admission and every close writes `control`: it is the hot item of the table. At beta
scale the conflicts are retried with jitter (5 tries per transaction); if
`beta_budget.unavailable` with "operator commitments kept moving" appears, the
admission rate has outgrown a single counter and TASK-564's design must resume.

## 3. Circuits

`provider` is the attempt's provider: `openai`, `deepgram`, `llamaparse`,
`unstructured`, `apify`, `x_api`. `all` is the manual pause of every new spend.

| From | Event | To |
|---|---|---|
| closed | one **credit exhausted** or **account refused** answer | open, `action_required`; no automatic probe |
| closed | 5 **transient** failures in a row (timeout, lost connection, 5xx) | open, `incident`, wait 30 s or `Retry-After` |
| closed | a success | closed, count reset |
| open `incident` | wait over, next real send | half_open, that send is the probe |
| half_open | probe succeeds | half_open, success count +1; the next send probes |
| half_open | 3rd successful probe | closed |
| half_open | probe fails transiently | open `incident`, wait doubled up to 15 min |
| half_open | probe claimed > 15 min ago, never closed | the next send may take the probe |
| any | owner `resume` | half_open (provider) / closed (`all`) |
| any | owner `suspend` | open, `manual` |

- **A rate limit never opens a circuit.** It is capacity, handled by the workers'
  concurrency and `Retry-After` (decision 459, kept by Owner Validation point 1).
- **A failure of the item itself never opens a circuit**: an unreadable file, a
  private post, an empty transcript. Callers classify with `budget_guard.failure_of`.
- **No threshold on a percentage of a free volume** (Owner Validation point 5).
- The probe is always a real request, already reserved like any other. There is no
  synthetic paid traffic.
- The check is in the claim's transaction. A send claimed just before a circuit
  opens still goes out; nothing cancels a call already sent.

### 3.1 Credit exhausted, per provider

| Provider | Recognised as credit exhausted | Retried? | Source |
|---|---|---|---|
| OpenAI | `utils/llm_failure.py`: billing markers, 402, a bare 429 with no pacing marker → `REFUSAL_QUOTA`, `PERMANENT` | never | already in place (task-327) |
| Deepgram | HTTP 402 → `DeepgramCreditExhaustedError` (documented `err_code` `ASR_PAYMENT_REQUIRED`); 401 or missing key → `DeepgramAccountRefusedError` | never (non-retryable refusal) | [Deepgram errors](https://developers.deepgram.com/docs/errors) |
| LlamaParse | HTTP 402, or 429 whose body names credits/quota/billing/plan → `ParseErrorCode.CREDITS_EXHAUSTED` | never; falls back to Unstructured, as for any LlamaParse error | [LlamaParse troubleshooting](https://developers.llamaindex.ai/llamaparse/general/troubleshooting/) |
| Unstructured | same rule as LlamaParse | never | no documented credit refusal found for the legacy endpoint: 402 is read as one |
| Apify | HTTP 402 → `apify_payment_required` | never | already in place |
| X API | HTTP 402 → `PROVIDER_CREDITS_DEPLETED`; 429 `UsageCapExceeded` / `usage-capped` → same | never | 402 in place; usage cap added |

A suspended LlamaParse sends documents straight to the Unstructured fallback; a
suspended Unstructured with LlamaParse down fails the import (accepted, Owner
Validation point 5).

## 4. What the user sees

A send refused by the control is released at zero cost and refused as
`provider_suspended` (HTTP 503 on synchronous paths, `PROVIDER_SUSPENDED` on a job
or an artifact, retryable). The body carries `retry_at` when the control knows it;
the scope and reason stay in the logs. Mobile and web word it from
`packages/core` (`budget.suspended`): the service is paused, the library stays
available. Reading, organising and every delivered result never come through the
control. The tester's percentage is unchanged.

## 5. Alerts

| Alarm (`operator_control_alerts.tf`, `beta_budget_alerts.tf`) | Fires when |
|---|---|
| `operator-exposure-50`, `operator-exposure-80` | month's exposure reaches 50 % / 80 % of `monthly_cap_eur` |
| `operator-loss-day`, `operator-loss-month` | failures + open commitments reach 80 % of a loss reserve |
| `operator-drift` | month's spend ÷ active accounts above `per_active_account_alert_eur` |
| `operator-circuits` | a circuit or the manual pause is not closed at the audit |
| `budget-operator` | any `operator.suspended`, `operator.limit_refused`, `operator.bound_missing`, `operator.circuit_update_failed` line |

The first five are read every 30 minutes by the budget audit Lambda
(`operator.spend_level`); `budget-audit-missing` already alarms when it stops. The
last one is immediate, from every Lambda's logs. All notify the `pipeline_alerts`
SNS topic. The drift alert tells "each account costs more" apart from "more
accounts": the 500 EUR ceiling alone cannot.

**How an alert reaches the owner.** Alarms are on in dev since TASK-567
(`enable_alarms = true` in `envs/dev/main.tf`, ≈ 3.30 USD/month). Every alarm in
the table, and the other pipeline alarms of the module, publish to the SNS topic
`media-summarizer-pipeline-alerts-dev` on `ALARM` and again on `OK`.
The topic delivers by email to one address, which is never committed (the
repository is public):

- **Subscribe**: pass the address on the apply that creates the topic,
  `terraform apply -var alert_email=<address>` in `envs/dev`, which creates the
  `pipeline_alerts_email` subscription, then click the confirmation link AWS sends.
  Until it is confirmed, nothing is delivered. Without `alert_email`, subscribe
  out-of-band (`aws sns subscribe --protocol email`), and confirm the same way.
- **Delay**: the five audit-driven alarms reach `ALARM` at the first audit after the
  threshold is crossed, so within about 30 minutes; `budget-operator` fires within
  5 minutes of the log line (its period is 300 s).
- **Check end to end**: `aws cloudwatch set-alarm-state --state-value ALARM` on one
  operator alarm must produce an email; the next evaluation brings it back to `OK`.

## 6. Guarantees and residual limits

The control bounds the **new valued authorisations** of every path that goes
through `budget_guard`, at the barème. It does not guarantee a bank debit:

- calls already sent finish and are billed, including past a ceiling reached a
  moment later; an Apify run continues after its Lambda;
- the barème values at normal price; taxes, FX of the bank, subscriptions, rounding
  and invoice cycles of the providers differ;
- a late cost after a release is not added (logged and alarmed); a bound standing in
  for a missing metric can be above or below the real bill (`failed_bound`);
- Algolia searches and records, AWS infrastructure, stores, Cognito, email and
  Sentry are outside the ledger; Algolia has no per-request price in the barème, so
  no search spend is counted here (TASK-563 §3.2 sizes it separately);
- holds created before this control was deployed were never added to `control`; they
  expire within 6 hours on dev, and `held_nano_eur` may read slightly negative until
  then;
- the old `provider_pools` cut at 90 % of the Apify and LlamaParse free volumes is
  still in place; its fate belongs to TASK-557/558, not to this control.

## 7. Runbook

### 7.1 Read the state

```sh
.venv/bin/python scripts/operator_control.py --profile second-brain-app --table beta_budget-dev status
```

It prints open commitments, the month's delivered and failed spend, today's failures
and every circuit that exists. `prod`: `--profile prod --table beta_budget-prod`.

### 7.2 Diagnose an alarm

| Alarm | Look at | Usual cause |
|---|---|---|
| exposure | `status`, TASK-552 report `operator.months` | growth (raise the ceiling) or a heavy account (drift) |
| loss | `status`, Logs Insights `filter event = "beta_budget.released"` by `provider` | an incident: a provider failing after being paid |
| drift | report `rows` sorted by provider cost | a few accounts at their 5 EUR, or retries piling up failures |
| circuits / `operator.suspended` | `status`, the `suspension_reason`, the provider console | credit exhausted, key rotated, provider outage |
| `operator.bound_missing` | `pricing_config-<env>` item `operator_control` | a ceiling mistyped: all new spend is paused |

### 7.3 Suspend and resume

```sh
.venv/bin/python scripts/operator_control.py ... suspend --scope all --note "investigating"
.venv/bin/python scripts/operator_control.py ... suspend --scope deepgram --note "outage"
.venv/bin/python scripts/operator_control.py ... resume --scope deepgram
.venv/bin/python scripts/operator_control.py ... resume --scope all
```

Before resuming a provider suspended for an action: fix the cause in its console
(top up, rotate the key), then `resume`. The provider goes `half_open`: the next real
request probes it; three successes close it, a failure reopens it. Do not clear
`probe_attempt` by hand to "unblock" it: a probe older than 15 minutes is taken over
automatically. An incident reopens on its own after its wait; resume it by hand only
when the provider's status page says the incident is over.

### 7.4 Console checklist (owner, not a delivery gate)

Coherent with TASK-557/558, which own plans, recharges, credits and `provider_pools`:

1. OpenAI: confirm the hard spend limit of the organisation/project and its scope;
   a recharge threshold is not a ceiling. Launch tier deposit: TASK-558.
2. Deepgram: confirm the project's balance and whether an overage agreement exists
   (without one, an empty balance answers 402, which suspends Deepgram here).
3. LlamaParse: the optional spend limit of paid plans caps the overage only.
4. Unstructured: confirm the billing unit and the refusal of the legacy endpoint.
5. Apify: confirm the monthly usage hard limit of each account.
6. X API: confirm the prepaid balance, the cycle cap and auto-recharge.
7. Never copy a balance, a token or an account identity into a tracked file.

**After merge and push** (owner): the code deploys with `main`; the alarms need the
Terraform apply of `operator_control_alerts.tf` and the audit role's new read on the
`operator` partition. Then `status` on dev should show the operator figures moving
with normal dev use.
